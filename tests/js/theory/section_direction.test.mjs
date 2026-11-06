// Spectrum + chorus Phase A: one section's band changes; everything else compares exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startJam, setJamDirection, contributeJam } from "../../../static/js/theory/jam_session.js";
import { addSongCard, applySongMaterial, detachSongCard, moveSongCard, normalizeSongCards, songCardRanges, songEvents } from "../../../static/js/theory/song_view.js";
import { compileSongStandalone } from "../../../static/ui/standalone_compiler.js";
import { materializePerformance } from "../../../static/js/theory/performance_capture.js";
import { validateProject } from "../../../static/js/theory/project_validation.js";
import { editLeadEvent } from "../../../static/js/theory/event_tune.js";
import { applySectionTrial, ensureSectionIds, isReplaceableNote, planSectionDirection, sectionRevision } from "../../../static/js/theory/section_direction.js";

const clone = value => JSON.parse(JSON.stringify(value));
const own = notes => notes.filter(note => note.provenance === "user_placed");
const band = notes => notes.filter(isReplaceableNote);

// Two independent sections plus a linked repeat of the shared material.
function song({ jam = true } = {}) {
  let doc = { id: "song-1", notes: [], global_context: { root_pc: 0, scale_type: "major", bpm: 100, meter: "4/4", steps_per_bar: 16 },
    lead_patch_id: "warm_keys", drum_kit: "soft", song_cards: [{ bars: 4 }] };
  doc = setJamDirection(startJam(doc, { kind: "pitched", patchId: "warm_keys" }), { scene_catalogue: "first-neighborhood-v1", scene_id: "rocksteady-v1" });
  doc = contributeJam(doc, { pad: 0, step: 2 });
  doc = contributeJam(doc, { pad: 2, step: 7 });
  let cards = addSongCard(addSongCard(doc.song_cards));
  cards = detachSongCard(cards, 0, doc);
  cards = detachSongCard(cards, 1, doc);
  doc.song_cards = ensureSectionIds(cards);
  if (!jam) delete doc.jam_session;
  return doc;
}
const [A, B, LINKED] = [0, 1, 2];
const id = (doc, index) => doc.song_cards[index].section_id;
const plan = (doc, index, sceneId = "reggae-v1", extra = {}) => planSectionDirection(doc, { sectionId: id(doc, index), sceneId, ...extra });

test("the selected section's band changes and nothing else does", () => {
  const doc = song();
  const before = clone(doc);
  const { ok, trial } = plan(doc, A);
  assert.ok(ok);
  assert.deepEqual(doc, before, "planning writes nothing to the document");
  assert.equal(trial.summary.changed, true, "a different scene must really change the band");

  const applied = applySectionTrial(doc, trial);
  assert.ok(applied.ok);
  const next = applied.doc;
  assert.deepEqual(own(next.song_cards[A].material.notes), own(before.song_cards[A].material.notes), "personal notes compare exactly");
  assert.deepEqual(next.song_cards[B], normalizeSongCards(before.song_cards)[B], "the other section is untouched");
  assert.deepEqual(next.song_cards[LINKED], normalizeSongCards(before.song_cards)[LINKED], "the linked repeat is untouched");
  assert.deepEqual(next.notes, before.notes, "shared material is untouched");
  assert.deepEqual(next.jam_session, before.jam_session, "the song-level band setting is untouched");
  assert.deepEqual(next.global_context, before.global_context, "tempo and key are untouched");
  assert.notDeepEqual(band(next.song_cards[A].material.notes), band(before.song_cards[A].material.notes));
});

test("the compiled song changes only in the selected section's time range, with the same event order elsewhere", () => {
  const doc = song();
  const next = applySectionTrial(doc, plan(doc, B).trial).doc;
  const compile = input => {
    const loopDoc = { ...input, arrangement_mode: "loop" };
    const loop = compileSongStandalone(loopDoc, null);
    const parts = input.song_cards.map(card => card.material ? compileSongStandalone(applySongMaterial(loopDoc, card.material), null) : loop);
    return songEvents(loop, input.song_cards, parts);
  };
  const shape = event => [event.role, event.start_sec, event.duration_sec, event.concrete?.midi_pitch ?? null, event.patch_id];
  const ranges = songCardRanges(doc.song_cards, 64, doc.global_context.bpm);
  const within = (song, range) => song.events.filter(event => event.start_sec >= range.start_sec && event.start_sec < range.end_sec);
  const [before, after] = [compile(doc), compile(next)];
  assert.equal(after.total_steps, before.total_steps, "song length is unchanged");
  assert.deepEqual(within(after, ranges[A]).map(shape), within(before, ranges[A]).map(shape));
  assert.deepEqual(within(after, ranges[LINKED]).map(shape), within(before, ranges[LINKED]).map(shape));
  assert.notDeepEqual(within(after, ranges[B]).map(shape), within(before, ranges[B]).map(shape), "the selected section really changes");
  const lead = song => within(song, ranges[B]).filter(event => event.provenance === "user_placed").map(shape);
  assert.ok(lead(before).length > 0);
  assert.deepEqual(lead(after), lead(before), "the person's notes sound the same");
});

