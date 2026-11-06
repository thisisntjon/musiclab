// Verifier's hostile input against cf37871 (longer history): the older notes are saved as a second song whose id is
// `${source.id}-earlier-${first occurrence}` (static/ui/stages/play_flow.js, _saveEarlierNotes). A new take restarts
// occurrences at 1 (scheduler.js start()), so the same song kept a second time, after Back to jam and another long
// take, can produce the same id for a different older phrase. Contract (3 November): no played note is lost.
// Screen and storage are stubbed as in keep_twice_flow.test.mjs beside this file; the capture handed over is fixed.
//   node --test tests/js/ui/earlier_song_hostile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { listWorkingSongs } from '../../../static/js/theory/save_store.js';
import { madeByYou } from '../../../static/js/theory/session_rules.js';

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
  return { flow, scheduler, said, press };
}
// Eight live notes with the given id prefix; occurrences restart at 1 in every take, as the scheduler numbers them.
const phrase = (songId, prefix) => ({ version: 1, source_song_id: songId, start: 0, end: 9.6, bpm: 100, bars: 4, events: [
  { time: 0, duration: .5, occurrence: 1, event: { id: 'band-0', role: 'bass', patch_id: 'clean_bass', provenance: 'jam_generated', velocity: .6, duration_sec: .5, concrete: { midi_pitch: 40 } } },
  ...Array.from({ length: 8 }, (_, i) => ({ time: 1 + i * .3, duration: .25, occurrence: i + 2,
    event: { id: `${prefix}-${i}`, source_note_id: `${prefix}-${i}`, role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .85, duration_sec: .25, concrete: { freq_hz: 440 * 2 ** ((60 + i - 69) / 12) } } }))] });
const idsIn = song => [...song.notes, ...(song.song_cards || []).flatMap(c => c.material?.notes || [])].map(n => n.source_note_id);

test('Keep, Back to jam, a second long take, Keep again: the older notes of both takes are each in some song', async () => {
  const { flow, scheduler, press } = setup();
  await press('listen-circle');
  assert.equal(flow.stage, 'jam');
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...phrase(flow.doc.id, 'jam-live-take1-new'), earlier: phrase(flow.doc.id, 'jam-live-take1-old') } : null;
  await press('capture-direction');
  assert.equal(flow.stage, 'tune');
  const firstSongs = listWorkingSongs(globalThis.window.localStorage).filter(s => /-earlier-/.test(s.id)).map(s => s.id);
  await press('jam-open');
  assert.equal(flow.stage, 'jam');
  await press('play');
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...phrase(flow.doc.id, 'jam-live-take2-new'), earlier: phrase(flow.doc.id, 'jam-live-take2-old') } : null;
  await press('capture-direction');
  assert.equal(flow.stage, 'tune');
  const songs = listWorkingSongs(globalThis.window.localStorage);
  const everywhere = new Set([...songs.flatMap(idsIn), ...idsIn(flow.doc)]);
  const missing = Array.from({ length: 8 }, (_, i) => `jam-live-take1-old-${i}`).filter(id => !everywhere.has(id));
  assert.deepEqual(missing, [], `the first take's older notes were in ${firstSongs.join(', ')}; after the second Keep the earlier songs are ${songs.filter(s => /-earlier-/.test(s.id)).map(s => s.id).join(', ')}`);
  for (let i = 0; i < 8; i++) assert.ok(everywhere.has(`jam-live-take2-old-${i}`));
});

async function keptTwice() {
  const made = setup(), { flow, scheduler, press } = made;
  await press('listen-circle');
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...phrase(flow.doc.id, 'jam-live-take1-new'), earlier: phrase(flow.doc.id, 'jam-live-take1-old') } : null;
  await press('capture-direction');
  await press('jam-open');
  await press('play');
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...phrase(flow.doc.id, 'jam-live-take2-new'), earlier: phrase(flow.doc.id, 'jam-live-take2-old') } : null;
  await press('capture-direction');
  return made;
}
const earlierSongs = () => listWorkingSongs(globalThis.window.localStorage).filter(s => /-earlier-/.test(s.id));

