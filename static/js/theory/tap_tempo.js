/**
 * Tap for speed (F-CORE-2): untimed taps that only suggest a speed. There is no window to hit and no score;
 * a pause longer than MAX_GAP_MS just starts a fresh run of taps. The person hears and chooses the suggestion.
 */
export const MIN_TAPS = 4;
export const MAX_GAP_MS = 2000;
const KEEP = 8;

export function addTap(taps, tMs) {
  const prev = taps[taps.length - 1];
  const fresh = prev === undefined || tMs - prev > MAX_GAP_MS || tMs <= prev ? [] : taps;
  return [...fresh, tMs].slice(-KEEP);
}

/** The suggested speed (beats per minute) from the taps so far, or null until there are MIN_TAPS. */
export function suggestSpeed(taps, { min = 60, max = 160, step = 5 } = {}) {
  if (taps.length < MIN_TAPS) return null;
  const gaps = taps.slice(1).map((t, i) => t - taps[i]).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  let bpm = 60000 / median;
  // Taps far outside the range are probably on every other beat (or twice per beat): fold them in.
  while (bpm > max) bpm /= 2;
  while (bpm < min) bpm *= 2;
  return Math.max(min, Math.min(max, Math.round(bpm / step) * step));
}

/** Add one tap at `tMs` and return `{ taps, bpm }` (`bpm` is null until `MIN_TAPS` taps). */
export function nextTap(taps, tMs, opts = {}) {
  const next = addTap(taps, tMs);
  return { taps: next, bpm: suggestSpeed(next, opts) };
}
