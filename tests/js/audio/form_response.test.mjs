import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const own=(id,time)=>({time,duration:.4,occurrence:1,event:{id,source_note_id:id,role:'lead',patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:63},velocity:.6}});
function setup(responsive=true){
 const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'hard-bop-v1',responsive});
 d.jam_session.live_keys=true;const p=createJamFormBuilder()(d),s=new LookaheadScheduler();s.audioCtx={currentTime:0};
 s.setCompiledSong(compileSongStandalone(d),{quantizeJamBacking:true,jamStyleKey:'hard-bop',phraseContext:phraseContext(d),jamFormProgram:p});
 s.isPlaying=true;s.jamPhraseOrdinal=0;s.performanceTake={song_id:d.id,start:0,bpm:100,sequence:1,events:[]};
 s._activateJamForm();s._rememberJamBacking(0);return {d,p,s};
}
function advance(s){s.audioCtx.currentTime=9.5;s.currentStep=0;s.jamPhraseOrdinal=1;s.nextStepAudioTime=9.6;s._commitJamFormIfDue();}

test('Make room leaves the first half open and retains simultaneous answer groups after reached playing',()=>{
 const {d,p,s}=setup(),original=structuredClone(p),record=own('jam-live-own',9);
 s.performanceTake.events=[record,own('jam-live-future',9.6)];s.liveNotes.set('held',{pitch:63,identity:'unchanged'});
 advance(s);const raw=p.blocks[1].variants[0].events,played=s.committedJamBacking;
 assert.ok(played.filter(e=>e.role==='lead').length<raw.filter(e=>e.role==='lead').length);
 assert.ok(played.filter(e=>e.role==='lead').every(e=>e.step>=32));
 assert.deepEqual(played.filter(e=>e.role!=='lead'),raw.filter(e=>e.role!=='lead'));
 const onset=e=>e.step+(e.performance?.offset_steps||0),kept=new Set(played.filter(e=>e.role==='lead').map(onset));
 assert.equal(kept.size,2);
 for(const at of kept)assert.equal(played.filter(e=>e.role==='lead'&&onset(e)===at).length,raw.filter(e=>e.role==='lead'&&onset(e)===at).length);
 for(const e of played.filter(e=>e.role==='lead')){assert.equal(e.provenance,'jam_generated');assert.deepEqual(e.response_to,['jam-live-own']);}
 assert.deepEqual(p,original);assert.deepEqual(s.liveNotes.get('held'),{pitch:63,identity:'unchanged'});
 assert.deepEqual(s.performanceTake.events[0],record);
 assert.equal(s.activeJamBacking().phraseContext.form_response.mode,'steady','lookahead is not yet reached');
 s.audioCtx.currentTime=9.61;assert.equal(s.activeJamBacking().phraseContext.form_response.mode,'space');
 const reply=played.find(e=>e.role==='lead');s._rememberPerformance(reply,14.4);s.audioCtx.currentTime=14.5;
 const captured=materializePerformance(d,s.capturePerformance()),saved=parseProjectJson(exportProjectJson(captured));assert.equal(saved.ok,true);
 const notes=[...saved.song.notes,...saved.song.song_cards.flatMap(c=>c.material?.notes||[])];
 assert.ok(notes.some(e=>e.provenance==='user_placed'&&e.source_note_id==='jam-live-own'));
 assert.ok(notes.some(e=>e.response_version==='form-room-v1'&&e.response_to[0]==='jam-live-own'));
});

test('off, future-only and generated activity leave the complete form unchanged',()=>{
 for(const [responsive,record] of [[false,own('jam-live-own',9)],[true,own('jam-live-future',9.6)],
  [true,{...own('jam-live-generated',9),event:{...own('jam-live-generated',9).event,provenance:'jam_generated'}}]]){
  const {p,s}=setup(responsive);s.performanceTake.events=[record];advance(s);
  assert.deepEqual(s.committedJamBacking,p.blocks[1].variants[0].events);
 }
});

test('turning response off restores the authored score at a boundary without resetting form position',()=>{
 const {d,s}=setup();s.performanceTake.events=[own('jam-live-own',9)];advance(s);
 const next=setJamDirection(d,{responsive:false}),program=createJamFormBuilder()(next);
 s.setCompiledSong(compileSongStandalone(next),{quantizeJamBacking:true,jamStyleKey:'hard-bop',phraseContext:phraseContext(next),jamFormProgram:program});
 s.currentStep=16;s.nextStepAudioTime=12;s._commitJamBackingIfDue();
 assert.equal(s.activeJamForm.cursor.blockIndex,1);assert.equal(s.activeJamForm.cursor.cycle,0);
 assert.deepEqual(s.committedJamBacking,program.blocks[1].variants[0].events);
 assert.equal(s.committedPhraseContext.form_response,undefined);
});
