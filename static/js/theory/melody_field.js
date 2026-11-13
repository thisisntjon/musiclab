import {melodyFieldRhythm} from './melody_field_rhythm.js';
import {SCALES} from './harmony.js';

const clone = value => structuredClone(value);
export const MELODY_FIELD_REGIONS=['Rise','Wave','Again','Fall','Dip','Return'];
export const MELODY_FIELD_V3_REGIONS=['Climb','Flow','Bounce','Space','Pulse','Answer'];
export function melodyFieldRegion(position,version=2) {
  const names=version===3?MELODY_FIELD_V3_REGIONS:MELODY_FIELD_REGIONS;
  const p=melodyFieldPosition(position),radius=Math.hypot(p.x,p.y);
  const sector=((Math.atan2(p.x,p.y)/(2*Math.PI)+1)%1)*6;
  const first=Math.floor(sector)%6,mix=sector-Math.floor(sector);
  return {radius,first,next:(first+1)%6,mix,
    label:radius<.02?'Original':mix<.1?names[first]:mix>.9?names[(first+1)%6]:`${names[first]} / ${names[(first+1)%6]}`};
}
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** A field owns an exact source. Exploring never edits that source or its band. */
export function createMelodyField(sourceNotes, {root=0,scale='major',sourceId='tune',version=1,bpm=100,totalSteps=64,stepsPerBar=16,swing=.5}={}) {
  if (![1,2,3].includes(version) || !Array.isArray(sourceNotes) || !Number.isInteger(root)
    || root<0 || root>11 || !Object.hasOwn(SCALES,scale) || typeof sourceId!=='string')
    throw new Error('Invalid melody field source or context.');
  if(version===3&&(!Number.isFinite(swing)||swing<0||swing>1||!Number.isFinite(bpm)||bpm<=0||!Number.isInteger(totalSteps)||totalSteps<1||!Number.isInteger(stepsPerBar)||stepsPerBar<1))throw new Error('Invalid phrase clock.');
  const ids=new Set();
  for (const n of sourceNotes) {
    if (!n || typeof n.id!=='string' || ids.has(n.id) || !Number.isFinite(n.step)
      || !Number.isFinite(n.duration_steps) || n.duration_steps<=0
      || (n.performance?.offset_steps!==undefined && !Number.isFinite(n.performance.offset_steps))
      || !Number.isFinite(n.step+(n.performance?.offset_steps||0)+n.duration_steps))
      throw new Error('Melody source needs unique notes with finite timing and lengths.');
    ids.add(n.id);
    if (n.role==='lead' && (!Number.isInteger(n.concrete?.midi_pitch)
      || n.concrete.midi_pitch<0 || n.concrete.midi_pitch>127
      || (n.concrete.freq_hz!==undefined && (!Number.isFinite(n.concrete.freq_hz)||n.concrete.freq_hz<=0))))
      throw new Error('Melody source needs concrete pitches. Your source is unchanged.');
  }
  return freeze({version,sourceId,root,scale,...(version===3?{bpm,totalSteps,stepsPerBar,swing}:{}),notes:clone(sourceNotes)});
}

export function melodyFieldPosition({x,y}={}) {
  if (!Number.isFinite(x)||!Number.isFinite(y))throw new RangeError('Melody position must be finite.');
  // Scale before hypot: even finite extreme coordinates must not overflow.
  const largest=Math.max(1,Math.abs(x),Math.abs(y));
  const scaled=Math.hypot(x/largest,y/largest);
  if(largest>1 || scaled>1){x=(x/largest)/scaled;y=(y/largest)/scaled;}
  const round=n=>Math.round(n*1000)/1000 || 0;
  x=round(x);y=round(y);
  // Rounding a point on the rim can move it outside. Keep the serialized
  // lattice point inside so reopening it never normalizes to a different point.
  while(x*x+y*y>1) {
    if(Math.abs(x)>=Math.abs(y))x=round(x-Math.sign(x)*.001);
    else y=round(y-Math.sign(y)*.001);
  }
  return {x,y};
}

