import { isSampledPatch } from './sampled_piano.js';
/**
 * Web Audio synthesis voices for all 7 heavy-bass synth roles + 110 BPM Punch Drums
 */
import { createWavefolderCurve } from "./master_bus.js";
import { standInLevel } from "../theory/scene_voice_levels.js";

export const VOWEL_FORMANTS = {
  A: [730, 1090, 2440, 900],
  E: [530, 1840, 2480, 1150],
  I: [270, 2290, 3010, 1350],
  O: [570, 840, 2410, 700],
  U: [300, 870, 2240, 580],
};

export const LFO_DIVISIONS = {
  off: 0,
  "1/2": 0.5,
  "1/4": 1.0,
  "1/8": 2.0,
  "1/8t": 3.0,
  "1/16": 4.0,
  "1/32": 8.0,
};

// Phase 9b: three drum kits chosen by ear. "punchy" is the original sound. The clap is its own sound
// (three quick band-passed noise bursts, no drum body), so a clap row never sounds like a snare.
export const DRUM_KITS = {
  punchy: { kickHi: 165, kickLo: 49, kickDrop: 0.045, kickDecay: 0.18, snareHp: 1100, snareDecay: 0.14, clapBp: 1500, clapTail: 0.12, hatHp: 6500, hatDecay: 0.045 },
  soft: { kickHi: 120, kickLo: 45, kickDrop: 0.06, kickDecay: 0.28, snareHp: 600, snareDecay: 0.22, clapBp: 1000, clapTail: 0.18, hatHp: 4000, hatDecay: 0.06 },
  tiny: { kickHi: 220, kickLo: 70, kickDrop: 0.03, kickDecay: 0.09, snareHp: 2000, snareDecay: 0.08, clapBp: 2200, clapTail: 0.07, hatHp: 9000, hatDecay: 0.03 },
};

function routeEventDest(ctx, baseDest, pan) {
  if (pan === undefined || pan === null || !ctx.createStereoPanner) return baseDest;
  const p = Math.max(-1.0, Math.min(1.0, Number(pan) || 0));
  if (Math.abs(p) < 0.01) return baseDest;
  const panner = ctx.createStereoPanner();
  panner.pan.value = p;
  panner.connect(baseDest);
  return panner;
}

function extractSoundSeed(event) {
  const ev = event || {};
  const seed = ev.sound_seed || {};
  const xy = ev.gesture?.xy_pad || {};
  let bright = Number(seed.brightness ?? 0.5);
  if (xy.y !== undefined) {
    bright = Math.max(0.15, Math.min(0.95, 0.5 * bright + 0.5 * Number(xy.y)));
  }
  const warmth = Math.max(0.15, Math.min(0.95, Number(seed.warmth ?? 0.5)));
  const width = Math.max(0.15, Math.min(0.95, Number(seed.width ?? 0.5)));
  return { bright, warmth, width };
}

