// Open-release audit B1 (IN RT-1): a shared song file must never put its own markup into the page.
// Every string field of a song gets a marker that becomes an element if it reaches the page unescaped. The song is
// opened as a file (with every field the file check accepts), and it is also loaded from saved songs with every field
// marked (older saved data or a changed entry is never checked), and each screen is drawn twice, as a click redraws.
// Screen and storage are stubbed as in earlier_song_hostile.test.mjs beside this file.
//   node --test tests/js/ui/release_hostile_strings.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { parseProjectJson, exportProjectJson, stashWorkingSong } from '../../../static/js/theory/save_store.js';

const MARK = n => `"'><i data-xss="${n}">x</i>`;
const RAW = /<i data-xss="(\d+)"/g;
const ESCAPED = /&lt;i data-xss=&quot;(\d+)&quot;/g;

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = {
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k),
      get length() { return values.size; }, key: i => [...values.keys()][i] ?? null },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {},
  };
  const html = [];
  const root = { markup: '', get innerHTML() { return this.markup; }, set innerHTML(v) { this.markup = v; html.push(v); },
    insertAdjacentHTML(where, h) { html.push(h); this.markup = where === 'afterbegin' ? h + this.markup : this.markup + h; },
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
  globalThis.document = { body: { classList: { toggle() {}, add() {}, contains: () => false } }, activeElement: null,
    getElementById: id => id === 'play-flow' ? root : null };
  const said = [];
  const flow = new PlayFlow({ scheduler, _announce: m => said.push(String(m)), _logSessionEvent() {} });
  flow._sparkAt = () => {};
  flow._keepMusicGoing = async function () { this.app.scheduler.isPlaying = true; return true; };
  flow.explorationRandom = () => .37;
  const press = key => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
  return { flow, html, said, scheduler, press, values };
}

/** Every screen and drawer that shows song data, drawn twice each. Returns every piece of markup written. */
function drawEverything(t) {
  const { flow, html } = t;
  const returned = [], failed = [];
  const draw = (name, fn) => { try { const out = fn(); if (typeof out === 'string') returned.push(out); } catch (error) { failed.push(`${name}: ${error.message}`); } };
  Object.assign(flow, { legendOpen: true, comfortOpen: true, sheetOpen: true, songMoreOpen: true, shareMoreOpen: true, demoToolsOpen: true,
    nameIdeasOpen: true, playedTakeOpen: true });
  const cards = Math.max(1, flow.doc?.song_cards?.length || 1);
  for (const stage of ['song', 'keep', 'tune', 'under', 'beat', 'jam']) {
    for (let card = 0; card < cards; card++) {
      flow.stage = stage; flow.activeSongCard = card;
      draw(`${stage} ${card}`, () => { flow.render(); flow.render(); });
    }
  }
  flow.stage = 'song';
  for (const helper of ['_timelineHtml', '_sheetSvg', '_journeyHtml', '_songOverviewHtml', '_legendHtml', '_helpPanelHtml', '_receiptHtml', '_bandHandHtml', '_keepLostHtml']) draw(helper, () => flow[helper]());
  flow.allAtOnce = true; draw('all at once', () => { flow.render(); flow.render(); }); flow.allAtOnce = false;
  flow.detailHub = true; flow.stage = 'tune'; draw('detail hub', () => flow.render()); flow.detailHub = false;
  flow.stage = 'start'; flow.libraryOpen = true; flow.librarySelection = flow.doc?.id;
  draw('library', () => { flow.render(); flow.render(); });
  flow.libraryOpen = false; draw('start', () => flow.render());
  return { markup: [...html, ...returned].join('\n'), failed };
}

const stringPaths = song => {
  const groups = new Map();
  (function walk(value, path) {
    if (Array.isArray(value)) value.forEach((child, i) => walk(child, [...path, i]));
    else if (value && typeof value === 'object') for (const key of Object.keys(value)) walk(value[key], [...path, key]);
    else if (typeof value === 'string') {
      // Every copy of one field (each note's patch, each part's name) is one group, so a field is tried as a whole.
      const field = path.map(p => typeof p === 'number' ? '*' : p).join('.');
      groups.set(field, [...(groups.get(field) || []), path]);
    }
  })(song, []);
  return [...groups.entries()].map(([field, paths], n) => ({ field, paths, n }));
};
const marked = (song, groups) => {
  const copy = JSON.parse(JSON.stringify(song));
  for (const group of groups) for (const path of group.paths) {
    let at = copy;
    for (const key of path.slice(0, -1)) at = at[key];
    at[path.at(-1)] = MARK(group.n);
  }
  return copy;
};
/** The largest set of marked fields that still loads: split any group of fields that fails until each failing one is alone. */
function keepWhile(song, groups, works) {
  let kept = [];
  const tryGroups = list => {
    if (!list.length) return;
    if (works(marked(song, [...kept, ...list]))) { kept = [...kept, ...list]; return; }
    if (list.length === 1) return;
    const half = Math.ceil(list.length / 2);
    tryGroups(list.slice(0, half)); tryGroups(list.slice(half));
  };
  tryGroups(groups);
  return kept;
}

