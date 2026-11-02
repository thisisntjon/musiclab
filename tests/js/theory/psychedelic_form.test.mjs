import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {pianoNotes} from '../../../static/js/audio/sampled_piano.js';
const make=()=>{const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'psychedelic-rock-v1',density:4,responsive:true});d.jam_session.live_keys=true;return d;};
const own=step=>({id:'my-unmodified-phrase',role:'lead',patch_id:'sampled_clean_guitar_v1',step,duration_steps:.3,concrete:{midi_pitch:61},pitch_lock_mode:'concrete',velocity:.37,provenance:'user_placed'});

test('authored echoes retain source pitch, explicit delay and diminishing velocity',()=>{
 const d=make(),p=createJamFormBuilder()(d);
 for(const b of p.blocks)for(const v of b.variants){
  const lead=v.events.filter(e=>e.role==='lead');assert.equal(lead.length,24);
  for(const dry of lead.filter(e=>e.generated_echo.delay_steps===0)){
   const group=lead.filter(e=>e.generated_echo.source_id===dry.id);
   assert.deepEqual(group.map(e=>e.generated_echo.delay_steps),[0,3,6]);
   assert.deepEqual(group.map(e=>e.concrete.midi_pitch),[dry.concrete.midi_pitch,dry.concrete.midi_pitch,dry.concrete.midi_pitch]);
   assert.deepEqual(group.map(e=>e.velocity),[dry.velocity,dry.velocity*.5,dry.velocity*.25]);
   assert.deepEqual(group.map(e=>e.step-dry.step),[0,3,6]);
  }
 }
});
test('protecting personal input removes orphan generated echoes but never removes its own notes',()=>{
 const original=make(),dry=original.notes.find(n=>n.voice_id==='dry-guitar'&&n.step===2);
 for(const at of[2,5]){
  const d=structuredClone(original),personal=own(at);d.notes.push(personal);const input=structuredClone(d),next=setJamDirection(d,{});
  assert.deepEqual(d,input);assert.deepEqual(next.notes.filter(n=>n.provenance==='user_placed'),[personal]);
  const group=next.notes.filter(n=>n.generated_echo?.source_id===dry.id);
  assert.deepEqual(group.map(n=>n.generated_echo.delay_steps),at===2?[]:[0,6]);
 }
});
test('Make room retains complete late dry/echo groups and leaves held personal sources untouched',()=>{
 const d=make(),p=createJamFormBuilder()(d),before=structuredClone(p),s=new LookaheadScheduler();s.audioCtx={currentTime:0};
 s.setCompiledSong(compileSongStandalone(d),{quantizeJamBacking:true,jamStyleKey:'psychedelic',phraseContext:phraseContext(d),jamFormProgram:p});
 s.isPlaying=true;s.jamPhraseOrdinal=0;s.performanceTake={song_id:d.id,start:0,bpm:100,sequence:1,events:[]};s._activateJamForm();
 const record={time:9,duration:.4,occurrence:1,event:{...own(0),id:'jam-live-own',source_note_id:'jam-live-own'}};
 s.performanceTake.events=[record];s.liveNotes.set('held',{identity:'untouched'});s.audioCtx.currentTime=9.5;s.currentStep=0;s.jamPhraseOrdinal=1;s.nextStepAudioTime=9.6;s._commitJamFormIfDue();
 const kept=s.committedJamBacking.filter(e=>e.role==='lead');assert.equal(kept.length,6);
 assert.deepEqual(kept.filter(e=>e.generated_echo.delay_steps===0).map(e=>e.step),[34,54]);
 for(const e of kept){assert.ok(kept.some(dry=>dry.id===e.generated_echo.source_id));assert.deepEqual(e.response_to,['jam-live-own']);}
 assert.deepEqual(p,before);assert.deepEqual(s.liveNotes.get('held'),{identity:'untouched'});assert.deepEqual(s.performanceTake.events,[record]);
});
test('an echo captured after its source left the window remains independent and editable',()=>{
 const d=make(),echo=createJamFormBuilder()(d).blocks[0].variants[0].events.find(e=>e.voice_id==='echo-first');
 const kept=materializePerformance(d,{start:echo.start_sec-.01,end:echo.start_sec+.1,bpm:100,bars:1,events:[{event:echo,time:echo.start_sec,duration:.1,occurrence:2}]});
 const metadata=structuredClone(kept.notes[0].generated_echo);kept.notes[0].concrete.midi_pitch+=1;
 const reopened=parseProjectJson(exportProjectJson(kept));assert.equal(reopened.ok,true);
 const events=compileSongStandalone(reopened.song).events;assert.equal(events.length,1);
 assert.deepEqual(events[0].generated_echo,metadata);assert.equal(pianoNotes(events[0])[0].pitch,echo.concrete.midi_pitch+1);
 assert.equal(reopened.song.captured_performance.events.length,1);
});
