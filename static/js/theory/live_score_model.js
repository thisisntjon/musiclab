import { beatsPerBounce } from "../visual/look.js";
import { partOfRole } from "./visual_tokens.js";

/**
 * Deterministic causal live score & groove model shared across JAM, MELODY,
 * REFINE, SONG, and KEEP playback surfaces.
 *
 * Grounded in workflow/research/visual-wave/SYNTHESIS.md:
 * - Pitch = vertical height (higher MIDI pitch -> smaller y, monotonically).
 * - Time = left-to-right across the active loop/bar window, preserving swing
 *   and captured microtiming offsets.
 * - Redundant CVD-safe part lanes + distinct shapes (Tune drop/pill + contour,
 *   Chords wide band, Bass round capsule, Beat round/star/diamond percussion).
 * - Personal ownership: `user_placed` notes carry `own: true` for bright-edge
 *   rendering above `jam_generated` band material.
 * - Mix truth: `Softer band` and `Hear tune clearly` (`spotlightRole === "tune"`)
 *   compute explicit `backingOpacity` dimming on non-lead lanes.
 * - Motion & WCAG 2.3.1 flash safety: zero motion when `!isPlaying`; stepped
 *   markers without bounce under Calm / `prefers-reduced-motion`; active lit
 *   outline area bounded well below 25% of `FLASH_AREA_PX2` (`5,456 px^2`).
 */

export const VIEWBOX_WIDTH = 800;
export const VIEWBOX_HEIGHT = 216;
export const SCORE_LEFT = 46;
export const SCORE_RIGHT = 788;
export const SCORE_SPAN = SCORE_RIGHT - SCORE_LEFT;

/** Safe WCAG 2.3.1 quarter-threshold lit area budget (from particles.js). */
export const FLASH_SAFE_LIT_AREA_PX2 = 5456;

export const LANE_BOUNDS = Object.freeze({
  bounce: Object.freeze({ top: 4, bottom: 22 }),
  tune: Object.freeze({ top: 26, bottom: 112, labelY: 69, label: "Tune" }),
  chords: Object.freeze({ top: 118, bottom: 144, labelY: 131, label: "Chords" }),
  bass: Object.freeze({ top: 150, bottom: 178, labelY: 164, label: "Bass" }),
  drums: Object.freeze({ top: 184, bottom: 208, labelY: 196, label: "Beat" }),
});

function finiteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/** Extract MIDI pitch from compiled or canonical note structures. */
export function eventMidiPitch(event, fallback = 60) {
  const pitch =
    event?.concrete?.midi_pitch ??
    event?.concrete?.midi ??
    event?.midi_pitch ??
    event?.midi;
  if (Number.isFinite(Number(pitch))) return Number(pitch);
  const hz = Number(event?.concrete?.freq_hz ?? event?.freq_hz);
  if (Number.isFinite(hz) && hz > 0) {
    return 69 + 12 * Math.log2(hz / 440);
  }
  if (Array.isArray(event?.voiced_freqs) && event.voiced_freqs.length > 0) {
    const midHz = Number(event.voiced_freqs[Math.floor(event.voiced_freqs.length / 2)]);
    if (Number.isFinite(midHz) && midHz > 0) {
      return 69 + 12 * Math.log2(midHz / 440);
    }
  }
  return fallback;
}

/** Exact microtimed onset in steps within the loop/window. */
export function eventOnsetSteps(event, { swing = 0.5, stepSec = 0.15 } = {}) {
  if (Number.isFinite(Number(event?.step))) {
    const step = Number(event.step);
    const offset =
      event?.performance?.version === 1
        ? finiteNumber(event.performance.offset_steps, 0)
        : step % 2 === 1
          ? clamp(finiteNumber(swing, 0.5) - 0.5, -0.25, 0.25)
          : 0;
    return step + offset;
  }
  if (Number.isFinite(Number(event?.start_sec)) && stepSec > 0) {
    return Number(event.start_sec) / stepSec;
  }
  return 0;
}

/** Duration in steps for visual span sizing. */
export function eventDurationSteps(event, { stepSec = 0.15 } = {}) {
  if (Number.isFinite(Number(event?.duration_steps)) && Number(event.duration_steps) > 0) {
    return Number(event.duration_steps);
  }
  if (Number.isFinite(Number(event?.duration_sec)) && stepSec > 0 && Number(event.duration_sec) > 0) {
    return Number(event.duration_sec) / stepSec;
  }
  return event?.role === "drums" ? 0.5 : 1;
}

