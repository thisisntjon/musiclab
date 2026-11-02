import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileSongStandalone } from '../../../static/ui/standalone_compiler.js';
import { newPlayDoc } from '../../../static/js/theory/session_rules.js';

const note = (performance = undefined) => ({ id:'performed',step:63,duration_steps:2,velocity:.6,
  role:'lead',patch_id:'warm_keys',pitch_lock_mode:'concrete',concrete:{midi_pitch:67},provenance:'user_placed',
  sound_seed:{brightness:.25}, ...(performance === undefined ? {} : {performance}) });
const documentWith = notes => ({...newPlayDoc({now:1,rand:()=>.5}),notes,sound_seed:{brightness:.8},
  global_context:{bpm:100,swing:.65,root_pc:0,scale_type:'major',bars:4}});

test('realized fractional timing and expression survive JSON roundtrip without rehumanization', () => {
  const doc = documentWith([{...note({version:1,offset_steps:.8}),duration_steps:2.375,velocity:.37123}]);
  const before = structuredClone(doc);
  for (const humanize of [true,false]) {
    const event = compileSongStandalone(JSON.parse(JSON.stringify(doc)),{humanize}).events[0];
    assert.equal(event.start_sec,9.57);
    assert.equal(event.duration_sec,.35625);
    assert.equal(event.velocity,.37123);
    assert.equal(event.concrete.midi_pitch,67);
    assert.deepEqual(event.sound_seed,{brightness:.25});
  }
  assert.deepEqual(doc,before);
});

test('malformed performed fields do not alter ordinary note behavior', () => {
  const baseline = compileSongStandalone(documentWith([note()])).events[0];
  for (const performance of [null,[], 'bad', {offset_steps:-.1,duration_steps:0,velocity:2},
    {offset_steps:1,duration_steps:65,velocity:-1}, {offset_steps:'0.2',duration_steps:true,velocity:'0.4'},
    {offset_steps:NaN,duration_steps:Infinity,velocity:NaN}]) {
    const event = compileSongStandalone(documentWith([note(performance)])).events[0];
    delete event.performance;
    assert.deepEqual(event,baseline);
  }
});

test('versioned performance preserves kit and filters explicitly silent events', () => {
  const drums = {...note({version:1,offset_steps:.2}),duration_steps:1.5,velocity:.4,role:'drums',patch_id:'snare',drum_kit:'tiny'};
  const silent = {...note({version:1}),velocity:0,id:'silent'};
  const events = compileSongStandalone({...documentWith([drums,silent]),drum_kit:'soft'}).events;
  assert.equal(events.length,1);
  assert.equal(events[0].drum_kit,'tiny');
  const partial = compileSongStandalone(documentWith([{...note({version:1,offset_steps:.2}),duration_steps:'invalid',velocity:.42}])).events[0];
  assert.equal(partial.start_sec,9.48);
  assert.equal(partial.velocity,.42);
  assert.equal(partial.duration_sec,.15);
});

test('intentional ordinary duration and expression edits override captured values', () => {
  const doc=documentWith([note({version:1,offset_steps:.4,duration_steps:50,velocity:.99})]);
  doc.notes[0].duration_steps=.75;
  doc.notes[0].velocity=.23;
  const event=compileSongStandalone(doc).events[0];
  assert.equal(event.duration_sec,.1125);
  assert.equal(event.velocity,.23);
  assert.equal(event.start_sec,9.51);
});
