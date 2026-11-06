// Phase 14.3: what a person plays during Listen leans where the band explores next.
import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceLean,backingActivity,leanWeights,leanWords,BIAS_MIN,BIAS_MAX,BIAS_MIN_NOTES} from '../../../static/js/theory/exploration_bias.js';
import {nextExplorationStyle,nextUnvisitedStyle} from '../../../static/js/theory/exploration_route.js';
import {SCENE_CATALOGUE,compatibleSceneIndices,sceneIndex,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';

const own=(time,hold,extra={})=>({time,duration:hold,released_at:time+hold,event:{provenance:'user_placed',source_note_id:`jam-live-x-${time}`,role:'lead',concrete:{freq_hz:440},...extra}});
const take=(events,bpm=120)=>({bpm,steps_per_bar:16,events});

test('fewer than a few notes, echoes and drums do not lean',()=>{
  assert.equal(performanceLean(take([own(1,.2),own(2,.2)]),10),null);
  const echoes=[1,2,3,4].map(t=>({...own(t,.2),event:{...own(t,.2).event,provenance:'jam_answer',source_note_id:'jam-answer-1'}}));
  assert.equal(performanceLean(take(echoes),10),null);
  const drums=[1,2,3,4].map(t=>own(t,.2,{role:'drums'}));
  assert.equal(performanceLean(take(drums),10),null);
  assert.equal(performanceLean(null,10),null);
  assert.equal(BIAS_MIN_NOTES,3);
});

test('busy short playing leans toward movement; sparse held playing leans toward space',()=>{
  const busy=performanceLean(take(Array.from({length:16},(_,i)=>own(10+i*.25,.1))),14);
  assert.ok(busy.lean>0,`busy lean ${busy.lean}`);
  const calm=performanceLean(take([own(2,2),own(6,2.5),own(10,2)]),14);
  assert.ok(calm.lean<0,`calm lean ${calm.lean}`);
  // Old notes outside the window are not read.
  assert.equal(performanceLean(take([own(1,.1),own(1.2,.1),own(1.4,.1)]),100),null);
});

test('backing activity is notes per bar of the generated band',()=>{
  assert.equal(backingActivity([],16),0);
  const notes=Array.from({length:32},(_,i)=>({step:i,duration_steps:1}));
  assert.equal(backingActivity(notes,16),16);
});

test('lean weights favour the leaned direction, stay bounded, and never shut a candidate',()=>{
  const activity={0:10,1:20,2:5};
  const up=leanWeights(1,activity[0],i=>activity[i]);
  assert.ok(up(1)>1&&up(2)<1&&up(1)<=BIAS_MAX&&up(2)>=BIAS_MIN);
  const down=leanWeights(-1,activity[0],i=>activity[i]);
  assert.ok(down(2)>1&&down(1)<1);
  assert.equal(leanWeights(0,10,()=>99)(1),1);
  assert.equal(leanWeights(1,0,()=>99)(1),1);
  assert.equal(up(7),1); // unknown candidate: unweighted
  // The route still reaches every candidate under a strong lean (weights are never zero).
  const seen=new Set();for(let r=0;r<1;r+=.01)seen.add(nextExplorationStyle(0,[],()=>r,[0,1,2],[],up));
  assert.deepEqual([...seen].sort(),[1,2]);
});

test('a leaned wide tour still covers the whole connected catalogue without invented edges',()=>{
  const bias=i=>i%2?BIAS_MAX:BIAS_MIN;
  for(const random of [()=>0,()=>.5,()=>.99]){
    let at=sceneIndex('texas-blues-v1'),visited=[];
    for(let i=0;i<250&&new Set(visited).size<SCENE_CATALOGUE.length;i++){visited.push(at);const next=nextUnvisitedStyle(at,visited,compatibleSceneIndices,random,[],bias);assert.ok(compatibleSceneIndices(at).includes(next));at=next;}
    assert.equal(new Set(visited).size,SCENE_CATALOGUE.length);
  }
});

test('the flow measures candidates from this song and leans the pick; no notes leaves the pick alone',()=>{
  const doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'hip-hop-v1',scene_mix:SCENE_MIX_VERSION});
  const current=sceneIndex('hip-hop-v1');
  const make=(events)=>Object.assign(Object.create(PlayFlow.prototype),{doc,explorationVisited:[],app:{scheduler:{audioCtx:{currentTime:20},performanceTake:take(events,doc.global_context.bpm)}}});
  const plain=make([]);
  assert.equal(plain._explorationBias(current)(current+1),1);
  assert.equal(plain.explorationLean,null);
  const busy=make(Array.from({length:24},(_,i)=>own(14+i*.25,.08)));
  const weight=busy._explorationBias(current);
  const candidates=compatibleSceneIndices(current);
  const weights=candidates.map(i=>weight(i));
  assert.ok(weights.every(w=>w>=BIAS_MIN&&w<=BIAS_MAX));
  assert.ok(weights.some(w=>w!==1),'a busy player must move at least one candidate weight');
  assert.ok(busy.explorationLean.lean>0);
  // Over many random draws the busiest candidate is picked more often with the lean than without.
  const activity=Object.fromEntries(candidates.map(i=>[i,busy._sceneActivityCache.get([...busy._sceneActivityCache.keys()].find(k=>k.startsWith(SCENE_CATALOGUE[i].id+'|')))]));
  const busiest=candidates.reduce((a,b)=>activity[b]>activity[a]?b:a);
  let withLean=0,without=0;
  for(let r=0;r<1;r+=.005){
    if(nextExplorationStyle(current,[],()=>r,candidates,[],weight)===busiest)withLean++;
    if(nextExplorationStyle(current,[],()=>r,candidates,[])===busiest)without++;
  }
  assert.ok(withLean>without,`busiest picked ${withLean} with lean vs ${without} without`);
  assert.equal(leanWords(busy.explorationLean.lean),'You play a lot. The band moves more next.');
  assert.equal(leanWords(-1),'You hold your notes. The band makes room next.');
  assert.equal(leanWords(0),'');
});

