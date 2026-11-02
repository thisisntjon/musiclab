// Original blues and piano form studies; source premises in NEXT-TEN-ROOTS-JAZZ.md.
export const SCENES=['jump-blues','boogie-woogie','classic-blues','country-blues','ragtime','stride-piano'];
export const BLOCK_COUNTS={'jump-blues':3,'boogie-woogie':3,'classic-blues':3,'country-blues':3,ragtime:2,'stride-piano':2};
const fold=(p,lo,hi)=>{while(p<lo)p+=12;while(p>hi)p-=12;return p;};
const blues=[0,0,0,0,5,5,0,0,7,5,0,7];
const validLevel=n=>Number.isInteger(n)&&n>=0&&n<=4;
export function buildBlock(sceneId,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 const id=sceneId.replace(/-v1$/,'');
 if(!SCENES.includes(id)||!validLevel(density)||!validLevel(color)||!['base','space','answer'].includes(variant)||!Number.isInteger(root)||root<0||root>11||!Number.isInteger(cycle)||cycle<0||!Number.isInteger(blockIndex)||blockIndex<0||blockIndex>=BLOCK_COUNTS[id])throw Error('Invalid draft block');
 const notes=[],seen=new Set(),third=minor?3:4;
 const roots=id==='ragtime'?(blockIndex===0?[0,9,2,7]:[5,5,0,7]):id==='stride-piano'?(blockIndex===0?[0,minor?8:9,2,7]:[5,2,7,0]):blues.slice(blockIndex*4,blockIndex*4+4);
 const bars=roots.map((r,b)=>{
  if(id==='stride-piano'){
   const type=blockIndex===0?['six','min','min','dom'][b]:['six','min','dom','six'][b];
   return [r,(r+(type==='min'?3:third))%12,(r+7)%12,(r+(type==='six'?(minor?8:9):10))%12];
  }
  if(id==='ragtime'){
   const t=blockIndex===1&&b===1?3:((blockIndex===0&&b===2)?3:third);
   return [r,(r+t)%12,(r+7)%12,(r+10)%12];
  }
  return [r,(r+third)%12,(r+7)%12,(r+10)%12];
 });
 const add=(role,patch,position,pitch,gate,velocity)=>{
  const identity=`${patch}/${position}/${pitch}`;
  if(seen.has(identity))throw Error('Duplicate draft attack '+identity);
  if(position<0||position>=64||gate<=0||position+gate>64+1e-8)throw Error('Outside block');
  seen.add(identity);notes.push({role,patch,position,pitch,gate,velocity});
 };
 const bass=(bar,step,interval,gate=1.5,patch='sampled_piano_v1',vel=.3)=>add('bass',patch,bar*16+step,fold(36+root+roots[bar]+interval,patch==='sampled_guitar_v1'?40:36,55),gate,vel);
 const upper=(bar,step,tone,gate=1,patch='sampled_piano_v1',vel=.3)=>add('lead',patch,bar*16+step,72+(root+tone)%12,gate,vel);
 // Five distinct upper-note colors, with the fifth using a low-velocity octave echo
 // contour rather than an extra layer. Pitch indices and articulation are authored.
 const colorIndex=[0,1,2,3,1][color],colorGate=color===4?1.35:1;
 const phase=cycle%8;
 const callTimes=[2,3,5,6,7,9,10,11];
 const baseCalls=Array.from({length:4},(_,bar)=>({bar,step:id==='stride-piano'?([6,10,2,13][bar]+(phase%2?2/3:0)):id==='ragtime'?(blockIndex? [1,7,11,5][bar]:[2,5,10,13][bar]):callTimes[(phase+bar)%8]}));
 const extraCalls=Array.from({length:density},(_,i)=>({bar:id==='classic-blues'?i%3:i,step:id==='classic-blues'?(i===3?12:14):id==='ragtime'?(blockIndex?14:7):14}));
 const calls=[...baseCalls,...extraCalls].filter(c=>id!=='classic-blues'||c.bar!==3).filter((c,i,a)=>!(variant==='space'&&i===a.length-1));
 if(id==='boogie-woogie'){
  const walk=minor?[0,3,7,8,10,8,7,3]:[0,4,7,9,10,9,7,4];
  for(let bar=0;bar<4;bar++)walk.forEach((tone,i)=>bass(bar,i*2,tone,1.4));
  // Never remove or shorten the defining eight attacks per bar for capacity.
 } else if(id==='jump-blues'){
  for(let bar=0;bar<4;bar++){
   if(bar===3){bass(bar,0,0,.7,'sampled_bass_v1',.3);add('drums','kick',bar*16,36,.5,.07);continue;}
   [0,third,7,minor?10:9].forEach((tone,i)=>bass(bar,i*4,tone,2.4,'sampled_bass_v1',.3));
   for(const step of [4,12])add('drums','snare',bar*16+step,38,.5,.065);
   add('drums','kick',bar*16,36,.5,.07);
   add('drums','hat_closed',bar*16+20/3,42,.35,.025);
  }
 }else if(id==='country-blues'){
  for(let bar=0;bar<4;bar++)for(const step of [0,4,8,12])bass(bar,step,0,.7,'sampled_guitar_v1',.3);
 }else{
  for(let bar=0;bar<4;bar++){
   bass(bar,0,0,id==='classic-blues'?3:1.6);bass(bar,8,7,id==='classic-blues'?3:1.6);
   if(id==='classic-blues'&&bar%2===0)continue;
   // Mid-register dyads; separate hand from low bass and high melody.
   for(const step of [4,12])for(const tone of [bars[bar][1],bars[bar][3]])add('harmony','sampled_piano_v1',bar*16+step,55+(root+tone+5)%12,variant==='space'?.55:1.2,.23);
  }
 }
 const patch=id==='jump-blues'?'sampled_trumpet_v1':id==='country-blues'?'sampled_guitar_v1':'sampled_piano_v1';
 for(const [i,c]of calls.entries()){
  const melodicPhase=id==='ragtime'&&c.bar<3?0:phase;
  let tone=bars[c.bar][(colorIndex+i+melodicPhase)%4];
  if(variant==='answer'&&i===calls.length-1)tone=bars[c.bar][(colorIndex+i+melodicPhase+1)%4];
  const onset=c.step+((id==='ragtime'||id==='stride-piano')&&phase>=4&&c.bar===3?.5:0);
  upper(c.bar,onset,tone,Math.min(64-(c.bar*16+onset),(id==='classic-blues'?(c.bar<2?4:1.4)*colorGate:colorGate)*(variant==='space'?.65:1)),patch,color===4?.25:.32);
 }
 notes.sort((a,b)=>a.position-b.position||a.role.localeCompare(b.role)||a.pitch-b.pitch);
 return {notes,harmony:{version:1,bars,ending:roots.at(-1)},label:`${id}: ${id==='ragtime'?['independent A study','independent B study'][blockIndex]:`form block ${blockIndex+1}/${BLOCK_COUNTS[id]}`} cycle ${phase}`,scope:id==='ragtime'?'Two independent four-bar studies, not full historical rag strains.':'Original generated instrumental; no personal-note input.'};
}
