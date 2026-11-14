// Bass moves join at the half bar and never under a still-sounding bass note of the outgoing score
// (bass wheel attack fix 1). The part audition never cuts a sounding voice, so the scheduler must either end
// outgoing generated bass notes at the coming join or wait for the next join where none is still sounding.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {bassJoinPlan,bassContext,bassCandidateEvents,BASS_JOIN_STEPS} from '../../../static/js/theory/bass_wheel.js';
import {melodyFieldPlaybackView} from '../../../static/js/audio/melody_field_view.js';
import {isSampledPatch} from '../../../static/js/audio/sampled_piano.js';
import {jamScore} from '../theory/bass-wheel-fixtures.mjs';

const BPM=100,STEP=15/BPM;
const note=(id,step,duration,{role='bass',provenance='jam_generated',generated_by='musiclab_jam',pitch=36}={})=>({id,role,step,
  duration_steps:duration,duration_sec:duration*STEP,start_sec:step*STEP,patch_id:role==='bass'?'sampled_bass_v1':'sampled_piano_v1',
  velocity:.4,provenance,generated_by,concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},performance:{version:1,offset_steps:0}});
// A Soul-like band bass: its note at step 7 rings 2 steps, across the half-bar line at 8.
const band=()=>[note('band-0',0,5),note('band-7',7,2,{pitch:43}),note('band-10',10,3,{pitch:40}),note('band-16',16,5),note('band-23',23,2,{pitch:43})];
const line=tag=>[0,4,8,12,16,20,24,28].map(s=>note(`${tag}-${s}`,s,3.5,{generated_by:'musiclab_bass_wheel_v1',pitch:38}));
const tune=tag=>[2,6,10,14,18,22,26,30].map(s=>note(`${tag}-lead-${s}`,s,1,{role:'lead',generated_by:'musiclab_phrase_composer_v9',pitch:72}));
const song=events=>({song_id:'s',bpm:BPM,swing:.5,total_steps:32,steps_per_bar:16,events});

function setup(first) {
  const s=new LookaheadScheduler(),trace=[];
  s.audioCtx={currentTime:0};s.ensureContext=()=>s.audioCtx;
  s.masterBus={fadeIn(){},dispose(){},piano:{stop(){},trigger(e,t){trace.push({id:e.id,time:t,duration:e.duration_sec,role:e.role});}}};
  const prev=globalThis.window;globalThis.window={setInterval:()=>1,clearInterval(){}};
  try{s.beginPartAudition(first,{sectionId:'m',requestId:'A'});s.start();}finally{globalThis.window=prev;}
  for(const method of ['_commitJamBackingIfDue','_commitJamFormIfDue','_commitJamLeadIfDue','_serviceAutomaticAnswer','_serviceJamAnswer'])
    s[method]=()=>{throw Error(`Jam leaked: ${method}`);};
  return {s,trace};
}
// Step times are measured from the scheduler's grid origin. runTo advances the audio clock until the lookahead
// has scheduled up to (not including) that step.
const at=(s,step)=>s.gridOriginTime+step*STEP;
const runTo=(s,step)=>{for(let t=s.audioCtx.currentTime;t<=at(s,step)-.1-1e-9;t+=STEP/4){s.audioCtx.currentTime=t;s._lookaheadTick();}};
// Bass notes whose voice is still on at a step's time (attack before it, end after it).
const sounding=(s,trace,step)=>trace.filter(e=>e.role==='bass'&&e.time<at(s,step)-1e-9&&e.time+e.duration>at(s,step)+1e-9);
const commitStep=s=>Math.round((s.partAudition.timeline.at(-1).audioTime-s.gridOriginTime)/STEP);

test('a bass-safe request ends outgoing generated bass notes at the coming half-bar join',()=>{
  const {s,trace}=setup(song([...band(),...tune('A')]));
  runTo(s,3);
  assert.equal(s.queuePartAudition(song([...line('B'),...tune('A')]),{sectionId:'m',requestId:'B',joinSteps:8,bassSafe:true}).ok,true);
  runTo(s,10);
  assert.equal(s.getPartAuditionState().scheduledId,'B');
  assert.equal(commitStep(s),8,'joins at the half bar');
  const seven=trace.find(e=>e.id==='band-7');
  assert.ok(seven.time+seven.duration<=at(s,8)-.1*STEP+1e-9,'the outgoing note ends .1 step before the join');
  assert.deepEqual(sounding(s,trace,8),[],'nothing of the old bass rings under the new line');
  assert.ok(trace.some(e=>e.id==='B-8'));
});

