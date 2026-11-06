import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { ensureSectionIds, extractSongMaterial } from "../../../static/js/theory/song_view.js";
import { loadPiece } from "../../../static/js/theory/save_store.js";

function setup() {
  const values = new Map(), session = new Map();
  const store = map => ({ getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) });
  globalThis.window = { localStorage: store(values), sessionStorage: store(session) };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null };
  flow.app = { scheduler: { setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {},
    clearMuteLayers() {}, setSpotlightRole() {}, unlock: async () => {}, previewSound() {}, stop() {} },
    _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  flow._tapNote(2, 61);
  const own = extractSongMaterial(flow.doc);
  flow.doc.song_cards = ensureSectionIds([
    { section_id: "source", bars: 2, material: own },
    { section_id: "finish", bars: 1, role_name: "Ending", fx: "beat_drop", material: own },
  ]);
  flow._compile(); flow.activeSongCard = 0;
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });

test("Shape add/remove preserve original ending, Undo identity and compiled saved round trip", async () => {
  const flow = setup();
  const original = structuredClone(flow._canonicalDoc().song_cards);
  const originalEvents = structuredClone(flow.app.compiledSong.events);
  await press(flow, "add-card");
  const added = flow.doc.song_cards[flow.activeSongCard];
  assert.ok(!original.some(c => c.section_id === added.section_id));
  assert.deepEqual(flow.doc.song_cards.at(-1), original.at(-1));
  assert.deepEqual(added.material.notes, original[0].material.notes);
  flow._undo();
  assert.deepEqual(flow.doc.song_cards, original);
  assert.deepEqual(flow.app.compiledSong.events, originalEvents);
  await press(flow, "add-card");
  const withAdded = structuredClone(flow.doc.song_cards);
  await press(flow, `remove-card:${flow.activeSongCard}`);
  assert.deepEqual(flow.doc.song_cards, original);
  flow._undo();
  assert.deepEqual(flow.doc.song_cards, withAdded);
  const beforeEvents = structuredClone(flow.app.compiledSong.events);
  flow._save();
  const saved = loadPiece(window.localStorage, flow.doc.id);
  assert.deepEqual(saved.song_cards, withAdded);
  flow._loadDocIntoFlow(saved);
  assert.deepEqual(flow.doc.song_cards, withAdded);
  assert.deepEqual(flow.app.compiledSong.events, beforeEvents);
});
