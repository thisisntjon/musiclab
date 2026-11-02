import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLED_SOUND_CAPABILITIES,SAMPLED_PROGRAMS,SAMPLED_BANK} from '../../../static/js/theory/sampled_sound_capabilities.js';
import {pianoNotes,PianoAllocation} from '../../../static/js/audio/sampled_piano.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {songEvents,applySongMaterial} from '../../../static/js/theory/song_view.js';
const added={sampled_muted_guitar_v1:28,sampled_upright_bass_v1:32};
const full=doc=>{const base=structuredClone(doc);delete base.song_cards;return songEvents(compileSongStandalone(base),doc.song_cards,doc.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null)).events;};
test('sound capability versions preserve old programs and explicitly admit both new presets',()=>{
 const old={sampled_piano_v1:0,sampled_electric_piano_v1:4,sampled_organ_v1:16,sampled_harmonica_v1:22,sampled_guitar_v1:24,sampled_steel_guitar_v1:25,sampled_clean_guitar_v1:27,sampled_overdrive_guitar_v1:29,sampled_bass_v1:33,sampled_strings_v1:48,sampled_ooh_v1:53,sampled_trumpet_v1:56,sampled_tenor_sax_v1:66,sampled_clarinet_v1:71,sampled_banjo_v1:105};
 assert.deepEqual(SAMPLED_PROGRAMS,{...old,...added});
 for(const [patch,program] of Object.entries(added)){const cap=SAMPLED_SOUND_CAPABILITIES[patch];assert.equal(cap.program,program);assert.equal(cap.bank,0);assert.equal(cap.bankId,SAMPLED_BANK.id);assert.equal(cap.pythonAudio,false);assert.equal(cap.pitchResolution,'semitone');assert.ok(Object.isFrozen(cap));}
});
test('new instrument choices preserve personal events through style changes and save/reopen',()=>{
 for(const patchId of Object.keys(added)){
  let doc=startJam(newPlayDoc(),{patchId});assert.equal(doc.jam_session.patchId,patchId);
  const own={id:'my-held-note',role:'lead',patch_id:patchId,step:3,duration_steps:13.4,performance:{version:1,offset_steps:.27},velocity:.53,concrete:{midi_pitch:59},provenance:'user_placed',pitch_lock_mode:'concrete'};
  doc.notes.push(structuredClone(own));
  for(const scene_id of ['ska-v1','rocksteady-v1','reggae-v1']){doc=setJamDirection(doc,{scene_catalogue:'first-neighborhood-v1',scene_id});assert.deepEqual(doc.notes.find(n=>n.id===own.id),own);}
  const reopened=parseProjectJson(exportProjectJson(doc));assert.equal(reopened.ok,true);
  const a=compileSongStandalone(doc).events,b=compileSongStandalone(reopened.song).events;assert.deepEqual(b,a);
  const event=b.find(n=>n.id===own.id);const voice=pianoNotes(event)[0];assert.equal(voice.program,added[patchId]);assert.equal(voice.pitch,59);assert.equal(voice.duration,event.duration_sec);
 }
});
test('captured elapsed holds retain both sounds and source identity through edit, restore and whole-song compilation',()=>{
 const doc=startJam(newPlayDoc());
 const events=Object.entries(added).map(([patch_id],i)=>({time:.31+i*.4,duration:i?1.23:.29,occurrence:i+1,event:{id:`live-${i}`,source_note_id:`live-${i}`,role:'lead',patch_id,concrete:{midi_pitch:60+i*3},provenance:'user_placed',pitch_lock_mode:'concrete',velocity:.6}}));
 const kept=materializePerformance(doc,{start:0,end:2,bpm:100,events});
 const before=full(kept).filter(e=>e.provenance==='user_placed');assert.equal(before.length,2);
 const changed=structuredClone(kept),target=[...changed.notes,...changed.song_cards.flatMap(c=>c.material?.notes||[])].find(n=>n.source_note_id==='live-0');
 assert.ok(target);target.concrete.midi_pitch++;
 const edited=parseProjectJson(exportProjectJson(changed));assert.equal(edited.ok,true);
 const after=full(edited.song).filter(e=>e.provenance==='user_placed');
 for(const event of after){const original=before.find(e=>e.source_note_id===event.source_note_id);assert.equal(event.patch_id,original.patch_id);assert.equal(event.start_sec,original.start_sec);assert.equal(event.duration_sec,original.duration_sec);assert.equal(pianoNotes(event)[0].program,added[event.patch_id]);assert.equal(event.concrete.midi_pitch,original.concrete.midi_pitch+(event.source_note_id==='live-0'?1:0));}
 const restored=parseProjectJson(exportProjectJson(kept));assert.equal(restored.ok,true);assert.deepEqual(full(restored.song).filter(e=>e.provenance==='user_placed'),before);
});
test('changing program cannot reuse a held channel or steal its note identity',()=>{
 const pool=new PianoAllocation(),first=pool.claim(0,Infinity,60,64,28),held=structuredClone(pool.slots[first]);
 const second=pool.claim(.2,1,60,64,32);assert.notEqual(first,second);assert.deepEqual(pool.slots[first],held);
 pool.release(second,.7,60);assert.deepEqual(pool.slots[first],held);
});
