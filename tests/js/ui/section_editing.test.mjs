import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { addSongCard, songArcFromCapture, ensureSectionIds } from "../../../static/js/theory/song_view.js";
import { loadPiece, loadWorkingSong, stashWorkingSong, savePiece } from "../../../static/js/theory/save_store.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function setup() {
  const values = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } };
  const session = new Map();
  globalThis.window.sessionStorage = { getItem: key => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null };
  flow.app = {
    scheduler: { setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {},
      clearMuteLayers() {}, setSpotlightRole() {}, unlock: async () => {}, previewSound() {} },
    _announce() {}, _logSessionEvent() {},
  };
  flow.render = () => {};
  flow._sparkAt = () => {};
  flow.stage = "song";
  flow.trail = [];
  flow.confirm = {};
  flow._freshState();
  flow.doc.song_cards = addSongCard(flow.doc.song_cards);
  return flow;
}

const press = (flow, key) => flow._onClick({ target: {
  closest: () => ({ dataset: { key }, focus() {} }),
} });

test('opening another saved song and returning recovers unfinished notes without replacing its saved version',async()=>{
 const flow=setup();flow._startInstrument('warm_keys');await press(flow,'jam-pad:0');flow._save();
 const id=flow.doc.id,saved=loadPiece(window.localStorage,id);
 await press(flow,'jam-pad:1');const edited=structuredClone(flow._canonicalDoc());
 const other={...structuredClone(saved),id:'different-song',title:'Other'};savePiece(window.localStorage,other);
 flow._continue(other.id);assert.equal(flow.doc.id,other.id);
 assert.deepEqual(loadWorkingSong(window.localStorage,id).notes,edited.notes);
 flow._continue(id);assert.deepEqual(flow.doc.notes,edited.notes);assert.deepEqual(loadPiece(window.localStorage,id),saved);
});

test('storage failure blocks song replacement and exposes a persistent warning',async()=>{
 const flow=setup();flow._startInstrument('warm_keys');await press(flow,'jam-pad:0');
 window.localStorage.setItem=()=>{throw Error('quota');};await press(flow,'jam-pad:1');
 const before=structuredClone(flow.doc);
 flow._startInstrument('pluck_lead');assert.deepEqual(flow.doc,before);assert.equal(flow.draftSaveFailed,true);
 flow._loadDocIntoFlow({...structuredClone(before),id:'other'});assert.deepEqual(flow.doc,before);
});

test('fresh pictured instrument establishes jam style before any contribution, and leaving retires it',()=>{
 const flow=setup(),calls=[];
 flow.app.scheduler.setCompiledSong=(song,options)=>calls.push({song,options});
 flow._startInstrument('warm_keys');
 assert.equal(flow.stage,'jam');
 assert.equal(calls.at(-1).options.quantizeJamBacking,true);
 assert.equal(calls.at(-1).options.jamStyleBlend,flow.doc.jam_session.style_blend);
 assert.ok(calls.at(-1).song.events.length);
 flow._go('tune');assert.equal(calls.at(-1).options.quantizeJamBacking,false);
});

test("live jam direction preserves contributions and capture preserves the exact music", async () => {
  const flow = setup();
  flow.stage = "jam";
  flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  await press(flow, "jam-pad:0");
  const own = structuredClone(flow.doc.notes.filter(note => note.provenance === "user_placed"));
  await press(flow, "jam-density:more");
  await press(flow, "jam-color:more");
  assert.deepEqual(flow.doc.notes.filter(note => note.provenance === "user_placed"), own);
  const notes = structuredClone(flow.doc.notes);
  const events = structuredClone(flow.app.compiledSong.events);
  await press(flow, "capture-direction");
  assert.equal(flow.stage, "tune");
  assert.deepEqual(flow.doc.notes, notes);
  // The capture now becomes a three-part song of itself; every original event still plays in it.
  assert.equal(flow.doc.song_cards.length, 1);
  const ids = new Set(flow.app.compiledSong.events.map(e => e.id));
  assert.ok(events.every(e => ids.has(e.id) || flow.app.compiledSong.events.some(x => x.source_note_id === e.id || x.id.startsWith(e.id))));
  flow._save();
  assert.deepEqual(loadPiece(window.localStorage, flow.doc.id).notes, notes);
});

