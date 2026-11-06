import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performanceLean,leanWeights} from '../../../static/js/theory/exploration_bias.js';
import {readHand,ownPhrase} from '../../../static/js/theory/band_hand.js';
import {nextExplorationStyle,nextUnvisitedStyle} from '../../../static/js/theory/exploration_route.js';
import {CIRCLE_SCENES} from '../../../static/js/theory/music_circle.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
const trace=[];
const note=(i,extra={})=>({time:1+i*.5,released_at:1.1+i*.5,duration:.1,occurrence:i+1,event:{provenance:'user_placed',source_note_id:`jam-live-astra-${i}`,role:'lead',concrete:{freq_hz:440*2**((64-69)/12)}},...extra});
const take=events=>({start:0,bpm:120,steps_per_bar:16,events});
const log=(name,value)=>trace.push({name,value});
after(()=>{if(process.env.ASTRA_TRACE)fs.writeFileSync(process.env.ASTRA_TRACE,JSON.stringify(trace,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2));});
function makeFlow(events=[0,1,2].map(i=>note(i))) {
  const doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'hip-hop-v1',scene_mix:SCENE_MIX_VERSION});
  doc.jam_session.exploration_map='catalogue-circle-v2';
  const f=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',undoStack:[],beatGrid:{},tuneGrid:{},editingCard:null,root:null,
    _compile(){this.compiles=(this.compiles||0)+1;},render(){},_cancelCardPreview(){},
    app:{_announce(){},scheduler:{isPlaying:true,audioCtx:{currentTime:5},performanceTake:take(events)}}});
  return f;
}
test('NaN timestamps and spoofed provenance without live identities do not create a hand or bias',()=>{
  for(const kind of ['nan-time','spoof-id']) {
    const events=[0,1,2].map(i=>{const n=note(i);if(kind==='nan-time')n.time=NaN;else n.event.source_note_id='not-live';return n;});
    const result={hand:readHand(take(events),5),bias:performanceLean(take(events),5)};log(kind,result);
    assert.equal(result.hand,null);assert.equal(result.bias,null);
  }
});
test('missing release is held input: no hand, finite bounded bias',()=>{
  const events=[0,1,2].map(i=>note(i,{released_at:undefined,duration:1}));
  const result={hand:readHand(take(events),5),bias:performanceLean(take(events),5)};log('missing-release',result);
  assert.equal(result.hand,null);assert.ok(Number.isFinite(result.bias.lean));
});
for(const freq of [0,Infinity])test(`invalid frequency ${freq} is not pitched input for either new behavior`,()=>{
  const events=Array.from({length:8},(_,i)=>{const n=note(i,{time:4+i*.05,released_at:4.01+i*.05,duration:.01});n.event.concrete.freq_hz=freq;return n;});
  const result={hand:readHand(take(events),5),bias:performanceLean(take(events),5)};log(`frequency-${freq}`,result);
  assert.equal(result.hand,null);assert.equal(result.bias,null,'invalid pitched events must not steer exploration');
});
test('500 notes in one bar remain bounded; upper/lower density offers do not exceed limits',()=>{
  const events=Array.from({length:500},(_,i)=>{const n=note(i,{time:1+i/1000,released_at:1.001+i/1000});n.event.concrete.freq_hz=440*2**(([60,64,67][i%3]-69)/12);return n;});
  const bias=performanceLean(take(events),2);const full=readHand(take(events),2,{root:0,density:4});
  const quiet=[0,1,2].map(i=>note(i,{time:1+i*2,released_at:2+i*2}));
  const floor=readHand(take(quiet),8,{root:4,density:0});log('500-notes',{bias,full,floor});
  assert.ok(Number.isFinite(bias.lean));assert.ok(bias.lean>=-1&&bias.lean<=1);
  assert.notEqual(full?.kind,'density');assert.notEqual(floor?.kind,'density');
});
test('hostile numeric lean values never yield zero or nonfinite multipliers',()=>{
  const values=[];
  for(const lean of [NaN,Infinity,-Infinity,-100,0,100])for(const activity of [0,10,20,NaN,Infinity]) {
    const value=leanWeights(lean,10,()=>activity)(0); values.push({lean,activity,value});
  }
  log('multipliers',values);
  assert.ok(values.every(r=>Number.isFinite(r.value)&&r.value>0),'all multipliers must be finite and positive');
});
test('isolated scene remains itself and Next family stays on circle with missing jam session',()=>{
  assert.equal(nextExplorationStyle(3,[],()=>.5,[]),3);
  assert.equal(nextUnvisitedStyle(3,[],()=>[],()=>.5),3);
  const f=makeFlow();delete f.doc.jam_session;
  const choices=[];
  for(const id of [...CIRCLE_SCENES,'unknown-scene'])for(const delta of [-1,1])choices.push(f._circleFamilyChoice(id,delta));
  log('circle-no-session',{choices,count:choices.length});assert.ok(choices.every(id=>CIRCLE_SCENES.includes(id)));
});
test('fewer than three notes never offer a hand and service never changes document without a press',()=>{
  for(let count=0;count<3;count++){const f=makeFlow(Array.from({length:count},(_,i)=>note(i)));f._serviceBandHand();assert.equal(f.bandHand??null,null);}
  const f=makeFlow(),before=structuredClone(f.doc);f._serviceBandHand();
  log('no-unasked-edit',{hand:f.bandHand,unchanged:JSON.stringify(before)===JSON.stringify(f.doc),undo:f.undoStack.length});
  assert.ok(f.bandHand);assert.deepEqual(f.doc,before);assert.equal(f.undoStack.length,0);
});
test('out-of-range roots normalize in suggestions; taking root preserves personal pitches and Undo exactly restores',()=>{
  for(const root of [-13,12,999]) {
    const f=makeFlow(); f.doc.global_context.root_pc=root;
    f.doc.notes.push({id:'kept-personal',role:'lead',step:1,duration_steps:2.75,velocity:.8,patch_id:'warm_keys',pitch_lock_mode:'concrete',concrete:{midi_pitch:61.25},provenance:'user_placed',source_note_id:'jam-live-kept'});
    const before=structuredClone(f.doc),personal=structuredClone(f.doc.notes.filter(n=>n.provenance==='user_placed'));
    f._serviceBandHand();const hand=f.bandHand;assert.equal(hand.kind,'root');assert.ok(hand.value>=0&&hand.value<=11);
    f._handKey('hand-take');assert.deepEqual(f.doc.notes.filter(n=>n.provenance==='user_placed'),personal);
    f._undo();log(`undo-root-${root}`,{exact:JSON.stringify(f.doc)===JSON.stringify(before)});assert.deepEqual(f.doc,before);
  }
});
test('release before attack is not an own released phrase',()=>{
  const events=[0,1,2].map(i=>note(i,{released_at:0}));
  const accepted=ownPhrase(take(events),5);log('reversed-gates',{accepted:accepted.length,hand:readHand(take(events),5)});
  assert.equal(accepted.length,0);
});
