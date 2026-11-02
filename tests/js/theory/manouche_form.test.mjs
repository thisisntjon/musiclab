import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SAMPLED_PROGRAMS,pianoNotes} from '../../../static/js/audio/sampled_piano.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {sourceModeGuidance} from '../../../static/js/theory/source_mode.js';
const patch='sampled_steel_guitar_v1';
const make=()=>setJamDirection(startJam(newPlayDoc(),{patchId:patch}),{scene_catalogue:'first-neighborhood-v1',scene_id:'jazz-manouche-v1'});
test('steel-string is separately selectable and mapped without replacing nylon saves',()=>{
 assert.equal(SAMPLED_PROGRAMS[patch],25);assert.equal(SAMPLED_PROGRAMS.sampled_guitar_v1,24);
 assert.equal(getInstrument(patch).group,'strings');assert.match(getInstrument(patch).image,/guitar\.svg$/);
 const d=make();assert.equal(d.jam_session.patchId,patch);const saved=parseProjectJson(exportProjectJson(d));assert.equal(saved.ok,true);
 const events=compileSongStandalone(saved.song).events;assert.ok(events.length);assert.ok(events.every(e=>pianoNotes(e).every(n=>n.program===25)));
 const old=startJam(newPlayDoc(),{patchId:'sampled_guitar_v1'});assert.equal(parseProjectJson(exportProjectJson(old)).song.jam_session.patchId,'sampled_guitar_v1');
});
test('minor sixth source context is preserved without incorrect global-scale correction after edits',()=>{
 const d=make();d.global_context.scale_type='natural_minor';const p=createJamFormBuilder()(d);
 const n=p.blocks[0].variants[0].events.find(e=>e.step<16&&e.concrete.midi_pitch%12===9);assert.ok(n);
 assert.deepEqual(n.generated_harmony.pitch_classes,[0,3,7,9]);assert.equal(n.why_label,'Source band: harmony context. Pitch kept as written.');
 const kept=materializePerformance(d,{start:0,end:2,bpm:100,bars:1,events:[{event:n,time:.25,duration:.2,occurrence:1}]});
 const original=structuredClone(kept);kept.notes[0].concrete.midi_pitch=58;
 const saved=parseProjectJson(exportProjectJson(kept));assert.equal(saved.ok,true);
 const event=compileSongStandalone(saved.song).events[0];assert.equal(event.concrete.midi_pitch,58);
 assert.deepEqual(event.generated_harmony,n.generated_harmony);assert.equal(event.why_label,n.why_label);
 assert.equal(original.notes[0].concrete.midi_pitch,n.concrete.midi_pitch);
});
test('malformed historical chords cannot suppress ordinary pitch guidance',()=>{
 for(const pcs of [[0,0,7],[0,4,12],[false,4,7],[0,4,'7'],[0,7],null])
  assert.equal(sourceModeGuidance({generated_harmony:{version:1,pitch_classes:pcs}}),null);
 assert.equal(sourceModeGuidance({generated_harmony:{version:true,pitch_classes:[0,4,7]}}),null);
});
