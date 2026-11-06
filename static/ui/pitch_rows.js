export const PITCH_ROW_HEIGHT = 28;
const NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export function pitchName(midi) {
  const rounded=Math.round(midi);
  return `${NAMES[((rounded%12)+12)%12]}${Math.floor(rounded/12)-1}${midi!==rounded?' ~':''}`;
}
export function pitchRows(notes) {
  const pitches=notes.map(n=>Number(n.concrete?.midi_pitch??n.concrete?.midi??60)).filter(Number.isFinite);
  let low=Math.min(127,Math.max(0,Math.floor(Math.min(...(pitches.length?pitches:[60])))-2));
  let high=Math.max(0,Math.min(127,Math.ceil(Math.max(...(pitches.length?pitches:[60])))+2));
  while(high-low<11) { if(low>0)low--; if(high-low<11&&high<127)high++; }
  return {low,high,rowHeight:PITCH_ROW_HEIGHT,height:(high-low+1)*PITCH_ROW_HEIGHT,
    rows:Array.from({length:high-low+1},(_,i)=>({midi:high-i,label:pitchName(high-i),black:[1,3,6,8,10].includes((high-i)%12)}))};
}
export const pitchTop=(midi,range)=>(range.high-midi)*range.rowHeight;
