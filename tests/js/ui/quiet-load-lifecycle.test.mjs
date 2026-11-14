import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

test('managed loading sessions own bank attempts, including failed and ready states',async()=>{
 for(const state of ['loading','failed','ready','live']){
  let calls=0;const flow=Object.create(PlayFlow.prototype);
  Object.assign(flow,{app:{scheduler:{loadingSession:{state},preparePiano:async()=>{calls++;}}},doc:{id:'one'}});
  flow._loadSoundsQuietly();await Promise.resolve();
  assert.equal(calls,0,`${state} must not start a competing quiet load`);
  assert.equal(flow.quietLoad,undefined);
 }
});

function fixture(){
 let resolve,reject;
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const scheduler={stopGeneration:0,masterBus:{piano:null,disposed:false},preparePiano:()=>pending};
 const flow=Object.create(PlayFlow.prototype);
 Object.assign(flow,{app:{scheduler},doc:{id:'one'},pianoMessage:'',renders:0,render(){this.renders++;}});
 flow._loadSoundsQuietly();return {flow,scheduler,resolve,reject};
}
test('Stop or changing songs cannot turn an obsolete sound load into a current failure',async()=>{
 for(const retire of [(f,s)=>s.stopGeneration++,(f)=>f.doc={id:'two'}]){
  const {flow,scheduler,reject}=fixture();retire(flow,scheduler);reject(Error('disposed graph'));
  await flow.quietLoad;assert.equal(flow.pianoMessage,'');assert.equal(flow.renders,0);assert.equal(flow.quietLoad,null);
 }
});
test('a real bank failure remains visible; successful retry clears only its own failure text',async()=>{
 const {flow,reject}=fixture();reject(Error('bank unavailable'));await flow.quietLoad;
 assert.match(flow.pianoMessage,/did not load/);
 flow.app.scheduler.preparePiano=async()=>{flow.app.scheduler.masterBus.piano={};};
 flow._loadSoundsQuietly();await flow.quietLoad;
 assert.equal(flow.pianoMessage,'');assert.equal(flow.renders,2);
});
test('a late rejection does not overwrite a ready bank or loading-session message',async()=>{
 for(const ready of [true,false]){
  const {flow,scheduler,reject}=fixture();flow.pianoMessage='Music is on. Full sounds are on the way.';
  if(ready)scheduler.masterBus.piano={};else scheduler.loadingSession={state:'loading'};
  reject(Error('old load'));await flow.quietLoad;
  assert.equal(flow.pianoMessage,'Music is on. Full sounds are on the way.');assert.equal(flow.renders,0);
 }
});

test('quiet loading clears retired progress only when its current bank is ready',async()=>{
 const {flow,scheduler,resolve}=fixture();
 flow.pianoMessage='Sound is on. Full sounds are on the way.';
 scheduler.masterBus.piano={};resolve();await flow.quietLoad;
 assert.equal(flow.pianoMessage,'');assert.equal(flow.renders,1);
});

test('quiet completion cannot clear a newer managed session or a retired song message',async()=>{
 for(const change of [(f,s)=>s.loadingSession={state:'ready'},(f,s)=>s.stopGeneration++,(f)=>f.doc={id:'two'}]){
  const {flow,scheduler,resolve}=fixture();
  flow.pianoMessage='Full sounds join at the next bar.';
  change(flow,scheduler);scheduler.masterBus.piano={};resolve();await flow.quietLoad;
  assert.equal(flow.pianoMessage,'Full sounds join at the next bar.');assert.equal(flow.renders,0);
 }
});
