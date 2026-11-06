/**
 * Harmony engine — an exact port of src/theory_core/harmony.py (Phase 9b, gate 9b-2: parity).
 * Functional chord states, minimal-motion voice leading in MIDI 48..76, the melody-first harmoniser,
 * and the clash rescue: chord tones a semitone from a held melody note are re-voiced; the melody never changes.
 * Keep this file and the Python module in step; tests/test_theory_core.py::HarmonyParityTest compares them.
 */

export const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export const SCALES = {
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
};

export const FUNCTIONAL_STATES = {
  1: { state: "home", state_label: "Home / Tonic Anchor", felt_effect: "Grounded center of gravity where phrases start or resolve.", suggested_next: [6, 7, 4, 5] },
  3: { state: "bittersweet_lift", state_label: "Relative Major Lift", felt_effect: "Opens up a wider, heroic horizon while sharing two tones with Home.", suggested_next: [6, 7, 4, 1] },
  4: { state: "subdominant_lift", state_label: "Forward Departure (Subdominant)", felt_effect: "Steps away from Home and creates forward momentum (Dorian bright lift if Major IV).", suggested_next: [7, 5, 1, 6] },
  5: { state: "dominant_tension", state_label: "High Tension / Pulls Home", felt_effect: "Strongest magnetic pull back to the Home chord (1).", suggested_next: [1, 6] },
  6: { state: "dark_departure", state_label: "Emotional / Cinematic Turn (VI)", felt_effect: "Lush, emotional shift that deepens the progression without losing stability.", suggested_next: [3, 7, 4, 5] },
  7: { state: "power_pickup", state_label: "Power Pickup (bVII)", felt_effect: "Energetic rock and electronic launchpad that drives back into Home (1).", suggested_next: [1, 3, 4] },
  2: { state: "pre_tension", state_label: "Stepping Stone (ii)", felt_effect: "Transitional tension that bridges into Dominant (5) or Power Pickup (7).", suggested_next: [5, 7, 1] },
};

export const CHORD_INTERVALS = {
  min: [0, 3, 7],
  maj: [0, 4, 7],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  power: [0, 7, 12],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

const mod12 = (x) => ((Math.trunc(x) % 12) + 12) % 12;
const has = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);
const pyRound = (x, places) => {
  const f = 10 ** places;
  return Math.round(x * f) / f;
};

export function midiToFreq(midi) {
  return pyRound(440.0 * Math.pow(2.0, (Number(midi) - 69.0) / 12.0), 4);
}

export function midiToName(midi) {
  const m = Math.trunc(Number(midi));
  return `${NOTE_NAMES[mod12(m)]}${Math.floor(m / 12) - 1}`;
}

export function chordPitchClasses(rootPc, scaleType, degree, quality = null) {
  const scale = SCALES[scaleType] || SCALES.natural_minor;
  const degIdx = (Math.max(1, Math.trunc(degree)) - 1) % scale.length;
  const chordRoot = mod12(Math.trunc(rootPc) + scale[degIdx]);
  if (quality && has(CHORD_INTERVALS, quality)) {
    return [chordRoot, CHORD_INTERVALS[quality].map((iv) => mod12(chordRoot + iv)), quality];
  }
  const thirdPc = mod12(Math.trunc(rootPc) + scale[(degIdx + 2) % scale.length]);
  const fifthPc = mod12(Math.trunc(rootPc) + scale[(degIdx + 4) % scale.length]);
  const inferred = mod12(thirdPc - chordRoot) === 4 ? "maj" : "min";
  return [chordRoot, [chordRoot, thirdPc, fifthPc], inferred];
}

/** Concrete MIDI pitch of a melody note (same resolution as the Python harmoniser). */
export function melodyNoteMidi(n, rootPc, scaleType) {
  if (n.pitch_lock_mode === "concrete" && n.concrete) return Math.trunc(n.concrete.midi_pitch ?? 60);
  if (n.concrete && has(n.concrete, "midi_pitch")) return Math.trunc(n.concrete.midi_pitch);
  if (has(n, "midi_pitch")) return Math.trunc(n.midi_pitch);
  const deg = Math.trunc((n.scale_lock || {}).degree ?? 1);
  const octOff = Math.trunc((n.scale_lock || {}).octave_offset ?? 0);
  const scale = SCALES[scaleType] || SCALES.major;
  const degIdx = (Math.max(1, deg) - 1) % scale.length;
  return 60 + mod12(rootPc) + scale[degIdx] + octOff * 12;
}

