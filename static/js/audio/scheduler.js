import {planJamAnswer} from '../theory/jam_answer.js';
import {validJamForm,formCursor,formVariant,validFormMode} from '../theory/jam_form.js';
import {playedResponseSources} from '../theory/melodic_evolution.js';
import {captureWindow,playedLive} from '../theory/capture_window.js';
/**
 * Chris Wilson "A Tale of Two Clocks" 25ms/100ms Web Audio Lookahead Scheduler
 * Guarantees sub-millisecond AudioParam timing while decoupling visual playhead rendering.
 */
import { MasterBus } from "./master_bus.js";
import { triggerScheduledEvent } from "./voices.js";
import { isSampledPatch, SAMPLE_TAIL, createPiano, renderPiano } from './sampled_piano.js';
import { liveVelocity, dimmedVelocity, ENERGY_ROLL_LEVEL } from "../theory/scene_voice_levels.js";
/** Native voices that stand in for sampled ones while the bank loads (phase 14.1), by role. */
export const LOADING_VOICES = Object.freeze({ bass: "clean_bass", lead: "pluck_lead", harmony: "warm_keys", hocket: "warm_keys" });
import { hzToMidiFloat, keyPhraseRelative, rmsToExpression } from "./hum_keying.js";

export const LOOKAHEAD_INTERVAL_MS = 25;
/** One render block ahead of the audio clock: soon enough to feel immediate, late enough that an attack is not cut. */
export const LIVE_START_DELAY_SEC = 0.003;
const microphoneSessions = new WeakMap();
export function preferPlaybackAudioSession(nav = globalThis.navigator) {
  try {
    const session = nav?.audioSession;
    if (!session) return false;
    if (microphoneSessions.has(session) || session.type === 'play-and-record') return false;
    if (session.type !== 'playback') session.type = 'playback';
    return session.type === 'playback';
  } catch (_) { return false; }
}
/** Keep optional humming compatible with platforms that enforce capture session types. */
export function acquireMicrophoneAudioSession(nav = globalThis.navigator) {
  try {
    const session = nav?.audioSession;
    if (!session) return () => {};
    let lease = microphoneSessions.get(session);
    if (!lease) {
      const previous = session.type;
      session.type = 'play-and-record';
      lease = { previous, users: 0 };
      microphoneSessions.set(session, lease);
    }
    lease.users++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--lease.users) return;
      microphoneSessions.delete(session);
      try { if (session.type === 'play-and-record') session.type = lease.previous; } catch (_) {}
    };
  } catch (_) { return () => {}; }
}
export const SCHEDULE_AHEAD_SEC = 0.100;
// A step whose start is already this far in the past is skipped, never started late in a burst.
export const LATE_STEP_TOLERANCE_SEC = 0.02;

// Live presses: a tap still lasts the previous preview length; holding sustains up to the cap.
export const LIVE_MIN_SEC = 0.25;
export const LIVE_MAX_HOLD_SEC = 4;
export const LIVE_RELEASE_SEC = 0.06;
export const LIVE_VOICE_LIMIT = 8;
// Energy from playing: each press adds some, and it fades over a few seconds.
export const ENERGY_PER_PRESS = .12;
export const ENERGY_DECAY_SEC = 2.5;

/** How many steps the transport must skip so that no step starts more than `tolerance` late. */
export function overdueSteps(nextStepTime, now, stepSec, tolerance = LATE_STEP_TOLERANCE_SEC) {
  if (!(stepSec > 0) || nextStepTime >= now - tolerance) return 0;
  return Math.ceil((now - tolerance - nextStepTime) / stepSec - 1e-9);
}

// Captured live performances retain their within-step timing. Ordinary notes
// continue to use the existing swing calculation at each playback call site.
export function performanceOffsetSeconds(event, stepSec, fallback = 0) {
  if (event?.performance?.version !== 1) return fallback;
  const offset = event?.performance?.offset_steps;
  return typeof offset === "number" && Number.isFinite(offset) && offset >= 0 && offset < 1
    ? offset * stepSec : 0;
}

// Shared with audio_engine.synth: 1.5s browser reverb plus voice/percussion release.
// A fixed reserve, not an assertion that every renderer produces identical sound.
export const RENDER_TAIL_SEC = 2;
export function renderDurationSeconds(song) {
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;
  const declared = finite(song?.total_duration_sec);
  const noteEnd = (song?.events || []).reduce((end, event) => Math.max(end,
    finite(event.start_sec) + finite(event.duration_sec)), 0);
  const tail = song?.events?.some(event => isSampledPatch(event.patch_id)) ? SAMPLE_TAIL : RENDER_TAIL_SEC;
  return Math.max(declared, noteEnd) + tail;
}

export function roleMatchesLayer(role, layerId) {
  if (!layerId) return false;
  if (layerId === "beat" || layerId === "drums") return role === "drums";
  if (layerId === "tune" || layerId === "lead") return role === "lead";
  if (layerId === "under") return role === "harmony" || role === "bass" || role === "hocket";
  return role === layerId;
}

export class LookaheadScheduler {
  constructor() {
    this.audioCtx = null;
    this.masterBus = null;
    this.compiledSong = null;
    this.isPlaying = false;
    this.currentStep = 0;
    this.loopStartStep = 0;
    this.loopEndStep = null;
    this.repeatPlayback = true;
    this.playbackEndTime = null;
    this.nextStepAudioTime = 0;
    this.timerId = null;
    this.visualQueue = [];
    this.visualNotes = [];
    this.lastVisualClock = null;
    this.jamClockTimeline = [];
    this.onStepVisual = null;
    this.droneNodes = null;
    this.spotlightRole = null;
    this.mutedLayers = new Set();
    this.droppedSteps = 0;
    this.liveNotes = new Map();
    this._liveSeq = 0;
    this.committedJamBacking = null;
    this.pendingJamBacking = null;
    this.jamBridgeStage = null;
    this.requestedJamStyle = null;
    this.lastJamBackingCommit = null; // scheduled boundary, not proof of audible output
    this.performanceTake = null;
    this.pendingJamLead = null;
    this.activeJamLead = null;
    this.jamPhraseOrdinal = 0;
    this.lastJamLeadCommit = null;
    this.partAudition = null;
  }

  setSpotlightRole(role = null) {
    this.spotlightRole = role || null;
  }

  setRepeatPlayback(repeat = true) {
    this.repeatPlayback = Boolean(repeat);
  }

  toggleMuteLayer(layerId) {
    if (!layerId) return false;
    if (this.mutedLayers.has(layerId)) {
      this.mutedLayers.delete(layerId);
      return false;
    }
    this.mutedLayers.add(layerId);
    return true;
  }

  clearMuteLayers() {
    this.mutedLayers.clear();
  }

  auditionEarMission(mission) {
    if (!mission) return;
    this.auditionMissionSequence(mission.call_events || [], mission.target_events || []);
  }

  setReferenceDrone(enabled, rootMidi = 43) {
    if (!enabled) {
      if (this.droneNodes) {
        const nodes = this.droneNodes;
        this.droneNodes = null;
        try {
          const now = this.audioCtx ? this.audioCtx.currentTime : 0;
          nodes.gain.gain.setTargetAtTime(0.0001, now, 0.08);
          setTimeout(() => {
            for (const osc of [nodes.oscRoot, nodes.oscFifth]) {
              try { osc.stop(); } catch (_) {}
            }
            nodes.gain.disconnect();
          }, 220);
        } catch (_) {}
      }
      return;
    }

    const ctx = this.ensureContext();
    const rootFreq = 440.0 * Math.pow(2.0, (Number(rootMidi || 43) - 69.0) / 12.0);
    const fifthFreq = rootFreq * 1.498307; // Perfect 5th

    if (this.droneNodes) {
      this.droneNodes.oscRoot.frequency.setTargetAtTime(rootFreq, ctx.currentTime, 0.05);
      this.droneNodes.oscFifth.frequency.setTargetAtTime(fifthFreq, ctx.currentTime, 0.05);
      return;
    }

    const oscRoot = ctx.createOscillator();
    const oscFifth = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscRoot.type = "triangle";
    oscFifth.type = "sine";
    oscRoot.frequency.value = rootFreq;
    oscFifth.frequency.value = fifthFreq;

    lp.type = "lowpass";
    lp.frequency.value = 340.0;
    lp.Q.value = 0.7;

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.setTargetAtTime(0.11, ctx.currentTime, 0.12); // ~ -18 dBFS warm reference floor

    oscRoot.connect(lp);
    oscFifth.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterBus.synthBus);

