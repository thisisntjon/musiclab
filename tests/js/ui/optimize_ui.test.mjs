// Make it nicer, on every level, with one Undo and a plain sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  const said = [];
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: true, stopGeneration: 0, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, previewSound() {}, stop() {}, start() {}, seekToStep() {}, capturePerformance: () => null, activeJamBacking: () => null, activeJamContext: () => null,
    masterBus: { piano: {}, disposed: false }, committedJamBacking: [{ role: "lead", concrete: { midi_pitch: 76 } }, { role: "lead", concrete: { midi_pitch: 79 } }] }, _announce: m => said.push(String(m)), _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {}; flow.liveHolds = new Map();
  flow._freshState(); flow.said = said;
  flow._keepMusicGoing = async function () { this.app.scheduler.isPlaying = true; return true; };
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
async function song() {
  const flow = setup();
  flow.stage = "jam";
  flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  await press(flow, "jam-pad:0");
  await press(flow, "capture-direction");
  await press(flow, "adjust-keep-as-is");
  return flow;
}

test("unnamed optimization is replaced by optional named previews without mutation", async () => {
  const flow = await song();
  for (const route of ['journey:shape','journey:detail','journey:share']) {
    await press(flow, route);
    assert.doesNotMatch(flow._journeyHtml(), /data-key="optimize"/);
    assert.match(flow._journeyHtml(), /data-key="adjust-open"/);
    const before = JSON.stringify(flow._canonicalDoc());
    const depth = flow.undoStack.length;
    await press(flow, 'optimize'); // legacy route is safe too
    assert.equal(JSON.stringify(flow._canonicalDoc()), before);
    assert.equal(flow.undoStack.length, depth);
    assert.match(flow._adjustHtml(), /Whole song/);
    await press(flow, 'adjust-keep-as-is');
  }
});
