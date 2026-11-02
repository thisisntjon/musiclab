// Phase 10 (10-1, 10-4, 10-6): Song view card model and non-destructive multi-card song compilation.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SONG_CARDS,
  CARD_FX,
  defaultSongCards,
  addSongCard,
  removeSongCard,
  moveSongCard,
  toggleCardLayer,
  toggleCardFx,
  toggleCardBig,
  toggleCardTuneVariation,
  revealSongArc,
  capturePerformedArrangement,
  songEvents,
  extractSongMaterial,
  applySongMaterial,
  detachSongCard,
  updateSongCardMaterial,
  setSongCardBars,
  songCardRanges,
} from "../../../static/js/theory/song_view.js";
import { newPlayDoc, recordAct, madeByYou } from "../../../static/js/theory/session_rules.js";
import { savePiece, loadPiece } from "../../../static/js/theory/save_store.js";

test("part lengths change offsets and clip playback without deleting source notes", () => {
  const loop = sampleLoop();
  loop.events.push({ id: "long", role: "lead", step: 15, start_sec: 2.25, duration_sec: 2, concrete: { midi: 60 } });
  const original = structuredClone(loop);
  let cards = setSongCardBars(addSongCard(defaultSongCards()), 0, 1);
  cards = setSongCardBars(cards, 1, 2);
  assert.deepEqual(songCardRanges(cards).map((range) => [range.start_step, range.end_step]), [[0, 16], [16, 48]]);
  const result = songEvents(loop, cards);
  assert.equal(result.total_steps, 48);
  assert.equal(result.total_duration_sec, 7.2);
  assert.ok(Math.abs(result.events.find((event) => event.id === "long").duration_sec - .15) < 1e-9);
  assert.deepEqual(loop, original);
  const restored = songEvents(loop, setSongCardBars(cards, 0, 4));
  assert.equal(restored.events.find((event) => event.id === "long").duration_sec, 2);
});

test("detached material isolates edits, accompaniment removal, and duplicated parts", () => {
  const doc = newPlayDoc();
  doc.underneath = { feel: "warm" };
  doc.tune_grid_state = { main: [{ midi: 60 }], ending: [], baseEnding: [] };
  let cards = detachSongCard(addSongCard(defaultSongCards()), 1, doc);
  const original = structuredClone(cards[1].material);
  const working = applySongMaterial(doc, cards[1].material);
  working.notes[0].velocity = 0.23;
  working.tune_grid_state.main[0].midi = 67;
  delete working.underneath;
  cards = updateSongCardMaterial(cards, 1, working);
  assert.equal(cards[0].material, undefined);
  assert.deepEqual(extractSongMaterial(doc), original);
  assert.equal(applySongMaterial(doc, cards[1].material).underneath, undefined);
  assert.deepEqual(applySongMaterial(doc, cards[1].material).global_context, doc.global_context);
  cards = addSongCard(cards);
  cards[2].material.notes[0].velocity = 0.9;
  assert.equal(cards[1].material.notes[0].velocity, 0.23);
  const performed = capturePerformedArrangement(cards, [1, 1]);
  performed[0].material.tune_grid_state.main[0].midi = 72;
  assert.equal(performed[1].material.tune_grid_state.main[0].midi, 67);
});

test("distinct section material survives reorder, save/reopen and produces distinct events", () => {
  const doc = newPlayDoc();
  doc.song_cards = detachSongCard(addSongCard(defaultSongCards()), 1, doc);
  doc.song_cards[1].material.lead_patch_id = "warm_keys";
  doc.song_cards = moveSongCard(doc.song_cards, 1, 0);
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  assert.equal(savePiece(store, doc).ok, true);
  const restored = loadPiece(store, doc.id);
  assert.deepEqual(restored.song_cards, doc.song_cards);
  const loop = sampleLoop();
  const independent = structuredClone(loop);
  independent.events[1].concrete.midi_pitch = 67;
  independent.events[1].patch_id = restored.song_cards[0].material.lead_patch_id;
  const song = songEvents(loop, restored.song_cards, [independent, null]);
  const lead0 = song.events.find((e) => e.card === 0 && e.role === "lead");
  const lead1 = song.events.find((e) => e.card === 1 && e.role === "lead");
  assert.equal(lead0.concrete.midi_pitch, 67);
  assert.equal(lead0.patch_id, "warm_keys");
  assert.equal(lead1.concrete.midi_pitch, 60);
  assert.equal(lead1.step, lead0.step + 64);
  assert.equal(song.total_duration_sec, 19.2);
});

test("parts can be reordered without changing their settings", () => {
  const cards = [
    { role_name: "Beginning", beat: true, tune: false, under: false },
    { role_name: "Main", beat: true, tune: true, under: true, big: true },
    { role_name: "Ending", beat: false, tune: true, under: true, fx: "beat_drop" },
  ];
  const moved = moveSongCard(cards, 2, 0);
  assert.deepEqual(moved.map((c) => c.role_name), ["Ending", "Beginning", "Main"]);
  assert.equal(moved[0].fx, "beat_drop");
  assert.equal(moved[2].big, true);
  assert.deepEqual(cards.map((c) => c.role_name), ["Beginning", "Main", "Ending"]);
});

