// Gate 1 (jam-deep SYNTHESIS): live presses sound on press, hold until release, stay out of the

// band's duck, and a stalled transport skips missed steps instead of starting them in a burst.

import { test } from "node:test";
import { writeFileSync } from "node:fs";

import assert from "node:assert/strict";

import { LookaheadScheduler, overdueSteps, LATE_STEP_TOLERANCE_SEC, LIVE_MIN_SEC, LIVE_RELEASE_SEC,

  LIVE_MAX_HOLD_SEC, LIVE_VOICE_LIMIT, LIVE_START_DELAY_SEC } from "../../../static/js/audio/scheduler.js";
import { liveVelocity } from "../../../static/js/theory/scene_voice_levels.js";

import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import {planMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';

import { startJam, setJamDirection } from "../../../static/js/theory/jam_session.js";

import { addSongCard } from "../../../static/js/theory/song_view.js";



// Records every AudioParam call and connection without a real AudioContext.

function fakeParam() {

  return { value: 1, calls: [], setValueAtTime(...a) { this.calls.push(["set", ...a]); },

    linearRampToValueAtTime(...a) { this.calls.push(["ramp", ...a]); },

    exponentialRampToValueAtTime(...a) { this.calls.push(["exp", ...a]); },

    setTargetAtTime(...a) { this.calls.push(["target", ...a]); },

    cancelScheduledValues(...a) { this.calls.push(["cancel", ...a]); } };

}

function fakeNode(name) {

  const node = { name, connections: [], disconnected: false, connect(dest) { this.connections.push(dest); return dest; },

    disconnect() { this.disconnected = true; }, start() {}, stop() {} };

  return new Proxy(node, { get(target, key) {

    if (!(key in target) && typeof key === "string") target[key] = fakeParam();

    return target[key];

  } });

}

function fakeContext() {

  const created = [];

  const ctx = { currentTime: 0, sampleRate: 1000, state: "running", destination: fakeNode("speaker"),

    createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }) };

  for (const kind of ["Gain", "Oscillator", "BiquadFilter", "WaveShaper", "Convolver", "DynamicsCompressor",

    "Analyser", "BufferSource", "StereoPanner", "DynamicsCompressor"]) {

    ctx[`create${kind}`] = () => { const n = fakeNode(kind); created.push(n); return n; };

  }

  return { ctx, created };

}

function withTimers(fn) {

  const original = [globalThis.setTimeout, globalThis.clearTimeout];

  const pending = new Map();

  let seq = 0;

  globalThis.setTimeout = (cb, ms) => { pending.set(++seq, { cb, ms }); return seq; };

  globalThis.clearTimeout = id => pending.delete(id);

  try { return fn(pending); } finally { [globalThis.setTimeout, globalThis.clearTimeout] = original; }

}

function liveScheduler() {

  const scheduler = new LookaheadScheduler();

  const { ctx } = fakeContext();

  scheduler.audioCtx = ctx;

  scheduler.ensureContext();

  return scheduler;

}



test("overdueSteps skips only steps already later than the tolerance", () => {

  assert.equal(overdueSteps(1, 1, 0.15), 0);

  assert.equal(overdueSteps(1 - LATE_STEP_TOLERANCE_SEC, 1, 0.15), 0, "within tolerance is still played");

  assert.equal(overdueSteps(0.4, 1, 0.15), 4); // 0.4 + 4 * 0.15 = 1.0 >= 0.98

  assert.equal(overdueSteps(0.4, 1, 0), 0);

});



test("a stalled transport resumes without any step scheduled in the past", () => {

  const scheduler = new LookaheadScheduler();

  scheduler.compiledSong = { total_steps: 16, bpm: 100, swing: 0.5, events: [] };

  scheduler.audioCtx = { currentTime: 0 };

  scheduler.isPlaying = true;

  scheduler.nextStepAudioTime = 0.04;

  scheduler._lookaheadTick();

  const before = scheduler.visualQueue.length;

  scheduler.audioCtx.currentTime = 0.7; // a 600 ms main-thread stall

  scheduler._lookaheadTick();

  const resumed = scheduler.visualQueue.slice(before);

  assert.ok(resumed.length > 0, "playback continues after the stall");

  for (const step of resumed) assert.ok(step.time >= 0.7 - LATE_STEP_TOLERANCE_SEC, `step ${step.step} late at ${step.time}`);

  assert.ok(scheduler.droppedSteps >= 3, "skipped steps are counted, not hidden");

  const lastBefore = scheduler.visualQueue[before - 1].step;

  assert.equal(resumed[0].step, (lastBefore + 1 + scheduler.droppedSteps) % 16, "the transport stays on the beat grid");

});



test("a stall across the end of a non-repeating song still finishes it", () => {

  const scheduler = new LookaheadScheduler();

  scheduler.compiledSong = { total_steps: 2, bpm: 120, swing: 0.5, events: [] };

  scheduler.audioCtx = { currentTime: 5 };

  scheduler.isPlaying = true;

  scheduler.nextStepAudioTime = 0;

  scheduler.setRepeatPlayback(false);

  scheduler._lookaheadTick();

  assert.deepEqual(scheduler.visualQueue, []);

  assert.notEqual(scheduler.playbackEndTime, null);

});



test("a held pitched press sustains until release and never ends before a tap would", () => withTimers(() => {

  const scheduler = liveScheduler();

  const ctx = scheduler.audioCtx;

  const id = scheduler.noteOn({ patchId: "warm_keys", role: "lead", midi: 60 });

  const note = scheduler.liveNotes.get(id);

  assert.ok(note.hold.connections.includes(scheduler.masterBus.liveBus), "live press bypasses the band duck");

  assert.ok(!note.hold.connections.includes(scheduler.masterBus.synthBus));

  ctx.currentTime = 0.05; // a quick tap

  scheduler.noteOff(id);

  const start = note.startTime;

  assert.deepEqual(note.hold.gain.calls.slice(-2), [["set", 1, start + LIVE_MIN_SEC], ["ramp", 0, start + LIVE_MIN_SEC + LIVE_RELEASE_SEC]]);

  assert.equal(scheduler.liveNotes.size, 0);



  const held = scheduler.noteOn({ patchId: "warm_keys", role: "lead", midi: 64 });

  const heldNote = scheduler.liveNotes.get(held);

  ctx.currentTime = 1.2;

  scheduler.noteOff(held);

  assert.deepEqual(heldNote.hold.gain.calls.slice(-2), [["set", 1, 1.2], ["ramp", 0, 1.2 + LIVE_RELEASE_SEC]]);

  scheduler.noteOff(held); // a second release is harmless

}));



test("held presses are bounded: voice limit, maximum hold, all-notes-off and Stop", () => withTimers(pending => {

  const scheduler = liveScheduler();

  const ids = [];

  for (let i = 0; i < LIVE_VOICE_LIMIT; i++) ids.push(scheduler.noteOn({ patchId: "pluck_lead", role: "lead", midi: 60 + i }));

  assert.equal(scheduler.liveNotes.size, LIVE_VOICE_LIMIT);

  for(const patchId of ['pluck_lead','sampled_piano_v1'])assert.throws(()=>scheduler.noteOn({patchId,role:'lead',midi:80}),/All held notes/);
  assert.deepEqual([...scheduler.liveNotes.keys()],ids,'an incoming instrument must not release personal holds');

  const auto = [...pending.values()].find(t => t.ms === LIVE_MAX_HOLD_SEC * 1000);

  assert.ok(auto, "every held note has a release at the maximum hold");

  scheduler.allNotesOff();

  assert.equal(scheduler.liveNotes.size, 0);

  scheduler.noteOn({ patchId: "pluck_lead", role: "lead", midi: 60 });

  scheduler.stop();

  assert.equal(scheduler.liveNotes.size, 0);

  assert.ok(![...pending.values()].some(t => t.ms === LIVE_MAX_HOLD_SEC * 1000), "no hold timer outlives Stop");

}));



test("drum presses are strikes and muted comfort mode makes no sound", () => withTimers(() => {

  const scheduler = liveScheduler();

  assert.notEqual(scheduler.noteOn({ patchId: "snare", role: "drums", kit: "soft" }), null);

  assert.equal(scheduler.liveNotes.size, 0);

  scheduler.previewsMuted = true;

  assert.equal(scheduler.noteOn({ patchId: "warm_keys", role: "lead", midi: 60 }), null);

}));



