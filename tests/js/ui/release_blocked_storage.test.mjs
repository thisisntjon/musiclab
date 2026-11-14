// Open-release audit S16 and L6: MusicLab starts when the browser blocks site data, and one bad saved entry cannot
// stop the start screen. The screen is stubbed as in earlier_song_hostile.test.mjs beside this file; storage is
// replaced by one that throws on access, as Chrome's "Don't allow sites to save data" does.
//   node --test tests/js/ui/release_blocked_storage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { icon } from '../../../static/ui/icons.js';
import { safeStorage, installSafeStorage } from '../../../static/js/theory/safe_storage.js';
import { newPlayDoc, recordAct } from '../../../static/js/theory/session_rules.js';
import { beatGridFromNotes } from '../../../static/js/theory/beat_model.js';
import { advancePlayhead } from '../../../static/js/theory/playhead.js';

const denied = () => { const error = new Error("Failed to read the 'localStorage' property from 'Window': Access is denied for this document."); error.name = 'SecurityError'; throw error; };
const BLOCKED_WORDS = 'Songs here will be lost when you close the page. Use Download to keep songs.';

function screen(win) {
  globalThis.window = Object.assign(win, { scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {} });
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
  globalThis.document = { body: { classList: { toggle() {}, add() {}, contains: () => false } }, activeElement: null, getElementById: id => id === 'play-flow' ? root : null };
  return { root, scheduler };
}
const blockedWindow = () => ({ get localStorage() { return denied(); }, get sessionStorage() { return denied(); } });
const workingWindow = () => {
  const values = new Map();
  return { values, localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k),
    get length() { return values.size; }, key: i => [...values.keys()][i] ?? null }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
};

test('S16: the app starts when reading storage throws, says to use Download, and saving works for this visit', async () => {
  const win = blockedWindow();
  const { root, scheduler } = screen(win);
  assert.throws(() => globalThis.window.localStorage, /Access is denied/, 'storage really is blocked (control)');
  const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
  flow._sparkAt = () => {};
  flow.render();
  assert.match(root.innerHTML, /Find your groove/, 'the start screen draws');
  assert.ok(root.innerHTML.includes(BLOCKED_WORDS), 'the screen says songs will not stay');
  const song = newPlayDoc(); song.title = 'Visit song';
  song.notes.push({ id: 'own', role: 'lead', step: 0, duration_steps: 2, velocity: .8, patch_id: 'pluck_lead', pitch_lock_mode: 'concrete', concrete: { midi_pitch: 64 }, provenance: 'user_placed' });
  recordAct(song, 'tap');
  flow._loadDocIntoFlow(song, { stage: 'keep' });
  flow._save();
  assert.match(flow.saveMessage, /^Saved "Visit song"/);
  flow._go('start'); flow.libraryOpen = true; flow.render();
  assert.match(root.innerHTML, /Visit song/, 'the song is listed for this visit');
  assert.ok(root.innerHTML.includes(BLOCKED_WORDS));
});

test('S16 control: with working storage there is no notice, and safeStorage hands back the real storage', () => {
  const win = workingWindow();
  const { root, scheduler } = screen(win);
  const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
  flow._sparkAt = () => {};
  flow.render();
  assert.match(root.innerHTML, /Find your groove/);
  assert.ok(!root.innerHTML.includes(BLOCKED_WORDS));
  assert.equal(safeStorage('localStorage', win), win.localStorage);
  assert.equal(installSafeStorage(win), false);
});

test('S16: safeStorage falls back to memory when the getter or a read throws, and keeps what is written', () => {
  for (const win of [blockedWindow(), { localStorage: { getItem: denied, setItem: denied, removeItem: denied } }, { localStorage: null }]) {
    const storage = safeStorage('localStorage', win);
    assert.equal(storage.getItem('x'), null);
    storage.setItem('x', 1);
    assert.equal(safeStorage('localStorage', win).getItem('x'), '1', 'the same memory store each time');
    assert.equal(storage.length, 1);
    assert.equal(storage.key(0), 'x');
    storage.removeItem('x');
    assert.equal(storage.getItem('x'), null);
  }
  const win = blockedWindow();
  assert.equal(installSafeStorage(win), true);
  win.localStorage.setItem('k', 'v');
  assert.equal(win.localStorage.getItem('k'), 'v', 'every later reader of window.localStorage gets the memory store');
  assert.equal(win.sessionStorage.getItem('none'), null);
});

