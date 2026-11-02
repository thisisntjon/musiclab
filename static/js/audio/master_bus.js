/**
 * Native tone/reverb and separate sampled/drum routing through master safety and volume.
 */

export const SAFETY_CEILING = 0.708; // -3 dBFS; mirrored by TARGET_PEAK in src/audio_engine/synth.py
export const DEFAULT_VOLUME = 0.8;
export const FADE_IN_SECONDS = 0.4;
export const STOP_FADE_SECONDS = 0.008;

/**
 * Safety ceiling curve: linear below a knee, then a soft limit that approaches but never exceeds `ceiling`.
 * WaveShaper clamps inputs outside [-1, 1] to the curve ends, so no input can exceed the ceiling.
 */
export function createSafetyCeilingCurve(ceiling = SAFETY_CEILING, n = 4096) {
  const knee = ceiling * 0.85;
  const span = ceiling - knee;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + span * Math.tanh((ax - knee) / span);
    curve[i] = Math.sign(x) * Math.min(y, ceiling);
  }
  return curve;
}

export function createWavefolderCurve(grit = 0.8) {
  const n = 4096;
  const curve = new Float32Array(n);
  const drive = 1.4 + 4.2 * Math.max(0, Math.min(1, grit));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const asym = 0.18 * x * x;
    curve[i] = Math.tanh(1.65 * Math.sin(drive * x + asym) + 0.35 * Math.tanh(2.8 * x));
  }
  return curve;
}

export function createOTTCurve(ottPunch = 0.85) {
  const n = 4096;
  const curve = new Float32Array(n);
  const amt = Math.max(0, Math.min(1, ottPunch));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const ax = Math.abs(x);
    if (ax < 0.001) {
      curve[i] = 0;
      continue;
    }
    const sign = x >= 0 ? 1 : -1;
    let wet;
    if (ax < 0.005) {
      wet = sign * (ax / 0.005) * Math.tanh(1.5 * Math.pow(0.005, 0.68));
    } else {
      wet = sign * Math.tanh(1.5 * Math.pow(ax, 0.68) + 0.75 * ax);
    }
    curve[i] = (1 - amt) * Math.tanh(x) + amt * wet;
  }
  return curve;
}

export function createImpulseResponse(audioCtx, durationSec = 1.6, decay = 2.6) {
  const rate = audioCtx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const impulse = audioCtx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.08;
      b1 = 0.96 * b1 + white * 0.12;
      const env = Math.pow(1 - i / length, decay);
      data[i] = (b0 + b1) * env * 0.38;
    }
  }
  return impulse;
}

export class MasterBus {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.disposed = false;
    this.ottPunch = 0.85;
    this.drumBus = audioCtx.createGain();
    this.synthBus = audioCtx.createGain();
    this.duckGain = audioCtx.createGain();
    this.synthBus.connect(this.duckGain);

    // 3-Band OTT Crossover on Synth/Bass Bus (Low < 120Hz, Mid 120-2500Hz, High > 2500Hz)
    this.lowLP = audioCtx.createBiquadFilter();
    this.lowLP.type = "lowpass";
    this.lowLP.frequency.value = 120;

    this.midHP = audioCtx.createBiquadFilter();
    this.midHP.type = "highpass";
    this.midHP.frequency.value = 120;
    this.midLP = audioCtx.createBiquadFilter();
    this.midLP.type = "lowpass";
    this.midLP.frequency.value = 2500;

    this.highHP = audioCtx.createBiquadFilter();
    this.highHP.type = "highpass";
    this.highHP.frequency.value = 2500;

    this.ottShaper = audioCtx.createWaveShaper();
    this.ottShaper.curve = createOTTCurve(0.85);
    this.ottShaper.oversample = "2x";

    this.duckGain.connect(this.lowLP);
    this.duckGain.connect(this.midHP);
    this.midHP.connect(this.midLP);
    this.duckGain.connect(this.highHP);

    // Live presses join the same chain after the duck, so the band's kick/snare pumping never hides them.
    this.liveBus = audioCtx.createGain();
    this.liveBus.connect(this.lowLP);
    this.liveBus.connect(this.midHP);
    this.liveBus.connect(this.highHP);

