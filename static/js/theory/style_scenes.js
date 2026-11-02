/** Original cyclic phrase variants, not a taxonomy of musical genres. */
export const SCENE_VARIANTS = Object.freeze([
  Object.freeze({id:'base',name:'Steady phrase'}),
  Object.freeze({id:'answer',name:'Answering phrase'}),
  Object.freeze({id:'space',name:'Room to play'}),
]);
export const SCENE_COMPATIBILITY = Object.freeze({version:1,stepsPerBar:16,cycleSteps:64,
  tuning:'12tet',harmony:'root-IV-V-root-triads-v1',tempo:'preserve-session',
  // Cyclic phrases can enter here without resetting the person's musical clock.
  entrySteps:Object.freeze([0,16,32,48])});
export function isSceneVariant(value) { return SCENE_VARIANTS.some(item=>item.id===value); }
export function sceneDescription(variant) { return SCENE_VARIANTS.find(item=>item.id===variant)?.name || 'Saved phrase'; }

/** Only generated profile backing enters this edit; personal events stay outside. */
export function arrangeScene(backing, profile, variant='base') {
  if (!isSceneVariant(variant)) throw Error('Unsupported phrase variation.');
  if (variant==='base') return backing;
  let notes=backing.map(note=>({...note,concrete:{...note.concrete},performance:{...note.performance}}));
  const inBar=(note,bar)=>Math.floor(note.step/16)===bar;
  const remove=(bar,predicate)=>{notes=notes.filter(note=>!inBar(note,bar)||!predicate(note,note.step%16));};
  const add=(bar,role,patch,step,change={})=>{
    if(notes.some(n=>inBar(n,bar)&&n.role===role&&n.patch_id===patch&&n.step%16===step))return;
    const template=backing.find(n=>inBar(n,bar)&&n.role===role&&n.patch_id===patch)||backing.find(n=>n.role===role&&n.patch_id===patch);
    if(template)notes.push({...template,concrete:{...template.concrete},performance:{...template.performance},step:bar*16+step,...change});
  };
  if(variant==='space')for(const bar of [1,3]) {
    remove(bar,(n,step)=>n.role==='bass' && (profile===3 ? ![0,8].includes(step) : profile===2 ? step===10 : step!==0));
    remove(bar,(n,step)=>n.role==='harmony' && !(profile===3?[2,10]:profile===2?[2,7]:profile===1?[0]:[1]).includes(step));
    remove(bar,(n,step)=>n.patch_id==='hat_closed' && ![2,10].includes(step));
  }
  if(variant==='answer') {
    if(profile===0) {
      for(const n of notes)if(inBar(n,1)&&n.step%16===7&&['kick','clean_bass'].includes(n.patch_id))n.step--;
      remove(3,(n,step)=>n.patch_id==='kick'&&step===10);add(3,'drums','kick',14,{velocity:.35});
      for(const n of notes)if(inBar(n,3)&&n.role==='bass'&&n.step%16===10){n.step+=4;n.duration_steps=1;}
    } else if(profile===1) {
      remove(1,(n,step)=>n.patch_id==='kick'&&step===10);add(3,'drums','kick',14,{velocity:.35});
      const bass=backing.find(n=>inBar(n,3)&&n.role==='bass');
      if(bass)add(3,'bass',bass.patch_id,14,{duration_steps:1.5,concrete:{midi_pitch:bass.concrete.midi_pitch+7},velocity:.32});
    } else if(profile===2) {
      for(const n of notes)if(inBar(n,1)&&n.role==='bass'&&n.step%16===14){n.step++;n.duration_steps=.75;}
      remove(3,(n,step)=>n.role==='harmony'&&[10,15].includes(step));add(3,'drums','hat_closed',15,{velocity:.13});
    } else {
      for(const n of notes)if(inBar(n,1)&&n.role==='bass'&&n.step%16===12)n.concrete.midi_pitch+=7;
      remove(3,(n,step)=>n.role==='harmony'&&step===14);add(3,'drums','hat_closed',15,{velocity:.13});
    }
  }
  return notes.map(note=>({...note,id:`scene-v1-${profile}-${variant}-${note.role}-${note.patch_id}-${note.step}-${note.concrete.midi_pitch}`,
    scene_version:1,scene_profile:profile,scene_variant:variant,generated_by:'musiclab_jam',provenance:'jam_generated'}));
}
