// Bass wheel in the melody session (14 Nov 2026, slice 1): state, candidates, history, joins, Keep and reopen.
// Real Jam bands from the scene catalogue with real V9 tune choices; the music itself is tested in
// tests/js/theory/bass-wheel*.test.mjs. Attack fixes covered here: 1 (every request joins bass-safe through the
// scheduler, also a tune move made while a bass move waits), 2 (Keep saves the band's ORIGINAL bass and reopening
// plays the stored bass untouched until the bass moves), 5 (the opening bass is passed explicitly, so Keep before
// anything is heard saves the bass that was heard).
import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession,MELODY_JOIN,heardMelodyCandidate,melodyKeepReadiness} from '../../../static/ui/melody_field_session.js';
import {PlayFlow,savedBassWheel} from '../../../static/ui/stages/play_flow.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {isSampledPatch} from '../../../static/js/audio/sampled_piano.js';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v9.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {phraseContext as docPhraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {SOFT_BAND_FACTOR} from '../../../static/js/theory/melody_balance.js';
import {BASS_MOVES,BASS_BAND,BASS_WHEEL_GENERATOR,bassOverlap} from '../../../static/js/theory/bass_wheel.js';
import {jamScore} from '../theory/bass-wheel-fixtures.mjs';

const EPS=1e-6;
const onset=n=>n.step+(n.performance?.version===1?n.performance.offset_steps||0:0);
const r4=x=>Math.round(x*1e4)/1e4;
/** What a bass note plays: id, time, length, pitch, level and sound. */
const music=n=>[n.id,r4(onset(n)),r4(n.duration_steps??n.duration_sec*100/15),n.concrete?.midi_pitch,r4(n.velocity),n.patch_id];
const bassOf=events=>events.filter(n=>n.role==='bass').sort((a,b)=>onset(a)-onset(b)||String(a.id).localeCompare(String(b.id)));
const bandBass=events=>bassOf(events).filter(n=>n.generated_by==='musiclab_jam');
const wheelBass=events=>bassOf(events).filter(n=>n.generated_by===BASS_WHEEL_GENERATOR);

const PALETTES=new Map();
function palette(context) {
  const key=JSON.stringify([context.sceneId,context.root,context.harmony,context.source.events.filter(n=>n.role==='lead').map(n=>n.id)]);
  if(!PALETTES.has(key))PALETTES.set(key,buildMelodyPalette(context));
  return PALETTES.get(key);
}
function fakeScheduler() {
  return {queued:[],isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,loadingSession:null,audition:null,
    getPartAuditionState(){return this.audition;},
    setSpotlightRole(role){this.spotlightRole=role;},
    queueContinuousPartAudition(_view,opts){this.queued.push(opts);return {ok:true};}};
}
/** A melody session over a real Jam band, with its V9 tune choices loaded as prepare() would. */
function bassSession(scene='soul-v1',{root=0,minor=false,variant='base',scheduler=fakeScheduler(),context=null,song=null,doc=null}={}) {
  const score=jamScore(scene,{root,minor,variant});
  const phrase=context??score.context,source=song??score.song;
  const field=new MelodyFieldSession(source,{scheduler,captureOrigin:0,root,scale:minor?'minor':'major',sourceDoc:doc??score.doc,phraseContext:phrase});
  field.palette=palette(phrase);
  field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return {field,scheduler,score};
}
/** The scheduler has reached the requested score. */
const hear=(field,scheduler)=>{scheduler.audition={sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId};field.realizedId=field.requestId;field.hasPlayed=true;};

