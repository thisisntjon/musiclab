// Phase 9b-5 (shaping the ending changes bar 4 only), the underneath stage, kits, and the browser clash rescue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tuneGridFromNotes, notesFromTuneGrid, toggleTuneCell, toggleEndingCell, shapeEnding, endingIsOwn } from "../../../static/js/theory/tune_model.js";
import { PHRASE_SHAPES } from "../../../static/js/theory/phrase_transforms.js";
import {
  FEELS,
  HARMONY_STYLES,
  chordOptions,
  applyUnderneath,
  clearUnderneath,
  bassNotesForStyle,
  gapAnswerBassNotes,
  toggleBarPin,
} from "../../../static/js/theory/underneath.js";
import { harmonizeMelodyPhrase } from "../../../static/js/theory/harmony.js";
import { SEED_BRANCHES, defaultSoundSeed, breedSoundSeeds, applySoundBranch } from "../../../static/js/theory/sound_breeder.js";
import { newPlayDoc, madeByYou, recordAct, seedPulse } from "../../../static/js/theory/session_rules.js";
import { compileSongStandalone } from "../../../static/ui/standalone_compiler.js";
import { DRUM_KITS } from "../../../static/js/audio/voices.js";

const bars = (notes) =>
  [0, 1, 2, 3].map((b) =>
    notes.filter((n) => n.role === "lead" && Math.floor(n.step / 16) === b).map((n) => [n.step % 16, n.concrete.midi_pitch, n.duration_steps])
  );

test("9b-5: every shape on the ending changes bar 4 only; bars 1-3 are unchanged", () => {
  for (const shape of PHRASE_SHAPES) {
    const grid = tuneGridFromNotes([]);
    [[0, 60], [4, 64], [8, 67], [12, 65]].forEach(([c, m]) => toggleTuneCell(grid, c, m));
    const before = bars(notesFromTuneGrid(grid));
    const after = bars(notesFromTuneGrid(shapeEnding(grid, shape, 0, "major")));
    assert.deepEqual(after.slice(0, 3), before.slice(0, 3), `${shape} touched bars 1-3`);
    if (shape !== "repeat") assert.notDeepEqual(after[3], before[3], `${shape} should change the ending`);
  }
});

test("9b-5: once the ending is the person's own, editing the main part leaves it alone", () => {
  const grid = tuneGridFromNotes([]);
  toggleTuneCell(grid, 0, 60);
  assert.equal(endingIsOwn(grid), false);
  toggleEndingCell(grid, 6, 67);
  assert.equal(endingIsOwn(grid), true);
  toggleTuneCell(grid, 2, 62, { endingFollowsMain: !endingIsOwn(grid) });
  const b = bars(notesFromTuneGrid(grid));
  assert.deepEqual(b[0].map((x) => x[0]), [0, 2]);
  assert.deepEqual(b[3].map((x) => x[0]), [0, 6]);
});

function tunedDoc() {
  const doc = newPlayDoc();
  const grid = tuneGridFromNotes([]);
  [[0, 65], [4, 64], [8, 62], [12, 60]].forEach(([c, m]) => toggleTuneCell(grid, c, m));
  grid.main[0].duration_steps = 4; // a held F
  doc.notes = notesFromTuneGrid(grid, doc.notes);
  return doc;
}

test("underneath: each feel brings chords and bass; the tune is untouched; 'just my beat and tune' takes them away", () => {
  const doc = tunedDoc();
  const lead = JSON.stringify(doc.notes.filter((n) => n.role === "lead"));
  const options = chordOptions(doc);
  assert.equal(options.length, 3);
  for (const feel of FEELS) {
    const next = applyUnderneath(doc, { feel: feel.id, chords: feel.chords, bass: feel.bass }, options);
    assert.equal(next.auto_harmony_stabs, true);
    assert.ok(next.notes.some((n) => n.role === "bass"));
    assert.equal(JSON.stringify(next.notes.filter((n) => n.role === "lead")), lead);
    const compiled = compileSongStandalone(next, null);
    assert.ok(compiled.events.some((e) => e.role === "harmony"));
    const cleared = clearUnderneath(next);
    assert.equal(cleared.auto_harmony_stabs, false);
    assert.ok(!cleared.notes.some((n) => n.role === "bass"));
  }
  assert.equal(doc.auto_harmony_stabs, false, "the original doc is untouched (so it can be undone)");
});

test("underneath: the browser compiler re-voices a chord around a held melody note (same rescue as Python)", () => {
  const doc = newPlayDoc();
  doc.notes = [
    ...seedPulse(),
    { id: "f", step: 0, duration_steps: 8, role: "lead", patch_id: "pluck_lead", pitch_lock_mode: "concrete", provenance: "user_placed", concrete: { midi_pitch: 65 } },
  ];
  doc.auto_harmony_stabs = true;
  const chords = compileSongStandalone(doc, null).voiced_chords;
  assert.equal(chords[0].rescue, "sus4");
  assert.equal(chords[0].chord_name, "Csus4");
  assert.ok(chords[0].voiced_midi.every((m) => m % 12 !== 4), "no E against the held F");
});

