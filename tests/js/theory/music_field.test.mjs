import test from 'node:test';
import assert from 'node:assert/strict';
import {musicFieldBacking,validMusicField} from '../../../static/js/theory/music_field.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection,jamDirectionKey} from '../../../static/js/theory/jam_session.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const seed=()=>startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'});
const at=(doc,x,y=.5)=>setJamDirection(doc,{music_field:{version:1,x,y}});
const score=(x,y=.5)=>at(seed(),x,y).notes.filter(n=>n.provenance==='jam_generated');
const onset=n=>n.step+n.performance.offset_steps;
test('field coordinates validate and all endpoints/interiors compile bounded original notes',()=>{
 for(const x of[0,.01,.25,.5,.75,.99,1])for(const y of[0,.5,1]){
  const notes=score(x,y);assert.ok(notes.length>60&&notes.length<200);
  assert.equal(new Set(notes.map(n=>n.id)).size,notes.length);
  assert.ok(notes.every(n=>Number.isInteger(n.step)&&n.step>=0&&n.step<64&&n.velocity>0&&n.velocity<=1&&n.duration_steps>0));
 }
 for(const bad of[null,{},'bad',{version:1,x:Infinity,y:0},{version:1,x:-1,y:0},{version:99,x:0,y:0}])assert.ok(!validMusicField(bad));
});
test('field moves bass onset continuously and articulation independently; no second complete band',()=>{
 const pick=x=>score(x).find(n=>n.id==='music-field-v1:0:bass:36:0');
 assert.equal(onset(pick(0)),2);assert.equal(onset(pick(1)),0);
 assert.ok(Math.abs(onset(pick(.501))-onset(pick(.5)))<.003);
 const a=score(.5,0),b=score(.5,1);assert.deepEqual(a.map(n=>n.id),b.map(n=>n.id));
 assert.ok(a.some((n,i)=>n.role==='harmony'&&n.duration_steps<b[i].duration_steps));
 assert.deepEqual(a.filter(n=>n.role==='lead'),b.filter(n=>n.role==='lead'));
});
test('field preserves exact personal notes, persists coordinates, exposes realized-context value and exits explicitly',()=>{
 const doc=seed();const own={id:'personal',role:'bass',step:1,duration_steps:5,velocity:.7,patch_id:'sampled_bass_v1',concrete:{midi_pitch:38},provenance:'user_placed',performance:{version:1,offset_steps:.25}};
 doc.notes.push(own);
 for(const x of[0,.25,.5,.75,1]){
  const next=at(doc,x);assert.deepEqual(next.notes.find(n=>n.id==='personal'),own);
  assert.ok(next.notes.filter(n=>n.role==='bass'&&n.provenance==='jam_generated').every(n=>onset(n)>=6.25||onset(n)+n.duration_steps<=1.25));
  assert.equal(jamDirectionKey(next),'music-field-v1');assert.deepEqual(phraseContext(next).musicField,next.jam_session.music_field);
  const reopened=parseProjectJson(exportProjectJson(next));assert.equal(reopened.ok,true);assert.deepEqual(reopened.song.notes,next.notes);
 }
 const leave=setJamDirection(at(doc,.5),{scene_id:'house-v1'});assert.equal(leave.jam_session.music_field,undefined);
 const bad=at(doc,.5);bad.jam_session.music_field.x='0.5';assert.equal(parseProjectJson(exportProjectJson(bad)).ok,false);
});

test('no coincident generated attacks across the field; personal sources stay outside the morph',()=>{
 for(let i=0;i<=100;i++){
  const notes=score(i/100);const keys=notes.map(n=>`${n.role}:${n.patch_id}:${n.concrete.midi_pitch}:${onset(n).toFixed(7)}`);
  assert.equal(new Set(keys).size,keys.length,`duplicate attack at ${i/100}`);
 }
});

