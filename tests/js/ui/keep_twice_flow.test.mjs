// Verifier's hostile input at the screen: Make my song pressed twice fast, and Stop then Keep, through the real
// PlayFlow handlers (static/ui/stages/play_flow.js _onClick -> _captureDirection). The DOM and the audio are
// stubbed as in tests/js/ui/no_refusals.test.mjs; the capture the scheduler hands over is fixed, so what is
// tested is what the screen does with it. Contract: what the app says at Keep is true (PLAN, preservation
// contracts; 3c0a260 "the same honest line is heard and seen").
//   node --test "workflow/evidence/verify-2026-11-02/hostile/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = {
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {},
  };
  const root = { innerHTML: '', insertAdjacentHTML(where, html) { this.innerHTML = where === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const scheduler = {
    isPlaying: false, liveNotes: new Map(), masterBus: { piano: {}, disposed: false }, audioCtx: { currentTime: 0 },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, preparePiano: async () => ({}), previewSound() {}, previewBar: () => true,
    noteOn() { return null; }, noteOff() {}, stop() { if (this.isPlaying) this.lastStoppedPerformance = this.capturePerformance(); this.isPlaying = false; },
    start() { this.isPlaying = true; this.lastStoppedPerformance = null; },
    capturePerformance: () => null, activeJamBacking: () => null, activeJamContext: () => null,
    seekToStep() {}, toggleMuteLayer() {}, requestJamAnswer() { return true; }, setAutomaticAnswers() {}, freezeJamLead() {},
    jamAnswerStatus: () => '', jamAnswerReadiness: () => ({ state: 'ready', label: 'Answer this', message: '' }), cancelJamAnswer() {},
  };
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: id => id === 'play-flow' ? root : null };
  const said = [];
  const flow = new PlayFlow({ scheduler, _announce: m => said.push(String(m)), _logSessionEvent() {} });
  flow._sparkAt = () => {};
  flow._keepMusicGoing = async function () { this.app.scheduler.isPlaying = true; return true; };
  flow.explorationRandom = () => .37;
  const press = key => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
  return { flow, scheduler, said, press };
}
// What the scheduler would hand over after eight live keys: identities, onsets, pitches, and optionally a count lost.
function takeFor(songId, { lost = 0 } = {}) {
  const events = Array.from({ length: 8 }, (_, i) => ({ time: 1 + i * .3, duration: .25, occurrence: i + 1,
    event: { id: `jam-live-${i}`, source_note_id: `jam-live-${i}`, role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .85, duration_sec: .25, concrete: { freq_hz: 440 * 2 ** ((60 + i - 69) / 12) } } }));
  events.push({ time: 0, duration: .5, occurrence: 9, event: { id: 'band-0', role: 'bass', patch_id: 'clean_bass', provenance: 'jam_generated', velocity: .6, duration_sec: .5, concrete: { midi_pitch: 40 } } });
  return { version: 1, source_song_id: songId, start: 0, end: 9.6, bpm: 100, bars: 4, ...(lost ? { personal_lost: lost } : {}), events };
}
const keepLines = said => said.filter(m => /your song now|Kept this mix/i.test(m));
const ids = doc => [...doc.notes, ...(doc.song_cards || []).flatMap(c => c.material?.notes || [])].map(n => n.source_note_id).filter(Boolean);
async function inJam() {
  const t = setup();
  await t.press('listen-circle');
  assert.equal(t.flow.stage, 'jam');
  assert.equal(t.scheduler.isPlaying, true);
  return t;
}

test('Make my song pressed twice fast keeps all eight notes once and the last thing said is still the truth', async () => {
  const { flow, scheduler, said, press } = await inJam();
  scheduler.capturePerformance = () => scheduler.isPlaying ? takeFor(flow.doc.id) : null;
  await Promise.all([press('capture-direction'), press('capture-direction')]);
  assert.equal(flow.stage, 'tune');
  for (let i = 0; i < 8; i++) assert.ok(ids(flow.doc).includes(`jam-live-${i}`), `jam-live-${i} is in the song`);
  const lines = keepLines(said);
  assert.match(lines[0], /This is your song now\. It is saved\./);
  assert.equal(lines.at(-1), lines[0], `the second press replaced the Keep line with: "${lines.at(-1)}"`);
});

test('after a loss past the bound, a second fast press must not replace "did not fit" with "Your notes stay the same"', async () => {
  const { flow, scheduler, said, press } = await inJam();
  scheduler.capturePerformance = () => scheduler.isPlaying ? takeFor(flow.doc.id, { lost: 3 }) : null;
  await Promise.all([press('capture-direction'), press('capture-direction')]);
  const last = keepLines(said).at(-1);
  assert.match(flow._keepLostHtml(), /did not fit/, 'the screen still says so');
  assert.match(last, /did not fit/, `a screen reader last hears: "${last}"`);
});

test('one Undo after a double Keep goes back to the jam the person was in', async () => {
  const { flow, scheduler, press } = await inJam();
  scheduler.capturePerformance = () => scheduler.isPlaying ? takeFor(flow.doc.id) : null;
  await Promise.all([press('capture-direction'), press('capture-direction')]);
  await press('undo');
  assert.equal(flow.doc.captured_performance, undefined, `${flow.undoStack.length} more Undo needed to leave the kept song`);
});