test("bass patterns match the Python ones (kick-lock follows the kick)", () => {
  const lock = bassNotesForStyle("bass_kick_lock", seedPulse());
  assert.deepEqual(lock.slice(0, 2).map((n) => [n.step, n.relational.chord_tone_index]), [[0, 0], [8, 2]]);
  assert.equal(bassNotesForStyle("bass_driving_8ths", []).length, 32);
  assert.equal(bassNotesForStyle("bass_warm_sustained", []).length, 8);
});

test("9b-3: three kits with different settings; the clap is its own sound (band-passed, not the snare's high-pass)", () => {
  assert.deepEqual(Object.keys(DRUM_KITS).sort(), ["punchy", "soft", "tiny"]);
  for (const k of Object.values(DRUM_KITS)) assert.notEqual(k.clapBp, k.snareHp);
  assert.equal(new Set(Object.values(DRUM_KITS).map((k) => k.kickHi)).size, 3);
  const doc = newPlayDoc();
  doc.drum_kit = "tiny";
  assert.ok(compileSongStandalone(doc, null).events.filter((e) => e.role === "drums").every((e) => e.drum_kit === "tiny"));
});

test("a kit picked by ear counts as the person's (one act, kept in the piece)", () => {
  const doc = newPlayDoc();
  assert.equal(madeByYou(doc), false);
  doc.drum_kit = "soft";
  doc.play_session.choices = { kit: "soft" };
  assert.equal(madeByYou(doc), false, "no act yet");
  recordAct(doc, "kit", { kit: "soft" });
  assert.equal(madeByYou(doc), true);
});

test("12c-1 (#1): harmonizeMelodyPhrase and applyUnderneath respect pinnedBars while re-rolling unpinned bars", () => {
  let doc = tunedDoc();
  doc.chord_progressions["prog-main"] = [
    { bar: 0, degree: 6, roman: "vi", quality: "min" },
    { bar: 1, degree: 4, roman: "IV", quality: "maj" },
    { bar: 2, degree: 1, roman: "I", quality: "maj" },
    { bar: 3, degree: 5, roman: "V", quality: "maj" },
  ];
  doc = toggleBarPin(doc, 0);
  assert.ok(doc.pinned_chord_bars && doc.pinned_chord_bars[0]);
  const opts = chordOptions(doc);
  for (const o of opts) {
    assert.equal(o.progression[0].roman, "vi");
  }
  const applied = applyUnderneath(doc, { feel: "driving", chords: 2, bass: "bass_driving_8ths" }, opts);
  assert.equal(applied.chord_progressions["prog-main"][0].roman, "vi");
});

test("12c-2 (#16): gapAnswerBassNotes places bass strictly in silent melody gaps with zero overlap on active lead steps", () => {
  const doc = tunedDoc(); // lead notes at [0..3], [4..5], [8..9], [12..13] in each bar
  const leadSteps = new Set();
  for (const n of doc.notes.filter((x) => x.role === "lead")) {
    for (let s = n.step; s < n.step + (n.duration_steps || 2); s++) leadSteps.add(s);
  }
  const gapBass = gapAnswerBassNotes(doc.notes);
  assert.ok(gapBass.length >= 4);
  for (const b of gapBass) {
    for (let s = b.step; s < b.step + b.duration_steps; s++) {
      assert.equal(leadSteps.has(s), false, `gap bass overlapped lead at step ${s}`);
    }
  }
});

test("12c-3 (#9): harmony_style ripple arpeggiates chord tones and wide_echo pans octave-mirrored twin events", () => {
  const doc = tunedDoc();
  const opts = chordOptions(doc);
  const rippled = applyUnderneath(doc, { feel: "warm", chords: 0, bass: "bass_warm_sustained", harmony_style: "ripple" }, opts);
  const compRipple = compileSongStandalone(rippled, null);
  const harmEvents = compRipple.events.filter((e) => e.role === "harmony");
  assert.ok(harmEvents.length >= 16, "ripple splits 4 bar chords into eighth-note arpeggio steps");

  const wide = applyUnderneath(doc, { feel: "warm", chords: 0, bass: "bass_warm_sustained", harmony_style: "wide_echo" }, opts);
  const compWide = compileSongStandalone(wide, null);
  const juxEvents = compWide.events.filter((e) => String(e.id).includes("jux"));
  assert.ok(juxEvents.length >= 4);
});

test("12d-1 (#5): breedSoundSeeds and applySoundBranch stay in safe manifold [0.15, 0.95] and attach sound_seed to events", () => {
  let seed = defaultSoundSeed();
  for (let i = 0; i < 10; i++) {
    for (const b of SEED_BRANCHES) {
      seed = applySoundBranch(seed, b.id);
      assert.ok(seed.brightness >= 0.15 && seed.brightness <= 0.95);
      assert.ok(seed.warmth >= 0.15 && seed.warmth <= 0.95);
      assert.ok(seed.width >= 0.15 && seed.width <= 0.95);
    }
  }
  const children = breedSoundSeeds(defaultSoundSeed());
  assert.equal(Object.keys(children).length, 3);
  const doc = tunedDoc();
  doc.sound_seed = applySoundBranch(defaultSoundSeed(), "brighter");
  const comp = compileSongStandalone(doc, null);
  const leadEv = comp.events.find((e) => e.role === "lead");
  assert.equal(leadEv.sound_seed.branch, "brighter");
});
