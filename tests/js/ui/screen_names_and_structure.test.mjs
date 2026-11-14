// Open-release audit L8, L9, L10, L12 (app), L13, L14 and the S8 first-visit pool.
// Help is one name, one press away where the app points to it; titles and headings name each screen;
// the loading page shows no dead studio controls; the wheel labels never fade to unreadable grey.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";
import { startJam, setJamDirection } from "../../../static/js/theory/jam_session.js";
import { SCENE_CATALOGUE, SCENE_CATALOGUE_VERSION } from "../../../static/js/theory/scene_catalogue.js";
import { checkPrompt } from "../../../static/js/theory/plain_language.js";
import { parseHtml } from "./mini_dom.mjs";

const read = rel => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
const FLOW = read("static/ui/stages/play_flow.js");
const CSS_TEXT = read("static/css/studio.css");
const INDEX = read("static/index.html");
const APP = read("static/ui/app.js");
const PARENTS = read("static/parents.html");

function memory() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k), key: i => [...values.keys()][i] ?? null, get length() { return values.size; } };
}

function screenFlow() {
  globalThis.window = { localStorage: memory(), sessionStorage: memory(), scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {} };
  globalThis.document = { body: { classList: { toggle() {}, add() {}, contains: () => false } }, activeElement: null, getElementById: () => null, title: "MusicLab" };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  const scheduler = { isPlaying: false, stopGeneration: 0, audioCtx: { currentTime: 0 }, liveNotes: new Map(), masterBus: { piano: {}, disposed: false },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {}, stop() {}, start() {}, unlock: async () => {},
    activeJamBacking: () => null, capturePerformance: () => null };
  const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
  flow._freshState();
  flow.root = parseHtml("");
  for (const name of ["_syncWaterFlowDom", "_paintPlayhead", "_paintJamPads", "_paintJamAnswer", "_paintLiveScore", "_loadSoundsQuietly", "_paintCircle", "_paintMusicField"]) flow[name] = () => {};
  return flow;
}

function toJam(flow) {
  flow.stage = "jam";
  flow.doc = setJamDirection(startJam(newPlayDoc({ now: 1, rand: () => .5 }), { patchId: "sampled_piano_v1" }), { showcase_version: 1, scene_catalogue: SCENE_CATALOGUE_VERSION, scene_id: "ska-v1" });
  flow.doc.jam_session.exploration_map = "catalogue-circle-v2";
  Object.assign(flow.doc.jam_session, { live_keys: true, dynamic_keys: true });
  return flow;
}

const insideClosedDetails = el => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === "DETAILS") return true; return false; };

test("L12: the start screen calls the comfort panel Help and the reader Read this screen, as every other screen does", () => {
  const flow = screenFlow();
  flow.render();
  const settings = flow.root.querySelector('[data-key="settings"]');
  assert.match(settings.textContent.trim(), /^Help$/);
  assert.match(flow.root.querySelector('[data-key="speak-screen"]').textContent.trim(), /^Read this screen$/);
  assert.doesNotMatch(flow.root.textContent, /Settings/);
  flow.comfortOpen = true; flow.render();
  assert.match(flow.root.querySelector('[data-key="settings"]').textContent.trim(), /^Close help$/);
  assert.doesNotMatch(FLOW, /'Tune map'/, "the tune wheel is called the Tune wheel everywhere");
});

test("L14: For parents is a real link to the parents page, on the front door and in Help", () => {
  const flow = screenFlow();
  flow.render();
  for (const html of [flow.root.innerHTML, flow._helpPanelHtml()]) {
    const link = parseHtml(html).querySelector('[data-key="parents"]');
    assert.equal(link.tagName, "A");
    assert.match(link.getAttribute("href"), /parents\.html$/);
    assert.equal(link.textContent.trim(), "For parents");
  }
});

test("L14: pressing the For parents link never lets the browser leave before the music stops", async () => {
  const flow = screenFlow();
  let prevented = 0;
  window.fetch = async () => ({ ok: true });
  window.location = { href: "http://127.0.0.1/static/index.html" };
  const link = { tagName: "A", dataset: { key: "parents" }, focus() {} };
  await flow._onClick({ target: { closest: () => link }, preventDefault() { prevented++; } });
  assert.equal(prevented, 1, "the app stops the music first, then opens the page");
  assert.match(window.location.href, /parents\.html$/);
});

test("L14: the library screen has an h1 and every screen names itself in the page title", () => {
  const flow = screenFlow();
  flow.render();
  assert.equal(document.title, "MusicLab");
  flow.libraryOpen = true; flow.render();
  const h1 = flow.root.querySelector("h1");
  assert.ok(h1, "the library screen has an h1");
  assert.equal(h1.textContent.trim(), "Your songs");
  assert.equal(document.title, "Your songs — MusicLab");
  flow.libraryOpen = false; toJam(flow); flow.render();
  assert.equal(document.title, "Find your groove — MusicLab");
});

test("L14: the lock button keeps one name and says its state with aria-pressed alone", () => {
  const flow = screenFlow();
  let observer = null;
  globalThis.MutationObserver = class { constructor(cb) { observer = cb; } observe() {} };
  const lock = { attrs: { "aria-pressed": "false" }, innerHTML: "", getAttribute(k) { return this.attrs[k] ?? null; } };
  document.querySelector = () => null;
  document.getElementById = id => id === "btn-volume-lock" ? lock : null;
  flow._styleVolumeLock();
  assert.match(lock.innerHTML, /Lock volume/);
  lock.attrs["aria-pressed"] = "true"; observer();
  assert.match(lock.innerHTML, /Lock volume/);
  assert.doesNotMatch(lock.innerHTML, /Unlock/);
});

