// Verifier's hostile input against the two repairs of 2 November: Keep after rest (3c0a260: the window reaches
// back to the earliest live note, capped at sixteen bars, and says so past the cap) and Stop safety (d64e0a5:
// silence first, a throwing release callback cannot escape, running out of voices costs a note, not the band).
// Each test states the contract it holds the code to (workflow/PLAN.md, "Standing preservation and access
// contracts"). A failing test here is a finding, not a broken test. Imports the worktree's production modules
// read-only, as tests/js/audio/ does.
//   node --test "workflow/evidence/verify-2026-11-02/hostile/*.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { LookaheadScheduler } from '../../../static/js/audio/scheduler.js';
import { PianoAllocation, TOTAL_CHANNELS } from '../../../static/js/audio/sampled_piano.js';
import { materializePerformance } from '../../../static/js/theory/performance_capture.js';

// ---- a real scheduler on a fake audio graph (the pattern of tests/js/audio/stop_safety.test.mjs) ----
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
const BPM = 100, BAR = 16 * 15 / BPM;           // 2.4 s a bar at 100 BPM
const loopSong = ({ id = 'song', bpm = BPM, patch = 'warm_keys', midi = 48, bars = 4 } = {}) => ({ song_id: id, bpm, swing: .5, steps_per_bar: 16,
  total_steps: bars * 16, total_duration_sec: bars * 16 * 15 / bpm,
  events: Array.from({ length: bars * 4 }, (_, i) => ({ id: `band-${midi}-${i}`, step: i * 4, role: 'bass', patch_id: patch, duration_sec: .2, velocity: .5,
    provenance: 'jam_generated', start_sec: i * 4 * 15 / bpm, concrete: { midi_pitch: midi, freq_hz: 440 * 2 ** ((midi - 69) / 12) } })) });
function running(song = loopSong(), key = 'scene:a', beforeStart = () => {}) {
  const s = new LookaheadScheduler();
  s.audioCtx = fakeContext(); s.ensureContext();
  s.setRepeatPlayback(true);
  s.setCompiledSong(song, { quantizeJamBacking: true, jamStyleKey: key });
  s.onAudioError = () => {};
  beforeStart(s);
  s.start();
  return s;
}
const tickTo = (s, t) => { while (s.isPlaying && s.nextStepAudioTime < t + .1) { s.audioCtx.currentTime = Math.min(t, s.nextStepAudioTime - .05); s._lookaheadTick(); } s.audioCtx.currentTime = t; };
// A person's key: pressed at t, released `hold` seconds later, on the audio clock.
function key(s, i, t, hold = .3, extra = {}) {
  tickTo(s, t);
  const id = s.noteOn({ patchId: 'pluck_lead', role: 'lead', midi: 60 + i, sourceNoteId: `jam-live-${i}`, ...extra });
  if (hold !== null) { tickTo(s, t + hold); s.noteOff(id); }
  return id;
}
const own = capture => (capture?.events || []).filter(r => r.event.provenance === 'user_placed');
const ownIds = capture => own(capture).map(r => r.event.source_note_id);
const quiet = fn => { const o = console.error; console.error = () => {}; try { return fn(); } finally { console.error = o; } };
// Every played note either survives with its onset and held length, or is counted as lost so the app can say so.
function accounted(s, capture, playedIds) {
  const take = Object.fromEntries((s.performanceTake?.events || []).filter(r => r.event.provenance === 'user_placed').map(r => [r.event.source_note_id, r]));
  const kept = new Map(own(capture).map(r => [r.event.source_note_id, r]));
  const moved = [...kept].filter(([id, r]) => take[id] && (Math.abs(r.time - take[id].time) > 1e-9 || Math.abs(r.duration - take[id].duration) > 1e-9)).map(([id]) => id);
  const missing = playedIds.filter(id => !kept.has(id));
  return { missing, moved, lost: capture?.personal_lost || 0 };
}
const notes8 = (s, from) => Array.from({ length: 8 }, (_, i) => key(s, i, from + i * .3, .2));
const ids8 = Array.from({ length: 8 }, (_, i) => `jam-live-${i}`);

// ---- Keep after rest, 3c0a260 ----

for (const rest of [5, 8, 12, 14]) {
  test(`a rest of ${rest} bars, longer than the four-bar loop, keeps all eight notes exactly`, () => {
    const s = running();
    notes8(s, 1 * BAR);
    tickTo(s, 1 * BAR + 2.4 + rest * BAR);
    const c = s.capturePerformance(), a = accounted(s, c, ids8);
    assert.deepEqual(a.missing, []); assert.deepEqual(a.moved, []); assert.equal(a.lost, 0);
    s.stop();
  });
}

