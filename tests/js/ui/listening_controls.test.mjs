import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection,contributeJam} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION} from '../../../static/js/theory/scene_catalogue.js';
const press=(f,key)=>f._onClick({target:{closest:()=>({dataset:{key},focus(){}})}});
function flow(){return Object.assign(Object.create(PlayFlow.prototype),{stage:'start',doc:newPlayDoc({now:1,rand:()=>.5}),root:{querySelector:()=>null},_pushUndo(){},render(){},_acceptJamDoc(d){this.doc=d},async _startInstrument(){this.doc=startJam(this.doc,{patchId:'sampled_piano_v1'});this.stage='jam';return true},app:{_announce(){},scheduler:{audioCtx:{currentTime:0},setRepeatPlayback(){},start(){this.isPlaying=true}}}})}
test('fresh listening can begin at either end of the supported catalogue without changing audio safety',async()=>{for(const value of [0,.999999]){const f=flow();f.explorationRandom=()=>value;await press(f,'listen-explore');assert.equal(f.doc.jam_session.scene_id,SCENE_CATALOGUE[Math.floor(value*SCENE_CATALOGUE.length)].id);assert.equal(f.doc.jam_session.live_keys,true);assert.equal(f.app.scheduler.isPlaying,true)}});
test('explicit style change requests a different neighbor immediately and accepts a newer destination while a change is pending',async()=>{const f=flow();f.explorationRandom=()=>.99;await press(f,'listen-explore');const before=f.doc.jam_session.scene_id;f.app.scheduler.activeJamBacking=()=>({phraseContext:{sceneId:before}});await press(f,'change-style');assert.notEqual(f.doc.jam_session.scene_id,before);const next=JSON.stringify(f.doc);f.app.scheduler.pendingJamBacking={};await press(f,'change-style');assert.notEqual(JSON.stringify(f.doc),next)});
test('repeating dynamic contributions preserve the actually selected sound through style changes and JSON reopen',()=>{let doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'death-metal-v1'});const sound={patchId:'sampled_clean_guitar_v1',role:'lead',midi:66};doc=contributeJam(doc,{pad:0,step:3,sound});const own=doc.notes.filter(n=>n.provenance==='user_placed');assert.equal(own.length,4);assert.ok(own.every(n=>n.concrete.midi_pitch===66&&n.patch_id===sound.patchId));doc=setJamDirection(JSON.parse(JSON.stringify(doc)),{scene_id:'thrash-metal-v1'});assert.deepEqual(doc.notes.filter(n=>n.provenance==='user_placed'),own)});

 test('personal-only Keep retains live and repeating authored notes, excluding generated accompaniment',async()=>{const {personalPerformance}=await import('../../../static/js/theory/dynamic_keys.js');const events=[{event:{source_note_id:'jam-live-a',provenance:'user_placed'}},{event:{id:'jam-user-guitar-3',provenance:'user_placed'}},{event:{source_note_id:'live-only-1',provenance:'user_placed'}},{event:{id:'jam-user-spoof',provenance:'jam_generated'}},{event:{id:'band',provenance:'jam_generated'}}];const capture={events};assert.deepEqual(personalPerformance(capture,{includeRepeats:true}).events,events.slice(0,3));assert.equal(capture.events.length,5)});

test('music director resets stopped dwell without visual ticks and never starts audio',()=>{
 const f=flow();f.stage='jam';f.exploreTour={mode:'wide',settledAt:12};
 let advances=0;f._advanceExploreTour=()=>advances++;
 f.advanceMusic();assert.equal(f.exploreTour.settledAt,null);assert.equal(advances,0);
 f.app.scheduler.isPlaying=true;f.advanceMusic();assert.equal(advances,1);
 f.stage='song';f.advanceMusic();assert.equal(advances,1);
});
test('Stay pins the requested style without freezing its developing phrase',async()=>{
 const f=flow();await press(f,'listen-explore');const before=structuredClone(f.doc);
 f.app.scheduler.pendingJamBacking={};await press(f,'stay-style');
 assert.equal(f.exploreTour,null);assert.deepEqual(f.doc,before);
 assert.equal(f.doc.jam_session.anchor_backing,undefined);
 await press(f,'stay-style');assert.equal(f.exploreTour.mode,'wide');
});
test('stopped captured history from another song is never kept; Keep keeps this band instead of refusing',()=>{
 const f=flow();f.stage='jam';f.doc=startJam(f.doc);f.doc.jam_session.live_keys=false;
 f.app.scheduler.lastStoppedPerformance={source_song_id:'another-song',events:[{event:{id:'foreign',role:'lead',step:0}}]};
 const messages=[];f.app._announce=m=>messages.push(m);
 f._stopForScopeChange=()=>{};f._finishPartEdit=()=>{};f._compile=()=>{};f._resetCapturedView=()=>{};f._go=stage=>{f.stage=stage;};
 f._captureDirection();
 assert.equal(f.stage,'song');assert.equal(f.doc.captured_performance,undefined,'playing from another song is not captured');
 assert.ok(!messages.some(m=>/Press Play|first|No notes/.test(m)),'no refusal');
});

