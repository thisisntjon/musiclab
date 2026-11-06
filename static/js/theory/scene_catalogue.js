import {FORM_SCENES,formBlockCount,formBacking} from './form_scenes.js';
import {rootsStudyBacking,ROOTS_STUDY_IDS} from './roots_study_scenes.js';
import {baltimoreBacking} from './baltimore_scene.js';
import {footworkBacking} from './footwork_scene.js';
import {grimeBacking} from './grime_scene.js';
import {dubstepBacking} from './dubstep_scene.js';
import {dooWopBacking} from './doo_wop_scene.js';
import {pianoResponseBacking} from './piano_response_scene.js';
import {indieBacking,INDIE_ID} from './indie_scene.js';
import {clubTrapBacking,CLUB_TRAP_IDS} from './club_trap_scenes.js';
import {showcaseBacking,CONTRAST_PROFILES} from './listening_showcase.js';
import {createSceneWriter} from './scene_writer.js';
import {skaBacking} from './ska_scene.js';
import {rocksteadyBacking} from './rocksteady_scene.js';
import {pulseBacking,PULSE_SCENE_IDS} from './pulse_scenes.js';
import {rhythmBacking,RHYTHM_SCENE_IDS} from './rhythm_scenes.js';
import {fastBreakBacking,FAST_BREAK_IDS} from './fast_break_scenes.js';
import {soulTimingBacking,SOUL_TIMING_IDS} from './soul_timing_scenes.js';
import {rootsTimingBacking,ROOTS_TIMING_IDS} from './roots_timing_scenes.js';
import {timingBacking,TIMING_SCENE_IDS} from './timing_scenes.js';
import {responseBacking,RESPONSE_SCENE_IDS} from './response_scenes.js';
import {houseRootsBacking,HOUSE_ROOTS_IDS} from './house_roots_scenes.js';

