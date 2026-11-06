import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,responsive:false});
const steps=(song,role,patch,bar=0)=>song.notes.filter(n=>n.role===role&&(!patch||n.patch_id===patch)&&n.step>=bar*16&&n.step<(bar+1)*16).map(n=>n.step-bar*16);

test('reggae adds a two-bar bass phrase and interlocking replies beyond existing offbeat strum',()=>{
 const song=make('reggae-v1');
 assert.deepEqual(steps(song,'drums','kick'),[8]);
 assert.deepEqual(steps(song,'bass'),[0,3,6,10]);
 assert.deepEqual(steps(song,'bass',null,1),[0,6,11,14]);
 assert.ok(steps(song,'harmony',null,1).includes(3));
 assert.ok(!steps(song,'harmony').includes(3));
 assert.notDeepEqual(song.notes.filter(n=>n.role==='bass'),make('contrast-0').notes.filter(n=>n.role==='bass'));
});
test('house offbeat bass and electro broken kicks retain distinct musical signatures',()=>{
 const house=make('house-v1'),electro=make('electro-v1');
 assert.deepEqual(steps(house,'drums','kick'),[0,4,8,12]);
 assert.deepEqual(steps(house,'bass'),[2,6,10,14]);
 assert.deepEqual([...new Set(steps(house,'harmony'))],[0,6,12]);
 assert.deepEqual(steps(electro,'drums','kick'),[0,6,11]);
 assert.deepEqual(steps(electro,'drums','kick',1),[0,3,10]);
 assert.ok(electro.notes.filter(n=>n.role==='bass').every(n=>n.patch_id==='clean_bass'&&n.duration_steps<=1.5));
});
test('all pulse controls are meaningful and intended bass tones belong to each local chord',()=>{
 for(const id of ['reggae-v1','house-v1','electro-v1']){
  const base=make(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(base,{[field]:v})).events))).size,5,`${id}/${field}`);
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(base,{scene_variant})).events))).size,3,id);
  for(const scale_type of ['major','natural_minor'])for(const scene_variant of ['base','answer','space']){
   const input=structuredClone(base);input.global_context.scale_type=scale_type;
   const song=setJamDirection(input,{scene_variant});
   for(let bar=0;bar<4;bar++){
    const inBar=n=>n.step>=bar*16&&n.step<(bar+1)*16;
    const harmony=new Set(song.notes.filter(n=>n.role==='harmony'&&inBar(n)).map(n=>n.concrete.midi_pitch%12));
    for(const n of song.notes.filter(n=>n.role==='bass'&&inBar(n)))assert.ok(harmony.has(n.concrete.midi_pitch%12),`${id}/${scale_type}/${scene_variant}/bar${bar}`);
   }
  }
 }
});
test('larger optional catalogue uses one labeled native selector with stable scene IDs',()=>{
 const flow=Object.create(PlayFlow.prototype);flow.doc=make('house-v1');
 const html=flow._sceneChoicesHtml(true,8);
 assert.match(html,/label for="pf-scene-picker"/);assert.match(html,/value="house-v1" selected/);
 assert.equal((html.match(/<option /g)||[]).length,78);assert.ok(!html.includes('jam-profile:'));
});
