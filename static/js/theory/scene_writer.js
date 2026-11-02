import {bassInterval} from './underneath.js';

/** Shared generated-note contract. Musical choices stay in each recipe. */
export function createSceneWriter(sceneId,doc,session,preserved,initial=[]){
  const notes=[...initial];
  const ids=new Set(notes.map(note=>note.id));
  if(ids.size!==notes.length)throw Error('Duplicate generated note identity.');
  const add=(role,patch,position,pitch,duration,velocity,offset=0)=>{
    if(!['drums','bass','harmony','lead'].includes(role)||!patch||
      ![position,pitch,duration,velocity,offset].every(Number.isFinite)||
      position<0||offset<0||pitch<0||pitch>127||duration<=0||velocity<0||velocity>1)
      throw Error('Unsupported generated note. Your notes are unchanged.');
    const whole=Math.floor(position),fraction=position-whole+offset;
    const step=whole+Math.floor(fraction),remainder=fraction-Math.floor(fraction);
    const note={id:`${sceneId}-${role}-${patch}-${position}-${pitch}`,role,patch_id:patch,step,
      duration_steps:duration,concrete:{midi_pitch:pitch},pitch_lock_mode:'concrete',velocity,
      performance:{version:1,offset_steps:remainder},provenance:'jam_generated',generated_by:'musiclab_jam',
      ...(role==='drums'?{drum_kit:session.kit||'soft'}:{}),
      ...(role==='harmony'?{voiced_freqs:[440*2**((pitch-69)/12)]}:{})};
    const [a,b]=bassInterval(note,doc);
    if(preserved.some(own=>own.role===role&&(role==='drums'?own.patch_id===patch&&own.step===step:
      (()=>{const [c,d]=bassInterval(own,doc);return a<d&&c<b;})())))return;
    // Repeated pitches at distinct times must use distinct (possibly fractional)
    // positions. Explicit offset is articulation, not a second identity channel.
    if(ids.has(note.id))throw Error('Duplicate generated note identity. Use a distinct position.');
    ids.add(note.id);
    notes.push(note);
    return note;
  };
  return {add,finish:()=>notes.sort((a,b)=>a.step-b.step||a.id.localeCompare(b.id))};
}
