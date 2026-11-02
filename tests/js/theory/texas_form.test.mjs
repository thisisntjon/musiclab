import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'texas-blues-v1',responsive:false});
test('Texas keeps three chapters, a shuffled figure and intentional mixed thirds',()=>{
 const p=createJamFormBuilder()(make());assert.equal(p.blocks.length,3);
 assert.deepEqual(p.blocks.flatMap(b=>b.variants[0].harmony.bars.map(c=>c[0])),[0,0,0,0,5,5,0,0,7,5,0,7]);
 const events=p.blocks[0].variants[0].events;
 const call=events.find(e=>e.voice_id==='single-string-call'&&e.step===6),reply=events.find(e=>e.voice_id==='single-string-reply'&&e.step===14);
 assert.equal(call.concrete.midi_pitch,76);assert.equal(reply.concrete.midi_pitch,75);
 assert.deepEqual(reply.generated_harmony.pitch_classes,[0,4,7,10]);
 assert.equal(reply.why_label,'Source band: harmony context. Pitch kept as written.');
 const shuffled=events.find(e=>e.voice_id==='shuffle-figure'&&e.step===2);assert.ok(shuffled);
 assert.ok(Math.abs(shuffled.start_sec-.4)<1e-8);
});
test('the chromatic approach and blue reply stay editable without being retuned on reopen',()=>{
 const d=make(),v=createJamFormBuilder()(d).blocks[0].variants[0];
 const notes=v.events.filter(e=>(e.voice_id==='root-repeat-approach'&&e.step===12)||(e.voice_id==='single-string-reply'&&e.step===14));
 assert.deepEqual(notes.map(e=>e.concrete.midi_pitch),[47,75]);
 const kept=materializePerformance(d,{start:0,end:2.4,bpm:100,bars:1,events:notes.map((event,i)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence:i+1}))});
 const before=structuredClone(kept);kept.notes[1].concrete.midi_pitch=78;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);
 const events=compileSongStandalone(saved.song).events;assert.deepEqual(events.map(e=>e.concrete.midi_pitch),[47,78]);
 assert.deepEqual(saved.song.notes[0],before.notes[0]);
 assert.ok(events.every(e=>e.why_label==='Source band: harmony context. Pitch kept as written.'));
 for(let i=0;i<2;i++){assert.deepEqual(events[i].generated_harmony,notes[i].generated_harmony);assert.equal(events[i].voice_id,notes[i].voice_id);assert.ok(Math.abs(events[i].start_sec-notes[i].start_sec)<1e-8);}
});
