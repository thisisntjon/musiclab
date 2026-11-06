/**
 * The person's saved pieces (Phase 9a, 9a-9): every piece keeps its own id, so a second song never
 * overwrites the first, and only the person's own pieces are ever listed. Works without the server.
 * Phase 9b (9b-6): 6 slots. A new piece never pushes an old one out: when all 6 are used, saving says so and the
 * person picks a slot to replace. Replacing or deleting needs a second press (confirmPress).
 * `storage` is any object with getItem/setItem (window.localStorage in the browser).
 */
import { MAX_PROJECT_BYTES, validateProject } from './project_validation.js';
export { MAX_PROJECT_BYTES } from './project_validation.js';
const KEY = "musiclab.saves.v1";
export const TRASH_KEY = "musiclab.trash.v1";
function trashEntries(storage) {
  try {
    const entries = JSON.parse(storage.getItem(TRASH_KEY) || '[]');
    return Array.isArray(entries) && entries.every(e => e && typeof e.id === 'string' && e.id)
      ? entries : null;
  } catch { return null; }
}
function hiddenSong(storage, id) { return trashEntries(storage)?.some(e => e.id === id) || false; }
function writableSong(storage, id) {
  const trash = trashEntries(storage);
  return trash === null ? 'unreadable' : trash.some(e => e.id === id) ? 'trashed' : null;
}

