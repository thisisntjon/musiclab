import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyUnderneath,clearUnderneath,chordOptions} from '../../../static/js/theory/underneath.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';

test('collision protection includes actual swing scheduling around performed holds',()=>{
  const doc=newPlayDoc();doc.global_context.swing=.68;doc.scaffold_options={humanize:true};
  doc.notes=[{id:'kick',step:1,duration_steps:1,role:'drums',patch_id:'kick'},
    {id:'own',step:5,duration_steps:.5,role:'bass',provenance:'user_placed',patch_id:'clean_bass',
      concrete:{midi_pitch:48},performance:{version:1,offset_steps:.05}}];
  for(const performed of [true,false]) {
    if(!performed) delete doc.notes[1].performance;
    const next=applyUnderneath(doc,{bass:'bass_kick_lock',chords:0},chordOptions(doc));
    const events=compileSongStandalone(next).events;
    const personal=events.find(n=>n.id==='own');
    for(const event of events.filter(n=>n.generated_by==='musiclab_underneath'))
      assert.ok(event.start_sec+event.duration_sec<=personal.start_sec || event.start_sec>=personal.start_sec+personal.duration_sec);
  }
});

test('all accompaniment choices preserve personal bass and make room for held gates',()=>{
  const doc=newPlayDoc();
  const own=[{id:'bass-sust-0',step:30,provenance:'user_placed'},
    {id:'hum-bass',step:4,provenance:'hummed_confirmed'}].map(n=>({...n,role:'bass',patch_id:'warm_keys',
      duration_steps:3.75,velocity:.42,concrete:{midi_pitch:48},source_note_id:`source-${n.id}`,
      performance:{version:1,offset_steps:.2,hold_id:n.id}}));
  doc.notes.push(...own);const original=structuredClone(doc);
  for(const style of ['bass_kick_lock','bass_gap_answer','bass_warm_sustained','bass_driving_8ths','bass_funk_bounce']) {
    let next=applyUnderneath(doc,{bass:style,chords:0,feel:'warm'},chordOptions(doc));
    next=applyUnderneath(JSON.parse(JSON.stringify(next)),{bass:style,chords:1,feel:'floating'},chordOptions(next));
    assert.deepEqual(doc,original);
    for(const note of own) assert.deepEqual(next.notes.filter(n=>n.id===note.id),[note]);
    assert.equal(new Set(next.notes.map(n=>n.id)).size,next.notes.length);
    for(const note of next.notes.filter(n=>n.generated_by==='musiclab_underneath')) {
      assert.equal(note.provenance,'generator_default');
      assert.ok(own.every(n=>note.step+note.duration_steps<=n.step+.2 || note.step>=n.step+.2+n.duration_steps));
    }
    const cleared=clearUnderneath(next);
    assert.deepEqual(cleared.notes.filter(n=>n.role==='bass'),own);
    assert.deepEqual(cleared.notes.filter(n=>n.role!=='bass'),doc.notes.filter(n=>n.role!=='bass'));
  }
});
