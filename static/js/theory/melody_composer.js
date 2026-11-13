import {validPhraseHarmony,wheelOnlyHarmonyFor} from './phrase_harmony.js';
import {melodyFieldPosition} from './melody_field.js';

export const MELODY_FAMILIES=['Hook','Flow','Playful','Answer','Space','Bold'];
// Long-form styles: the composer works on the form block that is playing, using that block's own four-bar harmony.
const FORM_SCENE_IDS=[
  'jump-blues-v1','boogie-woogie-v1','classic-blues-v1','country-blues-v1','chicago-blues-v1','texas-blues-v1',
  'ragtime-v1','stride-piano-v1','new-orleans-jazz-v1','bebop-v1','cool-jazz-v1','hard-bop-v1','modal-jazz-v1','jazz-fusion-v1','jazz-manouche-v1','bossa-nova-v1',
  'memphis-soul-v1','philadelphia-soul-v1','soul-jazz-v1','nashville-sound-v1','bakersfield-sound-v1','progressive-house-v1','trance-v1',
  'psychedelic-rock-v1','hard-rock-v1','garage-rock-v1','punk-rock-v1','post-punk-v1','grunge-v1','heavy-metal-v1','thrash-metal-v1','death-metal-v1','black-metal-v1',
];
export const FORM_COMPOSER_SCENES=FORM_SCENE_IDS;
export const COMPOSER_SCENES=[
  'ska-v1','rocksteady-v1','reggae-v1','house-v1','doo-wop-v1','electro-v1','grime-v1','footwork-v1','baltimore-club-v1',
  'outlaw-country-v1','progressive-bluegrass-v1','delta-blues-v1','dubstep-v1','gospel-piano-v1',
  'deep-house-v1','neo-soul-v1','liquid-dnb-v1','western-swing-v1','techno-v1','minimal-techno-v1','jungle-v1',
  'tech-house-v1','honky-tonk-v1','downtempo-v1','uk-garage-v1','two-step-v1','breakbeat-v1','new-wave-v1',
  'early-rnb-v1','soul-v1','swing-v1','piedmont-v1','boom-bap-v1','trip-hop-v1','drum-and-bass-v1',
  'jersey-club-v1','trap-v1','indie-rock-v1','contrast-0','contrast-1','contrast-2','contrast-3',
  'bluegrass-v1','old-time-v1','hip-hop-v1',
  ...FORM_SCENE_IDS,
];
const copy=x=>structuredClone(x);
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

/** Only explicitly verified recipes enter this first composer delivery. */
export function captureMelodyContext(song,reached,{customBacking=false}={}) {
  const c=reached?.phraseContext;
  const harmony=c?.harmony??wheelOnlyHarmonyFor(c?.sceneId,c?.minor);
  // Field5 explicitly blends these same three recipes over their shared progression.
  const sharedField=c?.musicField?.version===5&&['ska-v1','rocksteady-v1','reggae-v1'].includes(c.sceneId)
    &&['x','y'].every(axis=>Number.isFinite(c.musicField[axis])&&c.musicField[axis]>=0&&c.musicField[axis]<=1);
  // A long-form style is admitted one block at a time; anything else carrying a form or mode is still refused.
  const formBlock=FORM_SCENE_IDS.includes(c?.sceneId)&&Number.isInteger(c.form?.blockIndex)&&c.form.blockIndex>=0&&c.form.blockIndex<3;
  if(!song||!Array.isArray(song.events)||customBacking||!c||!COMPOSER_SCENES.includes(c.sceneId)||(c.musicField&&!sharedField)||((c.mode||c.form)&&!formBlock)
    ||song.total_steps!==64||(song.steps_per_bar||16)!==16||!validPhraseHarmony(harmony)
    ||!Number.isInteger(c.root)||c.root<0||c.root>11||!Number.isFinite(song.bpm)||song.bpm<=0
    ||!Number.isFinite(song.swing??.5)||(song.swing??.5)<0||(song.swing??.5)>1
    ||song.events.some(n=>!Number.isFinite(n.step)||!Number.isFinite(n.duration_steps??n.duration_sec/(15/song.bpm))||(n.duration_steps??n.duration_sec/(15/song.bpm))<=0
      ||(n.performance?.offset_steps!==undefined&&!Number.isFinite(n.performance.offset_steps))))return null;
  const lead=song.events.filter(n=>n.role==='lead'&&Number.isInteger(n.concrete?.midi_pitch));
  if(!lead.length)return null;
  const pitches=lead.map(n=>n.concrete.midi_pitch).sort((a,b)=>a-b);
  const centre=Math.max(48,Math.min(84,pitches[Math.floor(pitches.length/2)]));
  const personal=lead.filter(n=>n.provenance==='user_placed').sort((a,b)=>a.step-b.step).slice(0,4);
  const inspiration=personal.length>=2?{sourceIds:personal.map(n=>n.id),
    contour:personal.map(n=>Math.max(-5,Math.min(5,n.concrete.midi_pitch-personal[0].concrete.midi_pitch)))}:null;
  return freeze({version:1,sceneId:c.sceneId,root:c.root,harmony:copy(harmony),
    bpm:song.bpm,swing:song.swing??.5,stepsPerBar:16,totalSteps:64,
    source:{...copy(song),events:song.events.map(n=>({...copy(n),duration_steps:n.duration_steps??n.duration_sec/(15/song.bpm)}))},patch:lead.find(n=>n.provenance==='jam_generated')?.patch_id||lead[0].patch_id,
    register:[Math.max(0,centre-12),Math.min(127,centre+12)],centre,inspiration,
    ...(formBlock?{form:{id:c.sceneId,blockIndex:c.form.blockIndex,cycle:Number.isInteger(c.form.cycle)?c.form.cycle:0}}:{})});
}

