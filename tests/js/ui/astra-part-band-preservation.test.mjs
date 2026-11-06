import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {ensureSectionIds} from '../../../static/js/theory/song_view.js';
import {startJam} from '../../../static/js/theory/jam_session.js';
const press=(f,key)=>f._onClick({target:{closest:()=>({dataset:{key},focus(){}})}});
function fixture(){
 const f=Object.create(PlayFlow.prototype),values=new Map();
 globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 f.root={querySelector:()=>null}; f.render=()=>{};f.cancelFieldGesture=()=>{};f._stopForScopeChange=()=>{};
 f.stage='song';f.trail=[];f.confirm={};f.app={scheduler:{clearMuteLayers(){},setLoopRange(){},setRepeatPlayback(){},setSpotlightRole(){},setCompiledSong(){},getPartAuditionState(){return this.state},isPlaying:true},_announce(m){f.message=m}};
 f._freshState(); f.doc=startJam(f.doc,{kind:'pitched',patchId:'warm_keys'});f.doc.song_cards=ensureSectionIds([{bars:4},{bars:4}]);
 f._compile();f.partComparison={kind:'band',index:0,sectionId:f.doc.song_cards[0].section_id,before:structuredClone(f._canonicalDoc()),sceneId:null};
 f._selectPartBand('reggae-v1');
 return {f,values};
}
test('audition requests do not change canonical document, draft or Undo',()=>{
 const {f,values}=fixture();const doc=structuredClone(f._canonicalDoc()),saved=[...values],depth=f.undoStack.length;
 f._selectPartBand('ska-v1');assert.deepEqual(f._canonicalDoc(),doc);assert.deepEqual([...values],saved);assert.equal(f.undoStack.length,depth);
});
test('Keep commits realized candidate, preserves unrelated later section setting, and adds one Undo',async()=>{
 const {f}=fixture(),c=f.partComparison;const heard=c.candidates[c.requestedId];
 f._selectPartBand('ska-v1');f.app.scheduler.state={sectionId:c.sectionId,realizedId:heard.requestId,requestedId:c.requestedId};
 f.doc.song_cards[1].role_name='Later edit';const before=structuredClone(f._canonicalDoc()),depth=f.undoStack.length;
 await press(f,'compare-keep');assert.deepEqual(f.doc.song_cards[0].material,heard.trial.material);assert.equal(f.doc.song_cards[1].role_name,'Later edit');assert.equal(f.undoStack.length,depth+1);
 f._undo();assert.deepEqual(f._canonicalDoc(),before);
});
test('stale realized trial cannot overwrite changed target and creates no Undo',async()=>{
 const {f}=fixture(),c=f.partComparison;f.app.scheduler.state={sectionId:c.sectionId,realizedId:c.requestedId,requestedId:c.requestedId};
 f.doc.song_cards[0].role_name='Later target edit';const before=structuredClone(f._canonicalDoc()),depth=f.undoStack.length;
 await press(f,'compare-keep');assert.deepEqual(f._canonicalDoc(),before);assert.equal(f.undoStack.length,depth);
});

test('stopped realization wins over the most recently requested unplayed band',async()=>{
 const {f}=fixture(),c=f.partComparison,heard=c.candidates[c.requestedId];
 f._selectPartBand('ska-v1');f.app.scheduler.isPlaying=false;f.app.scheduler.lastPartAuditionState={sectionId:c.sectionId,realizedId:heard.requestId,requestedId:c.requestedId};
 await press(f,'compare-keep');assert.deepEqual(f.doc.song_cards[0].material,heard.trial.material);
});
test('reordering follows realized section identity while deleting it refuses Keep',async()=>{
 for(const remove of [false,true]){
  const {f}=fixture(),c=f.partComparison,heard=c.candidates[c.requestedId];f.app.scheduler.state={sectionId:c.sectionId,realizedId:heard.requestId,requestedId:heard.requestId};
  if(remove)f.doc.song_cards.shift();else f.doc.song_cards.reverse();const before=structuredClone(f._canonicalDoc()),depth=f.undoStack.length;
  await press(f,'compare-keep');
  if(remove){assert.deepEqual(f._canonicalDoc(),before);assert.equal(f.undoStack.length,depth);}else {assert.equal(f.activeSongCard,1);assert.deepEqual(f.doc.song_cards[1].material,heard.trial.material);assert.deepEqual(f.doc.song_cards[0],before.song_cards[0]);}
 }
});
test('closing and global Stop restore canonical playback while keeping stopped candidate available',async()=>{
 for(const close of [true,false]){
  const {f}=fixture(),c=f.partComparison,s=f.app.scheduler,heard=c.candidates[c.requestedId],canonical=f.app.compiledSong;
  c.auditionStarted=true;c.canonicalRestored=false;s.compiledSong=f._partCandidateCompiled(heard);
  s.state={sectionId:c.sectionId,realizedId:heard.requestId,requestedId:heard.requestId};
  s.setCompiledSong=song=>{s.compiledSong=song;s.state=null;};
  s.stop=()=>{s.lastPartAuditionState=s.state;s.state=null;s.isPlaying=false;};
  // The actual app onPlaybackEnded calls render, whose comparison branch syncs.
  f.render=()=>{if(f.partComparison)f._syncPartAudition();};s.onPlaybackEnded=()=>f.render();
  f._stopForScopeChange=PlayFlow.prototype._stopForScopeChange;
  if(close)await press(f,'compare-close');else {s.stop();f.render();}
  assert.equal(s.compiledSong,canonical);assert.equal(c.realized,heard);
  // Main transport starts whichever compiled song is installed.
  s.start=()=>{s.isPlaying=true;s.played=s.compiledSong;};s.start();assert.equal(s.played,canonical);
  assert.equal(f.doc.song_cards[0].material,undefined,'unkept material never enters the document');
 }
});
