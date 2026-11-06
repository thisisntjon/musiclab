// Original jazz form studies; premises in NEXT-TEN-JAZZ-SCORE-PREMISES.md.
export const SCENES=['new-orleans-jazz-v1','bebop-v1','cool-jazz-v1','hard-bop-v1'];
export function buildBlock(sceneId,{root=0,minor=false,density=2,color=2,variant=0,cycle=0,blockIndex=0}={}){
 if(!SCENES.includes(sceneId))throw Error(`Unsupported study ${sceneId}`);
 variant=typeof variant==='string'?Math.max(0,['base','answer','space'].indexOf(variant)):variant;
 const block=((blockIndex%2)+2)%2,c=((cycle%8)+8)%8,third=minor?3:4;
 const shade=[0,1,2,3,1][color];
 const pc=n=>((n%12)+12)%12,notes=[];
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});
 const tone=(base,interval)=>base+pc(root+interval);
 const chord=(r,type='dom')=>[r,pc(r+(type==='min'?3:type==='major'?third:4)),pc(r+7),pc(r+(type==='major'?11:10)),pc(r+2)];
 let bars,roots,label;
 if(sceneId==='bebop-v1'){roots=block?[2,7,0,0]:[2,7,0,9];bars=roots.map((r,b)=>{
   if(block&&b===2)return [0,third,7,minor?8:9];
   const ch=chord(r,b===0?'min':b>=2&&r===0?'major':'dom');
   return (block&&b===1)||(!block&&b===3)?ch.slice(0,4):ch;
  });label=`Bebop changes study ${block?'answer':'call'}`;}
 else if(sceneId==='hard-bop-v1'){roots=block?[0,5,7,0]:[0,5,2,7];bars=roots.map((r,b)=>chord(r,!block&&b===2?'min':'dom').slice(0,4));label=`Hard-bop harmonized head study ${block?'reply':'head'}`;}
 else {roots=block?[5,0,7,0]:[0,5,0,7];bars=roots.map(r=>[r,pc(r+third),pc(r+7),pc(r+9)]);label=`${sceneId==='cool-jazz-v1'?'Cool arranged counterline':'New Orleans collective-line'} study ${block?'B':'A'}`;}
 for(let b=0;b<4;b++){
  const at=b*16,ch=bars[b],r=roots[b];
  // Bass and sparse guide-tone shell are independent, never a copied lead.
  const bassSteps=sceneId==='bebop-v1'?[0,4,8,12]:[0,8];
  bassSteps.forEach((s,i)=>add('bass','sampled_bass_v1',at+s,tone(36,[r,ch[1],ch[2],ch[3]][i]),1.2,.28+(i===0?.05:0),'bass'));
  if(b%2===block){for(const interval of[ch[1],ch[3]])add('harmony','sampled_piano_v1',at+(sceneId==='cool-jazz-v1'?10:6),tone(48,interval),sceneId==='cool-jazz-v1'?2.2:.9,.23,'piano-shell');}
  if(sceneId==='new-orleans-jazz-v1'){
   // Two different rhythms and contours overlap: main vs upper counterline.
   [0,8].forEach((s,i)=>add('lead','sampled_trumpet_v1',at+s,tone(60,ch[(b+i+c+shade)%3]),4,.31+(i===0?.04:0),'front-main'));
   const cells=(b+c+variant)%2?[3,7,11]:[2,6,13];
   cells.slice(0,density===0?2:3).forEach((s,i)=>add('lead','sampled_clarinet_v1',at+s,tone(72,ch[(3-i+b+c+shade)%ch.length]),1.7,.25,'upper-counter'));
  }else if(sceneId==='bebop-v1'){
   const target=tone(60,ch[(b+c+variant+shade)%ch.length]);
   const starts=(b+c)%2?[1,5,7,12]:[2,6,10,13];
   // Penultimate approach resolves by a real ascending semitone, no octave wrap.
   starts.forEach((s,i)=>add('lead','sampled_trumpet_v1',at+s,i===2?target-1:i===3?target:tone(60,ch[(i+b+c+shade)%ch.length]),i===3?1.8:.8,.28+(i===3?.06:0),'solo'));
  }else if(sceneId==='cool-jazz-v1'){
   // Fixed A/B shapes: cycle alters turnaround only, preserving arranged identity.
   const pick=i=>ch[(i+shade+(variant===1?1:0))%ch.length];
   const main=block?[pick(2),pick(0)]:[pick(0),pick(2)],upper=block?[pick(1),pick(3)]:[pick(3),pick(1)];
   [0,9].forEach((s,i)=>add('lead','sampled_tenor_sax_v1',at+s,tone(60,main[i]),4.5,.29,'arranged-main'));
   [4,12].forEach((s,i)=>add('lead','sampled_clarinet_v1',at+s+(b===3&&i===1&&c>=4?.5:0),tone(72,b===3&&i===1?ch[(c+shade)%ch.length]:upper[i]),3,.23,'arranged-counter'));
  }else{
   // Head is truly harmonized on matching attacks; reply has its own space.
   if(b%2===0){for(const s of[2,9]){const index=(b/2+c+variant+shade)%2;add('lead','sampled_trumpet_v1',at+s,tone(60,ch[index?2:1]),2.8,.36,'head-high');add('lead','sampled_tenor_sax_v1',at+s,tone(48,ch[index?1:0]),3.2,.32,'head-low');}}
   else {const answer=[ch[1],pc(r+3),ch[0]];[3,8,12].slice(0,density===0?2:3).forEach((s,i)=>add('lead','sampled_trumpet_v1',at+s,tone(60,answer[(i+c+shade)%3]),1.7,.33,'head-answer'));}
  }
  // Non-sampled timekeeping does not consume sampled voice reservations.
  [0,8].forEach(s=>add('drums','kick',at+s,36,.6,sceneId==='cool-jazz-v1'?.12:.22,'kick'));
  [4,12].forEach(s=>add('drums','snare',at+s,38,.5,sceneId==='hard-bop-v1'?.28:.13,'snare'));
  const hats=density===0?[0,8]:density===1?[0,4,8]:density>=4?[0,8/3,4,8,12,44/3]:density>=3?[0,4,8,12,44/3]:[0,4,8,12];hats.forEach((s,i)=>add('drums','hat_closed',at+s,42,.3,.10+(i%2?.04:0)+color*.006,'time'));
 }
 // Optional punctuation changes density without adding a permanent chord stack.
 if(density>=3)add('lead',sceneId==='cool-jazz-v1'?'sampled_clarinet_v1':'sampled_trumpet_v1',sceneId==='bebop-v1'?63:61,tone(sceneId==='cool-jazz-v1'?72:60,bars[3][(c+1)%bars[3].length]),1,.22,'turnaround');
 // Eight reproducible cadence breaths preserve the composed core, while an
 // explicit Space alternative shortens supplied articulation only.
 const cadence=notes.filter(n=>n.role==='lead').sort((a,b)=>b.position-a.position)[0];
 cadence.gate=Math.min(64-cadence.position,cadence.gate+.125*c);
 if(color===4)for(const n of notes)if(n.role==='lead')n.gate*=.75;
 if(variant===2)for(const n of notes)if(n.role==='lead')n.gate*=.8;
 notes.sort((a,b)=>a.position-b.position||a.voice_id.localeCompare(b.voice_id)||a.pitch-b.pitch);
 return{notes,harmony:{version:1,bars,ending:bars[3][0]},label,blockCount:2,cycle:c};
}
