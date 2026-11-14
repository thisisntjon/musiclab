// Open-release audit S5, S9 (genre circle) and S10.
// S5: the jam screen's polite status line has one writer and changes only when the music changes.
// S9: the genre circle is a slider with a spoken value; the blend slider says where it is.
// S10: Read this screen reads the screen's own instructions and status, not the Help panel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";
import { startJam, setJamDirection } from "../../../static/js/theory/jam_session.js";
import { SCENE_CATALOGUE, SCENE_CATALOGUE_VERSION } from "../../../static/js/theory/scene_catalogue.js";
import { CIRCLE_SCENES } from "../../../static/js/theory/music_circle.js";
import { checkPrompt } from "../../../static/js/theory/plain_language.js";
import { parseHtml } from "./mini_dom.mjs";

const nameOf = id => SCENE_CATALOGUE.find(s => s.id === id).name;

function memory() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
}

function world() {
  globalThis.window = { localStorage: memory(), sessionStorage: memory(), scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }) };
  globalThis.document = { body: { classList: { toggle() {}, add() {}, contains: () => false } }, activeElement: null, getElementById: () => null, title: "MusicLab" };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
}

function circleDoc(sceneId = "house-v1") {
  const doc = setJamDirection(startJam(newPlayDoc({ now: 1, rand: () => .5 }), { patchId: "sampled_piano_v1" }),
    { showcase_version: 1, scene_catalogue: SCENE_CATALOGUE_VERSION, scene_id: sceneId });
  doc.jam_session.exploration_map = "catalogue-circle-v2";
  Object.assign(doc.jam_session, { live_keys: true, dynamic_keys: true });
  return doc;
}

/** A jam flow with a fake status line that records every change of its text. */
function statusFlow() {
  world();
  const scheduler = { isPlaying: true, stopGeneration: 0, audioCtx: { currentTime: 10 }, jamBridgeStage: null, pendingJamBacking: null, lastJamBackingCommit: null,
    activeJamBacking: () => ({ phraseContext: { sceneId: scheduler.reached } }), reached: "house-v1" };
  const flow = Object.create(PlayFlow.prototype);
  flow.app = { scheduler, _announce() {} };
  flow.stage = "jam";
  flow.doc = circleDoc();
  const changes = [];
  let text = "";
  const label = { get textContent() { return text; }, set textContent(v) { if (v !== text) changes.push(v); text = v; } };
  const circle = { attrs: {}, clientWidth: 340, querySelector: () => null, querySelectorAll: () => [], setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; } };
  const blend = { value: ".5", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); } };
  flow.root = { querySelector: s => s === "#pf-current-direction" ? label : s === "[data-music-circle]" ? circle : s === "[data-circle-blend]" ? blend : null, querySelectorAll: () => [] };
  // The status line is all this test watches; the other painters draw pictures it does not need.
  for (const name of ["_syncPartAudition", "_showBandAnswers", "_paintSheet", "_paintTimeline", "_paintListeningVisual", "_paintLiveScore", "_paintJamPads", "_paintJamAnswer", "_paintDirectionGlow"]) flow[name] = () => {};
  const frames = (playing, n = 20) => { for (let i = 0; i < n; i++) { flow.onTick(null, playing); flow._paintCircle(); } };
  return { flow, scheduler, changes, label, circle, blend, frames };
}

test("S5: while the band plays one style, the status line is written once, not on every frame", () => {
  const { changes, frames } = statusFlow();
  frames(true);
  assert.deepEqual(changes, [`Playing: ${nameOf("house-v1")}.`]);
});

test("S5: Stop changes the line once and it then stays still", () => {
  const { scheduler, changes, frames } = statusFlow();
  frames(true);
  scheduler.isPlaying = false;
  frames(false);
  assert.equal(changes.length, 2, JSON.stringify(changes));
  assert.equal(changes[1], `Ready: ${nameOf("house-v1")}.`);
});

test("S5: a new pick says Changing to X once, then Playing once it is heard (negative control: real changes still speak)", () => {
  const { flow, scheduler, changes, frames } = statusFlow();
  frames(true);
  flow.circleIntent = { id: "soul-v1", field: null, song: flow.doc.id, stop: 0 };
  frames(true);
  assert.equal(changes.at(-1), `Changing to ${nameOf("soul-v1")}.`);
  flow.circleIntent = null; flow.doc = circleDoc("soul-v1"); scheduler.reached = "soul-v1";
  frames(true);
  assert.deepEqual(changes, [`Playing: ${nameOf("house-v1")}.`, `Changing to ${nameOf("soul-v1")}.`, `Playing: ${nameOf("soul-v1")}.`]);
  assert.ok(changes.every(c => !/Boundary change|Scored blend/.test(c)));
  assert.equal(checkPrompt("Changing to it.").ok, true);
});