test("reverse swell remains a short audible gesture instead of a four-second attack", () => withTimers(() => {

  const scheduler = new LookaheadScheduler();

  const { ctx, created } = fakeContext();

  scheduler.audioCtx = ctx;

  scheduler.ensureContext();

  const id = scheduler.noteOn({ patchId: "reverse_swell", role: "lead", midi: 60 });

  assert.equal(scheduler.liveNotes.size, 0, "the swell rings out rather than waiting for keyup");

  const envelope = created.find(node => node.name === "Gain" &&

    node.gain.calls.some(call => call[0] === "exp" && call[1] === 0.45 * liveVelocity("reverse_swell", "lead", false)));

  assert.ok(envelope, "reverse voice has a swell envelope");

  const peak = envelope.gain.calls.find(call => call[0] === "exp" && call[1] === 0.45 * liveVelocity("reverse_swell", "lead", false));

  assert.ok(Math.abs(peak[2] - (LIVE_START_DELAY_SEC + LIVE_MIN_SEC - 0.015)) < 1e-9,

    "swell peaks during a tap, before release");

  scheduler.noteOff(id);

  assert.equal(scheduler.liveNotes.size, 0);

}));



function jamFlow() {

  globalThis.window = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} },

    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } };

  const calls = [];

  const flow = Object.create(PlayFlow.prototype);

  flow.root = { querySelector: () => null };

  let seq = 0;

  flow.app = {

    scheduler: { setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},

      unlock: async () => {}, previewSound: s => calls.push(["preview", s.durationSec]),

      noteOn: () => { calls.push(["on", ++seq]); return seq; }, noteOff: id => calls.push(["off", id]) },

    _announce() {}, _logSessionEvent() {},

  };

  flow.render = () => {};

  flow._sparkAt = () => {};

  flow.trail = [];

  flow.confirm = {};

  flow.liveHolds = new Map();

  flow.jamPointer = null;

  flow._freshState();

  flow.doc.song_cards = addSongCard(flow.doc.song_cards).slice(0, 1);

  flow.stage = "jam";

  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));

  return { flow, calls };

}

const padTarget = key => { const el = { dataset: { key }, focus() {}, closest: () => el }; return el; };



test("pointer press sounds on pointerdown, releases on pointerup, and the following click adds nothing", async () => {

  const { flow, calls } = jamFlow();

  const own = () => flow.doc.notes.filter(note => note.provenance === "user_placed").length;

  const target = padTarget("jam-pad:0");

  const before = own();

  flow._onPointerDown({ button: 0, pointerId: 7, target, preventDefault() {} });

  assert.deepEqual(calls, [["on", 1]], "the note starts while the pointer is still down");

  const afterPress = own();

  assert.ok(afterPress > before, "the press is kept as the player's note");

  flow._releaseJamPointer({ pointerId: 7 });

  await flow._onClick({ target });

  assert.deepEqual(calls, [["on", 1], ["off", 1]]);

  assert.equal(own(), afterPress, "the click after a pointer press adds no second contribution");

});



test("a held key releases on keyup; keyboard and switch activation remain one short note", async () => {

  const { flow, calls } = jamFlow();

  flow.root.style = {};

  flow.root.contains = () => true;

  globalThis.document = { activeElement: null, getElementById: () => null };

  const key = (k, repeat = false) => flow._onKey({ key: k, repeat, preventDefault() {}, stopImmediatePropagation() {} });

  key("a");

  key("a", true); // auto-repeat does not retrigger

  assert.deepEqual(calls, [["on", 1]]);

  flow._releaseLive("key:a");

  assert.deepEqual(calls.at(-1), ["off", 1]);

  key("s");

  flow._releaseAllLive(); // window blur / hidden page

  assert.deepEqual(calls.at(-1), ["off", 2]);

  await flow._onClick({ target: padTarget("jam-pad:1") }); // Enter, switch scan or screen reader

  assert.deepEqual(calls.at(-1), ["preview", 0.25]);

  delete globalThis.document;

});



test("assistive click during a held pointer sounds without consuming that pointer's click suppression", async () => {

  const { flow, calls } = jamFlow();

  const target = padTarget("jam-pad:0");

  flow._onPointerDown({ button: 0, pointerId: 7, target, preventDefault() {} });

  await flow._onClick({ target, detail: 0 });

  assert.deepEqual(calls, [["on", 1], ["preview", 0.25]]);

  assert.ok(flow.liveHolds.has("pointer:7"), "keyboard activation does not release the pointer");

  flow._releaseJamPointer({ pointerId: 7 });

  await flow._onClick({ target, pointerId: 7, detail: 1 });

  assert.deepEqual(calls, [["on", 1], ["preview", 0.25], ["off", 1]]);

});



test("two simultaneous pointers each release once and suppress only their own follow-up click", async () => {

  const { flow, calls } = jamFlow();

  const targets = [padTarget("jam-pad:0"), padTarget("jam-pad:1")];

  for (let i = 0; i < 2; i++) {

    flow._onPointerDown({ button: 0, pointerId: 7 + i, target: targets[i], preventDefault() {} });

  }

  assert.equal(flow.liveHolds.size, 2);

  for (let i = 0; i < 2; i++) {

    flow._releaseJamPointer({ pointerId: 7 + i });

    await flow._onClick({ target: targets[i], pointerId: 7 + i, detail: 1 });

  }

  assert.deepEqual(calls, [["on", 1], ["on", 2], ["off", 1], ["off", 2]]);

  assert.equal(flow.liveHolds.size, 0);

  assert.equal(flow.jamPointers.size, 0);

  await flow._onClick({ target: targets[0], detail: 0 });

  assert.deepEqual(calls.at(-1), ["preview", 0.25]);

});



test("release reports audio-clock gates once, including cap, stealing and immediate Stop", () => withTimers(pending => {

  const s = liveScheduler(), reports = [];

  const on = () => s.noteOn({ patchId: "warm_keys", role: "lead", midi: 60, onRelease: d => reports.push(d) });

  let id = on(); s.audioCtx.currentTime = .05; s.noteOff(id); s.noteOff(id);

  assert.deepEqual(reports, [.25]);

  id = on(); s.audioCtx.currentTime = .86; s.noteOff(id);

  assert.ok(Math.abs(reports[1] - (.86 - .05 - LIVE_START_DELAY_SEC)) < 1e-9);

  id = on(); s.audioCtx.currentTime = 10; s.noteOff(id); assert.equal(reports[2], 4);

  id = on(); s.audioCtx.currentTime = 10.11; s.stop();

  assert.ok(Math.abs(reports[3] - (.11 - LIVE_START_DELAY_SEC)) < 1e-9); assert.equal(reports.length, 4);

}));



test("performed holds survive later presses, capture and undo without resurrecting removed notes", () => withTimers(() => {

  const { flow } = jamFlow(); const s = liveScheduler(); flow.app.scheduler = s;

  s.setLoopRange = () => {}; s.setRepeatPlayback = () => {};

  flow._playJamPad(0, "key:a");

  s.audioCtx.currentTime = .05; flow._releaseLive("key:a");

  flow._playJamPad(1, "key:s");

  s.audioCtx.currentTime = .3; flow._playJamPad(2, "key:d");

  s.audioCtx.currentTime = .86; flow._releaseLive("key:s");

  const held = flow.doc.notes.filter(n => n.performance?.hold_id && n.step % 16 === 4);

  assert.equal(held.length, 4);

  for (const n of held) assert.ok(Math.abs(n.duration_steps - (.81 - LIVE_START_DELAY_SEC) * flow.doc.global_context.bpm / 15) < 1e-9);

  flow._undo(); // discard D, keep completed S recording

  for (const n of held) assert.deepEqual(flow.doc.notes.find(x => x.id === n.id), n);

  flow._releaseLive("key:d");

  assert.ok(!flow.doc.notes.some(n => n.provenance === "user_placed" && n.step % 16 === 8));

  flow._captureDirection();

  for (const n of held) assert.deepEqual(flow.doc.notes.find(x => x.id === n.id), n);

  assert.equal(flow.stage, "tune");

}));


