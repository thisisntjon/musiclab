import {songArcFromCapture} from '../../../static/js/theory/song_view.js';
// Phase 13.5: keep and share without loss. The song is still there tomorrow, and what plays is what exports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";
import { listSaves, savePiece, SLOT_COUNT } from "../../../static/js/theory/save_store.js";
import { songCardRanges } from "../../../static/js/theory/song_view.js";

function storage() {
  const values = new Map(), session = new Map();
  return { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) }, scrollTo() {} };
}
function setup(win = storage()) {
  globalThis.window = win;
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

function selectedFixture() {
 const f=setup();f.stage='keep';f.trail=['start','jam'];
 const archive=structuredClone(f.doc);
 archive.notes=[{id:'jam-live-held',role:'lead',step:3,duration_steps:20,velocity:.6,
   patch_id:'warm_keys',pitch_lock_mode:'concrete',concrete:{midi_pitch:64},provenance:'user_placed'}];
 f.doc.notes=[{...structuredClone(archive.notes[0]),id:'chosen',duration_steps:3,step:0}];
 f.doc.capture_notes={melody_field:{version:4}};f.doc.capture_source=archive;
 f._compile();return {f,archive};
}

test('Save exposes played archive; actual open and Undo preserve held notes without autoplay',async()=>{
 const {f,archive}=selectedFixture();const selected=structuredClone(f.doc);
 let starts=0;f.app.scheduler.start=()=>{starts++;};
 const html=f._renderKeep();assert.match(html,/Your played take/);assert.match(html,/data-key="restore-capture-source"/);
 assert.match(html,/<summary[^>]*data-key="[^"]+"[^>]*>Your played take<\/summary>/,'switch route can reach archive disclosure');
 await press(f,'restore-capture-source');
 assert.equal(f.stage,'keep');assert.deepEqual(f.doc.notes,archive.notes);
 assert.equal(f.doc.notes[0].duration_steps,20);assert.equal(starts,0);assert.equal(f.app.scheduler.isPlaying,false);
 assert.match(f._renderKeep(),/data-key="undo"/);
 assert.match(f._renderKeep(),/<details[^>]*class="pf-played-take"[^>]*\bopen\b/,'Undo stays visible after archive opens');
 await press(f,'undo');assert.deepEqual(f.doc,selected);assert.equal(starts,0);
});

test('failed storage copy does not claim autosave succeeded or hide editable download',()=>{
 const {f}=selectedFixture();window.localStorage.setItem=()=>{throw Error('quota');};
 assert.equal(f._stashDraft(f._canonicalDoc()),false);assert.equal(f.draftSaveFailed,true);
 const html=f._renderKeep();assert.match(html,/Save your music/);assert.match(html,/Save here/);
 assert.doesNotMatch(html,/saved here as you go/i);assert.match(html,/data-key="dl-project"/);
});

test('legacy source restoration keeps legacy Song destination',async()=>{
 const {f,archive}=selectedFixture();delete f.doc.capture_notes;
 await press(f,'restore-capture-source');assert.equal(f.stage,'song');assert.deepEqual(f.doc.notes,archive.notes);
 assert.equal(f.melodyArchiveOpen,false);
});