test("L8: on the jam wheel, Help sits at the top level, not inside Go deeper", () => {
  const flow = toJam(screenFlow());
  flow.render();
  const help = flow.root.querySelector('[data-key="settings"]');
  assert.ok(help, "a Help button on the jam screen");
  assert.equal(insideClosedDetails(help), false, "Help is not hidden inside a disclosure");
  assert.equal(flow.root.querySelectorAll('[data-key="settings"]').length, 1, "one Help button");
});

test("L8: when the full sounds fail, Load sounds again sits right beside the message", () => {
  const flow = toJam(screenFlow());
  flow.app.scheduler.loadingSession = { state: "failed", retry() {} };
  flow.pianoMessage = "Full sounds did not load.";
  flow.render();
  const retry = flow.root.querySelector('[data-key="sounds-retry"]');
  assert.ok(retry, "the retry button is on screen with Help closed");
  assert.equal(insideClosedDetails(retry), false);
  assert.doesNotMatch(FLOW, /Help can try again/, "the message names the button beside it");
});

test("L8: the parents page says where the keys and switch scanning are explained", () => {
  assert.doesNotMatch(PARENTS, /look in Help and settings/);
  assert.match(PARENTS, /Switch scanning/);
  assert.match(PARENTS, /Load sounds again/);
});

test("a ready bank after Stop removes the retired session's loading and handover text", () => {
  for (const message of ["Sound is on. Full sounds are on the way.", "Full sounds join at the next bar."]) {
    const flow = toJam(screenFlow());
    flow.pianoMessage = message;
    flow.app.scheduler.loadingSession = null;
    flow.render();
    assert.equal(flow.pianoMessage, "");
    assert.ok(!flow.root.textContent.includes(message));
  }
});

test("render preserves active loading, next-bar handover, failure/retry and unrelated messages", () => {
  for (const [state, message] of [
    ["loading", "Sound is on. Full sounds are on the way."],
    ["ready", "Full sounds join at the next bar."],
    ["failed", "Full sounds did not load. Press Load sounds again."],
    [null, "Sound loading cancelled. Your notes are preserved."],
  ]) {
    const flow = toJam(screenFlow());
    flow.pianoMessage = message;
    flow.app.scheduler.loadingSession = state ? { state } : null;
    flow.render();
    assert.equal(flow.pianoMessage, message);
    assert.ok(flow.root.textContent.includes(message));
    if (state === "failed") assert.ok(flow.root.querySelector('[data-key="sounds-retry"]'));
  }
  for (const bus of [{ piano: null, disposed: false }, { piano: {}, disposed: true }]) {
    const flow = toJam(screenFlow());
    flow.app.scheduler.masterBus = bus;
    flow.pianoMessage = "Sound is on. Full sounds are on the way.";
    flow.render();
    assert.match(flow.pianoMessage, /on the way/);
  }
});

function rule(selector) {
  const at = CSS_TEXT.lastIndexOf(`${selector} {`);
  assert.ok(at >= 0, `a rule for ${selector}`);
  return CSS_TEXT.slice(at, CSS_TEXT.indexOf("}", at));
}

test("L9: a wheel label under the marker is hidden, not faded to unreadable grey, and circle labels are at least 12px", () => {
  assert.match(rule('.pf-circle-family[data-near="true"]'), /visibility:\s*hidden/);
  assert.match(rule('.pf-mf-region[data-near="true"]'), /visibility:\s*hidden/);
  const size = Number(rule(".pf-circle-family").match(/font-size:\s*(\d+)px/)?.[1] ?? CSS_TEXT.match(/\.pf-circle-family \{[^}]*font-size:\s*(\d+)px/)[1]);
  assert.ok(size >= 12, `circle labels are ${size}px`);
});

test("L10: on a short screen (400% zoom) the top bar scrolls away instead of covering half the page", () => {
  const block = CSS_TEXT.match(/@media \(max-height:\s*450px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(block, "a short-screen rule");
  assert.match(block[1], /\.transport-bar\s*\{[^}]*position:\s*static/);
  assert.match(block[1], /scroll-padding-top:\s*0/);
});

test("L13: while the app loads, the old studio bar is hidden and the page says it is loading", () => {
  assert.match(INDEX, /<body[^>]*data-booting/);
  assert.match(INDEX, /id="boot-loading"[^>]*role="status"[^>]*>Loading MusicLab/);
  assert.match(CSS_TEXT, /body\[data-booting\] \.transport-bar,\s*body\[data-booting\] \.why-banner\s*\{\s*display:\s*none/);
  assert.match(CSS_TEXT, /body:not\(\[data-booting\]\) #boot-loading\s*\{\s*display:\s*none/);
  assert.match(APP, /removeAttribute\("data-booting"\)/);
});

test("S8: first visits open on a short list of friendly styles, and every one has whole-tune choices", async () => {
  const flow = screenFlow();
  const opened = new Set();
  flow._startInstrument = async function () { this.doc = startJam(this.doc, { patchId: "sampled_piano_v1" }); this.stage = "jam"; return true; };
  flow._acceptJamDoc = function (doc) { this.doc = doc; };
  flow.app.scheduler.start = () => {};
  for (let i = 0; i < 40; i++) {
    flow.stage = "start"; flow.explorationRandom = () => i / 40;
    await flow._onClick({ target: { closest: () => ({ dataset: { key: "listen-circle" }, focus() {} }) } });
    opened.add(flow.doc.jam_session.scene_id);
  }
  assert.ok(opened.size >= 4 && opened.size <= 14, `${opened.size} opening styles`);
  for (const id of opened) {
    assert.doesNotMatch(id, /metal|thrash|grime|trap|jungle|death|black/);
    assert.equal(checkPrompt(SCENE_CATALOGUE.find(s => s.id === id).name).ok, true, `${id} has a plain name`);
  }
});
