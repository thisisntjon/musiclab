// Melody composer v3: explicit phrase form.
// motif -> form template (statement, repeat/sequence, development, cadence) -> pitches fitted to
// each bar's authored chord. Weak-step passing/neighbour notes are allowed when they resolve by
// step. A direction is a set of musical settings plus a treatment; wheel distance sets how much.
// Same exports as melody_composer.js, so the worker, session and Keep need no changes.
import {melodyFieldPosition} from './melody_field.js';
export {captureMelodyContext,COMPOSER_SCENES} from './melody_composer.js';

/** Compass directions: hook (top) opposes playful; flowing (right) opposes space. */
export const DIRECTIONS=[
  {id:'hook',label:'Memorable hook',angle:0},
  {id:'flowing',label:'More flowing',angle:90},
  {id:'playful',label:'More playful',angle:180},
  {id:'space',label:'More space',angle:270},
];
export const MELODY_FAMILIES=DIRECTIONS.map(d=>d.label);
export const BENCH_DIRECTIONS=Object.fromEntries(DIRECTIONS.map(d=>[d.id,d.angle]));

// Settings 0..1. density: notes per bar; step: stepwise motion; range: register span;
// legato: share of the gap a note fills; synco: off-beat attacks.
const NEUTRAL={density:.45,step:.7,range:.45,legato:.6,synco:.3};
const SETTINGS={
  hook:   {density:.45,step:.55,range:.35,legato:.55,synco:.45},
  flowing:{density:.9, step:.95,range:.55,legato:.95,synco:.15},
  playful:{density:.65,step:.35,range:.9, legato:.25,synco:.9},
  space:  {density:.15,step:.65,range:.35,legato:.4, synco:.1},
};
const KEYS=Object.keys(NEUTRAL);
const copy=x=>structuredClone(x);
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let s=seed||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

/** Wheel position -> blended settings, leading direction, motif region and small variant. Pure. */
export function melodySettings(position){
  const p=melodyFieldPosition(position),r=Math.min(1,Math.hypot(p.x,p.y));
  const angle=((Math.atan2(p.x,p.y)*180/Math.PI)+360)%360;
  const w=DIRECTIONS.map(d=>{const diff=Math.abs(((angle-d.angle+540)%360)-180);return Math.max(0,Math.cos(diff*Math.PI/180))**2;});
  const total=w.reduce((a,b)=>a+b,0)||1,s={};
  for(const k of KEYS){const target=DIRECTIONS.reduce((a,d,i)=>a+SETTINGS[d.id][k]*w[i]/total,0);s[k]=NEUTRAL[k]+(target-NEUTRAL[k])*r;}
  const main=DIRECTIONS[w.indexOf(Math.max(...w))];
  const turn=Math.round(angle/15)%24,regionIndex=Math.round(angle/45)%8;
  // Inner disk develops your own motif; outside it each 45-degree region has its own new idea.
  const region=r<=.5?'yours':`r${regionIndex}`;
  const variant=((turn-regionIndex*3+25)%24)-1; // -1, 0 or +1 inside a region
  return {settings:s,radius:r,angle,main,region,variant};
}

export function melodyChoice(position){
  const p=melodyFieldPosition(position),radius=Math.hypot(p.x,p.y);
  if(radius<.12)return {key:'original',position:{x:0,y:0},radius:0,label:'Your tune'};
  const turn=Math.round(((Math.atan2(p.x,p.y)/(Math.PI*2)+1)%1)*24)%24,ring=Math.max(1,Math.min(4,Math.round(radius*4)));
  const a=turn*Math.PI/12,q={x:+(Math.sin(a)*ring/4).toFixed(6),y:+(Math.cos(a)*ring/4).toFixed(6)};
  const {main}=melodySettings(q),amount=['a little','more','much more','all the way'][ring-1];
  return {key:`${turn}:${ring}`,position:q,radius:ring/4,label:`${main.label}, ${amount}`};
}

function scaleOf(ctx){
  // Degrees follow the tonic, not absolute pitch-class order (C first).
  const relative=pc=>((pc-ctx.root)%12+12)%12;
  const order=(a,b)=>relative(a)-relative(b);
  const pcs=[...new Set(ctx.harmony.bars.flat().map(pc=>(pc+ctx.root)%12))].sort(order);
  return pcs.length>=5?pcs:[0,2,4,5,7,9,11].map(pc=>(pc+ctx.root)%12).sort(order);
}
const degToMidi=(scale,deg,base)=>{const n=scale.length,o=Math.floor(deg/n),i=((deg%n)+n)%n;return base+o*12+((scale[i]-base%12+12)%12);};
function midiToDeg(scale,midi,base){let best=0,dist=1e9;for(let d=-30;d<=30;d++){const m=degToMidi(scale,d,base);if(Math.abs(m-midi)<dist){dist=Math.abs(m-midi);best=d;}}return best;}

