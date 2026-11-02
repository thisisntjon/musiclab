import {createSceneWriter} from './scene_writer.js';
import {sceneHarmonyLevel} from './scene_voice_levels.js';

export const RESPONSE_SCENE_IDS=Object.freeze(['new-wave-v1','early-rnb-v1','soul-v1']);

// Original instrumental interpretations. The existing shared four-bar harmony
// remains explicit: no twelve-bar, singing, electric-guitar or organ claim.
export function responseBacking(doc,session,preserved,motif){
  const id=session.scene_id;
  if(!RESPONSE_SCENE_IDS.includes(id))throw Error('Unsupported response recipe.');
  const wave=id==='new-wave-v1',rnb=id==='early-rnb-v1';
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const triads=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],roots=[0,sixth,5,7];
  const density=session.density??1,color=session.color??1;
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
    const answer=session.scene_variant==='answer'&&bar===3;
    const phrase=(wave||rnb?[.92,1,.96,1.05]:[.88,.96,.90,1])[bar];
    const localThird=bar===1?(minor?4:3):third;
    const kicks=wave?(odd?[0,8,14]:[0,6,8]):rnb?[0,6,8,14]:odd?[0,7,8]:[0,8,11];
    for(const step of kicks)add('drums','kick',base+step,36,1,(step===11?.09:.15)*phrase);
    for(const step of [4,12])add('drums','snare',base+step,38,1,.13*phrase);
    const hats=wave||rnb?[[0,4,8,12],[0,2,4,6,8,10,12,14]][density===0?0:1]:[2,6,10,14];
    for(const step of hats)add('drums','hat_closed',base+step,42,.5,(step%4===0?.055:.035)*phrase);
    if(density>=3&&odd&&!space)for(const step of [3,11])add('drums','perc',base+step,45,.4,.025*phrase);
    if(density===4&&bar===3)add('drums','hat_closed',base+15,42,.4,.025*phrase);
    let bass;
    if(wave){
      bass=[[0,0],[2,12],[4,0],[6,7],[8,0],[10,12],[12,7],[14,odd?localThird:0]];
      bass=bass.filter(([step])=>density>=2||step%4===0||(density===1&&[2,10].includes(step))).map(([step,pitch])=>[step,answer&&step===12?localThird:pitch,1.25]);
    }else if(rnb){
      bass=[[0,0,1.5],[3,localThird,.75],[4,7,2],[8,0,1.5],...(odd?[[10,7,1],[14,0,1.5]]:[[11,7,.75],[12,localThird,2]])];
      if(density===0)bass=[[0,0,1.5],[4,7,2],[8,0,1.5],[12,localThird,2]];
      else if(density===1)bass=bass.filter(([step])=>![10,11].includes(step));
      if(answer)bass=bass.map(([step,pitch,gate])=>[step,step>=12?7:pitch,gate]);
    }else bass=odd?[[0,0,3],[6,localThird,3],[11,answer?localThird:7,4]]:[[0,0,5],[7,7,2],[10,localThird,3]];
    for(const [step,pitch,gate] of bass)add('bass','sampled_bass_v1',base+step,36+root+roots[bar]+pitch,gate,(step===0?.4:.33)*phrase);
    if(doc.auto_harmony_stabs)continue;
    // Color changes voicing/register as well as optional synth color; these
    // are editable generated notes, never a transformation of personal notes.
    const inversion=color%3,octave=color>=3?12:0;
    const chord=triads[bar].map((_,i)=>triads[bar][(i+inversion)%3]+(i+inversion>=3?12:0));
    if(wave){
      for(const step of space||density===0?[3,11]:[3,7,11,15])for(const pitch of [chord[0],chord[2]])add('harmony','sampled_guitar_v1',base+step,48+root+pitch+octave,.55,.28*phrase);
      const patch=['warm_keys','pluck_lead','supersaw_stab','warm_keys','pluck_lead'][color];
      if(!space&&density>=2)for(const step of density>=3?[0,6,10]:[0,10])for(const pitch of [chord[0],chord[2]])add('harmony',patch,base+step,48+root+pitch+octave,1.5,sceneHarmonyLevel(patch)*.65*phrase);
    }else if(rnb){
      for(const step of [2,6])for(const pitch of [chord[1],chord[2]])add('harmony','sampled_piano_v1',base+step,48+root+pitch+octave,.75,.32*phrase);
      if(!space&&odd)for(const [i,step] of (density===0?[10]:density<4?[10,11,14]:[10,11,14,15]).entries())add('harmony','sampled_piano_v1',base+step,60+root+chord[answer?2-i%2:1+i%2]+octave,.55,.28*phrase);
      if(density>=3)for(const step of [0,8])for(const pitch of chord)add('harmony','sampled_guitar_v1',base+step,48+root+pitch,1.25,.16*phrase);
    }else{
      for(const step of space||density===0?[0]:[0,8])for(const pitch of chord)add('harmony','sampled_electric_piano_v1',base+step,48+root+pitch+octave,step===0?5:3,.26*phrase);
      // Upper guitar replies over the end of the keyboard bed, rather than
      // claiming strict alternation with a still-sounding supporting chord.
      if(odd&&!space)for(const [i,step] of (density<2?[14]:[10,14]).entries())for(const pitch of [chord[answer?i:1],chord[2]])add('harmony','sampled_guitar_v1',base+step,60+root+pitch,1,.23*phrase);
    }
  }
  return finish();
}
