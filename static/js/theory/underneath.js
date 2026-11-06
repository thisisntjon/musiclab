import {stepsPerBar} from './musical_time.js';
/**
 * Underneath stage (Phase 9b, F-CORE-6 + Phase 12c #1, #9, #16).
 * Three feels, each a bundle of chords that fit the person's tune and a bass line. The details drawer swaps
 * the chords, pins individual bars (#1), chooses chord motion (`Hold chords`, `Ripple notes`, `Wide echo`, #9),
 * or selects call-and-response gap bass (`Answer my tune`, #16). Nothing here touches the person's tune.
 */
import { harmonizeMelodyPhrase } from "./harmony.js";
import { BARS, STEPS_PER_BAR } from "./session_rules.js";

const isPersonalBass = note => note.role === "bass"
  && ["user_placed", "hummed_confirmed"].includes(note.provenance);

export function bassInterval(note, doc) {
  const step = Number(note.step || 0);
  const performed = note.performance?.version === 1;
  const swing = doc.scaffold_options?.humanize === false ? .5
    : Math.max(.5, Math.min(.68, Number(doc.global_context?.swing || .52)));
  const offset = performed ? Number(note.performance.offset_steps || 0) : (step % 2 === 1 ? swing - .5 : 0);
  const start = step + offset;
  // Conservative union of browser and Python ordinary-note gates; both use
  // exact performed gates. Include the renderer's minimum ordinary duration.
  const duration = performed ? Number(note.duration_steps || 1)
    : Math.max(1, Number(note.duration_steps || 1), .035 * Number(doc.global_context?.bpm || 100) / 15);
  return [start, start + duration];
}

export const FEELS = [
  { id: "warm", label: "Warm", hint: "Full and soft", icon: "sun", chords: 0, bass: "bass_warm_sustained" },
  { id: "floating", label: "Floating", hint: "Light and open", icon: "cloud", chords: 1, bass: "bass_kick_lock" },
  { id: "driving", label: "Driving", hint: "Steady and strong", icon: "rocket", chords: 2, bass: "bass_driving_8ths" },
];

// The details drawer offers 3 low-note styles (T4 <= 3 options per group):
export const BASS_STYLES = [
  { id: "bass_kick_lock", label: "With the kick", hint: "With the drums" },
  { id: "bass_gap_answer", label: "Answer my tune", hint: "Fills the gaps" },
  { id: "bass_warm_sustained", label: "Long low notes", hint: "Long and low" },
];

// #9 Strudel Stereo `jux` Twin & Voiced Chord Ripple (`arp`) — 3 choices, <= 2 plain words each:
export const HARMONY_STYLES = [
  { id: "hold", label: "Hold chords", icon: "hold" },
  { id: "ripple", label: "Ripple notes", icon: "sparkle" },
  { id: "wide_echo", label: "Wide echo", icon: "cloud" },
];

/** The three chord options fitted to the person's tune (respecting any pinned bars, #1). */
export function chordOptions(doc) {
  const ctx = doc.global_context || {};
  const lead = (doc.notes || []).filter((n) => n.role === "lead" && n.concrete?.midi_pitch != null);
  return harmonizeMelodyPhrase(lead, Number(ctx.root_pc ?? 0), ctx.scale_type || "major", doc.pinned_chord_bars || null, stepsPerBar(doc));
}

/** #1 Toggle a per-bar chord pin on `doc.pinned_chord_bars` so switching Mood Crates keeps that bar locked. */
export function toggleBarPin(doc, barIdx) {
  const next = JSON.parse(JSON.stringify(doc));
  const b = Math.max(0, Math.min(3, Math.trunc(Number(barIdx) || 0)));
  const pins = { ...(next.pinned_chord_bars || {}) };
  if (pins[b]) {
    delete pins[b];
  } else {
    const prog = next.chord_progressions?.[next.active_progression_id || "prog-main"] || [];
    const cur = prog.find((p) => Number(p.bar) === b) || prog[b] || { bar: b, degree: 1, roman: "I", quality: "maj" };
    pins[b] = { degree: cur.degree, roman: cur.roman, quality: cur.quality };
  }
  if (Object.keys(pins).length > 0) next.pinned_chord_bars = pins;
  else delete next.pinned_chord_bars;
  return next;
}

