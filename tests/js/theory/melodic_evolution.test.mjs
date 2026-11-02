import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planMelodicPhrase,leadPalette,restoreMelodicPhrase,playedResponseSources} from '../../../static/js/theory/melodic_evolution.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';

const plan=(phraseOrdinal,options={})=>planMelodicPhrase({phraseOrdinal,sceneId:'bluegrass-v1',...options});
const pitches=p=>p.events.map(e=>[e.step,e.concrete.midi_pitch,e.duration_sec]);

test('v3 follows explicit local harmony and tonic cadence, including a major dominant in minor',()=>{
 for(const minor of [false,true])for(let root=0;root<12;root++) {
  const third=minor?3:4;
  const harmony={version:1,bars:[[0,third,7],[5,minor?8:9,0],[7,11,2],[0,third,7]],ending:0};
  for(let i=0;i<16;i++) {
   const p=plan(i,{version:3,harmony,minor,root});
   assert.equal(p.events.at(-1).concrete.midi_pitch%12,root);
   for(const e of p.events)assert.ok(harmony.bars[Math.floor(e.step/16)].includes((e.concrete.midi_pitch-root+12)%12));
   assert.deepEqual(restoreMelodicPhrase(JSON.parse(JSON.stringify(p.descriptor))),p);
  }
 }
 const p=plan(0,{version:3,harmony:{version:1,bars:[[0,4,7],[5,9,0],[7,11,2],[0,4,7]],ending:0}});
 for(const harmony of [null,{version:1,bars:[[0,4,7]],ending:0},
  {...p.descriptor.harmony,ending:2},{...p.descriptor.harmony,bars:[[0,4],[5,9,0],[7,11,2],[0,4,7]]}])
  assert.equal(restoreMelodicPhrase({...p.descriptor,harmony}),null);
});

test('authored intent survives empty chord parts and transposes independently of mode',()=>{
 const doc={notes:[],global_context:{root_pc:2,scale_type:'natural_minor'},jam_session:{scene_id:'reggae-v1'}};
 const context=phraseContext(doc);
 assert.deepEqual(context.harmony.bars,[[0,3,7],[0,3,8],[0,5,8],[2,7,10]]);
 assert.equal(context.root,2);
 assert.equal(phraseContext({...doc,jam_session:{scene_id:'bluegrass-v1'}}).harmony,null);
});
test('statement, answer, space and return develop a recognizable core deterministically',()=>{
 const phrases=Array.from({length:12},(_,i)=>plan(i));
 assert.deepEqual(pitches(phrases[0]).slice(0,6),pitches(phrases[1]).slice(0,6));
 assert.notDeepEqual(pitches(phrases[0]),pitches(phrases[1]));
 assert.equal(phrases[2].events.length,5);assert.equal(phrases[0].events.length,12);
 assert.notDeepEqual(pitches(phrases[1]),pitches(phrases[5]));
 assert.deepEqual(plan(9),plan(9));
 assert.ok(phrases.every(p=>p.events.every(e=>e.provenance==='jam_generated'&&e.step<64)));
});
test('instrument handoff preserves statement and never duplicates a lead',()=>{
 const p=plan(1,{sceneId:'reggae-v1',previousPatch:'sampled_banjo_v1'});
 assert.equal(p.variant,'statement');assert.equal(p.patch,'sampled_clean_guitar_v1');
 assert.deepEqual(pitches(p),pitches(plan(0)));
 assert.equal(new Set(p.events.map(e=>e.step)).size,p.events.length);
 assert.notDeepEqual(leadPalette('bluegrass-v1'),leadPalette('reggae-v1'));
});
test('minor descendants, transposition and tempo use concrete editable gates',()=>{
 const p=plan(1,{minor:true,root:2,bpm:200});
 assert.ok(p.events.some(e=>e.concrete.midi_pitch===70));
 for(const e of p.events){assert.equal(e.start_sec,e.step*.075);assert.ok(e.duration_sec>0);}
 assert.throws(()=>plan(-1));
 for(let root=0;root<12;root++)assert.ok(plan(1,{root}).events.every(e=>e.concrete.midi_pitch<=84));
});

