import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'bossa-nova-v1',responsive:false});
test('nylon thumb and syncopated upper shells remain separate editable voices',()=>{
 const p=createJamFormBuilder()(make());
 for(const b of p.blocks)for(const v of b.variants){
  const thumb=v.events.filter(e=>e.role==='bass'),shell=v.events.filter(e=>e.role==='harmony');
  assert.equal(thumb.length,8);assert.equal(shell.length,20);
  assert.ok(thumb.every(e=>e.step%8===0&&e.voice_id==='thumb-root-fifth'));
  assert.deepEqual(shell.filter(e=>e.step<16).map(e=>e.step),[0,0,6,6,12,12]);
  assert.ok([...thumb,...shell].every(e=>e.patch_id==='sampled_guitar_v1'&&e.generated_harmony.pitch_classes.length===5));
 }
});
test('minor extended harmony and fractional cadence survive capture, intentional edit and reopen',()=>{
 const d=make();d.global_context.scale_type='natural_minor';const p=createJamFormBuilder()(d);
 const v=p.blocks[0].variants[7],n=v.events.find(e=>e.role==='lead'&&e.step>60&&e.performance?.offset_steps>0);assert.ok(n);
 assert.deepEqual(n.generated_harmony.pitch_classes,[0,3,7,9,2]);
 assert.equal(n.why_label,'Source band: harmony context. Pitch kept as written.');
 const dominant=v.events.find(e=>e.role==='harmony'&&e.step>=32&&e.step<48);assert.ok(dominant);
 assert.deepEqual(dominant.generated_harmony.pitch_classes,[7,11,2,5,8]);
 const kept=materializePerformance(d,{start:0,end:10,bpm:100,bars:4,events:[{event:n,time:9.215625,duration:.33,occurrence:1}]});
 const original=structuredClone(kept);kept.notes[0].concrete.midi_pitch=74;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);
 const e=compileSongStandalone(saved.song).events[0];assert.equal(e.concrete.midi_pitch,74);
 assert.equal(e.voice_id,n.voice_id);assert.deepEqual(e.generated_harmony,n.generated_harmony);
 assert.ok(Math.abs(e.duration_sec-.33)<1e-8);assert.ok(Math.abs(e.start_sec-9.215625)<1e-8);
 assert.equal(original.notes[0].concrete.midi_pitch,n.concrete.midi_pitch);
});
