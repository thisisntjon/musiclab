import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {planJamAnswer} from '../../../static/js/theory/jam_answer.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {stashWorkingSong,loadWorkingSong} from '../../../static/js/theory/save_store.js';
const personal=(id,time,duration,pitch=60,occurrence=1)=>({time,duration,occurrence,event:{
 source_note_id:`jam-live-${id}`,provenance:'user_placed',role:'lead',patch_id:'sampled_piano_v1',
 concrete:{freq_hz:440*2**((pitch-69)/12)},velocity:.85,duration_sec:duration}});
function setup(){
 const s=new LookaheadScheduler(),attacks=[];
 s.audioCtx={currentTime:2,state:'running'};
 s.masterBus={piano:{trigger(event,time){attacks.push({event:structuredClone(event),time});return{};},stop(){}},dispose(){}};
 s.compiledSong={song_id:'fixture',bpm:100,swing:.5,total_steps:64,events:[]};
 s.isPlaying=true;s.currentStep=14;s.nextStepAudioTime=2.14;
 s.performanceTake={start:0,bpm:100,steps_per_bar:16,sequence:2,events:[personal('a',.21,.25),personal('s',.59,.8114,64,2)]};
 return {s,attacks};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('exact echo snapshots only four recent released pitched occurrences, preserving source bytes',()=>{
 const records=[personal('old',-10,.3),...Array.from({length:5},(_,i)=>personal('n'+i,i*.2,.1,60+i,i+2)),personal('held',1.8,4),personal('future',3,.25)];
 const original=structuredClone(records),plan=planJamAnswer(records,{now:2,start:2.4,id:'answer',windowSec:4.8});
 assert.deepEqual(records,original);assert.equal(plan.events.length,4);
 assert.deepEqual(plan.events.map(x=>x.event.response_to),records.slice(2,6).map(x=>[x.event.source_note_id]));
 for(let i=0;i<4;i++){near(plan.events[i].time,2.4+i*.2);near(plan.events[i].event.duration_sec,.1);assert.equal(plan.events[i].event.provenance,'jam_generated');}
 assert.equal(planJamAnswer([personal('held',1.8,4)],{now:2,start:3,id:'x',windowSec:5}),null);
});
test('one-shot echo retains exact rhythm/gates; Keep excludes future attacks; editable save and compiler agree',()=>{
 const {s,attacks}=setup(),original=structuredClone(s.performanceTake.events);
 assert.match(s.requestJamAnswer(),/queued/);const plan=s.jamAnswer;
 near(plan.start,2.44);near(plan.events[1].time,2.82);
 assert.equal(attacks.length,0);s.audioCtx.currentTime=2.35;s._serviceJamAnswer();
 assert.equal(attacks.length,1);assert.equal(s.capturePerformance().events.filter(x=>x.event.response).length,0);
 s.audioCtx.currentTime=2.54;const capture=s.capturePerformance();
 const replies=capture.events.filter(x=>x.event.response);assert.equal(replies.length,1);near(replies[0].duration,.10);
 s.audioCtx.currentTime=2.73;s._serviceJamAnswer();s.audioCtx.currentTime=3.7;s._serviceJamAnswer();
 assert.equal(attacks.length,2);near(attacks[1].time-attacks[0].time,.38);near(attacks[1].event.duration_sec,.8114);
 assert.deepEqual(s.performanceTake.events.slice(0,2),original);
 const full=s.capturePerformance(),source=newPlayDoc(),doc=materializePerformance(source,full);
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 stashWorkingSong(storage,doc);const reopened=loadWorkingSong(storage);assert.deepEqual(reopened,doc);
 const compiled=compileSongStandalone(reopened);assert.equal(compiled.events.length,full.events.length);
 for(const [i,record] of full.events.entries()){
   const note=doc.notes[i],event=compiled.events.find(n=>n.id===note.id);
   near(event.start_sec,record.time-full.start);near(event.duration_sec,record.duration);
   assert.equal(note.provenance,record.event.provenance);assert.deepEqual(note.response_to,record.event.response_to);
 }
 if(process.env.MUSICLAB_ANSWER_TRACE)writeFileSync(process.env.MUSICLAB_ANSWER_TRACE,JSON.stringify({
  expected:{onsets:[2.44,2.82],gates:[.25,.8114],partialKeepReplies:1},
  actual:{onsets:attacks.map(x=>x.time),gates:attacks.map(x=>x.event.duration_sec),partialKeepReplies:replies.length},
  originalUnchanged:true,saveReopenExact:true,compilerExact:true,doc,compiled},null,2));
});
test('new successful playing cancels only unsubmitted reply attacks; scheduled history stays truthful',()=>{
 const {s,attacks}=setup();s.requestJamAnswer();s.audioCtx.currentTime=2.35;s._serviceJamAnswer();
 s.previewSound({patchId:'sampled_piano_v1',role:'lead',midi:67,sourceNoteId:'jam-live-new',durationSec:.25});
 assert.equal(s.jamAnswer.cancelled,true);assert.deepEqual(s.jamAnswer.events.map(x=>x.state),['scheduled','cancelled']);
 s.audioCtx.currentTime=3;s._serviceJamAnswer();assert.equal(attacks.length,2);
 assert.equal(s.capturePerformance().events.filter(x=>x.event.response).length,1);
});
test('repeated pending requests replace rather than accumulate; held input, scope change, stall and Stop cancel safely',()=>{
 const {s,attacks}=setup();s.requestJamAnswer();const old=s.jamAnswer;s.requestJamAnswer();
 assert.equal(old.cancelled,true);assert.notEqual(old.id,s.jamAnswer.id);
 s.liveNotes.set(1,{});assert.match(s.requestJamAnswer(),/Release/);s._serviceJamAnswer();assert.equal(s.jamAnswer.cancelled,true);s.liveNotes.clear();
 s.requestJamAnswer();s.compiledSong.song_id='other';s._serviceJamAnswer();assert.equal(s.jamAnswer.cancelled,true);
 s.compiledSong.song_id='fixture';s.requestJamAnswer();s.audioCtx.currentTime=3;s._serviceJamAnswer();assert.match(s.answerMessage,/pause/);assert.equal(attacks.length,0);
 s.requestJamAnswer();s.stop();s.audioCtx.currentTime=4;s._serviceJamAnswer();assert.equal(attacks.length,0);assert.equal(s.liveNotes.size,0);
});
test('answer failures and lead mute never stop playback or falsely record attacks',()=>{
 const {s}=setup();s.masterBus.piano.trigger=()=>{throw Error('capacity fixture');};s.requestJamAnswer();s.audioCtx.currentTime=2.35;s._serviceJamAnswer();
 assert.equal(s.isPlaying,true);assert.equal(s.performanceTake.events.length,2);assert.match(s.answerMessage,/capacity/);
 const second=setup().s;second.requestJamAnswer();second.mutedLayers.add('tune');second.audioCtx.currentTime=2.35;second._serviceJamAnswer();assert.equal(second.performanceTake.events.length,2);assert.match(second.answerMessage,/muted/);
});
test('main transport makes space for answer and held input without suppressing personal loop notes',()=>{
 const {s,attacks}=setup();s.requestJamAnswer();s.audioCtx.currentTime=2.4;s.currentStep=16;s.nextStepAudioTime=2.44;
 const base={step:16,patch_id:'sampled_piano_v1',duration_sec:.2,concrete:{freq_hz:220},velocity:.5,role:'lead'};
 s.compiledSong.events=[{...base,id:'generated',provenance:'jam_generated'},{...base,id:'own-loop',provenance:'user_placed'},{...base,id:'bass',role:'bass',provenance:'jam_generated'}];
 s._lookaheadTick();assert.deepEqual(attacks.map(x=>x.event.id),[s.jamAnswer.events[0].event.id,'own-loop','bass']);
 const held=setup();held.s.makeRoomForLive=true;held.s.liveNotes.set(1,{});held.s.currentStep=16;held.s.nextStepAudioTime=2.04;held.s.compiledSong.events=s.compiledSong.events;
 held.s._lookaheadTick();assert.deepEqual(held.attacks.map(x=>x.event.id),['own-loop','bass']);
 held.s.makeRoomForLive=false;held.s.currentStep=16;held.s.nextStepAudioTime=2.04;held.s._lookaheadTick();assert.equal(held.attacks.at(-3).event.id,'generated');
});

test('Focus attenuation is identical in reply playback and capture',()=>{
 const {s,attacks}=setup();s.spotlightRole='under';s.requestJamAnswer();s.audioCtx.currentTime=2.35;s._serviceJamAnswer();
 near(attacks[0].event.velocity,.85*.8*.22);near(s.performanceTake.events.at(-1).event.velocity,attacks[0].event.velocity);
});


test('released ringing final tap is included and answer waits for all gates on a beat',()=>{
 const {s}=setup();s.audioCtx.currentTime=1;s.currentStep=7;s.nextStepAudioTime=1.04;
 const long={...personal('long',.2,1.7),released_at:.9};
 const tap={...personal('final',.9,.25,64,2),released_at:1};
 s.performanceTake.events=[long,tap];const original=structuredClone(s.performanceTake.events);
 assert.match(s.requestJamAnswer(),/queued/);assert.equal(s.jamAnswer.events.length,2);
 assert.deepEqual(s.jamAnswer.events.map(x=>x.event.response_to[0]),['jam-live-long','jam-live-final']);
 near(s.jamAnswer.start,2.39);near(s.jamAnswer.events[1].event.duration_sec,.25);
 assert.deepEqual(s.performanceTake.events,original);
 assert.equal(s.capturePerformance().events.filter(x=>x.event.response).length,0);
 const at=s.capturePerformance().events.find(x=>x.event.source_note_id==='jam-live-final');near(at.duration,.1);
});

test('readiness prioritizes Cancel, then holds/cooldown, and recovers without stale refusal',()=>{
 const {s}=setup();s.requestJamAnswer();s.audioCtx.currentTime=2.35;s._serviceJamAnswer();
 assert.equal(s.jamAnswerReadiness().state,'active');assert.equal(s.jamAnswerReadiness().label,'Cancel answer');
 s.audioCtx.currentTime=4;assert.equal(s.jamAnswerReadiness().state,'cooling');assert.match(s.jamAnswerStatus(),/You can play/);
 assert.match(s.requestJamAnswer(),/fade/);s.audioCtx.currentTime=10;
 assert.equal(s.jamAnswerReadiness().state,'ready');assert.doesNotMatch(s.jamAnswerStatus(),/fade/);
 s.liveNotes.set(1,{});assert.equal(s.jamAnswerReadiness().state,'held');s.liveNotes.clear();
 s.previewsMuted=true;assert.equal(s.jamAnswerReadiness().state,'stopped');
});

test('released but future personal attacks defer the whole request, never substitute older notes',()=>{
 const {s}=setup();s.performanceTake.events.push({...personal('starting',2.01,.25),released_at:2});
 assert.equal(s.jamAnswerReadiness().state,'starting');assert.match(s.requestJamAnswer(),/starting/);assert.equal(s.jamAnswer,undefined);
 s.audioCtx.currentTime=2.02;assert.match(s.requestJamAnswer(),/queued/);
 assert.ok(s.jamAnswer.events.some(x=>x.event.response_to[0]==='jam-live-starting'));
});


test('automatic turn taking waits for released phrase, answers once, and never copies its own reply',()=>{
 const {s}=setup();s.performanceTake.events=[];s.performanceTake.sequence=0;s.setAutomaticAnswers(true);
 const note=personal('new',1,.25,60,1);note.released_at=1.25;
 s.performanceTake.events.push(note);s.performanceTake.sequence=1;
 s.audioCtx.currentTime=1.6;s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined);
 s.audioCtx.currentTime=2;s._serviceAutomaticAnswer();assert.equal(s.jamAnswer.automatic,true);
 const id=s.jamAnswer.id;assert.deepEqual(s.jamAnswer.events[0].event.response_to,['jam-live-new']);
 s.audioCtx.currentTime=2.4;s._serviceJamAnswer();
 s.audioCtx.currentTime=10;s._serviceAutomaticAnswer();assert.equal(s.jamAnswer.id,id);
 assert.deepEqual(s.performanceTake.events[0],note);
});
test('automatic answers respect held input, explicit opt-out, and focus-loss cancellation',()=>{
 const {s}=setup();s.performanceTake.events=[];s.performanceTake.sequence=0;s.setAutomaticAnswers(true);
 const note=personal('new',1,.25,60,1);note.released_at=1.25;s.performanceTake.events.push(note);s.performanceTake.sequence=1;
 s.liveNotes.set('held',{});s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined);s.liveNotes.clear();
 s.cancelJamAnswer();s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined,'cancel consumes old phrase without deleting it');
 const next={...personal('next',1.1,.25,64,2),released_at:1.4};s.performanceTake.events.push(next);s.performanceTake.sequence=2;
 s._serviceAutomaticAnswer();assert.equal(s.jamAnswer.events.length,1);assert.equal(s.jamAnswer.events[0].event.response_to[0],'jam-live-next');
 s.setAutomaticAnswers(false);assert.equal(s.jamAnswer.cancelled,true);assert.equal(s.performanceTake.events.length,2);
});
test('enabling automatic answers does not replay music from before the switch',()=>{
 const {s}=setup();for(const note of s.performanceTake.events)note.released_at=note.time+note.duration;
 s.setAutomaticAnswers(true);s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined);
});