test('a bass-safe request made after a crossing note started waits for the next join with nothing sounding',()=>{
  const {s,trace}=setup(song([...band(),...tune('A')]));
  runTo(s,7.6);
  assert.ok(trace.some(e=>e.id==='band-7'),'the crossing note has already started');
  s.queuePartAudition(song([...line('B'),...tune('A')]),{sectionId:'m',requestId:'B',joinSteps:8,bassSafe:true});
  runTo(s,10);
  assert.equal(s.getPartAuditionState().scheduledId,'A','no join at 8 while band-7 still sounds');
  runTo(s,18);
  assert.equal(s.getPartAuditionState().scheduledId,'B');
  assert.equal(commitStep(s),16);
  assert.deepEqual(sounding(s,trace,16),[],'clean join at 16');
  assert.equal(trace.find(e=>e.id==='band-7').duration,2*STEP,'a voice already sounding is never cut');
});

test('without bassSafe the half-bar join keeps the old behaviour (a ringing note overlaps the new line)',()=>{
  const {s,trace}=setup(song([...band(),...tune('A')]));
  runTo(s,7.6);
  s.queuePartAudition(song([...line('B'),...tune('A')]),{sectionId:'m',requestId:'B',joinSteps:8});
  runTo(s,10);
  assert.equal(commitStep(s),8);
  assert.equal(sounding(s,trace,8).length>0,true,'negative control: the overlap the bass-safe join prevents');
});

test('personal bass is never shortened and never holds a bass-safe join back',()=>{
  const own=note('own-6',6,6,{provenance:'user_placed',generated_by:undefined,pitch:48});
  const {s,trace}=setup(song([note('band-0',0,5),own,...tune('A')]));
  runTo(s,3);
  s.queuePartAudition(song([own,...line('B').filter(n=>n.step>=12||n.step<6),...tune('A')]),{sectionId:'m',requestId:'B',joinSteps:8,bassSafe:true});
  runTo(s,10);
  assert.equal(commitStep(s),8);
  assert.equal(trace.find(e=>e.id==='own-6').duration,6*STEP);
});

test('join plans compare with the scheduled score: a bass move then a tune move in one half bar still joins at the half bar',()=>{
  const A=song([...band(),...tune('A')]),B=song([...line('B'),...tune('A')]),C=song([...line('B'),...tune('C')]);
  const {s,trace}=setup(A);
  runTo(s,1);
  const bassMove=bassJoinPlan(A.events,B.events);
  assert.deepEqual([bassMove.bassChanged,bassMove.joinSteps,bassMove.bassSafe],[true,BASS_JOIN_STEPS,true]);
  s.queuePartAudition(B,{sectionId:'m',requestId:'B',joinSteps:bassMove.joinSteps,bassSafe:bassMove.bassSafe});
  runTo(s,2);
  // The tune move arrives before B has joined. Against the requested score its bass looks unchanged (a beat
  // join); against the scheduled score (still A) the bass changes, so the join stays bass-safe at the half bar.
  assert.equal(bassJoinPlan(B.events,C.events).joinSteps,4,'negative control: comparing with the request');
  const scheduled=s.getPartAuditionState().scheduledId==='A'?A:B;
  const tuneMove=bassJoinPlan(scheduled.events,C.events);
  assert.deepEqual([tuneMove.joinSteps,tuneMove.bassSafe],[8,true]);
  s.queuePartAudition(C,{sectionId:'m',requestId:'C',joinSteps:tuneMove.joinSteps,bassSafe:tuneMove.bassSafe});
  runTo(s,6);
  assert.equal(s.getPartAuditionState().scheduledId,'A','no beat join at 4');
  runTo(s,10);
  assert.equal(s.getPartAuditionState().scheduledId,'C');
  assert.equal(commitStep(s),8);
  assert.deepEqual(sounding(s,trace,8),[]);
});

test("bassSafe 'auto': the scheduler compares each request's bass with the score it has scheduled",()=>{
  const A=song([...band(),...tune('A')]),B=song([...line('B'),...tune('A')]),C=song([...line('B'),...tune('C')]),D=song([...band(),...tune('C')]);
  // A bass move, then a tune move and then Undo of the bass in the same half bar: every request asks for a beat join.
  for(const [later,expectId] of [[C,'C'],[D,'D']]) {
    const {s,trace}=setup(A);
    runTo(s,1);
    s.queuePartAudition(B,{sectionId:'m',requestId:'B',joinSteps:4,bassSafe:'auto'});
    runTo(s,2);
    s.queuePartAudition(later,{sectionId:'m',requestId:expectId,joinSteps:4,bassSafe:'auto'});
    runTo(s,6);
    if(expectId==='C'){
      assert.equal(s.getPartAuditionState().scheduledId,'A','the bass still differs from the scheduled score: no beat join');
      runTo(s,10);assert.equal(commitStep(s),8);
    } else {
      // Undo brought the scheduled bass back: only the tune changes, so the beat join is right.
      assert.equal(s.getPartAuditionState().scheduledId,'D');assert.equal(commitStep(s),4);
    }
    assert.deepEqual(sounding(s,trace,commitStep(s)).filter(e=>!e.id.startsWith(expectId)&&!e.id.startsWith('band')),[]);
    assert.deepEqual(sounding(s,trace,commitStep(s)).filter(e=>expectId==='C'&&e.id.startsWith('band')),[]);
  }
  // An unchanged bass keeps the caller's beat join.
  const {s}=setup(A);runTo(s,1);
  s.queuePartAudition(D,{sectionId:'m',requestId:'D',joinSteps:4,bassSafe:'auto'});
  runTo(s,6);assert.equal(commitStep(s),4);
});

