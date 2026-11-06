/**
 * Tune stage model: one melody note per column. The main phrase repeats before the chosen last-bar ending.
 * The source phrase defaults to four bars; scoped song parts may use one to four.
 * Phase 9b: 16 columns (sixteenth notes) shown a page at a time, the ending as its own tab (a copy of the main part
 * until the person changes it), phrase shapes on the ending only, and the note dial (lock / guide / free).
 * Phase 12b adds:
 * - #2 Mutable Instruments Marbles "Déjà Vu" loop-locked mutator (`DEJA_VU_CARDS`, `applyDejaVu`)
 * - #14 BeepBox 1-click note transition decorators (`NOTE_DECORATOR_CARDS`, `decorateTuneNote`, `activeDecorator`)
 * - #15 Non-drifting Bar-4 Ending Shaper with Before/After A/B toggle (`shapeEnding`, `activeEndingShape`)
 * - #19 3-Stop Safety & Mastery Dial post-placement shape marks (`classifyTuneNoteMark`)
 * - #20 Drag-to-hold sustain ribbons + cross-bar sustain (`startTunePaint`, `applyTunePaint`, `lengths`)
 */
import { BARS, STEPS_PER_BAR } from "./session_rules.js";
import { hasLeadCollisions } from "./event_tune.js";
import { transformPhraseEnding, mutateDejaVu, decoratePhraseNotes } from "./phrase_transforms.js";

export const TUNE_STEPS = 16;
const SCALES = {
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
};
const EASY_DEGREES = [0, 1, 2, 4, 5]; // 1, 2, 3, 5, 6 of the scale: no clashing half steps
export const DIAL_MODES = ["lock", "guide", "free"];

export const DEJA_VU_CARDS = [
  { id: "spin_notes", label: "Spin my notes", icon: "retry" },
  { id: "spin_rhythm", label: "Move the steps", icon: "swap" },
  { id: "shuffle_loop", label: "Mix my tune", icon: "sparkle" },
];

export const NOTE_DECORATOR_CARDS = [
  { id: "slide", label: "Slide", icon: "climb" },
  { id: "bounce", label: "Bounce", icon: "bolt" },
  { id: "sparkle", label: "Sparkle", icon: "sparkle" },
];

const pcOf = (m) => ((Number(m) % 12) + 12) % 12;

/**
 * Rows to show, low to high, for the note dial:
 * - lock: the easy five notes from home upward
 * - guide: all seven notes of the scale (rows that clash with the chords are marked, see clashingRows)
 * - free: all twelve notes from home upward
 * plus any other notes the person already has (a hummed note is shown where it is, never moved to fit).
 */
export function tuneRows(rootPc = 0, scaleType = "major", existingMidis = [], mode = "lock") {
  const offsets = SCALES[scaleType] || SCALES.major;
  const home = 60 + (Number(rootPc) % 12);
  const picks =
    mode === "free" ? [...Array(12).keys()] : mode === "guide" ? offsets : EASY_DEGREES.map((d) => offsets[d]);
  const rows = new Set(picks.map((o) => home + o));
  for (const m of existingMidis) if (Number.isFinite(m)) rows.add(m);
  return [...rows].sort((a, b) => a - b);
}

/** Rows a semitone above a chord tone of any of the given chords (the dial's "guide" marks these). */
export function clashingRows(rows, chordPcsList) {
  return rows.filter((m) => chordPcsList.some((pcs) => pcs.some((c) => (((m - c) % 12) + 12) % 12 === 1)));
}

/**
 * #19 Post-placement non-color shape marks (`●` fits chord, `◇` step note, `▲` edge note).
 * Uses SVG icon names (`mark_anchor`, `mark_step`, `mark_edge`) and plain-language words.
 */
export function classifyTuneNoteMark(midi, rootPc = 0, scaleType = "major", chordPcsList = []) {
  const pc = pcOf(midi);
  const rPc = pcOf(rootPc);
  const scaleOffsets = SCALES[scaleType] || SCALES.major;
  const scalePcs = new Set(scaleOffsets.map((o) => pcOf(rPc + o)));
  const inChord = chordPcsList.some((pcs) => Array.isArray(pcs) && pcs.some((c) => pcOf(c) === pc));
  if (pc === rPc || pc === pcOf(rPc + 7) || inChord) {
    return { tier: "anchor", icon: "mark_anchor", word: "fits chord" };
  }
  if (scalePcs.has(pc)) {
    return { tier: "step", icon: "mark_step", word: "step note" };
  }
  return { tier: "edge", icon: "mark_edge", word: "edge note" };
}

