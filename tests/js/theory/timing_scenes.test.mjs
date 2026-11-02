import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {INSTRUMENTS} from '../../../static/js/theory/instrument_catalogue.js';
const ids=['uk-garage-v1','two-step-v1','breakbeat-v1'];
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,density:3,responsive:false});
const at=n=>n.step+n.performance.offset_steps;
const part=(song,role,bar)=>song.notes.filter(n=>n.role===role&&n.step>=bar*16&&n.step<(bar+1)*16);
test('four-kick and two-step garage retain different kick, bass and chord timing',()=>{
 const garage=make(ids[0]),two=make(ids[1]);
 assert.deepEqual(part(garage,'drums',0).filter(n=>n.patch_id==='kick').map(at),[0,4,8,12]);
 assert.deepEqual(part(two,'drums',0).filter(n=>n.patch_id==='kick').map(at),[0,7,10]);
 assert.deepEqual(part(garage,'bass',0).map(at),[0,5.5,8,13.5]);
 assert.deepEqual(part(two,'bass',0).map(at),[1.5,6,11.5]);
 assert.deepEqual([...new Set(part(garage,'harmony',0).map(at))],[2.5,6.5,10.5]);
 const sparse=setJamDirection(garage,{density:0});assert.ok(part(sparse,'harmony',0).every(n=>at(n)%1===.5));
});
test('two-step answer replaces attacks; breakbeat turnaround retains quiet unique ghost attacks',()=>{
 const two=setJamDirection(make(ids[1]),{scene_variant:'answer'});
 const bass=part(two,'bass',3).map(n=>at(n)-48);assert.ok(bass.includes(13.5));assert.ok(!bass.includes(13));
 const harmony=part(two,'harmony',3).map(n=>at(n)-48);assert.ok(harmony.includes(11.5));assert.ok(!harmony.includes(11));
 const beat=setJamDirection(make(ids[2]),{scene_variant:'answer'}),snare=part(beat,'drums',3).filter(n=>n.patch_id==='snare');
 assert.deepEqual(snare.map(n=>at(n)-48),[4,12,14.5,15.5]);
 assert.equal(snare[2].velocity/snare[0].velocity,.3);assert.ok(Math.abs(snare[3].velocity/snare[0].velocity-.2)<1e-12);
 const event=compileSongStandalone(beat).events.find(e=>e.id===snare[3].id);
 assert.equal(event.start_sec,Math.round(63.5*15/beat.global_context.bpm*1e6)/1e6);
});
test('timing recipes have distinct controls, supported voices and local chord tones',()=>{
 const patches=new Set(INSTRUMENTS.map(i=>i.patchId));
 for(const id of ids){
  const base=make(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(base,{[field]:v})).events))).size,5,`${id}/${field}`);
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(base,{scene_variant})).events))).size,3,id);
  for(const scale_type of ['major','natural_minor'])for(let color=0;color<5;color++){
   const input=structuredClone(base);input.global_context.scale_type=scale_type;
   const song=setJamDirection(input,{color}),minor=scale_type==='natural_minor',third=minor?3:4,sixth=minor?8:9;
   for(const note of song.notes)assert.ok(patches.has(note.patch_id),note.patch_id);
   for(let bar=0;bar<4;bar++){
    const chord=new Set([[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]][bar]);
    for(const role of ['bass','harmony'])for(const n of part(song,role,bar))assert.ok(chord.has(n.concrete.midi_pitch%12),`${id}/${role}/${scale_type}/${bar}`);
   }
  }
 }
});
