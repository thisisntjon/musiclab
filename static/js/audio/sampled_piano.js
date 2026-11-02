/** Optional local sampled palette. Patch identity pins bank/program; no silent synth fallback. */
export const PIANO_PATCH = 'sampled_piano_v1';
import {SAMPLED_PROGRAMS} from '../theory/sampled_sound_capabilities.js';
export {SAMPLED_PROGRAMS};
export const isSampledPatch = patch => Object.hasOwn(SAMPLED_PROGRAMS, patch);
// Four MIDI ports keep repeated pitches/programs isolated through their release
// tails. A single port exhausted during ordinary four-part arrangement changes.
export const CHANNELS = 64;
// Four isolated one-shot answer voices cannot consume the band's/personal pool.
export const ANSWER_CHANNELS = 4;
export const TOTAL_CHANNELS = CHANNELS + ANSWER_CHANNELS;
export const isRecordedAnswer = event => event?.provenance==='jam_generated'
  && event.response?.version===1 && event.response.kind==='exact-echo';
// Programs0/4/24/33 tested releases ended by5.25s; program105 by.75s.
// Characterization is bounded to retained range/gate fixtures, not every controller.
export const SAMPLE_TAIL = 6;
const base = new URL('../../vendor/sampled-piano/', import.meta.url);
let libraryPromise, bankPromise;
async function assets() {
  libraryPromise ||= import(new URL('engine.js', base)).catch(error => { libraryPromise = null; throw error; });
  bankPromise ||= fetch(new URL('GeneralUser-GS-2.0.3.sf2', base)).then(response => {
    if (!response.ok) throw Error('Instrument files could not be loaded. Your song is unchanged.');
    return response.arrayBuffer();
  }).catch(error => { bankPromise = null; throw error; });
  const [library, bank] = await Promise.all([libraryPromise, bankPromise]);
  library.SpessaLog.setLogLevel(false, false, false);
  return {library, bank};
}
export function pianoNotes(event) {
  if (!isSampledPatch(event.patch_id)) return [];
  const velocity = Math.max(0, Math.min(127, Math.round(Number(event.velocity ?? .85) * 127)));
  if (!velocity) return [];
  return (event.voiced_freqs || [event.concrete?.freq_hz || 440]).map(freq => ({
    program: SAMPLED_PROGRAMS[event.patch_id],
    pitch: Math.max(0, Math.min(127, Math.round(69 + 12 * Math.log2(freq / 440)))), velocity,
    duration: Math.max(.001, Number(event.duration_sec) || .25),
    pan: Math.max(0, Math.min(127, Math.round(64 + 63 * Number(event.pan || 0)))),
  }));
}
export class PianoAllocation {
  constructor() { this.slots = Array.from({length:TOTAL_CHANNELS}, () => []); }
  claim(at, duration, pitch = 60, pan = 64, program = 0, answerMode = null) {
    const active = this.slots.map(slots => slots.filter(note => note.until > at));
    let channel=-1;
    if(answerMode && active.slice(CHANNELS).flat().length<ANSWER_CHANNELS)
      channel=active.findIndex((notes,ch)=>ch>=CHANNELS&&notes.every(note=>note.pitch!==pitch&&note.pan===pan&&note.program===program));
    if(channel<0&&answerMode==='reply')throw Error('Answer voices are still fading. Your notes and band stay.');
    if(channel<0) {
      if(active.slice(0,CHANNELS).flat().length>=120)throw Error('Too many overlapping sampled notes. Stop and reduce the overlap; no notes were removed.');
      channel=active.findIndex((notes,ch)=>ch<CHANNELS&&ch%16!==9&&notes.every(note=>note.pitch!==pitch&&note.pan===pan&&note.program===program));
    }
    if (channel < 0) throw Error('Too many overlapping sampled notes. Stop and reduce the overlap; no notes were removed.');
    this.slots = active;
    this.slots[channel].push({pitch,pan,program,until:at + duration + SAMPLE_TAIL});
    return channel;
  }
  release(channel, at, pitch = 60) {
    const note = this.slots[channel].find(note => note.pitch === pitch);
    if (note) note.until = at + SAMPLE_TAIL;
  }
}
function setup(synth) {
  for (let ch = 0; ch < TOTAL_CHANNELS; ch++) if (ch % 16 !== 9) {
    synth.programChange(ch, 0); synth.controllerChange(ch, 91, 0); synth.controllerChange(ch, 93, 0);
  }
}
/** The pinned library reports a new channel's reset before channelAdded.
 * Hold those metadata callbacks until its client-side channel exists. Audio
 * messages and note lifetimes are unchanged; no vendor bytes are patched.
 */