test("captured hold duration remains editable rather than overriding intentional note edits", async () => {
  const { stashWorkingSong, loadWorkingSong } = await import("../../../static/js/theory/save_store.js");
  withTimers(() => {
    const { flow } = jamFlow(), s = liveScheduler(); flow.app.scheduler = s;
    s.setLoopRange = () => {}; s.setRepeatPlayback = () => {};
    flow._playJamPad(0, "key:a"); s.audioCtx.currentTime = .81; flow._releaseLive("key:a");
    flow._captureDirection();
    const original = structuredClone(flow.doc.notes.find(n => n.provenance === "user_placed"));
    assert.equal(flow.tuneGrid.eventEditor, true);
    flow.eventTuneId = original.id;
    flow._editEvent("up"); flow._editEvent("up"); flow._editEvent("shorter");
    const edited = flow.doc.notes.find(n => n.id === original.id);
    assert.equal(edited.duration_steps, original.duration_steps - .25);
    assert.equal(edited.concrete.midi_pitch, original.concrete.midi_pitch + 2);
    assert.equal(edited.provenance, original.provenance);
    const data = new Map(), storage = {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
    stashWorkingSong(storage, flow._canonicalDoc());
    const reopened = loadWorkingSong(storage);
    assert.deepEqual(reopened.notes, flow.doc.notes);
    assert.equal(reopened.notes.find(n=>n.id===original.id).duration_steps, original.duration_steps - .25);
  });
});


// Reproducible boundary fixture: A/B/C have distinct pitches and identities at
// every step. The trace is scheduler submission, never a claim of acoustic output.
const boundarySong = label => ({bpm:100,swing:.5,total_steps:32,total_duration_sec:4.8,
  events:Array.from({length:32},(_,step)=>({id:`${label}-${step}`,step,role:'bass',patch_id:'clean_bass',
    duration_sec:.1,velocity:.4,provenance:'jam_generated',concrete:{freq_hz:{A:110,B:146.83,C:164.81}[label]}}))});
const bridgeSong = label => ({bpm:100,swing:.5,total_steps:64,total_duration_sec:9.6,
  events:Array.from({length:64},(_,step)=>['drums','bass','harmony'].map(role=>({
    id:`${label}-${role}-${step}`,step,role,patch_id:role==='drums'?'kick':role==='bass'?'clean_bass':'warm_keys',
    duration_sec:.1,velocity:.3,provenance:'jam_generated',concrete:{midi_pitch:60,freq_hz:261.625565}}))).flat()});

const leadPlan = (version, phraseOrdinal=1) => ({planVersion:version,phraseOrdinal,
  events:[{id:`evolved-${version}`,step:0,role:'lead',patch_id:'warm_keys',duration_sec:.3,
    velocity:.4,provenance:'jam_generated',concrete:{midi_pitch:67,freq_hz:391.995}}]});

test('lead plans commit once at a full phrase on the exact grid clock; repeats do not undo them',()=>{
 const s=bridgeScheduler(); s.performanceTake={start:0,bpm:100,sequence:0,events:[]};
 for(let i=0;i<63;i++)oneBoundaryStep(s);
 assert.equal(s.queueJamLead(leadPlan(1)),true);
 oneBoundaryStep(s);assert.equal(s.activeJamLead,null);
 const expectedTime=s.nextStepAudioTime;oneBoundaryStep(s);
 assert.deepEqual(s.lastJamLeadCommit,{planVersion:1,requestedPhraseOrdinal:1,phraseOrdinal:1,audioTime:expectedTime});
 assert.equal(s.visualQueue.at(-1).events.filter(e=>e.role==='lead').length,1);
 assert.equal(s.capturePerformance().events.some(x=>x.event.id==='evolved-1'),false,'queued future attack excluded');
 s.audioCtx.currentTime=expectedTime+.1;
 assert.equal(s.capturePerformance().events.filter(x=>x.event.id==='evolved-1').length,1);
 assert.equal(s.activeJamBacking().events.filter(e=>e.role==='lead').length,1);
 s.setCompiledSong(bridgeSong('A'),{quantizeJamBacking:true,jamStyleBlend:0});
 assert.equal(s.pendingJamBacking,null);assert.equal(s.activeJamLead.planVersion,1);
 assert.equal(s.queueJamLead(leadPlan(1,2)),false);
});

test('bridge wins collision, deferred lead waits for next phrase and survives later style commits',()=>{
 const s=bridgeScheduler();for(let i=0;i<63;i++)oneBoundaryStep(s);
 s.queueJamLead(leadPlan(1));
 s.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleBlend:1});
 assert.equal(s.pendingJamLead,null,'a changed backing cancels a stale prepared plan');
 assert.equal(s.queueJamLead(leadPlan(2)),true);
 oneBoundaryStep(s);oneBoundaryStep(s);
 assert.equal(s.jamBridgeStage,1);assert.equal(s.activeJamLead,null);
 for(let i=0;i<63;i++)oneBoundaryStep(s);
 assert.equal(s.activeJamLead,null,'destination at bar 2 is not a full phrase');
 oneBoundaryStep(s);assert.equal(s.activeJamLead.planVersion,2);
 assert.equal(s.lastJamLeadCommit.phraseOrdinal,2);
 s.setCompiledSong(bridgeSong('C'),{quantizeJamBacking:true,jamStyleBlend:2});
 for(let i=0;i<33;i++)oneBoundaryStep(s);
 assert.equal(s.activeJamLead.planVersion,2);
 assert.equal(s._effectiveJamBacking().filter(e=>e.role==='lead').length,1);
 assert.ok(s._effectiveJamBacking().filter(e=>e.role!=='lead').every(e=>e.id.startsWith('C-')));
 s.queueJamLead(leadPlan(3,3));s.clearJamLead();
 assert.equal(s.pendingJamLead,null);assert.equal(s.activeJamLead,null);
 s.queueJamLead(leadPlan(4,3));s.stop();assert.equal(s.pendingJamLead,null);
});

test('lead plan rejects personal events and unsupported loop ranges; skipping never emits a missed phrase',()=>{
 const s=bridgeScheduler(); const own={...leadPlan(1),events:[{...leadPlan(1).events[0],provenance:'user_placed'}]};
 assert.equal(s.queueJamLead(own),false);
 s.loopStartStep=16;assert.equal(s.queueJamLead(leadPlan(1)),false);s.loopStartStep=0;
 s.queueJamLead(leadPlan(1));s.currentStep=0;s.jamPhraseOrdinal=1;
 s._commitJamLeadIfDue(true);assert.equal(s.activeJamLead,null);
 s._commitJamLeadIfDue();assert.equal(s.activeJamLead.planVersion,1);
});

test('an edited personal lead suppresses overlapping evolved lead without changing either source',()=>{
 const s=bridgeScheduler();s.queueJamLead(leadPlan(1,0));s._commitJamLeadIfDue();
 const own={...leadPlan(1).events[0],id:'my-held-note',provenance:'user_placed',duration_sec:1};
 s.setCompiledSong({...bridgeSong('A'),events:[...bridgeSong('A').events,own]},
   {quantizeJamBacking:true,jamStyleBlend:0});
 assert.equal(s._effectiveJamBacking().filter(e=>e.role==='lead').length,0);
 assert.equal(s.activeJamLead.events.length,1);assert.deepEqual(s.compiledSong.events.at(-1),own);
 const swung={...own,step:1,duration_sec:.15};
 s.compiledSong={...s.compiledSong,swing:.6,events:[swung]};
 s.activeJamLead.events=[{...leadPlan(1).events[0],step:2,duration_sec:.01}];
 assert.equal(s._effectiveJamBacking().filter(e=>e.role==='lead').length,0,'legacy swing overlap');
});

