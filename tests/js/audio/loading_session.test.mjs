// Phase 14.1: music within 3 seconds. A loading session plays native voices while the sampled bank
// loads, records what was actually heard, brings the loaded sounds in at a bar line, and dies with Stop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LookaheadScheduler, LOADING_VOICES } from "../../../static/js/audio/scheduler.js";

function fakeParam() {
  return { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} };
}
function fakeNode(name) {
  const node = { name, connect(dest) { return dest; }, disconnect() {}, start() {}, stop() {} };
  return new Proxy(node, { get(target, key) { if (!(key in target) && typeof key === "string") target[key] = fakeParam(); return target[key]; } });
}
function fakeContext() {
  const ctx = { currentTime: 0, sampleRate: 1000, state: "running", destination: fakeNode("speaker"),
    createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }) };
  for (const kind of ["Gain", "Oscillator", "BiquadFilter", "WaveShaper", "Convolver", "DynamicsCompressor", "Analyser", "BufferSource", "StereoPanner"])
    ctx[`create${kind}`] = () => fakeNode(kind);
  return ctx;
}
// The band uses sampled sounds, as the Listen jam does.
const song = () => ({ bpm: 100, swing: .5, total_steps: 64, total_duration_sec: 9.6, steps_per_bar: 16,
  events: Array.from({ length: 64 }, (_, step) => [["drums", "kick"], ["bass", "sampled_bass_v1"], ["harmony", "sampled_piano_v1"], ["lead", "sampled_guitar_v1"]]
    .map(([role, patch]) => ({ id: `band-${role}-${step}`, step, role, patch_id: patch, duration_sec: .1, velocity: .3, provenance: "jam_generated", concrete: { midi_pitch: 60, freq_hz: 261.6 } }))).flat() });

/** A scheduler whose bank load is under the test's control. */
globalThis.window = globalThis.window || { setInterval: () => 1, clearInterval() {} };
function scheduler() {
  const s = new LookaheadScheduler();
  s.audioCtx = fakeContext(); s.ensureContext();
  s.setCompiledSong(song(), { quantizeJamBacking: true, jamStyleBlend: 0 });
  const errors = []; s.onAudioError = m => errors.push(m);
  let settle;
  const piano = { triggered: [], trigger(event, time, held) { this.triggered.push({ event, time, held }); return { stop() {} }; }, stop() {} };
  s.preparePiano = () => new Promise((resolve, reject) => { settle = { resolve: () => { s.masterBus.piano = piano; resolve(piano); }, reject }; });
  s.nextStepAudioTime = .04;
  return { s, errors, piano, settle: () => settle };
}
function tick(s) { s.audioCtx.currentTime = s.nextStepAudioTime - .05; s._lookaheadTick(); return s.visualQueue.at(-1); }
const flush = () => new Promise(r => setTimeout(r, 0));
const patches = frame => frame.events.map(e => e.patch_id);

test("without a session, a sampled song refuses to start; with one it starts at once on native voices and records them", () => {
  const { s, errors } = scheduler();
  s.start();
  assert.equal(s.isPlaying, false); assert.equal(errors.length, 1);
  const session = s.beginLoadingSession();
  assert.equal(session.state, "loading");
  s.start();
  assert.equal(s.isPlaying, true);
  const frame = tick(s);
  assert.deepEqual([...new Set(patches(frame))].sort(), ["clean_bass", "kick", "pluck_lead", "warm_keys"]);
  const bass = frame.events.find(e => e.role === "bass");
  assert.equal(bass.requested_patch_id, "sampled_bass_v1"); assert.equal(bass.loading_voice, true);
  const recorded = s.performanceTake.events.map(r => r.event);
  assert.ok(recorded.length > 0);
  assert.ok(recorded.every(e => e.role === "drums" || Object.values(LOADING_VOICES).includes(e.patch_id)), "capture records what was heard, not what was asked for");
});

