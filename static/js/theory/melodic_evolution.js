import {rootsStudyCells,rootsStudyPitch} from './roots_study_phrases.js';
import {baltimoreCells} from './baltimore_scene.js';
import {footworkFragments} from './footwork_scene.js';
import {validPhraseHarmony,leadGrammarFor} from './phrase_harmony.js';
import {OOH_SCENE_LEVEL,GRIME_SCENE_LEVEL,OUTLAW_STUDY_LEVEL,PROGRESSIVE_STUDY_LEVEL,DELTA_STUDY_LEVEL} from './scene_voice_levels.js';
// Original descendants of the listening motif. This planner only emits supplied
// MusicLab material; performed notes never enter its transformation path.
import {SCENE_CATALOGUE} from './scene_catalogue.js';
const PALETTES = [
  [/delta-blues/, ['sampled_guitar_v1','sampled_guitar_v1']],
  [/outlaw-country/, ['sampled_clean_guitar_v1','sampled_guitar_v1']],
  [/doo-wop/, ['sampled_ooh_v1','sampled_ooh_v1']],
  [/gospel-piano/, ['sampled_piano_v1','sampled_piano_v1']],
  [/bluegrass|old-time/, ['sampled_banjo_v1','sampled_guitar_v1']],
  [/piedmont|western-swing|contrast-0/, ['sampled_guitar_v1','sampled_piano_v1']],
  [/honky-tonk|early-rnb|^swing|contrast-1/, ['sampled_piano_v1','sampled_clean_guitar_v1']],
  [/ska|rocksteady|reggae|indie-rock|new-wave|contrast-2/, ['sampled_clean_guitar_v1','sampled_electric_piano_v1']],
];

export function leadPalette(sceneId) {
  return [...(PALETTES.find(([match])=>match.test(sceneId))?.[1]
    || ['sampled_electric_piano_v1','sampled_piano_v1'])];
}

export function restoreMelodicPhrase(state) {
  const patches=new Set(PALETTES.flatMap(([,p])=>p).concat('sampled_electric_piano_v1'));
  if(![1,2,3].includes(state?.version)||!Number.isInteger(state.phraseOrdinal)||state.phraseOrdinal<0||state.phraseOrdinal>1000000
    ||!SCENE_CATALOGUE.some(s=>s.id===state.sceneId)||!Number.isInteger(state.root)||state.root<0||state.root>11
    ||typeof state.minor!=='boolean'||!Number.isFinite(state.bpm)||state.bpm<20||state.bpm>400
    ||!Number.isInteger(state.seed)||state.seed<0||state.seed>0xffffffff
    ||(state.previousPatch!==null&&!patches.has(state.previousPatch)))return null;
  if(state.version>=2&&(!Array.isArray(state.recentOpenings)||state.recentOpenings.length>4
    ||state.recentOpenings.some(n=>!Number.isInteger(n)||n<0||n>7)))return null;
  if(state.version>=2&&state.roomFor!==undefined&&(!Array.isArray(state.roomFor)||state.roomFor.length>16
    ||state.roomFor.some(id=>typeof id!=='string'||!id.startsWith('jam-live-')||id.length>160)))return null;
  if(state.version===3&&!validPhraseHarmony(state.harmony))return null;
  if(state.version===3&&state.leadGrammar!==undefined&&state.leadGrammar!==leadGrammarFor(state.sceneId))return null;
  return planMelodicPhrase(state);
}

/** A pure plan: calling it for rendering/inspection never advances music. */
export function planMelodicPhrase(options) {
  return options.version>=2?planDevelopingPhrase(options):planLegacyMelodicPhrase(options);
}