// Bar rhythms (onsets on 16 steps) with their share among 13,336 folk phrases (Nottingham + Essen),
// from workflow/research/melody-corpus-folk-2026-11-08/patterns.json. Statistics only, no melodies.
const CORPUS_BAR_RHYTHMS=[[[0,4,8,12],.111],[[0,2,4,6,8,10,12,14],.069],[[0,6,8,12],.036],[[0,4,8,12,14],.035],[[0,8,12],.029],
  [[0,2,4,6,8,12,14],.029],[[0,4,8],.029],[[0,8],.029],[[0,2,4,6,8,12],.028],[[0,12],.024],[[0,4,8,10,12,14],.023],[[0,4,6,8,10,12,14],.022],
  [[0,4,6,8,12,14],.021],[[0,4,6,8,12],.019],[[0,6,8,10,12,14],.018],[[0,2,4,6,8],.017],[[0,4,8,14],.017],[[0,12,14],.013],[[0,6,8,14],.009],[[0,8,12,14],.008]];
/** A bar rhythm that answers the motif's: common in real tunes, similar density, not the same pattern.
 * Folk tunes are hardly syncopated, so a syncopated direction anticipates some beats (the genre push). */
function contrastRhythm(count,rand,avoid,synco){
  const key=o=>o.join(','),taken=new Set(avoid.map(key));
  // Compare the rhythm that will actually play, after anticipation, not its unshifted source.
  const available=CORPUS_BAR_RHYTHMS.map(([o,w])=>[
    synco>=.6?o.map(t=>(t===4||t===12)&&!o.includes(t-1)?t-1:t):o,w
  ]).filter(([o])=>!taken.has(key(o)));
  const pool=available.filter(([o])=>Math.abs(o.length-count)<=1);
  const list=pool.length?pool:available;
  // Only two motifs are excluded by callers; this also handles exhausted external probes safely.
  if(!list.length)return [...(avoid[0]||[0,8])];
  let pick=rand()*list.reduce((a,[,w])=>a+w,0),onsets=list[0][0];
  for(const [o,w] of list){pick-=w;if(pick<=0){onsets=o;break;}}
  return [...onsets];
}

/** Motif = onsets within one bar + scale-degree moves between its notes. */
function sourceMotif(ctx,scale,base){
  const lead=ctx.source.events.filter(n=>n.role==='lead'&&Number.isInteger(n.concrete?.midi_pitch)).sort((a,b)=>a.step-b.step);
  if(lead.length<2)return null;
  const bar0=Math.floor(lead[0].step/16),inBar=lead.filter(n=>Math.floor(n.step/16)===bar0).slice(0,5);
  const notes=inBar.length>=2?inBar:lead.slice(0,3);
  const degs=notes.map(n=>midiToDeg(scale,n.concrete.midi_pitch,base));
  const onsets=[...new Set(notes.map(n=>n.step%16))].sort((a,b)=>a-b);
  return {onsets,moves:degs.slice(1,onsets.length).map((d,i)=>Math.max(-4,Math.min(4,d-degs[i]))),start:degs[0]};
}
function newMotif(dir,s,rand,inspiration){
  let onsets;
  if(dir==='space')onsets=[[0,6],[0,8],[0,10],[0,3]][Math.floor(rand()*4)];
  else{
    const count=Math.max(2,Math.min(5,Math.round(1.5+s.density*4)));
    const grid=s.synco>.6?[3,6,7,10,11,14]:s.density>.7?[2,4,6,8,10,12]:[4,6,8,10,12];
    onsets=[0];const pool=[...grid];
    while(onsets.length<count&&pool.length)onsets.push(pool.splice(Math.floor(rand()*pool.length),1)[0]);
    onsets.sort((a,b)=>a-b);
  }
  // Gap-fill: after a leap, step back the other way. A hook opens with one signature leap.
  const moves=[];
  for(let i=0;i<onsets.length-1;i++){
    const c=inspiration?.contour,insp=c&&c[i+1]!==undefined?Math.sign(c[i+1]-c[i]):0;
    const last=moves.at(-1)||0,way=Math.abs(last)>=2?-Math.sign(last):(insp||(rand()<.5?-1:1));
    const leap=dir==='hook'?i===0:Math.abs(last)<2&&rand()>s.step;
    // Real tunes repeat a note about one move in six; a hook leans on it.
    const repeat=!leap&&i>0&&rand()<(dir==='hook'?.3:.16);
    moves.push(repeat?0:leap?way*(2+Math.floor(rand()*(1+s.range*3))):way);
  }
  return {onsets,moves,start:Math.floor(rand()*3)};
}

