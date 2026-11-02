import {jamPads} from './jam_session.js';
import {isSampledPatch} from '../audio/sampled_piano.js';
import {validFormMode} from './jam_form.js';
const pitched=p=>isSampledPatch(p)||['warm_keys','pluck_lead','supersaw_stab','clean_bass'].includes(p);
const midi=e=>Number.isFinite(e.concrete?.midi_pitch)?e.concrete.midi_pitch:69+12*Math.log2((e.concrete?.freq_hz||440)/440);
/** Resolve only NEW presses from the score active on the audio clock. */
export function dynamicJamPads(doc,context){
 const fallback=jamPads(doc);
 if(!context?.backing?.events?.length||doc.jam_session?.kind==='drums')return fallback;
 const mode=context.backing.phraseContext?.mode;
 if(validFormMode(mode)){
  // Sparse modal piano voicings are not the complete mode. Offer its declared
  // tonic/third/sixth/seventh for new presses, using only the reached context.
  const pcs=[0,mode.intervals[2],mode.intervals[5],mode.intervals[6]].map(n=>(mode.tonic+n)%12).sort((a,b)=>a-b);
  const lead=context.backing.events.find(e=>e.role==='lead'&&pitched(e.patch_id));
  const declared=context.backing.phraseContext?.form_lead_patch;
  const patch=doc.jam_session?.follow_band_sound===false?fallback[0].patchId:lead?.patch_id||(pitched(declared)?declared:fallback[0].patchId);
  const octave=/bass/.test(patch)?36:60;
  return fallback.map((pad,i)=>({...pad,midi:octave+pcs[i],role:'lead',patchId:patch}));
 }
 const cycle=doc.global_context?.steps_per_bar||16,bar=Math.floor(context.position/cycle),position=context.position;
 const local=context.backing.events.filter(e=>Math.floor(e.step/cycle)===bar&&pitched(e.patch_id));
 const harmony=local.filter(e=>e.role==='harmony');
 const pool=harmony.length?harmony:local.filter(e=>e.role==='bass'||e.role==='lead');
 if(!pool.length)return fallback;
 const start=e=>e.start_sec/(15/context.bpm);
 const begun=pool.filter(e=>start(e)<=position+1e-7);
 const active=begun.filter(e=>start(e)+e.duration_sec/(15/context.bpm)>position);
 // Keep the local harmonic vocabulary in a rest; never use a future recipe.
 const tones=active.length>=2?active:pool;
 const pcs=[...new Set(tones.map(e=>((Math.round(midi(e))%12)+12)%12))].sort((a,b)=>a-b);
 const counts=new Map();for(const e of pool)counts.set(e.patch_id,(counts.get(e.patch_id)||0)+1);
 const patch=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
 const selectedPatch=doc.jam_session?.follow_band_sound===false?fallback[0].patchId:patch;
 const notes=[];for(let octave=/bass/.test(selectedPatch)?36:60;notes.length<4;octave+=12)for(const pc of pcs){notes.push(octave+pc);if(notes.length===4)break;}
 return fallback.map((pad,i)=>({...pad,midi:notes[i],role:'lead',patchId:selectedPatch}));
}
export const MELODY_KEYS = ["a", "s", "d", "f", "g", "h", "j", "k"];
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
/**
 * Room to play a tune (phase 13.3b): eight keys up the scale, A to K, one octave from the
 * key's home note. The chord's own tones (what the four pads offered before) are marked
 * `home`, so a child can see which keys always land. Octave shifts move all eight.
 * Drums keep their four pads.
 */
export function melodyPads(doc, context, { octaveShift = 0 } = {}) {
  const chord = dynamicJamPads(doc, context);
  if (doc.jam_session?.kind === "drums") return chord;
  const g = doc.global_context || {};
  const mode = context?.backing?.phraseContext?.mode;
  // A style with its own mode owns the row: its tonic is home and its intervals are the steps.
  const root = validFormMode(mode) ? ((mode.tonic % 12) + 12) % 12 : ((Number(g.root_pc) || 0) % 12 + 12) % 12;
  const scale = validFormMode(mode) ? [...new Set(mode.intervals.map(n => ((n % 12) + 12) % 12))].sort((a, b) => a - b)
    : /minor|dorian|phrygian|aeolian/.test(g.scale_type || "") ? MINOR : MAJOR;
  const chordPcs = new Set(chord.map(p => ((p.midi % 12) + 12) % 12));
  const patchId = chord[0].patchId, low = Math.floor(chord[0].midi / 12) * 12 + 12 * octaveShift;
  const degrees = [...scale.slice(0, 7), 12];
  return degrees.map((interval, i) => {
    const midi = Math.max(24, Math.min(103, low + root + interval));
    const home = chordPcs.has(((midi % 12) + 12) % 12);
    return { key: MELODY_KEYS[i], label: i === 0 || i === 7 ? "Home" : String(i + 1), midi, role: "lead", patchId, home };
  });
}

/** A fresh personal piece keeps timing and a separately labelled full-band reference. */
export function personalPerformance(capture,{includeRepeats=false}={}){
 if(!capture)return null;
 return {...capture,events:capture.events.filter(r=>r.event.provenance==='user_placed'&&(includeRepeats?/^(jam-live-|jam-user-|live-only-)/:/^jam-live-/).test(String(r.event.source_note_id||r.event.id||'')))};
}