// Keep version 1 byte-for-byte musical behavior for saved descriptors.
function planLegacyMelodicPhrase({phraseOrdinal,sceneId,root=0,minor=false,bpm=100,seed=0,previousPatch=null}) {
  if(!Number.isInteger(phraseOrdinal)||phraseOrdinal<0||!Number.isFinite(bpm)||bpm<=0)throw Error('Invalid phrase clock');
  const third=minor?3:4,sixth=minor?8:9,seventh=minor?10:11;
  const statement=[[[2,7,2],[6,12,2],[10,14,3]],[[2,12,2],[8,7,2],[12,third,2]],
    [[2,7,2],[6,12,2],[10,14,3]],[[2,12,2],[8,7,2],[12,2,2]]];
  const palette=leadPalette(sceneId);
  // An answer voice is a phrase-level handoff, never a random patch per note.
  const patch=palette[Math.floor(phraseOrdinal/4)%3===2?1:0];
  const handoff=previousPatch!==null&&patch!==previousPatch;
  const phase=phraseOrdinal%4;
  const variant=handoff?'statement':['statement','answer','space','return'][phase];
  const motif=statement.map(bar=>bar.map(note=>[...note]));
  const alternative=(Math.floor(phraseOrdinal/4)+(Number(seed)>>>0))%3;
  if(variant==='answer') {
    motif[2]=alternative===0?[[2,sixth,2],[8,7,2],[12,5,2]]
      :alternative===1?[[2,12,3],[8,sixth,2],[12,7,2]]:[[2,7,2],[6,sixth,2],[10,12,3]];
    motif[3]=alternative===2?[[4,7,2],[10,2,4]]:[[2,7,3],[10,2,4]];
  } else if(variant==='space') {
    motif[0]=[motif[0][0]];motif[1]=[motif[1][0]];
    motif[2]=[[6,sixth,2],[10,7,2]];motif[3]=[[8,2,4]];
  } else if(variant==='return') {
    motif[3]=[[2,seventh,2],[8,7,2],[12,2,2]];
  }
  const stepSec=15/bpm;
  const events=motif.flatMap((bar,index)=>bar.map(([step,interval,duration])=>{
    const pc=((root%12+12)%12);
    const position=index*16+step,pitch=(pc===11?48:60)+pc+interval;
    return {id:`evolution-v1-${phraseOrdinal}-${position}`,role:'lead',patch_id:patch,
      step:position,start_sec:position*stepSec,duration_sec:duration*stepSec,
      velocity:step===2?.64:.53,concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},
      provenance:'jam_generated',generated_by:'musiclab_jam',performance:{version:1,offset_steps:0},
      evolution:{version:1,phraseOrdinal,variant,sceneId}};
  }));
  return {events,variant,patch,phraseOrdinal,
    descriptor:{version:1,phraseOrdinal,sceneId,root:((root%12+12)%12),minor,bpm,seed:Number(seed)>>>0,previousPatch:previousPatch??null}};
}

// Rhythm/contour cells, indexed into local chord-related tones and extensions.
// Each opening differs in both pacing and direction, with intentional gaps.
const CELLS = [
  [[2,2,2],[6,3,2],[10,4,3]],
  [[0,0,4],[7,1,2],[12,2,2]],
  [[4,3,5],[12,2,2]],
  [[2,1,2],[5,2,2],[9,3,3]],
  [[0,2,3],[6,1,3],[12,0,2]],
  [[6,1,5]],
  [[1,3,2],[4,2,2],[8,1,4]],
  [[0,1,3],[5,2,2],[11,1,3]],
];

