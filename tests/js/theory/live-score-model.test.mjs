import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
  FLASH_SAFE_LIT_AREA_PX2,
  buildLiveScoreModel,
  computeLiveScoreFrame,
  computeBackingOpacity,
  drumKindOf,
  estimateActiveOutlineAreaPx2,
} from "../../../static/js/theory/live_score_model.js";
import { planMelodyCandidate, VOCABULARY_VERSION } from "../../../static/js/theory/melody_composer_v5.js";
import { sceneHarmonyFor } from "../../../static/js/theory/phrase_harmony.js";

function sampleBackingEvents(style = "house-v1") {
  if (style === "ska-v1") {
    return [
      { id: "d1", role: "drums", patch_id: "kick", step: 0, duration_steps: 1, concrete: { midi: 36 } },
      { id: "d2", role: "drums", patch_id: "snare", step: 4, duration_steps: 1, concrete: { midi: 38 } },
      { id: "d3", role: "drums", patch_id: "hat_closed", step: 2, duration_steps: 0.5, concrete: { midi: 42 } },
      { id: "c1", role: "harmony", patch_id: "warm_keys", step: 2, duration_steps: 1.5, concrete: { midi_pitch: 64 } },
      { id: "c2", role: "harmony", patch_id: "warm_keys", step: 6, duration_steps: 1.5, concrete: { midi_pitch: 67 } },
      { id: "b1", role: "bass", patch_id: "clean_bass", step: 0, duration_steps: 2, concrete: { midi_pitch: 40 } },
      { id: "b2", role: "bass", patch_id: "clean_bass", step: 4, duration_steps: 2, concrete: { midi_pitch: 47 } },
    ];
  }
  return [
    { id: "d1", role: "drums", patch_id: "kick", step: 0, duration_steps: 1, concrete: { midi: 36 } },
    { id: "d2", role: "drums", patch_id: "kick", step: 4, duration_steps: 1, concrete: { midi: 36 } },
    { id: "d3", role: "drums", patch_id: "clap", step: 4, duration_steps: 1, concrete: { midi: 39 } },
    { id: "d4", role: "drums", patch_id: "hat_open", step: 2, duration_steps: 1, concrete: { midi: 46 } },
    { id: "c1", role: "harmony", patch_id: "warm_keys", step: 0, duration_steps: 8, concrete: { midi_pitch: 60 } },
    { id: "b1", role: "bass", patch_id: "clean_bass", step: 2, duration_steps: 2, concrete: { midi_pitch: 36 } },
  ];
}

test("Pitch maps monotonically to height and CVD-safe parts carry distinct shapes", () => {
  const events = [
    { id: "l-low", role: "lead", step: 0, duration_steps: 4, provenance: "jam_generated", concrete: { midi_pitch: 60 } },
    { id: "l-mid", role: "lead", step: 8, duration_steps: 4, provenance: "user_placed", concrete: { midi_pitch: 67 } },
    { id: "l-high", role: "lead", step: 16, duration_steps: 4, provenance: "jam_generated", concrete: { midi_pitch: 74 } },
    ...sampleBackingEvents("house-v1"),
  ];
  const model = buildLiveScoreModel({ events, totalSteps: 64, stepsPerBar: 16, bpm: 120 });
  assert.equal(VIEWBOX_WIDTH, 800);
  assert.equal(VIEWBOX_HEIGHT, 216);
  assert.equal(model.leadNotes.length, 3);
  const [low, mid, high] = model.leadNotes;
  assert.ok(high.centerY < mid.centerY && mid.centerY < low.centerY, "higher MIDI pitch sits visually higher (smaller y)");
  assert.ok(low.x < mid.x && mid.x < high.x, "later steps sit further right");
  assert.equal(mid.own, true, "user_placed note flagged as own");
  assert.equal(low.own, false, "jam_generated note is not flagged as own");

  assert.equal(drumKindOf({ patch_id: "kick", concrete: { midi: 36 } }), "boom");
  assert.equal(drumKindOf({ patch_id: "clap", concrete: { midi: 39 } }), "clap");
  assert.equal(drumKindOf({ patch_id: "hat_closed", concrete: { midi: 42 } }), "tick");

  const shapes = new Set(model.notes.map((n) => `${n.part}:${n.shape}`));
  assert.ok(shapes.has("tune:drop"));
  assert.ok(shapes.has("chords:band"));
  assert.ok(shapes.has("bass:round"));
  assert.ok(shapes.has("drums:round"));
  assert.ok(shapes.has("drums:star"));
  assert.ok(shapes.has("drums:diamond"));
});

test("Steering Jam styles visibly transforms backing signature, drum shapes, and bass contour", () => {
  const ska = buildLiveScoreModel({ events: sampleBackingEvents("ska-v1"), bpm: 132 });
  const house = buildLiveScoreModel({ events: sampleBackingEvents("house-v1"), bpm: 124 });
  assert.notEqual(ska.signature, house.signature, "style steering changes live score signature");
  assert.notDeepEqual(
    ska.backingNotes.map((n) => [n.part, n.x, n.y, n.width]),
    house.backingNotes.map((n) => [n.part, n.x, n.y, n.width])
  );
});

