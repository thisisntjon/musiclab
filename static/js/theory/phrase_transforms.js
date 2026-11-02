/**
 * Shape the ending of the person's own phrase without replacing it (Phase 8.0, decision 1 + Phase 12b).
 * Mirror of src/theory_core/phrase_transforms.py; both are tested against the same fixture.
 * Each shape changes only the last note of each bar; ids and provenance are kept.
 *
 * Phase 12b adds:
 * - #2 Mutable Instruments Marbles "Déjà Vu" loop-locked mutator (`mutateDejaVu`, `DEJA_VU_MODES`)
 * - #14 BeepBox 1-click note transition decorators (`decoratePhraseNotes`, `NOTE_DECORATORS`)
 */

export const PHRASE_SHAPES = ["climb", "fall", "hang", "repeat", "leave_space"];
export const DEJA_VU_MODES = ["spin_notes", "spin_rhythm", "shuffle_loop"];
export const NOTE_DECORATORS = ["slide", "bounce", "sparkle"];

export const SHAPE_ACTIONS = {
  melody_climb: "climb",
  melody_fall: "fall",
  melody_hang: "hang",
  melody_repeat: "repeat",
  melody_silence_drop: "leave_space",
};

const SCALES = {
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
};

const STEPS_PER_BAR = 16;

const midiOf = (n) => (n.concrete && Number.isFinite(Number(n.concrete.midi_pitch)) ? Number(n.concrete.midi_pitch) : null);

function setMidi(n, midi) {
  n.pitch_lock_mode = "concrete";
  n.concrete = { ...(n.concrete || {}), midi_pitch: midi };
}

function barEndings(lead) {
  const endings = new Map();
  for (const n of [...lead].sort((a, b) => Number(a.step || 0) - Number(b.step || 0))) {
    endings.set(Math.floor(Number(n.step || 0) / STEPS_PER_BAR), n);
  }
  return endings;
}

export function transformPhraseEnding(leadNotes, shape, rootPc = 0, scaleType = "major") {
  if (!PHRASE_SHAPES.includes(shape)) throw new Error(`Unknown phrase shape: ${shape}`);
  const lead = JSON.parse(JSON.stringify(leadNotes || []));
  if (lead.length === 0) return lead;
  const pcs = (SCALES[scaleType] || SCALES.major).map((o) => (Number(rootPc) + o) % 12);
  const endings = barEndings(lead);
  const firstBar = Math.min(...endings.keys());
  const reference = endings.get(firstBar);

  for (const [bar, note] of endings) {
    const step = Number(note.step || 0);
    const barEnd = (bar + 1) * STEPS_PER_BAR;
    const midi = midiOf(note);
    const dur = Number(note.duration_steps || 1);
    let changed = false;
    if (shape === "climb" && midi !== null) {
      let m = midi + 1;
      while (!pcs.includes(((m % 12) + 12) % 12)) m += 1;
      setMidi(note, m);
      changed = true;
    } else if (shape === "fall" && midi !== null) {
      const home = midi - ((((midi - Number(rootPc)) % 12) + 12) % 12);
      if (home !== midi) {
        setMidi(note, home);
        changed = true;
      }
    } else if (shape === "hang") {
      const longer = Math.max(dur, barEnd - step);
      if (longer !== dur) {
        note.duration_steps = longer;
        changed = true;
      }
    } else if (shape === "repeat" && bar !== firstBar) {
      const refMidi = midiOf(reference);
      if (refMidi !== null) setMidi(note, refMidi);
      note.duration_steps = Math.max(1, Math.min(Number(reference.duration_steps || 1), barEnd - step));
      changed = true;
    } else if (shape === "leave_space" && (bar - firstBar) % 2 == 1) {
      if (dur !== 1) {
        note.duration_steps = 1;
        changed = true;
      }
    }
    if (changed) note.shaped_by = [...(note.shaped_by || []), shape];
  }
  return lead;
}

/**
 * #2 Mutable Instruments Marbles "Déjà Vu" loop-locked mutator.
 * Exact JS mirror of `mutate_deja_vu` in `src/theory_core/phrase_transforms.py`.
 */