function planDevelopingPhrase({version=2,harmony=null,phraseOrdinal,sceneId,root=0,minor=false,bpm=100,seed=0,previousPatch=null,recentOpenings=[],roomFor=[]}) {
  if(!Number.isInteger(phraseOrdinal)||phraseOrdinal<0||!Number.isFinite(bpm)||bpm<=0)throw Error('Invalid phrase clock');
  if(version===3&&!validPhraseHarmony(harmony))throw Error('Invalid phrase harmony');
  const history=recentOpenings.slice(-4),third=minor?3:4,sixth=minor?8:9,seventh=minor?10:11;
  let openingId=(phraseOrdinal+(Number(seed)>>>0)%8)%8;
  while(history.includes(openingId))openingId=(openingId+1)%8;
  const cycle=Math.floor(phraseOrdinal/8);
  const chords=[[0,third,7,12,14],[0,third,7,sixth,12],[0,5,sixth,12,14],[2,7,seventh,12,14]];
  const palette=leadPalette(sceneId),patch=palette[Math.floor(phraseOrdinal/4)%3===2?1:0];
  const cells=[openingId,(openingId+3+cycle)%8,(openingId+5+cycle)%8,(openingId+2)%8];
  const variant=roomFor.length?'room':openingId===5?'space':openingId===0?'return':'develop';
  const pc=((root%12+12)%12),base=pc===11?48:60,stepSec=15/bpm;
  const events=cells.flatMap((cell,bar)=>CELLS[cell].map(([onset,tone,gate],index,notes)=>{
    // Cadence on a local stable tone; no requirement to repeat the first cell.
    const tones=version===3?[...harmony.bars[bar],...harmony.bars[bar].map(n=>n+12)]:chords[bar];
    const interval=bar===3&&index===notes.length-1?(version===3?harmony.ending:cycle%2?7:2):tones[tone];
    const vowel=version===3&&sceneId==='doo-wop-v1';
    const position=vowel?(onset<4?0:onset<7?6:onset<10?8:14):onset;
    const step=bar*16+position,rawPitch=base+pc+interval;
    const pitch=vowel?72+(pc+interval)%12:rawPitch<60?rawPitch+12:rawPitch;
    return {id:`evolution-v${version}-${phraseOrdinal}-${step}`,role:'lead',patch_id:patch,step,
      start_sec:step*stepSec,duration_sec:(vowel?Math.min(gate,1.5):gate)*stepSec,velocity:vowel?(index===0?.36:.3)*OOH_SCENE_LEVEL:index===0?.62:.5,
      concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},provenance:'jam_generated',
      generated_by:'musiclab_jam',performance:{version:1,offset_steps:0},
      evolution:{version,phraseOrdinal,variant,sceneId,openingId}};
  }));
  // Successful live playing earns space in the NEXT phrase: two silent bars,
  // then a short supplied answer. This never changes a personal event or gain.
  let eligible=version===3&&sceneId==='dubstep-v1'?events.filter((e,i,list)=>
    i===list.length-1||(Math.floor(e.step/16)%2===0&&(i===0||Math.floor(list[i-1].step/16)!==Math.floor(e.step/16)
      ||Math.floor(list[i+1].step/16)!==Math.floor(e.step/16))))
    .map(e=>({...e,velocity:e.velocity*.8})):events;
  if(version===3&&sceneId==='grime-v1')eligible=[1,3].flatMap(bar=>{
    const notes=events.filter(e=>Math.floor(e.step/16)===bar);
    const replies=notes.length===1?notes:[notes[0],notes.at(-1)];
    return replies.map((e,i)=>{const step=bar*16+(replies.length===1||i?14:2);return {...e,
      id:`evolution-v3-${phraseOrdinal}-${step}`,step,start_sec:step*stepSec,duration_sec:stepSec,velocity:.45*GRIME_SCENE_LEVEL};});
  });
  if(version===3&&sceneId==='footwork-v1')eligible=footworkFragments(harmony,openingId).map(cell=>{
    const step=Math.floor(cell.position),offset=cell.position-step,pitch=60+(pc+cell.interval)%12;
    return {...events[0],id:`evolution-v3-${phraseOrdinal}-${cell.position}`,step,
      start_sec:cell.position*stepSec,duration_sec:cell.gate*stepSec,velocity:.34,
      concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},performance:{version:1,offset_steps:offset}};
  });
  if(version===3&&sceneId==='baltimore-club-v1')eligible=baltimoreCells(harmony,openingId).map(cell=>{
    const step=cell.position,pitch=60+(pc+cell.interval)%12;
    return {...events[0],id:`evolution-v3-${phraseOrdinal}-${step}`,step,
      start_sec:step*stepSec,duration_sec:cell.gate*stepSec,velocity:.4,
      concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},performance:{version:1,offset_steps:0}};
  });
  if(version===3&&['outlaw-country-v1','progressive-bluegrass-v1','delta-blues-v1'].includes(sceneId))eligible=rootsStudyCells(sceneId,harmony,openingId,minor).map(cell=>{
    const step=cell.position,pitch=rootsStudyPitch(sceneId,pc,cell);
    return {...events[0],id:`evolution-v3-${phraseOrdinal}-${step}`,step,
      start_sec:step*stepSec,duration_sec:cell.gate*stepSec,velocity:sceneId==='outlaw-country-v1'?.42*OUTLAW_STUDY_LEVEL:sceneId==='progressive-bluegrass-v1'?.38*PROGRESSIVE_STUDY_LEVEL:.42*DELTA_STUDY_LEVEL,
      concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},performance:{version:1,offset_steps:0}};
  });
  const later=eligible.filter(e=>e.step>=32);
  const played=roomFor.length?later.filter((e,i)=>i===0||i===later.length-1)
    .map(e=>({...e,evolution:{...e.evolution,room_for:[...roomFor]}})):eligible;
  return {events:played,variant,patch,phraseOrdinal,openingId,
    descriptor:{version,...(version===3?{harmony:JSON.parse(JSON.stringify(harmony)),
      ...(leadGrammarFor(sceneId)?{leadGrammar:leadGrammarFor(sceneId)}:{})}:{}),phraseOrdinal,sceneId,root:pc,minor,bpm,seed:Number(seed)>>>0,
      previousPatch:previousPatch??null,recentOpenings:history,openingId,...(roomFor.length?{roomFor:[...roomFor]}:{})}};
}

