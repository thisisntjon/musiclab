import {songArcFromCapture} from '../../../static/js/theory/song_view.js';
// Phase 13.4: a captured jam becomes a real song of itself, shaped with plain choices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  const loops = [];
  flow.app = { scheduler: { isPlaying: false, stopGeneration: 0, setCompiledSong() {}, setLoopRange(a, b) { loops.push([a, b]); }, setRepeatPlayback() {},
    clearMuteLayers() {}, setSpotlightRole() {}, unlock: async () => {}, previewSound() {}, stop() { this.isPlaying = false; }, start() { this.isPlaying = true; },
    capturePerformance: () => null, activeJamBacking: () => null, masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  flow.loops = loops;
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
const byPart = (flow, idx) => flow.app.compiledSong.events.filter(e => e.card === idx);
const layers = events => [...new Set(events.map(e => e.role))].sort().join(",");
const level = events => events.reduce((sum, e) => sum + (e.velocity ?? 0), 0);

async function captured() {
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

test("legacy arc retains at least two contrasting parts and an ending whose last bar differs from the main part", async () => {
  const flow = await captured();
  assert.equal(flow.stage, "song");
  const cards = flow.doc.song_cards;
  assert.ok(cards.length >= 3);
  const begin = byPart(flow, 0), main = byPart(flow, 1), end = byPart(flow, cards.length - 1);
  assert.ok(layers(begin) !== layers(main) || level(begin) !== level(main), "beginning and main part contrast");
  const bar = 16, mainLast = main.filter(e => e.step >= main[0].step + 3 * bar), endLast = end.filter(e => e.step >= end[0].step + 3 * bar);
  assert.notEqual(layers(mainLast) + level(mainLast).toFixed(2), layers(endLast) + level(endLast).toFixed(2), "the ending's last bar is different");
  assert.ok(end.some(e => String(e.id).startsWith("fx-roll-")), "the ending rolls into its last bar");
});

test("Calmer on part 2 changes only part 2, and Undo restores every part exactly", async () => {
  const flow = await captured();
  const before = flow.doc.song_cards.map((_, i) => structuredClone(byPart(flow, i)));
  await press(flow, "part-mood:1:calmer");
  const after = flow.doc.song_cards.map((_, i) => byPart(flow, i));
  assert.notDeepEqual(after[1], before[1], "part 2 changed");
  // The part before may lose only its lead-in (swell and breath) into a big part: its last 12 steps.
  const body = (events, i) => { const start = events[0]?.step ?? i * 64; return events.filter(e => e.step < start + 64 - 12); };
  for (const i of before.keys()) {
    if (i === 1) continue;
    if (i === 0) assert.deepEqual(body(after[0], 0), body(before[0], 0), "part 1 unchanged apart from its lead-in");
    else assert.deepEqual(after[i], before[i], `part ${i + 1} unchanged`);
  }
  await press(flow, "undo");
  for (const i of before.keys()) assert.deepEqual(byPart(flow, i), before[i]);
});

test("the ending's three choices each change the final bar, and Drum roll adds roll events", async () => {
  const flow = await captured();
  const last = flow.doc.song_cards.length - 1, seen = new Set();
  for (const style of ["quiet", "roll", "big"]) {
    await press(flow, `ending-style:${style}`);
    const end = byPart(flow, last), tail = end.filter(e => e.step >= end[0].step + 48);
    seen.add(layers(tail) + level(tail).toFixed(2));
    if (style === "roll") assert.ok(end.some(e => String(e.id).startsWith("fx-roll-")));
  }
  assert.equal(seen.size, 3);
});

test("Shape shows at most five primary controls beyond the part tiles", async () => {
  const flow = await captured();
  const html = flow._renderSong();
  const outsideTiles = html.replace(/<button\b[^>]*class="[^"]*\bpf-song-block\b[^>]*>[\s\S]*?<\/button>/g, "")
    .replace(/<section class="pf-song-selected\b[\s\S]*?<\/section>/g, "")
    .replace(/<details[\s\S]*<\/details>/, "");
  const keys = [...outsideTiles.matchAll(/data-key="([^"]+)"/g)].map(m => m[1]);
  assert.ok(keys.length <= 5, keys.join(", "));
  assert.ok(html.includes(`data-key="part-mood:${flow.activeSongCard || 0}:calmer"`));
  assert.ok(!html.includes('data-key="ending-style:roll"'), "ending choices appear only when ending is selected");
  await press(flow, `select-card:${flow.doc.song_cards.length - 1}`);
  assert.ok(flow._renderSong().includes('data-key="ending-style:roll"'));
});

test("opening a part while the song plays keeps the music going, looping that part", async () => {
  const flow = await captured();
  flow.app.scheduler.isPlaying = true;
  flow._keepMusicGoing = async function (token, loop) { this.app.scheduler.start(); this.loops.push(loop); return true; };
  await press(flow, "edit-card:1");
  assert.equal(flow.stage, "tune");
  assert.equal(flow.app.scheduler.isPlaying, true);
  assert.deepEqual(flow.loops.at(-1), [64, 128], "part 2's range");
});
