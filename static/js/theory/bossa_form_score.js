// Original nylon study in explicit four-quarter teaching notation.
export const SCENE_ID='bossa-nova-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!=='bossa-nova-v1'||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid bossa form');
 const a=minor?[[0,3,7,10,2],[5,8,0,3,7],[7,11,2,5,8],[0,3,7,9,2]]:[[0,4,7,11,2],[2,5,9,0,4],[7,11,2,5,9],[0,4,7,9,2]];
 const bars=blockIndex?[a[1],a[2],a[0],a[3]]:a,notes=[],seen=new Set(),space=variant==='space',phase=cycle%8;
 const pc=n=>((n%12)+12)%12,fold=(n,lo,hi)=>{while(n<lo)n+=12;while(n>hi)n-=12;return n;};
 const add=(role,at,pitch,gate,velocity,voice_id)=>{let k=[at,pitch].join('/');if(seen.has(k))throw Error('Duplicate nylon attack');seen.add(k);notes.push({role,patch:'sampled_guitar_v1',position:at,pitch,gate:Math.min(gate,64-at),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const ch=bars[bar],at=16*bar,pattern=bar%2?[4,10]:[0,6,12];
  for(const[i,s]of[0,8].entries())add('bass',at+s,fold(48+root+ch[i?2:0],40,55),space?2:4,.25,'thumb-root-fifth');
  for(const[i,s]of pattern.entries())for(const tone of[ch[1],ch[i===pattern.length-1?4:3]])add('harmony',at+s,fold(60+root+tone,56,67),space?.8:1.8,.21,'syncopated-shell');
  const degree=(bar+color+(bar===3?phase+(variant==='answer'?1:0):0))%5;
  add('lead',at+[3,7,5,13][bar]+(bar===3?.0625*phase:0),72+pc(root+ch[degree]),space?1:2.2,.24,'spacious-call');
  if(bar<density)add('lead',at+[9,13,11,9][bar],72+pc(root+ch[(color+bar+1)%5]),space?.6:1,.19,'answer-detail');
  for(const s of[0,4,8,12])notes.push({role:'drums',patch:'hat_closed',position:at+s,pitch:42,gate:.3,velocity:.018,voice_id:'quiet-time'});
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.pitch-b.pitch),harmony:{version:1,bars,ending:0},blockCount:2,label:`Nylon bossa ${blockIndex?'answer':'statement'} study`};
}
