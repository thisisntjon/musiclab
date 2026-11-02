import {bassInterval} from './underneath.js';

export const CONTRAST_PROFILES=Object.freeze(['Offbeat strum','Pop backbeat','Syncopated funk','Dance pulse'].map((name,index)=>Object.freeze({id:`contrast-${index}`,name})));

/** Original four-bar composition. Styles are arrangement choices, not a genre taxonomy.
 * Only the listening entry opts in; old documents retain their existing generator.
 * Each role has one owner at intermediate positions, avoiding two competing grooves.
 */
export function showcaseBacking(doc, session, preserved) {
  const position=Math.max(0,Math.min(3,Number(session.style_spectrum)||0));
  const low=Math.floor(position), high=Math.min(3,low+1), fraction=position-low;
  const owner=role=>fraction >= ({drums:.25,bass:.5,harmony:.75}[role]??1) ? high : low;
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4, sixth=minor?8:9;
  const sampled=session.showcase_palette==='sampled';
  const contrast=session.showcase_arrangement==='contrast-v1';
  const notes=[];
  const add=(role,patch,step,pitch,duration,velocity,offset=0)=>{
    const note={id:`showcase-v1-${role}-${patch}-${step}-${pitch}`,role,patch_id:patch,step,
      duration_steps:duration,velocity,concrete:{midi_pitch:pitch},pitch_lock_mode:'concrete',
      provenance:'jam_generated',generated_by:'musiclab_jam',
      performance:{version:1,offset_steps:offset},
      ...(role==='drums'?{drum_kit:session.kit||'soft'}:{}),
      ...(role==='harmony'?{voiced_freqs:[440*2**((pitch-69)/12)]}:{})};
    const [start,end]=bassInterval(note,doc);
    if(preserved.some(own=>own.role===role && (role==='drums'
      ? own.patch_id===patch && own.step===step
      : (()=>{const [a,b]=bassInterval(own,doc);return start<b&&a<end;})())))return;
    notes.push(note);
  };
  // Close voice-leading: Cmaj7 / Am7 / Fmaj7 / Gsus -> G in the major form.
  const chords=[[0,third,7,11],[0,third,7,sixth],[0,5,sixth,12],[2,7,12,14]];
  const bassRoots=[0,sixth,5,7];
  const density=Math.max(0,Math.min(4,session.density??1));
  for(let bar=0;bar<4;bar++) {
    const base=bar*16,d=owner('drums'),b=owner('bass'),h=owner('harmony');
    const space=session.scene_variant==='space'&&bar%2===1;
    const phrase=contrast?[.92,1,.96,1.05][bar]:1;
    const kicks=(contrast?[[8],[0,8,10],[0,3,6,10],[0,4,8,12]]:[[0,7,10],[0,8,10],[0,6,10],[0,4,8,12]])[d];
    for(const step of kicks)if(!space||step===kicks[0])add('drums','kick',base+step,36,1,contrast?(step%8===0?.2:.14)*phrase:.48);
    const snares=contrast?(d===0?[8]:d===2?[4,11,12]:[4,12]):[4,12];
    for(const step of snares)add('drums',d===3?'clap':'snare',base+step,38,1,contrast?(step===11?.06:step===12?.18:.16)*phrase:.3);
    const hats=space||density===0?[2,10]:density===1?[2,6,10,14]:density===2?[0,2,6,8,10,14]:[0,2,4,6,8,10,12,14];
    for(const step of hats)add('drums','hat_closed',base+step,42,.5,contrast?(step%8===6?.11:step%4===2?.08:.04)*phrase:step%4===2?.17:.09,d===0?.12:0);
    if(density===4&&!space)for(const step of [3,11])add('drums','perc',base+step,45,.5,.14);
    if(session.scene_variant==='answer'&&bar===3)add('drums','perc',base+15,45,.5,.2);
    const bassSteps=space?[contrast&&b===0?2:0]:(contrast?[[2,7,10],[0,8],[0,3,6,10,14],[0,4,8,12]]:[[0,7,10],[0,8],[0,3,6,10,14],[0,4,8,12]])[b];
    for(const step of bassSteps)add('bass',sampled?'sampled_bass_v1':'clean_bass',base+step,
      36+root+bassRoots[bar]+(b===2&&step===14?7:0),b===0?(step===0?5:2):b===1?6:1.5,contrast?(step===bassSteps[0]?.4:.33)*phrase:.36);
    const harmonySteps=space?[2]:(contrast?[[2,6,10,14],[0,8],[2,7,10,15],[2,6,10,14]]:[[0],[0,8],[2,6,10,14],[2,6,10,14]])[h];
    const color=session.color??1, bright=color>=3;
    const voice=([0,1,2,0,1][color]+(h>=2?1:0))%3;
    const patch=sampled?(contrast&&h===0&&color===1?'sampled_banjo_v1':['sampled_piano_v1','sampled_electric_piano_v1','sampled_guitar_v1'][voice]):['warm_keys','pluck_lead','supersaw_stab'][voice];
    if(!doc.auto_harmony_stabs)for(const step of harmonySteps)for(const [voiceIndex,interval] of chords[bar].entries())
      add('harmony',patch,base+step,48+root+(minor&&interval===11?10:interval)+(bright?12:0),contrast&&h===0?.65:h<2?5:.7,
        contrast?(step%8===6?.44:.38)*phrase:.105,contrast&&h===0?voiceIndex*.045:0);
    // The same singable contour stays in phase as the band changes; leave room to join.
    const motif=bar%2===0?[[2,7,2],[6,12,2],[10,14,3]]:[[2,12,2],[8,7,2],[12,bar===3?2:third,2]];
    for(const [step,pitch,duration] of motif)if(!space||step===2)
      add('lead',sampled?'sampled_piano_v1':'pluck_lead',base+step,60+root+pitch,duration,contrast?(step===2?.7:.58)*phrase:.28);
  }
  return notes.sort((a,b)=>a.step-b.step||a.id.localeCompare(b.id));
}
