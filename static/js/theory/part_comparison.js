import {stepsPerBar} from './musical_time.js';
import {normalizeSongCards,extractSongMaterial} from './song_view.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const GENERATED=new Set(['jam_generated','scaffold_generated','generator_default','seed_template']);
/** A disposable example; only Keep may apply it to one independent part. */
export function quieterBandComparison(song,index) {
  const next=clone(song), cards=normalizeSongCards(song.song_cards);
  if(!Number.isInteger(index)||!cards[index])throw Error('Choose a song part.');
  const material=clone(cards[index].material||extractSongMaterial(song));
  let changed=0;
  material.notes=(material.notes||[]).map(note=>{
    if(!GENERATED.has(note.provenance)||!['drums','bass','harmony','hocket'].includes(note.role)
      || (note.role==='drums' ? !cards[index].beat : !cards[index].under)
      || note.step>=cards[index].bars*stepsPerBar(song) || Number(note.velocity??.8)<=0)return note;
    changed++;
    return {...note,velocity:Number((Number(note.velocity??.8)*.6).toFixed(6))};
  });
  if(changed)cards[index]={...cards[index],material};
  next.song_cards=cards;
  return {before:clone(song),after:next,index,changed};
}