test('four-region field has distinct rhythmic anchors, no duplicate attacks, and unchanged v1 scores',async()=>{
 const {readFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');
 const expected=JSON.parse(readFileSync(new URL('../fixtures/legacy-v1-scores.json',import.meta.url),'utf8'));
 for(const point of expected)assert.equal(createHash('sha256').update(JSON.stringify(at(seed(),point.x,point.y).notes)).digest('hex'),point.sha256);
 const signatures=[];
 for(let i=0;i<=300;i++){
  const d=setJamDirection(seed(),{music_field:{version:2,x:i/300,y:.5}}),notes=d.notes.filter(n=>n.provenance==='jam_generated');
  const keys=notes.map(n=>`${n.role}:${n.patch_id}:${n.concrete.midi_pitch}:${onset(n).toFixed(7)}`);
  assert.equal(new Set(keys).size,keys.length,`duplicate at${i/300}`);
  if(i%100===0)signatures.push(JSON.stringify(notes.filter(n=>n.role==='drums'||n.role==='bass').map(n=>[n.role,n.patch_id,onset(n),n.velocity])));
  assert.equal(jamDirectionKey(d),'music-field-v2');
  assert.equal(parseProjectJson(exportProjectJson(d)).ok,true);
 }
 assert.equal(new Set(signatures).size,4);
});


test('Rocksteady Reggae field retains authored bass rests, replies, and a single bass line',()=>{
 const v3=(x,y=.5)=>setJamDirection(seed(),{music_field:{version:3,x,y}});
 const a=v3(0),b=v3(1);
 assert.deepEqual(a.notes.filter(n=>n.role==='bass'&&n.step<16).map(n=>[onset(n),n.duration_steps]),[[0,4],[6,2],[10,3],[14,1]]);
 assert.deepEqual(b.notes.filter(n=>n.role==='bass'&&n.step<16).map(n=>[onset(n),n.duration_steps]),[[0,2.5],[3,.75],[6,2],[10,4]]);
 assert.equal(a.notes.filter(n=>n.role==='harmony').length,32);
 assert.equal(b.notes.filter(n=>n.role==='harmony').length,36);
 for(const x of [...Array.from({length:101},(_,i)=>i/100),4/11,8/11])for(const y of[0,.5,1]){
  const d=v3(x,y),bass=d.notes.filter(n=>n.role==='bass').sort((a,b)=>onset(a)-onset(b));
  assert.equal(bass.length,16);assert.ok(bass.every(n=>Number.isInteger(n.concrete.midi_pitch)));
  for(let j=1;j<bass.length;j++)assert.ok(onset(bass[j-1])+bass[j-1].duration_steps<=onset(bass[j])+1e-8,`overlap ${x} ${j}`);
  assert.deepEqual(bass.map(n=>[onset(n),n.duration_steps]),v3(x,.5).notes.filter(n=>n.role==='bass').map(n=>[onset(n),n.duration_steps]));
  assert.equal(jamDirectionKey(d),'music-field-v3');
  assert.equal(parseProjectJson(exportProjectJson(d)).ok,true);
 }
});

test('roots field tempo is explicit, legacy scores unaffected, and banjo/personal data survive',()=>{
 const d=seed();d.global_context.bpm=161;const before=JSON.stringify(d);
 assert.throws(()=>setJamDirection(d,{music_field:{version:3,x:0,y:0}}),/160 BPM/);assert.equal(JSON.stringify(d),before);
 d.global_context.bpm=160;
 const own={id:'own-held',provenance:'user_placed',role:'lead',step:3,duration_steps:9,patch_id:'sampled_piano_v1',concrete:{midi_pitch:61},velocity:.6,performance:{version:1,offset_steps:.1}};d.notes.push(own);
 let field=setJamDirection(d,{music_field:{version:3,x:.23,y:.7}});
 field=setJamDirection(field,{band_chord_patch:'sampled_banjo_v1'});
 field=setJamDirection(field,{music_field:{version:3,x:.77,y:.2}});
 assert.deepEqual(field.notes.find(n=>n.id===own.id),own);
 assert.ok(field.notes.filter(n=>n.role==='harmony').every(n=>n.patch_id==='sampled_banjo_v1'));
 assert.equal(parseProjectJson(exportProjectJson(field)).ok,true);
 field.global_context.bpm=161;assert.equal(parseProjectJson(exportProjectJson(field)).ok,false);
});


test('connected field maps accepted local anchors and bridges with no double scaling',()=>{
 const atVersion=(version,x,y)=>setJamDirection(seed(),{music_field:{version,x,y}});
 const signature=d=>d.notes.map(({id,...n})=>n).sort((a,b)=>onset(a)-onset(b)||a.role.localeCompare(b.role)||a.concrete.midi_pitch-b.concrete.midi_pitch);
 for(const y of[0,.5,1])for(const [x,version,local]of[[0,3,1],[.2,3,0],[.4,2,0],[.6,2,1/3],[.8,2,2/3],[1,2,1]])
  assert.deepEqual(signature(atVersion(4,x,y)),signature(atVersion(version,local,y)),`anchor ${x} ${y}`);
 for(let i=0;i<=200;i++){
  const x=.2+i/1000,d=atVersion(4,x,.5),notes=d.notes;
  const keys=notes.map(n=>`${n.role}:${n.patch_id}:${n.concrete.midi_pitch}:${onset(n).toFixed(8)}`);
  assert.equal(new Set(keys).size,keys.length,`seamduplicate ${x}`);
  const bass=notes.filter(n=>n.role==='bass').sort((a,b)=>onset(a)-onset(b));
  for(let j=1;j<bass.length;j++)assert.ok(onset(bass[j-1])+bass[j-1].duration_steps<=onset(bass[j])+1e-8);
  assert.equal(jamDirectionKey(d),'music-field-v4');
  assert.equal(parseProjectJson(exportProjectJson(d)).ok,true);
 }
});