// Published entries are append-only: old saved IDs and numeric positions retain
// their meaning. A researched genre is NOT automatically a playable scene.
export const SCENE_CATALOGUE_VERSION='first-neighborhood-v1';
export const SCENE_MIX_VERSION='balanced-v1';
export const SCENE_CATALOGUE=Object.freeze([
  ...CONTRAST_PROFILES.map((profile,index)=>Object.freeze({...profile,legacyIndex:index,neighbors:[]})),
  Object.freeze({id:'bluegrass-v1',name:'Bluegrass inspired',neighbors:['contrast-0','contrast-1','contrast-2','ska-v1','old-time-v1','honky-tonk-v1','western-swing-v1','piedmont-v1','progressive-bluegrass-v1']}),
  Object.freeze({id:'ska-v1',name:'Ska inspired',neighbors:['contrast-0','contrast-1','bluegrass-v1','rocksteady-v1']}),
  Object.freeze({id:'rocksteady-v1',name:'Rocksteady inspired',neighbors:['contrast-0','contrast-1','ska-v1','reggae-v1','downtempo-v1']}),
  Object.freeze({id:'reggae-v1',name:'Reggae inspired',neighbors:['contrast-0','rocksteady-v1']}),
  Object.freeze({id:'house-v1',name:'House inspired',neighbors:['contrast-1','contrast-3','electro-v1','techno-v1','minimal-techno-v1','deep-house-v1','tech-house-v1','uk-garage-v1','jersey-club-v1']}),
  Object.freeze({id:'electro-v1',name:'Electro inspired',neighbors:['contrast-2','house-v1','techno-v1','hip-hop-v1','new-wave-v1','breakbeat-v1']}),
  Object.freeze({id:'techno-v1',name:'Techno inspired',neighbors:['house-v1','electro-v1','minimal-techno-v1','tech-house-v1']}),
  Object.freeze({id:'minimal-techno-v1',name:'Minimal techno inspired',neighbors:['house-v1','techno-v1']}),
  Object.freeze({id:'hip-hop-v1',name:'Hip-hop instrumental',neighbors:['contrast-1','electro-v1','downtempo-v1','two-step-v1','breakbeat-v1','boom-bap-v1','trap-v1']}),
  Object.freeze({id:'downtempo-v1',name:'Downtempo inspired',neighbors:['rocksteady-v1','hip-hop-v1','deep-house-v1','soul-v1','trip-hop-v1','trap-v1']}),
  Object.freeze({id:'deep-house-v1',name:'Deep house inspired',neighbors:['house-v1','downtempo-v1','neo-soul-v1']}),
  Object.freeze({id:'tech-house-v1',name:'Tech house inspired',neighbors:['house-v1','techno-v1','uk-garage-v1']}),
  Object.freeze({id:'old-time-v1',name:'Old-time plucked band',neighbors:['bluegrass-v1','honky-tonk-v1','piedmont-v1']}),
  Object.freeze({id:'honky-tonk-v1',name:'Honky-tonk inspired',neighbors:['contrast-1','bluegrass-v1','old-time-v1','early-rnb-v1','swing-v1','western-swing-v1','outlaw-country-v1']}),
  Object.freeze({id:'new-wave-v1',name:'New-wave guitar/synth',neighbors:['contrast-1','electro-v1','indie-rock-v1']}),
  Object.freeze({id:'early-rnb-v1',name:'Early R&B piano band',neighbors:['honky-tonk-v1','soul-v1','gospel-piano-v1','doo-wop-v1']}),
  Object.freeze({id:'soul-v1',name:'Soul instrumental',neighbors:['early-rnb-v1','downtempo-v1','swing-v1','neo-soul-v1','gospel-piano-v1','doo-wop-v1']}),
  Object.freeze({id:'uk-garage-v1',name:'UK garage four-kick',neighbors:['house-v1','tech-house-v1','two-step-v1']}),
  Object.freeze({id:'two-step-v1',name:'Two-step garage inspired',neighbors:['uk-garage-v1','hip-hop-v1','dubstep-v1','grime-v1']}),
  Object.freeze({id:'breakbeat-v1',name:'Programmed breakbeat',neighbors:['electro-v1','hip-hop-v1','drum-and-bass-v1','jungle-v1','jersey-club-v1','baltimore-club-v1']}),
  Object.freeze({id:'swing-v1',name:'Small-group swing',neighbors:['western-swing-v1','honky-tonk-v1','soul-v1']}),
  Object.freeze({id:'western-swing-v1',name:'Western swing guitar study',neighbors:['swing-v1','honky-tonk-v1','bluegrass-v1','outlaw-country-v1','progressive-bluegrass-v1']}),
  Object.freeze({id:'piedmont-v1',name:'Piedmont guitar study',neighbors:['old-time-v1','bluegrass-v1','indie-rock-v1','delta-blues-v1']}),
  Object.freeze({id:'boom-bap-v1',name:'Boom-bap instrumental',neighbors:['hip-hop-v1','trip-hop-v1']}),
  Object.freeze({id:'trip-hop-v1',name:'Trip-hop instrumental study',neighbors:['downtempo-v1','boom-bap-v1']}),
  Object.freeze({id:'neo-soul-v1',name:'Neo-soul keys inspired',neighbors:['soul-v1','deep-house-v1','liquid-dnb-v1']}),
  Object.freeze({id:'drum-and-bass-v1',name:'Drum-and-bass pulse study',neighbors:['breakbeat-v1','jungle-v1','liquid-dnb-v1','footwork-v1']}),
  Object.freeze({id:'jungle-v1',name:'Programmed jungle study',neighbors:['drum-and-bass-v1','breakbeat-v1']}),
  Object.freeze({id:'liquid-dnb-v1',name:'Liquid DnB keys study',neighbors:['drum-and-bass-v1','neo-soul-v1']}),
  Object.freeze({id:'jersey-club-v1',name:'Jersey club instrumental',neighbors:['house-v1','breakbeat-v1','footwork-v1','baltimore-club-v1']}),
  Object.freeze({id:'trap-v1',name:'Trap instrumental study',neighbors:['hip-hop-v1','downtempo-v1']}),
  Object.freeze({id:'indie-rock-v1',name:'Indie clean-guitar study',neighbors:['new-wave-v1','piedmont-v1']}),
  Object.freeze({id:'gospel-piano-v1',name:'Gospel-inspired piano responses',neighbors:['soul-v1','early-rnb-v1']}),
  Object.freeze({id:'doo-wop-v1',name:'Doo-wop vowel study',neighbors:['soul-v1','early-rnb-v1']}),
  Object.freeze({id:'dubstep-v1',name:'Dubstep half-time study',neighbors:['two-step-v1','grime-v1']}),
  Object.freeze({id:'grime-v1',name:'Grime instrumental study',neighbors:['two-step-v1','dubstep-v1']}),
  Object.freeze({id:'footwork-v1',name:'Footwork fragment study',neighbors:['jersey-club-v1','drum-and-bass-v1']}),
  Object.freeze({id:'baltimore-club-v1',name:'Baltimore club instrumental',neighbors:['jersey-club-v1','breakbeat-v1']}),
  Object.freeze({id:'outlaw-country-v1',name:'Outlaw acoustic country study',neighbors:['honky-tonk-v1','western-swing-v1','delta-blues-v1']}),
  Object.freeze({id:'progressive-bluegrass-v1',name:'Progressive bluegrass study',neighbors:['bluegrass-v1','western-swing-v1']}),
  Object.freeze({id:'delta-blues-v1',name:'Delta-inspired fretted guitar study',neighbors:['piedmont-v1','outlaw-country-v1']}),
  ...FORM_SCENES,
]);
export function hasSceneCatalogue(session){return session?.scene_catalogue===SCENE_CATALOGUE_VERSION;}
export function sceneIndex(id){return SCENE_CATALOGUE.findIndex(scene=>scene.id===id);}
export function compatibleSceneIndices(index){
  const scene=SCENE_CATALOGUE[index];
  if(!scene)return [];
  if(scene.neighbors.length)return [...new Set([...scene.neighbors,...FORM_SCENES.filter(entry=>entry.neighbors.includes(scene.id)).map(entry=>entry.id)])].map(id=>{
    const next=sceneIndex(id);
    if(next<0)throw Error(`Unknown musical neighbor: ${id}`);
    return next;
  });
  return SCENE_CATALOGUE.map((entry,i)=>i).filter(i=>i!==index&&(i<4||SCENE_CATALOGUE[i].neighbors.includes(scene.id)));
}