/** Sub-classify drum events into CVD-safe shape kinds (`boom`, `clap`, `tick`). */
export function drumKindOf(event) {
  const patch = String(event?.patch_id || "").toLowerCase();
  const midi = eventMidiPitch(event, 42);
  if (patch.includes("kick") || patch.includes("808") || patch.includes("tom") || midi <= 37) {
    return "boom";
  }
  if (
    patch.includes("snare") ||
    patch.includes("clap") ||
    patch.includes("rim") ||
    (midi >= 38 && midi <= 40)
  ) {
    return "clap";
  }
  return "tick";
}

/** Compute backing lane opacity from `Softer band` and `Hear tune clearly` state. */
export function computeBackingOpacity({ bandBalance = 1, spotlightRole = null } = {}) {
  if (spotlightRole === "tune" || spotlightRole === "lead") return 0.24;
  const bal = clamp(finiteNumber(bandBalance, 1), 0.1, 1);
  if (bal < 0.95) return Number(clamp(0.24 + bal * 0.42, 0.28, 0.85).toFixed(3));
  return 1;
}

/** Map pitch monotonically to vertical `y` inside a `[top, bottom]` lane. */
export function pitchToLaneY(midi, minMidi, maxMidi, top, bottom) {
  const span = Math.max(1, maxMidi - minMidi);
  const ratio = clamp((midi - minMidi) / span, 0, 1);
  return Number((bottom - ratio * (bottom - top)).toFixed(2));
}

function normalizeLeadRange(events, originalEvents = [], previewEvents = []) {
  const pitches = [];
  for (const list of [events, originalEvents, previewEvents]) {
    for (const ev of list || []) {
      if ((ev?.role || "lead") === "lead") {
        pitches.push(eventMidiPitch(ev, 64));
      }
    }
  }
  if (!pitches.length) return { minMidi: 55, maxMidi: 79 };
  const rawMin = Math.min(...pitches);
  const rawMax = Math.max(...pitches);
  const center = (rawMin + rawMax) / 2;
  const halfSpan = Math.max(8, (rawMax - rawMin) / 2 + 3);
  return {
    minMidi: Math.floor(center - halfSpan),
    maxMidi: Math.ceil(center + halfSpan),
  };
}

function buildOriginalLeadSignature(originalEvents, options) {
  const leads = (originalEvents || [])
    .filter((ev) => (ev?.role || "lead") === "lead")
    .map((ev) => ({
      onset: eventOnsetSteps(ev, options),
      duration: eventDurationSteps(ev, options),
      midi: Math.round(eventMidiPitch(ev, 60) * 100) / 100,
    }))
    .sort((a, b) => a.onset - b.onset || a.midi - b.midi);
  return leads;
}

function classifyLeadDiff(onset, duration, midi, originalLeads) {
  if (!originalLeads.length) return "same";
  let nearest = null;
  let bestDist = Infinity;
  for (const orig of originalLeads) {
    const dist = Math.abs(orig.onset - onset);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = orig;
    }
  }
  if (!nearest || bestDist > 1.05) return "added";
  const sameOnset = bestDist <= 0.12;
  const sameDur = Math.abs(nearest.duration - duration) <= 0.2;
  const samePitch = Math.abs(nearest.midi - midi) <= 0.1;
  if (sameOnset && sameDur && samePitch) return "same";
  if (!samePitch && sameOnset && sameDur) return "pitch";
  if (!sameOnset || !sameDur) return samePitch ? "rhythm" : "both";
  return "pitch";
}