// `synthDest`/`drumDest` let a live press use its own release gain instead of the band's buses.
export function triggerScheduledEvent(audioCtx, masterBus, event, exactTime, bpm = 110,
  { synthDest: synthBase = masterBus.synthBus, drumDest = masterBus.drumBus, answer = false } = {}) {
  if (isSampledPatch(event.patch_id)) {
    if (!masterBus.piano) throw Error('Load sounds before playing. Your notes are preserved.');
    return masterBus.piano.trigger(event, exactTime, false, answer);
  }
  const role = event.role || "hocket";
  const patchId = event.patch_id || "monster_growl";
  const dur = Math.max(0.05, Number(event.duration_sec || 0.25));
  const value = Number(event.velocity ?? .85) * (event.loading_voice ? standInLevel(event.role) : 1);
  const vel = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .85;
  if (vel === 0) return;
  const freq = Number(event.concrete?.freq_hz || 55.0);
  const gesture = event.gesture || {};
  const synthDest = routeEventDest(audioCtx, synthBase, event.pan);

  if (role === "drums" || ["kick", "snare", "clap", "hat_closed", "hat_open", "perc"].includes(patchId)) {
    if (patchId === "kick" || patchId === "snare" || patchId === "clap") {
      masterBus.scheduleSidechainDuck(exactTime, event.style_weight ?? 1);
    }
    triggerDrumVoice(audioCtx, drumDest, patchId, exactTime, dur, vel, event.drum_kit);
    return;
  }

  if (patchId === "reverse_swell") {
    triggerReverseSwellVoice(audioCtx, synthDest, freq, exactTime, dur, vel);
  } else if (patchId === "monster_growl" || patchId === "talking_yoi") {
    triggerGrowlVoice(audioCtx, synthDest, freq, exactTime, dur, vel, gesture, bpm, patchId === "talking_yoi");
  } else if (patchId === "clean_bass") {
    triggerCleanBassVoice(audioCtx, synthDest, freq, exactTime, dur, vel);
  } else if (patchId === "wobble_bass" || patchId === "sub_drop_808") {
    triggerWobbleVoice(audioCtx, synthDest, freq, exactTime, dur, vel, gesture, bpm, patchId === "sub_drop_808");
  } else if (patchId === "laser_screech") {
    triggerLaserVoice(audioCtx, synthDest, freq, exactTime, dur, vel, gesture);
  } else if (patchId === "vocal_chop") {
    triggerVocalChopVoice(audioCtx, synthDest, freq, exactTime, dur, vel, gesture, bpm);
  } else if (patchId === "warm_keys") {
    const freqs = event.voiced_freqs || [freq];
    triggerWarmKeysVoice(audioCtx, synthDest, freqs, exactTime, dur, vel, event);
  } else if (patchId === "pluck_lead") {
    triggerPluckLeadVoice(audioCtx, synthDest, freq, exactTime, dur, vel, event);
  } else {
    const freqs = event.voiced_freqs || (role === "lead" ? [freq] : [freq, freq * 1.2, freq * 1.5]);
    triggerSupersawStab(audioCtx, synthDest, freqs, exactTime, dur, vel, event);
  }
}

