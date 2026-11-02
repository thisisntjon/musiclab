import {buildBlock as bluesBlock,BLOCK_COUNTS} from './blues_form_scores.js';
import {buildBlock as jazzBlock,SCENES as JAZZ_IDS} from './jazz_form_scores.js';
import {createSceneWriter} from './scene_writer.js';
import {buildBlock as modalBlock,SCENE_ID as MODAL_ID} from './modal_form_score.js';
import {buildBlock as fusionBlock,SCENE_ID as FUSION_ID} from './fusion_form_score.js';
import {buildBlock as manoucheBlock,SCENE_ID as MANOUCHE_ID} from './manouche_form_score.js';
import {buildBlock as memphisBlock,SCENE_ID as MEMPHIS_ID} from './memphis_form_score.js';
import {buildBlock as progressiveBlock,SCENE_ID as PROGRESSIVE_ID} from './progressive_house_form_score.js';
import {buildBlock as tranceBlock,SCENE_ID as TRANCE_ID} from './trance_form_score.js';
import {buildBlock as bossaBlock,SCENE_ID as BOSSA_ID} from './bossa_form_score.js';
import {buildBlock as nashvilleBlock,SCENE_ID as NASHVILLE_ID} from './nashville_form_score.js';
import {buildBlock as bakersfieldBlock,SCENE_ID as BAKERSFIELD_ID} from './bakersfield_form_score.js';
import {buildBlock as chicagoBlock,SCENE_ID as CHICAGO_ID} from './chicago_form_score.js';
import {buildBlock as texasBlock,SCENE_ID as TEXAS_ID} from './texas_form_score.js';
import {buildBlock as soulJazzBlock,SCENE_ID as SOUL_JAZZ_ID} from './soul_jazz_form_score.js';
import {buildBlock as philadelphiaBlock,SCENE_ID as PHILADELPHIA_ID} from './philadelphia_form_score.js';
import {buildBlock as hardRockBlock,SCENE_ID as HARD_ROCK_ID} from './hard_rock_form_score.js';
import {buildBlock as garageRockBlock,SCENE_ID as GARAGE_ROCK_ID} from './garage_rock_form_score.js';
import {buildBlock as punkRockBlock,SCENE_ID as PUNK_ROCK_ID} from './punk_rock_form_score.js';
import {buildBlock as postPunkBlock,SCENE_ID as POST_PUNK_ID} from './post_punk_form_score.js';
import {buildBlock as psychedelicBlock,SCENE_ID as PSYCHEDELIC_ID} from './psychedelic_rock_form_score.js';
import {buildBlock as grungeBlock,SCENE_ID as GRUNGE_ID} from './grunge_form_score.js';
import {buildBlock as heavyMetalBlock,SCENE_ID as HEAVY_METAL_ID} from './heavy_metal_form_score.js';
import {buildBlock as thrashMetalBlock,SCENE_ID as THRASH_METAL_ID} from './thrash_metal_form_score.js';
import {buildBlock as deathMetalBlock,SCENE_ID as DEATH_METAL_ID} from './death_metal_form_score.js';
import {buildBlock as blackMetalBlock,SCENE_ID as BLACK_METAL_ID} from './black_metal_form_score.js';
const SPECIAL_FORMS=Object.freeze({[MODAL_ID]:modalBlock,[FUSION_ID]:fusionBlock,[MANOUCHE_ID]:manoucheBlock,[MEMPHIS_ID]:memphisBlock,[PROGRESSIVE_ID]:progressiveBlock,[TRANCE_ID]:tranceBlock,[BOSSA_ID]:bossaBlock,[NASHVILLE_ID]:nashvilleBlock,[BAKERSFIELD_ID]:bakersfieldBlock,[CHICAGO_ID]:chicagoBlock,[TEXAS_ID]:texasBlock,[SOUL_JAZZ_ID]:soulJazzBlock,[PHILADELPHIA_ID]:philadelphiaBlock,[HARD_ROCK_ID]:hardRockBlock,[GARAGE_ROCK_ID]:garageRockBlock,[PUNK_ROCK_ID]:punkRockBlock,[POST_PUNK_ID]:postPunkBlock,[PSYCHEDELIC_ID]:psychedelicBlock,[GRUNGE_ID]:grungeBlock,[HEAVY_METAL_ID]:heavyMetalBlock,[THRASH_METAL_ID]:thrashMetalBlock,[DEATH_METAL_ID]:deathMetalBlock,[BLACK_METAL_ID]:blackMetalBlock});

