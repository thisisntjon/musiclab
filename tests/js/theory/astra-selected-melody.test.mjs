import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {captureMelodyContext,planMelodyCandidate} from '../../../static/js/theory/melody_composer.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {buildStandaloneSeed,compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
function setup(){
 const doc=buildStandaloneSeed();doc.arrangement_mode='loop';doc.auto_harmony_stabs=false;
 doc.notes=[{id:'personal',step:3,duration_steps:18.8114,velocity:.61,role:'lead',patch_id:'sampled_piano_v1',provenance:'user_placed',pitch_lock_mode:'concrete',concrete:{midi_pitch:67},performance:{version:1,offset_steps:.271}}];
 const score=compileSongStandalone(doc);score.events=score.events.map(n=>({...n,duration_steps:n.duration_steps??n.duration_sec/(15/score.bpm)}));
 const context=captureMelodyContext(score,{phraseContext:phraseContext({...doc,jam_session:{scene_id:'house-v1'}})});
 return {doc,score,context};
}
test('selected complete score compiles to matching attacks, gates, patches and provenance after JSON reopen',()=>{
 const {doc,score,context}=setup(),p=planMelodyCandidate(context,{x:0,y:1}),chosen={...score,events:p.notes};
 const kept=selectedMelody(doc,chosen,{context,choice:p.choice}),compiled=compileSongStandalone(JSON.parse(JSON.stringify(kept)));
 assert.equal(compiled.total_steps,chosen.total_steps);assert.equal(compiled.events.length,chosen.events.length);
 for(const n of chosen.events){const actual=compiled.events.find(e=>e.id===n.id);assert.ok(actual,n.id);
  for(const key of ['patch_id','provenance'])assert.equal(actual[key],n[key]);
  assert.equal(actual.concrete.midi_pitch,n.concrete.midi_pitch);
  assert.ok(Math.abs(actual.start_sec-n.start_sec)<1e-5);assert.ok(Math.abs(actual.duration_sec-n.duration_sec)<1e-5);
 }
});
test('actual performance archive remains separate and exact; personal original is recoverable and source untouched',()=>{
 const {doc,score,context}=setup(),before=structuredClone(doc),archive={...structuredClone(doc),captured_performance:{events:[{event:doc.notes[0],time:4.321,duration:2.82171}],end:9}};
 const p=planMelodyCandidate(context,{x:0,y:1}),kept=selectedMelody(doc,{...score,events:p.notes},{context,choice:p.choice,performanceArchive:archive});
 assert.deepEqual(kept.capture_source,archive);assert.deepEqual(kept.melody_original,before);assert.deepEqual(doc,before);
 assert.equal(kept.captured_performance,undefined);assert.equal(kept.capture_notes.melody_field.version,4);
 assert.equal(kept.capture_notes.melody_field.context.source,undefined);
});
test('selected original preserves personal gate and fractional timing through compiler',()=>{
 const {doc,score,context}=setup(),kept=selectedMelody(doc,score,{context,choice:{key:'original'}}),out=compileSongStandalone(kept).events.find(e=>e.id==='personal');
 assert.equal(out.provenance,'user_placed');assert.equal(out.concrete.midi_pitch,67);
 assert.ok(Math.abs(out.start_sec-(3+.271)*.15)<1e-5);assert.ok(Math.abs(out.duration_sec-18.8114*.15)<1e-5);
});
test('composer context rejects nonfinite timing before palette generation',()=>{
 const {score}=setup(),reached={phraseContext:phraseContext({global_context:{root_pc:0,scale_type:'major'},jam_session:{scene_id:'house-v1'}})};
 for(const bad of [{...score,swing:NaN},{...score,events:score.events.map(e=>({...e,duration_steps:NaN}))},{...score,events:score.events.map(e=>({...e,step:Infinity}))}])
  assert.ok(captureMelodyContext(bad,reached)===null,'nonfinite score timing must not enter the composer');
});

test('selected score retains early swing by normalizing its fractional attack',()=>{
 const {doc,score,context}=setup();
 const event={...score.events[0],step:1,performance:undefined,start_sec:.12,duration_steps:1,duration_sec:.15};
 const chosen={...score,swing:.3,events:[event]};
 const kept=selectedMelody(doc,chosen,{context,choice:{key:'original'}});
 const compiled=compileSongStandalone(kept).events[0];
 assert.ok(Math.abs(compiled.start_sec-.12)<.00001);
 assert.equal(kept.notes[0].step,0);assert.ok(Math.abs(kept.notes[0].performance.offset_steps-.8)<.00001);
});
