import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const ids=['drum-and-bass-v1','jungle-v1','liquid-dnb-v1'];
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,density:2,color:0,responsive:false});
const at=n=>n.step+n.performance.offset_steps;
const part=(song,role,bar)=>song.notes.filter(n=>n.role===role&&n.step>=bar*16&&n.step<(bar+1)*16);
test('two fast drum bars occupy one unchanged application bar with exact substeps',()=>{
 const dnb=make(ids[0]),jungle=make(ids[1]);
 assert.deepEqual(part(dnb,'drums',0).filter(n=>n.patch_id==='kick').map(at),[0,5,8,12.5,15]);
 assert.deepEqual(part(dnb,'drums',0).filter(n=>n.patch_id==='snare').map(at),[2,3.5,6,7.5,9.5,10,13.5,14]);
 const snares=part(jungle,'drums',0).filter(n=>n.patch_id==='snare');
 assert.ok(snares.some(n=>at(n)===15.25));assert.ok(snares.some(n=>at(n)===15.75));
 for(const id of ids)for(const bpm of [85,100,400]){
  const input=make(id);input.global_context.bpm=bpm;
  const own={id:'jam-user-fixed-clock',role:'lead',patch_id:'sampled_piano_v1',step:1,duration_steps:5.5,velocity:.63,concrete:{midi_pitch:66},pitch_lock_mode:'concrete',performance:{version:1,offset_steps:.25},provenance:'user_placed'};
  input.notes.push(own);const song=setJamDirection(input),event=compileSongStandalone(song).events.find(e=>e.id===own.id);
  assert.deepEqual(song.notes.find(n=>n.id===own.id),own);
  assert.equal(song.global_context.bpm,bpm);assert.equal(event.start_sec,Math.round(1.25*15/bpm*1e6)/1e6);
  assert.ok(Math.abs(event.duration_sec-5.5*15/bpm)<1e-6);
 }
});
test('liquid sustains common voices and moves only one voice into the explicit second sonority',()=>{
 const second={major:[[62,64,71],[59,60,67],[55,57,64],[57,59,65]],natural_minor:[[62,63,70],[58,60,67],[55,56,63],[53,58,62]]};
 for(const scale_type of Object.keys(second))for(const root_pc of [0,2]){
  const input=make(ids[2]);Object.assign(input.global_context,{scale_type,root_pc});const song=setJamDirection(input);
  for(let bar=0;bar<4;bar++){
   const notes=part(song,'harmony',bar),time=bar*16+8;
   assert.equal(notes.filter(n=>at(n)===time).length,1);
   assert.equal(notes.filter(n=>n.duration_steps===14).length,2);
   const sounding=notes.filter(n=>at(n)<=time&&at(n)+n.duration_steps>time).map(n=>n.concrete.midi_pitch).sort((a,b)=>a-b);
   assert.deepEqual(sounding,second[scale_type][bar].map(p=>p+root_pc));
  }
 }
});
test('fast recipes respect the event budget and retain meaningful controls without duplicate attacks',()=>{
 const signature=s=>JSON.stringify(compileSongStandalone(s).events.map(({id,source_note_id,...e})=>e));
 for(const id of ids){
  const base=make(id);
  for(const scene_variant of ['base','answer','space']){
   const variant=setJamDirection(base,{scene_variant});
   assert.equal(new Set(Array.from({length:5},(_,density)=>signature(setJamDirection(variant,{density})))).size,5,`${id}/${scene_variant}/density`);
   assert.equal(new Set(Array.from({length:5},(_,color)=>signature(setJamDirection(variant,{color})))).size,5,`${id}/${scene_variant}/color`);
   for(let density=0;density<5;density++)for(let color=0;color<5;color++){
    const song=setJamDirection(variant,{density,color});
    assert.ok(song.notes.length<=300);assert.ok(song.notes.filter(n=>n.role==='drums').length<=220);
    assert.ok(song.notes.every(n=>at(n)<64));
    assert.equal(new Set(song.notes.map(n=>`${n.role}/${n.patch_id}/${at(n)}/${n.concrete.midi_pitch}`)).size,song.notes.length);
   }
  }
  for(let density=0;density<5;density++)for(let color=0;color<5;color++)assert.equal(new Set(['base','answer','space'].map(scene_variant=>signature(setJamDirection(base,{density,color,scene_variant})))).size,3,`${id}/${density}/${color}/variants`);
 }
});