test("a press while loading sounds native and is held through the handover with its voice unchanged", async () => {
  const { s, piano, settle } = scheduler();
  s.beginLoadingSession(); s.start(); tick(s);
  const id = s.noteOn({ patchId: "sampled_piano_v1", role: "lead", midi: 64, sourceNoteId: "jam-live-x-1" });
  assert.ok(id != null);
  const held = s.liveNotes.get(id);
  assert.equal(held.pianoHandle, null, "the hold is a native voice");
  assert.equal(held.recorded.event.patch_id, "pluck_lead"); assert.equal(held.recorded.event.requested_patch_id, "sampled_piano_v1");
  settle().resolve(); await flush();
  assert.equal(s.loadingSession.state, "ready");
  // Steps 1..15 of the bar stay native; step 16 is the bar line where the bank joins.
  while (s.currentStep % 16 !== 0) assert.ok(!patches(tick(s)).includes("sampled_piano_v1"));
  const atBar = tick(s);
  assert.equal(s.loadingSession.state, "live");
  assert.ok(patches(atBar).includes("sampled_piano_v1"), "from the bar line the sampled sounds play");
  assert.ok(piano.triggered.length > 0);
  assert.equal(s.liveNotes.get(id), held, "the held note is untouched by the handover");
  assert.equal(s.liveNotes.get(id).pianoHandle, null);
  s.noteOff(id);
  assert.equal(s.liveNotes.has(id), false);
});

test("Stop before the bank is ready ends the session, and a late load starts nothing", async () => {
  const { s, settle } = scheduler();
  const session = s.beginLoadingSession(); s.start(); tick(s);
  s.stop();
  assert.equal(s.loadingSession, null);
  settle().resolve(); await flush();
  assert.equal(session.state, "loading", "a dead session does not change state");
  assert.equal(s.isPlaying, false);
});

test("a failed bank leaves the music playing on native voices and retry asks again", async () => {
  const { s, settle } = scheduler();
  const states = [];
  const session = s.beginLoadingSession(); session.onChange(st => states.push(st));
  s.start(); tick(s);
  settle().reject(new Error("offline")); await flush();
  assert.equal(session.state, "failed"); assert.equal(s.isPlaying, true);
  assert.ok(!patches(tick(s)).includes("sampled_piano_v1"));
  session.retry();
  assert.equal(session.state, "loading");
  settle().resolve(); await flush();
  assert.equal(session.state, "ready");
  assert.deepEqual(states, ["failed", "loading", "ready"]);
});

test("a short tap while loading is recorded on its native voice with the request kept beside it", () => {
  const { s } = scheduler();
  s.beginLoadingSession(); s.start(); tick(s);
  s.previewSound({ patchId: "sampled_guitar_v1", role: "lead", midi: 67, durationSec: .25, sourceNoteId: "jam-live-x-2" });
  const mine = s.performanceTake.events.map(r => r.event).find(e => e.source_note_id === "jam-live-x-2");
  assert.equal(mine.patch_id, "pluck_lead"); assert.equal(mine.requested_patch_id, "sampled_guitar_v1");
});

test("fast playing (energy) and a spotlight keep the native voice while loading; the real browser found this one", () => {
  const { s, errors } = scheduler();
  s.beginLoadingSession(); s.start(); tick(s);
  s.addPlayEnergy?.(); s.addPlayEnergy?.(); s.addPlayEnergy?.(); s.addPlayEnergy?.();
  s.setSpotlightRole?.("lead");
  for (let i = 0; i < 20; i++) { const frame = tick(s); assert.ok(!patches(frame).some(p => /^sampled_/.test(p)), `step ${i}: ${patches(frame).join(",")}`); }
  assert.equal(s.isPlaying, true); assert.deepEqual(errors, []);
});

test("when the sounds are already loaded, no session is made", () => {
  const { s, piano } = scheduler();
  s.masterBus.piano = piano;
  assert.equal(s.beginLoadingSession(), null);
  assert.equal(s.loadingSession, undefined);
});
