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


test('sound choice changes generated tune only, keeps heard sound, and survives Keep/resume',async()=>{
  const {field,scheduler,flow,north,south}=fixture();
  for(const v of Object.values(field.palette))for(const e of v.notes)if(e.provenance==='generated')e.provenance='jam_generated';
  const personal=structuredClone(field.palette.original.notes[0]);
  const edited={...personal,id:'edited',provenance:'jam_generated',edited_from_generator:true};
  const backing={...personal,id:'bass',role:'bass',provenance:'jam_generated'};
  for(const v of Object.values(field.palette))v.notes.push(structuredClone(personal),structuredClone(backing),structuredClone(edited));
  field.candidates.clear();
  const first=field._candidate(north);field.realizedId=first.id;field.requestId=first.id;scheduler.state.realizedId=first.id;
  const snapshot=structuredClone(field.palette);
  field.selectSound('sampled_guitar_v1');
  const requested=field.candidates.get(field.requestId);
  assert.equal(requested.song.events[0].patch_id,'sampled_guitar_v1');
  assert.deepEqual(requested.song.events.slice(1),first.song.events.slice(1));
  assert.deepEqual(field.palette,snapshot);
  assert.equal(field.candidates.get(field.realizedId).song.events[0].patch_id,'sampled_piano_v1');
  scheduler.state.realizedId=field.requestId;field.paint();
  field.selectSound('sampled_organ_v1');
  await flow._melodyFieldAction('melody-field-keep');
  assert.equal(flow.doc.capture_notes.melody_field.context.melodySound,'sampled_guitar_v1');
  assert.equal(flow.doc.notes[0].patch_id,'sampled_guitar_v1');
  const reopened=JSON.parse(JSON.stringify(flow.doc));
  const resumed=new MelodyFieldSession({...field.source,events:reopened.notes},{scheduler,captureOrigin:0,sourceDoc:reopened,phraseContext:reopened.capture_notes.melody_field.context});
  resumed.palette=field.palette;resumed.candidates.clear();
  assert.equal(resumed._candidate(south).song.events[0].patch_id,'sampled_guitar_v1');
});

test('sound Original and Undo restore sound with tune; no personal-only rewrite',()=>{
  const {field,north}=fixture();
  for(const v of Object.values(field.palette))for(const e of v.notes)if(e.provenance==='generated')e.provenance='jam_generated';
  field.candidates.clear();field.requestId=field._candidate(north).id;
  field.selectSound('sampled_organ_v1');assert.equal(field.soundPatch,'sampled_organ_v1');
  field.toggleOriginal();assert.equal(field.soundPatch,null);
  field.toggleOriginal();assert.equal(field.soundPatch,'sampled_organ_v1');
  field.undo();assert.equal(field.soundPatch,null);
  field.request({x:0,y:0});
  field.selectSound('sampled_guitar_v1');
  assert.equal(field.soundPatch,null);
  assert.match(field.requestError,/Your notes keep their sound/);
});


function guideFixture(){
 const f=fixture();
 const bass={id:'band',role:'bass',step:0,duration_steps:4,velocity:.7,patch_id:'sampled_bass_v1',provenance:'jam_generated',concrete:{midi_pitch:48}};
 for(const v of Object.values(f.field.palette))v.notes.push(bass);f.field.bandBasis={band:.7};
 f.field.candidates.clear();
 const c=f.field._candidate(f.north);f.field.requestId=c.id;f.field.realizedId=c.id;f.scheduler.state.realizedId=c.id;
 return f;
}
test('Show me requires heard context and a genuine backing change',()=>{
 const {field}=fixture();assert.equal(field.startGuide(),false);assert.match(field.requestError,/no band notes/);
 const f=guideFixture();f.field.request(f.south);assert.equal(f.field.startGuide(),false);
});
test('Show me accepts heard mix only, adds one Undo and preserves source',()=>{
 const {field,scheduler,north,south}=guideFixture();const original=structuredClone(field.sourceDoc);
 assert.equal(field.startGuide(),true);assert.equal(field.finishGuide(true),false);
 assert.equal(field.request(south),false);assert.deepEqual(field.position,north);
 scheduler.state.realizedId=field.requestId;field.paint();
 assert.equal(field.finishGuide(true),true);assert.equal(field.history.length,1);assert.equal(field.bandBalance,true);
 field.undo();assert.equal(field.bandBalance,false);assert.deepEqual(field.sourceDoc,original);
});
test('Put back waits for actual restoration; Stop does not accept preview',async()=>{
 const {field,scheduler,flow}=guideFixture();
 field.startGuide();scheduler.state.realizedId=field.requestId;field.paint();
 const doc=structuredClone(flow.doc);await flow._melodyFieldAction('melody-field-keep');assert.deepEqual(flow.doc,doc);
 scheduler.stop();assert.equal(field.finishGuide(false),true);assert.equal(field.guide.restoring,true);
 assert.equal(field.finishGuide(true),false);
 scheduler.isPlaying=true;Object.assign(scheduler.state,{realizedId:field.requestId,scheduledId:field.requestId,pending:false,scheduledTime:0});field.paint();
 assert.equal(field.guide,null);assert.equal(field.history.length,0);assert.equal(field.bandBalance,false);
});
test('failed guide request or failed restoration leaves recoverable state',()=>{
 const {field,scheduler}=guideFixture();
 scheduler.queueContinuousPartAudition=()=>({ok:false});
 assert.equal(field.startGuide(),false);assert.equal(field.guide,undefined);assert.equal(field.bandBalance,false);
 scheduler.queueContinuousPartAudition=()=>({ok:true});field.startGuide();
 scheduler.state.realizedId=field.requestId;field.paint();
 scheduler.queueContinuousPartAudition=()=>({ok:false});
 assert.equal(field.finishGuide(false),false);assert.ok(field.guide);assert.equal(field.bandBalance,true);
});

test('Show me cannot use original fallback as proof it played',()=>{
 const {field,scheduler}=guideFixture();
 field.realizedId=null;scheduler.state.realizedId=null;field.position={x:0,y:0};field.requestId=field._candidate(field.position).id;
 assert.equal(field.startGuide(),false);
});
test('Put back stays unresolved while an intervening preview is already scheduled',()=>{
 const {field,scheduler}=guideFixture();const old=field.requestId;
 field.startGuide();const preview=field.requestId;
 Object.assign(scheduler.state,{realizedId:old,scheduledId:preview,pending:false,scheduledTime:2});
 field.finishGuide(false);assert.ok(field.guide);
 Object.assign(scheduler.state,{realizedId:old,scheduledId:old,pending:false,scheduledTime:3});field.paint();assert.ok(field.guide);
 scheduler.audioCtx.currentTime=3;field.paint();assert.equal(field.guide,null);
});