/** Pages of columns for the screen width: 8 per page, or 4 on a phone. */
export function pageCount(pageSize) {
  return Math.ceil(TUNE_STEPS / pageSize);
}

const emptyRow = () => Array(TUNE_STEPS).fill(null);

function cloneCell(c) {
  if (!c) return null;
  const out = { midi: c.midi, provenance: c.provenance, duration_steps: Number(c.duration_steps || 2) };
  if (c.shaped_by) out.shaped_by = [...c.shaped_by];
  if (c.transition) out.transition = c.transition;
  if (c.velocity !== undefined) out.velocity = Number(c.velocity);
  if (c.gesture) out.gesture = JSON.parse(JSON.stringify(c.gesture));
  if (c.sourceNote) out.sourceNote = JSON.parse(JSON.stringify(c.sourceNote));
  return out;
}

function cellFromNote(note) {
  const cell = { midi: note.concrete?.midi_pitch, provenance: note.provenance || "seed_template",
    duration_steps: Number(note.duration_steps || 2) };
  if (note.shaped_by) cell.shaped_by = [...note.shaped_by];
  if (note.transition) cell.transition = note.transition;
  if (note.velocity !== undefined) cell.velocity = Number(note.velocity);
  if (note.gesture) cell.gesture = JSON.parse(JSON.stringify(note.gesture));
  return cell;
}

const cellValue = cell => cell ? {
  midi: cell.midi,
  provenance: cell.provenance || "seed_template",
  duration_steps: Number(cell.duration_steps || 2),
  velocity: cell.velocity === undefined ? .86 : Number(cell.velocity),
  shaped_by: cell.shaped_by || null,
  transition: cell.transition || null,
  gesture: cell.gesture || null,
} : null;

/** Upgrade saved grids using matching current notes, without inventing lost historical identity. */
export function hydrateTuneGridSources(grid, notes = []) {
  const next = JSON.parse(JSON.stringify(grid));
  const fill = (row, bar) => {
    for (let col = 0; col < (row || []).length; col++) {
      const cell = row[col];
      if (!cell || cell.sourceNote) continue;
      const note = notes.find(item => item.role === "lead" && item.step === bar * STEPS_PER_BAR + col
        && JSON.stringify(cellValue(cellFromNote(item))) === JSON.stringify(cellValue(cell)));
      if (note) cell.sourceNote = JSON.parse(JSON.stringify(note));
    }
  };
  const visit = (state, bars = BARS) => {
    const count = Number.isInteger(bars) && bars >= 1 && bars <= BARS ? bars : BARS;
    fill(state.main, 0);
    for (const key of ["ending", "baseEnding", "exploredEnding"]) fill(state[key], count - 1);
    for (const [length, history] of Object.entries(state.endingStates || {})) visit(history, Number(length));
  };
  visit(next, next.bars || BARS);
  const current = tuneGridFromNotes(notes, next.bars || BARS);
  if (["main", "ending"].some(key => (next[key] || []).some((cell,col) =>
    JSON.stringify(cellValue(cell)) !== JSON.stringify(cellValue(current[key][col]))))) next.eventEditor = true;
  return next;
}

/** The compact grid is truthful only for integer-timed, repeated main bars.
 * Identity is deliberately not compared: each repeat retains its own source ID.
 */
