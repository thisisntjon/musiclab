import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
const song={song_id:'request',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:[{id:'own',role:'lead',step:0,duration_steps:4,patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:60}}]};
test('rejected scheduling does not claim that a new melody is on its way',()=>{
 let accept=false,calls=0;
 const scheduler={isPlaying:true,gridOriginTime:0,queueContinuousPartAudition(){calls++;return {ok:accept};}};
 const f=new MelodyFieldSession(song,{scheduler,captureOrigin:0,sourceDoc:{id:'request'}});
 const original=f.requestId;
 f.request({x:1,y:0});
 assert.equal(f.requestId,original);
 assert.deepEqual(f.position,{x:0,y:0});
 assert.ok(f.requestError);
 accept=true;f.request({x:1,y:0});
 assert.notEqual(f.requestId,original);assert.equal(f.requestError,null);assert.equal(calls,2);
});
test('paused selection works without scheduling or starting sound',()=>{
 const f=new MelodyFieldSession(song,{scheduler:{isPlaying:false,queueContinuousPartAudition(){throw Error('unexpected audio');}},captureOrigin:0,sourceDoc:{id:'request'}});
 f.request({x:1,y:0});assert.deepEqual(f.position,{x:1,y:0});
});


test('failed Undo retains its entry so retry can restore the same choice',()=>{
 let accept=true;
 const scheduler={isPlaying:true,gridOriginTime:0,queueContinuousPartAudition(){return {ok:accept};}};
 const f=new MelodyFieldSession(song,{scheduler,captureOrigin:0,sourceDoc:{id:'request'}});
 f.request({x:1,y:0});f.remember({x:0,y:0});
 accept=false;f.undo();assert.equal(f.history.length,1);assert.deepEqual(f.position,{x:1,y:0});
 accept=true;f.undo();assert.equal(f.history.length,0);assert.deepEqual(f.position,{x:0,y:0});
});
