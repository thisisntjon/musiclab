// Phase 9a-4 (swipe-to-paint), 9a-6 (main part repeats), 9a-7 (hum keeps provenance).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beatGridFromNotes,
  notesFromBeatGrid,
  startPaint,
  applyPaint,
  emptyBeatGrid,
  toggleBeatCell,
  isPadPinned,
  rollGrooveDice,
  euclid,
  applyEuclidPreset,
  interpolateGridsMap,
  applyGridsSpot,
} from "../../../static/js/theory/beat_model.js";
import {
  tuneRows,
  tuneGridFromNotes,
  notesFromTuneGrid,
  toggleTuneCell,
  toggleEndingCell,
  tuneGridFromHum,
  TUNE_STEPS,
  mergeHumIntoTune,
  hasOwnTuneNotes,
  classifyTuneNoteMark,
  shapeEnding,
  switchEndingVersion,
  activeEndingShape,
  applyDejaVu,
  activeDecorator,
  decorateTuneNote,
  startTunePaint,
  applyTunePaint,
  cellIsInsideSustain,
} from "../../../static/js/theory/tune_model.js";
import { seedPulse } from "../../../static/js/theory/session_rules.js";

test("beat grid round-trips the starter pulse as seed_template", () => {
  const grid = beatGridFromNotes(seedPulse());
  assert.deepEqual(grid.kick, ["seed_template", null, null, null, "seed_template", null, null, null]);
  const notes = notesFromBeatGrid(grid);
  assert.equal(notes.filter((n) => n.patch_id === "kick").length, 8);
});

test("beat edits preserve untouched captured drum voices, expression and off-grid notes", () => {
  const notes = [
    { id: "own-snare", role: "drums", patch_id: "snare", step: 2, duration_steps: 3, velocity: .61, provenance: "user_placed", concrete: { midi_pitch: 38 } },
    { id: "own-open", role: "drums", patch_id: "hat_open", step: 4, duration_steps: 5, velocity: .43, provenance: "user_placed", concrete: { midi_pitch: 46 } },
    { id: "own-perc", role: "drums", patch_id: "perc", step: 6, duration_steps: 1, velocity: .7, provenance: "user_placed" },
    { id: "odd-clap", role: "drums", patch_id: "clap", step: 3, provenance: "user_placed" },
    { id: "later-variation", role: "drums", patch_id: "snare", step: 36, provenance: "user_placed" },
  ];
  const original = structuredClone(notes);
  const grid = beatGridFromNotes(notes);
  assert.deepEqual(notesFromBeatGrid(grid, notes), notes);
  toggleBeatCell(grid, "kick", 0);
  const edited = notesFromBeatGrid(grid, notes);
  for (const note of notes) assert.deepEqual(edited.find(item => item.id === note.id), note);
  assert.equal(edited.filter(note => note.patch_id === "kick").length, 4);
  assert.deepEqual(notes, original);
  assert.deepEqual(notesFromBeatGrid(beatGridFromNotes(edited), edited), edited);
});

test("drum fill is additive and removing it restores all prior source notes", () => {
  const notes = [
    ...seedPulse(),
    { id: "own-late-snare", role: "drums", patch_id: "snare", step: 58, velocity: .53, provenance: "user_placed" },
    { id: "source-perc", role: "drums", patch_id: "perc", step: 61, provenance: "jam_generated" },
  ];
  const grid = beatGridFromNotes(notes);
  const withFill = notesFromBeatGrid(grid, notes, { bar4Fill: true });
  for (const note of notes) assert.deepEqual(withFill.find(item => item.id === note.id), note);
  assert.ok(withFill.some(note => note.generated_by === "musiclab_beat_fill"));
  assert.deepEqual(notesFromBeatGrid(grid, withFill), notes);
});

