// Original instrumental upper-register texture, not a physical picking or amp model.
export const SCENE_ID='black-metal-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}) {
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid black-metal form');
 const phase=cycle%8,space=variant==='space',pc=n=>((n%12)+12)%12;
 const bars=blockIndex?[[5,8,0],[8,0,3],[7,10,2],[0,3,7]]:[[0,3,7],[10,2,5],[8,0,3],[0,3,7]];
 const registers=blockIndex?[5,8,7,0]:[0,-2,-4,0];
 const contours=blockIndex?[[2,1,2,0],[1,2,1,0],[2,0,1,0],[1,0,2,0]]:[[2,2,1,0],[2,1,1,0],[2,1,0,0],[1,1,0,0]];
 const notes=[],seen=new Set(),patch='sampled_overdrive_guitar_v1';
 const add=(role,sound,position,pitch,gate,velocity,voice_id)=>{const key=[sound,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate black-metal attack');seen.add(key);notes.push({role,patch:sound,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++) {
  const at=bar*16,tonic=registers[bar],chord=bars[bar].map(pitch=>tonic+pc(pitch-tonic));
  add('bass','clean_bass',at,36+root+tonic,space?10:14,.0026,'long-root');
  for(const pitch of[tonic,tonic+7])add('harmony',patch,at,48+root+pitch,space?6:12,.15,'open-interval');
  const contour=contours[phase%4];
  for(let step=0;step<16;step++) {
   if(space&&step>=12)continue;
   const group=Math.floor(step/4),degree=bar===3&&group===3&&variant==='answer'?1:contour[group];
   const pitch=60+root+chord[degree];
   add('lead',patch,at+step,pitch,space?.45:.7+color*.05,(step%4===0?.23:.18)*(bar===3?1-phase*.015:1),'upper-repetition');
  }
  for(const step of[0,2,4,6,8,10,12,14])add('drums','kick',at+step,36,.35,step%8===0?.085:.045,'steady-fast-kick');
  for(const step of[1,3,5,7,9,11,13,15])if(!space||step%4===3)add('drums','snare',at+step,38,.3,.045,'upper-alternation');
  for(const step of[0,4,8,12])add('drums','hat_closed',at+step,42,.25,.018,'quarter-pulse');
  if(bar<density)add('drums','perc',at+15.5,42,.2,.018,'phrase-pickup');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:0},blockCount:2,label:`Black-metal original upper ${blockIndex?'return':'descending'} texture`,scope:'Instrumental minor chord texture, repeated sampled guitar attacks and long bass roots. No vocal, clipping, physical tremolo-picking, named-mode vocabulary or personal retiming claim.'};
}