    oscRoot.start();
    oscFifth.start();
    this.droneNodes = { oscRoot, oscFifth, lp, gain };
  }

  auditionNoteWithResolution(noteFreqHz, chordFreqs = [], resolutionFreqHz = null) {
    const ctx = this.ensureContext();
    const bpm = this.compiledSong?.bpm || 110;
    const now = ctx.currentTime + 0.01;

    // 1. Softly sound the active underlying chord in C3-E5 for harmonic grounding
    if (Array.isArray(chordFreqs) && chordFreqs.length > 0) {
      triggerScheduledEvent(
        ctx,
        this.masterBus,
        {
          role: "harmony",
          patch_id: "supersaw_stab",
          duration_sec: resolutionFreqHz ? 0.78 : 0.45,
          velocity: 0.48,
          voiced_freqs: chordFreqs,
          concrete: { freq_hz: chordFreqs[0] },
          gesture: { preset_id: "pluck_stab", grit: 0.25, ott_punch: 0.45 },
        },
        now,
        bpm
      );
    }

    // 2. Sound the candidate note
    triggerScheduledEvent(
      ctx,
      this.masterBus,
      {
        role: "lead",
        patch_id: "supersaw_stab",
        duration_sec: 0.34,
        velocity: 0.90,
        concrete: { freq_hz: noteFreqHz },
        gesture: { preset_id: "pluck_stab", grit: 0.45, ott_punch: 0.75 },
      },
      now,
      bpm
    );

    // 3. If it is a tension tone with a resolution target, sound the resolution 360ms later
    if (resolutionFreqHz && Math.abs(resolutionFreqHz - noteFreqHz) > 0.5) {
      triggerScheduledEvent(
        ctx,
        this.masterBus,
        {
          role: "lead",
          patch_id: "supersaw_stab",
          duration_sec: 0.42,
          velocity: 0.94,
          concrete: { freq_hz: resolutionFreqHz },
          gesture: { preset_id: "pluck_stab", grit: 0.35, ott_punch: 0.80 },
        },
        now + 0.36,
        bpm
      );
    }
  }

  auditionMissionSequence(callEvents = [], targetEvents = []) {
    const ctx = this.ensureContext();
    const bpm = this.compiledSong?.bpm || 110;
    const stepSec = (60.0 / bpm) / 4.0;
    const baseTime = ctx.currentTime + 0.05;

    for (const ev of [...callEvents, ...targetEvents]) {
      const t0 = baseTime + Number(ev.step || 0) * stepSec;
      triggerScheduledEvent(
        ctx,
        this.masterBus,
        {
          role: "lead",
          patch_id: ev.patch_id || "supersaw_stab",
          duration_sec: stepSec * 2.5,
          velocity: 0.90,
          concrete: { freq_hz: ev.freq_hz || 440.0 },
          gesture: { preset_id: "pluck_stab", grit: 0.4, ott_punch: 0.75 },
        },
        t0,
        bpm
      );
    }
  }

  setLoopRange(startStep = 0, endStep = null) {
    if (startStep!==this.loopStartStep || endStep!==this.loopEndStep) this.clearPartAudition();
    this.loopStartStep = Math.max(0, Number(startStep) || 0);
    this.loopEndStep = endStep !== null ? Number(endStep) : null;
    if (this.currentStep < this.loopStartStep || (this.loopEndStep !== null && this.currentStep >= this.loopEndStep)) {
      this.currentStep = this.loopStartStep;
    }
  }

  /** Listening volume 0..1 (Phase 8.0); applied now and whenever the audio context is created. */
  setVolume(volume) {
    this.listeningVolume = Math.max(0, Math.min(1, Number(volume)));
    if (this.masterBus) this.masterBus.setVolume(this.listeningVolume);
  }

  seekToStep(stepIndex) {
    this.clearPartAudition();
    this.currentStep = Math.max(0, Number(stepIndex) || 0);
    if (this.playbackEndTime !== null) {
      this.playbackEndTime = null;
      this.nextStepAudioTime = (this.audioCtx?.currentTime || 0) + 0.04;
    }
  }

  ensureContext() {
    // Optional platform hint only: unsupported/denied setters must not block audio.
    preferPlaybackAudioSession();
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (!this.masterBus || this.masterBus.disposed) {
      const ottPunch = this.masterBus?.ottPunch;
      // Rapid Stop -> Preview must not sum two independently limited outputs.
      this.masterBus?.disconnect?.();
      this.masterBus = new MasterBus(this.audioCtx);
      this.masterBus.setVolume(this.listeningVolume ?? 0.8);
      if (ottPunch !== undefined) this.masterBus.setOTTPunch(ottPunch);
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /** Phase 9a-1: unlock audio on the first press and wait for it, so the first sound is never lost. */
  async unlock() {
    const ctx = this.ensureContext();
    if (ctx.state !== "running") await ctx.resume();
    return ctx.state;
  }

  /**
   * Phase 14.1: music within 3 seconds. A loading session lets a fresh Listen start at once on the
   * bundled native voices while the sampled bank loads in the background. Every attack is resolved
   * once, before dispatch, visuals and capture, so what is recorded is what was heard. Loaded sounds
   * join at the next bar line; held notes keep the voice they started with. Stop ends the session,
   * so a late load never starts music. Returns null when the sounds are already there.
   */
  beginLoadingSession() {
    this.ensureContext();
    if (this.masterBus?.piano && !this.masterBus.disposed) return null;
    const listeners = new Set();
    const session = {
      state: "loading", generation: this.stopGeneration || 0, ready: null,
      onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
      _set(state) { if (session.state === state) return; session.state = state; for (const cb of [...listeners]) cb(state, session); },
      retry: null,
    };
    const load = () => {
      session._set("loading");
      session.ready = this.preparePiano().then(
        () => { if (this.loadingSession === session) session._set("ready"); },
        () => { if (this.loadingSession === session) session._set("failed"); });
      return session.ready;
    };
    session.retry = load;
    this.loadingSession = session;
    load();
    return session;
  }

  /** While a loading session is on, a sampled attack sounds on a native voice of the same role; the request is kept beside it. */
  _resolveVoice(event) {
    const session = this.loadingSession;
    if (!session || session.state === "live" || !isSampledPatch(event?.patch_id)) return event;
    return { ...event, patch_id: LOADING_VOICES[event.role] || LOADING_VOICES.harmony, requested_patch_id: event.patch_id, loading_voice: true };
  }

  async preparePiano() {
    const ctx = this.ensureContext(), bus = this.masterBus;
    if (bus.piano) return bus.piano;
    if (!bus.pianoLoading) bus.pianoLoading = createPiano(ctx, bus.sampledBus).then(piano => {
      if (bus.disposed || bus !== this.masterBus) { piano.stop(); throw Error('Piano loading cancelled by Stop. Try again when ready.'); }
      bus.piano = piano; return piano;
    }).finally(() => { bus.pianoLoading = null; });
    return bus.pianoLoading;
  }

  /** One short sound in answer to a press (a tapped pad, a tune note, or a Ghost Spark cushioned by chordFreqs). Never starts the loop. */
  previewSound({ patchId, role = "drums", midi = null, durationSec = 0.3, kit = null, chordFreqs = null, soundSeed = null, sourceNoteId = null } = {}) {
    if (this.previewsMuted) return;
    const liveLevel = liveVelocity(patchId, role, isSampledPatch(patchId));
    const resolvedPreview = this._resolveVoice({ patch_id: patchId, role });
    patchId = resolvedPreview.patch_id;
    if (isSampledPatch(patchId) && (!this.masterBus?.piano || this.masterBus.disposed)) {
      this.onAudioError?.('Load sounds before playing. Your notes are preserved.'); return;
    }
    const ctx = this.ensureContext();
    const now = ctx.currentTime + LIVE_START_DELAY_SEC;
    const bpm = this.compiledSong?.bpm || 100;
    if (Array.isArray(chordFreqs) && chordFreqs.length > 0) {
      triggerScheduledEvent(
        ctx,
        this.masterBus,
        {
          role: "harmony",
          patch_id: "warm_keys",
          duration_sec: Math.max(0.32, durationSec),
          velocity: 0.34,
          voiced_freqs: chordFreqs,
          concrete: { freq_hz: chordFreqs[0] },
          sound_seed: soundSeed || null,
        },
        now,
        bpm
      );
    }
    const freq = midi === null ? 55 : 440 * Math.pow(2, (Number(midi) - 69) / 12);
    triggerScheduledEvent(
      ctx,
      this.masterBus,
      {
        role,
        patch_id: patchId,
        duration_sec: durationSec,
        velocity: liveLevel,
        ...(resolvedPreview.loading_voice ? { loading_voice: true } : {}),
        concrete: { freq_hz: freq },
        drum_kit: kit || "punchy",
        sound_seed: soundSeed || null,
      },
      now,
      bpm,
      { synthDest: this.masterBus.liveBus || this.masterBus.synthBus }
    );
    if(sourceNoteId)this.cancelJamAnswer('Your turn.');
    if (sourceNoteId) { const recorded=this._rememberPerformance({ id: sourceNoteId, source_note_id: sourceNoteId, role, patch_id: patchId,
      duration_sec: durationSec, velocity: liveLevel, concrete: { freq_hz: freq }, drum_kit: kit || 'punchy',
      sound_seed: soundSeed || null, provenance: 'user_placed',
      ...(resolvedPreview.loading_voice ? { requested_patch_id: resolvedPreview.requested_patch_id, loading_voice: true } : {}) }, now);
      if(recorded)recorded.released_at=ctx.currentTime;
    }
    return true; // A successful live dispatch, distinct from muted or failed preview attempts.
  }

  /**
   * A press that sounds now and lasts while it is held; returns an id for noteOff.
   * Drums and reverse swells are timed gestures: they ring out on their own.
   */
  noteOn({ patchId, role = "drums", midi = null, kit = null, soundSeed = null, onRelease = null, sourceNoteId = null } = {}) {
    if (this.previewsMuted) return null;
    if (role !== 'drums' && patchId !== 'reverse_swell' && this.liveNotes.size >= LIVE_VOICE_LIMIT) throw Error('All held notes are in use. Release one to add a new note.');
    const ctx = this.ensureContext();
    const bus = this.masterBus;
    const now = ctx.currentTime + LIVE_START_DELAY_SEC;
    const strike = role === "drums";
    // A reverse envelope reaches its peak at the end of its duration. Stretching
    // it to the hold cap makes a normal tap almost silent before noteOff gates it.
    // Keep this explicitly timed gesture short, just like its preview.
    const timedSwell = patchId === "reverse_swell";
    const id = ++this._liveSeq;
    const event = this._resolveVoice({
      role,
      patch_id: patchId,
      duration_sec: strike ? 0.3 : timedSwell ? LIVE_MIN_SEC : LIVE_MAX_HOLD_SEC,
      velocity: liveVelocity(patchId, role, isSampledPatch(patchId)),
      concrete: { freq_hz: midi === null ? 55 : 440 * Math.pow(2, (Number(midi) - 69) / 12) },
      drum_kit: kit || "punchy",
      sound_seed: soundSeed || null,
      provenance: 'user_placed', source_note_id: sourceNoteId,
    });
    // Read only reached metadata; do not clone a whole backing score per press.
    const mode=this.isPlaying?[...(this.jamBackingTimeline||[])].reverse()
      .find(snapshot=>snapshot.time<=ctx.currentTime)?.phraseContext?.mode:null;
    if(!strike&&validFormMode(mode))event.performed_mode=JSON.parse(JSON.stringify(mode));
    let recorded;
    if (strike || timedSwell) {
      triggerScheduledEvent(ctx, bus, event, now, this.compiledSong?.bpm || 100,
        { synthDest: bus.liveBus || bus.synthBus });
      this.cancelJamAnswer('Your turn.');
      this._rememberPerformance(event, now);
      return id;
    }
    const hold = ctx.createGain();
    hold.gain.setValueAtTime(1, now);
    hold.connect(bus.liveBus || bus.synthBus);
    let pianoHandle;
    try {
      pianoHandle = isSampledPatch(event.patch_id) ? bus.piano?.trigger(event, now, true) : null;
      if (isSampledPatch(event.patch_id) && !pianoHandle) throw Error('Load sounds before playing.');
      if (!pianoHandle) triggerScheduledEvent(ctx, bus, event, now, this.compiledSong?.bpm || 100, { synthDest: hold });
    } catch (error) { hold.disconnect(); throw error; }
    this.cancelJamAnswer('Your turn.');
    recorded = this._rememberPerformance(event, now);
    const timer = setTimeout(() => this.noteOff(id), LIVE_MAX_HOLD_SEC * 1000);
    this.liveNotes.set(id, { hold, piano:bus.piano, pianoHandle, startTime: now, timer, onRelease, recorded });
    return id;
  }

  /** Release a held press. A quick tap still lasts LIVE_MIN_SEC; the release is a short fade, not a cut. */
  noteOff(id) {
    const note = this.liveNotes.get(id);
    if (!note) return;
    this.liveNotes.delete(id);
    clearTimeout(note.timer);
    const ctx = this.audioCtx;
    const at = Math.max(ctx.currentTime, note.startTime + LIVE_MIN_SEC);
    if (note.pianoHandle) note.piano.release(note.pianoHandle, at);
    const gain = note.hold.gain;
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(1, at);
    gain.linearRampToValueAtTime(0, at + LIVE_RELEASE_SEC);
    if (note.recorded) {
      note.recorded.duration = Math.min(LIVE_MAX_HOLD_SEC, at - note.startTime);
      // The attack was scheduled a hair ahead of the clock (noteOn's now). A tap released inside
      // that hair must not be recorded as released before it started, or the reads that require
      // release >= onset (exploration_bias, band_hand) drop every quick tap.
      note.recorded.released_at=Math.max(ctx.currentTime, note.startTime);
    }
    // The fade is already scheduled above; a failing callback cannot hold the note or break the key's release.
    try { note.onRelease?.(Math.min(LIVE_MAX_HOLD_SEC, at - note.startTime)); }
    catch (error) { console.error('A key release kept going past an error', error); }
    setTimeout(() => note.hold.disconnect(), (at + LIVE_RELEASE_SEC - ctx.currentTime) * 1000 + 50);
  }

  allNotesOff() {
    for (const id of [...this.liveNotes.keys()]) this.noteOff(id);
  }

  /**
   * Play one or more bars of a compiled song once (Phase 9b + Phase 12c #1 anticipationBeats).
   * When `anticipationBeats > 0`, plays 1 beat of solo melody before dropping the full accompaniment crate.
   */
  /** Explicit Play for a disposable comparison. Never changes the saved transport song. */
  playComparisonOnce(compiledSong) {
    if(this.isPlaying || !compiledSong)return false;
    const ctx=this.ensureContext();
    if(compiledSong.events?.some(e=>isSampledPatch(e.patch_id)) && !this.masterBus?.piano)
      throw Error('Load sounds before playing this comparison.');
    const at=ctx.currentTime+.05;
    try {
      for(const event of compiledSong.events||[])triggerScheduledEvent(ctx,this.masterBus,event,
        at+Math.max(0,Number(event.start_sec)||0),compiledSong.bpm||100);
    } catch(error) {this.stop();throw error;}
    return true;
  }

  previewBar(compiledSong, bar = 0, barsCount = 1, { anticipationBeats = 0 } = {}) {
    if (this.isPlaying || !compiledSong) return false;
    if (this.previewsMuted) return true; // comfort: "a press never makes a sound" (only Play does)
    const ctx = this.ensureContext();
    const stepsPerBar=compiledSong.steps_per_bar||16;
    const bpm = compiledSong.bpm || 100;
    const stepSec = 60.0 / bpm / 4.0;
    const t0 = ctx.currentTime + 0.05;
    const leadInSteps = Math.max(0, Math.trunc(Number(anticipationBeats) || 0)) * 4;
    const dropOffsetSec = leadInSteps * stepSec;
    if (leadInSteps > 0) {
      for (const ev of compiledSong.events || []) {
        const s = Number(ev.step) - bar * stepsPerBar;
        if (ev.role === "lead" && s >= 0 && s < leadInSteps) {
          triggerScheduledEvent(ctx, this.masterBus, ev, t0 + s * stepSec + performanceOffsetSeconds(ev, stepSec), bpm);
        }
      }
    }
    for (const ev of compiledSong.events || []) {
      const s = Number(ev.step) - bar * stepsPerBar;
      if (s < 0 || s >= Math.max(1, Number(barsCount) || 1) * stepsPerBar) continue;
      triggerScheduledEvent(ctx, this.masterBus, ev, t0 + dropOffsetSec + s * stepSec + performanceOffsetSeconds(ev, stepSec), bpm);
    }
    return true;
  }

  /**
   * Celebrate by playing it back (fun-wave-2 #3, score 74):
   * Plays the whole compiled song once from step 0 with the visual playhead lights following
   * (`this.visualQueue`), at the exact same volume (no confetti, no fanfare, no jump in volume),
   * without starting the infinite transport loop (`this.isPlaying` remains false).
   */
  celebratePlaybackOnce(compiledSong = null) {
    const song = compiledSong || this.compiledSong;
    if (this.isPlaying || !song) return false;
    if (this.previewsMuted) return true;
    const ctx = this.ensureContext();
    const bpm = Number(song.bpm || 100);
    const swing = Number(song.swing || 0.5);
    const stepSec = 60.0 / bpm / 4.0;
    const totalSteps = Math.max(16, Number(song.total_steps || 64));
    const t0 = ctx.currentTime + 0.05;
    this.visualQueue.length = 0;
    this.visualNotes = [];
    this.lastVisualClock = null;
    this.jamClockTimeline = [];

    for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
      const swingOffset = stepIndex % 2 === 1 ? (swing - 0.5) * 2.0 * stepSec * 0.5 : 0.0;
      const exactStepTime = t0 + stepIndex * stepSec + swingOffset;
      const stepEvents = (song.events || []).filter((e) => Number(e.step) === stepIndex);
      for (const ev of stepEvents) {
        const attack = t0 + stepIndex * stepSec + performanceOffsetSeconds(ev, stepSec, swingOffset);
        triggerScheduledEvent(ctx, this.masterBus, ev, attack, bpm);
        if (Number(ev.velocity ?? .85) > 0) this.visualNotes.push({ event: ev, time: attack, end: attack + Math.max(.001, Number(ev.duration_sec) || Number(ev.duration_steps || 1)*stepSec) });
      }
      this.visualQueue.push({ step: stepIndex, time: t0 + stepIndex * stepSec, events: stepEvents, scheduledVisual: true });
    }
    this._celebratingUntilTime = t0 + totalSteps * stepSec + 0.15;
    return true;
  }

  isCelebratingPlayback() {
    if (!this.audioCtx || !this._celebratingUntilTime) return false;
    if (this.audioCtx.currentTime <= this._celebratingUntilTime || this.visualQueue.length > 0) {
      return true;
    }
    this._celebratingUntilTime = 0;
    return false;
  }

  /** Join a pinned melody on the existing clock; submitted voices and live holds survive. */
  /** joinSteps: where a new choice may enter. Default is the bar line; the melody screen asks for the beat (4). */
  queueContinuousPartAudition(compiledSong, {sectionId, requestId, joinSteps = null} = {}) {
    if(joinSteps!==null&&(!Number.isInteger(joinSteps)||joinSteps<1))return {ok:false};
    const prior=this.compiledSong;
    if(!this.isPlaying || !Number.isFinite(this.gridOriginTime) || !sectionId || !requestId || !compiledSong?.events
      || !Number.isInteger(compiledSong.total_steps) || compiledSong.total_steps<1
      || compiledSong.bpm!==prior?.bpm
      || (compiledSong.steps_per_bar||16)!==(prior.steps_per_bar||16))return {ok:false};
    if(this.partAudition)return this.queuePartAudition(compiledSong,{sectionId,requestId,joinSteps});
    this.pendingPartHandoff={song:structuredClone(compiledSong),sectionId,requestId,joinSteps};
    return {ok:true};
  }

  _commitContinuousPartIfDue() {
    const h=this.pendingPartHandoff;
    if(!h || this.currentStep%(this.compiledSong.steps_per_bar||16)!==0)return;
    this.pendingPartHandoff=null;
    const reached=this.activeJamBacking();
    const fallbackSong=structuredClone(reached ? {...this.compiledSong,
      events:[...this.compiledSong.events.filter(e=>e.provenance!=='jam_generated'),...reached.events]} : this.compiledSong);
    // Only retire future generators. Never dispose the graph or release a live voice.
    this.cancelJamAnswer();this.clearJamLead();
    this.committedJamBacking=null;this.pendingJamBacking=null;
    this.activeJamForm=null;this.requestedJamFormProgram=null;
    this.pendingPhraseContext=null;this.jamBridgeStage=null;
    this.leadAnswer=null;this.energyDrop=null;this.playEnergy=0;
    this.compiledSong=h.song;
    const tick=Math.round((this.nextStepAudioTime-this.gridOriginTime)/(15/h.song.bpm));
    this.currentStep=((tick%h.song.total_steps)+h.song.total_steps)%h.song.total_steps;
    this.loopStartStep=0;this.loopEndStep=null;this.repeatPlayback=true;
    this.lastPartAuditionState=null;
    this.partAudition={sectionId:h.sectionId,requestedId:h.requestId,scheduledId:h.requestId,
      initial:h.song,fallbackSong,pending:null,timeline:[],loopStart:0,loopEnd:null,joinSteps:h.joinSteps};
  }

  /** Detached compiled-part audition. This is not Jam generation or live-input capture. */
  beginPartAudition(compiledSong, {sectionId, requestId} = {}) {
    if (this.isPlaying || !sectionId || !requestId || !compiledSong?.events) return {ok:false};
    const song = structuredClone(compiledSong);
    this.setCompiledSong(song);
    this.lastPartAuditionState=null;
    this.partAudition = {sectionId, requestedId:requestId, scheduledId:requestId,
      initial:song, pending:null, timeline:[], loopStart:this.loopStartStep, loopEnd:this.loopEndStep};
    return {ok:true};
  }

  queuePartAudition(compiledSong, {sectionId, requestId, joinSteps = null} = {}) {
    if(joinSteps!==null&&(!Number.isInteger(joinSteps)||joinSteps<1))return {ok:false};
    const a=this.partAudition;
    if (!a || !this.isPlaying || !requestId || sectionId!==a.sectionId || !compiledSong?.events
      || this.loopStartStep!==a.loopStart || this.loopEndStep!==a.loopEnd
      || !['bpm','swing','total_steps','steps_per_bar'].every(k=>compiledSong[k]===a.initial[k]))
      return {ok:false,reason:'This band needs a new preview.'};
    a.requestedId=requestId;if(Number.isInteger(joinSteps)&&joinSteps>0)a.joinSteps=joinSteps;
    a.pending=requestId===a.scheduledId ? null : {requestId,song:structuredClone(compiledSong)};
    return {ok:true};
  }

  getPartAuditionState() {
    const a=this.partAudition;
    if (!a) return this.pendingPartHandoff ? {sectionId:this.pendingPartHandoff.sectionId,
      requestedId:this.pendingPartHandoff.requestId,scheduledId:null,realizedId:null,pending:true,scheduledTime:null} : null;
    const realized=a.timeline.filter(t=>t.audioTime<=(this.audioCtx?.currentTime ?? -Infinity)).at(-1);
    return {sectionId:a.sectionId, requestedId:a.requestedId, scheduledId:a.scheduledId,
      realizedId:realized?.requestId ?? null, pending:Boolean(a.pending),
      scheduledTime:a.timeline.at(-1)?.audioTime ?? null};
  }

  clearPartAudition() {
    this.pendingPartHandoff=null;
    const a=this.partAudition;
    if(a) this.lastPartAuditionState=this.getPartAuditionState();
    if(a) this.compiledSong=a.timeline.filter(t=>t.audioTime<=(this.audioCtx?.currentTime ?? -Infinity)).at(-1)?.song || a.fallbackSong || a.initial;
    this.partAudition=null;
  }

  _commitPartAuditionIfDue() {
    const a=this.partAudition;
    if (!a) return;
    if (!a.timeline.length) a.timeline.push({requestId:a.scheduledId,song:this.compiledSong,audioTime:this.nextStepAudioTime});
    if (this.currentStep % (a.joinSteps || this.compiledSong.steps_per_bar || 16)!==0 || !a.pending) return;
    const next=a.pending;
    a.pending=null;a.scheduledId=next.requestId;this.compiledSong=next.song;
    a.timeline.push({requestId:next.requestId,song:next.song,audioTime:this.nextStepAudioTime});
    // Retain the latest realized candidate and all scheduled future entries.
    let lastRealized=-1;
    for(let i=0;i<a.timeline.length;i++) if(a.timeline[i].audioTime<=this.audioCtx.currentTime)lastRealized=i;
    if(lastRealized>0)a.timeline.splice(0,lastRealized);
  }

  setCompiledSong(compiledSong, { quantizeJamBacking = false, jamStyleBlend = null, jamStyleKey = null, initialJamLead = null, phraseContext = null, jamFormProgram = null, coalesceJamTransitions = false } = {}) {
    this.clearPartAudition();
    if(jamFormProgram&&!validJamForm(jamFormProgram))throw Error('Invalid generated form. Your notes are unchanged.');
    const compatible = this.compiledSong && compiledSong
      && ["bpm", "swing", "total_steps", "steps_per_bar"].every(key => this.compiledSong[key] === compiledSong[key]);
    const backing = (compiledSong?.events || []).filter(event => event.provenance === "jam_generated");
    const style = jamStyleKey ?? (Number.isFinite(jamStyleBlend) ? jamStyleBlend : null);
    const styleChanged = style !== null && this.requestedJamStyle !== null && style !== this.requestedJamStyle;
    const previousBacking = (this.compiledSong?.events || []).filter(event => event.provenance === "jam_generated");
    const context=phraseContext?JSON.parse(JSON.stringify(phraseContext)):null;
    const scoreOf=p=>p?{...p,cursor:undefined}:null;
    const formChanged=JSON.stringify(scoreOf(jamFormProgram))!==JSON.stringify(scoreOf(this.requestedJamFormProgram));
    const intentContext=c=>c?.form?{sceneId:c.sceneId,root:c.root,minor:c.minor}:c;
    const contextChanged=formChanged||JSON.stringify(intentContext(context))!==JSON.stringify(intentContext(this.requestedPhraseContext??null));
    const backingChanged = JSON.stringify(backing) !== JSON.stringify(previousBacking);
    if (quantizeJamBacking && this.isPlaying && compatible) {
      // Only future band attacks change at a bar boundary. Personal notes and
      // their completed hold lengths remain current; live previews never wait.
      this.committedJamBacking ??= (this.compiledSong.events || []).filter(event => event.provenance === "jam_generated");
      // A repeat compile is not a new musical request and must not undo a
      // phrase already committed by the transport, or reset an ongoing bridge.
      if (backingChanged || styleChanged || contextChanged) {
        this.pendingJamBacking = !contextChanged && JSON.stringify(backing) === JSON.stringify(this.committedJamBacking) ? null : backing;
        this.pendingPhraseContext=context;
        this.pendingJamLead = null;
      }
      // A fresh direction begins from the committed band, including a partly
      // completed bridge. Ordinary input updates its destination, not its phase.
      if (this.pendingJamBacking === null) this.jamBridgeStage = null;
      else if (styleChanged && (!coalesceJamTransitions || this.jamBridgeStage !== 1)) {
        this.jamBridgeStage = 0;
        const pair=new Set(['rocksteady-v1','reggae-v1']);
        const from=coalesceJamTransitions?['scene',this.activeJamBacking()?.phraseContext?.sceneId||this.committedPhraseContext?.sceneId]:String(this.requestedJamStyle).split(':'),to=String(style).split(':');
        this.jamBridgeMode=from[0]==='scene'&&to[0]==='scene'&&from[1]!==to[1]
          &&pair.has(from[1])&&pair.has(to[1])?'offbeat-chords-first':'drums-first';
      }
    } else {
      this.clearJamLead();
      this.committedJamBacking = quantizeJamBacking ? backing : null;
      this.committedPhraseContext=quantizeJamBacking?context:null;
      this.pendingPhraseContext=null;
      this.pendingJamBacking = null;
      this.jamBridgeStage = null;
      this.lastJamBackingCommit = null;
    }
    this.requestedJamFormProgram=quantizeJamBacking&&jamFormProgram?JSON.parse(JSON.stringify(jamFormProgram)):null;
    if(!this.isPlaying||!quantizeJamBacking)this.activeJamForm=null;
    this.requestedPhraseContext=context;
    this.compiledSong = compiledSong;
    if(this.isPlaying&&quantizeJamBacking&&!compatible){
      this._activateJamForm(true);
      this._rememberJamBacking(this.nextStepAudioTime);
    }
    this.initialJamLead = quantizeJamBacking ? initialJamLead : null;
    this.requestedJamStyle = quantizeJamBacking ? style : null;
  }

  _activateJamForm(preservePosition=false){
    const program=this.requestedJamFormProgram,previous=this.activeJamForm;
    this.activeJamForm=null;
    if(!program){if(this.performanceTake)this.performanceTake.capture_bars=4;return;}
    const same=preservePosition&&previous?.program.id===program.id&&previous.program.blocks.length===program.blocks.length;
    const elapsed=same?Math.max(0,this.jamPhraseOrdinal-previous.lastPhrase):0;
    const next=same?previous.cursor.blockIndex+elapsed:0;
    const saved=same?{blockIndex:next%program.blocks.length,cycle:previous.cursor.cycle+Math.floor(next/program.blocks.length)}:program.cursor;
    const blockIndex=Number.isInteger(saved?.blockIndex)&&saved.blockIndex>=0&&saved.blockIndex<program.blocks.length?saved.blockIndex:0;
    const cycle=Number.isInteger(saved?.cycle)&&saved.cycle>=0&&saved.cycle<=1000000?saved.cycle:0;
    this.activeJamForm={program,cursor:formCursor(program,blockIndex,cycle),lastPhrase:this.jamPhraseOrdinal};
    this._applyJamForm();
  }

  _applyJamForm(){
    const form=this.activeJamForm;if(!form)return;
    const variant=formVariant(form.program,form.cursor);
    this.clearJamLead();
    this.committedJamBacking=JSON.parse(JSON.stringify(variant.events));
    this.committedPhraseContext={...this.committedPhraseContext,harmony:JSON.parse(JSON.stringify(variant.harmony)),form:form.cursor};
    // A deliberate foreground rest must not change the instrument of new presses.
    this.committedPhraseContext.form_lead_patch=variant.events.find(e=>e.role==='lead')?.patch_id||null;
    const sources=form.program.liveResponse?playedResponseSources(this.performanceTake?.events,
      this.audioCtx?.currentTime,64*15/(this.compiledSong?.bpm||100)):[];
    if(sources.length){
      // Leave the first half open, then retain late original answers if present.
      // Keep whole simultaneous groups so a harmonized head stays harmonized.
      const onset=e=>e.step+(e.performance?.offset_steps||0);
      const lead=this.committedJamBacking.filter(e=>e.role==='lead');
      const echoMeta=e=>e.provenance==='jam_generated'&&e.generated_by==='musiclab_jam'?e.generated_echo:null;
      const dryById=new Map(lead.filter(e=>echoMeta(e)?.version===1&&
        echoMeta(e).delay_steps===0&&echoMeta(e).source_id===e.id).map(e=>[e.id,e]));
      // Echo metadata is historical on saved songs. Here it groups only the
      // current generated phrase, so a response cannot outlive a removed source.
      const group=e=>{
        const echo=echoMeta(e),dry=echo?.version===1&&dryById.get(echo.source_id);
        return dry&&Number.isFinite(echo.delay_steps)&&echo.delay_steps>=0
          ?{key:`echo:${dry.id}`,at:onset(dry)}:{key:`onset:${onset(e)}`,at:onset(e)};
      };
      const late=[...new Map(lead.map(group).filter(g=>g.at>=32).map(g=>[g.key,g])).values()].sort((a,b)=>a.at-b.at);
      const answers=new Set([late[0]?.key,late.at(-1)?.key]);
      this.committedJamBacking=this.committedJamBacking.filter(e=>e.role!=='lead'||answers.has(group(e).key))
        .map(e=>e.role==='lead'?{...e,response_to:[...sources],response_version:'form-room-v1'}:e);
    }
    if(form.program.liveResponse)this.committedPhraseContext.form_response={version:1,mode:sources.length?'space':'steady',source_ids:sources};
    else delete this.committedPhraseContext.form_response;
    if(variant.mode)this.committedPhraseContext.mode=JSON.parse(JSON.stringify(variant.mode));
    else delete this.committedPhraseContext.mode;
    if(this.performanceTake)this.performanceTake.capture_bars=form.cursor.bars;
  }

  _commitJamFormIfDue(){
    const form=this.activeJamForm;
    if(!form||!this._supportsJamPhrase()||this.currentStep!==0||this.pendingJamBacking!==null||this.jamBridgeStage!==null)return;
    const delta=this.jamPhraseOrdinal-form.lastPhrase;if(delta<=0)return;
    const ordinal=form.cursor.blockIndex+delta;
    form.cursor=formCursor(form.program,ordinal%form.program.blocks.length,form.cursor.cycle+Math.floor(ordinal/form.program.blocks.length));
    form.lastPhrase=this.jamPhraseOrdinal;this._applyJamForm();this._rememberJamBacking(this.nextStepAudioTime);
  }

  /** Internal generated-lead plan only. Never accepts personal event material. */
  queueJamLead({ events, planVersion, phraseOrdinal, notBeforeAudioTime = 0, descriptor = null, commitStep }) {
    if (commitStep !== undefined && !(Number.isInteger(commitStep) && commitStep >= 0 && commitStep < 64 && commitStep % 16 === 0)) return false;
    if (this.activeJamForm || !this.isPlaying || !this._supportsJamPhrase() || !Number.isInteger(planVersion) || planVersion < 1
      || !Number.isInteger(phraseOrdinal) || phraseOrdinal < this.jamPhraseOrdinal
      || !Number.isFinite(notBeforeAudioTime) || !Array.isArray(events)
      || events.some(e => e.provenance !== 'jam_generated' || e.role !== 'lead'
        || !Number.isInteger(e.step) || e.step < 0 || e.step >= 64)) return false;
    const latestVersion = Math.max(this.activeJamLead?.planVersion || 0, this.pendingJamLead?.planVersion || 0);
    if (planVersion <= latestVersion) return false;
    this.pendingJamLead = JSON.parse(JSON.stringify({events, planVersion, phraseOrdinal, notBeforeAudioTime, descriptor,
      ...(commitStep !== undefined ? {commitStep} : {})}));
    return true;
  }

  clearJamLead() {
    this.pendingJamLead = null;
    this.activeJamLead = null;
    this.lastJamLeadCommit = null;
    this.adoptJamLeadOnCommit = false;
  }

  freezeJamLead() {
    this.pendingJamLead = null;
    // The caller writes the active audio-clock snapshot into the editable
    // backing. Adopt that snapshot at its boundary, not halfway through a bar.
    this.adoptJamLeadOnCommit = true;
  }

  _supportsJamPhrase() {
    return this.committedJamBacking !== null && this.compiledSong?.total_steps === 64
      && (this.compiledSong.steps_per_bar || 16) === 16 && this.loopStartStep === 0
      && (this.loopEndStep === null || this.loopEndStep === 64) && this.repeatPlayback;
  }

  _effectiveJamBacking() {
    if ((!this.activeJamLead&&!this.activeJamForm) || !this._supportsJamPhrase()) return this.committedJamBacking;
    const stepSec = 15 / (this.compiledSong.bpm || 100);
    const interval = e => {
      const swingOffset = e.step % 2 === 1 ? ((this.compiledSong.swing || .53) - .5) * stepSec : 0;
      const start = e.step * stepSec + performanceOffsetSeconds(e, stepSec, swingOffset);
      return [start, start + e.duration_sec];
    };
    const personal = this.compiledSong.events.filter(e => e.role === 'lead' && e.provenance !== 'jam_generated');
    const lead = (this.activeJamLead?.events||this.committedJamBacking.filter(e=>e.role==='lead')).filter(e => {
      const [a,b] = interval(e);
      return !personal.some(own => {const [c,d] = interval(own);return a < d && c < b;});
    });
    return [...this.committedJamBacking.filter(e => e.role !== 'lead'), ...lead];
  }

  _commitJamLeadIfDue(skippedBoundary = false) {
    const plan = this.pendingJamLead;
    // An answer to the person's playing may start at a bar line; development waits for the phrase start.
    if (!plan || skippedBoundary || !this._supportsJamPhrase() || this.currentStep !== (plan.commitStep ?? 0)
      || this.pendingJamBacking !== null || this.jamBridgeStage !== null
      || this.jamPhraseOrdinal < plan.phraseOrdinal || this.nextStepAudioTime < plan.notBeforeAudioTime) return;
    this.activeJamLead = plan;
    this.pendingJamLead = null;
    this.lastJamLeadCommit = {planVersion: plan.planVersion, requestedPhraseOrdinal: plan.phraseOrdinal,
      phraseOrdinal: this.jamPhraseOrdinal, audioTime: this.nextStepAudioTime};
    this._rememberJamBacking(this.nextStepAudioTime);
  }

  /**
   * Playing adds energy that fades. It makes the generated drums and bass stronger,
   * adds a snare roll at the end of a bar and, at its height, a riser and a drop.
   * The person's own notes are never changed.
   */
  addPlayEnergy(amount = ENERGY_PER_PRESS) {
    if (!this.isPlaying || !this.audioCtx) return 0;
    const now = this.audioCtx.currentTime;
    this.playEnergy = Math.min(1, this.energyAt(now) + amount);
    this.playEnergyTime = now;
    return this.playEnergy;
  }

  energyAt(time) {
    if (!this.playEnergy) return 0;
    return this.playEnergy * Math.exp(-Math.max(0, time - (this.playEnergyTime || 0)) / ENERGY_DECAY_SEC);
  }

  /**
   * Phase 15.2: a one-beat confirmation. When the person takes a move the band offers, or their
   * playing steers Next family, the band answers with a short snare roll in the last beat of the
   * current bar, so the link is heard as well as seen. Nothing when Calm asks for quiet.
   */
  requestConfirmFill() {
    if (!this.isPlaying || this.quietOrnaments) return false;
    this.confirmFill = { phrase: this.jamPhraseOrdinal, bar: Math.floor((this.currentStep || 0) / 16) };
    return true;
  }

  setQuietOrnaments(quiet) { this.quietOrnaments = Boolean(quiet); if (this.quietOrnaments) this.confirmFill = null; }

  _energyOrnaments(step, stepSec, energy) {
    if (this.committedJamBacking === null || !this.repeatPlayback || (this.compiledSong?.steps_per_bar || 16) !== 16) return [];
    if (this.quietOrnaments) { this.energyDrop = null; return []; }
    const out = [];
    const base = {provenance: 'jam_generated', generated_by: 'musiclab_energy', step, performance: {version: 1, offset_steps: 0}};
    const beat = step % 16;
    const fill = this.confirmFill;
    if (fill && (fill.phrase !== this.jamPhraseOrdinal || Math.floor(step / 16) !== fill.bar)) this.confirmFill = null;
    else if (fill && beat >= 12) energy = Math.max(energy, .6);
    if (energy >= .45 && beat >= 12)
      out.push({...base, id: `energy-roll-${this.jamPhraseOrdinal}-${step}`, role: 'drums', patch_id: 'snare',
        duration_sec: stepSec * .9, velocity: Number((ENERGY_ROLL_LEVEL * Math.min(.95, .25 + .5 * energy * (beat - 11) / 4)).toFixed(4)), concrete: {midi: 38, freq_hz: 200}});
    // Energy may add a quiet rhythmic answer, never an unsolicited sweep or bass drop.
    this.energyDrop = null;
    return out;
  }

  /**
   * In a style with a fixed form the melody comes from the form, so the answer is
   * played over it: the first band note of the named bar takes the answered pitch,
   * once. A bar with no band note gets a short answering note on its first beat.
   */
  answerNextBar({ step, phraseOrdinal, pitch, midi, sourceNoteId, patchId }) {
    if (!this.isPlaying || !Number.isInteger(step) || step < 0 || step >= 64 || step % 16 !== 0
      || !Number.isInteger(phraseOrdinal) || !Number.isFinite(pitch)) return false;
    this.leadAnswer = { step, phraseOrdinal, pitch, midi, sourceNoteId, patchId, used: false };
    return true;
  }

  _applyLeadAnswer(stepIndex, events, stepSec) {
    const a = this.leadAnswer;
    if (!a || a.used || this.jamPhraseOrdinal !== a.phraseOrdinal || stepIndex < a.step || stepIndex >= a.step + 16) {
      if (a && (this.jamPhraseOrdinal > a.phraseOrdinal || (this.jamPhraseOrdinal === a.phraseOrdinal && stepIndex >= a.step + 16))) this.leadAnswer = null;
      return events;
    }
    const answered = {source_note_id: a.sourceNoteId, midi: a.midi};
    const concrete = {midi_pitch: a.pitch, freq_hz: 440 * 2 ** ((a.pitch - 69) / 12)};
    const lead = events.find(e => e.provenance === 'jam_generated' && e.role === 'lead');
    if (lead) {
      a.used = true;
      return events.map(e => e === lead ? {...e, id: `answer-${stepIndex}-${e.id}`, concrete: {...e.concrete, ...concrete},
        velocity: Math.max(Number(e.velocity) || .5, .6), evolution: {...(e.evolution || {}), answered}} : e);
    }
    if (stepIndex !== a.step || !a.patchId) return events;
    const barHasLead = (this._effectiveJamBacking() || []).some(e => e.role === 'lead' && e.step >= a.step && e.step < a.step + 16);
    if (barHasLead) return events;
    a.used = true;
    return [...events, {id: `answer-${stepIndex}-${this.jamPhraseOrdinal}`, role: 'lead', patch_id: a.patchId, step: stepIndex,
      duration_sec: stepSec * 2, velocity: .6, provenance: 'jam_generated', generated_by: 'musiclab_jam',
      performance: {version: 1, offset_steps: 0}, concrete, evolution: {answered}}];
  }

  /** One readiness contract for both UI feedback and request admission. */
  jamAnswerReadiness() {
    const now=this.audioCtx?.currentTime||0,plan=this.jamAnswer;
    if(!this.isPlaying||!this.performanceTake||this.previewsMuted)
      return {state:'stopped',label:'Answer this',message:'Listen, then play a few notes first.'};
    if(plan&&!plan.cancelled&&now<plan.end)
      return {state:'active',label:'Cancel answer',message:now<plan.start?'Answer queued for the next beat.':'Band answering. Play again whenever you like.'};
    if(this.liveNotes.size)return {state:'held',label:'Release notes to answer',message:'Release your notes, then ask for an answer.'};
    if(now<(this.answerAvailableAt||0))return {state:'cooling',label:'Answer cooling down',message:'You can play. Another answer is available after the previous notes fade.'};
    if(this.performanceTake.events.some(record=>record.event?.source_note_id?.startsWith('jam-live-')
      &&Number.isFinite(record.released_at)&&record.time>=now))
      return {state:'starting',label:'Note starting',message:'Your note is starting. Ask for an answer once it begins.'};
    return {state:'ready',label:'Answer this',message:'Play a phrase, then ask the band to echo it.'};
  }

  /** Optional turn-taking. Only newly performed, released notes can request an answer. */
  setAutomaticAnswers(enabled) {
    enabled = Boolean(enabled);
    if (enabled === Boolean(this.automaticAnswers)) return;
    this.automaticAnswers = enabled;
    if (enabled) this.answeredThrough = this.performanceTake?.sequence || 0;
    else if (this.jamAnswer?.automatic) this.cancelJamAnswer('Automatic answers off. Your notes stay.');
  }

  _serviceAutomaticAnswer() {
    if (!this.automaticAnswers || this.jamAnswerReadiness().state !== 'ready' || this.liveNotes.size) return;
    const now = this.audioCtx.currentTime;
    // Let a promised next-bar melodic adoption sound before an automatic echo
    // occupies its slot. Explicit Answer this remains a separate user request.
    const formAnswer = this.leadAnswer && {phraseOrdinal: this.leadAnswer.phraseOrdinal,
      commitStep: this.leadAnswer.step, events: [{evolution: {answered: {source_note_id: this.leadAnswer.sourceNoteId}}}]};
    for (const adoption of [this.pendingJamLead, this.activeJamLead, formAnswer]) {
      if (adoption && adoption.commitStep !== undefined
        && (adoption.phraseOrdinal > this.jamPhraseOrdinal
          || (adoption.phraseOrdinal === this.jamPhraseOrdinal && this.currentStep < adoption.commitStep + 16))) {
        const waiting = adoption.events.some(e => e.evolution?.answered?.source_note_id
          && !(this.performanceTake?.events || []).some(r => r.time <= now
            && r.event?.evolution?.answered?.source_note_id === e.evolution.answered.source_note_id));
        if (waiting) return;
      }
    }
    const fresh = (this.performanceTake?.events || []).filter(record =>
      record.occurrence > (this.answeredThrough || 0)
      && record.event?.provenance === 'user_placed' && record.event.source_note_id?.startsWith('jam-live-')
      && record.event.role !== 'drums' && record.event.patch_id !== 'reverse_swell'
      && Number.isFinite(record.released_at) && record.released_at <= now);
    if (!fresh.length) return;
    const released = Math.max(...fresh.map(record => record.released_at));
    // A beat of silence gives successive taps time to become a phrase.
    if (now - released < Math.max(.35, 60 / (this.compiledSong.bpm || 100))) return;
    this.requestJamAnswer({ automatic: true });
  }

  /** One explicit echo, independent of the looping/form lead and style mailbox. */
  requestJamAnswer({ automatic = false } = {}) {
    const now=this.audioCtx?.currentTime||0;
    this.answerFeedback=null;
    const feedback=message=>(this.answerFeedback=message);
    const readiness=this.jamAnswerReadiness();
    if(this.liveNotes.size)return 'Release your notes, then ask for an answer.';
    // Direct calls may replace a wholly unsent request; an emitted answer must finish.
    const replaceUnsent=readiness.state==='active'&&!this.liveNotes.size&&now>=(this.answerAvailableAt||0);
    if(readiness.state!=='ready'&&!replaceUnsent)return readiness.message;
    const beatSec=60/(this.compiledSong.bpm||100), stepSec=beatSec/4;
    let start=this.nextStepAudioTime+((4-this.currentStep%4)%4)*stepSec;
    if(start<now+SCHEDULE_AHEAD_SEC)start+=Math.ceil((now+SCHEDULE_AHEAD_SEC-start)/beatSec)*beatSec;
    const id=`jam-answer-${this.stopGeneration||0}-${this.answerSequence=(this.answerSequence||0)+1}`;
    const records = automatic ? this.performanceTake.events.filter(record => record.occurrence > (this.answeredThrough || 0)) : this.performanceTake.events;
    const plan=planJamAnswer(records,{now,start,id,
      windowSec:2*(this.performanceTake.steps_per_bar||16)*stepSec,beatSec});
    if(!plan){
      if(automatic)this.answeredThrough=this.performanceTake.sequence;
      return feedback('Play and release up to four pitched notes, then ask for an answer.');
    }
    this.answeredThrough=Math.max(this.answeredThrough||0,...plan.events.map(item=>item.event.response.source_occurrence));
    this.cancelJamAnswer();
    this.jamAnswer={...plan,automatic,take:this.performanceTake,songId:this.compiledSong.song_id,
      generation:this.stopGeneration||0,requestedAt:now,cancelled:false};
    this.answerMessage='Answer queued for the next beat.';
    return this.answerMessage;
  }

  cancelJamAnswer(message = 'Answer cancelled. Already scheduled notes may finish.') {
    const plan=this.jamAnswer;
    // Successive presses form one phrase. Only interruption of an actual answer,
    // or explicit cancellation/focus loss, consumes the earlier source records.
    if(message !== 'Your turn.' || (plan && !plan.cancelled && (this.audioCtx?.currentTime||0) < plan.end))
      this.answeredThrough=Math.max(this.answeredThrough||0,this.performanceTake?.sequence||0);
    if(!plan||plan.cancelled){if(message==='Your turn.'){this.answerMessage=message;this.answerFeedback=null;}return;}
    plan.cancelled=true;
    for(const item of plan.events)if(item.state==='requested')item.state='cancelled';
    this.answerMessage=message;this.answerFeedback=null;
  }

  jamAnswerStatus() {
    const readiness=this.jamAnswerReadiness();
    if(readiness.state!=='ready')return readiness.message;
    if(this.answerFeedback)return this.answerFeedback;
    return this.jamAnswer?this.answerMessage==='Answer queued for the next beat.'
      ?'Your turn. The answer stays in this performance for Keep.':this.answerMessage:readiness.message;
  }

  _serviceJamAnswer() {
    const plan=this.jamAnswer,now=this.audioCtx.currentTime;
    if(!plan||plan.cancelled)return;
    if(plan.take!==this.performanceTake||plan.songId!==this.compiledSong.song_id
      ||plan.generation!==(this.stopGeneration||0)||this.liveNotes.size||this.previewsMuted) {
      this.cancelJamAnswer();return;
    }
    for(const item of plan.events) {
      if(item.state!=='requested'||item.time>=now+SCHEDULE_AHEAD_SEC)continue;
      if(item.time<now-LATE_STEP_TOLERANCE_SEC){this.cancelJamAnswer('Answer cancelled after a pause. Your notes stay.');break;}
      if(this.mutedLayers.has('lead')||this.mutedLayers.has('tune')){this.cancelJamAnswer('Answer is muted. Your notes stay.');break;}
      try {
        const event=this._resolveVoice(this.spotlightRole&&!roleMatchesLayer(item.event.role,this.spotlightRole)
          ?{...item.event,velocity:dimmedVelocity(item.event.velocity)}:item.event);
        triggerScheduledEvent(this.audioCtx,this.masterBus,event,item.time,this.compiledSong.bpm||100,{answer:true});
        this._rememberPerformance(event,item.time);
        item.state='scheduled';
        // Bound repeated echoes and sampled release overlap; no backlog or stolen personal voices.
        this.answerAvailableAt=Math.max(this.answerAvailableAt||0,item.time+item.event.duration_sec+SAMPLE_TAIL);
      } catch(error) {
        this.cancelJamAnswer(`Answer paused: ${error.message}`);
        break; // An optional answer must never stop the band or remove personal notes.
      }
    }
  }

  _answerOccupies(time) {
    const plan=this.jamAnswer;
    return Boolean(plan&&(!plan.cancelled?time>=plan.start&&time<plan.end
      :plan.events.some(item=>item.state==='scheduled'&&time>=item.time&&time<item.time+item.event.duration_sec)));
  }

  _rememberPerformance(event, time) {
    const take = this.performanceTake;
    if (!take || !this.isPlaying) return null;
    const record = { event: JSON.parse(JSON.stringify(event)), time,
      duration: Math.max(.001, Number(event.duration_sec) || .25), occurrence: ++take.sequence };
    take.events.push(record);
    if(event.provenance==='user_placed'&&event.source_note_id?.startsWith('jam-live-'))
      this.personalRoomUntil=Math.max(this.personalRoomUntil||0,time+Math.min(.25,record.duration));
    // Retain maximum supported form history before a later style can request it.
    // Silence is coverage too; expanding Keep never invents pruned earlier music.
    this._pruneTake(take);
    return record;
  }

  /** The person's notes are never pruned. The band older than the recent bars stays only around them, for at most the
   * newest notes, so a long session stays small. Runs about once a bar. */
  _pruneTake(take) {
    const now = this.audioCtx.currentTime, barSec = (take.steps_per_bar||16) * 15 / take.bpm;
    if (now - (take.prunedAt ?? -Infinity) < barSec) return;
    take.prunedAt = now;
    const oldest = now - 17 * barSec, reach = 8 * barSec;
    const times = take.events.filter(playedLive).map(item => item.time).slice(-512);
    let next = 0;
    take.events = take.events.filter(item => {
      if (item.time + item.duration > oldest || playedLive(item)) return true;
      while (next < times.length && times[next] < item.time - reach) next++;
      return next < times.length && times[next] <= item.time + reach;
    });
  }

  /** After Keep the played history belongs to the kept song, so a later Stop and Play does not bring it back. */
  markPerformanceKept() { if (this.performanceTake) this.performanceTake.kept = true; this.lastStoppedPerformance = null; }

  /** Stop and Play again on the same song is one performance, with the stopped gap closed: the band's earlier bars
   * and the person's notes move forward as a block, keeping their spacing, ending on a bar line before the new start. */
  _carryStoppedTake(start) {
    const prev = this.performanceTake, spb = this.compiledSong.steps_per_bar||16;
    if (!prev || prev.kept || prev.song_id !== this.compiledSong.song_id || (prev.steps_per_bar||16) !== spb || !Number.isFinite(this.stoppedAt)) return null;
    const stoppedAt = this.stoppedAt;
    if (!prev.events.some(item => playedLive(item) && item.time < stoppedAt)) return null;
    const barSec = spb * 15 / prev.bpm;
    const startOfRun = start - Math.ceil((stoppedAt - prev.start) / barSec) * barSec;
    const shift = startOfRun - prev.start;
    const events = prev.events.filter(item => item.time < stoppedAt).map(item => {
      const stoppedShort = item.time + item.duration > stoppedAt;
      return { ...item, time: item.time + shift, duration: stoppedShort ? stoppedAt - item.time : item.duration,
        ...(Number.isFinite(item.released_at) ? { released_at: Math.min(item.released_at, stoppedAt) + shift } : playedLive(item) ? { released_at: Math.min(stoppedAt, item.time + item.duration) + shift } : {}) };
    });
    return { start: startOfRun, events, sequence: prev.sequence };
  }

  capturePerformance() {
    const take = this.performanceTake;
    if (!take || !this.isPlaying) return null;
    const end = this.audioCtx.currentTime;
    const { start, windowBars, bars, events, rests_left_out, earlier } = captureWindow({ events: take.events, start: take.start, end, bpm: take.bpm, stepsPerBar: take.steps_per_bar||16, captureBars: take.capture_bars||4 });
    return { version: 1, ...(take.song_id?{source_song_id:take.song_id}:{}), semantics: 'audio-clock attacks and clipped gates; not physical audibility',
      start, end, bpm: take.bpm, ...(take.steps_per_bar===12?{steps_per_bar:12}:{}), bars, ...(windowBars>4?{window_bars:windowBars,form:this.activeJamBacking()?.phraseContext?.form||null}:{}), ...(rests_left_out?{rests_left_out:true}:{}), ...(earlier?{earlier:{...earlier,...(take.song_id?{source_song_id:take.song_id}:{})}}:{}), events };
  }

  activeJamContext({ readOnly = false } = {}) {
    if(!this.isPlaying)return null;
    const now=this.audioCtx.currentTime;
    const tick=[...(this.jamClockTimeline||[])].reverse().find(t=>t.time<=now);
    let backing;
    if (readOnly) {
      const snapshot=(this.jamBackingTimeline||[]).findLast(item=>item.time<=now);
      if (!snapshot) return null;
      // Pad lookup reads the same immutable reached score many times per frame.
      // Cache a detached frozen copy, never the mutable scheduler ledger itself.
      if (this._padBackingSource !== snapshot) {
        const freeze = value => {
          if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
          return value;
        };
        this._padBackingView=freeze(JSON.parse(JSON.stringify(snapshot)));
        this._padBackingSource=snapshot;
      }
      backing=this._padBackingView;
    } else backing=this.activeJamBacking();
    if(!tick||!backing)return null;
    const bpm=this.performanceTake?.bpm||this.compiledSong.bpm||100;
    return {audioTime:now,bpm,position:tick.step+Math.min(.999999,Math.max(0,(now-tick.time)/(15/bpm))),backing};
  }

  activeJamBacking() {
    if(!this.isPlaying)return null;
    const now=this.audioCtx.currentTime;
    const snapshot=[...(this.jamBackingTimeline||[])].reverse().find(item=>item.time<=now);
    return snapshot?JSON.parse(JSON.stringify(snapshot)):null;
  }

  _rememberJamBacking(time) {
    if(!this.committedJamBacking)return;
    this.jamBackingTimeline=[...(this.jamBackingTimeline||[]),
      {time,events:JSON.parse(JSON.stringify(this._effectiveJamBacking())),
        leadPlan:this.activeJamLead?JSON.parse(JSON.stringify(this.activeJamLead)):null,
        source_song_id:this.compiledSong?.song_id,
        phraseContext:this.committedPhraseContext?JSON.parse(JSON.stringify(this.committedPhraseContext)):null}].slice(-8);
  }

  _commitJamBackingIfDue(skippedBoundary = false) {
    const stepsPerBar=this.compiledSong?.steps_per_bar||16;
    if (this.currentStep % stepsPerBar !== 0) return;
    if (this.pendingJamBacking === null) {
      if (this.adoptJamLeadOnCommit) {
        this.clearJamLead();
        this._rememberJamBacking(this.nextStepAudioTime);
      }
      return;
    }
    const bridge = this.jamBridgeStage === 0;
    const harmonyKey=context=>JSON.stringify([context?.root??null,context?.minor??null,context?.harmony??null,context?.leadGrammar??null]);
    const harmonyChanges=harmonyKey(this.committedPhraseContext)!==harmonyKey(this.pendingPhraseContext);
    if(harmonyChanges&&(!bridge||this.jamBridgeMode==='offbeat-chords-first')) {
      // Keep only reached opening history; retiring a voice is not a new phrase.
      this.retiredJamLeadDescriptor=this.activeJamBacking()?.leadPlan?.descriptor
        ||this.retiredJamLeadDescriptor||null;
      this.clearJamLead();
    }
    if (bridge) {
      // Original one-bar bridge for the compatible two-feel route: incoming
      // percussion, sparse outgoing bass, outgoing harmony. Personal notes
      // never enter these backing arrays. Preserve global steps/phrase phase.
      this.committedJamBacking = this.jamBridgeMode==='offbeat-chords-first'?[
        ...this.pendingJamBacking.filter(event=>event.role==='harmony'||(harmonyChanges&&event.role==='lead')),
        ...this.committedJamBacking.filter(event=>event.role!=='harmony'&&(!harmonyChanges||event.role!=='lead')),
      ]:[
        ...this.pendingJamBacking.filter(event => event.role === 'drums'),
        ...this.committedJamBacking.filter(event => event.role !== 'drums'
          && (event.role !== 'bass' || event.step % stepsPerBar === 0)),
      ];
      if(this.jamBridgeMode==='offbeat-chords-first')this.committedPhraseContext=this.pendingPhraseContext;
      this.jamBridgeStage = 1;
    } else {
      // A lead derived from another progression must not survive the harmony
      // handover. Fall back to the destination's authored lead, then develop it
      // at the next phrase boundary. Personal events are outside this layer.
      this.committedJamBacking = this.pendingJamBacking;
      this.committedPhraseContext=this.pendingPhraseContext;
      this.pendingPhraseContext=null;
      this.pendingJamBacking = null;
      this.jamBridgeStage = null;
      if (this.adoptJamLeadOnCommit) this.clearJamLead();
      this._activateJamForm(true);
    }
    this.lastJamBackingCommit = { step: this.currentStep, audioTime: this.nextStepAudioTime, skippedBoundary,
      phase: bridge ? 'bridge' : 'destination', route:this.jamBridgeMode||'drums-first' };
    this._rememberJamBacking(this.nextStepAudioTime);
  }

  start() {
    if (this.isPlaying || !this.compiledSong) return;
    if (!this.loadingSession && this.compiledSong.events?.some(ev => isSampledPatch(ev.patch_id)) && (!this.masterBus?.piano || this.masterBus.disposed)) {
      this.onAudioError?.('Load sounds before playing. Your notes are preserved.'); return;
    }
    const ctx = this.ensureContext();
    this._celebratingUntilTime = 0;
    this.visualQueue.length = 0;
    this.visualNotes = [];
    this.lastVisualClock = null;
    this.jamClockTimeline = [];
    this.playbackEndTime = null;
    this.isPlaying = true;
    this.jamAnswer=null;this.answeredThrough=0;this.answerMessage='';this.answerFeedback=null;this.answerAvailableAt=0;this.personalRoomUntil=0;
    const carried = this._carryStoppedTake(ctx.currentTime);
    this.lastStoppedPerformance = null;
    this.performanceTake = { song_id: this.compiledSong.song_id, start: carried?.start ?? ctx.currentTime, bpm: this.compiledSong.bpm || 100, steps_per_bar:this.compiledSong.steps_per_bar||16, sequence: carried?.sequence ?? 0, events: carried?.events ?? [] };
    this.jamPhraseOrdinal = 0;
    this.retiredJamLeadDescriptor=null;
    this.clearJamLead();
    if(this._supportsJamPhrase()&&this.initialJamLead) {
      const saved=this.initialJamLead.descriptor,context=this.committedPhraseContext;
      const compatible=!context||!saved||(saved.root===context.root&&saved.minor===context.minor
        &&(saved.leadGrammar??null)===(context.leadGrammar??null)
        &&(saved.version===3?JSON.stringify(saved.harmony)===JSON.stringify(context.harmony):!context.requiresHarmonicLead));
      if(compatible)this.activeJamLead=JSON.parse(JSON.stringify(this.initialJamLead));
      else this.retiredJamLeadDescriptor=JSON.parse(JSON.stringify(saved));
    }
    this._activateJamForm();
    this.jamEvolutionOrigin=(this.activeJamLead?.descriptor||this.retiredJamLeadDescriptor)?.phraseOrdinal||0;
    this.lastStoppedJamLead=null;
    this.masterBus.fadeIn();
    this.currentStep = this.loopStartStep || 0;
    this.nextStepAudioTime = ctx.currentTime + 0.04;
    this.gridOriginTime=this.nextStepAudioTime-this.currentStep*(15/this.compiledSong.bpm);
    this.jamBackingTimeline=[];
    this._rememberJamBacking(this.nextStepAudioTime);
    this.droppedSteps = 0;
    this.droppedVoices = 0;
    this.droppedVoicesSaid = false;
    this.timerId = window.setInterval(() => {
      try { this._lookaheadTick(); }
      catch (error) { this.stop(); this.onAudioError?.(error.message); }
    }, LOOKAHEAD_INTERVAL_MS);
  }

  /** Cut every sound source, each on its own, so one failing cannot leave another playing. */
  _silenceNow() {
    const guarded = fn => { try { fn(); } catch (error) { console.error('Stop kept going past an error', error); } };
    // Also stops auditions, which deliberately do not set isPlaying.
    guarded(() => this.masterBus?.dispose?.());
    guarded(() => this.masterBus?.piano?.stop());
    const drone = this.droneNodes;
    this.droneNodes = null;
    if (drone) {
      for (const osc of [drone.oscRoot, drone.oscFifth]) guarded(() => osc.stop());
      guarded(() => drone.gain.disconnect());
    }
  }

  stop() {
    this.pendingPartHandoff=null;
    // Silence comes first: nothing after this line can leave sound playing.
    this._silenceNow();
    if(this.partAudition) {
      const a=this.partAudition;
      this.compiledSong=a.timeline.filter(t=>t.audioTime<=(this.audioCtx?.currentTime ?? -Infinity)).at(-1)?.song || a.fallbackSong || a.initial;
      this.clearPartAudition();
    }
    this.playEnergy = 0;
    this.leadAnswer = null;
    this.energyDrop = null;
    if(this.isPlaying) {
      try {
        this.lastStoppedPerformance=this.capturePerformance();
        this.lastStoppedLoadingState=this.loadingSession
          ?{state:this.loadingSession.state,liveAt:this.loadingSession.liveAt,cutoff:this.audioCtx.currentTime}:null;
        const snapshot=this.activeJamBacking();
        this.lastStoppedJamLead=snapshot?{source_song_id:snapshot.source_song_id,plan:snapshot.leadPlan,formCursor:snapshot.phraseContext?.form}:null;
        if(snapshot?.phraseContext?.form&&this.requestedJamFormProgram&&snapshot.source_song_id===this.compiledSong?.song_id&&snapshot.phraseContext.form.id===this.requestedJamFormProgram.id)
          this.requestedJamFormProgram={...this.requestedJamFormProgram,cursor:JSON.parse(JSON.stringify(snapshot.phraseContext.form))};
        this.initialJamLead=snapshot?.leadPlan||null;
      } catch (error) { console.error('Stop kept going past an error', error); }
    }
    if(this.isPlaying)this.stoppedAt=this.audioCtx?.currentTime;
    this.stopGeneration=(this.stopGeneration||0)+1;
    this.isPlaying = false;
    // Stop ends a loading session: a bank that finishes later starts nothing.
    this.loadingSession = null;
    this.cancelJamAnswer('Stopped.');
    this.clearJamLead();
    this.jamBackingTimeline=[];
    // Stop cancels the pending live transition. The next explicit Play starts
    // from the latest editable state, which is also what Save/Export retain.
    if (this.committedJamBacking !== null) this.committedJamBacking = (this.compiledSong?.events || []).filter(event => event.provenance === "jam_generated");
    this.activeJamForm=null;
    this.pendingJamBacking = null;
    this.pendingPhraseContext=null;
    this.committedPhraseContext=this.requestedPhraseContext??null;
    this.jamBridgeStage = null;
    this.lastJamBackingCommit = null;
    this.playbackEndTime = null;
    this._celebratingUntilTime = 0;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.visualQueue.length = 0;
    this.visualNotes = [];
    this.lastVisualClock = null;
    this.jamClockTimeline = [];
    // Held presses go silent with the graph below; forget them so no release timer outlives Stop.
    const stoppedNotes = [...this.liveNotes.values()];
    this.liveNotes.clear();
    for (const note of stoppedNotes) {
      clearTimeout(note.timer);
      // Stop cuts the graph immediately, even before a tap's minimum gate. Every note gets its release.
      try { note.onRelease?.(Math.max(0.001, Math.min(LIVE_MAX_HOLD_SEC, this.audioCtx.currentTime - note.startTime))); }
      catch (error) { console.error('Stop kept going past an error', error); }
    }
  }

  _lookaheadTick() {
    if (!this.isPlaying || !this.compiledSong || !this.audioCtx) return;
    // Scheduling the final step happens ahead of the speaker. Keep the transport
    // and final visual alive until the song boundary and the render tail pass.
    if (this.playbackEndTime !== null) {
      const latency = Number(this.audioCtx.outputLatency || this.audioCtx.baseLatency || 0);
      if (this.audioCtx.currentTime >= this.playbackEndTime + latency) {
        this.stop();
        this.onPlaybackEnded?.();
      }
      return;
    }
    let totalSteps = this.compiledSong.total_steps || 64;
    const bpm = this.compiledSong.bpm || 110;
    const swing = this.compiledSong.swing || 0.53;
    const stepSec = (60.0 / bpm) / 4.0;

    // After a stall (busy page, throttled timer), skip the missed steps rather than starting them all at once.
    const missed = overdueSteps(this.nextStepAudioTime, this.audioCtx.currentTime, stepSec);
    for (let i = 0; i < missed; i++) {
      if(!this.partAudition) {this._commitJamBackingIfDue(true);this._commitJamFormIfDue();}
      this.droppedSteps += 1;
      if (!this._advanceStep(totalSteps, stepSec)) return;
    }

    this.visualNotes = this.visualNotes.filter(note => note.end > this.audioCtx.currentTime - Number(this.audioCtx.outputLatency || this.audioCtx.baseLatency || 0));
    if(!this.partAudition) {this._serviceAutomaticAnswer();this._serviceJamAnswer();}
    while (this.nextStepAudioTime < this.audioCtx.currentTime + SCHEDULE_AHEAD_SEC) {
      this._commitContinuousPartIfDue();
      totalSteps=this.compiledSong.total_steps||64;
      this._commitPartAuditionIfDue();
      if(!this.partAudition) {this._commitJamBackingIfDue();this._commitJamFormIfDue();this._commitJamLeadIfDue();}
      // Loaded sounds join at a bar line, for attacks from here on; nothing already sounding changes.
      if (this.loadingSession?.state === "ready" && this.currentStep % (this.compiledSong.steps_per_bar || 16) === 0) {
        this.loadingSession.liveAt=this.nextStepAudioTime;
        this.loadingSession._set("live");
      }
      const stepIndex = this.currentStep;
      const swingOffset = (stepIndex % 2 === 1) ? ((swing - 0.50) * 2.0 * stepSec * 0.5) : 0.0;
      const exactStepTime = this.nextStepAudioTime + swingOffset;

      const events = (this.partAudition || this.committedJamBacking === null) ? (this.compiledSong.events || [])
        : [...(this.compiledSong.events || []).filter(event => event.provenance !== "jam_generated"), ...this._effectiveJamBacking()];
      const energy = this.partAudition ? 0 : this.energyAt(this.nextStepAudioTime);
      const stepEvents = this.partAudition ? events.filter(e=>e.step===stepIndex) : [...this._applyLeadAnswer(stepIndex, events.filter((e) => e.step === stepIndex), stepSec), ...this._energyOrnaments(stepIndex, stepSec, energy)];
      const submitted = [];
      for (const ev of stepEvents) {
        const attack=this.nextStepAudioTime+performanceOffsetSeconds(ev,stepSec,swingOffset);
        if(!this.partAudition&&ev.provenance==='jam_generated'&&ev.role==='lead'
          &&(this._answerOccupies(attack)||(this.makeRoomForLive&&(this.liveNotes.size||attack<(this.personalRoomUntil||0)))))continue;
        if (this.mutedLayers && this.mutedLayers.size > 0) {
          let isMuted = false;
          for (const mLayer of this.mutedLayers) {
            if (roleMatchesLayer(ev.role, mLayer)) {
              isMuted = true;
              break;
            }
          }
          if (isMuted) continue;
        }
        // Resolve once; the energy and spotlight shapes build on the resolved event, not the request.
        let evToPlay = this._resolveVoice(ev);
        if (energy > .02 && ev.provenance === 'jam_generated' && (ev.role === 'drums' || ev.role === 'bass') && ev.generated_by !== 'musiclab_energy')
          evToPlay = { ...evToPlay, velocity: Math.min(1, (ev.velocity ?? .8) * (1 + .45 * energy)) };
        if (this.spotlightRole && !roleMatchesLayer(ev.role, this.spotlightRole)) {
          evToPlay = { ...evToPlay, velocity: dimmedVelocity(ev.velocity) };
        }
        try {
          triggerScheduledEvent(this.audioCtx, this.masterBus, evToPlay,
            this.nextStepAudioTime + performanceOffsetSeconds(ev, stepSec, swingOffset), bpm);
        } catch (error) {
          // No free voice costs this note, never the band, and never a note someone is holding.
          // It did not sound, so it is not history. Any other failure still stops, as it should.
          if (!error?.voicesFull) throw error;
          this.droppedVoices = (this.droppedVoices || 0) + 1;
          if (ev.provenance !== 'jam_generated' && !this.droppedVoicesSaid) {
            this.droppedVoicesSaid = true;
            this.onAudioError?.('Some notes could not sound. Your notes are safe.');
          }
          continue;
        }
        submitted.push(evToPlay);
        if (Number(evToPlay.velocity ?? .85) > 0) this.visualNotes.push({ event: evToPlay, time: attack, end: attack + Math.max(.001, Number(evToPlay.duration_sec) || Number(evToPlay.duration_steps || 1)*stepSec) });
        this._rememberPerformance(evToPlay, this.nextStepAudioTime + performanceOffsetSeconds(ev, stepSec, swingOffset));
      }

      this.jamClockTimeline=[...(this.jamClockTimeline||[]),{step:stepIndex,time:this.nextStepAudioTime}].slice(-32);
      this.visualQueue.push({ step: stepIndex, time: this.nextStepAudioTime, events: submitted, scheduledVisual: true });
      if (!this._advanceStep(totalSteps, stepSec)) break;
    }
  }

  /** Move the transport one step on; false once a non-repeating song has reached its end. */
  _advanceStep(totalSteps, stepSec) {
    this.nextStepAudioTime += stepSec;
    const effectiveEnd = this.loopEndStep !== null ? Math.min(totalSteps, this.loopEndStep) : totalSteps;
    const effectiveStart = Math.min(this.loopStartStep, Math.max(0, effectiveEnd - 1));
    if (this.currentStep + 1 < effectiveEnd) {
      this.currentStep = this.currentStep + 1;
      return true;
    }
    this.currentStep = effectiveStart;
    this.jamPhraseOrdinal += 1;
    if (this.repeatPlayback) return true;
    const tail = Math.max(RENDER_TAIL_SEC, renderDurationSeconds(this.compiledSong) - Number(this.compiledSong.total_duration_sec || totalSteps * stepSec));
    this.playbackEndTime = this.nextStepAudioTime + tail;
    return false;
  }

  drainVisualStep() {
    if (!this.audioCtx) return null;
    // Browser latency is an estimate, not evidence of physical speaker audibility.
    const latency = Number(this.audioCtx.outputLatency || this.audioCtx.baseLatency || 0);
    const now = this.audioCtx.currentTime - latency;
    const passed = [];
    while (this.visualQueue.length > 0 && this.visualQueue[0].time <= now) {
      passed.push(this.visualQueue.shift());
    }
    if (passed.length) this.lastVisualClock = passed[passed.length-1];
    if (!this.lastVisualClock?.scheduledVisual) return passed.length ? { ...passed[passed.length-1], passed } : null;
    this.visualNotes = this.visualNotes.filter(note => note.end > now);
    const sounding = this.visualNotes.filter(note => note.time <= now).map(note => note.event);
    const stepSec = 15 / (this.compiledSong?.bpm || 100);
    const fraction = Math.max(0, Math.min(.999999, (now - this.lastVisualClock.time) / stepSec));
    return { ...this.lastVisualClock, position: this.lastVisualClock.step + fraction, passed, sounding };
  }

  auditionPatchNote(patchId, freqHz, gesture, durationSec = 0.45) {
    const ctx = this.ensureContext();
    const bpm = this.compiledSong?.bpm || 110;
    triggerScheduledEvent(
      ctx,
      this.masterBus,
      {
        role: patchId === "supersaw_stab" ? "harmony" : "hocket",
        patch_id: patchId,
        duration_sec: durationSec,
        velocity: 0.92,
        concrete: { freq_hz: freqHz },
        gesture,
      },
      ctx.currentTime + 0.01,
      bpm
    );
  }

  async renderSongOfflineToWavBlob(compiledSong, roleFilter = null, sampleRate = 44100) {
    return encodeAudioBufferToWavBlob(await this.renderSongOfflineToBuffer(compiledSong, roleFilter, sampleRate));
  }

  /** The same render as the download, as an AudioBuffer (the self-test measures its peak). */
  async renderSongOfflineToBuffer(compiledSong, roleFilter = null, sampleRate = 44100) {
    const song = compiledSong || this.compiledSong;
    if (!song) throw new Error("No compiled song available to render");
    const totalDur = renderDurationSeconds(song);
    const totalSamples = Math.ceil(totalDur * sampleRate);
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);
    const offlineBus = new MasterBus(offlineCtx);
    const bpm = Number(song.bpm || 110);
    const sampled = [];

    for (const ev of song.events || []) {
      if ((roleFilter === "drums" || roleFilter === "beat") && ev.role !== "drums") continue;
      if (roleFilter === "tune" && ev.role !== "lead") continue;
      if (roleFilter === "under" && ev.role !== "harmony" && ev.role !== "bass" && ev.role !== "hocket") continue;
      if (roleFilter === "hocket_bass" && ev.role !== "hocket" && ev.role !== "bass") continue;
      if (roleFilter === "harmony_lead" && ev.role !== "harmony" && ev.role !== "lead") continue;
      const t0 = Math.max(0.005, Number(ev.start_sec || 0));
      if (isSampledPatch(ev.patch_id)) { sampled.push(ev); continue; }
      triggerScheduledEvent(offlineCtx, offlineBus, ev, t0, bpm);
    }

    if (sampled.length) {
      const channels = await renderPiano(sampled, sampleRate, totalSamples);
      const buffer = offlineCtx.createBuffer(2, totalSamples, sampleRate);
      channels.forEach((channel, index) => buffer.copyToChannel(channel, index));
      const source = offlineCtx.createBufferSource(), gain = offlineCtx.createGain();
      source.buffer = buffer; gain.gain.value = .35;
      source.connect(gain); gain.connect(offlineBus.sampledBus); source.start(0);
    }

    return offlineCtx.startRendering();
  }

  async renderPatchSampleOfflineToWavBlob(patchId, freqHz, gesture, durationSec = 0.85, sampleRate = 44100) {
    const totalSamples = Math.ceil((durationSec + 0.01 + RENDER_TAIL_SEC) * sampleRate);
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);
    const offlineBus = new MasterBus(offlineCtx);
    const bpm = Number(this.compiledSong?.bpm || 110);

    triggerScheduledEvent(
      offlineCtx,
      offlineBus,
      {
        role: patchId === "supersaw_stab" ? "harmony" : "hocket",
        patch_id: patchId,
        duration_sec: durationSec,
        velocity: 0.95,
        concrete: { freq_hz: freqHz || 55.0 },
        gesture,
      },
      0.01,
      bpm
    );

    const renderedBuffer = await offlineCtx.startRendering();
    return encodeAudioBufferToWavBlob(renderedBuffer);
  }
}

