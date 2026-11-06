/** Independent authored returns, admitted only when compiled music is preserved. */
import {ensureSectionIds, extractSongMaterial, applySongMaterial, songEvents, songCardRanges, MAX_SONG_CARDS} from '../js/theory/song_view.js';
import {compileSongStandalone} from './standalone_compiler.js';
const clone = v => structuredClone(v);

export function compileReturnSong(doc) {
  const loopDoc={...doc,arrangement_mode:'loop'};
  const loop=compileSongStandalone(loopDoc);
  return songEvents(loop,doc.song_cards,(doc.song_cards||[]).map(c=>compileSongStandalone(c.material?applySongMaterial(loopDoc,c.material):loopDoc)));
}

function localEvents(song,doc,index) {
  const spb=song.steps_per_bar||16;
  const range=songCardRanges(doc.song_cards,Number(doc.global_context?.bars||4)*spb,song.bpm,spb)[index];
  return song.events.filter(e=>e.card===index).map(event=>{
    const copy=clone(event);delete copy.card;
    copy.step-=range.start_step;
    copy.start_sec=Number((copy.start_sec-range.start_sec).toFixed(4));
    return copy;
  });
}

// Absolute start seconds are rounded to four decimals by the compiler.
// Permit that rounding unit only; all musical payload remains exact.
export function sameLocalEvents(a,b) {
  return a.length===b.length && a.every((event,i)=>{
    const {start_sec:t,...payload}=event, {start_sec:u,...other}=b[i];
    return Number.isFinite(t)&&Number.isFinite(u)&&Math.abs(t-u)<=.000100001
      && JSON.stringify(payload)===JSON.stringify(other);
  });
}

export function previewReturningPart(doc,index) {
  const before=clone(doc),after=clone(doc);
  const result={before,after,index,afterIndex:index,kind:'return',changed:false};
  const decline=reason=>({...result,after:clone(before),reason});
  if(!Number.isInteger(index)||!doc.song_cards?.[index])return decline('Choose a part.');
  if(doc.song_cards.length>=MAX_SONG_CARDS)return decline('This song has eight parts. Remove one to add a return.');
  const source=doc.song_cards[index];
  const copy={...clone(source),section_id:undefined,role_name:`Part ${index+1} returns`,material:extractSongMaterial(source.material||doc)};
  // Copy the heard breath, rather than recomputing it from the new neighbour.
  copy.pre_big_breath = typeof source.pre_big_breath === "boolean" ? source.pre_big_breath : Boolean(doc.song_cards[index+1]?.big);
  delete copy.capture_segment;
  const added=ensureSectionIds([...doc.song_cards,copy]).at(-1);
  after.song_cards.push(added);
  try {
    const original=compileReturnSong(before),candidate=compileReturnSong(after);
    for(let i=0;i<before.song_cards.length;i++) {
      if(!sameLocalEvents(localEvents(original,before,i),localEvents(candidate,after,i)))
        return decline('This would change the end you have. Your song stays.');
    }
    const afterIndex=after.song_cards.length-1;
    if(!sameLocalEvents(localEvents(original,before,index),localEvents(candidate,after,afterIndex)))
      return decline('A held note or part effect needs more room. Your song stays.');
    return {...result,changed:true,afterIndex};
  } catch {return decline('This part needs a different edit. Your song stays.');}
}
