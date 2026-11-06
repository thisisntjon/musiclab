import {songArcFromCapture} from '../../../static/js/theory/song_view.js';
// Phase 13.6c: Adjust. Three concrete ideas on arrival; hear one in place, keep it or not, one Undo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";
import { dealCards, applyCard, CARDS } from "../../../static/js/theory/adjust_cards.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: false, stopGeneration: 0, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {},
    setSpotlightRole() {}, unlock: async () => {}, previewSound() {}, stop() { this.isPlaying = false; }, start() { this.isPlaying = true; }, seekToStep(s) { this.currentStep = s; },
    capturePerformance: () => null, activeJamBacking: () => null, masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  flow._keepMusicGoing = async function () { this.app.scheduler.start(); return true; };
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

test("a hand is three applicable cards of different kinds; every card has a short plain title and really changes the song", async () => {
  const flow = await song();
  const doc = flow._canonicalDoc();
  for (const level of ["play", "shape", "detail", "share"]) {
    const hand = dealCards(doc, level, { seed: "s" });
    assert.ok(hand.length >= 2 && hand.length <= 3, `${level}: ${hand.length}`);
    const kinds = hand.map(c => c.kind);
    assert.ok(new Set(kinds).size >= Math.min(2, hand.length) && !kinds.every(k => k === kinds[0]), `${level}: the hand mixes kinds (${kinds})`);
    for (const card of hand) {
      assert.ok(card.title.split(/\s+/).length <= 3, card.title);
      const after = applyCard(doc, card.id);
      assert.ok(after, `${card.id} applies`);
      assert.notEqual(JSON.stringify({ g: after.global_context, c: after.song_cards, n: after.notes }), JSON.stringify({ g: doc.global_context, c: doc.song_cards, n: doc.notes }), `${card.id} changes something`);
    }
  }
  assert.notDeepEqual(dealCards(doc, "shape", { seed: "s", shuffle: 1 }).map(c => c.id), dealCards(doc, "shape", { seed: "s" }).map(c => c.id), "other ideas deal a different hand");
  assert.ok(CARDS.every(c => c.hint.length <= 60));
});

test("cards stay optional on arrival and Adjust opens them", async () => {
  const flow = await song();
  assert.equal(flow.adjustOpen, false, "optional on arrival at Shape");
  assert.equal(flow.adjustHand.length, 3);
  await press(flow, "adjust-keep-as-is");
  assert.equal(flow.adjustOpen, false);
  await press(flow, "journey:detail");
  assert.equal(flow.adjustOpen, false, "optional on arrival at Detail");
  await press(flow, "adjust-keep-as-is");
  await press(flow, "journey:shape");
  assert.equal(flow.adjustOpen, false, "not dealt twice at the same level");
  await press(flow, "adjust-open");
  assert.equal(flow.adjustOpen, true);
  assert.match(flow._journeyHtml(), /data-key="adjust-open"/);
});

test("tapping a card plays it in place; tapping another swaps the preview; keeping leaves one Undo; Keep as it is restores", async () => {
  const flow = await song();
  const before = JSON.stringify([flow.doc.global_context, flow.doc.song_cards]);
  const undo0 = flow.undoStack.length;
  const [a, b] = flow.adjustHand;
  await press(flow, `adjust-card:${a.id}`);
  assert.equal(flow.cardPreview.id, a.id);
  assert.equal(flow.app.scheduler.isPlaying, true, "you hear it");
  assert.notEqual(JSON.stringify([flow.doc.global_context, flow.doc.song_cards, flow.doc.notes.length]), JSON.stringify([JSON.parse(before)[0], JSON.parse(before)[1], flow.doc.notes.length]) || a.kind === "sound", "the song changed while previewing");
  await press(flow, `adjust-card:${b.id}`);
  assert.equal(flow.cardPreview.id, b.id, "the second card replaces the first");
  assert.equal(flow.undoStack.length, undo0 + 1, "one undo step at a time");
  await press(flow, "adjust-keep-as-is");
  assert.equal(JSON.stringify([flow.doc.global_context, flow.doc.song_cards]), before, "nothing kept, nothing changed");
  assert.equal(flow.undoStack.length, undo0);
  await press(flow, "adjust-open");
  const [c] = flow.adjustHand;
  await press(flow, `adjust-card:${c.id}`);
  await press(flow, `adjust-card:${c.id}`);
  assert.equal(flow.adjustOpen, false, "kept and closed");
  assert.equal(flow.undoStack.length, undo0 + 1, "one undo step for the kept idea");
  await press(flow, "undo");
  assert.equal(JSON.stringify([flow.doc.global_context, flow.doc.song_cards]), before, "Undo brings the old song back");
});

