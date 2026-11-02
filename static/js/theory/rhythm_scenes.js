import {createSceneWriter} from './scene_writer.js';
import {NATIVE_SCENE_BASS_LEVEL,sceneHarmonyLevel} from './scene_voice_levels.js';

export const RHYTHM_SCENE_IDS=Object.freeze(['techno-v1','minimal-techno-v1','hip-hop-v1','downtempo-v1']);

/** Original fixed-clock interpretations: rolling cells, interacting cycles,
 * explicit displaced pickups, and spacious sustained contrast respectively.
 */
export function rhythmBacking(doc,session,preserved,motif){
  const id=session.scene_id;
  if(!RHYTHM_SCENE_IDS.includes(id))throw Error('Unsupported rhythm recipe.');
  const techno=id==='techno-v1',minimal=id==='minimal-techno-v1',hiphop=id==='hip-hop-v1';
  const electronic=techno||minimal;
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const chords=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],roots=[0,sixth,5,7];
  const density=session.density??1,color=session.color??1;
  const colors=electronic?['warm_keys','pluck_lead','sampled_electric_piano_v1','supersaw_stab','warm_keys']:
    hiphop?['sampled_piano_v1','sampled_electric_piano_v1','sampled_guitar_v1','sampled_banjo_v1','sampled_electric_piano_v1']:
    ['sampled_electric_piano_v1','warm_keys','sampled_banjo_v1','sampled_piano_v1','warm_keys'];
  const patch=colors[color],level=sceneHarmonyLevel(patch);
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,phrase=[.92,1,.96,1.05][bar];
    const space=session.scene_variant==='space'&&odd,answer=session.scene_variant==='answer'&&bar===3;
    const chordThird=bar===1?(minor?4:3):third;
    const kicks=electronic?[0,4,8,12]:hiphop?(odd?[0,6,13]:[0,7,10]):odd||space?[0]:[0,11];
    for(const step of kicks)add('drums','kick',base+step,36,1,(step%8===0?.16:.12)*phrase);
    for(const step of electronic||hiphop?[4,12]:[8])add('drums',electronic?'clap':'snare',base+step,38,1,(minimal?.07:.13)*phrase);
    const hats=space?[6,14]:[[6,14],[2,6,10,14],[2,4,6,10,12,14],[0,2,4,6,8,10,12,14],[0,2,3,4,6,8,10,11,12,14]][density];
    for(const step of hats)add('drums','hat_closed',base+step,42,.5,(minimal?.035:step%4===2?.065:.025)*phrase);
    if(techno&&!space)for(const step of odd?[1,7,9,15]:[3,7,11,15])add('drums','perc',base+step,45,.5,(step===7?.055:.03)*phrase);
    if(hiphop&&!space&&density>0)for(const step of odd?[7.25,15.25]:[3.25,11.25])add('drums','hat_closed',base+step,42,.4,.04*phrase);
    let bass;
    if(techno)bass=[1,2,5,6,9,10,13,14].filter((_,i)=>!space||i%2===0).map((step,i)=>[step,answer&&step===14?7:0,i%2===0?.5:.75]);
    else if(minimal)bass=[[2,0,1.5],[10,answer?7:0,.75]];
    else if(hiphop)bass=odd?[[0,0,2],[6,answer?chordThird:7,3]]:[[0,0,2],[7,7,1],[10,chordThird,3]];
    else bass=[[0,0,6],[10,answer?chordThird:7,4]];
    for(const [step,pitch,gate] of bass)add('bass',electronic?'clean_bass':'sampled_bass_v1',base+step,36+root+roots[bar]+pitch,gate,(electronic?NATIVE_SCENE_BASS_LEVEL:hiphop?.4:.38)*phrase);
    if(doc.auto_harmony_stabs)continue;
    if(minimal){
      const cell=[[1,7,10],[2,8,11],[3,9,12],[0,6,9]][bar];
      for(const [i,step] of cell.entries())if(!space||i<2){
        const pitch=roots[bar]+(i===1?7:0),accent=(answer?2-i:i)===0?1:.72;
        add('harmony',patch,base+step,60+root+pitch+(color===4?12:0),[.35,.55,.85,.55][bar],Math.min(.99,level*1.6*accent));
      }
    }else{
      const steps=techno?[3,11,...(answer?[15]:[])]:hiphop?(odd?[2,10]:[0,9]):[0,...(space?[]:[12])];
      for(const step of space&&hiphop?steps.slice(0,1):steps){
        const voices=techno?[roots[bar],roots[bar]+7]:!hiphop&&step===12?chords[bar].slice(answer?1:0,answer?3:2):chords[bar];
        for(const [voice,pitch] of voices.entries())add('harmony',patch,base+step,48+root+pitch+(color===4?12:0),techno?.65:hiphop?(step<4?3.5:2):step===0?11:2,level*phrase,voice*.025);
      }
    }
  }
  return finish();
}
