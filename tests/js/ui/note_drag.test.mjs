// Phase 13.6b, first part: drag a note and hear it change while the song plays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  globalThis.CSS = globalThis.CSS || { escape: s => String(s).replace(/[^\w-]/g, m => `\\${m}`) };
  const previews = [], compiles = [];
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: true, stopGeneration: 0, setCompiledSong() { compiles.push(1); }, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {},
    setSpotlightRole() {}, unlock: async () => {}, previewSound(s) { previews.push(s.midi); }, stop() {}, start() {}, capturePerformance: () => null, activeJamBacking: () => null,
    masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  flow.previews = previews; flow.compiles = compiles;
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
const picture = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 444, height: 210, right: 444, bottom: 210 }), setPointerCapture() {}, releasePointerCapture() {} };
const pointer = (x, y, id = 7, target = null) => ({ pointerId: id, clientX: x, clientY: y, button: 0, target: { closest: () => target } });

async function inDetail() {
  const flow = setup();
  flow.stage = "jam";
  flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  await press(flow, "jam-pad:0");
  await press(flow, "capture-direction");
  await press(flow, "edit-card:1");
  flow.tuneGrid.eventEditor = true;
  flow._renderEventTune();                      // sets the picture's pitch range
  return flow;
}

test("dragging a note up changes its pitch in the key, sounds it as it moves, and leaves one undo step", async () => {
  const flow = await inDetail();
  const note = flow.doc.notes.find(n => n.role === "lead");
  const { low, high } = flow.phraseRange;
  const yFor = midi => (high - midi + .5) * flow.phraseRange.rowHeight;
  const buttonFor = n => ({ dataset: { phraseNote: n.id }, getBoundingClientRect: () => ({ left: 0, right: 44, top: 0, bottom: 44 }) });
  const undoBefore = flow.undoStack.length, startPitch = note.concrete.midi_pitch, startStep = note.step;
  flow._beginNoteDrag(pointer(10, yFor(startPitch), 7, buttonFor(note)), picture);
  flow._moveNoteDrag(pointer(10, yFor(startPitch + 2)));
  flow._moveNoteDrag(pointer(10, yFor(startPitch + 5)));
  flow._endNoteDrag();
  const after = flow.doc.notes.find(n => n.id === note.id);
  assert.notEqual(after.concrete.midi_pitch, startPitch);
  assert.ok(flow._keyPitches().has(after.concrete.midi_pitch % 12), "the new pitch is in the key");
  assert.equal(after.step, startStep, "moving up does not move in time");
  assert.ok(flow.previews.length >= 2, "you hear it as it moves");
  assert.ok(flow.compiles.length >= 2, "the band plays the change while it moves");
  assert.equal(flow.undoStack.length, undoBefore + 1, "one undo step for the whole drag");
  await press(flow, "undo");
  assert.equal(flow.doc.notes.find(n => n.id === note.id).concrete.midi_pitch, startPitch);
});

test("dragging sideways snaps to the grid; dragging the right edge changes the length", async () => {
  const flow = await inDetail();
  const note = flow.doc.notes.find(n => n.role === "lead");
  const { low, high, stepCount } = flow.phraseRange, y = (high - note.concrete.midi_pitch + .5) * flow.phraseRange.rowHeight;
  const colW = 444 / stepCount;
  const buttonFor = n => ({ dataset: { phraseNote: n.id }, getBoundingClientRect: () => ({ left: 0, right: 44, top: 0, bottom: 44 }) });
  const startStep = note.step;                   // the note object itself is edited in place
  flow._beginNoteDrag(pointer(2, y, 7, buttonFor(note)), picture);
  flow._moveNoteDrag(pointer(2 + 3 * colW, y));
  flow._endNoteDrag();
  const moved = flow.doc.notes.find(n => n.id === note.id);
  assert.equal(moved.step, startStep + 3);
  assert.equal(moved.performance.offset_steps, 0, "on the grid");
  const edge = { dataset: { phraseNote: note.id }, getBoundingClientRect: () => ({ left: moved.step % stepCount * colW, right: moved.step % stepCount * colW + 44, top: 0, bottom: 44 }) };
  flow._beginNoteDrag(pointer(moved.step % stepCount * colW + 40, y, 8, edge), picture);
  assert.equal(flow.noteDrag.mode, "resize");
  flow._moveNoteDrag(pointer((moved.step % stepCount + 5) * colW, y, 8));
  flow._endNoteDrag();
  assert.equal(flow.doc.notes.find(n => n.id === note.id).duration_steps, 6);
});

test("a press on an empty spot adds a note there, in the key, and a drag with no change leaves no undo step", async () => {
  const flow = await inDetail();
  const count = flow.doc.notes.length, undoBefore = flow.undoStack.length;
  flow._beginNoteDrag(pointer(200, 60, 9, null), picture);
  flow._endNoteDrag();
  assert.equal(flow.doc.notes.length, count + 1);
  const added = flow.doc.notes.at(-1);
  assert.equal(added.provenance, "user_placed");
  assert.ok(flow._keyPitches().has(added.concrete.midi_pitch % 12));
  assert.equal(flow.undoStack.length, undoBefore + 1);
  const note = flow.doc.notes.find(n => n.role === "lead");
  const buttonFor = n => ({ dataset: { phraseNote: n.id }, getBoundingClientRect: () => ({ left: 0, right: 44, top: 0, bottom: 44 }) });
  flow._beginNoteDrag(pointer(5, 100, 10, buttonFor(note)), picture);
  flow._endNoteDrag();
  assert.equal(flow.undoStack.length, undoBefore + 1, "a tap without moving adds nothing to undo");
});