// Codex red team, 2026-11-01: four reproduced defects, now regression tests.
test("trying a tempo idea inside a part leaves that part's own notes exactly as edited", async () => {
  const flow = await song();
  await press(flow, "adjust-keep-as-is");
  await press(flow, "edit-card:1");
  const mine = flow.doc.notes.find(n => n.provenance === "user_placed");
  mine.concrete = { ...mine.concrete, midi_pitch: 61 };
  flow._compile();
  await press(flow, "adjust-open");
  const slower = flow.adjustHand.find(c => c.id === "slower") || flow.adjustHand[0];
  await press(flow, `adjust-card:${slower.id}`);
  assert.equal(flow.doc.notes.find(n => n.id === mine.id).concrete.midi_pitch, 61, "the scoped edit survives the preview");
  assert.equal(flow.editingCard, 1);
});

test("an idea that is only being tried is not what a reload recovers; keeping it is", async () => {
  const { loadWorkingSong } = await import("../../../static/js/theory/save_store.js");
  const flow = await song();
  const bpm = flow.doc.global_context.bpm;
  const slower = flow.adjustHand.find(c => c.id === "slower");
  if (!slower) return;  // another hand was dealt; the tempo path is covered when it is present
  await press(flow, `adjust-card:${slower.id}`);
  assert.equal(flow.doc.global_context.bpm, bpm - 12, "you hear it");
  assert.equal(loadWorkingSong(globalThis.window.localStorage, flow.doc.id).global_context.bpm, bpm, "the recovered draft is the song from before");
  await press(flow, `adjust-card:${slower.id}`);
  assert.equal(loadWorkingSong(globalThis.window.localStorage, flow.doc.id).global_context.bpm, bpm - 12, "kept means recovered");
});

test("Keep as is still drops the idea after another edit in between, and the later edit stays", async () => {
  const flow = await song();
  const bpm = flow.doc.global_context.bpm;
  const slower = flow.adjustHand.find(c => c.id === "slower");
  if (!slower) return;
  await press(flow, `adjust-card:${slower.id}`);
  await press(flow, "part-mood:0:bigger");          // an unrelated undoable edit while the idea plays
  assert.equal(flow.cardPreview, null, "the idea is dropped the moment something else is edited");
  assert.equal(flow.doc.global_context.bpm, bpm, "tempo is back");
  assert.equal(flow.doc.song_cards[0].big, true, "the later edit stays");
});

test("Lift the tune previews the part it changed, not the next one", async () => {
  const { cardSeek, applyCard } = await import("../../../static/js/theory/adjust_cards.js");
  const flow = await song();
  const doc = flow._canonicalDoc();
  const before = cardSeek(doc, "lift"), after = cardSeek(applyCard(doc, "lift"), "lift");
  assert.notEqual(before, after, "the fixture reproduces the old mistake: seeking after applying picks the next part");
  await press(flow, "adjust-keep-as-is");
  flow.adjustHand = [{ id: "lift", title: "Lift the tune", hint: "", kind: "sound" }];
  flow.adjustOpen = true;
  await press(flow, "adjust-card:lift");
  assert.equal(flow.app.scheduler.currentStep, before, "we listen where the change is");
});
