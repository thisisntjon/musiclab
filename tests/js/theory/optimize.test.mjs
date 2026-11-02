// Make it nicer: the smallest move to what is known to sound better, said plainly, and idempotent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { optimizeNotes, optimizeArrangement, chordTonesByBar, describeOptimisation } from "../../../static/js/theory/optimize.js";
import { songArcFromCapture } from "../../../static/js/theory/song_view.js";

const own = (id, step, midi, extra = {}) => ({ id, step, role: "lead", patch_id: "warm_keys", velocity: .7, duration_steps: 2, provenance: "user_placed", concrete: { midi_pitch: midi, freq_hz: 440 }, performance: { version: 1, offset_steps: 0 }, ...extra });
const band = (id, step, midi) => ({ id, step, role: "lead", patch_id: "warm_keys", velocity: .5, duration_steps: 2, provenance: "jam_generated", concrete: { midi_pitch: midi, freq_hz: 440 } });

test("chord tones come from the band's harmony, then bass, then the key", () => {
  const events = [{ step: 0, role: "harmony", concrete: { midi_pitch: 60 } }, { step: 2, role: "harmony", concrete: { midi_pitch: 64 } }, { step: 4, role: "harmony", concrete: { midi_pitch: 67 } }, { step: 16, role: "bass", concrete: { midi_pitch: 41 } }];
  const tones = chordTonesByBar(events, { bars: 3, root: 0, minor: false });
  assert.deepEqual(tones[0], [0, 4, 7]);
  assert.deepEqual(tones[1].slice(0, 1), [5]);
  assert.deepEqual(tones[2], [0, 4, 7]);
});

test("notes move the smallest distance to the chord, far-off-grid notes land on the beat, overlaps shrink, and the last note comes home", () => {
  const notes = [own("a", 0, 61), own("b", 4, 64, { performance: { version: 1, offset_steps: .8 } }), own("c", 8, 66, { duration_steps: 8 }), own("d", 12, 65), band("x", 2, 50)];
  const { notes: out, changes } = optimizeNotes(notes, { tonesByBar: [[0, 4, 7]], stepsPerBar: 16 });
  const by = id => out.find(n => n.id === id);
  assert.equal(by("a").concrete.midi_pitch, 60, "61 moves one step to C, not three to E");
  assert.equal(by("b").step, 5); assert.equal(by("b").performance.offset_steps, 0);
  assert.equal(by("c").concrete.midi_pitch, 67, "66 moves to G");
  assert.equal(by("c").duration_steps, 4, "shortened so it does not run into the next note");
  assert.equal(by("d").concrete.midi_pitch, 67, "65 fits to E first, then the last note comes home to the nearer of C and G");
  assert.equal(by("x").concrete.midi_pitch, 50, "the band's note is left alone");
  assert.deepEqual(changes, { chord: 3, grid: 1, overlap: 1, home: true });
});

test("a deliberate push between the beats is kept, and a second run changes nothing", () => {
  const notes = [own("a", 0, 60, { performance: { version: 1, offset_steps: .5 } }), own("b", 8, 67)];
  const first = optimizeNotes(notes, { tonesByBar: [[0, 4, 7]] });
  assert.equal(first.notes[0].performance.offset_steps, .5, "a half-step push is a feel, not a mistake");
  const second = optimizeNotes(first.notes, { tonesByBar: [[0, 4, 7]] });
  assert.equal(second.changed, false);
  assert.deepEqual(second.notes, first.notes);
});

test("the arrangement gets a calmer start, a real ending and a comfortable pace, once", () => {
  const flat = [{ beat: true, tune: true, under: true, big: false, fx: null, bars: 4 }, { beat: true, tune: true, under: true, big: false, fx: null, bars: 4 }, { beat: true, tune: true, under: true, big: false, fx: null, bars: 4 }];
  const r = optimizeArrangement(flat, 150);
  assert.equal(r.cards[0].under, false, "calmer start");
  assert.equal(r.cards.at(-1).fx, "drum_roll", "a real ending");
  assert.equal(r.bpm, 132);
  assert.ok(r.changes.includes("a calmer pace"));
  const again = optimizeArrangement(r.cards, r.bpm);
  assert.equal(again.changed, false, "already as near as it gets");
  const arc = songArcFromCapture([{ bars: 4, beat: true, tune: true, under: true, fx: null, big: false }]);
  assert.equal(optimizeArrangement(arc, 100).changed, false, "the three-part arc already has contrast and an ending");
});

test("what changed is said in one plain sentence", () => {
  assert.equal(describeOptimisation({ notes: { changes: { chord: 2, grid: 0, overlap: 1, home: true } } }), "2 notes moved to the chord, 1 note made shorter and the last note comes home. Undo puts it back.");
  assert.equal(describeOptimisation({ notes: { changes: { chord: 0, grid: 0, overlap: 0, home: false } }, arrangement: { changes: [] } }), "It is as near as I can get it. Undo is there if you want.");
});