function readAll(storage) {
  try {
    const list = JSON.parse(storage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (_e) {
    return [];
  }
}

// Mutations must never interpret unreadable existing bytes as an empty library.
function readForWrite(storage) {
  try {
    const raw=storage.getItem(KEY);
    const list=raw===null?[]:JSON.parse(raw);
    if(!Array.isArray(list)||list.some(entry=>!entry||typeof entry!=='object'
      ||Array.isArray(entry)||typeof entry.id!=='string'||!entry.id))return null;
    return list;
  } catch { return null; }
}

/** Only pieces the person made in the play flow are listed (never starter or test songs). */
export function listSaves(storage, { includeTrashed = false } = {}) {
  return readAll(storage).filter((s) => s && s.source === "person" && s.song && s.id && (includeTrashed || !hiddenSong(storage, s.id)));
}

export const SLOT_COUNT = 6;

function write(storage, list, entry) {
  try {
    storage.setItem(KEY, JSON.stringify(list));
    return { ok: true, entry };
  } catch (_e) {
    return { ok: false, reason: "full", entry }; // the device is full; nothing was removed
  }
}

export const WORKING_KEY = "musiclab.working.v1";

/** A matching library id does not mean that the current edits were saved. */
export function workingDiffersFromSave(storage, working = loadWorkingSong(storage)) {
  return Boolean(working && JSON.stringify(working) !== JSON.stringify(loadPiece(storage, working.id)));
}

export function summarizeCartridge(song) {
  const kit = song?.drum_kit || song?.vibe_groove?.drum_kit || "punchy";
  const feel = song?.underneath?.feel || song?.chord_spine?.feel || "none";
  const parts = Array.isArray(song?.song_cards) && song.song_cards.length > 0 ? song.song_cards.length : 1;
  const leadNotes = Array.isArray(song?.notes)
    ? song.notes.filter((n) => n && n.role === "lead" && Number(n.step ?? 0) < 16).length
    : Array.isArray(song?.hook_melody?.phrase_notes)
      ? song.hook_melody.phrase_notes.length
      : 0;
  return { kit, feel, parts, notes: leadNotes };
}

/** Browsers usually allow about 5.2 million characters here; some allow far less, and then a write fails and says so. */
const NEARLY_FULL_CHARS = 4_000_000;
export function storageNearlyFull(storage) {
  try {
    let total = 0;
    for (let i = 0; i < storage.length; i += 1) { const key = storage.key(i); total += key.length + (storage.getItem(key)?.length || 0); }
    return total >= NEARLY_FULL_CHARS;
  } catch (_e) { return false; }
}

/** Stash the person's active working song so reopening the app shows it where they left it (paused). */
export function stashWorkingSong(storage, song) {
  if (!storage || !song || !song.id) return false;
  if (writableSong(storage, song.id)) return false;
  try {
    // One atomic localStorage replacement retains every other unfinished song.
    // Read strictly here: malformed stored JSON must not be silently overwritten.
    const old = JSON.parse(storage.getItem(WORKING_KEY) || "null");
    if (!validWorkingRecord(old)) return false;
    const previous = workingEntries(old);
    const drafts = previous.filter(entry => entry.song.id !== song.id
      && workingDiffersFromSave(storage, entry.song));
    storage.setItem(
      WORKING_KEY,
      JSON.stringify({
        id: song.id,
        source: "person",
        title: song.title || "Your song",
        updated_at: new Date().toISOString(),
        cartridge: summarizeCartridge(song),
        song: JSON.parse(JSON.stringify(song)),
        drafts,
      })
    );
    return true;
  } catch (_e) {
    return false;
  }
}

function workingEntries(raw) {
  if (!raw) return [];
  return [raw, ...(Array.isArray(raw.drafts) ? raw.drafts : [])]
    .filter(entry => entry?.source === 'person' && entry.song?.id)
    .map(({drafts, ...entry}) => entry);
}

function validWorkingRecord(raw) {
  if (raw === null) return true;
  const valid = entry => entry && entry.source === 'person' && typeof entry.song?.id === 'string';
  return valid(raw) && (raw.drafts === undefined || (Array.isArray(raw.drafts) && raw.drafts.every(valid)));
}

/** One library identity; saved checkpoints and unfinished edits stay distinct. */
export function songLibrary(storage, { trash = false } = {}) {
  try {
    const removed = trashEntries(storage), saved = readForWrite(storage);
    const working = JSON.parse(storage.getItem(WORKING_KEY) || 'null');
    if (removed === null || saved === null || !validWorkingRecord(working)) return {ok:false,reason:'unreadable',songs:[]};
    const entries = new Map();
    for (const entry of listSaves(storage, {includeTrashed:true})) entries.set(entry.id, {id:entry.id,saved:entry.song,updated:entry.saved_at});
    for (const entry of workingEntries(working)) {
      const row = entries.get(entry.song.id) || {id:entry.song.id};
      if (!row.draft) { row.draft=entry.song; row.updated=entry.updated_at || row.updated; }
      entries.set(row.id,row);
    }
    const songs=[...entries.values()].filter(row => removed.some(e=>e.id===row.id) === trash).map(row=>({
      ...row, title:(row.draft || row.saved).title || 'My song',
      unfinished:!!row.draft && JSON.stringify(row.draft)!==JSON.stringify(row.saved),
    }));
    return {ok:true,songs};
  } catch { return {ok:false,reason:'unavailable',songs:[]}; }
}

export function trashSong(storage, id) {
  const library=songLibrary(storage), removed=trashEntries(storage);
  if(!library.ok || removed===null) return {ok:false,reason:'unreadable'};
  if(!library.songs.some(row=>row.id===id)) return {ok:false,reason:'missing'};
  try {
    storage.setItem(TRASH_KEY,JSON.stringify([...removed,{id,removed_at:new Date().toISOString()}]));
    return {ok:true};
  } catch { return {ok:false,reason:'storage'}; }
}

export function restoreSong(storage,id) {
  const library=songLibrary(storage,{trash:true}), removed=trashEntries(storage);
  if(!library.ok || removed===null) return {ok:false,reason:'unreadable'};
  const row=library.songs.find(row=>row.id===id);
  if(!row) return {ok:false,reason:'missing'};
  if(row.saved && listSaves(storage).length>=SLOT_COUNT) return {ok:false,reason:'slots_full'};
  try { storage.setItem(TRASH_KEY,JSON.stringify(removed.filter(e=>e.id!==id))); return {ok:true}; }
  catch { return {ok:false,reason:'storage'}; }
}

export function listWorkingSongs(storage, { includeTrashed = false } = {}) {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(WORKING_KEY) || "null");
    const unique = new Map();
    for (const entry of workingEntries(raw)) if (!unique.has(entry.song.id)) unique.set(entry.song.id, entry.song);
    return JSON.parse(JSON.stringify([...unique.values()].filter(song => includeTrashed || !hiddenSong(storage, song.id))));
  } catch (_e) {
    return [];
  }
}