/** Pitch classes of held melody notes (a beat or longer), in every bar they sound in. Returns {bar: Set}. */
export function heldPcsByBar(melodyNotes, rootPc, scaleType = "major", bars = 4, stepsPerBar = 16) {
  const held = {};
  for (const n of melodyNotes || []) {
    if (!has(n, "step")) continue;
    const step = Math.trunc(n.step ?? 0);
    const dur = Math.trunc(n.duration_steps ?? 2);
    if (dur < 4 || step >= bars * stepsPerBar) continue;
    const pc = mod12(melodyNoteMidi(n, rootPc, scaleType));
    const lastBar = Math.min(bars - 1, Math.floor((step + dur - 1) / stepsPerBar));
    for (let b = Math.floor(step / stepsPerBar); b <= lastBar; b++) {
      (held[b] ||= new Set()).add(pc);
    }
  }
  return held;
}

function clashes(held, tone) {
  for (const h of held) {
    const d = mod12(h - tone);
    if (d === 1 || d === 11) return true;
  }
  return false;
}

/** Returns [soundingPcs, rescueLabel|null, bassPlaysFifth]. Same rules as rescue_chord_tones in Python. */
export function rescueChordTones(chordRootPc, chordPcs, held) {
  if (!held || held.size === 0 || chordPcs.length < 3) return [[...chordPcs], null, false];
  const root = mod12(chordPcs[0]);
  let third = mod12(chordPcs[1]);
  let fifth = mod12(chordPcs[2]);
  const labels = [];
  let bassFifth = false;
  const rootClash = clashes(held, root);
  if (clashes(held, third)) {
    const sus4 = mod12(root + 5);
    const sus2 = mod12(root + 2);
    let label;
    if (!clashes(held, sus4)) [third, label] = [sus4, "sus4"];
    else if (!clashes(held, sus2)) [third, label] = [sus2, "sus2"];
    else if (!rootClash) [third, label] = [root, "open5"];
    else [third, label] = [null, "open5"];
    labels.push(label);
  }
  if (clashes(held, fifth)) {
    fifth = rootClash ? null : root;
    labels.push(rootClash ? "no_fifth" : "root_for_fifth");
  }
  let upper = [rootClash ? null : root, third, fifth].filter((pc) => pc !== null);
  // a 7th (or other added tone) stays unless it clashes; a dropped one is named, never silent
  for (const extra of chordPcs.slice(3)) {
    if (clashes(held, mod12(extra))) labels.push("no_7th");
    else upper.push(mod12(extra));
  }
  if (rootClash) {
    labels.push("no_root");
    bassFifth = [...held].some((h) => mod12(h - root) === 1);
  }
  upper = upper.filter((pc) => !clashes(held, pc));
  if (!upper.length) {
    const sortedHeld = [...held].sort((a, b) => a - b);
    const safe = [mod12(root + 7), root, ...sortedHeld].filter((pc) => !clashes(held, pc));
    upper = safe.length ? [safe[0]] : [sortedHeld[0]];
  }
  return [upper, labels.length ? labels.join("+") : null, bassFifth];
}

export function generateCandidateVoicings(chordRootPc, chordPcs, held = null) {
  const uniquePcs = [];
  for (const pc of chordPcs) if (!uniquePcs.includes(mod12(pc))) uniquePcs.push(mod12(pc));
  const pad = mod12(chordRootPc + 7);
  let targetPcs = [...uniquePcs];
  while (targetPcs.length < 3) {
    if (held && held.size && clashes(held, pad)) {
      targetPcs.push(uniquePcs.length ? uniquePcs[(targetPcs.length - uniquePcs.length) % uniquePcs.length] : pad);
    } else {
      targetPcs.push(pad);
    }
  }
  targetPcs = targetPcs.slice(0, 3);

  const pool = targetPcs.map((pc) => {
    const ms = [];
    for (let m = 52; m < 75; m++) if (m % 12 === pc) ms.push(m);
    return ms;
  });
  const candidates = [];
  for (const n0 of pool[0]) {
    for (const n1 of pool[1]) {
      for (const n2 of pool[2]) {
        const v = [n0, n1, n2].sort((a, b) => a - b);
        if (new Set(v).size < 3) continue;
        if (v[0] < 48 || v[2] > 76) continue;
        if (v[1] - v[0] < 3 || v[2] - v[1] < 3) continue;
        if (v[2] - v[0] > 16) continue;
        candidates.push(v);
      }
    }
  }
  if (!candidates.length) {
    if (held && held.size) {
      const stacked = [];
      let m = 55;
      for (const pc of targetPcs) {
        m = m + (mod12(pc - m) || (stacked.length ? 12 : 0));
        if (m <= 76) stacked.push(m);
      }
      candidates.push(stacked);
    } else {
      let base = 60 + mod12(chordRootPc);
      if (base > 67) base -= 12;
      candidates.push([base, base + 3, base + 7]);
    }
  }
  return candidates;
}

