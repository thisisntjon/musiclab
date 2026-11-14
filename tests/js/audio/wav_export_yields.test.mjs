// Open-release audit L29 (Q7): Download audio renders the sampled parts on the main thread. While music plays,
// one long block stalls the live scheduler and drops steps. renderPiano now gives timers a turn every few
// milliseconds, for the whole render. A fake processor stands in for the real one, so these tests check
// timing and order only; the real browser measurement is recorded with the audit evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sampled from '../../../static/js/audio/sampled_piano.js';

const {renderPiano, PIANO_PATCH} = sampled;
function fakeLibrary({blockMs = 0, tick = null} = {}) {
  const calls = [];
  class SpessaSynthProcessor {
    constructor() { this.ready = Promise.resolve(); this.midiChannels = []; this.soundBankManager = {addSoundBank() {}}; this.at = 0; }
    createMIDIChannel() { this.midiChannels.push({}); }
    programChange(channel, program) { calls.push(`program ${channel} ${program} @${this.at}`); }
    controllerChange() {}
    noteOn(channel, pitch) { calls.push(`on ${channel} ${pitch} @${this.at}`); }
    noteOff(channel, pitch) { calls.push(`off ${channel} ${pitch} @${this.at}`); }
    process(left, right, offset, count) {
      left[offset] = offset; right[offset + count - 1] = count; this.at = offset + count;
      tick?.();
      const until = performance.now() + blockMs; while (performance.now() < until) { /* stands in for synthesis work */ }
    }
    destroy() { calls.push('destroy'); }
  }
  return {calls, load: async () => ({library: {SpessaSynthProcessor, SoundBankLoader: {fromArrayBuffer: bank => bank}}, bank: new ArrayBuffer(8)})};
}
// A live-scheduler stand-in: a 4 ms timer. The longest stretch without a tick is how long the page was blocked.
async function timerProbe(work) {
  const stamps = [], timer = setInterval(() => stamps.push(performance.now()), 4);
  const start = performance.now(); const value = await work(); const end = performance.now();
  clearInterval(timer);
  const marks = [start, ...stamps.filter(t => t > start && t < end), end];
  return {value, ticks: marks.length - 2, totalMs: end - start, longestBlockMs: Math.max(...marks.slice(1).map((t, i) => t - marks[i]))};
}
const rate = 1000, samples = 128 * 960;
const events = [
  {patch_id: PIANO_PATCH, start_sec: 1, duration_sec: 2, velocity: .8, concrete: {freq_hz: 440}},
  {patch_id: 'sampled_guitar_v1', start_sec: 12.5, duration_sec: 4, velocity: .7, concrete: {freq_hz: 220}},
];

test('a long WAV export gives timers a turn, so live playback keeps its steps', async () => {
  const {load} = fakeLibrary({blockMs: .5});
  const probe = await timerProbe(() => renderPiano(events, rate, samples, load));
  assert.ok(probe.ticks >= 4, `timers ran ${probe.ticks} times during a ${samples / 128}-block export`);
  // The old export blocked for all of its ~480 ms. Slices are 30 ms. Node's event loop is not a browser's and can
  // run a few message turns before a timer, and other test files share the CPU, so the bound is relative and loose.
  assert.ok(probe.longestBlockMs < probe.totalMs / 2,
    `the page was blocked for ${probe.longestBlockMs.toFixed(1)} of ${probe.totalMs.toFixed(1)} ms at once`);
});

test('giving timers a turn does not change what is rendered', async () => {
  const slow = fakeLibrary({blockMs: .5}), fast = fakeLibrary();
  const [slowOut, fastOut] = [await renderPiano(events, rate, samples, slow.load), await renderPiano(events, rate, samples, fast.load)];
  assert.deepEqual(slow.calls, fast.calls);
  assert.ok(fast.calls.includes(`on 0 69 @${rate}`) && fast.calls.at(-1) === 'destroy');
  assert.deepEqual(slowOut, fastOut);
});

test('a long song keeps giving timers a turn to the very end, even on a slow page', async () => {
  // Review of L29: the old cap stopped the turns after 2 s, so a long song or a slow Chromebook blocked the rest.
  // A fake page clock: every block costs 10 ms. 600 blocks of 128 frames at 1000 Hz is a 76.8 s song and 6 s of work.
  const RealChannel = globalThis.MessageChannel;
  let now = 0; const turnsAt = [];
  const longEvents = [...events, {patch_id: PIANO_PATCH, start_sec: 70, duration_sec: 5, velocity: .8, concrete: {freq_hz: 330}}];
  const {load, calls} = fakeLibrary({tick: () => { now += 10; }});
  Object.defineProperty(performance, 'now', {value: () => now, configurable: true, writable: true});
  globalThis.MessageChannel = class extends RealChannel { constructor() { super(); turnsAt.push(now); } };
  try { await renderPiano(longEvents, rate, 128 * 600, load); }
  finally { delete performance.now; globalThis.MessageChannel = RealChannel; }
  const workMs = now; // 600 blocks, plus a few short blocks where a note starts or ends mid-block
  assert.equal(typeof performance.now(), 'number');
  assert.ok(calls.some(c => /^on \d+ 64 @70000$/.test(c)), 'the late note is played on time');
  const {RENDER_SLICE_MS: slice} = sampled;
  const turnMs = (Math.floor(slice / 10) + 1) * 10; // a turn after the first block past the slice: 4 blocks, 40 ms
  const marks = [...turnsAt, workMs], gaps = marks.slice(1).map((t, i) => t - marks[i]);
  assert.ok(Math.max(...gaps) <= turnMs, `longest stretch without a turn: ${Math.max(...gaps)} ms of fake time`);
  assert.equal(turnsAt.length, Math.floor(workMs / turnMs) + 1, 'one turn every slice for all 6 s, plus one before the bank is read');
  assert.ok(workMs >= 6000 && turnsAt.at(-1) >= workMs - turnMs, `the last turn came at ${turnsAt.at(-1)} ms of ${workMs}`);
});

test('negative control: the timer probe catches a page that blocks', async () => {
  const probe = await timerProbe(async () => {
    await null;
    const until = performance.now() + 120; while (performance.now() < until) { /* one long block */ }
  });
  assert.equal(probe.ticks, 0);
  assert.ok(probe.longestBlockMs >= 115);
});
