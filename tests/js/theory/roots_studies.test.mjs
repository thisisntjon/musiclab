import {rootsStudyCells,rootsStudyHarmony} from '../../../static/js/theory/roots_study_phrases.js';
import {rootsStudyBacking} from '../../../static/js/theory/roots_study_scenes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {planMelodicPhrase,restoreMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const make=scene_id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',
 showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,
 scene_id,responsive:false});


const STUDIES=[['outlaw-country-v1',['honky-tonk-v1','western-swing-v1']],['progressive-bluegrass-v1',['bluegrass-v1','western-swing-v1']],['delta-blues-v1',['piedmont-v1','outlaw-country-v1']]];
for(const [id,neighbors] of STUDIES){
 test(`${id} has distinct accompaniment and controls, without duplicate generated attacks`,()=>{
  const doc=make(id),signature=d=>JSON.stringify(d.notes.filter(n=>n.role!=='lead').map(n=>[n.role,n.step,n.performance?.offset_steps,n.concrete.midi_pitch,n.duration_steps]));
  for(const scene_id of neighbors){assert.notEqual(signature(doc),signature(setJamDirection(doc,{scene_id})));assert.ok(SCENE_CATALOGUE.find(s=>s.id===scene_id).neighbors.includes(id));}
  for(const scene_variant of ['base','answer','space'])for(const field of ['density','color'])
   assert.equal(new Set([0,1,2,3,4].map(v=>JSON.stringify(compileSongStandalone(setJamDirection(doc,{scene_variant,[field]:v})).events))).size,5);
  const keys=doc.notes.map(n=>JSON.stringify([n.patch_id,n.concrete.midi_pitch,n.step+(n.performance?.offset_steps||0)]));assert.equal(new Set(keys).size,keys.length);
  if(id==='delta-blues-v1'){
   assert.deepEqual(phraseContext(doc).harmony.bars,[[0,4,7],[0,4,7],[5,9,0],[7,11,2]]);
   assert.ok(doc.notes.filter(n=>n.role==='lead').every(n=>n.concrete.midi_pitch>=72));
   assert.ok(doc.notes.filter(n=>n.role==='harmony').every(n=>n.concrete.midi_pitch<72));
  }
  if(id==='progressive-bluegrass-v1'){
   const counts=[0,1,2,3,4].map(density=>setJamDirection(doc,{density}).notes.filter(n=>n.role==='harmony').length);
   assert.ok(counts.every((n,i)=>i===0||n>counts[i-1]));
   assert.ok(phraseContext(doc).harmony.bars[3].includes(5));
  }
  if(id==='outlaw-country-v1'){
   const bass=doc.notes.filter(n=>n.role==='bass');assert.equal(bass.length,8);assert.equal((bass[1].concrete.midi_pitch-bass[0].concrete.midi_pitch+12)%12,7);
   assert.ok(doc.notes.filter(n=>n.role==='harmony').some(n=>n.performance.offset_steps>0));
  }
 });
 test(`${id} evolving foreground follows authored harmony, real opening history and ending`,()=>{
  for(let root=0;root<12;root++)for(const minor of [false,true]){
   const doc=make(id);doc.global_context.root_pc=root;doc.global_context.scale_type=minor?'natural_minor':'major';
   const context=phraseContext(doc);assert.equal(context.requiresHarmonicLead,true);
   let recentOpenings=[];const seen=[];
   for(let phraseOrdinal=0;phraseOrdinal<16;phraseOrdinal++){
    const p=planMelodicPhrase({version:3,...context,phraseOrdinal,recentOpenings});
    assert.equal(new Set(p.events.map(e=>e.id)).size,p.events.length);
    for(const e of p.events){const interval=(e.concrete.midi_pitch-root+12)%12,bar=Math.floor(e.step/16);
     assert.ok(p.descriptor.harmony.bars[bar].includes(interval)||(id==='delta-blues-v1'&&!minor&&bar===0&&interval===3));
     assert.ok(e.concrete.midi_pitch>=(id==='delta-blues-v1'?72:60)&&e.concrete.midi_pitch<=(id==='delta-blues-v1'?84:83));
    }
    assert.equal(Math.floor(p.events.at(-1).step/16),3);assert.equal(p.events.at(-1).concrete.midi_pitch%12,(root+7)%12);
    assert.deepEqual(restoreMelodicPhrase(p.descriptor),p);
    const sig=JSON.stringify(p.events.filter(e=>e.step<16).map(e=>[e.start_sec,e.concrete.midi_pitch]));
    assert.ok(!seen.slice(-4).includes(sig));seen.push(sig);recentOpenings=[...recentOpenings,p.openingId].slice(-4);
   }
  }
 });
 test(`${id} preserves personal holds and exact reopened output across all controls`,()=>{
  const doc=make(id),own={id:'jam-live-roots',role:'lead',patch_id:'sampled_piano_v1',step:3,duration_steps:7.25,
   velocity:.62,concrete:{midi_pitch:67},pitch_lock_mode:'concrete',provenance:'user_placed',performance:{version:1,offset_steps:.25}};
  doc.notes.push(own);
  for(const scene_variant of ['base','answer','space'])for(let density=0;density<5;density++)for(let color=0;color<5;color++){
   const song=setJamDirection(doc,{density,color,scene_variant});assert.deepEqual(song.notes.filter(n=>n.id===own.id),[own]);
   const opened=parseProjectJson(exportProjectJson(song));assert.equal(opened.ok,true);
   assert.deepEqual(compileSongStandalone(opened.song).events,compileSongStandalone(song).events);
  }
 });
}

test('Delta fretted approach rises one actual semitone in every key, initial and evolving',()=>{
 for(let root=0;root<12;root++){
  const doc=make('delta-blues-v1');doc.global_context.root_pc=root;
  const initial=rootsStudyBacking(doc,doc.jam_session,[]).filter(n=>n.role==='lead');
  assert.equal(initial.find(e=>e.step===7).concrete.midi_pitch-initial.find(e=>e.step===6).concrete.midi_pitch,1);
  for(let phraseOrdinal=0;phraseOrdinal<8;phraseOrdinal++){
   const cells=rootsStudyCells('delta-blues-v1',rootsStudyHarmony('delta-blues-v1'),phraseOrdinal);
   const resolution=cells.find(c=>c.resolvesApproach);if(!resolution)continue;
   const p=planMelodicPhrase({version:3,...phraseContext(doc),phraseOrdinal});
   const after=p.events.find(e=>e.step===resolution.position),before=p.events.find(e=>e.step===resolution.position-1);
   assert.equal(after.concrete.midi_pitch-before.concrete.midi_pitch,1);
  }
 }
});