test("S9: the genre circle paints its value for screen readers as the style changes", () => {
  const { flow, circle, blend } = statusFlow();
  flow._paintCircle();
  assert.equal(circle.attrs["aria-valuetext"], nameOf("house-v1"));
  assert.equal(circle.attrs["aria-valuenow"], String(CIRCLE_SCENES.indexOf("house-v1")));
  assert.ok(blend.attrs["aria-valuetext"], "the blend slider says where it is, not just 0.5");
  assert.match(blend.attrs["aria-valuetext"], /Ska|Rocksteady|Reggae/);
});

function jamFlow() {
  world();
  const scheduler = { isPlaying: false, stopGeneration: 0, audioCtx: { currentTime: 0 }, liveNotes: new Map(), masterBus: { piano: {}, disposed: false },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {}, stop() {}, start() {}, activeJamBacking: () => null, capturePerformance: () => null };
  const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
  flow._freshState();
  flow.stage = "jam";
  flow.doc = circleDoc("ska-v1");
  return flow;
}

test("S9: the genre circle is a slider with a role description and a pointer to its keys and buttons", () => {
  const flow = jamFlow();
  const dom = parseHtml(flow._musicCircleHtml());
  const circle = dom.querySelector("[data-music-circle]");
  assert.equal(circle.getAttribute("role"), "slider");
  assert.ok(circle.getAttribute("aria-roledescription"));
  assert.equal(circle.getAttribute("aria-valuemin"), "0");
  assert.equal(circle.getAttribute("aria-valuemax"), String(CIRCLE_SCENES.length - 1));
  assert.equal(circle.getAttribute("aria-valuenow"), String(CIRCLE_SCENES.indexOf("ska-v1")));
  assert.equal(circle.getAttribute("aria-valuetext"), nameOf("ska-v1"));
  const described = circle.getAttribute("aria-describedby").split(/\s+/).map(id => dom.querySelector(`#${id}`));
  assert.ok(described.length && described.every(Boolean), "aria-describedby points at lines on the screen");
  const words = described.map(el => el.textContent.trim()).join(" ");
  assert.match(words, /arrow keys/);
  assert.match(words, /Choose without dragging/, "it names the button alternative");
  assert.equal(checkPrompt(described[0].textContent).ok, true, described[0].textContent);
  const blend = dom.querySelector("#pf-circle-blend");
  assert.ok(blend.getAttribute("aria-valuetext"), "the blend slider has words, not just a number");
});

test("S8: the Choose without dragging note and the key line read at grade 2", () => {
  const flow = jamFlow();
  const dom = parseHtml(flow._musicCircleHtml());
  const notes = dom.querySelectorAll("details p.pf-sub").map(p => p.textContent.trim()).filter(Boolean);
  assert.ok(notes.length >= 1);
  for (const note of notes) assert.deepEqual(checkPrompt(note).problems || [], [], note);
  const keyLine = flow._keySoundText?.();
  assert.ok(keyLine, "one function builds the key line");
  assert.doesNotMatch(keyLine, /active harmony/);
  assert.equal(checkPrompt(keyLine.replace(/^Your next keys: [^.]*\. /, "")).ok, true, keyLine);
});

function speakFrom(flow, html) {
  flow.root = parseHtml(html);
  let spoken = null;
  flow.speaker = { speak: text => { spoken = text; return true; } };
  flow._readingToast = () => {};
  flow._speakScreen();
  return spoken;
}

test("S10: Read this screen on the jam screen reads its instructions and status, never the Help panel", () => {
  const flow = jamFlow();
  flow.comfortOpen = true;
  const html = flow._renderListeningJam() + `<section aria-label="Help and access">${flow._helpPanelHtml()}</section>`;
  flow.root = parseHtml(html);
  flow.root.querySelector("#pf-current-direction").textContent = "Playing: Ska inspired.";
  let spoken = null;
  flow.speaker = { speak: text => { spoken = text; return true; } };
  flow._readingToast = () => {};
  flow._speakScreen();
  assert.match(spoken, /^Find your groove/);
  assert.match(spoken, /Drag the dot round\. Or use the arrow keys\./);
  assert.match(spoken, /Playing: Ska inspired\./);
  assert.match(spoken, /Touch a pad\./);
  assert.doesNotMatch(spoken, /Make this screen fit you/);
  assert.doesNotMatch(spoken, /Space or Enter/, "the Keys line in Help is not read as the screen");
});

test("S10: on a screen with no marked lines, it reads the heading, the instructions and the status line", () => {
  const flow = jamFlow();
  const spoken = speakFrom(flow, `<section class="pf-stage"><h1 class="pf-heading">Make your tune</h1>
    <p class="pf-sub">Turn to hear each group.</p><details><summary>More ways</summary><p class="pf-sub">Hidden extra.</p></details>
    <p class="pf-sub" data-mf-status role="status">Playing: Original.</p>
    <section><div class="pf-help-panel"><div class="pf-details" data-help-panel><p class="pf-say">Make this screen fit you. These stay set here.</p></div></div></section></section>`);
  assert.equal(spoken, "Make your tune Turn to hear each group. Playing: Original.");
});
