import {extractSongMaterial} from './song_view.js';
/** Materialize audio-clock event occurrences, never regenerate requested backing. */
export function materializePerformance(source, capture) {
  if (!capture?.events?.length) throw new Error("Play a little music before keeping this performance.");
  const doc = JSON.parse(JSON.stringify(source));
  const stepSec = 15 / capture.bpm;
  doc.capture_source = JSON.parse(JSON.stringify(source));
  doc.captured_performance = JSON.parse(JSON.stringify(capture));
  doc.global_context.bpm = capture.bpm;
  if(capture.steps_per_bar!==undefined)doc.global_context.steps_per_bar=capture.steps_per_bar;
  doc.notes = capture.events.map(({ event, time, duration, occurrence }, index) => {
    const position = (time - capture.start) / stepSec;
    const step = Math.floor(position + 1e-9);
    const note = JSON.parse(JSON.stringify(event));
    const sourceId = note.source_note_id || note.id || null;
    for (const key of ['start_sec', 'duration_sec', 'card', 'section_id']) delete note[key];
    return { ...note, id: `take-${doc.id}-${index}`, source_note_id: sourceId,
      capture_occurrence: occurrence, step, duration_steps: duration / stepSec,
      performance: { version: 1, offset_steps: Math.max(0, position - step) },
      pitch_lock_mode: 'concrete', concrete: { ...note.concrete,
        midi_pitch: note.concrete?.midi_pitch ?? 69 + 12 * Math.log2((note.concrete?.freq_hz || 440) / 440) } };
  });
  doc.auto_harmony_stabs = false;
  doc.scaffold_options = { ...doc.scaffold_options, humanize: false, hocket_choke: false, pre_drop_silence: false };
  doc.song_cards = [{ bars: capture.bars, role_name: 'My performance', beat: true, tune: true, under: true, fx: null, big: false }];
  doc.capture_notes = { timing: 'Audio-clock attacks and gates through Keep; partial final bar padded with silence.',
    sound: 'Not physical audibility or reverb capture. Editor mix may differ.', cutoff_seconds: capture.end - capture.start };
  if(capture.bars>4){
    const fullNotes=doc.notes,stepsPerBar=capture.steps_per_bar||16;
    const takeId=`${doc.id}:${capture.start}:${capture.end}`;
    doc.song_cards=[];
    for(let bar=0;bar<capture.bars;bar+=4){
      const bars=Math.min(4,capture.bars-bar),start=bar*stepsPerBar,end=start+bars*stepsPerBar;
      const notes=fullNotes.filter(n=>n.step>=start&&n.step<end).map(n=>({...n,step:n.step-start}));
      doc.song_cards.push({bars,role_name:`Performance ${doc.song_cards.length+1}`,beat:true,tune:true,under:true,fx:null,big:false,
        capture_segment:{version:1,take_id:takeId,start_step:start,end_step:end},material:extractSongMaterial({...doc,notes})});
    }
    doc.notes=JSON.parse(JSON.stringify(doc.song_cards[0].material.notes));
    delete doc.song_cards[0].material;
  }
  delete doc.tune_grid_state;
  return doc;
}
