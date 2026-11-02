import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {planMelodicPhrase,restoreMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
import {PianoAllocation,pianoNotes} from '../../../static/js/audio/sampled_piano.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',
 showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,
 scene_id:'doo-wop-v1',responsive:false});

test('vowel parts stay ordered and evolved lead leaves the group response windows',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true])for(let color=0;color<5;color++) {
  const doc=make();doc.global_context.root_pc=root;doc.global_context.scale_type=minor?'natural_minor':'major';
  for(const scene_variant of ['base','answer','space'])for(let density=0;density<5;density++) {
   const song=setJamDirection(doc,{color,density,scene_variant});
   assert.equal(new Set(song.notes.map(n=>n.id)).size,song.notes.length);
   const harmony=phraseContext(song).harmony;
   assert.equal(song.notes.find(n=>n.role==='bass'&&n.step===56).duration_steps,7);
   assert.ok(!song.notes.some(n=>n.role==='bass'&&n.step===62));
   for(const n of song.notes.filter(n=>n.role!=='drums')) {
    const p=n.concrete.midi_pitch;
    assert.equal(n.patch_id,'sampled_ooh_v1');
    assert.ok(p>=(n.role==='bass'?48:n.role==='harmony'?60:72)&&p<=(n.role==='bass'?59:n.role==='harmony'?71:83));
    assert.ok(harmony.bars[Math.floor(n.step/16)].includes((p-root+120)%12));
   }
   const phrase=planMelodicPhrase({version:3,harmony,sceneId:'doo-wop-v1',root,minor,phraseOrdinal:density+color});
   assert.deepEqual(restoreMelodicPhrase(phrase.descriptor),phrase);
   assert.equal(new Set(phrase.events.map(e=>e.step)).size,phrase.events.length);
   for(const e of phrase.events) {
    assert.ok(e.concrete.midi_pitch>=72&&e.concrete.midi_pitch<=83);
    assert.ok([0,6,8,14].includes(e.step%16));
    assert.ok(e.duration_sec<=1.5*15/100);
   }
  }
 }
});

test('new ooh patch and personal held harmony survive editing and project roundtrip',()=>{
 const doc=make(),own={id:'jam-live-vowel',role:'harmony',patch_id:'sampled_ooh_v1',step:1,
  duration_steps:7.5,velocity:.67,concrete:{midi_pitch:66},pitch_lock_mode:'concrete',
  performance:{version:1,offset_steps:.25},provenance:'user_placed'};
 doc.notes.push(own);const song=setJamDirection(doc,{density:4,color:4});
 assert.deepEqual(song.notes.find(n=>n.id===own.id),own);
 const opened=parseProjectJson(exportProjectJson(song));assert.equal(opened.ok,true);
 assert.deepEqual(compileSongStandalone(opened.song).events,compileSongStandalone(song).events);
 assert.equal(pianoNotes(compileSongStandalone(song).events.find(e=>e.id===own.id))[0].program,53);
});

test('maximum-rate vowel study leaves allocation room for eight personal held notes',()=>{
 for(let density=0;density<5;density++)for(let color=0;color<5;color++) {
  const doc=make();doc.global_context.bpm=400;
  const song=setJamDirection(doc,{density,color});const compiled=compileSongStandalone(song);
  const phrase=planMelodicPhrase({version:3,harmony:phraseContext(song).harmony,sceneId:'doo-wop-v1',bpm:400,phraseOrdinal:3});
  const events=[...compiled.events.filter(e=>e.role!=='lead'),...phrase.events];
  const queue=[];for(let cycle=0;cycle<6;cycle++)for(const event of events)
   for(const n of pianoNotes(event))queue.push({at:cycle*2.4+event.start_sec,...n});
  for(let pitch=60;pitch<68;pitch++)queue.push({at:2.4,duration:4,pitch,program:53,pan:64});
  const pool=new PianoAllocation();
  for(const n of queue.sort((a,b)=>a.at-b.at))pool.claim(n.at,n.duration,n.pitch,n.pan,n.program);
 }
});
