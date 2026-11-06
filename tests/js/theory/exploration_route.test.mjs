import test from 'node:test';
import assert from 'node:assert/strict';
import {nextExplorationStyle,EXPLORATION_DWELL_SECONDS} from '../../../static/js/theory/exploration_route.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
test('wandering varies next directions and avoids current/recent arrangements',()=>{
 assert.equal(EXPLORATION_DWELL_SECONDS,20);
 assert.notEqual(nextExplorationStyle(0,[],()=>0),nextExplorationStyle(0,[],()=>.99));
 for(let current=0;current<4;current++)for(const r of [0,.25,.5,.99]){
  assert.notEqual(nextExplorationStyle(current,[],()=>r),current);
  const recent=[(current+1)%4,(current+2)%4];
  assert.ok(![current,recent.at(-1)].includes(nextExplorationStyle(current,recent,()=>r)));
 }
 // History must not lock a four-style map into a permanent four-item playlist.
 assert.notEqual(nextExplorationStyle(2,[0,1],()=>0),nextExplorationStyle(2,[0,1],()=>.99));
});
test('showcase waits twenty settled seconds then changes arrangement, not a tiny phrase variant',()=>{
 const flow=Object.create(PlayFlow.prototype);
 Object.assign(flow,{stage:'jam',doc:setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',style_spectrum:0}),exploreTour:{mode:'wide',settledAt:0},explorationRandom:()=>.99,render(){},_acceptJamDoc(doc){this.doc=doc;},app:{scheduler:{isPlaying:true,audioCtx:{currentTime:19.99},jamBridgeStage:null}}});
 flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,0);
 flow.app.scheduler.audioCtx.currentTime=20;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,3);
 assert.equal(flow.doc.jam_session.scene_variant,'base');assert.equal(flow.exploreTour.settledAt,null);
 flow.app.scheduler.jamBridgeStage=1;flow.app.scheduler.audioCtx.currentTime=23;flow._advanceExploreTour();assert.equal(flow.exploreTour.settledAt,null);
 flow.app.scheduler.jamBridgeStage=null;flow.app.scheduler.lastJamBackingCommit={audioTime:25};flow._advanceExploreTour();assert.equal(flow.exploreTour.settledAt,null);
 flow.app.scheduler.audioCtx.currentTime=25;flow._advanceExploreTour();assert.equal(flow.exploreTour.settledAt,25);
 flow.app.scheduler.audioCtx.currentTime=44.99;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,3);
 flow.app.scheduler.isPlaying=false;flow.app.scheduler.audioCtx.currentTime=100;flow._advanceExploreTour();assert.equal(flow.doc.jam_session.style_spectrum,3);
});
import {nextUnvisitedStyle} from '../../../static/js/theory/exploration_route.js';
import {SCENE_CATALOGUE,compatibleSceneIndices,sceneIndex,SCENE_CATALOGUE_VERSION} from '../../../static/js/theory/scene_catalogue.js';
test('wide exploration escapes blues branches and reaches every connected catalogue scene without invented edges',()=>{for(const random of [()=>0,()=>.5,()=>.99]){let at=sceneIndex('texas-blues-v1'),visited=[];for(let i=0;i<250&&new Set(visited).size<SCENE_CATALOGUE.length;i++){visited.push(at);const next=nextUnvisitedStyle(at,visited,compatibleSceneIndices,random);assert.ok(compatibleSceneIndices(at).includes(next));at=next;}assert.equal(new Set(visited).size,SCENE_CATALOGUE.length)}});
test('exhausted leaf backtracks toward unvisited styles, then an exhausted catalogue still moves',()=>{const neighbors=n=>[[1],[0,2],[1]][n];assert.equal(nextUnvisitedStyle(0,[0,1],neighbors,()=>0),1);assert.equal(nextUnvisitedStyle(1,[0,1,2],neighbors,()=>.99),2)});
test('long blues form requests its next connected style after twenty seconds, without forcing a full form wait',()=>{const doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{showcase_version:1,scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'texas-blues-v1'});const f=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',exploreTour:{mode:'wide',settledAt:0},explorationRandom:()=>.99,_queueMelodicEvolution(){},_acceptJamDoc(d){this.doc=d},render(){},app:{scheduler:{isPlaying:true,audioCtx:{currentTime:19.99}}}});f._advanceExploreTour();assert.equal(f.doc.jam_session.scene_id,'texas-blues-v1');f.app.scheduler.audioCtx.currentTime=20;f._advanceExploreTour();assert.equal(f.doc.jam_session.scene_id,'chicago-blues-v1')});
