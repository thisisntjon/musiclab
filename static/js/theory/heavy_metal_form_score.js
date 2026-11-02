// Original heavy-metal riff study. Short sampled gates are not physical palm muting.
export const SCENE_ID='heavy-metal-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid heavy-metal form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=blockIndex?[5,8,10,0]:[0,0,10,0],bars=roots.map(r=>[r,pc(r+(minor?3:4)),pc(r+7)]),palette=minor?[0,3,5,7,10]:[0,2,4,7,10],notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate metal attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 const patch='sampled_overdrive_guitar_v1';
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],low=48+pc(root+r);
  for(const step of[0,2,3,8,10,11]){
   const accent=step%8===0;
   const gate=(accent?.7:color===4?.5:.35)*(space?.5:1);
   add('harmony',patch,at+step,low,gate,accent?.28:.22,'gallop-root');
   if(accent)add('harmony',patch,at+step,low+7,gate,.25,'power-fifth-upper');
   add('bass','clean_bass',at+step,36+pc(root+r),space?.4:.8,.0028,'gallop-bass');
  }
  // A separately sustained answer occupies the gap after a gallop, not another low-riff trigger.
  const step=bar%2?12:4,degree=(color+bar+blockIndex+(bar===3?phase:0)+(bar===3&&variant==='answer'?1:0))%5;
  add('lead',patch,at+step+(bar===3?phase/8:0),72+pc(root+r+palette[degree]),space?1.2:2.4,.27,'sustained-answer');
  if(bar<density)add('lead',patch,at+7,72+pc(root+r+palette[(color+bar+2)%5]),space?.15:.3,.18,'lead-pickup');
  for(const step of[0,3,8,11])add('drums','kick',at+step,36,.5,step%8===0?.10:.065,'selected-riff-lock');
  for(const step of[4,12])add('drums','snare',at+step,38,.5,.09,'heavy-backbeat');
  for(const step of[0,4,8,12])add('drums','hat_closed',at+step,42,.3,.022,'quarter-pulse');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:0},blockCount:2,label:`Heavy-metal original gallop ${blockIndex?'answer':'pedal'} study`,scope:'Instrumental sampled overdrive with short low gates and sustained high answers; no physical palm mute, amp model, vocals or tempo multiplication.'};
}
