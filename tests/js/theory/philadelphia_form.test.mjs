import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'philadelphia-soul-v1',responsive:false});
test('two ordered string voices move smoothly through the full progression and loop seam',()=>{
 for(const scale_type of ['major','natural_minor']){
  const d=make();d.global_context.scale_type=scale_type;const p=createJamFormBuilder()(d);
  const voices=['string-lower','string-upper'].map(id=>p.blocks.flatMap(b=>b.variants[0].events.filter(e=>e.voice_id===id).map(e=>e.concrete.midi_pitch)));
  assert.ok(voices.every(v=>v.length===8));
  for(let i=0;i<8;i++){
   assert.ok(voices[0][i]<voices[1][i]);
   for(const v of voices)assert.ok(Math.abs(v[(i+1)%8]-v[i])<=4);
  }
 }
});
test('saved individual string pitch edits reach the sampler without changing the other string',()=>{
 const d=make(),v=createJamFormBuilder()(d).blocks[0].variants[0];
 const pair=v.events.filter(e=>e.step===0&&e.patch_id==='sampled_strings_v1');assert.equal(pair.length,2);
 const kept=materializePerformance(d,{start:0,end:2.4,bpm:100,bars:1,events:pair.map((event,i)=>({event,time:0,duration:2.1,occurrence:i+1}))});
 const original=structuredClone(kept);kept.notes[0].concrete.midi_pitch+=1;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);const before=structuredClone(saved.song);
 const events=compileSongStandalone(saved.song).events;
 assert.deepEqual(pianoNotes(events[0]).map(n=>n.pitch),[original.notes[0].concrete.midi_pitch+1]);
 assert.deepEqual(pianoNotes(events[1]).map(n=>n.pitch),[original.notes[1].concrete.midi_pitch]);
 assert.deepEqual(saved.song,before);assert.deepEqual(saved.song.notes[1],original.notes[1]);
 assert.deepEqual(pianoNotes(compileSongStandalone(original).events[0]).map(n=>n.pitch),[original.notes[0].concrete.midi_pitch]);
 assert.deepEqual(events.map(e=>e.voice_id),pair.map(e=>e.voice_id));
});