test("starting a drag on an existing note does not re-render, and the drag measures against the picture on screen", async () => {
  const flow = await inDetail();
  let renders = 0; flow.render = () => { renders++; };
  const note = flow.doc.notes.find(n => n.role === "lead");
  const buttonFor = n => ({ dataset: { phraseNote: n.id }, getBoundingClientRect: () => ({ left: 0, right: 44, top: 0, bottom: 44 }), setAttribute() {} });
  const stale = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }), setPointerCapture() {}, releasePointerCapture() {} };
  flow.root = { querySelector: sel => sel === "[data-phrase-picture]" ? picture : null, querySelectorAll: () => [] };
  const { low, high } = flow.phraseRange, startPitch = note.concrete.midi_pitch, startStep = note.step;
  const yFor = midi => (high - midi + .5) * flow.phraseRange.rowHeight;
  flow._beginNoteDrag(pointer(10, yFor(startPitch), 3, buttonFor(note)), stale);
  assert.equal(renders, 0, "no re-render mid-gesture");
  flow._moveNoteDrag(pointer(10, yFor(startPitch) - 2 * flow.phraseRange.rowHeight, 3));
  flow._endNoteDrag();
  const after = flow.doc.notes.find(n => n.id === note.id);
  assert.ok(after.concrete.midi_pitch > startPitch && after.concrete.midi_pitch < startPitch + 12, `moved up a little, got ${after.concrete.midi_pitch}`);
  assert.equal(after.step, startStep, "a vertical drag keeps its place in time even if the stored picture is stale");
});

// Codex red team, 2026-11-01.
test("a pitch-only drag keeps the note's timing feel: its offset, release and hold are untouched", async () => {
  const flow = await inDetail();
  const note = flow.doc.notes.find(n => n.role === "lead");
  note.performance = { version: 1, offset_steps: .37, released_at: 12.5, hold_id: "h1" };
  const { low, high } = flow.phraseRange, yFor = midi => (high - midi + .5) * flow.phraseRange.rowHeight, p0 = note.concrete.midi_pitch;
  const buttonFor = n => ({ dataset: { phraseNote: n.id }, getBoundingClientRect: () => ({ left: 0, right: 44, top: 0, bottom: 44 }), setAttribute() {} });
  flow._beginNoteDrag(pointer(10, yFor(p0), 7, buttonFor(note)), picture);
  flow._moveNoteDrag(pointer(10, yFor(p0 + 5), 7));
  flow._endNoteDrag();
  const after = flow.doc.notes.find(n => n.id === note.id);
  assert.notEqual(after.concrete.midi_pitch, p0);
  assert.deepEqual(after.performance, { version: 1, offset_steps: .37, released_at: 12.5, hold_id: "h1" });
});

test("a cancelled drag restores the note and leaves the undo stack as it was", async () => {
  const flow = await inDetail();
  const note = flow.doc.notes.find(n => n.role === "lead");
  const snapshot = JSON.stringify(note), depth = flow.undoStack.length;
  const { low, high } = flow.phraseRange, yFor = midi => (high - midi + .5) * flow.phraseRange.rowHeight;
  const buttonFor = n => ({ dataset: { phraseNote: n.id }, getBoundingClientRect: () => ({ left: 0, right: 44, top: 0, bottom: 44 }), setAttribute() {} });
  flow._beginNoteDrag(pointer(10, yFor(note.concrete.midi_pitch), 7, buttonFor(note)), picture);
  flow._moveNoteDrag(pointer(10, yFor(note.concrete.midi_pitch + 7), 7));
  flow._endNoteDrag({ cancelled: true });
  assert.equal(JSON.stringify(flow.doc.notes.find(n => n.id === note.id)), snapshot);
  assert.equal(flow.undoStack.length, depth);
});

test("the note editor opens on your own notes and names them apart from the band's", async () => {
  const flow = setup();
  flow.stage = "jam";
  flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  await press(flow, "jam-pad:0");
  await press(flow, "capture-direction");
  await press(flow, "edit-card:1");
  flow.tuneGrid.eventEditor = true;
  const mine = flow.doc.notes.find(n => n.provenance === "user_placed");
  assert.ok(mine, "the pad press was kept as your note");
  const html = flow._renderEventTune();
  assert.equal(flow.eventTuneBar, Math.floor(mine.step / 16));
  assert.equal(flow.eventTuneId, mine.id, "your note is the one selected");
  assert.match(html, /pf-phrase-own/);
  assert.match(html, /aria-label="[^"\n]*Your note \d+, beat/);
  assert.doesNotMatch(html, /aria-label="Selected note"/);
  await press(flow, `event-select:${mine.id}`);
  assert.match(flow._renderEventTune(), /Your note \d+ selected/);
  flow.eventTuneZoom = true;
  assert.match(flow._renderEventTune(), /Bar \d+ · your notes/);
  assert.match(html, /Your notes have a bright edge\./);
});
