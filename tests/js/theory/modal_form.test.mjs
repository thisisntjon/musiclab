import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {validJamForm,validFormMode} from '../../../static/js/theory/jam_form.js';
import {dynamicJamPads} from '../../../static/js/theory/dynamic_keys.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
function doc(root=0,minor=false){const d=startJam(newPlayDoc(),{patchId:'sampled_piano_v1'});
 Object.assign(d.global_context,{root_pc:root,scale_type:minor?'natural_minor':'major'});
 return setJamDirection(d,{scene_catalogue:'first-neighborhood-v1',scene_id:'modal-jazz-v1',responsive:false});}

test('modal source states third, sixth and flat seventh in both chapters, even Space',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true]){
  const d=setJamDirection(doc(root,minor),{scene_variant:'space',density:0,color:0}),original=structuredClone(d.global_context);
  const p=createJamFormBuilder()(d);assert.ok(validJamForm(p));assert.deepEqual(d.global_context,original);
  for(const b of p.blocks)for(const v of b.variants){
   assert.ok(validFormMode(v.mode));assert.equal(v.mode.name,minor?'dorian':'mixolydian');
   const pcs=new Set(v.events.filter(e=>e.role==='lead').map(e=>(e.concrete.midi_pitch-root+12)%12));
   for(const tone of [minor?3:4,9,10])assert.ok(pcs.has(tone));
   assert.ok(v.harmony.bars.every(ch=>ch[0]===0));
   assert.ok(v.events.every(e=>JSON.stringify(e.generated_mode)===JSON.stringify(v.mode)));
   assert.ok(v.events.filter(e=>e.role!=='drums').every(e=>!e.why_label.includes('outside the scale')&&e.why_label.includes('Source band:')));
  }
 }
 assert.equal(validFormMode({version:1,name:'dorian',tonic:0,intervals:[0,2,3,5,7,8,10]}),false);
});

test('new modal keys retain vocabulary and tenor in rests; manual sound and drums stay selectable',()=>{
 for(let root=0;root<12;root++)for(const minor of [false,true]){
  const d=doc(root,minor),p=createJamFormBuilder()(d),before=structuredClone(d);
  for(const b of p.blocks)for(const position of [1,19,35,63]){
   const v=b.variants[0],context={bpm:100,position,backing:{events:v.events,phraseContext:{mode:v.mode}}};
   const pads=dynamicJamPads(d,context),expected=[0,minor?3:4,9,10].map(n=>(root+n)%12).sort((a,b)=>a-b);
   assert.deepEqual(pads.map(p=>p.midi-60),expected);assert.ok(pads.every(p=>p.patchId==='sampled_tenor_sax_v1'));
   assert.ok(dynamicJamPads({...d,jam_session:{...d.jam_session,follow_band_sound:false}},context).every(p=>p.patchId==='sampled_piano_v1'));
  }
  assert.deepEqual(d,before);
 }
});

test('modal clock context waits for the reached boundary and never remaps held notes',()=>{
 const d=doc(),s=new LookaheadScheduler(),build=createJamFormBuilder();s.audioCtx={currentTime:0};
 const options=d=>({quantizeJamBacking:true,jamStyleKey:'modal',phraseContext:phraseContext(d),jamFormProgram:build(d)});
 s.setCompiledSong(compileSongStandalone(d),options(d));s.isPlaying=true;s.jamPhraseOrdinal=0;s._activateJamForm();s._rememberJamBacking(0);
 s.liveNotes.set('personal-held',{pitch:63,patch:'sampled_guitar_v1'});
 const next=structuredClone(d);next.global_context.root_pc=2;const edited=setJamDirection(next);
 s.setCompiledSong(compileSongStandalone(edited),options(edited));s.currentStep=16;s.nextStepAudioTime=2.4;s._commitJamBackingIfDue();
 assert.equal(s.committedPhraseContext.mode.tonic,2);assert.equal(s.activeJamBacking().phraseContext.mode.tonic,0);
 s.audioCtx.currentTime=2.41;assert.equal(s.activeJamBacking().phraseContext.mode.tonic,2);
 assert.deepEqual(s.liveNotes.get('personal-held'),{pitch:63,patch:'sampled_guitar_v1'});
});

test('capture retains each generated event source mode across mixed contexts and reopening',()=>{
 const a=doc(0,true),b=doc(2,false),build=createJamFormBuilder();
 const events=[a,b].map((d,i)=>({event:build(d).blocks[0].variants[0].events.find(e=>e.role==='lead'),time:1+i,duration:.2,occurrence:i+1}));
 const capture={events,start:0,end:4,bars:2,bpm:100};
 const kept=materializePerformance(doc(9),capture),saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);
 const compiled=compileSongStandalone(saved.song);
 assert.deepEqual(compiled.events.map(e=>e.generated_mode.tonic),[0,2]);
 assert.deepEqual(compiled.events.map(e=>e.generated_mode.name),['dorian','mixolydian']);
 assert.deepEqual(compiled.events.map(e=>e.why_label),['Source band: Dorian. Pitch kept as written.','Source band: Mixolydian. Pitch kept as written.']);
 assert.deepEqual(compiled.events.map(e=>e.concrete.midi_pitch),events.map(e=>e.event.concrete.midi_pitch));
 assert.equal(saved.song.global_context.root_pc,9,'source context is not rewritten to the latest generated mode');
});