test("separate drum lanes retain their voices and patterns only change their named lanes", () => {
  const notes = [
    { id: "own-snare", role: "drums", patch_id: "snare", step: 2, provenance: "user_placed" },
    { id: "band-clap", role: "drums", patch_id: "clap", step: 2, provenance: "jam_generated" },
  ];
  const grid = beatGridFromNotes(notes);
  assert.equal(grid.snare[1], "user_placed");
  assert.equal(grid.clap[1], "jam_generated");
  const rolled = rollGrooveDice(grid, { seed: 1 }).grid;
  const result = notesFromBeatGrid(rolled, notes);
  assert.deepEqual(result.find(item => item.id === "own-snare"), notes[0]);
  for (const lane of ["snare", "hat_open", "perc"]) {
    const standalone = emptyBeatGrid();
    toggleBeatCell(standalone, lane, 0);
    const written = notesFromBeatGrid(standalone);
    assert.equal(written.length, 4);
    assert.ok(written.every(note => note.patch_id === lane));
    const mapped = applyGridsSpot(standalone, "pocket");
    assert.deepEqual(mapped[lane], standalone[lane]);
  }
});

test("9a-4: one drag across 4 empty pads paints exactly 4 steps", () => {
  const grid = emptyBeatGrid();
  const g = startPaint(grid, "clap", 1);
  for (const s of [2, 3, 4]) applyPaint(grid, g, "clap", s);
  applyPaint(grid, g, "clap", 3); // passing a pad twice does nothing
  assert.deepEqual(grid.clap.map(Boolean), [false, true, true, true, true, false, false, false]);
  assert.ok(grid.clap.filter(Boolean).every((c) => c === "user_placed"));
});

test("9a-4: a drag that starts on a filled pad erases rather than toggling", () => {
  const grid = emptyBeatGrid();
  grid.hat = ["user_placed", "user_placed", null, "user_placed", null, null, null, null];
  const g = startPaint(grid, "hat", 0);
  for (const s of [1, 2, 3]) applyPaint(grid, g, "hat", s);
  assert.deepEqual(grid.hat.slice(0, 4), [null, null, null, null]);
});

test("9a-6: the main part repeats in bars 1-3; editing it updates all three; other parts untouched", () => {
  const drums = seedPulse();
  const grid = tuneGridFromNotes([]);
  toggleTuneCell(grid, 0, 60);
  toggleTuneCell(grid, 2, 64);
  const notes = notesFromTuneGrid(grid, drums);
  const lead = notes.filter((n) => n.role === "lead");
  for (const bar of [0, 1, 2]) {
    assert.deepEqual(lead.filter((n) => Math.floor(n.step / 16) === bar).map((n) => [n.step % 16, n.concrete.midi_pitch]), [[0, 60], [2, 64]]);
  }
  assert.deepEqual(notes.filter((n) => n.role === "drums"), drums);
  toggleTuneCell(grid, 2, 64); // tap again removes it everywhere
  const after = notesFromTuneGrid(grid, drums).filter((n) => n.role === "lead");
  assert.ok(after.every((n) => n.step % 16 === 0));
  assert.equal(TUNE_STEPS, 16); // Phase 9b: sixteenth-note columns, shown a page at a time
});

test("9a-7: hummed notes enter the grid with their own pitch and hummed_confirmed provenance", () => {
  const draft = [
    { step: 0, concrete: { midi_pitch: 65 } },
    { step: 4, concrete: { midi_pitch: 71 } }, // a note outside the easy five: kept, not moved
  ];
  const grid = tuneGridFromHum(draft);
  assert.deepEqual(grid.main.filter(Boolean).map((c) => [c.midi, c.provenance]), [[65, "hummed_confirmed"], [71, "hummed_confirmed"]]);
  const rows = tuneRows(0, "major", [71]);
  assert.ok(rows.includes(71) && rows.includes(60) && rows.length === 6);
  const lead = notesFromTuneGrid(grid).filter((n) => n.role === "lead");
  assert.ok(lead.every((n) => n.provenance === "hummed_confirmed"));
});

