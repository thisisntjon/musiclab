import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION,compatibleSceneIndices} from '../../../static/js/theory/scene_catalogue.js';
import {startJam,setJamDirection,jamDirectionKey} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const legacy=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',style_spectrum:0,responsive:false});
const scene=()=>setJamDirection(legacy(),{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'bluegrass-v1'});
test('new scene is reachable beyond legacy ceiling and preserves old four mappings',()=>{
 assert.equal(SCENE_CATALOGUE.length,78);
 for(let index=0;index<4;index++){
  const old=setJamDirection(legacy(),{style_spectrum:index});
  const expanded=setJamDirection(old,{scene_catalogue:SCENE_CATALOGUE_VERSION,style_spectrum:index});
  assert.deepEqual(expanded.notes,old.notes);
  assert.equal(expanded.jam_session.scene_id,`contrast-${index}`);
 }
 const b=scene();assert.equal(b.jam_session.style_spectrum,4);assert.match(jamDirectionKey(b),/bluegrass-v1/);
 assert.equal(setJamDirection(legacy(),{style_spectrum:4}).jam_session.style_spectrum,3);
 for(const neighbor of compatibleSceneIndices(4))assert.ok(compatibleSceneIndices(neighbor).includes(4));
 assert.ok(!compatibleSceneIndices(3).includes(4));
});
test('bluegrass sketch is a string-band roll and chop, not another drum patch swap',()=>{
 const b=scene();assert.ok(!b.notes.some(n=>n.role==='drums'));
 const roll=b.notes.filter(n=>n.role==='harmony'&&n.patch_id==='sampled_banjo_v1');
 assert.equal(roll.length,32);assert.equal(new Set(roll.filter(n=>n.step<16).map(n=>n.concrete.midi_pitch)).size,3);
 assert.ok(b.notes.some(n=>n.patch_id==='sampled_guitar_v1'&&n.step===4));
 assert.equal(b.notes.filter(n=>n.role==='bass').length,8);
 for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(b,{[field]:v})).events))).size,5);
 const answer=setJamDirection(b,{scene_variant:'answer'});
 assert.deepEqual(answer.notes.filter(n=>n.step<48),b.notes.filter(n=>n.step<48));
 assert.notDeepEqual(compileSongStandalone(answer).events,compileSongStandalone(b).events);
 assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(b,{scene_variant})).events))).size,3);
});
test('scene ID, personal held notes and exact compiled output survive reopening',()=>{
 const b=scene(),own={id:'personal',role:'harmony',patch_id:'sampled_banjo_v1',step:1,duration_steps:14,velocity:.6,concrete:{midi_pitch:60},pitch_lock_mode:'concrete',provenance:'user_placed',performance:{version:1,offset_steps:.3}};
 b.notes.push(own);
 const edited=setJamDirection(b,{color:2});assert.deepEqual(edited.notes.find(n=>n.id===own.id),own);
 assert.deepEqual(setJamDirection(b,{scene_variant:'answer'}).notes.find(n=>n.id===own.id),own);
 assert.ok(!edited.notes.some(n=>n.role==='harmony'&&n.id!=='personal'&&n.step>1&&n.step<15));
 const reopened=parseProjectJson(exportProjectJson(edited));assert.equal(reopened.ok,true);
 assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(edited).events);
 assert.deepEqual(setJamDirection(reopened.song).notes,edited.notes);
 for(const patch of [{scene_id:'unknown'},{scene_catalogue:'future'},{style_spectrum:0}]){
  const bad=structuredClone(b);Object.assign(bad.jam_session,patch);assert.equal(parseProjectJson(JSON.stringify(bad)).ok,false);
 }
});

