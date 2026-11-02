import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {formBlockCount,selectedFormCursor} from '../../../static/js/theory/form_scenes.js';
import {SAMPLED_PROGRAMS,pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {songEvents,applySongMaterial} from '../../../static/js/theory/song_view.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc(),{patchId:'sampled_harmonica_v1'}),{scene_catalogue:'first-neighborhood-v1',scene_id:'chicago-blues-v1',responsive:false});
test('Chicago keeps its complete twelve-bar progression and selectable harmonica',()=>{
 const d=make(),p=createJamFormBuilder()(d);assert.equal(formBlockCount('chicago-blues-v1'),3);assert.equal(p.blocks.length,3);
 assert.deepEqual(p.blocks.flatMap(b=>b.variants[0].harmony.bars.map(c=>c[0])),[0,0,0,0,5,5,0,0,7,5,0,7]);
 assert.equal(selectedFormCursor({scene_id:'chicago-blues-v1',form_cursor:{id:'chicago-blues-v1',blockIndex:2,cycle:7}}).blockIndex,2);
 assert.equal(SAMPLED_PROGRAMS.sampled_harmonica_v1,22);assert.match(getInstrument('sampled_harmonica_v1').image,/harmonica\.svg$/);
 for(const b of p.blocks)for(const v of b.variants){
  assert.equal(v.events.filter(e=>e.role==='harmony').length,15);
  const replies=v.events.filter(e=>e.voice_id==='harmonica-reply');assert.equal(replies.length,4);
  assert.ok(replies.every(e=>pianoNotes(e).every(n=>n.program===22)));
 }
 assert.equal(parseProjectJson(exportProjectJson(d)).song.jam_session.patchId,'sampled_harmonica_v1');
});
test('Keep in the turnaround retains all three chapters through reopen and song compilation',()=>{
 const d=make(),p=createJamFormBuilder()(d),s=new LookaheadScheduler();s.audioCtx={currentTime:28.15};s.isPlaying=true;
 s.performanceTake={song_id:d.id,start:0,bpm:100,capture_bars:12,sequence:0,events:[]};
 p.blocks.forEach((b,i)=>{for(const e of b.variants[0].events)s._rememberPerformance(e,i*9.6+e.start_sec);});
 s._rememberPerformance({id:'future-return',role:'lead',patch_id:'sampled_harmonica_v1',concrete:{midi_pitch:72},duration_sec:.3,provenance:'jam_generated'},28.8);
 const capture=s.capturePerformance();assert.ok(capture.events.every(r=>r.scheduled_time<28.15));
 const kept=materializePerformance(d,capture),saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);assert.equal(saved.song.song_cards.length,3);
 const base=structuredClone(saved.song);delete base.song_cards;
 const result=songEvents(compileSongStandalone(base),saved.song.song_cards,saved.song.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null));
 assert.ok(result.events.some(e=>e.step<64&&e.voice_id==='guitar-call'));
 assert.ok(result.events.some(e=>e.step>=128&&e.voice_id==='harmonica-reply'));
 const last=result.events.filter(e=>e.step>=176&&e.voice_id==='harmonica-reply');assert.equal(last.length,1);
 assert.deepEqual(last[0].generated_harmony.pitch_classes,[7,11,2,5]);
 assert.ok(Math.abs(last[0].duration_sec-.25)<1e-8);
 assert.ok(!result.events.some(e=>e.source_note_id==='future-return'));
});
