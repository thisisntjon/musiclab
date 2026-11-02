import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceOffsetSeconds} from '../../../static/js/audio/scheduler.js';
import {songEvents} from '../../../static/js/theory/song_view.js';

test('performed timing uses bounded substep offset; invalid offsets use beat and ordinary notes retain swing',()=>{
  assert.equal(performanceOffsetSeconds({performance:{version:1,offset_steps:.8}},.15,.02),.12);
  for(const value of [-1,1,NaN,Infinity,'0.5',null]) assert.equal(performanceOffsetSeconds({performance:{version:1,offset_steps:value}},.15,.02),0);
  assert.equal(performanceOffsetSeconds({},.15,.02),.02);
});
test('last performance release survives final card; an earlier card retains its boundary',()=>{
  const event={id:'last',role:'lead',step:15,start_sec:2.385,duration_sec:.3,duration_steps:2,velocity:.7,performance:{version:1,offset_steps:.9},concrete:{midi_pitch:60}};
  const loop={bpm:100,total_steps:64,events:[event]};
  const card={bars:1};
  const single=songEvents(loop,[card]);
  assert.equal(single.events[0].duration_sec,.3);
  const repeated=songEvents(loop,[card,card]);
  assert.ok(Math.abs(repeated.events[0].duration_sec-.015)<1e-8);
  assert.equal(repeated.events[1].duration_sec,.3);
  assert.equal(repeated.events[1].start_sec,4.785);
});