test('realized descriptors persist through Stop/reopen; future plans never become saved state',()=>{
 for(const bpm of [100,400])for(const after of [false,true]) {
  const s=bridgeScheduler();s.compiledSong={...s.compiledSong,bpm,song_id:'sequence'};
  const flow=Object.create(PlayFlow.prototype);
  flow.stage='jam';flow.app={scheduler:s};flow.exploreTour={mode:'wide'};
  flow.doc={id:'sequence',global_context:{bpm,root_pc:0,scale_type:'major'},
    jam_session:{showcase_version:1,scene_id:'bluegrass-v1'}};
  const before=planMelodicPhrase({phraseOrdinal:4,sceneId:'bluegrass-v1',bpm,seed:23});
  const future=planMelodicPhrase({phraseOrdinal:5,sceneId:'reggae-v1',bpm,seed:23,previousPatch:before.patch});
  s.activeJamLead={...before,planVersion:1};s._rememberJamBacking(0);
  s.activeJamLead={...future,planVersion:2};s._rememberJamBacking(10);
  s.audioCtx.currentTime=after?10.01:9.99;
  flow._retainMelodicState();const expected=after?future:before;
  assert.deepEqual(flow.doc.jam_session.melodic_evolution,expected.descriptor);
  s.stop();flow._retainMelodicState();assert.deepEqual(flow.doc.jam_session.melodic_evolution,expected.descriptor);
  flow.doc=JSON.parse(JSON.stringify(flow.doc));
  const restored=flow._savedMelodicLead();assert.deepEqual(restored.events,expected.events);
  flow.doc.global_context={bpm:200,root_pc:2,scale_type:'major'};
  const changed=flow._savedMelodicLead();
  assert.equal(changed.events[0].concrete.midi_pitch,expected.events[0].concrete.midi_pitch+2);
  assert.equal(changed.events[0].duration_sec,expected.events[0].duration_sec*bpm/200);
  flow.doc.global_context={bpm,root_pc:0,scale_type:'major'};
  s.initialJamLead=restored;s.masterBus=null;s.ensureContext();s.masterBus.piano={trigger(){},stop(){}};
  globalThis.window={...globalThis.window,setInterval(){return 1;},clearInterval(){}};
  s.start();assert.equal(s.jamEvolutionOrigin,expected.descriptor.phraseOrdinal);
  flow.exploreTour={mode:'wide'};flow._queueMelodicEvolution();
  assert.equal(s.pendingJamLead.descriptor.phraseOrdinal,expected.descriptor.phraseOrdinal+1);
  assert.equal(s.pendingJamLead.phraseOrdinal,bpm===400?3:1);
  const retained=JSON.stringify(s.pendingJamLead);flow._queueMelodicEvolution();assert.equal(JSON.stringify(s.pendingJamLead),retained);
  flow.doc.captured_performance={events:[]};assert.equal(flow._savedMelodicLead(),null);
  s.stop();
 }
});

test('32-bar integration develops melody at bounded tempo cadence without duplicate lead events',()=>{
 for(const bpm of [100,400]) {
  const s=bridgeScheduler();s.compiledSong={...s.compiledSong,bpm,song_id:'long-run'};
  s.masterBus.piano={trigger(){},stop(){}};
  const flow=Object.create(PlayFlow.prototype);
  flow.stage='jam';flow.app={scheduler:s};flow.exploreTour={mode:'wide'};
  flow.doc={id:'long-run',global_context:{bpm,root_pc:0,scale_type:'major'},jam_session:{showcase_version:1,scene_id:'bluegrass-v1'}};
  const commits=[];
  for(let i=0;i<512;i++) {
   flow._queueMelodicEvolution();
   s.audioCtx.currentTime=s.nextStepAudioTime-.09;s._lookaheadTick();
   const c=s.lastJamLeadCommit;
   if(c&&!commits.some(x=>x.audioTime===c.audioTime))commits.push({...c,variant:s.activeJamLead.descriptor.phraseOrdinal%4});
   const lead=s.visualQueue.at(-1).events.filter(e=>e.role==='lead');
   assert.equal(new Set(lead.map(e=>e.id)).size,lead.length);
  }
  assert.deepEqual(commits.map(c=>c.phraseOrdinal),bpm===100?[1,2,3,4,5,6,7]:[3,6]);
  assert.ok(commits.every((c,i)=>!i||c.audioTime-commits[i-1].audioTime>=6));
 }
});

test('next opening history waits for the audio-clock realization of a lookahead commit',()=>{
 const s=bridgeScheduler();s.compiledSong={...s.compiledSong,song_id:'opening-clock'};
 const flow=Object.create(PlayFlow.prototype);
 flow.stage='jam';flow.app={scheduler:s};flow.exploreTour={mode:'wide'};
 flow.doc={id:'opening-clock',global_context:{bpm:100,root_pc:0,scale_type:'major'},
   jam_session:{showcase_version:1,scene_id:'bluegrass-v1'}};
 const phrase=planMelodicPhrase({version:2,phraseOrdinal:1,sceneId:'bluegrass-v1',seed:0,recentOpenings:[]});
 s.activeJamLead={...phrase,planVersion:1};s.jamPhraseOrdinal=1;s.currentStep=1;
 s.lastJamLeadCommit={phraseOrdinal:1,audioTime:10};s._rememberJamBacking(10);
 s.audioCtx.currentTime=9.99;flow._queueMelodicEvolution();assert.equal(s.pendingJamLead,null);
 s.audioCtx.currentTime=10.01;flow._queueMelodicEvolution();
 assert.deepEqual(s.pendingJamLead.descriptor.recentOpenings,[phrase.openingId]);
});

test('live playing replaces only a future lead plan; opt-out and Stop cancel pending room',()=>{
 const s=bridgeScheduler();s.compiledSong={...s.compiledSong,song_id:'live-room'};
 s.currentStep=60;s.audioCtx.currentTime=9;
 const flow=Object.create(PlayFlow.prototype);
 flow.stage='jam';flow.app={scheduler:s};flow.exploreTour={mode:'wide'};
 flow.doc={id:'live-room',global_context:{bpm:100,root_pc:0,scale_type:'major'},
   jam_session:{showcase_version:1,scene_id:'bluegrass-v1',live_keys:true,responsive:true}};
 s.performanceTake={start:0,bpm:100,sequence:0,events:[]};
 flow._queueMelodicEvolution();assert.ok(s.pendingJamLead.events.length>2);
 const own={time:9.01,duration:4,event:{provenance:'user_placed',source_note_id:'jam-live-hold'}};
 s.performanceTake.events.push(own);flow._queueMelodicEvolution();assert.equal(s.pendingJamLead.descriptor.roomFor,undefined);
 s.audioCtx.currentTime=9.02;flow._queueMelodicEvolution();
 assert.deepEqual(s.pendingJamLead.descriptor.roomFor,['jam-live-hold']);
 assert.ok(s.pendingJamLead.events.every(e=>e.step>=32));assert.equal(s.activeJamLead,null);
 const personal=structuredClone(own);flow.doc.jam_session.responsive=false;flow._queueMelodicEvolution();
 assert.equal(s.pendingJamLead.descriptor.roomFor,undefined);assert.deepEqual(own,personal);
 flow.doc.jam_session.responsive=true;flow._queueMelodicEvolution();s.stop();assert.equal(s.pendingJamLead,null);
});
function bridgeScheduler() {
  const s=liveScheduler();s.setCompiledSong(bridgeSong('A'),{quantizeJamBacking:true,jamStyleBlend:0});
  s.isPlaying=true;s.nextStepAudioTime=.04;return s;
}
function boundaryScheduler() {
  const s=liveScheduler(); s.setCompiledSong(boundarySong('A'),{quantizeJamBacking:true});
  s.isPlaying=true; s.nextStepAudioTime=.04; return s;
}
function oneBoundaryStep(s) {
  s.audioCtx.currentTime=s.nextStepAudioTime-.05;
  const count=s.visualQueue.length; s._lookaheadTick();
  assert.equal(s.visualQueue.length,count+1);
  return s.visualQueue.at(-1).events.map(e=>e.id);
}

test('rocksteady/reggae intermediate commits incoming chords over outgoing rhythm in both directions',()=>{
 for(const [from,to] of [['rocksteady-v1','reggae-v1'],['reggae-v1','rocksteady-v1']]) {
  const s=liveScheduler();s.setCompiledSong(bridgeSong('A'),{quantizeJamBacking:true,jamStyleKey:`scene:${from}:base`});
  s.isPlaying=true;s.nextStepAudioTime=.04;
  for(let i=0;i<5;i++)oneBoundaryStep(s);
  s.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleKey:`scene:${to}:base`});
  for(let i=5;i<=16;i++)oneBoundaryStep(s);
  assert.equal(s.lastJamBackingCommit.route,'offbeat-chords-first');
  assert.deepEqual(s.visualQueue.at(-1).events.map(e=>e.id).sort(),['A-bass-16','A-drums-16','B-harmony-16']);
  for(let i=17;i<=32;i++)oneBoundaryStep(s);
  assert.deepEqual(s.visualQueue.at(-1).events.map(e=>e.id).sort(),['B-bass-32','B-drums-32','B-harmony-32']);
  s.setCompiledSong(bridgeSong('A'),{quantizeJamBacking:true,jamStyleKey:`scene:${from}:base`});
  for(let i=33;i<=48;i++)oneBoundaryStep(s);
  assert.deepEqual(s.visualQueue.at(-1).events.map(e=>e.id).sort(),['A-harmony-48','B-bass-48','B-drums-48']);
  s.stop();assert.equal(s.pendingJamBacking,null);assert.equal(s.isPlaying,false);
 }
});

