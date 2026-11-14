// A song holds at most two songs of history: the take or loop it came from, and the one song under that.
// Keeping a melody again and again, or opening a song saved before this rule, never holds every trip before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { archivedSong, flattenSongHistory, historyDepth, keepPlayedNotes, sourceLoop, withoutHistory } from '../../../static/js/theory/song_history.js';
import { selectedMelody } from '../../../static/js/theory/selected_melody.js';
import { materializePerformance } from '../../../static/js/theory/performance_capture.js';
import { compileSongStandalone } from '../../../static/ui/standalone_compiler.js';
import { compileReturnSong } from '../../../static/ui/returning_part.js';

const note = (id, step, pitch, provenance = 'user_placed') => ({ id, role: 'lead', step, duration_steps: 2, velocity: .7, patch_id: 'pluck_lead', provenance,
  pitch_lock_mode: 'concrete', concrete: { midi_pitch: pitch }, performance: { version: 1, offset_steps: 0 } });
const loop = { id: 'song', title: 'Song', global_context: { bpm: 100, bars: 4, steps_per_bar: 16, root_pc: 0, scale_type: 'major' },
  song_cards: [{ bars: 4, role_name: 'Loop', beat: true, tune: true, under: true, fx: null, big: false }], notes: [note('band', 0, 40, 'jam_generated')] };
const capture = (prefix, n = 4) => ({ version: 1, source_song_id: 'song', start: 0, end: 2, bpm: 100, bars: 4,
  events: Array.from({ length: n }, (_, i) => ({ time: .1 + i * .3, duration: .2, occurrence: i + 1, event: note(`${prefix}-${i}`, i * 2, 60 + i) })) });
const score = (prefix) => ({ song_id: 'song', bpm: 100, swing: .5, total_steps: 64, steps_per_bar: 16,
  events: [note(`${prefix}-a`, 0, 64, 'jam_generated'), note(`${prefix}-b`, 4, 67, 'jam_generated'), note(`${prefix}-own`, 8, 72)] });
/** Every id of a note the person played, anywhere in a song. */
const playedIds = song => { const ids = new Set(); (function walk(at) { if (!at || typeof at !== 'object') return;
  if (at.provenance === 'user_placed') ids.add(at.source_note_id || at.id); for (const v of Object.values(at)) walk(v); })(song); return ids; };
const keep = (source, archive, prefix) => selectedMelody(source, score(prefix), { context: { version: 1, root: 0 }, choice: { position: { x: 0, y: 0 } }, performanceArchive: archive });

/** A melody kept the old way, trip after trip: each song holds the whole song before it. */
function oldChain(trips = 5) {
  const nest = (from, prefix) => ({ ...structuredClone(from), notes: capture(prefix).events.map(e => e.event), captured_performance: capture(prefix), capture_source: structuredClone(from) });
  let doc = loop;
  for (let trip = 0; trip < trips; trip++) {
    const source = nest(doc, `jam-${trip}`), archive = nest(source, `wheel-${trip}`);
    doc = structuredClone(source); doc.capture_source = archive; doc.melody_original = structuredClone(source.melody_original || source);
    delete doc.captured_performance; doc.notes = score(`melody-${trip}`).events; doc.capture_notes = { melody_field: { version: 4, context: { version: 1, root: 0 } } };
  }
  return doc;
}

test('depth counts both kinds of history', () => {
  assert.equal(historyDepth(loop), 0);
  assert.equal(historyDepth({ ...loop, melody_original: { ...loop, capture_source: loop } }), 2);
  assert.ok(historyDepth(oldChain()) > 6);
});

test('keeping a melody again and again stays two songs deep and grows only with what was played', () => {
  let doc = loop, sizes = [], played = new Set();
  for (let trip = 0; trip < 10; trip++) {
    const source = materializePerformance(doc, capture(`jam-${trip}`));        // Make my tune, as the wheel opens
    const archive = materializePerformance(source, capture(`wheel-${trip}`), { keepWholeSource: trip > 0 }); // a played take
    for (const id of playedIds(source)) played.add(id);
    if (trip % 2) for (const id of playedIds(archive)) played.add(id);
    doc = keep(source, trip % 2 ? archive : null, `melody-${trip}`);            // Keep or Back to jam
    assert.ok(historyDepth(doc) <= 2, `trip ${trip}: ${historyDepth(doc)} deep`);
    const held = playedIds(doc);
    assert.deepEqual([...played].filter(id => !held.has(id)), [], `trip ${trip}: every played note is still in the song`);
    sizes.push(JSON.stringify(doc).length - JSON.stringify(doc.played_archive || []).length);
  }
  assert.ok(Math.max(...sizes) <= Math.max(sizes[0], sizes[1]) * 1.1, `without the played notes, no trip is bigger than the first two: ${sizes.join(', ')}`);
  const archived = doc.played_archive.map(n => n.source_note_id || n.id);
  assert.equal(new Set(archived).size, archived.length, 'each played note is archived once');
  assert.ok(doc.played_archive.every(n => n.provenance === 'user_placed'), 'and only played notes');
  assert.equal(archivedSong(doc).played_archive, undefined, 'only the song at the top holds the archive');
  assert.equal(sourceLoop(doc).notes[0].id, 'band', 'the loop the song began from is still under it');
  assert.equal(doc.melody_original.notes[0].source_note_id, 'jam-0-0', 'the melody original is the first take, as it was');
});

