import {restoreMelodicPhrase} from './melodic_evolution.js';

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
    // Every pitched note of the chosen score was heard at its concrete pitch. A note that names no
    // pitch rule (a jam's developed phrase, a played key) would be re-placed on chord tones by the
    // compiler, so it is kept as heard. A note with its own rule (relational) keeps that rule.
    if(note.role!=='drums'&&note.pitch_lock_mode==null&&Number.isFinite(note.concrete?.midi_pitch))note.pitch_lock_mode='concrete';
    return note;
  });
  // Back to jam resumes the jam's saved phrase over this score's lead. Keep it only while the kept
  // generated lead is that phrase as the jam played it (same phrase, own sound); a melody in another
  // sound or with other notes is what the jam continues from instead. The archives keep it as it was.
  const evolution=doc.jam_session?.melodic_evolution,phrase=evolution?restoreMelodicPhrase(evolution):null;
  if(phrase&&doc.notes.some(n=>n.role==='lead'&&n.provenance==='jam_generated'&&!n.edited_from_generator
    &&(n.evolution?.phraseOrdinal!==evolution.phraseOrdinal||n.patch_id!==phrase.patch||n.sound_base)))delete doc.jam_session.melodic_evolution;
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
