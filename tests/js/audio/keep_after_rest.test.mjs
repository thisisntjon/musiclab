// Release blocker found on e74db66: on a free style Keep read only the last four bars, so a person who
// played and then rested lost every note while the app said the song was saved. Every note the person
// played in this take must be kept within what the take can represent; if any cannot be, the capture says so.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {personalPerformance} from '../../../static/js/theory/dynamic_keys.js';
import {songArcFromCapture,normalizeSongCards} from '../../../static/js/theory/song_view.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

const BPM = 100, BAR = 16 * 15 / BPM; // 2.4 s a bar
const scheduler = (captureBars) => {
  const s = Object.create(LookaheadScheduler.prototype);
  Object.assign(s, { isPlaying: true, audioCtx: { currentTime: 0 }, jamBackingTimeline: [],
    performanceTake: { song_id: 'song', start: 0, bpm: BPM, steps_per_bar: 16, sequence: 0, events: [], ...(captureBars ? { capture_bars: captureBars } : {}) } });
  return s;
};
const mine = (i, role = 'lead') => ({ id: `jam-live-${i}`, source_note_id: `jam-live-${i}`, role, patch_id: 'warm_keys', duration_sec: .25, provenance: 'user_placed', concrete: { freq_hz: 330 } });
const band = i => ({ id: `band-${i}`, role: 'bass', patch_id: 'clean_bass', duration_sec: .5, provenance: 'jam_generated', concrete: { midi_pitch: 40 } });
function perform(s, events) { // [time, event] pairs in time order, on the take's own clock
  for (const [time, event] of events) { s.audioCtx.currentTime = time; const r = s._rememberPerformance(event, time); if (r && event.provenance === 'user_placed') r.released_at = time + .25; }
}
const playedAt = bar => [0, 1, 2, 3, 4, 5, 6, 7].map(i => [bar * BAR + i * .3, mine(i)]);
const bandEveryBar = bars => Array.from({ length: bars }, (_, b) => [b * BAR, band(b)]);
const merged = (...lists) => lists.flat().sort((a, b) => a[0] - b[0]);
const ids = capture => capture.events.filter(r => r.event.provenance === 'user_placed').map(r => r.event.source_note_id);

test('free style: all eight notes survive a six-bar rest, with their identities', () => {
  const s = scheduler();
  perform(s, merged(playedAt(2), bandEveryBar(9)));
  s.audioCtx.currentTime = 8.5 * BAR; // played in bar 2, rested six bars, pressed Keep in bar 8
  const capture = s.capturePerformance();
  assert.deepEqual(ids(capture), [0, 1, 2, 3, 4, 5, 6, 7].map(i => `jam-live-${i}`));
  assert.equal(capture.personal_lost, undefined, 'nothing was lost, so nothing is claimed lost');
  assert.ok(capture.start <= 2 * BAR);
  assert.equal(capture.bars % 4, 0, 'the window stays on the four-bar phrase');
  assert.ok(capture.events.some(r => r.event.id === 'band-8'), 'the band up to Keep is still there');
});

test('fixed form: the same rest keeps the same notes, and the form window is not shortened', () => {
  const s = scheduler(12);
  perform(s, merged(playedAt(2), bandEveryBar(9)));
  s.audioCtx.currentTime = 8.5 * BAR;
  const capture = s.capturePerformance();
  assert.equal(ids(capture).length, 8);
  assert.equal(capture.bars, 9);
  assert.equal(capture.window_bars, 12);
});

test('no rest and no notes: the free-style window stays four bars, as before', () => {
  const quiet = scheduler();
  perform(quiet, bandEveryBar(10));
  quiet.audioCtx.currentTime = 9.5 * BAR;
  assert.equal(quiet.capturePerformance().bars, 4);
  const recent = scheduler();
  perform(recent, merged(bandEveryBar(10), playedAt(8)));
  recent.audioCtx.currentTime = 9.5 * BAR;
  const capture = recent.capturePerformance();
  assert.equal(capture.bars, 4);
  assert.equal(ids(capture).length, 8);
});

