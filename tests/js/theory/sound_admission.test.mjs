import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLED_SOUND_CAPABILITIES,SAMPLED_PROGRAMS,SAMPLED_BANK,SAMPLED_TRANSPOSE} from '../../../static/js/theory/sampled_sound_capabilities.js';
import {pianoNotes,PianoAllocation} from '../../../static/js/audio/sampled_piano.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {songEvents,applySongMaterial} from '../../../static/js/theory/song_view.js';
const added={sampled_muted_guitar_v1:28,sampled_upright_bass_v1:32};
// Sound wheel additions (13 Nov 2026): wheel-only melodic presets of the same bank.
const wheel={sampled_accordion_v1:21,sampled_music_box_v1:10,sampled_marimba_v1:12,sampled_vibraphone_v1:11,
 sampled_steel_drums_v1:114,sampled_kalimba_v1:108,sampled_koto_v1:107,sampled_harp_v1:46,sampled_pizzicato_v1:45,
 sampled_solo_vox_v1:85,sampled_synth_voice_v1:54,sampled_recorder_v1:74,sampled_pan_flute_v1:75,sampled_ocarina_v1:79,
 sampled_trombone_v1:57,sampled_square_lead_v1:80,sampled_saw_lead_v1:81,sampled_synth_brass_v1:62};
// Bass flute (13 Nov 2026): the bank's Flute preset (program 73), sounded an octave below the written pitch.
const bassFlute={sampled_bass_flute_v1:73};
const full=doc=>{const base=structuredClone(doc);delete base.song_cards;return songEvents(compileSongStandalone(base),doc.song_cards,doc.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null)).events;};
test('sound capability versions preserve old programs and explicitly admit both new presets',()=>{
 const old={sampled_piano_v1:0,sampled_electric_piano_v1:4,sampled_organ_v1:16,sampled_harmonica_v1:22,sampled_guitar_v1:24,sampled_steel_guitar_v1:25,sampled_clean_guitar_v1:27,sampled_overdrive_guitar_v1:29,sampled_bass_v1:33,sampled_strings_v1:48,sampled_ooh_v1:53,sampled_trumpet_v1:56,sampled_tenor_sax_v1:66,sampled_clarinet_v1:71,sampled_banjo_v1:105};
 assert.deepEqual(SAMPLED_PROGRAMS,{...old,...added,...wheel,...bassFlute});
 assert.equal(Object.keys(SAMPLED_PROGRAMS).length,36);assert.equal(new Set(Object.values(SAMPLED_PROGRAMS)).size,36);
 for(const [patch,program] of Object.entries(added)){const cap=SAMPLED_SOUND_CAPABILITIES[patch];assert.equal(cap.program,program);assert.equal(cap.bank,0);assert.equal(cap.bankId,SAMPLED_BANK.id);assert.equal(cap.pythonAudio,false);assert.equal(cap.pitchResolution,'semitone');assert.ok(Object.isFrozen(cap));}
});
test('the 18 Sound wheel presets are admitted as version 1 browser-only sounds pinned to their bank program',()=>{
 assert.equal(Object.keys(wheel).length,18);
 for(const [patch,program] of Object.entries(wheel)){
  const cap=SAMPLED_SOUND_CAPABILITIES[patch];
  assert.deepEqual(cap,{id:patch,version:1,bankId:SAMPLED_BANK.id,bank:0,program,pitchResolution:'semitone',
   release:'independent-note-off',articulation:'preset',pythonAudio:false,browserAudio:true});
  assert.ok(Object.isFrozen(cap));assert.equal(SAMPLED_PROGRAMS[patch],program);
  const voice=pianoNotes({patch_id:patch,concrete:{freq_hz:440},duration_sec:.5})[0];assert.equal(voice.program,program);assert.equal(voice.pitch,69);
 }
});
test('the bass flute is admitted as a version 1 browser-only sound: Flute (program 73) transposed -12',()=>{
 const cap=SAMPLED_SOUND_CAPABILITIES.sampled_bass_flute_v1;
 assert.deepEqual(cap,{id:'sampled_bass_flute_v1',version:1,bankId:SAMPLED_BANK.id,bank:0,program:73,pitchResolution:'semitone',
  release:'independent-note-off',articulation:'preset',pythonAudio:false,browserAudio:true,transposeSemitones:-12});
 assert.ok(Object.isFrozen(cap));assert.equal(SAMPLED_PROGRAMS.sampled_bass_flute_v1,73);
 // The transpose map and the records agree, and no other record gains a transpose.
 assert.deepEqual({...SAMPLED_TRANSPOSE},{sampled_bass_flute_v1:-12});assert.ok(Object.isFrozen(SAMPLED_TRANSPOSE));
 for(const [patch,record] of Object.entries(SAMPLED_SOUND_CAPABILITIES))
  assert.equal(record.transposeSemitones,Object.hasOwn(SAMPLED_TRANSPOSE,patch)?SAMPLED_TRANSPOSE[patch]:undefined,patch);
 assert.equal(Object.values(SAMPLED_SOUND_CAPABILITIES).filter(r=>Object.hasOwn(r,'transposeSemitones')).length,1);
 // Program 73 is used by no other patch, so no shared program sounds at two octaves.
 assert.deepEqual(Object.entries(SAMPLED_PROGRAMS).filter(([,p])=>p===73).map(([id])=>id),['sampled_bass_flute_v1']);
 const voice=pianoNotes({patch_id:'sampled_bass_flute_v1',concrete:{freq_hz:440},duration_sec:.5})[0];assert.equal(voice.program,73);assert.equal(voice.pitch,57);
});
test('a bass flute note keeps its written pitch through save/reopen, compilation and capture; only the sound is an octave down',()=>{
 const doc=startJam(newPlayDoc());
 const own={id:'bf-note',role:'lead',patch_id:'sampled_bass_flute_v1',step:2,duration_steps:4,velocity:.6,concrete:{midi_pitch:74},provenance:'user_placed',pitch_lock_mode:'concrete'};
 doc.notes.push(structuredClone(own));
 const reopened=parseProjectJson(exportProjectJson(doc));assert.equal(reopened.ok,true);
 assert.deepEqual(reopened.song.notes.find(n=>n.id===own.id),own,'the saved note is unchanged');
 const a=compileSongStandalone(doc).events,b=compileSongStandalone(reopened.song).events;assert.deepEqual(b,a);
 const event=b.find(n=>n.id===own.id);
 assert.equal(event.concrete.midi_pitch,74);assert.equal(Math.round(69+12*Math.log2(event.concrete.freq_hz/440)),74,'the compiled score keeps the written pitch');
 assert.deepEqual(pianoNotes(event).map(v=>[v.program,v.pitch]),[[73,62]]);
 // A captured take of the same note keeps the written pitch too.
 const kept=materializePerformance(doc,{start:0,end:2,bpm:100,events:[{time:.4,duration:.5,occurrence:1,event:{...event,source_note_id:'bf-note'}}]});
 const take=kept.notes.find(n=>n.source_note_id==='bf-note');
 assert.equal(take.patch_id,'sampled_bass_flute_v1');assert.equal(take.concrete.midi_pitch,74);
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
