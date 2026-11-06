// Status review findings on e74db66. Stop must silence first, so a throwing callback can never leave sound
// playing. Running out of sampled voices must cost a note, not the band, and must never steal a held note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LookaheadScheduler } from '../../../static/js/audio/scheduler.js';
import { PianoAllocation, TOTAL_CHANNELS } from '../../../static/js/audio/sampled_piano.js';

function fakeParam() { return { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }; }
function fakeNode(name) {
  const node = { name, connect(dest) { return dest; }, disconnect() {}, start() {}, stop() {} };
  return new Proxy(node, { get(target, key) { if (!(key in target) && typeof key === 'string') target[key] = fakeParam(); return target[key]; } });
}
function fakeContext() {
  const ctx = { currentTime: 0, sampleRate: 1000, state: 'running', destination: fakeNode('speaker'), createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }) };
  for (const kind of ['Gain', 'Oscillator', 'BiquadFilter', 'WaveShaper', 'Convolver', 'DynamicsCompressor', 'Analyser', 'BufferSource', 'StereoPanner']) ctx[`create${kind}`] = () => fakeNode(kind);
  return ctx;
}
globalThis.window = globalThis.window || { setInterval: () => 1, clearInterval() {} };
const song = patch => ({ bpm: 100, swing: .5, total_steps: 64, total_duration_sec: 9.6, steps_per_bar: 16, events: Array.from({ length: 64 }, (_, step) => ({ id: `band-${step}`, step, role: 'lead', patch_id: patch, duration_sec: .1, velocity: .3, provenance: 'jam_generated', concrete: { midi_pitch: 60, freq_hz: 261.6 } })) });
function scheduler(patch = 'warm_keys') {
  const s = new LookaheadScheduler();
  s.audioCtx = fakeContext(); s.ensureContext();
  s.setCompiledSong(song(patch), { quantizeJamBacking: true, jamStyleBlend: 0 });
  const errors = []; s.onAudioError = m => errors.push(m);
  return { s, errors };
}
const tick = s => { s.audioCtx.currentTime = s.nextStepAudioTime - .05; s._lookaheadTick(); };
const quiet = fn => { const original = console.error; console.error = () => {}; try { return fn(); } finally { console.error = original; } };

test('Stop silences before any release callback runs', () => {
  const { s } = scheduler();
  s.start();
  const order = [];
  const dispose = s.masterBus.dispose.bind(s.masterBus);
  s.masterBus.dispose = () => { order.push('silence'); dispose(); };
  s.noteOn({ patchId: 'pluck_lead', role: 'lead', midi: 60, onRelease() { order.push('callback'); } });
  s.stop();
  assert.deepEqual(order, ['silence', 'callback']);
});

test('a throwing release callback cannot leave sound playing, stop the other callbacks, or escape Stop', () => {
  const { s } = scheduler();
  s.start();
  const released = [];
  s.noteOn({ patchId: 'pluck_lead', role: 'lead', midi: 60, onRelease() { throw Error('boom'); } });
  s.noteOn({ patchId: 'pluck_lead', role: 'lead', midi: 64, onRelease() { released.push('second'); } });
  const bus = s.masterBus; let pianoStopped = false;
  bus.piano = { stop() { pianoStopped = true; } };
  assert.doesNotThrow(() => quiet(() => s.stop()));
  assert.equal(bus.disposed, true, 'the bus is silenced');
  assert.equal(pianoStopped, true, 'the sampled voices are silenced');
  assert.deepEqual(released, ['second']);
  assert.equal(s.isPlaying, false);
  assert.equal(s.liveNotes.size, 0);
});

test('a throwing callback on an ordinary key release fades the note and does not escape', () => {
  const { s } = scheduler();
  s.start();
  const id = s.noteOn({ patchId: 'pluck_lead', role: 'lead', midi: 60, onRelease() { throw Error('boom'); } });
  assert.doesNotThrow(() => quiet(() => s.noteOff(id)));
  assert.equal(s.liveNotes.has(id), false);
  s.stop();
});

test('a failure while saving the stopped take cannot leave sound playing', () => {
  const { s } = scheduler();
  s.start();
  s.capturePerformance = () => { throw Error('boom'); };
  const bus = s.masterBus;
  assert.doesNotThrow(() => quiet(() => s.stop()));
  assert.equal(bus.disposed, true);
  assert.equal(s.isPlaying, false);
});

