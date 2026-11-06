import {compileReturnSong} from './returning_part.js';
import {previewEndingIdea} from '../js/theory/melody_answer.js';
import {SCALES} from '../js/theory/harmony.js';
import {stepsPerBar} from '../js/theory/musical_time.js';

export const MELODY_DIRECTIONS = [
  {id:'rise', label:'Rise', description:'Later notes move up one step in the key.'},
  {id:'fall', label:'Fall', description:'Later notes move down one step in the key.'},
  {id:'arch', label:'Rise then settle', description:'Middle notes move up. The last note stays.'},
];

/** A detached, source-derived suggestion, never an in-place correction. */
export function exploreMelody(doc, index, direction='rise', {placement='insert'}={}) {
  const base=previewEndingIdea(doc,index,{placement});
  const result={...base,kind:'melody',direction};
  const decline=reason=>({...result,changed:false,after:structuredClone(base.before),reason});
  if(!base.changed)return result;
  if(!MELODY_DIRECTIONS.some(d=>d.id===direction))return decline('Choose a tune idea.');
  const source=doc.song_cards[index],material=source.material||doc;
  const end=source.bars*stepsPerBar(doc);
  const time=n=>n.step+(n.performance?.offset_steps||0);
  const all=material.notes.filter(n=>n.role==='lead'&&time(n)<end);
  const personal=all.filter(n=>['user_placed','hummed_confirmed'].includes(n.provenance));
  const lead=(personal.length?personal:all).slice().sort((a,b)=>time(a)-time(b));
  const positions=[...new Set(lead.map(time))];
  if(positions.length<3)return decline('Add three notes at different times to try this.');
  if(lead.some(n=>!Number.isInteger(n.concrete?.midi_pitch)))return decline('This tune needs a different kind of edit.');
  const root=((doc.global_context?.root_pc||0)%12+12)%12;
  const scale=SCALES[doc.global_context?.scale_type||'major'];
  const ids=new Set(material.notes.map(n=>n.id));
  const proposed=new Map();
  for(const n of lead){
    const rank=positions.indexOf(time(n))/(positions.length-1);
    const delta=direction==='arch'?(rank>0&&rank<1?1:0):rank>=.5?(direction==='fall'?-1:1):0;
    if(!delta)continue;
    let pitch=n.concrete.midi_pitch+delta;
    while(pitch>=0&&pitch<=127&&!scale.includes((pitch-root+120)%12))pitch+=delta;
    if(pitch<0||pitch>127)return decline('This idea needs more pitch space. Your tune stays.');
    let id=`melody-${base.after.song_cards[base.afterIndex].section_id}-${proposed.size+1}`;
    while(ids.has(id))id+='-v';ids.add(id);
    const note={...structuredClone(n),id,source_note_id:n.id,provenance:'jam_generated',
      generated_by:'musiclab_melody_explorer',pitch_lock_mode:'concrete',
      concrete:{...n.concrete,midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)}};
    delete note.capture_occurrence;delete note.edited_from_generator;
    proposed.set(n.id,note);
  }
  const card=base.after.song_cards[base.afterIndex];
  if(placement !== 'replace') card.role_name=MELODY_DIRECTIONS.find(d=>d.id===direction).label;
  card.material.notes=material.notes.map(n=>proposed.get(n.id)||structuredClone(n));
  delete card.material.tune_grid_state;
  // Following-part effects can change earlier music: verify every existing part.
  const original=compileReturnSong(doc), candidate=compileReturnSong(base.after);
  const local=(song,cards,index)=>{
    const start=cards.slice(0,index).reduce((sum,c)=>sum+c.bars*stepsPerBar(doc),0);
    return song.events.filter(e=>e.card===index).map(e=>{
      const n=structuredClone(e);delete n.card;delete n.section_id;
      n.step=Number((n.step-start).toFixed(9));n.start_sec-=start*15/song.bpm;return n;
    });
  };
  for(let i=0;i<doc.song_cards.length;i++){
    if(placement === 'replace' && i===index)continue;
    const next=placement === 'replace' ? i : i>=base.afterIndex?i+1:i;
    const a=local(original,doc.song_cards,i),b=local(candidate,base.after.song_cards,next);
    // The compiler rounds absolute start seconds to four decimals. Moving a
    // section can change that rounding by one 0.1ms unit; note steps stay exact.
    const same=a.length===b.length&&a.every((n,j)=>{
      const {start_sec:t,...rest}=n,{start_sec:u,...other}=b[j];
      return Math.abs(t-u)<=.000100001&&JSON.stringify(rest)===JSON.stringify(other);
    });
    if(!same)return decline('This idea would change another part. Your song stays.');
  }
  return {...result,beforeNotes:structuredClone(lead),afterNotes:structuredClone(lead.map(n=>proposed.get(n.id)||n))};
}

/** Two pictures share pitch/time scales; widths are the actual held lengths. */
export function melodyPictures(trial) {
  if(!trial.changed)return '';
  const notes=[...trial.beforeNotes,...trial.afterNotes];
  const min=Math.min(...notes.map(n=>n.concrete.midi_pitch))-2,max=Math.max(...notes.map(n=>n.concrete.midi_pitch))+2;
  const time=n=>n.step+(n.performance?.offset_steps||0);
  const end=Math.max(...notes.map(n=>time(n)+n.duration_steps));
  return [trial.beforeNotes,trial.afterNotes].map((row,i)=>`<figure><figcaption>${i?'Idea':'Original'}</figcaption><svg viewBox="0 0 320 100" role="img" aria-label="${i?'Suggested':'Original'} tune. Time goes right; pitch goes up.">${row.map(n=>`<rect x="${4+time(n)/end*306}" y="${8+(max-n.concrete.midi_pitch)/(max-min)*76}" width="${Math.max(2,n.duration_steps/end*306)}" height="6" rx="3" fill="${i?'#ffb347':'#33d9ee'}"/>`).join('')}</svg></figure>`).join('');
}
