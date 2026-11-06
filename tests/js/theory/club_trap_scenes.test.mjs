import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const ids=['jersey-club-v1','trap-v1'];
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,density:2,color:0,responsive:false});
const at=n=>n.step+n.performance.offset_steps;
const positions=(song,patch,bar)=>song.notes.filter(n=>n.patch_id===patch&&n.step>=bar*16&&n.step<(bar+1)*16).map(n=>at(n)-bar*16).sort((a,b)=>a-b);

test('Jersey unequal kick spacing and trap rational rolls retain separate identities',()=>{
 const jersey=make(ids[0]),trap=make(ids[1]);
 for(let bar=0;bar<4;bar++)assert.deepEqual(positions(jersey,'kick',bar),[0,4,8,11,14]);
 const roll=positions(trap,'hat_closed',1).filter(x=>x>=14);
 assert.equal(roll.length,3);
 for(let i=0;i<3;i++)assert.ok(Math.abs(roll[i]-(14+2*i/3))<1e-12);
 const dense=setJamDirection(trap,{density:4});
 assert.deepEqual(positions(dense,'hat_closed',3).filter(x=>x>=14),[14,14.5,15,15.5]);
 assert.deepEqual(positions(trap,'snare',0),[8]);
 assert.ok(trap.notes.filter(n=>n.role==='bass').every(n=>n.patch_id==='clean_bass'));
});

test('rational rolls and personal holds survive direction edits and portable reopening',()=>{
 for(const id of ids){
  const song=make(id);song.global_context.bpm=100;
  const own={id:'jam-user-club-hold',role:'lead',patch_id:'sampled_piano_v1',step:14,duration_steps:6.25,velocity:.61,concrete:{midi_pitch:66},pitch_lock_mode:'concrete',performance:{version:1,offset_steps:.125},provenance:'user_placed'};
  song.notes.push(own);const edited=setJamDirection(song,{color:3,scene_variant:'answer'});
  assert.deepEqual(edited.notes.find(n=>n.id===own.id),own);
  const reopened=parseProjectJson(exportProjectJson(edited));assert.equal(reopened.ok,true);
  assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(edited).events);
  const event=compileSongStandalone(edited).events.find(e=>e.id===own.id);
  assert.ok(Math.abs(event.start_sec-2.11875)<1e-6);assert.equal(event.duration_sec,.9375);
 }
});

test('club controls remain distinct without IDs and never double an attack',()=>{
 const signature=s=>JSON.stringify(compileSongStandalone(s).events.map(({id,source_note_id,...e})=>e));
 for(const id of ids){
  const base=make(id);
  for(const scene_variant of ['base','answer','space']){
   const variant=setJamDirection(base,{scene_variant});
   for(const field of ['density','color'])assert.equal(new Set([0,1,2,3,4].map(v=>signature(setJamDirection(variant,{[field]:v})))).size,5,`${id}/${scene_variant}/${field}`);
  }
  for(let density=0;density<5;density++)for(let color=0;color<5;color++){
   assert.equal(new Set(['base','answer','space'].map(scene_variant=>signature(setJamDirection(base,{density,color,scene_variant})))).size,3);
   for(const scene_variant of ['base','answer','space']){
    const notes=setJamDirection(base,{density,color,scene_variant}).notes;
    assert.equal(new Set(notes.map(n=>`${n.role}/${n.patch_id}/${at(n)}/${n.concrete.midi_pitch}`)).size,notes.length);
    assert.ok(notes.every(n=>at(n)<64));
   }
  }
 }
});