export function loadWorkingSong(storage, id = null) {
  const songs = listWorkingSongs(storage);
  return (id === null ? songs[0] : songs.find(song => song.id === id)) || null;
}

export function clearWorkingSong(storage) {
  if (!storage) return;
  try {
    storage.removeItem?.(WORKING_KEY);
    if (!storage.removeItem) storage.setItem(WORKING_KEY, "");
  } catch (_e) {
    // ignore
  }
}

/** Export a portable project file payload (.musiclab.json) and validate/import it back on any computer. */
export function exportProjectJson(song) {
  if (!song || !song.id) throw new Error("A piece needs its own id before it can be exported");
  return JSON.stringify(
    {
      format: "musiclab.project.v1",
      exported_at: new Date().toISOString(),
      title: song.title || "My song",
      cartridge: summarizeCartridge(song),
      song: JSON.parse(JSON.stringify(song)),
    },
    null,
    2
  );
}

export function parseProjectJson(jsonText) {
  try {
    const text = typeof jsonText === 'string' ? jsonText : JSON.stringify(jsonText);
    if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) return { ok: false, reason: 'too_large' };
    const parsed = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
    if (parsed?.format !== undefined && parsed.format !== 'musiclab.project.v1') return { ok: false, reason: 'unsupported_format' };
    if (parsed?.format && parsed.title !== undefined && typeof parsed.title !== 'string') return { ok: false, reason: 'invalid_project' };
    const song = parsed?.format === "musiclab.project.v1" && parsed?.song ? parsed.song : parsed;
    if (!song || typeof song !== "object" || !Array.isArray(song.notes) || !song.global_context) {
      return { ok: false, reason: "invalid_project" };
    }
    validateProject(song);
    const clean = JSON.parse(JSON.stringify(song));
    if (!clean.id) clean.id = `song-import-${globalThis.crypto.randomUUID()}`;
    clean.source = "person";
    if (!clean.title) clean.title = parsed?.title || "My song";
    return { ok: true, song: clean };
  } catch (error) {
    return { ok: false, reason: error instanceof SyntaxError ? 'invalid_json' : error.message || 'invalid_project' };
  }
}

function entryFor(song, now) {
  if (!song || !song.id) throw new Error("A piece needs its own id before it can be saved");
  return {
    id: song.id,
    source: "person",
    title: song.title || "My song",
    saved_at: now,
    cartridge: summarizeCartridge(song),
    song: JSON.parse(JSON.stringify(song)),
  };
}

/** Save a piece. Saving it again updates its own slot; a new piece needs a free slot (reason "slots_full" if none). */
export function savePiece(storage, song, { now = new Date().toISOString() } = {}) {
  const entry = entryFor(song, now);
  const reason = writableSong(storage, song.id);
  if (reason) return {ok:false, reason, entry};
  const all = readForWrite(storage);
  if(all===null)return {ok:false,reason:"unreadable",entry};
  const at = all.findIndex((s) => s.id === song.id);
  if (at >= 0) {
    const list = [...all];
    list[at] = entry;
    return write(storage, list, entry);
  }
  if (listSaves(storage).length >= SLOT_COUNT) return { ok: false, reason: "slots_full", entry };
  return write(storage, [...all, entry], entry);
}

/** Put a piece in the slot of another one (the caller has had the second press). */
export function replacePiece(storage, oldId, song, { now = new Date().toISOString() } = {}) {
  const entry = entryFor(song, now);
  const reason = writableSong(storage, oldId) || writableSong(storage, song.id);
  if (reason) return {ok:false, reason, entry};
  const stored = readForWrite(storage);
  if(stored===null)return {ok:false,reason:"unreadable",entry};
  const all = stored.filter((s) => s.id !== song.id);
  const at = all.findIndex((s) => s.id === oldId);
  if (at < 0) return { ok: false, reason: "missing", entry };
  const list = [...all];
  list[at] = entry;
  return write(storage, list, entry);
}