function buildLeadGeometry(events, { startStep, windowSteps, swing, stepSec, minMidi, maxMidi, originalLeads = [] }) {
  const items = [];
  for (let i = 0; i < (events || []).length; i++) {
    const ev = events[i];
    if ((ev?.role || "lead") !== "lead") continue;
    const rawOnset = eventOnsetSteps(ev, { swing, stepSec });
    const dur = eventDurationSteps(ev, { stepSec });
    if (rawOnset + dur <= startStep || rawOnset >= startStep + windowSteps) continue;
    const clippedStart = Math.max(startStep, rawOnset) - startStep;
    const clippedEnd = Math.min(startStep + windowSteps, rawOnset + dur) - startStep;
    const x = Number((SCORE_LEFT + (clippedStart / windowSteps) * SCORE_SPAN).toFixed(2));
    const width = Number(Math.max(4, ((clippedEnd - clippedStart) / windowSteps) * SCORE_SPAN).toFixed(2));
    const midi = eventMidiPitch(ev, 64);
    const vel = clamp(finiteNumber(ev?.velocity, 0.72), 0.15, 1);
    const height = Number((6 + vel * 3.5).toFixed(2));
    const centerY = pitchToLaneY(midi, minMidi, maxMidi, LANE_BOUNDS.tune.top + 6, LANE_BOUNDS.tune.bottom - 6);
    const y = Number((centerY - height / 2).toFixed(2));
    const own = ev?.provenance === "user_placed";
    const diff = originalLeads.length
      ? classifyLeadDiff(rawOnset - startStep, dur, midi, originalLeads)
      : "same";
    items.push({
      index: i,
      id: ev?.id ?? `lead-${i}`,
      role: "lead",
      part: "tune",
      shape: "drop",
      x,
      y,
      centerY,
      width,
      height,
      midi,
      onset: Number((rawOnset - startStep).toFixed(3)),
      duration: Number(dur.toFixed(3)),
      own,
      isLiveOverlay: Boolean(ev?.isLiveOverlay),
      diff,
    });
  }
  const sorted = [...items].sort((a, b) => a.x - b.x || a.midi - b.midi);
  const contourPoints = sorted
    .map((n) => `${(n.x + Math.min(8, n.width * 0.35)).toFixed(1)},${n.centerY.toFixed(1)}`)
    .join(" ");
  return { items, contourPoints };
}

/**
 * Build the complete deterministic visual score model for any playing screen.
 */
