import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';

function fixture() {
  const song={song_id:'comparison-review',bpm:120,swing:.5,total_steps:64,steps_per_bar:16,
    events:[{id:'one',role:'lead',step:0,duration_steps:4,patch_id:'sampled_piano_v1',
      provenance:'user_placed',concrete:{midi_pitch:60}}]};
  const scheduler={isPlaying:false,gridOriginTime:0,accept:true,
    getPartAuditionState:()=>null,
    queueContinuousPartAudition(){return {ok:this.accept};}};
  const session=new MelodyFieldSession(song,{scheduler,captureOrigin:0,sourceDoc:{id:song.song_id}});
  session.palette={original:{notes:song.events},'4:4':{notes:song.events}};
  session.request({x:.8660254,y:.5});
  scheduler.isPlaying=true;
  return {session,scheduler};
}

test('rejected Original does not claim comparison has begun; next press retries Original',()=>{
  const {session:s,scheduler}=fixture(),selected=structuredClone(s.position);
  scheduler.accept=false;s.toggleOriginal();
  assert.deepEqual(s.position,selected);
  assert.equal(s.comparisonPosition,null);
  assert.match(s.requestError,/did not play/);
  scheduler.accept=true;s.toggleOriginal();
  assert.deepEqual(s.position,{x:0,y:0});
  assert.deepEqual(s.comparisonPosition,selected);
  assert.equal(s.requestError,null);
});

test('rejected return from Original retains remembered alternative for retry',()=>{
  const {session:s,scheduler}=fixture(),selected=structuredClone(s.position);
  s.toggleOriginal();
  assert.deepEqual(s.position,{x:0,y:0});
  scheduler.accept=false;s.toggleOriginal();
  assert.deepEqual(s.position,{x:0,y:0});
  assert.deepEqual(s.comparisonPosition,selected);
  assert.match(s.requestError,/did not play/);
  scheduler.accept=true;s.toggleOriginal();
  assert.deepEqual(s.position,selected);
  assert.equal(s.comparisonPosition,null);
  assert.equal(s.requestError,null);
});
