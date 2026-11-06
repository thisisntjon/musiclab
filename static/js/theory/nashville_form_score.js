// Original Nashville-inspired piano/string instrumental.
export const SCENE_ID='nashville-sound-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!=='nashville-sound-v1'||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid Nashville form');
 const a=minor?[[0,3,7,10],[8,0,3,7],[5,8,0,3],[7,11,2,5]]:[[0,4,7,9],[9,0,4,7],[5,9,0,2],[7,11,2,5]],bars=blockIndex?[a[2],a[0],a[3],a[0]]:a;
 const notes=[],seen=new Set(),pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space';
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const k=[patch,position,pitch].join('/');if(seen.has(k))throw Error('Duplicate Nashville attack');seen.add(k);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=16*bar,ch=bars[bar];
  for(const[i,s]of[0,8].entries())add('bass','sampled_bass_v1',at+s,36+pc(root+ch[i?2:0]),space?3:6,.24,'connected-bass');
  for(const tone of[ch[1],ch[bar%2?3:2]])add('harmony','sampled_strings_v1',at,48+pc(root+tone),space?8:14,.18,'sustained-strings');
  const last=bar===3,idx=(bar+color+(last?[0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0):0))%4;
  add('lead','sampled_piano_v1',at+[2,5,3,9][bar]+(last?.125*phase:0),60+pc(root+ch[idx]),(color===4?4.5:3)*(space?.65:1),.33,'piano-phrase');
  if(bar<density)add('lead','sampled_piano_v1',at+[10,13,11,14][bar],60+pc(root+ch[(bar+color+1)%4]),space?.8:1.5,.24,'piano-answer');
  for(const s of[0,8])add('drums','kick',at+s,36,.5,.055,'soft-time');
  for(const s of[4,12])add('drums','snare',at+s,38,.4,.03,'soft-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:bars[3][0]},blockCount:2,label:`Nashville-inspired piano and strings ${blockIndex?'answer':'statement'}`};
}
