/**
 * Beat stage model (Phase 9a + Phase 12a): an 8-step pattern per lane (eighth notes), repeated in every bar.
 * Each cell is null, "seed_template" (starter pulse) or "user_placed" (the person's).
 * Phase 12a adds:
 * - #6 Pin-and-Spin Groove Dice (`rollGrooveDice`, `isPadPinned`, `GROOVE_CRATES`)
 * - #7 Strudel/Toussaint Euclidean Rhythm Generator (`euclid`, `EUCLID_PRESETS`, `applyEuclidLane`, `applyEuclidPreset`)
 * - #8 Mutable Instruments Grids 2D Topographic Drum Map + Bar-4 Turnaround Fill (`interpolateGridsMap`, `GRIDS_MAP_SPOTS`, `applyGridsSpot`, `bar4Fill`)
 */
import { BARS, STEPS_PER_BAR } from "./session_rules.js";

export const BEAT_STEPS = 8;
export const LANES = [
  { id: "kick", patch: "kick", midi: 36, label: "Boom" },
  { id: "clap", patch: "clap", midi: 39, label: "Clap" },
  { id: "hat", patch: "hat_closed", midi: 42, label: "Tick" },
  { id: "snare", patch: "snare", midi: 38, label: "Snare" },
  { id: "hat_open", patch: "hat_open", midi: 46, label: "Open hat" },
  { id: "perc", patch: "perc", midi: 45, label: "Noise tick" },
];
const PATCH_TO_LANE = Object.fromEntries(LANES.map(lane => [lane.patch, lane.id]));
const isOwn = provenance => provenance === "user_placed" || provenance === "hummed_confirmed";

