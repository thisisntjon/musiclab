// Phase 9a-2, 9a-3, 9a-8 (JS side): one act makes it yours; the starter pulse is never the person's.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newPlayDoc,
  seedPulse,
  recordAct,
  actsCount,
  recordReveal,
  revealsCount,
  madeByYou,
  provenanceOf,
} from "../../../static/js/theory/session_rules.js";
import { compileSongStandalone, computeProvenanceSummary } from "../../../static/ui/standalone_compiler.js";
import { beatGridFromNotes, notesFromBeatGrid, startPaint } from "../../../static/js/theory/beat_model.js";

test("authored notes in an independent part allow keeping the song", () => {
  const doc = newPlayDoc();
  doc.song_cards = [{ material: { notes: [{ provenance: "user_placed" }] } }];
  assert.equal(madeByYou(doc), false);
  recordAct(doc, "tune_note");
  assert.equal(madeByYou(doc), true);
  doc.song_cards[0].material.notes = [];
  assert.equal(madeByYou(doc), false);
});

test("9a-2: a new piece has only the starter pulse (kick on beats 1 and 3), labelled seed_template", () => {
  const doc = newPlayDoc();
  const kicks = doc.notes.filter((n) => n.patch_id === "kick");
  assert.equal(doc.notes.length, 8);
  assert.deepEqual(kicks.map((n) => n.step % 16).sort((a, b) => a - b), [0, 0, 0, 0, 8, 8, 8, 8]);
  assert.ok(doc.notes.every((n) => n.provenance === "seed_template"));
  assert.equal(madeByYou(doc), false);
});

test("9a-3: one act that leaves something of yours makes it yours; unlabelled notes are starter material", () => {
  const doc = newPlayDoc();
  assert.equal(actsCount(doc), 0);
  const grid = beatGridFromNotes(doc.notes);
  startPaint(grid, "clap", 1); // paint one clap through the real model
  doc.notes = notesFromBeatGrid(grid, doc.notes);
  recordAct(doc, "paint", { lane: "clap", step: 1 });
  assert.equal(actsCount(doc), 1);
  assert.equal(madeByYou(doc), true);
  assert.equal(provenanceOf({}), "seed_template");
});

test("9a-3: turning a pad on and off again leaves nothing of yours, so it isn't 'made by you'", () => {
  const doc = newPlayDoc();
  for (let i = 0; i < 2; i++) {
    const grid = beatGridFromNotes(doc.notes);
    startPaint(grid, "clap", 1);
    doc.notes = notesFromBeatGrid(grid, doc.notes);
    recordAct(doc, "paint", { lane: "clap", step: 1 });
  }
  assert.equal(actsCount(doc), 2);
  assert.equal(madeByYou(doc), false);
});

test("9a-3: choosing a different speed counts as yours", () => {
  const doc = newPlayDoc();
  doc.global_context.bpm = 90;
  recordAct(doc, "speed", { bpm: 90 });
  assert.equal(madeByYou(doc), true);
});

test("9a-3: the provenance ledger doesn't count unlabelled notes as the person's", () => {
  const doc = { notes: [{ id: "x", step: 0, role: "drums", patch_id: "kick" }] };
  const summary = computeProvenanceSummary(doc);
  assert.equal(summary.counts.user_placed || 0, 0);
});

test("9a-8 (JS side): a beat-only piece compiles to drums only, no chords nobody chose", () => {
  const doc = newPlayDoc();
  const compiled = compileSongStandalone(doc);
  const roles = new Set(compiled.events.map((e) => e.role));
  assert.deepEqual([...roles], ["drums"]);
});

test("each new piece gets its own id", () => {
  const ids = new Set(Array.from({ length: 50 }, () => newPlayDoc().id));
  assert.equal(ids.size, 50);
  assert.equal(seedPulse(4).length, 8);
});

test("12f-4: recordReveal tracks discovery reveals separately from authored acts and does not inflate madeByYou", () => {
  const doc = newPlayDoc();
  assert.equal(revealsCount(doc), 0);
  recordReveal(doc, "shape_ending", { shape: "climb" });
  recordReveal(doc, "roll_beat", { crate: "bounce" });
  assert.equal(revealsCount(doc), 2);
  assert.equal(actsCount(doc), 0);
  assert.equal(madeByYou(doc), false);
});