const exampleSong = () => JSON.parse(readFileSync(new URL('../../../examples/three-beat-song.musiclab.json', import.meta.url), 'utf8')).song;
async function keptTakeSong() {
  const t = setup();
  await t.press('listen-circle');
  t.scheduler.capturePerformance = () => t.scheduler.isPlaying ? { version: 1, source_song_id: t.flow.doc.id, start: 0, end: 9.6, bpm: 100, bars: 4, events: [
    { time: 0, duration: .5, occurrence: 1, event: { id: 'band-0', role: 'bass', patch_id: 'clean_bass', provenance: 'jam_generated', velocity: .6, duration_sec: .5, concrete: { midi_pitch: 40 } } },
    ...Array.from({ length: 8 }, (_, i) => ({ time: 1 + i * .3, duration: .25, occurrence: i + 2,
      event: { id: `own-${i}`, source_note_id: `own-${i}`, role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .85, duration_sec: .25, concrete: { freq_hz: 440 * 2 ** ((60 + i - 69) / 12) } } }))] } : null;
  await t.press('capture-direction');
  const song = JSON.parse(JSON.stringify(t.flow._canonicalDoc()));
  song.song_cards = (song.song_cards || []).map((card, i) => ({ ...card, role_name: card.role_name || `Part ${i + 1}` }));
  return song;
}

const fileText = song => exportProjectJson(song);
async function openAsFile(song) {
  const t = setup();
  const text = fileText(song);
  await t.flow._importProjectFile({ size: text.length, text: async () => text });
  return t;
}
async function loadFromSavedSongs(song) {
  const t = setup();
  stashWorkingSong(globalThis.window.localStorage, song);
  t.flow._continue(song.id);
  return t;
}
const opened = t => Boolean(t.flow.doc) && /^Opened /.test(t.flow.saveMessage || '');

function rawMarkers(markup) { return [...markup.matchAll(RAW)].map(m => Number(m[1])); }
function escapedMarkers(markup) { return new Set([...markup.matchAll(ESCAPED)].map(m => Number(m[1]))); }
const named = (groups, numbers) => [...new Set(numbers)].map(n => groups.find(g => g.n === n)?.field || n);

test('the marker check sees markup that is not escaped (control)', () => {
  assert.deepEqual(rawMarkers(`<span>${MARK(7)}</span>`), [7]);
  assert.deepEqual(rawMarkers(`<span>${MARK(7).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</span>`), []);
});

for (const [name, makeSong] of [['the example song', async () => exampleSong()], ['a kept take', keptTakeSong]]) {
  test(`${name}, opened as a file with a marker in every field the file check accepts, never shows the marker as markup`, async ctx => {
    const song = await makeSong();
    const groups = stringPaths(song);
    const accepted = keepWhile(song, groups, candidate => parseProjectJson(fileText(candidate)).ok);
    const hostile = marked(song, accepted);
    const t = await openAsFile(hostile);
    assert.ok(opened(t), `the marked file opens: ${t.flow.saveMessage}`);
    const { markup, failed } = drawEverything(t);
    assert.deepEqual(failed.filter(f => /^(song|keep|library|start)/.test(f)), [], 'the main screens draw');
    assert.deepEqual(named(accepted, rawMarkers(markup)), [], 'no field reaches the page as markup');
    const shown = escapedMarkers(markup);
    const title = accepted.find(g => g.field === 'title');
    assert.ok(title && shown.has(title.n), 'the marked title was drawn, as text');
    assert.ok(shown.size >= 2, `marked fields were drawn as text (${shown.size})`);
    ctx.diagnostic(`${accepted.length} of ${groups.length} fields marked; ${shown.size} drawn as text; not drawn here: ${failed.join(' | ') || 'none'}`);
  });

  test(`${name}, loaded from saved songs with a marker in every field, never shows the marker as markup`, async ctx => {
    const song = await makeSong();
    const groups = stringPaths(song);
    const loads = keepWhile(song, groups, candidate => { const t = setup(); stashWorkingSong(globalThis.window.localStorage, candidate);
      try { t.flow._continue(candidate.id); } catch (_) { return false; } return t.flow.doc?.id === candidate.id; });
    assert.ok(loads.some(g => g.field === 'song_cards.*.role_name'), 'the part names are marked');
    const hostile = marked(song, loads);
    const t = await loadFromSavedSongs(hostile);
    assert.equal(t.flow.doc?.id, hostile.id, 'the marked song loads');
    const { markup, failed } = drawEverything(t);
    assert.deepEqual(failed.filter(f => /^(song|keep|library|start)/.test(f)), [], 'the main screens draw');
    assert.deepEqual(named(loads, rawMarkers(markup)), [], 'no field reaches the page as markup');
    const roleName = loads.find(g => g.field === 'song_cards.*.role_name');
    assert.ok(escapedMarkers(markup).has(roleName.n), 'the marked part name was drawn, as text');
    ctx.diagnostic(`${loads.length} of ${groups.length} fields marked; ${escapedMarkers(markup).size} drawn as text; not drawn here: ${failed.join(' | ') || 'none'}`);
  });
}
