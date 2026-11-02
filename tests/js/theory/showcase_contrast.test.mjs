import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const fresh=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',style_spectrum:0,responsive:false});
test('offbeat composition has beat-three drum anchor and articulated banjo chords',()=>{
 const d=fresh();
 assert.deepEqual([...new Set(d.notes.filter(n=>n.patch_id==='kick').map(n=>n.step%16))],[8]);
 assert.deepEqual([...new Set(d.notes.filter(n=>n.patch_id==='snare').map(n=>n.step%16))],[8]);
 const banjo=d.notes.filter(n=>n.patch_id==='sampled_banjo_v1');
 assert.equal(banjo.length,64);
 assert.deepEqual([...new Set(banjo.map(n=>n.step%16))],[2,6,10,14]);
 assert.ok(banjo.every(n=>n.duration_steps===.65));
 assert.deepEqual(banjo.slice(0,4).map(n=>n.performance.offset_steps),[0,.045,.09,.135]);
});
test('each rhythm differs and has accents while the motif survives A-B-A and persistence',()=>{
 const a=fresh(), signatures=[];
 for(let style_spectrum=0;style_spectrum<4;style_spectrum++){
  const b=setJamDirection(a,{style_spectrum});
  signatures.push(JSON.stringify(b.notes.filter(n=>n.role==='drums').map(n=>[n.patch_id,n.step,n.velocity])));
  assert.deepEqual(b.notes.filter(n=>n.role==='lead'),a.notes.filter(n=>n.role==='lead'));
  for(const role of ['drums','bass','harmony','lead'])assert.ok(new Set(b.notes.filter(n=>n.role===role).map(n=>n.velocity)).size>1);
  assert.deepEqual(setJamDirection(b,{style_spectrum:0}).notes,a.notes);
  const parsed=parseProjectJson(exportProjectJson(b));assert.equal(parsed.ok,true);
  assert.deepEqual(compileSongStandalone(parsed.song).events,compileSongStandalone(b).events);
 }
 assert.equal(new Set(signatures).size,4);
});
test('all contrast controls act, personal holds survive, old arrangement stays old',()=>{
 const a=fresh();
 for(let style_spectrum=0;style_spectrum<4;style_spectrum++)for(const field of ['color','density']){
  const b=setJamDirection(a,{style_spectrum});
  assert.equal(new Set(Array.from({length:5},(_,n)=>JSON.stringify(compileSongStandalone(setJamDirection(b,{[field]:n})).events))).size,5);
 }
 const own={id:'mine',role:'harmony',patch_id:'sampled_banjo_v1',step:1,duration_steps:15,concrete:{midi_pitch:60},pitch_lock_mode:'concrete',provenance:'user_placed',velocity:.6,performance:{version:1,offset_steps:.2}};
 a.notes.push(own);const changed=setJamDirection(a,{style_spectrum:.2});
 assert.deepEqual(changed.notes.find(n=>n.id==='mine'),own);
 assert.ok(changed.notes.filter(n=>n.role==='harmony'&&n.id!=='mine').every(n=>n.step>=17));
 const old=setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',style_spectrum:0});
 assert.ok(!old.notes.some(n=>n.patch_id==='sampled_banjo_v1'));
 assert.ok(old.notes.filter(n=>n.role==='lead').every(n=>n.velocity===.28));
 const invalid=fresh();invalid.jam_session.showcase_arrangement='future';
 assert.equal(parseProjectJson(JSON.stringify(invalid)).ok,false);
});
