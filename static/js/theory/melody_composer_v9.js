// Versioned phrase development. V5-V8 remain unchanged for saved work.
import {buildMelodyPalette as seven, SUPPORTED_SCENES as sevenScenes} from './melody_composer_v7.js';
import {buildMelodyPalette as eight, SUPPORTED_SCENES as eightScenes} from './melody_composer_v8.js';
import {melodyChoice as baseChoice} from './melody_composer_v6.js';
import {GENRE_PROFILES} from './melody_composer_v5.js';
export {MELODY_FAMILIES, REGION_NAMES, VOCABULARY_VERSION} from './melody_composer_v6.js';
export const DEFAULT_COMPOSER_VERSION = 9;
export const SUPPORTED_SCENES = new Set([...sevenScenes, ...eightScenes]);
export const RADIAL_TREATMENTS = ['Light', 'Theme', 'Breathe', 'Return'];
export function melodyChoice(position) {
 const choice=baseChoice(position);
 if(choice.key==='original')return choice;
 const treatment=RADIAL_TREATMENTS[Number(choice.key.split(':')[1])-1];
 return {...choice,treatment,label:choice.label.replace(/ \d$/, ` \u00b7 ${treatment}`)};
}
const copy=x=>structuredClone(x), q=x=>Math.round(x*1000)/1000;
export const onset=n=>n.step+(n.performance?.offset_steps||0);
const generated=n=>n.role==='lead'&&n.provenance==='jam_generated'&&/^musiclab_phrase_composer_v[678]$/.test(n.generated_by||'');
const eligible=n=>generated(n)&&!n.derivation?.motif_anchor;
const bar=n=>Math.floor(onset(n)/16);
const eventSig=n=>JSON.stringify([onset(n),n.duration_steps,n.concrete?.midi_pitch,n.velocity,n.patch_id]);
const lead=p=>p.notes.filter(n=>n.role==='lead').sort((a,b)=>onset(a)-onset(b));
const digest=x=>JSON.stringify(x);

const maxLeap=ns=>Math.max(0,...ns.slice(1).map((n,i)=>Math.abs(n.concrete.midi_pitch-ns[i].concrete.midi_pitch)));
export function boundBreathEnding(ctx,theme,breath){
 const plan=structuredClone(breath),notes=lead(plan),limit=Math.max(12,maxLeap(lead(theme))),changed=[];
 for(let i=1;i<notes.length;i++){
  const n=notes[i-1],next=notes[i],gap=onset(next)-onset(n)-n.duration_steps;
  if(Math.abs(next.concrete.midi_pitch-n.concrete.midi_pitch)<=limit)continue;
  if(gap<4-1e-6||onset(n)<32||onset(n)>=44||onset(next)<48)return {plan:structuredClone(breath),applied:false,reason:'not-a-breath-boundary'};
  if(n.provenance!=='jam_generated'||n.derivation?.motif_anchor||!/^musiclab_phrase_composer_v[6789]$/.test(n.generated_by||''))return {plan:structuredClone(breath),applied:false,reason:'protected-breath-end'};
  const [lo,hi]=GENRE_PROFILES[ctx.sceneId].reg||ctx.register,old=n.concrete.midi_pitch,prior=notes[i-2]?.concrete.midi_pitch;
  const pcs=ctx.harmony.bars[2].map(pc=>(pc+ctx.root)%12);
  const choices=Array.from({length:hi-lo+1},(_,j)=>lo+j).filter(p=>pcs.includes(p%12)&&Math.abs(p-next.concrete.midi_pitch)<=limit&&(prior===undefined||Math.abs(p-prior)<=limit));
  choices.sort((a,b)=>Math.abs(a-old)-Math.abs(b-old)||(Math.abs(a-(prior??a))+Math.abs(a-next.concrete.midi_pitch))-(Math.abs(b-(prior??b))+Math.abs(b-next.concrete.midi_pitch))||a-b);
  if(!choices.length)return {plan:structuredClone(breath),applied:false,reason:'no-bounded-breath-end'};
  n.concrete={...n.concrete,midi_pitch:choices[0],freq_hz:440*2**((choices[0]-69)/12)};
  n.derivation={...n.derivation,development:{...n.derivation?.development,ending_fit:{from:old,to:choices[0]}}};
  changed.push({id:n.id,from:old,to:choices[0],prior,next:next.concrete.midi_pitch,gapSteps:gap});
 }
 return {plan,applied:true,changed};
}
export function phraseBreath(ctx,theme) {
 const plan=copy(theme),cut=44,end=48;
 // A protected event crossing the proposed breath makes this treatment unavailable.
 if(plan.notes.some(n=>n.role==='lead'&&onset(n)<end&&onset(n)+n.duration_steps>cut&&(!eligible(n)||bar(n)!==2)))return {plan,applied:false,reason:'protected-note-crosses-breath'};
 const removed=[],shortened=[];
 plan.notes=plan.notes.filter(n=>{
  if(!eligible(n)||bar(n)!==2)return true;
  if(onset(n)>=cut){removed.push(n.id);return false;}
  if(onset(n)+n.duration_steps>cut){const gate=q(cut-onset(n));if(gate<.25){removed.push(n.id);return false;}
   shortened.push({id:n.id,from:n.duration_steps,to:gate});n.duration_steps=gate;n.duration_sec=gate*15/ctx.bpm;
   n.derivation={...n.derivation,development:{kind:'one-beat-phrase-breath',source_note_id:n.id}};
  }
  return true;
 });
 const bounded=boundBreathEnding(ctx,theme,plan);
 if(!bounded.applied)return {plan:copy(theme),applied:false,reason:bounded.reason};
 return {plan:bounded.plan,applied:removed.length+shortened.length>0,removed,shortened,reason:removed.length+shortened.length?'changed':'already-breathing'};
}