// Original authored phrase rhythms: opening, continuation, contrast, landing.
const RHYTHMS=[
  [[[0,3],[6,2],[10,2]],[[0,3],[6,2],[10,2]],[[2,2],[6,2],[12,3]],[[0,3],[6,2],[10,5]]],
  [[[0,6],[8,6]],[[0,6],[8,3],[12,3]],[[0,7],[8,6]],[[0,6],[8,7]]],
  [[[2,1],[4,1],[7,2],[11,1]],[[2,1],[6,2],[10,3]],[[1,1],[4,1],[6,1],[10,2],[13,1]],[[2,1],[6,2],[10,5]]],
  [[[0,3],[4,2],[8,3]],[[6,2],[10,4]],[[0,3],[4,2],[8,3]],[[4,2],[8,6]]],
  [[[0,6]],[[8,6]],[[0,4],[8,4]],[[8,7]]],
  [[[0,2],[3,1],[6,2],[10,4]],[[0,2],[3,1],[6,2],[10,4]],[[2,2],[6,2],[10,4]],[[0,3],[6,2],[10,5]]],
];
const CONTOURS=[[-4,3,0],[-5,0,7,2],[-3,2,5,0],[0,4,0,-3],[-3,0,-2],[0,7,3,-4]];

export function melodyChoice(position) {
  const p=melodyFieldPosition(position),radius=Math.hypot(p.x,p.y);
  if(radius<.12)return {key:'original',position:{x:0,y:0},radius:0,first:0,next:1,mix:0,label:'Original'};
  const sector=((Math.atan2(p.x,p.y)/(Math.PI*2)+1)%1)*6;
  // Stable 24 angular neighborhoods and four departure levels, not six presets.
  const turn=Math.round(sector*4)%24,first=Math.floor(turn/4),mix=(turn%4)/4;
  const ring=Math.max(1,Math.min(4,Math.round(radius*4)));
  return {key:`${turn}:${ring}`,position:p,radius:ring/4,first,next:(first+1)%6,mix,
    label:mix?`${MELODY_FAMILIES[first]} / ${MELODY_FAMILIES[(first+1)%6]}`:MELODY_FAMILIES[first]};
}

