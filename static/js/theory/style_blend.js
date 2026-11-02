import { bassInterval } from './underneath.js';
import { arrangeScene } from './style_scenes.js';
/** Original compatible backing profiles, blended as editable symbolic notes.
 * Genre-inspired, not claims of authentic instrumentation or a universal style model.
 */
export const STYLE_PROFILES = Object.freeze([
  {id:'laid_back_v1', name:'Laid back'}, {id:'backbeat_pop_v1', name:'Pop backbeat'},
  {id:'syncopated_funk_v1', name:'Syncopated funk'}, {id:'dance_v1', name:'Dance pulse'},
].map(Object.freeze));

export function spectrumDescription(position, profiles=STYLE_PROFILES) {
  const p = Math.max(0,Math.min(profiles.length-1,Number(position)||0)), low = Math.floor(p), mix=p-low;
  return mix === 0 ? profiles[low].name : `${profiles[low].name} → ${profiles[low+1].name}: ${Math.round(mix*100)}%`;
}

/** Versioned adjacent profiles on one compatible clock/key; legacy function below is unchanged. */
export function spectrumBacking(doc, session, preserved) {
  const position = Math.max(0,Math.min(3,session.style_spectrum));
  const lower = Math.floor(position), fraction = position-lower;
  const mix = [[lower,1-fraction], ...(fraction ? [[lower+1,fraction]] : [])];
  const merged = new Map();
  for (const [index,weight] of mix) {
    const profile = index === 0 || index === 3
      ? blendedBacking(doc,{...session,style_blend:index===3?1:0},preserved)
      : authoredProfile(doc,session,preserved,index);
    for (const note of arrangeScene(profile,index,session.scene_variant || 'base')) {
      const id=`jam-spectrum-${note.role}-${note.patch_id}-${note.step}-${note.concrete.midi_pitch}`;
      const velocity=note.velocity*weight, prior=merged.get(id);
      if (prior) {
        const total=prior.velocity+velocity;
        prior.duration_steps=(prior.duration_steps*prior.velocity+note.duration_steps*velocity)/total;
        prior.performance.offset_steps=(prior.performance.offset_steps*prior.velocity+note.performance.offset_steps*velocity)/total;
        prior.velocity=total; prior.style_weight=Math.min(1,prior.style_weight+weight);
        prior.style_profiles.push(STYLE_PROFILES[index].id);
      } else merged.set(id,{...note,id,velocity,style_weight:weight,style_version:'connected-four-v1',
        style_profiles:[STYLE_PROFILES[index].id],performance:{...note.performance}});
    }
  }
  const protectedBass = preserved.filter(note=>note.role==='bass').map(note=>bassInterval(note,doc));
  return [...merged.values()].filter(note => {
    if (note.role!=='bass') return !preserved.some(own=>own.role===note.role && own.step===note.step
      && (note.role!=='drums'||own.patch_id===note.patch_id));
    const [start,end]=bassInterval(note,doc);
    return !protectedBass.some(([ownStart,ownEnd])=>start<ownEnd && ownStart<end);
  })
    .sort((a,b)=>a.step-b.step||a.id.localeCompare(b.id));
}

function authoredProfile(doc, session, preserved, index) {
  const funk=index===2, notes=[];
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const third=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'')?3:4;
  const add=(role,patch,step,midi,duration,velocity,offset=0)=>{
    if(preserved.some(n=>n.role===role&&n.step===step&&(role!=='drums'||n.patch_id===patch)))return;
    notes.push({id:`profile-${role}-${patch}-${step}-${midi}`,role,patch_id:patch,step,
      concrete:{midi_pitch:midi},duration_steps:duration,velocity,pitch_lock_mode:'concrete',
      provenance:'jam_generated',generated_by:'musiclab_jam',performance:{version:1,offset_steps:offset},
      ...(role==='drums'?{drum_kit:session.kit}:{sound_seed:{brightness:.2+session.color*.15,warmth:.8-session.color*.12,width:.35}}),
      ...(role==='harmony'?{voiced_freqs:[440*2**((midi-69)/12)]}:{})});
  };
  for(let bar=0;bar<4;bar++) {
    const base=bar*16, degree=[0,5,7,0][bar];
    for(const step of funk?[0,6,10]:[0,8,10])add('drums','kick',base+step,36,1,step===0?.62:.46);
    for(const step of[4,12])add('drums','snare',base+step,38,1,.44);
    const hats=session.density===0?[2,10]:session.density===1?[2,6,10,14]:[0,2,4,6,8,10,12,14];
    for(const step of hats)add('drums','hat_closed',base+step,42,1,step%4===2?.24:.13,funk?.08:0);
    if(session.density>=3)for(const step of funk?[3,11]:[7,15])add('drums','perc',base+step,45,1,.18);
    if(session.density===4)for(const step of funk?[7,15]:[3,11])add('drums','perc',base+step,45,1,.12);
    const bassSteps=session.density===0?[0]:funk?[0,3,6,10,14]:[0,8];
    for(const step of bassSteps)add('bass','clean_bass',base+step,36+root+degree+(funk&&[3,14].includes(step)?7:0),funk?1.25:6,.4);
    if(!doc.auto_harmony_stabs)for(const step of funk?[2,7,10,15]:[0,8])
      for(const interval of[0,third,7])add('harmony',session.color===4?'supersaw_stab':funk?'pluck_lead':'warm_keys',
        base+step,48+root+degree+interval+(session.color>=3?12:0),funk?1.25:6,.14);
  }
  return notes;
}