function triggerGrowlVoice(ctx, dest, freq, t0, dur, vel, gesture, bpm, isYoi) {
  const vStart = VOWEL_FORMANTS[gesture.vowel_start || (isYoi ? "I" : "O")] || VOWEL_FORMANTS.O;
  const vEnd = VOWEL_FORMANTS[gesture.vowel_end || (isYoi ? "O" : "I")] || VOWEL_FORMANTS.I;
  const grit = Number(gesture.grit ?? 0.82);

  // Clean phase-locked sub (<110 Hz)
  let subHz = freq;
  while (subHz > 95) subHz *= 0.5;
  while (subHz < 38) subHz *= 2.0;

  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(subHz, t0);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.001, t0);
  subGain.gain.linearRampToValueAtTime(0.45 * vel, t0 + 0.006);
  subGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  subOsc.connect(subGain);
  subGain.connect(dest);

  // 3-Op FM Mid Growl
  const carrier = ctx.createOscillator();
  carrier.type = "sawtooth";
  carrier.frequency.setValueAtTime(freq, t0);

  const mod1 = ctx.createOscillator();
  mod1.type = "sine";
  mod1.frequency.setValueAtTime(freq * 2.0, t0);
  const mod1Gain = ctx.createGain();
  const peakIdx1 = freq * (1.2 + 4.5 * grit);
  mod1Gain.gain.setValueAtTime(peakIdx1 * 0.25, t0);
  mod1Gain.gain.linearRampToValueAtTime(peakIdx1, t0 + dur * 0.6);
  mod1Gain.gain.linearRampToValueAtTime(peakIdx1 * 0.2, t0 + dur);

  const mod2 = ctx.createOscillator();
  mod2.type = "sine";
  mod2.frequency.setValueAtTime(freq * (isYoi ? 3.0 : 4.0), t0);
  const mod2Gain = ctx.createGain();
  const peakIdx2 = freq * (0.8 + 3.6 * grit);
  mod2Gain.gain.setValueAtTime(peakIdx2 * 0.15, t0);
  mod2Gain.gain.linearRampToValueAtTime(peakIdx2, t0 + dur * 0.6);
  mod2Gain.gain.linearRampToValueAtTime(peakIdx2 * 0.15, t0 + dur);

  mod1.connect(mod1Gain);
  mod1Gain.connect(carrier.frequency);
  mod2.connect(mod2Gain);
  mod2Gain.connect(carrier.frequency);

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(120, t0);

  const shaper = ctx.createWaveShaper();
  shaper.curve = createWavefolderCurve(grit);
  shaper.oversample = "2x";

  const notch = ctx.createBiquadFilter();
  notch.type = "notch";
  notch.Q.value = 5.5;
  notch.frequency.setValueAtTime(vStart[3], t0);
  notch.frequency.exponentialRampToValueAtTime(vEnd[3], t0 + dur * 0.65);

  const bp1 = ctx.createBiquadFilter();
  bp1.type = "bandpass";
  bp1.Q.value = 7.0;
  bp1.frequency.setValueAtTime(vStart[0], t0);
  bp1.frequency.exponentialRampToValueAtTime(vEnd[0], t0 + dur * 0.65);

  const bp2 = ctx.createBiquadFilter();
  bp2.type = "bandpass";
  bp2.Q.value = 8.5;
  bp2.frequency.setValueAtTime(vStart[1], t0);
  bp2.frequency.exponentialRampToValueAtTime(vEnd[1], t0 + dur * 0.65);

  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.001, t0);
  envGain.gain.linearRampToValueAtTime(0.85 * vel, t0 + 0.005);
  envGain.gain.setValueAtTime(0.85 * vel, Math.max(t0 + 0.01, t0 + dur - 0.02));
  envGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  carrier.connect(hp);
  hp.connect(shaper);
  shaper.connect(notch);
  notch.connect(bp1);
  notch.connect(bp2);
  bp1.connect(envGain);
  bp2.connect(envGain);
  envGain.connect(dest);

  subOsc.start(t0);
  subOsc.stop(t0 + dur + 0.02);
  carrier.start(t0);
  carrier.stop(t0 + dur + 0.02);
  mod1.start(t0);
  mod1.stop(t0 + dur + 0.02);
  mod2.start(t0);
  mod2.stop(t0 + dur + 0.02);
}

function triggerWobbleVoice(ctx, dest, freq, t0, dur, vel, gesture, bpm, isSubDrop) {
  if (isSubDrop) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(135, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85 * vel, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    return;
  }

  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(freq, t0);
  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.setValueAtTime(freq * 1.005, t0);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 4.2;
  filter.frequency.setValueAtTime(320, t0);

  const lfoDiv = LFO_DIVISIONS[gesture.lfo_rate || "1/16"] || 4.0;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime((bpm / 60) * lfoDiv, t0);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(1800, t0);
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, t0);
  env.gain.linearRampToValueAtTime(0.75 * vel, t0 + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(env);
  env.connect(dest);

  osc1.start(t0);
  osc1.stop(t0 + dur + 0.02);
  osc2.start(t0);
  osc2.stop(t0 + dur + 0.02);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.02);
}

function triggerLaserVoice(ctx, dest, freq, t0, dur, vel, gesture) {
  const bendSt = Number(gesture.pitch_bend_st ?? 12);
  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  const osc2 = ctx.createOscillator();
  osc2.type = "square";

  const startFreq = freq * Math.pow(2, bendSt / 12);
  osc1.frequency.setValueAtTime(startFreq, t0);
  osc1.frequency.exponentialRampToValueAtTime(freq, t0 + Math.min(0.042, dur * 0.5));
  osc2.frequency.setValueAtTime(startFreq * 2, t0);
  osc2.frequency.exponentialRampToValueAtTime(freq * 2, t0 + Math.min(0.042, dur * 0.5));

  const shaper = ctx.createWaveShaper();
  shaper.curve = createWavefolderCurve(Number(gesture.grit ?? 0.85));

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, t0);
  env.gain.linearRampToValueAtTime(0.7 * vel, t0 + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  osc1.connect(shaper);
  osc2.connect(shaper);
  shaper.connect(env);
  env.connect(dest);

  osc1.start(t0);
  osc1.stop(t0 + dur + 0.02);
  osc2.start(t0);
  osc2.stop(t0 + dur + 0.02);
}

