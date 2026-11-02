/**
 * MusicLab Standalone Browser Compiler, Provenance Ledger, Melody-First Harmonizer & Transfer Study Engine
 * Enables 100% static Web App / PWA execution (GitHub Pages, desktop & mobile) with zero Python backend required,
 * while maintaining deterministic parity with `src/theory_core/`.
 */

import {sourceModeGuidance,alignIndividualSourceVoice} from '../js/theory/source_mode.js';
import {
  voiceChordProgression as engineVoiceChordProgression,
  harmonizeMelodyPhrase,
  heldPcsByBar,
} from "../js/theory/harmony.js";
import {stepsPerBar as projectStepsPerBar} from '../js/theory/musical_time.js';

export const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

// Version 1 opts into exact ordinary duration/velocity; only onset offset is
// additional state. Intentional note edits therefore remain authoritative.
function performedValues(note) {
  const source = note.performance;
  if (!source || typeof source !== "object" || Array.isArray(source) || source.version !== 1) return {};
  const number = value => typeof value === "number" && Number.isFinite(value);
  return {
    offset_steps: number(source.offset_steps) && source.offset_steps >= 0 && source.offset_steps < 1 ? source.offset_steps : 0,
    duration_steps: number(note.duration_steps) && note.duration_steps > 0 && note.duration_steps <= 64 ? note.duration_steps : 1,
    velocity: number(note.velocity) && note.velocity >= 0 && note.velocity <= 1 ? note.velocity : .85,
  };
}

export const SCALES = {
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
};

export const MONSTER_CHOKE_PATCHES = new Set([
  "monster_growl",
  "talking_yoi",
  "wobble_bass",
  "sub_drop_808",
  "laser_screech",
  "vocal_chop",
]);

export const METRIC_ACCENT_WEIGHTS = [
  1.12, 0.84, 0.94, 0.86,
  1.06, 0.85, 0.96, 0.88,
  1.09, 0.84, 0.95, 0.87,
  1.05, 0.86, 0.98, 0.91,
];

export const FUNCTIONAL_STATES = {
  1: { state: "home", state_label: "Home / Tonic Anchor", felt_effect: "Grounded center of gravity.", suggested_next: [4, 5, 6, 7] },
  2: { state: "bridge", state_label: "Bridge / Predominant", felt_effect: "Stepping-stone motion.", suggested_next: [5, 7, 1] },
  3: { state: "relative", state_label: "Bittersweet / Mediant", felt_effect: "Warm emotional expansion.", suggested_next: [6, 4, 7] },
  4: { state: "lift", state_label: "Subdominant Lift", felt_effect: "Opens the horizon away from home.", suggested_next: [5, 7, 1] },
  5: { state: "tension", state_label: "Dominant Tension", felt_effect: "Strong gravitational pull back to Home.", suggested_next: [1, 6] },
  6: { state: "lift", state_label: "Bittersweet / Anthem Lift", felt_effect: "Heroic lift (or relative minor depth).", suggested_next: [4, 7, 5, 1] },
  7: { state: "tension", state_label: "Subtonic Drive", felt_effect: "Driving cadence pushing into Bar 1.", suggested_next: [1, 3] },
};

export function midiToFreq(midi) {
  return Number((440.0 * Math.pow(2.0, (Number(midi) - 69.0) / 12.0)).toFixed(4));
}

