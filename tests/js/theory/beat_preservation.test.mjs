import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatGridFromNotes, notesFromBeatGrid, rollGrooveDice, applyEuclidPreset,
  applyGridsSpot, isPadPinned } from '../../../static/js/theory/beat_model.js';
import { seedPulse } from '../../../static/js/theory/session_rules.js';

const own = (id, step, provenance = 'user_placed') => ({id, step, role:'drums',
  patch_id:'kick', provenance, velocity:.63, duration_steps:1.375,
  concrete:{midi_pitch:36}, performance:{version:1,offset_steps:.125,hold_id:id},
  capture_occurrence:true, source_note_id:`source-${id}`});
function preserved(original, result) {
  for (const note of original.filter(n => ['user_placed','hummed_confirmed'].includes(n.provenance))) {
    assert.deepEqual(result.filter(n=>n.id===note.id), [note], `lost/changed/duplicated ${note.id}`);
  }
}
const transform = (notes, seed, protectOwn = true) => {
  const grid = beatGridFromNotes(notes);
  const next = seed % 3 === 0 ? rollGrooveDice(grid,{seed}).grid
    : seed % 3 === 1 ? applyEuclidPreset(grid,['bounce','drive','skip'][Math.floor(seed/3)%3])
    : applyGridsSpot(grid,['steady','pocket','dance'][Math.floor(seed/3)%3]);
  return notesFromBeatGrid(next, notes, {protectOwn,bar4Fill:seed%2===0});
};

test('assistance keeps later-bar notes; checker rejects the old unprotected write', () => {
  const notes = [...seedPulse().filter(n=>n.step!==40), own('my-kick',40)];
  const grid = rollGrooveDice(beatGridFromNotes(notes),{seed:1}).grid;
  assert.throws(()=>preserved(notes, notesFromBeatGrid(grid,notes)), /my-kick/);
  preserved(notes,notesFromBeatGrid(grid,notes,{protectOwn:true}));
});

test('confirmed humming pins survive all generators without relabeling or duplicates', () => {
  const notes = [own('hum',0,'hummed_confirmed'),own('same-cell',0),own('late',32,'hummed_confirmed')];
  assert.equal(isPadPinned(beatGridFromNotes(notes),'kick',0),true);
  for(let seed=0;seed<12;seed++) preserved(notes,transform(notes,seed));
});

test('seeded assistance actions preserve all personal fields through reload and continuation', () => {
  // Reproduce with node --test tests/js/theory/beat_preservation.test.mjs
  for(let seed=1;seed<=100;seed++) {
    let state=seed;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
    const original=[...seedPulse(),...Array.from({length:8},(_,i)=>own(`s${seed}-${i}`,random()%64,i%2?'hummed_confirmed':'user_placed'))];
    let uninterrupted=structuredClone(original), resumed=structuredClone(original);
    for(let action=0;action<15;action++) {
      const choice=random()%30;
      uninterrupted=transform(uninterrupted,choice);
      resumed=transform(resumed,choice);
      if(action===7) resumed=JSON.parse(JSON.stringify(resumed));
      try { preserved(original,resumed); assert.deepEqual(resumed,uninterrupted); }
      catch(error) { error.message+=` seed=${seed} action=${action} choice=${choice}`; throw error; }
    }
  }
});

test('intentional erase remains available independently of assistance protection', () => {
  const notes=[own('erase-me',0)];
  const grid=beatGridFromNotes(notes);grid.kick[0]=null;
  assert.equal(notesFromBeatGrid(grid,notes).some(n=>n.id==='erase-me'),false);
  preserved(notes,notesFromBeatGrid(grid,notes,{protectOwn:true}));
});
