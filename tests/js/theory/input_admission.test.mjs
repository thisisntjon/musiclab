import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {startJam} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
function flow(){
 const calls=[],scheduler={liveNotes:new Map(Array.from({length:8},(_,i)=>[i,{}])),masterBus:{piano:{}},previewSound(){calls.push('preview');},noteOn(){assert.fail('No held slot is available');},activeJamContext(){return null;}};
 const f=Object.assign(Object.create(PlayFlow.prototype),{doc:startJam(newPlayDoc(),{kind:'pitched',patchId:'warm_keys'}),stage:'jam',liveHolds:new Map(),undoStack:[],root:{querySelector:()=>null},render(){},_pushUndo(){this.undoStack.push({});},_acceptJamDoc(d){this.doc=d;},app:{scheduler,_announce(m){calls.push(m);}}});
 return {f,calls,scheduler};
}
test('switch short notes remain playable at held capacity',()=>{
 const {f,calls,scheduler}=flow();f._playJamPad(0,null);
 assert.equal(calls[0],'preview');assert.equal(scheduler.liveNotes.size,8);assert.equal(f.doc.notes.filter(n=>n.provenance==='user_placed').length,4);
});
test('a press past the held limit uses the actual reached instrument as a short note instead of refusing',()=>{
 const {f,calls,scheduler}=flow();f.doc.jam_session.patchId='reverse_swell';f.doc.jam_session.dynamic_keys=true;
 scheduler.activeJamContext=()=>({position:0,bpm:100,backing:{events:[{step:0,start_sec:0,duration_sec:1,patch_id:'sampled_piano_v1',role:'harmony',concrete:{midi_pitch:60}}]}});
 assert.equal(f._liveJamPads()[0].patchId,'sampled_piano_v1');const original=structuredClone(f.doc);
 f._playJamPad(0,'key:a');assert.equal(calls[0],'preview','past the held limit a press still sounds, as a short note');assert.equal(scheduler.liveNotes.size,8,'earlier holds keep ringing');
 assert.ok(f.doc.notes.some(n=>n.provenance==='user_placed'&&n.patch_id==='sampled_piano_v1'),'the reached instrument is used');assert.ok(!calls.some(m=>/All held notes/.test(m)));
});