test('the Bass wheel opens only over an admitted band with its tune choices; elsewhere it says why',()=>{
  const {field}=bassSession('soul-v1');
  assert.equal(field.bassReason,null);
  assert.equal(field.bassReady,true);
  assert.equal(field.initialBassMove,BASS_BAND);assert.equal(field.bassMove,BASS_BAND);
  assert.match(field.html(),/data-key="melody-field-bass-mode" aria-pressed="false">Bass wheel<\/button>/);
  // Before the tune choices load there is nothing to play the bass over: no tab, no wheel.
  const palette=field.palette;field.palette=null;
  assert.equal(field.bassReady,false);
  assert.equal(field.setWheel('bass'),false);assert.equal(field.wheel,'tune');
  field.palette=palette;
  assert.equal(field.setWheel('bass'),true);assert.equal(field.wheel,'bass');assert.equal(field.bassMode,true);
  // Not a V9 composer context: not ready, with the reason the card shows.
  const score=jamScore('house-v1');
  const older=bassSession('house-v1',{context:{...score.context,composerVersion:5}}).field;
  assert.equal(older.bassReason,'composer');assert.equal(older.bassReady,false);assert.equal(older.initialBassMove,null);
  assert.doesNotMatch(older.html(),/melody-field-bass-mode/);
  older.setWheel('bass');assert.equal(older.wheel,'tune');
  // The six scenes, every variant: ready (Reggae and Ska 'answer' anchor bar 4 on the band's inversion bass).
  for(const scene of ['house-v1','reggae-v1','soul-v1','ska-v1','rocksteady-v1','swing-v1'])for(const variant of ['base','answer','space']) {
    const s=jamScore(scene,{variant});
    const f=new MelodyFieldSession(s.song,{scheduler:fakeScheduler(),captureOrigin:0,sourceDoc:s.doc,phraseContext:s.context});
    assert.equal(f.bassReason,null,`${scene} ${variant}`);
  }
});

test('candidate ids carry the bass move; at the opening bass every id and score is as before',()=>{
  const {field,score}=bassSession('house-v1');
  const plain=new MelodyFieldSession(score.song,{scheduler:fakeScheduler(),captureOrigin:0,sourceDoc:score.doc,phraseContext:{...score.context,composerVersion:5}});
  plain.palette=field.palette;plain.candidates.clear();
  for(const p of [{x:0,y:0},{x:0,y:.5},{x:.7,y:.7}])for(const soft of [false,true]) {
    const a=field._candidate(p,soft,null),b=plain._candidate(p,soft,null);
    assert.equal(a.id.replace(field.sectionId,''),b.id.replace(plain.sectionId,''),'no bass suffix at the opening bass');
    assert.deepEqual(a.song.events,b.song.events,'the opening bass leaves the score exactly as the tune wheel had it');
    assert.equal(a.bassMove,BASS_BAND);
  }
  const moved=field._candidate({x:0,y:0},false,null,'funky-full');
  assert.match(moved.id,/:bass:funky-full$/);assert.equal(moved.bassMove,'funky-full');
  assert.notEqual(field._candidate({x:0,y:0},false,null,'funky-big').id,moved.id);
  assert.notEqual(field._candidate({x:0,y:.5},false,null,'funky-full').id,moved.id);
  // Only the bass changed: every other note is the same note.
  const base=field._candidate({x:0,y:0},false,null,BASS_BAND);
  assert.deepEqual(moved.song.events.filter(n=>n.role!=='bass'),base.song.events.filter(n=>n.role!=='bass'));
  assert.ok(wheelBass(moved.song.events).length>0);assert.equal(bandBass(moved.song.events).length,0);
});

test('the middle plays the band bass exactly; every way at Full sounds different from it',()=>{
  for(const scene of ['soul-v1','swing-v1','ska-v1']) {
    const {field,score}=bassSession(scene);field.setWheel('bass');
    const band=bandBass(score.song.events).map(music);
    for(const move of BASS_MOVES.filter(m=>m.endsWith('-full'))) {
      field.selectBass(move);
      const line=bassOf(field._candidate(field.position).song.events);
      assert.ok(bassOverlap(line,bandBass(score.song.events)).share<=.4+EPS,`${scene} ${move}`);
    }
    field.selectBass(BASS_BAND);
    assert.deepEqual(bassOf(field._candidate(field.position).song.events).map(music),band,`${scene}: the hub is the band's own bass`);
    // And it is the opening score itself, not a regenerated copy.
    assert.equal(field._candidate(field.position).id,field._candidate({x:0,y:0},false,null,field.initialBassMove).id);
  }
});