export function midiToName(midi) {
  const m = Math.round(Number(midi));
  const pc = ((m % 12) + 12) % 12;
  const oct = Math.floor(m / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

/** Voicing now comes from the shared engine (an exact port of harmony.py, with the Phase 9b clash rescue). */
export function voiceChordProgression(rootPc, scaleType, progression, voiceLeadingMode = "smooth", heldByBar = null) {
  return engineVoiceChordProgression(rootPc, scaleType, progression, voiceLeadingMode, heldByBar);
}

export function classifyStepGravity(rootPc, scaleType, voicedChord) {
  const scaleOffsets = SCALES[scaleType] || SCALES.major;
  const scalePcs = scaleOffsets.map((o) => (Number(rootPc) + o) % 12);
  const chordPcs = voicedChord.chord_pcs.map((c) => Number(c) % 12);
  const chordRootPc = Number(voicedChord.chord_root_pc) % 12;
  const chordName = voicedChord.chord_name;

  const result = {};
  for (let pc = 0; pc < 12; pc++) {
    const noteName = NOTE_NAMES[pc];
    if (chordPcs.includes(pc)) {
      const roleIdx = chordPcs.indexOf(pc);
      const roleName =
        pc === chordRootPc
          ? "Chord Root (Strongest Anchor)"
          : roleIdx === 1
          ? "Chord 3rd (Emotional Color Anchor)"
          : "Chord 5th (Power Lock Anchor)";
      result[pc] = {
        pc,
        note_name: noteName,
        tier: "tier_1_anchor",
        shape_mark: "●",
        shape_kind: "filled_circle",
        pattern: "solid",
        is_avoid_clash: false,
        resolution_target_pc: pc,
        resolution_target_name: noteName,
        why_label: `${noteName} is the ${roleName} of ${chordName} — safe to land on strong beats or hold.`,
      };
    } else {
      let nearestChordPc = chordPcs[0];
      let minDist = 99;
      for (const c of chordPcs) {
        const d = Math.min((pc - c + 12) % 12, (c - pc + 12) % 12);
        if (d < minDist) {
          minDist = d;
          nearestChordPc = c;
        }
      }
      const targetName = NOTE_NAMES[nearestChordPc];
      if (scalePcs.includes(pc)) {
        const avoid = chordPcs.some((c) => (pc - c + 12) % 12 === 1);
        result[pc] = {
          pc,
          note_name: noteName,
          tier: "tier_2_tension",
          shape_mark: "◇",
          shape_kind: "hollow_diamond",
          pattern: "dashed",
          is_avoid_clash: avoid,
          resolution_target_pc: nearestChordPc,
          resolution_target_name: targetName,
          why_label: avoid
            ? `${noteName} is an in-scale Tension Clash (1 semitone above ${targetName} in ${chordName}) — resolve down to ${targetName}.`
            : `${noteName} is an in-scale Passing Tone over ${chordName} — resolves smoothly to ${targetName}.`,
        };
      } else {
        result[pc] = {
          pc,
          note_name: noteName,
          tier: "chromatic",
          shape_mark: "▲",
          shape_kind: "warning_triangle",
          pattern: "dotted",
          is_avoid_clash: true,
          resolution_target_pc: nearestChordPc,
          resolution_target_name: targetName,
          why_label: `${noteName} is outside the scale over ${chordName} — resolves by half-step to ${targetName}.`,
        };
      }
    }
  }
  return result;
}

// The old guide knows the three options by these ids; the engine's ids match the Python ones.
const OLD_GUIDE_OPTION_IDS = { prog_pop_anthem: "prog_anthem_lift", prog_warm_story: "prog_storyteller", prog_minor_lift: "prog_warm_sunset" };

export function harmonizeMelodyPhraseJS(melodyNotes, rootPc, scaleType = "major") {
  return harmonizeMelodyPhrase(melodyNotes, rootPc, scaleType).map((opt) => ({ ...opt, id: OLD_GUIDE_OPTION_IDS[opt.id] || opt.id }));
}

export function suggestHarmonyAlternatives(rootPc, scaleType = "major", melodyNotes = []) {
  const harmonized = harmonizeMelodyPhraseJS(melodyNotes, rootPc, scaleType);
  return harmonized.map((item, idx) => ({
    id: item.alt_id,
    wizard_id: item.id,
    title: `Option ${idx + 1}: ${item.title}`,
    summary: item.summary,
    why: item.why,
    progression: item.progression,
    voiced_chords: item.voiced_chords,
  }));
}

export function computeProvenanceSummary(songDoc, compiled = null) {
  const notes = songDoc?.notes || [];
  const graph = songDoc?.fluid_song_graph;
  const hasGraph = Boolean(graph && typeof graph === "object");
  const userDecisionsCount = hasGraph ? Number(graph.user_decisions_count || 0) : 0;
  const phraseShaped = hasGraph ? Boolean(graph.phrase_shaped) : false;

  const counts = {
    user_placed: 0,
    hummed_confirmed: 0,
    transformed_accepted: 0,
    seed_template: 0,
    scaffold_generated: 0,
  };
  const ledger = [];

  for (const n of notes) {
    const nid = String(n.id || "");
    let prov = String(n.provenance || "seed_template");
    if (!(prov in counts)) prov = "seed_template";
    if (
      hasGraph &&
      userDecisionsCount === 0 &&
      (prov === "user_placed" || prov === "transformed_accepted") &&
      (nid.startsWith("neutral-") ||
        nid.startsWith("heavybass-") ||
        nid.startsWith("drum-") ||
        nid.startsWith("bass-") ||
        nid.startsWith("lead-"))
    ) {
      prov = "seed_template";
    }
    counts[prov] += 1;
    ledger.push({
      id: nid,
      step: Number(n.step || 0),
      role: String(n.role || "lead"),
      patch_id: String(n.patch_id || ""),
      provenance: prov,
    });
  }

  if (compiled?.events) {
    for (const ev of compiled.events) {
      if (String(ev.id || "").startsWith("auto-stab-")) {
        counts.scaffold_generated += 1;
      }
    }
  }

  const total = notes.length;
  const directUser = counts.user_placed + counts.hummed_confirmed;
  const steeredUser = directUser + counts.transformed_accepted;
  const strictPct =
    total > 0
      ? Number(((directUser / total) * 100.0).toFixed(1))
      : hasGraph && userDecisionsCount === 0
      ? 0.0
      : 100.0;
  const authoredPct =
    total > 0
      ? Number(((steeredUser / total) * 100.0).toFixed(1))
      : hasGraph && userDecisionsCount === 0
      ? 0.0
      : 100.0;

  // Phase 9a, "one act makes it yours": zero acts of the person's own is never labelled theirs.
  const actsCount = Number(songDoc?.play_session?.acts_count || 0);
  const startBpm = Number(songDoc?.play_session?.start_bpm ?? 100);
  const tempoChanged = actsCount > 0 && Number(songDoc?.global_context?.bpm ?? startBpm) !== startBpm;
  // Something of the person's must be in the piece: their notes, a kept choice, a shaped phrase, or a chosen speed.
  // Phase 9b: a kit or feel the person picked by ear and kept is theirs too.
  const keptChoice = actsCount > 0 && Object.keys(songDoc?.play_session?.choices || {}).length > 0;
  const madeByYou = directUser > 0 || userDecisionsCount > 0 || Boolean(phraseShaped) || tempoChanged || keptChoice;
  const badgeLabel = madeByYou ? "Made by you" : "Starting point (make one change to make it yours)";

  return {
    total_canvas_notes: total,
    counts,
    user_decisions_count: userDecisionsCount,
    acts_count: actsCount,
    made_by_you: madeByYou,
    phrase_shaped: phraseShaped,
    strict_user_placed_pct: strictPct,
    authored_by_you_pct: authoredPct,
    meets_study_50pct_bar: strictPct >= 50.0,
    not_ai_slop_verified: true,
    ai_audio_generated_pct: 0.0,
    badge_label: badgeLabel,
    ledger,
  };
}

export function compileSongStandalone(songDoc, scaffoldOptions = null) {
  const opts = { ...(songDoc.scaffold_options || {}), ...(scaffoldOptions || {}) };
  const voiceLeadingMode = opts.voice_leading || "smooth";
  const hocketChokeEnabled = opts.hocket_choke !== false;
  const humanizeEnabled = opts.humanize !== false;
  const preDropSilenceEnabled = opts.pre_drop_silence !== false;
  const harmonyDisplayMode = opts.harmony_display_mode || "post_placement";

  const ctx = songDoc.global_context || {};
  const bpm = Number(ctx.bpm || 100.0);
  const swing = humanizeEnabled ? Math.max(0.5, Math.min(0.68, Number(ctx.swing || 0.52))) : 0.5;
  const rootPc = ((Number(ctx.root_pc ?? 0) % 12) + 12) % 12;
  const scaleType = ctx.scale_type || "major";
  const coreBars = Number(ctx.bars || 4);
  const stepsPerBar = projectStepsPerBar(songDoc);
  if(stepsPerBar!==16 && songDoc.arrangement_mode==='song' && songDoc.sections?.length)
    throw Error('Use song cards for this musical cycle; legacy arranger requires 4/4.');
  const stepSec = 60.0 / bpm / 4.0;

  const progMap = songDoc.chord_progressions || {};
  const rawProg = progMap[songDoc.active_progression_id || "prog-main"] || [
    { bar: 0, beats: 4, degree: 1, roman: "I", quality: "maj" },
    { bar: 1, beats: 4, degree: 5, roman: "V", quality: "maj" },
    { bar: 2, beats: 4, degree: 6, roman: "vi", quality: "min" },
    { bar: 3, beats: 4, degree: 4, roman: "IV", quality: "maj" },
  ];

  // Phase 9b: chord tones a semitone from a held melody note are re-voiced (same as compiler.py).
  const leadForRescue = (songDoc.notes || []).filter((n) => n.role === "lead" && n.concrete?.midi_pitch != null);
  const voicedChords = voiceChordProgression(rootPc, scaleType, rawProg, voiceLeadingMode, heldPcsByBar(leadForRescue, rootPc, scaleType, 4, stepsPerBar));
  const totalSteps = coreBars * stepsPerBar;

  const gravityByStep = [];
  for (let s = 0; s < totalSteps; s++) {
    const barIdx = Math.floor(s / stepsPerBar) % voicedChords.length;
    gravityByStep.push(classifyStepGravity(rootPc, scaleType, voicedChords[barIdx]));
  }

  let notes = JSON.parse(JSON.stringify(songDoc.notes || []));
  if (hocketChokeEnabled) {
    const nonChoke = [];
    const byStep = new Map();
    for (const n of notes) {
      if ((n.role === "hocket" || n.role === "bass") && MONSTER_CHOKE_PATCHES.has(n.patch_id)) {
        byStep.set(Number(n.step || 0), n);
      } else {
        nonChoke.push(n);
      }
    }
    const sortedSteps = Array.from(byStep.keys()).sort((a, b) => a - b);
    sortedSteps.forEach((st, idx) => {
      const n = byStep.get(st);
      if (idx + 1 < sortedSteps.length) {
        n.duration_steps = Math.max(1, Math.min(Number(n.duration_steps || 1), sortedSteps[idx + 1] - st));
      }
      nonChoke.push(n);
    });
    notes = nonChoke;
  }

  const scaleOffsets = SCALES[scaleType] || SCALES.major;
  const scalePcs = scaleOffsets.map((o) => (rootPc + o) % 12);
  const compiledEvents = [];
  const kickSteps = [];
  const snareSteps = [];
  let prevLeadFreqHz = null;
  const soundSeed = songDoc.sound_seed || null;
  const underCfg = songDoc.underneath || {};
  const harmonyStyle = songDoc.harmony_style || underCfg.harmony_style || "hold";
  const stereoJux = Boolean(songDoc.stereo_jux || harmonyStyle === "wide_echo");

  const sortedNotes = [...notes].sort((a, b) => Number(a.step || 0) - Number(b.step || 0));
  for (const n of sortedNotes) {
    const step = Number(n.step || 0);
    if (step < 0 || step >= totalSteps) continue;
    const barIdx = Math.floor(step / stepsPerBar) % voicedChords.length;
    const chord = voicedChords[barIdx];
    const gravStep = gravityByStep[step];
    const resolved = JSON.parse(JSON.stringify(n));
    resolved.provenance = resolved.provenance || "seed_template";
    const performed = performedValues(n);
    const hasPerformance = Object.keys(performed).length > 0;
    if (performed.velocity === 0) continue;

    if (resolved.role === "drums") {
      const m = Number(resolved.concrete?.midi_pitch || 36);
      resolved.concrete = { midi_pitch: m, freq_hz: midiToFreq(m), note_name: midiToName(m), micro_offset_ms: 0 };
      resolved.post_placement_mark = "●";
      resolved.post_placement_shape_kind = "filled_circle";
      resolved.drum_kit = hasPerformance && ["soft", "punchy", "tiny"].includes(n.drum_kit)
        ? n.drum_kit : songDoc.drum_kit || "punchy";
      if (resolved.patch_id === "kick") kickSteps.push(step);
      if (resolved.patch_id === "snare" || resolved.patch_id === "clap") snareSteps.push(step);
    } else {
      let midiPitch = 60;
      if (resolved.pitch_lock_mode === "concrete" && resolved.concrete?.midi_pitch != null) {
        midiPitch = Number(resolved.concrete.midi_pitch);
      } else {
        const rel = resolved.relational || {};
        const ctIdx = Number(rel.chord_tone_index || 0);
        const degOff = Number(rel.scale_degree_offset || 0);
        const octOff = Number(rel.octave_offset || 0);
        const tones = chord.sounding_pcs || chord.chord_pcs;
        let targetPc = tones[ctIdx % tones.length];
        if (degOff !== 0 && scalePcs.includes(targetPc)) {
          const sIdx = (scalePcs.indexOf(targetPc) + degOff + scalePcs.length) % scalePcs.length;
          targetPc = scalePcs[sIdx];
        }
        if (resolved.role === "bass" || ["monster_growl", "talking_yoi", "wobble_bass", "sub_drop_808", "clean_bass"].includes(resolved.patch_id)) {
          midiPitch = 24 + 12 * Math.max(0, Math.min(1, octOff + 1)) + targetPc;
          while (midiPitch < 24) midiPitch += 12;
          while (midiPitch > 47) midiPitch -= 12;
        } else {
          midiPitch = 60 + targetPc + 12 * Math.max(0, Math.min(1, octOff));
          while (midiPitch < 60) midiPitch += 12;
          while (midiPitch > 84) midiPitch -= 12;
        }
      }
      const pc = ((midiPitch % 12) + 12) % 12;
      const gInfo = gravStep[pc] || {};
      resolved.concrete = { midi_pitch: midiPitch, freq_hz: midiToFreq(midiPitch), note_name: midiToName(midiPitch), micro_offset_ms: 0 };
      alignIndividualSourceVoice(resolved);
      resolved.gravity_tier = gInfo.tier || "tier_1_anchor";
      resolved.post_placement_mark = gInfo.shape_mark || "●";
      resolved.post_placement_shape_kind = gInfo.shape_kind || "filled_circle";
      resolved.why_label = `${resolved.post_placement_mark} [${resolved.patch_id}] ${gInfo.why_label || ""}`;
      const sourceGuidance=sourceModeGuidance(resolved);
      if(sourceGuidance){
        delete resolved.gravity_tier;delete resolved.post_placement_mark;delete resolved.post_placement_shape_kind;
        resolved.why_label=sourceGuidance;
      }
    }

    const baseVel = Number(resolved.velocity || 0.85);
    resolved.velocity = performed.velocity ?? (humanizeEnabled
      ? Number(Math.max(0.18, Math.min(1.0, baseVel * METRIC_ACCENT_WEIGHTS[step % stepsPerBar])).toFixed(4))
      : 0.8);
    const swingDelay = step % 2 === 1 ? (swing - 0.5) * 2.0 * stepSec * 0.5 : 0.0;
    resolved.start_sec = Number((step * stepSec + (performed.offset_steps !== undefined ? performed.offset_steps * stepSec : swingDelay)).toFixed(6));
    resolved.duration_sec = performed.duration_steps !== undefined
      ? Number((performed.duration_steps * stepSec).toFixed(6))
      : Number(Math.max(0.035, Number(resolved.duration_steps || 1) * stepSec).toFixed(6));
    resolved.bar = Math.floor(step / stepsPerBar);
    if (soundSeed && !(hasPerformance && resolved.sound_seed) && (resolved.role === "lead" || resolved.role === "harmony")) {
      resolved.sound_seed = JSON.parse(JSON.stringify(soundSeed));
    }
    if (resolved.role === "lead") {
      const curFreq = Number(resolved.concrete?.freq_hz || 261.63);
      if (prevLeadFreqHz !== null) resolved.prev_freq_hz = Number(prevLeadFreqHz.toFixed(4));
      prevLeadFreqHz = curFreq;
      if (stereoJux) resolved.pan = -0.35;
    }
    compiledEvents.push(resolved);

    if (stereoJux && resolved.role === "lead") {
      const durSteps = Math.max(1, Number(resolved.duration_steps || 1));
      const juxStep = (step % stepsPerBar) + 2 < stepsPerBar ? step + 2 : step;
      const juxMidi = Math.min(84, Number(resolved.concrete?.midi_pitch || 60) + 12);
      const juxFreq = midiToFreq(juxMidi);
      const juxEv = {
        id: `auto-jux-${resolved.id || step}`,
        step: juxStep,
        bar: Math.floor(juxStep / stepsPerBar),
        duration_steps: Math.max(1, Math.min(2, durSteps)),
        start_sec: Number((juxStep * stepSec).toFixed(6)),
        duration_sec: Number(Math.max(0.05, Math.min(2, durSteps) * stepSec * 0.85).toFixed(6)),
        velocity: Number((Number(resolved.velocity || 0.8) * 0.42).toFixed(4)),
        role: "harmony",
        patch_id: resolved.patch_id || "pluck_lead",
        pitch_lock_mode: "concrete",
        provenance: "scaffold_generated",
        pan: 0.65,
        concrete: { midi_pitch: juxMidi, freq_hz: juxFreq, note_name: midiToName(juxMidi), micro_offset_ms: 0 },
      };
      if (soundSeed) juxEv.sound_seed = JSON.parse(JSON.stringify(soundSeed));
      compiledEvents.push(juxEv);
    }
  }

  // Auto harmony stabs
  const hasExplicitHarmony = compiledEvents.some((e) => e.role === "harmony" && !String(e.id || "").startsWith("auto-jux-"));
  if (songDoc.auto_harmony_stabs !== false && !hasExplicitHarmony) {
    const arpPattern = [0, 1, 2, 1, 0, 2, 1, 2];
    const subSteps = harmonyStyle === "ripple" ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 12];
    for (let bar = 0; bar < coreBars; bar++) {
      const vc = voicedChords[bar % voicedChords.length];
      subSteps.forEach((sub, idxSub) => {
        if(sub>=stepsPerBar)return;
        const s = bar * stepsPerBar + sub;
        const vMidis = vc.voiced_midi || [];
        const vFreqs = vc.voiced_freqs || [];
        const vNames = vc.voiced_names || [];
        let evMidis = vMidis;
        let evFreqs = vFreqs;
        let cMidi = vMidis[0];
        let cFreq = vFreqs[0];
        let cName = vNames[0];
        if (harmonyStyle === "ripple" && vMidis.length > 0) {
          const pick = arpPattern[idxSub % arpPattern.length] % vMidis.length;
          evMidis = [vMidis[pick]];
          evFreqs = [vFreqs[pick]];
          cMidi = vMidis[pick];
          cFreq = vFreqs[pick];
          cName = vNames[pick];
        }
        const stabEv = {
          id: `auto-stab-${s}`,
          step: s,
          bar,
          duration_steps: 2,
          start_sec: Number((s * stepSec).toFixed(6)),
          duration_sec: Number((2 * stepSec * 0.85).toFixed(6)),
          velocity: 0.76,
          role: "harmony",
          patch_id: songDoc.harmony_patch_id || "warm_keys",
          pitch_lock_mode: "relational",
          provenance: "scaffold_generated",
          post_placement_mark: "●",
          voiced_midi: evMidis,
          voiced_freqs: evFreqs,
          concrete: { midi_pitch: cMidi, freq_hz: cFreq, note_name: cName },
          why_label: vc.why_label,
        };
        if (soundSeed) stabEv.sound_seed = JSON.parse(JSON.stringify(soundSeed));
        compiledEvents.push(stabEv);
      });
    }
  }

  compiledEvents.sort((a, b) => a.start_sec - b.start_sec || a.step - b.step);

  const isSongMode = songDoc.arrangement_mode === "song";
  if (isSongMode) {
    const arcId = songDoc.selected_song_arc || "arc_radio_hit";
    const sectionBlueprints =
      arcId === "arc_early_lift"
        ? [
            { id: "sec_intro", name: "Opening", type: "intro", bars: 4, energy: 0.45, active_roles: ["drums", "harmony"] },
            { id: "sec_chorus_1", name: "Early Lift Chorus", type: "drop", bars: 4, energy: 0.96, active_roles: ["drums", "harmony", "bass", "lead"], lift: true },
            { id: "sec_verse", name: "Verse Groove", type: "verse", bars: 4, energy: 0.65, active_roles: ["drums", "bass", "lead"] },
            { id: "sec_build", name: "Rising Build", type: "build", bars: 4, energy: 0.78, active_roles: ["drums", "harmony", "lead"] },
            { id: "sec_chorus_2", name: "Main Chorus", type: "drop", bars: 4, energy: 1.0, active_roles: ["drums", "harmony", "bass", "lead"], lift: true },
            { id: "sec_bridge", name: "Breathing Bridge", type: "breakdown", bars: 4, energy: 0.42, active_roles: ["harmony", "lead"] },
            { id: "sec_outro", name: "Warm Return", type: "outro", bars: 4, energy: 0.35, active_roles: ["drums", "harmony"] },
          ]
        : arcId === "arc_two_peaks"
        ? [
            { id: "sec_intro", name: "Gentle Opening", type: "intro", bars: 4, energy: 0.35, active_roles: ["harmony", "lead"] },
            { id: "sec_peak_1", name: "First Peak", type: "drop", bars: 4, energy: 0.95, active_roles: ["drums", "harmony", "bass", "lead"], lift: true },
            { id: "sec_valley", name: "Quiet Middle", type: "breakdown", bars: 4, energy: 0.38, active_roles: ["harmony", "lead"] },
            { id: "sec_build", name: "Second Build", type: "build", bars: 4, energy: 0.76, active_roles: ["drums", "harmony", "bass"] },
            { id: "sec_peak_2", name: "Full Return Peak", type: "drop", bars: 4, energy: 1.0, active_roles: ["drums", "harmony", "bass", "lead"], lift: true },
            { id: "sec_afterglow", name: "Afterglow", type: "verse", bars: 4, energy: 0.58, active_roles: ["drums", "harmony", "lead"] },
            { id: "sec_outro", name: "Closing Resolve", type: "outro", bars: 4, energy: 0.28, active_roles: ["harmony"] },
          ]
        : [
            { id: "sec_intro", name: "Warm Opening", type: "intro", bars: 4, energy: 0.34, active_roles: ["drums", "harmony"] },
            { id: "sec_verse", name: "Verse Story", type: "verse", bars: 4, energy: 0.58, active_roles: ["drums", "bass", "lead"] },
            { id: "sec_build", name: "Rising Anticipation", type: "build", bars: 4, energy: 0.76, active_roles: ["drums", "harmony", "lead"] },
            { id: "sec_chorus_1", name: "Full Chorus", type: "drop", bars: 4, energy: 1.0, active_roles: ["drums", "harmony", "bass", "lead"], lift: true },
            { id: "sec_breakdown", name: "Breathing Space", type: "breakdown", bars: 4, energy: 0.4, active_roles: ["harmony", "lead"] },
            { id: "sec_chorus_2", name: "Big Return Chorus", type: "drop", bars: 4, energy: 1.0, active_roles: ["drums", "harmony", "bass", "lead"], lift: true },
            { id: "sec_outro", name: "Gentle Ending", type: "outro", bars: 4, energy: 0.28, active_roles: ["drums", "harmony"] },
          ];

    const expandedEvents = [];
    const unfoldedSections = [];
    let curBar = 0;
    sectionBlueprints.forEach((sec, idx) => {
      const startStep = curBar * stepsPerBar;
      const endStep = (curBar + sec.bars) * stepsPerBar;
      const roleSet = new Set(sec.active_roles);
      let secEvCount = 0;
      for (const ev of compiledEvents) {
        if (!roleSet.has(ev.role) && !(ev.role === "hocket" && roleSet.has("bass"))) continue;
        const cloned = JSON.parse(JSON.stringify(ev));
        cloned.id = `${sec.id}-${ev.id}`;
        cloned.step = startStep + (Number(ev.step) % totalSteps);
        cloned.bar = curBar + Math.floor((Number(ev.step) % totalSteps) / stepsPerBar);
        const performedOffset = ev.performance?.version === 1 ? ev.start_sec - Number(ev.step) * stepSec : 0;
        cloned.start_sec = Number((cloned.step * stepSec + performedOffset).toFixed(6));
        cloned.velocity = Number(Math.max(0.18, Math.min(1.0, Number(ev.velocity || 0.8) * (0.55 + 0.45 * sec.energy))).toFixed(4));
        if (sec.lift && cloned.role === "lead" && cloned.concrete?.midi_pitch) {
          const liftedMidi = Math.min(84, Number(cloned.concrete.midi_pitch) + 12);
          cloned.concrete = { midi_pitch: liftedMidi, freq_hz: midiToFreq(liftedMidi), note_name: midiToName(liftedMidi), micro_offset_ms: 0 };
          cloned.transition_tag = "chorus_octave_lift";
        }
        expandedEvents.push(cloned);
        secEvCount += 1;
      }
      unfoldedSections.push({
        id: sec.id,
        index: idx,
        name: sec.name,
        type: sec.type,
        bars: sec.bars,
        start_bar: curBar,
        end_bar: curBar + sec.bars,
        start_step: startStep,
        end_step: endStep,
        energy: sec.energy,
        active_roles: sec.active_roles,
        transition: sec.type === "build" ? "pre_drop_silence" : "none",
        active_event_count: secEvCount,
      });
      curBar += sec.bars;
    });

    const fullTotalSteps = curBar * stepsPerBar;
    expandedEvents.sort((a, b) => a.start_sec - b.start_sec || a.step - b.step);
    return {
      schema_version: 1,
      song_id: songDoc.id || "starter_neutral_100_cm",
      title: songDoc.title || "MusicLab Studio",
      arrangement_mode: "song",
      bpm,
      swing,
      root_pc: rootPc,
      root_name: NOTE_NAMES[rootPc],
      scale_type: scaleType,
      bars: curBar,
      core_bars: coreBars,
      steps_per_bar: stepsPerBar,
      total_steps: fullTotalSteps,
      step_sec: Number(stepSec.toFixed(6)),
      total_duration_sec: Number((fullTotalSteps * stepSec).toFixed(6)),
      voiced_chords: voicedChords,
      sections: unfoldedSections,
      gravity_by_step: gravityByStep,
      sidechain_duck_steps: Array.from(new Set([...kickSteps, ...snareSteps])).sort((a, b) => a - b),
      scaffold_options: {
        voice_leading: voiceLeadingMode,
        hocket_choke: hocketChokeEnabled,
        humanize: humanizeEnabled,
        pre_drop_silence: preDropSilenceEnabled,
        harmony_display_mode: harmonyDisplayMode,
      },
      events: expandedEvents,
    };
  }

  return {
    schema_version: 1,
    song_id: songDoc.id || "starter_neutral_100_cm",
    title: songDoc.title || "MusicLab Studio",
    arrangement_mode: "loop",
    bpm,
    swing,
    root_pc: rootPc,
    root_name: NOTE_NAMES[rootPc],
    scale_type: scaleType,
    bars: coreBars,
    core_bars: coreBars,
    steps_per_bar: stepsPerBar,
    total_steps: totalSteps,
    step_sec: Number(stepSec.toFixed(6)),
    total_duration_sec: Number((totalSteps * stepSec).toFixed(6)),
    voiced_chords: voicedChords,
    sections: [
      {
        id: "sec_loop",
        index: 0,
        name: "4-Bar Core Loop",
        type: "drop",
        bars: coreBars,
        start_bar: 0,
        end_bar: coreBars,
        start_step: 0,
        end_step: totalSteps,
        energy: 1.0,
        active_roles: ["drums", "harmony", "bass", "hocket", "lead"],
        transition: "none",
        active_event_count: compiledEvents.length,
      },
    ],
    gravity_by_step: gravityByStep,
    sidechain_duck_steps: Array.from(new Set([...kickSteps, ...snareSteps])).sort((a, b) => a - b),
    scaffold_options: {
      voice_leading: voiceLeadingMode,
      hocket_choke: hocketChokeEnabled,
      humanize: humanizeEnabled,
      pre_drop_silence: preDropSilenceEnabled,
      harmony_display_mode: harmonyDisplayMode,
    },
    events: compiledEvents,
  };
}

export function generateFalsificationProtocolJS(condition = "treatment", participantId = "P01") {
  const buildBlock = (blockId, title, rootPc, scaleType, progression) => {
    const voiced = voiceChordProgression(rootPc, scaleType, progression, "smooth");
    const scaleOffsets = SCALES[scaleType] || SCALES.major;
    const scalePcs = scaleOffsets.map((o) => (rootPc + o) % 12);
    const items = [];

    voiced.forEach((vc, barI) => {
      const chordPcs = vc.chord_pcs;
      const nonChordPcs = scalePcs.filter((pc) => !chordPcs.includes(pc));
      const sBeat1 = barI * 16;
      items.push({
        item_id: `${blockId}-b${barI + 1}-beat1`,
        bar: barI,
        step: sBeat1,
        chord_name: vc.chord_name,
        roman_function_label: vc.roman_function_label,
        chord_pcs: chordPcs,
        is_height_trap: false,
        target_chord_tone_midi: 60 + chordPcs[1],
        height_distractor_midi: 60 + (nonChordPcs[0] ?? (chordPcs[0] + 2) % 12),
      });

      const sBeat3 = barI * 16 + 8;
      const trapDistractorPc = nonChordPcs[0] ?? (chordPcs[0] + 2) % 12;
      const trapDistractorMidi = 60 + trapDistractorPc;
      const trapContextMidi = trapDistractorMidi + 1;
      const chordCandidates = [...chordPcs.map((c) => 60 + c), ...chordPcs.map((c) => 72 + c).filter((m) => m <= 79)];
      const farTargetMidi = chordCandidates.reduce((a, b) =>
        Math.abs(a - trapContextMidi) >= Math.abs(b - trapContextMidi) ? a : b
      );
      items.push({
        item_id: `${blockId}-b${barI + 1}-beat3-trap`,
        bar: barI,
        step: sBeat3,
        chord_name: vc.chord_name,
        roman_function_label: vc.roman_function_label,
        chord_pcs: chordPcs,
        is_height_trap: true,
        target_chord_tone_midi: farTargetMidi,
        height_distractor_midi: trapDistractorMidi,
      });
    });

    return {
      block_id: blockId,
      title,
      marks_visible: false,
      root_pc: rootPc,
      root_name: NOTE_NAMES[rootPc],
      scale_type: scaleType,
      progression,
      voiced_chords: voiced,
      items,
      target_steps: items.map((i) => i.step),
    };
  };

  return {
    protocol_version: 1,
    participant_id: participantId,
    condition: condition === "control" ? "control" : "treatment",
    pretest: buildBlock("pretest_c_major", "Step 1: Baseline Pretest (Marks OFF · Key of C Major)", 0, "major", [
      { bar: 0, beats: 4, degree: 1, roman: "I", quality: "maj" },
      { bar: 1, beats: 4, degree: 5, roman: "V", quality: "maj" },
      { bar: 2, beats: 4, degree: 6, roman: "vi", quality: "min" },
      { bar: 3, beats: 4, degree: 4, roman: "IV", quality: "maj" },
    ]),
    transfer_posttest: buildBlock("posttest_f_major", "Step 3: Blind Transfer Post-Test (Marks OFF · New Key of F Major)", 5, "major", [
      { bar: 0, beats: 4, degree: 1, roman: "I", quality: "maj" },
      { bar: 1, beats: 4, degree: 6, roman: "vi", quality: "min" },
      { bar: 2, beats: 4, degree: 2, roman: "ii", quality: "min" },
      { bar: 3, beats: 4, degree: 5, roman: "V", quality: "maj" },
    ]),
  };
}

export function gradeFalsificationTrialJS(trialBlock, userNotes) {
  const items = trialBlock?.items || [];
  if (!items.length) return { strong_beat_chord_tone_rate_pct: 0, height_trap_accuracy_pct: 0, height_bias_error_rate_pct: 0 };

  const notesByStep = new Map();
  for (const n of userNotes || []) {
    if (!n.role || n.role === "lead" || n.role === "hocket") {
      notesByStep.set(Number(n.step), n);
    }
  }

  let ctHits = 0;
  let trapTotal = 0;
  let trapHits = 0;
  let trapBiasErrors = 0;
  let answered = 0;

  for (const it of items) {
    const isTrap = Boolean(it.is_height_trap);
    if (isTrap) trapTotal += 1;
    const u = notesByStep.get(Number(it.step));
    if (!u) continue;
    answered += 1;

    const uMidi = Number(u.concrete?.midi_pitch ?? -1);
    const rel = u.relational || {};
    const isCt =
      uMidi >= 0
        ? it.chord_pcs.includes(((uMidi % 12) + 12) % 12)
        : Number(rel.scale_degree_offset || 0) === 0 && (rel.anchor || "chord_tone") === "chord_tone";

    if (isCt) {
      ctHits += 1;
      if (isTrap) trapHits += 1;
    } else if (isTrap && uMidi >= 0 && uMidi % 12 === it.height_distractor_midi % 12) {
      trapBiasErrors += 1;
    }
  }

  const ctRate = Number(((ctHits / items.length) * 100.0).toFixed(1));
  const trapAcc = Number(((trapHits / Math.max(1, trapTotal)) * 100.0).toFixed(1));
  const trapErr = Number(((trapBiasErrors / Math.max(1, trapTotal)) * 100.0).toFixed(1));
  return {
    block_id: trialBlock.block_id,
    strong_beat_chord_tone_rate_pct: ctRate,
    height_trap_accuracy_pct: trapAcc,
    height_bias_error_rate_pct: trapErr,
    answered_count: answered,
    total_items: items.length,
    should_fade_marks: ctRate >= 75.0,
  };
}

export function buildStandaloneSeed(presetId = "starter_neutral_100_cm") {
  if (presetId === "starter_neutral_100_cm") {
    const notes = [];
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      for (const kStep of [0, 8, 10]) {
        notes.push({
          id: `drum-kick-${b + kStep}`,
          step: b + kStep,
          duration_steps: 1,
          velocity: 0.92,
          role: "drums",
          patch_id: "kick",
          provenance: "seed_template",
          concrete: { midi_pitch: 36 },
        });
      }
      for (const sStep of [4, 12]) {
        notes.push({
          id: `drum-snare-${b + sStep}`,
          step: b + sStep,
          duration_steps: 1,
          velocity: 0.88,
          role: "drums",
          patch_id: "snare",
          provenance: "seed_template",
          concrete: { midi_pitch: 38 },
        });
      }
      for (let h = 2; h < 16; h += 4) {
        notes.push({
          id: `drum-hat-${b + h}`,
          step: b + h,
          duration_steps: 1,
          velocity: 0.68,
          role: "drums",
          patch_id: "hat_closed",
          provenance: "seed_template",
          concrete: { midi_pitch: 42 },
        });
      }
      notes.push({
        id: `bass-clean-${b}`,
        step: b,
        duration_steps: 4,
        velocity: 0.88,
        role: "bass",
        patch_id: "clean_bass",
        pitch_lock_mode: "relational",
        provenance: "seed_template",
        relational: { anchor: "chord_tone", chord_tone_index: 0, scale_degree_offset: 0, octave_offset: 0 },
      });
      notes.push({
        id: `bass-clean-${b + 8}`,
        step: b + 8,
        duration_steps: 4,
        velocity: 0.84,
        role: "bass",
        patch_id: "clean_bass",
        pitch_lock_mode: "relational",
        provenance: "seed_template",
        relational: { anchor: "chord_tone", chord_tone_index: 2, scale_degree_offset: 0, octave_offset: 0 },
      });
      notes.push({
        id: `lead-pluck-${b}`,
        step: b,
        duration_steps: 4,
        velocity: 0.85,
        role: "lead",
        patch_id: "pluck_lead",
        pitch_lock_mode: "relational",
        provenance: "seed_template",
        relational: { anchor: "chord_tone", chord_tone_index: bar % 2 === 0 ? 0 : 1, scale_degree_offset: 0, octave_offset: 0 },
      });
      notes.push({
        id: `lead-pluck-${b + 6}`,
        step: b + 6,
        duration_steps: 2,
        velocity: 0.8,
        role: "lead",
        patch_id: "pluck_lead",
        pitch_lock_mode: "relational",
        provenance: "seed_template",
        relational: { anchor: "chord_tone", chord_tone_index: 1, scale_degree_offset: 1, octave_offset: 0 },
      });
      notes.push({
        id: `lead-pluck-${b + 8}`,
        step: b + 8,
        duration_steps: 4,
        velocity: 0.88,
        role: "lead",
        patch_id: "pluck_lead",
        pitch_lock_mode: "relational",
        provenance: "seed_template",
        relational: { anchor: "chord_tone", chord_tone_index: 2, scale_degree_offset: 0, octave_offset: 0 },
      });
    }
    return {
      schema_version: 1,
      id: "starter_neutral_100_cm",
      title: "MusicLab — Warm Keys & Clean Groove",
      genre_preset: "neutral_starter",
      harmony_patch_id: "warm_keys",
      bass_patch_id: "clean_bass",
      lead_patch_id: "pluck_lead",
      arrangement_mode: "song",
      selected_song_arc: "arc_radio_hit",
      auto_harmony_stabs: true,
      global_context: { bpm: 100.0, swing: 0.52, root_pc: 0, scale_type: "major", bars: 4 },
      active_progression_id: "prog-main",
      chord_progressions: {
        "prog-main": [
          { bar: 0, beats: 4, degree: 1, roman: "I", quality: "maj" },
          { bar: 1, beats: 4, degree: 5, roman: "V", quality: "maj" },
          { bar: 2, beats: 4, degree: 6, roman: "vi", quality: "min" },
          { bar: 3, beats: 4, degree: 4, roman: "IV", quality: "maj" },
        ],
      },
      notes,
    };
  }
  return null;
}



