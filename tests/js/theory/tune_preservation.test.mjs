import { needsExactTuneEditor } from "../../../static/js/theory/tune_model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";
import { startJam, contributeJam } from "../../../static/js/theory/jam_session.js";
import { tuneGridFromNotes, tuneGridForBars, notesFromTuneGrid, toggleTuneCell, toggleEndingCell, shapeEnding,
  switchEndingVersion, retimbreTuneGrid, hydrateTuneGridSources } from "../../../static/js/theory/tune_model.js";

function capturedJam() {
  let doc = startJam(newPlayDoc(), { patchId: "warm_keys" });
  for (const [pad, step] of [[0, 0], [1, 4], [2, 8]]) doc = contributeJam(doc, { pad, step });
  doc.notes[doc.notes.findIndex(note => note.id === "jam-user-warm_keys-0")].gesture = { velocity_shape: "soft", custom: [1, 2] };
  doc.notes.push({ id: "own-varied-note", role: "lead", patch_id: "warm_keys", step: 19, duration_steps: 3,
    velocity: .67, provenance: "hummed_confirmed", concrete: { midi_pitch: 65 }, extra_source_info: "keep" });
  return doc;
}

test("captured tune roundtrip and first manual edit preserve untouched note identities and metadata", () => {
  const doc = capturedJam();
  const original = structuredClone(doc.notes);
  const grid = tuneGridFromNotes(doc.notes);
  assert.deepEqual(notesFromTuneGrid(grid, doc.notes, doc.lead_patch_id), doc.notes);
  toggleTuneCell(grid, 4, 69);
  const edited = notesFromTuneGrid(grid, doc.notes, doc.lead_patch_id);
  for (const note of original.filter(note => note.role !== "lead" || note.step % 16 !== 4)) {
    assert.deepEqual(edited.find(item => item.id === note.id), note);
  }
  assert.equal(edited.filter(note => note.role === "lead" && note.step % 16 === 4 && note.concrete.midi_pitch === 69).length, 4);
  assert.deepEqual(doc.notes, original);
});

test("a short ending edit leaves all other source bars and their expression byte-identical", () => {
  const doc = capturedJam();
  const grid = tuneGridFromNotes(doc.notes, 2);
  toggleEndingCell(grid, 0, 72);
  const edited = notesFromTuneGrid(grid, doc.notes, doc.lead_patch_id, { endingOnly: true });
  for (const note of doc.notes.filter(note => note.role !== "lead" || note.step !== 16)) {
    assert.deepEqual(edited.find(item => item.id === note.id), note);
  }
  assert.equal(edited.find(note => note.role === "lead" && note.step === 16).concrete.midi_pitch, 72);
});

test("untouched generated notes retain tags; an intentional transformed cell is no longer band-replaceable", () => {
  const note = { id: "generated-lead", step: 48, duration_steps: 2, velocity: .51, role: "lead", patch_id: "warm_keys",
    provenance: "jam_generated", generated_by: "musiclab_jam", concrete: { midi_pitch: 60 }, sound_seed: { brightness: .4 } };
  let grid = tuneGridFromNotes([note]);
  assert.deepEqual(notesFromTuneGrid(grid, [note], "warm_keys"), [note]);
  grid = shapeEnding(grid, "climb");
  const transformed = notesFromTuneGrid(grid, [note], "warm_keys", { endingOnly: true });
  assert.equal(transformed[0].generated_by, undefined);
  assert.equal(transformed[0].provenance, "jam_generated");
  assert.notEqual(transformed[0].concrete.midi_pitch, note.concrete.midi_pitch);
});

test("adding a neighboring note does not rewrite an untouched held note", () => {
  const note = { id: "held", step: 0, duration_steps: 12, velocity: .7, role: "lead", patch_id: "warm_keys",
    provenance: "user_placed", concrete: { midi_pitch: 60 }, transition: "slide" };
  const grid = tuneGridFromNotes([note]);
  toggleTuneCell(grid, 4, 64, { endingFollowsMain: false });
  const edited = notesFromTuneGrid(grid, [note], "warm_keys");
  assert.deepEqual(edited.find(item => item.id === "held"), note);
});

