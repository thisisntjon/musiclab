import {stepsPerBar} from './musical_time.js';
import {bassInterval} from './underneath.js';
const clone=value=>JSON.parse(JSON.stringify(value));
/** A score snapshot of the band active on the audio clock, not a recording of hardware output. */
export function anchorBand(doc,snapshot) {
  if(!snapshot?.events?.length)return null;
  const next=clone(doc),stepSec=15/next.global_context.bpm;
  const notes=snapshot.events.filter(n=>n.provenance==='jam_generated').map(event=>{
    const note=clone(event);
    for(const key of ['start_sec','duration_sec','card','section_id'])delete note[key];
    note.duration_steps=event.duration_sec/stepSec;
    note.performance={version:1,offset_steps:Math.max(0,Math.min(.999999,event.start_sec/stepSec-event.step))};
    note.pitch_lock_mode='concrete';
    return note;
  });
  if(!notes.length)return null;
  next.jam_session.anchor_backing={version:1,time:snapshot.time,steps_per_bar:stepsPerBar(doc),notes};
  next.jam_session.anchor_traits={version:1,drums:2,chords:2};
  next.jam_session.scene_variant='base';
  return next;
}

/** Small variants of the actual active backing; original anchor never mutates. */
export function anchoredBacking(doc,session,preserved) {
  const cycle=stepsPerBar(doc),variant=session.scene_variant||'base';
  const notes=clone(session.anchor_backing.notes);
  const selected=notes.filter(note=>variant!=='space'||Math.floor(note.step/cycle)%2===0
    ||note.role==='bass'||note.step%cycle<cycle/2);
  if(variant==='answer')for(const note of selected) {
    if(Math.floor(note.step/cycle)%2===1 && note.step%cycle>=cycle/2) {
      if(note.role==='bass')note.concrete.midi_pitch=Math.min(127,note.concrete.midi_pitch+7);
      if(note.role==='drums')note.velocity=Math.min(1,note.velocity*1.2);
    }
  }
  const filtered=selected.filter(note=>!preserved.some(own=>own.role===note.role&&(note.role==='bass'
    ? (()=>{const [a,b]=bassInterval(own,doc),[c,d]=bassInterval(note,doc);return a<d&&c<b;})()
    :own.step===note.step&&(note.role!=='drums'||own.patch_id===note.patch_id))));
  return applyAnchorTraits(filtered,session.anchor_traits,preserved,doc);
}

const TRAIT_FACTORS=[.6,.8,1,1.15,1.3];

/** Relative edits always start from the frozen score, never the last edit. */
export function applyAnchorTraits(notes,traits,preserved,doc) {
  if(!traits)return notes;
  const drumFactor=TRAIT_FACTORS[traits.drums]??1,chordFactor=TRAIT_FACTORS[traits.chords]??1;
  return notes.map(note=>{
    if(note.provenance!=='jam_generated')return note;
    if(note.role==='drums'&&drumFactor!==1)return {...note,velocity:Math.min(1,note.velocity*drumFactor)};
    if(note.role!=='harmony'||chordFactor===1)return note;
    const [start,end]=bassInterval(note,doc);
    let duration=note.duration_steps*chordFactor;
    if(chordFactor>1) {
      let cap=stepsPerBar(doc)*4;
      for(const other of [...notes.filter(n=>n!==note&&n.role==='harmony'&&n.patch_id===note.patch_id
        &&n.concrete?.midi_pitch===note.concrete?.midi_pitch),...preserved.filter(n=>n.role==='harmony')]) {
        const [at,until]=bassInterval(other,doc);
        if(at>start)cap=Math.min(cap,at);
        else if(until>start)cap=Math.min(cap,end);
      }
      // Preserve any existing overlap/tail at neutral; never create a new one.
      duration=Math.min(duration,Math.max(end,cap)-start);
    }
    return {...note,duration_steps:duration};
  });
}
