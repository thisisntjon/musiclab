import {createSceneWriter} from './scene_writer.js';
import {sceneHarmonyLevel} from './scene_voice_levels.js';

export const SOUL_TIMING_IDS=Object.freeze(['boom-bap-v1','trip-hop-v1','neo-soul-v1']);
export const NEO_SHELLS=Object.freeze({major:[[64,71,74],[60,67,71],[57,64,67],[59,65,69]],
  minor:[[63,70,74],[60,67,70],[56,63,67],[58,62,65]]});
const fold=(pitch,low,high)=>{while(pitch<low)pitch+=12;while(pitch>high)pitch-=12;return pitch;};

// Original instrumental scores. No record chopping, vinyl texture, uniform
// input delay or unrecorded sound automation is implied by these names.
export function soulTimingBacking(doc,session,preserved,motif){
  const id=session.scene_id,boom=id==='boom-bap-v1',trip=id==='trip-hop-v1';
  if(!SOUL_TIMING_IDS.includes(id))throw Error('Unsupported soul timing recipe.');
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9,roots=[0,sixth,5,7];
  const triads=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]];
  const density=session.density??1,color=session.color??1;
  const colors=boom?['sampled_electric_piano_v1','sampled_piano_v1','sampled_guitar_v1','sampled_electric_piano_v1','sampled_piano_v1']:
    trip?['sampled_electric_piano_v1','warm_keys','sampled_piano_v1','sampled_guitar_v1','warm_keys']:
    ['sampled_electric_piano_v1','sampled_electric_piano_v1','sampled_piano_v1','sampled_guitar_v1','sampled_electric_piano_v1'];
  const patch=colors[color],level=sceneHarmonyLevel(patch);
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
    const answer=session.scene_variant==='answer'&&bar===3,phrase=[.92,1,.96,1.04][bar];
    const localThird=bar===1?(minor?4:3):third;
    const kicks=boom?(density===0?(odd?[0,8]:[0,10]):odd?[0,7,8,14]:[0,5.5,10]):trip?(odd?[2,9.5]:[0,10]):odd?[0,7,11]:[0,6,10];
    for(const step of kicks)add('drums','kick',base+step,36,1,.15*phrase);
    for(const step of boom||trip?[4,12]:[4.125,12.125])add('drums','snare',base+step,38,.9,.13*phrase);
    if(boom){
      if(density>=1)for(const step of [0,2,4,6,8,10,12,14])add('drums','hat_closed',base+step,42,.4,(step%4?.03:.045)*phrase);
      if(density>=2)add('drums','snare',base+(answer?14.5:odd?11:3.5),38,.4,.13*(odd?.28:.22)*phrase);
      if(density>=3&&odd&&!space)for(const step of [7.25,15.25])add('drums','hat_closed',base+step,42,.3,.02*phrase);
    }else if(trip){
      if(density>=1)for(const step of odd?(space?[0,6]:[0,6,12]):[2,6,10,14])add('drums','hat_closed',base+step,42,.4,.035*phrase);
      if(density>=3&&odd)add('drums','snare',base+15,38,.4,.03*phrase);
      if(density===4&&bar===3)add('drums','perc',base+7,45,.4,.025*phrase);
    }else{
      const hats=density>=3?[0,2.25,4,6.25,8,10.25,12,14.25]:[0,4,8,12];
      for(const step of hats)add('drums','hat_closed',base+step,42,.4,(step%1?.025:.045)*phrase);
    }
    let bass=boom?(odd?[[0,0,1.5],[8,localThird,1.5],[14,7,1]]:[[0,0,1.5],[5.5,7,1],[10,0,1.5]]):
      trip?(odd?[[1.5,0,6],[11.5,localThird,3.5]]:[[2,0,5],[10,7,4]]):
      odd?[[1,0,3.5],[7,7,2],[12.5,localThird,2.5]]:[[0,0,3],[6.25,localThird,2],[11,7,3]];
    if(density===0&&!trip)bass=boom?(odd?[[0,0,1.5],[8,localThird,1.5]]:[[0,0,1.5],[10,0,1.5]]):[bass[0]];
    for(const [step,pitch,gate] of bass)add('bass','sampled_bass_v1',base+step,fold(36+root+roots[bar]+pitch,36,55),gate,.37*phrase);
    if(doc.auto_harmony_stabs)continue;
    const inversion=color%3;
    let chord=boom||trip?triads[bar].map((_,i)=>48+root+triads[bar][(i+inversion)%3]+(i+inversion>=3?12:0)+(color>=3?12:0)):
      NEO_SHELLS[minor?'minor':'major'][bar].map((_,i)=>NEO_SHELLS[minor?'minor':'major'][bar][(i+inversion)%3]+root+(i+inversion>=3?12:0)+(color===4?12:0));
    chord=chord.map(p=>fold(p,48,boom||trip?83:88));
    if(answer&&!trip)chord=[...chord.slice(1),chord[0]+12<=88?chord[0]+12:chord[0]-12];
    if(boom){
      const attacks=space||density<2?[0,8]:bar===3?[0,3,8]:[0,3,8,11];
      if(density===4&&bar===3&&!space)attacks.push(15);
      for(const step of attacks)for(const pitch of chord)add('harmony',patch,base+step,pitch,space?.75:step%8===0?1.25:.5,level*phrase);
    }else if(trip){
      for(const pitch of odd?[chord[1],chord[2]]:[chord[0],chord[2]])add('harmony',patch,base+(odd?4:0),pitch,space?4:odd?7:9,level*phrase);
      // At sparse density Answer introduces the reply; with an existing reply
      // it replaces 14 with 13/15. It never duplicates the original attack.
      if(odd&&((density>=2&&!space)||answer))for(const [i,step] of (answer?[13,15]:[14]).entries())add('harmony','sampled_piano_v1',base+step,fold(chord[i]+12,60,83),answer?.6:1.2,.22*phrase);
    }else{
      const starts=odd?[1.25,10.25]:[.25,9.25];
      for(const [i,step] of (space||density<2?[starts[0]]:starts).entries())for(const pitch of chord)add('harmony',patch,base+step,pitch,space?3.5:i?4.5:odd?6:5.5,level*.85*phrase);
      if(density===4&&bar===3&&!space)add('harmony','sampled_guitar_v1',base+14.5,fold(chord[1]+12,60,83),.8,.24*phrase);
    }
  }
  return finish();
}