test("editing one column does not retimbre untouched notes with different instruments", () => {
  const notes = [
    { id: "keys", step: 0, duration_steps: 2, velocity: .6, role: "lead", patch_id: "warm_keys", provenance: "user_placed", concrete: { midi_pitch: 60 } },
    { id: "pluck", step: 20, duration_steps: 3, velocity: .8, role: "lead", patch_id: "pluck_lead", provenance: "user_placed", concrete: { midi_pitch: 67 } },
  ];
  const grid = tuneGridFromNotes(notes);
  toggleTuneCell(grid, 8, 64);
  const edited = notesFromTuneGrid(grid, notes, "supersaw_stab");
  for (const note of notes) assert.deepEqual(edited.find(item => item.id === note.id), note);
  assert.ok(edited.filter(note => note.step % 16 === 8).every(note => note.patch_id === "supersaw_stab"));
});

const flowSource = readFileSync(new URL("../../../static/ui/stages/play_flow.js", import.meta.url), "utf8");
const actualShapes = [...flowSource.match(/const SHAPES = \[([\s\S]*?)\n\];/)[1].matchAll(/id: "([^"]+)"/g)].map(match => match[1]);
const endingSource = () => Array.from({ length: 4 }, (_, bar) => [0, 4, 12].map((col, index) => ({
  id: `jam-user-warm_keys-${bar * 16 + col}`, step: bar * 16 + col, duration_steps: 3, velocity: .61,
  role: "lead", patch_id: index === 1 ? "pluck_lead" : "warm_keys", pitch_lock_mode: "concrete",
  provenance: "user_placed", concrete: { midi_pitch: [60, 64, 67][index] },
  gesture: { tone: .4 }, original_detail: { captured: true },
}))).flat();
const byId = notes => [...notes].sort((a, b) => a.id.localeCompare(b.id));

for (const bars of [1, 2, 3, 4]) for (const shape of actualShapes) {
  test(`${shape}: ${bars}-bar ending restores captured identities, provenance and source details`, () => {
    const source = endingSource();
    const grid = tuneGridFromNotes(source, bars);
    const shaped = shapeEnding(grid, shape);
    const explored = notesFromTuneGrid(shaped, source, "warm_keys", { endingOnly: true });
    for (const note of source.filter(note => Math.floor(note.step / 16) !== bars - 1)) {
      assert.deepEqual(explored.find(item => item.id === note.id), note);
    }
    const restoredGrid = switchEndingVersion(JSON.parse(JSON.stringify(shaped)), "original");
    const restored = notesFromTuneGrid(restoredGrid, explored, "warm_keys", { endingOnly: true });
    assert.deepEqual(byId(restored), byId(source));
    assert.equal(new Set(restored.map(note => note.id)).size, restored.length);

    const changedSound = explored.map(note => ({ ...note, patch_id: "clean_bass" }));
    const retimbred = retimbreTuneGrid(shaped, "clean_bass");
    const withNewSound = notesFromTuneGrid(switchEndingVersion(retimbred, "original"), changedSound, "clean_bass", { endingOnly: true });
    assert.deepEqual(byId(withNewSound), byId(source.map(note => ({ ...note, patch_id: "clean_bass" }))));
  });
}

test("restoring an ending can recover a removed note's original identity after resize and reopen", () => {
  const source = endingSource();
  let grid = shapeEnding(tuneGridFromNotes(source, 2), "breathe");
  grid.ending[12] = null;
  let notes = notesFromTuneGrid(grid, source, "warm_keys", { endingOnly: true });
  assert.equal(notes.some(note => note.id === "jam-user-warm_keys-28"), false);
  grid = tuneGridForBars(grid, notes, 4);
  grid = retimbreTuneGrid(grid, "pluck_lead");
  notes = notes.map(note => ({ ...note, patch_id: "pluck_lead" }));
  const reopened = JSON.parse(JSON.stringify({ grid, notes }));
  grid = tuneGridForBars(reopened.grid, reopened.notes, 2);
  grid = switchEndingVersion(grid, "original");
  const restored = notesFromTuneGrid(grid, reopened.notes, "pluck_lead", { endingOnly: true });
  assert.deepEqual(byId(restored), byId(source.map(note => ({ ...note, patch_id: "pluck_lead" }))));
});

