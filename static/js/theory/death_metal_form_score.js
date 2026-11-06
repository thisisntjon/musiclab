// Original death-metal-inspired dense/sparse low-register study, no vocal or physical mute model.
export const SCENE_ID='death-metal-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid death-metal form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',sparse=blockIndex===1,roots=sparse?[0,5,1,0]:[0,1,6,0],bars=roots.map(r=>[r,pc(r+(minor?3:4)),pc(r+7)]),palette=[0,1,3,6,10],notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate death-metal attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 const patch='sampled_overdrive_guitar_v1';
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],low=40+pc(root+r-4),steps=sparse?[0,6,8,14]:[0,1,2,3,4,5,6,7],cell=sparse?[0,1,6,0]:[0,0,1,1,6,6,1,0];
  for(const[i,step]of steps.entries()){
   const gate=sparse?(space?.6:1.4):(space?.15:color===4?.45:.3);
   add('harmony',patch,at+step,low+cell[i],gate,step===0?.27:.21,sparse?'heavy-cell':'repeated-burst');
   if(sparse&&[0,8].includes(step))add('harmony',patch,at+step,low+cell[i]+7,gate,.22,'heavy-fifth');
   add('bass','clean_bass',at+step,low+cell[i]-12,space?.3:sparse?1.1:.6,.0026,'low-riff-unison');
  }
  const step=sparse?(bar%2?10:4):(bar%2?14:10),degree=(color+bar+blockIndex+(bar===3?phase:0)+(bar===3&&variant==='answer'?1:0))%5;
  add('lead',patch,at+step+(bar===3?phase/8:0),72+pc(root+r+palette[degree]),space?.3:sparse?2.2:.6,.25,'phrase-answer');
  if(bar<density)add('lead',patch,at+12,72+pc(root+r+palette[(color+bar+2)%5]),space?.15:.3,.17,'answer-pickup');
  for(const step of(sparse?[0,8]:[0,2,4,6,8,10,12,14]))add('drums','kick',at+step,36,.4,sparse?.09:.06,'dense-sparse-kick');
  for(const step of(sparse?[12]:[1,3,5,7,9,11,13,15]))add('drums','snare',at+step,38,.35,sparse?.09:.045,'alternating-snare');
  for(const step of(sparse?[0,8]:[0,4,8,12]))add('drums','hat_closed',at+step,42,.25,.018,'phrase-pulse');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:0},blockCount:2,label:`Death-metal original ${sparse?'sparse heavy':'dense repeated'} cell study`,scope:'Instrumental low-register chromatic sample notes, alternating drums and sparse contrast; no down-tuning model, vocal, palm mute, mixed meter or personal retiming.'};
}
