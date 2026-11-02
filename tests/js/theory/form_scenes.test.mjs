import test from 'node:test';
import assert from 'node:assert/strict';
import {FORM_SCENES,formBlockCount,formScore} from '../../../static/js/theory/form_scenes.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {validJamForm} from '../../../static/js/theory/jam_form.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {sceneIndex,compatibleSceneIndices} from '../../../static/js/theory/scene_catalogue.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const scene=id=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:id,responsive:false});
const sound=notes=>JSON.stringify(notes.map(n=>[n.role,n.patch_id,n.step,n.performance?.offset_steps,n.duration_steps,n.velocity,n.concrete.midi_pitch]));

test('ten form directions have valid programs and bidirectional exploration links',()=>{
 for(const {id,neighbors} of FORM_SCENES){const doc=scene(id),before=structuredClone(doc),build=createJamFormBuilder(),p=build(doc);
  assert.ok(validJamForm(p),id);assert.equal(p.blocks.length,formBlockCount(id));assert.deepEqual(doc,before);
  assert.equal(build(doc).blocks,p.blocks,'cached musical score');
  for(const neighbor of neighbors){assert.ok(compatibleSceneIndices(sceneIndex(id)).includes(sceneIndex(neighbor)));assert.ok(compatibleSceneIndices(sceneIndex(neighbor)).includes(sceneIndex(id)));}
  const saved=parseProjectJson(exportProjectJson({...doc,jam_session:{...doc.jam_session,form_cursor:{id,blockIndex:1,cycle:3}}}));
  assert.equal(saved.ok,true);assert.equal(build(saved.song).cursor.blockIndex,1);assert.equal(build(saved.song).cursor.cycle,3);
 }
});

test('blues progression reaches IV and V across twelve bars; boogie keeps eight bass attacks per bar',()=>{
 for(const id of ['jump-blues-v1','boogie-woogie-v1','classic-blues-v1','country-blues-v1']){
  const p=createJamFormBuilder()(scene(id));assert.deepEqual(p.blocks.flatMap(b=>b.variants[0].harmony.bars.map(ch=>ch[0])),[0,0,0,0,5,5,0,0,7,5,0,7]);
  if(id==='boogie-woogie-v1')for(const b of p.blocks)for(const v of b.variants)for(let bar=0;bar<4;bar++)assert.equal(v.events.filter(e=>e.role==='bass'&&Math.floor(e.step/16)===bar).length,8);
 }
});

test('controls change actual sound, short A/B studies differ, and personal sources survive each form',()=>{
 for(const {id} of FORM_SCENES){const doc=scene(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>sound(setJamDirection(doc,{[field]:v}).notes))).size,5,`${id} ${field}`);
  assert.equal(new Set(['base','answer','space'].map(scene_variant=>sound(setJamDirection(doc,{scene_variant}).notes))).size,3,`${id} alternatives`);
  const a=formScore(doc),b=formScore(doc,{...doc.jam_session,form_cursor:{id,blockIndex:1,cycle:0}});
  if(formBlockCount(id)===2)assert.notDeepEqual(a.notes,b.notes,id);
  const own={id:'jam-user-held',role:'lead',patch_id:'sampled_piano_v1',step:3,duration_steps:10,velocity:.6,provenance:'user_placed',pitch_lock_mode:'concrete',concrete:{midi_pitch:64},performance:{version:1,offset_steps:.3}};
  doc.notes.push(own);const before=structuredClone(doc);const p=createJamFormBuilder()(doc);
  assert.deepEqual(doc,before);
  for(const block of p.blocks)for(const variant of block.variants)assert.ok(!variant.events.some(e=>e.id===own.id));
  assert.deepEqual(setJamDirection(doc,{color:4}).notes.find(e=>e.id===own.id),own);
 }
});

test('bebop approaches resolve by a concrete semitone in every key, not an octave-wrapped pitch class',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true]){
  const doc=scene('bebop-v1');doc.global_context.root_pc=root;doc.global_context.scale_type=minor?'natural_minor':'major';
  for(let cycle=0;cycle<8;cycle++)for(let blockIndex=0;blockIndex<2;blockIndex++){
   const score=formScore(doc,{...doc.jam_session,form_cursor:{id:'bebop-v1',blockIndex,cycle}});
   for(let bar=0;bar<4;bar++){const line=score.notes.filter(n=>n.role==='lead'&&n.voice_id==='solo'&&Math.floor(n.position/16)===bar);assert.equal(line[3].pitch-line[2].pitch,1);}
  }
 }
});

test('form identity includes stops, vocal space, stable rag core and independent jazz voices',()=>{
 const jump=formScore(scene('jump-blues-v1'));
 assert.ok(jump.notes.some(n=>n.role==='lead'&&n.position>=48));
 assert.ok(!jump.notes.some(n=>n.role!=='lead'&&n.position>48),'generated stop leaves a horn reply');
 const classic=formScore(scene('classic-blues-v1'));
 assert.ok(!classic.notes.some(n=>n.role==='lead'&&n.position>=48),'last bar breath');
 assert.ok(classic.notes.filter(n=>n.role==='lead'&&n.position<32).every(n=>n.gate>=4));
 const rag=scene('ragtime-v1'),a=formScore(rag),b=formScore(rag,{...rag.jam_session,form_cursor:{id:'ragtime-v1',blockIndex:0,cycle:5}});
 assert.deepEqual(a.notes.filter(n=>n.position<48),b.notes.filter(n=>n.position<48));
 assert.notDeepEqual(a.notes.filter(n=>n.position>=48),b.notes.filter(n=>n.position>=48));
 const stride=formScore(scene('stride-piano-v1'));
 assert.deepEqual(stride.harmony.bars,[[0,4,7,9],[9,0,4,7],[2,5,9,0],[7,11,2,5]]);
 for(const id of ['new-orleans-jazz-v1','bebop-v1','cool-jazz-v1','hard-bop-v1']){
  const p=createJamFormBuilder()(scene(id));
  assert.ok(p.blocks.every(b=>b.variants.every(v=>v.events.every(e=>typeof e.voice_id==='string'))),id);
 }
});

test('dense bebop turnaround has its own onset in all eight cycles and colors',()=>{
 for(const density of [3,4])for(let color=0;color<5;color++)for(const scene_variant of ['base','answer','space']){
  const doc=setJamDirection(scene('bebop-v1'),{density,color,scene_variant});
  const program=createJamFormBuilder()(doc);assert.ok(validJamForm(program));
  for(const b of program.blocks)for(const v of b.variants){
   const attacks=v.events.map(e=>[e.patch_id,e.step,e.performance?.offset_steps||0,e.concrete.midi_pitch].join(':'));
   assert.equal(new Set(attacks).size,attacks.length);
   assert.equal(v.events.find(e=>e.voice_id==='turnaround').step,63);
  }
 }
});
