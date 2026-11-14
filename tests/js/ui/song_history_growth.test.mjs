// Every trip through the Tune wheel (Make my tune, then Keep or Back to jam) used to copy the whole song inside the
// next one, so a few minutes of the main loop filled the space for songs. These run the real entry and Keep/Back
// handlers ten times and check the song stays two songs deep and small. The composer is a stand-in: which melody
// is chosen does not change what a song keeps. A song saved the old way must open short with the same notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { MelodyFieldSession } from '../../../static/ui/melody_field_session.js';
import { WORKING_KEY, listWorkingSongs, loadPiece, exportProjectJson } from '../../../static/js/theory/save_store.js';
import { compileSongStandalone } from '../../../static/ui/standalone_compiler.js';

const SIZE_LIMIT = 1_000_000;
const QUOTA = 5_200_000; // About what a browser allows here, in characters.
const HISTORY = ['capture_source', 'melody_original'];
/** How deep songs are kept inside songs, down either kind of history. */
function depth(doc) {
  let deepest = 0;
  const walk = (at, d) => { deepest = Math.max(deepest, d); for (const key of HISTORY) if (at?.[key] && typeof at[key] === 'object') walk(at[key], d + 1); };
  walk(doc, 0);
  return deepest;
}
const playable = doc => compileSongStandalone(JSON.parse(JSON.stringify({ ...doc, arrangement_mode: 'loop' }))).events
  .map(e => [e.id, e.role, e.patch_id, e.concrete?.midi_pitch, +e.start_sec.toFixed(6), +e.duration_sec.toFixed(6)]);

