// Phase 13.2: across every screen, stopped or playing, no press is refused.
// Random presses are drawn from the controls each screen actually renders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";

// A refusal tells the person to do something else first instead of doing what they asked.
const REFUSAL = /(\bfirst[.,]|\bfirst,? then\b|\bbefore (joining|playing|keeping|adding)\b|can't|cannot|supports up to|release one|\bis full\b|load sounds|press play (before|or|in)\b|choose a .* first|go back to)/i;
// Real limits that are not refusals of a musical action.
const ALLOWED = [/^Music is locked/, /^No voice is set up here/];
// Controls that leave the app or open files; they need a real browser.
const SKIP = /^(dl-|download|open-project|hum|mic|speak-screen|print|import|file-)/;

function seeded(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = {
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }),
  };
  const root = {
    innerHTML: "",
    insertAdjacentHTML(where, html) { this.innerHTML = where === "afterbegin" ? html + this.innerHTML : this.innerHTML + html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
  };
  const scheduler = {
    isPlaying: false, liveNotes: new Map(), masterBus: { piano: {}, disposed: false }, audioCtx: { currentTime: 0 },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, preparePiano: async () => ({}), previewSound() {}, previewBar: () => true,
    noteOn() { return null; }, noteOff() {}, stop() { this.isPlaying = false; }, start() { this.isPlaying = true; },
    capturePerformance: () => null, activeJamBacking: () => null, activeJamContext: () => null,
    seekToStep() {}, toggleMuteLayer() {}, requestJamAnswer() { return true; }, setAutomaticAnswers() {}, freezeJamLead() {},
    jamAnswerStatus: () => "", jamAnswerReadiness: () => ({ state: "ready", label: "Answer this", message: "" }), cancelJamAnswer() {},
  };
  globalThis.document = { body: { classList: { toggle() {}, add() {} } }, activeElement: null,
    getElementById: id => id === "play-flow" ? root : null };
  const announced = [];
  const flow = new PlayFlow({ scheduler, _announce: m => announced.push(String(m)), _logSessionEvent() {} });
  flow._sparkAt = () => {};
  // In a real browser Play starts the scheduler through the transport button.
  flow._keepMusicGoing = async function () { this.app.scheduler.isPlaying = true; };
  return { flow, scheduler, announced };
}

const keysOf = html => [...html.matchAll(/<button[^>]*data-key="([^"]+)"[^>]*>/g)]
  .filter(m => !/\sdisabled/.test(m[0])).map(m => m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));

async function fuzz(seed, presses) {
  const { flow, scheduler, announced } = setup();
  const rand = seeded(seed), refusals = new Set(), errors = new Set(), visited = {};
  flow.explorationRandom = rand;                 // the opening style comes from the seed too, so a failure reproduces
  const press = key => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
  for (let i = 0; i < presses; i++) {
    try { flow.render(); } catch (error) { errors.add(`render ${flow.stage}: ${String(error.message).slice(0, 80)}`); }
    visited[flow.stage] = (visited[flow.stage] || 0) + 1;
    const keys = keysOf(flow.root.innerHTML).filter(k => !SKIP.test(k));
    const roll = rand();
    const before = announced.length, message = flow.jamMessage;
    try {
      if (roll < .08) scheduler.isPlaying = !scheduler.isPlaying;           // Stop and start from outside
      else if (roll < .2 && flow.stage === "jam") flow._playJamPad(Math.floor(rand() * 4), rand() < .5 ? "key:a" : null);
      else if (keys.length) await press(keys[Math.floor(rand() * keys.length)]);
      await Promise.resolve();
    } catch (error) { errors.add(String(error.message).slice(0, 80)); }
    const said = announced.slice(before);
    if (flow.jamMessage && flow.jamMessage !== message) said.push(flow.jamMessage);
    for (const m of said) if (REFUSAL.test(m) && !ALLOWED.some(a => a.test(m))) refusals.add(`${flow.stage}: ${m}`);
  }
  return { refusals: [...refusals], errors: [...errors], visited };
}

test("10,000 random presses across every screen, stopped and playing, never throw and are never refused", async () => {
  const found = new Set(), stats = { stages: {}, errors: new Set() };
  for (let seed = 1; seed <= 10; seed++) {
    const result = await fuzz(seed, 1000);
    result.refusals.forEach(r => found.add(r));
    result.errors.forEach(e => stats.errors.add(e));
    Object.entries(result.visited).forEach(([k, v]) => { stats.stages[k] = (stats.stages[k] || 0) + v; });
  }
  assert.deepEqual([...found], []);
  // A press that throws did not do what was asked, whatever it said.
  assert.deepEqual([...stats.errors], []);
  if (process.env.FUZZ_DEBUG) console.log(stats);
});
