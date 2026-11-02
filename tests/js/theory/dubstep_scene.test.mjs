import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {planMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',
 showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,
 scene_id:'dubstep-v1',responsive:false});

test('every density and color remains a distinct musical choice across all variants',()=>{
 const doc=make(),signature=s=>JSON.stringify(compileSongStandalone(s).events);
 for(const scene_variant of ['base','answer','space']) {
  for(const field of ['density','color'])assert.equal(new Set([0,1,2,3,4].map(value=>
   signature(setJamDirection(doc,{scene_variant,[field]:value})))).size,5);
  for(let density=0;density<5;density++) {
   const song=setJamDirection(doc,{scene_variant,density});
   assert.ok(song.notes.filter(n=>n.role==='harmony'&&n.step<16).every(n=>n.duration_steps===3+density));
  }
 }
});

test('half-time pattern and sparse developing phrases leave the personal clock unchanged',()=>{
 const doc=make();
 assert.deepEqual(doc.notes.filter(n=>n.patch_id==='snare').map(n=>n.step),[8,24,40,56]);
 assert.deepEqual(doc.notes.filter(n=>n.patch_id==='kick').map(n=>n.step),[0,11,16,22,30,32,43,48,54,62]);
 for(const bpm of [20,100,400])for(const scale_type of ['major','natural_minor']) {
  doc.global_context={...doc.global_context,bpm,scale_type};
  const own={id:'personal-clock',role:'lead',patch_id:'sampled_piano_v1',step:3,duration_steps:11.25,
   performance:{version:1,offset_steps:.25},provenance:'user_placed',pitch_lock_mode:'concrete',concrete:{midi_pitch:66},velocity:.61};
  doc.notes.push(own);const song=setJamDirection(doc);assert.deepEqual(song.notes.find(n=>n.id===own.id),own);doc.notes.pop();
  const ev=compileSongStandalone(song).events.find(e=>e.id===own.id);
  assert.ok(Math.abs(ev.start_sec-3.25*15/bpm)<1e-6);assert.ok(Math.abs(ev.duration_sec-11.25*15/bpm)<1e-6);
  for(let phraseOrdinal=0;phraseOrdinal<16;phraseOrdinal++) {
   const p=planMelodicPhrase({version:3,...phraseContext(song),bpm,phraseOrdinal});
   assert.ok(p.events.length<=5);assert.ok(!p.events.some(e=>e.step>=16&&e.step<32));
   assert.equal(p.events.at(-1).concrete.midi_pitch%12,7);
  }
 }
});

test('explicit wobble rate survives realized materialization, editable saves and compilation',()=>{
 for(let color=0;color<5;color++) {
  const song=setJamDirection(make(),{color}),compiled=compileSongStandalone(song);
  const rate=['1/2','1/4','1/8','1/8t','1/16'][color];
  const wobble=compiled.events.filter(e=>e.patch_id==='wobble_bass');assert.equal(wobble.length,4);
  assert.ok(wobble.every(e=>e.gesture.lfo_rate===rate&&e.concrete.midi_pitch>=36&&e.concrete.midi_pitch<=54));
  const capture={version:1,start:0,end:9.6,bpm:100,bars:4,events:compiled.events.map((event,i)=>
   ({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1}))};
  const taken=materializePerformance(song,capture),opened=parseProjectJson(exportProjectJson(taken));assert.equal(opened.ok,true);
  assert.deepEqual(compileSongStandalone(opened.song).events,compileSongStandalone(taken).events);
  assert.ok(compileSongStandalone(opened.song).events.filter(e=>e.patch_id==='wobble_bass').every(e=>e.gesture.lfo_rate===rate));
 }
});
