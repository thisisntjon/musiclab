// Original clean-electric country answer study; no Telecaster emulation claim.
export const SCENE_ID='bakersfield-sound-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!=='bakersfield-sound-v1'||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid Bakersfield form');
 const roots=blockIndex?[5,0,7,0]:[0,5,0,7],pc=n=>((n%12)+12)%12,bars=roots.map(r=>[r,pc(r+(r===7?4:minor?3:4)),pc(r+7)]),notes=[],seen=new Set(),phase=cycle%8,space=variant==='space';
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const k=[patch,position,pitch].join('/');if(seen.has(k))throw Error('Duplicate Bakersfield attack');seen.add(k);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=16*bar,ch=bars[bar];
  for(const[i,s]of[0,4,8,12].entries())add('bass','sampled_bass_v1',at+s,36+pc(root+ch[i%2?2:0]),space?.65:1.1,.31,'driving-root-fifth');
  if(bar<density)add('bass','sampled_bass_v1',at+15,36+pc(root+ch[1]),.5,.23,'pickup');
  for(const tone of[ch[1],ch[2]])add('harmony','sampled_clean_guitar_v1',at+(bar%2?12:4),48+pc(root+tone),space?.3:.6,.25,'compact-comp');
  for(const[i,s]of(blockIndex?[3,10]:[2,7]).entries()){
   const last=bar===3&&i===1,index=(bar+i+color+(last?[0,1,2,0,2,1,0,2][phase]+(variant==='answer'?1:0):0))%3;
   add('lead','sampled_clean_guitar_v1',at+s+(last?.0625*phase:0),60+pc(root+ch[index])+(color>=3?12:0),(color===4?.8:.45)*(space?.65:1),.34,'picked-answer');
  }
  for(const s of[0,8])add('drums','kick',at+s,36,.5,.14,'firm-beat');
  for(const s of[4,12])add('drums','snare',at+s,38,.4,.14,'firm-backbeat');
  for(const s of[0,2,4,6,8,10,12,14])add('drums','hat_closed',at+s,42,.3,.03,'straight-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:`Bakersfield-inspired electric ${blockIndex?'reply':'call'} study`};
}
