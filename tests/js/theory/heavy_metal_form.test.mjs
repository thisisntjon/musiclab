import test from 'node:test';import assert from 'node:assert/strict';
import {buildBlock,SCENE_ID} from '../../../static/js/theory/heavy_metal_form_score.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';import {materializePerformance} from '../../../static/js/theory/performance_capture.js';import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';import {pianoNotes} from '../../../static/js/audio/sampled_piano.js';import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
test('heavy-metal gallop attacks lock bass and fifth accents while the answer sustains',()=>{
 for(const blockIndex of[0,1])for(const variant of['base','space','answer']){
  const score=buildBlock(SCENE_ID,{blockIndex,variant,density:4,color:4,cycle:7});
  for(let bar=0;bar<4;bar++){
   const part=id=>score.notes.filter(n=>n.voice_id===id&&Math.floor(n.position/16)===bar);
   const riff=part('gallop-root'),bass=part('gallop-bass'),upper=part('power-fifth-upper'),answer=part('sustained-answer')[0];
   assert.deepEqual(riff.map(n=>n.position%16),[0,2,3,8,10,11]);assert.deepEqual(bass.map(n=>n.position),riff.map(n=>n.position));
   assert.deepEqual(upper.map(n=>n.position%16),[0,8]);assert.ok(upper.every(n=>n.pitch-riff[0].pitch===7));
   assert.ok(riff.every(n=>n.gate<answer.gate));
  }
 }
});
test('Keep clips ongoing answers and personal holds, excludes future attacks and preserves independent edits',()=>{
const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'heavy-metal-v1',density:4,responsive:false}),events=createJamFormBuilder()(d).blocks[0].variants[0].events;
const root=events.find(e=>e.voice_id==='gallop-root'&&e.step===0),fifth=events.find(e=>e.voice_id==='power-fifth-upper'&&e.step===0),lead=events.find(e=>e.voice_id==='sustained-answer'&&e.step===4),future=events.find(e=>e.voice_id==='lead-pickup'&&e.step===7);assert.ok(lead.duration_sec>root.duration_sec);
const own={id:'jam-live-heavy-review',source_note_id:'jam-live-heavy-review',role:'lead',patch_id:'sampled_clean_guitar_v1',provenance:'user_placed',concrete:{midi_pitch:64},pitch_lock_mode:'concrete',velocity:.47};
const s=new LookaheadScheduler();s.audioCtx={currentTime:.8};s.isPlaying=true;s.performanceTake={song_id:d.id,start:0,bpm:100,events:[root,fifth,lead,future].map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1})).concat([{event:own,time:.2,duration:1,occurrence:5}])};
const capture=s.capturePerformance();assert.equal(capture.events.length,4);assert.ok(!capture.events.some(e=>e.event.id===future.id));assert.ok(Math.abs(capture.events.find(e=>e.event.id===lead.id).duration-.2)<1e-8);
const kept=materializePerformance(d,capture),original=structuredClone(kept),target=kept.notes.find(e=>e.voice_id==='power-fifth-upper');target.concrete.midi_pitch++;
const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);const output=compileSongStandalone(saved.song).events,prior=compileSongStandalone(original).events;
for(const e of output){const old=prior.find(x=>x.id===e.id);assert.equal(pianoNotes(e)[0].pitch,old.concrete.midi_pitch+(e.voice_id==='power-fifth-upper'?1:0));assert.equal(pianoNotes(e)[0].program,e.provenance==='user_placed'?27:29);assert.equal(e.source_note_id,old.source_note_id);assert.equal(e.start_sec,old.start_sec);assert.equal(e.duration_sec,old.duration_sec);}
assert.deepEqual(saved.song.captured_performance,original.captured_performance);const ownOut=output.filter(e=>e.source_note_id===own.id);assert.equal(ownOut.length,1);assert.equal(ownOut[0].concrete.midi_pitch,64);assert.ok(Math.abs(ownOut[0].duration_sec-.6)<1e-8);
});
