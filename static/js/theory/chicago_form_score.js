// Original twelve-bar guitar/harmonica exchange; bounded four-key allocation.
export const SCENE_ID='chicago-blues-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1,2].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid Chicago form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=[0,0,0,0,5,5,0,0,7,5,0,7].slice(blockIndex*4,blockIndex*4+4);
 const bars=roots.map(r=>[r,pc(r+(minor&&r!==7?3:4)),pc(r+7),pc(r+10)]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate Chicago attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,ch=bars[bar],r=roots[bar],turn=blockIndex===2&&bar===3;
  // Repeated root/fifth/sixth/fifth bass figure; final bar walks dominant -> tonic approach.
  const line=turn?[r,pc(r+4),pc(r+7),11]:[r,ch[2],pc(r+(minor?8:9)),ch[2]];
  line.forEach((tone,i)=>add('bass','sampled_bass_v1',at+i*4,36+pc(root+tone),space?1.2:2.8,.26,'repeated-blues-bass'));
  for(const step of [4,12])for(const tone of [ch[1],ch[3]]){
   // Leave room for four personal keys and the existing transition overlap.
   if(bar===3&&step===12&&tone===ch[3])continue;
   add('harmony','sampled_clean_guitar_v1',at+step,48+pc(root+tone),space?.5:1.1,.2,'electric-shells');
  }
  // Guitar calls then longer harmonica replies: distinct patches and time windows.
  const index=(bar+color+(bar===3?[0,1,2,3,1,2,3,0][phase]:0))%4;
  add('lead','sampled_clean_guitar_v1',at+2,60+pc(root+ch[index]),color===4?1.2:.7,.31,'guitar-call');
  if(bar<density)add('lead','sampled_clean_guitar_v1',at+8/3,60+pc(root+ch[(index+1)%4]),.5,.22,'guitar-pickup');
  const reply=(index+1+(variant==='answer'?1:0))%4;
  add('lead','sampled_harmonica_v1',at+10+((bar===3)?.125*phase:0),72+pc(root+ch[reply]),(space?1.2:3)*(color===4?1.15:1),.27,'harmonica-reply');
  for(const step of [0,8])add('drums','kick',at+step,36,.5,.08,'shuffle-time');
  for(const step of [4,12])add('drums','snare',at+step,38,.4,.06,'shuffle-time');
  for(const step of [0,8/3,8,32/3])add('drums','hat_closed',at+step,42,.3,step%8===0?.025:.016,'shuffle-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:3,label:`Chicago-inspired guitar/harmonica shuffle ${blockIndex+1}/3`};
}