/** Delete one piece (the caller has had the second press). */
export function deletePiece(storage, id) {
  const all = readForWrite(storage);
  if(all===null)return {ok:false,reason:"unreadable"};
  if (!all.some((s) => s.id === id)) return { ok: false, reason: "missing" };
  return write(storage, all.filter((s) => s.id !== id), null);
}

/**
 * Two presses for anything that removes a piece: the first press arms it ("Press again to delete"),
 * the second press on the same thing confirms. Pressing anything else disarms. Returns true on the confirming press.
 */
export function confirmPress(state, key) {
  if (state.armed === key) {
    state.armed = null;
    return true;
  }
  state.armed = key;
  return false;
}

export function loadPiece(storage, id) {
  const hit = listSaves(storage).find((s) => s.id === id);
  return hit ? JSON.parse(JSON.stringify(hit.song)) : null;
}

const PHRASE_KEY = "musiclab.phrases.v1";
export const PHRASE_SHELF_COUNT = 6;

/**
 * #3 & #9 Personal Phrase Shelf (96/100 & 92/100):
 * Save a discovered or crafted phrase as a reusable building block on a personal shelf,
 * and reuse it in another piece where it adapts to the new key context.
 */
export function listPhraseShelf(storage) {
  try {
    const list = JSON.parse(storage?.getItem(PHRASE_KEY) || "[]");
    return Array.isArray(list) ? list.filter((p) => p && p.id && Array.isArray(p.notes)) : [];
  } catch (_e) {
    return [];
  }
}

export function savePhraseToShelf(storage, doc, { id = null, title = "", now = new Date().toISOString() } = {}) {
  const lead = (doc?.notes || []).filter((n) => n.role === "lead").map((n) => JSON.parse(JSON.stringify(n)));
  if (!lead.length) return { ok: false, reason: "empty" };
  const all = listPhraseShelf(storage);
  const phraseId = id || `phrase-${doc?.id || "local"}`;
  const entry = {
    id: phraseId,
    title: title || doc?.title || `Phrase ${all.length + 1}`,
    saved_at: now,
    root_pc: Number(doc?.global_context?.root_pc || 0),
    scale_type: doc?.global_context?.scale_type || "major",
    notes: lead,
  };
  const at = all.findIndex((p) => p.id === phraseId);
  const next = at >= 0 ? all.map((p, i) => (i === at ? entry : p)) : [...all.slice(-(PHRASE_SHELF_COUNT - 1)), entry];
  try {
    storage.setItem(PHRASE_KEY, JSON.stringify(next));
    return { ok: true, entry };
  } catch (_e) {
    return { ok: false, reason: "full", entry };
  }
}

export function applyPhraseFromShelf(doc, phraseEntry) {
  if (!doc || !phraseEntry || !Array.isArray(phraseEntry.notes)) return doc;
  const next = JSON.parse(JSON.stringify(doc));
  const targetRoot = Number(next?.global_context?.root_pc || 0);
  const sourceRoot = Number(phraseEntry.root_pc || 0);
  const rawShift = ((targetRoot - sourceRoot) % 12 + 12) % 12;
  const semiShift = rawShift > 6 ? rawShift - 12 : rawShift;
  const nonLead = (next.notes || []).filter((n) => n.role !== "lead");
  const adaptedLead = phraseEntry.notes.map((n) => {
    const copy = JSON.parse(JSON.stringify(n));
    const midi = Number(copy?.concrete?.midi_pitch ?? 60);
    copy.concrete = { ...(copy.concrete || {}), midi_pitch: Math.max(48, Math.min(84, midi + semiShift)) };
    return copy;
  });
  next.notes = [...nonLead, ...adaptedLead];
  return next;
}