test('honeycomb pages expose every real neighbor, and all directions remain selectable',async()=>{
 const {compatibleSceneIndices}=await import('../../../static/js/theory/scene_catalogue.js');
 for(let i=0;i<SCENE_CATALOGUE.length;i++){
  const f=flow();f.stage='jam';f.doc=setJamDirection(startJam(f.doc),{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:SCENE_CATALOGUE[i].id});
  const expected=compatibleSceneIndices(i),actual=[];
  for(let page=0;page<Math.ceil(expected.length/6);page++){
   f.honeycombPage=page;const html=f._honeycombHtml();
   const ids=[...html.matchAll(/data-key="honey-style:(\d+)"/g)].map(m=>Number(m[1]));
   assert.ok(ids.length<=6);actual.push(...ids);
   assert.equal((html.match(/<option /g)||[]).length,SCENE_CATALOGUE.length);
  }
  assert.deepEqual(actual,expected);
 }
});
test('honeycomb selects only connected neighbors while a bridge is pending',async()=>{
 const {compatibleSceneIndices}=await import('../../../static/js/theory/scene_catalogue.js');
 const f=flow();await press(f,'listen-explore');const current=Math.round(f.doc.jam_session.style_spectrum),next=compatibleSceneIndices(current)[0];
 let selected=null;f._selectJamProfile=i=>selected=i;
 f.app.scheduler.pendingJamBacking={};await press(f,`honey-style:${next}`);assert.equal(selected,next);
 f.app.scheduler.pendingJamBacking=null;await press(f,`honey-style:${next}`);assert.equal(selected,next);
 selected=null;await press(f,`honey-style:${current}`);assert.equal(selected,null);
});

test('field mailbox coalesces rapid input, one drag undo, and discards stopped or replaced scope',()=>{
 const f=flow();f.stage='jam';f.doc=setJamDirection(startJam(f.doc),{music_field:{version:1,x:.5,y:.5}});
 f._paintMusicField=()=>{};let edits=0,undos=0;f._pushUndo=()=>undos++;
 f._acceptJamDoc=doc=>{f.doc=doc;edits++};f.app.scheduler.stopGeneration=1;
 for(let i=0;i<100;i++)f._requestMusicField({x:i/100,y:.2},true);
 assert.equal(edits,0);assert.equal(undos,1);f._flushMusicField();assert.equal(edits,1);assert.equal(f.doc.jam_session.music_field.x,.99);
 f._requestMusicField({x:0,y:1},true);f.app.scheduler.stopGeneration++;f._flushMusicField();assert.equal(edits,1);assert.equal(f.fieldIntent,null);
 f._requestMusicField({x:0,y:1},true);f.doc.id='another-song';f._flushMusicField();assert.equal(edits,1);
});

test('field status never plots an older coordinate system as the new realized position',()=>{
 const f=flow();f.stage='jam';f.doc=setJamDirection(startJam(f.doc),{music_field:{version:2,x:.5,y:.5}});
 const requested={style:{}},realized={style:{}},label={};
 const element={querySelector:s=>s==='[data-field-requested]'?requested:realized};
 f.root={querySelector:s=>s==='[data-music-field]'?element:label,querySelectorAll:()=>[]};
 let version=1;f.app.scheduler.isPlaying=true;f.app.scheduler.activeJamBacking=()=>({phraseContext:{musicField:{version,x:.5,y:.5}}});
 f._paintMusicField();assert.equal(realized.hidden,true);assert.match(label.textContent,/Moving toward/);
 version=2;f._paintMusicField();assert.equal(realized.hidden,false);assert.match(label.textContent,/^Playing:/);
});