test('successive live presses accumulate a phrase instead of consuming each preceding note',()=>{
 const {s}=setup();s.performanceTake.events=[];s.performanceTake.sequence=0;s.setAutomaticAnswers(true);
 for(let i=0;i<4;i++){
  s.cancelJamAnswer('Your turn.');
  s.performanceTake.events.push({...personal('phrase'+i,.2+i*.25,.15,60+i,i+1),released_at:.35+i*.25});
  s.performanceTake.sequence=i+1;
 }
 s._serviceAutomaticAnswer();
 assert.deepEqual(s.jamAnswer.events.map(item=>item.event.response_to[0]),[0,1,2,3].map(i=>'jam-live-phrase'+i));
});

test('actual successful pad auditions produce one four-note automatic answer',()=>{
 const {s}=setup();s.performanceTake.events=[];s.performanceTake.sequence=0;s.setAutomaticAnswers(true);
 for(let i=0;i<4;i++){
  s.audioCtx.currentTime=i*.2;
  s.previewSound({patchId:'sampled_piano_v1',role:'lead',midi:60+i,durationSec:.15,sourceNoteId:'jam-live-actual'+i});
 }
 const originals=structuredClone(s.performanceTake.events);
 s.audioCtx.currentTime=1.3;s._serviceAutomaticAnswer();
 assert.deepEqual(s.jamAnswer.events.map(item=>item.event.response_to[0]),[0,1,2,3].map(i=>'jam-live-actual'+i));
 assert.deepEqual(s.performanceTake.events,originals);
});