test('a held note that straddles the sixteen-bar bound is either kept whole or counted as lost, never silently cut', () => {
  // Pressed 0.9 bar into bar 1, held 0.5 bar; Keep 17.5 bars in. The window starts at bar 2, inside the note.
  const s = running();
  key(s, 0, 1.9 * BAR, .5 * BAR);
  tickTo(s, 17.5 * BAR);
  const c = s.capturePerformance(), a = accounted(s, c, ['jam-live-0']);
  const r = own(c)[0];
  assert.ok((a.missing.length === 0 && a.moved.length === 0) || a.lost >= 1,
    `the note was kept with its onset moved from ${(1.9 * BAR).toFixed(3)} s to ${r?.time.toFixed(3)} s and its length cut from ${(.5 * BAR).toFixed(3)} to ${r?.duration.toFixed(3)} s, and personal_lost is ${c.personal_lost ?? 0}`);
  s.stop();
});

test('a style change in the middle of a rest keeps every note before it, exactly', () => {
  const s = running(loopSong({ midi: 48 }), 'scene:a');
  notes8(s, .5 * BAR);
  tickTo(s, 4 * BAR);
  s.setCompiledSong(loopSong({ midi: 43, patch: 'clean_bass' }), { quantizeJamBacking: true, jamStyleKey: 'scene:b' });
  tickTo(s, 9 * BAR);
  const c = s.capturePerformance(), a = accounted(s, c, ids8);
  assert.ok(s.activeJamBacking().events.some(e => e.concrete.midi_pitch === 43), 'the new style really is playing');
  assert.deepEqual(a.missing, []); assert.deepEqual(a.moved, []); assert.equal(a.lost, 0);
  s.stop();
});

test('a style change that also changes the tempo mid-rest keeps every note, and the song keeps their seconds', () => {
  const s = running(loopSong({ midi: 48 }), 'scene:a');
  notes8(s, .5 * BAR);
  tickTo(s, 3 * BAR);
  s.setCompiledSong(loopSong({ midi: 43, bpm: 90, patch: 'clean_bass' }), { quantizeJamBacking: true, jamStyleKey: 'scene:c' });
  tickTo(s, 8 * BAR);
  const c = s.capturePerformance(), a = accounted(s, c, ids8);
  assert.deepEqual(a.missing, []); assert.deepEqual(a.moved, []);
  const doc = materializePerformance({ id: 'song', notes: [], global_context: { bpm: BPM, root_pc: 0, scale_type: 'major' }, song_cards: [{}] }, c);
  const stepSec = 15 / c.bpm, all = [...doc.notes.map(n => [n, 0]), ...doc.song_cards.flatMap(card => (card.material?.notes || []).map(n => [n, card.capture_segment.start_step]))];
  for (const r of own(c)) {
    const hit = all.find(([n]) => n.source_note_id === r.event.source_note_id && n.capture_occurrence === r.occurrence);
    assert.ok(hit, `${r.event.source_note_id} reached the song`);
    const [n, base] = hit;
    assert.ok(Math.abs((base + n.step + n.performance.offset_steps) * stepSec - (r.time - c.start)) < 1e-6, `${n.source_note_id} keeps its onset`);
  }
  s.stop();
});

test('notes before and after a change of scene are all kept, in order, with their pitches', () => {
  const s = running(loopSong({ midi: 48 }), 'scene:a');
  for (let i = 0; i < 4; i++) key(s, i, .5 * BAR + i * .3, .2);
  s.setCompiledSong(loopSong({ midi: 41, patch: 'clean_bass' }), { quantizeJamBacking: true, jamStyleKey: 'scene:b' });
  tickTo(s, 3 * BAR);
  for (let i = 4; i < 8; i++) key(s, i, 3 * BAR + (i - 4) * .3, .2);
  tickTo(s, 5 * BAR);
  const c = s.capturePerformance();
  assert.deepEqual(ownIds(c), ids8);
  assert.deepEqual(own(c).map(r => Math.round(12 * Math.log2(r.event.concrete.freq_hz / 440) + 69)), [60, 61, 62, 63, 64, 65, 66, 67]);
  s.stop();
});

test('Keep pressed twice at the scheduler gives the same capture both times', () => {
  const s = running();
  notes8(s, 1 * BAR);
  tickTo(s, 7.5 * BAR);
  const first = s.capturePerformance(), second = s.capturePerformance();
  assert.deepEqual(second, first);
  s.stop();
});