test("capture enters the tune first without creating sections or losing the visited route", async () => {
  for (const [kind, patchId, expected] of [["pitched", "warm_keys", "tune"], ["drums", "snare", "tune"]]) {
    const flow = setup();
    flow.stage = "jam";
    flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
    flow._acceptJamDoc(startJam(flow.doc, { kind, patchId }));
    await press(flow, "jam-pad:0");
    const before = structuredClone({ notes: flow.doc.notes, cards: flow.doc.song_cards, events: flow.app.compiledSong.events });
    flow.tuneTab = "ending"; flow.tunePage = 2; flow.activeSongCard = 3;
    await press(flow, "capture-direction");
    assert.equal(flow.stage, expected);
    assert.equal(flow.doc.last_stage, expected);
    assert.equal(flow.tuneTab, "main"); assert.equal(flow.tunePage, 0); assert.equal(flow.activeSongCard, 0);
    assert.equal(flow.editingCard, null, "capture must not detach or silently narrow shared edits");
    assert.deepEqual(flow.doc.notes, before.notes);
    assert.equal(flow.doc.song_cards.length, before.cards.length, "Keep does not add an arrangement");
    assert.ok(flow.doc.song_cards.every(c => c.bars === before.cards[0].bars), "the captured length is kept");
    assert.deepEqual(flow.doc.song_cards, before.cards, "Keep preserves the chosen band");
    flow._back(); assert.equal(flow.stage, "jam");
    await press(flow, "capture-direction");
    await press(flow, "card-bars:0:1");
    assert.equal(flow.doc.song_cards[0].bars, 1);
    assert.deepEqual(flow.doc.notes, before.notes);
  }
});

test("new performed capture enters its actual one-bar idea; newer working draft resumes its saved stage", async () => {
  const flow = setup();
  flow.stage = "start";
  flow.doc.song_cards = [{ ...flow.doc.song_cards[0], bars: 1 }];
  flow.doc.selected_instrument = "warm_keys";
  flow.doc.captured_performance = { bars: 1, events: [] };
  flow.doc.notes = [{ id: "mine", role: "lead", patch_id: "warm_keys", step: 3, duration_steps: 1.25,
    velocity: .4, concrete: { midi_pitch: 67 }, pitch_lock_mode: "concrete", provenance: "user_placed",
    performance: { version: 1, offset_steps: .3 } }];
  flow.doc.last_stage = "song"; // converter's old source hint must not skip fresh development
  flow.pendingPerformance = structuredClone(flow.doc);
  const notes = structuredClone(flow.doc.notes);
  flow.tuneTab = "ending"; flow.tunePage = 3;
  await press(flow, "continue-performance");
  assert.equal(flow.stage, "tune"); assert.equal(flow._partBars(), 1); assert.equal(flow.tuneGrid.bars, 1);
  assert.deepEqual(flow.doc.notes, notes);
  assert.deepEqual(flow.trail, ["start"]);
  flow._back(); assert.equal(flow.stage, "start", "no invented jam/beat history on import");
  const newer = structuredClone(flow.doc); newer.last_stage = "under"; newer.title = "Later edits";
  stashWorkingSong(window.localStorage, newer);
  flow.pendingPerformance = { ...structuredClone(newer), title: "Old capture", last_stage: "song" };
  await press(flow, "continue-performance");
  assert.equal(flow.stage, "under"); assert.equal(flow.doc.title, "Later edits");
  flow._save();
  flow._continue(flow.doc.id);
  assert.equal(flow.stage, "song", "a saved song reopens on Shape, ready to play (unfinished edits resume where they were)");
  for (const last_stage of ["song", "keep", "under", "tune", "beat"]) {
    assert.equal(flow._savedDevelopmentStage({ ...newer, capture_development_started: false, last_stage }), last_stage,
      "old prototype documents without an original material snapshot must retain their legitimate saved stage");
  }
});

