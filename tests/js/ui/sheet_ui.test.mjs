import {songArcFromCapture} from '../../../static/js/theory/song_view.js';
// Phase 13.6a: the sheet in the app. Shape shows it in step with the music; Share hands it out; it opens again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";
import { toMusicXML, fromMusicXML } from "../../../static/js/theory/score_sheet.js";

function setup() {
  const values = new Map(), session = new Map();
  globalThis.window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler: { isPlaying: false, stopGeneration: 0, setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {},
    setSpotlightRole() {}, unlock: async () => {}, previewSound() {}, stop() {}, start() {}, capturePerformance: () => null, activeJamBacking: () => null,
    masterBus: { piano: {}, disposed: false } }, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = "song"; flow.trail = []; flow.confirm = {};
  flow._freshState();
  return flow;
}
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
async function songOf(flow) {
  flow.stage = "jam";
  flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  await press(flow, "jam-pad:0");
  await press(flow, "capture-direction");
  // Existing three-part songs remain supported; new onboarding has separate coverage.
  flow._finishPartEdit(); flow.doc.song_cards=songArcFromCapture(flow.doc.song_cards);
  delete flow.doc.song_path; flow._compile(); flow._go("song");
  flow.app.scheduler.isPlaying=true;
  return flow;
}

test("Shape shows the whole song as a sheet, with the person's note outlined and the playhead where the music is", async () => {
  const flow = await songOf(setup());
  flow.sheetOpen = true;
  const score = flow._sheetScore();
  assert.equal(score.measures.length, flow.app.compiledSong.total_steps / 16, "one measure per bar of the arranged song");
  assert.ok(score.parts.includes("tune") && score.parts.includes("drums"));
  flow.app.scheduler.isPlaying = true; flow.playhead = { step: 70 };
  const svg = flow._sheetSvg();
  assert.match(svg, /pf-sheet-note[^"]*own/, "the pad note the person played is outlined");
  assert.match(svg, /pf-sheet-playhead/);
  assert.match(flow._renderSong(), /data-key="sheet-toggle"/);
});

test("the downloaded sheet opens again as the same song, in the app and as standard MusicXML", async () => {
  const flow = await songOf(setup());
  flow.doc.title = "Sheet test";
  const text = toMusicXML(flow._sheetScore());
  assert.match(text, /<work-title>Sheet test<\/work-title>/);
  const back = fromMusicXML(text);
  const doc = flow._openSheet(back);
  assert.equal(doc.title, "Sheet test");
  assert.equal(doc.global_context.bpm, flow.doc.global_context.bpm);
  const allNotes = [doc.notes, ...doc.song_cards.slice(1).map(c => c.material.notes)].flat();
  const played = flow.app.compiledSong.events.filter(e => (e.velocity ?? 1) > 0 && ["lead", "bass", "harmony", "drums"].includes(e.role));
  assert.ok(allNotes.length >= played.length * .9, `${allNotes.length} notes came back of ${played.length} that play`);
  assert.ok(allNotes.some(n => n.provenance === "user_placed"), "the person's note is still theirs");
  assert.equal(doc.song_cards.length, Math.ceil(flow.app.compiledSong.total_steps / 64));
});

test("Share offers the sheet beside the audio, and Open accepts sheet files", async () => {
  const flow = await songOf(setup());
  flow.stage = "keep";
  const html = flow._renderKeep();
  assert.match(html, /data-key="dl-sheet"[^>]*>[\s\S]*?Download sheet/);
  assert.match(html, /accept="[^"]*\.musicxml/);
});

test("on the Play level the sheet is live: it grows from the take and marks the beat", async () => {
  const flow = setup();
  flow.stage = "jam";
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  const s = flow.app.scheduler;
  s.isPlaying = true; s.audioCtx = { currentTime: 3 };
  const note = (id, step, role, midi, extra = {}) => ({ event: { id, step: 0, role, patch_id: role === "drums" ? "kick" : "warm_keys", velocity: .7, duration_steps: 2,
    concrete: role === "drums" ? { midi, freq_hz: 200 } : { midi_pitch: midi, freq_hz: 440 }, provenance: "jam_generated", ...extra }, time: step * .15, duration: .3 });
  s.performanceTake = { start: 0, bpm: 100, steps_per_bar: 16, events: [note("k", 0, "drums", 36), note("me", 4, "lead", 64, { provenance: "user_placed" }), note("future", 40, "lead", 60)] };
  const live = flow._liveSheet();
  assert.equal(live.score.measures.length, 2, "two bars so far");
  const svg = flow._sheetSvg();
  assert.match(svg, /data-id="me"[^>]*/);
  assert.match(svg, /pf-sheet-note pf-part-tune own/);
  assert.doesNotMatch(svg, /data-id="future"/, "a note that has not sounded is not on the page yet");
  assert.match(svg, /pf-sheet-beat/);
  flow.sheetOpen = true;
  assert.match(flow._renderListeningJam(), /The page writes itself/);
});

test("the Bars / Line / Off switch changes what the moving picture draws, and the choice is remembered", async () => {
  const flow = await songOf(setup());
  const set = {}; const path = { setAttribute: (k, v) => { set.wave = v; } }, spectrum = { setAttribute() {} };
  const parts = {}; const partEl = id => ({ setAttribute: (k, v) => { parts[id] = v; } });
  const visual = { querySelector: sel => sel === "[data-wave]" ? path : sel === "[data-spectrum]" ? spectrum : partEl(sel), querySelectorAll: () => [] };
  flow.root = { querySelector: sel => sel === ".pf-listening-visual" ? visual : null, querySelectorAll: () => [] };
  flow.comfort = { lessMotion: false };
  globalThis.window.matchMedia = () => ({ matches: false });
  globalThis.document = { hidden: false, body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  flow.app.scheduler.masterBus.analyser = { frequencyBinCount: 512, fftSize: 1024, getByteFrequencyData: a => a.fill(180), getByteTimeDomainData: a => a.fill(128) };
  flow.visualPaintTime = -1000;
  flow._setVisualMode("bars"); flow._paintListeningVisual(true);
  assert.ok(Object.values(parts).some(d => d && d.length > 0), "bars are drawn in bars mode");
  flow.visualPaintTime = -1000; flow._setVisualMode("scope"); flow._paintListeningVisual(true);
  assert.ok(Object.values(parts).every(d => d === ""), "no bars in line mode"); assert.match(set.wave, /^M 24/);
  flow.visualPaintTime = -1000; flow._setVisualMode("off"); flow._paintListeningVisual(true);
  assert.equal(set.wave, "", "nothing drawn when off");
  assert.equal(globalThis.window.localStorage.getItem("musiclab.visual-mode"), "off");
  flow.legendOpen = true;
  const html = flow._legendHtml();
  assert.match(html, /Tune: the tune\./); assert.match(html, /data-key="visual-mode:off"[^>]*aria-pressed="true"/);
});
