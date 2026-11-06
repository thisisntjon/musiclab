import test from 'node:test';
import assert from 'node:assert/strict';
import {previewEndingIdea} from '../../../static/js/theory/melody_answer.js';
import {ensureSectionIds,applySongMaterial} from '../../../static/js/theory/song_view.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';

const lead=()=>({id:'last',role:'lead',step:4,duration_steps:8,velocity:.7,patch_id:'warm_keys',
  pitch_lock_mode:'concrete',provenance:'user_placed',concrete:{midi_pitch:49},performance:{version:1,offset_steps:0}});
function fixture(extra={}) {
 return {id:'astra-ending',notes:[],global_context:{bpm:100,root_pc:0,scale_type:'major'},
  song_cards:ensureSectionIds([{bars:1,material:{notes:[lead()],...extra},beat:true,tune:true,under:true},
   {bars:1,material:{notes:[],auto_harmony_stabs:false},beat:true,tune:true,under:true}])};
}
const events=(doc,card)=>compileSongStandalone({...applySongMaterial(doc,card.material),arrangement_mode:'loop'}).events;

test('short part can develop an ending while unused later recipe notes stay intact',()=>{
 const doc=fixture({auto_harmony_stabs:false});
 const later={...lead(),id:'unused-later',role:'bass',step:32,duration_steps:4,patch_id:'clean_bass'};
 const laterLead={...lead(),id:'unused-lead',step:40};
 doc.song_cards[0].material.notes.push(later,laterLead);const before=structuredClone(doc);
 const p=previewEndingIdea(doc,0);assert.equal(p.changed,true,p.reason);assert.deepEqual(doc,before);
 assert.deepEqual(p.after.song_cards[0],before.song_cards[0]);
 const added=p.after.song_cards[p.afterIndex].material.notes;
 assert.deepEqual(added.find(n=>n.id===later.id),later);assert.deepEqual(added.find(n=>n.id===laterLead.id),laterLead);
 assert.equal(added.find(n=>n.generated_by==='musiclab_ending_idea').source_note_id,'last');
 const crossing=fixture({auto_harmony_stabs:false});crossing.song_cards[0].material.notes.push({...later,step:15,duration_steps:4});
 assert.equal(previewEndingIdea(crossing,0).changed,false,'a sounding hold crossing the boundary is still protected');
});

test('ending never promises unchanged band while implicit harmony rescue changes its voicing',()=>{
 const doc=fixture(),snapshot=structuredClone(doc),p=previewEndingIdea(doc,0);
 assert.deepEqual(doc,snapshot);
 if(p.changed) assert.deepEqual(events(p.after,p.after.song_cards[p.afterIndex]).filter(e=>e.role!=='lead'),
   events(doc,doc.song_cards[0]).filter(e=>e.role!=='lead'));
 else assert.deepEqual(p.after,doc);
});

test('ending generated identity cannot collide with an existing material note',()=>{
 const doc=fixture({auto_harmony_stabs:false});
 doc.song_cards[0].material.notes.push({id:'ending-section-3',role:'drums',step:0,duration_steps:1,
  patch_id:'kick',provenance:'user_placed',velocity:.6});
 const p=previewEndingIdea(doc,0);
 if(p.changed) {
  const ids=p.after.song_cards[p.afterIndex].material.notes.map(n=>n.id);
  assert.equal(new Set(ids).size,ids.length,'generated note collided with a retained note');
  assert.equal(parseProjectJson(exportProjectJson(p.after)).ok,true);
 } else assert.deepEqual(p.after,doc);
});

test('ending pitch step starts from realized concrete pitch, not a stale relational cache',()=>{
 const doc=fixture({auto_harmony_stabs:false});
 doc.song_cards[0].material.notes[0].pitch_lock_mode='relational';
 doc.song_cards[0].material.notes[0].relational={chord_tone_index:0};
 const p=previewEndingIdea(doc,0);
 if(p.changed) {
  const from=events(doc,doc.song_cards[0]).find(e=>e.role==='lead').concrete.midi_pitch;
  assert.equal(p.fromPitch,from,'preview claims cached pitch rather than the tune that plays');
 } else assert.deepEqual(p.after,doc);
});

test('cached MIDI on relational harmony does not bypass one-note-only guard',()=>{
 const doc=fixture({auto_harmony_stabs:false});
 doc.song_cards[0].material.notes.push({id:'chord',role:'harmony',step:0,duration_steps:8,velocity:.5,
  patch_id:'warm_keys',pitch_lock_mode:'relational',concrete:{midi_pitch:60},relational:{chord_tone_index:1}});
 const p=previewEndingIdea(doc,0);
 if(p.changed) assert.deepEqual(events(p.after,p.after.song_cards[p.afterIndex]).filter(e=>e.role!=='lead'),
   events(doc,doc.song_cards[0]).filter(e=>e.role!=='lead'));
 else assert.deepEqual(p.after,doc);
});
