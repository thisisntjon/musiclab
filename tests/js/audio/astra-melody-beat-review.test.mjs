import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {melodyFieldPlaybackView} from '../../../static/js/audio/melody_field_view.js';

const opts=requestId=>({sectionId:'field',requestId});
const score=(id,steps=64)=>({song_id:'same-song',bpm:120,swing:.5,total_steps:steps,steps_per_bar:16,
 events:Array.from({length:steps},(_,step)=>({id:`${id}-${step}`,role:'lead',step,start_sec:step*.125,
 duration_sec:.08,duration_steps:.64,patch_id:'sampled_piano_v1',velocity:.6,
 concrete:{midi_pitch:60},provenance:'jam_generated',performance:{version:1,offset_steps:0}}))});
function setup(){
 const s=new LookaheadScheduler(),trace=[],calls={starts:0,stops:0,dispose:0};
 s.audioCtx={currentTime:0};s.ensureContext=()=>s.audioCtx;
 s.masterBus={fadeIn(){calls.starts++;},dispose(){calls.dispose++;},piano:{stop(){calls.stops++;},trigger(e,t){trace.push({id:e.id,time:t,duration:e.duration_sec});}}};
 s.setCompiledSong(score('A'));
 const prev=globalThis.window;globalThis.window={setInterval:()=>91,clearInterval(){}};
 try{s.start();}finally{globalThis.window=prev;}
 return {s,trace,calls};
}
function tick(s,time){s.audioCtx.currentTime=time;s._lookaheadTick();}
function advance(s,first,last){for(let i=first;i<=last;i++)tick(s,i*.125);}
function stop(s){const prev=globalThis.window;globalThis.window={clearInterval(){}};try{s.stop();}finally{globalThis.window=prev;}}

test('beat option leaves first handoff at bar; following latest request enters on beat and preserves live hold',()=>{
 const {s,trace,calls}=setup();tick(s,0);advance(s,1,5);
 const held={id:'jam-live-owned',patch_id:'sampled_piano_v1',duration_steps:40};s.liveNotes.set('own',held);
 s.queueContinuousPartAudition(score('B'),{...opts('B'),joinSteps:4});advance(s,6,12);
 assert.equal(s.partAudition,null);assert.equal(trace.some(e=>e.id.startsWith('B-')),false);
 advance(s,13,16);tick(s,2.05);
 assert.equal(s.getPartAuditionState().realizedId,'B');
 s.queueContinuousPartAudition(score('C'),{...opts('C'),joinSteps:4});
 s.queueContinuousPartAudition(score('D'),{...opts('D'),joinSteps:4});
 advance(s,17,20);
 assert.equal(trace.at(-1).id,'D-20');assert.equal(trace.some(e=>e.id.startsWith('C-')),false);
 assert.equal(s.getPartAuditionState().realizedId,'B');
 assert.equal(s.getPartAuditionState().scheduledId,'D');
 assert.equal(s.liveNotes.get('own'),held);assert.deepEqual(calls,{starts:1,stops:0,dispose:0});
 tick(s,2.55);assert.equal(s.getPartAuditionState().realizedId,'D');
});

test('Stop after beat submission before realization keeps prior score and clears pending',()=>{
 const {s}=setup();tick(s,0);s.queueContinuousPartAudition(score('B'),{...opts('B'),joinSteps:4});
 advance(s,1,16);tick(s,2.05);
 s.queueContinuousPartAudition(score('C'),{...opts('C'),joinSteps:4});advance(s,17,20);
 assert.equal(s.getPartAuditionState().scheduledId,'C');assert.equal(s.getPartAuditionState().realizedId,'B');
 stop(s);assert.equal(s.compiledSong.events[0].id,'B-0');assert.equal(s.getPartAuditionState(),null);
});

test('reversal before next beat does not leave stale attack',()=>{
 const {s,trace}=setup();tick(s,0);s.queueContinuousPartAudition(score('B'),{...opts('B'),joinSteps:4});
 advance(s,1,16);tick(s,2.05);
 s.queueContinuousPartAudition(score('C'),{...opts('C'),joinSteps:4});
 s.queueContinuousPartAudition(score('B'),{...opts('B'),joinSteps:4});advance(s,17,20);
 assert.equal(trace.some(e=>e.id.startsWith('C-')),false);assert.equal(s.getPartAuditionState().pending,false);
 assert.equal(s.getPartAuditionState().scheduledId,'B');
});

test('invalid joinSteps cannot replace an existing initial handoff',()=>{
 const {s}=setup();tick(s,0);
 s.queueContinuousPartAudition(score('B'),{...opts('B'),joinSteps:4});
 const before=structuredClone({pending:s.pendingPartHandoff,state:s.getPartAuditionState(),song:s.compiledSong});
 for(const joinSteps of [0,-1,.5,NaN,Infinity,'4',false,{}]) {
   assert.equal(s.queueContinuousPartAudition(score('BAD'),{...opts('BAD'),joinSteps}).ok,false);
   assert.deepEqual({pending:s.pendingPartHandoff,state:s.getPartAuditionState(),song:s.compiledSong},before);
 }
});

test('invalid joinSteps leave scheduled and pending established audition unchanged through either queue API',()=>{
 const {s}=setup();tick(s,0);
 s.queueContinuousPartAudition(score('B'),{...opts('B'),joinSteps:4});advance(s,1,16);tick(s,2.05);
 s.queuePartAudition(score('C'),{...opts('C'),joinSteps:4});
 const before=structuredClone({audition:s.partAudition,state:s.getPartAuditionState(),song:s.compiledSong});
 for(const method of ['queueContinuousPartAudition','queuePartAudition'])for(const joinSteps of [0,-1,.5,NaN,Infinity,'4',false,{}]) {
   assert.equal(s[method](score('BAD'),{...opts('BAD'),joinSteps}).ok,false);
   assert.deepEqual({audition:s.partAudition,state:s.getPartAuditionState(),song:s.compiledSong},before);
 }
});


