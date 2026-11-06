import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {rootsWalk} from '../../../static/js/theory/roots_timing_scenes.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {INSTRUMENTS} from '../../../static/js/theory/instrument_catalogue.js';
const ids=['swing-v1','western-swing-v1','piedmont-v1'];
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,density:2,responsive:false});
const part=(song,role,bar)=>song.notes.filter(n=>n.role===role&&n.step>=bar*16&&n.step<(bar+1)*16);
const at=n=>n.step+n.performance.offset_steps;
test('authored walks retain exact C fixtures and bounded scale approaches under transposition',()=>{
 assert.deepEqual(rootsWalk(0,false,false),[[36,40,43,43],[45,48,52,43],[41,45,48,45],[43,47,50,38]]);
 assert.deepEqual(rootsWalk(0,true,false),[[36,39,43,46],[44,48,51,43],[41,44,48,41],[43,46,50,38]]);
 assert.deepEqual(rootsWalk(0,false,true),[[48,43,40,47],[45,40,48,43],[41,48,45,41],[43,38,47,50]]);
 assert.deepEqual(rootsWalk(0,true,true),[[48,43,39,46],[44,39,48,43],[41,48,44,41],[43,38,46,50]]);
 for(let root=0;root<12;root++)for(const minor of [false,true])for(const western of [false,true]){
  const walk=rootsWalk(root,minor,western),scale=(minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11]).map(n=>(n+root)%12);
  for(let bar=0;bar<4;bar++){
   assert.ok(walk[bar].every(p=>p>=36&&p<=55));
   assert.ok([1,2].includes(Math.abs(walk[bar][3]-walk[(bar+1)%4][0])));
   assert.ok(scale.includes(walk[bar][3]%12));
  }
 }
});
test('swing broken comp differs from western guitar quarters and explicit chord colors',()=>{
 const swing=make(ids[0]),western=make(ids[1]);
 assert.ok(part(swing,'drums',0).some(n=>Math.abs(at(n)-20/3)<1e-10));
 assert.deepEqual([...new Set(part(swing,'harmony',0).filter(n=>n.patch_id==='sampled_electric_piano_v1').map(at))],[0,20/3]);
 for(const scale_type of ['major','natural_minor']){
  const input=structuredClone(western);input.global_context.scale_type=scale_type;
  const song=setJamDirection(input),extension=scale_type==='major'?[9,7,2,5]:[10,5,3,5];
  for(let bar=0;bar<4;bar++){
   const guitar=part(song,'harmony',bar).filter(n=>n.patch_id==='sampled_guitar_v1');
   assert.deepEqual([...new Set(guitar.map(n=>at(n)-bar*16))],[0,4,8,12]);
   assert.ok(guitar.some(n=>n.concrete.midi_pitch%12===extension[bar]));
  }
 }
});
test('Piedmont separates bounded low guitar quarters from upper syncopation and protects both roles',()=>{
 const song=make(ids[2]);
 assert.ok(!song.notes.some(n=>n.role==='drums'));
 for(let bar=0;bar<4;bar++){
  const bass=part(song,'bass',bar),high=part(song,'harmony',bar);
  assert.deepEqual(bass.map(n=>at(n)-bar*16),[0,4,8,12]);
  assert.ok(bass.every(n=>n.patch_id==='sampled_guitar_v1'&&n.concrete.midi_pitch>=40&&n.concrete.midi_pitch<=55));
  assert.ok(high.every(n=>n.patch_id==='sampled_guitar_v1'&&n.concrete.midi_pitch>=60&&n.concrete.midi_pitch<=76));
 }
 const own=[{id:'own-low',role:'bass',step:3,duration_steps:4},{id:'own-high',role:'harmony',step:8,duration_steps:5}].map(n=>({...n,patch_id:'sampled_guitar_v1',velocity:.6,concrete:{midi_pitch:64},pitch_lock_mode:'concrete',performance:{version:1,offset_steps:0},provenance:'user_placed'}));
 song.notes.push(...own);
 for(const scene_variant of ['base','answer','space']){
  const edited=setJamDirection(song,{scene_variant,density:4});
  for(const n of own)assert.deepEqual(edited.notes.find(e=>e.id===n.id),n);
  assert.ok(!edited.notes.some(n=>n.provenance==='jam_generated'&&n.role==='bass'&&n.step===4));
  assert.ok(!edited.notes.some(n=>n.provenance==='jam_generated'&&n.role==='harmony'&&at(n)>=8&&at(n)<13));
 }
});
test('roots recipes offer distinct controls and registered patches without identity-only differences',()=>{
 const patches=new Set(INSTRUMENTS.map(i=>i.patchId));
 const signature=song=>JSON.stringify(compileSongStandalone(song).events.map(({id,source_note_id,...event})=>event));
 for(const id of ids){
  const base=make(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,value)=>signature(setJamDirection(base,{[field]:value})))).size,5,`${id}/${field}`);
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>signature(setJamDirection(base,{scene_variant})))).size,3,id);
  for(let color=0;color<5;color++)for(const n of setJamDirection(base,{color,density:4}).notes)assert.ok(patches.has(n.patch_id),n.patch_id);
 }
});
test('responsive Piedmont guitar answers keep pitch class in guitar range without changing the player',()=>{
 for(let pitch=60;pitch<72;pitch++){
  const song=make('piedmont-v1');
  const own={id:`jam-user-played-${pitch}`,role:'lead',patch_id:'sampled_piano_v1',step:0,duration_steps:2,velocity:.67,concrete:{midi_pitch:pitch},pitch_lock_mode:'concrete',performance:{version:1,offset_steps:.25},provenance:'user_placed'};
  song.notes.push(own);
  const result=setJamDirection(song,{responsive:true}),replies=result.notes.filter(n=>n.response_to?.includes(own.id));
  assert.ok(replies.length);
  assert.deepEqual(result.notes.find(n=>n.id===own.id),own);
  for(const n of replies){
   assert.equal(n.patch_id,'sampled_guitar_v1');assert.equal(n.response_version,'gap-answer-guitar-v1');
   assert.ok(n.concrete.midi_pitch>=40&&n.concrete.midi_pitch<=55);
   assert.equal(n.concrete.midi_pitch%12,pitch%12);assert.ok(at(n)>=2.25);
  }
 }
});
