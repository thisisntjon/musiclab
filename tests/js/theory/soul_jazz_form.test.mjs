import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {formScore,formBacking} from '../../../static/js/theory/form_scenes.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';
import {SAMPLED_PROGRAMS,pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc(),{patchId:'sampled_organ_v1'}),{scene_catalogue:'first-neighborhood-v1',scene_id:'soul-jazz-v1',responsive:false,density:0});
test('neighbor horn calibration changes only the generated foreground',()=>{
 const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'hard-bop-v1',responsive:false});
 const raw=formScore(d).notes,backing=formBacking(d,d.jam_session,[]);
 for(const e of backing){
  const n=raw.find(n=>n.role===e.role&&n.patch===e.patch_id&&n.pitch===e.concrete.midi_pitch&&Math.abs(n.position-e.step-e.performance.offset_steps)<1e-8);assert.ok(n);
  assert.equal(e.velocity,n.velocity*(e.role==='lead'?2:1));
  assert.equal(e.duration_steps,n.gate);
 }
 const own={id:'personal-horn',role:'lead',patch_id:'sampled_trumpet_v1',step:0,duration_steps:2,concrete:{midi_pitch:61},pitch_lock_mode:'concrete',velocity:.37,provenance:'user_placed'};
 d.notes.push(own);const next=setJamDirection(d,{color:2});assert.deepEqual(next.notes.find(n=>n.id===own.id),own);
});
test('the organ keeps independent bass, shell and upper registers through both vamp chapters',()=>{
 const d=make(),p=createJamFormBuilder()(d);assert.equal(p.blocks.length,2);
 assert.deepEqual(p.blocks.flatMap(b=>b.variants[0].harmony.bars.map(c=>c[0])),[0,0,0,0,5,5,0,0]);
 assert.equal(SAMPLED_PROGRAMS.sampled_organ_v1,16);assert.match(getInstrument('sampled_organ_v1').image,/organ\.svg$/);
 for(const b of p.blocks)for(const v of b.variants){
  for(const [role,count,low,high,id] of [['bass',16,36,47,'organ-bass-ostinato'],['harmony',8,48,59,'organ-shells'],['lead',8,60,71,'organ-upper-answer']]){
   const part=v.events.filter(e=>e.role===role);assert.equal(part.length,count);
   assert.ok(part.every(e=>e.patch_id==='sampled_organ_v1'&&e.voice_id===id&&e.concrete.midi_pitch>=low&&e.concrete.midi_pitch<=high));
   assert.ok(part.every(e=>pianoNotes(e).every(n=>n.program===16)));
  }
 }
 assert.equal(parseProjectJson(exportProjectJson(d)).song.jam_session.patchId,'sampled_organ_v1');
});
test('captured organ parts keep separate source identities when one part is revised and reopened',()=>{
 const d=make(),v=createJamFormBuilder()(d).blocks[0].variants[0];
 const selected=['bass','lead','harmony'].map(role=>v.events.find(e=>e.role===role));
 const kept=materializePerformance(d,{start:0,end:2.4,bpm:100,bars:1,events:selected.map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1}))});
 const before=structuredClone(kept);kept.notes[0].concrete.midi_pitch+=1;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);const events=compileSongStandalone(saved.song).events;
 assert.equal(events.length,3);assert.equal(new Set(events.map(e=>e.source_note_id)).size,3);
 assert.equal(events[0].concrete.midi_pitch,before.notes[0].concrete.midi_pitch+1);
 assert.deepEqual(saved.song.notes.slice(1),before.notes.slice(1));
 assert.deepEqual(events.map(e=>e.voice_id),selected.map(e=>e.voice_id));
 assert.ok(events.every(e=>e.patch_id==='sampled_organ_v1'&&e.generated_harmony.pitch_classes.length===4));
});
