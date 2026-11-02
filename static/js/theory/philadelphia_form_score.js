// Original sparse strings and horn-pair dialogue, not orchestral emulation.
export const SCENE_ID='philadelphia-soul-v1';
const cache=new Map(),pc=n=>((n%12)+12)%12;
function material(root,minor){
 const key=`${root}/${minor}`;if(cache.has(key))return cache.get(key);
 const bars=minor?[[0,3,7,10],[8,0,3,7],[5,8,0,3],[7,11,2,5],[5,8,0,3],[8,0,3,7],[7,11,2,5],[0,3,7,10]]:[[0,4,7,11],[9,0,4,7],[2,5,9,0],[7,11,2,5],[5,9,0,4],[2,5,9,0],[7,11,2,5],[0,4,7,11]];
 const candidates=bars.map(ch=>{const out=[];for(let a=48;a<=71;a++)for(let b=a+3;b<=Math.min(a+12,71);b++)if(new Set([a%12,b%12]).size===2&&[a,b].every(p=>[ch[1],ch[3]].some(t=>pc(root+t)===p%12)))out.push([a,b]);return out;});
 // Exhaustive small pair-state paths; include the cycle seam in the objective.
 let best=null;
 function visit(path,index,total,max){if(index===8){const leap=path[7].map((p,i)=>Math.abs(p-path[0][i]));const score=Math.max(max,...leap)*1000+total+leap.reduce((a,b)=>a+b,0);if(!best||score<best.score)best={score,path};return;}
 for(const next of candidates[index]){const leap=path.length?next.map((p,i)=>Math.abs(p-path.at(-1)[i])):[0,0];visit([...path,next],index+1,total+leap.reduce((a,b)=>a+b,0),Math.max(max,...leap));}}
 visit([],0,0,0);const result={bars,strings:best.path};cache.set(key,result);return result;
}
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid Philadelphia form');
 const m=material(root,minor),bars=m.bars.slice(blockIndex*4,blockIndex*4+4),phase=cycle%8,space=variant==='space',notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate Philly attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,ch=bars[bar],globalBar=blockIndex*4+bar;
  [ch[0],ch[2],ch[1],ch[2]].forEach((tone,i)=>add('bass','sampled_bass_v1',at+[0,6,8,14][i],36+pc(root+tone),space?1.2:[4,1.5,4,1.5][i],.23,'connected-bass'));
  m.strings[globalBar].forEach((pitch,i)=>add('harmony','sampled_strings_v1',at,pitch,space?8:14,.17,`string-${i?'upper':'lower'}`));
  const index=(bar+color+(bar===3?[0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0):0))%4,onset=at+(blockIndex?10:11)+(bar===3?phase/8:0),gate=(color===4?1.6:.8)*(space?.6:1);
  add('lead','sampled_trumpet_v1',onset,60+pc(root+ch[index]),gate,.26,'horn-upper');
  add('lead','sampled_tenor_sax_v1',onset,48+pc(root+ch[(index+2)%4]),gate,.23,'horn-lower');
  if(bar<density)add('lead','sampled_trumpet_v1',at+5,60+pc(root+ch[(bar+color+1)%4]),space?.35:.6,.18,'horn-pickup');
  for(const step of [0,4,8,12])add('drums','kick',at+step,36,.5,.065,'steady-pulse');
  for(const step of [4,12])add('drums','snare',at+step,38,.4,.065,'backbeat');
  for(const step of [2,6,10,14])add('drums','hat_closed',at+step,42,.3,.025,'offbeat-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:bars[3][0]},blockCount:2,label:`Philadelphia-inspired strings and horns ${blockIndex?'answer':'statement'}`};
}