test('every request asks for a beat join that turns bass-safe on its own: tune, sound, bass, Undo and Original',()=>{
  const {field,scheduler}=bassSession('soul-v1');
  assert.deepEqual(MELODY_JOIN,{joinSteps:4,bassSafe:'auto'});
  field.request({x:0,y:.5});field.remember({x:0,y:0});
  field.selectSound('sampled_kalimba_v1');
  field.setWheel('bass');field.selectBass('deep-full');field.selectBass('deep-big');
  field.undo();field.toggleOriginal();field.toggleOriginal();
  field.toggleBandBalance();
  assert.ok(scheduler.queued.length>=7);
  for(const q of scheduler.queued)assert.deepEqual([q.joinSteps,q.bassSafe],[4,'auto'],JSON.stringify(q));
  // begin() too.
  const fresh=bassSession('soul-v1');fresh.scheduler.queued.length=0;fresh.field.begin();
  assert.deepEqual([fresh.scheduler.queued[0].joinSteps,fresh.scheduler.queued[0].bassSafe],[4,'auto']);
});

// ---- The real scheduler: a bass move, then a tune move in the same half bar (attack fix 1) ----
const STEP=15/100;
function realAudition(field) {
  const s=new LookaheadScheduler(),trace=[];
  s.audioCtx={currentTime:0};s.ensureContext=()=>s.audioCtx;
  s.masterBus={fadeIn(){},dispose(){},piano:{stop(){},trigger(e,t){trace.push({id:e.id,time:t,duration:e.duration_sec,role:e.role,generated_by:e.generated_by});}}};
  // Native drum and chord voices need a real audio graph; the join only concerns the sampled bass and tune.
  const view=field.view.bind(field);
  field.view=candidate=>{const v=view(candidate);v.events=v.events.filter(e=>isSampledPatch(e.patch_id));return v;};
  field.scheduler=s;
  const first=field._candidate(field.position);
  const prev=globalThis.window;globalThis.window={setInterval:()=>1,clearInterval(){}};
  try{s.beginPartAudition({...first.song,events:first.song.events.filter(e=>isSampledPatch(e.patch_id))},{sectionId:field.sectionId,requestId:first.id});s.start();}
  finally{globalThis.window=prev;}
  for(const method of ['_commitJamBackingIfDue','_commitJamFormIfDue','_commitJamLeadIfDue','_serviceAutomaticAnswer','_serviceJamAnswer'])s[method]=()=>{};
  field.captureOrigin=s.gridOriginTime;field.hasPlayed=true;
  return {s,trace,first};
}
const at=(s,step)=>s.gridOriginTime+step*STEP;
const runTo=(s,step)=>{for(let t=s.audioCtx.currentTime;t<=at(s,step)-.1-1e-9;t+=STEP/4){s.audioCtx.currentTime=t;s._lookaheadTick();}};
const commitStep=s=>Math.round((s.partAudition.timeline.at(-1).audioTime-s.gridOriginTime)/STEP);
const soundingBass=(s,trace,step)=>trace.filter(e=>e.role==='bass'&&e.time<at(s,step)-1e-9&&e.time+e.duration>at(s,step)+1e-9);

test('real scheduler: a bass move then a tune move inside one half bar joins at the half bar, with no old bass under the new line',()=>{
  // Soul's own band bass crosses the half-bar line in every bar.
  const {field}=bassSession('soul-v1');field.setWheel('bass');
  const {s,trace,first}=realAudition(field);
  runTo(s,1);
  assert.equal(field.selectBass('deep-full'),true);
  runTo(s,2);
  assert.equal(field.request({x:0,y:.5}),true,'a tune move while the bass move waits');
  const last=field.requestId;
  runTo(s,6);
  assert.equal(s.getPartAuditionState().scheduledId,first.id,'no beat join at step 4: the bass still differs from the scheduled score');
  runTo(s,10);
  assert.equal(s.getPartAuditionState().scheduledId,last);
  assert.equal(commitStep(s)%8,0,'joins on a half-bar line');
  assert.deepEqual(soundingBass(s,trace,commitStep(s)).filter(e=>e.generated_by==='musiclab_jam'),[],'nothing of the band bass rings under the new line');
  assert.ok(trace.some(e=>e.generated_by===BASS_WHEEL_GENERATOR),'the new bass plays');
  // Undo of the bass alone (the tune stays) changes the bass again: bass-safe once more.
  field.undo();
  const undo=field.requestId,before=commitStep(s);
  runTo(s,before+12);
  assert.equal(s.getPartAuditionState().scheduledId,undo);
  assert.equal(commitStep(s)%8,0);
  assert.deepEqual(soundingBass(s,trace,commitStep(s)).filter(e=>e.generated_by===BASS_WHEEL_GENERATOR),[],'nothing of the wheel bass rings under the band bass');
});

