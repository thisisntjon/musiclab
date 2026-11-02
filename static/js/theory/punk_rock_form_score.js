// Original compact punk instrumental; no physical downstroke/vocal claim.
export const SCENE_ID='punk-rock-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid punk form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=blockIndex?[7,5,0,0]:[0,5,0,5],bars=roots.map(r=>[r,pc(r+(minor?3:4)),pc(r+7)]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate punk attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],base=48+pc(root+r),gate=(space?.24:.45)*(color===4?1.25:1);
  for(const step of [0,2,4,8,10,12])add('harmony','sampled_overdrive_guitar_v1',at+step,base,gate,step%8===0?.29:.22,'clipped-root-drive');
  for(const step of [0,8])add('harmony','sampled_overdrive_guitar_v1',at+step,base+7,gate,.24,'power-fifth-accent');
  const palette=minor?[0,3,5,7,10]:[0,2,4,7,9],last=bar===3;
  const idx=(color+(bar%2?2:0)+(blockIndex?1:0)+(last?[0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0):0))%5;
  add('lead','sampled_overdrive_guitar_v1',at+(bar%2?14:6)+(last?phase/16:0),60+pc(root+r+palette[idx]),space?.25:.5,.28,'short-hook-answer');
  if(bar<density)add('lead','sampled_overdrive_guitar_v1',at+(bar%2?6:14),60+pc(root+r+palette[(color+1)%5]),space?.18:.35,.19,'hook-pickup');
  for(let i=0;i<8;i++)add('bass','clean_bass',at+i*2,36+pc(root+r+(i===7?7:0)),space?.5:.9,.0036,'eighth-root-pulse');
  for(const step of [0,6,8,14])add('drums','kick',at+step,36,.4,step%8===0?.10:.07,'subdivision-drive');
  for(const step of [4,12])add('drums','snare',at+step,38,.4,.11,'backbeat');
  for(let i=0;i<16;i++)add('drums','hat_closed',at+i,42,.2,i%4===0?.022:i%2===0?.016:.009,'sixteenth-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:`Punk original compact hook ${blockIndex?'answer':'call'} study`,scope:'Instrumental sampled overdrive; original generated subdivision only, no vocals or physical downstroke emulation.'};
}