/** A complete phrase, fitted to local harmony. No changes to its original or band. */
export function planMelodyCandidate(context,position) {
  const choice=melodyChoice(position),source=context.source;
  if(choice.key==='original')return {choice,notes:copy(source.events),description:'Your starting tune'};
  const sec=15/context.bpm,sourceLead=source.events.filter(n=>n.role==='lead');
  const at=n=>n.step+(n.performance?.version===1?n.performance.offset_steps||0:n.step%2?context.swing-.5:0);
  const retained=[],slots=[];
  const thresholds=[.75,.25,.5,1];
  for(let bar=0;bar<4;bar++) {
    if(choice.radius<thresholds[bar]) {retained.push(...copy(sourceLead.filter(n=>Math.floor(at(n)/16)===bar)));continue;}
    const family=choice.mix>[.125,.625,.375,.875][bar]?choice.next:choice.first;
    const cells=RHYTHMS[family][bar];
    cells.forEach(([offset,gate],index)=>{
      const step=bar*16+offset,shift=offset%2?context.swing-.5:0;
      const motif=(f)=>CONTOURS[f][index%CONTOURS[f].length];
      slots.push({step,offset:shift,gate:Math.min(gate,16-offset-Math.max(0,shift)),bar,index,
        target:context.centre+motif(choice.first)*(1-choice.mix)+motif(choice.next)*choice.mix
          +(context.inspiration?.contour[index%context.inspiration.contour.length]||0)*.6,
        landing:bar===3&&index===cells.length-1});
    });
  }
  // Retained personal/source holds may cross a changed bar or the loop edge.
  const eligible=slots.filter(s=>!retained.some(n=>[-64,0,64].some(shift=>
    at(n)+shift<s.step+s.offset+s.gate&&at(n)+shift+n.duration_steps>s.step+s.offset)));
  let beam=[{cost:0,pitches:[],motif:[]}];
  for(const s of eligible) {
    const tones=context.harmony.bars[s.bar].map(pc=>(pc+context.root)%12);
    const choices=[];
    for(let pitch=context.register[0];pitch<=context.register[1];pitch++)
      if(tones.includes(pitch%12)&&(!s.landing||pitch%12===(context.harmony.ending+context.root)%12))choices.push(pitch);
    const next=[];
    for(const path of beam)for(const pitch of choices) {
      const prev=path.pitches.at(-1),leap=prev===undefined?0:Math.abs(pitch-prev);
      const oldLeap=path.pitches.length>1?path.pitches.at(-1)-path.pitches.at(-2):0;
      const sameDirection=prev!==undefined&&Math.sign(pitch-prev)===Math.sign(oldLeap);
      const motif=path.motif[s.index];
      const target=s.target+(s.bar===2?2:0);
      const cost=path.cost+Math.abs(pitch-target)*1.2+leap*.15+Math.max(0,leap-7)*1.5
        +(Math.abs(oldLeap)>5&&sameDirection?3:0)
        +(s.bar===1&&motif!==undefined?Math.min(Math.abs((pitch-context.root+120)%12-motif),12-Math.abs((pitch-context.root+120)%12-motif))*.2:0);
      const memory=[...path.motif];if(s.bar===0)memory[s.index]=(pitch-context.root+120)%12;
      next.push({cost,pitches:[...path.pitches,pitch],motif:memory});
    }
    beam=next.sort((a,b)=>a.cost-b.cost||a.pitches.at(-1)-b.pitches.at(-1)).slice(0,32);
  }
  if(!beam.length)throw new Error('No compatible melody in this range.');
  const generated=eligible.map((s,i)=>{
    const pitch=beam[0].pitches[i];
    return {id:`phrase-v1-${choice.key}-${s.step}`,role:'lead',patch_id:context.patch,step:s.step,
      start_sec:(s.step+s.offset)*sec,duration_steps:s.gate,duration_sec:s.gate*sec,
      performance:{version:1,offset_steps:s.offset},velocity:s.index===0?.62:.52,
      concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},pitch_lock_mode:'concrete',
      provenance:'jam_generated',generated_by:'musiclab_phrase_composer',
      derivation:{version:1,scene:context.sceneId,choice:choice.key,source_ids:context.inspiration?.sourceIds||sourceLead.map(n=>n.id)}};
  });
  return {choice,notes:[...copy(source.events.filter(n=>n.role!=='lead')),...retained,...generated],
    description:`${choice.label}: a new phrase with this band`};
}

export function buildMelodyPalette(context) {
  const plans={original:planMelodyCandidate(context,{x:0,y:0})};
  for(let turn=0;turn<24;turn++)for(let ring=1;ring<=4;ring++) {
    const angle=turn*Math.PI/12,p={x:Math.sin(angle)*ring/4,y:Math.cos(angle)*ring/4};
    const plan=planMelodyCandidate(context,p);plans[plan.choice.key]=plan;
  }
  return plans;
}