test('style handoff preserves phrase phase and reaches destination despite repeated input updates',()=>{
 const s=bridgeScheduler(),trace=[];
 for(let step=0;step<40;step++) {
  if(step===5 || step===19 || step===29) s.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleBlend:1});
  const ids=oneBoundaryStep(s);trace.push(ids);
  const expected=step<16?['drums','bass','harmony'].map(r=>`A-${r}-${step}`)
   :step<32?[`B-drums-${step}`,...(step%16===0?[`A-bass-${step}`]:[]),`A-harmony-${step}`]
   :['drums','bass','harmony'].map(r=>`B-${r}-${step}`);
  assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
 }
 assert.equal(s.currentStep,40);assert.equal(s.isPlaying,true);
 assert.equal(s.pendingJamBacking,null);assert.equal(s.jamBridgeStage,null);
 assert.equal(s.lastJamBackingCommit.step,32);assert.equal(s.lastJamBackingCommit.phase,'destination');
});

test('style reversal, Stop, incompatible clock and skipped bars discard stale transition work',()=>{
 const s=bridgeScheduler();for(let i=0;i<5;i++)oneBoundaryStep(s);
 s.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleBlend:1});
 s.setCompiledSong(bridgeSong('A'),{quantizeJamBacking:true,jamStyleBlend:0});
 assert.equal(s.pendingJamBacking,null);assert.equal(s.jamBridgeStage,null);
 s.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleBlend:1});
 while(s.currentStep<18)oneBoundaryStep(s);
 assert.equal(s.jamBridgeStage,1);
 s.setCompiledSong(bridgeSong('A'),{quantizeJamBacking:true,jamStyleBlend:0});
 while(s.currentStep<33)oneBoundaryStep(s);
 assert.ok(s.visualQueue.at(-1).events.every(e=>e.id.startsWith('A-')));
 s.stop();assert.equal(s.jamBridgeStage,null);assert.equal(s.pendingJamBacking,null);
 assert.deepEqual(s.committedJamBacking,bridgeSong('A').events);
 const stalled=bridgeScheduler();oneBoundaryStep(stalled);
 stalled.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleBlend:1});
 stalled.audioCtx.currentTime=5.2;stalled._lookaheadTick();
 assert.equal(stalled.pendingJamBacking,null);assert.equal(stalled.jamBridgeStage,null);
 assert.ok(stalled.visualQueue.slice(1).every(v=>v.time>=5.18 && v.events.every(e=>e.id.startsWith('B-'))));
 const clock=bridgeScheduler();clock.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleBlend:1});
 clock.setCompiledSong({...bridgeSong('C'),bpm:120},{quantizeJamBacking:true,jamStyleBlend:.5});
 assert.equal(clock.jamBridgeStage,null);assert.equal(clock.pendingJamBacking,null);
});

test('Keep midway through handoff retains performed bridge and held note through save and compilation',async()=>{
 const {materializePerformance}=await import('../../../static/js/theory/performance_capture.js');
 const {compileSongStandalone}=await import('../../../static/ui/standalone_compiler.js');
 const {stashWorkingSong,loadWorkingSong}=await import('../../../static/js/theory/save_store.js');
 const {writeFileSync}=await import('node:fs');
 withTimers(()=>{
  const s=bridgeScheduler();s.performanceTake={start:0,bpm:100,sequence:0,events:[]};
  for(let step=0;step<=20;step++){
   if(step===5)s.setCompiledSong(bridgeSong('B'),{quantizeJamBacking:true,jamStyleBlend:1});
   oneBoundaryStep(s);
  }
  s.audioCtx.currentTime=2.6;s.noteOn({patchId:'warm_keys',role:'lead',midi:67,sourceNoteId:'held-mine'});
  s.setCompiledSong(bridgeSong('C'),{quantizeJamBacking:true,jamStyleBlend:.5});
  s.audioCtx.currentTime=3;const capture=s.capturePerformance();
  const ids=capture.events.map(e=>e.event.source_note_id||e.event.id);
  const expected=Array.from({length:16},(_,step)=>['drums','bass','harmony'].map(r=>`A-${r}-${step}`)).flat();
  for(let step=16;step<20;step++)expected.push(`B-drums-${step}`,...(step===16?[`A-bass-${step}`]:[]),`A-harmony-${step}`);
  expected.push('held-mine');assert.deepEqual(ids,expected);
  const held=capture.events.at(-1);assert.ok(Math.abs(held.time-(2.6+LIVE_START_DELAY_SEC))<1e-9);
  assert.ok(Math.abs(held.duration-(.4-LIVE_START_DELAY_SEC))<1e-9);
  assert.equal(ids.filter(id=>id==='held-mine').length,1);
  const {flow}=jamFlow(),source=structuredClone(flow.doc),doc=materializePerformance(source,capture);
  assert.deepEqual(doc.capture_source,source);
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  assert.equal(stashWorkingSong(storage,doc),true);const reopened=loadWorkingSong(storage);assert.deepEqual(reopened,doc);
  const compiled=compileSongStandalone(reopened);
  assert.equal(compiled.events.length,capture.events.length);
  for(const [i,record] of capture.events.entries()){
   const e=compiled.events.find(e=>e.id===doc.notes[i].id);assert.ok(e);
   assert.ok(Math.abs(e.start_sec-(record.time-capture.start))<1e-5);
   assert.ok(Math.abs(e.duration_sec-record.duration)<1e-5);
  }
  if(process.env.MUSICLAB_BRIDGE_TRACE)writeFileSync(process.env.MUSICLAB_BRIDGE_TRACE,JSON.stringify({
   expected,actual:ids,capture,doc,compiled,scheduled:s.performanceTake.events,
   semantics:'audio-clock event history, not physical audibility; future step20 and pending C excluded'},null,2));
 });
});

test('one-bar style bridge advances on wrap and same-style response updates its destination',()=>{
 const short=label=>({...bridgeSong(label),total_steps:16,total_duration_sec:2.4,
  events:bridgeSong(label).events.filter(e=>e.step<16)});
 const s=liveScheduler();s.setCompiledSong(short('A'),{quantizeJamBacking:true,jamStyleBlend:0});
 s.isPlaying=true;s.nextStepAudioTime=.04;
 for(let i=0;i<5;i++)oneBoundaryStep(s);
 s.setCompiledSong(short('B'),{quantizeJamBacking:true,jamStyleBlend:1});
 for(let i=5;i<=16;i++)oneBoundaryStep(s);
 assert.equal(s.jamBridgeStage,1);
 s.setCompiledSong(short('C'),{quantizeJamBacking:true,jamStyleBlend:1});
 assert.equal(s.jamBridgeStage,1);
 for(let i=17;i<=32;i++)oneBoundaryStep(s);
 assert.equal(s.jamBridgeStage,null);assert.equal(s.pendingJamBacking,null);
 assert.ok(s.visualQueue.at(-1).events.every(e=>e.id.startsWith('C-')));
});

test('jam backing commits once at first unscheduled bar, while personal gates stay current', async () => {
  const s=boundaryScheduler(),actual=[];
  for(let step=0;step<32;step++) {
    if(step===5) {
      const b=boundarySong('B'); b.events.push({id:'held-personal',step:7,role:'lead',patch_id:'warm_keys',
        duration_sec:.81,velocity:.7,provenance:'user_placed',concrete:{freq_hz:440}});
      s.setCompiledSong(b,{quantizeJamBacking:true});
      assert.ok(s.pendingJamBacking); assert.equal(s.currentStep,5);
    }
    actual.push(...oneBoundaryStep(s));
  }
  const expected=Array.from({length:32},(_,i)=>`${i<16?'A':'B'}-${i}`);expected.splice(7,0,'held-personal');
  assert.deepEqual(actual,expected);assert.equal(new Set(actual).size,actual.length);
  assert.equal(s.lastJamBackingCommit.step,16);assert.ok(Math.abs(s.lastJamBackingCommit.audioTime-2.44)<1e-9);
  assert.equal(s.pendingJamBacking,null);assert.equal(s.isPlaying,true);
  assert.equal(s.compiledSong.events.find(e=>e.id==='held-personal').duration_sec,.81);
  if(process.env.MUSICLAB_BOUNDARY_TRACE) {
    const {writeFileSync}=await import('node:fs');writeFileSync(process.env.MUSICLAB_BOUNDARY_TRACE,JSON.stringify({
      fixture:'A steps0-15; B steps16-31; personal step7 immediate',expectedScheduled:expected,actualScheduled:actual,
      commit:s.lastJamBackingCommit,realizedAudio:'not measured by this deterministic fixture',
      capture:'not implemented; editable document remains latest requested B',passed:true},null,2));
  }
});

