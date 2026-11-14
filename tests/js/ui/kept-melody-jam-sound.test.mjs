import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {planMelodicPhrase} from '../../../static/js/theory/melodic_evolution.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {tuneGridFromNotes} from '../../../static/js/theory/tune_model.js';
import {buildStandaloneSeed,compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {MELODY_SOUNDS,melodySoundEvents} from '../../../static/ui/melody_field_session.js';

const KALIMBA='sampled_kalimba_v1',MUSIC_BOX='sampled_music_box_v1',OCARINA='sampled_ocarina_v1',ORGAN='sampled_organ_v1';
const level=patch=>MELODY_SOUNDS.find(s=>s.patch===patch).level;
const close=(a,b)=>Math.abs(a-b)<1e-12;

/** A hip-hop jam that has developed one phrase (as the persist gate's 5C reached it). */
function developedJam() {
  let doc=startJam(buildStandaloneSeed(),{kind:'pitched',patchId:'sampled_piano_v1'});
  doc=setJamDirection(doc,{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',
    scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'hip-hop-v1',scene_mix:SCENE_MIX_VERSION});
  doc.notes=doc.notes.filter(n=>n.provenance!=='seed_template');
  doc.id='jam-song';
  const band=compileSongStandalone({...doc,arrangement_mode:'loop'}),stepSec=15/band.bpm;
  const phrase=planMelodicPhrase({version:2,phraseOrdinal:1,sceneId:'hip-hop-v1',root:0,minor:false,bpm:band.bpm,seed:7,previousPatch:'sampled_piano_v1'});
  doc.jam_session.melodic_evolution=structuredClone(phrase.descriptor);
  const song={...band,song_id:doc.id,events:[...band.events.filter(e=>e.role!=='lead'),...phrase.events]
    .map(e=>({...structuredClone(e),duration_steps:e.duration_steps??e.duration_sec/stepSec}))};
  return {doc,song,phrase};
}

/** Press Keep / Back to jam on the wheel with the real handler; the scheduler and screen are stand-ins. */
async function keepFromWheel(key,sound) {
  const {doc,song,phrase}=developedJam();
  const candidate={id:'melody-field-1:original'+(sound?':sound:'+sound:''),position:{x:0,y:0},soundPatch:sound,bandBalance:false,
    song:{...song,events:sound?melodySoundEvents(song.events,sound):song.events}};
  const field={palette:{},hasPlayed:true,sectionId:'melody-field-1',fromSaved:false,guide:null,bandBasis:null,
    phraseContext:{version:1,root:0,sceneId:'hip-hop-v1'},sourceDoc:structuredClone(doc),candidates:new Map([[candidate.id,candidate]])};
  const f=Object.create(PlayFlow.prototype);
  const scheduler={isPlaying:true,audioCtx:{currentTime:30},loadingSession:{state:'live',liveAt:2},stopGeneration:0,
    getPartAuditionState:()=>({sectionId:field.sectionId,realizedId:candidate.id}),capturePerformance:()=>null,
    // The jam's reached backing: the developed phrase leads it.
    activeJamBacking:()=>scheduler.isPlaying?{source_song_id:doc.id,leadPlan:{...structuredClone(phrase),planVersion:1},phraseContext:{sceneId:'hip-hop-v1'}}:null,
    // As LookaheadScheduler.stop(): the last reached lead plan is remembered for the stopped song.
    stop(){if(this.isPlaying)this.lastStoppedJamLead={source_song_id:doc.id,plan:this.activeJamBacking().leadPlan,formCursor:undefined};this.isPlaying=false;},
    onPlaybackEnded(){},markPerformanceKept(){}};
  Object.assign(f,{doc:structuredClone(doc),stage:'jam',melodyField:field,editingCard:null,sharedMaterial:null,undoStack:[],
    app:{scheduler,_announce(){}},_cancelDeferredInput(){},cancelFieldGesture(){},_pushUndo(){},_resetCapturedView(){},_reconcileRetainedPlaying(){},_go(stage){f.went=stage;}});
  f._compile=function(){
    // What _compile hands the scheduler: the canonical doc and the jam lead to resume.
    const canonical=this._canonicalDoc();
    this.compiled={evolution:structuredClone(canonical.jam_session.melodic_evolution),resume:this._savedMelodicLead(),
      song:compileReturnSong(canonical)};
  };
  await f._melodyFieldAction(key);
  return {f,phrase,doc};
}

test('Back to jam after a developed phrase continues with the kept Kalimba tune, not the pre-wheel phrase',async()=>{
  const {f}=await keepFromWheel('melody-field-back',KALIMBA);
  assert.equal(f.went,'jam');
  assert.equal(f.compiled.evolution,undefined,'the kept doc carries no stale jam phrase');
  assert.equal(f.compiled.resume,null,'the jam does not resume the pre-wheel phrase over the kept tune');
  const leads=f.compiled.song.events.filter(e=>e.role==='lead');
  assert.ok(leads.length>0&&leads.every(e=>e.patch_id===KALIMBA),'the jam starts from the kept tune in Kalimba');
  // Later saves of this song do not bring the stopped pre-wheel phrase back either.
  f.compiled=null;f._compile();
  assert.equal(f.compiled.evolution,undefined);
});

test('Keep this melody in another sound saves no pre-wheel jam phrase',async()=>{
  const {f}=await keepFromWheel('melody-field-keep',KALIMBA);
  assert.equal(f.went,'keep');
  assert.equal(Object.hasOwn(f.doc.jam_session,'melodic_evolution'),false);
});

test('Back to jam in the tune\'s own sound still resumes the phrase it kept',async()=>{
  const {f,phrase}=await keepFromWheel('melody-field-back',null);
  assert.deepEqual(f.compiled.evolution,phrase.descriptor);
  assert.deepEqual(f.compiled.resume?.descriptor,phrase.descriptor);
  assert.equal(f.compiled.resume.patch,f.compiled.song.events.find(e=>e.role==='lead').patch_id);
});

/** Run the tune-stage Change sound on a kept melody, with the real handler. */
async function changeSound(doc,id) {
  const f=Object.create(PlayFlow.prototype);
  Object.assign(f,{doc,stage:'tune',editingCard:null,eventRole:'lead',tuneGrid:{...tuneGridFromNotes(doc.notes),eventEditor:true},
    app:{scheduler:{stopGeneration:0},_announce(){}},_loadPiano:async()=>true,_canonicalDoc(){return f.doc;},
    _pushUndo(){},_stopForScopeChange(){},_compile(){},render(){},_noteChoice(){}});
  await f._changeInstrument(id);
  return f.doc;
}
function keptIn(sound) {
  const {doc,song}=developedJam();
  // One generated lead never had a velocity of its own.
  const events=song.events.map((e,i,all)=>e===all.find(x=>x.role==='lead')?(({velocity,...rest})=>rest)(e):e);
  return selectedMelody(doc,{...song,events:melodySoundEvents(events,sound)},
    {context:{version:1,root:0,sceneId:'hip-hop-v1',melodySound:sound},choice:{position:{x:0,y:0},requestId:'r'}});
}

test('tune-stage Change sound starts the new sound at the melody\'s own level, not the wheel\'s',async()=>{
  for(const sound of [MUSIC_BOX,OCARINA,KALIMBA]){
    const kept=keptIn(sound),bases=new Map(kept.notes.filter(n=>n.sound_base).map(n=>[n.id,n.sound_base]));
    assert.ok(bases.size>0);
    const doc=await changeSound(structuredClone(kept),ORGAN);
    for(const n of doc.notes.filter(n=>bases.has(n.id))){
      const base=bases.get(n.id);
      assert.equal(n.patch_id,ORGAN);assert.equal(Object.hasOwn(n,'sound_base'),false);
      if(Object.hasOwn(base,'velocity'))assert.ok(close(n.velocity,base.velocity),`${sound}: ${n.id} back to ${base.velocity}, got ${n.velocity}`);
      else assert.equal(Object.hasOwn(n,'velocity'),false,`${sound}: ${n.id} had no level of its own`);
    }
    assert.equal(doc.capture_notes.melody_field.context.melodySound,null);
    // Reopening the wheel: a sound choice scales from the melody's own level, so levels never stack.
    const source=compileReturnSong(doc).events.filter(e=>bases.has(e.id)),again=melodySoundEvents(source,MUSIC_BOX);
    for(const e of again){
      const base=bases.get(e.id),own=Number(base.velocity??.85);
      assert.ok(close(e.velocity,Math.min(1,own*level(MUSIC_BOX))),`${sound} then Organ then Music box: ${e.id} is a fresh Music box level`);
    }
  }
});

test('tune-stage Change sound after an Own-sound Keep stops Back to jam resuming the old phrase',async()=>{
  const kept=keptIn(null);
  assert.ok(kept.jam_session.melodic_evolution,'an Own-sound Keep keeps the phrase it played');
  const doc=await changeSound(structuredClone(kept),ORGAN);
  assert.equal(doc.jam_session.melodic_evolution,undefined,'the saved phrase no longer describes the Organ tune');
  const f=Object.create(PlayFlow.prototype);Object.assign(f,{doc,app:{scheduler:{}}});
  assert.equal(f._savedMelodicLead?.()??null,null,'nothing resumes over the chosen tune sound');
});

test('a band preset resets wheel levels like Change sound does',()=>{
  const kept=keptIn(MUSIC_BOX),bases=new Map(kept.notes.filter(n=>n.sound_base).map(n=>[n.id,n.sound_base]));
  const f=Object.create(PlayFlow.prototype);
  Object.assign(f,{doc:structuredClone(kept),tuneGrid:tuneGridFromNotes(kept.notes)});
  f._retimbreLeads(ORGAN);
  for(const n of f.doc.notes.filter(n=>bases.has(n.id))){
    const base=bases.get(n.id);assert.equal(n.patch_id,ORGAN);assert.equal(Object.hasOwn(n,'sound_base'),false);
    if(Object.hasOwn(base,'velocity'))assert.ok(close(n.velocity,base.velocity));else assert.equal(Object.hasOwn(n,'velocity'),false);
  }
  assert.equal(f.doc.capture_notes.melody_field.context.melodySound,null);
});
