import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession,melodyKeepReadiness} from '../../../static/ui/melody_field_session.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

// Exercise the actual painter and Keep/Refine handler together. Audio advancement
// is explicit in this fixture: requesting a score never pretends it was heard.
function fixture({heard=true, playing=true}={}) {
  const own={id:'personal',role:'lead',step:1,performance:{version:1,offset_steps:.273},duration_steps:21.271,
    velocity:.6,patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:60}};
  const sourceDoc={id:'heard-preview',global_context:{bpm:100,bars:4,root_pc:0},notes:[own],arrangement_mode:'loop'};
  const song={song_id:sourceDoc.id,bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:[own]};
  const scheduler={isPlaying:playing,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,
    getPartAuditionState(){return this.isPlaying?this.state:null;},
    queueContinuousPartAudition(_song,{requestId}){this.state.requestedId=requestId;return {ok:true};},
    stop(){this.lastPartAuditionState={...this.state};this.isPlaying=false;this.stopGeneration++;},
    capturePerformance(){return null;},markPerformanceKept(){}};
  const field=new MelodyFieldSession(song,{scheduler,captureOrigin:0,sourceDoc,
    phraseContext:{version:1,composerVersion:7,root:0}});
  const north={x:0,y:.5},south={x:0,y:-.75};
  const note=(id,pitch)=>({...own,id,provenance:'generated',concrete:{midi_pitch:pitch}});
  field.palette={original:{notes:[own]},[field.chooseMelody(north).key]:{notes:[note('heard',64)]},
    [field.chooseMelody(south).key]:{notes:[note('unheard',67)]}};
  field.candidates.clear();
  const original=field._candidate({x:0,y:0}),a=field._candidate(north);
  field.position=heard?north:{x:0,y:0};field.requestId=heard?a.id:original.id;
  field.realizedId=heard?a.id:null;field.hasPlayed=heard;
  scheduler.state={sectionId:field.sectionId,realizedId:field.realizedId,requestedId:field.requestId};
  scheduler.lastPartAuditionState={...scheduler.state};
  const nodes=new Map();field.root={querySelector(selector){
    if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',style:{},dataset:{},
      setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];}});
    return nodes.get(selector);
  },querySelectorAll(){return [];}};
  const flow=Object.create(PlayFlow.prototype);flow.doc=structuredClone(sourceDoc);flow.melodyField=field;
  flow.app={scheduler,_announce(message){throw Error(message);}};
  for(const name of ['_pushUndo','_stopForScopeChange','_finishPartEdit','_reconcileRetainedPlaying','_compile'])flow[name]=()=>{};
  flow._go=stage=>{flow.stage=stage;};
  const mainIds=()=>[...nodes.get('[data-mf-score]').innerHTML.matchAll(/data-vis-note="([^"]+)"/g)].map(m=>m[1]);
  return {field,scheduler,flow,nodes,north,south,mainIds};
}

for(const heard of [true,false])for(const action of ['melody-field-keep','melody-field-refine']) {
  test(`stopped pending ${action} shows exactly what it retains; heard=${heard}`,async()=>{
    const {field,flow,nodes,north,south,mainIds}=fixture({heard});
    for(const p of [south,north,south])field.request(p);
    await flow._melodyFieldAction('melody-field-play'); // Stop through the real handler.
    const shown=mainIds();
    assert.deepEqual(shown,[heard?'heard':'personal']);
    assert.match(nodes.get('[data-mf-score]').innerHTML,/data-vis-preview="requested"/);
    assert.equal(nodes.get('[data-key="melody-field-keep"]').textContent,heard?'Keep last heard':'Keep original');
    assert.equal(nodes.get('[data-key="melody-field-refine"]').textContent,heard?'Refine last heard':'Refine original');
    assert.match(nodes.get('[data-mf-keep-help]').textContent,/Play this choice first/);
    assert.match(nodes.get('[data-mf-status]').textContent,/Stopped/);
    await flow._melodyFieldAction(action);
    assert.deepEqual(flow.doc.notes.map(n=>n.id),shown);
    assert.equal(flow.doc.melody_original.notes[0].duration_steps,21.271);
    assert.equal(flow.doc.melody_original.notes[0].performance.offset_steps,.273);
    assert.equal(flow.doc.melody_original.notes[0].provenance,'user_placed');
  });
}

test('settled choice, reversal and later audible realization update the main score honestly',()=>{
  const {field,scheduler,nodes,north,south,mainIds}=fixture();
  field.request(south);
  assert.deepEqual(mainIds(),['heard']);
  field.request(north);
  assert.equal(nodes.get('[data-key="melody-field-keep"]').textContent,'Keep this melody');
  assert.doesNotMatch(nodes.get('[data-mf-score]').innerHTML,/data-vis-preview="requested"/);
  field.request(south);
  scheduler.state.realizedId=field.requestId;field.paint();
  assert.deepEqual(mainIds(),['unheard']);
  assert.equal(nodes.get('[data-key="melody-field-keep"]').textContent,'Keep this melody');
  assert.doesNotMatch(nodes.get('[data-mf-score]').innerHTML,/data-vis-preview="requested"/);
});

