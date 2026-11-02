import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,responsive:false});
const inBar=(song,role,bar)=>song.notes.filter(n=>n.role===role&&n.step>=16*bar&&n.step<16*(bar+1));

test('techno rolling root cells and minimal four-bar articulation cycles are distinct',()=>{
 const techno=make('techno-v1'),minimal=make('minimal-techno-v1');
 assert.deepEqual(inBar(techno,'bass',0).map(n=>n.step),[1,2,5,6,9,10,13,14]);
 assert.equal(new Set(inBar(techno,'bass',0).map(n=>n.concrete.midi_pitch)).size,1);
 assert.deepEqual(inBar(minimal,'bass',0).map(n=>n.step),[2,10]);
 assert.deepEqual(Array.from({length:4},(_,bar)=>inBar(minimal,'harmony',bar).map(n=>n.step-bar*16)),[[1,7,10],[2,8,11],[3,9,12],[0,6,9]]);
 assert.deepEqual(Array.from({length:4},(_,bar)=>inBar(minimal,'harmony',bar)[0].duration_steps),[.35,.55,.85,.55]);
});
test('hip-hop emits displaced pickups and downtempo has bounded long gates at unchanged tempo',()=>{
 const hip=make('hip-hop-v1'),down=make('downtempo-v1');
 const pickup=hip.notes.find(n=>n.role==='drums'&&n.step===3&&n.performance.offset_steps===.25);
 assert.ok(pickup);const event=compileSongStandalone(hip).events.find(n=>n.id===pickup.id);
 assert.equal(event.start_sec,Math.round(3.25*15/hip.global_context.bpm*1e6)/1e6);
 assert.equal(down.global_context.bpm,hip.global_context.bpm);
 assert.ok(inBar(down,'harmony',0).some(n=>n.step===0&&n.duration_steps===11));
 assert.deepEqual(inBar(down,'drums',0).filter(n=>n.patch_id==='snare').map(n=>n.step),[8]);
 assert.deepEqual(inBar(down,'bass',0).map(n=>[n.step,n.duration_steps]),[[0,6],[10,4]]);
});
test('all four recipes have meaningful controls, local chord tones and preserved performed bass',()=>{
 for(const id of ['techno-v1','minimal-techno-v1','hip-hop-v1','downtempo-v1']){
  const base=make(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(base,{[field]:v})).events))).size,5,`${id}/${field}`);
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(base,{scene_variant})).events))).size,3,id);
  for(const scale_type of ['major','natural_minor'])for(const scene_variant of ['base','answer','space']){
   const input=structuredClone(base);input.global_context.scale_type=scale_type;
   const song=setJamDirection(input,{scene_variant});
   for(let bar=0;bar<4;bar++){
    const minor=scale_type==='natural_minor',third=minor?3:4,sixth=minor?8:9;
    const chord=new Set([[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]][bar]);
    for(const n of inBar(song,'bass',bar))assert.ok(chord.has(n.concrete.midi_pitch%12),`${id}/${scale_type}/${bar}`);
   }
  }
  const own={id:'held-rhythm',role:'bass',patch_id:'sampled_bass_v1',step:0,duration_steps:15,performance:{version:1,offset_steps:.2},velocity:.61,provenance:'user_placed',concrete:{midi_pitch:48},pitch_lock_mode:'concrete'};
  base.notes.push(own);const edited=setJamDirection(base,{scene_variant:'answer'});
  assert.deepEqual(edited.notes.find(n=>n.id===own.id),own);
  assert.ok(!edited.notes.some(n=>n.role==='bass'&&n.id!==own.id&&n.step<15));
 }
});
