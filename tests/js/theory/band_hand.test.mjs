// Phase 14.3b: the band shows its hand. One read, one move, nothing applied on its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readHand,ownPhrase,phraseSettled,HAND_SWING} from '../../../static/js/theory/band_hand.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';

const freq=midi=>440*2**((midi-69)/12);
let seq=0;
const own=(time,hold,midi,extra={})=>({time,duration:hold,released_at:time+hold,occurrence:++seq,event:{provenance:'user_placed',source_note_id:`jam-live-x-${time}`,role:'lead',concrete:{freq_hz:freq(midi)},...extra}});
const take=(events,bpm=120)=>({bpm,start:0,steps_per_bar:16,events});
const beat=.5; // 120 bpm

test('no hand on too few notes, drums, echoes, or notes still held',()=>{
  assert.equal(readHand(take([own(1,.2,64),own(2,.2,64)]),10),null);
  assert.equal(readHand(take([1,2,3,4].map(t=>own(t,.2,64,{role:'drums'}))),10),null);
  assert.equal(readHand(take([1,2,3,4].map(t=>({...own(t,.2,64),event:{...own(t,.2,64).event,provenance:'jam_answer'}}))),10),null);
  const held=[own(1,.2,64),own(2,.2,64),{...own(3,.2,64),released_at:undefined}];
  assert.equal(ownPhrase(take(held),8).length,2);
  assert.equal(phraseSettled([],10),false);
  assert.equal(phraseSettled([own(9.9,.05,64)],10,120),false);
  assert.equal(phraseSettled([own(9,.05,64)],10,120),true);
});

test('leaning on a note that is not home offers to make it home',()=>{
  const hand=readHand(take([own(1,.2,64),own(2,.2,64),own(3,.2,67),own(4,.2,64)]),8,{root:0});
  assert.equal(hand.kind,'root');assert.equal(hand.value,4);
  assert.equal(hand.heard,'You lean on E.');assert.equal(hand.move,'Make E home');
  // Leaning on home itself is not a key change.
  assert.notEqual(readHand(take([own(1,.2,60),own(2,.2,60),own(3,.2,60)]),8,{root:0})?.kind,'root');
});

test('playing between the beats offers swing, unless the band already swings',()=>{
  const off=[1.5,2.5,3.5,4.5].map((t,i)=>own(t+beat/2,.1,[60,64,67,60][i]));
  const hand=readHand(take(off),8,{root:0,swing:.5});
  assert.equal(hand.kind,'swing');assert.equal(hand.value,HAND_SWING);assert.equal(hand.move,'Swing the band');
  assert.notEqual(readHand(take(off),8,{root:0,swing:.62})?.kind,'swing');
});

test('a lot offers more movement, a little with long holds offers more space, within the band limits',()=>{
  const lot=Array.from({length:14},(_,i)=>own(2+i*.25,.05,60+[0,4,7][i%3]));
  assert.deepEqual([readHand(take(lot),6,{root:0,density:1}).heard,readHand(take(lot),6,{root:0,density:1}).value],['You play a lot.',2]);
  assert.notEqual(readHand(take(lot),6,{root:0,density:4})?.kind,'density');
  const little=[own(1,1.5,60),own(3,1.5,64),own(5,1.5,67)];
  const hand=readHand(take(little),8,{root:0,density:2});
  assert.equal(hand.heard,'You leave room.');assert.equal(hand.value,1);
  assert.notEqual(readHand(take(little),8,{root:0,density:0})?.kind,'density');
});

test('ending on home offers to make the song',()=>{
  const hand=readHand(take([own(1,.2,64),own(2,.2,67),own(3,.2,60)]),8,{root:0,density:1});
  assert.equal(hand.kind,'song');assert.equal(hand.move,'Make my song');
});

test('in the flow: a settled phrase shows one hand, taking it changes the band once with Undo ready, skipping clears it',()=>{
  const doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'hip-hop-v1',scene_mix:SCENE_MIX_VERSION});
  const events=[own(1,.2,64),own(2,.2,64),own(3,.2,67),own(4,.2,64)];
  const announced=[];let compiled=0;
  const flow=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',undoStack:[],beatGrid:{},tuneGrid:{},root:null,
    _compile(){compiled++;},render(){},_cancelCardPreview(){},
    app:{_announce:m=>announced.push(m),scheduler:{isPlaying:true,audioCtx:{currentTime:8},performanceTake:take(events,doc.global_context.bpm)}}});
  flow._serviceBandHand();
  assert.equal(flow.bandHand?.kind,'root');
  assert.match(flow._bandHandHtml(),/You lean on E\./);
  assert.match(flow._bandHandHtml(),/Make E home/);
  // The same phrase does not re-offer after a skip.
  flow._handKey('hand-skip');
  assert.equal(flow.bandHand,null);
  flow._serviceBandHand();
  assert.equal(flow.bandHand,null);
  // A new note makes a new phrase.
  flow.app.scheduler.performanceTake.events.push(own(9,.2,64));
  flow.app.scheduler.audioCtx.currentTime=12;
  flow._serviceBandHand();
  assert.equal(flow.bandHand?.kind,'root');
  const before=flow.doc.global_context.root_pc;
  flow._handKey('hand-take');
  assert.equal(flow.doc.global_context.root_pc,4);
  assert.notEqual(flow.doc.global_context.root_pc,before);
  assert.equal(flow.undoStack.length,1);
  assert.equal(compiled,1);
  assert.equal(flow.bandHand,null);
  assert.ok(announced.at(-1).includes('Undo'));
  // Nothing is applied without a press: a fresh phrase leaves the band as it is.
  flow.app.scheduler.performanceTake.events.push(own(13,.2,67),own(14,.2,67),own(15,.2,67));
  flow.app.scheduler.audioCtx.currentTime=18;
  flow._serviceBandHand();
  assert.equal(flow.bandHand?.kind,'root');
  assert.equal(flow.doc.global_context.root_pc,4);
  assert.equal(compiled,1);
  // A fresh take after Stop or Undo counts from one again: an early phrase in it still gets a hand.
  seq=0;
  flow.app.scheduler.performanceTake=take([own(1,.2,67),own(2,.2,67),own(3,.2,67)],doc.global_context.bpm);
  flow.app.scheduler.audioCtx.currentTime=6;
  flow.bandHand=null;
  flow._serviceBandHand();
  assert.equal(flow.bandHand?.heard,'You lean on G.');
});