test('keeping the same song twice makes two older songs a person can tell apart on the start screen', async () => {
  await keptTwice();
  const songs = earlierSongs();
  assert.ok(songs.length >= 2);
  assert.equal(new Set(songs.map(s => s.title)).size, songs.length, `titles were ${songs.map(s => s.title).join(' and ')}`);
  for (const song of songs) assert.ok(madeByYou(song), 'the start screen lists it');
});

test('Undo and Keep again replaces its own older song and does not take a new number', async () => {
  const { flow, scheduler, press } = setup();
  await press('listen-circle');
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...phrase(flow.doc.id, 'jam-live-take1-new'), earlier: phrase(flow.doc.id, 'jam-live-take1-old') } : null;
  await press('capture-direction');
  const before = earlierSongs().map(s => [s.id, s.title]);
  await press('undo');
  await press('capture-direction');
  assert.deepEqual(earlierSongs().map(s => [s.id, s.title]), before);
});

test('a note repeating from the loop does not name the older song: its id is shared between takes', async () => {
  const { flow, scheduler, press } = setup();
  const withRepeat = prefix => { const take = phrase(flow.doc.id, prefix); take.events.splice(1, 0, { time: .5, duration: .25, occurrence: 1, event: { id: 'jam-user-loop', source_note_id: 'jam-user-loop', role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .8, duration_sec: .25, concrete: { freq_hz: 440 } } }); return take; };
  await press('listen-circle');
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...phrase(flow.doc.id, 'jam-live-a-new'), earlier: withRepeat('jam-live-a-old') } : null;
  await press('capture-direction');
  await press('jam-open');
  await press('play');
  scheduler.isPlaying = true;
  scheduler.capturePerformance = () => scheduler.isPlaying ? { ...phrase(flow.doc.id, 'jam-live-b-new'), earlier: withRepeat('jam-live-b-old') } : null;
  await press('capture-direction');
  const ids = new Set(earlierSongs().flatMap(idsIn));
  for (let i = 0; i < 8; i++) { assert.ok(ids.has(`jam-live-a-old-${i}`)); assert.ok(ids.has(`jam-live-b-old-${i}`)); }
});

test('a band note whose pitch comes from its frequency can be drawn: a kept song never stops the screen', async () => {
  const { spellPitch } = await import('../../../static/js/theory/score_sheet.js');
  assert.deepEqual(spellPitch(79.00000282734328), spellPitch(79));
  assert.deepEqual(spellPitch(71.99999567891487), spellPitch(72));
  assert.doesNotThrow(() => spellPitch(NaN));
  const { materializePerformance } = await import('../../../static/js/theory/performance_capture.js');
  const { flow, press } = setup();
  await press('listen-circle');
  const band = { time: 0, duration: .5, occurrence: 1, event: { id: 'band-f', role: 'harmony', patch_id: 'sampled_piano_v1', provenance: 'generator_default', velocity: .6, duration_sec: .5, concrete: { freq_hz: 783.991 } } };
  const bent = { time: .5, duration: .5, occurrence: 2, event: { id: 'bent', role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .6, duration_sec: .5, concrete: { freq_hz: 800 } } };
  const doc = materializePerformance(JSON.parse(JSON.stringify(flow.doc)), { version: 1, start: 0, end: 9.6, bpm: 100, bars: 4, events: [band, bent] });
  assert.equal(doc.notes[0].concrete.midi_pitch, 79, 'a tiny rounding error is not a pitch');
  assert.ok(!Number.isInteger(doc.notes[1].concrete.midi_pitch), 'a real bend stays as played');
  assert.equal(doc.notes[0].concrete.freq_hz, 783.991, 'the sound itself is not touched');
});

// 3 November ruling: a second Keep must not drop the first take out of the song with only an obscure button to bring it back.
const LAST_TAKE = /Your last take is saved too\. Find it on the first screen\./;
const take = (flow, scheduler, capture) => { scheduler.capturePerformance = () => scheduler.isPlaying ? capture(flow.doc.id) : null; };
async function keepThenAgain(first, second) {
  const made = setup(), { flow, scheduler, press } = made;
  await press('listen-circle');
  take(flow, scheduler, first);
  await press('capture-direction');
  await press('jam-open');
  await press('play');
  scheduler.isPlaying = true;
  take(flow, scheduler, second);
  await press('capture-direction');
  return made;
}
const said = made => made.said.filter(line => /your song now/i.test(line)).at(-1) || '';
const ownIds = song => idsIn(song).filter(id => /^jam-live-/.test(id));

