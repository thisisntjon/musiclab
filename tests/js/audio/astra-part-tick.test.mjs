import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';

const opts=requestId=>({sectionId:'p',requestId});
const song=id=>({song_id:'s',bpm:120,swing:.5,total_steps:32,steps_per_bar:16,
 events:[0,15,16,31].map(step=>({id:step===15?'personal-hold':`${id}-${step}`,step,
 role:'lead',patch_id:'sampled_piano_v1',velocity:.7,duration_sec:step===15?1:.1,
 duration_steps:step===15?8:1,concrete:{midi_pitch:64},
 provenance:step===15?'user_placed':'jam_generated'}))});
function setup(){
 const s=new LookaheadScheduler(),trace=[];
 s.audioCtx={currentTime:0};s.ensureContext=()=>s.audioCtx;
 s.masterBus={fadeIn(){},dispose(){},piano:{stop(){},trigger(e,t){trace.push({id:e.id,time:t,duration:e.duration_sec});}}};
 const prev=globalThis.window;globalThis.window={setInterval:()=>1};
 try{s.beginPartAudition(song('A'),opts('A'));s.start();}finally{globalThis.window=prev;}
 for(const method of ['_commitJamBackingIfDue','_commitJamFormIfDue','_commitJamLeadIfDue',
 '_serviceAutomaticAnswer','_serviceJamAnswer','_applyLeadAnswer','_energyOrnaments'])
 s[method]=()=>{throw Error(`Jam leaked: ${method}`);};
 return {s,trace};
}
function tick(s,time){s.audioCtx.currentTime=time;s._lookaheadTick();}

test('real tick submits latest candidate, preserves crossing personal gate and loop phase',()=>{
 const {s,trace}=setup();const held={id:'live-held'};s.liveNotes.set('x',held);
 tick(s,0);s.queuePartAudition(song('B'),opts('B'));s.queuePartAudition(song('C'),opts('C'));
 for(let i=1;i<=16;i++)tick(s,i*.125);
 assert.deepEqual(trace.map(e=>e.id),['A-0','personal-hold','C-16']);
 assert.equal(trace[1].duration,1);assert.equal(s.liveNotes.get('x'),held);
 assert.equal(s.getPartAuditionState().realizedId,'A');
 tick(s,2.05);assert.equal(s.getPartAuditionState().realizedId,'C');
 for(let i=17;i<=32;i++)tick(s,i*.125);
 assert.equal(trace.at(-1).id,'C-0');assert.ok(Math.abs(trace.at(-1).time-4.04)<1e-9);
});

test('stall skips boundary without pretending pending candidate played',()=>{
 const {s,trace}=setup();tick(s,0);s.queuePartAudition(song('B'),opts('B'));
 tick(s,2.3);assert.equal(s.getPartAuditionState().scheduledId,'A');
 assert.ok(s.droppedSteps>=17);assert.deepEqual(trace.map(e=>e.id),['A-0']);
 for(let i=19;i<=32;i++)tick(s,i*.125);
 assert.equal(trace.at(-1).id,'B-0');assert.equal(s.getPartAuditionState().realizedId,'A');
});

test('cold stall has no realized candidate until first actually submitted step',()=>{
 const {s,trace}=setup();s.audioCtx.currentTime=2.32;
 assert.equal(s.getPartAuditionState().realizedId,null);
 s._lookaheadTick();assert.equal(s.getPartAuditionState().realizedId,null);
 assert.deepEqual(trace,[]);
 tick(s,2.45);assert.equal(s.getPartAuditionState().realizedId,'A');
});

test('clearing audition before submitted future boundary does not retain unheard candidate',()=>{
 const {s}=setup();tick(s,0);s.queuePartAudition(song('B'),opts('B'));
 for(let i=1;i<=16;i++)tick(s,i*.125);
 assert.equal(s.getPartAuditionState().realizedId,'A');
 s.clearPartAudition();
 assert.equal(s.compiledSong.events[0].id,'A-0');
});
