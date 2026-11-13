import {PHRASES,VOCABULARY_VERSION} from './melody_phrase_library_v1.js';
import {melodyFieldPosition} from './melody_field.js';
export const MELODY_FAMILIES=['Idea 1','Idea 3','Idea 5','Idea 7'];
export const BENCH_DIRECTIONS={hook:0,flowing:90,playful:180,space:270};
export {VOCABULARY_VERSION};
export function melodyChoice(position){
 const p=melodyFieldPosition(position),r=Math.min(1,Math.hypot(p.x,p.y));
 if(r<.06)return {key:'original',position:{x:0,y:0},radius:0,angle:0,label:'Original'};
 const angle=((Math.atan2(p.x,p.y)*180/Math.PI)+360)%360,turn=Math.round(angle/15)%24,ring=Math.max(1,Math.min(4,Math.round(r*4)));
 return {key:`${turn}:${ring}`,position:p,radius:ring/4,angle,label:`Idea ${Math.round(turn/3)%8+1}, take ${ring}`};
}
const copy=x=>structuredClone(x);
function maxRunShare(pitches){
 let run=1,best=1;
 for(let i=1;i<pitches.length;i++){run=pitches[i]===pitches[i-1]?run+1:1;if(run>best)best=run;}
 return best/pitches.length;
}
function adaptBeam(ctx,phrase,shift=0){
 const notes=phrase.notes,first=notes[0][1],lo=ctx.register[0],hi=ctx.register[1];
 const targetBase=Math.max(lo,Math.min(hi,ctx.centre+shift));
 let beam=[{cost:0,pitches:[]}];
 for(let i=0;i<notes.length;i++){
  const [step,pitch,gate]=notes[i],bar=Math.floor(step/16),lastBar=Math.min(3,Math.floor((step+gate-1e-7)/16));
  const tones=ctx.harmony.bars[bar].map(pc=>(pc+ctx.root)%12);
  let pcs=tones;for(let b=bar+1;b<=lastBar;b++)pcs=pcs.filter(pc=>ctx.harmony.bars[b].some(x=>(x+ctx.root)%12===pc));
  if(!pcs.length)return [];
  const options=[];for(let m=lo;m<=hi;m++)if(pcs.includes(m%12))options.push(m);
  const grown=[];for(const state of beam)for(const m of options){
   const prev=state.pitches.at(-1),sourceMove=i?pitch-notes[i-1][1]:0,move=i?m-prev:0;
   const cost=state.cost+Math.abs(m-(targetBase+pitch-first))*.5+(i?Math.abs(move-sourceMove)*1.4:0)
    +(sourceMove&&move&&Math.sign(sourceMove)!==Math.sign(move)?18:0)+(i&&sourceMove===0&&move!==0?5:0)
    +(i&&sourceMove!==0&&move===0?5.2:0)+Math.max(0,Math.abs(move)-9)*2.5;
   grown.push({cost,pitches:[...state.pitches,m]});
  }
  beam=grown.sort((a,b)=>a.cost-b.cost||a.pitches.at(-1)-b.pitches.at(-1)).slice(0,24);if(!beam.length)return [];
 }
 return beam;
}
// Adapt a complete rest-delimited source phrase. Never regenerate its timing or shorten holds.
function adapt(ctx,phrase,variant,allowMonotone=false){
 const filter=list=>allowMonotone?list:list.filter(s=>maxRunShare(s.pitches)<.5);
 const c0=filter(adaptBeam(ctx,phrase,0));if(!c0.length)return null;
 const base=c0[0].pitches,baseKey=base.join(',');
 if(variant===0)return base;
 const shifted=filter(adaptBeam(ctx,phrase,variant*4));
 const pick=shifted.find(s=>s.pitches.join(',')!==baseKey)||c0.find(s=>s.pitches.join(',')!==baseKey);
 if(variant===-1)return (pick||c0[0]).pitches;
 const m1=(filter(adaptBeam(ctx,phrase,-4)).find(s=>s.pitches.join(',')!==baseKey)||c0[0]).pitches.join(',');
 const pickPlus=shifted.find(s=>{const k=s.pitches.join(',');return k!==baseKey&&k!==m1;})
  ||c0.find(s=>{const k=s.pitches.join(',');return k!==baseKey&&k!==m1;});
 return (pickPlus||pick||c0[0]).pitches;
}
function vocabulary(ctx){
 if(ctx.vocabularyVersion!==VOCABULARY_VERSION)throw new Error('This phrase library needs its saved version. Your original stays.');
 const clean=PHRASES.filter(p=>p.notes[0][0]<12&&adapt(ctx,p,0,false));
 if(clean.length>=8)return clean;
 return PHRASES.filter(p=>adapt(ctx,p,0,true));
}
function ordered(ctx){
 // Reproducible editorial neighborhoods based on the phrase as a whole; not a universal melody map.
 const list=vocabulary(ctx);if(!list.length)throw new Error('No phrase fits these held notes and chords. Your groove stays.');
 const distance=(a,b)=>{
  const aa=new Set(a.notes.map(n=>n[0])),bb=new Set(b.notes.map(n=>n[0])),union=new Set([...aa,...bb]);
  const rhythm=1-[...aa].filter(t=>bb.has(t)).length/union.size;
  const contour=p=>Array.from({length:8},(_,i)=>p.notes[Math.round(i*(p.notes.length-1)/7)][1]/Math.max(1,p.range));
  const ac=contour(a),bc=contour(b),shape=ac.reduce((sum,v,i)=>sum+Math.abs(v-bc[i]),0)/8;
  const ending=p=>p.notes.at(-1)[1]-p.notes.at(-2)[1];
  return rhythm*4+shape*3+Math.abs(ending(a)-ending(b))/8+Math.abs(a.notes.length-b.notes.length)/12+Math.abs(a.range-b.range)/12+Math.abs(a.rest-b.rest)/32+Math.abs(a.repeats-b.repeats);
 };
 const anchors=[];let rest=[...list].sort((a,b)=>a.notes.length-b.notes.length||a.id.localeCompare(b.id));
 anchors.push(rest.splice(Math.floor(rest.length/2),1)[0]);
 while(anchors.length<8&&rest.length){rest.sort((a,b)=>Math.min(...anchors.map(x=>distance(b,x)))-Math.min(...anchors.map(x=>distance(a,x)))||a.id.localeCompare(b.id));anchors.push(rest.shift());}
 // Order anchors by nearest neighbour; radial choices develop outward without sharing phrases across sectors.
 const ring=[anchors.shift()];while(anchors.length){anchors.sort((a,b)=>distance(ring.at(-1),a)-distance(ring.at(-1),b)||a.id.localeCompare(b.id));ring.push(anchors.shift());}
 // Improve the closing seam as well as interior neighbors without random ordering.
 const cost=xs=>xs.reduce((sum,p,i)=>sum+distance(p,xs[(i+1)%xs.length]),0);
 for(let pass=0;pass<8;pass++){let improved=false;for(let i=1;i<ring.length-1;i++)for(let j=i+1;j<ring.length;j++){const trial=[...ring.slice(0,i),...ring.slice(i,j+1).reverse(),...ring.slice(j+1)];if(cost(trial)+1e-9<cost(ring)){ring.splice(0,ring.length,...trial);improved=true;}}if(!improved)break;}
 const used=new Set(ring.map(p=>p.id)),groups=ring.map(a=>[a]);
 for(let r=1;r<4;r++)for(let g=0;g<groups.length;g++){
  const anchor=groups[g][0],pool=list.filter(p=>!used.has(p.id));
  const candidates=pool.length?pool:list.filter(p=>!groups[g].some(x=>x.id===p.id));
  if(!candidates.length){groups[g].push(groups[g].at(-1));continue;}
  candidates.sort((x,y)=>distance(anchor,x)-distance(anchor,y)||x.id.localeCompare(y.id));
  const chosen=candidates[0];used.add(chosen.id);groups[g].push(chosen);
 }
 return groups.map(g=>[g[0],...g.slice(1).sort((x,y)=>distance(g[0],x)-distance(g[0],y)||x.id.localeCompare(y.id))]);
}
export function planMelodyCandidate(ctx,position,groups=null){
 const choice=melodyChoice(position);if(choice.key==='original')return {choice,notes:copy(ctx.source.events),description:'Your starting tune'};
 const [turn,ring]=choice.key.split(':').map(Number),families=groups||ordered(ctx),region=Math.round(turn/3)%8;
 const group=families[region%families.length],phrase=group[Math.min(ring-1,group.length-1)];
 const variant=((turn-region*3+25)%24)-1,pitches=adapt(ctx,phrase,variant)||adapt(ctx,phrase,variant,true);if(!pitches)throw new Error('This phrase does not fit. Your groove stays.');
 const sec=15/ctx.bpm;
 const generated=phrase.notes.map(([step,originalPitch,gate],i)=>({id:`phrase-v4-${choice.key}-${phrase.id}-${i}`,role:'lead',patch_id:ctx.patch,step,
  duration_steps:gate,start_sec:step*sec,duration_sec:gate*sec,performance:{version:1,offset_steps:0},velocity:i===0||step%16===0?.68:.58,
  concrete:{midi_pitch:pitches[i],freq_hz:440*2**((pitches[i]-69)/12)},pitch_lock_mode:'concrete',provenance:'jam_generated',generated_by:'musiclab_phrase_composer_v4',
  derivation:{version:4,vocabularyVersion:VOCABULARY_VERSION,phrase_id:phrase.id,source:phrase.source,source_sha256:phrase.source_sha256,boundary:phrase.boundary,source_pitch:originalPitch}}));
 return {choice,notes:[...copy(ctx.source.events.filter(n=>n.role!=='lead')),...generated],description:'A source phrase fitted to this band',phraseId:phrase.id};
}
export function buildMelodyPalette(ctx){const groups=ordered(ctx),plans={original:planMelodyCandidate(ctx,{x:0,y:0},groups)};for(let t=0;t<24;t++)for(let r=1;r<=4;r++){const a=t*Math.PI/12,plan=planMelodyCandidate(ctx,{x:Math.sin(a)*r/4,y:Math.cos(a)*r/4},groups);plans[plan.choice.key]=plan;}return plans;}