test('a second Keep saves the first take as its own song, listed, and says so seen and heard', async () => {
  const made = await keepThenAgain(id => phrase(id, 'jam-live-first'), id => phrase(id, 'jam-live-second'));
  const stored = listWorkingSongs(globalThis.window.localStorage), main = stored.find(s => s.id === made.flow.doc.id) || made.flow.doc;
  assert.ok(ownIds(main).includes('jam-live-second-0'), 'the second take is the song');
  const saved = earlierSongs();
  assert.equal(saved.length, 1);
  for (let i = 0; i < 8; i++) assert.ok(idsIn(saved[0]).includes(`jam-live-first-${i}`), `first take note ${i} is in a stored song`);
  assert.ok(madeByYou(saved[0]), 'the start screen lists it');
  assert.equal(saved[0].last_stage, 'song', 'it opens on the song screen');
  assert.match(said(made), LAST_TAKE);
  assert.match(made.flow._keepLostHtml(), LAST_TAKE);
});

test('a second take that holds every first note saves nothing extra and says nothing extra', async () => {
  const made = await keepThenAgain(id => phrase(id, 'jam-live-same'), id => phrase(id, 'jam-live-same'));
  assert.equal(earlierSongs().length, 0);
  assert.doesNotMatch(said(made), LAST_TAKE);
});

test('a first Keep says nothing about a last take', async () => {
  const { flow, scheduler, press, said: lines } = setup();
  await press('listen-circle');
  take(flow, scheduler, id => phrase(id, 'jam-live-only'));
  await press('capture-direction');
  assert.equal(earlierSongs().length, 0);
  assert.doesNotMatch(lines.join(' '), LAST_TAKE);
});

test('Keep, back, Keep, Undo, Keep again makes no second copy of the first take', async () => {
  const made = await keepThenAgain(id => phrase(id, 'jam-live-first'), id => phrase(id, 'jam-live-second'));
  await made.press('undo');
  await made.press('capture-direction');
  assert.equal(earlierSongs().length, 1);
});

test('an older song is never overwritten unless all its notes are in the new one, even when a replayed note names both', async () => {
  // A note replaying from the kept song keeps its id, so two different older parts can begin with the same note.
  const older = (id, name) => { const part = phrase(id, `jam-live-${name}`); part.events[1].event.source_note_id = 'jam-live-replayed'; part.events[1].event.id = 'jam-live-replayed'; return part; };
  await keepThenAgain(id => ({ ...phrase(id, 'jam-live-a'), earlier: older(id, 'x') }), id => ({ ...phrase(id, 'jam-live-a'), earlier: older(id, 'y') }));
  const ids = new Set(earlierSongs().flatMap(idsIn));
  for (let i = 1; i < 8; i++) { assert.ok(ids.has(`jam-live-x-${i}`), `first older part, note ${i}`); assert.ok(ids.has(`jam-live-y-${i}`), `second older part, note ${i}`); }
});

test('if the first take cannot be saved, the screen says where it is, and it is', async () => {
  const made = setup(), { flow, scheduler, press } = made;
  await press('listen-circle');
  take(flow, scheduler, id => phrase(id, 'jam-live-first'));
  await press('capture-direction');
  await press('jam-open');
  await press('play');
  scheduler.isPlaying = true;
  const storage = globalThis.window.localStorage, realSet = storage.setItem;
  storage.setItem = (key, value) => { if (/-earlier-/.test(String(value)) && /"id":"[^"]*-earlier-/.test(String(value).slice(0, 200))) throw new Error('full'); return realSet(key, value); };
  take(flow, scheduler, id => phrase(id, 'jam-live-second'));
  await press('capture-direction');
  storage.setItem = realSet;
  assert.equal(earlierSongs().length, 0);
  assert.match(said(made), /Old notes stay with this song\./);
  assert.match(JSON.stringify(flow.doc.capture_source), /jam-live-first-0/);
});