// ---- Stop then Keep ----

test('Stop then Keep: the stopped take still holds every note played before the rest', () => {
  const s = running();
  notes8(s, 1 * BAR);
  tickTo(s, 8 * BAR);
  s.stop();
  const a = accounted(s, s.lastStoppedPerformance, ids8);
  assert.deepEqual(a.missing, []); assert.equal(a.lost, 0);
});

test('Stop, play on, then Keep: notes from before Stop are kept or said lost, never silently dropped', () => {
  // On live keys a pad press after Stop starts the band again (_readyThenPlay -> _keepMusicGoing -> start()),
  // and start() clears lastStoppedPerformance and opens a new take (scheduler.js start()).
  const s = running();
  notes8(s, 1 * BAR);
  tickTo(s, 3 * BAR);
  s.stop();
  s.audioCtx.currentTime += 5;
  s.start();
  const t0 = s.audioCtx.currentTime;
  key(s, 8, t0 + .5, .2);
  tickTo(s, t0 + 2 * BAR);
  const c = s.capturePerformance() || s.lastStoppedPerformance;
  const a = accounted(s, c, [...ids8, 'jam-live-8']);
  assert.ok(a.missing.length === 0 || a.lost >= a.missing.length,
    `${a.missing.length} notes played before Stop are missing from the capture and personal_lost is ${a.lost}`);
  s.stop();
});

// ---- Across Stop, 3 November: one performance until Keep ----

test('Stop and play on: every note from before and after Stop, by identity, spacing kept, the stopped gap closed', () => {
  const s = running();
  notes8(s, 1 * BAR);
  tickTo(s, 3 * BAR);
  const before = own(s.capturePerformance()).map(r => r.time);
  s.stop();
  s.audioCtx.currentTime += 50;
  s.start();
  const t0 = s.audioCtx.currentTime;
  key(s, 8, t0 + .5, .2);
  tickTo(s, t0 + 2 * BAR);
  const c = s.capturePerformance(), kept = own(c);
  assert.deepEqual(ownIds(c), [...ids8, 'jam-live-8']);
  assert.equal(c.rests_left_out, undefined);
  assert.ok(c.bars <= 8, `the stopped gap is closed: ${c.bars} bars`);
  kept.slice(0, 8).forEach((r, i) => assert.ok(Math.abs((r.time - kept[0].time) - (before[i] - before[0])) < 1e-9, `note ${i} keeps its spacing`));
  assert.ok(kept[8].time - kept[7].time < 3 * BAR, 'the notes after Stop follow on');
  assert.equal(new Set(c.events.map(r => r.occurrence)).size, c.events.length, 'occurrences stay unique across Stop');
  s.stop();
});

test('a note held when Stop was pressed comes back ended at Stop, once, not four seconds long', () => {
  const s = running();
  key(s, 0, 1 * BAR, null);
  tickTo(s, 1 * BAR + .5);
  s.stop();
  s.audioCtx.currentTime += 5;
  s.start();
  tickTo(s, s.audioCtx.currentTime + 1 * BAR);
  const kept = own(s.capturePerformance());
  assert.equal(kept.length, 1);
  assert.ok(Math.abs(kept[0].duration - .5) < .02, `length ${kept[0].duration}`);
  s.stop();
});

test('after Keep the next take starts clean, so a second song does not repeat the first', () => {
  const s = running();
  notes8(s, 1 * BAR);
  s.markPerformanceKept();
  s.stop();
  s.start();
  assert.equal(s.performanceTake.events.length, 0);
  s.stop();
});

test('another song never inherits this take', () => {
  const s = running();
  notes8(s, 1 * BAR);
  s.stop();
  s.setCompiledSong(loopSong({ id: 'other' }), { quantizeJamBacking: true, jamStyleKey: 'scene:a' });
  s.start();
  assert.equal(s.performanceTake.events.length, 0);
  s.stop();
});

test('a take with no live notes carries nothing across Stop, so ordinary playback stays clean', () => {
  const s = running();
  tickTo(s, 2 * BAR);
  s.stop();
  s.start();
  assert.equal(s.performanceTake.events.length, 0);
  s.stop();
});

test('a very long take keeps every note and does not keep every band note', () => {
  const s = running();
  key(s, 0, .5 * BAR, .2);
  tickTo(s, 60 * BAR);
  key(s, 1, 60 * BAR, .2);
  tickTo(s, 61 * BAR);
  assert.deepEqual(ownIds(s.capturePerformance()), ['jam-live-0', 'jam-live-1']);
  assert.ok(s.performanceTake.events.length < 61 * 4, `history stays small: ${s.performanceTake.events.length} events`);
  s.stop();
});