test("9a-7: adding a hummed tune never removes notes the person tapped", () => {
  const grid = tuneGridFromNotes([]);
  toggleTuneCell(grid, 0, 60);
  toggleTuneCell(grid, 3, 67);
  const hum = tuneGridFromHum([{ step: 0, concrete: { midi_pitch: 64 } }, { step: 4, concrete: { midi_pitch: 65 } }]);
  const { grid: merged, blocked } = mergeHumIntoTune(grid, hum);
  assert.deepEqual(merged.main[0], { midi: 60, provenance: "user_placed", duration_steps: 2 }); // tap kept
  assert.equal(merged.main[3].midi, 67);
  assert.equal(merged.main[4].provenance, "hummed_confirmed"); // hum filled the gap
  assert.equal(blocked, 1);
  assert.ok(hasOwnTuneNotes(grid));
});

test("9a-7: notes that land on the same step are counted, not silently lost", () => {
  const hum = tuneGridFromHum([0, 0, 1, 1].map((s, i) => ({ step: s, concrete: { midi_pitch: 60 + i } })));
  assert.equal(hum.main.filter(Boolean).length, 2);
  assert.equal(hum.dropped, 2);
});

test("9b: sixteenth notes from a hum all fit now (4 quick notes, 0 dropped)", () => {
  const hum = tuneGridFromHum([0, 1, 2, 3].map((s) => ({ step: s, concrete: { midi_pitch: 60 + s } })));
  assert.equal(hum.main.filter(Boolean).length, 4);
  assert.equal(hum.dropped, 0);
});


test("12a-1 (#6): rollGrooveDice spins new beats while keeping every user_placed pad pinned", () => {
  const grid = beatGridFromNotes(seedPulse());
  toggleBeatCell(grid, "clap", 3);
  toggleBeatCell(grid, "hat", 7);
  assert.equal(isPadPinned(grid, "clap", 3), true);
  assert.equal(isPadPinned(grid, "kick", 0), false);

  for (let seed = 0; seed < 12; seed++) {
    const res = rollGrooveDice(grid, { seed });
    assert.equal(res.grid.clap[3], "user_placed");
    assert.equal(res.grid.hat[7], "user_placed");
    assert.equal(res.lockedCount, 2);
  }
  const r0 = rollGrooveDice(grid, { seed: 0 });
  const r1 = rollGrooveDice(grid, { seed: 1 });
  assert.notEqual(r0.crateId, r1.crateId);
});

test("12a-2 (#7): euclid(k, n, rotation) produces Tresillo E(3,8) and Cinquillo E(5,8) and respects pins", () => {
  assert.deepEqual(euclid(3, 8, 0), [true, false, false, true, false, false, true, false]);
  assert.deepEqual(euclid(3, 8, 1), [false, true, false, false, true, false, false, true]);
  assert.equal(euclid(5, 8, 0).filter(Boolean).length, 5);
  assert.deepEqual(euclid(0, 8, 0), Array(8).fill(false));
  assert.deepEqual(euclid(8, 8, 0), Array(8).fill(true));

  const grid = emptyBeatGrid();
  toggleBeatCell(grid, "kick", 1);
  const next = applyEuclidPreset(grid, "bounce", { respectPins: true });
  assert.equal(next.kick[1], "user_placed");
  assert.equal(next.kick[0], "seed_template");
  assert.equal(next.kick[3], "seed_template");
  assert.equal(next.kick[6], "seed_template");
});