test('the band answering, and notes that repeat from the loop, do not stretch the window', () => {
  const s = scheduler();
  perform(s, merged(bandEveryBar(10), [[1, { ...mine(90), source_note_id: 'jam-answer-1', id: 'jam-answer-1', provenance: 'jam_generated' }], [1.5, { ...mine(91), id: 'jam-user-a-0', source_note_id: 'jam-user-a-0' }]]));
  s.audioCtx.currentTime = 9.5 * BAR;
  assert.equal(s.capturePerformance().bars, 4);
});

test('a person\'s drum pad counts as their playing', () => {
  const s = scheduler();
  perform(s, merged(bandEveryBar(9), [[2 * BAR, mine(5, 'drums')]]));
  s.audioCtx.currentTime = 8.5 * BAR;
  assert.deepEqual(ids(s.capturePerformance()), ['jam-live-5']);
});

test('a long take loses nothing: old notes survive past the seventeen bars of band history', () => {
  const gone = scheduler();
  perform(gone, merged(bandEveryBar(40), playedAt(1), playedAt(30).map(([t, e]) => [t, { ...e, id: `${e.id}b`, source_note_id: `${e.source_note_id}b` }])));
  gone.audioCtx.currentTime = 31 * BAR;
  const capture = gone.capturePerformance();
  assert.equal(ids(capture).length, 16, 'both phrases are kept, twenty-nine bars apart');
  assert.equal(capture.personal_lost, undefined);
  assert.equal(capture.rests_left_out, true);
  assert.ok(capture.bars <= 24);
  assert.ok(capture.events.some(r => r.event.id === 'band-1'), 'the old notes keep the band that played under them');
  assert.equal(personalPerformance(capture).rests_left_out, true);
});

test('every kept note reaches the song: across its parts and through the song arc', () => {
  const s = scheduler();
  perform(s, merged(playedAt(0), playedAt(9).map(([t, e]) => [t, { ...e, id: `${e.id}b`, source_note_id: `${e.source_note_id}b` }]), bandEveryBar(11)));
  s.audioCtx.currentTime = 10.5 * BAR;
  const capture = s.capturePerformance();
  assert.equal(ids(capture).length, 16);
  const source = { id: 'song', notes: [], global_context: { bpm: BPM, root_pc: 0, scale_type: 'major' }, song_cards: [{ beat: true, tune: true, under: true }] };
  const doc = materializePerformance(source, capture);
  assert.ok(doc.song_cards.length > 1);
  const inSong = new Set([...doc.notes, ...doc.song_cards.flatMap(c => c.material?.notes || [])].map(n => n.source_note_id));
  for (const id of ids(capture)) assert.ok(inSong.has(id), `${id} reached the song`);
  const arc = songArcFromCapture(normalizeSongCards(doc.song_cards));
  assert.ok(arc.length >= doc.song_cards.length + 2, 'no part is sliced away by the arc');
});

test('the song screen says so when notes did not fit, and stays quiet when none were lost', () => {
  const flow = Object.create(PlayFlow.prototype);
  flow.doc = { captured_performance: { personal_lost: 8 } };
  assert.match(flow._keepLostHtml(), /Some of your first notes did not fit\./);
  assert.match(flow._keepLostHtml(), /role="status"/);
  flow.doc = { captured_performance: {} };
  assert.equal(flow._keepLostHtml(), '');
  flow.doc = {};
  assert.equal(flow._keepLostHtml(), '');
});

test('the announcement a screen reader hears carries the same line; no loss means plain words', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../../../static/ui/stages/play_flow.js', import.meta.url), 'utf8');
  assert.match(source, /It is saved\.\$\{keptNote\} Try your tune here\./);
  assert.match(source, /It is not saved yet\.\$\{keptNote\}/);
  assert.match(source, /capture\?\.personal_lost \? ` \$\{KEEP_LOST_WORDS\}` : ""/);
});