test('versioned descriptor restores handoff choice exactly and rejects malformed saves',()=>{
 const original=plan(2,{sceneId:'reggae-v1',previousPatch:'sampled_banjo_v1',seed:123});
 const saved=JSON.parse(JSON.stringify(original.descriptor));
 assert.deepEqual(restoreMelodicPhrase(saved),original);
 for(const bad of [{version:2},{phraseOrdinal:-1},{root:NaN},{minor:'yes'},{bpm:Infinity},
   {seed:-1},{previousPatch:'alien'},{sceneId:'unregistered'}])
   assert.equal(restoreMelodicPhrase({...saved,...bad}),null);
});

test('v2 develops openings across style handoffs without revisiting the last four',()=>{
 for(const seed of [0,7,123456789]) {
  let recentOpenings=[],previousPatch=null;const signatures=[];
  for(let phraseOrdinal=1;phraseOrdinal<=64;phraseOrdinal++) {
   const sceneId=['bluegrass-v1','reggae-v1','house-v1','honky-tonk-v1'][phraseOrdinal%4];
   const p=plan(phraseOrdinal,{version:2,sceneId,seed,recentOpenings,previousPatch});
   const opening=JSON.stringify(pitches(p).filter(n=>n[0]<32));
   assert.ok(!signatures.slice(-4).includes(opening),'first two bars cannot be a disguised recent repeat');
   assert.ok(!recentOpenings.includes(p.openingId));
   assert.deepEqual(restoreMelodicPhrase(JSON.parse(JSON.stringify(p.descriptor))),p);
   const sameMusic=plan(phraseOrdinal,{version:2,sceneId,seed,recentOpenings,previousPatch:null});
   assert.deepEqual(pitches(p),pitches(sameMusic),'instrument handoff must not reset the melody');
   assert.ok(p.events.every(e=>e.step+e.duration_sec/(15/100)<=64&&e.provenance==='jam_generated'));
   signatures.push(opening);recentOpenings=[...recentOpenings,p.openingId].slice(-4);previousPatch=p.patch;
  }
  assert.ok(new Set(signatures).size>=8);
 }
});

test('v1 save keeps its original opening; v2 rejects corrupt history and keeps tonal ranges',()=>{
 assert.deepEqual(plan(1).events.slice(0,3).map(e=>e.concrete.midi_pitch),[67,72,74]);
 const p=plan(2,{version:2,recentOpenings:[0,1],seed:9});
 assert.equal(restoreMelodicPhrase({...p.descriptor,recentOpenings:[0,1,2,3,4]}),null);
 assert.equal(restoreMelodicPhrase({...p.descriptor,recentOpenings:[NaN]}),null);
 for(let root=0;root<12;root++)for(const minor of [false,true])for(let i=0;i<8;i++) {
  const q=plan(i,{version:2,root,minor});
  assert.ok(q.events.every(e=>e.concrete.midi_pitch>=60&&e.concrete.midi_pitch<=84));
  assert.equal(new Set(q.events.map(e=>e.step)).size,q.events.length);
 }
});

test('room responds only to successful reached live events, and persists as generated silence/answer',()=>{
 const own={time:9,duration:2,event:{provenance:'user_placed',source_note_id:'jam-live-1'}};
 const records=[own,{...own,time:10.01,event:{...own.event,source_note_id:'jam-live-future'}},
  {...own,time:0,duration:.1},{...own,event:{...own.event,provenance:'jam_generated'}},
  {...own,event:{...own.event,source_note_id:null}},{...own,duration:0}];
 const before=structuredClone(records),roomFor=playedResponseSources(records,10,5);
 assert.deepEqual(roomFor,['jam-live-1']);assert.deepEqual(records,before);
 const p=plan(2,{version:2,roomFor});
 assert.equal(p.variant,'room');assert.equal(p.events.length,2);
 assert.ok(p.events.every(e=>e.step>=32&&e.provenance==='jam_generated'));
 assert.deepEqual(restoreMelodicPhrase(JSON.parse(JSON.stringify(p.descriptor))),p);
 assert.equal(restoreMelodicPhrase({...p.descriptor,roomFor:['not-a-live-source']}),null);
 assert.deepEqual(playedResponseSources(records,20,5),[]);
});