export function mutateDejaVu(leadNotes, mode = "spin_notes", seed = 1) {
  if (!DEJA_VU_MODES.includes(mode)) throw new Error(`Unknown deja vu mode: ${mode}`);
  const lead = JSON.parse(JSON.stringify(leadNotes || []));
  if (lead.length === 0) return lead;

  const sVal = Math.max(1, Math.abs(Math.trunc(Number(seed) || 1)));
  const byBar = new Map();
  for (const n of [...lead].sort((a, b) => Number(a.step || 0) - Number(b.step || 0))) {
    const bar = Math.floor(Number(n.step || 0) / STEPS_PER_BAR);
    if (!byBar.has(bar)) byBar.set(bar, []);
    byBar.get(bar).push(n);
  }

  const tag = `deja_vu:${mode}`;
  for (const [bar, notes] of [...byBar.entries()].sort((a, b) => a[0] - b[0])) {
    const k = notes.length;
    if (k === 0) continue;
    const barBase = bar * STEPS_PER_BAR;
    if (mode === "spin_notes") {
      if (k >= 2) {
        const midis = notes.map(midiOf);
        const shift = ((sVal - 1) % (k - 1)) + 1;
        const rotated = notes.map((_, i) => midis[(i + shift) % k]);
        if (sVal % 2 === 0 && k >= 3) {
          const tmp = rotated[0];
          rotated[0] = rotated[k - 1];
          rotated[k - 1] = tmp;
        }
        notes.forEach((n, i) => {
          if (rotated[i] !== null) setMidi(n, Math.trunc(rotated[i]));
          n.shaped_by = [...(n.shaped_by || []), tag];
        });
      }
    } else if (mode === "spin_rhythm") {
      const shiftSteps = (((sVal - 1) % 3) + 1) * 2;
      const localSteps = notes.map((n) => ((Number(n.step || 0) - barBase) + shiftSteps) % STEPS_PER_BAR);
      const used = new Set();
      const resolved = [];
      for (const st of [...localSteps].sort((a, b) => a - b)) {
        let cand = st;
        while (used.has(cand) && used.size < STEPS_PER_BAR) {
          cand = (cand + 1) % STEPS_PER_BAR;
        }
        used.add(cand);
        resolved.push(cand);
      }
      resolved.sort((a, b) => a - b);
      notes.forEach((n, i) => {
        const nextCol = resolved[i];
        const nextColEnd = i + 1 < k ? resolved[i + 1] : STEPS_PER_BAR;
        n.step = barBase + nextCol;
        n.duration_steps = Math.max(1, Math.min(Number(n.duration_steps || 2), nextColEnd - nextCol));
        n.shaped_by = [...(n.shaped_by || []), tag];
      });
    } else if (mode === "shuffle_loop") {
      if (k >= 2) {
        const midis = notes.map(midiOf);
        const durs = notes.map((n) => Number(n.duration_steps || 2));
        let order = notes.map((_, i) => i);
        if (sVal % 2 === 1) {
          for (let i = 0; i < k - 1; i += 2) {
            const tmp = order[i];
            order[i] = order[i + 1];
            order[i + 1] = tmp;
          }
        } else {
          order = order.reverse();
        }
        notes.forEach((n, i) => {
          const srcIdx = order[i];
          if (midis[srcIdx] !== null) setMidi(n, Math.trunc(midis[srcIdx]));
          const nextCol = i + 1 < k ? Number(notes[i + 1].step || 0) - barBase : STEPS_PER_BAR;
          const curCol = Number(n.step || 0) - barBase;
          n.duration_steps = Math.max(1, Math.min(durs[srcIdx], nextCol - curCol));
          n.shaped_by = [...(n.shaped_by || []), tag];
        });
      }
    }
  }
  return lead;
}

/**
 * #14 BeepBox 1-click note transition decorators: `slide`, `bounce`, `sparkle`.
 * Exact JS mirror of `decorate_phrase_notes` in `src/theory_core/phrase_transforms.py`.
 */
export function decoratePhraseNotes(leadNotes, decorator) {
  if (decorator !== null && decorator !== undefined && !NOTE_DECORATORS.includes(decorator)) {
    throw new Error(`Unknown note decorator: ${decorator}`);
  }
  const lead = JSON.parse(JSON.stringify(leadNotes || []));
  if (lead.length === 0) return lead;

  const allHave = Boolean(decorator) && lead.every((n) => n.transition === decorator);
  const target = allHave ? null : decorator || null;
  const tag = decorator ? `decorator:${decorator}` : null;

  for (const n of lead) {
    const shaped = (n.shaped_by || []).filter((s) => !String(s).startsWith("decorator:"));
    if (target === null) {
      delete n.transition;
      if (shaped.length > 0) n.shaped_by = shaped;
      else delete n.shaped_by;
    } else {
      n.transition = target;
      n.shaped_by = tag ? [...shaped, tag] : shaped;
    }
  }
  return lead;
}