test("untouched legacy jam captures reopen on the whole song while later work retains its saved route", async () => {
  for (const [kind, patchId, expected] of [["pitched", "warm_keys", "song"], ["drums", "snare", "song"]]) {
    const flow = setup();
    flow.stage = "jam";
    flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
    flow._acceptJamDoc(startJam(flow.doc, { kind, patchId }));
    await press(flow, "jam-pad:0");
    await press(flow, "capture-direction");
    const legacy = structuredClone(flow.doc);
    legacy.song_cards=ensureSectionIds(songArcFromCapture(legacy.song_cards));delete legacy.song_path;
    delete legacy.capture_development_started;
    legacy.last_stage = "song";
    const original = structuredClone({ notes: legacy.notes, cards: legacy.song_cards });
    stashWorkingSong(window.localStorage, legacy);
    flow._resumeWorking();
    assert.equal(flow.stage, expected, "working resume must repair the old hardcoded Song route");
    assert.deepEqual({ notes: flow.doc.notes, cards: flow.doc.song_cards }, original);
    flow.doc = structuredClone(legacy); flow._save(); flow._continue(legacy.id);
    assert.equal(flow.stage, expected, "saved-library reopen uses the same migration");
    for (const mutate of [
      doc => { doc.last_stage = "keep"; },
      doc => { doc.last_stage = "under"; },
      doc => { doc.capture_development_started = true; },
      doc => { doc.notes[0].velocity *= .5; },
      doc => { doc.song_cards = addSongCard(doc.song_cards); },
      doc => { doc.song_cards[0].beat = false; },
      doc => { doc.global_context.bpm += 10; },
      doc => { doc.play_session.acts.push({ kind: "paint" }); },
    ]) {
      const edited = structuredClone(legacy); mutate(edited);
      stashWorkingSong(window.localStorage, edited);
      flow._resumeWorking();
      assert.equal(flow.stage, edited.last_stage, "later musical changes or completed routes must not be reset");
    }
  }
});

test("first jam restore and undo retain the later complete arrangement", async () => {
  const flow = setup();
  flow.stage = "jam";
  flow._acceptJamDoc(startJam(flow.doc, { kind: "drums", patchId: "snare" }));
  await press(flow, "jam-pad:0");
  await press(flow, "capture-direction");
  const first = structuredClone(flow.doc.notes);
  await press(flow, "add-card");
  await press(flow, "edit-card:1");
  flow._tapNote(4, 67);
  await press(flow, "to-song");
  const developed = structuredClone(flow.doc.song_cards);
  await press(flow, "restore-jam");
  assert.deepEqual(flow.doc.notes, first);
  assert.equal(flow.doc.song_cards.length, 2);
  await press(flow, "undo");
  assert.deepEqual(flow.doc.song_cards, developed);
});

test("changing catalogue sound in one part preserves note positions and other parts", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  const source = structuredClone(flow.doc.notes);
  await press(flow, "edit-card:1");
  await press(flow, "change-instrument:talking_yoi");
  assert.deepEqual(flow.app.songDoc.notes, source);
  const own = flow.app.songDoc.song_cards[1].material.notes;
  assert.deepEqual(own.map(note => [note.id, note.step, note.concrete]), source.map(note => [note.id, note.step, note.concrete]));
  assert.ok(own.filter(note => note.role === "lead").every(note => note.patch_id === "talking_yoi"));
});

test("keeping a direction preserves exact musical material and restores it with undo", () => {
  const flow = setup();
  flow._tapNote(0, 60);
  flow.doc.global_context.bpm = 113;
  const before = structuredClone(flow.doc);
  flow._captureDirection();
  assert.equal(flow.stage, "song");
  assert.deepEqual(flow.doc.notes, before.notes);
  assert.deepEqual(flow.doc.global_context, before.global_context);
  assert.deepEqual(flow.doc.song_cards, before.song_cards);
  assert.deepEqual(flow.doc.jam_start.material.notes, before.notes);
  assert.deepEqual(loadWorkingSong(window.localStorage).jam_start, flow.doc.jam_start);
  flow._tapNote(4, 67);
  assert.deepEqual(flow.doc.jam_start.material.notes, before.notes);
  flow._undo();
  flow._undo();
  assert.deepEqual(flow.doc, before);
});