export function needsExactTuneEditor(notes, bars = BARS) {
  const lead = (notes || []).filter(n => n.role === "lead" && n.step >= 0 && n.step < bars * TUNE_STEPS);
  if (hasLeadCollisions(lead, bars)) return true;
  if (lead.some(n => !Number.isInteger(n.step) || !Number.isInteger(Number(n.duration_steps || 2))
    || (n.performance?.version === 1 && Number(n.performance.offset_steps || 0) !== 0))) return true;
  const ordered = [...lead].sort((a,b) => a.step-b.step);
  if (ordered.some((n,i) => i && n.step < ordered[i-1].step + Number(ordered[i-1].duration_steps || 2))) return true;
  const signature = bar => JSON.stringify(lead.filter(n => Math.floor(n.step / TUNE_STEPS) === bar)
    .sort((a,b) => a.step-b.step).map(n => [n.step % TUNE_STEPS, cellValue(cellFromNote(n)), n.patch_id || null]));
  const first = signature(0);
  return Array.from({length: Math.max(0,bars-2)}, (_,i) => i+1).some(bar => signature(bar) !== first);
}

/** Read the main phrase and chosen last bar; each cell contains pitch, provenance and expression. */
export function tuneGridFromNotes(notes, bars = BARS) {
  const main = emptyRow();
  const ending = emptyRow();
  for (const n of notes || []) {
    if (n.role !== "lead") continue;
    const step = Number(n.step || 0);
    const midi = n.concrete?.midi_pitch;
    if (!Number.isFinite(midi)) continue;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const col = step % STEPS_PER_BAR;
    const cell = { ...cellFromNote(n), sourceNote: JSON.parse(JSON.stringify(n)) };
    if (bar === 0) main[col] = cell;
    if (bar === bars - 1) ending[col] = cell;
  }
  return { main, ending, bars };
}

/** Switch the last-bar editor without moving notes; keep each length's A/B history. */
export function tuneGridForBars(grid, notes, bars = BARS) {
  const target = Number.isInteger(bars) && bars >= 1 && bars <= BARS ? bars : BARS;
  if ((grid.bars || BARS) === target) return grid;
  const history = JSON.parse(JSON.stringify(grid.endingStates || {}));
  const fields = ["baseEnding", "exploredEnding", "exploredShape", "activeShape", "endingVersion"];
  history[grid.bars || BARS] = Object.fromEntries(fields.filter(key => grid[key] !== undefined).map(key => [key, grid[key]]));
  return { ...tuneGridFromNotes(notes, target), ...history[target], endingStates: history,
    ...(grid.eventEditor ? { eventEditor: true } : {}) };
}

/** Apply an explicit instrument choice to saved A/B origins as well as the live notes. */
export function retimbreTuneGrid(grid, patchId) {
  const next = JSON.parse(JSON.stringify(grid));
  const update = state => {
    for (const key of ["main", "ending", "baseEnding", "exploredEnding"]) {
      for (const cell of state[key] || []) {
        if (cell?.sourceNote?.role === "lead") cell.sourceNote.patch_id = patchId;
      }
    }
    for (const history of Object.values(state.endingStates || {})) update(history);
  };
  update(next);
  return next;
}

/**
 * A note lasts its own length, but never past the next note in the bar (the lead plays one note at a time).
 * #20: If there is no later note in the same bar (`next === TUNE_STEPS`), allow the note to sustain across
 * the barline up to `2 * TUNE_STEPS - col` so cross-bar harmonic clash rescue (`sus2`/`sus4`) engages.
 */
function lengths(cells) {
  return cells.map((cell, col) => {
    if (!cell) return 0;
    let next = col + 1;
    while (next < TUNE_STEPS && !cells[next]) next++;
    const maxLen = next < TUNE_STEPS ? next - col : 2 * TUNE_STEPS - col;
    return Math.max(1, Math.min(Number(cell.duration_steps || 2), maxLen));
  });
}

