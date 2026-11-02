import {formBlockCount,selectedFormCursor,formScore} from './form_scenes.js';
import {setJamDirection} from './jam_session.js';
import {compileSongStandalone} from '../../ui/standalone_compiler.js';

// One cache per flow. Personal sources participate in the key so protection and
// optional replies are recomputed when the person edits, never on animation ticks.
export function createJamFormBuilder() {
 let cacheKey=null,program=null;
 return doc=>{
  const session=doc?.jam_session,count=formBlockCount(session?.scene_id);
  if(!count||session.anchor_backing||doc.captured_performance)return null;
  const {form_cursor,melodic_evolution,response,...settings}=session;
  const source={...doc,jam_session:settings,notes:(doc.notes||[]).filter(n=>!(n.provenance==='jam_generated'&&n.generated_by==='musiclab_jam'))};
  // UI state/cards do not affect the jam's four-bar material.
  const key=JSON.stringify([settings,source.notes,doc.global_context,doc.auto_harmony_stabs,doc.drum_kit]);
  if(key!==cacheKey) {
   const blocks=Array.from({length:count},(_,blockIndex)=>{
    let label='';
    const variants=Array.from({length:8},(_,cycle)=>{
     const next=setJamDirection({...source,arrangement_mode:'loop',song_cards:undefined,
      jam_session:{...settings,form_cursor:{id:session.scene_id,blockIndex,cycle}}});
     const score=formScore(next);label=score.label.replace(/ cycle \d+$/,'');
     const compiled=compileSongStandalone(next);
     return {harmony:score.harmony,...(score.mode?{mode:structuredClone(score.mode)}:{}),events:compiled.events.filter(e=>e.provenance==='jam_generated'&&e.generated_by==='musiclab_jam')};
    });
    return {label,variants};
   });
   program={version:1,id:session.scene_id,liveResponse:session.live_keys===true&&session.responsive===true,blocks};cacheKey=key;
  }
  return {...program,cursor:selectedFormCursor(session)};
 };
}
