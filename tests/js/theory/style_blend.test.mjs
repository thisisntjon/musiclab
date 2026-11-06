import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection,contributeJam} from '../../../static/js/theory/jam_session.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const fresh=()=>startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'warm_keys'});
const musical=doc=>doc.notes.map(n=>[n.role,n.patch_id,n.step,n.duration_steps,n.velocity,n.performance?.offset_steps,n.concrete?.midi_pitch]);
test('style endpoints change rhythmic phrasing and instruments; all21 exposed blends differ',()=>{
 const doc=fresh(),a=setJamDirection(doc,{style_blend:0}),b=setJamDirection(doc,{style_blend:1});
 assert.deepEqual(a.notes.filter(n=>n.role==='drums'&&n.patch_id==='kick'&&n.step<16).map(n=>n.step),[0,7,10]);
 assert.deepEqual(b.notes.filter(n=>n.role==='drums'&&n.patch_id==='kick'&&n.step<16).map(n=>n.step),[0,4,8,12]);
 assert.ok(a.notes.some(n=>n.role==='harmony'&&n.patch_id==='warm_keys'));
 assert.ok(b.notes.some(n=>n.role==='harmony'&&n.patch_id==='pluck_lead'));
 const variants=Array.from({length:21},(_,i)=>setJamDirection(doc,{style_blend:i/20}));
 assert.equal(new Set(variants.map(d=>JSON.stringify(musical(d)))).size,21);
 for(const d of variants){assert.equal(new Set(d.notes.map(n=>n.id)).size,d.notes.length);assert.ok(d.notes.length<=240);assert.ok(d.notes.every(n=>n.velocity>0&&n.velocity<=1));}
 const low=setJamDirection(doc,{style_blend:.05});const hi=setJamDirection(doc,{style_blend:.95});
 assert.ok(low.notes.find(n=>n.patch_id==='clap').velocity<hi.notes.find(n=>n.patch_id==='clap').velocity);
});
test('style exploration preserves personal instrument, gates, provenance, context and reverse state',()=>{
 for(const kind of ['pitched','drums']){
 let doc=startJam(newPlayDoc({now:1,rand:()=>.5}),{kind,patchId:kind==='drums'?'snare':'pluck_lead'});
 doc=contributeJam(doc,{pad:1,step:4});const own=doc.notes.filter(n=>n.provenance==='user_placed');
 const before=structuredClone(doc);for(const p of [0,.3,.5,.9,1,0]){
 const next=setJamDirection(doc,{style_blend:p});assert.deepEqual(next.notes.filter(n=>n.provenance==='user_placed'),own);
 assert.deepEqual(next.global_context,doc.global_context);assert.equal(next.jam_session.patchId,doc.jam_session.patchId);
 assert.deepEqual(compileSongStandalone(JSON.parse(JSON.stringify(next))).events,compileSongStandalone(next).events);
 }assert.deepEqual(doc,before);assert.deepEqual(setJamDirection(setJamDirection(doc,{style_blend:1}),{style_blend:0}),doc);
 }
});
test('legacy sessions retain original backing until explicit style choice',()=>{
 const doc=fresh();delete doc.jam_session.style_blend;const legacy=setJamDirection(doc);assert.ok(!legacy.notes.some(n=>n.style_version));
 const roundtrip=JSON.parse(JSON.stringify(legacy));assert.deepEqual(setJamDirection(roundtrip),legacy);
 assert.ok(setJamDirection(legacy,{style_blend:.5}).notes.some(n=>n.style_version==='two-feels-v1'));
});

test('each activity setting changes the styled score without touching personal notes',()=>{
 const doc=contributeJam(fresh(),{pad:0,step:4});
 const scores=Array.from({length:5},(_,density)=>setJamDirection(doc,{density,style_blend:.5}));
 assert.equal(new Set(scores.map(d=>JSON.stringify(musical(d)))).size,5);
 for(const score of scores)assert.deepEqual(score.notes.filter(n=>n.provenance==='user_placed'),doc.notes.filter(n=>n.provenance==='user_placed'));
});
