// A hosted copy is not this computer. Developer hooks (?selftest) run only on this computer, and nothing is sent to
// /api unless the local MusicLab server answers there. A static host answers 404, so no song leaves the device.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const APP = readFileSync(new URL("../../../static/ui/app.js", import.meta.url), "utf8");
const at = (href) => new URL(href);

test("?selftest runs only on this computer, never on a hosted copy", async () => {
  const { selftestAllowed } = await import("../../../static/ui/host_mode.js");
  for (const href of ["http://127.0.0.1:8765/?selftest", "http://localhost:8777/static/index.html?selftest=1",
    "http://[::1]:9000/static/index.html?selftest", "file:///C:/musiclab/static/index.html?selftest"]) {
    assert.equal(selftestAllowed(at(href)), true, href);
  }
  for (const href of ["https://musiclab.simoneresearch.com/static/index.html?selftest",
    "https://musiclab.example.workers.dev/static/index.html?selftest", "http://192.168.1.20:8765/?selftest",
    "https://127.0.0.1.example.com/?selftest", "http://127.0.0.1:8765/static/index.html"]) {
    assert.equal(selftestAllowed(at(href)), false, href);
  }
});

test("the app asks the gate before it loads the self-test, on both routes", () => {
  const loads = [...APP.matchAll(/import\("\.\/selftest\.js"\)/g)];
  assert.equal(loads.length, 2, "both the play flow and the studio route can load it");
  for (const m of loads) {
    const line = APP.slice(APP.lastIndexOf("\n", m.index) + 1, APP.indexOf("\n", m.index));
    assert.match(line, /selftestAllowed\(window\.location\)/, line.trim());
  }
  assert.doesNotMatch(APP, /params\.has\("selftest"\)/, "no ungated ?selftest check is left");
});

function fakeFetch(probe) {
  const calls = [];
  const impl = async (path, options = {}) => {
    calls.push({ path, method: options.method || "GET", body: options.body });
    if (path === "/api/patches") {
      if (probe === "offline") throw new Error("offline");
      return { ok: probe === 200, status: probe };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return { impl, calls };
}

test("on a static host the gate sends one GET probe and never a song", async () => {
  const { createApiGate } = await import("../../../static/ui/host_mode.js");
  for (const probe of [404, "offline"]) {
    const { impl, calls } = fakeFetch(probe);
    const api = createApiGate(impl);
    const song = JSON.stringify({ song: { schema_version: 1, title: "Mine" } });
    await assert.rejects(api("/api/songs", { method: "POST", body: song }), /Static fallback/);
    await assert.rejects(api("/api/compile", { method: "POST", body: song }), /Static fallback/);
    await assert.rejects(api("/api/songs/starter"), /Static fallback/);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), ["GET /api/patches"], String(probe));
    assert.ok(calls.every((c) => c.body === undefined), "nothing with a body went out");
  }
});

test("with the local MusicLab server the gate passes calls through (control)", async () => {
  const { createApiGate } = await import("../../../static/ui/host_mode.js");
  const { impl, calls } = fakeFetch(200);
  const api = createApiGate(impl);
  const res = await api("/api/songs", { method: "POST", body: "{}" });
  assert.equal(res.ok, true);
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), ["GET /api/patches", "POST /api/songs"]);
});

test("every /api call in the app goes through the gate", () => {
  const direct = [...APP.matchAll(/\bfetch\(\s*(?:["'`]\/api|direction === "undo" \? "\/api)/g)].map((m) => APP.slice(m.index, m.index + 40));
  assert.deepEqual(direct, [], "a direct fetch to /api can send a song to a static host");
  assert.ok((APP.match(/\bapiFetch\(/g) || []).length >= 20, "the studio's calls use apiFetch");
});

// The self-test must never take a person's saved songs, draft or settings out of real storage, even for a moment:
// closing the tab mid-run must lose nothing.
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

test("the self-test runs on its own storage and leaves real saves untouched throughout", async () => {
  const real = memoryStorage({ "musiclab.saves.v1": '[{"id":"mine"}]', "musiclab.working.v1": '{"id":"draft"}', "musiclab.comfort.v1": '{"bigger":true}' });
  const before = JSON.stringify([...real.map]);
  const session = memoryStorage();
  const snapshots = [];
  let release;
  const holdFetch = new Promise((r) => { release = r; });
  const win = {};
  Object.defineProperty(win, "localStorage", { configurable: true, enumerable: true, get: () => real });
  Object.defineProperty(win, "sessionStorage", { configurable: true, enumerable: true, get: () => session });
  const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage") };
  globalThis.window = win;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => win.localStorage });
  globalThis.document = { getElementById: () => null, activeElement: null, body: {} };
  globalThis.fetch = async () => {
    snapshots.push(JSON.stringify([...real.map]));
    await holdFetch;
    throw new Error("stop here");
  };
  try {
    const { runSelfTest } = await import("../../../static/ui/selftest.js");
    const flow = { comfort: {}, stage: "start", doc: null, _applyComfort() {}, _go() {}, render() {}, _loadDocIntoFlow() {}, _canonicalDoc: () => null };
    const app = { playFlow: flow, _logSessionEvent() {}, _listenForHum() {}, scheduler: { stop() {}, previewSound() {}, previewBar() {} } };
    const run = runSelfTest(app).catch(() => null);
    for (let i = 0; i < 50 && !snapshots.length; i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(snapshots.length, 1, "the self-test reached its first network check");
    assert.equal(snapshots[0], before, "real saves were still in place while the self-test ran");
    assert.notEqual(globalThis.localStorage, real, "inside the run, storage is a stand-in");
    release();
    await run;
    assert.equal(JSON.stringify([...real.map]), before, "real saves are byte-identical afterwards");
    assert.equal(globalThis.localStorage, real, "real storage is back after the run");
  } finally {
    release?.();
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
    if (saved.localStorage) Object.defineProperty(globalThis, "localStorage", saved.localStorage);
    else delete globalThis.localStorage;
  }
});
