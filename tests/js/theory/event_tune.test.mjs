import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasLeadCollisions,editLeadEvent} from '../../../static/js/theory/event_tune.js';
import {tuneGridFromNotes,notesFromTuneGrid,tuneGridForBars} from '../../../static/js/theory/tune_model.js';
const fixture=()=>[60,64,60].map((midi,i)=>({id:`own${i}`,role:'lead',step:26,duration_steps:1.4+i*.2,
  provenance:'user_placed',patch_id:'warm_keys',concrete:{midi_pitch:midi},
  performance:{version:1,offset_steps:i*.2,hold_id:`hold${i}`},source_note_id:`source${i}`}));
test('exact event edits preserve other pitches and repeated pitch occurrences',()=>{
  const notes=fixture(),original=structuredClone(notes);
  for(const action of ['up','down','shorter','longer','remove']) {
    const next=editLeadEvent(notes,'own1',action);
    assert.deepEqual(next.filter(n=>n.id!=='own1'),notes.filter(n=>n.id!=='own1'));
    if(action!=='remove') {
      const selected=next.find(n=>n.id==='own1');
      for(const key of ['id','step','performance','source_note_id','provenance','patch_id','velocity']) assert.deepEqual(selected[key],notes[1][key]);
    }
    assert.deepEqual(notes,original);
    assert.deepEqual(JSON.parse(JSON.stringify(next)),next);
  }
});
test('middle-bar collision blocks lossy grid writeback and event mode survives resizing',()=>{
  const notes=fixture();assert.equal(hasLeadCollisions(notes),true);
  const grid=tuneGridFromNotes(notes);grid.main[10]={midi:67,provenance:'user_placed',duration_steps:2};
  assert.throws(()=>notesFromTuneGrid(grid,notes),/one at a time/);
  const clean=tuneGridFromNotes(notes);assert.deepEqual(notesFromTuneGrid(clean,notes),notes);
  clean.eventEditor=true;
  assert.equal(tuneGridForBars(clean,notes,2).eventEditor,true);
  const one=editLeadEvent(editLeadEvent(notes,'own1','remove'),'own2','remove');
  const stable={...tuneGridFromNotes(one),eventEditor:true};stable.main[0]={midi:60};
  assert.throws(()=>notesFromTuneGrid(stable,one),/one at a time/);
});
test('ambiguous imported IDs never edit multiple notes',()=>{
  const notes=fixture();notes[1].id=notes[0].id;
  assert.throws(()=>editLeadEvent(notes,'own0','remove'),/Choose one/);
  assert.equal(notes.length,3);
});
test('explicit onset edits preserve gates and retire generator replacement permission',()=>{
  const notes=fixture();notes[0].generated_by='musiclab_jam';notes[0].provenance='jam_generated';
  const next=editLeadEvent(notes,'own0','later',{totalSteps:48});
  assert.equal(next[0].step,26);assert.equal(next[0].performance.offset_steps,.25);
  assert.equal(next[0].duration_steps,notes[0].duration_steps);
  assert.equal(next[0].provenance,'jam_generated');assert.equal(next[0].generated_by,undefined);
  assert.equal(next[0].edited_from_generator,'musiclab_jam');
  assert.deepEqual(next.slice(1),notes.slice(1));
});
