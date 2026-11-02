// Phase 13.5: keep and share without loss. The song is still there tomorrow, and what plays is what exports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";
import { listSaves, savePiece, SLOT_COUNT } from "../../../static/js/theory/save_store.js";
import { songCardRanges } from "../../../static/js/theory/song_view.js";

function storage() {
  const values = new Map(), session = new Map();
  return { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
}
function setup(win = storage()) {
  globalThis.window = win;
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: false, stopGeneration: 0, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {},
    setSpotlightRole() {}, unlock: async () => {}, previewSound() {}, stop() {}, start() {}, capturePerformance: () => null, activeJamBacking: () => null,
    masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
async function songOf(flow) {
  flow.stage = "jam";
  flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  await press(flow, "jam-pad:0");
  await press(flow, "capture-direction");
  return flow;
}

test("save, reload the page and reopen: the song is identical and opens on Shape, ready to play", async () => {
  const win = storage();
  const flow = await songOf(setup(win));
  flow.doc.title = "River song";
  flow._save();
  const saved = structuredClone(flow._canonicalDoc());
  const later = setup(win);                     // a fresh page load over the same browser storage
  later._continue(saved.id);
  assert.equal(later.stage, "song");
  assert.deepEqual(later._canonicalDoc(), saved);
  assert.equal(later.doc.song_cards.length, 3, "the three-part song came back whole");
});

test("what plays is what exports: every part has sound and the arrangement is the sum of its parts", async () => {
  const flow = await songOf(setup());
  const song = flow.app.compiledSong, cards = flow.doc.song_cards;
  const ranges = songCardRanges(cards, 64, song.bpm, 16);
  assert.equal(song.total_steps, ranges.at(-1).end_step, "arrangement length equals the parts' total");
  for (const r of ranges) {
    const inRange = song.events.filter(e => e.step >= r.start_step && e.step < r.end_step && (e.velocity ?? 1) > 0);
    assert.ok(inRange.length > 0, `part ${r.index + 1} has sound`);
  }
  assert.ok(song.events.filter(e => e.step >= ranges.at(-1).start_step).some(e => String(e.id).startsWith("fx-roll-")), "the ending is in the export");
});

test("when all spots are full, Swap oldest replaces only the oldest song after two presses", async () => {
  const win = storage();
  const flow = await songOf(setup(win));
  for (let i = 0; i < SLOT_COUNT; i++) savePiece(win.localStorage, { ...structuredClone(flow._canonicalDoc()), id: `old-${i}`, title: `Old ${i}` }, { now: `2026-01-0${i + 1}T00:00:00Z` });
  flow.doc.title = "New song";
  flow._save();
  assert.equal(flow.slotsFull, true);
  const html = flow._renderKeep();
  assert.match(html, /Download audio/);
  const oldest = html.slice(0, html.indexOf("Or pick one")).match(/data-key="replace:(old-\d)"/)?.[1];
  assert.equal(oldest, "old-0");
  await press(flow, `replace:${oldest}`);
  assert.ok(listSaves(win.localStorage).some(s => s.id === "old-0"), "the first press only arms");
  await press(flow, `replace:${oldest}`);
  const ids = listSaves(win.localStorage).map(s => s.id).sort();
  assert.deepEqual(ids, ["old-1", "old-2", "old-3", "old-4", "old-5", flow.doc.id].sort());
});

test("the Share screen keeps its primary controls to five", async () => {
  const flow = await songOf(setup());
  flow.stage = "keep";
  const html = flow._renderKeep();
  const visible = html.replace(/<details[\s\S]*?<\/details>/g, "");
  const buttons = [...visible.matchAll(/<button[^>]*data-key="([^"]+)"/g)].map(m => m[1]).filter(k => !k.startsWith("journey:") && !["adjust-open", "legend-open"].includes(k));
  assert.deepEqual(buttons.sort(), ["back", "dl-sheet", "download", "play", "save"], `exactly five actions outside the folds: ${buttons}`);
  assert.match(html, /<details class="pf-name-ideas"[\s\S]*data-key="name:/, "name ideas are folded beside the name box");
  assert.match(html, /<details class="pf-demo-tools pf-share-more"[\s\S]*toggle-about[\s\S]*toggle-all-view/, "the drawer is behind More");
  assert.doesNotMatch(html, /data-key="download"[^>]*>[^<]*Download<\//, "the download says what it is");
});