test('one Undo entry per bass press; Undo walks back across tune, sound and bass',()=>{
  const {field}=bassSession('house-v1');field.setWheel('bass');
  field.selectBass('walk-full');assert.equal(field.history.length,1);
  assert.equal(field.selectBass('walk-full'),false,'the same move again changes nothing');assert.equal(field.history.length,1);
  field.pressBassWay(2);assert.equal(field.bassMove,'walk-big','pressing the chosen way changes its size');
  field.setWheel('sound');field.selectSound('sampled_marimba_v1');
  field.setWheel('tune');field.request({x:0,y:.5});field.remember({x:0,y:0});
  assert.equal(field.history.length,4);
  field.undo();assert.deepEqual([field.position,field.soundPatch,field.bassMove],[{x:0,y:0},'sampled_marimba_v1','walk-big']);
  field.undo();assert.deepEqual([field.soundPatch,field.bassMove],[null,'walk-big']);
  field.undo();assert.equal(field.bassMove,'walk-full');
  field.undo();assert.equal(field.bassMove,BASS_BAND);
  assert.equal(field.history.length,0);
  assert.equal(field.requestId,field._candidate({x:0,y:0},false,null,BASS_BAND).id);
});

test('Original toggles the whole session, bass included, and back',()=>{
  const {field}=bassSession('reggae-v1');
  field.request({x:0,y:.5});field.selectSound('sampled_steel_drums_v1');field.setWheel('bass');field.selectBass('chill-light');
  const changed=field.requestId;
  field.toggleOriginal();
  assert.deepEqual([field.position,field.soundPatch,field.bassMove],[{x:0,y:0},null,BASS_BAND]);
  assert.equal(field.requestId,field._candidate({x:0,y:0},false,null,BASS_BAND).id);
  field.toggleOriginal();
  assert.equal(field.bassMove,'chill-light');assert.equal(field.soundPatch,'sampled_steel_drums_v1');
  assert.equal(field.requestId,changed);
});

test('Keep before anything is heard saves the opening bass, never the requested one',()=>{
  const {field,scheduler}=bassSession('soul-v1');field.setWheel('bass');
  field.selectBass('funky-big');
  assert.equal(field.realizedId,null);
  const heard=heardMelodyCandidate(field,scheduler);
  assert.equal(heard.bassMove,BASS_BAND,'the fallback is the session as it opened');
  assert.deepEqual(bassOf(heard.song.events).map(music),bandBass(field.source.events).map(music));
  assert.equal(field.bassSave(heard),null,'a live band bass never moved needs no record');
  // While playing and not yet joined, Keep says it keeps the original.
  const parts=mountLight(field);field.paint();
  assert.equal(parts.keep.textContent,'Keep original');
});

test('Keep saves the heard bass while a newer one waits; its record holds the band original bass',()=>{
  const {field,scheduler,score}=bassSession('soul-v1');field.setWheel('bass');
  field.selectBass('funky-full');hear(field,scheduler);
  field.selectBass('deep-big');
  const heard=heardMelodyCandidate(field,scheduler);
  assert.equal(heard.bassMove,'funky-full');
  const parts=mountLight(field);field.paint();
  assert.equal(parts.keep.textContent,'Keep last heard');
  assert.match(parts.status.textContent,/^Playing: Funky bass\. It is full\. Next: Deep bass\. It is big\. Long low notes\.$/);
  const save=field.bassSave(heard);
  assert.equal(save.bassWheel.move,'funky-full');assert.equal(save.bassWheel.generator,'bass-wheel-v1');
  assert.deepEqual(save.bassWheel.band.events.map(music),bandBass(score.song.events).map(music));
  for(const n of wheelBass(heard.song.events))assert.equal(save.bandBasis[n.id],n.velocity,'heard wheel notes keep their unsoftened level');
  assert.ok(!Object.keys(save.bandBasis).some(id=>id.includes(':deep:')),'only heard ids are saved');
});

