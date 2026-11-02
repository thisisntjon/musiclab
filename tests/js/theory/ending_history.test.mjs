import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tuneGridFromNotes,shapeEnding,applyDejaVu,decorateTuneNote,switchEndingVersion} from '../../../static/js/theory/tune_model.js';
import {songEvents} from '../../../static/js/theory/song_view.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';

function fixture() {
  return tuneGridFromNotes([0,48].flatMap(base=>[60,64,67].map((midi,i)=>({
    id:`own-${base}-${i}`,role:'lead',step:base+i*4,duration_steps:1.75,velocity:.65,
    provenance:'user_placed',patch_id:'warm_keys',concrete:{midi_pitch:midi},
    performance:{version:1,offset_steps:.125}}))));
}
const operations=[g=>applyDejaVu(g,'spin_notes',7,'main'),g=>decorateTuneNote(g,'slide','main'),
  g=>applyDejaVu(g,'spin_rhythm',11,'ending'),g=>decorateTuneNote(g,'bounce','ending')];
test('main transforms preserve independent ending and all alternative history',()=>{
  const grid=shapeEnding(fixture(),'climb');grid.endingStates={2:{marker:'retained'}};
  for(const operation of operations.slice(0,2)) {
    const snapshot=structuredClone(grid), next=operation(grid);
    assert.deepEqual(grid,snapshot);
    for(const key of ['ending','baseEnding','exploredEnding','endingStates']) assert.deepEqual(next[key],grid[key]);
    assert.deepEqual(switchEndingVersion(next,'original').ending,grid.baseEnding);
  }
});
test('ending transforms retain original and return to updated explored after JSON reopen',()=>{
  const grid=shapeEnding(fixture(),'climb');
  for(const operation of operations.slice(2)) {
    for(const selected of [grid,switchEndingVersion(grid,'original')]) {
      const next=operation(selected);
      assert.deepEqual(next.main,grid.main);
      assert.deepEqual(next.baseEnding,grid.baseEnding);
      assert.equal(next.endingVersion,'explored');
      const original=switchEndingVersion(JSON.parse(JSON.stringify(next)),'original');
      assert.deepEqual(original.ending,grid.baseEnding);
      assert.deepEqual(switchEndingVersion(original,'explored').ending,next.ending);
    }
  }
});
test('seeded sequences keep original ending across transforms and version switches',()=>{
  for(let seed=0;seed<40;seed++) {
    let grid=shapeEnding(fixture(),'climb');const base=structuredClone(grid.baseEnding);
    for(let step=0;step<20;step++) {
      grid=operations[(seed+step)%operations.length](grid);
      if(step%3===0) grid=JSON.parse(JSON.stringify(grid));
      assert.deepEqual(switchEndingVersion(grid,'original').ending,base,`seed${seed} step${step}`);
    }
  }
});
test('lift companions remain generated through capture while original notes stay personal',()=>{
  for(const card of [{fx:'high_lift'}, {big:true}]) {
    const source={id:'own',source_note_id:'my-source',role:'lead',step:0,start_sec:0,duration_sec:.4,
      provenance:'user_placed',patch_id:'warm_keys',concrete:{midi:60,freq_hz:261.626}};
    const song=songEvents({bpm:100,total_steps:64,total_duration_sec:9.6,events:[source]},
      [{bars:1,beat:true,tune:true,under:true,...card}]);
    const lift=song.events.find(e=>e.role==='harmony');
    assert.equal(lift.provenance,'generator_default');assert.equal(lift.generated_by,'song_card_lift');
    assert.deepEqual(lift.response_to,['my-source']);
    assert.equal(lift.source_note_id,undefined);
    assert.equal(song.events.find(e=>e.role==='lead').provenance,'user_placed');
    const capture={bpm:100,start:0,end:2.4,bars:1,events:song.events.map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i}))};
    const saved=JSON.parse(JSON.stringify(materializePerformance(newPlayDoc(),capture)));
    assert.equal(saved.notes.filter(n=>n.provenance==='user_placed').length,1);
    assert.equal(saved.notes.find(n=>n.role==='harmony').generated_by,'song_card_lift');
    assert.equal(saved.notes.find(n=>n.role==='harmony').source_note_id,lift.id);
    assert.equal(source.provenance,'user_placed');
  }
});
