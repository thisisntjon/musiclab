import {songArcFromCapture} from '../../../static/js/theory/song_view.js';
// Phase 13.6b, part two: the timeline. The whole song on one axis; drag anywhere to play from there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  const seeks = [], loops = [];
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: false, stopGeneration: 0, setCompiledSong() {}, setLoopRange(a, b) { loops.push([a, b]); }, setRepeatPlayback() {}, clearMuteLayers() {},
    setSpotlightRole() {}, unlock: async () => {}, previewSound() {}, stop() { this.isPlaying = false; }, start() { this.isPlaying = true; }, seekToStep(s) { seeks.push(s); this.currentStep = s; },
    capturePerformance: () => null, activeJamBacking: () => null, masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  flow._keepMusicGoing = async function (token, loop) { this.app.scheduler.start(); loops.push(["start", loop]); return true; };
  flow.seeks = seeks; flow.loops = loops;
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
  // Existing three-part songs remain supported; new onboarding has separate coverage.
  flow._finishPartEdit(); flow.doc.song_cards=songArcFromCapture(flow.doc.song_cards);
  delete flow.doc.song_path; flow._compile(); flow._go("song");
  flow.app.scheduler.isPlaying=true;
  return flow;
}
const svgFor = m => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 46 + m.total * 6 + 8, height: 82 }), setPointerCapture() {}, releasePointerCapture() {} });

test("the timeline shows every part and lane of the whole song, with the person's notes outlined", async () => {
  const flow = await song();
  const m = flow._timelineModel();
  assert.equal(m.parts.length, flow.doc.song_cards.length);
  assert.deepEqual(m.lanes.map(l => l.id), ["drums", "bass", "chords", "tune"]);
  assert.ok(m.blocks.some(b => b.own), "the pad note is marked as the person's");
  assert.ok(m.blocks.some(b => b.lane === "tune") && m.blocks.some(b => b.lane === "drums"));
  const html = flow._renderSong();
  assert.match(html, /data-timeline/);
  assert.match(html, /pf-tl-block pf-part-tune own/);
  assert.match(html, /role="slider"/);
});

test("dragging on the timeline plays from there: stopped music starts, playing music jumps", async () => {
  const flow = await song();
  const m = flow._timelineModel(), svg = svgFor(m);
  const x = step => 46 + step * 6 + 3;
  await flow._beginScrub({ pointerId: 1, clientX: x(70), clientY: 20 }, svg);
  await Promise.resolve();
  assert.equal(flow.app.scheduler.isPlaying, true, "music starts when you grab the timeline while stopped");
  assert.deepEqual(flow.seeks.at(-1), 70);
  await flow._scrubTo({ pointerId: 1, clientX: x(100), clientY: 20 });
  assert.deepEqual(flow.seeks.at(-1), 100);
  await flow._scrubTo({ pointerId: 1, clientX: x(100), clientY: 20 });
  assert.equal(flow.seeks.filter(s => s === 100).length, 1, "no repeated seeks while the pointer stays in one step");
  flow._endScrub();
  assert.equal(flow.scrub, null);
  assert.match(flow._timelineLabel(70, m), /Main part, bar 1\./);
});

test("on Detail, seeking into another part opens that part at that bar; the arrow keys move a bar at a time", async () => {
  const flow = await song();
  await press(flow, "edit-card:0");
  assert.equal(flow.editingCard, 0);
  const m = flow._timelineModel();
  await flow._seekTo(m.parts[1].start_step + 16 + 2);
  assert.equal(flow.editingCard, 1, "the part under the pointer opens");
  assert.equal(flow.eventTuneBar, 1, "at the bar under the pointer");
  flow.app.scheduler.isPlaying = true; flow.playhead = { step: m.parts[1].start_step + 16 + 2 };
  const target = { hasAttribute: name => name === "data-timeline", tagName: "svg" };
  flow.root = { style: {}, contains: () => true, querySelector: () => null, querySelectorAll: () => [] };
  globalThis.document = { getElementById: () => null, activeElement: null, body: { classList: { toggle() {}, add() {} } } };
  const before = flow.seeks.length;
  await flow._onKey({ key: "ArrowRight", target, preventDefault() {}, ctrlKey: false, altKey: false, metaKey: false });
  assert.equal(flow.seeks.length, before + 1);
  assert.equal(flow.seeks.at(-1), m.parts[1].start_step + 32, "one bar to the right, on the bar line");
});

test("the painted playhead follows the music without a re-render", async () => {
  const flow = await song();
  const attrs = {}; let labelText = "";
  const head = { setAttribute: (k, v) => { attrs[k] = v; } };
  const svg = { querySelector: sel => sel === ".pf-tl-playhead" ? head : null, setAttribute: (k, v) => { attrs[k] = v; } };
  flow.root = { querySelector: sel => sel === "[data-timeline]" ? svg : sel === "[data-tl-label]" ? { get textContent() { return labelText; }, set textContent(v) { labelText = v; } } : null, querySelectorAll: () => [] };
  flow.app.scheduler.isPlaying = true; flow.playhead = { step: 32 };
  flow._paintTimeline();
  assert.equal(attrs.transform, `translate(${46 + 32 * 6} 0)`);
  assert.equal(attrs["aria-valuenow"], "3");
  assert.match(labelText, /bar/);
});

test("the compact tune editor also carries the timeline, so seeking into such a part never loses it", async () => {
  const flow = await song();
  await press(flow, "edit-card:1");
  flow.tuneGrid.eventEditor = false;
  assert.match(flow._renderTune(), /data-timeline/);
});
