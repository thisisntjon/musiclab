import { matchRemaining } from './ordered_note_match.js';
import {showcaseBacking} from './listening_showcase.js';
import {skaBacking} from './ska_scene.js';
import {rocksteadyBacking} from './rocksteady_scene.js';
import {pulseBacking} from './pulse_scenes.js';
import {bassInterval} from './underneath.js';

export function validMusicField(field) {
  return field && typeof field === 'object' && !Array.isArray(field) && [1,2,3,4,5].includes(field.version)
    && ['x','y'].every(axis => Number.isFinite(field[axis]) && field[axis] >= 0 && field[axis] <= 1);
}
export const ROOTS_FIELD_MAX_BPM=160;
export const sceneTempoAllowed=(id,bpm)=>id!=='black-metal-v1'||bpm<=160;
export function musicFieldTempoAllowed(doc,bpm=doc?.global_context?.bpm??100) {
  return (!([3,4,5].includes(doc?.jam_session?.music_field?.version)||['catalogue-circle-v1','catalogue-circle-v2'].includes(doc?.jam_session?.exploration_map)||doc?.jam_session?.scene_id==='black-metal-v1'))||Boolean(doc.captured_performance)||bpm<=ROOTS_FIELD_MAX_BPM;
}
const onset = note => note.step + (note.performance?.offset_steps || 0);
const lerp = (a,b,t) => a + (b-a)*t;
export const FIELD_REGIONS=Object.freeze(['Offbeat strum','Pop backbeat','Syncopated funk','Dance pulse']);
export const CONNECTED_FIELD_REGIONS=Object.freeze(['Reggae','Rocksteady',...FIELD_REGIONS]);
export function musicFieldDescription(field) {
  if(field.version===5){const p=field.x*2,lo=Math.floor(p),hi=Math.min(2,lo+1),names=['Ska','Rocksteady','Reggae'];return lo===hi?names[lo]:`${names[lo]} to ${names[hi]} (${Math.round((p-lo)*100)}%)`;}
  if(field.version===4){const p=field.x*5,lo=Math.floor(p),hi=Math.min(5,lo+1);return lo===hi?CONNECTED_FIELD_REGIONS[lo]:`${CONNECTED_FIELD_REGIONS[lo]} to ${CONNECTED_FIELD_REGIONS[hi]} (${Math.round((p-lo)*100)}%)`;}
  if(field.version===3)return `Rocksteady to Reggae (${Math.round(field.x*100)}%)`;
  if(field.version===1)return `${Math.round(field.x*100)}% steady pulse`;
  const p=field.x*3,lo=Math.floor(p),hi=Math.min(3,lo+1),mix=p-lo;
  return mix<.001?FIELD_REGIONS[lo]:`${FIELD_REGIONS[lo]} to ${FIELD_REGIONS[hi]} (${Math.round(mix*100)}%)`;
}

/** A bounded original rhythmic field on the modern shared chord plan.
 * One voice per matched event: timing/gates move, rather than stacking bands.
 * Patches and pitches remain discrete; this is not continuous timbre synthesis.
 */
export function musicFieldBacking(doc, session, preserved) {
  const f=session.music_field;
  if (!validMusicField(f)) throw Error('Unsupported musical field. Your notes are unchanged.');
  if([3,4,5].includes(f.version)&&(doc.global_context?.bpm??100)>ROOTS_FIELD_MAX_BPM)throw Error('Rocksteady / Reggae exploration supports up to 160 BPM. Your tempo and notes are unchanged.');
  if(f.version===5) {
    // Full original recipes on one explicitly shared electric-piano/banjo palette.
    // Preserve all four bass gestures, including Ska's approach to the next chord.
    const endpoint=index=>{
      const id=['ska-v1','rocksteady-v1','reggae-v1'][index];
      const settings={...session,density:1,color:session.band_chord_patch==='sampled_banjo_v1'?2:index===0?3:1,scene_variant:'base',scene_id:id};
      const motif=showcaseBacking(doc,{...settings,style_spectrum:1,showcase_arrangement:'contrast-v1',showcase_palette:'sampled'},[]).filter(n=>n.role==='lead');
      return [skaBacking,rocksteadyBacking,pulseBacking][index](doc,settings,[],motif);
    };
    const p=f.x*2,lo=Math.floor(p),hi=Math.min(2,lo+1);
    return blendMusicField(doc,f,endpoint(lo),endpoint(hi),p-lo,preserved);
  }
  if(f.version===4) {
    // One world coordinate over tested local charts. Old coordinates retain
    // their meanings; only the Rocksteady/Offbeat seam needs a new adapter.
    const p=f.x*5;
    const local=(version,x,own=preserved)=>musicFieldBacking(doc,{...session,music_field:{version,x:Math.max(0,Math.min(1,x)),y:f.y}},own);
    const notes=p<=1?local(3,1-p):p>=2?local(2,(p-2)/3):blendMusicField(doc,f,local(3,0,[]),local(2,0,[]),p-1,preserved,true);
    return notes.map(n=>({...n,id:`connected:${n.id}`,...(n.role==='harmony'&&session.band_chord_patch?{patch_id:session.band_chord_patch}:{})}));
  }
  const endpoint = index => {
    if(f.version===3) {
      // Explicit compact arrangement: two chord tones on every offbeat,
      // full bass phrases and odd-bar keyboard replies. Shared EP/banjo voice.
      const settings={...session,density:1,color:1,scene_variant:'base',scene_id:index===0?'rocksteady-v1':'reggae-v1'};
      const motif=showcaseBacking(doc,{...settings,style_spectrum:1,showcase_arrangement:'contrast-v1',showcase_palette:'sampled'},[]).filter(n=>n.role==='lead');
      const notes=(index===0?rocksteadyBacking:pulseBacking)(doc,settings,[],motif);
      return notes.filter(n=>n.role!=='harmony'||notes.filter(other=>other.role==='harmony'&&other.step===n.step).sort((a,b)=>a.concrete.midi_pitch-b.concrete.midi_pitch).indexOf(n)<2)
        .map(n=>n.role==='harmony'&&session.band_chord_patch?{...n,patch_id:session.band_chord_patch}:n);
    }
    const notes=showcaseBacking(doc,{...session,style_spectrum:index,
      showcase_arrangement:'contrast-v1',showcase_palette:'sampled',density:1,color:1},[]);
    // Deliberate two-note shells twice per bar leave room for the person and
    // release tails even at fast tempos. Never thin personal or evolving notes.
    return notes.filter(n=>{
      if(n.role==='harmony') {
        const steps=f.version===1?[2,10]:[...new Set(notes.filter(other=>other.role==='harmony'&&Math.floor(other.step/16)===Math.floor(n.step/16)).map(other=>other.step%16))].sort((a,b)=>a-b).filter((_,i,all)=>i===0||i===(all.length>2?2:1));
        if(!steps.includes(n.step%16))return false;
        const chord=notes.filter(other=>other.role==='harmony'&&other.step===n.step)
          .sort((a,b)=>a.concrete.midi_pitch-b.concrete.midi_pitch);
        return chord.indexOf(n)<2;
      }
      if(n.role==='bass')return notes.filter(other=>other.role==='bass'&&Math.floor(other.step/16)===Math.floor(n.step/16)).indexOf(n)<3;
      return true;
    }).map(n=>n.role==='harmony'?{...n,patch_id:'sampled_electric_piano_v1'}:n);
  };
  const position=f.version===2?f.x*3:f.x;
  const lower=f.version===2?Math.floor(position):0,upper=f.version===1?3:f.version===3?1:Math.min(3,lower+1);
  const mix=f.version===2?position-lower:f.x;
  return blendMusicField(doc,f,endpoint(lower),endpoint(upper),mix,preserved);
}

