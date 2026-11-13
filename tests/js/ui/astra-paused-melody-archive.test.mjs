import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';

const note={id:'own',role:'lead',step:0,duration_steps:2,velocity:.6,patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:60}};
const original={id:'paused-review',global_context:{bpm:100,bars:4,root_pc:0},notes:[note],arrangement_mode:'loop'};
const score={song_id:original.id,bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:[note]};
const context={version:1,composerVersion:2,root:0};
const archive={...structuredClone(original),captured_performance:{start:0,end:1,bpm:100,bars:4,events:[{event:note,time:.2,duration:.3,occurrence:1}]}};
const chosen=()=>selectedMelody(original,score,{context,choice:{position:{x:0,y:0},requestId:'selected'},performanceArchive:archive});
function setup(doc,{hasPlayed=false,capture=null}={}){
 const f=Object.create(PlayFlow.prototype),candidate={id:'selected',position:{x:0,y:0},song:structuredClone(score)};
 f.doc=doc;f.melodyField={palette:{},hasPlayed,sourceDoc:structuredClone(doc),phraseContext:context,
  candidates:new Map([['selected',candidate]]),_candidate:()=>candidate};
 f.app={scheduler:{getPartAuditionState:()=>hasPlayed?{realizedId:'selected'}:null,
  capturePerformance:()=>capture,lastStoppedPerformance:archive.captured_performance,markPerformanceKept(){}},_announce(message){throw new Error(message);}};
 f._pushUndo=()=>{};f._stopForScopeChange=()=>{};f._finishPartEdit=()=>{};
 f._reconcileRetainedPlaying=()=>{};f._compile=()=>{};f._go=stage=>{f.stage=stage;};
 return f;
}

for(const [action,stage] of [['melody-field-keep','keep'],['melody-field-refine','tune'],['melody-field-back','jam']]){
 test(`actual UI ${action}: repeated paused continuation preserves direct played archive`,async()=>{
  let doc=chosen();const size=JSON.stringify(doc).length;
  for(let i=0;i<3;i++){
   const f=setup(doc);await f._melodyFieldAction(action);doc=f.doc;
   assert.equal(f.stage,stage);assert.deepEqual(doc.capture_source,archive);
   assert.deepEqual(doc.melody_original,original);assert.equal(JSON.stringify(doc).length,size);
  }
 });
}
test('actual UI fresh performed take replaces prior archive, without changing the pinned original',async()=>{
 const capture={start:0,end:2,bpm:100,bars:4,events:[{event:note,time:1.2,duration:.7,occurrence:2}]};
 const f=setup(chosen(),{hasPlayed:true,capture});await f._melodyFieldAction('melody-field-keep');
 assert.deepEqual(f.doc.capture_source.captured_performance,capture);
 assert.deepEqual(f.doc.melody_original,original);
 assert.notDeepEqual(f.doc.capture_source.captured_performance,archive.captured_performance);
});
