import {bassInterval} from './underneath.js';
export const TRIPLE_SCENE_COMPATIBILITY=Object.freeze({version:1,stepsPerBar:12,cycleSteps:48,
  quarterBeatsPerBar:3,tuning:'12tet',tempo:'preserve-session',entrySteps:Object.freeze([0,12,24,36])});
/** Original three-quarter-beat grooves. These are arrangements, not authentic genre models. */
export function tripleBacking(doc,session,preserved=[]) {
  const direction=Math.max(0,Math.min(3,session.style_spectrum||0));
  const lo=Math.floor(direction),hi=Math.ceil(direction);
  if(lo!==hi) {
    const merged=new Map();
    for(const [profile,weight] of [[lo,hi-direction],[hi,direction-lo]]) {
      for(const note of tripleBacking(doc,{...session,style_spectrum:profile},preserved)) {
        const key=`${note.role}-${note.patch_id}-${note.step}-${note.role==='bass'?'one':note.concrete.midi_pitch}`;
        const previous=merged.get(key);
        const chosen=!previous || weight>previous.weight?note:previous.note;
        merged.set(key,{weight:Math.max(weight,previous?.weight||0),note:{...chosen,id:`triple-blend-${key}`,
          velocity:(previous?.note.velocity||0)+note.velocity*weight}});
      }
    }
    const notes=[...merged.values()].map(value=>value.note);
    const bass=notes.filter(n=>n.role==='bass').sort((a,b)=>a.step-b.step);
    for(let i=0;i<bass.length-1;i++)bass[i].duration_steps=Math.min(bass[i].duration_steps,bass[i+1].step-bass[i].step);
    return notes;
  }
  const root=Number(doc.global_context?.root_pc)||0;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const profile=lo, variant=session.scene_variant||'base';
  const notes=[];
  const add=(bar,step,role,patch,midi,duration,velocity)=>{
    const note={id:`triple-v1-${profile}-${variant}-${bar}-${step}-${role}-${midi}`,step:bar*12+step,
      duration_steps:duration,velocity,role,patch_id:patch,pitch_lock_mode:'concrete',concrete:{midi_pitch:midi},
      performance:{version:1,offset_steps:0},
      ...(role==='harmony'?{voiced_freqs:[440*2**((midi-69)/12)]}:{}),
      provenance:'jam_generated',generated_by:'musiclab_jam',scene_version:1};
    if(preserved.some(n=>n.role===role && (role==='bass'
      ? (()=>{const [a,b]=bassInterval(n,doc),[c,d]=bassInterval(note,doc);return a<d&&c<b;})()
      : n.step===note.step && (role!=='drums'||n.patch_id===patch))))return;
    notes.push(note);
  };
  for(let bar=0;bar<4;bar++) {
    const bass=36+root+[0,5,7,0][bar];
    const sparse=variant==='space'&&bar%2===1;
    const kick=profile===3?[0,4,8]:profile===2?[0,7]:[0];
    for(const s of kick)add(bar,s,'drums','kick',36,1,.38);
    if(!sparse)for(const s of (profile===0?[8]:[4,8]))add(bar,s,'drums','snare',38,1,.22);
    if(session.density>0)for(let s=2;s<12;s+=sparse||session.density===1?4:2)add(bar,s,'drums','hat_closed',42,.6,s%4===0?.13:.09);
    if(session.density>=3&&!sparse)for(const s of [3,7,11])add(bar,s,'drums','hat_closed',42,.4,.07);
    if(session.density===4&&!sparse)add(bar,9,'drums','perc',45,.5,.13);
    const bassSteps=sparse||session.density===0?[0]:profile===3?[0,4,8]:profile===2?[0,6,10]:[0,8];
    if(variant==='answer'&&bar%2===1)bassSteps[bassSteps.length-1]=Math.min(11,bassSteps.at(-1)+2);
    bassSteps.forEach((s,i)=>add(bar,s,'bass','clean_bass',bass+(i%2?7:0),Math.min(profile===0?4:2,12-s),.32));
    const chords=sparse||session.density===0?[4]:profile===3?[2,6,10]:profile===2?[3,7]:[4,8];
    if(!doc.auto_harmony_stabs)for(const s of chords)for(const interval of [0,minor?3:4,7])
      add(bar,s,'harmony',session.color===4?'supersaw_stab':session.color>=2?'pluck_lead':'warm_keys',
        bass+(session.color===0?12:session.color>=3?36:24)+interval,session.color===0?2:1.5,.2);
    if(variant==='answer'&&bar%2===1)add(bar,11,'drums','perc',45,.6,.18);
  }
  return notes;
}
