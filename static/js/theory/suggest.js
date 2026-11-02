/**
 * Heard-first suggestions for the tune (Phase 9b, F-CORE-4 + Phase 12b #4 Ghost Sparks).
 * After the person places a note, at most 2 outlined ideas appear in the next empty column. They have no text:
 * moving to one plays it, choosing it places it. They are worked out only when the press ends (pointer-up or a key),
 * never during a drag, and never on a column that already has a note.
 *
 * Phase 12b (#4 Ghost Sparks): on strong beat columns (`col % 4 === 0` before cadence), when chord tones are present,
 * non-clashing candidates that belong to the bar's chord (`chordPcsList`) are prioritized ahead of non-chord steps.
 */

const pcOf = (m) => ((m % 12) + 12) % 12;

/**
 * cells: midi|null per column; justCol: the column just filled; rows: the grid's midis, low to high;
 * chordPcsList: the chord tones under this part (so no idea clashes a semitone above a chord tone).
 * Returns up to 2 of {col, midi, kind}. Pure and deterministic.
 */
export function suggestNext({ cells, justCol, rows, rootPc = 0, chordPcsList = [] }) {
  const prevMidi = cells[justCol];
  if (prevMidi == null || !rows.length) return [];
  let before = justCol - 1;
  while (before >= 0 && cells[before] == null) before--;
  const stride = before >= 0 && justCol - before <= 4 ? justCol - before : 2;
  const col = [justCol + stride, justCol + 2, justCol + 1].find((c) => c < cells.length && cells[c] == null);
  if (col === undefined) return [];

  let prev = rows.indexOf(prevMidi);
  if (prev < 0) prev = rows.reduce((best, m, i) => (Math.abs(m - prevMidi) < Math.abs(rows[best] - prevMidi) ? i : best), 0);
  const clashes = (r) => chordPcsList.some((pcs) => pcs.some((c) => pcOf(rows[r] - c) === 1));
  const isChordTone = (r) => chordPcsList.some((pcs) => pcs.some((c) => pcOf(rows[r]) === pcOf(c)));
  const homeRow = rows.reduce(
    (best, m, r) => (pcOf(m) === pcOf(rootPc) && (best < 0 || Math.abs(r - prev) < Math.abs(best - prev)) ? r : best),
    -1
  );
  const isCadence = col >= cells.length - 2; // the end of the bar: going home comes first
  const baseOrder = isCadence
    ? [["home", homeRow], ["repeat", prev], ["down", prev - 1], ["up", prev + 1]]
    : [["repeat", prev], ["up", prev + 1], ["down", prev - 1], ["home", homeRow]];

  const valid = [];
  const seen = new Set();
  for (const [kind, row] of baseOrder) {
    if (row < 0 || row >= rows.length || seen.has(row) || clashes(row)) continue;
    seen.add(row);
    valid.push({ col, midi: rows[row], kind, chordTone: isChordTone(row) });
  }
  if (!isCadence && col % 4 === 0 && chordPcsList.length > 0) {
    valid.sort((a, b) => Number(b.chordTone) - Number(a.chordTone));
  }
  return valid.slice(0, 2).map(({ col: c, midi, kind }) => ({ col: c, midi, kind }));
}

/** When suggestions may appear: cleared when a press starts, worked out only when it ends. */
export function createSuggester() {
  return { pressing: false, list: [] };
}

export function suggesterDown(s) {
  s.pressing = true;
  s.list = [];
  return s.list;
}

export function suggesterUp(s, input) {
  if (!s.pressing) return s.list;
  s.pressing = false;
  s.list = input ? suggestNext(input) : [];
  return s.list;
}

/** A key press (Enter) is a whole press: down and up at once. */
export function suggesterKey(s, input) {
  suggesterDown(s);
  return suggesterUp(s, input);
}
