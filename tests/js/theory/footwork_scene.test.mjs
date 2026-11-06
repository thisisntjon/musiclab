import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {planMelodicPhrase,restoreMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',
 showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,
 scene_id:'footwork-v1',responsive:false});


test('footwork has exact rational attacks, distinct neighboring rhythm and meaningful controls',()=>{
 const doc=make(),position=n=>n.step+(n.performance?.offset_steps||0);
 const kicks=d=>d.notes.filter(n=>n.patch_id==='kick').map(position);
 assert.deepEqual(kicks(doc).slice(0,5),[0,4/3,8/3,5,7]);
 for(const scene_id of ['jersey-club-v1','drum-and-bass-v1','breakbeat-v1'])assert.notDeepEqual(kicks(doc),kicks(setJamDirection(doc,{scene_id})));
 for(const scene_variant of ['base','answer','space'])for(const field of ['density','color'])
  assert.equal(new Set([0,1,2,3,4].map(v=>JSON.stringify(compileSongStandalone(setJamDirection(doc,{scene_variant,[field]:v})).events))).size,5);
});
test('footwork generated fragments have unique rational occurrences, evolve and restore exactly',()=>{
 const signatures=new Set();
 for(let root=0;root<12;root++)for(const minor of [false,true])for(let phraseOrdinal=0;phraseOrdinal<16;phraseOrdinal++) {
  const doc=make();doc.global_context.root_pc=root;doc.global_context.scale_type=minor?'natural_minor':'major';
  const p=planMelodicPhrase({version:3,...phraseContext(doc),phraseOrdinal});
  assert.ok(p.events.length>=8&&p.events.length<=16);
  assert.equal(new Set(p.events.map(e=>e.id)).size,p.events.length);
  for(const e of p.events){assert.equal(e.step,Math.floor(e.step));assert.ok(Math.abs(e.start_sec/(15/100)-e.step-e.performance.offset_steps)<1e-10);}
  assert.equal(p.events.at(-1).concrete.midi_pitch%12,(root+7)%12);
  assert.deepEqual(restoreMelodicPhrase(p.descriptor),p);
  if(root===0&&!minor)signatures.add(JSON.stringify(p.events.map(e=>[e.start_sec,e.concrete.midi_pitch])));
 }
 assert.ok(signatures.size>=6);
});
test('footwork keeps original personal holds through all controls and reopened compilation',()=>{
 const doc=make(),own={id:'jam-live-footwork',role:'lead',patch_id:'sampled_piano_v1',step:3,duration_steps:7.25,
  velocity:.62,concrete:{midi_pitch:67},pitch_lock_mode:'concrete',provenance:'user_placed',performance:{version:1,offset_steps:.25}};
 doc.notes.push(own);
 for(const scene_variant of ['base','answer','space'])for(let density=0;density<5;density++)for(let color=0;color<5;color++){
  const song=setJamDirection(doc,{density,color,scene_variant});
  assert.deepEqual(song.notes.filter(n=>n.id===own.id),[own]);
  const opened=parseProjectJson(exportProjectJson(song));assert.equal(opened.ok,true);
  assert.deepEqual(compileSongStandalone(opened.song).events,compileSongStandalone(song).events);
 }
});

test('footwork actual openings honor recent history and neighbor edges are reciprocal',()=>{
 for(const id of ['jersey-club-v1','drum-and-bass-v1'])assert.ok(SCENE_CATALOGUE.find(s=>s.id===id).neighbors.includes('footwork-v1'));
 const doc=make();let recentOpenings=[];const seen=[];
 for(let phraseOrdinal=0;phraseOrdinal<32;phraseOrdinal++){
  const p=planMelodicPhrase({version:3,...phraseContext(doc),phraseOrdinal,recentOpenings});
  const signature=JSON.stringify(p.events.filter(e=>e.step<16).map(e=>[e.start_sec,e.concrete.midi_pitch]));
  assert.ok(!seen.slice(-4).includes(signature));seen.push(signature);
  recentOpenings=[...recentOpenings,p.openingId].slice(-4);
 }
});
