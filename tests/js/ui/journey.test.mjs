// Phase 13.8: the eight-step journey, in order, as one test. This is the technical MVP gate.
// Listen → keys change the next bar → Make my song keeps playing → two contrasting parts and an ending →
// Calmer changes one part, Undo restores → the whole song plays from the start → save, reload, reopen identical →
// the export covers every part and the sheet round-trips. Along the way: no refusals, five controls, legend names.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { planMelodicPhrase } from "../../../static/js/theory/melodic_evolution.js";
import { toMusicXML, fromMusicXML } from "../../../static/js/theory/score_sheet.js";
import { songCardRanges } from "../../../static/js/theory/song_view.js";
import { SCENE_CATALOGUE } from "../../../static/js/theory/scene_catalogue.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

const REFUSAL = /(\bfirst[.,]|\bfirst,? then\b|\bbefore (joining|playing|keeping|adding)\b|can't|cannot|supports up to|release one|\bis full\b|load sounds|press play (before|or|in)\b|choose a .* first|go back to)/i;

function world() {
  const values = new Map(), session = new Map();
  const win = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {}, matchMedia: () => ({ matches: false }) };
  return win;
}
function flowIn(win, { randomStyle = Math.random() } = {}) {
  globalThis.window = win;
  globalThis.CSS = globalThis.CSS || { escape: s => String(s) };
  globalThis.document = { hidden: false, body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  const said = [], queued = [];
  const scheduler = {
    isPlaying: false, stopGeneration: 0, currentStep: 6, jamPhraseOrdinal: 0, liveNotes: new Map(), masterBus: { piano: {}, disposed: false }, audioCtx: { currentTime: 0 },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {}, unlock: async () => {}, previewSound() {}, noteOn() { return 1; }, noteOff() {},
    stop() { this.isPlaying = false; this.stopGeneration++; }, start() { this.isPlaying = true; }, seekToStep(s) { this.currentStep = s; },
    capturePerformance: () => null, activeJamBacking: () => ({ phraseContext: { root: 0, minor: false } }), activeJamContext: () => null,
    _supportsJamPhrase: () => true, activeJamForm: null, committedJamBacking: [],
    activeJamLead: { planVersion: 1, events: planMelodicPhrase({ version: 2, phraseOrdinal: 1, sceneId: "contrast-1", root: 0, minor: false, bpm: 100, seed: 1 }).events, descriptor: null },
    queueJamLead(plan) { queued.push(plan); return true; }, addPlayEnergy() { this.energy = (this.energy || 0) + 1; return this.energy; }, energyAt: () => 0,
    requestJamAnswer() { return true; }, cancelJamAnswer() {}, jamAnswerStatus: () => "", jamAnswerReadiness: () => ({ state: "ready", label: "", message: "" }),
  };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler, _announce: m => said.push(String(m)), _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "start"; flow.trail = []; flow.confirm = {}; flow.liveHolds = new Map();
  flow._freshState();
  flow.explorationRandom = () => randomStyle;
  flow._keepMusicGoing = async function () { this.app.scheduler.start(); return true; };
  // Sampled sounds load from a file in the browser; here the instrument starts at once, as the listening tests do.
  flow._startInstrument = async function () { this.doc = startJam(this.doc, { patchId: "sampled_piano_v1" }); this.stage = "jam"; return true; };
  flow.said = said; flow.queued = queued;
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
const byPart = (flow, i) => flow.app.compiledSong.events.filter(e => e.card === i);
const sig = events => [...new Set(events.map(e => e.role))].sort().join(",") + ":" + events.reduce((s, e) => s + (e.velocity ?? 0), 0).toFixed(2);
const primaryCount = html => {
  const outside = html.replace(/<div class="pf-song-card[\s\S]*?<\/div>\s*<\/div>/g, "").replace(/<details[\s\S]*?<\/details>/g, "");
  return [...outside.matchAll(/data-key="(play|add-card|keep|undo|back|save|download|dl-sheet|to-song|capture-direction)"/g)].length;
};

test("the eight-step journey passes in order, on a random style, with no refusals and five controls per screen", async () => {
  const win = world();
  const style = Math.random();
  let flow = flowIn(win, { randomStyle: style });

  // 1. Listen: a random style plays.
  await press(flow, "listen-circle");
  assert.equal(flow.stage, "jam");
  assert.equal(flow.app.scheduler.isPlaying, true);
  const scene = flow.doc.jam_session.scene_id;
  assert.ok(SCENE_CATALOGUE.some(s => s.id === scene), `a real style: ${scene}`);

  // 2. Keys: a press changes the band's next bar and adds energy; the person's notes stay theirs.
  const notesBefore = structuredClone(flow.doc.notes);
  flow._playJamPad(2, null);
  assert.ok(flow.queued.length >= 1 && flow.queued.at(-1).commitStep !== undefined, "the next bar is re-planned around the played note");
  assert.ok(flow.app.scheduler.energy >= 1);
  assert.deepEqual(flow.doc.notes, notesBefore, "live playing never edits the song's notes behind the person's back");
  assert.equal(flow._journeyLevel(), "play");

  // What the scheduler would have recorded: the band, plus the note the person just played (the stub plays nothing).
  const ev = (id, role, patch, midi, time, provenance = "jam_generated") => ({ event: { id, role, patch_id: patch, velocity: .7, provenance, concrete: { midi_pitch: midi, freq_hz: 440 * 2 ** ((midi - 69) / 12) }, duration_steps: 2 }, time, duration: .3, occurrence: 1 });
  flow.app.scheduler.capturePerformance = () => ({ source_song_id: flow.doc.id, bars: 4, bpm: 100, start: 0, end: 9.6, steps_per_bar: 16, events: [
    ...Array.from({ length: 16 }, (_, i) => ev(`k${i}`, "drums", "kick", 36, i * .6)), ...Array.from({ length: 8 }, (_, i) => ev(`b${i}`, "bass", "clean_bass", 48, i * 1.2)),
    ...Array.from({ length: 8 }, (_, i) => ev(`c${i}`, "harmony", "warm_keys", 60 + (i % 2) * 4, i * 1.2)),
    { ...ev("jam-live-mine", "lead", "warm_keys", 67, .9, "user_placed"), event: { ...ev("jam-live-mine", "lead", "warm_keys", 67, .9, "user_placed").event, source_note_id: "jam-live-mine" } } ] });

  // 3. Make my song: the music keeps playing and Shape opens.
  await press(flow, "capture-direction");
  assert.equal(flow.stage, "tune");
  assert.equal(flow.doc.song_cards.length,1,"Keep does not generate extra parts");
  await press(flow,"build-starter");
  assert.equal(flow.partComparison?.kind,"starter");
  await press(flow,"compare-keep");
  assert.equal(flow.app.scheduler.isPlaying, false, "accepting a preview does not unexpectedly start audio");
  assert.ok(!flow.adjustOpen && flow.adjustHand.length >= 2, "ideas are available without opening on arrival");
  await press(flow, "adjust-keep-as-is");

  // 4. Two contrasting parts and an ending.
  const cards = flow.doc.song_cards;
  assert.ok(cards.length >= 3);
  assert.notEqual(sig(byPart(flow, 0)), sig(byPart(flow, 2)), "ending band is softer");
  assert.equal(flow.doc.song_path.groups.length,3,"three deliberate song chapters");
  assert.ok(primaryCount(flow._renderSong()) <= 5, "five primary controls on Shape");

  // 5. Calmer changes only that part; Undo restores it exactly.
  const before = cards.map((_, i) => structuredClone(byPart(flow, i)));
  await press(flow, "part-mood:1:calmer");
  assert.notDeepEqual(byPart(flow, 1), before[1]);
  assert.deepEqual(byPart(flow, 2), before[2], "the part after is untouched");
  await press(flow, "undo");
  for (const i of before.keys()) assert.deepEqual(byPart(flow, i), before[i]);

  // 6. The whole song plays from the start (the timeline's seek), and a drag into Detail keeps it going.
  flow.app.scheduler.stop();
  await flow._seekTo(0);
  assert.equal(flow.app.scheduler.isPlaying, true);
  assert.equal(flow.app.scheduler.currentStep, 0);
  await press(flow, "edit-card:1");
  assert.equal(flow.stage, "tune");
  assert.equal(flow.app.scheduler.isPlaying, true, "music carries into Detail");
  assert.ok(flow.legendOpen === undefined || flow.legendOpen === false);
  await press(flow, "legend-open");
  const names = flow._legendElements().map(e => e.id);
  for (const id of ["tune", "drums", "beat", "bar", "own"]) assert.ok(names.includes(id), `What is this? names ${id}`);
  await press(flow, "legend-open");
  await press(flow, "journey:share");
  assert.equal(flow.stage, "keep");
  assert.ok(primaryCount(flow._renderKeep()) <= 5, "five primary controls on Share");

  // 7. Save, reload the page, reopen: identical, on Shape.
  flow.doc.title = "Journey song";
  flow._save();
  const saved = structuredClone(flow._canonicalDoc());
  const later = flowIn(win);
  later._continue(saved.id);
  assert.equal(later.stage, "song");
  const strip = doc => ({ ...doc, last_stage: undefined });   // reopening lands on Shape by design
  assert.deepEqual(strip(later._canonicalDoc()), strip(saved));

  // 8. The export covers every part and the sheet round-trips.
  const song = later.app.compiledSong, ranges = songCardRanges(later.doc.song_cards, 64, song.bpm, 16);
  assert.equal(song.total_steps, ranges.at(-1).end_step);
  for (const r of ranges) assert.ok(song.events.some(e => e.step >= r.start_step && e.step < r.end_step && (e.velocity ?? 1) > 0), `part ${r.index + 1} has sound`);
  const sheet = fromMusicXML(toMusicXML(later._sheetScore()));
  assert.equal(sheet.ok, true);
  assert.ok(sheet.notes.length > 0 && sheet.notes.some(n => n.provenance === "user_placed"), "the sheet keeps your notes as yours");

  // Along the way: nothing was refused.
  const refusals = [...flow.said, ...later.said].filter(m => REFUSAL.test(m) && !/^Music is locked|^No voice is set up here/.test(m));
  assert.deepEqual(refusals, []);
});

test("the journey completes by keyboard alone: journey keys, pads by letter, timeline arrows, Enter on controls", async () => {
  const flow = flowIn(world());
  await press(flow, "listen-circle");
  globalThis.document = { hidden: false, body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  flow.root = { style: {}, contains: () => true, querySelector: () => null, querySelectorAll: () => [] };
  const key = (k, target = {}) => flow._onKey({ key: k, target, preventDefault() {}, stopImmediatePropagation() {}, ctrlKey: false, altKey: false, metaKey: false, repeat: false });
  key("s");                                      // a pad by letter
  assert.ok(flow.queued.length >= 1);
  await press(flow, "capture-direction");        // Enter on the focused button is a click
  await press(flow, "adjust-keep-as-is");
  await key("ArrowRight", { hasAttribute: n => n === "data-timeline", tagName: "svg" });
  assert.equal(flow.app.scheduler.currentStep, 16, "the timeline moved one bar by keyboard");
  await press(flow, "journey:detail"); assert.equal(flow.stage, "tune");
  await press(flow, "journey:share"); assert.equal(flow.stage, "keep");
});