export function blendedBacking(doc, session, preserved) {
  const p = Math.max(0, Math.min(1, session.style_blend));
  const root = ((Number(doc.global_context?.root_pc) || 0) % 12 + 12) % 12;
  const third = /minor|dorian|phrygian/.test(doc.global_context?.scale_type || '') ? 3 : 4;
  const merged = new Map();
  const occupied = (role, patch, step) => preserved.some(n => n.role === role && n.step === step
    && (role !== 'drums' || n.patch_id === patch));
  function add(weight, role, patch, step, midi, duration, velocity, offset = 0) {
    if (weight <= 0 || occupied(role, patch, step)) return;
    const id = `jam-style-${role}-${patch}-${step}-${midi}`;
    const v = weight * velocity;
    const prior = merged.get(id);
    if (prior) {
      const total = prior.velocity + v;
      prior.duration_steps = (prior.duration_steps * prior.velocity + duration * v) / total;
      prior.performance.offset_steps = (prior.performance.offset_steps * prior.velocity + offset * v) / total;
      prior.velocity = total;
      prior.style_weight = Math.min(1, prior.style_weight + weight);
      return;
    }
    merged.set(id, { id, role, patch_id: patch, step, concrete: { midi_pitch: midi },
      duration_steps: duration, velocity: v, pitch_lock_mode: 'concrete',
      provenance: 'jam_generated', generated_by: 'musiclab_jam', style_version: 'two-feels-v1', style_weight: weight,
      performance: { version: 1, offset_steps: offset },
      ...(role === 'drums' ? { drum_kit: session.kit } : { sound_seed: {
        brightness: .2 + session.color * .15, warmth: .8 - session.color * .12, width: .35 } }),
      ...(role === 'harmony' ? { voiced_freqs: [440 * 2 ** ((midi - 69) / 12)] } : {}),
    });
  }
  for (let bar = 0; bar < 4; bar++) {
    const base = bar * 16, degree = [0, 5, 7, 0][bar];
    for (const dance of [false, true]) {
      const weight = dance ? p : 1 - p;
      const drum = (patch, step, midi, velocity, offset = 0) => add(weight, 'drums', patch, base + step, midi, 1, velocity, offset);
      for (const step of dance ? [0, 4, 8, 12] : [0, 7, 10]) drum('kick', step, 36, step === 0 ? .62 : .48);
      for (const step of [4, 12]) drum(dance ? 'clap' : 'snare', step, dance ? 39 : 38, .42);
      const hats = session.density === 0 ? [2, 10] : session.density === 1 ? [2, 6, 10, 14] : [0, 2, 4, 6, 8, 10, 12, 14];
      for (const step of hats) drum('hat_closed', step, 42, step % 4 === 2 ? .25 : .14, dance ? 0 : .14);
      if (session.density >= 3) for (const step of dance ? [7, 15] : [3, 13]) drum('perc', step, 45, .18);
      if (session.density === 4) for (const step of dance ? [3, 11] : [6, 15]) drum('perc', step, 45, .12);
      const bassSteps = session.density === 0 ? [0] : dance ? [0, 4, 8, 12] : [0, 7, 10];
      for (const step of bassSteps) add(weight, 'bass', 'clean_bass', base + step, 36 + root + degree,
        dance ? 2 : step === 0 ? 5 : 2, .42);
      if (!doc.auto_harmony_stabs) for (const step of dance ? [2, 6, 10, 14] : [1, 11]) {
        for (const interval of [0, third, 7]) add(weight, 'harmony', session.color === 4 ? 'supersaw_stab' : dance ? 'pluck_lead' : 'warm_keys', base + step,
          48 + root + degree + interval + (session.color >= 3 ? 12 : 0), dance ? 1.5 : step === 1 ? 7 : 3, .14);
      }
    }
  }
  return [...merged.values()].sort((a, b) => a.step - b.step || a.id.localeCompare(b.id));
}
