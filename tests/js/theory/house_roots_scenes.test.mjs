import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const ids=['deep-house-v1','tech-house-v1','old-time-v1','honky-tonk-v1'];
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,responsive:false});
const inBar=(song,role,bar)=>song.notes.filter(n=>n.role===role&&n.step>=bar*16&&n.step<(bar+1)*16);
test('deep house uses explicit local sevenths; tech house displaces a two-note bass hook',()=>{
 const deep=make('deep-house-v1'),tech=make('tech-house-v1');
 for(let bar=0;bar<4;bar++)assert.ok(inBar(deep,'harmony',bar).some(n=>n.concrete.midi_pitch%12===[11,7,4,5][bar]));
 assert.ok(inBar(deep,'harmony',0).some(n=>n.duration_steps===6));
 const bass=inBar(tech,'bass',0);
 assert.deepEqual(bass.map(n=>n.step+n.performance.offset_steps),[0,3.25,6,8,11.25,14]);
 assert.equal(new Set(bass.map(n=>n.concrete.midi_pitch)).size,2);
});
test('old-time groups note/brush/thumb events with a deliberately fixed fifth drone',()=>{
 const song=make('old-time-v1');assert.ok(!song.notes.some(n=>n.role==='drums'));
 for(let bar=0;bar<4;bar++){
  const harmony=inBar(song,'harmony',bar);
  assert.equal(harmony.filter(n=>n.step===bar*16+4).length,3);
  assert.equal(harmony.filter(n=>n.step===bar*16+12).length,3);
  const drone=harmony.filter(n=>[6,14].includes(n.step-bar*16));
  assert.equal(drone.length,2);assert.ok(drone.every(n=>n.concrete.midi_pitch===67));
 }
});
test('honky-tonk explicit shuffled eighths compile at thirds rather than straight offsets',()=>{
 const song=make('honky-tonk-v1');
 const note=inBar(song,'drums',0).find(n=>n.patch_id==='hat_closed'&&n.step===2);
 assert.ok(Math.abs(note.performance.offset_steps-2/3)<1e-12);
 const event=compileSongStandalone(song).events.find(e=>e.id===note.id);
 assert.equal(event.start_sec,Math.round((8/3)*15/song.global_context.bpm*1e6)/1e6);
 assert.deepEqual(inBar(song,'bass',0).map(n=>n.step),[0,8]);
});
test('four house/roots recipes have meaningful controls and locally valid bass in both scale contexts',()=>{
 for(const id of ids){
  const base=make(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(base,{[field]:v})).events))).size,5,`${id}/${field}`);
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(base,{scene_variant})).events))).size,3,id);
  for(const scale_type of ['major','natural_minor'])for(const scene_variant of ['base','answer','space']){
   const input=structuredClone(base);input.global_context.scale_type=scale_type;
   const song=setJamDirection(input,{scene_variant}),minor=scale_type==='natural_minor',third=minor?3:4,sixth=minor?8:9;
   for(let bar=0;bar<4;bar++){
    const chord=new Set([[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]][bar]);
    for(const note of inBar(song,'bass',bar))assert.ok(chord.has(note.concrete.midi_pitch%12),`${id}/${scale_type}/bar${bar}`);
   }
  }
 }
});
