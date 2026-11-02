import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {phraseContext,responseHarmony} from '../../../static/js/theory/phrase_harmony.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',
 showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,
 scene_id:'gospel-piano-v1',responsive:false});

test('piano study keeps upper answers above calls and reaches tonic within four bars',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true])for(let color=0;color<5;color++) {
  const doc=make();doc.global_context.root_pc=root;doc.global_context.scale_type=minor?'natural_minor':'major';
  for(const scene_variant of ['base','answer','space'])for(let density=0;density<5;density++) {
   const song=setJamDirection(doc,{color,density,scene_variant});
   assert.equal(new Set(song.notes.map(n=>n.id)).size,song.notes.length);
   for(let bar=0;bar<4;bar++) {
    const h=song.notes.filter(n=>n.role==='harmony'&&Math.floor(n.step/16)===bar);
    const calls=h.filter(n=>n.step%16<8),answers=h.filter(n=>n.step%16>=8);
    assert.ok(Math.min(...answers.map(n=>n.concrete.midi_pitch))>Math.max(...calls.map(n=>n.concrete.midi_pitch)));
    for(const n of song.notes.filter(n=>n.role!=='drums'&&Math.floor(n.step/16)===bar))
     assert.ok(responseHarmony(minor).bars[bar].includes((n.concrete.midi_pitch-root+120)%12));
   }
   assert.equal(song.notes.filter(n=>n.role==='lead').at(-1).concrete.midi_pitch%12,root);
   assert.equal(phraseContext(song).requiresHarmonicLead,true);
  }
 }
});

test('a personal held harmony survives response edits and editable roundtrip',()=>{
 const doc=make(),own={id:'jam-live-personal-bb',role:'harmony',patch_id:'sampled_piano_v1',step:46,
  duration_steps:15.5,velocity:.6,concrete:{midi_pitch:70},pitch_lock_mode:'concrete',
  performance:{version:1,offset_steps:.125},provenance:'user_placed'};
 doc.notes.push(own);
 const changed=setJamDirection(doc,{density:4,color:4,scene_variant:'answer'});
 assert.deepEqual(changed.notes.find(n=>n.id===own.id),own);
 const reopened=parseProjectJson(exportProjectJson(changed));assert.equal(reopened.ok,true);
 assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(changed).events);
 assert.ok(changed.notes.filter(n=>n.role==='harmony'&&n.provenance==='jam_generated').every(n=>n.step+n.duration_steps<=46||n.step>=62));
});