    this.lowLP.connect(this.ottShaper);
    this.midLP.connect(this.ottShaper);
    this.highHP.connect(this.ottShaper);

    // Convolver Reverb Send
    this.reverbConvolver = audioCtx.createConvolver();
    this.reverbConvolver.buffer = createImpulseResponse(audioCtx, 1.5, 2.8);
    this.reverbGain = audioCtx.createGain();
    this.reverbGain.gain.value = 0.16;
    this.ottShaper.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbGain);

    // Master Glue Compressor & Analyser
    this.compressor = audioCtx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.11;
    // Sampled piano retains its natural spectrum; share final limiter/volume,
    // without the synth's distortion or backing duck hiding personal notes.
    this.sampledBus = audioCtx.createGain();
    this.sampledBus.connect(this.compressor);

    // Phase 8.0 safe sound: limiter-style compressor -> fade-in -> hard safety ceiling -> user volume.
    // The WaveShaper ceiling is the guarantee. Browser compressors also add
    // intrinsic buffering (measured at 6ms each in the tested Chromium build).
    this.limiter = audioCtx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0;
    this.limiter.release.value = 0.1;

    this.fadeGain = audioCtx.createGain();
    this.fadeGain.gain.value = 1; // fadeIn() ramps from 0 when playback starts; auditions play at 1

    this.safetyClip = audioCtx.createWaveShaper();
    this.safetyClip.curve = createSafetyCeilingCurve(SAFETY_CEILING);
    this.safetyClip.oversample = "none";

    this.masterGain = audioCtx.createGain();
    this.masterGain.gain.value = DEFAULT_VOLUME;
    this.analyser = audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;

    this.drumBus.connect(this.compressor);
    this.ottShaper.connect(this.compressor);
    this.reverbGain.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.fadeGain);
    this.fadeGain.connect(this.safetyClip);
    this.safetyClip.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(audioCtx.destination);
  }

  /** Listening volume, 0..1. Never above 1, so it can't push output past the safety ceiling. */
  setVolume(volume) {
    if (this.disposed) return;
    const v = Math.max(0, Math.min(1, Number(volume)));
    this.masterGain.gain.setTargetAtTime(Number.isFinite(v) ? v : DEFAULT_VOLUME, this.ctx.currentTime, 0.02);
  }

  /** Soft start so playback never begins at full level. */
  fadeIn(seconds = FADE_IN_SECONDS) {
    if (this.disposed) return;
    const g = this.fadeGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(1, now + seconds);
  }

  setOTTPunch(amount) {
    this.ottPunch = amount;
    this.ottShaper.curve = createOTTCurve(amount);
  }

  /** Retire this graph permanently: pending voices and reverb cannot leak into a restart. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.ctx.currentTime;
    const gain = this.masterGain.gain;
    // A very short release avoids a hard waveform cut. This gain is never reopened.
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
    setTimeout(() => this.disconnect(), STOP_FADE_SECONDS * 1000 + 12);
  }

  /** Finish retirement early before connecting a replacement graph. */
  disconnect() {
    if (this.disconnected) return;
    this.disconnected = true;
    for (const node of Object.values(this)) {
      if (node && typeof node.disconnect === "function") node.disconnect();
    }
  }

  scheduleSidechainDuck(audioTime, weight = 1) {
    const amount = Number.isFinite(Number(weight)) ? Math.max(0, Math.min(1, Number(weight))) : 1;
    if (!amount || this.disposed) return;
    this.duckWeights ||= new Map();
    for (const time of this.duckWeights.keys()) if (time < this.ctx.currentTime - 1) this.duckWeights.delete(time);
    const total = Math.min(1, (this.duckWeights.get(audioTime) || 0) + amount);
    this.duckWeights.set(audioTime, total);
    const g = this.duckGain.gain;
    g.cancelScheduledValues(audioTime);
    g.setValueAtTime(1.0, audioTime);
    g.linearRampToValueAtTime(1 - .8 * total, audioTime + 0.005);
    g.exponentialRampToValueAtTime(1.0, audioTime + 0.115);
  }
}