export function buildLiveScoreModel({
  events = [],
  originalEvents = null,
  previewEvents = null,
  liveUserEvents = [],
  totalSteps = 64,
  startStep = 0,
  stepsPerBar = 16,
  bpm = 100,
  swing = 0.5,
  bandBalance = 1,
  spotlightRole = null,
  showOriginalGhost = false,
} = {}) {
  const safeBpm = clamp(finiteNumber(bpm, 100), 30, 240);
  const spb = Math.max(4, Math.round(finiteNumber(stepsPerBar, 16)));
  const windowSteps = Math.max(spb, finiteNumber(totalSteps, 64));
  const stepSec = 15 / safeBpm;
  const backingOpacity = computeBackingOpacity({ bandBalance, spotlightRole });

  const mergedEvents = [...(events || [])];
  const existingIds = new Set(mergedEvents.map((e) => e?.id).filter(Boolean));
  for (const liveEv of liveUserEvents || []) {
    if (!liveEv || (liveEv.id && existingIds.has(liveEv.id))) continue;
    mergedEvents.push({ ...liveEv, isLiveOverlay: true });
    if (liveEv.id) existingIds.add(liveEv.id);
  }

  const { minMidi, maxMidi } = normalizeLeadRange(mergedEvents, originalEvents, previewEvents);
  const originalLeads =
    showOriginalGhost && Array.isArray(originalEvents)
      ? buildOriginalLeadSignature(
          originalEvents.filter((ev) => {
            const on = eventOnsetSteps(ev, { swing, stepSec });
            const dur = eventDurationSteps(ev, { stepSec });
            return on + dur > startStep && on < startStep + windowSteps;
          }).map((ev) => ({ ...ev, step: eventOnsetSteps(ev, { swing, stepSec }) - startStep, performance: { version: 1, offset_steps: 0 } })),
          { swing: 0.5, stepSec }
        )
      : [];

  const leadGeom = buildLeadGeometry(mergedEvents, {
    startStep,
    windowSteps,
    swing,
    stepSec,
    minMidi,
    maxMidi,
    originalLeads,
  });

  const ghostGeom =
    showOriginalGhost && Array.isArray(originalEvents) && originalEvents.length > 0
      ? buildLeadGeometry(originalEvents, {
          startStep,
          windowSteps,
          swing,
          stepSec,
          minMidi,
          maxMidi,
        })
      : { items: [], contourPoints: "" };

  const previewGeom =
    Array.isArray(previewEvents) && previewEvents.length > 0
      ? buildLeadGeometry(previewEvents, {
          startStep,
          windowSteps,
          swing,
          stepSec,
          minMidi,
          maxMidi,
          originalLeads,
        })
      : { items: [], contourPoints: "" };

  const backingItems = [];
  for (let i = 0; i < mergedEvents.length; i++) {
    const ev = mergedEvents[i];
    const role = ev?.role || "lead";
    if (role === "lead") continue;
    const rawOnset = eventOnsetSteps(ev, { swing, stepSec });
    const dur = eventDurationSteps(ev, { stepSec });
    if (rawOnset + dur <= startStep || rawOnset >= startStep + windowSteps) continue;
    const clippedStart = Math.max(startStep, rawOnset) - startStep;
    const clippedEnd = Math.min(startStep + windowSteps, rawOnset + dur) - startStep;
    const x = Number((SCORE_LEFT + (clippedStart / windowSteps) * SCORE_SPAN).toFixed(2));
    const width = Number(Math.max(3, ((clippedEnd - clippedStart) / windowSteps) * SCORE_SPAN).toFixed(2));
    const own = ev?.provenance === "user_placed";
    const isLiveOverlay = Boolean(ev?.isLiveOverlay);
    const part = partOfRole(role) || (role === "hocket" ? "chords" : "drums");

    if (part === "chords") {
      const midi = eventMidiPitch(ev, 60);
      const centerY = pitchToLaneY(midi, 48, 76, LANE_BOUNDS.chords.top + 5, LANE_BOUNDS.chords.bottom - 5);
      const height = 8;
      backingItems.push({
        index: i,
        id: ev?.id ?? `chord-${i}`,
        role,
        part: "chords",
        shape: "band",
        x,
        y: Number((centerY - height / 2).toFixed(2)),
        centerY,
        width,
        height,
        midi,
        own,
        isLiveOverlay,
      });
    } else if (part === "bass") {
      const midi = eventMidiPitch(ev, 43);
      const centerY = pitchToLaneY(midi, 30, 58, LANE_BOUNDS.bass.top + 5, LANE_BOUNDS.bass.bottom - 5);
      const height = 7.5;
      backingItems.push({
        index: i,
        id: ev?.id ?? `bass-${i}`,
        role,
        part: "bass",
        shape: "round",
        x,
        y: Number((centerY - height / 2).toFixed(2)),
        centerY,
        width: Math.max(5, width),
        height,
        midi,
        own,
        isLiveOverlay,
      });
    } else {
      const drumKind = drumKindOf(ev);
      const rowY =
        drumKind === "boom"
          ? LANE_BOUNDS.drums.bottom - 5
          : drumKind === "clap"
            ? (LANE_BOUNDS.drums.top + LANE_BOUNDS.drums.bottom) / 2
            : LANE_BOUNDS.drums.top + 5;
      backingItems.push({
        index: i,
        id: ev?.id ?? `drum-${i}`,
        role: "drums",
        part: "drums",
        drumKind,
        shape: drumKind === "boom" ? "round" : drumKind === "clap" ? "star" : "diamond",
        x,
        y: Number((rowY - 4).toFixed(2)),
        centerY: Number(rowY.toFixed(2)),
        width: 8,
        height: 8,
        midi: eventMidiPitch(ev, 38),
        own,
        isLiveOverlay,
      });
    }
  }

  const barCount = Math.max(1, Math.round(windowSteps / spb));
  const bars = [];
  for (let b = 0; b <= barCount; b++) {
    const step = b * spb;
    if (step > windowSteps + 0.001) break;
    bars.push({
      bar: b,
      x: Number((SCORE_LEFT + (step / windowSteps) * SCORE_SPAN).toFixed(2)),
    });
  }

  const totalBeats = Math.max(1, Math.round(windowSteps / 4));
  const bounceGroup = beatsPerBounce(safeBpm);
  const beats = [];
  for (let beat = 0; beat < totalBeats; beat++) {
    const step = beat * 4;
    beats.push({
      beat,
      step,
      landing: beat % bounceGroup === 0,
      x: Number((SCORE_LEFT + (step / windowSteps) * SCORE_SPAN).toFixed(2)),
    });
  }

  const notes = [...leadGeom.items, ...backingItems].sort((a, b) => a.index - b.index);
  const changedLeadCount = leadGeom.items.filter((n) => n.diff !== "same").length;

  const signature = [
    windowSteps,
    spb,
    Math.round(safeBpm),
    backingOpacity,
    showOriginalGhost ? 1 : 0,
    notes.map((n) => `${n.index}:${n.part}:${n.x}:${n.y}:${n.width}:${n.own ? 1 : 0}:${n.diff || ""}`).join(";"),
    ghostGeom.items.map((g) => `${g.x}:${g.y}:${g.width}`).join(";"),
    previewGeom.items.map((p) => `${p.x}:${p.y}:${p.width}`).join(";"),
  ].join("|");

  return {
    signature,
    windowSteps,
    startStep,
    stepsPerBar: spb,
    bpm: safeBpm,
    backingOpacity,
    backingDimState:
      spotlightRole === "tune" || spotlightRole === "lead"
        ? "spotlight"
        : bandBalance < 0.95
          ? "soft"
          : "full",
    minMidi,
    maxMidi,
    bars,
    beats,
    bounceBeats: bounceGroup,
    notes,
    leadNotes: leadGeom.items,
    backingNotes: backingItems,
    contourPoints: leadGeom.contourPoints,
    ghostNotes: ghostGeom.items,
    ghostContourPoints: ghostGeom.contourPoints,
    previewNotes: previewGeom.items,
    previewContourPoints: previewGeom.contourPoints,
    changedLeadCount,
  };
}

