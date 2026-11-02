import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {dynamicJamPads} from '../../../static/js/theory/dynamic_keys.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {songEvents,applySongMaterial} from '../../../static/js/theory/song_view.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
function doc(root=0,minor=false){const d=startJam(newPlayDoc(),{patchId:'sampled_piano_v1'});
 Object.assign(d.global_context,{root_pc:root,scale_type:minor?'natural_minor':'major',swing:.65});
 return setJamDirection(d,{scene_catalogue:'first-neighborhood-v1',scene_id:'jazz-fusion-v1',responsive:true,density:0});}

test('fusion regions declare their actual tonic and straight rhythm despite global swing',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true]){
  const d=doc(root,minor),before=structuredClone(d),p=createJamFormBuilder()(d);
  p.blocks.forEach((b,i)=>{for(const v of b.variants){
   const tonic=(root+5*i)%12;assert.equal(v.mode.tonic,tonic);
   assert.ok(v.harmony.bars.every(ch=>ch[0]===5*i));
   for(const e of v.events){assert.deepEqual(e.generated_mode,v.mode);
    if(e.role==='drums')assert.equal(e.performance.offset_steps,0);
    else assert.ok(v.mode.intervals.includes((e.concrete.midi_pitch-tonic+120)%12));
   }
   const pads=dynamicJamPads(d,{bpm:100,position:40,backing:{events:v.events,phraseContext:{mode:v.mode}}});
   assert.deepEqual(pads.map(p=>p.midi-60),[0,minor?3:4,9,10].map(n=>(tonic+n)%12).sort((a,b)=>a-b));
   assert.ok(pads.every(p=>p.patchId==='sampled_clean_guitar_v1'));
  }});assert.deepEqual(d,before);
 }
});

test('regional transition and response silence preserve held identity and followed guitar',()=>{
 const d=doc();d.jam_session.live_keys=true;const s=new LookaheadScheduler(),p=createJamFormBuilder()(d);
 s.audioCtx={currentTime:0};s.setCompiledSong(compileSongStandalone(d),{quantizeJamBacking:true,jamStyleKey:'fusion',phraseContext:phraseContext(d),jamFormProgram:p});
 s.isPlaying=true;s.jamPhraseOrdinal=0;s.performanceTake={start:0,bpm:100,events:[],sequence:0};s._activateJamForm();s._rememberJamBacking(0);
 const own={time:9,duration:20,occurrence:1,event:{source_note_id:'jam-live-held',provenance:'user_placed',role:'lead',concrete:{midi_pitch:60},performed_mode:p.blocks[0].variants[0].mode}};
 s.performanceTake.events.push(own);s.liveNotes.set('held',{pitch:60,patch:'sampled_clean_guitar_v1'});const original=structuredClone(own);
 s.audioCtx.currentTime=9.5;s.jamPhraseOrdinal=1;s.currentStep=0;s.nextStepAudioTime=9.6;s._commitJamFormIfDue();
 assert.equal(s.activeJamBacking().phraseContext.mode.tonic,0);
 s.audioCtx.currentTime=9.61;assert.equal(s.activeJamBacking().phraseContext.mode.tonic,5);
 s.audioCtx.currentTime=19.1;s.jamPhraseOrdinal=2;s.nextStepAudioTime=19.2;s._commitJamFormIfDue();s.audioCtx.currentTime=19.21;
 const backing=s.activeJamBacking();assert.equal(backing.phraseContext.mode.tonic,0);assert.equal(backing.events.filter(e=>e.role==='lead').length,0);
 assert.ok(dynamicJamPads(d,{bpm:100,position:1,backing}).every(p=>p.patchId==='sampled_clean_guitar_v1'));
 assert.ok(dynamicJamPads({...d,jam_session:{...d.jam_session,follow_band_sound:false}},{bpm:100,position:1,backing}).every(p=>p.patchId==='sampled_piano_v1'));
 assert.deepEqual(own,original);assert.deepEqual(s.liveNotes.get('held'),{pitch:60,patch:'sampled_clean_guitar_v1'});
});

test('capturing both fusion regions preserves context and editable pitches through reopening',()=>{
 const d=doc(2,true),p=createJamFormBuilder()(d);
 const events=p.blocks.map((b,i)=>({event:b.variants[0].events.find(e=>e.role==='lead'),time:1+10*i,duration:.4,occurrence:i+1}));
 const captured=materializePerformance(d,{events,start:0,end:12,bars:5,bpm:100}),saved=parseProjectJson(exportProjectJson(captured));
 assert.equal(saved.ok,true,saved.reason);
 const base=structuredClone(saved.song);delete base.song_cards;
 const result=songEvents(compileSongStandalone(base),saved.song.song_cards,
  saved.song.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null)).events;
 assert.deepEqual(result.map(e=>e.generated_mode.tonic),[2,7]);
 assert.deepEqual(result.map(e=>e.concrete.midi_pitch),events.map(r=>r.event.concrete.midi_pitch));
});
