// The melody screen asks a new choice to enter on the next beat; other auditions keep the bar line.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {MELODY_JOIN_STEPS} from '../../../static/ui/melody_field_session.js';

const song=id=>({song_id:'audition',bpm:100,swing:.5,total_steps:32,steps_per_bar:16,
 events:Array.from({length:32},(_,step)=>({id:`${id}-${step}`,role:'lead',step,start_sec:step*.15,
 duration_steps:1,duration_sec:.15,patch_id:'warm_keys',velocity:.7,provenance:'user_placed',
 concrete:{midi_pitch:60},performance:{version:1,offset_steps:0}}))});
function setup(){
 const s=new LookaheadScheduler();s.audioCtx={currentTime:0};
 s.ensureContext=()=>s.audioCtx;s.masterBus={fadeIn(){},dispose(){},piano:{stop(){}}};
 const previous=globalThis.window;globalThis.window={setInterval:()=>1,clearInterval(){}};
 try{s.beginPartAudition(song('A'),{sectionId:'m',requestId:'A'});s.start();}finally{globalThis.window=previous;}
 s._commitPartAuditionIfDue();return s;
}
const at=(s,step,time)=>{s.currentStep=step;s.nextStepAudioTime=time;s.audioCtx.currentTime=time-.05;s._commitPartAuditionIfDue();};

test('the melody screen joins on a beat',()=>assert.equal(MELODY_JOIN_STEPS,4));

test('with joinSteps 4 a choice enters at the next beat, not the next bar',()=>{
 const s=setup();s.audioCtx.currentTime=.1;
 assert.equal(s.queuePartAudition(song('B'),{sectionId:'m',requestId:'B',joinSteps:4}).ok,true);
 at(s,2,.3);assert.equal(s.getPartAuditionState().scheduledId,'A','not mid-beat');
 at(s,4,.6);assert.equal(s.getPartAuditionState().scheduledId,'B','enters on beat 2');
 assert.equal(s.compiledSong.events[0].id,'B-0');
});

test('without joinSteps the bar line still governs',()=>{
 const s=setup();s.audioCtx.currentTime=.1;
 s.queuePartAudition(song('B'),{sectionId:'m',requestId:'B'});
 at(s,4,.6);assert.equal(s.getPartAuditionState().scheduledId,'A');
 at(s,16,2.4);assert.equal(s.getPartAuditionState().scheduledId,'B');
});
