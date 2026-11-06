import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { ensureSectionIds } from "../../../static/js/theory/song_view.js";

function setup() {
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.window = { localStorage: storage, sessionStorage: storage };
  const flow = Object.create(PlayFlow.prototype), audio = [];
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: false, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {},
    clearMuteLayers() {}, setSpotlightRole() {}, start() { audio.push("start"); },
    stop() { audio.push("stop"); }, previewSound() { audio.push("preview"); } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  flow.doc.song_cards = ensureSectionIds([{ bars: 1 }, { bars: 1 }, { bars: 1, role_name: "Ending" }]);
  flow._compile(); flow.activeSongCard = 0; audio.length = 0;
  return { flow, audio };
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });

test("Song block source uses realized compiled seconds, including offsets and sub-half-step durations", () => {
  const { flow } = setup();
  flow.app.compiledSong = { bpm: 120, total_steps: 48, events: [
    { id: "offset", role: "lead", step: 2, start_sec: .3125, duration_steps: 20,
      duration_sec: .03125, provenance: "user_placed", velocity: .8 },
    { id: "hold", role: "lead", step: 15, start_sec: 1.875, duration_sec: .5, velocity: .7 },
    { id: "muted", role: "drums", step: 1, start_sec: .125, duration_sec: .1, velocity: 0 },
  ] };
  const model = flow._timelineModel();
  assert.equal(model.blocks.find(b => b.id === "offset").step, 2.5);
  assert.equal(model.blocks.find(b => b.id === "offset").length, .25);
  assert.equal(model.blocks.find(b => b.id === "offset").own, true);
  assert.equal(model.blocks.find(b => b.id === "hold").length, 4);
  assert.ok(!model.blocks.some(b => b.id === "muted"));
  assert.deepEqual(model.parts.map(p => [p.start_step, p.end_step]), [[0, 16], [16, 32], [32, 48]]);
});

test("selecting a Song block only selects: no music edit, editor navigation, Undo or audio", async () => {
  const { flow, audio } = setup();
  const before = structuredClone(flow._canonicalDoc()), undoLength = flow.undoStack.length;
  await press(flow, "select-card:1");
  assert.equal(flow.activeSongCard, 1);
  assert.equal(flow.stage, "song");
  assert.equal(flow.editingCard, null);
  assert.deepEqual(flow._canonicalDoc(), before);
  assert.equal(flow.undoStack.length, undoLength);
  assert.deepEqual(audio, []);
});

test("Shape exposes each selectable visual block and a single selected-part action panel", async () => {
  const { flow } = setup();
  await press(flow, "select-card:1");
  const html = flow._renderSong();
  for (const i of [0, 1, 2]) assert.match(html, new RegExp(`data-key="select-card:${i}"`));
  assert.equal((html.match(/class="[^"]*\bpf-song-block\b/g) || []).length, 3);
  assert.match(html, /data-key="play-card:1"/);
  assert.match(html, /data-key="melody-part:1"/);
  assert.doesNotMatch(html, /data-key="(?:play-card|melody-part):(?:0|2)"/);
  assert.match(html, /data-key="add-card"/);
  assert.match(html, /data-key="remove-card:1"/);
  assert.match(html, /data-key="part-mood:1:/);
  assert.doesNotMatch(html, /data-key="part-mood:(?:0|2):/);
  const moreStart = html.indexOf('pf-song-more');
  assert.ok(moreStart >= 0);
  assert.ok(html.indexOf('data-timeline') > moreStart, "the detailed timeline is in More");
});