test("one part can vary its tune without changing linked parts", () => {
  const loop = sampleLoop();
  let cards = addSongCard(defaultSongCards());
  cards = toggleCardTuneVariation(cards, 1);
  const song = songEvents(loop, cards);
  const first = song.events.find((event) => event.role === "lead" && event.card === 0);
  const varied = song.events.find((event) => event.role === "lead" && event.card === 1);
  assert.equal(first.concrete.midi_pitch, 60);
  assert.equal(varied.concrete.midi_pitch, 72);
  assert.equal(varied.provenance, first.provenance);
  assert.equal(cards[0].tune_variant, null);
  assert.equal(cards[1].tune_variant, "lift");
});

test("invalid move indices never reorder or discard parts", () => {
  const cards = revealSongArc();
  const expected = cards.map((card) => card.role_name);
  for (const invalid of [NaN, undefined, 0.5, "1", Infinity, -1, 3]) {
    assert.deepEqual(moveSongCard(cards, invalid, 0).map((card) => card.role_name), expected);
    assert.deepEqual(moveSongCard(cards, 0, invalid).map((card) => card.role_name), expected);
  }
});

test("lift preserves pitch class, tuning, aliases and source at high pitches", () => {
  const loop = sampleLoop();
  loop.events[1].concrete = { midi: 90, midi_pitch: 90, freq_hz: 1481 };
  loop.events[1].voiced_freqs = [1481, 2221.5];
  const before = structuredClone(loop);
  const cards = toggleCardTuneVariation(defaultSongCards(), 0);
  const event = songEvents(loop, cards).events.find((item) => item.role === "lead");
  assert.equal(event.concrete.midi, 102);
  assert.equal(event.concrete.midi_pitch, 102);
  assert.equal(event.concrete.freq_hz, 2962);
  assert.deepEqual(event.voiced_freqs, [2962, 4443]);
  assert.deepEqual(loop, before);
  assert.deepEqual(songEvents(loop, toggleCardTuneVariation(cards, 0)).events.find((item) => item.role === "lead").concrete, before.events[1].concrete);
});

test("muted backing stays silent even with Big and lift effects", () => {
  let cards = addSongCard(defaultSongCards());
  cards = toggleCardLayer(cards, 0, "under");
  cards = toggleCardBig(cards, 1);
  cards = toggleCardFx(cards, 0, "high_lift");
  const events = songEvents(sampleLoop(), cards).events.filter((event) => event.card === 0);
  assert.ok(events.every((event) => event.role === "lead" || event.role === "drums"));
});

test("reordered lifted cards survive save/reopen with the same playback schedule", () => {
  const store = { data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, value) { this.data[key] = value; } };
  const doc = newPlayDoc();
  doc.song_cards = moveSongCard(toggleCardTuneVariation(revealSongArc(), 2), 2, 0);
  const expected = songEvents(sampleLoop(), doc.song_cards);
  assert.equal(savePiece(store, doc).ok, true);
  assert.deepEqual(songEvents(sampleLoop(), loadPiece(store, doc.id).song_cards), expected);
});

function sampleLoop() {
  return {
    bpm: 100,
    total_steps: 64,
    total_duration_sec: 9.6,
    events: [
      { id: "drum-kick-0", step: 0, start_sec: 0, duration_sec: 0.2, role: "drums", patch_id: "kick", provenance: "seed_template" },
      { id: "tune-0-0-60", step: 0, start_sec: 0, duration_sec: 0.3, role: "lead", patch_id: "pluck_lead", provenance: "user_placed", concrete: { midi_pitch: 60 } },
      { id: "tune-0-4-64", step: 4, start_sec: 0.6, duration_sec: 0.3, role: "lead", patch_id: "pluck_lead", provenance: "hummed_confirmed", concrete: { midi_pitch: 64 } },
      { id: "harm-0", step: 0, start_sec: 0, duration_sec: 2.4, role: "harmony", patch_id: "warm_keys", provenance: "chord_stab" },
      { id: "bass-0", step: 0, start_sec: 0, duration_sec: 1.2, role: "bass", patch_id: "clean_bass", provenance: "accompaniment_bass" },
    ],
  };
}

test("10-1: songEvents preserves every tune event's id, pitch, and provenance across cards", () => {
  const loop = sampleLoop();
  let cards = defaultSongCards();
  cards = addSongCard(cards);
  cards = addSongCard(cards);
  assert.equal(cards.length, 3);

  const song = songEvents(loop, cards);
  assert.equal(song.total_steps, 3 * 64);
  assert.equal(song.total_duration_sec, 28.8);

  const lead = song.events.filter((e) => e.role === "lead");
  assert.equal(lead.length, 6);
  for (const ev of lead) {
    const orig = loop.events.find((x) => x.id === ev.id);
    assert.ok(orig, "every lead event comes from a loop event with the same id");
    assert.equal(ev.concrete.midi_pitch, orig.concrete.midi_pitch);
    assert.equal(ev.provenance, orig.provenance);
    assert.equal(ev.step, orig.step + ev.card * 64);
  }
});