test('join plans: an unchanged bass keeps the beat join; outgoing crossings are reported',()=>{
  const A=[...band(),...tune('A')];
  assert.deepEqual(bassJoinPlan(A,[...band(),...tune('C')]),{bassChanged:false,joinSteps:4,bassSafe:false,crossings:[]});
  // Velocity alone (Softer band) is not a bass change: the same notes continue.
  assert.equal(bassJoinPlan(A,A.map(n=>n.role==='bass'?{...n,velocity:n.velocity*.45}:n)).bassChanged,false);
  const plan=bassJoinPlan(A,[...line('B'),...tune('A')]);
  assert.deepEqual(plan.crossings.map(c=>[c.id,c.step]),[['band-7',8],['band-23',24]]);
  assert.equal(bassJoinPlan(null,A).bassSafe,false);
});

// ---- The scheduled score and the requests: one line, two representations ----
// Play on the melody screen schedules the raw candidate; every later request sends melodyFieldPlaybackView of it, which
// recomputes each offset as precise - step. A line whose music is unchanged must not count as a changed bass.
function realScore(scene,move) {
  const {song,context}=jamScore(scene),ctx=bassContext(context);
  const sampled=events=>events.filter(n=>isSampledPatch(n.patch_id));
  return {song:{...song,events:sampled(bassCandidateEvents(ctx,move,song.events))},other:{...song,events:sampled(bassCandidateEvents(ctx,move==='walk-full'?'deep-full':'walk-full',song.events))}};
}
function realSetup(first) {
  const s=new LookaheadScheduler(),trace=[];
  s.audioCtx={currentTime:0};s.ensureContext=()=>s.audioCtx;
  s.masterBus={fadeIn(){},dispose(){},piano:{stop(){},trigger(e,t){trace.push({id:e.id,time:t,duration:e.duration_sec,role:e.role});}}};
  const prev=globalThis.window;globalThis.window={setInterval:()=>1,clearInterval(){}};
  try{s.beginPartAudition(first,{sectionId:'m',requestId:'A'});s.start();}finally{globalThis.window=prev;}
  return {s,trace};
}
const realStep=s=>15/s.compiledSong.bpm;
const realRunTo=(s,step)=>{const sec=realStep(s);for(let t=s.audioCtx.currentTime;t<=s.gridOriginTime+step*sec-.1-1e-9;t+=sec/4){s.audioCtx.currentTime=t;s._lookaheadTick();}};
const realCommit=s=>Math.round((s.partAudition.timeline.at(-1).audioTime-s.gridOriginTime)/realStep(s));
const tuneMoved=song=>({...song,events:song.events.map(n=>n.role==='lead'?{...n,concrete:{...n.concrete,midi_pitch:n.concrete.midi_pitch+2}}:n)});

for(const [scene,move] of [['swing-v1','bounce-full'],['swing-v1','deep-full'],['swing-v1','chill-full'],['house-v1','chill-full']])
  test(`after Play, a tune-only move over ${scene} ${move} keeps the beat join: the view's bass is the scheduled bass`,()=>{
    const {song}=realScore(scene,move);
    const {s}=realSetup(song);
    realRunTo(s,1);
    const view=melodyFieldPlaybackView(tuneMoved(song),s.gridOriginTime,s.gridOriginTime);
    // The representations really differ (offsets recomputed as precise - step), so exact floats would disagree.
    const offsets=e=>e.filter(n=>n.role==='bass').map(n=>n.performance.offset_steps);
    if(scene==='swing-v1'||move==='chill-full')assert.notDeepEqual(offsets(view.events),offsets(song.events),'control: the floats differ');
    assert.equal(s.queuePartAudition(view,{sectionId:'m',requestId:'B',joinSteps:4,bassSafe:'auto'}).ok,true);
    assert.equal(s.partAudition.pending.bassSafe,false,'an unchanged line is not a bass change');
    assert.equal(s.partAudition.joinSteps,4);
    realRunTo(s,6);
    assert.equal(s.getPartAuditionState().scheduledId,'B');assert.equal(realCommit(s),4);
  });