test("role scope: a beat-only change leaves bass and harmony exact", () => {
  const doc = song();
  const { trial } = plan(doc, A, "reggae-v1", { roles: ["drums"] });
  const pick = (notes, role) => notes.filter(note => note.role === role);
  const old = doc.song_cards[A].material.notes;
  for (const role of ["bass", "harmony", "lead"]) assert.deepEqual(pick(trial.material.notes, role), pick(old, role));
  assert.notDeepEqual(pick(trial.material.notes, "drums"), pick(old, "drums"));
});

test("a deliberately edited band note survives, keeps its origin, and cannot collide with new ids", () => {
  const doc = song();
  const notes = doc.song_cards[A].material.notes;
  const lead = notes.find(note => note.role === "bass" && isReplaceableNote(note));
  const edited = { ...lead, step: lead.step + 1, concrete: { ...lead.concrete, midi_pitch: 70 }, edited_from_generator: lead.generated_by };
  delete edited.generated_by;
  notes[notes.indexOf(lead)] = edited;
  const { trial } = plan(doc, A);
  const kept = trial.material.notes.filter(note => note.concrete?.midi_pitch === 70 && note.edited_from_generator);
  assert.deepEqual(kept, [edited]);
  assert.equal(kept[0].provenance, "jam_generated", "origin is not relabelled as personal");
  const ids = trial.material.notes.map(note => note.id);
  assert.equal(new Set(ids).size, ids.length, "note ids stay unique");
});

test("fractional taps, long holds and non-scale pitches on protected notes compare exactly", () => {
  const doc = song();
  const hook = { id: "hook-1", role: "lead", step: 3, duration_steps: 9.5, velocity: .7, patch_id: "warm_keys", provenance: "user_placed",
    performance: { version: 1, offset_steps: .37 }, pitch_lock_mode: "concrete", concrete: { midi_pitch: 61, freq_hz: 277.18 } };
  doc.song_cards[A].material.notes.push(clone(hook));
  const { trial } = plan(doc, A);
  assert.deepEqual(trial.material.notes.find(note => note.id === "hook-1"), hook);
});

test("rapid movement: latest plan wins, returning to a scene is identical, and no history accumulates", () => {
  const doc = song();
  const first = plan(doc, A, "reggae-v1").trial;
  plan(doc, A, "ska-v1");
  const back = plan(doc, A, "reggae-v1").trial;
  assert.deepEqual(back, first);
  assert.ok(!Object.hasOwn(doc, "undo"));
});

test("stale trials are refused: edited section, deleted section, reorder is safe, other song", () => {
  const doc = song();
  const { trial } = plan(doc, A);

  const edited = clone(doc);
  edited.song_cards[A].material.notes.push({ id: "later", role: "lead", step: 1, duration_steps: 1, provenance: "user_placed", concrete: { midi_pitch: 60 } });
  assert.deepEqual(applySectionTrial(edited, trial), { ok: false, reason: "stale" });
  assert.equal(edited.song_cards[A].material.notes.at(-1).id, "later", "the later edit is still there");
  assert.equal(plan(edited, A, "reggae-v1", { revision: trial.baseRevision }).reason, "stale");

  const removed = clone(doc);
  removed.song_cards.splice(A, 1);
  assert.equal(applySectionTrial(removed, trial).reason, "section_missing");

  // The section moved: the trial follows its identity, not the index now holding other music.
  const moved = clone(doc);
  moved.song_cards = moveSongCard(moved.song_cards, A, LINKED);
  const result = applySectionTrial(moved, trial);
  assert.ok(result.ok);
  assert.deepEqual(result.doc.song_cards[LINKED].material, trial.material);
  assert.deepEqual(result.doc.song_cards[A], normalizeSongCards(moved.song_cards)[A]);

  assert.equal(applySectionTrial({ ...clone(doc), id: "other" }, trial).reason, "other_song");
});

test("a tempo or key change makes a pending trial stale", () => {
  const doc = song();
  const { trial } = plan(doc, A);
  const faster = clone(doc);
  faster.global_context.bpm = 120;
  assert.equal(applySectionTrial(faster, trial).reason, "stale");
});