export function rhythmicReturn(ctx,theme,{fitSequence=true}={}) {
 const plan=copy(theme),donor=lead(theme).filter(n=>bar(n)===0&&eligible(n));
 const replace=lead(theme).filter(n=>bar(n)===2&&eligible(n));
 const protectedNotes=lead(theme).filter(n=>!replace.includes(n)&&onset(n)<48&&onset(n)+n.duration_steps>32);
 const pcs=ctx.harmony.bars[2].map(pc=>(pc+ctx.root)%12),[lo,hi]=GENRE_PROFILES[ctx.sceneId].reg||ctx.register;
 const pitches=Array.from({length:hi-lo+1},(_,i)=>lo+i).filter(p=>pcs.includes(p%12));
 const generatedNotes=[];let rejected=0;
 for(let i=0;i<donor.length;i++){
  const source=donor[i],at=q(onset(source)+32);
  if(protectedNotes.some(n=>at<onset(n)+n.duration_steps+.04&&at>=onset(n)-.04)){rejected++;continue;}
  const nextDonor=i+1<donor.length?onset(donor[i+1])+32:48;
  const nextProtected=Math.min(48,...protectedNotes.filter(n=>onset(n)>at).map(onset));
  const gate=q(Math.min(source.duration_steps,nextDonor-at-.04,nextProtected-at-.04,48-at));
  if(gate<.25||!pitches.length){rejected++;continue;}
  const target=source.concrete.midi_pitch;
  const pitch=[...pitches].sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b)[0];
  const step=Math.floor(at),offset=q(at-step),n=copy(source);
  Object.assign(n,{id:`return-${source.id}`,step,performance:{...n.performance,version:1,offset_steps:offset},start_sec:at*15/ctx.bpm,duration_steps:gate,duration_sec:gate*15/ctx.bpm,concrete:{...n.concrete,midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)}});
  n.derivation={...n.derivation,motif_anchor:false,development:{kind:'bar-one-rhythm-return',source_note_id:source.id,source_bar:0,target_bar:2}};
  generatedNotes.push(n);
 }
 if(!generatedNotes.length)return {plan,applied:false,reason:'no-fitting-donor',rejected};
 if(fitSequence){
  // Fit the entire returned phrase against its unchanged entry/exit, not notes
  // independently. Pure nearest-chord fitting produced six new >octave leaps.
  const baseLead=lead(theme),prior=baseLead.filter(n=>onset(n)<32).at(-1),next=baseLead.find(n=>onset(n)>=48);
  const newIds=new Set(generatedNotes.map(n=>n.id));
  const seq=[...protectedNotes.filter(n=>onset(n)>=32),...generatedNotes].sort((a,b)=>onset(a)-onset(b));
  if(prior)seq.unshift(prior);if(next)seq.push(next);
  const limit=Math.max(12,...baseLead.slice(1).map((n,i)=>Math.abs(n.concrete.midi_pitch-baseLead[i].concrete.midi_pitch)));
  let states=[{cost:0,pitches:[]}];
  for(const n of seq){
   const options=newIds.has(n.id)?pitches:[n.concrete.midi_pitch],grown=[];
   for(const state of states)for(const pitch of options){const previous=state.pitches.at(-1),distance=previous===undefined?0:Math.abs(pitch-previous);if(distance>limit)continue;
    grown.push({cost:state.cost+Math.abs(pitch-n.concrete.midi_pitch)+distance*.35,pitches:[...state.pitches,pitch]});}
   // Future cost depends only on the last pitch. Keep the cheapest path to
   // each pitch so repeated paths cannot crowd out a valid cadence route.
   const byPitch=new Map();
   for(const state of grown.sort((a,b)=>a.cost-b.cost||a.pitches.at(-1)-b.pitches.at(-1))) {
    const pitch=state.pitches.at(-1);if(!byPitch.has(pitch))byPitch.set(pitch,state);
   }
   states=[...byPitch.values()];
  }
  if(!states.length)return {plan,applied:false,reason:'no-bounded-return',rejected};
  const best=states[0];for(let i=0;i<seq.length;i++)if(newIds.has(seq[i].id)){seq[i].concrete.midi_pitch=best.pitches[i];seq[i].concrete.freq_hz=440*2**((best.pitches[i]-69)/12);}
 }
 const replacedIds=new Set(replace.map(n=>n.id));
 plan.notes=[...plan.notes.filter(n=>!replacedIds.has(n.id)),...generatedNotes];
 const changed=digest(lead(plan).map(eventSig))!==digest(lead(theme).map(eventSig));
 return {plan,applied:changed,reason:changed?'changed':'same-arrangement',rejected,removed:replace.map(n=>n.id),added:generatedNotes.map(n=>n.id)};
}