test("Melody wheel candidates reshape contour against Original ghost and flag changed notes", () => {
  const originalLead = [
    { id: "o1", role: "lead", step: 0, duration_steps: 4, velocity: 0.75, provenance: "jam_generated", concrete: { midi_pitch: 64 } },
    { id: "o2", role: "lead", step: 8, duration_steps: 4, velocity: 0.75, provenance: "jam_generated", concrete: { midi_pitch: 67 } },
    { id: "o3", role: "lead", step: 16, duration_steps: 4, velocity: 0.75, provenance: "jam_generated", concrete: { midi_pitch: 69 } },
    { id: "o4", role: "lead", step: 24, duration_steps: 4, velocity: 0.75, provenance: "jam_generated", concrete: { midi_pitch: 67 } },
  ];
  const backing = sampleBackingEvents("house-v1");
  const ctx = {
    root: 0,
    minor: false,
    sceneId: "house-v1",
    harmony: sceneHarmonyFor("house-v1", false),
    vocabularyVersion: VOCABULARY_VERSION,
    bpm: 124,
    patch: "sampled_piano_v1",
    register: [54, 78],
    centre: 66,
    lead: originalLead,
    source: { events: [...backing, ...originalLead] },
  };
  const candBright = planMelodyCandidate(ctx, { x: 0.1, y: 0.85 }).notes;
  const candSpace = planMelodyCandidate(ctx, { x: -0.1, y: -0.85 }).notes;

  const modelBright = buildLiveScoreModel({
    events: candBright,
    originalEvents: [...backing, ...originalLead],
    showOriginalGhost: true,
    bpm: 124,
  });
  const modelSpace = buildLiveScoreModel({
    events: candSpace,
    originalEvents: [...backing, ...originalLead],
    showOriginalGhost: true,
    bpm: 124,
  });

  assert.equal(modelBright.ghostNotes.length, originalLead.length, "Original ghost notes preserved alongside candidate");
  assert.ok(modelBright.ghostContourPoints.length > 0, "Original ghost contour rendered");
  assert.ok(modelBright.changedLeadCount > 0, "Candidate notes show explicit diff against Original");
  assert.notEqual(modelBright.contourPoints, modelSpace.contourPoints, "Different wheel regions produce distinct visual contours");
});

test("Softer band and Hear tune clearly dim backing opacity truthfully", () => {
  assert.equal(computeBackingOpacity({ bandBalance: 1, spotlightRole: null }), 1);
  const soft = computeBackingOpacity({ bandBalance: 0.45, spotlightRole: null });
  const spot = computeBackingOpacity({ bandBalance: 1, spotlightRole: "tune" });
  assert.ok(soft < 0.55 && soft >= 0.28, `Softer band dims backing (${soft})`);
  assert.equal(spot, 0.24, "Tune spotlight dims backing further");
});

test("Motion & WCAG 2.3.1 safety: zero motion when idle, calm steps without bounce, <= 2 Hz bounce above 120 BPM, safe flash area", () => {
  const idle = computeLiveScoreFrame({ isPlaying: false, positionSteps: 12.4, bpm: 120, quiet: false });
  assert.equal(idle.playheadVisible, false);
  assert.equal(idle.ballVisible, false);
  assert.equal(idle.calmBeatVisible, false);

  const calm = computeLiveScoreFrame({ isPlaying: true, positionSteps: 10.75, bpm: 120, quiet: true });
  assert.equal(calm.playheadVisible, true);
  assert.equal(calm.ballVisible, false, "Calm mode hides bouncing ball");
  assert.equal(calm.calmBeatVisible, true, "Calm mode shows non-bouncing beat marker");
  assert.equal(calm.localStep, 10, "Calm mode steps playhead cleanly");

  const fastMidArc = computeLiveScoreFrame({ isPlaying: true, positionSteps: 4, bpm: 150, quiet: false });
  assert.equal(fastMidArc.ballVisible, true);
  // At 150 BPM (> 120), beatsPerBounce(150) = 2 (8 steps per bounce -> 1.25 Hz < 3 Hz), so step 4 is peak of arc!
  assert.ok(fastMidArc.ballY < 10, `Ball arcs smoothly at midpoint over 2 beats above 120 BPM (y=${fastMidArc.ballY})`);

  const model = buildLiveScoreModel({ events: sampleBackingEvents("house-v1"), bpm: 124 });
  const litArea = estimateActiveOutlineAreaPx2(model.notes, 1.2);
  assert.ok(litArea > 0 && litArea <= FLASH_SAFE_LIT_AREA_PX2, `Active outline delta (${litArea} px^2) stays within WCAG 2.3.1 safe cap`);
});