function triggerVocalChopVoice(ctx, dest, freq, t0, dur, vel, gesture, bpm) {
  const vStart = VOWEL_FORMANTS[gesture.vowel_start || "A"] || VOWEL_FORMANTS.A;
  const vEnd = VOWEL_FORMANTS[gesture.vowel_end || "I"] || VOWEL_FORMANTS.I;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, t0);

  const bp1 = ctx.createBiquadFilter();
  bp1.type = "bandpass";
  bp1.Q.value = 9.0;
  bp1.frequency.setValueAtTime(vStart[0] * 1.22, t0);
  bp1.frequency.exponentialRampToValueAtTime(vEnd[0] * 1.22, t0 + dur);

  const bp2 = ctx.createBiquadFilter();
  bp2.type = "bandpass";
  bp2.Q.value = 9.5;
  bp2.frequency.setValueAtTime(vStart[1] * 1.22, t0);
  bp2.frequency.exponentialRampToValueAtTime(vEnd[1] * 1.22, t0 + dur);

  const gateGain = ctx.createGain();
  const divMult = LFO_DIVISIONS[gesture.stutter_div || "1/32"] || 8.0;
  const sliceSec = 1.0 / ((bpm / 60) * divMult);
  for (let t = t0; t < t0 + dur; t += sliceSec) {
    gateGain.gain.setValueAtTime(0.78 * vel, t);
    gateGain.gain.setValueAtTime(0.06 * vel, Math.min(t0 + dur, t + sliceSec * 0.6));
  }
  gateGain.gain.setValueAtTime(0.001, t0 + dur);

  osc.connect(bp1);
  osc.connect(bp2);
  bp1.connect(gateGain);
  bp2.connect(gateGain);
  gateGain.connect(dest);

  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function triggerSupersawStab(ctx, dest, freqs, t0, dur, vel, event = null) {
  const { bright, warmth, width } = extractSoundSeed(event);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600 + 2800 * bright, t0);
  filter.frequency.exponentialRampToValueAtTime(900 + 1000 * warmth, t0 + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, t0);
  env.gain.linearRampToValueAtTime(0.32 * vel, t0 + 0.004);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  filter.connect(env);
  env.connect(dest);

  const spread = 10 + 14 * width;
  const detunes = [-spread, 0, spread];
  for (const f of freqs) {
    for (const det of detunes) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t0);
      osc.detune.setValueAtTime(det, t0);
      osc.connect(filter);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }
}

function triggerCleanBassVoice(ctx, dest, freq, t0, dur, vel) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(580, t0);
  filter.frequency.exponentialRampToValueAtTime(240, t0 + dur);
  filter.Q.value = 0.9;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, t0);
  env.gain.linearRampToValueAtTime(0.68 * vel, t0 + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(freq, t0);

  const warmOsc = ctx.createOscillator();
  warmOsc.type = "triangle";
  warmOsc.frequency.setValueAtTime(freq, t0);

  subOsc.connect(filter);
  warmOsc.connect(filter);
  filter.connect(env);
  env.connect(dest);

  subOsc.start(t0);
  subOsc.stop(t0 + dur + 0.02);
  warmOsc.start(t0);
  warmOsc.stop(t0 + dur + 0.02);
}

