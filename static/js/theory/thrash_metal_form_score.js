// Original thrash-inspired chromatic bursts. Sample gates do not model palm muting.
export const SCENE_ID='thrash-metal-v1';
export function buildBlock(sceneId=SCENE_ID,{root=0,minor=false,density=1,color=1,variant='base',cycle=0,blockIndex=0}={}){
 if(sceneId!==SCENE_ID||!Number.isInteger(root)||root<0||root>11||![density,color].every(n=>Number.isInteger(n)&&n>=0&&n<=4)||![0,1].includes(blockIndex)||!Number.isInteger(cycle)||cycle<0||!['base','space','answer'].includes(variant))throw Error('Invalid thrash form');
 const pc=n=>((n%12)+12)%12,phase=cycle%8,space=variant==='space',roots=blockIndex?[8,5,1,0]:[0,0,5,0],bars=roots.map(r=>[r,pc(r+(minor?3:4)),pc(r+7)]),palette=[0,1,5,6,10],notes=[],seen=new Set();
 const add=(role,patch,position,pitch,gate,velocity,voice_id)=>{const key=[patch,position,pitch].join('/');if(seen.has(key))throw Error('Duplicate thrash attack');seen.add(key);notes.push({role,patch,position,pitch,gate:Math.min(gate,64-position),velocity,voice_id});};
 const patch='sampled_overdrive_guitar_v1';
 for(let bar=0;bar<4;bar++){
  const at=bar*16,r=roots[bar],low=48+pc(root+r),cell=bar%2?[0,1,0,0,6,5,1,0]:[0,0,1,0,0,6,5,0];
  for(const[i,step]of[0,1,2,3,8,9,10,11].entries()){
   add('harmony',patch,at+step,low+cell[i],space?.15:color===4?.45:.3,step%8===0?.27:.21,'chromatic-burst');
   add('bass','clean_bass',at+step,36+pc(root+r)+cell[i],space?.3:.6,.0026,'riff-unison');
   add('drums','kick',at+step,36,.4,step%8===0?.085:.055,'kick-burst');
  }
  const answerStep=bar%2?14:6,degree=(color+bar+blockIndex+(bar===3?phase:0)+(bar===3&&variant==='answer'?1:0))%5;
  add('lead',patch,at+answerStep+(bar===3?phase/8:0),72+pc(root+r+palette[degree]),space?.2:.4,.25,'angular-answer');
  if(bar<density)add('lead',patch,at+7,72+pc(root+r+palette[(color+bar+2)%5]),space?.15:.3,.17,'answer-pickup');
  for(const step of[4,12])add('drums','snare',at+step,38,.5,.09,'burst-backbeat');
  for(const step of[0,2,4,6,8,10,12,14])add('drums','hat_closed',at+step,42,.25,.018,'eighth-pulse');
 }
 return {notes:notes.sort((a,b)=>a.position-b.position||a.patch.localeCompare(b.patch)||a.pitch-b.pitch),harmony:{version:1,bars,ending:0},blockCount:2,label:`Thrash original chromatic ${blockIndex?'answer':'burst'} study`,scope:'Instrumental chromatic generated bursts and rests at shared tempo; no physical palm mute, amp model, vocals or retimed personal notes.'};
}