// ---- Stop safety, d64e0a5 ----

test('a release callback that throws during Stop while a held note plays: silent, no escape, and the held note is kept whole to Stop', () => {
  const s = running();
  key(s, 0, 1 * BAR, .2);
  key(s, 1, 1.5 * BAR, null, { onRelease() { throw Error('boom'); } });   // still held at Stop
  const released = [];
  key(s, 2, 1.6 * BAR, null, { onRelease: sec => released.push(sec) });
  tickTo(s, 2.5 * BAR);
  const bus = s.masterBus;
  assert.doesNotThrow(() => quiet(() => s.stop()));
  assert.equal(bus.disposed, true, 'the graph is silenced');
  assert.equal(released.length, 1, 'the callback after the throwing one still ran');
  const c = s.lastStoppedPerformance, held = own(c).find(r => r.event.source_note_id === 'jam-live-1');
  assert.deepEqual(ownIds(c), ['jam-live-0', 'jam-live-1', 'jam-live-2']);
  assert.ok(Math.abs(held.time + held.duration - c.end) < 1e-9, 'the held note lasts until Stop');
  const doc = materializePerformance({ id: 'song', notes: [], global_context: { bpm: BPM, root_pc: 0, scale_type: 'major' }, song_cards: [{}] }, c);
  assert.ok(['jam-live-0', 'jam-live-1', 'jam-live-2'].every(id => doc.notes.some(n => n.source_note_id === id)), 'Keep after Stop materializes all three');
});

test('Stop twice, the second time with nothing playing, is silent and harmless', () => {
  const s = running();
  key(s, 0, 1 * BAR, null, { onRelease() { throw Error('boom'); } });
  quiet(() => s.stop());
  const kept = s.lastStoppedPerformance;
  assert.doesNotThrow(() => quiet(() => s.stop()));
  assert.equal(s.lastStoppedPerformance, kept, 'a second Stop does not erase the stopped take');
});

function exhausted() {
  const pool = new PianoAllocation();
  for (let i = 0; i < TOTAL_CHANNELS * 16; i++) { try { pool.claim(0, 1000, 20 + (i % 80), 64, i % 8); } catch { break; } }
  try { pool.claim(0, 1000, 60, 64, 0); } catch (e) { return e; }
  return null;
}

test('voice exhaustion with a held personal note: the band plays on, the held note is kept, a new press that cannot sound is not recorded, and Stop is silent', () => {
  const piano = { full: false, triggered: 0, trigger() { if (this.full) throw exhausted(); this.triggered++; return {}; }, release() { return true; }, stop() {} };
  const s = running(loopSong({ patch: 'sampled_guitar_v1' }), 'scene:a', x => { x.masterBus.piano = piano; });
  assert.equal(s.isPlaying, true, 'the sampled band starts');
  tickTo(s, 1 * BAR);
  s.noteOn({ patchId: 'sampled_guitar_v1', role: 'lead', midi: 64, sourceNoteId: 'jam-live-held', onRelease() { throw Error('boom'); } });
  piano.full = true;
  tickTo(s, 2 * BAR);
  assert.equal(s.isPlaying, true, 'the band is still playing');
  assert.ok(s.droppedVoices > 0, 'band notes were dropped, not the band');
  let error; try { s.noteOn({ patchId: 'sampled_guitar_v1', role: 'lead', midi: 67, sourceNoteId: 'jam-live-late' }); } catch (e) { error = e; }
  assert.ok(error, 'the press that cannot sound is refused by the voice pool');
  assert.ok(!ownIds(s.capturePerformance()).includes('jam-live-late'), 'what did not sound is not history');
  assert.ok(ownIds(s.capturePerformance()).includes('jam-live-held'), 'the held note is still in the take');
  tickTo(s, 1 * BAR + 3.2);   // inside LIVE_MAX_HOLD_SEC (4 s, scheduler.js line 55), after which a hold ends by design
  const bus = s.masterBus;
  assert.doesNotThrow(() => quiet(() => s.stop()));
  assert.equal(bus.disposed, true);
  const held = own(s.lastStoppedPerformance).find(r => r.event.source_note_id === 'jam-live-held');
  assert.ok(held && Math.abs(held.time + held.duration - s.lastStoppedPerformance.end) < 1e-9, 'kept through Stop');
});