function blendMusicField(doc,f,a,b,mix,preserved,prepared=false) {
  const groups=new Map();
  const groupKey=n=>`${Math.floor(n.step/16)}:${n.role}:${n.role==='drums'?(n.patch_id==='clap'?'snare':n.patch_id):f.version>=3&&n.role==='bass'?'line':n.concrete.midi_pitch}`;
  for(const [side,notes] of [[0,a],[1,b]])for(const note of notes){
    const key=groupKey(note);if(!groups.has(key))groups.set(key,[[],[]]);groups.get(key)[side].push(note);
  }
  const result=[];
  for(const [key,sides] of groups){
    for(const side of sides)side.sort((a,b)=>onset(a)-onset(b));
    // Keep shared rhythmic anchors paired before matching remaining gestures.
    // In particular kick8 must pair with kick8, not slide onto an extra kick4.
    const lefts=[...sides[0]],rights=[...sides[1]],pairs=[];
    for(let i=(f.version>=3&&lefts[0]?.role==='bass'?-1:lefts.length-1);i>=0;i--){
      const j=rights.findIndex(n=>Math.abs(onset(n)-onset(lefts[i]))<1e-9);
      if(j>=0)pairs.push([lefts.splice(i,1)[0],rights.splice(j,1)[0]]);
    }
    if(f.version>=2)pairs.push(...matchRemaining(lefts,rights));
    else for(let i=0;i<Math.max(lefts.length,rights.length);i++)pairs.push([lefts[i],rights[i]]);
    pairs.sort((a,b)=>onset(a[0]||a[1])-onset(b[0]||b[1]));
    for(const [i,[left,right]] of pairs.entries()){
      const base=left||right;
      const weight=left&&right?1:left?1-mix:mix;
      if(weight<=0)continue;
      const time=left&&right?lerp(onset(left),onset(right),mix):onset(base);
      const velocity=(left&&right?lerp(left.velocity,right.velocity,mix):base.velocity)*weight*(base.role==='drums'&&!prepared?.3:1);
      const gate=left&&right?lerp(left.duration_steps,right.duration_steps,mix):base.duration_steps;
      const note={...base,id:`music-field-v${f.version}:${key}:${i}`,step:Math.floor(time),velocity,
        duration_steps:prepared?gate:[3,5].includes(f.version)?(base.role==='harmony'?gate*lerp(.5,1.5,f.y):gate):base.role==='harmony'||base.role==='bass'?Math.min(3,gate*lerp(.5,1.5,f.y)):gate,
        performance:{version:1,offset_steps:time-Math.floor(time)}};
      if(f.version>=3&&base.role==='bass'&&left&&right&&mix>=.5)note.concrete={...right.concrete};
      if(left&&right&&left.patch_id!==right.patch_id)note.patch_id=mix<.5?left.patch_id:right.patch_id;
      const [start,end]=bassInterval(note,doc);
      if(preserved.some(own=>own.role===note.role&&(note.role==='drums'
        ?own.patch_id===note.patch_id&&own.step===note.step
        :(()=>{const [a,b]=bassInterval(own,doc);return start<b&&a<end;})())))continue;
      result.push(note);
    }
  }
  if(f.version>=3) {
    // One generated bass line. Keep intentional endpoint rests; do not let
    // interpolated gates run into the next attack. Personal gates are untouched.
    const bass=result.filter(n=>n.role==='bass').sort((a,b)=>onset(a)-onset(b));
    for(let i=0;i<bass.length;i++)bass[i].duration_steps=Math.min(bass[i].duration_steps,(i+1<bass.length?onset(bass[i+1]):64)-onset(bass[i]));
  }
  return result.sort((a,b)=>onset(a)-onset(b)||a.id.localeCompare(b.id));
}
