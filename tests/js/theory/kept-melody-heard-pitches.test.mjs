import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {planMelodicPhrase,restoreMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {validateProject} from '../../../static/js/theory/project_validation.js';
import {buildStandaloneSeed,compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {melodySoundEvents} from '../../../static/ui/melody_field_session.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';

// A kept melody must play the notes the child heard on the wheel. The jam's developed phrases
// (melodic evolution v1/v2/v3) carry concrete pitches but name no pitch rule, so the compiler used
// to re-place them on chord roots once kept (wheel 72 67 64 ..., kept song 60 60 67 ...).
const KALIMBA='sampled_kalimba_v1';
const heardMidi=e=>{const p=69+12*Math.log2(e.concrete.freq_hz/440);return Math.abs(p-Math.round(p))<.01?Math.round(p):p;};
const byStep=events=>[...events].sort((a,b)=>a.step-b.step||String(a.id).localeCompare(String(b.id)));
const leadMidi=events=>byStep(events.filter(e=>e.role==='lead')).map(e=>e.concrete.midi_pitch);

function jam(sceneId='hip-hop-v1') {
  let doc=startJam(buildStandaloneSeed(),{kind:'pitched',patchId:'sampled_piano_v1'});
  doc=setJamDirection(doc,{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',
    scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:sceneId,scene_mix:SCENE_MIX_VERSION});
  // The starter's own relational notes are not part of this jam's music.
  doc.notes=doc.notes.filter(n=>n.provenance!=='seed_template');
  return doc;
}

/** The jam after it developed one phrase, and the wheel's Original candidate built from what it played. */
function developed({version=2,sceneId=version===3?'reggae-v1':'hip-hop-v1',seed=7}={}) {
  const doc=jam(sceneId),band=compileSongStandalone({...doc,arrangement_mode:'loop'}),harmony=phraseContext(doc)?.harmony;
  if(version===3)assert.ok(harmony,`${sceneId} gives the jam a phrase harmony`);
  const phrase=planMelodicPhrase({version,...(version===3?{harmony}:{}),phraseOrdinal:1,sceneId,root:0,minor:false,
    bpm:band.bpm,seed,previousPatch:'sampled_piano_v1'});
  doc.jam_session.melodic_evolution=structuredClone(phrase.descriptor);
  const stepSec=15/band.bpm;
  // What the scheduler dispatches in the jam: the band, with the developed phrase as its lead.
  const s=Object.create(LookaheadScheduler.prototype);
  Object.assign(s,{activeJamLead:{events:structuredClone(phrase.events)},committedJamBacking:band.events.filter(e=>e.provenance==='jam_generated'),
    compiledSong:{...band,events:[]},loopStartStep:0,loopEndStep:null,repeatPlayback:true});
  const played=s._effectiveJamBacking();
  // The wheel's source (melody_workspace + MelodyFieldSession): the same events with step lengths.
  const song={...band,events:played.map(e=>({...structuredClone(e),duration_steps:e.duration_steps??e.duration_sec/stepSec}))};
  return {doc,song,phrase};
}
const keep=(doc,song,sound=null)=>selectedMelody(doc,{...song,events:sound?melodySoundEvents(song.events,sound):song.events},
  {context:{version:1,root:0,sceneId:doc.jam_session.scene_id,melodySound:sound},choice:{position:{x:0,y:0},requestId:'heard'}});

test('the jam plays a developed phrase at its concrete pitches (what the child hears)',()=>{
  for(const version of [1,2,3]){
    const {song,phrase}=developed({version});
    const leads=song.events.filter(e=>e.role==='lead');
    assert.equal(leads.length,phrase.events.length,`v${version}: the jam's lead is the developed phrase`);
    assert.ok(leads.every(e=>e.pitch_lock_mode===undefined),`v${version}: developed notes name no pitch rule`);
    assert.deepEqual(byStep(leads).map(heardMidi),leadMidi(leads),`v${version}: the sounding frequency is the concrete pitch`);
  }
});

test('Keep after a sound change plays the developed phrase at the pitches heard on the wheel',()=>{
  for(const version of [1,2,3]) for(const sound of [null,KALIMBA]){
    const {doc,song}=developed({version}),heard=sound?melodySoundEvents(song.events,sound):song.events;
    const kept=JSON.parse(JSON.stringify(keep(doc,song,sound)));
    const compiled=compileReturnSong(kept);
    assert.deepEqual(leadMidi(compiled.events),byStep(heard.filter(e=>e.role==='lead')).map(heardMidi),`v${version} ${sound||'own sound'}: kept lead = heard lead`);
    // Every pitched note of the heard score, band too, compiles to the pitch that was heard.
    const out=new Map(compiled.events.map(e=>[e.id,e]));
    for(const e of heard.filter(e=>e.role!=='drums'))assert.equal(out.get(e.id)?.concrete.midi_pitch,heardMidi(e),`${e.id} keeps its heard pitch`);
    assert.ok(kept.notes.filter(n=>n.role==='lead').every(n=>n.pitch_lock_mode==='concrete'));
  }
});

test('Back to jam, reopen and export of the kept melody use those same pitches',()=>{
  const {doc,song}=developed({version:2}),kept=keep(doc,song,KALIMBA);
  const heard=byStep(melodySoundEvents(song.events,KALIMBA).filter(e=>e.role==='lead')).map(heardMidi);
  // Back to jam and export compile the saved doc; reopen compiles it after a JSON round trip.
  assert.deepEqual(leadMidi(compileSongStandalone({...kept,arrangement_mode:'loop'}).events),heard);
  const reopened=JSON.parse(JSON.stringify(kept));
  validateProject(structuredClone(reopened));
  const source=compileReturnSong(reopened);
  assert.deepEqual(leadMidi(source.events),heard);
  // Keeping the reopened tune again changes nothing.
  const stepSec=15/source.bpm,again=selectedMelody(reopened,{...source,events:source.events.map(e=>({...e,duration_steps:e.duration_steps??e.duration_sec/stepSec}))},
    {context:reopened.capture_notes.melody_field.context,choice:{position:{x:0,y:0},requestId:'again'}});
  assert.deepEqual(leadMidi(compileReturnSong(again).events),heard);
});

test('a live note the child played keeps its pitch through Keep',()=>{
  const {doc,song}=developed({version:2}),bpm=song.bpm,stepSec=15/bpm;
  // melody_workspace adds a played key with its sounding frequency and pitch, and no pitch rule.
  const live={id:'workspace-3-jam-live-9',source_note_id:'jam-live-9',role:'lead',patch_id:'sampled_piano_v1',provenance:'user_placed',
    step:9,duration_steps:3,duration_sec:3*stepSec,velocity:.7,concrete:{freq_hz:440*2**((71-69)/12),midi_pitch:71},performance:{version:1,offset_steps:.25}};
  const kept=keep(doc,{...song,events:[...song.events,live]});
  const out=compileReturnSong(JSON.parse(JSON.stringify(kept))).events.find(e=>e.id===live.id);
  assert.equal(out.concrete.midi_pitch,71);
  assert.equal(out.provenance,'user_placed');
});

test('notes with their own pitch rule keep it: relational stays relational, drums get no rule',()=>{
  const {doc,song}=developed({version:2}),stepSec=15/song.bpm;
  const hummed={id:'hum-1',role:'lead',patch_id:'pluck_lead',provenance:'hummed_confirmed',step:20,duration_steps:2,duration_sec:2*stepSec,velocity:.6,
    pitch_lock_mode:'relational',relational:{anchor:'chord_tone',chord_tone_index:1,scale_degree_offset:0,octave_offset:0},concrete:{midi_pitch:64,freq_hz:329.63}};
  const placed={id:'jam-user-sampled_piano_v1-4',role:'lead',patch_id:'sampled_piano_v1',provenance:'user_placed',step:4,duration_steps:2,duration_sec:2*stepSec,velocity:.7,
    pitch_lock_mode:'concrete',concrete:{midi_pitch:67}};
  const kept=keep(doc,{...song,events:[...song.events,hummed,placed]});
  const note=id=>kept.notes.find(n=>n.id===id);
  assert.equal(note('hum-1').pitch_lock_mode,'relational');
  assert.deepEqual(note('hum-1').relational,hummed.relational);
  assert.equal(note(placed.id).pitch_lock_mode,'concrete');
  const drums=kept.notes.filter(n=>n.role==='drums');
  assert.ok(drums.length>0);
  assert.deepEqual(drums.map(n=>n.pitch_lock_mode),song.events.filter(e=>e.role==='drums').map(e=>e.pitch_lock_mode));
});

test('an older save without the pitch rule still opens and plays as it always did',()=>{
  const {doc,song}=developed({version:2}),kept=keep(doc,song,KALIMBA);
  // Saved before this fix: the same doc, with the developed notes naming no pitch rule.
  const old=JSON.parse(JSON.stringify(kept));
  for(const n of old.notes)if(n.evolution)delete n.pitch_lock_mode;
  const before=JSON.stringify(old);
  validateProject(structuredClone(old));
  const played=leadMidi(compileReturnSong(old).events);
  assert.equal(JSON.stringify(old),before,'opening and compiling never rewrites the saved notes');
  assert.ok(old.notes.filter(n=>n.evolution).every(n=>!Object.hasOwn(n,'pitch_lock_mode')));
  // It plays the chord-root placement it was saved with, not a silent upgrade.
  assert.notDeepEqual(played,leadMidi(compileReturnSong(kept).events));
  // Keeping it again from the wheel keeps exactly what it plays.
  const source=compileReturnSong(old),stepSec=15/source.bpm;
  const again=selectedMelody(old,{...source,events:source.events.map(e=>({...e,duration_steps:e.duration_steps??e.duration_sec/stepSec}))},
    {context:old.capture_notes.melody_field.context,choice:{position:{x:0,y:0},requestId:'again'}});
  assert.deepEqual(leadMidi(compileReturnSong(again).events),played);
});

test('the kept doc keeps the jam phrase only while its lead is that phrase in its own sound',()=>{
  const {doc,song,phrase}=developed({version:2});
  // Own sound: the kept lead is the jam's phrase as it played, so the jam may resume it.
  const own=keep(doc,song);
  assert.deepEqual(own.jam_session.melodic_evolution,phrase.descriptor);
  assert.equal(restoreMelodicPhrase(own.jam_session.melodic_evolution).patch,own.notes.find(n=>n.role==='lead').patch_id);
  // Kalimba: resuming the saved phrase would replace the kept tune with the pre-wheel sound.
  const kalimba=keep(doc,song,KALIMBA);
  assert.equal(Object.hasOwn(kalimba.jam_session,'melodic_evolution'),false);
  // Other notes (a composed candidate): the jam continues from the kept tune too.
  const composed={...song,events:song.events.map(e=>e.role==='lead'?{...e,id:`composed-${e.step}`,evolution:undefined,generated_by:'musiclab_phrase_composer_v9',pitch_lock_mode:'concrete'}:e)};
  const other=selectedMelody(doc,composed,{context:{version:1,root:0,sceneId:'hip-hop-v1'},choice:{position:{x:.5,y:.5},requestId:'other'}});
  assert.equal(Object.hasOwn(other.jam_session,'melodic_evolution'),false);
  // The archives keep the jam as it was.
  assert.deepEqual(kalimba.capture_source.jam_session.melodic_evolution,phrase.descriptor);
  assert.deepEqual(kalimba.melody_original.jam_session.melodic_evolution,phrase.descriptor);
  assert.deepEqual(doc.jam_session.melodic_evolution,phrase.descriptor,'the source doc is untouched');
});
