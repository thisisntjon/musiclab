// Original sequenced echoes: editable generated notes, not a delay processor.
export const SCENE_ID='psychedelic-rock-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid psychedelic form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',intervals=[0,2,minor?3:4,5,7,9,10],mode={version:1,name:minor?'dorian':'mixolydian',tonic:root,intervals},ch=[0,minor?3:4,7,10],bars=Array.from({length:4},()=>[...ch]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate psychedelic attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});return notes.at(-1);};
 for(let bar=0;bar<4;bar++){
  const at=bar*16;
  [48+root,55+root].forEach((pitch,i)=>add('harmony','sampled_organ_v1',at,pitch,space?8:14,.15,i?'drone-fifth':'drone-root'));
  for(const step of [0,8])add('bass','sampled_bass_v1',at+step,36+root,space?2:5,.23,'tonic-pedal');
  for(const[i,step]of [2,6].entries()){
   let degree=(bar*2+i+color+phase+blockIndex*2)%7;
   if(bar===0&&i===0)degree=5; // Audible natural sixth distinguishes this modal palette.
   if(bar===2&&i===0)degree=6; // Audible flat seventh is retained across controls.
   if(bar===3&&i===1&&variant==='answer')degree=(degree+1)%7;
   const pitch=(phase>=4?72:60)+pc(root+intervals[degree]),gate=(color===4?1.4:.9)*(space?.6:1),velocity=.27;
   const group="dry-"+(at+step);
   Object.assign(add('lead','sampled_clean_guitar_v1',at+step,pitch,gate,velocity,'dry-guitar'),{echo_group:group,echo_delay_steps:0});
   Object.assign(add('lead','sampled_clean_guitar_v1',at+step+3,pitch,gate,velocity*.5,'echo-first'),{echo_group:group,echo_delay_steps:3});
   if(bar<density)Object.assign(add('lead','sampled_clean_guitar_v1',at+step+6,pitch,gate,velocity*.25,'echo-second'),{echo_group:group,echo_delay_steps:6});
  }
  for(const step of [0,8])add('drums','kick',at+step,36,.5,.055,'sparse-pulse');
  add('drums','snare',at+12,38,.4,.055,'late-backbeat');
  for(const step of [7,15])add('drums','perc',at+step,42,.25,.015,'displaced-noise-tick');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:0},mode,blockCount:2,label:`Psychedelic original modal echo ${blockIndex?'answer':'contour'} study`,scope:'Sequenced generated echo notes, no sampled delay processor or automatic echoes on personal input; percussion is a noise tick, not tom.'};
}