function triggerWarmKeysVoice(ctx, dest, freqs, t0, dur, vel, event = null) {
  const { bright, warmth, width } = extractSoundSeed(event);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400 + 1800 * bright, t0);
  filter.frequency.exponentialRampToValueAtTime(800 + 700 * warmth, t0 + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, t0);
  env.gain.linearRampToValueAtTime(0.38 * vel, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  filter.connect(env);
  env.connect(dest);

  for (const f of freqs) {
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = "sine";
    bodyOsc.frequency.setValueAtTime(f, t0);
    bodyOsc.connect(filter);
    bodyOsc.start(t0);
    bodyOsc.stop(t0 + dur + 0.02);

    const chorusOsc = ctx.createOscillator();
    chorusOsc.type = "triangle";
    chorusOsc.frequency.setValueAtTime(f, t0);
    chorusOsc.detune.setValueAtTime(4 + 8 * width, t0);
    const chGain = ctx.createGain();
    chGain.gain.setValueAtTime(0.24 + 0.18 * warmth, t0);
    chorusOsc.connect(chGain);
    chGain.connect(filter);
    chorusOsc.start(t0);
    chorusOsc.stop(t0 + dur + 0.02);

    // Gentle Rhodes tine bell attack
    const tineOsc = ctx.createOscillator();
    tineOsc.type = "sine";
    tineOsc.frequency.setValueAtTime(f * 4.0, t0);
    const tineGain = ctx.createGain();
    tineGain.gain.setValueAtTime(0.07 + 0.10 * bright, t0);
    tineGain.gain.exponentialRampToValueAtTime(0.001, t0 + Math.min(0.14, dur));
    tineOsc.connect(tineGain);
    tineGain.connect(filter);
    tineOsc.start(t0);
    tineOsc.stop(t0 + Math.min(0.16, dur + 0.02));
  }
}

function triggerPluckLeadVoice(ctx, dest, freq, t0, dur, vel, event = null) {
  const { bright, warmth, width } = extractSoundSeed(event);
  const transition = event?.transition || null;
  const prevFreq = Number(event?.prev_freq_hz || freq);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2400 + 2800 * bright, t0);
  filter.frequency.exponentialRampToValueAtTime(520 + 420 * warmth, t0 + Math.min(0.32, dur));
  filter.Q.value = 1.25;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, t0);
  env.gain.linearRampToValueAtTime(0.55 * vel, t0 + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const osc1 = ctx.createOscillator();
  osc1.type = "triangle";
  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.detune.setValueAtTime(3 + 6 * width, t0);

  if (transition === "slide" && Math.abs(prevFreq - freq) > 1.0) {
    const glide = Math.min(0.065, dur * 0.35);
    osc1.frequency.setValueAtTime(prevFreq, t0);
    osc1.frequency.exponentialRampToValueAtTime(freq, t0 + glide);
    osc2.frequency.setValueAtTime(prevFreq, t0);
    osc2.frequency.exponentialRampToValueAtTime(freq, t0 + glide);
  } else if (transition === "bounce") {
    const graceFreq = freq * Math.pow(2, 2 / 12);
    osc1.frequency.setValueAtTime(graceFreq, t0);
    osc1.frequency.setValueAtTime(freq, t0 + Math.min(0.035, dur * 0.4));
    osc2.frequency.setValueAtTime(graceFreq, t0);
    osc2.frequency.setValueAtTime(freq, t0 + Math.min(0.035, dur * 0.4));
  } else {
    osc1.frequency.setValueAtTime(freq, t0);
    osc2.frequency.setValueAtTime(freq, t0);
  }

  const sawGain = ctx.createGain();
  sawGain.gain.setValueAtTime(0.28 + 0.16 * bright, t0);

  // Rings wooden marimba bar mode (3.98x fundamental)
  const modalOsc = ctx.createOscillator();
  modalOsc.type = "sine";
  modalOsc.frequency.setValueAtTime(Math.min(9000, freq * 3.98), t0);
  const modalGain = ctx.createGain();
  modalGain.gain.setValueAtTime(0.18 * (0.6 + 0.6 * bright), t0);
  modalGain.gain.exponentialRampToValueAtTime(0.001, t0 + Math.min(0.12, dur));

  osc1.connect(filter);
  osc2.connect(sawGain);
  sawGain.connect(filter);
  modalOsc.connect(modalGain);
  modalGain.connect(filter);
  filter.connect(env);
  env.connect(dest);

  osc1.start(t0);
  osc1.stop(t0 + dur + 0.02);
  osc2.start(t0);
  osc2.stop(t0 + dur + 0.02);
  modalOsc.start(t0);
  modalOsc.stop(t0 + Math.min(0.14, dur + 0.02));

  if (transition === "sparkle" && dur >= 0.09) {
    const sparkOsc = ctx.createOscillator();
    sparkOsc.type = "sine";
    sparkOsc.frequency.setValueAtTime(Math.min(9000, freq * 1.498), t0 + 0.055);
    const sparkGain = ctx.createGain();
    sparkGain.gain.setValueAtTime(0.001, t0 + 0.055);
    sparkGain.gain.linearRampToValueAtTime(0.18 * vel, t0 + 0.065);
    sparkGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    sparkOsc.connect(sparkGain);
    sparkGain.connect(dest);
    sparkOsc.start(t0 + 0.055);
    sparkOsc.stop(t0 + dur + 0.02);
  }
}