test('pending backing reversal and replacement do not leak stale attacks; Stop cancels pending', () => {
  const s=boundaryScheduler(); for(let i=0;i<5;i++) oneBoundaryStep(s);
  s.setCompiledSong(boundarySong('B'),{quantizeJamBacking:true});
  s.setCompiledSong(boundarySong('A'),{quantizeJamBacking:true});assert.equal(s.pendingJamBacking,null);
  for(let i=5;i<17;i++) assert.deepEqual(oneBoundaryStep(s),[`A-${i}`]);
  s.setCompiledSong(boundarySong('B'),{quantizeJamBacking:true});
  s.setCompiledSong(boundarySong('C'),{quantizeJamBacking:true});
  for(let i=17;i<32;i++) assert.deepEqual(oneBoundaryStep(s),[`A-${i}`]);
  assert.deepEqual(oneBoundaryStep(s),['C-0']);
  s.setCompiledSong(boundarySong('B'),{quantizeJamBacking:true});
  const step=s.currentStep,time=s.nextStepAudioTime;s.stop();
  assert.equal(s.pendingJamBacking,null);assert.equal(s.isPlaying,false);
  s._lookaheadTick();assert.equal(s.currentStep,step);assert.equal(s.nextStepAudioTime,time);assert.deepEqual(s.visualQueue,[]);
  assert.deepEqual(s.committedJamBacking,s.compiledSong.events,'explicit next Play uses latest editable state');
});

test('requests after a boundary was queued wait for the following bar; skipped boundaries do not burst', () => {
  const s=boundaryScheduler();for(let i=0;i<17;i++) oneBoundaryStep(s);
  s.setCompiledSong(boundarySong('B'),{quantizeJamBacking:true});
  for(let i=17;i<32;i++) assert.deepEqual(oneBoundaryStep(s),[`A-${i}`]);
  assert.deepEqual(oneBoundaryStep(s),['B-0']);
  const stalled=boundaryScheduler();oneBoundaryStep(stalled);
  stalled.setCompiledSong(boundarySong('C'),{quantizeJamBacking:true});
  stalled.audioCtx.currentTime=2.8;stalled._lookaheadTick();
  const resumed=stalled.visualQueue.slice(1);assert.ok(resumed.length>0);
  assert.ok(resumed.every(s=>s.events.every(e=>e.id.startsWith('C-'))));
  assert.ok(resumed.every(s=>s.time>=2.8-.02));
});


test('Keep captures past committed occurrences, partial bar and held input, excluding queued and pending events', async () => {
 const {materializePerformance}=await import('../../../static/js/theory/performance_capture.js');
 const {compileSongStandalone}=await import('../../../static/ui/standalone_compiler.js');
 const {stashWorkingSong,loadWorkingSong}=await import('../../../static/js/theory/save_store.js');
 withTimers(()=>{
  const s=boundaryScheduler();s.performanceTake={start:0,bpm:100,sequence:0,events:[]};
  for(let i=0;i<17;i++){if(i===5)s.setCompiledSong(boundarySong('B'),{quantizeJamBacking:true});oneBoundaryStep(s);}
  s.setCompiledSong(boundarySong('C'),{quantizeJamBacking:true});
  s.audioCtx.currentTime=2.5;s.noteOn({patchId:'warm_keys',role:'lead',midi:72,sourceNoteId:'personal-held'});
  oneBoundaryStep(s);s.audioCtx.currentTime=2.65;s._lookaheadTick();
  const capture=s.capturePerformance();
  const ids=capture.events.map(x=>x.event.source_note_id||x.event.id);
  const expected=[...Array.from({length:16},(_,i)=>`A-${i}`),'B-16','personal-held','B-17'];
  assert.deepEqual(ids,expected);assert.ok(!ids.includes('B-18'));assert.ok(!ids.some(id=>id.startsWith('C-')));
  assert.equal(capture.bars,2);assert.equal(capture.end,2.65);
  const held=capture.events.find(e=>e.event.source_note_id==='personal-held');assert.ok(Math.abs(held.duration-(.15-LIVE_START_DELAY_SEC))<1e-9);
  assert.equal(ids.filter(id=>id==='personal-held').length,1);
  const {flow}=jamFlow();const original=structuredClone(flow.doc);const doc=materializePerformance(original,capture);
  assert.deepEqual(doc.capture_source,original);assert.deepEqual(original,flow.doc);
  const compiled=compileSongStandalone(doc);
  assert.equal(compiled.events.length,capture.events.length);
  for(const [i,e] of capture.events.entries()){
   const note=doc.notes[i];const out=compiled.events.find(n=>n.id===note.id);
   assert.ok(out);assert.ok(Math.abs(out.start_sec-(e.time-capture.start))<.00001);
   assert.ok(Math.abs(out.duration_sec-e.duration)<.00001);
  }
  const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  stashWorkingSong(storage,doc);assert.deepEqual(loadWorkingSong(storage),doc);
  const trace={expectedIds:expected,actualIds:ids,scheduled:s.performanceTake.events,captured:capture,
   pendingExcluded:s.pendingJamBacking.map(e=>e.id),originalsPreserved:true,compilerAgreement:true,
   semantics:'event gates reached audio-clock cutoff; not measured physical audibility'};
  if(process.env.MUSICLAB_REALIZED_TRACE) writeFileSync(process.env.MUSICLAB_REALIZED_TRACE,JSON.stringify(trace,null,2));
 });
});


test('rolling capture keeps carry-in gates and cutoff provenance without inventing future notes', () => {
 const s=boundaryScheduler();s.performanceTake={start:0,bpm:100,sequence:4,events:[
  {event:{id:'old'},time:1,duration:.2,occurrence:1},
  {event:{id:'carry'},time:2,duration:1,occurrence:2},
  {event:{id:'last'},time:10.8,duration:.8,occurrence:3},
  {event:{id:'future'},time:11.1,duration:.2,occurrence:4}]};
 s.audioCtx.currentTime=11;const c=s.capturePerformance();
 assert.equal(c.start,2.4);assert.equal(c.bars,4);assert.deepEqual(c.events.map(e=>e.event.id),['carry','last']);
 assert.equal(c.events[0].scheduled_time,2);assert.equal(c.events[0].carried_in,true);
 assert.ok(Math.abs(c.events[0].duration-.6)<1e-9);assert.ok(Math.abs(c.events[1].duration-.2)<1e-9);
 s.stop();assert.equal(s.capturePerformance(),null,'stopped route explicitly keeps editable loop, not an old take');
});

test('muted scheduled events never enter performance history and release updates live occurrence once', () => withTimers(()=>{
 const s=boundaryScheduler();s.performanceTake={start:0,bpm:100,sequence:0,events:[]};
 s.mutedLayers.add('bass');oneBoundaryStep(s);assert.equal(s.performanceTake.events.length,0);
 const id=s.noteOn({patchId:'warm_keys',role:'lead',midi:60,sourceNoteId:'mine'});
 s.audioCtx.currentTime=.8;s.noteOff(id);const record=s.performanceTake.events[0];
 assert.equal(s.performanceTake.events.length,1);assert.ok(record.duration<1);
 s.noteOff(id);assert.equal(s.performanceTake.events.length,1);
}));

test('ASDF remains playable after a range adjustment while text fields keep typing',()=>{
 const {flow,calls}=jamFlow();flow.root.style={};flow.root.contains=()=>true;
 globalThis.document={activeElement:{tagName:'INPUT',type:'text'},getElementById:()=>null};
 const press=()=>flow._onKey({key:'a',repeat:false,preventDefault(){},stopImmediatePropagation(){}});
 press();assert.equal(calls.length,0);
 globalThis.document.activeElement={tagName:'INPUT',type:'range'};press();assert.equal(calls[0][0],'on');
 flow._releaseLive('key:a');assert.equal(calls.at(-1)[0],'off');delete globalThis.document;
});

