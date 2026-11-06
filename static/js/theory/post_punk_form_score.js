// Original angular bass/clean-guitar sketch; no muted-string physics claim.
export const SCENE_ID='post-punk-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid post-punk form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=blockIndex?[minor?8:2,5,0,0]:[0,0,5,5],bars=roots.map((r,i)=>[r,pc(r+(i%2?5:2)),pc(r+7)]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate post-punk attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],ch=bars[bar],bassTones=[0,7,2,0,7,10];
  [0,3,6,9,11,14].forEach((step,i)=>add('bass','sampled_bass_v1',at+step,36+pc(root+r+bassTones[i]),(space?.7:1)*[2.5,1,2,1.5,1,1.4][i],i===0?.3:.25,'angular-bass-ostinato'));
  const onset=at+(bar%2?12:4);
  [ch[1],ch[2]].forEach((tone,i)=>add('harmony','sampled_clean_guitar_v1',onset,48+pc(root+tone),space?.18:color===4?.6:.35,.22,`suspended-${i?'fifth':'color'}`));
  const palette=minor?[0,2,3,7,10]:[0,2,4,7,9],last=bar===3,idx=(bar+color+(blockIndex?1:0)+(last?[0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0):0))%5;
  add('lead','sampled_clean_guitar_v1',at+(bar%2?13:8)+(last?phase/16:0),60+pc(root+r+palette[idx]),space?.25:.55,.29,'gap-answer');
  if(bar<density)add('lead','sampled_clean_guitar_v1',at+(bar%2?5:1),60+pc(root+r+palette[(color+2)%5]),space?.2:.4,.2,'answer-pickup');
  for(const step of [0,7,10])add('drums','kick',at+step,36,.4,step===0?.1:.065,'angular-kick');
  for(const step of [4,12])add('drums','snare',at+step,38,.3,.075,'clipped-backbeat');
  for(const step of [2,6,10,14])add('drums','hat_closed',at+step,42,.25,.024,'sparse-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:`Post-punk original angular ${blockIndex?'answer':'ostinato'} study`,scope:'One bass-led clean-guitar sketch; natural release allowed, no effect/muting emulation or universal definition.'};
}
