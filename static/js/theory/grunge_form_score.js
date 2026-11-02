// Original grunge-inspired quiet/forceful instrumental contrast; not artist material.
export const SCENE_ID='grunge-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid grunge form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',forceful=blockIndex===1,roots=[0,8,5,0],third=minor?3:4,bars=roots.map(r=>[r,pc(r+third),pc(r+7)]),palette=minor?[0,3,5,7,10]:[0,2,4,7,10],notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate grunge attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 const patch=forceful?'sampled_overdrive_guitar_v1':'sampled_clean_guitar_v1';
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],low=48+pc(root+r);
  if(forceful){
   for(const step of[0,3,8,10]){
    for(const [i,pitch]of[low,low+7].entries())add('harmony',patch,at+step,pitch,(step===0?1.8:.8)*(space?.5:1),step===0?.29:.23,i?'power-fifth-upper':'power-fifth-root');
    add('drums','kick',at+step,36,.5,step===0?.10:.07,'riff-unison');
   }
  }else{
   for(const[i,step]of[0,4,8,12].entries())add('harmony',patch,at+step,low+[0,7,third,7][i],(color===4?3:2.2)*(space?.5:1),i===0?.25:.22,'clean-arpeggio');
   for(const step of[0,8])add('drums','kick',at+step,36,.5,.055,'quiet-pulse');
  }
  // A shared short upper answer survives both timbres; density belongs to generated pickups only.
  let degree=(color+bar+(bar===3?phase:0)+(bar===3&&variant==='answer'?1:0))%5;
  const position=at+14+(bar===3?phase/8:0);
  add('lead',patch,position,72+pc(root+r+palette[degree]),(color===4?.8:.5)*(space?.5:1),forceful?.25:.27,'shared-answer');
  if(bar<density)add('lead',patch,at+6,72+pc(root+r+palette[(color+bar+2)%5]),space?.2:.4,forceful?.18:.20,'answer-pickup');
  for(const step of(forceful?[0,3,8,10]:[0,8]))add('bass','clean_bass',at+step,36+pc(root+r),space?.8:1.6,.0032,'root-support');
  for(const step of[4,12])add('drums','snare',at+step,38,.5,forceful?.09:.055,'backbeat');
  for(const step of(forceful?[0,2,4,6,8,10,12,14]:[2,6,10,14]))add('drums','hat_closed',at+step,42,.3,forceful?.018:.012,'phrase-subdivision');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:0},blockCount:2,label:`Grunge original ${forceful?'forceful fifth-riff':'quiet clean-arpeggio'} study`,scope:'Generated clean/overdrive phrase contrast at one shared tempo; no vocals, amp model or physical distortion automation.'};
}