test("12a-3 (#8): Grids 2D map is monotone in density and Bar 4 turnaround fill leaves Bars 1-3 untouched", () => {
  const sparse = interpolateGridsMap(0.6, 0.4, 0.25);
  const dense = interpolateGridsMap(0.6, 0.4, 0.75);
  for (const lane of ["kick", "clap", "hat"]) {
    for (let s = 0; s < 8; s++) {
      if (sparse[lane][s]) assert.equal(dense[lane][s], true);
    }
  }
  const grid = emptyBeatGrid();
  toggleBeatCell(grid, "clap", 5);
  const spotted = applyGridsSpot(grid, "pocket", { respectPins: true });
  assert.equal(spotted.clap[5], "user_placed");

  const dryNotes = notesFromBeatGrid(spotted, [], { bar4Fill: false });
  const fillNotes = notesFromBeatGrid(spotted, [], { bar4Fill: true });
  assert.deepEqual(
    dryNotes.filter((n) => n.step < 48),
    fillNotes.filter((n) => n.step < 48)
  );
  assert.ok(fillNotes.some((n) => n.step === 58 && n.patch_id === "clap" && n.provenance === "user_placed"));
  assert.ok(fillNotes.some((n) => n.step === 63 && n.role === "drums"));
});

test("12b-1 (#2): applyDejaVu spins notes or rhythm while keeping user provenance", () => {
  const grid = tuneGridFromNotes([]);
  [[0, 60], [4, 64], [8, 67], [12, 69]].forEach(([c, m]) => toggleTuneCell(grid, c, m));
  const spinN = applyDejaVu(grid, "spin_notes", 3);
  assert.deepEqual(
    spinN.main.map((c, i) => (c ? i : -1)).filter((i) => i >= 0),
    [0, 4, 8, 12]
  );
  assert.deepEqual(
    spinN.main.filter(Boolean).map((c) => c.midi).sort((a, b) => a - b),
    [60, 64, 67, 69]
  );
  assert.ok(spinN.main.filter(Boolean).every((c) => c.provenance === "user_placed"));

  const spinR = applyDejaVu(grid, "spin_rhythm", 2);
  assert.deepEqual(
    spinR.main.filter(Boolean).map((c) => c.midi),
    [60, 64, 67, 69]
  );
});

test("12b-2 (#14): decorateTuneNote attaches slide, bounce, or sparkle transition and toggles off on repeat", () => {
  let grid = tuneGridFromNotes([]);
  toggleTuneCell(grid, 2, 60);
  toggleTuneCell(grid, 6, 67);
  grid = decorateTuneNote(grid, "slide");
  assert.equal(grid.main[6].transition, "slide");
  assert.equal(activeDecorator(grid), "slide");
  const notes = notesFromTuneGrid(grid);
  assert.equal(notes.find((n) => n.step === 6).transition, "slide");
  grid = decorateTuneNote(grid, "slide");
  assert.equal(grid.main[6].transition, undefined);
  assert.equal(activeDecorator(grid), null);
});

test("12b-3 (#15): shapeEnding snapshots baseEnding so switching shapes never drifts and toggles back on second press", () => {
  let grid = tuneGridFromNotes([]);
  [[0, 60], [4, 64], [8, 67], [12, 65]].forEach(([c, m]) => toggleTuneCell(grid, c, m));
  const origEndMidi = grid.ending[12].midi;
  grid = shapeEnding(grid, "climb", 0, "major");
  const climbedMidi = grid.ending[12].midi;
  assert.ok(climbedMidi > origEndMidi);
  assert.equal(activeEndingShape(grid), "climb");

  // Switching to fall then back to climb starts from baseEnding, never drifting higher
  grid = shapeEnding(grid, "fall", 0, "major");
  grid = shapeEnding(grid, "climb", 0, "major");
  assert.equal(grid.ending[12].midi, climbedMidi);

  // Pressing active shape again restores original baseEnding
  grid = shapeEnding(grid, "climb", 0, "major");
  assert.equal(grid.ending[12].midi, origEndMidi);
  assert.equal(activeEndingShape(grid), null);
});