// ---- Keep through the real play flow, then reopen as _resumeMelodyField does ----
function keepFlow(field,scheduler,doc,key='melody-field-keep') {
  const flow=Object.create(PlayFlow.prototype);flow.doc=structuredClone(doc);flow.melodyField=field;
  flow.app={scheduler,_announce(message){throw Error(message);}};
  for(const name of ['_pushUndo','_stopForScopeChange','_finishPartEdit','_reconcileRetainedPlaying','_compile'])flow[name]=()=>{};
  flow._go=stage=>{flow.stage=stage;};
  return flow._melodyFieldAction(key).then(()=>flow);
}
function reopen(doc) {
  const compiled=compileReturnSong(doc);
  const saved={...structuredClone(doc.capture_notes.melody_field.context),source:structuredClone(compiled)};
  const field=new MelodyFieldSession(compiled,{scheduler:fakeScheduler(),captureOrigin:0,root:doc.global_context.root_pc||0,sourceDoc:doc,phraseContext:saved});
  field.palette=buildMelodyPalette(saved);field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return field;
}

test('Keep, then reopen: the stored bass plays untouched until the bass moves, and the middle plays the band original',async()=>{
  const {field,scheduler,score}=bassSession('soul-v1');field.setWheel('bass');
  field.request({x:0,y:.5});field.selectBass('funky-big');hear(field,scheduler);
  const heard=heardMelodyCandidate(field,scheduler);
  const flow=await keepFlow(field,scheduler,score.doc);
  assert.equal(flow.stage,'keep');
  const context=flow.doc.capture_notes.melody_field.context;
  assert.equal(context.bassWheel.move,'funky-big');
  assert.deepEqual(context.bassWheel.band.events.map(music),bandBass(score.song.events).map(music),'the record holds the band original bass');
  const stored=bassOf(flow.doc.notes);
  assert.deepEqual(stored.map(n=>n.id),bassOf(heard.song.events).map(n=>n.id),'the heard score is saved');
  assert.deepEqual(savedBassWheel(flow.doc),context.bassWheel);

  const again=reopen(flow.doc);
  assert.equal(again.bassReason,null);
  assert.equal(again.bassCtx.bandSource,'saved');
  assert.equal(again.initialBassMove,'funky-big','the stored line opens as itself');
  const opening=again._candidate(again.position);
  assert.deepEqual(bassOf(opening.song.events).map(music),stored.map(music),'reopened: the stored bass, untouched');
  // A tune move never regenerates the stored bass.
  again.request({x:.7,y:.7});
  assert.deepEqual(bassOf(again._candidate(again.position).song.events).map(music),stored.map(music));
  // The middle is the band's original bass, not the kept line.
  again.setWheel('bass');again.selectBass(BASS_BAND);
  assert.deepEqual(bassOf(again._candidate(again.position).song.events).map(music),bandBass(score.song.events).map(music));
  // The kept move again over the kept tune reproduces the kept line.
  again.request({x:0,y:.5});again.selectBass('funky-big');
  assert.deepEqual(bassOf(again._candidate(again.position).song.events).map(music),stored.map(music));
  // Keep the middle: the record still holds the band original.
  again.selectBass(BASS_BAND);hear(again,again.scheduler);
  const second=await keepFlow(again,again.scheduler,flow.doc);
  assert.equal(second.doc.capture_notes.melody_field.context.bassWheel.move,BASS_BAND);
  assert.deepEqual(second.doc.capture_notes.melody_field.context.bassWheel.band.events.map(music),bandBass(score.song.events).map(music));
  assert.deepEqual(bandBass(second.doc.notes).map(music),bandBass(score.song.events).map(music),'the band bass is back in the song');
});

