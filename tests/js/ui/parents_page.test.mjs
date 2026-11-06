// Phase 14.4: the parent surface. One line on the front door; "For parents" one press away inside Help; nothing leaves the app.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {}, fetch: async () => ({ok:true}), location: { href: "http://127.0.0.1/static/index.html" } };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: true, stopGeneration: 0, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, previewSound() {}, stop() { this.isPlaying = false; }, start() {}, seekToStep() {}, capturePerformance: () => null, activeJamBacking: () => null, onPlaybackEnded() {},
    masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "jam"; flow.trail = []; flow.confirm = {}; flow.liveHolds = new Map(); flow.comfort = {};
  flow._freshState();
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });

test("the front door says who it is for and what they keep, in one line", () => {
  const flow = setup();
  flow.stage = "start";
  const html = flow._renderStart();
  assert.match(html, /pf-for-parents">For kids and new players\. Your song stays on this device\. <button[^>]*data-key="parents"/);
  assert.match(html, /data-key="listen-circle"/, "the line sits beside Listen, not in a fold");
});

test("For parents is one press away inside Help on every level, opens in the same tab, and the music stops first", async () => {
  const flow = setup();
  assert.match(flow._helpPanelHtml(), /data-key="parents"[^>]*>For parents</);
  await press(flow, "parents");
  assert.equal(globalThis.window.location.href, new URL("../../../static/parents.html", import.meta.url).href);
  assert.equal(flow.app.scheduler.isPlaying, false, "a page change never leaves music playing behind it");
});

test("the parents page links only to its own app and names the stand-in sounds and what was tested", () => {
  const page = fs.readFileSync(new URL("../../../static/parents.html", import.meta.url), "utf8");
  const hrefs = [...page.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(hrefs.length > 0);
  for (const h of hrefs) assert.match(h, /^\.\/index\.html$/, `an off-app link: ${h}`);
  assert.match(page, /built-in sounds/);
  assert.match(page, /Tested in:/);
  assert.match(page, /not proven for every child/);
  assert.doesNotMatch(page, /must be fixed before release/, "the stale review line is gone");
});

test("Parents checks the local server mount after a missing root page", async () => {
  const flow = setup(), requested = [];
  window.fetch = async url => { requested.push(url); return {ok: requested.length === 2}; };
  await press(flow, "parents");
  assert.equal(requested.length, 2);
  assert.equal(window.location.href, requested[1]);
  assert.ok(requested[1].endsWith('/static/parents.html'));
});

test("Parents fetch failure leaves the current song page intact", async () => {
  const flow = setup(), before = window.location.href;
  let message = '';
  flow.app._announce = value => { message = value; };
  window.fetch = async () => { throw new Error('offline'); };
  await press(flow, "parents");
  assert.equal(window.location.href, before);
  assert.match(message, /Your song is still here/);
  assert.equal(flow.app.scheduler.isPlaying, false);
});
