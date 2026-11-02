import {createSceneWriter} from './scene_writer.js';

export const HOUSE_ROOTS_IDS=Object.freeze(['deep-house-v1','tech-house-v1','old-time-v1','honky-tonk-v1']);

/** Original keys-led house and plucked/piano roots interpretations. No recorded
 * breaks, fiddle, steel guitar or authentic clawhammer articulation is claimed.
 */
export function houseRootsBacking(doc,session,preserved,motif){
  const id=session.scene_id;
  if(!HOUSE_ROOTS_IDS.includes(id))throw Error('Unsupported house/roots recipe.');
  const deep=id==='deep-house-v1',tech=id==='tech-house-v1',old=id==='old-time-v1';
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const triads=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],roots=[0,sixth,5,7];
  const sevenths=minor?[10,7,3,5]:[11,7,4,5],density=session.density??1,color=session.color??1;
  const colors=old?['sampled_guitar_v1','sampled_banjo_v1','sampled_piano_v1','sampled_electric_piano_v1','sampled_banjo_v1']:
    ['sampled_guitar_v1',deep||tech?'sampled_electric_piano_v1':'sampled_piano_v1','sampled_banjo_v1',deep||tech?'sampled_piano_v1':'sampled_electric_piano_v1',deep||tech?'sampled_electric_piano_v1':'sampled_piano_v1'];
  const patch=colors[color],octave=color===4?12:0;
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,phrase=[.92,1,.96,1.05][bar];
    const space=session.scene_variant==='space'&&odd,answer=session.scene_variant==='answer'&&bar===3;
    const chordThird=bar===1?(minor?4:3):third;
    if(!old){
      for(const step of deep||tech?[0,4,8,12]:[0,8])add('drums','kick',base+step,36,1,.15*phrase);
      for(const step of [4,12])add('drums',deep||tech?'clap':'snare',base+step,38,1,.12*phrase);
      const straight=[[6,14],[2,6,10,14],[0,2,6,8,10,14],[0,2,4,6,8,10,12,14],[0,2,3,4,6,8,10,11,12,14]][density];
      const hats=space?[6,14]:straight;
      for(const step of hats){
        // Honky-tonk's late eighths are 2/3 of a beat; house variants use a
        // smaller explicit displacement, never an assumed global-swing setting.
        const position=deep||tech?step+(step%4===2?.25:0):step+(step%4===2?2/3:0);
        add('drums','hat_closed',base+position,42,.5,(step%4===2?.065:.03)*phrase);
      }
      if(tech&&!space&&density>0)for(const step of odd?[3.25,11.25]:[7.25,15.25])add('drums','perc',base+step,45,.4,.035*phrase);
    }
    const bass=deep?[[2,0,2],[6,7,2],[10,answer?chordThird:0,2],[14,7,1.5]]:
      tech?[[0,0,1],[3.25,7,.75],[6,0,1],[8,0,1],[11.25,7,.75],[14,answer?7:0,1]]:
      [[0,0,3],[8,answer?chordThird:7,3]];
    for(const [step,pitch,gate] of bass)add('bass','sampled_bass_v1',base+step,36+root+roots[bar]+pitch,gate,(step===bass[0][0]?.43:.36)*phrase);
    if(doc.auto_harmony_stabs)continue;
    if(old){
      // A fixed fifth drone is intentional, including its tension over IV.
      // It is not an accidentally miscomputed local chord tone.
      for(const step of [0,8])add('harmony',patch,base+step,60+root+roots[bar]+octave,1,.42*phrase);
      const brush=space?[4]:[4,12];
      for(const step of brush)for(const [voice,pitch] of triads[bar].entries())add('harmony',patch,base+step,48+root+pitch+octave,.65,.4*phrase,voice*.035);
      for(const step of space?[6]:[6,14])add('harmony',patch,base+step,67+root+octave,.75,(answer&&step===14?.52:.38)*phrase);
      const extra=[[],[15],[7,15],[3,7,15],[3,7,11,15]][density];
      if(!space)for(const step of extra)add('harmony',patch,base+step,60+root+triads[bar][1]+octave,.5,.22*phrase);
    }else{
      const chord=deep?[...triads[bar],sevenths[bar]]:triads[bar];
      const attacks=deep?(space?[0]:[0,10]):tech?(space?[6.25]:[6.25,14.25]):space?[4]:[4,12];
      for(const step of attacks)for(const [voice,pitch] of chord.entries())add('harmony',patch,base+step,48+root+pitch+octave,deep?(step===0?6:4):tech?.6:.75,(deep?.29:tech?.3:.36)*phrase,voice*.025);
      if(!deep&&!tech&&!space&&density>0)for(const step of density===1?[14]:[6,14])add('harmony',patch,base+step,60+root+(answer?roots[bar]:triads[bar][1])+octave,.65,.24*phrase);
    }
  }
  return finish();
}
