import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {SAMPLED_PROGRAMS,pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:'indie-rock-v1',density:2,color:0,responsive:false});
const at=n=>n.step+n.performance.offset_steps;
test('indie ringing arpeggio keeps exact onset/pitch associations and fourth-bar space',()=>{
 const expected={major:[[60,67,64,67,64,72],[64,60,69,60,64,57],[65,72,69,72,69,77],[62,59,67,55]],natural_minor:[[60,67,63,67,63,72],[63,60,68,60,63,56],[65,72,68,72,68,77],[62,58,67,55]]};
 for(const scale_type of Object.keys(expected)){
  const input=make();input.global_context.scale_type=scale_type;const song=setJamDirection(input);
  for(let bar=0;bar<4;bar++){
   const notes=song.notes.filter(n=>n.role==='harmony'&&n.step>=bar*16&&n.step<(bar+1)*16);
   assert.deepEqual(notes.map(n=>n.concrete.midi_pitch),expected[scale_type][bar]);
   assert.deepEqual(notes.map(n=>at(n)-bar*16),bar===3?[0,3,6,14]:[0,3,6,8,11,14]);
   assert.ok(notes.every(n=>n.patch_id==='sampled_clean_guitar_v1'));
  }
 }
});
test('new program27 identity survives editing/reopening without changing legacy24',()=>{
 assert.equal(SAMPLED_PROGRAMS.sampled_guitar_v1,24);assert.equal(SAMPLED_PROGRAMS.sampled_clean_guitar_v1,27);
 const song=make(),own={id:'jam-user-guitar',role:'lead',patch_id:'sampled_clean_guitar_v1',step:1,duration_steps:7.25,velocity:.6,concrete:{midi_pitch:66},pitch_lock_mode:'concrete',performance:{version:1,offset_steps:.25},provenance:'user_placed'};
 song.notes.push(own);const edited=setJamDirection(song,{color:3,scene_variant:'answer'});
 assert.deepEqual(edited.notes.find(n=>n.id===own.id),own);
 const reopened=parseProjectJson(exportProjectJson(edited));assert.equal(reopened.ok,true);
 assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(edited).events);
 for(const event of compileSongStandalone(edited).events.filter(e=>e.patch_id==='sampled_clean_guitar_v1'))assert.ok(pianoNotes(event).every(n=>n.program===27));
 const legacy=structuredClone(own);legacy.patch_id='sampled_guitar_v1';song.notes=[legacy];assert.equal(pianoNotes(compileSongStandalone(song).events[0])[0].program,24);
});
test('indie controls are meaningful without adding stacked guitar voices',()=>{
 const base=make(),sig=s=>JSON.stringify(compileSongStandalone(s).events.map(({id,source_note_id,...e})=>e));
 for(const scene_variant of ['base','answer','space'])for(const field of ['density','color'])assert.equal(new Set([0,1,2,3,4].map(v=>sig(setJamDirection(base,{scene_variant,[field]:v})))).size,5);
 for(let density=0;density<5;density++)for(let color=0;color<5;color++){
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>sig(setJamDirection(base,{density,color,scene_variant})))).size,3);
  for(const scene_variant of ['base','answer','space']){
   const notes=setJamDirection(base,{density,color,scene_variant}).notes;
   const guitar=notes.filter(n=>n.role==='harmony');assert.ok(guitar.length<=22);
   assert.equal(new Set(guitar.map(at)).size,guitar.length);
   assert.ok(guitar.every(n=>n.concrete.midi_pitch>=48&&n.concrete.midi_pitch<=84));
  }
 }
});
