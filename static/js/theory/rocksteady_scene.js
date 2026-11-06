import {createSceneWriter} from './scene_writer.js';

/** Original spacious, bass-led interpretation; fixed shared tempo, not a tempo slowdown. */
export function rocksteadyBacking(doc,session,preserved,motif){
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const chords=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],roots=[0,sixth,5,7];
  const density=session.density??1,color=session.color??1;
  const patches=['sampled_guitar_v1','sampled_electric_piano_v1','sampled_banjo_v1','sampled_piano_v1','sampled_electric_piano_v1'];
  const {add,finish}=createSceneWriter('rocksteady-v1',doc,session,preserved,motif.map(n=>({...n,id:`rocksteady-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,phrase=[.92,1,.96,1.05][bar],space=session.scene_variant==='space'&&bar%2===1;
    const answer=session.scene_variant==='answer'&&bar===3;
    const chordThird=bar===1?(minor?4:3):third;
    add('drums','kick',base,36,1,.13*phrase);
    if(!space)add('drums','kick',base+10,36,1,.08*phrase);
    for(const step of [4,12])add('drums','snare',base+step,38,1,(step===12?.15:.12)*phrase);
    const hats=space?[6,14]:[[6,14],[2,6,10,14],[2,6,10,12,14],[0,2,6,8,10,12,14],[0,2,4,6,8,10,12,14]][density];
    for(const step of hats)add('drums','hat_closed',base+step,42,.5,(step===6||step===14?.07:.035)*phrase);
    // The rests at4-6 and8-10 are intentional; density never fills this bass phrase.
    const bass=space?[[0,0,4],[10,7,3]]:[[0,0,4],[6,7,2],[10,answer?chordThird:0,3],[14,answer?0:chordThird,1]];
    for(const [step,interval,duration] of bass)add('bass','sampled_bass_v1',base+step,36+root+roots[bar]+interval,duration,(step===0?.48:.4)*phrase);
    if(!doc.auto_harmony_stabs)for(const step of space?[6,14]:[2,6,10,14]){
      for(const [voice,pitch] of chords[bar].entries())add('harmony',patches[color],base+step,48+root+pitch+(color===4?12:0),.8,(step===6||step===14?.29:.21)*phrase,voice*.025);
    }
  }
  return finish();
}
