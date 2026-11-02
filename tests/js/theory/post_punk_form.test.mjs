import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlock,SCENE_ID} from '../../../static/js/theory/post_punk_form_score.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {pianoNotes,SAMPLED_PROGRAMS} from '../../../static/js/audio/sampled_piano.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';

test('post-punk uses syncopated sampled bass and distinct suspended shell voices',()=>{
 for(let root=0;root<12;root++)for(const blockIndex of[0,1]){
  const score=buildBlock(SCENE_ID,{root,blockIndex,density:4,color:4,cycle:7});
  assert.equal(score.notes.filter(n=>n.patch==='hat_closed').length,16);
  for(let bar=0;bar<4;bar++){
   const bass=score.notes.filter(n=>n.role==='bass'&&Math.floor(n.position/16)===bar);
   assert.deepEqual(bass.map(n=>n.position%16),[0,3,6,9,11,14]);
   assert.ok(bass.every(n=>n.patch==='sampled_bass_v1'));
   assert.ok(new Set(bass.map(n=>n.pitch)).size>=4);
   const shell=score.notes.filter(n=>n.role==='harmony'&&Math.floor(n.position/16)===bar);
   assert.equal(shell.length,2);assert.equal(new Set(shell.map(n=>n.voice_id)).size,2);
   assert.ok(shell.every(n=>n.patch==='sampled_clean_guitar_v1'&&n.position%16===(bar%2?12:4)));
  }
 }
});
test('a captured post-punk bass edit preserves clean-guitar parts and timing',()=>{
 assert.equal(SAMPLED_PROGRAMS.sampled_overdrive_guitar_v1,29);assert.equal(SAMPLED_PROGRAMS.sampled_clean_guitar_v1,27);
 assert.match(getInstrument('sampled_overdrive_guitar_v1').image,/guitar\.svg$/);
 const d=setJamDirection(startJam(newPlayDoc(),{patchId:'sampled_clean_guitar_v1'}),{scene_catalogue:'first-neighborhood-v1',scene_id:SCENE_ID,responsive:false});
 const v=createJamFormBuilder()(d).blocks[0].variants[0];
 const selected=['angular-bass-ostinato','suspended-color','suspended-fifth'].map(id=>v.events.find(e=>e.voice_id===id));
 const kept=materializePerformance(d,{start:0,end:9.6,bpm:100,bars:4,events:selected.map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1}))});
 const original=structuredClone(kept);kept.notes[0].concrete.midi_pitch+=1;
 const reopened=parseProjectJson(exportProjectJson(kept));assert.equal(reopened.ok,true);
 const input=structuredClone(reopened.song),events=compileSongStandalone(reopened.song).events;
 assert.equal(events.length,3);assert.equal(new Set(events.map(e=>e.source_note_id)).size,3);
 assert.deepEqual(events.map(e=>pianoNotes(e)[0].pitch),original.notes.map((n,i)=>n.concrete.midi_pitch+(i===0?1:0)));
 assert.deepEqual(events.map(e=>pianoNotes(e)[0].program),[33,27,27]);
 assert.deepEqual(reopened.song,input);assert.deepEqual(reopened.song.notes.slice(1),original.notes.slice(1));
 assert.deepEqual(reopened.song.captured_performance,original.captured_performance);
 assert.deepEqual(events.map(e=>[e.voice_id,e.start_sec,e.duration_sec]),compileSongStandalone(original).events.map(e=>[e.voice_id,e.start_sec,e.duration_sec]));
 assert.equal(parseProjectJson(exportProjectJson(d)).song.jam_session.patchId,'sampled_clean_guitar_v1');
});
