import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {songEvents} from '../../../static/js/theory/song_view.js';
import {stepsPerBar} from '../../../static/js/theory/musical_time.js';
import {beatGridFromNotes,notesFromBeatGrid,rollGrooveDice} from '../../../static/js/theory/beat_model.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const fresh=()=>{const doc=newPlayDoc();doc.global_context.steps_per_bar=12;return startJam(doc,{patchId:'warm_keys'});};
test('three-beat clock, partial capture and independent section lengths agree',()=>{
  const doc=fresh(),loop=compileSongStandalone(doc);
  assert.equal(stepsPerBar(newPlayDoc()),16);assert.equal(loop.total_steps,48);assert.equal(loop.total_duration_sec,7.2);
  const whole=songEvents(loop,[{bars:1},{bars:2},{bars:1}]);
  assert.deepEqual(whole.sections.map(s=>s.end_step-s.start_step),[12,24,12]);
  const scheduler=Object.create(LookaheadScheduler.prototype);
  scheduler.isPlaying=true;scheduler.audioCtx={currentTime:1.81};
  scheduler.performanceTake={start:0,bpm:100,steps_per_bar:12,events:[{event:loop.events[0],time:0,duration:.1,occurrence:1}]};
  const take=scheduler.capturePerformance(),captured=materializePerformance(doc,take);
  assert.equal(take.bars,2);assert.equal(captured.global_context.steps_per_bar,12);
  const reopened=parseProjectJson(exportProjectJson(captured));assert.equal(reopened.ok,true);
  assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(captured).events);
  assert.throws(()=>stepsPerBar({steps_per_bar:13}));
});
test('three-beat controls change backing while preserving personal held notes',()=>{
  const doc=fresh();
  const own={id:'own',step:11,duration_steps:3.25,velocity:.7,role:'lead',patch_id:'warm_keys',
    provenance:'user_placed',concrete:{midi_pitch:65},performance:{version:1,offset_steps:.2}};
  doc.notes.push(own);
  for(const key of ['density','color']) {
    const scores=[];
    for(let value=0;value<=4;value++) {
      const next=setJamDirection(doc,{style_spectrum:1.5,[key]:value,responsive:false});
      assert.deepEqual(next.notes.find(n=>n.id==='own'),own);
      scores.push(JSON.stringify(compileSongStandalone(next).events.filter(n=>n.provenance==='jam_generated')
        .map(n=>[n.role,n.patch_id,n.step,n.duration_sec,n.velocity,n.concrete.freq_hz,n.voiced_freqs])));
      assert.ok(next.notes.every(n=>n.step<48));
    }
    assert.equal(new Set(scores).size,5,key);
  }
});
test('native six-cell beat assistance preserves personal pads and stays within48steps',()=>{
  const doc=fresh();const grid=beatGridFromNotes(doc.notes,12);grid.kick[5]='user_placed';
  const own=notesFromBeatGrid(grid,doc.notes,{stepsPerBar:12});
  const rolled=rollGrooveDice(grid,{stepsPerBar:12,seed:1});
  assert.equal(rolled.grid.kick.length,6);assert.equal(rolled.grid.kick[5],'user_placed');
  const next=notesFromBeatGrid(rolled.grid,own,{stepsPerBar:12,protectOwn:true});
  assert.ok(next.every(n=>n.step<48));
  for(const n of own.filter(n=>n.provenance==='user_placed'))assert.deepEqual(next.find(x=>x.id===n.id),n);
});