test("capture commits heard mute choices to arrangement without deleting notes", () => {
  const flow = setup();
  flow.app.scheduler.mutedLayers = new Set(["beat"]);
  flow.app.scheduler.spotlightRole = "tune";
  const notes = structuredClone(flow.doc.notes);
  const messages = [];
  flow.app._announce = (message) => messages.push(message);
  flow._captureDirection();
  assert.ok(flow.doc.song_cards.every((card) => card.beat === false && card.tune === true));
  assert.deepEqual(flow.doc.notes, notes);
  assert.ok(messages.at(-1).includes("Focus is off"));
  assert.ok(flow.app.compiledSong.events.every((event) => event.role !== "drums"));
});

test("starter material can be explicitly saved without relabelling its notes", () => {
  const flow = setup();
  const notes = structuredClone(flow.doc.notes);
  flow._save();
  assert.deepEqual(loadPiece(window.localStorage, flow.doc.id).notes, notes);
  assert.equal(flow.doc.play_session.acts_count, 0);
});

test("capture inside a part retains shared music and the part's edits", () => {
  const flow = setup();
  flow._tapNote(0, 60);
  const shared = structuredClone(flow.doc.notes);
  flow._editPart(1);
  flow._tapNote(4, 67);
  const edited = structuredClone(flow.doc.notes);
  flow._captureDirection();
  assert.equal(flow.editingCard, null);
  assert.deepEqual(flow.doc.notes, shared);
  assert.deepEqual(flow.doc.song_cards[1].material.notes, edited);
  flow._undo();
  assert.equal(flow.editingCard, 1);
  assert.deepEqual(flow.doc.notes, edited);
});

test("part editing preserves the shared tune, saves midway, and restores scoped undo", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  const source = structuredClone(flow.doc.notes);
  await press(flow, "edit-card:1");
  flow._tapNote(4, 67);
  const edited = structuredClone(flow.doc.notes);
  assert.notDeepEqual(edited, source);
  assert.deepEqual(flow.app.songDoc.notes, source);
  assert.deepEqual(flow.app.songDoc.song_cards[1].material.notes, edited);
  assert.equal(flow.app.songDoc.song_cards[0].material, undefined);
  assert.deepEqual(loadWorkingSong(window.localStorage).notes, source);
  flow._save();
  const saved = loadPiece(window.localStorage, flow.doc.id);
  assert.deepEqual(saved.notes, source);
  assert.deepEqual(saved.song_cards[1].material.notes, edited);
  flow._undo();
  assert.equal(flow.editingCard, 1);
  assert.deepEqual(flow.doc.notes, source);
  flow._tapNote(4, 67);
  await press(flow, "to-song");
  assert.equal(flow.editingCard, null);
  assert.deepEqual(flow.doc.notes, source);
  flow._loadDocIntoFlow(saved);
  await press(flow, "edit-card:1");
  assert.deepEqual(flow.doc.notes, edited);
  await press(flow, "sound:warm_keys");
  assert.equal(flow.app.songDoc.lead_patch_id, "pluck_lead");
  assert.equal(flow.app.songDoc.song_cards[1].material.lead_patch_id, "warm_keys");
});

test("ending originals survive leaving and reopening a part", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  flow._tapNote(12, 64);
  await press(flow, "edit-card:1");
  const original = structuredClone(flow.tuneGrid.ending);
  flow._shape("climb");
  const shaped = structuredClone(flow.tuneGrid);
  await press(flow, "to-song");
  await press(flow, "edit-card:1");
  assert.deepEqual(flow.tuneGrid, shaped);
  await press(flow, "version:original");
  assert.deepEqual(flow.tuneGrid.ending, original);
});

test("backing edits stay within the selected part and source edits leave its copy alone", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  const source = structuredClone(flow.doc.notes);
  await press(flow, "edit-card:1");
  await press(flow, "edit-scope:under");
  await press(flow, "feel:warm");
  const part = structuredClone(flow.app.songDoc.song_cards[1].material);
  assert.deepEqual(flow.app.songDoc.notes, source);
  assert.deepEqual(part.notes.filter((note) => note.role === "lead"), source.filter((note) => note.role === "lead"));
  assert.ok(part.notes.some((note) => note.role === "bass"));
  await press(flow, "to-song");
  await press(flow, "edit-shared");
  flow._tapNote(4, 67);
  assert.deepEqual(flow.app.songDoc.song_cards[1].material, part);
  assert.notDeepEqual(flow.app.songDoc.notes, source);
});

