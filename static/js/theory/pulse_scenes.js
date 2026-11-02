import {createSceneWriter} from './scene_writer.js';
import {NATIVE_SCENE_BASS_LEVEL,sceneHarmonyLevel} from './scene_voice_levels.js';

export const PULSE_SCENE_IDS=Object.freeze(['reggae-v1','house-v1','electro-v1']);

/** Original bounded instrumental recipes. These share timing and preservation,
 * not a universal rhythm. No organ/808/vocoder or recorded repertoire claim.
 */
export function pulseBacking(doc,session,preserved,motif){
  const id=session.scene_id;
  if(!PULSE_SCENE_IDS.includes(id))throw Error('Unsupported pulse recipe.');
  const reggae=id==='reggae-v1',house=id==='house-v1';
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const chords=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],roots=[0,sixth,5,7];
  const density=session.density??1,color=session.color??1;
  const colors=reggae?['sampled_guitar_v1','sampled_electric_piano_v1','sampled_banjo_v1','sampled_piano_v1','sampled_electric_piano_v1']:
    house?['sampled_electric_piano_v1','sampled_piano_v1','sampled_banjo_v1','sampled_guitar_v1','sampled_piano_v1']:
    ['warm_keys','pluck_lead','sampled_electric_piano_v1','supersaw_stab','warm_keys'];
  const patch=colors[color],electronic=!reggae&&!house;
  // Native voices use the existing processed synth bus, not the sampled bus.
  // These recipe velocities were calibrated with matched offline role renders.
  const harmonyLevel=electronic?sceneHarmonyLevel(patch):.3;
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,phrase=[.92,1,.96,1.05][bar];
    const space=session.scene_variant==='space'&&odd,answer=session.scene_variant==='answer'&&bar===3;
    const chordThird=bar===1?(minor?4:3):third;
    const kicks=reggae?[8]:house?[0,4,8,12]:odd?[0,3,answer?14:10]:[0,6,11];
    for(const step of kicks)add('drums','kick',base+step,36,1,(step%8===0?.17:.13)*phrase);
    for(const step of reggae?[8]:[4,12])add('drums',house?'clap':'snare',base+step,38,1,.14*phrase);
    const hats=space?[6,14]:[[6,14],[2,6,10,14],[0,2,6,8,10,14],[0,2,4,6,8,10,12,14],[0,2,3,4,6,8,10,11,12,14]][density];
    for(const step of hats)add('drums',house&&step%4===2?'hat_open':'hat_closed',base+step,42,.5,(step%4===2?.075:.035)*phrase);
    let bass;
    if(reggae)bass=odd?[[0,0,3],[6,chordThird,2],[11,7,1.5],[14,chordThird,1]]:[[0,0,2.5],[3,7,.75],[6,chordThird,2],[10,0,4]];
    else if(house)bass=[[2,0,1.5],[6,7,1.5],[10,12,1.5],[14,answer?chordThird:0,1.5]];
    else bass=odd?[[0,0,1],[6,12,.75],[9,7,1],[15,chordThird,.75]]:[[0,0,1.5],[3,12,.75],[7,7,1],[10,chordThird,1],[14,0,.75]];
    if(answer&&!house)bass=bass.map(([step,interval,gate],i)=>[step,bass[bass.length-1-i][1],gate]);
    if(space&&!house)bass=bass.filter((_,i)=>i!==bass.length-1);
    for(const [step,interval,gate] of bass)add('bass',electronic?'clean_bass':'sampled_bass_v1',base+step,36+root+roots[bar]+interval,gate,(electronic?NATIVE_SCENE_BASS_LEVEL:step===bass[0][0]?.44:.36)*phrase);
    if(!doc.auto_harmony_stabs){
      const steps=reggae?[2,6,10,14]:house?(odd?[2,8,answer?15:14]:[0,6,12]):odd?[3,12]:[0,10];
      for(const step of space?steps.slice(0,2):steps)for(const [voice,pitch] of chords[bar].entries())
        add('harmony',patch,base+step,48+root+pitch+(color===4?12:0),reggae?.65:house?1.25:.75,harmonyLevel*phrase,voice*.025);
      // Alternating keyboard replies create a separate interlocking cycle.
      if(reggae&&odd&&!space&&density>0)for(const step of density===1?[3,11]:[1,3,9,11])
        add('harmony',patch,base+step,60+root+chords[bar][answer?2:1]+(color===4?12:0),.5,.21*phrase);
    }
  }
  return finish();
}