test('a failing piano stop still stops the drone and ends playback', () => {
  const { s } = scheduler();
  s.start();
  s.masterBus.piano = { stop() { throw Error('boom'); } };
  let droneStopped = 0;
  s.droneNodes = { oscRoot: { stop() { droneStopped++; } }, oscFifth: { stop() { droneStopped++; } }, gain: { disconnect() {} } };
  assert.doesNotThrow(() => quiet(() => s.stop()));
  assert.equal(droneStopped, 2);
  assert.equal(s.isPlaying, false);
});

function exhausted() {
  const pool = new PianoAllocation();
  for (let i = 0; i < TOTAL_CHANNELS * 16; i++) { try { pool.claim(0, 1000, 20 + (i % 80), 64, i % 8); } catch { break; } }
  let thrown; try { pool.claim(0, 1000, 60, 64, 0); } catch (e) { thrown = e; }
  return thrown;
}

test('a person\'s release still records its length after Stop has silenced', () => {
  const { s } = scheduler();
  s.start();
  const lengths = [];
  s.audioCtx.currentTime = 1;
  s.noteOn({ patchId: 'pluck_lead', role: 'lead', midi: 60, onRelease: seconds => lengths.push(seconds) });
  s.audioCtx.currentTime = 1.5;
  s.stop();
  assert.equal(lengths.length, 1);
  assert.ok(lengths[0] > .4 && lengths[0] < .6);
});

test('the allocator marks exhaustion so it can be told apart from a real failure', () => {
  const error = exhausted();
  assert.ok(error, 'the pool does run out');
  assert.equal(error.voicesFull, true);
  assert.match(error.message, /overlapping/);
});

function sampledBand() {
  const { s, errors } = scheduler('sampled_guitar_v1');
  const piano = { triggered: 0, full: true, trigger() { if (this.full) throw exhausted(); this.triggered++; return {}; }, release() { return true; }, stop() {} };
  s.masterBus.piano = piano;
  return { s, errors, piano };
}

test('running out of voices costs that note: the band plays on and picks up when voices free', () => {
  const { s, errors, piano } = sampledBand();
  s.start();
  assert.equal(s.isPlaying, true);
  tick(s); tick(s);
  assert.equal(s.isPlaying, true, 'the band is still playing');
  assert.equal(s.timerId !== null, true);
  assert.deepEqual(errors, [], 'a dropped band note is not an alarm');
  assert.ok(s.droppedVoices > 0, 'the drop is counted');
  const take = s.performanceTake.events.length;
  piano.full = false;
  s.nextStepAudioTime += .001; tick(s); tick(s);
  assert.ok(piano.triggered > 0, 'notes sound again');
  assert.ok(s.performanceTake.events.length > take);
  s.stop();
});

test('a dropped note is not recorded as heard, and a person\'s own note says so once', () => {
  const { s, errors } = sampledBand();
  const events = song('sampled_guitar_v1').events.map(e => ({ ...e, provenance: 'user_placed', id: `mine-${e.step}`, source_note_id: `mine-${e.step}` }));
  s.setCompiledSong({ ...song('sampled_guitar_v1'), events }, { quantizeJamBacking: true, jamStyleBlend: 0 });
  s.start();
  tick(s); tick(s); tick(s);
  assert.equal(s.isPlaying, true);
  assert.equal(s.performanceTake.events.length, 0, 'what did not sound is not history');
  assert.equal(errors.length, 1, 'said once, not on every note');
  assert.match(errors[0], /could not sound/);
  s.stop();
});

test('any other failure in the tick still stops, as before', () => {
  const { s, errors } = sampledBand();
  s.masterBus.piano = { trigger() { throw Error('Sampled sounds stopped. Load them again before playing.'); }, stop() {} };
  const realSetInterval = globalThis.window.setInterval;
  let run; globalThis.window.setInterval = fn => { run = fn; return 1; };
  try { s.start(); s.audioCtx.currentTime = s.nextStepAudioTime - .05; run(); } finally { globalThis.window.setInterval = realSetInterval; }
  assert.equal(s.isPlaying, false);
  assert.match(errors[0], /Load them again/);
});

test('a held note is never stolen to make room for the band', () => {
  const { s } = sampledBand();
  s.start();
  s.masterBus.piano.full = false;
  const id = s.noteOn({ patchId: 'sampled_guitar_v1', role: 'lead', midi: 60, sourceNoteId: 'jam-live-1' });
  assert.ok(s.liveNotes.has(id));
  s.masterBus.piano.full = true;
  tick(s); tick(s);
  assert.ok(s.liveNotes.has(id), 'the held note stays held while the band drops notes');
  s.stop();
});