/** Write active bars only; ending-only edits retain all other notes, including hidden later bars. */
export function notesFromTuneGrid(grid, otherNotes = [], patchId = "pluck_lead", { endingOnly = false } = {}) {
  const { main, ending } = grid;
  const bars = grid.bars || BARS;
  const before = tuneGridFromNotes(otherNotes, bars);
  const changedColumns = (wanted, previous) => new Set(Array.from({ length: TUNE_STEPS }, (_, col) => col)
    .filter(col => JSON.stringify(cellValue(wanted[col])) !== JSON.stringify(cellValue(previous[col]))));
  const mainChanges = endingOnly ? new Set() : changedColumns(main, before.main);
  const endingChanges = changedColumns(ending || main, before.ending);
  if ((mainChanges.size || endingChanges.size) && (grid.eventEditor || hasLeadCollisions(otherNotes, bars))) {
    throw new Error("Edit these notes one at a time.");
  }
  const isAffected = note => {
    if (note.role !== "lead" || note.step < 0 || note.step >= bars * STEPS_PER_BAR) return false;
    const bar = Math.floor(note.step / STEPS_PER_BAR);
    return (bar === bars - 1 ? endingChanges : mainChanges).has(note.step % STEPS_PER_BAR);
  };
  // A compact repeated-phrase editor must not regenerate untouched captured notes.
  // Preserve their identities, per-bar variations, expression and generation tags.
  const retained = otherNotes.filter(note => !isAffected(note));
  const lead = [];
  const write = (cells, bar, changed) => {
    const lens = lengths(cells);
    cells.forEach((cell, col) => {
      if (!cell || !changed.has(col)) return;
      const step = bar * STEPS_PER_BAR + col;
      const maxBarRemain = BARS * STEPS_PER_BAR - step;
      const source = cell.sourceNote || null;
      const original = source && Math.floor(source.step / STEPS_PER_BAR) === bar ? source : null;
      if (original?.step === step && JSON.stringify(cellValue(cell)) === JSON.stringify(cellValue(cellFromNote(original)))) {
        // A/B restoration may bring back a note removed by the alternative.
        // Explicit sound changes update saved origins through retimbreTuneGrid.
        lead.push(JSON.parse(JSON.stringify(original)));
        return;
      }
      const note = {
        ...(source ? JSON.parse(JSON.stringify(source)) : {}),
        id: original?.id || `tune-${step}`,
        step,
        // A pitch/articulation edit must not quantize a captured gate or tail.
        // A duration-changing operation still supplies its new ordinary value.
        duration_steps: source?.performance?.version === 1
          ? Number(cell.duration_steps || 2) : Math.max(1, Math.min(lens[col], maxBarRemain)),
        velocity: cell.velocity !== undefined ? Number(cell.velocity) : 0.86,
        role: "lead",
        patch_id: source?.patch_id || patchId,
        pitch_lock_mode: "concrete",
        provenance: cell.provenance,
        concrete: { midi_pitch: cell.midi },
      };
      // These fields describe the current edit, not immutable capture metadata.
      for (const field of ["shaped_by", "transition", "gesture"]) delete note[field];
      // Once intentionally edited, a supplied cell must not be regenerated away.
      delete note.generated_by;
      if (cell.shaped_by) note.shaped_by = [...cell.shaped_by];
      if (cell.transition) note.transition = cell.transition;
      if (cell.gesture) note.gesture = JSON.parse(JSON.stringify(cell.gesture));
      lead.push(note);
    });
  };
  if (!endingOnly) for (let bar = 0; bar < bars - 1; bar++) write(main, bar, mainChanges);
  write(ending || main, bars - 1, endingChanges);
  return [...retained, ...lead];
}

/** Toggle one cell of the main part (one note per column). The ending follows until it has been changed on its own. */
export function toggleTuneCell(grid, col, midi, { endingFollowsMain = true } = {}) {
  const cur = grid.main[col];
  const next = cur && cur.midi === midi ? null : { midi, provenance: "user_placed", duration_steps: 2 };
  grid.main[col] = next;
  if (endingFollowsMain) {
    grid.ending[col] = next ? { ...next } : null;
    delete grid.baseEnding;
    delete grid.activeShape;
  }
  return next;
}

/** Toggle one cell of the chosen ending only. Keep parallel `baseEnding` intact when exploring. */
export function toggleEndingCell(grid, col, midi) {
  const cur = grid.ending[col];
  const next = cur && cur.midi === midi ? null : { midi, provenance: "user_placed", duration_steps: 2 };
  grid.ending[col] = next;
  if (grid.baseEnding) {
    grid.exploredEnding = grid.ending.map(cloneCell);
    grid.endingVersion = "explored";
  }
  return next;
}

