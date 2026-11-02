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

test("the button is on every level after Find", async () => {
  const flow = await song();
  assert.match(flow._journeyHtml(), /data-key="optimize"[^>]*>Make it nicer/);
  await press(flow, "journey:detail"); assert.match(flow._journeyHtml(), /data-key="optimize"/);
  await press(flow, "journey:share"); assert.match(flow._journeyHtml(), /data-key="optimize"/);
});

test("on Detail, one tap moves a wrong note to the chord, says so, leaves one Undo, and a second tap finds nothing to do", async () => {
  const flow = await song();
  await press(flow, "edit-card:1"); await press(flow, "adjust-keep-as-is");
  const mine = flow.doc.notes.find(n => n.provenance === "user_placed");
  mine.concrete = { ...mine.concrete, midi_pitch: 61 }; flow._compile();
  const depth = flow.undoStack.length, others = JSON.stringify(flow.doc.notes.filter(n => n.provenance !== "user_placed"));
  await press(flow, "optimize");
  const after = flow.doc.notes.find(n => n.id === mine.id);
  assert.notEqual(after.concrete.midi_pitch, 61);
  assert.equal(JSON.stringify(flow.doc.notes.filter(n => n.provenance !== "user_placed")), others, "the band's notes are untouched");
  assert.match(flow.said.at(-1), /moved to the chord|comes home/);
  assert.equal(flow.undoStack.length, depth + 1);
  await press(flow, "optimize");
  assert.match(flow.said.at(-1), /as near as I can get it/);
  assert.equal(flow.undoStack.length, depth + 1, "a tap that changes nothing adds no Undo step");
  await press(flow, "undo");
  assert.equal(flow.doc.notes.find(n => n.id === mine.id).concrete.midi_pitch, 61);
  assert.equal(flow.app.scheduler.isPlaying, true, "the music never stopped");
});

test("on Shape, one tap gives a flat song a calmer start and a real ending", async () => {
  const flow = await song();
  flow.doc.song_cards = flow.doc.song_cards.map(c => ({ ...c, under: true, big: false, fx: null })); flow._compile();
  await press(flow, "optimize");
  assert.equal(flow.doc.song_cards[0].under, false);
  assert.equal(flow.doc.song_cards.at(-1).fx, "drum_roll");
  assert.match(flow.said.at(-1), /calmer start/);
});

test("on Play, one tap moves the keys to the band's register", async () => {
  const flow = setup();
  flow.stage = "jam";
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  flow.doc.jam_session.live_keys = true; flow.jamPlayed = true;
  await press(flow, "optimize");
  assert.equal(flow.padOctave, 1);
  assert.match(flow.said.at(-1), /Keys moved up/);
});