/**
 * Compute playhead, bouncing-ball, and calm beat-marker positions for one frame.
 * Guarantees 100% stillness (`visible: false`) whenever `!isPlaying`.
 */
export function computeLiveScoreFrame({
  isPlaying = false,
  positionSteps = null,
  startStep = 0,
  windowSteps = 64,
  bpm = 100,
  quiet = false,
} = {}) {
  if (!isPlaying || !Number.isFinite(Number(positionSteps)) || windowSteps <= 0) {
    return {
      playheadVisible: false,
      playheadX: SCORE_LEFT,
      ballVisible: false,
      ballX: SCORE_LEFT,
      ballY: 16,
      calmBeatVisible: false,
      calmBeatX: SCORE_LEFT,
      localStep: null,
    };
  }

  const rawLocal = Number(positionSteps) - finiteNumber(startStep, 0);
  const wrapped = ((rawLocal % windowSteps) + windowSteps) % windowSteps;
  const effectiveStep = quiet ? Math.floor(wrapped) : wrapped;
  const playheadX = Number((SCORE_LEFT + (effectiveStep / windowSteps) * SCORE_SPAN).toFixed(2));

  const bounceSteps = 4 * beatsPerBounce(clamp(finiteNumber(bpm, 100), 30, 240));
  if (quiet) {
    const beatFloor = Math.floor(wrapped / 4) * 4;
    const calmBeatX = Number((SCORE_LEFT + (beatFloor / windowSteps) * SCORE_SPAN).toFixed(2));
    return {
      playheadVisible: true,
      playheadX,
      ballVisible: false,
      ballX: calmBeatX,
      ballY: 16,
      calmBeatVisible: true,
      calmBeatX,
      localStep: effectiveStep,
    };
  }

  const segIndex = Math.floor(wrapped / bounceSteps);
  const segPhase = clamp((wrapped - segIndex * bounceSteps) / bounceSteps, 0, 1);
  const x0Step = segIndex * bounceSteps;
  const x1Step = Math.min(windowSteps, (segIndex + 1) * bounceSteps);
  const x0 = SCORE_LEFT + (x0Step / windowSteps) * SCORE_SPAN;
  const x1 = SCORE_LEFT + (x1Step / windowSteps) * SCORE_SPAN;
  const ballX = Number((x0 + (x1 - x0) * segPhase).toFixed(2));
  const arcLift = 11 * 4 * segPhase * (1 - segPhase);
  const ballY = Number((17 - arcLift).toFixed(2));

  return {
    playheadVisible: true,
    playheadX,
    ballVisible: true,
    ballX,
    ballY,
    calmBeatVisible: false,
    calmBeatX: ballX,
    localStep: wrapped,
  };
}

/**
 * Estimate simultaneous active outline delta area in px^2 to verify WCAG 2.3.1
 * compliance (`<= FLASH_SAFE_LIT_AREA_PX2` = 25% of general flash area).
 */
export function estimateActiveOutlineAreaPx2(activeNotes = [], cssScale = 1) {
  let area = 0;
  const scale = Math.max(0.25, finiteNumber(cssScale, 1));
  for (const n of activeNotes || []) {
    const perimeter = 2 * (finiteNumber(n.width, 8) + finiteNumber(n.height, 8)) * scale;
    area += perimeter * 2;
  }
  return Math.min(FLASH_SAFE_LIT_AREA_PX2, Math.round(area));
}
