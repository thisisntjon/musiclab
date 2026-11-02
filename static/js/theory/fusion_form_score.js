// Original two-region electric-groove study; personal notes are never input.
export const SCENE_ID='jazz-fusion-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||![0,1].includes(blockIndex)||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||!['base','answer','space'].includes(variant)||!Number.isInteger(cycle)||cycle<0)throw Error('Invalid fusion form');
 const mode=minor?[0,2,3,5,7,9,10]:[0,2,4,5,7,9,10],region=blockIndex?5:0,phase=cycle%8,pc=n=>((n%12)+12)%12;
 const notes=[],seen=new Set(),space=variant==='space';
 const add=(role,patch,position,base,interval,gate,velocity,voice_id)=>{
  const pitch=base+pc(root+region+interval),key=[patch,position,pitch].join('/');
  if(seen.has(key))throw Error('Duplicate fusion attack '+key);seen.add(key);
  notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});
 };
 for(let bar=0;bar<4;bar++)for(const [i,at]of[0,6,9,14].entries())add('bass','sampled_bass_v1',bar*16+at,36,[0,7,10,9][i],space?.7:[1.5,.65,.65,1][i],.3,'syncopated-riff');
 for(const [at,tones]of[[2,[mode[2],10,2]],[34,[mode[2],9,2]]])for(const tone of tones)add('harmony','sampled_electric_piano_v1',at,48,tone,space?2:5,.22,'extended-comp');
 const starts=blockIndex?[1,5,11,18,26,37,43,54]:[0,3,7,10,19,23];
 starts.forEach((at,i)=>{
  if(space&&i===1)return;
  const last=i===starts.length-1,degree=i===0?2:i===2?6:last?([0,4,1,5,2,6,3,1][phase]+(variant==='answer'?2:0))%7:(i+color)%7;
  add('lead','sampled_clean_guitar_v1',at+(last?.125*phase:0),60,mode[degree],(blockIndex?1.7:.8)*(space?.7:1),.29,'electric-line');
 });
 for(let i=0;i<density;i++)add('lead','sampled_clean_guitar_v1',[29,46,58,62][i],60,mode[(i+color+blockIndex)%7],space?.45:.7,.22,'reply-detail');
 for(let bar=0;bar<4;bar++){
  // Native drum pitches are fixed, independent of modal region/tonic.
  const drum=(patch,at,pitch,v)=>notes.push({role:'drums',patch,position:bar*16+at,pitch,gate:.4,velocity:v,voice_id:'straight-kit'});
  for(const at of[0,6,10])drum('kick',at,36,.12);
  for(const at of[4,12])drum('snare',at,38,.10);
  for(const at of[0,2,4,6,8,10,12,14])drum('hat_closed',at,42,at%4===0?.045:.025);
 }
 notes.sort((a,b)=>a.position-b.position||a.role.localeCompare(b.role)||a.pitch-b.pitch);
 const vocabulary=[0,mode[2],7,9,10].map(n=>pc(region+n));
 return {notes,harmony:{version:1,bars:Array.from({length:4},()=>[...vocabulary]),ending:region},mode:{version:1,name:minor?'dorian':'mixolydian',intervals:mode,tonic:pc(root+region)},label:`Electric groove fusion ${blockIndex?'answer region':'riff region'}`,blockCount:2,cycle:phase};
}
