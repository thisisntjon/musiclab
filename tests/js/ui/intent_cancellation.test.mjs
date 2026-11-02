// Phase 13.2 repair (Codex red team, 2026-11-01): automatic recovery must respect Stop,
// release, focus loss, capture scope and real save results.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function setup({ storageFails = false } = {}) {
  const values = new Map(), session = new Map();
  globalThis.window = {
    localStorage: {
      getItem: k => values.get(k) ?? null,
      setItem: (k, v) => { if (storageFails) throw Error("quota"); values.set(k, v); },
      removeItem: k => values.delete(k),
    },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {},
  };
  const root = { innerHTML: "", insertAdjacentHTML() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: id => id === "play-flow" ? root : null };
  let releaseLoad;
  const calls = [];
  const scheduler = {
    isPlaying: false, stopGeneration: 0, liveNotes: new Map(), masterBus: { piano: null, disposed: true }, audioCtx: { currentTime: 0 },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    preparePiano() { return new Promise(resolve => { releaseLoad = () => { this.masterBus = { piano: {}, disposed: false }; resolve({}); }; }); },
    previewSound(sound) { calls.push(["short", sound.patchId]); },
    noteOn(sound) { calls.push(["hold", sound.patchId]); return 1; }, noteOff() {},
    stop() { this.isPlaying = false; this.stopGeneration++; }, start() { this.isPlaying = true; },
    requestJamAnswer() { calls.push(["answer"]); }, cancelJamAnswer() {},
    capturePerformance: () => null, activeJamBacking: () => null, activeJamContext: () => null,
  };
  const announced = [];
  const flow = new PlayFlow({ scheduler, _announce: m => announced.push(String(m)), _logSessionEvent() {} });
  flow._keepMusicGoing = async function (token = this._intentToken()) {
    if (!this._intentValid(token)) return false;
    this.app.scheduler.start(); return true;
  };
  flow._freshState();
  flow.doc = startJam(flow.doc, { kind: "pitched", patchId: "sampled_piano_v1" });
  flow.doc.jam_session.live_keys = true;
  flow.stage = "jam";
  flow._liveJamPads = () => Array.from({ length: 4 }, (_, i) => ({ patchId: "sampled_piano_v1", role: "lead", midi: 60 + i, key: "asdf"[i], label: "x" }));
  return { flow, scheduler, calls, announced, load: () => releaseLoad?.() };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("Stop while a key waits for sounds wins: nothing starts and nothing plays", async () => {
  const { flow, scheduler, calls, load } = setup();
  flow._playJamPad(0, "key:a");
  scheduler.stop();
  load(); await tick(); await tick();
  assert.equal(scheduler.isPlaying, false);
  assert.deepEqual(calls, []);
});

test("a key still held after loading keeps its hold; one let go while loading plays once", async () => {
  let { flow, calls, load } = setup();
  flow._playJamPad(0, "key:a");
  load(); await tick(); await tick();
  assert.deepEqual(calls, [["hold", "sampled_piano_v1"]]);
  ({ flow, calls, load } = setup());
  flow._playJamPad(1, "key:s");
  flow._releaseLive("key:s");
  load(); await tick(); await tick();
  assert.deepEqual(calls, [["short", "sampled_piano_v1"]]);
});

test("focus loss and song changes cancel a waiting key press", async () => {
  for (const cancel of [f => f._releaseAllLive(), f => { f.doc = { ...f.doc, id: "another-song" }; }]) {
    const { flow, scheduler, calls, load } = setup();
    flow._playJamPad(0, "key:a");
    cancel(flow);
    load(); await tick(); await tick();
    assert.equal(scheduler.isPlaying, false);
    assert.deepEqual(calls, []);
  }
});

test("focus loss cancels an answer that was waiting for the keys to be let go", async () => {
  const { flow, scheduler, calls } = setup();
  scheduler.isPlaying = true; scheduler.masterBus = { piano: {}, disposed: false };
  flow.liveHolds.set("key:a", 1); scheduler.liveNotes.set(1, {});
  flow.answerOnRelease = true;
  flow._releaseAllLive();
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.ok(!calls.some(c => c[0] === "answer"), "a cancelled answer is never queued again");
});

test("an answer asked for while holding plays once the keys are let go", async () => {
  const { flow, scheduler, calls } = setup();
  scheduler.isPlaying = true; scheduler.masterBus = { piano: {}, disposed: false };
  flow.liveHolds.set("key:a", 1);
  flow.answerOnRelease = true;
  flow._releaseLive("key:a");
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.ok(calls.some(c => c[0] === "answer"));
});

test("Keep never claims the song is saved when storage failed", () => {
  const { flow, announced } = setup({ storageFails: true });
  flow.app.scheduler.capturePerformance = () => ({ source_song_id: flow.doc.id, bars: 1, bpm: 100, start: 0, end: 2.4, steps_per_bar: 16,
    events: [{ event: { id: "mine", role: "lead", patch_id: "warm_keys", velocity: .7, provenance: "user_placed", concrete: { midi_pitch: 64 } },
      time: .3, duration: .3, occurrence: 1 }] });
  flow._captureDirection();
  assert.ok(flow.doc.captured_performance, "the capture was kept in memory");
  assert.ok(!announced.some(m => /It is saved/.test(m)), announced.join(" | "));
  assert.ok(announced.some(m => /not saved/.test(m)));
});

test("Only-my-playing Keep with nothing played keeps nothing, never the band", () => {
  const { flow, announced } = setup();
  flow.doc.jam_session.personal_only = true;
  flow.app.scheduler.lastStoppedPerformance = { source_song_id: flow.doc.id, events: [{ event: { id: "band", provenance: "jam_generated", role: "harmony" } }] };
  const before = structuredClone(flow.doc);
  flow._captureDirection();
  assert.equal(flow.stage, "jam");
  assert.deepEqual(flow.doc, before);
  assert.match(announced.at(-1), /Only your playing/);
});

test("a press that has to wait shows at once that it was heard, and the sign clears when it plays", async () => {
  const { flow, load } = setup();
  flow._playJamPad(2, "key:d");
  assert.equal(flow.jamMessage, "Getting the sound ready…");
  const html = flow._renderListeningJam();
  assert.match(html, /data-key="jam-pad:2"[^>]*aria-busy="true"|pf-pad-waiting[^>]*data-key="jam-pad:2"/);
  load(); await tick(); await tick();
  assert.equal(flow.pendingPad, null);
  assert.doesNotMatch(flow._renderListeningJam(), /pf-pad-waiting/);
  assert.notEqual(flow.jamMessage, "Getting the sound ready…");
});
