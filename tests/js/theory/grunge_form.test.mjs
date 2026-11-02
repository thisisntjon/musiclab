import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlock,SCENE_ID} from '../../../static/js/theory/grunge_form_score.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';

test('grunge contrasts chord density and timbre while retaining the same answer and clock',()=>{
 for(let root=0;root<12;root++)for(const minor of[false,true])for(const cycle of[0,4,7]){
  const pair=[0,1].map(blockIndex=>buildBlock(SCENE_ID,{root,minor,cycle,blockIndex,density:4}));
  assert.deepEqual(pair[0].harmony,pair[1].harmony);
  const answers=pair.map(s=>s.notes.filter(n=>n.voice_id==='shared-answer').map(n=>[n.position,n.pitch,n.gate]));assert.deepEqual(...answers);
  assert.deepEqual(pair.map(s=>s.notes.filter(n=>n.role==='harmony').length),[16,32]);
  assert.deepEqual(pair.map(s=>new Set(s.notes.filter(n=>n.role==='harmony').map(n=>n.position)).size),[16,16]);
  assert.ok(pair[0].notes.filter(n=>n.role==='lead'||n.role==='harmony').every(n=>n.patch==='sampled_clean_guitar_v1'));
  assert.ok(pair[1].notes.filter(n=>n.role==='lead'||n.role==='harmony').every(n=>n.patch==='sampled_overdrive_guitar_v1'));
 }
});
test('captured clean and overdrive phrases retain separate sampled identity across revisions',()=>{
 const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:SCENE_ID,responsive:false});
 const p=createJamFormBuilder()(d),quiet=p.blocks[0].variants[0].events.find(e=>e.voice_id==='shared-answer'&&e.step===62),forceful=p.blocks[1].variants[0].events.find(e=>e.voice_id==='shared-answer');
 const selected=[quiet,forceful],kept=materializePerformance(d,{start:8,end:17.6,bpm:100,bars:4,events:selected.map((event,i)=>({event,time:event.start_sec+(i?9.6:0),duration:event.duration_sec,occurrence:i+1}))});
 const original=structuredClone(kept);kept.notes[0].concrete.midi_pitch+=1;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);const before=structuredClone(saved.song),events=compileSongStandalone(saved.song).events;
 assert.equal(events.length,2);assert.deepEqual(events.map(e=>pianoNotes(e)[0].program),[27,29]);
 assert.deepEqual(events.map(e=>pianoNotes(e)[0].pitch),original.notes.map((n,i)=>n.concrete.midi_pitch+(i?0:1)));
 assert.deepEqual(saved.song,before);assert.deepEqual(saved.song.notes[1],original.notes[1]);assert.deepEqual(saved.song.captured_performance,original.captured_performance);
 assert.deepEqual(events.map(e=>[e.source_note_id,e.start_sec,e.duration_sec]),compileSongStandalone(original).events.map(e=>[e.source_note_id,e.start_sec,e.duration_sec]));
});