const sum = (v) => v.reduce((a, b) => a + b, 0);
const motion = (v, prev) => {
  let s = 0;
  for (let i = 0; i < Math.min(v.length, prev.length); i++) s += Math.abs(v[i] - prev[i]);
  return s;
};
function argmin(items, key) {
  let best = items[0];
  let bestK = key(best);
  for (let i = 1; i < items.length; i++) {
    const k = key(items[i]);
    if (k < bestK) [best, bestK] = [items[i], k];
  }
  return best;
}

function defaultRoman(degree, quality) {
  const numerals = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII" };
  const base = numerals[degree] || "I";
  if (quality.startsWith("min")) return base.toLowerCase();
  if ([3, 6, 7].includes(degree) && ["maj", "maj7", "dom7", "power"].includes(quality)) return `b${base}`;
  return base;
}

/** heldByBar: {bar: Set<pc>} from heldPcsByBar, or null. */
export function voiceChordProgression(rootPc, scaleType, progression, voiceLeadingMode = "smooth", heldByBar = null) {
  const out = [];
  let prev = null;
  (progression || []).forEach((item, idx) => {
    const degree = Math.trunc(item.degree ?? 1);
    const [chordRootPc, chordPcs, resolvedQuality] = chordPitchClasses(rootPc, scaleType, degree, item.quality ?? null);
    const barNo = Math.trunc(item.bar ?? idx);
    const held = voiceLeadingMode !== "raw_block" ? (heldByBar || {})[barNo] || new Set() : new Set();
    const [soundingPcs, rescue, bassFifth] = rescueChordTones(chordRootPc, chordPcs, held);

    let best;
    let avgMotion;
    if (voiceLeadingMode === "raw_block") {
      const rootM = (idx % 2 === 0 ? 48 : 60) + chordRootPc;
      best = [rootM, rootM + (resolvedQuality.startsWith("min") ? 3 : 4), rootM + 7];
      avgMotion = prev === null ? 0.0 : pyRound(motion(best, prev) / best.length, 3);
    } else {
      const candidates = generateCandidateVoicings(chordRootPc, soundingPcs, held);
      if (prev === null) {
        best = argmin(candidates, (v) => Math.abs(sum(v) / v.length - 61.0) + 0.1 * (v[v.length - 1] - v[0]));
        avgMotion = 0.0;
      } else {
        const p = prev;
        best = argmin(candidates, (v) => motion(v, p) / v.length + 0.04 * Math.abs(sum(v) / v.length - 61.0));
        avgMotion = pyRound(motion(best, prev) / best.length, 3);
      }
    }
    prev = best;

    let bassMidi = 36 + (bassFifth ? mod12(chordPcs[2]) : chordRootPc);
    if (bassMidi > 43) bassMidi -= 12;
    if (bassMidi < 28) bassMidi += 12;

    const meta = FUNCTIONAL_STATES[degree] || FUNCTIONAL_STATES[1];
    let chordName = `${NOTE_NAMES[chordRootPc]}${resolvedQuality === "maj" ? "" : resolvedQuality === "min" ? "m" : resolvedQuality}`;
    if (rescue) {
      if (rescue.startsWith("sus4")) chordName = `${NOTE_NAMES[chordRootPc]}sus4`;
      else if (rescue.startsWith("sus2")) chordName = `${NOTE_NAMES[chordRootPc]}sus2`;
      else if (rescue.startsWith("open5")) chordName = `${NOTE_NAMES[chordRootPc]}5`;
      if (rescue.includes("no_root")) chordName += " (no root)";
    }
    const romanStr = item.roman || defaultRoman(degree, resolvedQuality);
    const shortFn = meta.state_label.split("/")[0].trim();
    out.push({
      bar: barNo,
      beats: Math.trunc(item.beats ?? 4),
      degree,
      roman: romanStr,
      roman_function_label: `${romanStr} · ${shortFn}`,
      quality: resolvedQuality,
      chord_name: chordName,
      chord_root_pc: chordRootPc,
      chord_pcs: chordPcs,
      sounding_pcs: soundingPcs,
      rescue,
      bass_midi: bassMidi,
      bass_note: midiToName(bassMidi),
      voiced_midi: best,
      voiced_names: best.map(midiToName),
      voiced_freqs: best.map(midiToFreq),
      avg_voice_motion_st: avgMotion,
      state: meta.state,
      state_label: meta.state_label,
      why_label: `${chordName} (${meta.state_label}): ${meta.felt_effect}`,
      suggested_next: meta.suggested_next,
    });
  });
  return out;
}

