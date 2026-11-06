/** Explicit, local exact echo. Originals are read, never edited or quantized. */
export function planJamAnswer(records, {now, start, id, windowSec, beatSec = null}) {
  const source = records.filter(record => {
    const event=record.event;
    return event?.provenance==='user_placed' && event.source_note_id?.startsWith('jam-live-')
      && event.role!=='drums' && event.patch_id!=='reverse_swell'
      && Number.isFinite(event.concrete?.freq_hz) && event.concrete.freq_hz>0
      && record.time>=now-windowSec && record.time<now
      && record.duration>0 && (record.time+record.duration<=now+1e-9
        || (Number.isFinite(record.released_at)&&record.released_at<=now));
  }).sort((a,b)=>a.time-b.time||a.occurrence-b.occurrence).slice(-4);
  if(!source.length)return null;
  // A released tap can still be ringing through its minimum gate. Preserve it,
  // and wait for every selected gate before starting the echo on the beat.
  const gateEnd=Math.max(...source.map(record=>record.time+record.duration));
  if(gateEnd>start)start+=beatSec>0?Math.ceil((gateEnd-start)/beatSec)*beatSec:gateEnd-start;
  const events=source.map((record,index)=>{
    const event=JSON.parse(JSON.stringify(record.event));
    const sourceId=event.source_note_id;
    for(const key of ['performance','start_sec','duration_steps','step','card','section_id'])delete event[key];
    return {time:start+record.time-source[0].time, state:'requested', event:{...event,
      id:`${id}-${index}`,source_note_id:`${id}-${index}`,role:'lead',provenance:'jam_generated',
      duration_sec:record.duration,velocity:(event.velocity??.85)*.8,
      response_to:[sourceId],response:{version:1,kind:'exact-echo',source_occurrence:record.occurrence,
        source_time:record.time,source_duration:record.duration}}};
  });
  return {id,start,end:Math.max(...events.map(item=>item.time+item.event.duration_sec)),events};
}
