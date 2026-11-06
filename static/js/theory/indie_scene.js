import {createSceneWriter} from './scene_writer.js';
import {NATIVE_SCENE_BASS_LEVEL} from './scene_voice_levels.js';
export const INDIE_ID='indie-rock-v1';
export const INDIE_GUITAR=Object.freeze({
 major:[[60,67,64,67,64,72],[64,60,69,60,64,57],[65,72,69,72,69,77],[62,59,67,55]],
 minor:[[60,67,63,67,63,72],[63,60,68,60,63,56],[65,72,68,72,68,77],[62,58,67,55]],
});
const BASS={major:[[36,40,43,40],[45,48,40,43],[41,45,48,45],[43,47,50,38]],minor:[[36,39,43,39],[44,48,39,43],[41,44,48,44],[43,46,50,38]]};
const fold=(p,low,high)=>{while(p<low)p+=12;while(p>high)p-=12;return p;};
export function indieBacking(doc,session,preserved,motif){
 const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
 const quality=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'')?'minor':'major';
 const density=session.density??1,color=session.color??1;
 const {add,finish}=createSceneWriter(INDIE_ID,doc,session,preserved,motif.map(n=>({...n,id:`${INDIE_ID}-motif-${n.id}`})));
 for(let bar=0;bar<4;bar++){
  const base=16*bar,odd=bar%2===1,last=bar===3,space=session.scene_variant==='space'&&odd,answer=session.scene_variant==='answer'&&last;
  const phrase=[.96,1,.94,1][bar];
  for(const step of density===0?[0,8]:odd?[0,6,8]:[0,7,10])add('drums','kick',base+step,36,.65,.14*phrase);
  for(const step of [4,12])add('drums','snare',base+step,38,.65,.12*phrase);
  const hats=space||density===0?[6,14]:[2,6,10,14];
  if(density>=3&&!space)hats.push(0,8);
  for(const step of hats){const open=density===4&&last&&step===14;add('drums',open?'hat_open':'hat_closed',base+step,open?46:42,.3,(step===2||step===10?.04:.025)*phrase);}
  const bassTimes=[0,6,8,14],bassGates=[5,1.5,4,1.5];
  for(let i=0;i<4;i++){
   const step=bassTimes[i];if((space||density===0)&&step!==0&&step!==8)continue;if(density===1&&step===6)continue;
   add('bass','clean_bass',base+step,fold(BASS[quality][bar][i]+root,36,55),bassGates[i],NATIVE_SCENE_BASS_LEVEL*phrase);
  }
  if(doc.auto_harmony_stabs)continue;
  const steps=last?[0,3,6,14]:[0,3,6,8,11,14];
  const pitches=[...INDIE_GUITAR[quality][bar]];
  if(color===1)pitches[0]+=12;
  if(color===2)pitches[pitches.length-1]-=12;
  if(color===3)[pitches[1],pitches[2]]=[pitches[2],pitches[1]];
  if(color===4)pitches[2]=pitches[0]+12;
  if(answer)[pitches[2],pitches[pitches.length-1]]=[pitches[pitches.length-1],pitches[2]];
  for(let i=0;i<steps.length;i++){
   const step=steps[i];if((space||density===0)&&![0,6,14].includes(step))continue;
   if(density===1&&![0,3,6,14].includes(step))continue;
   let gate=({0:3.5,3:3.5,6:3,8:3.5,11:3.5,14:2})[step];
   if(space&&(step===0||step===14))gate=step===0?2:1;
   if(answer&&step===6)gate=2;
   const accent=(last?[1,.78,.88,.92]:[1,.78,.88,.72,.82,.92])[i];
   add('harmony','sampled_clean_guitar_v1',base+step,fold(pitches[i]+root,48,84),gate,.3*accent*phrase);
  }
 }
 return finish();
}
