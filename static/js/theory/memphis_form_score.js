// Original two-horn instrumental study; no copied repertoire.
export const SCENE_ID='memphis-soul-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!=='memphis-soul-v1'||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid Memphis form');
 const pc=n=>((n%12)+12)%12,roots=blockIndex?[5,0,7,0]:[0,5,0,7],phase=cycle%8,space=variant==='space';
 const bars=roots.map(r=>[r,pc(r+(r===7?4:minor?3:4)),pc(r+7),pc(r+10)]),notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate Memphis attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,ch=bars[bar];
  for(const [i,s]of[0,3,8,14].entries())add('bass','sampled_bass_v1',at+s,36+pc(root+ch[[0,2,0,1][i]]),space?.7:[2,.7,3,1][i],i===0?.32:.27,'bass-hook');
  for(const tone of[ch[1],ch[3]])add('harmony','sampled_clean_guitar_v1',at+(bar%2?10:2),48+pc(root+tone),space?.35:.7,.24,'guitar-punctuation');
  for(const s of[0,8])add('drums','kick',at+s,36,.5,.13,'backbeat');
  for(const s of[4,12])add('drums','snare',at+s,38,.5,.14,'backbeat');
  for(const s of[0,2,4,6,8,10,12,14])add('drums','hat_closed',at+s,42,.3,s%4?.025:.04,'time');
 }
 const starts=blockIndex?[10,30,42,58]:[6,14,38,46];
 starts.forEach((at,i)=>{
  if(space&&i===1)return;
  const ch=bars[Math.floor(at/16)],shade=color%4,last=i===3;
  const index=(i+shade+(last?phase:0)+(last&&variant==='answer'?1:0))%4;
  const onset=at+(last?phase*.125:0),gate=(color===4?1.05:.7)*(space?.6:1);
  add('lead','sampled_trumpet_v1',onset,60+pc(root+ch[index]),gate,.31,'horn-high');
  add('lead','sampled_tenor_sax_v1',onset,48+pc(root+ch[(index+2)%4]),gate,.27,'horn-low');
 });
 for(let i=0;i<density;i++){const at=[19,27,51,61][i],ch=bars[Math.floor(at/16)];add('lead',i%2?'sampled_tenor_sax_v1':'sampled_trumpet_v1',at,(i%2?48:60)+pc(root+ch[(i+color)%4]),space?.35:.6,.22,'horn-fill');}
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:roots[3]},blockCount:2,label:`Memphis horn ${blockIndex?'reply':'call'} study`};
}