export const HARMONY_SPECS = [
  {
    id: "prog_pop_anthem",
    alt_id: "alt_anthemic_lift",
    mood: "warm",
    title: "Warm & Grounded",
    summary: "Wraps your melody in home-base chords so every phrase feels solid and resolved.",
    why: "Fits warm home chords directly underneath the longest notes of your melody.",
  },
  {
    id: "prog_warm_story",
    alt_id: "alt_warm_story",
    mood: "floating",
    title: "Floating & Deep",
    summary: "Shifts the chords underneath your exact same melody for a deeper, bittersweet color.",
    why: "Keeps your melody untouched while changing the underlying chords to a deeper emotional shade.",
  },
  {
    id: "prog_minor_lift",
    alt_id: "alt_soul_turnaround",
    mood: "driving",
    title: "Driving & Bold",
    summary: "Pushes forward underneath your melody and builds strong momentum back to the start.",
    why: "Uses forward-leaning chords on the final bar so your melody pulls strongly into the next section.",
  },
];

/** Melody-first harmoniser: 3 four-bar progressions that fit under the person's unchanged melody. */
export function harmonizeMelodyPhrase(melodyNotes, rootPc, scaleType = "major", pinnedBars = null, cycle = 16) {
  const isMajor = scaleType === "major";
  const pool = isMajor
    ? [
        { degree: 1, roman: "I", quality: "maj" },
        { degree: 2, roman: "ii", quality: "min" },
        { degree: 3, roman: "iii", quality: "min" },
        { degree: 4, roman: "IV", quality: "maj" },
        { degree: 5, roman: "V", quality: "maj" },
        { degree: 6, roman: "vi", quality: "min" },
      ]
    : [
        { degree: 1, roman: "i", quality: "min" },
        { degree: 3, roman: "bIII", quality: "maj" },
        { degree: 4, roman: "iv", quality: "min" },
        { degree: 5, roman: "v", quality: "min" },
        { degree: 6, roman: "bVI", quality: "maj" },
        { degree: 7, roman: "bVII", quality: "maj" },
      ];

  const barNotes = { 0: [], 1: [], 2: [], 3: [] };
  for (const n of melodyNotes || []) {
    let barIdx;
    let dur;
    let beatInBar;
    if (has(n, "step")) {
      const stepVal = Math.trunc(n.step ?? 0);
      if (stepVal >= 4*cycle) continue;
      barIdx = Math.max(0, Math.min(3, Math.floor(stepVal / cycle)));
      dur = Number(n.duration_steps ?? 2) / 4.0;
      beatInBar = (stepVal % cycle) / 4.0;
    } else {
      const beat = Number(n.start_beat ?? 0.0);
      if (beat >= cycle) continue;
      barIdx = Math.max(0, Math.min(3, Math.floor(beat / (cycle/4))));
      dur = Number(n.duration_beats ?? 1.0);
      beatInBar = ((beat % (cycle/4)) + cycle/4) % (cycle/4);
    }
    const weight = dur * (beatInBar % 2.0 === 0.0 ? 1.5 : 1.0);
    const midiP = melodyNoteMidi(n, rootPc, scaleType);
    barNotes[barIdx].push([mod12(midiP), weight]);
    if (has(n, "step")) {
      const endStep = Math.trunc(n.step ?? 0) + Math.trunc(n.duration_steps ?? 2);
      for (let later = barIdx + 1; later < Math.min(4, Math.floor((endStep - 1) / cycle) + 1); later++) {
        barNotes[later].push([mod12(midiP), (Math.min(endStep, (later + 1) * cycle) - later * cycle) / 4.0]);
      }
    }
  }

  const scoreCandidate = (cand, barIdx, mood) => {
    const [cRoot, cPcs] = chordPitchClasses(rootPc, scaleType, cand.degree, cand.quality);
    let score = 0.0;
    for (const [pc, w] of barNotes[barIdx] || []) {
      if (pc === cRoot) score += 3.5 * w;
      else if (cPcs.includes(pc)) score += 2.6 * w;
      else if (cPcs.some((cp) => mod12(pc - cp) === 1)) score -= 50.0;
      else score += 0.6 * w;
    }
    const deg = cand.degree;
    if (mood === "warm") {
      if (barIdx === 0 && deg === 1) score += 4.0;
      else if (barIdx === 3 && (deg === 4 || deg === 5)) score += 2.2;
      if ([1, 4, 5].includes(deg)) score += 1.2;
    } else if (mood === "floating") {
      if (barIdx === 0 && [6, 4, 3].includes(deg)) score += 3.5;
      if ([6, 4, 2, 3].includes(deg)) score += 1.5;
    } else if (mood === "driving") {
      if (barIdx === 0 && [6, 2, 4, 7].includes(deg)) score += 2.8;
      else if (barIdx === 3 && [5, 7].includes(deg)) score += 3.2;
      if ([5, 7, 6, 3].includes(deg)) score += 1.3;
    }
    return pyRound(score, 4);
  };

  const pinnedLookup = {};
  if (pinnedBars && typeof pinnedBars === "object") {
    for (const [k, v] of Object.entries(pinnedBars)) {
      const bKey = Number(k);
      if (Number.isInteger(bKey) && bKey >= 0 && bKey < 4 && v && typeof v === "object" && v.degree != null) {
        pinnedLookup[bKey] = v;
      }
    }
  }

  const buildProg = (mood, fallback, avoidFirst) => {
    const prog = [];
    let prevDeg = null;
    for (let b = 0; b < 4; b++) {
      let chosen;
      if (pinnedLookup[b]) {
        const pItem = pinnedLookup[b];
        const pDeg = Math.trunc(pItem.degree);
        chosen = pool.find((c) => c.degree === pDeg) || {
          degree: pDeg,
          roman: String(pItem.roman || "I"),
          quality: String(pItem.quality || (isMajor ? "maj" : "min")),
        };
      } else if (!barNotes[b].length) {
        chosen = pool.find((c) => c.degree === fallback[b]) || pool[0];
      } else {
        const key = (c) => scoreCandidate(c, b, mood) - (prevDeg === c.degree ? 2.0 : 0.0) - (b === 0 && avoidFirst.has(c.degree) ? 3.0 : 0.0);
        // stable sort, highest first (matches Python's sorted(..., reverse=True))
        chosen = pool.map((c, i) => [c, key(c), i]).sort((x, y) => y[1] - x[1] || x[2] - y[2])[0][0];
      }
      prevDeg = chosen.degree;
      prog.push({ bar: b, beats: cycle/4, degree: chosen.degree, roman: chosen.roman, quality: chosen.quality });
    }
    return prog;
  };

  const heldMap = heldPcsByBar(melodyNotes, rootPc, scaleType, 4, cycle);
  const usedFirst = new Set();
  const progWarm = buildProg("warm", isMajor ? [1, 5, 6, 4] : [1, 6, 3, 7], usedFirst);
  usedFirst.add(progWarm[0].degree);
  const progFloating = buildProg("floating", isMajor ? [6, 4, 1, 5] : [6, 4, 1, 7], usedFirst);
  usedFirst.add(progFloating[0].degree);
  const progDriving = buildProg("driving", isMajor ? [4, 5, 6, 5] : [1, 7, 6, 5], usedFirst);
  const progs = [progWarm, progFloating, progDriving];

  return HARMONY_SPECS.map((sp, i) => ({
    id: sp.id,
    alt_id: sp.alt_id,
    title: sp.title,
    summary: sp.summary,
    why: sp.why,
    progression: progs[i],
    voiced_chords: voiceChordProgression(rootPc, scaleType, progs[i], "smooth", heldMap),
  }));
}
