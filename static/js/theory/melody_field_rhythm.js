/** Deterministic phrase edits. Never applied to personal-source attacks or gates. */
export function melodyFieldRhythm(notes, source, region, {bpm,totalSteps,stepsPerBar,swing=.5}) {
  const stepSec=15/bpm;
  const weights=Array(6).fill(0);
  weights[region.first]=region.radius*(1-region.mix);
  weights[region.next]+=region.radius*region.mix;
  const add=weights[0]*.8+weights[2]+weights[5]*.7;
  const space=weights[3]+weights[5]*.45;
  const short=weights[2]*.7+weights[4]*.9;
  const flow=weights[1];
  const at=n=>n.step+(n.performance?.version===1?n.performance.offset_steps||0:n.step%2?swing-.5:0);
  const originals=new Map(source.map(n=>[n.id,n]));
  const lead=notes.filter(n=>n.role==='lead').sort((a,b)=>at(a)-at(b));
  const ids=new Set(notes.map(n=>n.id)),result=[],addedPerBar=new Map();
  const sourceOf=n=>originals.get(n.id)||originals.get(n.source_note_id);
  const eligible=n=>sourceOf(n)?.provenance==='jam_generated';
  const overlaps=(start,length,n)=>n.duration_steps>=totalSteps||[-totalSteps,0,totalSteps].some(shift=>
    at(n)+shift<start+length && at(n)+shift+n.duration_steps>start);
  const firstByBar=new Set(),seenBars=new Set();
  for(const n of lead) {
    const bar=Math.floor(at(n)/stepsPerBar);
    if(!seenBars.has(bar)){firstByBar.add(n.id);seenBars.add(bar);}
  }
  const unique=(id)=>{while(ids.has(id))id+='v';ids.add(id);return id;};
  const derived=(n,tag)=>{
    const copy=structuredClone(n);
    copy.id=unique(`field-v3-${n.id}-${tag}`);
    copy.source_note_id=sourceOf(n)?.id||n.source_note_id||n.id;
    copy.provenance='jam_generated';copy.generated_by='musiclab_melody_field';
    delete copy.capture_occurrence;delete copy.edited_from_generator;
    return copy;
  };
  notes.forEach(n=>{if(n.role!=='lead')result.push(n);});
  lead.forEach((n,i)=>{
    if(!eligible(n)){result.push(n);return;}
    const start=at(n),bar=Math.floor(start/stepsPerBar),end=start+n.duration_steps;
    const simultaneous=lead.some(other=>other!==n&&Math.abs(at(other)-start)<1e-8);
    const anchor=firstByBar.has(n.id)||i===lead.length-1||simultaneous;
    const threshold=.25+((i*7)%11)/20;
    if(!anchor&&space>threshold){return;}
    let current=n;
    // Do not alter polyphonic or crossing gates. Source personal notes are always protected.
    const next=lead.find(other=>at(other)>start+1e-8);
    const room=Math.min(next?at(next):totalSteps,(bar+1)*stepsPerBar)-start;
    const overlapping=lead.some(other=>other!==n&&overlaps(start,.000001,other));
    if(!simultaneous&&!overlapping&&end<=start+room&&room>0) {
      const length=Math.max(.25,Math.min(room,n.duration_steps*(1-short*.7)+flow*Math.max(0,room-n.duration_steps)*.8));
      if(Math.abs(length-n.duration_steps)>.01) {
        current=derived(n,`gate-${length}`);current.duration_steps=length;current.duration_sec=length*stepSec;
      }
    }
    result.push(current);
    // Add only in genuinely empty space; never cut a hold to make room.
    const onset=Math.ceil((Math.max(end,start+1))/2)*2;
    const stop=Math.min(next?at(next):totalSteps,(bar+1)*stepsPerBar);
    const blocked=lead.some(other=>overlaps(onset,Math.min(1,stop-onset)*.75,other));
    if(add>threshold&&!blocked&&!simultaneous&&onset+.5<=stop
      &&onset>=start+current.duration_steps&&(addedPerBar.get(bar)||0)<2) {
      const extra=derived(n,'reply');extra.step=onset;extra.performance={version:1,offset_steps:0};
      extra.start_sec=onset*stepSec;extra.duration_steps=Math.min(1,stop-onset)*.75;
      extra.duration_sec=extra.duration_steps*stepSec;extra.velocity=(n.velocity??.7)*.85;
      // Repeat a source tone: a rhythmic answer, without inventing unsupported harmony.
      result.push(extra);addedPerBar.set(bar,(addedPerBar.get(bar)||0)+1);
    }
  });
  return result;
}
