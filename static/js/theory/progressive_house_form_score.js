// Original eight-bar build/break/re-entry study using existing native voices.
export const SCENE_ID='progressive-house-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!=='progressive-house-v1'||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid progressive form');
 const t=minor?3:4,six=minor?8:9,bars=[[0,t,7],[six,0,minor?3:4],[5,minor?8:9,0],[7,minor?10:11,2]],roots=[0,six,5,7],pc=n=>((n%12)+12)%12;
 const notes=[],seen=new Set(),phase=cycle%8,space=variant==='space';
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate progressive attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 for(let bar=0;bar<4;bar++){
  const at=bar*16,breakBar=blockIndex===0&&bar===3,full=blockIndex===1,ch=bars[bar];
  if(!breakBar){for(const s of[0,4,8,12])add('drums','kick',at+s,36,.5,.14,'four-on-floor');
   for(const [i,s]of(full?[2,6,10,14]:[2,10]).entries())add('bass','clean_bass',at+s,36+pc(root+roots[bar])+(full&&i===2?12:0),space?1:1.5,.0036,'root-octave');}
  if(full||bar>=1)for(const s of[2,6,10,14])add('drums','hat_closed',at+s,42,.3,.045,'lift-hats');
  if(full||bar===2)for(const s of[4,12])add('drums','clap',at+s,38,.4,.10,'lift-claps');
  if(breakBar)for(const s of[14,15])add('drums','snare',at+s,38,.35,.07,'reentry-cue');
  for(const tone of[ch[0],ch[1]])add('harmony','warm_keys',at,48+pc(root+tone),space?2:[2,4,6,2][bar],.0021,'gate-build');
  const arps=breakBar?[2,10]:full?[2,4,6,8,10,12,14]:bar===0?[2,10]:bar===1?[2,6,10]:[2,6,10,14];
  const starts=space?arps.filter((_,i)=>i%2===0):arps;
  starts.forEach((s,i)=>{const last=bar===3&&i===starts.length-1,idx=(i+color+(last?phase:0)+(last&&variant==='answer'?1:0))%3;
   add('lead','pluck_lead',at+s+(last?phase*.0625:0),60+pc(root+ch[idx])+(color>=3?12:0),color===4?.8:.5,.0021,'developing-arp');});
  // Explicit extra subdivisions preserve the break; never add hidden kick/bass.
  for(let i=0;i<density;i++)add('drums','perc',at+[3,7,11,15.5][i],45,.25,.018,'detail');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.role.localeCompare(b.role)||a.pitch-b.pitch),harmony:{version:1,bars,ending:7},blockCount:2,label:blockIndex?'Progressive re-entry and development':'Progressive layers and break'};
}
