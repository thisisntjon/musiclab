// Original organ/drums vamp with separate bass, shell and upper-answer voices.
export const SCENE_ID='soul-jazz-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid soul jazz form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=blockIndex?[5,5,0,0]:[0,0,0,0],bars=roots.map(r=>[r,pc(r+(minor?3:4)),pc(r+7),pc(r+10)]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate soul jazz attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,ch=bars[bar];
  [ch[0],ch[2],ch[3],ch[2]].forEach((tone,i)=>add('bass','sampled_organ_v1',at+i*4,36+pc(root+tone),space?1:2.6,.2,'organ-bass-ostinato'));
  for(const tone of [ch[1],ch[3]])add('harmony','sampled_organ_v1',at+(bar%2?10:6),48+pc(root+tone),space?.7:1.8,.2,'organ-shells');
  for(const[i,step]of [2,12].entries()){
   const last=bar===3&&i===1,idx=(bar+i+color+(last?[0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0):0))%4;
   add('lead','sampled_organ_v1',at+step+(last?.125*phase:0),60+pc(root+ch[idx]),(color===4?2.2:1.4)*(space?.6:1),.29,'organ-upper-answer');
  }
  if(bar<density)add('lead','sampled_organ_v1',at+14,60+pc(root+ch[(bar+color+2)%4]),.6,.2,'organ-pickup');
  for(const step of [0,8])add('drums','kick',at+step,36,.5,.08,'grounded-time');
  for(const step of [4,12])add('drums','snare',at+step,38,.4,.07,'grounded-time');
  for(const step of [0,6,8,14])add('drums','hat_closed',at+step,42,.3,step%8===0?.025:.018,'syncopated-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:`Soul-jazz-inspired organ vamp ${blockIndex?'answer':'statement'}`};
}