test('automatic echo yields to next-bar adoption until its audio-clock attack, without consuming the personal phrase',()=>{
 const {s}=setup();s.performanceTake.events=[];s.performanceTake.sequence=0;s.setAutomaticAnswers(true);
 const own={...personal('adopt',1,.25,67,1),released_at:1.25};
 s.performanceTake.events.push(own);s.performanceTake.sequence=1;s.jamPhraseOrdinal=0;
 const event={provenance:'jam_generated',role:'lead',evolution:{answered:{source_note_id:'jam-live-adopt',midi:67}}};
 s.pendingJamLead={phraseOrdinal:0,commitStep:16,events:[event]};
 s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined,'pending adoption takes priority');
 assert.equal(s.answeredThrough,0,'waiting does not consume personal input');
 s.activeJamLead=s.pendingJamLead;s.pendingJamLead=null;s.currentStep=18;
 s.pendingJamLead={phraseOrdinal:1,events:[{provenance:'jam_generated',role:'lead'}]};
 s.performanceTake.events.push({event,time:2.2,duration:.25,occurrence:2});
 s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined,'scheduled future adoption is not realized');
 s.audioCtx.currentTime=2.21;s._serviceAutomaticAnswer();assert.equal(s.jamAnswer.automatic,true);
 assert.deepEqual(s.performanceTake.events[0],own);
});