test('moving and choosing a softer band while stopped never changes the kept original or starts audio',async()=>{
  const {field,scheduler,flow,nodes,south,mainIds}=fixture({heard:false,playing:false});
  scheduler.queueContinuousPartAudition=()=>{throw Error('must not start or schedule');};
  field.request(south);field.toggleBandBalance();
  assert.deepEqual(mainIds(),['personal']);
  assert.equal(nodes.get('[data-key="melody-field-keep"]').textContent,'Keep original');
  await flow._melodyFieldAction('melody-field-keep');
  assert.equal(flow.doc.notes[0].concrete.midi_pitch,60);
  assert.equal(flow.doc.capture_notes.melody_field.context.bandBalance??0,0);
});

for(const action of ['melody-field-keep','melody-field-refine','melody-field-back']) {
  test(`restart gap retains the heard score in the picture and ${action}`,async()=>{
    const {field,scheduler,flow,mainIds,south}=fixture();
    field.request(south);scheduler.stop();
    // beginPartAudition starts a new scheduler state before its first attack.
    scheduler.isPlaying=true;scheduler.lastPartAuditionState=null;
    scheduler.state={sectionId:field.sectionId,realizedId:null,requestedId:field.requestId};
    field.paint();assert.deepEqual(mainIds(),['heard']);
    await flow._melodyFieldAction(action);
    assert.equal(flow.doc.notes[0].id,'heard');
    assert.equal(flow.doc.notes[0].concrete.midi_pitch,64);
  });
}

test('another section cannot replace this session\'s last heard score',async()=>{
  const {field,scheduler,flow,mainIds,south}=fixture();
  field.request(south);
  scheduler.state={sectionId:'other-session',realizedId:field.requestId};
  field.paint();assert.deepEqual(mainIds(),['heard']);
  await flow._melodyFieldAction('melody-field-keep');
  assert.equal(flow.doc.notes[0].id,'heard');
});

for(const action of ['melody-field-keep','melody-field-refine','melody-field-back']) {
  test(`loading sounds cannot silently change the saved voice through ${action}`,async()=>{
    const {field,scheduler,flow,nodes}=fixture();
    scheduler.loadingSession={state:'loading'};
    const before=structuredClone(flow.doc),announcements=[];
    flow.app._announce=m=>announcements.push(m);
    field.paint();
    assert.match(nodes.get('[data-mf-keep-help]').textContent,/still loading/);
    assert.equal(nodes.get('[data-key="melody-field-keep"]').textContent,'Keep when ready');
    assert.equal(nodes.get('.pf-melody-keep-more').open,true);
    await flow._melodyFieldAction(action);
    assert.deepEqual(flow.doc,before);assert.equal(flow.melodyField,field);
    assert.match(announcements[0],/Save played take/);
    scheduler.loadingSession={state:'live',liveAt:1.1};
    assert.equal(melodyKeepReadiness(field).ok,false,'lookahead is not heard');
    scheduler.audioCtx.currentTime=1.1;
    assert.equal(melodyKeepReadiness(field).ok,true);
    field.paint();assert.equal(nodes.get('[data-key="melody-field-keep"]').textContent,'Keep this melody');
    await flow._melodyFieldAction(action);
    assert.equal(flow.doc.notes[0].id,'heard');
  });
}

test('Stop freezes loading readiness; waiting or a late bank completion never unlocks unheard samples',()=>{
  const {field,scheduler}=fixture();
  scheduler.isPlaying=false;
  scheduler.lastStoppedLoadingState={state:'live',liveAt:1.1,cutoff:1};
  scheduler.audioCtx.currentTime=100;
  assert.equal(melodyKeepReadiness(field).ok,false);
  scheduler.lastStoppedLoadingState={state:'failed',cutoff:1};
  assert.equal(melodyKeepReadiness(field).ok,false);
  scheduler.lastStoppedLoadingState={state:'live',liveAt:.9,cutoff:1};
  assert.equal(melodyKeepReadiness(field).ok,true);
  field.hasPlayed=false; // A reopened save has no new loading audition to preserve.
  scheduler.lastStoppedLoadingState={state:'loading',cutoff:1};
  assert.equal(melodyKeepReadiness(field).ok,true);
});

test('preloaded restart requires an actual realization in this melody section',()=>{
  const {field,scheduler}=fixture();
  scheduler.lastStoppedLoadingState={state:'loading',cutoff:1};
  scheduler.loadingSession=null;scheduler.isPlaying=true;scheduler.audioCtx.currentTime=100;
  scheduler.state.realizedId=null;
  assert.equal(melodyKeepReadiness(field).ok,false);
  scheduler.state={sectionId:'other-section',realizedId:'old-choice'};
  assert.equal(melodyKeepReadiness(field).ok,false);
  scheduler.state={sectionId:field.sectionId,realizedId:field.requestId};
  assert.equal(melodyKeepReadiness(field).ok,true);
});