test('L6: a saved entry with a prototype-named kit cannot stop the start screen, and the other songs still show', () => {
  for (const kit of ['toString', '__proto__', 'constructor']) {
    const win = workingWindow();
    const good = newPlayDoc(); good.id = 'good-song'; good.title = 'Good song';
    const bad = newPlayDoc(); bad.id = 'bad-song'; bad.title = 'Odd song'; bad.drum_kit = kit;
    const entries = [good, bad].map(song => ({ id: song.id, source: 'person', title: song.title, saved_at: new Date().toISOString(), song }));
    win.values.set('musiclab.saves.v1', JSON.stringify(entries));
    const { root, scheduler } = screen(win);
    const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
    flow._sparkAt = () => {};
    flow.libraryOpen = true;
    assert.doesNotThrow(() => flow.render(), kit);
    assert.match(root.innerHTML, /Good song/);
    assert.match(root.innerHTML, /Odd song/, 'the odd song is listed too, so it can be opened or moved to Trash');
  }
});

test('L6: icon names are looked up as own names only', () => {
  assert.throws(() => icon('toString'), /Unknown icon/);
  assert.throws(() => icon('__proto__'), /Unknown icon/);
  assert.match(icon('note'), /^<svg/);
});

test('L6: drum sounds named like built-ins are unknown sounds in the beat grid and the playhead, not a crash', () => {
  for (const patch of ['toString', '__proto__', 'constructor', 'valueOf']) {
    const notes = [{ id: 'odd', role: 'drums', step: 0, duration_steps: 1, velocity: .5, patch_id: patch, concrete: { midi_pitch: 36 }, provenance: 'jam_generated' },
      { id: 'kick', role: 'drums', step: 2, duration_steps: 1, velocity: .5, patch_id: 'kick', concrete: { midi_pitch: 36 }, provenance: 'jam_generated' }];
    const grid = beatGridFromNotes(notes, 16);
    assert.equal(grid.kick[1], 'jam_generated', `${patch}: the kick still shows`);
    assert.ok(Object.values(grid).every(lane => Array.isArray(lane)), `${patch}: every lane is still a row`);
    const head = advancePlayhead(null, { step: 0, events: notes, sounding: notes }, 64, 16);
    assert.ok(head.hits.every(hit => typeof hit === 'string'), `${patch}: only real lanes light (${head.hits.map(String)})`);
    const quiet = advancePlayhead(null, { step: 0, events: notes }, 64, 16);
    assert.ok(quiet.hits.every(hit => typeof hit === 'string'), patch);
  }
});

test('L6: an older saved song with such a drum sound still opens from Your songs', () => {
  const win = workingWindow();
  const { root, scheduler } = screen(win);
  const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
  flow._sparkAt = () => {};
  const song = newPlayDoc(); song.id = 'odd-drums'; song.title = 'Odd drums';
  song.notes.push({ id: 'odd', role: 'drums', step: 0, duration_steps: 1, velocity: .5, patch_id: 'toString', concrete: { midi_pitch: 36 }, provenance: 'user_placed' });
  recordAct(song, 'tap');
  win.values.set('musiclab.working.v1', JSON.stringify({ id: song.id, source: 'person', title: song.title, updated_at: new Date().toISOString(), song, drafts: [] }));
  flow._resumeWorking('odd-drums');
  assert.equal(flow.doc?.id, 'odd-drums');
  flow.stage = 'beat'; assert.doesNotThrow(() => flow.render());
  assert.match(root.innerHTML, /pf-lane/);
});
