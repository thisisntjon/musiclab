// 3 November: "keep a longer history so no notes are lost." Twenty-four bars of music fit in a song. Up to that
// the kept music is as it happened; past it, blocks with no notes drop out; beyond that, older blocks become another song.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureWindow, MAX_SONG_BARS, playedLive } from '../../../static/js/theory/capture_window.js';
import { materializePerformance } from '../../../static/js/theory/performance_capture.js';
import { songArcFromCapture, normalizeSongCards } from '../../../static/js/theory/song_view.js';

const BPM = 100, BAR = 2.4;
let seq = 0;
const mine = (time, duration = .25, name = `jam-live-${time}`) => ({ time, duration, occurrence: ++seq, released_at: time + duration, event: { id: name, source_note_id: name, role: 'lead', patch_id: 'warm_keys', provenance: 'user_placed', concrete: { freq_hz: 330 } } });
const band = bars => Array.from({ length: bars }, (_, b) => ({ time: b * BAR, duration: .5, occurrence: ++seq, event: { id: `band-${b}`, role: 'bass', patch_id: 'clean_bass', provenance: 'jam_generated', concrete: { midi_pitch: 40 } } }));
const capture = (events, end) => captureWindow({ events: [...events].sort((a, b) => a.time - b.time), start: 0, end, bpm: BPM });
const ownIds = c => c.events.filter(playedLive).map(r => r.event.source_note_id);

test('a span that fits is exactly what happened: nothing moved, no rest left out', () => {
  const note = mine(2.1 * BAR, 1.2);
  const c = capture([...band(25), note], 24.5 * BAR);
  assert.equal(c.bars, 24);
  assert.equal(c.rests_left_out, undefined);
  assert.equal(c.earlier, undefined);
  const kept = c.events.find(r => r.event.source_note_id === note.event.source_note_id);
  assert.equal(kept.time, note.time);
  assert.ok(Math.abs(kept.duration - note.duration) < 1e-9);
});

test('a long listen drops the empty blocks: every note whole, its gap to the next closed, the Keep moment untouched', () => {
  const early = [mine(1 * BAR), mine(1 * BAR + .4)], late = mine(60.2 * BAR);
  const c = capture([...band(62), ...early, late], 61 * BAR);
  assert.equal(c.rests_left_out, true);
  assert.ok(c.bars <= MAX_SONG_BARS);
  assert.deepEqual(ownIds(c).sort(), [...early, late].map(n => n.event.source_note_id).sort());
  const [a, b] = c.events.filter(playedLive);
  assert.ok(Math.abs((b.time - a.time) - .4) < 1e-9, 'spacing inside a block is kept');
  assert.ok(a.time >= c.start, 'the moved note is inside the song');
  assert.equal(a.duration, .25);
  assert.equal(c.events.filter(playedLive).at(-1).time, late.time, 'the block at Keep does not move');
  assert.ok(c.events.some(r => r.event.id === 'band-1'), 'the note keeps the band that played under it');
  assert.ok(!c.events.some(r => r.event.id === 'band-30'), 'the band from the empty blocks is left out');
  assert.equal(c.scheduled_time, undefined);
  assert.equal(a.scheduled_time, early[0].time, 'where it really happened stays on record');
});

test('a note across a block line brings both blocks and is never cut', () => {
  const held = mine(5.5 * BAR, 2 * BAR); // Blocks count back from bar 50, so one line falls at bar 6.
  const c = capture([...band(50), held], 50 * BAR);
  const kept = c.events.filter(playedLive);
  assert.equal(kept.length, 1);
  assert.ok(Math.abs(kept[0].duration - 2 * BAR) < 1e-9);
  assert.ok(c.bars >= 12);
});

test('more than twenty-four bars of playing: the older blocks become another capture, whole, and every note is somewhere exactly once', () => {
  const played = Array.from({ length: 70 }, (_, b) => mine(b * BAR + .1));
  const held = mine(45.9 * BAR, 1.5 * BAR, 'jam-live-across'); // Across the join between the song and the earlier capture.
  const c = capture([...band(71), ...played, held], 70.5 * BAR);
  assert.equal(c.bars, 24);
  const seen = [];
  for (let chunk = c; chunk; chunk = chunk.earlier) {
    assert.ok(chunk.bars <= MAX_SONG_BARS);
    seen.push(...ownIds(chunk));
  }
  assert.equal(new Set(seen).size, seen.length, 'no note appears twice');
  assert.deepEqual(seen.sort(), [...played, held].map(n => n.event.source_note_id).sort());
  let across; for (let chunk = c; chunk; chunk = chunk.earlier) across ||= chunk.events.find(r => r.event.source_note_id === 'jam-live-across');
  assert.ok(Math.abs(across.duration - 1.5 * BAR) < 1e-9, 'the note across the join is whole');
});

test('every window fits a song: no part is sliced away, and steps stay valid', () => {
  const played = Array.from({ length: 30 }, (_, b) => mine(b * BAR + .1));
  const c = capture([...band(31), ...played], 30.5 * BAR);
  const source = { id: 'song', notes: [], global_context: { bpm: BPM, root_pc: 0, scale_type: 'major' }, song_cards: [{}] };
  const { earlier, ...own } = c;
  const doc = materializePerformance(source, { ...own, version: 1, end: 30.5 * BAR, bpm: BPM });
  assert.equal(doc.song_cards.length, 6);
  const cards = normalizeSongCards(doc.song_cards);
  assert.ok(cards.every(card => card.capture_segment), 'the longest segment survives validation');
  const arc = songArcFromCapture(cards);
  assert.equal(arc.length, 8);
  assert.equal(arc.at(-1).role_name, 'Ending');
  assert.equal(arc.filter(card => /Main part/.test(card.role_name)).length, 6, 'no main part is lost to the eight-part limit');
  const inSong = new Set([...doc.notes, ...doc.song_cards.flatMap(card => card.material?.notes || [])].map(n => n.source_note_id));
  for (const id of ownIds(c)) assert.ok(inSong.has(id), `${id} reached the song`);
});

test('hostile input: no notes at all, one note at the very end, a note ending after Keep, and a bare bar of band', () => {
  assert.equal(capture(band(40), 39.5 * BAR).bars, 4);
  const last = mine(39.99 * BAR);
  assert.deepEqual(ownIds(capture([...band(40), last], 40 * BAR)), [last.event.source_note_id]);
  const running = mine(39.5 * BAR, 4), first = mine(.1);
  const c = capture([...band(40), first, running], 40 * BAR);
  assert.equal(ownIds(c).length, 2, 'a note still sounding at Keep is kept, clipped only by Keep itself');
  assert.equal(capture([], 1).events.length, 0);
});

test('only my playing means that in the older song too', async () => {
  const { personalPerformance } = await import('../../../static/js/theory/dynamic_keys.js');
  const note = (id, provenance) => ({ time: 0, duration: 1, event: { id, source_note_id: id, provenance } });
  const capture = { events: [note('jam-live-a', 'user_placed'), note('band-a', 'jam_generated')], earlier: { events: [note('jam-live-b', 'user_placed'), note('band-b', 'jam_generated')] } };
  const own = personalPerformance(capture);
  assert.deepEqual(own.events.map(r => r.event.id), ['jam-live-a']);
  assert.deepEqual(own.earlier.events.map(r => r.event.id), ['jam-live-b']);
  const bandOnly = personalPerformance({ events: [note('jam-live-a', 'user_placed')], earlier: { events: [note('band-b', 'jam_generated')] } });
  assert.equal(bandOnly.earlier, undefined, 'an older part with none of their notes makes no song');
});