/** Returns the currently active ending shape ("climb" | "fall" | "hang" | "breathe" | null) (#15). */
export function activeEndingShape(grid) {
  if (grid?.endingVersion === "original") return null;
  if (grid?.activeShape) return grid.activeShape;
  for (let i = TUNE_STEPS - 1; i >= 0; i--) {
    const c = grid?.ending?.[i];
    if (c && Array.isArray(c.shaped_by)) {
      const found = ["climb", "fall", "hang", "breathe"].find((s) => c.shaped_by.includes(s));
      if (found) return found;
    }
  }
  return null;
}

/**
 * Shape the ending (Phase 9b-5 + Phase 12b #15 + Parallel Musical Versions #1):
 * - Runs over bar 1 + bar 4 and keeps only bar 4 so bars 1-3 never change.
 * - Snapshots `baseEnding` before the first shape so switching between `Climb`, `Fall home`, and `Leave space`
 *   never cumulatively drifts upward in pitch, and reshaping individual notes keeps `baseEnding` intact.
 * - Pressing the already-active shape card toggles back to `baseEnding` while keeping `exploredEnding`.
 */
export function shapeEnding(grid, shape, rootPc = 0, scaleType = "major") {
  const curActive = activeEndingShape(grid);
  const baseEnding = (grid.baseEnding || grid.ending || grid.main).map(cloneCell);
  if (curActive === shape && grid.baseEnding) {
    return {
      ...grid,
      main: grid.main.map(cloneCell),
      ending: baseEnding.map(cloneCell),
      baseEnding: baseEnding.map(cloneCell),
      exploredEnding: grid.ending.map(cloneCell),
      exploredShape: shape,
      activeShape: null,
      endingVersion: "original",
    };
  }
  const both = notesFromTuneGrid({ main: grid.main, ending: baseEnding }).filter(
    (n) => n.step < STEPS_PER_BAR || n.step >= (BARS - 1) * STEPS_PER_BAR
  );
  const shaped = transformPhraseEnding(both, shape === "breathe" ? "leave_space" : shape, rootPc, scaleType);
  const ending = emptyRow();
  for (const n of shaped) {
    if (n.step < (BARS - 1) * STEPS_PER_BAR) continue;
    const cell = { midi: n.concrete.midi_pitch, provenance: n.provenance, duration_steps: n.duration_steps };
    if (n.shaped_by) cell.shaped_by = n.shaped_by;
    if (n.transition) cell.transition = n.transition;
    if (n.velocity !== undefined) cell.velocity = n.velocity;
    if (n.gesture) cell.gesture = n.gesture;
    const sourceNote = baseEnding[n.step % STEPS_PER_BAR]?.sourceNote;
    if (sourceNote) cell.sourceNote = JSON.parse(JSON.stringify(sourceNote));
    ending[n.step % STEPS_PER_BAR] = cell;
  }
  return {
    ...grid,
    main: grid.main.map(cloneCell),
    ending,
    baseEnding,
    exploredEnding: ending.map(cloneCell),
    exploredShape: shape,
    activeShape: shape,
    endingVersion: "explored",
  };
}

/**
 * #1 Parallel musical versions (98/100):
 * Switch between the user's original ending ("original") and their explored/reshaped ending ("explored")
 * without losing hand edits on either version.
 */
export function switchEndingVersion(grid, version = "original") {
  if (!grid?.baseEnding && !grid?.exploredEnding) return grid;
  const curVersion = grid.endingVersion || (grid.activeShape ? "explored" : "original");
  if (version === curVersion) return grid;
  if (version === "original" && grid.baseEnding) {
    return {
      ...grid,
      main: grid.main.map(cloneCell),
      ending: grid.baseEnding.map(cloneCell),
      baseEnding: grid.baseEnding.map(cloneCell),
      exploredEnding: grid.ending.map(cloneCell),
      exploredShape: grid.activeShape || grid.exploredShape || null,
      activeShape: null,
      endingVersion: "original",
    };
  }
  if (version === "explored" && grid.exploredEnding) {
    return {
      ...grid,
      main: grid.main.map(cloneCell),
      ending: grid.exploredEnding.map(cloneCell),
      baseEnding: (grid.baseEnding || grid.ending).map(cloneCell),
      exploredEnding: grid.exploredEnding.map(cloneCell),
      activeShape: grid.exploredShape || grid.activeShape || null,
      endingVersion: "explored",
    };
  }
  return grid;
}