/** Versioned source-derived field. V1/V2 keep rhythm; V3 adds generated-only phrase edits.
 * Every candidate derives from the pinned source, never the previous candidate.
 * Simultaneous attacks move as groups; sustained/released voices are the scheduler's responsibility.
 */
export function melodyFieldVariant(field, position) {
  if(![1,2,3].includes(field?.version))throw new Error('Unsupported melody field version.');
  const version=field.version;
  const p=melodyFieldPosition(position),notes=clone(field.notes);
  if(p.x===0&&p.y===0)return {version,position:p,notes,changed:false};
  const groups=new Map();
  notes.forEach((note,index)=>{
    if(note.role!=='lead')return;
    const at=note.step+(note.performance?.version===1?note.performance.offset_steps||0:version===3&&note.step%2?field.swing-.5:0);
    if(!groups.has(at))groups.set(at,[]);
    groups.get(at).push(index);
  });
  const ordered=[...groups].sort((a,b)=>a[0]-b[0]);
  if(!ordered.length)return {version,position:p,notes,changed:false};
  const sourceMeans=ordered.map(([,indices])=>indices.reduce((sum,i)=>sum+notes[i].concrete.midi_pitch,0)/indices.length);
  const region=melodyFieldRegion(p,version);
  const mean=indices=>indices.reduce((sum,i)=>sum+notes[i].concrete.midi_pitch,0)/indices.length;
  const anchor=mean(ordered[0][1]);
  const span=ordered.at(-1)[0]-ordered[0][0];
  const ids=new Set(notes.map(n=>n.id));
  let changed=false;
  ordered.forEach(([time,indices],rank)=>{
    const u=span ? (time-ordered[0][0])/span : 1;
    // First onset is an anchor for multi-onset phrases. Solo notes can still move.
    if(ordered.length>1&&rank===0)return;
    const reach=(mean(indices)-anchor)*.65*p.x;
    const contour=6*u*p.y;
    let desired=reach+contour;
    if(version>=2) {
      const motifLength=Math.max(1,Math.ceil(ordered.length/2));
      const targets=[6*u,6*Math.sin(Math.PI*u),sourceMeans[rank%motifLength]-sourceMeans[rank],
        -6*u,-6*Math.sin(Math.PI*u),(anchor-sourceMeans[rank])*Math.max(0,(u-2/3)*3)];
      // Interpolate desired phrase shapes, not note times or competing audio loops.
      desired=region.radius*(targets[region.first]*(1-region.mix)+targets[region.next]*region.mix);
    }
    const target=Math.max(-7,Math.min(7,desired));
    const pitches=indices.map(i=>notes[i].concrete.midi_pitch);
    let best=0,bestCost=Infinity;
    for(let delta=-7;delta<=7;delta++) {
      if(pitches.some(pitch=>pitch+delta<0||pitch+delta>127))continue;
      const outside=pitches.filter(pitch=>!SCALES[field.scale].includes((pitch+delta-field.root+120)%12)).length/pitches.length;
      // Soft scale preference, not a forced correction of chromatic source notes.
      const cost=Math.abs(delta-target)+outside*.18+Math.abs(delta)*.001;
      if(cost<bestCost){best=delta;bestCost=cost;}
    }
    if(!best)return;
    indices.forEach(i=>{
      const old=notes[i],pitch=old.concrete.midi_pitch+best;
      let id=`field-v${version}-${old.id}-${best<0?'m':'p'}${Math.abs(best)}`;
      while(ids.has(id))id+='v';
      ids.add(id);
      const note={...old,id,source_note_id:old.id,provenance:'jam_generated',
        generated_by:'musiclab_melody_field',pitch_lock_mode:'concrete',
        concrete:{...old.concrete,midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)}};
      delete note.capture_occurrence;
      delete note.edited_from_generator;
      notes[i]=note;
      changed=true;
    });
  });
  if(version===3) {
    const shaped=melodyFieldRhythm(notes,field.notes,region,field);
    return {version,position:p,notes:shaped,changed:JSON.stringify(shaped)!==JSON.stringify(field.notes)};
  }
  return {version,position:p,notes,changed};
}