test('ska has its own moving bass and clipped offbeats with meaningful controls and preserved personal holds',()=>{
 const ska=setJamDirection(scene(),{scene_id:'ska-v1'});
 const first=ska.notes.filter(n=>n.step<16);
 assert.deepEqual(first.filter(n=>n.role==='bass').map(n=>n.step),[0,4,8,12]);
 assert.ok(new Set(first.filter(n=>n.role==='bass').map(n=>n.concrete.midi_pitch)).size>2);
 assert.deepEqual([...new Set(first.filter(n=>n.role==='harmony').map(n=>n.step))],[2,6,10,14]);
 assert.ok(first.filter(n=>n.role==='harmony').every(n=>n.duration_steps===.55));
 assert.deepEqual(first.filter(n=>n.patch_id==='snare').map(n=>n.step),[4,12]);
 for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(ska,{[field]:v})).events))).size,5);
 assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(ska,{scene_variant})).events))).size,3);
 const own={id:'ska-personal',role:'bass',patch_id:'sampled_bass_v1',step:1,duration_steps:14,velocity:.6,concrete:{midi_pitch:48},pitch_lock_mode:'concrete',provenance:'user_placed',performance:{version:1,offset_steps:.3}};
 ska.notes.push(own);
 const edited=setJamDirection(ska,{scene_variant:'answer',color:2});
 assert.deepEqual(edited.notes.find(n=>n.id===own.id),own);
 assert.ok(!edited.notes.some(n=>n.role==='bass'&&n.id!==own.id&&n.step<15));
 const reopened=parseProjectJson(exportProjectJson(edited));assert.equal(reopened.ok,true);
 assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(edited).events);
 for(const neighbor of compatibleSceneIndices(5))assert.ok(compatibleSceneIndices(neighbor).includes(5));
 assert.notDeepEqual(compileSongStandalone(ska).events,compileSongStandalone(setJamDirection(ska,{scene_id:'contrast-0'})).events);
});

test('new-session mix is versioned, changes generated velocities only and round-trips exactly',()=>{
 for(const {id} of SCENE_CATALOGUE){
  const old=setJamDirection(scene(),{scene_id:id});
  const personal={...old.notes.find(n=>n.role==='lead'),id:'mix-personal',provenance:'user_placed',velocity:.43};
  delete personal.generated_by;
  old.notes.push(personal);
  const before=setJamDirection(old),mixed=setJamDirection(old,{scene_mix:SCENE_MIX_VERSION});
  assert.deepEqual(mixed.notes.find(n=>n.id===personal.id),personal);
  assert.deepEqual(mixed.notes.map(({velocity,...note})=>note),before.notes.map(({velocity,...note})=>note));
  if(before.notes.some(n=>n.role==='drums')||id==='bluegrass-v1')assert.notDeepEqual(mixed.notes,before.notes);
  else assert.deepEqual(mixed.notes,before.notes,'a drumless recipe needs no drum mix adjustment');
  assert.deepEqual(setJamDirection(before).notes,before.notes,'legacy output is stable');
  const reopened=parseProjectJson(exportProjectJson(mixed));assert.equal(reopened.ok,true);
  assert.deepEqual(setJamDirection(reopened.song).notes,mixed.notes);
  assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(mixed).events);
  const bad=structuredClone(mixed);bad.jam_session.scene_mix='future';assert.equal(parseProjectJson(JSON.stringify(bad)).ok,false);
 }
});

test('rocksteady keeps bass rests and different gates from ska, with three distinct phrases',()=>{
 const rock=setJamDirection(scene(),{scene_id:'rocksteady-v1',scene_mix:SCENE_MIX_VERSION});
 const bass=rock.notes.filter(n=>n.role==='bass'&&n.step<16);
 assert.deepEqual(bass.map(n=>[n.step,n.duration_steps]),[[0,4],[6,2],[10,3],[14,1]]);
 for(let density=0;density<5;density++)assert.deepEqual(setJamDirection(rock,{density}).notes.filter(n=>n.role==='bass'),rock.notes.filter(n=>n.role==='bass'));
 for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(rock,{[field]:v})).events))).size,5);
 assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(rock,{scene_variant})).events))).size,3);
 const ska=setJamDirection(rock,{scene_id:'ska-v1'});
 assert.notDeepEqual(ska.notes.filter(n=>n.role==='bass'),rock.notes.filter(n=>n.role==='bass'));
 assert.deepEqual(ska.notes.filter(n=>n.role==='lead').map(({id,...n})=>n),rock.notes.filter(n=>n.role==='lead').map(({id,...n})=>n));
 for(const neighbor of compatibleSceneIndices(6))assert.ok(compatibleSceneIndices(neighbor).includes(6));
 for(const scale_type of ['major','natural_minor'])for(const scene_variant of ['base','answer','space']){
  const input=structuredClone(rock);input.global_context.scale_type=scale_type;
  const song=setJamDirection(input,{scene_variant});
  for(let bar=0;bar<4;bar++){
   const inBar=n=>n.step>=bar*16&&n.step<(bar+1)*16;
   const harmony=new Set(song.notes.filter(n=>n.role==='harmony'&&inBar(n)).map(n=>n.concrete.midi_pitch%12));
   for(const note of song.notes.filter(n=>n.role==='bass'&&inBar(n)))assert.ok(harmony.has(note.concrete.midi_pitch%12),`${scale_type}/${scene_variant}/bar${bar}: bass must use the local chord`);
  }
 }
});