test("a linked repeat becomes independent only when changed", () => {
  const doc = song();
  const next = applySectionTrial(doc, plan(doc, LINKED).trial).doc;
  assert.ok(next.song_cards[LINKED].material);
  assert.deepEqual(next.notes, doc.notes);
  assert.deepEqual(next.song_cards[A], normalizeSongCards(doc.song_cards)[A]);
});

test("an imported song with no jam session works and invents no live session", () => {
  const doc = song({ jam: false });
  const applied = applySectionTrial(doc, plan(doc, A).trial);
  assert.ok(applied.ok);
  assert.ok(!Object.hasOwn(applied.doc, "jam_session"));
});

test("an impossible direction is refused and the song is unchanged", () => {
  const doc = song();
  assert.equal(plan(doc, A, "no-such-scene").reason, "unknown_scene");
  assert.equal(plan(doc, A, "reggae-v1", { roles: ["lead"] }).reason, "unsupported_role");
  assert.equal(planSectionDirection(doc, { sectionId: "nope", sceneId: "reggae-v1" }).reason, "section_missing");
});

test("save and reopen keep the section identity, descriptor and exact notes with no reroll", () => {
  const doc = song();
  const next = applySectionTrial(doc, plan(doc, A).trial).doc;
  const reopened = JSON.parse(JSON.stringify(next));
  validateProject(reopened);
  const cards = normalizeSongCards(reopened.song_cards);
  assert.deepEqual(cards, next.song_cards);
  assert.equal(cards[A].section_direction.scene_id, "reggae-v1");
  assert.deepEqual(cards[A].material.notes, next.song_cards[A].material.notes);
});

test("older saves load untouched and gain ids only when asked", () => {
  const old = [{ bars: 4, beat: true }, { bars: 2, tune: false }];
  const normal = normalizeSongCards(old);
  assert.ok(normal.every(card => !("section_id" in card) && !("section_direction" in card)));
  const ids = ensureSectionIds(old);
  assert.notEqual(ids[0].section_id, ids[1].section_id);
  assert.deepEqual(ensureSectionIds(ids), ids, "an id is assigned once");
});

test("a copied section gets its own identity", () => {
  const cards = ensureSectionIds([{ bars: 4 }]);
  const added = addSongCard(cards);
  assert.equal(added[0].section_id, cards[0].section_id);
  assert.notEqual(added[1].section_id, cards[0].section_id);
  const copied = normalizeSongCards([cards[0], clone(cards[0])]);
  assert.equal(copied[1].section_id, undefined, "a raw duplicate loses the id rather than sharing it");
});

test("import rejects malformed section metadata before it can replace work", () => {
  const base = () => { const doc = song(); return doc; };
  for (const change of [
    doc => { doc.song_cards[1].section_id = doc.song_cards[0].section_id; },
    doc => { doc.song_cards[0].section_id = "has spaces"; },
    doc => { doc.song_cards[0].section_id = 7; },
    doc => { doc.song_cards[0].section_direction = { version: 2, catalogue: "x", scene_id: "y", roles: [] }; },
    doc => { doc.song_cards[0].section_direction = { version: 1, catalogue: "x", scene_id: "y", roles: "drums" }; },
  ]) {
    const doc = base();
    change(doc);
    assert.throws(() => validateProject(doc));
  }
  assert.doesNotThrow(() => validateProject(base()));
});

test("sectionRevision notices material edits only in that section", () => {
  const doc = song();
  const before = [sectionRevision(doc, id(doc, A)), sectionRevision(doc, id(doc, B))];
  doc.song_cards[A].material.notes[0].velocity = .11;
  assert.notEqual(sectionRevision(doc, id(doc, A)), before[0]);
  assert.equal(sectionRevision(doc, id(doc, B)), before[1]);
  assert.equal(sectionRevision(doc, "nope"), null);
});

test("an edit made by the event editor is protected, matching the planner's rule", () => {
  const doc = song();
  const notes = doc.song_cards[A].material.notes;
  const generatedLead = { id: "g", role: "lead", step: 0, duration_steps: 2, provenance: "jam_generated", generated_by: "musiclab_jam", concrete: { midi_pitch: 60 } };
  const [edited] = editLeadEvent([generatedLead], "g", "up");
  assert.equal(isReplaceableNote(generatedLead), true);
  assert.equal(isReplaceableNote(edited), false);
  notes.push(edited);
  assert.deepEqual(plan(doc, A).trial.material.notes.find(note => note.id === "g"), edited);
});