export async function preparePianoChannels(synth) {
  const receive=synth.receiveEventCallback;
  const pending=[];
  synth.receiveEventCallback=function(event) {
    const channel=['channelParamChange','programChange'].includes(event.type)?event.data.channel:null;
    if(channel!==null&&!this.midiChannels[channel]) {pending.push(event);return;}
    receive.call(this,event);
    if(event.type==='channelAdded')for(let i=0;i<pending.length;) {
      if(this.midiChannels[pending[i].data.channel])receive.call(this,pending.splice(i,1)[0]);
      else i++;
    }
  };
  try {
    for(let ch=synth.midiChannels.length;ch<TOTAL_CHANNELS;ch++)synth.addNewChannel();
    const deadline=performance.now()+10000;
    while(synth.midiChannels.length<TOTAL_CHANNELS) {
      if(performance.now()>deadline)throw Error('Instrument initialization timed out. Try loading again.');
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    if(pending.length)throw Error('Instrument channels did not initialize. Try loading again.');
  } finally {synth.receiveEventCallback=receive;}
}
export async function createPiano(context, destination) {
  const {library, bank} = await assets();
  await context.audioWorklet.addModule(new URL('spessasynth_processor.min.js', base));
  const synth = new library.WorkletSynthesizer(context);
  const bus = context.createGain();
  let closed = false;
  try {
    await synth.isReady;
    await synth.soundBankManager.addSoundBank(bank.slice(0), 'generaluser-2.0.3-piano-v1');
    await preparePianoChannels(synth);
    setup(synth); bus.gain.value = .35; synth.connect(bus); bus.connect(destination);
  } catch (error) { bus.disconnect(); synth.destroy(); throw error; }
  const allocation = new PianoAllocation();
  const programs = Array(TOTAL_CHANNELS).fill(0);
  const handles = new Set();
  function trigger(event, at, held = false, answer = false) {
    if (closed) throw Error('Sampled sounds stopped. Load them again before playing.');
    const notes = pianoNotes(event);
    // Reserve all chord voices before emitting any attack.
    const old = structuredClone(allocation.slots);
    let tokens;
    try { tokens = notes.map(note => ({...note, cap:at + note.duration, channel:allocation.claim(at, held ? Infinity : note.duration, note.pitch, note.pan, note.program, answer?'reply':isRecordedAnswer(event)?'recorded':null)})); }
    catch (error) { allocation.slots = old; throw error; }
    const handle = {tokens, released:false}; handles.add(handle);
    for (const note of tokens) {
      if (programs[note.channel] !== note.program) {
        synth.programChange(note.channel, note.program, {time:at}); programs[note.channel] = note.program;
      }
      synth.controllerChange(note.channel, 10, note.pan, {time:at});
      synth.noteOn(note.channel, note.pitch, note.velocity, {time:at});
      // Audio-clock cap still releases a held note if the UI thread stalls.
      synth.noteOff(note.channel, note.pitch, {time:note.cap});
    }
    if (!held) handles.delete(handle);
    return handle;
  }
  return {trigger, release(handle, at) {
    if (closed || !handles.delete(handle) || handle.released) return false;
    handle.released = true;
    for (const note of handle.tokens) {
      if (at < note.cap) synth.noteOff(note.channel, note.pitch, {time:at});
      // The already queued cap must never release a newer same-pitch attack.
      allocation.release(note.channel, Math.max(at, note.cap), note.pitch);
    }
    return true;
  }, stop() {
    if (closed) return;
    closed = true; handles.clear(); bus.gain.cancelScheduledValues(context.currentTime);
    bus.gain.setValueAtTime(0, context.currentTime); bus.disconnect(); synth.stopAll(true); synth.destroy();
  }};
}

/** Same bank/mapping/gates as live, rendered on sample frames before WebAudio mixing. */
export async function renderPiano(events, sampleRate, samples) {
  const {library, bank} = await assets();
  const synth = new library.SpessaSynthProcessor(sampleRate);
  await synth.ready;
  const left = new Float32Array(samples), right = new Float32Array(samples);
  try {
    synth.soundBankManager.addSoundBank(library.SoundBankLoader.fromArrayBuffer(bank.slice(0)), 'generaluser-2.0.3-piano-v1');
    while (synth.midiChannels.length < TOTAL_CHANNELS) synth.createMIDIChannel();
    setup(synth);
    const actions = [], allocation = new PianoAllocation(), programs = Array(TOTAL_CHANNELS).fill(0);
    for (const event of [...events].sort((a,b) => a.start_sec-b.start_sec)) {
      const at = Math.max(.005, Number(event.start_sec) || 0);
      for (const note of pianoNotes(event)) {
        const channel = allocation.claim(at, note.duration, note.pitch, note.pan, note.program, isRecordedAnswer(event)?'recorded':null);
        actions.push({frame:Math.round(at*sampleRate), on:true, channel, ...note});
        actions.push({frame:Math.round((at+note.duration)*sampleRate), on:false, channel, ...note});
      }
    }
    actions.sort((a,b) => a.frame-b.frame || Number(a.on)-Number(b.on));
    let offset = 0;
    for (const action of actions) {
      const end = Math.min(samples, action.frame);
      while (offset < end) { const n=Math.min(128,end-offset); synth.process(left,right,offset,n); offset+=n; }
      if (action.frame >= samples) continue;
      if (action.on) {
        if (programs[action.channel] !== action.program) { synth.programChange(action.channel,action.program); programs[action.channel]=action.program; }
        synth.controllerChange(action.channel,10,action.pan); synth.noteOn(action.channel,action.pitch,action.velocity);
      }
      else synth.noteOff(action.channel,action.pitch);
    }
    while(offset<samples) { const n=Math.min(128,samples-offset); synth.process(left,right,offset,n); offset+=n; }
    return [left, right];
  } finally { synth.destroy(); }
}
