import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SONG_CARDS,
  ensureSectionIds,
  insertSongPart,
  removeSongPart,
  normalizeSongCards,
  moveSongCard,
} from "../../../static/js/theory/song_view.js";

const personalNote = (id, midi) => ({
  id, role: "lead", midi, step: 3.25, duration_steps: 5.75,
  provenance: "user_placed", velocity: .73,
});
const material = (id, midi) => ({
  notes: [personalNote(id, midi)],
  lead_patch_id: "piano",
  underneath: { feel: "warm" },
  tune_grid_state: { main: [{ midi }], ending: [], baseEnding: [] },
});
const fixture = () => ensureSectionIds([
  { section_id: "opening", role_name: "Beginning", bars: 2, material: material("jam-live-a", 61) },
  { section_id: "middle", role_name: "Main part", bars: 3, material: material("jam-live-b", 67) },
  { section_id: "ending", role_name: "Ending", bars: 1, fx: "drum_roll", material: material("jam-live-c", 69) },
]);

test("section identities repair legacy/duplicate IDs deterministically without stealing a later valid ID", () => {
  const input = [{}, { section_id: "section-1" }, { section_id: "custom" },
    { section_id: "custom" }, { section_id: "invalid id" }];
  const before = structuredClone(input);
  const result = ensureSectionIds(input);
  const ids = result.map(c => c.section_id);
  assert.deepEqual(input, before);
  assert.equal(ids[1], "section-1");
  assert.equal(ids[2], "custom");
  assert.equal(new Set(ids).size, input.length);
  assert.ok(ids.every(id => /^[A-Za-z0-9_-]{1,64}$/.test(id)));
  for (const i of [0, 3, 4]) assert.match(ids[i], /^section-\d+$/);
  assert.deepEqual(ensureSectionIds(input), result);
  assert.deepEqual(ensureSectionIds(result), result);
});

test("section identity survives normalization, serialization and reordering with its material", () => {
  const cards = fixture();
  const restored = normalizeSongCards(JSON.parse(JSON.stringify(cards)));
  assert.deepEqual(restored, cards);
  const moved = moveSongCard(restored, 0, 1);
  assert.deepEqual(moved.map(c => c.section_id), ["middle", "opening", "ending"]);
  assert.deepEqual(moved[1], cards[0]);
  assert.deepEqual(moved[2], cards[2]);
});

test("adding a part copies the selected material independently before the unchanged ending", () => {
  const cards = fixture(), before = structuredClone(cards);
  const result = insertSongPart(cards, "opening", material("unrelated", 90));
  assert.equal(result.cards.length, 4);
  assert.deepEqual(cards, before);
  assert.deepEqual(result.cards.at(-1), before.at(-1));
  assert.deepEqual(result.cards.filter(c => c.section_id !== result.selectedSectionId), before);
  const added = result.cards.find(c => c.section_id === result.selectedSectionId);
  assert.ok(added);
  assert.ok(!before.some(c => c.section_id === added.section_id));
  assert.deepEqual(added.material, before[0].material);
  assert.equal(added.bars, 2);
  added.material.notes[0].midi = 72;
  added.material.tune_grid_state.main[0].midi = 72;
  assert.deepEqual(result.cards[0], before[0]);
  assert.deepEqual(cards, before);
});

test("adding while the ending is selected copies the preceding part, not the ending", () => {
  const cards = fixture(), before = structuredClone(cards);
  const result = insertSongPart(cards, "ending", {});
  const added = result.cards.find(c => c.section_id === result.selectedSectionId);
  assert.deepEqual(added.material, before[1].material);
  assert.equal(added.bars, before[1].bars);
  assert.deepEqual(result.cards.at(-1), before.at(-1));
  assert.deepEqual(cards, before);
});

test("adding from shared material detaches a musical snapshot without copying document identity/history", () => {
  const cards = ensureSectionIds([{ section_id: "shared", bars: 4 }]);
  const shared = { ...material("jam-live-shared", 64), id: "song-id",
    global_context: { root_pc: 4, tempo: 97 }, history: [{ action: "keep" }] };
  const before = structuredClone(shared);
  const result = insertSongPart(cards, "shared", shared);
  const added = result.cards.find(c => c.section_id === result.selectedSectionId);
  assert.equal(result.cards.length, 2);
  assert.deepEqual(result.cards.at(-1), cards[0]);
  assert.deepEqual(added.material, material("jam-live-shared", 64));
  added.material.notes[0].duration_steps = 1;
  assert.deepEqual(shared, before);
  assert.deepEqual(result.cards.at(-1), cards[0]);
});

test("adding at the supported part limit preserves every source and the ending", () => {
  const cards = ensureSectionIds(Array.from({ length: MAX_SONG_CARDS }, (_, i) => ({
    section_id: `part-${i}`, material: material(`jam-live-${i}`, 60 + i),
    ...(i === MAX_SONG_CARDS - 1 ? { role_name: "Ending", fx: "beat_drop" } : {}),
  })));
  const before = structuredClone(cards);
  const result = insertSongPart(cards, cards[2].section_id, {});
  assert.deepEqual(result.cards, before);
  assert.equal(result.selectedSectionId, cards[2].section_id);
  assert.deepEqual(cards, before);
});

test("removing by stable identity preserves survivor order/material and selects a surviving part", () => {
  const cards = fixture(), before = structuredClone(cards);
  const result = removeSongPart(cards, "middle");
  assert.deepEqual(result.cards, [before[0], before[2]]);
  assert.ok(result.cards.some(c => c.section_id === result.selectedSectionId));
  assert.deepEqual(cards, before);
  assert.deepEqual(normalizeSongCards(JSON.parse(JSON.stringify(result.cards))), result.cards);
  assert.deepEqual(ensureSectionIds(before), before, "an Undo snapshot must retain its section identities");
});

test("removing the final part preserves a selectable editable song", () => {
  const cards = ensureSectionIds([fixture()[0]]), before = structuredClone(cards);
  const result = removeSongPart(cards, cards[0].section_id);
  assert.deepEqual(result.cards, before);
  assert.equal(result.selectedSectionId, cards[0].section_id);
  assert.deepEqual(cards, before);
});
