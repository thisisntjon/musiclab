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
  const supported=['rocksteady-v1','reggae-v1','house-v1','electro-v1','doo-wop-v1','grime-v1','footwork-v1','baltimore-club-v1'].includes(sceneId)||(sceneId==='ska-v1'&&doc.jam_session.exploration_map==='catalogue-circle-v2');
  const third=minor?3:4,sixth=minor?8:9;
  return {sceneId,root,minor,...(leadGrammarFor(sceneId)?{leadGrammar:leadGrammarFor(sceneId)}:{}),harmony:supported?{version:1,
    bars:[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],ending:7}:null};
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