test('a Softer band Keep stores the heard bass softened once; reopening and Restore band bring its level back',async()=>{
  const {field,scheduler,score}=bassSession('house-v1');
  field.toggleBandBalance();field.setWheel('bass');field.selectBass('steady-full');hear(field,scheduler);
  const flow=await keepFlow(field,scheduler,score.doc);
  const context=flow.doc.capture_notes.melody_field.context;
  assert.equal(context.bandBalance,1);
  const line=wheelBass(flow.doc.notes);assert.ok(line.length);
  for(const n of line)assert.ok(Math.abs(n.velocity-context.bandBasis[n.id]*SOFT_BAND_FACTOR)<1e-9,`${n.id} stored once softened`);
  const again=reopen(flow.doc);
  assert.equal(again.bandBalance,true);
  assert.deepEqual(bassOf(again._candidate(again.position).song.events).map(music),bassOf(flow.doc.notes).map(music));
  again.toggleBandBalance();
  for(const n of wheelBass(again._candidate(again.position).song.events))assert.ok(Math.abs(n.velocity-context.bandBasis[n.id])<1e-9,'Restore band: full level, never softened twice');
});

test('a Keep that never moved the bass saves exactly as before the Bass wheel',async()=>{
  const {field,scheduler,score}=bassSession('house-v1');
  field.request({x:0,y:.5});hear(field,scheduler);
  const flow=await keepFlow(field,scheduler,score.doc);
  const context=flow.doc.capture_notes.melody_field.context;
  assert.equal(Object.hasOwn(context,'bassWheel'),false);
  assert.equal(Object.hasOwn(context,'bandBasis'),false);
  const again=reopen(flow.doc);
  assert.equal(again.bassCtx.bandSource,'live');assert.equal(again.initialBassMove,BASS_BAND);
  assert.deepEqual(bassOf(again._candidate(again.position).song.events).map(music),bassOf(flow.doc.notes).map(music));
});

test('after Back to jam with a kept bass, the next wheel session finds the band bass through the saved record',async()=>{
  const {field,scheduler,score}=bassSession('soul-v1');field.setWheel('bass');
  field.selectBass('walk-big');hear(field,scheduler);
  const flow=await keepFlow(field,scheduler,score.doc,'melody-field-back');
  assert.equal(flow.stage,'jam');
  const kept=flow.doc,record=savedBassWheel(kept);
  assert.equal(record.move,'walk-big');
  // A fresh capture of the jam now playing the kept line, as _enterMelodyField builds it.
  const compiled=compileReturnSong(kept),stepSec=15/compiled.bpm;
  compiled.events=compiled.events.map(e=>({...e,duration_steps:e.duration_steps??e.duration_sec/stepSec}));
  const captured=captureMelodyContext(compiled,{phraseContext:docPhraseContext(kept)});
  const withRecord={...captured,composerVersion:9,bassWheel:record};
  const next=bassSession('soul-v1',{context:withRecord,song:compiled,doc:kept}).field;
  assert.equal(next.bassReason,null);
  assert.equal(next.initialBassMove,'walk-big');
  next.setWheel('bass');next.selectBass(BASS_BAND);
  assert.deepEqual(bassOf(next._candidate(next.position).song.events).map(music),bandBass(score.song.events).map(music),'the middle is the band, not the kept line');
  // Without the record the kept line cannot stand in for the band: the wheel stays closed rather than guess.
  const without=bassSession('soul-v1',{context:{...captured,composerVersion:9},song:compiled,doc:kept}).field;
  assert.equal(without.bassReason,'band-bass-unknown');assert.equal(without.bassReady,false);
});

test('a played take with a bass move keeps the band record beside it',async()=>{
  const {field,scheduler,score}=bassSession('soul-v1');field.setWheel('bass');
  field.selectBass('bounce-full');hear(field,scheduler);field.selectBass(BASS_BAND);
  const save=field.bassSave(heardMelodyCandidate(field,scheduler),{played:true});
  assert.equal(save.bassWheel.move,'bounce-full');
  hear(field,scheduler);
  const back=field.bassSave(heardMelodyCandidate(field,scheduler),{played:true});
  assert.equal(back.bassWheel.move,BASS_BAND,'the take held a wheel bass earlier, so the record stays');
  assert.equal(field.bassSave(heardMelodyCandidate(field,scheduler)),null,'a plain Keep of the band bass needs none');
  assert.deepEqual(back.bassWheel.band.events.map(music),bandBass(score.song.events).map(music));
});

