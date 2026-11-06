import {createSceneWriter} from './scene_writer.js';
import {sceneHarmonyLevel} from './scene_voice_levels.js';

export const TIMING_SCENE_IDS=Object.freeze(['uk-garage-v1','two-step-v1','breakbeat-v1']);

// Original fixed-tempo groove interpretations: no copied breaks, recorded
// vocal chops or tempo changes. Explicit offsets are part of the editable score.
export function timingBacking(doc,session,preserved,motif){
  const id=session.scene_id;
  if(!TIMING_SCENE_IDS.includes(id))throw Error('Unsupported timing recipe.');
  const garage=id==='uk-garage-v1',two=id==='two-step-v1';
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const triads=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],roots=[0,sixth,5,7];
  const density=session.density??1,color=session.color??1;
  const colors=garage?['sampled_piano_v1','sampled_electric_piano_v1','sampled_guitar_v1','sampled_electric_piano_v1','sampled_piano_v1']:
    ['sampled_piano_v1','sampled_electric_piano_v1','warm_keys','sampled_guitar_v1','sampled_electric_piano_v1'];
  const patch=colors[color],octave=color>=3?12:0,inversion=color%3;
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
    const answer=session.scene_variant==='answer'&&bar===3,phrase=[.92,1,.96,1.05][bar];
    const localThird=bar===1?(minor?4:3):third;
    const chord=triads[bar].map((_,i)=>triads[bar][(i+inversion)%3]+(i+inversion>=3?12:0));
    const kicks=garage?[0,4,8,12]:two?(odd?[0,6,14]:[0,7,10]):density===0?(odd?[0,9]:[0,8]):odd?[0,6,9,14]:[0,3,8,10.5];
    for(const step of kicks)add('drums','kick',base+step,36,1,.15*phrase);
    for(const step of [4,12])add('drums',garage?'clap':'snare',base+step,38,1,.13*phrase);
    if(garage){
      if(density>=1){
        for(const step of [2,10])add('drums','hat_open',base+step,46,.6,.04*phrase);
        for(const step of [6,14])add('drums','hat_closed',base+step,42,.5,.055*phrase);
      }
      if(density>=3)for(const step of space?[3.5,11.5]:[3.5,7.5,11.5,15.5])add('drums','hat_closed',base+step,42,.4,.02475*phrase);
      if(density===4&&bar===3)add('drums','perc',base+15,45,.4,.03*phrase);
    }else if(two){
      if(density>=1)for(const step of [2,6,10,14])add('drums','hat_closed',base+step,42,.5,.05*phrase);
      if(density>=3&&!space)for(const step of odd?[7.5,15.5]:[3.5,11.5])add('drums','hat_closed',base+step,42,.4,.025*phrase);
      if(density===4&&odd)add('drums','perc',base+(bar===1?5.5:13.5),45,.4,.035*phrase);
    }else{
      if(density>=2)for(const step of space?[0,2,8,10]:[0,2,4,6,8,10,12,14])add('drums',density>=3&&[6,14].includes(step)?'hat_open':'hat_closed',base+step,density>=3&&[6,14].includes(step)?46:42,.5,([2,10].includes(step)?.06:.035)*phrase);
      let ghosts=density<2?[]:density===2?(odd?[10]:[7]):odd?[3,10,15.5]:[7,11];
      if(space&&ghosts.length)ghosts=[ghosts[0]];
      if((answer||density===4)&&bar===3)ghosts=[14.5,15.5];
      for(const [i,step] of ghosts.entries())add('drums','snare',base+step,38,.5,.13*(i%2?.2:.3)*phrase);
    }
    let bass=garage?(odd?[[0,0,1],[6,0,1],[9.5,7,.75],[14,answer?localThird:0,1]]:[[0,0,1],[5.5,7,.75],[8,0,1],[13.5,localThird,.75]]):
      two?(odd?[[2,0,1.5],[9.5,localThird,1],[answer?13.5:13,7,1.5]]:[[1.5,0,1],[6,7,.75],[11.5,0,1.5]]):
      odd?[[0,0,4],[9,localThird,2],[14,7,1]]:[[0,0,3],[6,7,1],[10.5,0,2]];
    if(garage&&density<2)bass=[[0,0,1],[8,answer?localThird:0,1]];
    if(two&&density<2)bass=bass.filter((_,i)=>i!==1);
    for(const [step,pitch,gate] of bass)add('bass','sampled_bass_v1',base+step,36+root+roots[bar]+pitch,gate,(step===0?.4:.34)*phrase);
    if(doc.auto_harmony_stabs)continue;
    let attacks=garage?(density===0?[2.5,10.5]:odd?[2.5,9.5,14.5]:[2.5,6.5,10.5]):two?(odd?[3,answer?11.5:11]:[1,9]):odd?[2,12]:[0,10];
    if(space)attacks=garage?[attacks[0],attacks.at(-1)]:[attacks[0]];
    if(garage&&answer)attacks=[...attacks,15.5];
    const pitches=garage||two?[chord[1],chord[2]]:chord;
    for(const step of attacks)for(const pitch of pitches){
      const gate=garage?(step===15.5?.4:.65):two?.8:step===attacks[0]?(odd?5:6):answer?1:(odd?2:3);
      add('harmony',patch,base+step,48+root+pitch+octave,gate,sceneHarmonyLevel(patch)*phrase);
    }
    if(two&&bar===3)add('harmony',patch,base+14.5,60+root+roots[bar]+7,.5,sceneHarmonyLevel(patch)*.8*phrase);
  }
  return finish();
}
