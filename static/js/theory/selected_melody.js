/** Commit a complete editable score. This is not an audio-clock recording. */
export function selectedMelody(source,song,{context,choice,performanceArchive=null}={}) {
  const doc=structuredClone(source),stepSec=15/song.bpm;
  doc.capture_source=structuredClone(performanceArchive||(source.captured_performance?source:source.capture_source||source));
  doc.melody_original=structuredClone(source.melody_original||source);
  delete doc.captured_performance;
  doc.notes=song.events.map(event=>{
    const note=structuredClone(event);
    const offset=note.performance?.version===1?note.performance.offset_steps||0:note.step%2?(song.swing??.5)-.5:0;
    for(const key of ['start_sec','duration_sec','card','section_id','capture_occurrence'])delete note[key];
    note.duration_steps=event.duration_steps??event.duration_sec/stepSec;
    // Explicit performance offsets are nonnegative fractions. An early swung
    // attack belongs to the preceding step, not a negative offset the compiler drops.
    const position=note.step+offset;
    note.step=Math.floor(position);
    note.performance={version:1,offset_steps:position-note.step};
    return note;
  });
  doc.global_context={...doc.global_context,bpm:song.bpm,bars:song.total_steps/(song.steps_per_bar||16),
    steps_per_bar:song.steps_per_bar||16,root_pc:context.root};
  doc.auto_harmony_stabs=false;
  doc.scaffold_options={...doc.scaffold_options,humanize:false,hocket_choke:false,pre_drop_silence:false};
  doc.song_cards=[{bars:song.total_steps/(song.steps_per_bar||16),role_name:'My melody',beat:true,tune:true,under:true,fx:null,big:false}];
  const {source:ignored,...savedContext}=context;
  doc.capture_notes={melody_field:{version:4,context:structuredClone(savedContext),choice:structuredClone(choice),
    semantics:'Complete chosen score; performed exploration is retained separately in capture_source.'}};
  doc.capture_development_started=true;doc.song_path={version:1,step:'melody'};
  delete doc.tune_grid_state;
  return doc;
}