test("hostile section metadata: NaN, missing and wrong types never survive or throw in normalization", () => {
  const junk = [NaN, Infinity, null, undefined, 0, 7, "", " ", "a/b", "x".repeat(65), {}, [], true, { toString: () => "sec" }];
  for (const value of junk) {
    const card = normalizeSongCards([{ bars: 4, section_id: value }])[0];
    assert.ok(!("section_id" in card), `section_id ${String(value)}`);
  }
  const directions = [...junk, { version: NaN }, { version: "1", catalogue: "c", scene_id: "s", roles: [] },
    { version: 1, catalogue: 5, scene_id: "s", roles: [] }, { version: 1, catalogue: "c", roles: [] },
    { version: 1, catalogue: "c", scene_id: "s" }, { version: 1, catalogue: "c", scene_id: "s", roles: [1] },
    { version: 1, catalogue: "c", scene_id: "s", roles: Array(9).fill("drums") }, { version: 1, catalogue: "c".repeat(65), scene_id: "s", roles: [] }];
  for (const value of directions) {
    const card = normalizeSongCards([{ bars: 4, section_direction: value }])[0];
    assert.ok(!("section_direction" in card));
  }
});

test("hostile planner input is refused without throwing or writing", () => {
  const doc = song();
  const before = clone(doc);
  for (const sceneId of [NaN, null, undefined, 7, {}, "", "__proto__"]) assert.equal(planSectionDirection(doc, { sectionId: id(doc, A), sceneId }).ok, false);
  for (const sectionId of [NaN, null, undefined, 7, {}, "__proto__"]) assert.equal(planSectionDirection(doc, { sectionId, sceneId: "reggae-v1" }).ok, false);
  for (const roles of [[], ["lead"], [null], ["__proto__"]]) assert.equal(planSectionDirection(doc, { sectionId: id(doc, A), sceneId: "reggae-v1", roles }).ok, false);
  for (const bad of [null, undefined, {}, { songId: "song-1" }, { songId: "song-1", sectionId: "nope" }]) assert.equal(applySectionTrial(doc, bad).ok, false);
  assert.equal(planSectionDirection(null, { sectionId: "a", sceneId: "reggae-v1" }).ok, false);
  assert.equal(planSectionDirection({}).ok, false);
  assert.deepEqual(doc, before);
});

test("spoofed ownership is not replaceable: a generated label needs the generator's own marker", () => {
  for (const note of [{ provenance: "user_placed", generated_by: "musiclab_jam" }, { provenance: "jam_generated" }, { provenance: "jam_generated", generated_by: "other" },
    { provenance: "jam_generated", generated_by: "musiclab_jam", edited_from_generator: "musiclab_jam" }, null, undefined]) assert.equal(isReplaceableNote(note), false);
});

// A kept performance: a fractional personal tap, a personal hold across the 4-bar boundary, and band notes.
function capturedSong(bars) {
  const source = song();
  source.song_cards = [{ bars: 4 }];
  const stepSec = 15 / 100;
  const event = (time, duration, role, provenance, midi, occurrence) => ({ time, duration, occurrence, event: { id: `src-${occurrence}`, role, provenance,
    ...(provenance === "jam_generated" ? { generated_by: "musiclab_jam" } : {}), patch_id: role === "drums" ? "kick" : "warm_keys", velocity: .6,
    source_note_id: `src-${occurrence}`, concrete: { midi_pitch: midi } } });
  const take = { start: 0, end: bars * 16 * stepSec, bpm: 100, bars, steps_per_bar: 16, events: [
    event(3.37 * stepSec, 2 * stepSec, "lead", "user_placed", 61, 1),
    event(15 * stepSec, 34 * stepSec, "lead", "user_placed", 64, 2),
    event(0, stepSec, "drums", "jam_generated", 36, 3),
    event(8 * stepSec, 4 * stepSec, "bass", "jam_generated", 36, 4),
    event(20 * stepSec, 4 * stepSec, "bass", "jam_generated", 38, 5),
    ...(bars > 4 ? [event(70 * stepSec, 4 * stepSec, "bass", "jam_generated", 40, 6)] : []),
  ] };
  const doc = materializePerformance(source, take);
  doc.song_cards = ensureSectionIds(doc.song_cards);
  return doc;
}
const compiled = doc => {
  const loopDoc = { ...doc, arrangement_mode: "loop" };
  const loop = compileSongStandalone(loopDoc, null);
  const parts = doc.song_cards.map(card => card.material ? compileSongStandalone(applySongMaterial(loopDoc, card.material), null) : loop);
  return songEvents(loop, doc.song_cards, parts);
};