test("card compilation does not expand a legacy arrangement twice", () => {
  const flow = setup();
  flow.doc.arrangement_mode = "song";
  flow._compile();
  assert.equal(flow.app.compiledSong.total_steps, 128);
  assert.equal(flow.doc.arrangement_mode, "song");
});

test("entering a part stops ongoing playback without restarting it", () => {
  const flow = setup();
  flow.app.scheduler.isPlaying = true;
  let stopped = 0;
  flow.app.scheduler.stop = () => { stopped++; flow.app.scheduler.isPlaying = false; };
  flow._editPart(1);
  assert.equal(stopped, 1);
  assert.equal(flow.app.scheduler.isPlaying, false);
});

test("shortening a part preserves its notes and updates subsequent audition ranges", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  flow._editPart(0);
  flow._tapNote(4, 67);
  await press(flow, "to-song");
  const material = structuredClone(flow.doc.song_cards[0].material);
  await press(flow, "card-bars:0:1");
  assert.equal(flow.app.compiledSong.total_steps, 80);
  assert.deepEqual(flow.doc.song_cards[0].material, material);
  const ranges = [];
  const seeks = [];
  flow.app.scheduler.setLoopRange = (...args) => ranges.push(args);
  flow.app.scheduler.isPlaying = true;
  flow.app.scheduler.seekToStep = (step) => seeks.push(step);
  await press(flow, "play-card:1");
  assert.deepEqual(ranges.at(-1), [16, 80]);
  assert.equal(seeks.at(-1), 16);
  flow.app.scheduler.isPlaying = false;
  flow._undo();
  assert.equal(flow.doc.song_cards[0].bars, 4);
  assert.equal(flow.app.compiledSong.total_steps, 128);
  assert.deepEqual(flow.doc.song_cards[0].material, material);
});

test("edited part Play uses cumulative lengths and length changes are recoverable after save", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  await press(flow, "card-bars:0:2");
  await press(flow, "card-bars:1:1");
  flow._save();
  const loaded = loadPiece(window.localStorage, flow.doc.id);
  flow._loadDocIntoFlow(loaded);
  await press(flow, "edit-card:1");
  let range;
  flow.app.scheduler.setLoopRange = (...args) => { range = args; };
  globalThis.document = { getElementById: () => null };
  await press(flow, "play");
  assert.deepEqual(range, [32, 48]);
  await press(flow, "to-song");
  await press(flow, "card-bars:1:4");
  assert.equal(flow.app.compiledSong.total_steps, 96);
});

test("a short part edits its chosen last bar and preserves every other bar", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  await press(flow, "card-bars:0:2");
  await press(flow, "edit-card:0");
  flow.tuneTab = "ending";
  const shortHtml = flow._renderTune();
  assert.match(shortHtml, /Explore ending/);
  assert.match(shortHtml, /Bar 2 is the end/);
  const original = structuredClone(flow.doc.notes);
  flow._tapNote(4, 67);
  assert.ok(flow.doc.notes.some(note => note.role === "lead" && note.step === 20 && note.concrete.midi_pitch === 67));
  assert.deepEqual(flow.doc.notes.filter(note => note.role !== "lead" || note.step < 16 || note.step >= 32), original.filter(note => note.role !== "lead" || note.step < 16 || note.step >= 32));
  const shortNotes = structuredClone(flow.doc.notes);
  flow._save();
  const saved = loadPiece(window.localStorage, flow.doc.id);
  flow._loadDocIntoFlow(saved);
  await press(flow, "to-song");
  await press(flow, "card-bars:0:4");
  await press(flow, "edit-card:0");
  assert.equal(flow.tuneGrid.eventEditor, true, "expanded part has distinct bar variations");
  assert.match(flow._renderTune(), /data-event-transport/);
  assert.deepEqual(flow.doc.notes, shortNotes);
  await press(flow, "sound:warm_keys");
  assert.deepEqual(flow.doc.notes.map(({ patch_id, ...note }) => note), shortNotes.map(({ patch_id, ...note }) => note));
});