test('Stop then Make my song keeps the stopped take and says it is saved', async () => {
  const { flow, scheduler, said, press } = await inJam();
  scheduler.capturePerformance = () => scheduler.isPlaying ? takeFor(flow.doc.id) : null;
  scheduler.stop();
  assert.ok(scheduler.lastStoppedPerformance);
  await press('capture-direction');
  assert.equal(flow.stage, 'tune');
  assert.deepEqual(ids(flow.doc).filter(id => id.startsWith('jam-live-')).sort(), Array.from({ length: 8 }, (_, i) => `jam-live-${i}`));
  assert.match(keepLines(said).at(-1), /This is your song now\. It is saved\./);
});

test('Make my song marks the performance kept, so the next Stop and Play does not bring it back into a new song', async () => {
  const { flow, scheduler, press } = await inJam();
  scheduler.capturePerformance = () => scheduler.isPlaying ? takeFor(flow.doc.id) : null;
  let kept = 0; scheduler.markPerformanceKept = () => { kept++; };
  await press('capture-direction');
  assert.equal(kept, 1);
});

test('what does not fit becomes another song under Your songs, with one plain line heard and seen, and no copies on a repeat', async () => {
  const { flow, scheduler, said, press } = await inJam();
  const older = { ...takeFor(flow.doc.id), events: takeFor(flow.doc.id).events.map(r => r.event.id.startsWith('jam-live-') ? { ...r, event: { ...r.event, id: `old-${r.event.id}`, source_note_id: r.event.source_note_id.replace('jam-live-', 'jam-live-old-') } } : r) };
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...takeFor(flow.doc.id), earlier: older } : null;
  const { listWorkingSongs } = await import('../../../static/js/theory/save_store.js');
  const before = listWorkingSongs(globalThis.window.localStorage).length;
  await press('capture-direction');
  const songs = listWorkingSongs(globalThis.window.localStorage);
  const extra = songs.find(song => /-earlier-/.test(song.id));
  assert.ok(extra, 'the earlier notes are a song of their own');
  assert.ok(songs.length > before);
  const inExtra = [...extra.notes, ...(extra.song_cards || []).flatMap(c => c.material?.notes || [])].map(n => n.source_note_id);
  for (let i = 0; i < 8; i++) assert.ok(inExtra.includes(`jam-live-old-${i}`), `note ${i} is in the other song`);
  const { madeByYou } = await import('../../../static/js/theory/session_rules.js');
  assert.ok(madeByYou(extra), 'the start screen lists only what madeByYou accepts, so a saved song it refuses cannot be reached');
  assert.equal(extra.capture_development_started, true, 'it opens like any other kept song');
  assert.equal(extra.last_stage, 'song', 'on the song screen, not the band screen it was split from');
  assert.match(keepLines(said).at(-1), /Your older notes are in a new song\. Find it on the first screen\./);
  assert.match(flow._keepLostHtml(), /Your older notes are in a new song\./);
  assert.equal(flow.doc.captured_performance.earlier, undefined, 'saved once, not also carried in this file');
  await press('undo');
  await press('capture-direction');
  assert.equal(listWorkingSongs(globalThis.window.localStorage).filter(song => /-earlier-/.test(song.id)).length, 1, 'Undo and Keep again makes no copy');
});

test('if the other song cannot be saved, its notes stay in this song\'s file and the line says so', async () => {
  const { flow, scheduler, said, press } = await inJam();
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...takeFor(flow.doc.id), earlier: takeFor(flow.doc.id) } : null;
  const real = globalThis.window.localStorage.setItem;
  globalThis.window.localStorage.setItem = () => { throw Error('full'); };
  await press('capture-direction');
  globalThis.window.localStorage.setItem = real;
  assert.ok(flow.doc.captured_performance.earlier, 'nothing is discarded');
  assert.match(keepLines(said).at(-1), /Old notes stay with this song\./);
});

test('leaving Jam with unkept live playing asks before unloading; after Make my song it does not', async () => {
  const { flow, scheduler, press } = await inJam();
  const check = () => {
    let prevented = false;
    const ev = { preventDefault() { prevented = true; }, returnValue: undefined };
    flow._onBeforeUnload(ev);
    return prevented && ev.returnValue === '';
  };
  assert.equal(check(), false, 'no warning before any personal notes are played');
  scheduler.performanceTake = { song_id: flow.doc.id, events: takeFor(flow.doc.id).events };
  for (const record of scheduler.performanceTake.events) if (record.event?.provenance === 'user_placed') flow._rememberUnkeptPlaying(record.event.source_note_id || record.event.id);
  scheduler.capturePerformance = () => scheduler.isPlaying ? takeFor(flow.doc.id) : null;
  scheduler.markPerformanceKept = function () { if (this.performanceTake) this.performanceTake.kept = true; this.lastStoppedPerformance = null; };
  assert.equal(check(), true, 'warns while live playing is unkept');
  scheduler.stop();
  assert.equal(check(), true, 'still warns after Stop before Make my song');
  await press('capture-direction');
  assert.equal(flow.stage, 'tune');
  assert.equal(check(), false, 'does not warn once Make my song keeps the playing');
});
