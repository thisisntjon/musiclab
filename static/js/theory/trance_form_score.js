// Original compact rolling theme, exposed passage, and return.
export const SCENE_ID='trance-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!=='trance-v1'||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid trance form');
 const bars=minor?[[0,3,7],[8,0,3],[3,7,10],[10,2,5]]:[[0,4,7],[9,0,4],[5,9,0],[7,11,2]],roots=minor?[0,8,3,10]:[0,9,5,7],pc=n=>((n%12)+12)%12;
 const notes=[],seen=new Set(),phase=cycle%8,space=variant==='space';
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate trance attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=16*bar,ch=bars[bar],breakBar=blockIndex===1&&bar<2;
  for(const tone of[ch[0],ch[2]])add('harmony','supersaw_stab',at,48+pc(root+tone),breakBar?12:space?3:6,.0035,'wide-bed');
  if(!breakBar){
   for(const s of[0,4,8,12])add('drums','kick',at+s,36,.5,.14,'four-pulse');
   for(const s of[4,12])add('drums','clap',at+s,38,.4,.10,'backbeat');
   for(const s of[2,6,10,14])add('drums','hat_open',at+s,42,.4,.045,'offbeat');
   for(let s=0;s<16;s++)if(s%4!==0)add('bass','clean_bass',at+s,36+pc(root+roots[bar]),space?.35:.55,.0036,'rolling-root');
  }
  const onsets=breakBar?[2,10]:space?[1,3,5,7,9,11,13,15]:Array.from({length:16},(_,i)=>i);
  onsets.forEach((s,i)=>{const last=bar===3&&i===onsets.length-1,ending=[0,1,2,0,2,1,0,2][phase];
   const idx=last?(ending+(variant==='answer'?1:0))%3:(i+color)%3;
   add('lead','pluck_lead',at+s+(last?phase*.03125:0),60+pc(root+ch[idx])+(color>=3?12:0),breakBar?3:color===4?.7:.4,.0021,'repeating-theme');
  });
  if(!breakBar)for(let i=0;i<density;i++)add('drums','hat_closed',at+[1.5,5.5,9.5,13.5][i],42,.2,.018,'detail');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.role.localeCompare(b.role)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:blockIndex?'Trance exposed theme and return':'Trance rolling theme'};
}
