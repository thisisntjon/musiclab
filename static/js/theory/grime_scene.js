import {createSceneWriter} from './scene_writer.js';
import {sceneHarmonyLevel,NATIVE_SCENE_BASS_LEVEL,GRIME_SCENE_LEVEL} from './scene_voice_levels.js';
export function grimeBacking(doc,session,preserved) {
 const root=doc.global_context?.root_pc||0,minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
 const third=minor?3:4,sixth=minor?8:9,roots=[0,sixth,5,7];
 const chords=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]];
 const density=session.density??1,color=session.color??1;
 const patch=['pluck_lead','supersaw_stab','sampled_electric_piano_v1','warm_keys','sampled_clean_guitar_v1'][color];
 const {add,finish}=createSceneWriter('grime-v1',doc,session,preserved);
 for(let bar=0;bar<4;bar++) {
  const at=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
  const answer=session.scene_variant==='answer'&&bar===3;
  for(const step of space?[0,14]:odd?[0,5,14]:[0,6,11])add('drums','kick',at+step,36,.5,step===0?.14:.095);
  for(const step of odd?[7,12]:[4,11])add('drums','snare',at+step,38,.5,.12);
  if(answer)add('drums','snare',at+15,38,.25,.045);
  const hats=density===0?[2]:odd?[2,6,14]:[2,10];
  for(const step of hats)add('drums','hat_closed',at+step,42,.25,.028);
  if(density>=3)add('drums','perc',at+3,45,.25,.022);
  if(density===4&&!space)add('drums','hat_closed',at+15,42,.25,.02);
  const bass=36+(root+roots[bar])%12;
  for(const [step,gate] of space?[[0,1],[14,.5]]:odd?[[0,1],[5,.75],[14,.5]]:[[0,1.25],[6,.5],[13,.75]])
   add('bass','clean_bass',at+step,bass+(step>=13?7:0),gate,NATIVE_SCENE_BASS_LEVEL);
  if(!doc.auto_harmony_stabs)for(const interval of [chords[bar][0],chords[bar][2]])
   add('harmony',patch,at+(odd?9:2),(patch==='sampled_clean_guitar_v1'?60:48)+(root+interval)%12,.4+density*.15,sceneHarmonyLevel(patch));
  if(odd)for(const [i,step] of [2,14].entries())
   add('lead','sampled_electric_piano_v1',at+step,60+(root+(bar===3&&i===1?7:chords[bar][i]))%12,1,.45);
 }
 return finish().map(note=>({...note,velocity:note.velocity*GRIME_SCENE_LEVEL}));
}
