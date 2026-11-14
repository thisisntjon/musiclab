// Open-release audit S4 and L7: Space presses a focused button like on any page. Two-switch
// scanning (Space moves, Enter presses) is a Help setting a person turns on, and it is remembered.
// Letter keys that play notes have an off switch (WCAG 2.1.4) and still work on a focused pad.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { COMFORT_DEFAULTS, COMFORT_KEY, loadComfort } from "../../../static/js/theory/comfort.js";
import { checkPrompt } from "../../../static/js/theory/plain_language.js";

function memory() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k), values };
}

function keyFlow({ comfort = {}, active, inRoot = true, items = [] } = {}) {
  const previous = globalThis.document;
  globalThis.document = { activeElement: active, getElementById: () => null, body: { classList: { toggle() {}, add() {} } } };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { style: {}, contains: el => inRoot && el === active };
  flow.scan = { index: -1 };
  flow.stage = "start";
  flow.comfort = { ...COMFORT_DEFAULTS, ...comfort };
  flow._scanItems = () => items;
  const press = (key, extra = {}) => {
    const seen = { prevented: false, stopped: false };
    flow._onKey({ key, preventDefault() { seen.prevented = true; }, stopImmediatePropagation() { seen.stopped = true; }, ...extra });
    return seen;
  };
  return { flow, press, restore: () => { globalThis.document = previous; } };
}

function button(key, extra = {}) {
  const el = { tagName: "BUTTON", dataset: { key }, focused: 0, clicks: 0, focus() { this.focused++; globalThis.document.activeElement = this; }, click() { this.clicks++; }, ...extra };
  return el;
}

test("scanning is off by default and the setting is remembered on this device", () => {
  assert.equal(COMFORT_DEFAULTS.switchScan, false);
  const storage = memory();
  assert.equal(loadComfort(storage).switchScan, false);
  storage.setItem(COMFORT_KEY, JSON.stringify({ switchScan: true }));
  assert.equal(loadComfort(storage).switchScan, true);
});

test("with scanning off, Space on a focused stage button is left to the browser, so the button is pressed", () => {
  const listen = button("listen-circle"), library = button("library-open");
  const { press, restore } = keyFlow({ active: listen, items: [listen, library] });
  try {
    const seen = press(" ");
    assert.equal(seen.prevented, false, "Space must reach the button so the browser presses it");
    assert.equal(seen.stopped, false);
    assert.equal(library.focused, 0, "focus does not jump to the next control");
  } finally { restore(); }
});

test("negative control: with scanning on, Space moves to the next control and is not a press", () => {
  const listen = button("listen-circle"), library = button("library-open");
  const { press, restore } = keyFlow({ comfort: { switchScan: true }, active: listen, items: [listen, library] });
  try {
    const seen = press(" ");
    assert.equal(seen.prevented, true);
    assert.equal(library.focused, 1, "Space moved to the next scan stop");
    assert.equal(listen.clicks, 0);
  } finally { restore(); }
});

test("Space is never taken from Stop sound, Calm or the play button while scanning is off", () => {
  for (const [active, inRoot] of [[button(undefined, { id: "btn-stop-sound", dataset: {} }), false], [button(undefined, { id: "btn-calm", dataset: {} }), false], [button("play"), true]]) {
    const next = button("undo");
    const { press, restore } = keyFlow({ active, inRoot, items: [active, next] });
    try {
      const seen = press(" ");
      assert.equal(seen.prevented, false, `${active.id || active.dataset.key} keeps its own Space`);
      assert.equal(next.focused, 0);
    } finally { restore(); }
  }
});

// Review of S4: with Switch scanning on, Space on Stop sound, Stop or Calm must still press it when the person
// put focus there (Tab or pointer). Only a stop the scan itself landed on moves on, or a switch user would be
// stuck on Calm, the first scan stop. Enter presses in both cases.
function stopControls() {
  return [[button(undefined, { id: "btn-stop-sound", dataset: {} }), false, false],
    [button(undefined, { id: "btn-calm", dataset: {} }), false, false], [button("play"), true, true]];
}

test("with scanning on, Space on a stop control reached by Tab is left to the browser, so it acts", () => {
  for (const [active, inRoot, playing] of stopControls()) {
    const next = button("undo");
    const { flow, press, restore } = keyFlow({ comfort: { switchScan: true }, active, inRoot, items: [active, next] });
    flow.app = { scheduler: { isPlaying: playing } };
    try {
      const seen = press(" ");
      assert.equal(seen.prevented, false, `${active.id || active.dataset.key} keeps its own Space`);
      assert.equal(next.focused, 0, "focus stays on the stop control");
    } finally { restore(); }
  }
});

test("with scanning on, a stop the scan landed on still moves on with Space, so scanning is never stuck", () => {
  for (const [active, inRoot, playing] of stopControls()) {
    const before = button("listen-circle"), next = button("undo");
    const { flow, press, restore } = keyFlow({ comfort: { switchScan: true }, active: before, inRoot, items: [before, active, next] });
    flow.app = { scheduler: { isPlaying: playing } };
    flow.root.contains = el => (el === active ? inRoot : true);
    try {
      press(" ");
      assert.equal(globalThis.document.activeElement, active, "the scan moved onto the stop control");
      const seen = press(" ");
      assert.equal(seen.prevented, true, `${active.id || active.dataset.key}: Space moves on from a scan stop`);
      assert.equal(next.focused, 1);
      assert.equal(active.clicks, 0);
      // Tab hands focus back to the person: Space on the same stop now presses it.
      press(" "); press(" "); press("Tab");
      assert.equal(globalThis.document.activeElement, active);
      assert.equal(press(" ").prevented, false, "after Tab, Space presses the stop control");
    } finally { restore(); }
  }
});