import {circleFamilyScenes,circleFamilyStep,CIRCLE_GROUPS} from '../../../static/js/theory/music_circle.js';
test('on the circle, Next family lands on the busiest scene of the next family for a busy player, the calmest for a held one, the first for nobody',()=>{
  const doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'hip-hop-v1',scene_mix:SCENE_MIX_VERSION});
  doc.jam_session.exploration_map='catalogue-circle-v2';
  const make=(events)=>Object.assign(Object.create(PlayFlow.prototype),{doc,jamMessage:'',app:{scheduler:{audioCtx:{currentTime:20},performanceTake:take(events,doc.global_context.bpm)}}});
  const family=circleFamilyScenes('hip-hop-v1',1);
  assert.equal(circleFamilyStep('hip-hop-v1',1),family[0]);
  assert.ok(CIRCLE_GROUPS.some(g=>g.sceneIds===family));
  const nobody=make([]);
  assert.equal(nobody._circleFamilyChoice('hip-hop-v1',1),family[0]);
  assert.equal(nobody.jamMessage,'');
  const busy=make(Array.from({length:24},(_,i)=>own(14+i*.25,.08)));
  const busyPick=busy._circleFamilyChoice('hip-hop-v1',1);
  assert.ok(family.includes(busyPick));
  assert.equal(busy.jamMessage,'You play a lot. The band moves more next.');
  const calm=make([own(8,2.5),own(12,2.5),own(16,2.5)]);
  const calmPick=calm._circleFamilyChoice('hip-hop-v1',1);
  assert.ok(family.includes(calmPick));
  assert.equal(calm.jamMessage,'You hold your notes. The band makes room next.');
  const activity=id=>{const c=busy._sceneActivityCache;return c.get([...c.keys()].find(k=>k.startsWith(id+'|')));};
  assert.ok(activity(busyPick)>=activity(calmPick),`busy ${busyPick} ${activity(busyPick)} vs calm ${calmPick} ${activity(calmPick)}`);
  assert.notEqual(busyPick,calmPick,'the two leans must land on different scenes in this family');
  // The arrow keys and the button share the choice; stepping up then down returns to a family, never off the circle.
  assert.ok(circleFamilyScenes(busyPick,-1).includes('hip-hop-v1'));
});
