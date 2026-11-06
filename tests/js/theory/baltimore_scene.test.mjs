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
 scene_id:'baltimore-club-v1',responsive:false});


test('Baltimore has its own kick pickup, full control distinctions and sparse Space',()=>{
 const doc=make(),kicks=d=>d.notes.filter(n=>n.patch_id==='kick').map(n=>n.step);
 assert.deepEqual(kicks(doc).slice(0,5),[0,4,8,13,15]);
 for(const scene_id of ['jersey-club-v1','footwork-v1','breakbeat-v1'])assert.notDeepEqual(kicks(doc),kicks(setJamDirection(doc,{scene_id})));
 for(const scene_variant of ['base','answer','space'])for(const field of ['density','color'])
  assert.equal(new Set([0,1,2,3,4].map(v=>JSON.stringify(compileSongStandalone(setJamDirection(doc,{scene_variant,[field]:v})).events))).size,5);
 assert.ok(setJamDirection(doc,{scene_variant:'space'}).notes.filter(n=>n.role==='lead').length<doc.notes.filter(n=>n.role==='lead').length);
});
test('Baltimore actual openings vary, end on local harmony and restore exactly',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true]){
  const doc=make();doc.global_context.root_pc=root;doc.global_context.scale_type=minor?'natural_minor':'major';
  let recentOpenings=[];const seen=[];
  for(let phraseOrdinal=0;phraseOrdinal<16;phraseOrdinal++){
   const p=planMelodicPhrase({version:3,...phraseContext(doc),phraseOrdinal,recentOpenings});
   assert.ok(p.events.length>=3&&p.events.length<=8);
   assert.equal(new Set(p.events.map(e=>e.id)).size,p.events.length);
   for(const e of p.events)assert.ok(p.descriptor.harmony.bars[Math.floor(e.step/16)].includes((e.concrete.midi_pitch-root+12)%12));
   assert.equal(Math.floor(p.events.at(-1).step/16),3);assert.equal(p.events.at(-1).concrete.midi_pitch%12,(root+7)%12);
   assert.deepEqual(restoreMelodicPhrase(p.descriptor),p);
   const sig=JSON.stringify(p.events.filter(e=>e.step<16).map(e=>[e.start_sec,e.concrete.midi_pitch]));
   assert.ok(!seen.slice(-4).includes(sig));seen.push(sig);recentOpenings=[...recentOpenings,p.openingId].slice(-4);
  }
 }
});
test('Baltimore preserves personal holds and exact reopened output across every control',()=>{
 const doc=make(),own={id:'jam-live-baltimore',role:'lead',patch_id:'sampled_piano_v1',step:3,duration_steps:7.25,
  velocity:.62,concrete:{midi_pitch:67},pitch_lock_mode:'concrete',provenance:'user_placed',performance:{version:1,offset_steps:.25}};
 doc.notes.push(own);
 for(const scene_variant of ['base','answer','space'])for(let density=0;density<5;density++)for(let color=0;color<5;color++){
  const song=setJamDirection(doc,{density,color,scene_variant});assert.deepEqual(song.notes.filter(n=>n.id===own.id),[own]);
  const opened=parseProjectJson(exportProjectJson(song));assert.equal(opened.ok,true);
  assert.deepEqual(compileSongStandalone(opened.song).events,compileSongStandalone(song).events);
 }
 for(const id of ['jersey-club-v1','breakbeat-v1'])assert.ok(SCENE_CATALOGUE.find(s=>s.id===id).neighbors.includes('baltimore-club-v1'));
});
