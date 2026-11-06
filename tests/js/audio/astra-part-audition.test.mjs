// Independent contract fixtures: queued part changes are not yet realized sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';

const song=id=>({song_id:'audition',bpm:100,swing:.5,total_steps:32,steps_per_bar:16,
 events:Array.from({length:32},(_,step)=>({id:`${id}-${step}`,role:'lead',step,start_sec:step*.15,
 duration_steps:2,duration_sec:.3,patch_id:'warm_keys',velocity:.7,provenance:'user_placed',
 concrete:{midi_pitch:60+(id.charCodeAt(0)-65)},performance:{version:1,offset_steps:0}}))});
const opts=requestId=>({sectionId:'part-a',requestId});
function setup(commit=true){
 const s=new LookaheadScheduler();s.audioCtx={currentTime:0};
 s.ensureContext=()=>s.audioCtx;s.masterBus={fadeIn(){},dispose(){},piano:{stop(){}}};
 const previous=globalThis.window;
 globalThis.window={setInterval:()=>123,clearInterval(){}};
 try{s.beginPartAudition(song('A'),opts('A'));s.start();}
 finally{globalThis.window=previous;}
 if(commit)s._commitPartAuditionIfDue();
 return s;
}
function at(s,step,time,now=time-.05){s.currentStep=step;s.nextStepAudioTime=time;s.audioCtx.currentTime=now;s._commitPartAuditionIfDue();}
function stop(s){const previous=globalThis.window;globalThis.window={clearInterval(){}};try{s.stop();}finally{globalThis.window=previous;}}

test('cold start cannot claim a realized candidate before the first scheduled step',()=>{
 const s=setup(false);s.audioCtx.currentTime=3;
 assert.equal(s.getPartAuditionState().realizedId,null);
 at(s,21,3.19,3.14);assert.equal(s.getPartAuditionState().realizedId,null);
 s.audioCtx.currentTime=3.191;assert.equal(s.getPartAuditionState().realizedId,'A');
});

test('part audition distinguishes scheduling from audio-clock realization',()=>{
 const s=setup();assert.equal(s.getPartAuditionState().realizedId,null);
 s.audioCtx.currentTime=.041;assert.equal(s.getPartAuditionState().realizedId,'A');
 assert.equal(s.queuePartAudition(song('B'),opts('B')).ok,true);
 at(s,8,1.24);assert.equal(s.getPartAuditionState().scheduledId,'A');
 at(s,16,2.44);assert.equal(s.getPartAuditionState().scheduledId,'B');
 assert.equal(s.getPartAuditionState().realizedId,'A');
 s.audioCtx.currentTime=2.441;assert.equal(s.getPartAuditionState().realizedId,'B');
});
test('latest request replaces pending; scheduled reversal cannot cancel an already submitted boundary',()=>{
 const s=setup();s.audioCtx.currentTime=.1;
 s.queuePartAudition(song('B'),opts('B'));s.queuePartAudition(song('C'),opts('C'));
 at(s,16,2.44);assert.equal(s.compiledSong.events[0].id,'C-0');
 s.queuePartAudition(song('A'),opts('A'));
 assert.equal(s.getPartAuditionState().scheduledId,'C');
 s.audioCtx.currentTime=2.45;assert.equal(s.getPartAuditionState().realizedId,'C');
 at(s,0,4.84);assert.equal(s.getPartAuditionState().scheduledId,'A');
});
test('pending scores are detached and pre-boundary reversal cancels without touching held notes',()=>{
 const s=setup(),held={id:'my-hold'};s.liveNotes.set('held',held);s.audioCtx.currentTime=.1;
 const b=song('B');s.queuePartAudition(b,opts('B'));b.events[0].id='mutated';
 at(s,16,2.44);assert.equal(s.compiledSong.events[0].id,'B-0');assert.equal(s.liveNotes.get('held'),held);
 s.queuePartAudition(song('C'),opts('C'));s.queuePartAudition(song('B'),opts('B'));
 assert.ok(!s.getPartAuditionState().pending);assert.equal(s.liveNotes.get('held'),held);
});
test('incompatible section or timing leaves score and queue unchanged',()=>{
 const s=setup();s.audioCtx.currentTime=.1;s.queuePartAudition(song('B'),opts('B'));
 const state=structuredClone(s.getPartAuditionState()),score=structuredClone(s.compiledSong);
 for(const [d,o] of [[{...song('C'),bpm:120},opts('C')],[{...song('C'),steps_per_bar:12},opts('C')],
  [{...song('C'),total_steps:64},opts('C')],[song('C'),{...opts('C'),sectionId:'other'}]]){
  assert.equal(s.queuePartAudition(d,o).ok,false);assert.deepEqual(s.getPartAuditionState(),state);assert.deepEqual(s.compiledSong,score);
 }
});
test('Stop before scheduled boundary restores last realized candidate and clears pending mode',()=>{
 const s=setup();s.audioCtx.currentTime=.1;s.queuePartAudition(song('B'),opts('B'));at(s,16,2.44);
 stop(s);assert.equal(s.compiledSong.events[0].id,'A-0');assert.equal(s.isPlaying,false);
 assert.equal(s.queuePartAudition(song('C'),opts('C')).ok,false);
});
test('Stop retains realized B instead of either initial A or pending C',()=>{
 const s=setup();s.audioCtx.currentTime=.1;s.queuePartAudition(song('B'),opts('B'));at(s,16,2.44);
 s.audioCtx.currentTime=2.45;s.queuePartAudition(song('C'),opts('C'));stop(s);
 assert.equal(s.compiledSong.events[0].id,'B-0');assert.equal(s.getPartAuditionState(),null);
});
test('seek, loop scope change and ordinary compilation invalidate pending audition',()=>{
 for(const invalidate of [s=>s.seekToStep(4),s=>s.setLoopRange(0,16),s=>s.setCompiledSong(song('C'))]){
  const s=setup();s.audioCtx.currentTime=.1;s.queuePartAudition(song('B'),opts('B'));invalidate(s);
  assert.equal(s.getPartAuditionState(),null);assert.equal(s.queuePartAudition(song('B'),opts('B')).ok,false);
 }
});
