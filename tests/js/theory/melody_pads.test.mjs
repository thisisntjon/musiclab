// Phase 13.3b: room to play a tune. Eight keys up the scale, home notes marked, octaves shift.
import { test } from "node:test";
import assert from "node:assert/strict";
import { melodyPads, MELODY_KEYS } from "../../../static/js/theory/dynamic_keys.js";
import { startJam } from "../../../static/js/theory/jam_session.js";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";

const doc = (root = 0, scale = "major") => {
  const d = startJam(newPlayDoc({ now: 1, rand: () => .5 }), { kind: "pitched", patchId: "warm_keys" });
  d.global_context.root_pc = root; d.global_context.scale_type = scale; d.jam_session.live_keys = true;
  return d;
};

test("eight keys A to K climb one octave of the key, ending back home", () => {
  const pads = melodyPads(doc(0, "major"), null);
  assert.deepEqual(pads.map(p => p.key), MELODY_KEYS);
  assert.deepEqual(pads.map(p => p.midi), [60, 62, 64, 65, 67, 69, 71, 72]);
  assert.deepEqual(pads.map(p => p.label), ["Home", "2", "3", "4", "5", "6", "7", "Home"]);
  const minor = melodyPads(doc(9, "minor"), null);
  assert.deepEqual(minor.map(p => p.midi), [69, 71, 72, 74, 76, 77, 79, 81]);
});

test("the chord's own notes are marked home, so a child can see which keys always land", () => {
  const pads = melodyPads(doc(0, "major"), null);
  assert.deepEqual(pads.filter(p => p.home).map(p => p.midi), [60, 64, 67, 72]);
  assert.ok(pads.every(p => p.role === "lead" && p.patchId === "warm_keys"));
});

test("octave shift moves all eight keys together and stays in range", () => {
  const up = melodyPads(doc(), null, { octaveShift: 1 }), down = melodyPads(doc(), null, { octaveShift: -1 });
  assert.deepEqual(up.map(p => p.midi), [72, 74, 76, 77, 79, 81, 83, 84]);
  assert.deepEqual(down.map(p => p.midi), [48, 50, 52, 53, 55, 57, 59, 60]);
});

test("drums keep their four pads", () => {
  const d = startJam(newPlayDoc({ now: 1, rand: () => .5 }), { kind: "drums", patchId: "snare" });
  d.jam_session.live_keys = true;
  assert.equal(melodyPads(d, null).length, 4);
});

test("when the band plays a chord, the home keys follow it", () => {
  const d = doc(0, "major");
  const events = [60, 65, 69].map((midi, i) => ({ id: `h${i}`, step: 0, role: "harmony", patch_id: "warm_keys", start_sec: 0, duration_sec: 2.4, concrete: { midi_pitch: midi, freq_hz: 440 } }));
  const pads = melodyPads(d, { bpm: 100, position: 1, backing: { events } });
  assert.deepEqual([...new Set(pads.filter(p => p.home).map(p => p.midi % 12))].sort(), [0, 5, 9], "F chord tones are home");
  assert.equal(pads.length, 8);
});

test("in a style with its own mode, the row starts on the mode's home note and its chord keys are home", () => {
  const d = doc(0, "major");
  const mode = { version: 1, name: "dorian", tonic: 2, intervals: [0, 2, 3, 5, 7, 9, 10] };
  const events = [{ id: "l", step: 0, role: "lead", patch_id: "warm_keys", start_sec: 0, duration_sec: 1, concrete: { midi_pitch: 62, freq_hz: 440 } }];
  const pads = melodyPads(d, { bpm: 100, position: 1, backing: { events, phraseContext: { mode, form_lead_patch: "warm_keys" } } });
  assert.equal(pads[0].midi % 12, 2, "D is home");
  assert.deepEqual(pads.map(p => (p.midi - pads[0].midi)), [0, 2, 3, 5, 7, 9, 10, 12]);
  assert.ok(pads.filter(p => p.home).length >= 4, `${pads.filter(p => p.home).length} home keys`);
});