function triggerReverseSwellVoice(ctx, dest, freq, t0, dur, vel) {
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, t0);
  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq * 2.0, t0);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 2.6;
  filter.frequency.setValueAtTime(Math.max(220, freq), t0);
  filter.frequency.exponentialRampToValueAtTime(Math.min(7200, freq * 4.0), t0 + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.002, t0);
  env.gain.exponentialRampToValueAtTime(0.45 * vel, Math.max(t0 + 0.02, t0 + dur - 0.015));
  env.gain.linearRampToValueAtTime(0.001, t0 + dur + 0.01);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(env);
  env.connect(dest);

  osc1.start(t0);
  osc1.stop(t0 + dur + 0.02);
  osc2.start(t0);
  osc2.stop(t0 + dur + 0.02);
}

export function triggerDrumVoice(ctx, dest, patchId, t0, dur, vel, kitId = "punchy") {
  const kit = DRUM_KITS[kitId] || DRUM_KITS.punchy;
  if (patchId === "kick") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(kit.kickHi, t0);
    osc.frequency.exponentialRampToValueAtTime(kit.kickLo, t0 + kit.kickDrop);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95 * vel, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + kit.kickDecay);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + kit.kickDecay + 0.02);
    return;
  }

  if (patchId === "clap") {
    const len = 0.022 + kit.clapTail;
    const bufLen = Math.floor(ctx.sampleRate * len);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(kit.clapBp, t0);
    bp.Q.setValueAtTime(1.4, t0);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t0);
    for (const b of [0, 0.011, 0.022]) {
      g.gain.setValueAtTime(0.9 * vel, t0 + b);
      g.gain.exponentialRampToValueAtTime(0.12 * vel, t0 + b + 0.009);
    }
    g.gain.setValueAtTime(0.5 * vel, t0 + 0.031);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noise.start(t0);
    return;
  }

  if (patchId === "snare") {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(210, t0);
    osc.frequency.exponentialRampToValueAtTime(130, t0 + 0.06);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.65 * vel, t0);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + 0.10);

    const bufLen = Math.floor(ctx.sampleRate * kit.snareDecay);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(kit.snareHp, t0);
    const nGain = ctx.createGain();
    nGain.gain.value = 0;
    nGain.gain.setValueAtTime(0.6 * vel, t0);
    nGain.gain.exponentialRampToValueAtTime(0.001, t0 + kit.snareDecay);
    noise.connect(hp);
    hp.connect(nGain);
    nGain.connect(dest);
    noise.start(t0);
    return;
  }

  // Metallic Hi-Hat
  const decay = patchId === "hat_open" ? 0.16 : kit.hatDecay;
  const bufLen = Math.floor(ctx.sampleRate * decay);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(kit.hatHp, t0);
  const gain = ctx.createGain();
  // Silence before the envelope: fractional sample onsets can precede t0.
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.38 * vel, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + decay);
  noise.connect(hp);
  hp.connect(gain);
  gain.connect(dest);
  noise.start(t0);
}
