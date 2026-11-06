// Original garage riff: driving picked eighths plus sparse fifth accents, no clipping gimmick.
export const SCENE_ID='garage-rock-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid garage form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=blockIndex?[5,5,0,0]:[0,0,10,10],bars=roots.map(r=>[r,pc(r+(minor?3:4)),pc(r+7)]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate garage attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],base=48+pc(root+r),accents=bar%2?[.22,.12,.29,.14,.19,.11,.26,.13]:[.29,.14,.22,.11,.27,.13,.18,.12];
  for(let i=0;i<8;i++){
   add('harmony','sampled_overdrive_guitar_v1',at+i*2,base+(i%2?7:0),(space?.32:.65)*(color===4?1.2:1),accents[i],'driving-eighth');
   if(i===0&&bar%2===0)add('harmony','sampled_overdrive_guitar_v1',at,base+7,space?.32:.65,accents[i]*.8,'fifth-accent');
  }
  const palette=minor?[0,3,5,7,10]:[0,2,4,7,9];
  if(bar%2){const index=(color+(bar===3?[0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0):0))%5;add('lead','sampled_overdrive_guitar_v1',at+11+(bar===3?phase/8:0),60+pc(root+r+palette[index]),space?.25:.5,.28,'short-reply');}
  if(bar<density)add('lead','sampled_overdrive_guitar_v1',at+7,60+pc(root+r+palette[color]),space?.18:.35,.18,'reply-pickup');
  for(const s of[0,4,8,12])add('bass','clean_bass',at+s,36+pc(root+r),space?.8:1.6,.0036,'root-pulse');
  for(const s of[0,8])add('drums','kick',at+s,36,.5,.11,'drive');
  for(const s of[4,12])add('drums','snare',at+s,38,.4,bar%2?.13:.10,'uneven-backbeat');
  for(let i=0;i<8;i++)add('drums','hat_closed',at+i*2,42,.25,i%2?.018:.028,'straight-eighths');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:`Garage original eighth-riff ${blockIndex?'reply':'call'} study`,scope:'Sampled overdrive short picked attacks, no fuzz circuit/palm-mute claim; context third is not sounded by riff.'};
}