/**
 * #16 Monophonic Bass Call-and-Response ("Answer my tune" gap filler).
 * Exact JS mirror of `generate_gap_answer_notes` in `src/theory_core/hocket.py`.
 */
export function gapAnswerBassNotes(leadNotes = [], drumNotes = [], bars = BARS, patchId = "clean_bass", cycle = 16) {
  const STEPS_PER_BAR=cycle;
  const totalSteps = bars * STEPS_PER_BAR;
  const occupied = Array(totalSteps).fill(false);
  for (const n of leadNotes || []) {
    if ((n.role || "lead") !== "lead") continue;
    const st = Math.max(0, Math.trunc(Number(n.step || 0)));
    const dur = Math.max(1, Math.trunc(Number(n.duration_steps || 2)));
    for (let s = st; s < Math.min(totalSteps, st + dur); s++) occupied[s] = true;
  }

  const out = [];
  const candidateOffsets = [8, 12, 4, 6, 10, 14, 0, 2];
  for (let bar = 0; bar < bars; bar++) {
    const bBase = bar * STEPS_PER_BAR;
    let placedInBar = 0;
    const barOcc = occupied.slice(bBase, bBase + STEPS_PER_BAR);
    for (const relStep of candidateOffsets) {
      if (placedInBar >= 2) break;
      if (relStep >= STEPS_PER_BAR || barOcc[relStep]) continue;
      let freeLen = 0;
      while (relStep + freeLen < STEPS_PER_BAR && !barOcc[relStep + freeLen]) freeLen += 1;
      if (freeLen < 2) continue;
      const dur = Math.min(4, freeLen);
      for (let s = relStep; s < relStep + dur; s++) barOcc[s] = true;
      const step = bBase + relStep;
      const ctIdx = placedInBar === 0 ? 0 : 2;
      const octOff = placedInBar === 1 && relStep >= 10 ? 1 : 0;
      out.push({
        id: `bass-gap-${step}`,
        step,
        duration_steps: dur,
        velocity: placedInBar === 0 ? 0.88 : 0.82,
        role: "bass",
        patch_id: patchId,
        pitch_lock_mode: "relational",
        provenance: "transformed_accepted",
        relational: {
          anchor: "chord_tone",
          chord_tone_index: ctIdx,
          scale_degree_offset: 0,
          octave_offset: octOff,
        },
      });
      placedInBar += 1;
    }
  }
  out.sort((a, b) => a.step - b.step);
  // Monophonic choke
  for (let i = 0; i < out.length - 1; i++) {
    out[i].duration_steps = Math.max(1, Math.min(out[i].duration_steps, out[i + 1].step - out[i].step));
  }
  return out;
}