export function catalogueBacking(doc,session,preserved){
  const notes=unmixedBacking(doc,session,preserved);
  if(session.scene_mix!==SCENE_MIX_VERSION)return notes;
  // Explicitly opt-in generated-score balance; no live/personal gain changes.
  // Retain legacy saved output when the mix version is absent.
  return notes.map(note=>({...note,velocity:Math.min(.99,note.velocity*
    (note.role==='drums'?.3:session.scene_id==='bluegrass-v1'?1.3:1))}));
}

function unmixedBacking(doc,session,preserved){
  const index=sceneIndex(session.scene_id);
  if(index<0)throw Error('Unsupported musical scene. Your notes are unchanged.');
  const base=showcaseBacking(doc,{...session,showcase_arrangement:'contrast-v1',style_spectrum:index<4?index:1},preserved);
  if(index<4)return base;
  if(formBlockCount(session.scene_id))return formBacking(doc,session,preserved);
  if(ROOTS_STUDY_IDS.includes(session.scene_id))return rootsStudyBacking(doc,session,preserved);
  if(session.scene_id==='baltimore-club-v1')return baltimoreBacking(doc,session,preserved);
  if(session.scene_id==='footwork-v1')return footworkBacking(doc,session,preserved);
  if(session.scene_id==='grime-v1')return grimeBacking(doc,session,preserved);
  if(session.scene_id==='dubstep-v1')return dubstepBacking(doc,session,preserved);
  if(session.scene_id==='doo-wop-v1')return dooWopBacking(doc,session,preserved);
  if(session.scene_id==='gospel-piano-v1')return pianoResponseBacking(doc,session,preserved);
  if(PULSE_SCENE_IDS.includes(session.scene_id))return pulseBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(RHYTHM_SCENE_IDS.includes(session.scene_id))return rhythmBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(session.scene_id===INDIE_ID)return indieBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(CLUB_TRAP_IDS.includes(session.scene_id))return clubTrapBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(FAST_BREAK_IDS.includes(session.scene_id))return fastBreakBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(SOUL_TIMING_IDS.includes(session.scene_id))return soulTimingBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(ROOTS_TIMING_IDS.includes(session.scene_id))return rootsTimingBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(TIMING_SCENE_IDS.includes(session.scene_id))return timingBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(RESPONSE_SCENE_IDS.includes(session.scene_id))return responseBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(HOUSE_ROOTS_IDS.includes(session.scene_id))return houseRootsBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(session.scene_id==='ska-v1')return skaBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(session.scene_id==='rocksteady-v1')return rocksteadyBacking(doc,session,preserved,base.filter(n=>n.role==='lead'));
  if(session.scene_id!=='bluegrass-v1')throw Error('This musical scene has no arrangement yet. Your notes are unchanged.');
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  // Original roll/chop arrangement, informed by Folkways/LOC bluegrass accounts.
  // Not copied repertoire or a claim to reproduce a full acoustic ensemble.
  const notes=base.filter(n=>n.role==='lead').map(n=>({...n,patch_id:'sampled_banjo_v1',id:`bluegrass-motif-${n.id}`}));
  const {add,finish}=createSceneWriter('bluegrass-v1',doc,session,preserved,notes);
  const chords=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]];
  const bassRoots=[0,sixth,5,7],density=session.density??1,color=session.color??1;
  const rollPatch=['sampled_guitar_v1','sampled_banjo_v1','sampled_piano_v1','sampled_banjo_v1','sampled_electric_piano_v1'][color];
  for(let bar=0;bar<4;bar++){
    const space=session.scene_variant==='space'&&bar%2===1,baseStep=bar*16,phrase=[.92,1,.96,1.05][bar];
    for(const step of [0,8])add('bass','sampled_bass_v1',baseStep+step,36+root+bassRoots[bar]+(step===8?7:0),3,phrase*(step===0?.38:.31));
    const roll=space?[0,6,12]:[[0,6,12],[0,2,4,6,8,10,12,14],[0,2,4,6,8,10,12,14,15],[0,2,3,4,6,8,10,11,12,14,15],[0,1,2,3,4,6,7,8,10,11,12,14,15]][density];
    if(!doc.auto_harmony_stabs){
      const answering=session.scene_variant==='answer'&&bar===3;
      for(const [i,step] of roll.entries())add('harmony',rollPatch,baseStep+step,60+root+chords[bar][answering?2-i%3:i%3]+(color===3?12:0),.8,phrase*(i%3===0?.42:.31));
      for(const step of space?[4]:[4,12])for(const pitch of chords[bar])add('harmony','sampled_guitar_v1',baseStep+step,48+root+pitch,.6,.2*phrase);
    }
  }
  return finish();
}