const stripOrigins = grid => JSON.parse(JSON.stringify(grid, (key, value) => key === "sourceNote" ? undefined : value));

test("legacy snapshot-less grids hydrate from actual notes before ending alternatives", () => {
  const source = endingSource();
  for (const bars of [1, 2, 3, 4]) {
    const legacy = stripOrigins(tuneGridFromNotes(source, bars));
    const before = structuredClone(legacy);
    const hydrated = hydrateTuneGridSources(legacy, source);
    assert.deepEqual(legacy, before);
    const shaped = shapeEnding(hydrated, "breathe");
    const explored = notesFromTuneGrid(shaped, source, "warm_keys", { endingOnly: true });
    const restored = notesFromTuneGrid(switchEndingVersion(shaped, "original"), explored, "warm_keys", { endingOnly: true });
    assert.deepEqual(byId(restored), byId(source));
  }
});

test("serialized legacy part material preserves saved histories and hydrates only known origins", () => {
  const source = endingSource();
  const grid = stripOrigins(tuneGridFromNotes(source, 2));
  grid.baseEnding = structuredClone(grid.ending);
  grid.exploredEnding = structuredClone(grid.ending);
  grid.exploredEnding[12].midi += 2;
  grid.endingVersion = "original";
  grid.endingStates = { 1: { baseEnding: structuredClone(grid.main), endingVersion: "original" } };
  const preservedOrigin = { ...source[0], id: "historical-origin" };
  grid.main[0].sourceNote = preservedOrigin;
  const reopened = JSON.parse(JSON.stringify({ song_cards: [{ bars: 2, material: { notes: source, tune_grid_state: grid } }] }));
  const material = reopened.song_cards[0].material;
  const hydrated = hydrateTuneGridSources(material.tune_grid_state, material.notes);
  assert.deepEqual(hydrated.main[0].sourceNote, preservedOrigin);
  assert.equal(hydrated.baseEnding[12].sourceNote.id, "jam-user-warm_keys-28");
  assert.equal(hydrated.exploredEnding[12].sourceNote, undefined);
  assert.equal(hydrated.exploredEnding[12].midi, grid.exploredEnding[12].midi);
  assert.equal(hydrated.endingStates[1].baseEnding[0].sourceNote.id, "jam-user-warm_keys-0");
  assert.equal(hydrated.endingStates[1].endingVersion, "original");
  assert.deepEqual(hydrateTuneGridSources(hydrated, material.notes), hydrated);
});


test("compact tune eligibility rejects hidden bar variations, fractional timing, overlap and stale saved cells", () => {
  const notes=[0,1,2,3].map(bar=>({id:`own-${bar}`,role:"lead",step:bar*16,duration_steps:4,
    patch_id:"warm_keys",concrete:{midi_pitch:60},provenance:"user_placed"}));
  assert.equal(needsExactTuneEditor(notes),false);
  const varied=structuredClone(notes);varied[1].concrete.midi_pitch=62;
  assert.equal(needsExactTuneEditor(varied),true);
  const fractional=structuredClone(notes);fractional[0].performance={version:1,offset_steps:.5};
  assert.equal(needsExactTuneEditor(fractional),true);
  const short=structuredClone(notes);short[0].duration_steps=.2;
  assert.equal(needsExactTuneEditor(short),true);
  const overlap=notes.flatMap(n=>[n,{...n,id:n.id+"b",step:n.step+2,concrete:{midi_pitch:64}}]);
  assert.equal(needsExactTuneEditor(overlap),true);
  const grid=tuneGridFromNotes(notes);grid.main[0].midi=72;
  assert.equal(hydrateTuneGridSources(grid,notes).eventEditor,true);
  assert.deepEqual(notesFromTuneGrid(tuneGridFromNotes(varied),varied),varied,"opening preserves originals");
});