/** Form template: what each bar does with the motif. Direction picks it; distance deepens it.
 * Rhythm forms follow the corpus: hook repeats (aaab), flowing runs on (abcd, the most common form),
 * playful answers itself (abac), space leaves a bar open (aaba with a rest). */
function formFor(dir,r){
  if(dir==='hook')return ['a','a','a2','cad'];
  if(dir==='space')return r>=.74?['a','a2','rest','cad']:['a','b','a','cad'];
  if(dir==='playful')return ['a','b','a2','cadq'];
  return ['a','b','c','cad'];
}
function barCells(op,motif,dir){
  const cells=motif.onsets.map((o,i)=>({offset:o,move:i?motif.moves[i-1]:0}));
  if(op==='a')return cells;
  if(op==='a2')return cells.map((c,i)=>i===cells.length-1&&i>0?{...c,move:c.move+(c.move>=0?1:-1)}:c);
  // b and c bring their own rhythm; their pitch moves still come from the motif (inverted, then reversed).
  if(op==='b'||op==='c'){
    const onsets=op==='b'?motif.b:motif.c,source=op==='b'?motif.moves.map(m=>-m):[...motif.moves].reverse();
    if(!onsets)return cells.map((c,i)=>i===0?{...c,move:0}:{...c,move:-c.move});
    return onsets.map((o,i)=>({offset:o,move:i?(source.length?source[(i-1)%source.length]:0):0}));
  }
  if(op==='rest')return [];
  const head=cells.filter(c=>c.offset<8).slice(0,Math.max(1,Math.ceil(cells.length/2)));
  // A late-entry motif has no opening to reprise. Leave space, then land.
  // This is a generated cadence; the original performance stays untouched.
  if(!head.length)return [{offset:8,move:0,landing:true}];
  const land=dir==='playful'?Math.min(14,head.at(-1).offset+3):head.at(-1).offset<8?8:12;
  return [...head,{offset:land,move:0,landing:true}];
}
// Bar anchors in scale steps: the middle of the phrase climbs (corpus median range is an octave), then the cadence returns.
const ANCHOR={a:0,a2:2,b:4,c:3,cad:0,cadq:0,rest:0};