/** Port of _build_bass_notes_for_style: relational chord tones that follow the chords (plus #16 gap answer). */
export function bassNotesForStyle(styleId, drumNotes, bars = BARS, patchId = "clean_bass", leadNotes = [], cycle = 16) {
  const STEPS_PER_BAR=cycle;
  if (styleId === "bass_gap_answer") {
    return gapAnswerBassNotes(leadNotes, drumNotes, bars, patchId, cycle);
  }
  const notes = [];
  const kicks = [...new Set((drumNotes || []).filter((n) => n.patch_id === "kick").map((n) => Number(n.step || 0) % cycle))].sort((a, b) => a - b);
  const kickOffsets = kicks.length ? kicks : [0, 8];
  const rel = (ct, oct = 0) => ({ anchor: "chord_tone", chord_tone_index: ct, scale_degree_offset: 0, octave_offset: oct });
  const note = (id, step, dur, vel, relational) => ({
    id, step, duration_steps: dur, velocity: vel, role: "bass", patch_id: patchId,
    pitch_lock_mode: "relational", provenance: "transformed_accepted", relational,
  });
  for (let bar = 0; bar < bars; bar++) {
    const b = bar * STEPS_PER_BAR;
    if (styleId === "bass_driving_8ths") {
      for (let sub = 0; sub < cycle; sub += 2) notes.push(note(`bass-8th-${b + sub}`, b + sub, 2, sub % 4 === 0 ? 0.88 : 0.76, rel(0)));
    } else if (styleId === "bass_funk_bounce") {
      for (const [sub, ct, oct, dur] of [[0, 0, 0, 3], [6, 2, 0, 2], [8, 0, 1, 3], [14, 1, 0, 2]]) {
        if(sub>=cycle)continue;
        notes.push(note(`bass-funk-${b + sub}`, b + sub, dur, 0.89, rel(ct, oct)));
      }
    } else if (styleId === "bass_warm_sustained") {
      for (const [sub, ct] of [[0, 0], [8, 2]]) notes.push(note(`bass-sust-${b + sub}`, b + sub, 8, 0.86, rel(ct)));
    } else {
      kickOffsets.forEach((k, i) => notes.push(note(`bass-lock-${b + k}`, b + k, 4, 0.9, rel(i === 0 ? 0 : 2))));
    }
  }
  return notes;
}

/**
 * Put chords and bass under the tune. `choice` is {feel, chords, bass, harmony_style}; options come from chordOptions(doc).
 * Returns the new doc (the old one is untouched, so the choice can be undone).
 */
export function applyUnderneath(doc, choice, options) {
  const next = JSON.parse(JSON.stringify(doc));
  const opt = options[choice.chords] || options[0];
  next.chord_progressions = { ...(next.chord_progressions || {}), "prog-main": opt.progression.map((p) => ({ ...p })) };
  next.active_progression_id = "prog-main";
  next.auto_harmony_stabs = true;
  const harmonyStyle =
    choice.harmony_style || choice.harmonyStyle || next.underneath?.harmony_style || next.underneath?.harmonyStyle || next.harmony_style || "hold";
  next.harmony_style = harmonyStyle;
  next.stereo_jux = harmonyStyle === "wide_echo";
  const drums = next.notes.filter((n) => n.role === "drums");
  const lead = next.notes.filter((n) => n.role === "lead");
  const retained = next.notes.filter(n => n.role !== "bass" || isPersonalBass(n));
  const protectedSpans = retained.filter(isPersonalBass).map(note => bassInterval(note, next));
  const usedIds = new Set(retained.map(n => n.id));
  const generated = bassNotesForStyle(choice.bass, drums, BARS, "clean_bass", lead, stepsPerBar(next))
    .filter(note => {
      const [start, end] = bassInterval(note, next);
      return !protectedSpans.some(([a, b]) => start < b && end > a);
    }).map(note => {
      let id = note.id;
      let suffix = 1;
      while (usedIds.has(id)) id = `${note.id}-under-${suffix++}`;
      usedIds.add(id);
      return { ...note, id, provenance: "generator_default", generated_by: "musiclab_underneath" };
    });
  next.notes = [...retained, ...generated];
  next.underneath = {
    feel: choice.feel || null,
    chords: choice.chords,
    bass: choice.bass,
    harmony_style: harmonyStyle,
    harmonyStyle,
  };
  return next;
}

/** Remove supplied accompaniment while retaining personal bass performances. */
export function clearUnderneath(doc) {
  const next = JSON.parse(JSON.stringify(doc));
  next.auto_harmony_stabs = false;
  next.harmony_style = "hold";
  next.stereo_jux = false;
  next.notes = next.notes.filter((n) => n.role !== "bass" || isPersonalBass(n));
  delete next.underneath;
  return next;
}

/** Chord names for a card, e.g. "C - G - Am - F" (shown only in the details drawer). */
export function chordNames(option) {
  return option.voiced_chords.map((c) => c.chord_name).join(" - ");
}
