import test from 'node:test';
import assert from 'node:assert/strict';
import {startJam,setJamDirection,jamDirectionKey} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const fresh=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',style_spectrum:0,responsive:false});
test('showcase changes band roles while retaining one melodic identity, reversibly',()=>{
 const a=fresh(), melody=doc=>doc.notes.filter(n=>n.role==='lead');
 const signatures=[];
 for(const style_spectrum of [0,1,2,3]){
  const b=setJamDirection(a,{style_spectrum});
  assert.deepEqual(melody(b),melody(a));
  signatures.push(JSON.stringify(b.notes.filter(n=>n.role!=='lead')));
  assert.equal(new Set(b.notes.map(n=>n.id)).size,b.notes.length);
  assert.deepEqual(setJamDirection(b,{style_spectrum:0}).notes,a.notes);
 }
 assert.equal(new Set(signatures).size,4);
 assert.match(jamDirectionKey(a),/^showcase-v1:/);
});
test('showcase keeps personal held intervals, attribution and editable save roundtrip',()=>{
 const a=fresh();
 const own={id:'jam-user-personal-hold',role:'lead',patch_id:'sampled_piano_v1',step:1,duration_steps:14.3,
  velocity:.6,concrete:{midi_pitch:67},pitch_lock_mode:'concrete',provenance:'user_placed',performance:{version:1,offset_steps:.4}};
 a.notes.push(own);
 for(const style_spectrum of [0,.3,.6,.8,1,2,3]){
  const b=setJamDirection(a,{style_spectrum});
  assert.deepEqual(b.notes.find(n=>n.id===own.id),own);
  assert.ok(b.notes.filter(n=>n.role==='lead'&&n.id!==own.id).every(n=>n.step>=15.7||n.step+n.duration_steps<=1.4));
  const saved=parseProjectJson(exportProjectJson(b));assert.equal(saved.ok,true);
  assert.deepEqual(compileSongStandalone(saved.song).events,compileSongStandalone(b).events);
  assert.deepEqual(setJamDirection(saved.song).notes,b.notes);
 }
});
test('showcase never doubles competing bass or drum attacks at intermediate positions',()=>{
 for(let i=0;i<=30;i++){
  const b=setJamDirection(fresh(),{style_spectrum:i/10});
  const keys=b.notes.filter(n=>['bass','drums'].includes(n.role)).map(n=>`${n.role}:${n.role==='drums'?n.patch_id:''}:${n.step}`);
  assert.equal(new Set(keys).size,keys.length);
 }
});
test('old jams do not opt into showcase and tone control changes compiled harmony',()=>{
 const old=setJamDirection(startJam(newPlayDoc()),{style_spectrum:0});
 assert.equal(old.jam_session.showcase_version,undefined);
 assert.ok(old.notes.every(n=>!n.id.startsWith('showcase-')));
 const a=fresh(), signature=d=>compileSongStandalone(d).events.filter(n=>n.role==='harmony');
 assert.notDeepEqual(signature(a),signature(setJamDirection(a,{color:3})));
});
test('every showcased density and tone choice changes compiled events; unsupported versions reject',()=>{
 for(const style_spectrum of [0,1,2,3])for(const field of ['color','density']){
  const a=setJamDirection(fresh(),{style_spectrum});
  const signatures=Array.from({length:5},(_,value)=>JSON.stringify(compileSongStandalone(setJamDirection(a,{[field]:value})).events));
  assert.equal(new Set(signatures).size,5,`${style_spectrum} ${field}`);
 }
 for(const change of [{showcase_version:2},{showcase_palette:'unknown'}]){
  const a=fresh();Object.assign(a.jam_session,change);
  assert.equal(parseProjectJson(JSON.stringify(a)).ok,false);
 }
});
