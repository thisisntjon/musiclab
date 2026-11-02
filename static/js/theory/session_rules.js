/**
 * Play-flow session rules (Phase 9a, design decision 3: "one act makes it yours").
 * Pure and import-free so it is unit-tested in node and shared by every stage.
 */

export const BARS = 4;
export const STEPS_PER_BAR = 16;

/** Starter material is never the person's: anything without a label is starter material. */
export function provenanceOf(note) {
  return note && note.provenance ? note.provenance : "seed_template";
}

/** The soft starting pulse: kick on beats 1 and 3 of every bar, labelled as starter material. */
export function seedPulse(bars = BARS) {
  const notes = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const s of [0, 8]) {
      const step = bar * STEPS_PER_BAR + s;
      notes.push({
        id: `drum-kick-${step}`,
        step,
        duration_steps: 1,
        velocity: 0.9,
        role: "drums",
        patch_id: "kick",
        provenance: "seed_template",
        concrete: { midi_pitch: 36 },
      });
    }
  }
  return notes;
}

let idCounter = 0;
export function newSongId(now = Date.now(), rand = Math.random) {
  idCounter += 1;
  return `song-${now.toString(36)}-${Math.floor(rand() * 1e6).toString(36)}-${idCounter}`;
}

/** A fresh piece for the play flow: only the starting pulse, no chords nobody chose. */
export function newPlayDoc({ now, rand } = {}) {
  return {
    id: newSongId(now, rand),
    title: "",
    source: "person",
    global_context: { bpm: 100, swing: 0.5, root_pc: 0, scale_type: "major", bars: BARS },
    notes: seedPulse(),
    chord_progressions: {
      "prog-main": [
        { bar: 0, beats: 4, degree: 1, roman: "I", quality: "maj" },
        { bar: 1, beats: 4, degree: 5, roman: "V", quality: "maj" },
        { bar: 2, beats: 4, degree: 6, roman: "vi", quality: "min" },
        { bar: 3, beats: 4, degree: 4, roman: "IV", quality: "maj" },
      ],
    },
    active_progression_id: "prog-main",
    auto_harmony_stabs: false, // chords arrive only when the person chooses them (Phase 9b)
    arrangement_mode: "loop",
    lead_patch_id: "pluck_lead",
    play_session: { acts_count: 0, acts: [], reveals_count: 0, reveals: [], start_bpm: 100 },
  };
}

/** Record one act of the person's own (paint, tap, hum, choice, keep). */
export function recordAct(doc, kind, detail = {}) {
  const s = doc.play_session || (doc.play_session = { acts_count: 0, acts: [] });
  s.acts_count = Number(s.acts_count || 0) + 1;
  s.acts.push({ kind, ...detail });
  if (s.acts.length > 200) s.acts.shift();
  return s.acts_count;
}

export function actsCount(doc) {
  return Number(doc?.play_session?.acts_count || 0);
}

/**
 * Record a discovery/reveal action separately from authored acts.
 * Separate tracking detects whether reveals lead to retained edits or mere browsing.
 */
export function recordReveal(doc, kind, detail = {}) {
  const s = doc.play_session || (doc.play_session = { acts_count: 0, acts: [], reveals_count: 0, reveals: [] });
  s.reveals_count = Number(s.reveals_count || 0) + 1;
  if (!Array.isArray(s.reveals)) s.reveals = [];
  s.reveals.push({ kind, ...detail });
  if (s.reveals.length > 200) s.reveals.shift();
  return s.reveals_count;
}

export function revealsCount(doc) {
  return Number(doc?.play_session?.reveals_count || 0);
}

const OWN = new Set(["user_placed", "hummed_confirmed"]);

/**
 * True only when something of the person's is in the piece: a note they placed or hummed, a speed they chose,
 * or a kit or feel they picked by ear.
 * Pressing a pad on and off again leaves nothing of theirs, so it doesn't count.
 */
export function madeByYou(doc) {
  const ownNotes = [doc?.notes || [], ...(doc?.song_cards || []).map((card) => card?.material?.notes || [])]
    .some((notes) => notes.some((note) => OWN.has(note.provenance)));
  const startBpm = Number(doc?.play_session?.start_bpm ?? 100);
  const tempoChanged = Number(doc?.global_context?.bpm ?? startBpm) !== startBpm;
  const keptChoice = Object.keys(doc?.play_session?.choices || {}).length > 0; // a kit or feel picked by ear (9b)
  return actsCount(doc) >= 1 && (ownNotes || tempoChanged || keptChoice);
}