test('style duck weights sum at shared attacks and preserve full legacy duck',()=>{
 const s=liveScheduler(),bus=s.masterBus;
 bus.scheduleSidechainDuck(.5,.05);assert.deepEqual(bus.duckGain.gain.calls.at(-2),['ramp',.96,.505]);
 bus.scheduleSidechainDuck(1,.5);bus.scheduleSidechainDuck(1,.5);assert.ok(Math.abs(bus.duckGain.gain.calls.at(-2)[1]-.2)<1e-9);
 bus.scheduleSidechainDuck(2);assert.ok(Math.abs(bus.duckGain.gain.calls.at(-2)[1]-.2)<1e-9);
});

test('live attack precedes compilation and synchronous draft persistence', () => {
  const {flow,calls}=jamFlow();
  const accept=flow._acceptJamDoc.bind(flow);
  flow._acceptJamDoc=doc=>{assert.ok(calls.some(c=>c[0]==='on'));accept(doc);};
  flow._playJamPad(0,'key:a');
  assert.ok(flow.doc.notes.some(n=>n.provenance==='user_placed'));
  assert.equal(flow.liveHolds.size,1);
});

test('disposed sampler refuses a press without creating a silent personal edit', () => {
  const {flow,calls}=jamFlow();
  flow.doc=startJam(flow.doc,{patchId:'sampled_piano_v1'});
  flow.app.scheduler.masterBus={piano:{},disposed:true};
  const before=JSON.stringify(flow.doc);
  flow._playJamPad(0,'key:a');
  assert.equal(JSON.stringify(flow.doc),before);
  assert.equal(calls.length,0);
});

test('listening tour waits for actual transition time, dwells, reverses and preserves personal notes', () => {
  const {flow}=jamFlow();
  flow._playJamPad(0,'key:a');
  flow.doc=setJamDirection(flow.doc,{style_spectrum:0});
  const personal=JSON.stringify(flow.doc.notes.filter(n=>n.provenance==='user_placed'));
  const s=flow.app.scheduler;
  s.isPlaying=true;s.audioCtx={currentTime:0};s.pendingJamBacking=null;
  flow.exploreTour={direction:1,settledAt:null};
  flow._advanceExploreTour();
  s.audioCtx.currentTime=9;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,0);
  s.audioCtx.currentTime=10;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,1);
  s.pendingJamBacking=[];s.jamBridgeStage=0;s.audioCtx.currentTime=30;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,1);
  s.pendingJamBacking=null;s.jamBridgeStage=null;s.lastJamBackingCommit={audioTime:31,phase:'destination'};
  flow._advanceExploreTour();assert.equal(flow.exploreTour.settledAt,null);
  s.audioCtx.currentTime=31;flow._advanceExploreTour();
  s.pendingJamBacking=[];s.audioCtx.currentTime=41;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,2);
  flow.doc=setJamDirection(flow.doc,{style_spectrum:3});flow.exploreTour.settledAt=41;
  s.audioCtx.currentTime=51;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,2);
  assert.equal(JSON.stringify(flow.doc.notes.filter(n=>n.provenance==='user_placed')),personal);
  s.isPlaying=false;s.audioCtx.currentTime=100;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,2);
  flow.exploreTour=null;s.isPlaying=true;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,2);
});

test('phrase choice and nearby exploration retain fractional direction and personal events',async()=>{
 const {flow}=jamFlow();flow._playJamPad(0,'key:a');
 flow.doc=setJamDirection(flow.doc,{style_spectrum:1.5});
 const own=JSON.stringify(flow.doc.notes.filter(n=>n.provenance==='user_placed'));
 const click=key=>flow._onClick({target:{closest:()=>({dataset:{key},focus(){}})}});
 await click('jam-phrase:space');assert.equal(flow.doc.jam_session.style_spectrum,1.5);
 flow.app.scheduler.isPlaying=true;flow.app.scheduler.audioCtx={currentTime:0};
 const {compileSongStandalone}=await import('../../../static/ui/standalone_compiler.js');
 flow.app.scheduler.jamBackingTimeline=[{time:0,events:compileSongStandalone(flow.doc).events.filter(n=>n.provenance==='jam_generated')}];
 flow.app.scheduler.activeJamBacking=LookaheadScheduler.prototype.activeJamBacking;
 await click('explore-near');assert.equal(flow.exploreTour.anchor,1.5);
 flow._advanceExploreTour();
 for(let i=1;i<=4;i++) {flow.app.scheduler.audioCtx.currentTime=i*12;flow._advanceExploreTour();flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,1.5);}
 assert.equal(JSON.stringify(flow.doc.notes.filter(n=>n.provenance==='user_placed')),own);
 await click('explore-wide');flow._advanceExploreTour();
 flow.app.scheduler.audioCtx.currentTime+=12;flow._advanceExploreTour();
 assert.ok(Number.isInteger(flow.doc.jam_session.style_spectrum));
});

// Harmonic context uses the same reached snapshots as actual captured events.
test('harmonic metadata waits for realization, survives silence and clears incompatible generated lead',()=>{
 const s=bridgeScheduler();
 const a={sceneId:'reggae-v1',root:0,minor:false,harmony:{version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7}};
 const b={sceneId:'house-v1',root:0,minor:false,harmony:{version:1,bars:[[0,4,7],[5,9,0],[7,11,2],[0,4,7]],ending:0}};
 s.committedPhraseContext=a;s.requestedPhraseContext=a;s._rememberJamBacking(0);
 const phrase=planMelodicPhrase({version:3,harmony:a.harmony,phraseOrdinal:1,sceneId:a.sceneId});
 s.activeJamLead={...phrase,planVersion:1};s._rememberJamBacking(0);
 const own={id:'held-b-flat',role:'lead',provenance:'user_placed',step:12,duration_sec:4,concrete:{midi_pitch:70}};
 s.compiledSong.events.push(own);const original=structuredClone(own);
 const song={...s.compiledSong,events:[...s.compiledSong.events]};
 s.setCompiledSong(song,{quantizeJamBacking:true,jamStyleKey:'scene:house-v1',phraseContext:b});
 assert.ok(s.pendingJamBacking,'metadata-only change is a real request');
 s.currentStep=16;s.nextStepAudioTime=7.6;s._commitJamBackingIfDue();
 s.audioCtx.currentTime=7.61;assert.deepEqual(s.activeJamBacking().phraseContext,a);
 s.currentStep=32;s.nextStepAudioTime=10;s._commitJamBackingIfDue();
 s.audioCtx.currentTime=9.99;assert.deepEqual(s.activeJamBacking().phraseContext,a);
 s.audioCtx.currentTime=10.01;assert.deepEqual(s.activeJamBacking().phraseContext,b);
 assert.equal(s.activeJamLead,null);assert.deepEqual(own,original);
 const flow=Object.create(PlayFlow.prototype);flow.stage='jam';flow.app={scheduler:s};flow.exploreTour={mode:'wide'};
 flow.doc={id:'harmony-clock',global_context:{bpm:100,root_pc:0,scale_type:'major'},jam_session:{showcase_version:1,scene_id:'reggae-v1'}};
 s.audioCtx.currentTime=9.99;flow._queueMelodicEvolution();assert.equal(s.pendingJamLead,null);
 s.audioCtx.currentTime=10.01;flow._queueMelodicEvolution();
 assert.equal(s.pendingJamLead.descriptor.sceneId,b.sceneId);
 assert.deepEqual(s.pendingJamLead.descriptor.harmony,b.harmony);
 assert.deepEqual(s.pendingJamLead.descriptor.recentOpenings,[phrase.openingId]);
 s.setCompiledSong(song,{quantizeJamBacking:true,jamStyleKey:'scene:reggae-v1',phraseContext:a});
 assert.equal(s.pendingJamLead,null);assert.deepEqual(s.activeJamBacking().phraseContext,b);
 s.stop();assert.equal(s.pendingJamBacking,null);assert.equal(s.pendingPhraseContext,null);
});