/**
 * #2 Apply Mutable Instruments Marbles "Déjà Vu" loop-locked mutator to the tune grid.
 * Preserves every note's provenance and pitch multiset (`spin_notes`, `shuffle_loop`) or pitch order (`spin_rhythm`).
 */
export function applyDejaVu(grid, mode = "spin_notes", seed = 1, tab = "main") {
  const targetRow = tab === "ending" ? grid.ending : grid.main;
  const barNotes = [];
  const lens = lengths(targetRow);
  targetRow.forEach((cell, col) => {
    if (!cell) return;
    const n = {
      id: `tune-${col}`,
      step: col,
      duration_steps: cell.sourceNote?.performance?.version === 1 ? cell.duration_steps : lens[col],
      velocity: cell.velocity !== undefined ? cell.velocity : 0.86,
      role: "lead",
      pitch_lock_mode: "concrete",
      provenance: cell.provenance,
      concrete: { midi_pitch: cell.midi },
    };
    if (cell.shaped_by) n.shaped_by = [...cell.shaped_by];
    if (cell.transition) n.transition = cell.transition;
    if (cell.gesture) n.gesture = JSON.parse(JSON.stringify(cell.gesture));
    if (cell.sourceNote) n.sourceNote = JSON.parse(JSON.stringify(cell.sourceNote));
    barNotes.push(n);
  });
  const mutated = mutateDejaVu(barNotes, mode, seed);
  const nextRow = emptyRow();
  for (const n of mutated) {
    const col = Number(n.step || 0) % STEPS_PER_BAR;
    const cell = {
      midi: n.concrete.midi_pitch,
      provenance: n.provenance,
      duration_steps: Number(n.duration_steps || 2),
    };
    if (n.shaped_by) cell.shaped_by = [...n.shaped_by];
    if (n.transition) cell.transition = n.transition;
    if (n.velocity !== undefined) cell.velocity = n.velocity;
    if (n.gesture) cell.gesture = n.gesture;
    if (n.sourceNote) cell.sourceNote = JSON.parse(JSON.stringify(n.sourceNote));
    nextRow[col] = cell;
  }
  return withTransformedRow(grid, nextRow, tab);
}

/** Keep saved alternatives and independent endings outside a transform's scope. */
function withTransformedRow(grid, row, tab) {
  if (tab === "ending") {
    return {
      ...grid, main: grid.main.map(cloneCell), ending: row,
      ...(grid.baseEnding ? { exploredEnding: row.map(cloneCell), endingVersion: "explored" } : {}),
    };
  }
  const follows = !grid.baseEnding && !grid.exploredEnding && !endingIsOwn(grid);
  return { ...grid, main: row, ending: follows ? row.map(cloneCell) : grid.ending.map(cloneCell) };
}

/** Returns the active transition decorator ("slide" | "bounce" | "sparkle" | null) on the grid (#14). */
export function activeDecorator(grid, tab = "main") {
  const row = (tab === "ending" ? grid?.ending : grid?.main) || [];
  const cells = row.filter(Boolean);
  if (!cells.length) return null;
  const first = cells[0].transition || null;
  return first && cells.every((c) => c.transition === first) ? first : null;
}