test("a kept performance: personal notes compare exactly, its band is replaced and reported, the original stays recoverable", () => {
  const doc = capturedSong(4);
  const before = clone(doc);
  const { ok, trial } = plan(doc, 0);
  assert.ok(ok);
  assert.equal(trial.summary.capturedBandReplaced, 3, "the host can tell the person the kept band is being replaced");
  const next = applySectionTrial(doc, trial).doc;
  assert.deepEqual(own(next.song_cards[0].material.notes), own(before.notes));
  assert.ok(own(before.notes)[0].performance.offset_steps > .3, "the fixture really has a fractional tap");
  assert.ok(!next.song_cards[0].material.notes.some(note => note.source_note_id === "src-4"), "the captured bass is gone from this section");
  assert.deepEqual(next.captured_performance, before.captured_performance);
  assert.deepEqual(next.capture_source, before.capture_source);
  assert.equal(next.global_context.bpm, before.global_context.bpm);
  assert.doesNotThrow(() => validateProject(JSON.parse(JSON.stringify(next))));
});

test("a band change on a song without kept notes reports nothing captured", () => {
  const doc = song();
  assert.equal(plan(doc, A).trial.summary.capturedBandReplaced, 0);
});

test("a personal hold crossing captured sections sounds the same after either section's band changes", () => {
  const doc = capturedSong(8);
  assert.equal(doc.song_cards.length, 2);
  const held = song => song.events.filter(event => event.provenance === "user_placed").map(event => [event.start_sec, event.duration_sec, event.concrete?.midi_pitch]);
  const before = held(compiled(doc));
  assert.ok(before.length >= 2);
  for (const index of [0, 1]) {
    const next = applySectionTrial(doc, plan(doc, index).trial).doc;
    assert.deepEqual(next.song_cards[index].capture_segment, doc.song_cards[index].capture_segment, "segment identity is retained");
    assert.deepEqual(held(compiled(next)), before);
  }
});

// Guard: a live band change cannot silently delete what was kept or edited.
const capturedBand = doc => doc.notes.filter(note => note.provenance === "jam_generated" && note.capture_occurrence !== undefined);

test("a live band change keeps a kept performance's band exactly and does not stack a second band on its roles", () => {
  const doc = capturedSong(4);
  const band = capturedBand(doc);
  assert.equal(band.length, 3);
  const next = setJamDirection(doc, { scene_catalogue: "first-neighborhood-v1", scene_id: "reggae-v1" });
  assert.deepEqual(capturedBand(next), band, "the band that was heard at Keep is still there");
  assert.deepEqual(own(next.notes), own(doc.notes));
  for (const role of new Set(band.map(note => note.role))) {
    assert.ok(next.notes.filter(note => note.role === role && note.capture_occurrence === undefined).every(note => note.provenance !== "jam_generated"),
      `no new ${role} is layered over the kept ${role}`);
  }
});

test("playing a pad on a kept performance keeps its band", () => {
  const doc = capturedSong(4);
  const band = capturedBand(doc);
  const next = contributeJam(doc, { pad: 1, step: 6 });
  assert.equal(next.jam_session.last_contribution.added, true);
  assert.deepEqual(capturedBand(next), band);
});

test("a band note marked as edited survives a live change even if its old generator label remains", () => {
  const doc = song();
  const note = doc.notes.find(item => item.role === "bass" && item.generated_by);
  note.edited_from_generator = note.generated_by;
  note.concrete.midi_pitch = 70;
  const next = setJamDirection(doc, { density: 4 });
  assert.equal(next.notes.find(item => item.id === note.id)?.concrete.midi_pitch, 70);
});

test("replacing a kept band takes an explicit request, which only the section planner makes", () => {
  const doc = capturedSong(4);
  const next = setJamDirection(doc, { scene_catalogue: "first-neighborhood-v1", scene_id: "reggae-v1", replace_captured_band: true });
  assert.deepEqual(capturedBand(next), []);
  const { trial } = plan(doc, 0);
  assert.deepEqual(trial.material.notes.filter(note => note.capture_occurrence !== undefined && note.provenance === "jam_generated"), []);
  const fresh = trial.material.notes.filter(note => note.provenance === "jam_generated");
  assert.equal(new Set(fresh.map(note => note.id)).size, fresh.length);
  assert.ok(fresh.length > 0, "the planned band is really there");
});

test("a refreshed tune-grid cache is not an edit, so a redraw cannot make a trial stale", () => {
  const doc = song();
  const { trial } = plan(doc, A);
  doc.song_cards[A].material.tune_grid_state = { refreshed: true };
  assert.equal(sectionRevision(doc, id(doc, A)), trial.baseRevision);
  assert.ok(applySectionTrial(doc, trial).ok);
});
