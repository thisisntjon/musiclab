/**
 * Relative-pitch keying for hummed phrases (Phase 8.0, decision 7). Import-free and pure, so it is unit-tested.
 *
 * Most people who "can't sing" keep a tune's shape but start on a different pitch or drift out of tune
 * (research/inclusion-wave/iw5-frontier-bridge.md). So instead of snapping each note on its own, we:
 *   1. find the singer's own tuning offset (circular mean of each note's distance from the nearest semitone),
 *   2. round every note in that tuning,
 *   3. pick the one whole-phrase shift that best fits the song's key,
 *   4. snap only notes still outside the key to the nearest key note,
 *   5. move the whole phrase by octaves into a comfortable range.
 * Intervals the person actually sang are kept; the phrase is never rebuilt.
 */

const SCALES = {
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
};

export const DEFAULT_NOTE_RANGE = { low: 60, high: 79 };

const pcOf = (m) => ((m % 12) + 12) % 12;

export function hzToMidiFloat(hz) {
  return 69 + 12 * Math.log2(Number(hz) / 440);
}

/**
 * #10 Voice Alchemist: maps vocal RMS energy windows (`0.02..0.35`) to note velocity (`0.55..0.96`)
 * and synth filter brightness (`0.25..0.95`) so hummed melodies carry the singer's human expression.
 */
export function rmsToExpression(rmsVal) {
  const rms = Math.max(0.02, Math.min(0.35, Number(rmsVal) || 0.08));
  const norm = (rms - 0.02) / (0.35 - 0.02); // 0..1
  const velocity = Number((0.55 + 0.41 * norm).toFixed(3));
  const brightness = Number((0.25 + 0.70 * norm).toFixed(3));
  const grit = Number((0.18 + 0.45 * brightness).toFixed(3));
  return {
    velocity,
    brightness,
    gesture: {
      preset_id: "pluck_stab",
      grit,
      xy_pad: { x: 0.55, y: brightness },
    },
  };
}

function scalePcsFor(rootPc, scaleType) {
  return (SCALES[scaleType] || SCALES.major).map((o) => (Number(rootPc) + o) % 12);
}

function distToScale(m, pcs) {
  let best = 12;
  for (const pc of pcs) {
    const d = Math.abs(pcOf(m) - pc);
    best = Math.min(best, d, 12 - d);
  }
  return best;
}

function snapToScale(m, pcs) {
  if (pcs.includes(pcOf(m))) return m;
  for (let d = 1; d <= 6; d++) {
    if (pcs.includes(pcOf(m - d))) return m - d; // prefer settling down on ties
    if (pcs.includes(pcOf(m + d))) return m + d;
  }
  return m;
}

function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** Singer's tuning offset in semitones, in (-0.5, 0.5]. */
export function tuningOffset(midiFloats) {
  let sx = 0;
  let sy = 0;
  for (const m of midiFloats) {
    const a = 2 * Math.PI * (m - Math.round(m));
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  if (sx === 0 && sy === 0) return 0;
  return Math.atan2(sy, sx) / (2 * Math.PI);
}

/**
 * @param {(number|null)[]} midiFloats detected pitches as fractional MIDI (null = no pitch)
 * @returns {(number|null)[]} keyed MIDI notes, same length and order
 */
export function keyPhraseRelative(midiFloats, rootPc = 0, scaleType = "major", noteRange = DEFAULT_NOTE_RANGE) {
  const idx = [];
  const vals = [];
  (midiFloats || []).forEach((m, i) => {
    if (m !== null && Number.isFinite(m)) {
      idx.push(i);
      vals.push(Number(m));
    }
  });
  const out = (midiFloats || []).map(() => null);
  if (vals.length === 0) return out;

  const pcs = scalePcsFor(rootPc, scaleType);
  const root = Number(rootPc) % 12;
  const c = tuningOffset(vals);
  const rounded = vals.map((m) => Math.round(m - c));

  let best = null;
  for (let s = -5; s <= 6; s++) {
    const shifted = rounded.map((n) => n + s);
    const cost = shifted.reduce((acc, n) => acc + distToScale(n, pcs), 0);
    const endsHome = pcOf(shifted[shifted.length - 1]) === root ? 0 : 1;
    const startsHome = pcOf(shifted[0]) === root ? 0 : 1;
    const key = [cost, endsHome, startsHome, Math.abs(s)];
    if (!best || lexLess(key, best.key)) best = { s, key };
  }

  let keyed = rounded.map((n) => snapToScale(n + best.s, pcs));
  const sorted = [...keyed].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const centre = (noteRange.low + noteRange.high) / 2;
  const octaves = Math.round((centre - median) / 12);
  keyed = keyed.map((n) => n + 12 * octaves);

  idx.forEach((i, k) => {
    out[i] = keyed[k];
  });
  return out;
}

/** 1-based scale degrees of keyed notes (for tests and plain feedback). */
export function scaleDegreesOf(midis, rootPc = 0, scaleType = "major") {
  const offsets = SCALES[scaleType] || SCALES.major;
  return midis.map((m) => (m === null ? null : offsets.indexOf(pcOf(m - Number(rootPc))) + 1));
}
