import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tuneGridFromNotes, notesFromTuneGrid, shapeEnding, switchEndingVersion,
  decorateTuneNote, applyDejaVu, toggleEndingCell } from '../../../static/js/theory/tune_model.js';
import { compileSongStandalone } from '../../../static/ui/standalone_compiler.js';
import { newPlayDoc } from '../../../static/js/theory/session_rules.js';

const makeNote = (step=48, midi=67, duration=1.25) => ({id:`performed-${step}`,step,duration_steps:duration,velocity:.37,
  role:'lead',patch_id:'warm_keys',pitch_lock_mode:'concrete',provenance:'user_placed',concrete:{midi_pitch:midi},
  performance:{version:1,offset_steps:.73},sound_seed:{brightness:.24},custom_capture:{take:2}});
const compile = notes => compileSongStandalone({...newPlayDoc({now:1,rand:()=>.5}),notes}).events;

test('pitch-only ending shapes preserve performed onset, gate, expression and restore exact originals', () => {
  for (const bars of [1,2,3,4]) for (const shape of ['climb','fall']) for (const duration of [.75,1.25]) {
    const original=makeNote((bars-1)*16,67,duration);
    const before=compile([original])[0];
    const grid=shapeEnding(tuneGridFromNotes([original],bars),shape);
    const notes=notesFromTuneGrid(grid,[original],'pluck_lead',{endingOnly:true});
    const changed=notes.find(note=>note.id===original.id);
    assert.ok(changed);
    assert.notEqual(changed.concrete.midi_pitch,original.concrete.midi_pitch);
    for(const field of ['performance','sound_seed','custom_capture']) assert.deepEqual(changed[field],original[field]);
    assert.equal(changed.patch_id,original.patch_id);
    const after=compile(notes).find(note=>note.id===original.id);
    for(const field of ['start_sec','duration_sec','velocity']) assert.equal(after[field],before[field]);
    const restored=notesFromTuneGrid(switchEndingVersion(grid,'original'),notes,'warm_keys',{endingOnly:true});
    assert.deepEqual(restored,[original]);
  }
});

test('decorators preserve performed identity and timing; toggling restores original', () => {
  for(const decorator of ['slide','bounce','sparkle']) {
    const original=makeNote(48,67,.75);
    const before=compile([original])[0];
    const grid=decorateTuneNote(tuneGridFromNotes([original]),decorator,'ending');
    const notes=notesFromTuneGrid(grid,[original],'pluck_lead',{endingOnly:true});
    assert.equal(notes[0].transition,decorator);
    const after=compile(notes)[0];
    for(const field of ['start_sec','duration_sec','velocity']) assert.equal(after[field],before[field]);
    assert.deepEqual(notes[0].performance,original.performance);
    const toggled=decorateTuneNote(grid,decorator,'ending');
    assert.deepEqual(notesFromTuneGrid(toggled,notes,'warm_keys',{endingOnly:true}),[original]);
  }
});

test('DejaVu retains performance expression and relative offset across deliberate timing moves', () => {
  for(const mode of ['spin_notes','spin_rhythm','shuffle_loop']) {
    const originals=[makeNote(48,60,1.25),makeNote(54,67,2.5)];
    const grid=applyDejaVu(tuneGridFromNotes(originals),mode,1,'ending');
    const notes=notesFromTuneGrid(grid,originals,'pluck_lead',{endingOnly:true});
    assert.equal(new Set(notes.map(note=>note.id)).size,2);
    for(const event of compile(notes)) {
      const source=originals.find(note=>note.id===event.id);
      assert.ok(source);
      assert.deepEqual(event.performance,source.performance);
      assert.equal(event.velocity,.37);
      assert.ok(Math.abs(event.start_sec-(event.step+.73)*.15)<.000001);
    }
  }
});

test('a deliberately new note does not inherit old performed timing', () => {
  const original=makeNote();
  const grid=tuneGridFromNotes([original]);
  toggleEndingCell(grid,0,72);
  const notes=notesFromTuneGrid(grid,[original],'pluck_lead',{endingOnly:true});
  assert.equal(notes[0].performance,undefined);
  assert.equal(notes[0].patch_id,'pluck_lead');
});
