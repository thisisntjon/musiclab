// Phase 8.0 AC2 + AC3: the JS phrase transform keeps the person's phrase (mirror of the Python test).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHRASE_SHAPES,
  DEJA_VU_MODES,
  NOTE_DECORATORS,
  transformPhraseEnding,
  mutateDejaVu,
  decoratePhraseNotes,
} from "../../../static/js/theory/phrase_transforms.js";

const HUM_BAR = [[0, 65, 3], [3, 69, 2], [6, 72, 4], [11, 70, 3]];

function hummedLead() {
  const lead = [];
  for (let bar = 0; bar < 4; bar++) {
    for (const [step, midi, dur] of HUM_BAR) {
      lead.push({
        id: `hum-wiz-${bar * 16 + step}`, step: bar * 16 + step, duration_steps: dur, velocity: 0.85,
        role: "lead", patch_id: "pluck_lead", pitch_lock_mode: "concrete",
        concrete: { midi_pitch: midi }, provenance: "hummed_confirmed",
      });
    }
  }
  return lead;
}

const endingIds = (lead) => {
  const last = new Map();
  for (const n of [...lead].sort((a, b) => a.step - b.step)) last.set(Math.floor(n.step / 16), n.id);
  return new Set(last.values());
};

test("AC2: every shape keeps all hummed ids, provenance, and non-ending notes", () => {
  const before = hummedLead();
  const endings = endingIds(before);
  for (const shape of PHRASE_SHAPES) {
    const after = transformPhraseEnding(before, shape, 5, "major");
    assert.deepEqual(after.map((n) => n.id).sort(), before.map((n) => n.id).sort(), `${shape}: ids changed`);
    const byId = new Map(after.map((n) => [n.id, n]));
    for (const n of before) {
      const a = byId.get(n.id);
      assert.equal(a.provenance, "hummed_confirmed", `${shape}: provenance relabelled`);
      if (!endings.has(n.id)) {
        assert.deepEqual([a.step, a.concrete.midi_pitch, a.duration_steps], [n.step, n.concrete.midi_pitch, n.duration_steps], `${shape}: non-ending note ${n.id} changed`);
      }
    }
  }
});

test("AC2: shapes do what they say on each bar ending", () => {
  const before = hummedLead(); // F major (root 5); endings are midi 70 (B-flat) at steps 11, 27, 43, 59
  const climb = transformPhraseEnding(before, "climb", 5, "major").find((n) => n.step === 11);
  assert.equal(climb.concrete.midi_pitch, 72); // next F-major tone above B-flat is C
  const fall = transformPhraseEnding(before, "fall", 5, "major").find((n) => n.step === 11);
  assert.equal(fall.concrete.midi_pitch, 65); // home (F) at or below B-flat
  const hang = transformPhraseEnding(before, "hang", 5, "major").find((n) => n.step === 11);
  assert.equal(hang.duration_steps, 5); // rings to the bar end
  const space = transformPhraseEnding(before, "leave_space", 5, "major");
  assert.equal(space.find((n) => n.step === 27).duration_steps, 1);
  assert.equal(space.find((n) => n.step === 11).duration_steps, 3);
});

test("AC3: transforms never mutate their input, so the stored original always restores exactly", () => {
  const original = hummedLead();
  const snapshot = JSON.parse(JSON.stringify(original));
  let lead = original;
  for (const shape of ["climb", "hang", "leave_space"]) lead = transformPhraseEnding(lead, shape, 5, "major");
  assert.notDeepEqual(lead, snapshot);
  assert.deepEqual(original, snapshot, "input was mutated");
  const restored = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(restored, original);
});

test("empty lead stays empty and unknown shapes are refused", () => {
  assert.deepEqual(transformPhraseEnding([], "climb"), []);
  assert.throws(() => transformPhraseEnding(hummedLead(), "explode"));
});

test("12b-6 (#2, #14): mutateDejaVu and decoratePhraseNotes never mutate input and preserve id + provenance", () => {
  const before = hummedLead();
  const snap = JSON.parse(JSON.stringify(before));
  for (const mode of DEJA_VU_MODES) {
    const out = mutateDejaVu(before, mode, 7);
    assert.deepEqual(before, snap);
    assert.deepEqual(out.map((n) => n.id).sort(), before.map((n) => n.id).sort());
    assert.ok(out.every((n) => n.provenance === "hummed_confirmed"));
  }
  for (const deco of NOTE_DECORATORS) {
    const out = decoratePhraseNotes(before, deco);
    assert.deepEqual(before, snap);
    assert.ok(out.every((n) => n.transition === deco && n.provenance === "hummed_confirmed"));
    const toggledOff = decoratePhraseNotes(out, deco);
    assert.ok(toggledOff.every((n) => n.transition === undefined));
  }
});