test('saved v3 custom cadence is exact unless the person intentionally changes mode',()=>{
 const flow=Object.create(PlayFlow.prototype);flow.stage='jam';
 const harmony={version:1,bars:[[0,4,7],[5,9,0],[7,11,2],[0,4,7]],ending:0};
 const phrase=planMelodicPhrase({version:3,harmony,phraseOrdinal:2,sceneId:'reggae-v1'});
 flow.doc={global_context:{bpm:100,root_pc:0,scale_type:'major'},jam_session:{melodic_evolution:phrase.descriptor}};
 assert.deepEqual(flow._savedMelodicLead().events,phrase.events);
 flow.doc.global_context.root_pc=2;
 assert.deepEqual(flow._savedMelodicLead().events.map(e=>e.concrete.midi_pitch),phrase.events.map(e=>e.concrete.midi_pitch+2));
 flow.doc.global_context.scale_type='natural_minor';
 assert.deepEqual(flow._savedMelodicLead().descriptor.harmony.bars[0],[0,3,7]);
});
test('chord-first key change retires old generated lead at first harmony handover',()=>{
 const s=bridgeScheduler();
 const harmony={version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7};
 s.committedPhraseContext={sceneId:'rocksteady-v1',root:0,minor:false,harmony};
 s.pendingPhraseContext={sceneId:'reggae-v1',root:2,minor:false,harmony};
 s.activeJamLead={events:[],planVersion:1};s.pendingJamLead={events:[],planVersion:2};
 s.pendingJamBacking=bridgeSong('B').events.filter(e=>e.provenance==='jam_generated');
 s.jamBridgeStage=0;s.jamBridgeMode='offbeat-chords-first';s.currentStep=16;
 s._commitJamBackingIfDue();assert.equal(s.activeJamLead,null);assert.equal(s.pendingJamLead,null);
 assert.equal(s.committedPhraseContext.root,2);
 assert.deepEqual(s.committedJamBacking.filter(e=>e.role==='lead'),s.pendingJamBacking.filter(e=>e.role==='lead'));
});

test('Stop then Play cannot adopt the old reached lead over a newly requested harmony',()=>{
 const s=bridgeScheduler();s.masterBus.piano={trigger(){},stop(){}};
 const harmony={version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7};
 const context={sceneId:'reggae-v1',root:0,minor:false,harmony};
 const phrase=planMelodicPhrase({version:3,harmony,sceneId:'reggae-v1',phraseOrdinal:3});
 s.committedPhraseContext=context;s.activeJamLead={...phrase,planVersion:1};s._rememberJamBacking(0);
 s.audioCtx.currentTime=1;
 s.setCompiledSong(s.compiledSong,{quantizeJamBacking:true,jamStyleKey:'scene:house-v1',phraseContext:{...context,root:2}});
 s.stop();assert.deepEqual(s.initialJamLead.descriptor,phrase.descriptor);
 globalThis.window={...globalThis.window,setInterval(){return 1;},clearInterval(){}};
 s.start();assert.equal(s.activeJamLead,null);assert.deepEqual(s.retiredJamLeadDescriptor,phrase.descriptor);
 assert.equal(s.committedPhraseContext.root,2);assert.equal(s.jamEvolutionOrigin,3);s.stop();
});

test('new cadence does not resume a legacy lead merely because key and mode match',()=>{
 for(const version of [1,2]) {
  const s=bridgeScheduler();s.masterBus.piano={trigger(){},stop(){}};
  const phrase=planMelodicPhrase({version,phraseOrdinal:3,sceneId:'soul-v1',root:0,minor:false});
  s.initialJamLead={...phrase,planVersion:1};
  s.committedPhraseContext={sceneId:'gospel-piano-v1',root:0,minor:false,requiresHarmonicLead:true,
   harmony:{version:1,bars:[[0,4,7],[5,9,0],[7,11,2],[0,4,7]],ending:0}};
  s.isPlaying=false;globalThis.window={...globalThis.window,setInterval(){return 1;},clearInterval(){}};
  s.start();assert.equal(s.activeJamLead,null);assert.deepEqual(s.retiredJamLeadDescriptor,phrase.descriptor);s.stop();
 }
});

test('same harmony does not carry an incompatible lead grammar into the vowel ensemble',()=>{
 const s=bridgeScheduler();const harmony={version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7};
 const phrase=planMelodicPhrase({version:3,harmony,sceneId:'reggae-v1',phraseOrdinal:3});
 s.committedPhraseContext={sceneId:'reggae-v1',root:0,minor:false,harmony};
 s.pendingPhraseContext={sceneId:'doo-wop-v1',root:0,minor:false,harmony,leadGrammar:'vowel-response-v1'};
 s.activeJamLead={...phrase,planVersion:1};s._rememberJamBacking(0);
 s.pendingJamBacking=bridgeSong('B').events.filter(e=>e.provenance==='jam_generated');s.jamBridgeStage=1;s.currentStep=32;
 s.audioCtx.currentTime=1;s._commitJamBackingIfDue();assert.equal(s.activeJamLead,null);
 assert.deepEqual(s.retiredJamLeadDescriptor,phrase.descriptor);
 s.isPlaying=false;s.initialJamLead={...phrase,planVersion:1};s.masterBus.piano={trigger(){},stop(){}};
 globalThis.window={...globalThis.window,setInterval(){return 1;},clearInterval(){}};
 s.start();assert.equal(s.activeJamLead,null);assert.deepEqual(s.retiredJamLeadDescriptor,phrase.descriptor);s.stop();
});


test('a synthesized press at capacity cannot truncate sampled personal holds or their capture',()=>withTimers(()=>{
 const scheduler=liveScheduler(),releases=[],durations=[];
 scheduler.masterBus.piano={trigger(event){return {event};},release(handle,at){releases.push({handle,at});}};
 scheduler.isPlaying=true;scheduler.performanceTake={song_id:'mixed-holds',start:0,bpm:100,steps_per_bar:16,sequence:0,events:[]};
 const ids=Array.from({length:LIVE_VOICE_LIMIT},(_,i)=>scheduler.noteOn({patchId:'sampled_piano_v1',role:'lead',midi:60+i,sourceNoteId:`personal-${i}`,onRelease:seconds=>durations.push(seconds)}));
 scheduler.audioCtx.currentTime=.4;
 assert.throws(()=>scheduler.noteOn({patchId:'pluck_lead',role:'lead',midi:80,sourceNoteId:'overflow'}),/All held notes/);
 assert.deepEqual([...scheduler.liveNotes.keys()],ids);assert.equal(releases.length,0);assert.equal(durations.length,0);assert.equal(scheduler.performanceTake.events.length,LIVE_VOICE_LIMIT);
 scheduler.audioCtx.currentTime=.8214;scheduler.allNotesOff();
 assert.equal(releases.length,LIVE_VOICE_LIMIT);assert.ok(durations.every(d=>Math.abs(d-(.8214-LIVE_START_DELAY_SEC))<1e-9));
 const capture=scheduler.capturePerformance();assert.equal(capture.events.length,LIVE_VOICE_LIMIT);assert.ok(capture.events.every((r,i)=>r.event.source_note_id===`personal-${i}`&&Math.abs(r.duration-(.8214-LIVE_START_DELAY_SEC))<1e-9));
}));


test("visual attacks follow actual offset/gate and exclude muted, suppressed and silent events", () => {
  const s = liveScheduler();
  const base = {step:0, role:"lead", patch_id:"warm_keys", duration_sec:.03, duration_steps:.2,
    velocity:.8, concrete:{midi_pitch:60,freq_hz:261.63}, performance:{version:1,offset_steps:.5}};
  s.setCompiledSong({bpm:100,swing:.5,total_steps:64,events:[{...base,id:"personal"},{...base,id:"silent",velocity:0},
    {...base,id:"band",provenance:"jam_generated"}]});
  s.isPlaying=true;s.nextStepAudioTime=.04;s.makeRoomForLive=true;s.personalRoomUntil=1;
  s.audioCtx.outputLatency=.02;s._lookaheadTick();
  s.audioCtx.currentTime=.12;
  assert.deepEqual(s.drainVisualStep().sounding,[],"offset attack .115 plus estimated output delay .020 has not arrived");
  s.audioCtx.currentTime=.14;
  assert.deepEqual(s.drainVisualStep().sounding.map(e=>e.id),["personal"]);
  s.audioCtx.currentTime=.17;
  assert.deepEqual(s.drainVisualStep().sounding,[],"short gate ends between beat ticks");
  s.stop();assert.equal(s.drainVisualStep(),null);
  const muted=liveScheduler();muted.setCompiledSong({bpm:100,total_steps:64,events:[base]});
  muted.isPlaying=true;muted.nextStepAudioTime=.04;muted.mutedLayers=new Set(["lead"]);muted._lookaheadTick();
  assert.equal(muted.visualNotes.length,0);
});