export function encodeAudioBufferToWavBlob(audioBuffer) {
  const numChannels = Math.min(2, audioBuffer.numberOfChannels || 2);
  const sampleRate = audioBuffer.sampleRate || 44100;
  const length = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = numChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s0 = Math.max(-1, Math.min(1, ch0[i]));
    const s1 = Math.max(-1, Math.min(1, ch1[i]));
    view.setInt16(offset, s0 < 0 ? s0 * 0x8000 : s0 * 0x7fff, true);
    offset += 2;
    if (numChannels > 1) {
      view.setInt16(offset, s1 < 0 ? s1 * 0x8000 : s1 * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}


const NOTE_NAMES_JS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SCALES_JS = {
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
};

function midiToNameJS(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES_JS[pc]}${oct}`;
}

function midiToFreqJS(midi) {
  return Number((440.0 * Math.pow(2.0, (midi - 69.0) / 12.0)).toFixed(4));
}

/**
 * YIN-style normalized difference pitch tracker converting mono PCM samples into scale-snapped draft notes
 * that the user confirms or edits before committing (OSS Wave §3).
 */
export function pitchTrackPcmToDraftNotes(
  samples,
  sampleRate = 44100,
  bpm = 100.0,
  rootPc = 0,
  scaleType = "major",
  barIdx = 0,
  chordPcs = null
) {
  const stepSec = 60.0 / Math.max(40.0, Number(bpm || 100)) / 4.0;
  const samplesPerStep = Math.max(256, Math.round(stepSec * sampleRate));
  const scaleOffsets = SCALES_JS[scaleType] || SCALES_JS.major;
  const scalePcs = scaleOffsets.map((off) => (Number(rootPc) + off) % 12);
  const activeChordPcs =
    Array.isArray(chordPcs) && chordPcs.length >= 3
      ? chordPcs.map((c) => c % 12)
      : [scalePcs[0], scalePcs[2], scalePcs[4]];

  const minFreq = 85.0;
  const maxFreq = 880.0;
  const minLag = Math.max(4, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.floor(sampleRate / minFreq);

  const draftNotes = [];
  const detections = [];
  const numSteps = Math.min(16, Math.max(1, Math.floor(samples.length / samplesPerStep)));

  for (let sIdx = 0; sIdx < numSteps; sIdx++) {
    const start = sIdx * samplesPerStep;
    const winLen = Math.min(samplesPerStep, 2048, samples.length - start);
    if (winLen < maxLag + 16) continue;

    let sumSq = 0;
    for (let i = 0; i < winLen; i++) {
      const v = samples[start + i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / winLen);
    if (rms < 0.02) continue;

    const nWin = winLen - maxLag;
    let energy = 0;
    for (let i = 0; i < nWin; i += 2) {
      const v = samples[start + i];
      energy += v * v;
    }
    if (energy <= 1e-9) continue;

    const diffs = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let diffSq = 0;
      for (let i = 0; i < nWin; i += 2) {
        const d = samples[start + i] - samples[start + i + lag];
        diffSq += d * d;
      }
      diffs[lag] = diffSq / (2.0 * energy);
    }

    let bestLag = 0;
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (diffs[lag] < 0.15 && diffs[lag] <= diffs[lag - 1] && diffs[lag] <= diffs[lag + 1]) {
        bestLag = lag;
        break;
      }
    }
    if (bestLag === 0) {
      let minVal = Infinity;
      for (let lag = minLag; lag <= maxLag; lag++) {
        if (diffs[lag] < minVal) {
          minVal = diffs[lag];
          bestLag = lag;
        }
      }
    }
    if (bestLag <= 0) continue;

    const freq = sampleRate / bestLag;
    if (freq < minFreq || freq > maxFreq) continue;

    detections.push({ sIdx, midiFloat: hzToMidiFloat(freq), rms });
  }

  // Pass 2 (Phase 8.0 + Phase 12d #10 Voice Alchemist): key the whole phrase relative to the singer's own tuning,
  // and map vocal RMS energy onto per-note velocity and synth filter brightness.
  const keyed = keyPhraseRelative(detections.map((d) => d.midiFloat), rootPc, scaleType);
  for (let k = 0; k < detections.length; k++) {
    const sIdx = detections[k].sIdx;
    const rawMidi = Math.round(detections[k].midiFloat);
    const snappedMidi = keyed[k];
    const expr = rmsToExpression(detections[k].rms);
    const snappedPc = ((snappedMidi % 12) + 12) % 12;
    let ctIdx = 0;
    let degOff = 0;
    if (activeChordPcs.includes(snappedPc)) {
      ctIdx = activeChordPcs.indexOf(snappedPc);
      degOff = 0;
    } else {
      let nearestC = activeChordPcs[0];
      let minCDist = 99;
      for (const c of activeChordPcs) {
        const dist = Math.min((snappedPc - c + 12) % 12, (c - snappedPc + 12) % 12);
        if (dist < minCDist) {
          minCDist = dist;
          nearestC = c;
        }
      }
      ctIdx = Math.max(0, activeChordPcs.indexOf(nearestC));
      const sNear = Math.max(0, scalePcs.indexOf(nearestC));
      const sSnap = Math.max(0, scalePcs.indexOf(snappedPc));
      degOff = (sSnap - sNear + scalePcs.length) % scalePcs.length;
    }

    const stepGlobal = barIdx * 16 + sIdx;
    if (
      draftNotes.length > 0 &&
      draftNotes[draftNotes.length - 1].concrete.midi_pitch === snappedMidi &&
      draftNotes[draftNotes.length - 1].step + draftNotes[draftNotes.length - 1].duration_steps === stepGlobal
    ) {
      const prev = draftNotes[draftNotes.length - 1];
      prev.duration_steps += 1;
      prev.velocity = Number(Math.max(prev.velocity, expr.velocity).toFixed(3));
      if (prev.gesture?.xy_pad) {
        prev.gesture.xy_pad.y = Number(Math.max(prev.gesture.xy_pad.y, expr.brightness).toFixed(3));
      }
      continue;
    }

    draftNotes.push({
      id: `hum-draft-${stepGlobal}-${Date.now()}`,
      step: stepGlobal,
      duration_steps: 1,
      velocity: expr.velocity,
      role: "lead",
      patch_id: "pluck_lead",
      pitch_lock_mode: "relational",
      provenance: "hummed_confirmed",
      raw_detected_midi: rawMidi,
      raw_detected_name: midiToNameJS(rawMidi),
      snapped_midi: snappedMidi,
      snapped_name: midiToNameJS(snappedMidi),
      gesture: expr.gesture,
      relational: {
        anchor: "chord_tone",
        chord_tone_index: ctIdx,
        scale_degree_offset: degOff,
        octave_offset: snappedMidi >= 72 ? 1 : 0,
      },
      concrete: {
        midi_pitch: snappedMidi,
        freq_hz: midiToFreqJS(snappedMidi),
        note_name: midiToNameJS(snappedMidi),
        micro_offset_ms: 0.0,
      },
    });
  }

  return draftNotes;
}

/**
 * Listen to the person humming and return draft notes for them to keep or try again (Phase 8.0, decision 8).
 *
 * Honest by design: there is no made-up fallback tune. The result carries a status:
 *   "ok" | "denied" | "no_device" | "silent" | "error".
 * Untimed: listening stops when `controller.stop()` is called (button, Space or Enter), or after
 * `silenceStopSec` of quiet once singing has started, with a `maxSec` safety cap.
 * Audio never leaves the page and the microphone is always released.
 */
export async function recordHummedPhraseToDraftNotes({
  bpm = 100.0,
  rootPc = 0,
  scaleType = "major",
  barIdx = 0,
  chordPcs = null,
  controller = {},
  onState = () => {},
  maxSec = 8,
  silenceStopSec = 1.2,
  mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined,
} = {}) {
  const sampleRate = 22050;
  const voicedRms = 0.02;
  if (!mediaDevices || !mediaDevices.getUserMedia) return { status: "no_device", source: null, notes: [] };

  // Stop works even while the browser is still asking for the microphone, so nobody is stuck on that prompt.
  let cancelled = false;
  let cancelWait = () => {};
  const cancelled$ = new Promise((resolve) => (cancelWait = resolve));
  controller.stop = () => {
    cancelled = true;
    cancelWait();
  };
  let stream;
  const releaseAudioSession = acquireMicrophoneAudioSession();
  try {
    const asked = mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    stream = await Promise.race([asked, cancelled$]);
    if (cancelled) {
      releaseAudioSession();
      asked.then((late) => late?.getTracks().forEach((track) => track.stop())).catch(() => {});
      controller.stop = () => {};
      onState("stopped");
      return { status: "cancelled", source: null, notes: [] };
    }
  } catch (err) {
    releaseAudioSession();
    const name = err && err.name;
    const status =
      name === "NotAllowedError" || name === "SecurityError"
        ? "denied"
        : name === "NotFoundError" || name === "OverconstrainedError"
        ? "no_device"
        : "error";
    return { status, source: null, notes: [] };
  }

  const chunks = [];
  let ctx = null;
  let source = null;
  let proc = null;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx({ sampleRate });
    source = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(2048, 1, 1);
    const silentOut = ctx.createGain();
    silentOut.gain.value = 0; // keep the processor running without playing the mic back
    await new Promise((resolve) => {
      let heard = false;
      let quietSince = null;
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      controller.stop = finish;
      onState("listening");
      proc.onaudioprocess = (e) => {
        const input = new Float32Array(e.inputBuffer.getChannelData(0));
        chunks.push(input);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        const now = ctx.currentTime;
        if (rms >= voicedRms) {
          if (!heard) onState("heard");
          heard = true;
          quietSince = null;
        } else if (heard && quietSince === null) {
          quietSince = now;
        }
        if ((heard && quietSince !== null && now - quietSince >= silenceStopSec) || now >= maxSec) finish();
      };
      source.connect(proc);
      proc.connect(silentOut);
      silentOut.connect(ctx.destination);
    });
  } catch (_err) {
    return { status: "error", source: null, notes: [] };
  } finally {
    try {
      proc?.disconnect();
      source?.disconnect();
    } catch (_e) {
      // already disconnected
    }
    stream.getTracks().forEach((track) => track.stop());
    releaseAudioSession();
    if (ctx) await ctx.close().catch(() => {});
    controller.stop = () => {};
    onState("stopped");
  }

  // Trim leading silence so the phrase starts where the singing starts.
  let first = chunks.findIndex((c) => {
    let s = 0;
    for (let i = 0; i < c.length; i++) s += c[i] * c[i];
    return Math.sqrt(s / c.length) >= voicedRms;
  });
  if (first < 0) return { status: "silent", source: "microphone", notes: [] };
  const voiced = chunks.slice(first);
  const mono = new Float32Array(voiced.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const c of voiced) {
    mono.set(c, offset);
    offset += c.length;
  }
  const notes = pitchTrackPcmToDraftNotes(mono, sampleRate, bpm, rootPc, scaleType, barIdx, chordPcs);
  return { status: notes.length > 0 ? "ok" : "silent", source: "microphone", notes };
}