/** A complete phrase, fitted to local harmony. The band and the original are untouched. */
export function planMelodyCandidate(ctx,position){
  const choice=melodyChoice(position),source=ctx.source;
  if(choice.key==='original')return {choice,notes:copy(source.events),description:'Your starting tune'};
  const {settings:s,radius:r,region,variant,main}=melodySettings(choice.position),dir=main.id;
  const scale=scaleOf(ctx),base=ctx.root+12*Math.floor(ctx.centre/12);
  const fingerprint=source.events.filter(n=>n.role==='lead').map(n=>`${n.step}:${n.concrete?.midi_pitch-ctx.root}`).join(',');
  const centre=region==='yours'?s:melodySettings({x:Math.sin(+region.slice(1)*Math.PI/4),y:Math.cos(+region.slice(1)*Math.PI/4)}).settings;
  const motifDir=region==='yours'?dir:melodySettings({x:Math.sin(+region.slice(1)*Math.PI/4),y:Math.cos(+region.slice(1)*Math.PI/4)}).main.id;
  // One motif seed per outer region: crossing a treatment boundary must not reseed it.
  const rand=rng(hash(`${ctx.sceneId}|${fingerprint}|${region}|${region==='yours'?dir:motifDir}`));
  const motif=(region==='yours'&&sourceMotif(ctx,scale,base))||newMotif(motifDir,centre,rand,ctx.inspiration);
  motif.b=contrastRhythm(motif.onsets.length,rand,[motif.onsets],centre.synco);
  motif.c=contrastRhythm(motif.onsets.length+(centre.density>.7?1:0),rand,[motif.onsets,motif.b],centre.synco);
  const form=formFor(dir,r),sec=15/ctx.bpm,chordPcs=bar=>ctx.harmony.bars[bar].map(pc=>(pc+ctx.root)%12);
  const lo=ctx.register[0],hi=ctx.register[1],lift=region==='yours'?0:Math.round(s.range*2);
  const maxLeap=Math.round(3+(1-s.step)*9),climb=r>=.9?1:0; // full distance reaches higher in development
  const slots=[];
  form.forEach((op,bar)=>{
    const kind=op==='cadq'?'cad':op;
    let cum=0,list=(dir==='space'&&r>=.74&&kind==='cad'?[{offset:0,move:0,landing:true}]:barCells(kind,motif,dir)).map(c=>({...c,deg:motif.start+lift+ANCHOR[op]+(op==='b'?climb:0)+(cum+=c.move)}));
    const body=!kind.startsWith('cad');
    // Treatments: what the direction does to every bar, scaled by distance.
    if(dir==='flowing'&&body){const add=[];for(let i=0;i<list.length;i++){const a=list[i],b=list[i+1],gap=(b?.offset??16)-a.offset;
      if(gap>=4)add.push({offset:a.offset+2,deg:a.deg+(b?Math.sign(b.deg-a.deg)||1:-1),passing:true});
      if(r>=.75&&gap>=8)add.push({offset:a.offset+4,deg:a.deg+(b?2*Math.sign(b.deg-a.deg)||2:-2),passing:true},{offset:a.offset+6,deg:a.deg+(b?Math.sign(b.deg-a.deg)||1:-1),passing:true});}
      list=[...new Map([...list,...add].map(c=>[c.offset,c])).values()].sort((x,y)=>x.offset-y.offset);}
    if(dir==='space'&&body&&r<.74)list=list.filter((c,i)=>i===0||c.offset%4===0).slice(0,3);
    if(dir==='playful'&&body&&region==='yours')list=list.map((c,i)=>i&&c.offset%4===0&&c.offset<15&&!list.some(other=>other.offset===c.offset-1)?{...c,offset:c.offset-1}:c);
    // Small variants inside a region: same idea, a different turn of phrase.
    if(variant===1&&(bar===1||bar===3)&&list.length>2)list=list.map((c,i)=>i===list.length-1&&!c.landing?{...c,deg:c.deg-2}:i===0&&bar===3?{...c,deg:c.deg+2}:c);
    if(variant===-1&&bar===2&&list.length>2)list=list.map((c,i)=>i===1&&c.offset+2<(list[2]?.offset??16)?{...c,offset:c.offset+2}:c);
    if(r>=.9&&kind==='cad')list=list.map(c=>c.landing?{...c,offset:Math.min(c.offset,8)}:c);
    // Treatments may converge on an onset; keep one generated attack, preferring the cadence.
    const unique=new Map();for(const c of list)if(!unique.has(c.offset)||c.landing)unique.set(c.offset,c);
    list=[...unique.values()].sort((a,b)=>a.offset-b.offset);
    list.forEach((c,i)=>slots.push({bar,step:bar*16+c.offset,offset:c.offset,deg:c.deg,landing:!!c.landing,question:op==='cadq'&&!!c.landing,
      strong:c.offset%8===0,first:i===0,op}));
  });
  // Pitch realization as one beam search over the phrase. Hard rules: strong beats and landings
  // sit on the bar's chord; a note off the chord must be weak and resolve by step to the next.
  // Soft costs: follow the planned degree, prefer small moves, cap leaps, avoid repeats.
  const lean=.15+.35*s.step,endPc=(ctx.harmony.ending+ctx.root)%12,home=ctx.root%12;
  // The loop is the answer: the last landing sits a step from home (2nd or 7th over V) and the next
  // pass opens on home. A question cadence (playful) stays open on purpose.
  const lastTones=chordPcs(3),homeSteps=lastTones.filter(pc=>pc!==home&&[1,2].includes(Math.min((pc-home+12)%12,(home-pc+12)%12)));
  let beam=[{cost:0,path:[]}];
  slots.forEach((slot,i)=>{
    let planned=degToMidi(scale,slot.deg,base);while(planned>hi)planned-=12;while(planned<lo)planned+=12;
    const tones=chordPcs(slot.bar),next=slots[i+1];
    const want=slot.landing?(slot.question?[tones.find(pc=>pc!==endPc&&pc!==home)??tones[1]]:i===slots.length-1&&homeSteps.length?homeSteps:[endPc]):null;
    const weak=!slot.strong&&!slot.landing&&next&&next.step-slot.step<=4;
    const nextTones=next?(next.landing?(next.question?[chordPcs(next.bar).find(pc=>pc!==endPc&&pc!==home)??chordPcs(next.bar)[1]]:i+1===slots.length-1&&homeSteps.length?homeSteps:[endPc]):chordPcs(next.bar)):[];
    const resolvable=m=>nextTones.some(pc=>[1,2].some(d=>(m+d)%12===pc||(m-d+12)%12===pc));
    const options=[];for(let m=lo;m<=hi;m++){const pc=m%12;if(want!==null?want.includes(pc):tones.includes(pc)||(weak&&scale.includes(pc)&&resolvable(m)))options.push(m);}
    const grown=[];
    for(const b of beam)for(const m of options){
      const prev=b.path.at(-1),leap=prev===undefined?0:Math.abs(m-prev);
      const unresolved=prev!==undefined&&!chordPcs(slots[i-1].bar).includes(prev%12)&&(leap>2||leap===0);
      if(unresolved)continue; // Passing-tone resolution is a rule, not a tradable score penalty.
      const first=b.path[0]??m,last=i===slots.length-1;
      const c=b.cost+Math.abs(m-planned)+leap*lean+Math.max(0,leap-maxLeap)*3
        +(leap===0&&prev!==undefined?(dir==='hook'?.3:1.2):0)+(tones.includes(m%12)?0:.4)+(last&&!tones.includes(m%12)?99:0)
        +(i===0&&region!=='yours'&&m%12!==home?1.5:0)
        +(last&&!slot.question?3*Math.max(0,Math.abs(m-first)-2):0);
      grown.push({cost:c,path:[...b.path,m]});
    }
    grown.sort((x,y)=>x.cost-y.cost||x.path.at(-1)-y.path.at(-1));
    beam=grown.slice(0,48);
    // Keep one resolved route: pruning must not leave only pending passing tones.
    const resolved=grown.find(path=>tones.includes(path.path.at(-1)%12));
    if(resolved&&!beam.includes(resolved)){beam.pop();beam.push(resolved);}
  });
  if(!beam.length)throw new Error('No compatible melody in this range.');
  const out=slots.map((slot,i)=>({...slot,midi:beam[0].path[i]}));
  const peak=Math.max(...out.map(n=>n.midi));
  const generated=out.map((n,i)=>{
    const shift=n.offset%2?ctx.swing-.5:0,nextStep=out[i+1]?.step??64;
    const room=Math.min(nextStep+(out[i+1]&&out[i+1].offset%2?ctx.swing-.5:0)-n.step-shift,64-n.step-shift);
    const desired=n.landing?Math.max(2,16-n.offset):Math.max(.75,Math.min(16-n.offset,dir==='space'?6:16,Math.round(Math.max(1,room*s.legato)*4)/4));
    const gate=Math.min(room,desired); // Never extend a generated gate past the next attack.
    const velocity=Math.min(.78,(n.first?.66:n.strong?.6:.5)+(n.midi===peak?.06:0)+(n.landing?.02:0));
    return {id:`phrase-v3-${choice.key}-${n.step}-${i}`,role:'lead',patch_id:ctx.patch,step:n.step,
      start_sec:(n.step+shift)*sec,duration_steps:gate,duration_sec:gate*sec,performance:{version:1,offset_steps:shift},
      velocity:+velocity.toFixed(3),concrete:{midi_pitch:n.midi,freq_hz:440*2**((n.midi-69)/12)},pitch_lock_mode:'concrete',
      provenance:'jam_generated',generated_by:'musiclab_phrase_composer_v3',
      derivation:{version:3,scene:ctx.sceneId,choice:choice.key,direction:dir,region,form,source_ids:ctx.inspiration?.sourceIds||source.events.filter(e=>e.role==='lead').map(e=>e.id)}};
  });
  return {choice,notes:[...copy(source.events.filter(n=>n.role!=='lead')),...generated],
    description:`${main.label}: a new phrase with this band`,form,region};
}

export function buildMelodyPalette(ctx){
  const plans={original:planMelodyCandidate(ctx,{x:0,y:0})};
  for(let turn=0;turn<24;turn++)for(let ring=1;ring<=4;ring++){
    const a=turn*Math.PI/12,plan=planMelodyCandidate(ctx,{x:Math.sin(a)*ring/4,y:Math.cos(a)*ring/4});plans[plan.choice.key]=plan;
  }
  return plans;
}