/** #14 Apply or toggle a BeepBox 1-click note transition decorator (`slide`, `bounce`, `sparkle`). */
export function decorateTuneNote(grid, decorator, tab = "main") {
  const applyRow = (row) => {
    const barNotes = [];
    row.forEach((cell, col) => {
      if (!cell) return;
      const n = {
        id: `tune-${col}`,
        step: col,
        duration_steps: Number(cell.duration_steps || 2),
        provenance: cell.provenance,
        concrete: { midi_pitch: cell.midi },
      };
      if (cell.shaped_by) n.shaped_by = [...cell.shaped_by];
      if (cell.transition) n.transition = cell.transition;
      if (cell.velocity !== undefined) n.velocity = cell.velocity;
      if (cell.gesture) n.gesture = JSON.parse(JSON.stringify(cell.gesture));
      if (cell.sourceNote) n.sourceNote = JSON.parse(JSON.stringify(cell.sourceNote));
      barNotes.push(n);
    });
    const decorated = decoratePhraseNotes(barNotes, decorator);
    const out = emptyRow();
    for (const n of decorated) {
      const col = Number(n.step || 0) % STEPS_PER_BAR;
      const cell = {
        midi: n.concrete.midi_pitch,
        provenance: n.provenance,
        duration_steps: Number(n.duration_steps || 2),
      };
      if (n.shaped_by) cell.shaped_by = [...n.shaped_by];
      if (n.transition) cell.transition = n.transition;
      if (n.velocity !== undefined) cell.velocity = n.velocity;
      if (n.gesture) cell.gesture = n.gesture;
      if (n.sourceNote) cell.sourceNote = JSON.parse(JSON.stringify(n.sourceNote));
      out[col] = cell;
    }
    return out;
  };
  return withTransformedRow(grid, applyRow(tab === "ending" ? grid.ending : grid.main), tab);
}

/** True when the ending differs from the main part (the person changed it on its own). */
export function endingIsOwn(grid) {
  return grid.main.some((c, i) => {
    const e = grid.ending[i];
    return Boolean(c) !== Boolean(e) || (c && e && (c.midi !== e.midi || (c.duration_steps || 2) !== (e.duration_steps || 2)));
  });
}

/**
 * Put a hummed bar (16-step draft notes) into the columns, keeping the person's pitches, lengths, velocity/gesture and provenance.
 * Two notes in the same sixteenth can't both fit; `dropped` says how many were left out so the person is told.
 */
export function tuneGridFromHum(draftNotes) {
  const main = emptyRow();
  let dropped = 0;
  for (const dn of draftNotes || []) {
    const col = Number(dn.step || 0) % STEPS_PER_BAR;
    const midi = dn.concrete?.midi_pitch ?? dn.snapped_midi;
    if (!Number.isFinite(midi)) continue;
    if (main[col]) {
      dropped += 1;
      continue;
    }
    const dur = Math.max(1, Math.min(STEPS_PER_BAR - col, Math.round(Number(dn.duration_steps || 2))));
    const cell = { midi, provenance: "hummed_confirmed", duration_steps: dur };
    if (dn.velocity !== undefined) cell.velocity = Number(dn.velocity);
    if (dn.gesture) cell.gesture = JSON.parse(JSON.stringify(dn.gesture));
    main[col] = cell;
  }
  return { main, ending: main.map(cloneCell), dropped };
}

/** True when the tune already has notes the person put there (tapped or hummed). */
export function hasOwnTuneNotes(grid) {
  return [...grid.main, ...grid.ending].some((c) => c && (c.provenance === "user_placed" || c.provenance === "hummed_confirmed"));
}

/**
 * Add a hummed tune without losing anything: hummed notes go only into empty columns; the person's existing
 * notes stay. Returns the merged grid and how many hummed notes didn't fit.
 */
export function mergeHumIntoTune(grid, humGrid) {
  const main = grid.main.map(cloneCell);
  let blocked = 0;
  humGrid.main.forEach((h, col) => {
    if (!h) return;
    if (main[col]) blocked += 1;
    else main[col] = cloneCell(h);
  });
  const ending = endingIsOwn(grid) ? grid.ending.map(cloneCell) : main.map(cloneCell);
  return { grid: { ...grid, main, ending }, blocked };
}

