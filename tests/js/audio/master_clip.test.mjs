// Phase 8.0 AC5: the browser safety curve can never output more than the -3 dBFS ceiling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MasterBus, createSafetyCeilingCurve, SAFETY_CEILING, DEFAULT_VOLUME, STOP_FADE_SECONDS } from "../../../static/js/audio/master_bus.js";
import { LookaheadScheduler, renderDurationSeconds, RENDER_TAIL_SEC } from "../../../static/js/audio/scheduler.js";

test("AC5: curve max |y| <= 0.708 and the ceiling constant is -3 dBFS", () => {
  assert.ok(Math.abs(SAFETY_CEILING - 0.708) < 1e-9);
  const curve = createSafetyCeilingCurve();
  let max = 0;
  for (const y of curve) max = Math.max(max, Math.abs(y));
  assert.ok(max <= SAFETY_CEILING, `curve peak ${max} exceeds ceiling`);
  // WaveShaper clamps inputs outside [-1, 1] to the curve ends, so the ends bound inputs in [-4, 4].
  assert.ok(Math.abs(curve[0]) <= SAFETY_CEILING && Math.abs(curve[curve.length - 1]) <= SAFETY_CEILING);
});

test("quiet signals pass through unchanged below the knee", () => {
  const n = 4097;
  const curve = createSafetyCeilingCurve(SAFETY_CEILING, n);
  const at = (x) => curve[Math.round(((x + 1) / 2) * (n - 1))];
  for (const x of [-0.5, -0.2, 0, 0.2, 0.5]) assert.ok(Math.abs(at(x) - x) < 2e-3, `x=${x} changed to ${at(x)}`);
});

test("default listening volume cannot lift output past the ceiling", () => {
  assert.ok(DEFAULT_VOLUME > 0 && DEFAULT_VOLUME <= 1);
});

test("whole-song transport can stop after its chosen ending", () => {
  const scheduler = new LookaheadScheduler();
  scheduler.compiledSong = { total_steps: 2, bpm: 120, swing: 0.5, events: [] };
  scheduler.audioCtx = { currentTime: 0 };
  scheduler.isPlaying = true;
  scheduler.currentStep = 1;
  scheduler.nextStepAudioTime = 0;
  scheduler.setRepeatPlayback(false);
  let ended = false;
  scheduler.onPlaybackEnded = () => { ended = true; };
  scheduler._lookaheadTick();
  assert.equal(scheduler.isPlaying, true, "lookahead must not finish before the last step sounds");
  assert.equal(ended, false);
  assert.equal(scheduler.visualQueue.length, 1, "retain the final visual until heard");
  scheduler.audioCtx.currentTime = 0.12;
  scheduler._lookaheadTick();
  assert.equal(scheduler.visualQueue.length, 1, "do not schedule another loop while draining");
  assert.equal(scheduler.isPlaying, true);
  scheduler.audioCtx.currentTime = 2.13;
  scheduler._lookaheadTick();
  assert.equal(scheduler.isPlaying, false);
  assert.equal(ended, true);
});

test("manual stop cancels pending natural completion", () => {
  const scheduler = new LookaheadScheduler();
  scheduler.compiledSong = { total_steps: 1, bpm: 120, events: [] };
  scheduler.audioCtx = { currentTime: 0 };
  scheduler.isPlaying = true;
  scheduler.setRepeatPlayback(false);
  let ended = false;
  scheduler.onPlaybackEnded = () => { ended = true; };
  scheduler._lookaheadTick();
  scheduler.stop();
  scheduler.audioCtx.currentTime = 10;
  scheduler._lookaheadTick();
  assert.equal(ended, false);
  assert.equal(scheduler.playbackEndTime, null);
});

test("render extent retains notes beyond declared boundary and reserves effect tail", () => {
  assert.equal(RENDER_TAIL_SEC, 2);
  assert.equal(renderDurationSeconds({ total_duration_sec: 4, events: [] }), 6);
  assert.equal(renderDurationSeconds({ total_duration_sec: 4,
    events: [{ start_sec: 3.9, duration_sec: 1.1 }] }), 7);
  assert.equal(renderDurationSeconds({ total_duration_sec: 0, events: [] }), 2);
});

