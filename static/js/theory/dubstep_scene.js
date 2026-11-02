import {createSceneWriter} from './scene_writer.js';
import {NATIVE_SCENE_BASS_LEVEL} from './scene_voice_levels.js';
import {dubHarmony} from './phrase_harmony.js';
export function dubstepBacking(doc,session,preserved) {
 const root=doc.global_context?.root_pc||0,minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
 const roots=[0,minor?8:9,5,7],harmonic=dubHarmony(minor);
 const density=session.density??1,color=session.color??1;
 const {add,finish}=createSceneWriter('dubstep-v1',doc,session,preserved);
 for(let bar=0;bar<4;bar++) {
  const at=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
  const answer=session.scene_variant==='answer'&&bar===3;
  for(const step of space?[0]:odd?[0,6,14]:[0,11])add('drums','kick',at+step,36,.75,step===0?.16:.11);
  add('drums','snare',at+8,38,1,.15);
  for(const step of density===0||space?[2,10]:density<3?[2,6,10,14]:[0,2,6,9,10,14])
   add('drums','hat_closed',at+step,42,.3,step%4===2?.045:.025);
  if(density===4&&!space)add('drums','perc',at+15,45,.25,.025);
  const bass=36+(root+roots[bar])%12;
  add('bass','clean_bass',at,bass,space?10:6,NATIVE_SCENE_BASS_LEVEL);
  if(!space)add('bass','wobble_bass',at+(answer?10:9),bass+(answer?7:0),answer?5:6,.0036);
  if(!doc.auto_harmony_stabs)for(const interval of [harmonic.bars[bar][0],harmonic.bars[bar][2]])
   add('harmony','sampled_electric_piano_v1',at+(odd?4:0),48+(root+interval)%12,space?4:3+density,.25);
  if(bar%2===0)for(const [i,step] of [2,12].entries())
   add('lead','sampled_electric_piano_v1',at+step,60+(root+harmonic.bars[bar][i])%12,2,.48);
  if(bar===3)add('lead','sampled_electric_piano_v1',at+12,60+(root+7)%12,3,.4);
 }
 return finish().map(n=>n.patch_id==='wobble_bass'?{...n,gesture:{preset_id:'wobble_1_16',lfo_rate:['1/2','1/4','1/8','1/8t','1/16'][color]}}:n);
}