test('after Play, a real bass move sent as a view still joins bass-safe at the half bar',()=>{
  const {song,other}=realScore('swing-v1','bounce-full');
  const {s}=realSetup(song);
  realRunTo(s,1);
  s.queuePartAudition(melodyFieldPlaybackView(other,s.gridOriginTime,s.gridOriginTime),{sectionId:'m',requestId:'B',joinSteps:4,bassSafe:'auto'});
  assert.equal(s.partAudition.pending.bassSafe,true);assert.equal(s.partAudition.joinSteps,8);
  realRunTo(s,6);assert.equal(s.getPartAuditionState().scheduledId,'A','no beat join for a new line');
  realRunTo(s,10);assert.equal(realCommit(s),8);
});

// ---- First entry: the melody screen's first request hands the jam over at a bar line ----
// No admitted band's bass crosses a bar line today, but a first request can already carry a bass move (a way pressed
// before the first bar line), so the handoff is bass-safe like every later join.
const crossing=()=>[note('band-0',0,5),note('band-14',14,4,{pitch:43}),note('band-16',16,5),note('band-30',30,4,{pitch:43})];
function jamSetup(events) {
  const s=new LookaheadScheduler(),trace=[];
  s.audioCtx={currentTime:0};s.ensureContext=()=>s.audioCtx;
  s.masterBus={fadeIn(){},dispose(){},piano:{stop(){},trigger(e,t){trace.push({id:e.id,time:t,duration:e.duration_sec,role:e.role});}}};
  s.setCompiledSong(song(events));
  const prev=globalThis.window;globalThis.window={setInterval:()=>1,clearInterval(){}};
  try{s.start();}finally{globalThis.window=prev;}
  assert.equal(s.partAudition,null);assert.equal(s.isPlaying,true);
  return {s,trace};
}
const handoffStep=s=>Math.round((s.partAudition.timeline[0].audioTime-s.gridOriginTime)/STEP);

test('first entry with a changed bass: the jam bass ends before the bar line and the handoff never enters under it',()=>{
  const {s,trace}=jamSetup([...crossing(),...tune('A')]);
  runTo(s,3);
  assert.equal(s.queueContinuousPartAudition(song([...line('B'),...tune('A')]),{sectionId:'m',requestId:'B',joinSteps:4,bassSafe:'auto'}).ok,true);
  runTo(s,18);
  assert.ok(s.partAudition,'handed over');assert.equal(handoffStep(s),16);
  const last=trace.find(e=>e.id==='band-14');
  assert.ok(last.time+last.duration<=at(s,16)-.1*STEP+1e-9,'the jam note ends .1 step before the bar line');
  assert.deepEqual(sounding(s,trace,16),[]);
});

test('first entry asked after a crossing jam note started: the handoff waits a bar with nothing sounding',()=>{
  const {s,trace}=jamSetup([...crossing(),...tune('A')]);
  runTo(s,14.6);
  assert.ok(trace.some(e=>e.id==='band-14'));
  s.queueContinuousPartAudition(song([...line('B'),...tune('A')]),{sectionId:'m',requestId:'B',joinSteps:4,bassSafe:'auto'});
  runTo(s,18);
  assert.equal(s.partAudition,null,'no handoff at 16 while band-14 still sounds');
  runTo(s,34);
  assert.equal(handoffStep(s),32,'the next bar line (the loop start)');
  assert.deepEqual(sounding(s,trace,32),[]);
  assert.equal(trace.find(e=>e.id==='band-14').duration,4*STEP,'a voice already sounding is never cut');
});

test('first entry with the same bass keeps the old bar-line handoff and the jam notes whole; without bassSafe a changed bass overlaps',()=>{
  {
    const {s,trace}=jamSetup([...crossing(),...tune('A')]);
    runTo(s,3);
    s.queueContinuousPartAudition(song([...crossing(),...tune('C')]),{sectionId:'m',requestId:'C',joinSteps:4,bassSafe:'auto'});
    runTo(s,18);
    assert.equal(handoffStep(s),16);
    assert.equal(trace.find(e=>e.id==='band-14').duration,4*STEP,'the same bass rings on as it always did');
  }
  {
    const {s,trace}=jamSetup([...crossing(),...tune('A')]);
    runTo(s,3);
    s.queueContinuousPartAudition(song([...line('B'),...tune('A')]),{sectionId:'m',requestId:'B',joinSteps:4});
    runTo(s,18);
    assert.equal(handoffStep(s),16);
    assert.ok(sounding(s,trace,16).length>0,'negative control: the overlap the bass-safe handoff prevents');
  }
});
