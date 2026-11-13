import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';

test('actual melody focus action is reversible audition state, with unchanged score and clock',async()=>{
 const f=Object.create(PlayFlow.prototype),scheduler=Object.create(LookaheadScheduler.prototype);
 scheduler.isPlaying=true;scheduler.gridOriginTime=17.41;scheduler.spotlightRole=null;
 scheduler.start=()=>assert.fail('must not restart');scheduler.stop=()=>assert.fail('must not stop');
 scheduler.setCompiledSong=()=>assert.fail('must not recompile');
 const candidate={id:'selected',song:{events:[{id:'personal',patch_id:'sampled_piano_v1',duration_steps:20.8114,concrete:{midi_pitch:64}}]}};
 const doc={id:'focus',notes:structuredClone(candidate.song.events)};let paints=0;
 f.doc=doc;f.app={scheduler};f.melodyField={sourceDoc:structuredClone(doc),candidates:new Map([['selected',candidate]]),paint(){paints++;}};
 const before=structuredClone({doc,source:f.melodyField.sourceDoc,candidate});
 for(const expected of ['tune',null]){
  await f._melodyFieldAction('melody-field-focus');assert.equal(scheduler.spotlightRole,expected);
  assert.equal(scheduler.isPlaying,true);assert.equal(scheduler.gridOriginTime,17.41);
  assert.deepEqual({doc:f.doc,source:f.melodyField.sourceDoc,candidate},before);
 }
 assert.equal(paints,2);
});

test('actual navigation clears audition focus when leaving melody',()=>{
 const f=Object.create(PlayFlow.prototype),scheduler=Object.create(LookaheadScheduler.prototype);
 scheduler.spotlightRole='tune';scheduler.clearMuteLayers=()=>{};scheduler.setLoopRange=()=>{};scheduler.setRepeatPlayback=()=>{};
 f.app={scheduler};f.doc=null;f.stage='jam';f.trail=[];f.confirm={};f.melodyField={};
 f._finishPartEdit=()=>{};f._dealOnArrival=()=>{};f.render=()=>{};f.root={querySelector:()=>null};
 f._go('keep');assert.equal(scheduler.spotlightRole,null);assert.equal(f.melodyField,null);assert.equal(f.stage,'keep');
});
