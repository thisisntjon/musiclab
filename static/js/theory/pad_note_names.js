// Optional note names on the play pads, for people who read music. Off unless the player turns it on.
// The names follow the key's usual spelling: flat keys say B♭, sharp keys say F♯.
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1]);  // F, B♭, E♭, A♭, D♭
const FLAT_MINOR = new Set([2, 7, 0, 5, 10]);  // D, G, C, F, B♭ minor
export const PAD_NOTE_NAMES_KEY = 'musiclab.pad_note_names.v1';
const pc = n => ((Math.round(n) % 12) + 12) % 12;

export function usesFlats(rootPc = 0, minor = false) { return (minor ? FLAT_MINOR : FLAT_MAJOR).has(pc(rootPc)); }

/** The written name of a pad's note in this key ("C", "B♭", "F♯"), or null when the pad has no pitch (drums). */
export function padNoteName(pad, { rootPc = 0, minor = false } = {}) {
  if (!pad || pad.role === 'drums' || !Number.isFinite(pad.midi)) return null;
  return (usesFlats(rootPc, minor) ? FLAT : SHARP)[pc(pad.midi)];
}

/**
 * Names for a whole row of pads. The key decides sharps or flats, unless the other spelling avoids using one
 * letter twice in the row (a blues or modal seventh reads B♭ beside A, not A♯).
 */
export function padNoteNames(pads, { rootPc = 0, minor = false } = {}) {
  const pitched = (pads || []).filter(p => p && p.role !== 'drums' && Number.isFinite(p.midi));
  const letters = table => new Set(pitched.map(p => pc(p.midi)).filter((v, i, a) => a.indexOf(v) === i).map(v => table[v][0])).size;
  const keyFlats = usesFlats(rootPc, minor), sharp = letters(SHARP), flat = letters(FLAT);
  const table = flat > sharp ? FLAT : sharp > flat ? SHARP : keyFlats ? FLAT : SHARP;
  return (pads || []).map(p => (p && p.role !== 'drums' && Number.isFinite(p.midi)) ? table[pc(p.midi)] : null);
}

/** The same name for a screen reader: "B flat", "F sharp". */
export function spokenNoteName(name) { return name ? name.replace('♯', ' sharp').replace('♭', ' flat') : ''; }

export function loadPadNoteNames(storage) { try { return storage?.getItem(PAD_NOTE_NAMES_KEY) === 'on'; } catch { return false; } }
export function savePadNoteNames(storage, on) { try { storage?.setItem(PAD_NOTE_NAMES_KEY, on ? 'on' : 'off'); return true; } catch { return false; } }