/** Optional supported lead voices; the simple opening does not require choosing one. */
export const LEAD_SOUNDS = [
  { id: "sampled_trumpet_v1", label: "Trumpet", icon: "note" },
  { id: "sampled_tenor_sax_v1", label: "Tenor sax", icon: "note" },
  { id: "sampled_harmonica_v1", label: "Harmonica", icon: "note" },
  { id: "sampled_clarinet_v1", label: "Clarinet", icon: "note" },
  { id: "sampled_ooh_v1", label: "Ooh vowels", icon: "note" },
  { id: "sampled_overdrive_guitar_v1", label: "Overdrive guitar", icon: "note" },
  { id: "sampled_organ_v1", label: "Tonewheel organ", icon: "note" },
  { id: "sampled_piano_v1", label: "Piano", icon: "keys" },
  { id: "sampled_electric_piano_v1", label: "Electric piano", icon: "keys" },
  { id: "sampled_strings_v1", label: "String ensemble", icon: "note" },
  { id: "sampled_steel_guitar_v1", label: "Steel-string guitar", icon: "note" },
  { id: "sampled_guitar_v1", label: "Guitar", icon: "note" },
  { id: "sampled_clean_guitar_v1", label: "Clean guitar", icon: "note" },
  { id: "sampled_banjo_v1", label: "Banjo", icon: "note" },
  { id: "sampled_bass_v1", label: "Finger bass", icon: "note" },
  { id: "pluck_lead", label: "Pluck", icon: "note" },
  { id: "warm_keys", label: "Keys", icon: "keys" },
  { id: "supersaw_stab", label: "Synth", icon: "bolt" },
];

/** Plain-language label for each row in the tune grid (high-to-low). */
export function tuneRowLabel(midi, rowsHighToLow, homeMidi = 60) {
  if (midi === homeMidi) return "Home";
  const idx = rowsHighToLow.indexOf(midi);
  if (rowsHighToLow.length === 5) {
    return ["Top", "High", "Mid", "Low", "Home"][idx] || "Note";
  }
  if (idx === 0) return "Top";
  if (idx === rowsHighToLow.length - 1) return "Low";
  return `Note ${rowsHighToLow.length - idx}`;
}

/**
 * Swipe-to-paint & drag-to-hold sustain ribbon gesture on the tune grid (`tab` is "main" or "ending").
 * #20: Dragging horizontally along the same MIDI pitch extends `startCol`'s `duration_steps` into a held ribbon.
 */
export function startTunePaint(grid, tab, col, midi, { endingFollowsMain = true } = {}) {
  const row = tab === "ending" ? grid.ending : grid.main;
  const cur = row[col];
  const filling = !(cur && cur.midi === midi);
  const gesture = { tab, filling, endingFollowsMain, startCol: col, startMidi: midi, seen: new Set() };
  applyTunePaint(grid, gesture, col, midi);
  return gesture;
}

export function applyTunePaint(grid, gesture, col, midi) {
  if (!gesture || col < 0 || col >= TUNE_STEPS) return false;
  const key = `${col}:${midi}`;
  if (gesture.seen.has(key)) return false;
  gesture.seen.add(key);
  const row = gesture.tab === "ending" ? grid.ending : grid.main;
  if (gesture.filling) {
    if (midi === gesture.startMidi && col > gesture.startCol && row[gesture.startCol]?.midi === midi) {
      const span = col - gesture.startCol + 1;
      row[gesture.startCol].duration_steps = Math.max(Number(row[gesture.startCol].duration_steps || 2), span);
      for (let c = gesture.startCol + 1; c <= col; c++) row[c] = null;
      if (gesture.tab !== "ending" && gesture.endingFollowsMain) {
        grid.ending[gesture.startCol] = cloneCell(row[gesture.startCol]);
        for (let c = gesture.startCol + 1; c <= col; c++) grid.ending[c] = null;
      }
      return true;
    }
    const next = { midi, provenance: "user_placed", duration_steps: 2 };
    row[col] = next;
    gesture.startCol = col;
    gesture.startMidi = midi;
    if (gesture.tab !== "ending" && gesture.endingFollowsMain) grid.ending[col] = cloneCell(next);
  } else if (row[col] && row[col].midi === midi) {
    row[col] = null;
    if (gesture.tab !== "ending" && gesture.endingFollowsMain) grid.ending[col] = null;
  } else {
    return false;
  }
  return true;
}

/** True when `col` is inside the held sustain tail of an earlier dragged note (`dur > 2`) on `midi` (#20). */
export function cellIsInsideSustain(row, col, midi) {
  if (!Array.isArray(row) || col <= 0) return false;
  for (let s = col - 1; s >= 0; s--) {
    const c = row[s];
    if (!c) continue;
    const dur = Math.max(1, Number(c.duration_steps || 2));
    return dur > 2 && c.midi === midi && s + dur > col;
  }
  return false;
}
