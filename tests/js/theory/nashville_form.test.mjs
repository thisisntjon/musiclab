import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';
import {SAMPLED_PROGRAMS,pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc(),{patchId:'sampled_strings_v1'}),{scene_catalogue:'first-neighborhood-v1',scene_id:'nashville-sound-v1',responsive:false});
test('sampled string ensemble stays identifiable through the instrument picker and save',()=>{
 assert.equal(SAMPLED_PROGRAMS.sampled_strings_v1,48);
 const i=getInstrument('sampled_strings_v1');assert.equal(i.group,'strings');assert.match(i.image,/strings\.svg$/);
 const saved=parseProjectJson(exportProjectJson(make()));assert.equal(saved.ok,true);assert.equal(saved.song.jam_session.patchId,'sampled_strings_v1');
 const e=createJamFormBuilder()(saved.song).blocks[0].variants[0].events.find(e=>e.role==='harmony');
 assert.ok(pianoNotes(e).every(n=>n.program===48));assert.equal(e.patch_id,'sampled_strings_v1');
});
test('sustained string dyads leave the piano separate and preserve the minor dominant third',()=>{
 const d=make();d.global_context.scale_type='natural_minor';const p=createJamFormBuilder()(d);
 for(const b of p.blocks)for(const v of b.variants){
  const strings=v.events.filter(e=>e.role==='harmony');assert.equal(strings.length,8);
  assert.ok(strings.every(e=>e.patch_id==='sampled_strings_v1'&&e.duration_steps===14&&e.step%16===0));
  assert.ok(v.events.filter(e=>e.role==='lead').every(e=>e.patch_id==='sampled_piano_v1'));
 }
 const dominant=p.blocks[0].variants[0].events.filter(e=>e.role==='harmony'&&e.step===48);
 assert.ok(dominant.some(e=>e.concrete.midi_pitch%12===11));
 assert.deepEqual(dominant[0].generated_harmony.pitch_classes,[7,11,2,5]);
});
test('Keep during a string sustain retains played notes, excludes queued attacks and stays editable',()=>{
 const d=make(),p=createJamFormBuilder()(d),s=new LookaheadScheduler();s.audioCtx={currentTime:1.1};s.isPlaying=true;
 s.performanceTake={song_id:d.id,start:0,bpm:100,capture_bars:8,sequence:0,events:[]};
 for(const e of p.blocks[0].variants[0].events)s._rememberPerformance(e,e.start_sec);
 const captured=s.capturePerformance();assert.ok(captured.events.every(r=>r.scheduled_time<1.1));
 const kept=materializePerformance(d,captured);const strings=kept.notes.filter(n=>n.patch_id==='sampled_strings_v1');assert.equal(strings.length,2);
 const original=structuredClone(strings);strings[0].concrete.midi_pitch+=1;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);
 const events=compileSongStandalone(saved.song).events.filter(e=>e.patch_id==='sampled_strings_v1');assert.equal(events.length,2);
 assert.equal(events[0].concrete.midi_pitch,original[0].concrete.midi_pitch+1);
 assert.ok(events.every(e=>Math.abs(e.duration_sec-1.1)<1e-8&&e.voice_id==='sustained-strings'));
 assert.equal(events[1].concrete.midi_pitch,original[1].concrete.midi_pitch);
});