test("Stop retires a preview-only graph and repeated Stop does not create audio", () => {
  const scheduler = new LookaheadScheduler();
  let disposed = 0;
  scheduler.masterBus = { dispose() { disposed++; } };
  scheduler.visualQueue = [{ step: 0 }];
  scheduler._celebratingUntilTime = 10;
  scheduler.stop();
  assert.equal(disposed, 1);
  assert.equal(scheduler.isPlaying, false);
  assert.equal(scheduler.audioCtx, null);
  assert.deepEqual(scheduler.visualQueue, []);
  assert.equal(scheduler._celebratingUntilTime, 0);
});

test("a retired graph fades once and volume or play cannot reopen it", () => {
  const originalTimeout = globalThis.setTimeout;
  const callbacks = [];
  globalThis.setTimeout = (fn) => { callbacks.push(fn); };
  try {
    const calls = [];
    const bus = Object.create(MasterBus.prototype);
    bus.ctx = { currentTime: 2 };
    bus.masterGain = { gain: {
      value: 0.3,
      cancelScheduledValues: time => calls.push(["cancel", time]),
      setValueAtTime: (...args) => calls.push(["set", ...args]),
      linearRampToValueAtTime: (...args) => calls.push(["ramp", ...args]),
    }, disconnect: () => calls.push(["disconnect"]) };
    bus.dispose();
    bus.dispose();
    bus.setVolume(1);
    bus.fadeIn();
    assert.equal(callbacks.length, 1);
    assert.deepEqual(calls, [["cancel", 2], ["set", 0.3, 2], ["ramp", 0, 2 + STOP_FADE_SECONDS]]);
    callbacks[0]();
    assert.deepEqual(calls.at(-1), ["disconnect"]);
  } finally { globalThis.setTimeout = originalTimeout; }
});

test("delayed drone release cannot stop a replacement drone", () => {
  const originalTimeout = globalThis.setTimeout;
  let cleanup;
  globalThis.setTimeout = fn => { cleanup = fn; };
  try {
    const scheduler = new LookaheadScheduler();
    let oldStops = 0;
    const old = { oscRoot: { stop() { oldStops++; } }, oscFifth: { stop() { oldStops++; } },
      gain: { gain: { setTargetAtTime() {} }, disconnect() {} } };
    scheduler.droneNodes = old;
    scheduler.setReferenceDrone(false);
    assert.equal(scheduler.droneNodes, null);
    const replacement = { oscRoot: { stop() { assert.fail("new drone stopped"); } } };
    scheduler.droneNodes = replacement;
    cleanup();
    assert.equal(oldStops, 2);
    assert.equal(scheduler.droneNodes, replacement);
  } finally { globalThis.setTimeout = originalTimeout; }
});

test("rapid restart disconnects the retired output before connecting a new bus", () => {
  const calls = [];
  const node = () => {
    const result = { connect: dest => { if (dest === "speaker") calls.push("new output"); }, disconnect() {} };
    for (const key of ["gain", "frequency", "threshold", "knee", "ratio", "attack", "release"]) {
      result[key] = { value: 0, setTargetAtTime(value) { this.value = value; } };
    }
    return result;
  };
  const scheduler = new LookaheadScheduler();
  scheduler.audioCtx = { currentTime: 0, sampleRate: 1000, state: "running", destination: "speaker",
    createGain: node, createBiquadFilter: node, createWaveShaper: node, createConvolver: node,
    createDynamicsCompressor: node, createAnalyser: node,
    createBuffer: (_channels, length) => ({ getChannelData: () => new Float32Array(length) }),
  };
  const old = { disposed: true, ottPunch: 0.4, setVolume() {}, disconnect: () => calls.push("old disconnected") };
  scheduler.masterBus = old;
  scheduler.setVolume(0.25);
  scheduler.ensureContext();
  assert.deepEqual(calls, ["old disconnected", "new output"]);
  assert.notEqual(scheduler.masterBus, old);
  assert.equal(scheduler.masterBus.masterGain.gain.value, 0.25);
  assert.equal(scheduler.masterBus.ottPunch, 0.4);
  assert.equal(scheduler.isPlaying, false);
});