export const FORM_SCENES=Object.freeze([
 ['jump-blues-v1','Jump blues horn study','early-rnb-v1'],
 ['boogie-woogie-v1','Boogie-woogie piano study','early-rnb-v1'],
 ['classic-blues-v1','Classic blues instrumental','gospel-piano-v1'],
 ['country-blues-v1','Country blues steady-thumb study','delta-blues-v1'],
 ['ragtime-v1','Ragtime A/B piano studies','honky-tonk-v1'],
 ['stride-piano-v1','Stride piano A/B studies','swing-v1'],
 ['new-orleans-jazz-v1','New Orleans two-horn study','swing-v1'],
 ['bebop-v1','Bebop changes study','swing-v1'],
 ['cool-jazz-v1','Cool arranged counterlines','neo-soul-v1'],
 ['hard-bop-v1','Hard-bop horn responses','soul-v1'],
 ['modal-jazz-v1','Modal jazz pedal study','cool-jazz-v1'],
 ['jazz-fusion-v1','Electric groove fusion','modal-jazz-v1'],
 ['jazz-manouche-v1','Jazz manouche guitar duet','swing-v1'],
 ['memphis-soul-v1','Memphis two-horn soul study','soul-v1'],
 ['progressive-house-v1','Progressive house build and return','house-v1'],
 ['trance-v1','Trance rolling theme and return','progressive-house-v1'],
 ['bossa-nova-v1','Bossa nova nylon study','jazz-manouche-v1'],
 ['nashville-sound-v1','Nashville piano and strings','honky-tonk-v1'],
 ['bakersfield-sound-v1','Bakersfield electric answers','outlaw-country-v1'],
 ['chicago-blues-v1','Chicago guitar and harmonica shuffle','jump-blues-v1'],
 ['texas-blues-v1','Texas electric shuffle','chicago-blues-v1'],
 ['soul-jazz-v1','Soul-jazz organ vamp','hard-bop-v1'],
 ['death-metal-v1','Death-metal dense and sparse','thrash-metal-v1'],
 ['thrash-metal-v1','Thrash chromatic bursts','heavy-metal-v1'],
 ['heavy-metal-v1','Heavy-metal gallop and answers','hard-rock-v1'],
 ['grunge-v1','Grunge clean and overdrive','hard-rock-v1'],
 ['psychedelic-rock-v1','Psychedelic modal echoes','post-punk-v1'],
 ['post-punk-v1','Post-punk angular bass','new-wave-v1'],
 ['punk-rock-v1','Punk-rock compact hooks','garage-rock-v1'],
 ['garage-rock-v1','Garage-rock driving eighths','hard-rock-v1'],
 ['hard-rock-v1','Hard-rock overdrive riff','indie-rock-v1'],
 ['philadelphia-soul-v1','Philadelphia strings and horns','memphis-soul-v1'],
 ['black-metal-v1','Black-metal upper texture','death-metal-v1'],
].map(([id,name,neighbor])=>Object.freeze({id,name,neighbors:[neighbor]})));
export const formBlockCount=id=>[CHICAGO_ID,TEXAS_ID].includes(id)?3:BLOCK_COUNTS[id?.replace(/-v1$/,'')]||((JAZZ_IDS.includes(id)||Object.hasOwn(SPECIAL_FORMS,id))?2:0);
// Matched production renders against each existing neighbor; generated notes only.
const SAMPLE_LEVELS={'jump-blues-v1':2.4,'boogie-woogie-v1':2.5,'classic-blues-v1':2.5,
 'country-blues-v1':2.4,'ragtime-v1':2.2,'stride-piano-v1':1.9,'cool-jazz-v1':1.6,'modal-jazz-v1':2.2};
