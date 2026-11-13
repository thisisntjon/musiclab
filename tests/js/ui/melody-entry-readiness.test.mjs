import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

function fixture(capturePerformance) {
 const f=Object.create(PlayFlow.prototype);
 Object.assign(f,{stage:'jam',doc:{id:'mine'},app:{scheduler:{isPlaying:true,stopGeneration:0,capturePerformance}}});
 return f;
}
test('melody entry waits beyond the former 150ms cutoff and returns only realized capture',async()=>{
 const heard={source_song_id:'mine',events:[{id:'personal',time:.25,duration:1.75,provenance:'user_placed'}]};
 let calls=0;const f=fixture(()=>++calls>=9?heard:{events:[]});
 assert.equal(await f._awaitMelodyCapture(f._intentToken()),heard);
 assert.equal(calls,9);
});
test('Stop, navigation or changing songs cancels pending melody capture',async()=>{
 for(const change of [f=>{f.app.scheduler.stopGeneration++;f.app.scheduler.isPlaying=false;},f=>{f.stage='keep';},f=>{f.doc={id:'other'};}]){
  let calls=0;const f=fixture(()=>{calls++;change(f);return {events:[]};});
  assert.equal(await f._awaitMelodyCapture(f._intentToken()),null);assert.equal(calls,1);
 }
});
test('ready capture is immediate and never regenerated',async()=>{
 const capture={events:[{id:'held',duration:9.125}]};const f=fixture(()=>capture);
 assert.equal(await f._awaitMelodyCapture(f._intentToken()),capture);
});
test('missing take declines immediately rather than waiting for nonexistent playback',async()=>{
 let calls=0;const f=fixture(()=>{calls++;return null;});
 assert.equal(await f._awaitMelodyCapture(f._intentToken()),null);assert.equal(calls,1);
});
test('empty capture has a bounded wait and does not invent played notes',async()=>{
 let calls=0;const f=fixture(()=>{calls++;return {events:[]};});
 assert.equal(await f._awaitMelodyCapture(f._intentToken()),null);assert.equal(calls,160);
});