test("10-1: muted layers have zero events in that card while other cards keep theirs", () => {
  const loop = sampleLoop();
  let cards = addSongCard(defaultSongCards()); // 2 cards
  cards = toggleCardLayer(cards, 0, "under"); // card 0: no chords/bass
  cards = toggleCardLayer(cards, 1, "beat"); // card 1: no drums

  const song = songEvents(loop, cards);
  const card0 = song.events.filter((e) => e.card === 0);
  const card1 = song.events.filter((e) => e.card === 1);

  assert.equal(card0.filter((e) => e.role === "harmony" || e.role === "bass").length, 0);
  assert.equal(card0.filter((e) => e.role === "drums").length, 1);
  assert.equal(card1.filter((e) => e.role === "drums").length, 0);
  assert.equal(card1.filter((e) => e.role === "harmony" || e.role === "bass").length, 2);
});

test("10-2: cards cap at MAX_SONG_CARDS (8) and never drop below 1", () => {
  let cards = defaultSongCards();
  for (let i = 0; i < 12; i++) cards = addSongCard(cards);
  assert.equal(cards.length, MAX_SONG_CARDS);
  for (let i = 0; i < 12; i++) cards = removeSongCard(cards);
  assert.equal(cards.length, 1);
});

test("10-4 & 10-6: song cards round-trip through savePiece/loadPiece and count toward madeByYou", () => {
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = String(v); } };
  const doc = newPlayDoc();
  doc.song_cards = toggleCardLayer(addSongCard(defaultSongCards()), 0, "under");
  recordAct(doc, "song_layer", { card: 0, layer: "under" });
  doc.play_session.choices = { song_layer: "0:under" };
  assert.equal(madeByYou(doc), true);

  savePiece(store, doc);
  const loaded = loadPiece(store, doc.id);
  assert.deepEqual(loaded.song_cards, doc.song_cards);
});

test("12e-1 (#3): toggleCardFx applies beat_drop, high_lift, and drum_roll while preserving 10-1 lead note invariants", () => {
  const loop = sampleLoop();
  loop.events.push({
    id: "drum-kick-52",
    step: 52,
    start_sec: 7.8,
    duration_sec: 0.2,
    role: "drums",
    patch_id: "kick",
    provenance: "seed_template",
  });
  let cards = defaultSongCards();
  cards = toggleCardFx(cards, 0, "beat_drop");
  const dropSong = songEvents(loop, cards);
  assert.equal(dropSong.events.some((e) => e.id === "drum-kick-52"), false, "beat_drop mutes Bar 4 drums");

  cards = toggleCardFx(cards, 0, "high_lift");
  const liftSong = songEvents(loop, cards);
  assert.equal(liftSong.events.filter((e) => e.role === "lead").length, 2, "original lead events untouched");
  assert.ok(liftSong.events.some((e) => String(e.id).includes("-lift-c0") && e.role === "harmony"));

  cards = toggleCardFx(cards, 0, "drum_roll");
  const rollSong = songEvents(loop, cards);
  assert.equal(rollSong.events.filter((e) => String(e.id).startsWith("fx-roll-c0-")).length, 8);
});

test("12e-2 (#11, #13): toggleCardBig silences pre-drop breath (steps 61..63) and injects pitched reverse_swell riser", () => {
  const loop = sampleLoop();
  loop.events[1].concrete = { midi: 60, freq_hz: 261.63 };
  loop.events.push({
    id: "drum-hat-62",
    step: 62,
    start_sec: 9.3,
    duration_sec: 0.1,
    role: "drums",
    patch_id: "hat_closed",
    provenance: "seed_template",
  });
  let cards = addSongCard(defaultSongCards());
  cards = toggleCardBig(cards, 1);
  const song = songEvents(loop, cards);
  const card0 = song.events.filter((e) => e.card === 0);
  assert.equal(card0.some((e) => e.id === "drum-hat-62"), false, "step 62 drum silenced before Big card");
  const swell = card0.find((e) => e.patch_id === "reverse_swell");
  assert.ok(swell, "reverse_swell riser injected into card 0 before Big card 1");
  assert.equal(swell.concrete.freq_hz, 261.63);
});

test("12f-2 (Proposals #6 & #11): revealSongArc builds Beginning/Main/Ending and capturePerformedArrangement records sequence", () => {
  const loop = sampleLoop();
  const arc = revealSongArc();
  assert.equal(arc.length, 3);
  assert.deepEqual(
    arc.map((c) => c.role_name),
    ["Beginning", "Main part", "Ending"]
  );
  assert.equal(arc[0].under, false);
  assert.equal(arc[1].big, true);
  assert.equal(arc[2].beat, false);

  const performed = capturePerformedArrangement(arc, [0, 1, 1, 2]);
  assert.equal(performed.length, 4);
  assert.deepEqual(
    performed.map((c) => c.role_name),
    ["Beginning", "Main part", "Main part", "Ending"]
  );

  const compiled = songEvents(loop, performed);
  assert.equal(compiled.total_steps, 4 * 64);
});
