// Original sampled-overdrive riff study; no amplifier or palm-mute model.
export const SCENE_ID='hard-rock-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid hard-rock form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=blockIndex?[5,8,10,0]:[0,10,5,0],bars=roots.map(r=>[r,pc(r+(minor?3:4)),pc(r+7)]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate hard-rock attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],onsets=bar%2?[0,6,8]:[0,6,8,12];
  for(const s of onsets){
   const bass=48+pc(root+r);
   for(const pitch of[bass,bass+7])add('harmony','sampled_overdrive_guitar_v1',at+s,pitch,(bar%2?.8:1.2)*(space?.5:1)*(color===4?1.2:1),s===0?.32:.25,pitch===bass?'power-fifth-root':'power-fifth-upper');
   add('drums','kick',at+s,36,.5,s===0?.13:.09,'riff-unison');
  }
  // The odd-bar riff stops afterstep8; the short lead answers at10, then breathes.
  const palette=minor?[0,3,5,7,10]:[0,2,4,7,9];
  if(bar%2){const degree=(color+(bar===3?[0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0):0))%5;add('lead','sampled_overdrive_guitar_v1',at+10+(bar===3?phase/8:0),60+pc(root+r+palette[degree]),space?.3:.6,.3,'riff-answer');}
  if(bar<density)add('lead','sampled_overdrive_guitar_v1',at+3,60+pc(root+r+palette[color]),space?.2:.4,.2,'picked-pickup');
  for(const[i,s]of[0,8].entries())add('bass','clean_bass',at+s,36+pc(root+r+(i?7:0)),space?1.2:2.4,.0036,'root-fifth-support');
  for(const s of[4,12])add('drums','snare',at+s,38,.5,.12,'rock-backbeat');
  for(const s of[0,2,4,6,8,10,12,14])add('drums','hat_closed',at+s,42,.3,s%4===0?.028:.018,'straight-eighths');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:`Hard-rock original fifth-riff ${blockIndex?'answer':'call'} study`,scope:'Sampled overdrive, no amp model, bends or palm-mute claim; generated only.'};
}