test('a played take of a kept melody keeps the score it was played over, one level down', () => {
  const first = keep(materializePerformance(loop, capture('jam-0')), null, 'melody-0');
  const source = materializePerformance(first, capture('jam-1'));
  const archive = materializePerformance(source, capture('wheel-1'), { keepWholeSource: true });
  const second = keep(source, archive, 'melody-1');
  assert.equal(historyDepth(second), 2);
  assert.deepEqual(second.capture_source.captured_performance, capture('wheel-1'), 'Open played take has the new take');
  assert.deepEqual(second.capture_source.capture_source.notes, source.notes, 'and under it the take it was played over');
  assert.equal(second.capture_source.melody_original, undefined, 'only the song at the top keeps a melody original');
  assert.deepEqual(second.melody_original, first.melody_original, 'the pinned original does not change');
});

test('Keep over a kept melody carries the loop, not the whole song', () => {
  const kept = keep(materializePerformance(loop, capture('jam-0')), null, 'melody-0');
  const take = materializePerformance(kept, capture('jam-1'));
  assert.deepEqual(take.capture_source, withoutHistory(loop));
  assert.ok(historyDepth(take) <= 2);
  const whole = materializePerformance(kept, capture('jam-1'), { keepWholeSource: true });
  assert.deepEqual(whole.capture_source.notes, kept.notes, 'kept whole when asked, for a save that failed');
  assert.ok(historyDepth(whole) <= 2, 'and still two songs deep');
});

test('a song saved the old way flattens with the same score, take, original and loop', () => {
  const old = oldChain(), flat = flattenSongHistory(old);
  assert.equal(historyDepth(flat), 2);
  assert.deepEqual(flat.notes, old.notes);
  assert.deepEqual(compileSongStandalone(flat).events, compileSongStandalone(old).events, 'it plays the same notes');
  assert.deepEqual(compileReturnSong(flat).events, compileReturnSong(old).events, 'the Tune wheel reopens on the same notes');
  assert.deepEqual(flat.capture_notes, old.capture_notes);
  for (const key of ['notes', 'captured_performance']) {
    assert.deepEqual(flat.capture_source[key], old.capture_source[key], `the played take keeps its ${key}`);
    assert.deepEqual(flat.melody_original[key], old.melody_original[key], `the melody original keeps its ${key}`);
  }
  assert.deepEqual(flat.capture_source.capture_source, withoutHistory(loop), 'under the take, the loop the song began from');
  assert.deepEqual(Object.keys(flat), [...Object.keys(old), 'played_archive'], 'the song keeps its shape, with the played notes cut away beside it');
  const held = playedIds(flat);
  assert.deepEqual([...playedIds(old)].filter(id => !held.has(id)), [], 'no played note is lost');
  assert.ok(JSON.stringify(flat).length * 4 < JSON.stringify(old).length);
  assert.deepEqual(flattenSongHistory(flat), flat, 'flattening twice changes nothing');
  assert.equal(historyDepth(old) > 6, true, 'the old song itself is not changed');
});

test('a song that is already short is not rewritten', () => {
  const kept = keep(materializePerformance(loop, capture('jam-0')), materializePerformance(materializePerformance(loop, capture('jam-0')), capture('wheel-0')), 'melody-0');
  assert.equal(historyDepth(kept), 2);
  assert.equal(flattenSongHistory(kept), kept, 'the very same song comes back');
  assert.equal(flattenSongHistory(loop), loop);
  assert.equal(flattenSongHistory(null), null);
});

test('keepPlayedNotes adds only played notes the song lost, once, and can fail', () => {
  const kept = keep(materializePerformance(loop, capture('jam-0')), materializePerformance(materializePerformance(loop, capture('jam-0')), capture('wheel-0')), 'melody-0');
  const cut = withoutHistory(kept);
  assert.ok(!playedIds(cut).has('wheel-0-0'), 'cutting history loses the wheel take without the archive');
  keepPlayedNotes(cut, kept);
  for (const id of ['wheel-0-0', 'wheel-0-3', 'jam-0-0']) assert.ok(playedIds(cut).has(id), `${id} comes back`);
  assert.ok(!cut.played_archive.some(n => n.id === 'melody-0-own'), 'a note the song still holds is not copied');
  const size = JSON.stringify(cut).length;
  keepPlayedNotes(cut, kept);
  assert.equal(JSON.stringify(cut).length, size, 'keeping again adds nothing');
  const raw = { ...loop, notes: [], captured_performance: { events: [{ time: .5, duration: .2, event: { id: 'raw-1', provenance: 'user_placed', role: 'lead' } }] } };
  const bare = keepPlayedNotes(structuredClone(loop), raw);
  assert.deepEqual(bare.played_archive.map(n => [n.id, n.capture_time]), [['raw-1', .5]], 'a played key kept only in a take keeps its time');
  assert.equal(keepPlayedNotes(bare, raw).played_archive.length, 1);
});

test('archiving copies and never changes the song it copies', () => {
  const old = oldChain(3), before = structuredClone(old), copy = archivedSong(old);
  assert.deepEqual(old, before);
  assert.equal(historyDepth(copy), 1);
  assert.equal(copy.melody_original, undefined);
  assert.deepEqual(copy.capture_source, withoutHistory(old.capture_source));
});
