import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlock,SCENE_ID} from '../../../static/js/theory/black_metal_form_score.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {createJamFormBuilder} from '../../../static/js/theory/jam_form_program.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {songEvents,applySongMaterial} from '../../../static/js/theory/song_view.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {sceneIndex,SCENE_CATALOGUE} from '../../../static/js/theory/scene_catalogue.js';

const make=()=>setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:SCENE_ID,responsive:false});
test('choosing the arrangement at a fast legacy tempo slows to fit with one Undo, while the tour still skips it',()=>{
 const doc=setJamDirection(make(),{scene_id:'death-metal-v1'});doc.global_context.bpm=175;
 const fast=structuredClone(doc),messages=[];let undos=0;
 const f=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',explorationRandom:()=>.999,app:{_announce:m=>messages.push(m),scheduler:{isPlaying:false}},_compile(){},_pushUndo(){undos++;},_acceptJamDoc(d){this.doc=d;},render(){}});
 f._selectJamProfile(sceneIndex(SCENE_ID));assert.equal(undos,1);assert.equal(f.doc.global_context.bpm,160);assert.equal(f.doc.jam_session.scene_id,SCENE_ID);
 assert.match(messages[0],/Slowed down/);assert.ok(!messages.some(m=>/supports up to/.test(m)),'no refusal');
 f.doc=fast;let at=sceneIndex('death-metal-v1');for(let i=0;i<SCENE_CATALOGUE.length*2;i++){at=f._nextExplorationDirection(at);assert.notEqual(SCENE_CATALOGUE[at].id,SCENE_ID);}
 assert.equal(parseProjectJson(exportProjectJson(doc)).ok,true);
});
test('upper phrases descend without pitch-class octave jumps and develop over four cycles',()=>{
 for(let root=0;root<12;root++)for(let cycle=0;cycle<4;cycle++){
  const score=buildBlock(SCENE_ID,{root,cycle});
  for(let bar=0;bar<4;bar++){
   const line=score.notes.filter(n=>n.role==='lead'&&n.position>=bar*16&&n.position<(bar+1)*16);
   assert.ok(line.every((n,i)=>i===0||n.pitch<=line[i-1].pitch));
  }
  const starts=[0,16,32].map(at=>score.notes.find(n=>n.role==='lead'&&n.position===at).pitch);
  assert.ok(starts[0]>starts[1]&&starts[1]>starts[2]);
  assert.ok(score.notes.filter(n=>n.role==='bass').every(n=>n.gate===14));
 }
 for(const blockIndex of[0,1])assert.equal(new Set(Array.from({length:4},(_,cycle)=>JSON.stringify(buildBlock(SCENE_ID,{cycle,blockIndex}).notes.filter(n=>n.role==='lead').map(n=>n.pitch)))).size,4);
 const doc=make(),before=structuredClone(doc);doc.global_context.bpm=161;
 assert.throws(()=>setJamDirection(doc,{}),/160 BPM/);
 assert.equal(parseProjectJson(exportProjectJson(doc)).ok,false);
 doc.global_context.bpm=before.global_context.bpm;assert.deepEqual(doc,before);
 assert.equal(parseProjectJson(exportProjectJson(doc)).ok,true);
});

test('captured upper and return phrases preserve held personal notes, timing and independent edits',()=>{
 const d=make(),p=createJamFormBuilder()(d),a=p.blocks[0].variants[0].events,b=p.blocks[1].variants[0].events;
 const first=a.find(e=>e.voice_id==='upper-repetition'&&e.step===0),second=b.find(e=>e.voice_id==='upper-repetition'&&e.step===0),bass=b.find(e=>e.voice_id==='long-root'&&e.step===0),future=b.find(e=>e.voice_id==='upper-repetition'&&e.step===1);
 const own={id:'jam-live-black-metal',source_note_id:'jam-live-black-metal',role:'lead',patch_id:'sampled_clean_guitar_v1',provenance:'user_placed',concrete:{midi_pitch:62},pitch_lock_mode:'concrete',velocity:.47};
 const s=new LookaheadScheduler();s.audioCtx={currentTime:9.7};s.isPlaying=true;
 s.performanceTake={song_id:d.id,start:0,bpm:100,capture_bars:8,events:[{event:first,time:0,duration:first.duration_sec,occurrence:1},{event:second,time:9.6,duration:second.duration_sec,occurrence:2},{event:bass,time:9.6,duration:bass.duration_sec,occurrence:3},{event:future,time:9.75,duration:future.duration_sec,occurrence:4},{event:own,time:9.5,duration:1,occurrence:5}]};
 const cap=s.capturePerformance();assert.equal(cap.events.length,4);assert.ok(!cap.events.some(e=>e.event.id===future.id));
 const kept=materializePerformance(d,cap),original=structuredClone(kept);
 const target=kept.song_cards.flatMap(c=>c.material?.notes||[]).find(n=>n.voice_id==='upper-repetition');assert.ok(target);target.concrete.midi_pitch++;
 const full=doc=>{const base=structuredClone(doc);delete base.song_cards;return songEvents(compileSongStandalone(base),doc.song_cards,doc.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null));};
 const reopened=parseProjectJson(exportProjectJson(kept));assert.equal(reopened.ok,true);
 const events=full(reopened.song).events,prior=full(original).events;assert.equal(events.length,4);
 for(const e of events){const old=prior.find(x=>x.id===e.id);assert.equal(e.concrete.midi_pitch,old.concrete.midi_pitch+(e.source_note_id===target.source_note_id?1:0));assert.equal(e.start_sec,old.start_sec);assert.equal(e.duration_sec,old.duration_sec);assert.equal(e.provenance,old.provenance);}
 const ownOut=events.filter(e=>e.source_note_id===own.id);assert.equal(ownOut.length,1);assert.equal(ownOut[0].concrete.midi_pitch,62);assert.ok(Math.abs(ownOut[0].duration_sec-.2)<1e-8);assert.deepEqual(reopened.song.captured_performance,original.captured_performance);
});
