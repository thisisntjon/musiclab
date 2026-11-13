/** A complete editable groove, not a recording of time spent in Jam.
 * The caller retains the unmodified performance separately as sourceDoc.
 * Only the audio-clock-reached backing is used; pending style requests are not.
 */
export function melodyWorkspace(song, backing, capture, gridOrigin) {
  if (!song?.events || !Number.isFinite(gridOrigin) || !Number.isFinite(capture?.end))
    throw new Error('The current groove is not ready.');
  const result=structuredClone(song), stepSec=15/song.bpm;
  const length=song.total_steps, cycle=length*stepSec;
  if (!Number.isInteger(length)||length<1||!Number.isFinite(cycle)||cycle<=0)
    throw new Error('The current groove has no complete phrase.');
  const recent=capture.events.filter(r=>r.event?.provenance==='user_placed'
    && r.time<capture.end && r.time>=capture.end-cycle);
  const ownIds=new Set(recent.flatMap(r=>[r.event.id,r.event.source_note_id]).filter(Boolean));
  const base=Array.isArray(backing?.events)
    ? [...song.events.filter(e=>e.provenance!=='jam_generated'),...backing.events]
    : song.events;
  const events=structuredClone(base.filter(e=>!ownIds.has(e.id)&&!ownIds.has(e.source_note_id)));
  for(const r of recent) {
    const position=(((r.time-gridOrigin)/stepSec)%length+length)%length;
    const step=Math.floor(position+1e-9),offset=Math.max(0,position-step);
    const event=structuredClone(r.event);
    if(event.role==='lead' && event.concrete?.midi_pitch===undefined) {
      const pitch=69+12*Math.log2(event.concrete?.freq_hz/440);
      event.concrete={...event.concrete,midi_pitch:Math.abs(pitch-Math.round(pitch))<.01?Math.round(pitch):pitch};
    }
    events.push({...event,id:`workspace-${r.occurrence}-${r.event.id}`,
      source_note_id:r.event.source_note_id||r.event.id,step,
      performance:{version:1,offset_steps:offset},start_sec:position*stepSec,
      duration_sec:r.duration,duration_steps:r.duration/stepSec});
  }
  result.events=events;
  return result;
}