test('the Bass tab ends Hear tune clearly; tab changes never touch history, candidates or the request',()=>{
  const {field,scheduler}=bassSession('ska-v1');
  scheduler.spotlightRole='tune';
  const before={history:structuredClone(field.history),request:field.requestId,size:field.candidates.size,queued:scheduler.queued.length};
  field.setWheel('sound');assert.equal(scheduler.spotlightRole,'tune','the Sound wheel keeps it');
  field.setWheel('bass');assert.equal(scheduler.spotlightRole,null,'the bass is never dimmed on the Bass wheel');
  field.setWheel('tune');
  assert.deepEqual({history:field.history,request:field.requestId,size:field.candidates.size,queued:scheduler.queued.length},before);
  field.setSoundMode(true);assert.equal(field.wheel,'sound');field.setSoundMode(false);assert.equal(field.wheel,'tune');
  field.setWheel('bass');field.toggleExploration();assert.equal(field.exploring??null,null,'no Explore on the Bass wheel');
});

test('Keep readiness blocks while the bass plays on a stand-in voice',()=>{
  const {field,scheduler}=bassSession('house-v1');field.setWheel('bass');field.selectBass('deep-full');hear(field,scheduler);
  scheduler.loadingSession={state:'loading'};scheduler.lastStoppedLoadingState=null;scheduler.audioCtx.currentTime=1;
  assert.equal(melodyKeepReadiness(field,scheduler).ok,false);
  const parts=mountLight(field);field.paint();
  assert.equal(parts.keep.textContent,'Keep when ready');
  assert.match(parts.status.textContent,/^Playing: Deep bass\. It is full\. Long low notes\. Full sounds are on the way\.$/);
  scheduler.loadingSession={state:'live',liveAt:0};
  assert.equal(melodyKeepReadiness(field,scheduler).ok,true);
});

test('status names the heard bass and the next one',()=>{
  const {field,scheduler}=bassSession('rocksteady-v1');field.setWheel('bass');
  const parts=mountLight(field);
  field.paint();assert.equal(parts.status.textContent,'Next: Band bass. Your bass will join soon.');
  hear(field,scheduler);field.paint();assert.equal(parts.status.textContent,'Playing: Band bass.');
  field.selectBass('walk-light');assert.equal(parts.status.textContent,'Playing: Band bass. Next: Walk bass. It is light. Steps up and down.');
  hear(field,scheduler);field.paint();assert.equal(parts.status.textContent,'Playing: Walk bass. It is light. Steps up and down.');
  field.selectBass(BASS_BAND);hear(field,scheduler);field.paint();assert.equal(parts.status.textContent,'The band bass is back. Your tune stays.');
  scheduler.isPlaying=false;field.paint();assert.equal(parts.status.textContent,'Stopped. Press Play to hear this bass.');
  field.selectBass('funky-big');assert.equal(parts.status.textContent,'Stopped. Press Play to hear your next bass.');
  scheduler.isPlaying=true;scheduler.queueContinuousPartAudition=()=>({ok:false});
  field.selectBass('chill-full');
  assert.equal(parts.status.textContent,'That move did not play. Your bass stays. Stop, then play to try again.');
  assert.equal(field.bassMove,'funky-big','a failed move changes nothing');
});

/** Just the parts paint() writes words into. */
function mountLight(field) {
  const node=()=>({textContent:'',hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;}});
  const parts={status:node(),keep:node(),help:node(),original:node()};
  const map={'[data-mf-status]':parts.status,'[data-key="melody-field-keep"]':parts.keep,'[data-mf-keep-help]':parts.help,'[data-key="melody-field-original"]':parts.original};
  field.root={querySelector:sel=>map[sel]||null,querySelectorAll:()=>[]};
  return parts;
}
