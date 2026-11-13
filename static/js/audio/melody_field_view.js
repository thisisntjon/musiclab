/** Rotate a captured phrase into a running audio grid without altering its saved notes.
 * captureOrigin and gridOrigin are audio-clock seconds, not wall-clock time.
 */
export function melodyFieldPlaybackView(song, captureOrigin, gridOrigin) {
  if(!Number.isFinite(captureOrigin)||!Number.isFinite(gridOrigin)
    || !Number.isFinite(song?.bpm)||song.bpm<=0||!Number.isInteger(song.total_steps)||song.total_steps<1)
    throw new Error('Invalid melody playback clock.');
  const stepSec=15/song.bpm,period=song.total_steps;
  const shift=(captureOrigin-gridOrigin)/stepSec;
  const view=structuredClone(song);
  view.events=view.events.map(event=>{
    const offset=event.performance?.version===1 ? event.performance.offset_steps||0
      :event.step%2 ? ((song.swing??.5)-.5) : 0;
    const position=((event.step+offset+shift)%period+period)%period;
    const near=Math.round(position),precise=Math.abs(near-position)<1e-8?near%period:position;
    const step=Math.floor(precise);
    return {...event,step,start_sec:precise*stepSec,
      performance:{version:1,offset_steps:precise-step}};
  });
  return view;
}
