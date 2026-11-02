import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {planMelodicPhrase,restoreMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',
 showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,
 scene_id:'grime-v1',responsive:false});

test('grime has displaced snares and interrupted short support rather than trap rolls',()=>{
 const doc=make(),sn=s=>s.notes.filter(n=>n.patch_id==='snare').map(n=>n.step);
 assert.deepEqual(sn(doc),[4,11,23,28,36,43,55,60]);
 for(const scene_id of ['trap-v1','two-step-v1','dubstep-v1'])assert.notDeepEqual(sn(doc),sn(setJamDirection(doc,{scene_id})));
 assert.ok(doc.notes.filter(n=>n.role==='bass').every(n=>n.duration_steps<=1.25));
 for(const scene_variant of ['base','answer','space'])for(const field of ['density','color'])
  assert.equal(new Set([0,1,2,3,4].map(v=>JSON.stringify(compileSongStandalone(setJamDirection(doc,{scene_variant,[field]:v})).events))).size,5);
});

test('sparse grime reply grammar stays ordered, ends on target and restores exactly',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true])for(let phraseOrdinal=0;phraseOrdinal<32;phraseOrdinal++) {
  const doc=make();doc.global_context.root_pc=root;doc.global_context.scale_type=minor?'natural_minor':'major';
  const p=planMelodicPhrase({version:3,...phraseContext(doc),phraseOrdinal});
  assert.ok(p.events.length>=2&&p.events.length<=4);
  assert.ok(p.events.every(e=>[18,30,50,62].includes(e.step)));
  assert.deepEqual(p.events.map(e=>e.step),p.events.map(e=>e.step).sort((a,b)=>a-b));
  assert.equal(new Set(p.events.map(e=>e.id)).size,p.events.length);
  assert.equal(p.events.at(-1).step,62);assert.equal(p.events.at(-1).concrete.midi_pitch%12,(root+7)%12);
  assert.deepEqual(restoreMelodicPhrase(p.descriptor),p);
 }
});

test('grime part edits preserve performed notes and exact reopened compilation',()=>{
 const doc=make(),own={id:'jam-live-grime',role:'bass',patch_id:'clean_bass',step:3,duration_steps:7.25,
  velocity:.62,concrete:{midi_pitch:42},pitch_lock_mode:'concrete',provenance:'user_placed',performance:{version:1,offset_steps:.25}};
 doc.notes.push(own);const song=setJamDirection(doc,{density:4,color:4,scene_variant:'answer'});
 assert.deepEqual(song.notes.find(n=>n.id===own.id),own);
 const opened=parseProjectJson(exportProjectJson(song));assert.equal(opened.ok,true);
 assert.deepEqual(compileSongStandalone(opened.song).events,compileSongStandalone(song).events);
});
