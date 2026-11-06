import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlock,SCENE_ID} from '../../../static/js/theory/punk_rock_form_score.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {pianoNotes,SAMPLED_PROGRAMS} from '../../../static/js/audio/sampled_piano.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';

test('punk subdivisions belong to the backing and never duplicate or retime personal notes',()=>{
 for(const blockIndex of[0,1]){
  const score=buildBlock(SCENE_ID,{blockIndex,density:4,color:4,cycle:7});
  assert.equal(score.notes.filter(n=>n.voice_id==='sixteenth-time').length,64);
  assert.equal(score.notes.filter(n=>n.voice_id==='eighth-root-pulse').length,32);
  assert.equal(score.notes.filter(n=>n.voice_id==='short-hook-answer').length,4);
  for(let bar=0;bar<4;bar++){
   const roots=score.notes.filter(n=>n.voice_id==='clipped-root-drive'&&Math.floor(n.position/16)===bar);
   assert.deepEqual(roots.map(n=>n.position%16),[0,2,4,8,10,12]);
   assert.equal(new Set(roots.map(n=>n.pitch)).size,1);
   for(const step of[0,8]){const fifth=score.notes.find(n=>n.voice_id==='power-fifth-accent'&&n.position===bar*16+step);assert.equal(fifth.pitch-roots[0].pitch,7);}
  }
 }
 const own={id:'personal-long-punk',role:'lead',patch_id:'sampled_clean_guitar_v1',step:3,duration_steps:9,performance:{offset_steps:.25},concrete:{midi_pitch:61},pitch_lock_mode:'concrete',velocity:.37,provenance:'user_placed'};
 const d=startJam(newPlayDoc());d.notes.push(own);const before=structuredClone(d);
 const next=setJamDirection(d,{scene_catalogue:'first-neighborhood-v1',scene_id:SCENE_ID,density:4,color:4,responsive:false});
 assert.deepEqual(next.notes.filter(n=>n.provenance==='user_placed'),[own]);
 assert.deepEqual(d,before);assert.equal(next.global_context.bpm,d.global_context.bpm);
});
test('captured punk root and fifth preserve identity while one pitch is edited',()=>{
 assert.equal(SAMPLED_PROGRAMS.sampled_overdrive_guitar_v1,29);assert.equal(SAMPLED_PROGRAMS.sampled_clean_guitar_v1,27);
 assert.match(getInstrument('sampled_overdrive_guitar_v1').image,/guitar\.svg$/);
 const d=setJamDirection(startJam(newPlayDoc(),{patchId:'sampled_overdrive_guitar_v1'}),{scene_catalogue:'first-neighborhood-v1',scene_id:SCENE_ID,responsive:false});
 const v=createJamFormBuilder()(d).blocks[0].variants[0];
 const selected=['clipped-root-drive','power-fifth-accent','short-hook-answer'].map(id=>v.events.find(e=>e.voice_id===id));
 const kept=materializePerformance(d,{start:0,end:9.6,bpm:100,bars:4,events:selected.map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1}))});
 const original=structuredClone(kept);kept.notes[0].concrete.midi_pitch+=1;
 const reopened=parseProjectJson(exportProjectJson(kept));assert.equal(reopened.ok,true);
 const input=structuredClone(reopened.song),events=compileSongStandalone(reopened.song).events;
 assert.equal(events.length,3);assert.equal(new Set(events.map(e=>e.source_note_id)).size,3);
 assert.deepEqual(events.map(e=>pianoNotes(e)[0].pitch),original.notes.map((n,i)=>n.concrete.midi_pitch+(i===0?1:0)));
 assert.ok(events.every(e=>pianoNotes(e)[0].program===29));
 assert.deepEqual(reopened.song,input);assert.deepEqual(reopened.song.notes.slice(1),original.notes.slice(1));
 assert.deepEqual(reopened.song.captured_performance,original.captured_performance);
 assert.deepEqual(events.map(e=>[e.voice_id,e.start_sec,e.duration_sec]),compileSongStandalone(original).events.map(e=>[e.voice_id,e.start_sec,e.duration_sec]));
 assert.equal(parseProjectJson(exportProjectJson(d)).song.jam_session.patchId,'sampled_overdrive_guitar_v1');
});
