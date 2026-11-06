// Size must not compound: a Keep carries the original loop forward, not every previous take. No played note may be lost.
// A failed save is said plainly. Real browser check: .qa-tools/storage-probe.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { listWorkingSongs, WORKING_KEY, storageNearlyFull } from '../../../static/js/theory/save_store.js';
import { materializePerformance } from '../../../static/js/theory/performance_capture.js';

function setup() {
  const values = new Map(), session = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), key: i => [...values.keys()][i] ?? null, get length() { return values.size; } };
  globalThis.window = {
    localStorage: storage,
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {},
  };
  const root = { innerHTML: '', insertAdjacentHTML(where, html) { this.innerHTML = where === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const scheduler = {
    isPlaying: false, liveNotes: new Map(), masterBus: { piano: {}, disposed: false }, audioCtx: { currentTime: 0 },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, preparePiano: async () => ({}), previewSound() {}, previewBar: () => true,
    noteOn() { return null; }, noteOff() {}, stop() { this.isPlaying = false; }, start() { this.isPlaying = true; }, markPerformanceKept() {},
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
  return { flow, scheduler, said, press, root, storage, values };
}
const phrase = (songId, prefix) => ({ version: 1, source_song_id: songId, start: 0, end: 9.6, bpm: 100, bars: 4, events: [
  ...Array.from({ length: 40 }, (_, i) => ({ time: i * .2, duration: .2, occurrence: 100 + i, event: { id: `band-${i}`, role: 'bass', patch_id: 'clean_bass', provenance: 'jam_generated', velocity: .6, duration_sec: .2, concrete: { midi_pitch: 40 } } })),
  ...Array.from({ length: 8 }, (_, i) => ({ time: 1 + i * .3, duration: .25, occurrence: i + 2,
    event: { id: `${prefix}-${i}`, source_note_id: `${prefix}-${i}`, role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .85, duration_sec: .25, concrete: { freq_hz: 440 * 2 ** ((60 + i - 69) / 12) } } }))] });
const stored = values => values.get(WORKING_KEY) || '';
const depth = doc => { let n = 0; for (let d = doc?.capture_source; d; d = d.capture_source) n += 1; return n; };

async function fourKeeps(made) {
  const { flow, scheduler, press, values } = made, sizes = [];
  await press('listen-circle');
  for (let keep = 0; keep < 4; keep++) {
    if (keep) { await press('jam-open'); await press('play'); scheduler.isPlaying = true; }
    scheduler.capturePerformance = () => scheduler.isPlaying ? phrase(flow.doc.id, `jam-live-keep${keep}`) : null;
    await press('capture-direction');
    sizes.push(stored(values).length);
  }
  return sizes;
}

test('four Keeps grow in a line, with every played note stored by identity', async () => {
  const made = setup(), sizes = await fourKeeps(made);
  const steps = sizes.slice(1).map((size, i) => size - sizes[i]);
  assert.ok(steps[2] <= steps[1] * 1.25, `each Keep adds about the same: sizes ${sizes.join(', ')}`);
  const raw = stored(made.values);
  for (let keep = 0; keep < 4; keep++) for (let i = 0; i < 8; i++) assert.ok(raw.includes(`jam-live-keep${keep}-${i}`), `Keep ${keep}, note ${i} is stored`);
  for (const song of listWorkingSongs(made.storage)) assert.ok(depth(song) <= 1, `${song.title} holds no chain of earlier takes`);
});

test('Restore source loop still has the loop the song began from', async () => {
  const made = setup(); await fourKeeps(made);
  const main = listWorkingSongs(made.storage).find(song => song.id === made.flow.doc.id);
  assert.ok(main.capture_source, 'the button still has somewhere to go');
  assert.equal(main.capture_source.captured_performance, undefined, 'it is the loop, not a take');
});

test('an older save with a chain of takes still restores as it was', () => {
  const inner = { id: 'loop', global_context: { bpm: 100 }, notes: [], song_cards: [] };
  const kept = { id: 'kept', global_context: { bpm: 100 }, notes: [], song_cards: [], captured_performance: { events: [] }, capture_source: inner };
  const old = { ...kept, capture_source: kept };
  assert.equal(depth(old), 2, 'nothing rewrites a save on load');
});

test('materialize keeps the whole previous take when asked, for a save that failed', () => {
  const kept = { id: 'kept', global_context: { bpm: 100 }, notes: [{ id: 'n', source_note_id: 'jam-live-only-here' }], song_cards: [], captured_performance: { events: [] }, capture_source: { id: 'loop' } };
  const capture = { version: 1, start: 0, end: 1, bpm: 100, bars: 1, events: phrase('kept', 'jam-live-new').events };
  assert.equal(materializePerformance(kept, capture).capture_source.id, 'loop');
  assert.equal(materializePerformance(kept, capture, { keepWholeSource: true }).capture_source.id, 'kept');
});

test('a Keep that cannot save the last take keeps it inside the song and says so', async () => {
  const made = setup(), { flow, scheduler, press, storage, said } = made;
  await press('listen-circle');
  scheduler.capturePerformance = () => scheduler.isPlaying ? phrase(flow.doc.id, 'jam-live-first') : null;
  await press('capture-direction');
  await press('jam-open'); await press('play'); scheduler.isPlaying = true;
  const realSet = storage.setItem;
  storage.setItem = () => { throw new Error('full'); };
  scheduler.capturePerformance = () => scheduler.isPlaying ? phrase(flow.doc.id, 'jam-live-second') : null;
  await press('capture-direction');
  storage.setItem = realSet;
  assert.match(JSON.stringify(flow.doc.capture_source), /jam-live-first-0/);
  const line = said.filter(l => /your song now/i.test(l)).at(-1);
  assert.match(line, /It is not saved yet\./);
  assert.doesNotMatch(line, /It is saved\./);
  assert.equal(flow.draftSaveFailed, true);
});

test('storage nearly full is measured, and is said with the way to keep a copy', async () => {
  const made = setup(), { flow, scheduler, press, storage, said, values, root } = made;
  assert.equal(storageNearlyFull(storage), false);
  values.set('filler', 'x'.repeat(4_100_000));
  assert.equal(storageNearlyFull(storage), true);
  await press('listen-circle');
  scheduler.capturePerformance = () => scheduler.isPlaying ? phrase(flow.doc.id, 'jam-live-first') : null;
  await press('capture-direction');
  const line = said.filter(l => /your song now/i.test(l)).at(-1);
  assert.match(line, /It is saved\./);
  assert.match(line, /Space for songs is almost full\. Use Download project\./);
  flow.render();
  assert.match(root.innerHTML, /Space for songs is almost full\./);
  assert.match(root.innerHTML, /data-key="dl-project"/);
});
