// Phase 14.1: Listen does not wait for the sampled bank. The journey starts the music at once,
// says what is happening in plain words, and keeps its five primary controls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";

function setup({ withSession = true } = {}) {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  const said = [], calls = [];
  const sched = { isPlaying: false, stopGeneration: 0, masterBus: { piano: null, disposed: false }, loadingSession: null, liveNotes: new Map(),
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {}, seekToStep() {},
    capturePerformance: () => null, activeJamBacking: () => null, activeJamContext: () => null, onPlaybackEnded() {},
    unlock: async () => { calls.push("unlock"); }, stop() { this.isPlaying = false; this.loadingSession = null; }, start() { calls.push("start"); this.isPlaying = true; },
    preparePiano() { calls.push("preparePiano"); return new Promise(() => {}); },   // a bank that never finishes
    noteOn(args) { calls.push(["noteOn", args.patchId]); return 1; }, previewSound(args) { calls.push(["preview", args.patchId]); }, addPlayEnergy() {} };
  if (withSession) sched.beginLoadingSession = function () {
    calls.push("beginLoadingSession");
    const listeners = new Set();
    this.loadingSession = { state: "loading", onChange: cb => listeners.add(cb), _set(st) { this.state = st; for (const cb of listeners) cb(st); }, retry: () => calls.push("retry") };
    return this.loadingSession;
  };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: sched, _announce: m => said.push(String(m)), _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "jam"; flow.trail = []; flow.confirm = {}; flow.liveHolds = new Map(); flow.comfort = {};
  flow._freshState();
  return { flow, sched, said, calls };
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
const within = (p, ms) => Promise.race([p.then(() => "done"), new Promise(r => setTimeout(() => r("timeout"), ms))]);

test("Listen starts the music without waiting for the bank, and says so in plain words", async () => {
  const { flow, sched, calls } = setup();
  assert.equal(await within(press(flow, "listen-circle"), 500), "done", "Listen must not await the bank");
  assert.ok(calls.indexOf("beginLoadingSession") < calls.indexOf("start"));
  assert.equal(sched.isPlaying, true);
  assert.match(flow.pianoMessage, /on the way/);
  sched.loadingSession._set("ready");
  assert.match(flow.pianoMessage, /next bar/);
  sched.loadingSession._set("live");
  assert.equal(flow.pianoMessage, "");
});

test("keys play straight away while loading; nothing waits on the bank", async () => {
  const { flow, sched, calls } = setup();
  await press(flow, "listen-circle");
  calls.length = 0;
  flow._playJamPad(0, "key:a");
  assert.ok(calls.some(c => Array.isArray(c) && c[0] === "noteOn"), "a held key sounds at once");
  assert.ok(!calls.includes("preparePiano"));
  assert.equal(flow.pendingPad ?? null, null);
  // Moving deeper keeps the music going without a bank wait either.
  sched.isPlaying = false; calls.length = 0;
  assert.equal(await within(flow._keepMusicGoing(), 500), "done");
  assert.ok(!calls.includes("preparePiano"));
});

test("a failed load keeps the music and puts one Retry inside Help; the primary controls are unchanged", async () => {
  const { flow, sched, calls } = setup();
  await press(flow, "listen-circle");
  sched.loadingSession._set("failed");
  assert.match(flow.pianoMessage, /did not load/i);
  assert.match(flow._helpPanelHtml(), /data-key="sounds-retry"/);
  await press(flow, "sounds-retry");
  assert.ok(calls.includes("retry"));
  sched.loadingSession._set("live");
  assert.doesNotMatch(flow._helpPanelHtml(), /sounds-retry/);
});

test("without a loading-capable scheduler, Listen takes the old loading path", async () => {
  const { flow, calls } = setup({ withSession: false });
  const outcome = await within(press(flow, "listen-circle"), 200);
  assert.equal(outcome, "timeout", "the old path waits for the bank");
  assert.ok(calls.includes("preparePiano"));
});