export function buildMelodyPalette(ctx) {
 if(!SUPPORTED_SCENES.has(ctx.sceneId))throw new Error('This tune map is not ready for this band. Your tune stays.');
 const plans=(eightScenes.has(ctx.sceneId)?eight:seven)(ctx);
 for(let turn=0;turn<24;turn++) {
  const theme=plans[`${turn}:2`];
  for(const [ring,develop] of [[3,phraseBreath],[4,rhythmicReturn]]) {
   const result=develop(ctx,theme),key=`${turn}:${ring}`,choice=melodyChoice(plans[key].choice.position);
   plans[key]={...result.plan,choice,development:{kind:choice.treatment,applied:result.applied,reason:result.reason},
    description:`${theme.description} ${result.applied?choice.treatment:'Theme kept: '+result.reason}.`};
  }
 }
 for(const [key,plan] of Object.entries(plans)) {
  if(key==='original')continue;
  plan.choice=melodyChoice(plan.choice.position);
  for(const [i,n] of plan.notes.entries()) {
   if(!generated(n))continue;
   n.id=`phrase-v9-${key}-${ctx.sceneId}-${i}`;
   n.generated_by='musiclab_phrase_composer_v9';
   n.derivation={...n.derivation,version:9};
  }
 }
 return plans;
}
