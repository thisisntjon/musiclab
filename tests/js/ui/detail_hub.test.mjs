import {songArcFromCapture} from '../../../static/js/theory/song_view.js';
// Detail arrives as three tiles: Beat, Tune, Backing. The depth is visible at a glance; the music keeps playing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: true, stopGeneration: 0, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, previewSound() {}, stop() { this.isPlaying = false; }, start() { this.isPlaying = true; }, seekToStep() {}, capturePerformance: () => null, activeJamBacking: () => null,
    masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {}; flow.liveHolds = new Map();
  flow._freshState();
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
  // Existing three-part songs remain supported; new onboarding has separate coverage.
  flow._finishPartEdit(); flow.doc.song_cards=songArcFromCapture(flow.doc.song_cards);
  delete flow.doc.song_path; flow._compile(); flow._go("song");
  flow.app.scheduler.isPlaying=true;
  await press(flow, "adjust-keep-as-is");
  flow.app.scheduler.start();          // the harness's fresh state stops the stub; in the app the music is playing here
  return flow;
}
const primary = html => [...html.replace(/<details[\s\S]*?<\/details>/g, "").matchAll(/<button[^>]*data-key="([^"]+)"/g)].map(m => m[1]).filter(k => !k.startsWith("journey:") && !["adjust-open", "legend-open", "optimize", "settings"].includes(k));

test("Detail arrives as three tiles with what each holds, at most five primary controls, music still playing", async () => {
  const flow = await song();
  await press(flow, "journey:detail");
  await press(flow, "adjust-keep-as-is");
  assert.equal(flow.detailHub, true);
  assert.equal(flow._journeyLevel(), "detail");
  const html = flow._renderDetailHub();
  for (const t of ["Beat", "Tune", "Backing"]) assert.match(html, new RegExp(`<p class="pf-song-card-title">${t}`));
  assert.match(html, /\d+ (note|notes), \d+ yours/, "the Tune tile says how many notes and how many are yours");
  const keys = primary(html);
  assert.ok(keys.length <= 5, keys.join(","));
  assert.deepEqual(keys.filter(k => k.startsWith("hub-open:")), ["hub-open:beat", "hub-open:tune", "hub-open:under"]);
  assert.equal(flow.app.scheduler.isPlaying, true);
});

test("Open goes to the right editor and the music carries on; Shape's Open on a part still goes straight to its notes", async () => {
  const flow = await song();
  await press(flow, "journey:detail"); await press(flow, "adjust-keep-as-is");
  await press(flow, "hub-open:beat");
  assert.equal(flow.stage, "beat"); assert.equal(flow.detailHub, false); assert.equal(flow.app.scheduler.isPlaying, true);
  await press(flow, "journey:detail");
  assert.equal(flow.detailHub, true, "coming back to Detail shows the tiles again");
  await press(flow, "hub-open:under"); assert.equal(flow.stage, "under");
  await press(flow, "journey:detail"); await press(flow, "hub-open:tune"); assert.equal(flow.stage, "tune");
  await press(flow, "journey:shape");
  await press(flow, "edit-card:1");
  assert.equal(flow.stage, "tune"); assert.equal(flow.detailHub, false, "a part's Open means its notes");
});

test("the render dispatcher shows the hub instead of the editor while the hub is up", async () => {
  const flow = await song();
  await press(flow, "journey:detail"); await press(flow, "adjust-keep-as-is");
  const root = { innerHTML: "", insertAdjacentHTML(w, h) { this.innerHTML = w === "afterbegin" ? h + this.innerHTML : this.innerHTML + h; }, querySelector: () => null, querySelectorAll: () => [] };
  flow.root = root; flow.render = PlayFlow.prototype.render;
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  globalThis.window.scrollX = 0; globalThis.window.scrollY = 0;
  flow.render();
  assert.match(root.innerHTML, /pf-detail-hub/);
  assert.doesNotMatch(root.innerHTML, /data-phrase-picture/, "the note picture waits behind its tile");
});