test('expired adoption does not starve automatic echoes; explicit Answer this is still available while adoption waits',()=>{
 const {s}=setup();s.performanceTake.events=[];s.performanceTake.sequence=0;s.setAutomaticAnswers(true);
 s.performanceTake.events.push({...personal('manual',1,.25,67,1),released_at:1.25});s.performanceTake.sequence=1;
 s.jamPhraseOrdinal=0;s.pendingJamLead={phraseOrdinal:0,commitStep:16,events:[{evolution:{answered:{source_note_id:'jam-live-manual'}}}]};
 assert.match(s.requestJamAnswer(),/queued/,'an explicit request is not blocked');
 const {s:t}=setup();t.performanceTake.events=[];t.performanceTake.sequence=0;t.setAutomaticAnswers(true);
 t.performanceTake.events.push({...personal('late',1,.25,67,1),released_at:1.25});t.performanceTake.sequence=1;
 t.jamPhraseOrdinal=1;t.activeJamLead=s.pendingJamLead;t._serviceAutomaticAnswer();assert.equal(t.jamAnswer.automatic,true);
});

test('fixed-form melodic adoption also has priority until its emitted attack reaches the audio clock',()=>{
 const {s}=setup();s.performanceTake.events=[];s.performanceTake.sequence=0;s.setAutomaticAnswers(true);
 s.performanceTake.events.push({...personal('form',1,.25,67,1),released_at:1.25});s.performanceTake.sequence=1;
 s.jamPhraseOrdinal=0;s.leadAnswer={phraseOrdinal:0,step:16,sourceNoteId:'jam-live-form',used:false};
 s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined);
 s.leadAnswer.used=true;s.currentStep=18;
 s.performanceTake.events.push({time:2.2,duration:.25,occurrence:2,event:{evolution:{answered:{source_note_id:'jam-live-form'}}}});
 s._serviceAutomaticAnswer();assert.equal(s.jamAnswer,undefined,'used is not yet realized');
 s.audioCtx.currentTime=2.21;s._serviceAutomaticAnswer();assert.equal(s.jamAnswer.automatic,true);
});
