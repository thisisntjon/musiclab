/** Historical band context, separate from the person's current editable scale. */
export function validSourceMode(mode){
 const intervals=mode?.name==='dorian'?[0,2,3,5,7,9,10]:mode?.name==='mixolydian'?[0,2,4,5,7,9,10]:null;
 return mode?.version===1&&intervals!==null&&Number.isInteger(mode.tonic)&&mode.tonic>=0&&mode.tonic<12
  &&JSON.stringify(mode.intervals)===JSON.stringify(intervals);
}
export function validSourceHarmony(chord){
 const pcs=chord?.pitch_classes;
 return chord?.version===1&&Array.isArray(pcs)&&pcs.length>=3&&pcs.length<=5
  &&pcs.every(n=>Number.isInteger(n)&&n>=0&&n<12)&&new Set(pcs).size===pcs.length;
}
/** A generated individual voice caches one frequency, not an authored chord.
 * Resolve that cache on the compiler's copy; leave originals and chord arrays intact. */
export function alignIndividualSourceVoice(note){
 const voices=note.voiced_freqs,freq=note.concrete?.freq_hz;
 if(note.provenance==='jam_generated'&&note.pitch_lock_mode==='concrete'
  &&typeof note.voice_id==='string'&&note.voice_id.length>0&&validSourceHarmony(note.generated_harmony)
  &&Array.isArray(voices)&&voices.length===1&&Number.isFinite(voices[0])&&voices[0]>0
  &&Number.isFinite(freq)&&freq>0&&Math.abs(voices[0]-freq)>.001)note.voiced_freqs=[freq];
}
export function sourceModeGuidance(note){
 const mode=note.generated_mode||note.performed_mode;
 if(validSourceMode(mode))return `Source band: ${mode.name==='dorian'?'Dorian':'Mixolydian'}. Pitch kept as written.`;
 if(validSourceHarmony(note.generated_harmony))
  return 'Source band: harmony context. Pitch kept as written.';
 if(note.provenance==='user_placed'&&typeof note.source_note_id==='string'&&note.source_note_id.startsWith('jam-live-'))
  return 'From your performance. Pitch kept as written.';
 return null;
}
