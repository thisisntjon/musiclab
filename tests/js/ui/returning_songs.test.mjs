// The front door opens a dedicated library; one tile per song, at most three per page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { stashWorkingSong, savePiece, songLibrary } from '../../../static/js/theory/save_store.js';

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = {
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), key: i => [...values.keys()][i] ?? null, get length() { return values.size; } },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {},
  };
  const root = { innerHTML: '', insertAdjacentHTML() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: id => id === 'play-flow' ? root : null };
  const flow = new PlayFlow({ scheduler: { isPlaying: false, liveNotes: new Map(), setCompiledSong() {}, stop() {} }, _announce() {}, _logSessionEvent() {} });
  flow.libraryOpen = true;
  return { flow, storage: globalThis.window.localStorage };
}
const song = n => ({ id: `song-${n}`, title: `song ${n}`, notes: [{ id: `n${n}`, provenance: 'user_placed', source_note_id: `jam-live-${n}` }], song_cards: [], global_context: { bpm: 100 }, play_session: { acts_count: 1, acts: [{ kind: 'keep_direction' }] } });
const beforeMore = html => html.includes('class="pf-demo-tools"') ? html.slice(0, html.indexOf('class="pf-demo-tools"')) : html;

test('front door has one library entry and no duplicate song cards',()=>{
 const {flow,storage}=setup();savePiece(storage,song(1));flow.libraryOpen=false;
 const html=beforeMore(flow._renderStart());assert.match(html,/data-key="library-open"/);assert.doesNotMatch(html,/data-key="library-select:/);
 flow.libraryOpen=true;const library=flow._renderStart();assert.match(library,/data-key="library-close"/);assert.doesNotMatch(library,/Find your groove/);
});

test('with nothing saved, the library offers an honest empty state', () => {
  const { flow } = setup();
  assert.match(beforeMore(flow._renderStart()), /No songs here yet/);
  assert.doesNotMatch(beforeMore(flow._renderStart()), /data-key="library-select:/);
});

test('an unfinished song is visible in the library below New song', () => {
  const { flow, storage } = setup();
  assert.ok(stashWorkingSong(storage, song(1)));
  const open = beforeMore(flow._renderStart());
  assert.match(open, /Unfinished edits/);
  assert.match(open, /data-key="library-select:song-1"/);
  assert.ok(open.indexOf('data-key="listen-circle"') < open.indexOf('Your songs'), 'Listen stays first');
});

test('saved songs show before More', () => {
  const { flow, storage } = setup();
  assert.ok(savePiece(storage, song(1)).ok);
  assert.match(beforeMore(flow._renderStart()), /Your songs/);
  assert.match(beforeMore(flow._renderStart()), /data-key="library-select:song-1"/);
});

test('at most three songs, the rest a press away, and nothing listed twice', () => {
  const { flow, storage } = setup();
  for (let n = 1; n <= 5; n++) assert.ok(stashWorkingSong(storage, song(n)));
  const html = flow._renderStart(), open = beforeMore(html);
  assert.equal((open.match(/data-key="library-select:/g) || []).length, 3);
  assert.match(open, /data-key="more-saves"/);
  assert.equal((html.match(/data-key="library-select:/g) || []).length, 3, 'not also inside More');
});

test('saved checkpoint and newer draft share one selected tile with explicit version choice',()=>{
 const {flow,storage}=setup(),saved=song(1),draft=structuredClone(saved);draft.title='New title';
 savePiece(storage,saved);stashWorkingSong(storage,draft);flow.librarySelection=saved.id;
 const html=beforeMore(flow._renderStart());
 assert.equal((html.match(/data-key="library-select:song-1"/g)||[]).length,1);
 assert.match(html,/New title/);assert.match(html,/Open saved copy/);assert.match(html,/data-key="continue:song-1"/);
});

test('deleting the active identity waits if retaining live edits fails',()=>{
 const {flow,storage}=setup();flow.doc=song(1);savePiece(storage,flow.doc);
 let attempts=0;flow._retainBeforeSwitch=()=>{attempts++;return false;};flow.render=()=>{};
 flow._delete(flow.doc.id);flow._delete(flow.doc.id);
 assert.ok(attempts>0);assert.equal(songLibrary(storage).songs.length,1);assert.equal(songLibrary(storage,{trash:true}).songs.length,0);
});

test('the words name where the song is', async () => {
  const source = (await import('node:fs')).readFileSync(new URL('../../../static/ui/stages/play_flow.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /under More/);
});
