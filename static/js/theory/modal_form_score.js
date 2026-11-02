// Original modal pedal study. Source premises: workflow/research/genre-expansion-2026-10-30/MODAL-JAZZ.md.
export const SCENE_ID='modal-jazz-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(x=>Number.isInteger(x)&&x>=0&&x<=4)||!['base','space','answer'].includes(variant)||!Number.isInteger(cycle)||cycle<0||![0,1].includes(blockIndex))throw Error('Invalid modal draft context');
 const mode=minor?[0,2,3,5,7,9,10]:[0,2,4,5,7,9,10],pc=n=>((n%12)+12)%12;
 const notes=[],seen=new Set(),phase=cycle%8,space=variant==='space';
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{
  const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate modal attack '+key);seen.add(key);
  notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});
 };
 // One tonic pedal for the entire eight-bar form, sparse fifth in the answer block.
 for(let bar=0;bar<4;bar++)add('bass','sampled_bass_v1',16*bar,36+pc(root+(blockIndex&&bar===2?7:0)),space?6:10,.27,'pedal');
 // Sustained fourth-based cells, not a changing functional progression.
 for(const [at,tones]of [[0,[2,7,0]],[32,[9,2,7]]])for(const tone of tones)add('harmony','sampled_piano_v1',at,48+pc(root+tone),space?7:14,.19,'modal-fourths');
 const starts=blockIndex?[1,13,18,30,40,57]:[2,10,21,29,42,55];
 starts.forEach((at,i)=>{
  if(space&&i===1)return;
  // State the characteristic tones in every block, including Space.
  const ending=[0,2,4,0,2,4,0,4][phase];
  const degree=i===0?2:i===3?5:i===4?6:i===5?(variant==='answer'?(ending+2)%7:ending):(i+color+blockIndex)%7;
  add('lead','sampled_tenor_sax_v1',at+(i===5?phase*.125:0),60+pc(root+mode[degree]),(i===5?3+phase*.125:2.5)*(space?.65:1),.29,'modal-motif');
 });
 for(let i=0;i<density;i++)add('lead','sampled_tenor_sax_v1',[6,25,46,61][i],60+pc(root+mode[(i+color+blockIndex+1)%7]),space?.6:1.1,.23,'modal-reply');
 for(let bar=0;bar<4;bar++)for(const at of[0,8])add('drums','hat_closed',bar*16+at,42,.3,.035,'open-pulse');
 for(const at of[0,32])add('drums','kick',at,36,.5,.065,'pulse');
 for(const at of[12,44])add('drums','snare',at,38,.5,.04,'light-punctuation');
 notes.sort((a,b)=>a.position-b.position||a.role.localeCompare(b.role)||a.pitch-b.pitch);
 const vocabulary=[0,minor?3:4,7,9,10];
 return {notes,harmony:{version:1,bars:Array.from({length:4},()=>[...vocabulary]),ending:0},label:`Modal ${minor?'Dorian':'Mixolydian'} ${blockIndex?'answer':'statement'} study`,mode:{version:1,name:minor?'dorian':'mixolydian',intervals:mode,tonic:root},blockCount:2,cycle:phase};
}