test("one-bar ending is the audible bar and undo preserves its original", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  await press(flow, "card-bars:0:1");
  await press(flow, "edit-card:0");
  assert.equal(flow.tuneTab, "ending");
  assert.doesNotMatch(flow._renderTune(), /data-key="tab:main"/);
  const original = structuredClone(flow.doc.notes);
  flow._tapNote(4, 67);
  assert.ok(flow.app.compiledSong.events.some(event => event.card === 0 && event.role === "lead" && event.step === 4));
  assert.deepEqual(flow.doc.notes.filter(note => note.step >= 16), original.filter(note => note.step >= 16));
  flow._undo();
  assert.deepEqual(flow.doc.notes, original);
});

test("short-ending alternatives survive resizing and reopening", async () => {
  const flow = setup();
  flow._tapNote(0, 60);
  flow._tapNote(12, 64);
  await press(flow, "card-bars:0:2");
  await press(flow, "edit-card:0");
  await press(flow, "tab:ending");
  const original = structuredClone(flow.tuneGrid.ending);
  flow._shape("climb");
  const shapedNotes = structuredClone(flow.doc.notes);
  const changedSteps = shapedNotes.filter(note => note.role === "lead" && note.step >= 16 && note.step < 32);
  assert.ok(changedSteps.some(note => note.shaped_by?.includes("climb")));
  await press(flow, "to-song");
  await press(flow, "card-bars:0:4");
  await press(flow, "edit-card:0");
  assert.deepEqual(flow.doc.notes, shapedNotes);
  await press(flow, "to-song");
  await press(flow, "card-bars:0:2");
  flow._save();
  flow._loadDocIntoFlow(loadPiece(window.localStorage, flow.doc.id));
  await press(flow, "edit-card:0");
  await press(flow, "tab:ending");
  await press(flow, "version:original");
  assert.deepEqual(flow.tuneGrid.ending, original);
});

test("journey bar names one route and Make my song lands on the tune with music kept going", async () => {
  const flow = setup();
  flow.stage = "jam";
  flow.doc.song_cards = flow.doc.song_cards.slice(0, 1);
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  assert.equal(flow._journeyLevel(), "find");
  const jamBar = flow._journeyHtml();
  assert.match(jamBar, /data-key="journey:find"[^>]*aria-current="step"/);
  assert.match(jamBar, /data-key="journey:detail"[^>]*disabled/, "details wait until the music is your song");
  assert.doesNotMatch(jamBar, /data-key="journey:shape"[^>]*disabled/, "shaping is always one tap away");
  await press(flow, "jam-pad:0");
  assert.equal(flow._journeyLevel(), "play");
  let resumed = 0;
  flow.app.scheduler.isPlaying = true;
  flow._stopForScopeChange = function () { this.app.scheduler.isPlaying = false; };
  globalThis.document = { getElementById: id => id === "btn-play" ? { click: () => resumed++ } : null };
  try {
    await press(flow, "journey:shape");
  } finally { delete globalThis.document; }
  assert.equal(flow.stage, "tune");
  assert.equal(flow._journeyLevel(), "detail");
  assert.equal(resumed, 1, "the music keeps playing when the jam becomes the song");
  assert.equal(loadWorkingSong(window.localStorage, flow.doc.id)?.id, flow.doc.id, "the new song is saved without asking");
  await press(flow, "journey:detail");
  assert.equal(flow.stage, "tune");
  await press(flow, "journey:share");
  assert.equal(flow.stage, "keep");
  await press(flow, "journey:shape");
  assert.equal(flow.stage, "song");
});

test("Make my tune is a primary control on the circle, not hidden in More", () => {
  const flow = setup();
  flow.stage = "jam";
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  flow.doc.jam_session.exploration_map = "catalogue-circle-v1";
  flow._musicCircleHtml = () => "";
  flow._liveJamPads = () => [];
  flow._jamParticipationHtml = () => "";
  const html = flow._renderListeningJam();
  const more = html.slice(html.indexOf('class="pf-demo-tools"'));
  assert.match(html.slice(0, html.indexOf('class="pf-demo-tools"')), /data-key="melody-field-enter"[^>]*>Make my tune/);
  assert.doesNotMatch(more, /melody-field-enter/);
});
