// Original compact two-guitar study; no copied repertoire.
export const SCENE_ID='jazz-manouche-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!=='jazz-manouche-v1'||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid manouche form');
 const major=[[[0,4,7,9],[9,1,4,7],[2,5,9,0],[7,11,2,5]],[[5,9,0,2],[2,5,9,0],[7,11,2,5],[0,4,7,9]]];
 const minorBars=[[[0,3,7,9],[5,8,0,2],[2,5,8,0],[7,11,2,5]],[[5,8,0,2],[2,5,8,0],[7,11,2,5],[0,3,7,9]]];
 const bars=(minor?minorBars:major)[blockIndex],notes=[],seen=new Set(),phase=cycle%8,space=variant==='space';
 const fold=(n,lo,hi)=>{while(n<lo)n+=12;while(n>hi)n-=12;return n;};
 const add=(role,at,pitch,gate,velocity,voice_id)=>{const key=[at,pitch].join('/');if(seen.has(key))throw Error('Duplicate guitar attack');seen.add(key);notes.push({role,patch:'sampled_steel_guitar_v1',position:at,pitch,gate,velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const chord=bars[bar];
  for(const beat of[0,1,2,3])for(const tone of(beat%2?[chord[1],chord[3]]:[chord[0],chord[2]])){
   const p=beat%2?fold(60+root+tone,55,66):fold(48+root+tone,40,55);
   add('harmony',bar*16+beat*4,p,space?.25:beat%2?.35:.6,beat%2?.30:.23,'four-beat-pump');
  }
  const endingShift=[0,1,2,3,1,2,3,0][phase];
  const degree=bar===3?(3+color+endingShift+(variant==='answer'?1:0))%4:(bar+color)%4;
  const tone=chord[degree],at=bar*16+[2,5,6,9][bar]+(bar===3?.125*phase:0);
  add('lead',at,72+(root+tone)%12,(color===4?1.2:.8)*(space?.6:1),.28,'arpeggio-call');
  if(bar<density)add('lead',bar*16+[6,9,10,13][bar],72+(root+chord[(bar+color+(variant==='answer'?2:1))%4])%12,space?.4:.7,.23,'arpeggio-reply');
 }
 // The final call develops through all four chord tones; first three calls stay.
 return {notes:notes.sort((a,b)=>a.position-b.position||a.pitch-b.pitch),harmony:{version:1,bars,ending:bars[3][0]},blockCount:2,label:`Two-guitar pump ${blockIndex?'answer':'statement'} study`};
}
