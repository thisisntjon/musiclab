import test from 'node:test';
import assert from 'node:assert/strict';
import {PianoAllocation,pianoNotes,PIANO_PATCH,SAMPLE_TAIL,SAMPLED_PROGRAMS,SAMPLED_TRANSPOSE,CHANNELS,TOTAL_CHANNELS,preparePianoChannels} from '../../../static/js/audio/sampled_piano.js';
import {startJam, contributeJam} from '../../../static/js/theory/jam_session.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {renderDurationSeconds,LookaheadScheduler,LOADING_VOICES} from '../../../static/js/audio/scheduler.js';
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
test('every sampled choice a jam allows survives jam input and selects its pinned bank program', () => {
  // Jams accept only their own instrument list (jam_session PITCHED); Sound wheel presets stay wheel-only.
  const allowed = Object.keys(SAMPLED_PROGRAMS).filter(patchId=>startJam(newPlayDoc(),{kind:'pitched',patchId}).jam_session.patchId===patchId);
  assert.deepEqual(allowed.sort(),['sampled_piano_v1','sampled_electric_piano_v1','sampled_organ_v1','sampled_harmonica_v1',
    'sampled_guitar_v1','sampled_steel_guitar_v1','sampled_clean_guitar_v1','sampled_muted_guitar_v1','sampled_overdrive_guitar_v1',
    'sampled_upright_bass_v1','sampled_bass_v1','sampled_strings_v1','sampled_ooh_v1','sampled_trumpet_v1','sampled_tenor_sax_v1',
    'sampled_clarinet_v1','sampled_banjo_v1'].sort());
  for (const patchId of allowed) {
    const program = SAMPLED_PROGRAMS[patchId];
    const song = contributeJam(startJam(newPlayDoc(),{kind:'pitched',patchId}),{pad:0,step:0});
    assert.equal(song.lead_patch_id,patchId);
    assert.ok(song.notes.some(n=>n.patch_id===patchId && n.provenance==='user_placed'));
    assert.equal(pianoNotes({patch_id:patchId,concrete:{freq_hz:440},duration_sec:.8114})[0].program,program);
  }
});
test('every sampled patch, including wheel-only sounds, plays its own pinned bank program', () => {
  assert.equal(Object.keys(SAMPLED_PROGRAMS).length,36);
  for (const [patchId,program] of Object.entries(SAMPLED_PROGRAMS)) {
    // Only the bass flute sounds away from the written pitch (an octave down); every other patch is unchanged.
    const shift = patchId==='sampled_bass_flute_v1' ? -12 : 0;
    const single = pianoNotes({patch_id:patchId,concrete:{freq_hz:440},duration_sec:.8114,velocity:.5});
    assert.deepEqual(single.map(n=>[n.program,n.pitch,n.duration,n.velocity]),[[program,69+shift,.8114,64]]);
    const chord = pianoNotes({patch_id:patchId,voiced_freqs:[261.6256,329.6276,391.9954],duration_sec:.3});
    assert.deepEqual(chord.map(n=>[n.program,n.pitch]),[[program,60+shift],[program,64+shift],[program,67+shift]]);
  }
});
test('the bass flute plays program 73 one octave below the written pitch; nothing else moves', () => {
  assert.deepEqual({...SAMPLED_TRANSPOSE},{sampled_bass_flute_v1:-12});
  assert.ok(Object.isFrozen(SAMPLED_TRANSPOSE));
  const hz = midi => 440*2**((midi-69)/12);
  const note = (patch_id, midi, extra={}) => ({id:'n',role:'lead',patch_id,duration_sec:.5,velocity:.7,pan:.25,concrete:{midi_pitch:midi,freq_hz:hz(midi)},...extra});
  // The written lead range the wheel plays (62..84) sounds 50..72.
  for (let written=62; written<=84; written++) {
    const event = note('sampled_bass_flute_v1', written), before = structuredClone(event);
    const [voice] = pianoNotes(event);
    assert.deepEqual([voice.program,voice.pitch],[73,written-12]);
    assert.deepEqual(event,before,'the event keeps its written pitch');
    // Same velocity, duration and pan mapping as an untransposed patch.
    const [plain] = pianoNotes(note('sampled_recorder_v1', written));
    assert.deepEqual({...voice,program:0,pitch:0},{...plain,program:0,pitch:0});
    assert.equal(plain.pitch,written);
  }
  // Clamped to the MIDI range; chords move together.
  assert.equal(pianoNotes(note('sampled_bass_flute_v1', 5))[0].pitch,0);
  assert.equal(pianoNotes(note('sampled_bass_flute_v1', 127))[0].pitch,115);
  assert.deepEqual(pianoNotes(note('sampled_bass_flute_v1', 60, {voiced_freqs:[hz(60),hz(64),hz(67)]})).map(n=>n.pitch),[48,52,55]);
  // Prototype keys and unknown names stay silent and unshifted.
  for (const patch_id of ['toString','__proto__','sampled_bass_flute_v2','sampled_flute_v1']) assert.deepEqual(pianoNotes(note(patch_id, 72)),[]);
  // Allocation sees the sounding pitches (60 and 48), so two written-octave notes share a channel without colliding.
  const pool = new PianoAllocation(), [a] = pianoNotes(note('sampled_bass_flute_v1', 72)), [b] = pianoNotes(note('sampled_bass_flute_v1', 60));
  assert.equal(pool.claim(0,1,a.pitch,a.pan,a.program),pool.claim(0,1,b.pitch,b.pan,b.program));
});
test('while the bank loads, the bass flute stand-in plays the written pitch on the native lead voice', () => {
  const scheduler = new LookaheadScheduler();
  scheduler.loadingSession = {state:'loading'};
  const event = {id:'bf',role:'lead',patch_id:'sampled_bass_flute_v1',duration_sec:.5,velocity:.7,concrete:{midi_pitch:72,freq_hz:440*2**(3/12)}};
  const standIn = scheduler._resolveVoice(event);
  assert.equal(standIn.patch_id,LOADING_VOICES.lead);assert.equal(standIn.requested_patch_id,'sampled_bass_flute_v1');assert.equal(standIn.loading_voice,true);
  assert.deepEqual(standIn.concrete,event.concrete,'no transpose is applied to the stand-in or to the take it is recorded in');
  assert.deepEqual(pianoNotes(standIn),[]);
  scheduler.loadingSession = {state:'live'};
  assert.equal(scheduler._resolveVoice(event),event);assert.equal(pianoNotes(event)[0].pitch,60);
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
