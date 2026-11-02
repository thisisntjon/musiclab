// Original Texas-inspired clean-electric shuffle; no bends/distortion emulation.
export const SCENE_ID='texas-blues-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1,2].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid Texas form');
 const pc=n=>((n%12)+12)%12,progression=[0,0,0,0,5,5,0,0,7,5,0,7],roots=progression.slice(blockIndex*4,blockIndex*4+4);
 const bars=roots.map(r=>[r,pc(r+(minor&&r!==7?3:4)),pc(r+7),pc(r+10)]),phase=cycle%8,space=variant==='space',notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate Texas attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=16*bar,r=roots[bar],ch=bars[bar],third=minor?3:4;
  for(const[i,s]of[0,8/3,8,32/3].entries())add('harmony','sampled_clean_guitar_v1',at+s,48+pc(root+r+(i%2?(minor||bar===3?10:9):7)),space?.45:.9,.22,'shuffle-figure');
  for(const tone of[ch[1],ch[3]])add('harmony','sampled_clean_guitar_v1',at+(bar%2?12:4),60+pc(root+tone),space?.4:.85,.22,'seventh-shell');
  // Major call/minor-third reply is intentional blues color, not a triad-only claim.
  const colors=minor?[0,3,7,10,5]:[0,4,7,9,2],ending=(minor?[0,3,5,7]:[0,2,4,7]);
  const call=bar===0?third:bar===1?colors[color]:bar===2?7:ending[([0,1,2,3,1,2,3,0][phase]+(variant==='answer'?1:0))%4];
  add('lead','sampled_clean_guitar_v1',at+6,72+pc(root+r+call),(color===4?1.2:.7)*(space?.5:1),.31,'single-string-call');
  add('lead','sampled_clean_guitar_v1',at+14+(bar===3?phase/8:0),72+pc(root+r+(color===4?10:3)),space?.35:.65,.29,'single-string-reply');
  if(bar<density)add('lead','sampled_clean_guitar_v1',at+10,72+pc(root+r+(minor?5:9)),space?.2:.4,space?.12:.23,'pickup');
  const nextRoot=progression[(blockIndex*4+bar+1)%12],bass=[r,r,pc(r+7),pc(nextRoot-1)];
  for(const[i,s]of[0,4,8,12].entries())add('bass','clean_bass',at+s,36+pc(root+bass[i]),space?1.2:2.4,.0036,'root-repeat-approach');
  for(const s of[0,8])add('drums','kick',at+s,36,.5,.11,'shuffle-time');
  for(const s of[4,12])add('drums','snare',at+s,38,.4,.10,'shuffle-backbeat');
  for(const s of[0,8/3,4,20/3,8,32/3,12,44/3])add('drums','hat_closed',at+s,42,.3,.025,'triplet-time');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:3,label:`Texas-inspired electric shuffle ${blockIndex+1}/3`,scope:'Clean picked guitar, no bends/distortion emulation; original generated notes only.'};
}