test("12b-4 (#19): classifyTuneNoteMark returns anchor, step, or edge with plain words", () => {
  assert.deepEqual(classifyTuneNoteMark(60, 0, "major"), { tier: "anchor", icon: "mark_anchor", word: "fits chord" });
  assert.deepEqual(classifyTuneNoteMark(67, 0, "major"), { tier: "anchor", icon: "mark_anchor", word: "fits chord" });
  assert.deepEqual(classifyTuneNoteMark(62, 0, "major"), { tier: "step", icon: "mark_step", word: "step note" });
  assert.deepEqual(classifyTuneNoteMark(61, 0, "major"), { tier: "edge", icon: "mark_edge", word: "edge note" });
});

test("12b-5 (#20): drag across same MIDI row extends duration_steps into a held sustain ribbon", () => {
  const grid = tuneGridFromNotes([]);
  const g = startTunePaint(grid, "main", 2, 64);
  applyTunePaint(grid, g, 3, 64);
  applyTunePaint(grid, g, 4, 64);
  applyTunePaint(grid, g, 5, 64);
  assert.equal(grid.main[2].duration_steps, 4);
  assert.equal(grid.main[3], null);
  assert.equal(cellIsInsideSustain(grid.main, 3, 64), true);
  assert.equal(cellIsInsideSustain(grid.main, 5, 64), true);
  assert.equal(cellIsInsideSustain(grid.main, 6, 64), false);

  const notes = notesFromTuneGrid(grid);
  const reloaded = tuneGridFromNotes(notes);
  assert.equal(reloaded.main[2].duration_steps, 4);
});

test("12f-1 (Proposal #1, 98/100): switchEndingVersion preserves parallel original and reshaped explored endings", () => {
  let grid = tuneGridFromNotes([]);
  [[0, 60], [4, 64], [8, 67], [12, 65]].forEach(([c, m]) => toggleTuneCell(grid, c, m));
  const origMidi = grid.ending[12].midi;

  // Explore the ending ("climb"), then make a personal note edit at col 14
  grid = shapeEnding(grid, "climb", 0, "major");
  const climbedMidi = grid.ending[12].midi;
  toggleEndingCell(grid, 14, 72);
  assert.equal(grid.ending[14].midi, 72);

  // Switch back to original ending: col 14 edit is not in original, and col 12 is back to origMidi
  grid = switchEndingVersion(grid, "original");
  assert.equal(grid.ending[12].midi, origMidi);
  assert.equal(grid.ending[14], null);
  assert.equal(activeEndingShape(grid), null);

  // Switch back to explored ending: both the climbed note and the personal col 14 edit are intact
  grid = switchEndingVersion(grid, "explored");
  assert.equal(grid.ending[12].midi, climbedMidi);
  assert.equal(grid.ending[14].midi, 72);
  assert.equal(activeEndingShape(grid), "climb");
});

test("tapping or painting a dashed starter pad (seed_template) claims it as user_placed instead of erasing it", () => {
  const grid = beatGridFromNotes(seedPulse());
  assert.equal(grid.kick[0], "seed_template");
  // First tap claims the dashed starter pad as yours ("user_placed")
  assert.equal(toggleBeatCell(grid, "kick", 0), true);
  assert.equal(grid.kick[0], "user_placed");
  // Second tap on a user_placed pad turns it off
  assert.equal(toggleBeatCell(grid, "kick", 0), false);
  assert.equal(grid.kick[0], null);

  // startPaint on a dashed starter pad paints it as user_placed
  assert.equal(grid.kick[4], "seed_template");
  const g = startPaint(grid, "kick", 4);
  assert.equal(g.filling, true);
  assert.equal(grid.kick[4], "user_placed");
});

test("single-tap tune notes (duration_steps === 2) do not spawn held-tail boxes in the next column", () => {
  const grid = tuneGridFromNotes([]);
  toggleTuneCell(grid, 0, 60);
  assert.equal(grid.main[0].duration_steps, 2);
  assert.equal(cellIsInsideSustain(grid.main, 1, 60), false);
});