/** Curated 8-step groove crates for #6 Pin-and-Spin Groove Dice. */
export const GROOVE_CRATES = [
  { id: "walk", label: "Steady walk", kick: [0, 4], clap: [2, 6], hat: [0, 2, 4, 6] },
  { id: "bounce", label: "Warm bounce", kick: [0, 3, 6], clap: [2, 6], hat: [0, 1, 2, 4, 6] },
  { id: "drive", label: "Night drive", kick: [0, 2, 4, 6], clap: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  { id: "half", label: "Slow nod", kick: [0, 5], clap: [4], hat: [0, 2, 4, 6] },
  { id: "skip", label: "Light skip", kick: [0, 3, 4], clap: [2, 6], hat: [1, 3, 5, 7] },
  { id: "pocket", label: "Deep pocket", kick: [0, 3, 5], clap: [2, 6], hat: [0, 2, 3, 4, 6, 7] },
];

/** Euclidean presets (#7) — each <= 2 plain words, 3 choices in group. */
export const EUCLID_PRESETS = [
  { id: "bounce", label: "Bounce", kick: [3, 8, 0], clap: [2, 8, 2], hat: [5, 8, 0] },
  { id: "drive", label: "Drive", kick: [4, 8, 0], clap: [2, 8, 2], hat: [7, 8, 1] },
  { id: "skip", label: "Skip", kick: [3, 8, 1], clap: [2, 8, 2], hat: [4, 8, 1] },
];

/** Clean-room 4-corner 2D topographic weight maps [0..255] across 8 steps (#8). */
export const GRIDS_CORNERS = {
  c00: {
    kick: [255, 20, 60, 40, 240, 20, 50, 30],
    clap: [10, 20, 250, 30, 10, 20, 245, 40],
    hat: [220, 60, 210, 70, 220, 60, 210, 90],
  },
  c10: {
    kick: [255, 40, 50, 230, 120, 50, 215, 40],
    clap: [15, 30, 250, 40, 20, 90, 245, 60],
    hat: [230, 160, 215, 80, 230, 150, 215, 175],
  },
  c01: {
    kick: [255, 30, 40, 110, 60, 225, 40, 80],
    clap: [10, 20, 130, 30, 250, 20, 140, 50],
    hat: [210, 90, 200, 90, 210, 110, 200, 130],
  },
  c11: {
    kick: [255, 80, 200, 235, 240, 95, 220, 150],
    clap: [20, 70, 255, 110, 30, 125, 250, 170],
    hat: [245, 195, 235, 185, 245, 200, 235, 215],
  },
};

/** 3 curated 1-click coordinates on the 2D Grids map (#8). */
export const GRIDS_MAP_SPOTS = [
  { id: "steady", label: "Steady walk", x: 0.15, y: 0.15, density: 0.45 },
  { id: "pocket", label: "Head nod", x: 0.8, y: 0.25, density: 0.55 },
  { id: "dance", label: "Full bounce", x: 0.85, y: 0.85, density: 0.68 },
];

export function emptyBeatGrid() {
  const grid = {};
  for (const lane of LANES) grid[lane.id] = Array(BEAT_STEPS).fill(null);
  return grid;
}

export function cloneBeatGrid(grid) {
  const next = emptyBeatGrid();
  for (const lane of LANES) {
    const src = grid?.[lane.id] || [];
    for (let i = 0; i < BEAT_STEPS; i++) next[lane.id][i] = src[i] || null;
  }
  return next;
}

/** Personal or confirmed-hummed pads are pin-locked during assistance. */
export function isPadPinned(grid, laneId, step) {
  return isOwn(grid?.[laneId]?.[step]);
}

/**
 * #6 Pin-and-Spin Groove Dice: rolls a fresh beat crate around any "user_placed" pads.
 * User-placed pads are never erased or relabeled.
 */
export function rollGrooveDice(grid, { seed = 0, stepsPerBar = 16 } = {}) {
  const BEAT_STEPS=stepsPerBar/2;
  const crates=stepsPerBar===12?[
    {id:'three-sway',label:'Three sway',kick:[0],clap:[2,4],hat:[1,3,5]},
    {id:'three-drive',label:'Three drive',kick:[0,2,4],clap:[4],hat:[0,1,2,3,4,5]},
    {id:'three-skip',label:'Three skip',kick:[0,3],clap:[2,5],hat:[1,3,5]},
  ]:GROOVE_CRATES;
  const next = cloneBeatGrid(grid);
  for(const lane of LANES)next[lane.id]=next[lane.id].slice(0,BEAT_STEPS);
  const len = crates.length;
  const idx = ((Math.trunc(Number(seed) || 0) % len) + len) % len;
  const crate = crates[idx];
  let lockedCount = 0;
  for (const lane of LANES) {
    if (!crate[lane.id]) continue; // The curated pattern edits its named lanes only.
    const activeSteps = new Set(crate[lane.id] || []);
    for (let s = 0; s < BEAT_STEPS; s++) {
      if (isPadPinned(next, lane.id, s)) {
        lockedCount += 1;
        continue;
      }
      next[lane.id][s] = activeSteps.has(s) ? "seed_template" : null;
    }
  }
  return { grid: next, crateId: crate.id, label: crate.label, lockedCount };
}

/**
 * #7 Clean-room Toussaint (2005) / Bjorklund Euclidean rhythm generator `euclid(k, n, rotation)`.
 * Distributes `k` pulses as evenly as possible across `n` steps and circularly rotates by `rotation`.
 */
export function euclid(k, n = BEAT_STEPS, rotation = 0) {
  const steps = Math.max(1, Math.trunc(Number(n) || BEAT_STEPS));
  const pulses = Math.max(0, Math.min(steps, Math.trunc(Number(k) || 0)));
  if (pulses === 0) return Array(steps).fill(false);
  if (pulses === steps) return Array(steps).fill(true);
  const base = Array(steps).fill(false);
  for (let i = 0; i < steps; i++) {
    base[i] = i === 0 || Math.floor((i * pulses) / steps) !== Math.floor(((i - 1) * pulses) / steps);
  }
  const rot = ((Math.trunc(Number(rotation) || 0) % steps) + steps) % steps;
  if (rot === 0) return base;
  const out = Array(steps).fill(false);
  for (let i = 0; i < steps; i++) {
    out[(i + rot) % steps] = base[i];
  }
  return out;
}

/** Apply a Euclidean pattern to one lane while respecting user-pinned pads (#7). */
export function applyEuclidLane(grid, laneId, k, n = BEAT_STEPS, rotation = 0, { respectPins = true } = {}) {
  const next = cloneBeatGrid(grid);
  if (!next[laneId]) return next;
  const pattern = euclid(k, n, rotation);
  for (let s = 0; s < BEAT_STEPS; s++) {
    if (respectPins && isPadPinned(next, laneId, s)) continue;
    next[laneId][s] = pattern[s % pattern.length] ? "seed_template" : null;
  }
  return next;
}

/** Apply a 3-lane Euclidean preset while respecting user-pinned pads (#7). */
export function applyEuclidPreset(grid, presetId, { respectPins = true } = {}) {
  const preset = EUCLID_PRESETS.find((p) => p.id === presetId) || EUCLID_PRESETS[0];
  let next = cloneBeatGrid(grid);
  for (const lane of LANES) {
    if (!preset[lane.id]) continue;
    const [k, n, rot] = preset[lane.id] || [2, BEAT_STEPS, 0];
    next = applyEuclidLane(next, lane.id, k, n, rot, { respectPins });
  }
  return next;
}

/**
 * #8 Clean-room bilinear interpolation over the 4 Grids corners at (x, y) in [0,1]^2.
 * Higher `density` in [0,1] lowers the activation threshold monotonically.
 */
export function interpolateGridsMap(x = 0.5, y = 0.5, density = 0.5) {
  const cx = Math.max(0, Math.min(1, Number(x) || 0));
  const cy = Math.max(0, Math.min(1, Number(y) || 0));
  const cd = Math.max(0, Math.min(1, Number(density) || 0));
  const threshold = (1 - cd) * 255;
  const out = {};
  for (const lane of LANES) {
    const id = lane.id;
    out[id] = Array(BEAT_STEPS).fill(false);
    if (!GRIDS_CORNERS.c00[id]) continue;
    for (let s = 0; s < BEAT_STEPS; s++) {
      const w =
        (1 - cx) * (1 - cy) * GRIDS_CORNERS.c00[id][s] +
        cx * (1 - cy) * GRIDS_CORNERS.c10[id][s] +
        (1 - cx) * cy * GRIDS_CORNERS.c01[id][s] +
        cx * cy * GRIDS_CORNERS.c11[id][s];
      out[id][s] = w >= threshold;
    }
  }
  return out;
}

/** Apply one of the 3 curated 2D Grids map spots around any user-pinned pads (#8). */
export function applyGridsSpot(grid, spotId, { respectPins = true } = {}) {
  const spot = GRIDS_MAP_SPOTS.find((s) => s.id === spotId) || GRIDS_MAP_SPOTS[0];
  const mask = interpolateGridsMap(spot.x, spot.y, spot.density);
  const next = cloneBeatGrid(grid);
  for (const lane of LANES) {
    if (!GRIDS_CORNERS.c00[lane.id]) continue;
    for (let s = 0; s < BEAT_STEPS; s++) {
      if (respectPins && isPadPinned(next, lane.id, s)) continue;
      next[lane.id][s] = mask[lane.id][s] ? "seed_template" : null;
    }
  }
  return next;
}

/** Read bar 1's drums into the 8-step grid (eighth-note positions). */
export function beatGridFromNotes(notes, stepsPerBar = 16) {
  const STEPS_PER_BAR=stepsPerBar;
  const grid = emptyBeatGrid();
  for(const lane of LANES)grid[lane.id]=grid[lane.id].slice(0,stepsPerBar/2);
  for (const n of notes || []) {
    if (n.role !== "drums") continue;
    const lane = PATCH_TO_LANE[n.patch_id];
    const step = Number(n.step || 0);
    if (!lane || step >= STEPS_PER_BAR || step % 2 !== 0) continue;
    // Keep the person's pin visible if multiple same-voice hits share a cell.
    if (!isOwn(grid[lane][step / 2])) grid[lane][step / 2] = n.provenance || "seed_template";
  }
  return grid;
}

/**
 * Apply changed grid cells across the four-bar phrase. Unchanged source events
 * retain their exact patch, identity and expression, including off-grid or extra
 * percussion that this small editor cannot display. The optional fill is additive.
 * Assistance callers must set protectOwn; direct erasing intentionally does not.
 */
export function notesFromBeatGrid(grid, otherNotes = [], { bar4Fill = false, protectOwn = false, stepsPerBar = 16 } = {}) {
  const STEPS_PER_BAR=stepsPerBar, BEAT_STEPS=stepsPerBar/2;
  const isFill = note => note.role === "drums" && note.provenance === "seed_template"
    && (note.generated_by === "musiclab_beat_fill" || /^drum-(kick|clap)-\d+-fill$/.test(note.id || ""));
  const source = otherNotes.filter(note => !isFill(note));
  const before = beatGridFromNotes(source, stepsPerBar);
  const changed = new Set();
  for (const lane of LANES) for (let i = 0; i < BEAT_STEPS; i++) {
    if ((grid[lane.id]?.[i] || null) !== before[lane.id][i]) changed.add(`${lane.id}:${i}`);
  }
  const protectedNote = note => protectOwn && isOwn(note.provenance);
  const affected = note => !protectedNote(note) && note.role === "drums" && note.step >= 0 && note.step < BARS * STEPS_PER_BAR
    && note.step % 2 === 0 && changed.has(`${PATCH_TO_LANE[note.patch_id]}:${(note.step % STEPS_PER_BAR) / 2}`);
  const result = source.filter(note => !affected(note));
  for (const lane of LANES) {
    (grid[lane.id] || []).forEach((cell, i) => {
      if (i>=BEAT_STEPS || !cell || !changed.has(`${lane.id}:${i}`)) return;
      for (let bar = 0; bar < BARS; bar++) {
        const step = bar * STEPS_PER_BAR + i * 2;
        const existing = source.filter(note => note.role === "drums" && note.step === step && PATCH_TO_LANE[note.patch_id] === lane.id);
        if (existing.length) {
          // Protected events are already in result, unchanged and only once.
          result.push(...existing.filter(note => !protectedNote(note)).map(note => ({ ...note, provenance: cell })));
          continue;
        }
        result.push({
          id: `drum-${lane.id}-${step}`,
          step,
          duration_steps: 1,
          velocity: lane.id === "hat" ? 0.7 : 0.9,
          role: "drums",
          patch_id: lane.patch,
          provenance: cell,
          concrete: { midi_pitch: lane.midi },
        });
      }
    });
  }
  const placedSteps = new Set(result.filter(note => note.role === "drums").map(note => `${PATCH_TO_LANE[note.patch_id]}:${note.step}`));
  if (bar4Fill) {
    const bar4Base = (BARS - 1) * STEPS_PER_BAR; // 48
    const fillEvents = [
      { lane: "kick", patch: "kick", midi: 36, offset: 8, velocity: 0.88 },
      { lane: "clap", patch: "clap", midi: 39, offset: 8, velocity: 0.72 },
      { lane: "clap", patch: "clap", midi: 39, offset: 10, velocity: 0.78 },
      { lane: "clap", patch: "clap", midi: 39, offset: 12, velocity: 0.84 },
      { lane: "kick", patch: "kick", midi: 36, offset: 14, velocity: 0.9 },
      { lane: "clap", patch: "clap", midi: 39, offset: 14, velocity: 0.9 },
      { lane: "clap", patch: "clap", midi: 39, offset: 15, velocity: 0.92 },
    ];
    for (const f of fillEvents) {
      if(f.offset>=stepsPerBar)continue;
      const step = bar4Base + f.offset;
      const key = `${f.lane}:${step}`;
      if (placedSteps.has(key)) continue;
      placedSteps.add(key);
      result.push({
        id: `drum-${f.lane}-${step}-fill`,
        step,
        duration_steps: 1,
        velocity: f.velocity,
        role: "drums",
        patch_id: f.patch,
        provenance: "seed_template",
        generated_by: "musiclab_beat_fill",
        concrete: { midi_pitch: f.midi },
      });
    }
  }
  return result;
}

/** Toggle one beat cell; a starter ("seed_template") pad becomes yours ("user_placed") on tap, and yours turns off. */
export function toggleBeatCell(grid, laneId, step) {
  const cur = grid[laneId][step];
  const next = cur === "user_placed" ? null : "user_placed";
  grid[laneId][step] = next;
  return Boolean(next);
}

/**
 * Swipe-to-paint (design: mode is fixed at pointer-down, so passing a pad twice can't undo it).
 * Starting on a user-placed pad erases; starting on an empty or starter ("seed_template") pad paints it as yours.
 */
export function startPaint(grid, laneId, step) {
  const mode = grid[laneId][step] === "user_placed" ? "erase" : "paint";
  const gesture = { mode, filling: mode === "paint", touched: new Set() };
  applyPaint(grid, gesture, laneId, step);
  return gesture;
}

/** Apply the gesture to one more pad; returns true if the pad changed. */
export function applyPaint(grid, gesture, laneId, step) {
  const key = `${laneId}:${step}`;
  if (gesture.touched.has(key)) return false;
  gesture.touched.add(key);
  const want = gesture.mode === "paint" ? "user_placed" : null;
  if (grid[laneId][step] === want) return false;
  grid[laneId][step] = want;
  return true;
}
