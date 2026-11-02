import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'bakersfield-sound-v1',responsive:false,density:0});
test('electric call and reply use different straight rhythms over the driving bass',()=>{
 const p=createJamFormBuilder()(make());
 for(const [i,b] of p.blocks.entries())for(const v of b.variants){
  const lead=v.events.filter(e=>e.role==='lead'),bass=v.events.filter(e=>e.role==='bass');
  assert.equal(bass.length,16);assert.ok(bass.every(e=>e.step%4===0));
  assert.equal(lead.length,8);assert.deepEqual(lead.filter(e=>e.step<16).map(e=>e.step),i?[3,10]:[2,7]);
  assert.ok(lead.every(e=>e.patch_id==='sampled_clean_guitar_v1'&&e.voice_id==='picked-answer'&&e.duration_steps===.45));
  assert.ok(lead.every(e=>pianoNotes(e).every(n=>n.program===27&&Math.abs(n.duration-.0675)<1e-9)));
 }
});
test('same-patch guitar comp voices remain separate when a short answer is captured and revised',()=>{
 const d=make(),v=createJamFormBuilder()(d).blocks[0].variants[7];
 const selected=v.events.filter(e=>(e.role==='harmony'&&e.step===4)||(e.role==='lead'&&e.step>50)).slice(0,3);assert.equal(selected.length,3);
 const kept=materializePerformance(d,{start:0,end:10,bars:4,bpm:100,events:selected.map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1}))});
 const before=structuredClone(kept);kept.notes[2].concrete.midi_pitch+=1;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);const events=compileSongStandalone(saved.song).events;
 assert.equal(events.length,3);assert.equal(new Set(events.map(e=>e.source_note_id)).size,3);
 assert.deepEqual(events.slice(0,2).map(e=>e.concrete.midi_pitch),before.notes.slice(0,2).map(e=>e.concrete.midi_pitch));
 assert.equal(events[2].concrete.midi_pitch,before.notes[2].concrete.midi_pitch+1);
 for(let i=0;i<3;i++){assert.equal(events[i].voice_id,selected[i].voice_id);assert.deepEqual(events[i].generated_harmony,selected[i].generated_harmony);assert.ok(Math.abs(events[i].start_sec-selected[i].start_sec)<1e-9);}
});
