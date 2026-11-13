import {formBlockCount,formScore,selectedFormCursor} from './form_scenes.js';
import {rootsStudyHarmony} from './roots_study_phrases.js';
// Authored intent, independent of whether an instrument sounds every chord.
// Intervals are relative to the song root, so intentional transposition is safe.
export function validPhraseHarmony(h) {
  return h?.version===1 && Array.isArray(h.bars) && h.bars.length===4
    && h.bars.every(bar=>Array.isArray(bar)&&bar.length>=3&&bar.length<=5
      &&new Set(bar).size===bar.length&&bar.every(n=>Number.isInteger(n)&&n>=0&&n<12))
    &&Number.isInteger(h.ending)&&h.bars[3].includes(h.ending);
}

export function phraseContext(doc) {
  const sceneId=doc?.jam_session?.scene_id;
  if(!sceneId)return null;
  const root=doc.global_context?.root_pc||0;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  if(doc.jam_session.music_field) {
    const third=minor?3:4,sixth=minor?8:9;
    return {sceneId,root,minor,musicField:{...doc.jam_session.music_field},harmony:{version:1,bars:[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],ending:7}};
  }
  if(formBlockCount(sceneId)&&!doc.jam_session.anchor_backing){
    const score=formScore(doc);return {sceneId,root,minor,harmony:score.harmony,...(score.mode?{mode:structuredClone(score.mode)}:{}),
      form:{version:1,id:sceneId,...selectedFormCursor(doc.jam_session),bars:formBlockCount(sceneId)*4,label:score.label}};
  }
  // These recipes explicitly share this progression. Do not guess other
  // arrangements from surviving notes, density, or their style labels.
  if(['outlaw-country-v1','progressive-bluegrass-v1','delta-blues-v1'].includes(sceneId))return {sceneId,root,minor,harmony:rootsStudyHarmony(sceneId,minor),requiresHarmonicLead:true,leadGrammar:leadGrammarFor(sceneId)};
  if(sceneId==='dubstep-v1')return {sceneId,root,minor,harmony:dubHarmony(minor),requiresHarmonicLead:true,leadGrammar:leadGrammarFor(sceneId)};
  if(sceneId==='gospel-piano-v1')return {sceneId,root,minor,harmony:responseHarmony(minor),requiresHarmonicLead:true};
  return {sceneId,root,minor,...(leadGrammarFor(sceneId)?{leadGrammar:leadGrammarFor(sceneId)}:{}),harmony:sceneHarmonyFor(sceneId,minor)};
}

const SHARED_TRIAD_SCENES=new Set([
  'ska-v1','rocksteady-v1','reggae-v1','house-v1','electro-v1','doo-wop-v1','grime-v1','footwork-v1','baltimore-club-v1',
  'tech-house-v1','honky-tonk-v1','downtempo-v1','uk-garage-v1','two-step-v1','breakbeat-v1','new-wave-v1',
  'early-rnb-v1','soul-v1','swing-v1','piedmont-v1','boom-bap-v1','trip-hop-v1','drum-and-bass-v1','jersey-club-v1','trap-v1','indie-rock-v1',
]);

// Chords for the tune wheel only. These three styles have no chord plan for the live band, and giving them one
// would change how their band plays in Jam, so the wheel reads its chords from here instead.
export function wheelOnlyHarmonyFor(sceneId,minor=false) {
  const t=minor?3:4,s=minor?8:9,sev=minor?10:11;
  if(sceneId==='bluegrass-v1'||sceneId==='hip-hop-v1')return {version:1,bars:[[0,t,7],[0,t,s],[0,5,s],[2,7,sev]],ending:7};
  // Old-time keeps a fifth sounding through the middle bars; the tune may use it there.
  if(sceneId==='old-time-v1')return {version:1,bars:[[0,t,7],[0,t,s,7],[0,5,s,7],[2,7,sev]],ending:7};
  return null;
}

export function sceneHarmonyFor(sceneId,minor=false) {
  const t=minor?3:4,s=minor?8:9,sev=minor?10:11;
  if(sceneId==='deep-house-v1')return {version:1,bars:[[0,t,7,sev],[0,t,s,7],[0,5,s,t],[2,7,sev,5]],ending:7};
  if(sceneId==='neo-soul-v1')return minor
    ?{version:1,bars:[[0,3,10,2],[8,0,7,10],[5,8,3,7],[7,10,2,5]],ending:7}
    :{version:1,bars:[[0,4,11,2],[9,0,7,11],[5,9,4,7],[7,11,5,9]],ending:7};
  if(sceneId==='liquid-dnb-v1')return minor
    ?{version:1,bars:[[0,3,10,2],[8,0,7,10,3],[5,8,3,7],[7,10,2,5]],ending:7}
    :{version:1,bars:[[0,4,11,2],[9,0,7,11,4],[5,9,4,7],[7,11,5,9,2]],ending:7};
  if(sceneId==='western-swing-v1')return minor
    ?{version:1,bars:[[0,3,7,10],[0,3,8,5],[0,5,8,3],[2,7,10,5]],ending:7}
    :{version:1,bars:[[0,4,7,9],[0,4,9,7],[0,5,9,2],[2,7,11,5]],ending:7};
  if(sceneId==='techno-v1'||sceneId==='minimal-techno-v1')return {version:1,bars:[[0,2,7],[s,(s+7)%12,0],[5,0,7],[7,2,5]],ending:7};
  if(sceneId==='jungle-v1')return {version:1,bars:[[0,t,7],[0,t,s],[0,5,7],[2,7,sev]],ending:7};
  if(/^contrast-[0-3]$/.test(sceneId))return {version:1,bars:[[0,t,7,sev],[0,t,7,s],[0,5,s],[2,7,0]],ending:7};
  if(SHARED_TRIAD_SCENES.has(sceneId))return {version:1,bars:[[0,t,7],[0,t,s],[0,5,s],[2,7,sev]],ending:7};
  return null;
}

export function leadGrammarFor(sceneId) {
  return sceneId==='delta-blues-v1'?'fretted-blues-response-v1':sceneId==='progressive-bluegrass-v1'?'interrupted-roll-v1':sceneId==='outlaw-country-v1'?'country-guitar-response-v1':sceneId==='baltimore-club-v1'?'club-key-cell-v1':sceneId==='footwork-v1'?'fractional-fragments-v1':sceneId==='doo-wop-v1'?'vowel-response-v1':sceneId==='dubstep-v1'?'half-time-space-v1':sceneId==='grime-v1'?'sparse-stab-response-v1':null;
}

export function responseHarmony(minor=false) {
  const third=minor?3:4;
  return {version:1,bars:[[0,third,7],[5,minor?8:9,0],[7,11,2],[0,third,7]],ending:0};
}

export function dubHarmony(minor=false) {
 const sixth=minor?8:9;
 return {version:1,bars:[[0,2,7],[sixth,(sixth+2)%12,(sixth+7)%12],[5,7,0],[7,9,2]],ending:7};
}