/**
 * The band answers a played note: the given bar of the current melody opens on that
 * note, moved to the nearest tone of the bar's chord. Only generated notes change.
 */
/** The nearest tone of a bar's chord to a played note, in the band's lead register. */
export function fitToBarChord(midi, {bar, harmony = null, root = 0, minor = false}) {
  if (!Number.isInteger(bar) || bar < 0 || bar > 3 || !Number.isFinite(midi)) return null;
  const pc = ((root % 12) + 12) % 12, third = minor ? 3 : 4, sixth = minor ? 8 : 9, seventh = minor ? 10 : 11;
  const fallback = [[0, third, 7], [0, third, 7, sixth], [0, 5, sixth], [2, 7, seventh]];
  const classes = (validPhraseHarmony(harmony) ? harmony.bars[bar] : fallback[bar]).map(i => ((pc + i) % 12 + 12) % 12);
  let pitch = Math.round(midi);
  for (let d = 0; d < 12; d++) {
    if (classes.includes(((pitch + d) % 12 + 12) % 12)) { pitch += d; break; }
    if (classes.includes(((pitch - d) % 12 + 12) % 12)) { pitch -= d; break; }
  }
  while (pitch < 60) pitch += 12;
  while (pitch > 84) pitch -= 12;
  return pitch;
}

export function anchorPhraseToPlaying(events, {bar, midi, sourceNoteId = null, harmony = null, root = 0, minor = false, bpm = 100}) {
  if (!events?.length) return null;
  const pitch = fitToBarChord(midi, {bar, harmony, root, minor});
  if (pitch === null) return null;
  const start = bar * 16, stepSec = 15 / bpm, out = events.map(e => JSON.parse(JSON.stringify(e)));
  let first = out.filter(e => e.step >= start && e.step < start + 16).sort((a, b) => a.step - b.step)[0];
  if (!first) {
    first = {...JSON.parse(JSON.stringify(events[0])), step: start, start_sec: start * stepSec, duration_sec: 2 * stepSec};
    out.push(first);
  }
  Object.assign(first, {id: `answer-${start}-${first.id}`, velocity: Math.max(Number(first.velocity) || .5, .64),
    concrete: {...first.concrete, midi_pitch: pitch, freq_hz: 440 * 2 ** ((pitch - 69) / 12)},
    evolution: {...(first.evolution || {}), answered: {source_note_id: sourceNoteId, midi}}});
  return out.sort((a, b) => a.step - b.step);
}

/** Only successful, audio-clock-reached live performances can request room. */
export function playedResponseSources(records,now,windowSeconds) {
  if(!Number.isFinite(now)||!(windowSeconds>0))return [];
  return [...new Set((records||[]).filter(r=>Number.isFinite(r.time)&&r.time<=now
    &&Number.isFinite(r.duration)&&r.duration>0&&r.time+r.duration>now-windowSeconds
    &&r.event?.provenance==='user_placed'&&typeof r.event.source_note_id==='string'
    &&r.event.source_note_id.startsWith('jam-live-')&&r.event.source_note_id.length<=160)
    .map(r=>r.event.source_note_id))].slice(-16);
}
