/**
 * Phase A of the spectrum + chorus plan (workflow/research/spectrum-chorus-2026-11-02/SYNTHESIS.md):
 * change the band of one song section without touching anything else.
 *
 * A trial is a detached candidate. The document is not written until applySectionTrial, so discarding a
 * trial cannot roll back later playing or edits, and no rollback code exists to go wrong. Pass the
 * canonical song (PlayFlow._canonicalDoc), not an editor projection. The materialized notes are the
 * save, playback and export truth; section_direction only records how they were made.
 */
import { setJamDirection } from "./jam_session.js";
import { SCENE_CATALOGUE_VERSION, sceneIndex } from "./scene_catalogue.js";
import { applySongMaterial, extractSongMaterial, normalizeSongCards, SECTION_DIRECTION_VERSION } from "./song_view.js";

export const BAND_ROLES = Object.freeze(["drums", "bass", "harmony"]);
const clone = value => JSON.parse(JSON.stringify(value));

/** Only untouched generator output may be replaced. An edited band note lost generated_by when it was edited. */
export function isReplaceableNote(note) {
  return note?.provenance === "jam_generated" && note.generated_by === "musiclab_jam" && !note.edited_from_generator;
}

export { ensureSectionIds } from './song_view.js';

function sectionMaterial(doc, card) {
  return card.material ? clone(card.material) : extractSongMaterial(doc);
}

/** Content revision of one section. Any edit to its material, or to global timing and key, changes it.
 * The tune-grid state is left out: it is a cache a redraw refreshes, not an edit. */
export function sectionRevision(doc, sectionId) {
  const card = normalizeSongCards(doc?.song_cards).find(item => item.section_id === sectionId);
  if (!card) return null;
  const { tune_grid_state: _derived, ...material } = sectionMaterial(doc, card);
  const { material: _material, ...settings } = card;
  const text = JSON.stringify([material, settings, doc.global_context ?? null]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16);
}

function bandSession(doc, material) {
  const session = doc.jam_session ? clone(doc.jam_session) : { kind: "pitched",
    patchId: material.lead_patch_id || "warm_keys", density: 1, color: 1, responsive: true };
  delete session.music_field; delete session.exploration_map; delete session.anchor_backing; delete session.anchor_traits;
  return { ...session, kit: material.drum_kit || session.kit || "soft" };
}

function countByRole(notes) {
  const counts = {};
  for (const note of notes) counts[note.role] = (counts[note.role] || 0) + 1;
  return counts;
}

const bandShape = note => [note.role, note.step, note.performance?.offset_steps ?? 0, note.duration_steps,
  note.concrete?.midi_pitch ?? null, note.patch_id];
const shapeKey = notes => JSON.stringify(notes.map(bandShape).map(String).sort());

/**
 * Plan a different band for one section. Returns { ok: true, trial } or { ok: false, reason }.
 * Pure and deterministic: moving back to a scene yields the same candidate, so a host may replace
 * its pending trial on every movement without creating drafts or history.
 */
export function planSectionDirection(doc, { sectionId, revision, sceneId, roles = BAND_ROLES } = {}) {
  const card = normalizeSongCards(doc?.song_cards).find(item => item.section_id === sectionId);
  if (!card) return { ok: false, reason: "section_missing" };
  if (revision !== undefined && revision !== sectionRevision(doc, sectionId)) return { ok: false, reason: "stale" };
  if (sceneIndex(sceneId) < 0) return { ok: false, reason: "unknown_scene" };
  if (!roles.length || roles.some(role => !BAND_ROLES.includes(role))) return { ok: false, reason: "unsupported_role" };

  const material = sectionMaterial(doc, card);
  const source = { ...applySongMaterial(doc, material), jam_session: bandSession(doc, material) };
  let planned;
  try {
    planned = setJamDirection(source, { scene_catalogue: SCENE_CATALOGUE_VERSION, scene_id: sceneId, replace_captured_band: true });
  } catch (error) {
    return { ok: false, reason: "unsupported_direction", detail: error.message };
  }

  const before = material.notes || [];
  const replaced = note => isReplaceableNote(note) && roles.includes(note.role);
  const kept = before.filter(note => !replaced(note));
  const ids = new Set(kept.map(note => note.id));
  const fresh = [];
  for (const note of planned.notes.filter(replaced)) {
    let id = note.id;
    // A kept band note moved by hand can still hold the id the generator wants to reuse.
    while (ids.has(id)) id += "-new";
    ids.add(id);
    fresh.push({ ...note, id });
  }
  const removed = before.filter(replaced);
  return { ok: true, trial: {
    version: SECTION_DIRECTION_VERSION,
    songId: doc.id ?? null,
    sectionId,
    baseRevision: sectionRevision(doc, sectionId),
    sceneId,
    roles: [...roles],
    material: { ...material, notes: [...kept, ...fresh] },
    // Band notes from a kept performance are replaced too. The host must say so; the song's
    // capture_source and captured_performance stay untouched, so the original remains recoverable.
    summary: { kept: kept.length, removed: countByRole(removed), added: countByRole(fresh),
      capturedBandReplaced: removed.filter(note => note.capture_occurrence !== undefined).length,
      changed: shapeKey(removed) !== shapeKey(fresh) },
  } };
}

/** Commit a trial exactly as planned; never regenerates. The host pushes one Undo entry around this call. */
export function applySectionTrial(doc, trial) {
  if ((doc?.id ?? null) !== trial?.songId) return { ok: false, reason: "other_song" };
  const cards = normalizeSongCards(doc.song_cards);
  const index = cards.findIndex(card => card.section_id === trial.sectionId);
  if (index < 0) return { ok: false, reason: "section_missing" };
  if (sectionRevision(doc, trial.sectionId) !== trial.baseRevision) return { ok: false, reason: "stale" };
  const next = clone(doc);
  next.song_cards = cards.map((card, i) => i !== index ? card : { ...card, material: clone(trial.material),
    section_direction: { version: SECTION_DIRECTION_VERSION, catalogue: SCENE_CATALOGUE_VERSION,
      scene_id: trial.sceneId, roles: [...trial.roles] } });
  return { ok: true, doc: next };
}
