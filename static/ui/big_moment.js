import {exploreMelody} from './melody_explorer.js';
import {compileReturnSong} from './returning_part.js';

/** An explicit preview replaces only the chosen part, never the source chapter. */
export function previewBigMoment(doc,index,direction='rise') {
  const trial=exploreMelody(doc,index,direction,{placement:'replace'});
  const result={...trial,purpose:'big-moment',afterIndex:index};
  if(!trial.changed)return result;
  const after=structuredClone(doc);
  after.song_cards[index]={...after.song_cards[index],material:structuredClone(trial.after.song_cards[trial.afterIndex].material)};
  const beforeEvents=compileReturnSong(doc).events.filter(e=>e.card!==index);
  const afterEvents=compileReturnSong(after).events.filter(e=>e.card!==index);
  if(JSON.stringify(beforeEvents)!==JSON.stringify(afterEvents))return {...result,changed:false,after:structuredClone(doc),reason:'This would change another part. Your song stays.'};
  return {...result,after};
}
