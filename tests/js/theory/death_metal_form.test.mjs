import {formScore,formBacking} from '../../../static/js/theory/form_scenes.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';import {materializePerformance} from '../../../static/js/theory/performance_capture.js';import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';import {pianoNotes} from '../../../static/js/audio/sampled_piano.js';import {songEvents,applySongMaterial} from '../../../static/js/theory/song_view.js';import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'death-metal-v1',density:4,responsive:false});
test('dense and sparse captured parts remain independent across song cards and a held personal note',()=>{
const d=make(),p=createJamFormBuilder()(d),a=p.blocks[0].variants[0].events,b=p.blocks[1].variants[0].events;
const dense=a.find(e=>e.voice_id==='repeated-burst'&&e.step===2),sparse=b.find(e=>e.voice_id==='heavy-cell'&&e.step===0),fifth=b.find(e=>e.voice_id==='heavy-fifth'&&e.step===0),bass=b.find(e=>e.voice_id==='low-riff-unison'&&e.step===0),future=b.find(e=>e.voice_id==='heavy-cell'&&e.step===6);assert.equal(dense.concrete.midi_pitch,49);assert.equal(sparse.concrete.midi_pitch-bass.concrete.midi_pitch,12);assert.equal(sparse.concrete.midi_pitch,48);assert.equal(bass.concrete.midi_pitch,36);
const own={id:'jam-live-death-review',source_note_id:'jam-live-death-review',role:'lead',patch_id:'sampled_clean_guitar_v1',provenance:'user_placed',concrete:{midi_pitch:64},pitch_lock_mode:'concrete',velocity:.47};
const s=new LookaheadScheduler();s.audioCtx={currentTime:9.7};s.isPlaying=true;s.performanceTake={song_id:d.id,start:0,bpm:100,capture_bars:8,events:[{event:dense,time:dense.start_sec,duration:dense.duration_sec,occurrence:1},...[sparse,fifth,bass,future].map((event,i)=>({event,time:9.6+event.start_sec,duration:event.duration_sec,occurrence:i+2})),{event:own,time:9.5,duration:1,occurrence:6}]};
const cap=s.capturePerformance();assert.equal(cap.events.length,5);assert.ok(!cap.events.some(e=>e.event.id===future.id));const kept=materializePerformance(d,cap),original=structuredClone(kept),target=kept.song_cards.flatMap(c=>c.material?.notes||[]).find(n=>n.voice_id==='heavy-cell');assert.ok(target);target.concrete.midi_pitch++;
function full(doc){const base=structuredClone(doc);delete base.song_cards;return songEvents(compileSongStandalone(base),doc.song_cards,doc.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null));}
const reopened=parseProjectJson(exportProjectJson(kept));assert.equal(reopened.ok,true);const events=full(reopened.song).events,prior=full(original).events;assert.equal(events.length,5);
for(const e of events){const old=prior.find(x=>x.id===e.id);assert.equal(e.concrete.midi_pitch,old.concrete.midi_pitch+(e.voice_id==='heavy-cell'?1:0));assert.equal(e.source_note_id,old.source_note_id);assert.equal(e.start_sec,old.start_sec);assert.equal(e.duration_sec,old.duration_sec);if(e.patch_id.startsWith('sampled_')){assert.equal(pianoNotes(e)[0].pitch,e.concrete.midi_pitch);assert.equal(pianoNotes(e)[0].program,e.provenance==='user_placed'?27:29);}if(e.provenance==='jam_generated')assert.match(e.why_label,/harmony context/);}
assert.deepEqual(reopened.song.captured_performance,original.captured_performance);const ownOut=events.filter(e=>e.source_note_id===own.id);assert.equal(ownOut.length,1);assert.ok(Math.abs(ownOut[0].duration_sec-.2)<1e-8);
});
test('low-register guitar and bass retain their exact octave relationship in every key',()=>{
const d=make();
// Exact folded root and bass octave hold across all keys in the actual adapter/compiler.
let range=[127,0];for(let root=0;root<12;root++){const doc=structuredClone(d);doc.global_context.root_pc=root;const program=createJamFormBuilder()(doc);for(const block of program.blocks)for(const v of block.variants){for(const e of v.events.filter(n=>n.voice_id==='low-riff-unison')){range=[Math.min(range[0],e.concrete.midi_pitch),Math.max(range[1],e.concrete.midi_pitch)];const guitar=v.events.find(n=>['heavy-cell','repeated-burst'].includes(n.voice_id)&&n.step===e.step);assert.equal(guitar.concrete.midi_pitch-e.concrete.midi_pitch,12);}}}assert.deepEqual(range,[28,45]);
});

test('section calibration changes only generated sampled levels in the chosen section',()=>{
 const own={id:'my-independent-level',role:'lead',patch_id:'sampled_clean_guitar_v1',step:15,duration_steps:.2,concrete:{midi_pitch:64},pitch_lock_mode:'concrete',velocity:.43,provenance:'user_placed'};
 for(const blockIndex of[0,1]){
  const d=make();d.jam_session.form_cursor={id:'death-metal-v1',blockIndex,cycle:0};d.notes.push(own);
  const raw=formScore(d).notes,notes=formBacking(d,d.jam_session,[]);
  for(const e of notes){
   const n=raw.find(n=>n.patch===e.patch_id&&n.position===e.step+(e.performance?.offset_steps||0)&&n.pitch===e.concrete.midi_pitch);assert.ok(n);
   const factor=e.patch_id.startsWith('sampled_')?(e.role==='lead'?(blockIndex?2.9:3.5):(blockIndex?3:3.6)):(e.role==='bass'?.4:1);
   assert.equal(e.velocity,n.velocity*factor);assert.equal(e.duration_steps,n.gate);
  }
  const next=setJamDirection(d,{});assert.deepEqual(next.notes.find(n=>n.id===own.id),own);
 }
});
