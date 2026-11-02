import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {songEvents,applySongMaterial} from '../../../static/js/theory/song_view.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'trance-v1',responsive:false});
test('trance has three root attacks between kicks, then an exposed passage and exact return',()=>{
 const p=createJamFormBuilder()(make());
 for(let block=0;block<2;block++)for(const v of p.blocks[block].variants){
  const bass=v.events.filter(e=>e.role==='bass');assert.equal(bass.length,block?24:48);
  assert.ok(bass.every(e=>e.step%4!==0));assert.ok(v.events.every(e=>!e.patch_id.startsWith('sampled_')));
  for(let bar=block?2:0;bar<4;bar++)assert.equal(bass.filter(e=>Math.floor(e.step/16)===bar).length,12);
  if(block){assert.ok(!v.events.some(e=>e.step<32&&['bass','drums'].includes(e.role)));assert.ok(v.events.some(e=>e.step===32&&e.patch_id==='kick'));}
 }
});
test('keeping the exposed passage retains past theme and personal pitch without future return attacks',()=>{
 const d=make(),p=createJamFormBuilder()(d),s=new LookaheadScheduler();s.audioCtx={currentTime:14.35};s.isPlaying=true;
 s.performanceTake={song_id:d.id,start:0,bpm:100,capture_bars:8,sequence:0,events:[]};
 p.blocks.forEach((b,i)=>{for(const e of b.variants[0].events)s._rememberPerformance(e,i*9.6+e.start_sec);});
 s._rememberPerformance({id:'jam-live-trance',source_note_id:'jam-live-trance',provenance:'user_placed',role:'lead',patch_id:'pluck_lead',concrete:{midi_pitch:61},duration_sec:1,velocity:.6},14.2);
 assert.ok(s.performanceTake.events.some(r=>r.time>=14.35&&r.event.patch_id==='kick'));
 const capture=s.capturePerformance();assert.ok(capture.events.some(r=>r.scheduled_time<9.6));assert.ok(capture.events.every(r=>r.scheduled_time<14.35));
 const kept=materializePerformance(d,capture),saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);assert.equal(saved.song.song_cards.length,2);
 const base=structuredClone(saved.song);delete base.song_cards;
 const result=songEvents(compileSongStandalone(base),saved.song.song_cards,saved.song.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null));
 assert.ok(!result.events.some(e=>e.step>=64&&['bass','drums'].includes(e.role)));
 assert.ok(result.events.some(e=>e.role==='bass'&&e.step<64));
 const own=result.events.find(e=>e.source_note_id==='jam-live-trance');assert.equal(own.concrete.midi_pitch,61);assert.ok(Math.abs(own.duration_sec-.15)<1e-8);
});
test('Space and density do not secretly refill the exposed passage',()=>{
 for(const scene_variant of ['base','space','answer'])for(const density of [0,4]){
  const p=createJamFormBuilder()(setJamDirection(make(),{scene_variant,density}));
  for(const v of p.blocks[1].variants)assert.ok(!v.events.some(e=>e.step<32&&['bass','drums'].includes(e.role)));
 }
});
