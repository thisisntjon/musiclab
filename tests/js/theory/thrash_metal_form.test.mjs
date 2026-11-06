import test from 'node:test';import assert from 'node:assert/strict';
import {buildBlock,SCENE_ID} from '../../../static/js/theory/thrash_metal_form_score.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';import {materializePerformance} from '../../../static/js/theory/performance_capture.js';import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';import {pianoNotes} from '../../../static/js/audio/sampled_piano.js';import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
test('thrash chromatic bursts keep bass an octave below and kick attacks locked',()=>{
 for(let root=0;root<12;root++)for(const blockIndex of[0,1]){
  const score=buildBlock(SCENE_ID,{root,blockIndex,density:4,color:4,cycle:7});
  for(let bar=0;bar<4;bar++){
   const part=id=>score.notes.filter(n=>n.voice_id===id&&Math.floor(n.position/16)===bar),riff=part('chromatic-burst'),bass=part('riff-unison');
   assert.deepEqual(riff.map(n=>n.position%16),[0,1,2,3,8,9,10,11]);
   assert.deepEqual(bass.map(n=>n.position),riff.map(n=>n.position));assert.ok(bass.every((n,i)=>riff[i].pitch-n.pitch===12));
   assert.deepEqual(part('kick-burst').map(n=>n.position),riff.map(n=>n.position));
   assert.ok(riff.some(n=>n.pitch-riff[0].pitch===1));assert.ok(riff.some(n=>n.pitch-riff[0].pitch===6));
   assert.ok(part('angular-answer').every(n=>n.gate<=.4));
  }
 }
});
test('chromatic pitches and personal holds survive Keep and independent sampler edits',()=>{
const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'thrash-metal-v1',density:4,responsive:false}),events=createJamFormBuilder()(d).blocks[0].variants[0].events;
const semitone=events.find(e=>e.voice_id==='chromatic-burst'&&e.step===2),tritone=events.find(e=>e.voice_id==='chromatic-burst'&&e.step===9),future=events.find(e=>e.voice_id==='chromatic-burst'&&e.step===11);assert.equal(semitone.concrete.midi_pitch,49);assert.equal(tritone.concrete.midi_pitch,54);
for(const n of[semitone,tritone])assert.match(n.why_label,/harmony context/);
const own={id:'jam-live-thrash-review',source_note_id:'jam-live-thrash-review',role:'lead',patch_id:'sampled_clean_guitar_v1',provenance:'user_placed',concrete:{midi_pitch:64},pitch_lock_mode:'concrete',velocity:.47};
const s=new LookaheadScheduler();s.audioCtx={currentTime:1.4};s.isPlaying=true;s.performanceTake={song_id:d.id,start:0,bpm:100,events:[semitone,tritone,future].map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1})).concat([{event:own,time:1.1,duration:1,occurrence:4}])};
const capture=s.capturePerformance();assert.equal(capture.events.length,3);assert.ok(!capture.events.some(e=>e.event.id===future.id));const kept=materializePerformance(d,capture),original=structuredClone(kept),target=kept.notes.find(e=>e.concrete.midi_pitch===49);target.concrete.midi_pitch++;
const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);const output=compileSongStandalone(saved.song).events,prior=compileSongStandalone(original).events;
for(const e of output){const old=prior.find(x=>x.id===e.id);assert.equal(pianoNotes(e)[0].pitch,old.concrete.midi_pitch+(old.concrete.midi_pitch===49?1:0));assert.equal(pianoNotes(e)[0].program,e.provenance==='user_placed'?27:29);assert.equal(e.source_note_id,old.source_note_id);assert.equal(e.start_sec,old.start_sec);assert.equal(e.duration_sec,old.duration_sec);if(e.provenance==='jam_generated'){assert.deepEqual(e.generated_harmony,old.generated_harmony);assert.match(e.why_label,/harmony context/);}}
assert.deepEqual(saved.song.captured_performance,original.captured_performance);const ownOut=output.filter(e=>e.source_note_id===own.id);assert.equal(ownOut.length,1);assert.equal(ownOut[0].concrete.midi_pitch,64);assert.ok(Math.abs(ownOut[0].duration_sec-.3)<1e-8);
});