function setup() {
  const values = new Map(), session = new Map();
  const used = except => [...values].reduce((n, [key, value]) => key === except ? n : n + key.length + value.length, 0);
  const storage = { getItem: k => values.get(k) ?? null, removeItem: k => values.delete(k), key: i => [...values.keys()][i] ?? null, get length() { return values.size; },
    setItem(k, v) { if (used(k) + k.length + String(v).length > QUOTA) throw new Error('QuotaExceededError'); values.set(k, String(v)); } };
  globalThis.window = {
    localStorage: storage,
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {},
  };
  const root = { innerHTML: '', insertAdjacentHTML(where, html) { this.innerHTML = where === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const scheduler = {
    isPlaying: false, liveNotes: new Map(), masterBus: { piano: {}, disposed: false }, audioCtx: { currentTime: 0 }, gridOriginTime: 0, stopGeneration: 0,
    setCompiledSong(song) { this.compiledSong = song; }, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, preparePiano: async () => ({}), previewSound() {}, previewBar: () => true,
    noteOn() { return null; }, noteOff() {}, stop() { if (this.isPlaying) this.stopGeneration += 1; this.isPlaying = false; }, start() { this.isPlaying = true; }, markPerformanceKept() {},
    capturePerformance: () => null, activeJamBacking: () => null, activeJamContext: () => null,
    queueContinuousPartAudition(_view, { sectionId, requestId }) { this.audition = { sectionId, realizedId: requestId, requestedId: requestId }; return { ok: true }; },
    getPartAuditionState() { return this.isPlaying ? this.audition : null; }, clearPartAudition() {},
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
  return { flow, scheduler, said, press, storage, values };
}

/** Two bars of band and, when asked, eight keys the person played (a long jam makes every copy bigger). */
const take = (songId, prefix, { played = true } = {}) => ({ version: 1, source_song_id: songId, start: 0, end: 9.6, bpm: 100, bars: 4, events: [
  ...Array.from({ length: 64 }, (_, i) => ({ time: i * .15, duration: .15, occurrence: 100 + i, event: { id: `band-${i}`, role: 'bass', patch_id: 'clean_bass', provenance: 'jam_generated', velocity: .6, duration_sec: .15, concrete: { midi_pitch: 40 + (i % 5) } } })),
  ...(played ? Array.from({ length: 8 }, (_, i) => ({ time: 1 + i * .3, duration: .25, occurrence: i + 2,
    event: { id: `${prefix}-${i}`, source_note_id: `${prefix}-${i}`, role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .85, duration_sec: .25, concrete: { freq_hz: 440 * 2 ** ((60 + i - 69) / 12) } } })) : [])] });

/** The composer worker does not run under Node. Its stand-in offers the score as heard, as the centre choice does.
 * With pick 'other' it offers another melody instead: the band and a new lead, without the keys the person played. */
async function withComposerStandIn(run, { pick = 'original' } = {}) {
  const prepare = MelodyFieldSession.prototype.prepare;
  MelodyFieldSession.prototype.prepare = async function () {
    this.phraseContext ??= { version: 1, root: 0, sceneId: 'house-v1' };
    const other = this.source.events.filter(e => e.provenance !== 'user_placed' && !String(e.id).startsWith('other-lead-'))
      .concat([0, 4, 8, 12].map(step => ({ id: `other-lead-${step}`, role: 'lead', patch_id: 'pluck_lead', provenance: 'jam_generated', step, duration_steps: 2,
        velocity: .7, start_sec: step * .15, duration_sec: .3, concrete: { midi_pitch: 67 } })));
    this.palette = { original: { notes: this.source.events, choice: { position: { x: 0, y: 0 } } },
      other: { notes: other, choice: { position: { x: .5, y: 0 } }, changed: true } };
    this.chooseMelody = () => pick === 'other' ? { key: 'other', label: 'Other' } : { key: 'original', label: 'Original' };
    this.candidates.clear(); this.requestId = this._candidate(this.position).id;
  };
  try { return await run(); } finally { MelodyFieldSession.prototype.prepare = prepare; }
}

/** One trip: Make my tune, play along in the wheel when asked, then Keep (and Save) or Back to jam. */
async function trip(made, action, n, { playInWheel }) {
  const { flow, scheduler, press } = made;
  if (flow.stage !== 'jam') await press('jam-open');
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? take(flow.doc.id, `jam-live-trip${n}`) : null;
  await flow._enterMelodyField();
  assert.ok(flow.melodyField?.palette, `trip ${n}: the Tune wheel opened`);
  scheduler.capturePerformance = () => scheduler.isPlaying ? take(flow.doc.id, `wheel-live-trip${n}`, { played: playInWheel }) : null;
  await flow._melodyFieldAction(action);
  assert.equal(flow.melodyField, null, `trip ${n}: ${action} closed the wheel`);
  if (action === 'melody-field-keep') await press('save');
}

/** Ten trips from a fresh jam (Keep and Save) or from a kept jam (Back to jam), then one last Keep and Save.
 * The person plays along in the wheel on odd trips; on even trips only the band is heard there. */
async function tenTrips(action, { pick = 'original' } = {}) {
  const made = setup(), { flow, scheduler, press, values } = made, trips = [];
  await press('listen-circle');
  if (action === 'melody-field-back') {
    // Keep in the jam first, so the song is the person's and its draft is saved on every trip.
    scheduler.isPlaying = true;
    scheduler.capturePerformance = () => scheduler.isPlaying ? take(flow.doc.id, 'jam-live-first') : null;
    await press('capture-direction');
  }
  const history = doc => JSON.stringify([doc.capture_source ?? null, doc.melody_original ?? null]).length;
  await withComposerStandIn(async () => {
    for (let n = 0; n < 10; n++) {
      await trip(made, action, n, { playInWheel: n % 2 === 1 });
      trips.push({ depth: depth(flow.doc), size: JSON.stringify(flow.doc).length, history: history(flow.doc),
        stored: (values.get(WORKING_KEY) || '').length + (values.get('musiclab.saves.v1') || '').length });
    }
    await trip(made, 'melody-field-keep', 10, { playInWheel: true });
  }, { pick });
  return { ...made, trips };
}

for (const action of ['melody-field-keep', 'melody-field-back']) {
  test(`ten ${action === 'melody-field-keep' ? 'Keep and Save' : 'Back to jam'} trips stay two songs deep and small`, async () => {
    const { flow, trips, storage } = await tenTrips(action);
    const sizes = trips.map(t => t.size).join(', ');
    for (const [i, t] of trips.entries()) assert.ok(t.depth <= 2, `trip ${i}: songs kept ${t.depth} deep (sizes ${sizes})`);
    // Only the notes the person played grow the song. What it holds of earlier songs stays the same size.
    assert.ok(trips.at(-1).history <= trips[1].history * 1.1, `history stays the same size: ${trips.map(t => t.history).join(', ')}`);
    assert.ok(trips.at(-1).size <= trips[1].size * 1.5, `the song does not grow trip by trip: ${sizes}`);
    assert.ok(trips.at(-1).size < SIZE_LIMIT && trips.at(-1).stored < SIZE_LIMIT, `under the limit: ${sizes}; stored ${trips.at(-1).stored}`);
    assert.ok(trips.at(-1).stored > 0, 'the song really was stored');
    assert.match(flow.saveMessage, /^Saved "/, 'Save still works after ten trips');
    for (const song of listWorkingSongs(storage)) assert.ok(depth(song) <= 2, `${song.title} is stored two songs deep at most`);
    assert.ok(depth(loadPiece(storage, flow.doc.id)) <= 2, 'the saved song is short too');
    // What the buttons need is still there: the played take (Open played take) and the loop under it.
    assert.ok(flow.doc.capture_source?.captured_performance, 'Open played take has the last take');
    assert.ok(flow.doc.melody_original?.notes?.length, 'the melody original is kept');
    assert.match(JSON.stringify(flow.doc.capture_source), /wheel-live-trip10-0/, 'the last take keeps what the person played');
  });
}

/** Every place a song can be: the open song, its drafts and its saves. */
const everywhere = (flow, storage) => JSON.stringify([flow.doc, ...listWorkingSongs(storage), JSON.parse(storage.getItem('musiclab.saves.v1') || '[]')]);
const wheelIds = n => Array.from({ length: 8 }, (_, i) => `wheel-live-trip${n}-${i}`);
const missing = (text, ids) => ids.filter(id => !String(text).includes(`"${id}"`));

/** Keys A to K played inside the Tune wheel live only in the kept melody's played take, not in its score. */
async function keptWithWheelKeys({ pick = 'other' } = {}) {
  const made = setup(), { flow, scheduler, press } = made;
  await press('listen-circle');
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? take(flow.doc.id, 'jam-live-first') : null;
  await press('capture-direction');
  await withComposerStandIn(() => trip(made, 'melody-field-back', 0, { playInWheel: true }), { pick });
  return made;
}

test('keys played in the Tune wheel stay after a second trip, Keep and reopening', async () => {
  const made = await keptWithWheelKeys(), { flow, storage } = made;
  const inScore = JSON.stringify(flow.doc.notes);
  assert.deepEqual(missing(inScore, wheelIds(0)), wheelIds(0), 'the other melody does not hold the wheel keys in its score');
  assert.deepEqual(missing(JSON.stringify(flow.doc), wheelIds(0)), [], 'the kept melody holds what was played in the wheel');
  for (const [n, action] of [[1, 'melody-field-back'], [2, 'melody-field-keep']]) {
    await withComposerStandIn(() => trip(made, action, n, { playInWheel: n === 2 }), { pick: 'other' });
    assert.ok(depth(flow.doc) <= 2, `trip ${n}: kept ${depth(flow.doc)} deep`);
    assert.deepEqual(missing(JSON.stringify(flow.doc), wheelIds(0)), [], `trip ${n}: the song still holds the first wheel keys`);
    assert.deepEqual(missing(JSON.stringify(flow.doc), ['jam-live-first-0', 'jam-live-trip0-0', 'jam-live-trip1-0']), [], `trip ${n}: and the keys played in the jam`);
  }
  assert.match(flow.saveMessage, /^Saved "/);
  assert.deepEqual(missing(JSON.stringify(loadPiece(storage, flow.doc.id)), [...wheelIds(0), ...wheelIds(2)]), [], 'the saved song holds every wheel key');
  // Reopen the saved song, play new keys in the wheel and Keep: nothing played before is cut.
  flow._continue(flow.doc.id);
  await withComposerStandIn(() => flow._resumeMelodyField(), { pick: 'other' });
  assert.ok(flow.melodyField?.palette, 'the tune map reopened');
  made.scheduler.isPlaying = true; flow.melodyField.hasPlayed = true;
  made.scheduler.capturePerformance = () => take(flow.doc.id, 'wheel-live-trip3');
  await flow._melodyFieldAction('melody-field-keep');
  assert.equal(flow.melodyField, null, 'Keep closed the tune map');
  assert.ok(depth(flow.doc) <= 2, `reopened Keep kept ${depth(flow.doc)} deep`);
  assert.deepEqual(missing(JSON.stringify(flow.doc), [...wheelIds(0), ...wheelIds(2), ...wheelIds(3)]), [], 'every wheel key is in the song');
});

test('a Keep in the jam over a kept melody keeps the keys played in the wheel', async () => {
  const made = await keptWithWheelKeys(), { flow, scheduler, press, storage } = made;
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? take(flow.doc.id, 'jam-live-later') : null;
  await press('capture-direction');
  assert.ok(flow.doc.captured_performance, 'the new take is the song');
  assert.ok(depth(flow.doc) <= 2, `kept ${depth(flow.doc)} deep`);
  assert.deepEqual(missing(everywhere(flow, storage), wheelIds(0)), [], 'the wheel keys are kept');
  assert.deepEqual(missing(JSON.stringify(flow.doc), wheelIds(0)), [], 'in the song itself');
});

test('the wheel-key checks can fail: a song that drops its played take is caught', async () => {
  const { flow } = await keptWithWheelKeys();
  const cut = structuredClone(flow.doc);
  delete cut.capture_source; delete cut.played_archive;
  assert.deepEqual(missing(JSON.stringify(cut), wheelIds(0)), wheelIds(0), 'without its played take the song holds none of them');
});

test('Keep in the jam over a kept melody loses no note the take missed', async () => {
  const made = setup(), { flow, scheduler, press, storage } = made;
  await press('listen-circle');
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? take(flow.doc.id, 'jam-live-first') : null;
  await press('capture-direction');
  // Two trips: what the person played on the second is in the kept melody, not in its pinned original.
  await withComposerStandIn(async () => { await trip(made, 'melody-field-back', 0, { playInWheel: false }); await trip(made, 'melody-field-back', 1, { playInWheel: false }); });
  const played = flow.doc.notes.filter(n => n.provenance === 'user_placed').map(n => n.source_note_id || n.id);
  assert.ok(played.some(id => id.startsWith('jam-live-trip1-')), 'the kept melody holds notes the person played');
  assert.doesNotMatch(JSON.stringify([flow.doc.melody_original, flow.doc.jam_start]), /jam-live-trip1-/, 'and only it holds them');
  // Keep is pressed before those notes come round again, so the new take does not have them.
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? take(flow.doc.id, 'jam-live-later') : null;
  await press('capture-direction');
  assert.ok(flow.doc.captured_performance, 'the new take is the song');
  assert.ok(depth(flow.doc) <= 2, `kept ${depth(flow.doc)} deep`);
  const kept = JSON.stringify([flow.doc, ...listWorkingSongs(storage)]);
  for (const id of played) assert.ok(kept.includes(`"${id}"`), `${id} is still kept`);
});

for (const action of ['melody-field-keep', 'melody-field-back']) {
  test(`ten ${action === 'melody-field-keep' ? 'Keep' : 'Back to jam'} trips with another melody keep every key, two songs deep and small`, async () => {
    const { flow, trips, storage } = await tenTrips(action, { pick: 'other' });
    const sizes = trips.map(t => t.size).join(', ');
    for (const [i, t] of trips.entries()) assert.ok(t.depth <= 2, `trip ${i}: songs kept ${t.depth} deep (sizes ${sizes})`);
    assert.ok(trips.at(-1).history <= trips[1].history * 1.1, `history stays the same size: ${trips.map(t => t.history).join(', ')}`);
    assert.ok(trips.at(-1).size < SIZE_LIMIT && trips.at(-1).stored < SIZE_LIMIT, `under the limit: ${sizes}; stored ${trips.at(-1).stored}`);
    // Only what the person played grows: the archive holds each played note once.
    const archive = flow.doc.played_archive || [];
    const ids = archive.map(n => n.source_note_id || n.id);
    assert.equal(new Set(ids).size, ids.length, 'each played note is kept once');
    assert.ok(archive.every(n => n.provenance === 'user_placed'), 'and only played notes are kept there');
    assert.deepEqual(missing(JSON.stringify(flow.doc), [1, 3, 5, 7, 9, 10].flatMap(wheelIds)), [], 'every key played in the wheel is still in the song');
    assert.deepEqual(missing(JSON.stringify(flow.doc), Array.from({ length: 11 }, (_, n) => `jam-live-trip${n}-0`)), [], 'and every jam key');
    assert.ok(trips.at(-1).size - JSON.stringify(archive).length <= trips[1].size * 1.5, `without the played notes the song does not grow: ${sizes}`);
    for (const song of listWorkingSongs(storage)) assert.ok(depth(song) <= 2, `${song.title} is stored two songs deep at most`);
  });
}

test('the depth and size checks can fail: a song nested the old way is caught', () => {
  let doc = { id: 'old', global_context: { bpm: 100 }, notes: take('old', 'n').events.map(e => e.event), song_cards: [] };
  for (let trip = 0; trip < 10; trip++) doc = { ...doc, capture_source: doc, melody_original: doc.melody_original || doc };
  assert.ok(depth(doc) > 2, 'the old nesting is deeper than two');
  assert.ok(JSON.stringify(doc).length > 10 * JSON.stringify(doc.notes).length, 'and every trip copies the song again');
});

/** A kept melody saved by the old code after several trips: each song holds the whole song before it. */
function oldDeepSave() {
  const loop = { id: 'song-old', title: 'Old song', source: 'person', global_context: { bpm: 100, bars: 4, steps_per_bar: 16, root_pc: 0, scale_type: 'major' },
    jam_session: { trip: -1 }, song_cards: [{ bars: 4, role_name: 'Loop', beat: true, tune: true, under: true, fx: null, big: false }],
    notes: [{ id: 'band-0', role: 'bass', step: 0, duration_steps: 4, velocity: .5, patch_id: 'clean_bass', provenance: 'jam_generated', concrete: { midi_pitch: 40 } }] };
  const note = (id, step, pitch, provenance = 'user_placed') => ({ id, role: 'lead', step, duration_steps: 2, velocity: .7, patch_id: 'pluck_lead', provenance, pitch_lock_mode: 'concrete', concrete: { midi_pitch: pitch }, performance: { version: 1, offset_steps: 0 } });
  const takeDoc = (from, n) => ({ ...structuredClone(from), notes: [note(`take-${n}`, n % 64, 60 + n % 12)], captured_performance: { version: 1, bpm: 100, bars: 4, start: 0, end: 1, events: [{ time: .1, duration: .2, occurrence: n, event: note(`take-${n}`, n % 64, 60 + n % 12) }] },
    capture_notes: { timing: 'take' }, capture_source: structuredClone(from) });
  const kept = (source, archive, n) => { const doc = structuredClone(source); doc.capture_source = structuredClone(archive);
    doc.melody_original = structuredClone(source.melody_original || source); delete doc.captured_performance;
    doc.notes = [note(`melody-${n}-a`, 0, 64, 'jam_generated'), note(`melody-${n}-b`, 4, 67, 'jam_generated'), note(`own-${n}`, 8, 72)];
    doc.capture_notes = { melody_field: { version: 4, context: { version: 1, root: 0 }, choice: { position: { x: 0, y: 0 } } } };
    doc.song_cards = [{ bars: 4, role_name: 'My melody', beat: true, tune: true, under: true, fx: null, big: false }];
    doc.jam_session = { ...doc.jam_session, trip: n };
    return doc; };
  let doc = kept(takeDoc(loop, 0), takeDoc(takeDoc(loop, 0), 100), 0);
  for (let trip = 1; trip < 6; trip++) { const source = takeDoc(doc, trip); doc = kept(source, takeDoc(source, 100 + trip), trip); }
  return doc;
}

test('a song saved the old way opens two songs deep with the same notes, take and melody original', async () => {
  const old = oldDeepSave(), { flow, values, storage } = setup();
  assert.ok(depth(old) > 6, 'the fixture really is an old deep save');
  values.set('musiclab.saves.v1', JSON.stringify([{ id: old.id, source: 'person', title: old.title, saved_at: 'x', song: old }]));
  flow._continue(old.id);
  assert.equal(flow.doc.id, old.id);
  assert.ok(depth(flow.doc) <= 2, `opened ${depth(flow.doc)} deep`);
  assert.deepEqual(flow.doc.notes, old.notes, 'the score is the same');
  assert.deepEqual(playable(flow.doc), playable(old), 'it plays the same notes');
  const { capture_source: take, melody_original: original } = flow.doc;
  for (const key of ['notes', 'captured_performance', 'capture_notes']) assert.deepEqual(take[key], old.capture_source[key], `the played take keeps its ${key}`);
  for (const key of ['notes', 'jam_session', 'captured_performance']) assert.deepEqual(original[key], old.melody_original[key], `the melody original keeps its ${key}`);
  assert.equal(take.capture_source.capture_source, undefined, 'under the take only the loop stays');
  const rootOf = d => d.capture_source ? rootOf(d.capture_source) : d;
  assert.deepEqual(take.capture_source.notes, rootOf(old).notes, 'and that is the loop the song began from');
  assert.equal(take.capture_source.captured_performance, undefined, 'a loop, not a take');
  assert.ok(JSON.stringify(flow.doc).length * 3 < JSON.stringify(old).length, 'it is much smaller');
  for (const song of listWorkingSongs(storage)) assert.ok(depth(song) <= 2, 'the working copy is short too');
});

test('a song saved the old way keeps every played note of the songs cut away, once, and saves it', async () => {
  const old = oldDeepSave(), { flow, values, storage, press } = setup();
  const own = [];
  (function walk(at) { if (!at || typeof at !== 'object') return; if (at.provenance === 'user_placed') own.push(at.source_note_id || at.id); for (const v of Object.values(at)) walk(v); })(old);
  const ids = [...new Set(own)];
  for (const id of ['own-0', 'own-4', 'take-1', 'take-5', 'take-100', 'take-104']) assert.ok(ids.includes(id), `the fixture holds ${id}`);
  values.set('musiclab.saves.v1', JSON.stringify([{ id: old.id, source: 'person', title: old.title, saved_at: 'x', song: old }]));
  flow._continue(old.id);
  assert.ok(depth(flow.doc) <= 2);
  assert.deepEqual(missing(JSON.stringify(flow.doc), ids), [], 'every played note is still in the song');
  const archived = flow.doc.played_archive.map(n => n.source_note_id || n.id);
  assert.equal(new Set(archived).size, archived.length, 'each is kept once');
  await press('save');
  assert.deepEqual(missing(JSON.stringify(loadPiece(storage, old.id)), ids), [], 'and the next Save keeps them');
  // Open played take and Undo carry them too.
  await press('restore-capture-source');
  assert.deepEqual(missing(JSON.stringify(flow.doc), ids), [], 'the played take opened holds them');
});

test('after opening a song saved the old way, Open played take and Undo still work', async () => {
  const old = oldDeepSave(), { flow, values, press } = setup();
  values.set('musiclab.saves.v1', JSON.stringify([{ id: old.id, source: 'person', title: old.title, saved_at: 'x', song: old }]));
  flow._continue(old.id);
  await press('restore-capture-source');
  assert.deepEqual(flow.doc.notes, old.capture_source.notes, 'Open played take opens the take');
  assert.deepEqual(flow.doc.captured_performance, old.capture_source.captured_performance);
  await press('undo');
  assert.deepEqual(flow.doc.notes, old.notes, 'Undo brings the tune back');
  assert.deepEqual(playable(flow.doc), playable(old));
});

test('a song file saved the old way opens two songs deep with the same notes', async () => {
  const old = oldDeepSave(), { flow } = setup();
  await flow._importProjectFile({ size: 1000, text: async () => exportProjectJson(old) });
  assert.equal(flow.doc?.id, old.id, flow.saveMessage);
  assert.ok(depth(flow.doc) <= 2, `opened ${depth(flow.doc)} deep`);
  assert.deepEqual(playable(flow.doc), playable(old));
  assert.deepEqual(flow.doc.melody_original.notes, old.melody_original.notes);
  assert.deepEqual(flow.doc.capture_source.captured_performance, old.capture_source.captured_performance);
});

test('a short song opens exactly as it was saved', async () => {
  const old = oldDeepSave(), { flow, values } = setup();
  const bare = d => { const { capture_source, melody_original, ...rest } = structuredClone(d); return rest; };
  const loop = bare(old.melody_original.capture_source);
  const short = { ...structuredClone(old), capture_source: { ...bare(old.capture_source), capture_source: loop }, melody_original: { ...bare(old.melody_original), capture_source: loop } };
  assert.equal(depth(short), 2);
  values.set('musiclab.saves.v1', JSON.stringify([{ id: short.id, source: 'person', title: short.title, saved_at: 'x', song: short }]));
  flow._continue(short.id);
  for (const key of HISTORY) assert.deepEqual(flow.doc[key], short[key], `${key} is untouched`);
});