test("negative control: with scanning on, the play button while not playing is not a stop, so Space moves on", () => {
  const play = button("play"), next = button("undo");
  const { flow, press, restore } = keyFlow({ comfort: { switchScan: true }, active: play, items: [play, next] });
  flow.app = { scheduler: { isPlaying: false } };
  try {
    assert.equal(press(" ").prevented, true);
    assert.equal(next.focused, 1);
  } finally { restore(); }
});

test("with scanning off, Enter never acts on a stale scan stop when focus is elsewhere", () => {
  const stale = button("listen-circle");
  const { flow, press, restore } = keyFlow({ active: { tagName: "BODY", dataset: {} }, inRoot: false, items: [stale] });
  try {
    flow.scan.index = 0;
    const seen = press("Enter");
    assert.equal(stale.clicks, 0);
    assert.equal(seen.prevented, false);
  } finally { restore(); }
});

test("Enter still presses the focused control with scanning on or off", () => {
  for (const switchScan of [false, true]) {
    const focused = button("capture-direction");
    const { press, restore } = keyFlow({ comfort: { switchScan }, active: focused, items: [focused] });
    try { press("Enter"); assert.equal(focused.clicks, 1); } finally { restore(); }
  }
});

function jamKeyFlow(letterKeys, active) {
  const ctx = keyFlow({ comfort: letterKeys === undefined ? {} : { letterKeys }, active });
  ctx.flow.stage = "jam";
  ctx.played = [];
  ctx.flow._liveJamPads = () => "asdfghjk".split("").map((key, i) => ({ key, label: `Note ${i}` }));
  ctx.flow._playJamPad = (pad, source) => ctx.played.push(source);
  ctx.flow._shiftPadOctave = dir => ctx.played.push(`octave:${dir}`);
  return ctx;
}

test("letter keys play notes by default (negative control for the off switch)", () => {
  const ctx = jamKeyFlow(undefined, button("undo", { closest: () => null }));
  try { ctx.press("a"); ctx.press("x"); assert.deepEqual(ctx.played, ["key:a", "octave:1"]); } finally { ctx.restore(); }
});

test("with letter keys off, A to K, Z and X do nothing outside the pads (WCAG 2.1.4)", () => {
  const ctx = jamKeyFlow(false, button("undo", { closest: () => null }));
  try {
    const seen = ctx.press("a");
    ctx.press("z");
    assert.deepEqual(ctx.played, []);
    assert.equal(seen.prevented, false, "the letter is left alone");
  } finally { ctx.restore(); }
});

test("with letter keys off, the keys still play while a pad has focus", () => {
  const pad = button("jam-pad:0", { closest: sel => (sel.includes(".pf-jam-pads") ? {} : null) });
  const ctx = jamKeyFlow(false, pad);
  try { ctx.press("s"); assert.deepEqual(ctx.played, ["key:s"]); } finally { ctx.restore(); }
});

function helpFlow() {
  const storage = memory();
  globalThis.window = { localStorage: storage, sessionStorage: memory(), scrollTo() {} };
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  const flow = new PlayFlow({ scheduler: { isPlaying: false, stopGeneration: 0, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {}, stop() {} }, _announce() {}, _logSessionEvent() {} });
  flow.render = () => {};
  return { flow, storage };
}

test("Help has a Keys line, a Switch scanning setting and a Letter keys setting, in plain words", () => {
  const { flow } = helpFlow();
  const html = flow._renderComfort();
  const keys = html.match(/<p[^>]*data-help-keys[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(keys, "a Keys line in Help");
  const text = keys[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  for (const word of [/Space/, /Enter/, /A to K/, /Z and X/, /Escape/, /Switch scanning/]) assert.match(text, word);
  assert.deepEqual(checkPrompt(text).problems || [], [], text);
  assert.match(html, /data-key="comfort:switchScan"[^>]*aria-pressed="false"[^>]*>Switch scanning</);
  assert.match(html, /data-key="comfort:letterKeys"[^>]*aria-pressed="true"[^>]*>Letter keys</);
});

test("turning on Switch scanning in Help is saved and read back on the next visit", () => {
  const { flow, storage } = helpFlow();
  flow._toggleComfort("switchScan");
  assert.equal(flow.comfort.switchScan, true);
  assert.equal(loadComfort(storage).switchScan, true);
  assert.match(flow._renderComfort(), /data-key="comfort:switchScan"[^>]*aria-pressed="true"/);
});

const APP = readFileSync(new URL("../../../static/ui/app.js", import.meta.url), "utf8");

test("L7: the hidden backslash raw-mode shortcut is gone", () => {
  assert.doesNotMatch(APP, /key === "\\\\"/, "no keydown listener for the backslash key");
});

test("S4: the old studio's Space play toggle stays out of the play flow, so Space can press buttons and open summaries", () => {
  const handler = APP.match(/if \(ev\.code === "Space"[\s\S]{0,120}togglePlay\(\);/);
  assert.ok(handler, "the studio Space handler is still there for ?studio=1");
  const block = APP.slice(APP.lastIndexOf('window.addEventListener("keydown"', handler.index), handler.index);
  assert.match(block, /pf-mode/, "it returns early while the play flow is shown");
});
