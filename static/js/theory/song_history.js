/** A song can hold the songs it grew from: capture_source (the take or loop it came from) and melody_original
 * (the score the Tune wheel began from). Copying a song that already holds them into the next one made every
 * trip through the Tune wheel hold every trip before it, until saving failed. History stays two songs deep:
 * the song, what it came from, and the one song that came from. Only the song at the top keeps a melody original.
 * Cutting history never cuts what the person played: a played note the new song would not hold anywhere goes into
 * played_archive at its top, once. That list grows only with notes the person played, never with the band. */

const HISTORY = ['capture_source', 'melody_original'];
const ARCHIVE = 'played_archive';
const copy = value => structuredClone(value);
const isSong = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The song alone, holding no earlier song. Other keys keep their order, so the rest stays byte for byte the same. */
export function withoutHistory(song) {
  const out = copy(song);
  for (const key of HISTORY) delete out[key];
  delete out[ARCHIVE]; // The song at the top holds it.
  return out;
}

const OWN = new Set(['user_placed', 'hummed_confirmed']);
const timed = note => Number.isFinite(note?.step) && Number.isFinite(note?.duration_steps) && note.duration_steps > 0;

/** Every note the person played, anywhere in a song and the songs it holds, by its first id. A note is taken from a
 * score first; a played key kept only as a timed take record keeps its time with it. */
function playedNotes(song) {
  const found = new Map(), pending = isSong(song) ? [song] : [], seen = new Set();
  while (pending.length) {
    const value = pending.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const note = value.event && typeof value.event === 'object' ? value.event : value;
    const id = note.source_note_id || note.id;
    if (OWN.has(note.provenance) && typeof id === 'string' && !found.has(id)) {
      if (timed(note) || (Number.isFinite(note.capture_time) && note.capture_duration > 0)) found.set(id, note);
      else if (note === value.event && Number.isFinite(value.time) && value.duration > 0) found.set(id, { ...note, capture_time: value.time, capture_duration: value.duration });
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') pending.push(child);
  }
  return found;
}

/** Puts into song every played note from the songs it was made from that it no longer holds anywhere. Returns song. */
export function keepPlayedNotes(song, ...from) {
  const held = playedNotes(song), add = [];
  for (const before of from) for (const [id, note] of playedNotes(before)) if (!held.has(id)) { held.set(id, note); add.push(copy(note)); }
  if (add.length) song[ARCHIVE] = [...(Array.isArray(song[ARCHIVE]) ? song[ARCHIVE] : []), ...add];
  return song;
}

function chainEnd(song) {
  let at = song;
  for (let guard = 0; isSong(at?.capture_source) && guard < 100000; guard += 1) at = at.capture_source;
  return at;
}

/** The loop a song began from, holding no history: the last song down its capture_source chain. A played take kept
 * whole can end that chain, and then the loop is the one under the melody original. */
export function sourceLoop(song) {
  const end = chainEnd(song), underOriginal = isSong(song?.melody_original) ? chainEnd(song.melody_original) : null;
  return withoutHistory(end.captured_performance && underOriginal && !underOriginal.captured_performance ? underOriginal : end);
}

/** A song to keep inside another one. It keeps the one song it came from, which keeps nothing. */
export function archivedSong(song) {
  const out = copy(song);
  delete out.melody_original;
  delete out[ARCHIVE];
  if (isSong(out.capture_source)) out.capture_source = withoutHistory(out.capture_source);
  return out;
}

/** How many songs deep the history goes: 0 for a song that holds none. */
export function historyDepth(song) {
  let deepest = 0;
  const stack = isSong(song) ? [[song, 0]] : [];
  while (stack.length) {
    const [at, depth] = stack.pop();
    if (depth > deepest) deepest = depth;
    for (const key of HISTORY) if (isSong(at[key])) stack.push([at[key], depth + 1]);
  }
  return deepest;
}

/** A song saved before history was kept short comes back two songs deep. Its own notes, the take it came from and
 * its melody original stay whole; under each of those only the loop at the end of the chain stays. Every note the
 * person played in the songs cut away goes into played_archive. A song that is already short comes back as the very
 * same object, so nothing rewrites it. */
export function flattenSongHistory(song) {
  if (historyDepth(song) <= 2) return song;
  const out = copy(song);
  for (const key of HISTORY) {
    const kept = out[key];
    if (!isSong(kept)) continue;
    delete kept.melody_original;
    if (isSong(kept.capture_source)) kept.capture_source = sourceLoop(kept.capture_source);
  }
  return keepPlayedNotes(out, song);
}
