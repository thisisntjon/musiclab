import test from 'node:test';
import assert from 'node:assert/strict';
import {PianoAllocation,pianoNotes,PIANO_PATCH,SAMPLE_TAIL,SAMPLED_PROGRAMS,CHANNELS,TOTAL_CHANNELS,preparePianoChannels} from '../../../static/js/audio/sampled_piano.js';
import {startJam, contributeJam} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {renderDurationSeconds} from '../../../static/js/audio/scheduler.js';
test('piano voices reserve distinct channels and never silently steal on exhaustion', () => {
  const pool=new PianoAllocation();
  const available=CHANNELS-CHANNELS/16;
  const channels=Array.from({length:available},()=>pool.claim(0,4));
  assert.equal(new Set(channels).size,available);
  assert.ok(channels.every(ch=>ch%16!==9));
  const before=structuredClone(pool.slots);
  assert.throws(()=>pool.claim(0,4),/overlapping/);
  assert.deepEqual(pool.slots,before);
  pool.release(0,1); assert.throws(()=>pool.claim(1+SAMPLE_TAIL-.01,1));
  assert.equal(pool.claim(1+SAMPLE_TAIL,1),0);
});
test('sampled exports reserve measured piano release tail after the complete arrangement', () => {
  assert.equal(renderDurationSeconds({total_duration_sec:10,events:[{patch_id:PIANO_PATCH,start_sec:9,duration_sec:3}]}),18);
  assert.equal(renderDurationSeconds({total_duration_sec:10,events:[]}),12);
});
test('channel creation buffers early reset metadata without losing ordering or callbacks',async()=>{
 const synth={midiChannels:Array.from({length:16},()=>({})),
  receiveEventCallback(event){
   if(event.type==='channelAdded')this.midiChannels.push({});
   else this.midiChannels[event.data.channel][event.type]=event.data.value;
  },addNewChannel(){
   const channel=this.midiChannels.length;
   this.receiveEventCallback({type:'channelParamChange',data:{channel,value:'reset'}});
   this.receiveEventCallback({type:'programChange',data:{channel,value:24}});
   this.receiveEventCallback({type:'channelAdded'});
  }};
 const original=synth.receiveEventCallback;
 await preparePianoChannels(synth);
 assert.equal(synth.receiveEventCallback,original);
 assert.equal(synth.midiChannels.length,TOTAL_CHANNELS);
 for(const channel of synth.midiChannels.slice(16))assert.deepEqual(channel,{channelParamChange:'reset',programChange:24});
});
test('different programs cannot retimbre an occupied channel', () => {
  const pool = new PianoAllocation();
  assert.equal(pool.claim(0,4,60,64,0),0);
  assert.equal(pool.claim(0,4,64,64,0),0);
  assert.equal(pool.claim(0,4,67,64,24),1);
  assert.equal(pool.claim(0,4,40,64,33),2);
  assert.equal(pool.claim(0,4,72,32,0),3);
  assert.equal(pool.slots[0][0].program,0);
});
test('every sampled choice survives jam input and selects its pinned bank program', () => {
  for (const [patchId,program] of Object.entries(SAMPLED_PROGRAMS)) {
    const song = contributeJam(startJam(newPlayDoc(),{kind:'pitched',patchId}),{pad:0,step:0});
    assert.equal(song.lead_patch_id,patchId);
    assert.ok(song.notes.some(n=>n.patch_id===patchId && n.provenance==='user_placed'));
    assert.equal(pianoNotes({patch_id:patchId,concrete:{freq_hz:440},duration_sec:.8114})[0].program,program);
  }
});
test('piano mapping keeps repeated chord voices and fractional gate, with explicit silence', () => {
  const event={patch_id:PIANO_PATCH,voiced_freqs:[440,440],duration_sec:.8114,velocity:.5};
  assert.deepEqual(pianoNotes(event).map(n=>[n.pitch,n.duration,n.velocity]),[[69,.8114,64],[69,.8114,64]]);
  assert.deepEqual(pianoNotes({...event,velocity:0}),[]);
  assert.deepEqual(pianoNotes({...event,patch_id:'warm_keys'}),[]);
});


test('four answer slots cannot exhaust or retimbre normal voices; recorded edits can use normal pool',()=>{
 const pool=new PianoAllocation();
 for(let i=0;i<4;i++)assert.equal(pool.claim(0,4,60,64,0,'reply'),CHANNELS+i);
 const before=structuredClone(pool.slots);
 assert.throws(()=>pool.claim(0,4,64,64,0,'reply'),/still fading/);assert.deepEqual(pool.slots,before);
 for(let i=0;i<120;i++)assert.ok(pool.claim(0,4,60+i%2,64,0)<CHANNELS);
 assert.equal(pool.slots.flat().length,124);assert.throws(()=>pool.claim(0,4,67),/overlapping/);
 const edited=new PianoAllocation();for(let i=0;i<12;i++)edited.claim(0,.25,60,64,0,'recorded');
 assert.equal(edited.slots.flat().length,12);assert.equal(edited.slots.slice(CHANNELS).flat().length,4);
});
