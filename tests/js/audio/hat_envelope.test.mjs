import test from 'node:test';
import assert from 'node:assert/strict';
import {triggerDrumVoice,DRUM_KITS} from '../../../static/js/audio/voices.js';

// Evaluate the scheduled gain contract, not browser DSP. In particular a source
// onset rounded to an earlier sample must never see GainNode's default gain1.
function parameter(defaultValue=1){
 const p={value:defaultValue,events:[],setValueAtTime(value,time){this.events.push({value,time,kind:'set'});},
  exponentialRampToValueAtTime(value,time){this.events.push({value,time,kind:'exp'});}};
 p.at=time=>{
  let previous={value:p.value,time:0};
  for(const next of p.events){
   if(time<next.time){
    return next.kind==='exp'&&time>=previous.time?
     previous.value*(next.value/previous.value)**((time-previous.time)/(next.time-previous.time)):previous.value;
   }
   previous=next;
  }
  return previous.value;
 };
 return p;
}
function context(sampleRate){
 const gains=[],sources=[];
 const node=()=>({connect(){}});
 return {sampleRate,gains,sources,
  createBuffer:(_,length)=>({getChannelData:()=>new Float32Array(length)}),
  createBufferSource(){const n={...node(),start(time){this.startTime=time;}};sources.push(n);return n;},
  createBiquadFilter:()=>({...node(),frequency:parameter(),Q:parameter()}),
  createOscillator:()=>({...node(),frequency:parameter(),start(){},stop(){}}),
  createGain(){const n={...node(),gain:parameter()};gains.push(n);return n;}};
}

test('fractional scheduled hats are silent before onset and retain their quiet attack and decay',()=>{
 for(const sampleRate of [44100,48000])for(const kit of Object.keys(DRUM_KITS))for(const patch of ['hat_closed','hat_open']){
  const ctx=context(sampleRate),start=(sampleRate+100.75)/sampleRate,velocity=.0054;
  triggerDrumVoice(ctx,{},patch,start,.1,velocity,kit);
  assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].startTime,start);
  assert.equal(ctx.gains.length,1);const gain=ctx.gains[0].gain;
  const precedingSample=Math.floor(start*sampleRate)/sampleRate;
  assert.ok(precedingSample<start);
  assert.equal(gain.at(0),0);
  assert.equal(gain.at(precedingSample),0,`${patch}/${kit}: no full-gain pre-onset sample`);
  assert.equal(gain.at(start),.38*velocity);
  const end=start+(patch==='hat_open'?.16:DRUM_KITS[kit].hatDecay);
  assert.equal(gain.at(end),.001);
  assert.ok(gain.at((start+end)/2)<gain.at(start));
 }
});

test('verified clap and snare noise paths are silent before fractional onset',()=>{
 for(const sampleRate of [44100,48000])for(const kit of Object.keys(DRUM_KITS))for(const patch of ['clap','snare']){
  const ctx=context(sampleRate),start=(sampleRate+100.75)/sampleRate,velocity=.0054;
  triggerDrumVoice(ctx,{},patch,start,.1,velocity,kit);
  assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].startTime,start);
  // Snare's first gain belongs to its separate oscillator body; this regression
  // addresses the reproduced noise-path spike, not unmeasured sibling behavior.
  const gain=ctx.gains.at(-1).gain;
  assert.equal(gain.at(0),0);
  assert.equal(gain.at(Math.floor(start*sampleRate)/sampleRate),0,`${patch}/${kit}: silent noise baseline`);
  assert.equal(gain.at(start),(patch==='clap'?.9:.6)*velocity);
  const end=start+(patch==='clap'?.022+DRUM_KITS[kit].clapTail:DRUM_KITS[kit].snareDecay);
  assert.equal(gain.at(end),.001);
 }
});
