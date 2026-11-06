import test from 'node:test';
import {INSTRUMENTS} from '../../../static/js/theory/instrument_catalogue.js';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const ids=['new-wave-v1','early-rnb-v1','soul-v1'];
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,density:2,responsive:false});
const part=(song,role,bar)=>song.notes.filter(n=>n.role===role&&n.step>=bar*16&&n.step<(bar+1)*16);

test('new-wave octave bass and guitar/synth interlock use distinct played positions',()=>{
 const song=make(ids[0]);
 assert.deepEqual(part(song,'bass',0).map(n=>n.concrete.midi_pitch),[36,48,36,43,36,48,43,36]);
 const harmony=part(song,'harmony',0);
 assert.deepEqual([...new Set(harmony.filter(n=>n.patch_id==='sampled_guitar_v1').map(n=>n.step))],[3,7,11,15]);
 assert.deepEqual([...new Set(harmony.filter(n=>n.patch_id==='pluck_lead').map(n=>n.step))],[0,10]);
});
test('early R&B has a two-bar bass response while soul retains a long-note line',()=>{
 const rnb=make(ids[1]),soul=make(ids[2]);
 assert.deepEqual(part(rnb,'bass',0).map(n=>n.step),[0,3,4,8,11,12]);
 assert.deepEqual(part(rnb,'bass',1).map(n=>n.step-16),[0,3,4,8,10,14]);
 assert.deepEqual(part(soul,'bass',0).map(n=>[n.step,n.duration_steps]),[[0,5],[7,2],[10,3]]);
 assert.equal(part(soul,'harmony',0).filter(n=>n.patch_id==='sampled_guitar_v1').length,0);
 assert.deepEqual([...new Set(part(soul,'harmony',1).filter(n=>n.patch_id==='sampled_guitar_v1').map(n=>n.step-16))],[10,14]);
});
test('response recipes expose distinct controls and local chord tones in both supported contexts',()=>{
 for(const id of ids){
  const base=make(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>JSON.stringify(compileSongStandalone(setJamDirection(base,{[field]:v})).events))).size,5,`${id}/${field}`);
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>JSON.stringify(compileSongStandalone(setJamDirection(base,{scene_variant})).events))).size,3,id);
  for(const scale_type of ['major','natural_minor'])for(const scene_variant of ['base','answer','space']){
   const input=structuredClone(base);input.global_context.scale_type=scale_type;
   const song=setJamDirection(input,{scene_variant}),minor=scale_type==='natural_minor',third=minor?3:4,sixth=minor?8:9;
   for(let bar=0;bar<4;bar++){
    const chord=new Set([[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]][bar]);
    for(const role of ['bass','harmony'])for(const note of part(song,role,bar))assert.ok(chord.has(note.concrete.midi_pitch%12),`${id}/${role}/${scale_type}/${bar}`);
   }
  }
 }
});

test('every response tone uses a registered voice rather than renderer fallback',()=>{
 const patches=new Set(INSTRUMENTS.map(instrument=>instrument.patchId));
 for(const id of ids)for(let color=0;color<5;color++){
  const song=setJamDirection(make(id),{color,density:4});
  for(const note of song.notes)assert.ok(patches.has(note.patch_id),`${id}/${color}/${note.patch_id}`);
 }
});
