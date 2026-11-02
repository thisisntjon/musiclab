import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'memphis-soul-v1',responsive:true,density:0});
test('Memphis paired horn identities and local chord colors survive every compiled chapter',()=>{
 const d=make();d.global_context.scale_type='natural_minor';const p=createJamFormBuilder()(d);
 for(const b of p.blocks)for(const v of b.variants){
  const high=v.events.filter(e=>e.voice_id==='horn-high'),low=v.events.filter(e=>e.voice_id==='horn-low');
  assert.equal(high.length,4);assert.equal(low.length,4);
  assert.deepEqual(high.map(e=>e.start_sec),low.map(e=>e.start_sec));
  assert.ok(high.every(e=>e.patch_id==='sampled_trumpet_v1'&&e.concrete.midi_pitch>=60&&e.concrete.midi_pitch<=71));
  assert.ok(low.every(e=>e.patch_id==='sampled_tenor_sax_v1'&&e.concrete.midi_pitch>=48&&e.concrete.midi_pitch<=59));
  for(const e of [...high,...low]){assert.ok(e.generated_harmony.pitch_classes.includes(e.concrete.midi_pitch%12));assert.equal(e.why_label,'Source band: harmony context. Pitch kept as written.');}
 }
});
test('optional room preserves both horns in an answer group and never edits the personal performance',()=>{
 const d=make();d.jam_session.live_keys=true;const p=createJamFormBuilder()(d),s=new LookaheadScheduler();s.audioCtx={currentTime:0};
 s.setCompiledSong(compileSongStandalone(d),{quantizeJamBacking:true,jamStyleKey:'memphis',phraseContext:phraseContext(d),jamFormProgram:p});
 s.isPlaying=true;s.jamPhraseOrdinal=0;const own={time:9,duration:1,occurrence:1,event:{source_note_id:'jam-live-memphis',provenance:'user_placed',concrete:{midi_pitch:61}}};
 s.performanceTake={start:0,bpm:100,sequence:1,events:[own]};const before=structuredClone(own);s._activateJamForm();
 s.audioCtx.currentTime=9.5;s.jamPhraseOrdinal=1;s.currentStep=0;s.nextStepAudioTime=9.6;s._commitJamFormIfDue();
 const lead=s.committedJamBacking.filter(e=>e.role==='lead');assert.equal(lead.length,4);
 assert.equal(new Set(lead.map(e=>e.start_sec)).size,2);assert.ok(lead.every(e=>e.step>=32));
 assert.deepEqual(own,before);assert.ok(lead.every(e=>e.provenance==='jam_generated'&&e.response_to[0]===own.event.source_note_id));
});
test('simultaneous captured horns keep distinct events and sounds when saved and edited',()=>{
 const d=make(),v=createJamFormBuilder()(d).blocks[0].variants[0];
 const paired=v.events.filter(e=>['horn-high','horn-low'].includes(e.voice_id)&&e.step===6);
 assert.equal(paired.length,2);const captured=materializePerformance(d,{start:0,end:2,bars:1,bpm:100,events:paired.map((event,i)=>({event,time:.9,duration:.1,occurrence:i+1}))});
 const before=structuredClone(captured);captured.notes[0].concrete.midi_pitch+=1;
 const saved=parseProjectJson(exportProjectJson(captured));assert.equal(saved.ok,true);const events=compileSongStandalone(saved.song).events;
 assert.equal(events.length,2);assert.equal(new Set(events.map(e=>e.source_note_id)).size,2);
 assert.deepEqual(events.map(e=>e.voice_id).sort(),['horn-high','horn-low']);
 assert.equal(saved.song.notes[1].concrete.midi_pitch,before.notes[1].concrete.midi_pitch);
 assert.deepEqual(events.map(e=>e.generated_harmony),paired.map(e=>e.generated_harmony));
});
