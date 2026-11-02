import {createSceneWriter} from './scene_writer.js';

/** Original ska-inspired guitar-band sketch: upbeat chords and moving bass.
 * The shared motif is supplied by the showcase; no recorded song is copied.
 * Horn articulation and ska's different historical waves are not simulated.
 */
export function skaBacking(doc,session,preserved,motif){
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const chords=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]];
  const roots=[0,sixth,5,7],density=session.density??1,color=session.color??1;
  const patches=['sampled_piano_v1','sampled_guitar_v1','sampled_banjo_v1','sampled_electric_piano_v1','sampled_guitar_v1'];
  const {add,finish}=createSceneWriter('ska-v1',doc,session,preserved,motif.map(n=>({...n,id:`ska-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,phrase=[.92,1,.96,1.05][bar];
    const space=session.scene_variant==='space'&&bar%2===1;
    const answer=session.scene_variant==='answer'&&bar===3;
    for(const step of space?[0]:[0,8])add('drums','kick',base+step,36,1,.17*phrase);
    for(const step of [4,12])add('drums','snare',base+step,38,1,(step===12?.17:.14)*phrase);
    const hats=space?[2,10]:[[2,10],[0,2,4,6,8,10,12,14],[0,2,3,4,6,8,10,11,12,14],[0,2,3,4,6,7,8,10,11,12,14],[0,1,2,3,4,6,7,8,9,10,11,12,14,15]][density];
    for(const step of hats)add('drums','hat_closed',base+step,42,.5,(step%4===2?.085:.035)*phrase);
    const walk=[roots[bar],chords[bar][1],roots[bar]+7,roots[(bar+1)%4]+2];
    if(answer)walk.reverse();
    for(const beat of space?[0,2]:[0,1,2,3])add('bass','sampled_bass_v1',base+beat*4,36+root+walk[beat],2.6,(beat===0?.4:.32)*phrase);
    if(!doc.auto_harmony_stabs)for(const step of space||density===0?[6,14]:[2,6,10,14]){
      for(const [voice,pitch] of chords[bar].entries())add('harmony',patches[color],base+step,48+root+pitch+(color===4?12:0),.55,(step===6||step===14?.38:.31)*phrase,voice*.025);
    }
  }
  return finish();
}