const SAMPLE_PART_LEVELS={
 [BLACK_METAL_ID]:{lead:2.5,harmony:3.3},
 'hard-bop-v1':{lead:2},
 [FUSION_ID]:{lead:3,default:2},
 [MANOUCHE_ID]:{lead:3.5,default:3},
 [BOSSA_ID]:{lead:4,default:2.5},
 [NASHVILLE_ID]:{lead:2,harmony:2,bass:1.6},
 [BAKERSFIELD_ID]:{lead:2.8,harmony:3,bass:1.6},
 [CHICAGO_ID]:{sampled_clean_guitar_v1:3,sampled_harmonica_v1:3,bass:1.8},
 [TEXAS_ID]:{lead:3,harmony:2.5},
 [SOUL_JAZZ_ID]:{lead:3,harmony:3,bass:2.5},
 [HARD_ROCK_ID]:{lead:3,harmony:2.8},
 [GARAGE_ROCK_ID]:{lead:3,harmony:3.3},
 [PUNK_ROCK_ID]:{lead:3,harmony:3.3},
 [POST_PUNK_ID]:{lead:3,harmony:3,bass:2},
 [PSYCHEDELIC_ID]:{lead:3,harmony:3,bass:2},
 [GRUNGE_ID]:{sampled_clean_guitar_v1:3.4,sampled_overdrive_guitar_v1:2.8},
 [HEAVY_METAL_ID]:{lead:3,harmony:3.3},
 [THRASH_METAL_ID]:{lead:3.5,harmony:3.6},
 [DEATH_METAL_ID]:{lead:3.5,harmony:3.6,blocks:{1:{lead:2.9,harmony:3}}},
 [PHILADELPHIA_ID]:{sampled_trumpet_v1:3,sampled_tenor_sax_v1:3.5,sampled_strings_v1:2.5,bass:1.8},
 [MEMPHIS_ID]:{sampled_trumpet_v1:3,sampled_tenor_sax_v1:3.5,sampled_bass_v1:1.5,sampled_clean_guitar_v1:3},
};
const NATIVE_PART_LEVELS={
 [BLACK_METAL_ID]:{bass:.4},
 [DEATH_METAL_ID]:{bass:.4},
 [THRASH_METAL_ID]:{bass:.4},
 [HEAVY_METAL_ID]:{bass:.4},
 [GRUNGE_ID]:{bass:.4},
 [HARD_ROCK_ID]:{bass:.5},
 [GARAGE_ROCK_ID]:{bass:.4},
 [PUNK_ROCK_ID]:{bass:.4},
 [TEXAS_ID]:{bass:.5},
 [PROGRESSIVE_ID]:{lead:3,harmony:1.5,bass:.75},
 [TRANCE_ID]:{lead:2,bass:.75},
};
export function selectedFormCursor(session) {
 const count=formBlockCount(session?.scene_id),cursor=session?.form_cursor;
 return cursor?.id===session?.scene_id&&Number.isInteger(cursor.blockIndex)&&cursor.blockIndex>=0&&cursor.blockIndex<count
  &&Number.isInteger(cursor.cycle)&&cursor.cycle>=0&&cursor.cycle<=1e6?cursor:{blockIndex:0,cycle:0};
}
export function formScore(doc,session=doc.jam_session) {
 const cursor=selectedFormCursor(session),id=session.scene_id;
 return (SPECIAL_FORMS[id]||(JAZZ_IDS.includes(id)?jazzBlock:bluesBlock))(id,{
  root:doc.global_context?.root_pc||0,minor:/minor|dorian|phrygian/.test(doc.global_context?.scale_type||''),
  density:session.density??1,color:session.color??1,variant:session.scene_variant||'base',...cursor});
}
export function formBacking(doc,session,preserved) {
 const score=formScore(doc,session),cursor=selectedFormCursor(session);
 const {add,finish}=createSceneWriter(`${session.scene_id}-b${cursor.blockIndex}-c${cursor.cycle%8}`,doc,session,preserved);
 const echoGroups=new Map();
 for(const n of score.notes) {
  if(n.role==='harmony'&&doc.auto_harmony_stabs)continue;
  const levels=SAMPLE_PART_LEVELS[session.scene_id];
  const blockLevels=levels?.blocks?.[cursor.blockIndex];
  const sampledLevel=blockLevels?.[n.patch]??blockLevels?.[n.role]??blockLevels?.default
   ??levels?.[n.patch]??levels?.[n.role]??levels?.default??SAMPLE_LEVELS[session.scene_id]??1;
  const nativeLevel=NATIVE_PART_LEVELS[session.scene_id]?.[n.role]??1;
  const velocity=n.velocity*(n.patch.startsWith('sampled_')?sampledLevel:nativeLevel);
  const note=add(n.role,n.patch,n.position,n.pitch,n.gate,Math.min(.99,velocity));
  if(note&&n.voice_id)note.voice_id=n.voice_id;
  if(typeof n.echo_group==='string'&&Number.isFinite(n.echo_delay_steps)&&n.echo_delay_steps>=0){
   if(!echoGroups.has(n.echo_group))echoGroups.set(n.echo_group,[]);
   echoGroups.get(n.echo_group).push({note,delay:n.echo_delay_steps});
  }
  // Source modality is historical provenance, never an instruction to retune
  // this event or somebody's later edits to it.
  if(note&&score.mode)note.generated_mode=structuredClone(score.mode);
  if(note&&n.role!=='drums'&&[MANOUCHE_ID,MEMPHIS_ID,BOSSA_ID,NASHVILLE_ID,BAKERSFIELD_ID,CHICAGO_ID,TEXAS_ID,SOUL_JAZZ_ID,PHILADELPHIA_ID,HARD_ROCK_ID,GARAGE_ROCK_ID,PUNK_ROCK_ID,POST_PUNK_ID,PSYCHEDELIC_ID,GRUNGE_ID,HEAVY_METAL_ID,THRASH_METAL_ID,DEATH_METAL_ID,BLACK_METAL_ID].includes(session.scene_id))note.generated_harmony={version:1,
   pitch_classes:score.harmony.bars[Math.floor(n.position/16)].map(pc=>(pc+(doc.global_context?.root_pc||0))%12)};
 }
 // Personal-note protection may suppress a dry attack. Never leave its generated
 // echoes behind. A suppressed echo does not remove a surviving dry note.
 // This is live generation only; partial captured windows remain independent.
 const orphanIds=new Set();
 for(const group of echoGroups.values()){
  const dry=group.find(item=>item.delay===0)?.note;
  for(const {note,delay} of group)if(note){
   if(dry)note.generated_echo={version:1,source_id:dry.id,delay_steps:delay};
   else orphanIds.add(note.id);
  }
 }
 return finish().filter(note=>!orphanIds.has(note.id));
}
