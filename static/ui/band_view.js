/** Read-only overview of the compiled band. Source notes determine editability. */
export const bandKey = n => JSON.stringify([n.role || 'lead', n.patch_id || '']);
export function bandRows(events, sources, {card=0, start=0, stepSeconds=.15}={}) {
  const rows=new Map();
  const ensure=n=>{const key=bandKey(n);if(!rows.has(key))rows.set(key,{key,role:n.role,patch:n.patch_id,sources:[],events:[]});return rows.get(key);};
  for(const n of sources||[])ensure(n).sources.push(n.id);
  for(const e of events||[]){
    if(e.card!==card)continue;
    const onset=e.start_sec/stepSeconds-start, duration=e.duration_sec/stepSeconds;
    if(!Number.isFinite(onset)||!Number.isFinite(duration)||duration<=0)continue;
    ensure(e).events.push({id:e.id,onset,duration,pitch:e.concrete?.midi_pitch??60});
  }
  const order=['lead','bass','harmony','drums','hocket','fx'];
  return [...rows.values()].sort((a,b)=>(order.indexOf(a.role)<0?99:order.indexOf(a.role))-(order.indexOf(b.role)<0?99:order.indexOf(b.role))||String(a.patch).localeCompare(String(b.patch)));
}
