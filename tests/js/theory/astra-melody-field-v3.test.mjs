import test from 'node:test';
import assert from 'node:assert/strict';
import {createMelodyField,melodyFieldVariant} from '../../../static/js/theory/melody_field.js';
import {melodyFieldPlaybackView} from '../../../static/js/audio/melody_field_view.js';

const note=(id,step,extra={})=>({id,step,start_sec:step*.15,duration_steps:1,duration_sec:.15,
 role:'lead',provenance:'jam_generated',patch_id:'sampled_piano_v1',velocity:.7,
 concrete:{midi_pitch:60+(step%5),freq_hz:440*2**((60+(step%5)-69)/12)},...extra});
const at=n=>n.step+(n.performance?.offset_steps||0);
const points=Array.from({length:24},(_,i)=>({x:Math.sin(i*Math.PI/12),y:Math.cos(i*Math.PI/12)}));
const make=(notes,stepsPerBar=16)=>createMelodyField(notes,{version:3,bpm:100,totalSteps:stepsPerBar*4,stepsPerBar});
const fixture=(meter=16)=>Array.from({length:4},(_,bar)=>[0,4,8].map((step,i)=>note(`g-${bar}-${i}`,bar*meter+step))).flat();
function preservedPersonal(result,source){
 const descendants=result.filter(n=>n.id===source.id||n.source_note_id===source.id);
 assert.equal(descendants.length,1,'one personal attack or explicitly labelled pitch derivative');
 const n=descendants[0];
 for(const key of ['step','performance','start_sec','duration_steps','duration_sec','velocity','patch_id'])assert.deepEqual(n[key],source[key],key);
 assert.ok(Math.abs(n.concrete.midi_pitch-source.concrete.midi_pitch)<=7);
 if(n.id!==source.id){assert.equal(n.provenance,'jam_generated');assert.equal(n.generated_by,'musiclab_melody_field');assert.equal(n.source_note_id,source.id);}
 return n;
}

test('v3 center is exact including unsorted input and source is immutable across a round trip',()=>{
 const notes=fixture().reverse(),before=structuredClone(notes),field=make(notes);
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,notes);
 for(const p of points)melodyFieldVariant(field,p);
 assert.deepEqual(notes,before);assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,before);
});
test('personal source stays exact; pitch derivatives preserve fractional onsets and crossing held gates everywhere',()=>{
 const personal=note('mine',5,{provenance:'user_placed',duration_steps:20.8114,duration_sec:20.8114*.15,
 performance:{version:1,offset_steps:.27},source_note_id:'jam-live-me'});
 const notes=[...fixture(),personal],before=structuredClone(notes),field=make(notes);
 for(const p of points)preservedPersonal(melodyFieldVariant(field,p).notes,personal);
 assert.deepEqual(notes,before);assert.deepEqual(field.notes,before);
});
test('bass drums and harmony remain byte-equivalent as musical objects',()=>{
 const band=['bass','drums','harmony'].map((role,i)=>note(role,i,{role})),field=make([...fixture(),...band]);
 for(const p of points)assert.deepEqual(melodyFieldVariant(field,p).notes.filter(n=>n.role!=='lead').sort((a,b)=>a.id.localeCompare(b.id)),[...band].sort((a,b)=>a.id.localeCompare(b.id)));
});
test('new gap attacks do not overlap any personal hold and have honest provenance',()=>{
 const personal=note('mine',1,{provenance:'user_placed',duration_steps:6,duration_sec:.9});
 const field=make([...fixture(),personal]);let replies=0;
 for(const p of points)for(const n of melodyFieldVariant(field,p).notes.filter(n=>n.id.endsWith('-reply'))){
  replies++;assert.ok(at(n)+n.duration_steps<=at(personal)||at(n)>=at(personal)+personal.duration_steps);
  assert.equal(n.provenance,'jam_generated');assert.equal(n.generated_by,'musiclab_melody_field');assert.ok(n.source_note_id);
 }
 assert.ok(replies>0,'oracle exercises added events');
});
test('generated rhythm actually varies counts and gates while retaining an anchor in each bar',()=>{
 const field=make(fixture()),counts=new Set(),gates=new Set();
 for(const p of points){const result=melodyFieldVariant(field,p).notes;counts.add(result.length);
  for(const n of result)gates.add(n.duration_steps);
  for(let bar=0;bar<4;bar++)assert.ok(result.some(n=>at(n)===bar*16));
 }
 assert.ok(counts.size>1);assert.ok(gates.size>1);
});
test('v3 deterministic unique IDs, bounded count and consistent gates in 4/4 and 3/4',()=>{
 for(const meter of [16,12]){const notes=fixture(meter),field=make(notes,meter);
  for(const p of points){const result=melodyFieldVariant(field,p).notes;
   assert.deepEqual(melodyFieldVariant(field,p).notes,result);assert.equal(new Set(result.map(n=>n.id)).size,result.length);
   assert.ok(result.length<=notes.length+8);
   for(const n of result){assert.ok(at(n)>=0&&at(n)<meter*4);assert.ok(n.duration_steps>0);assert.ok(Math.abs(n.duration_sec-n.duration_steps*.15)<1e-9);}
  }
 }
});
test('playback rotation retains new gates and IDs and agrees with precise attack metadata',()=>{
 const notes=melodyFieldVariant(make(fixture()),{x:.866,y:-.5}).notes;
 const song={events:notes,bpm:100,swing:.5,total_steps:64};
 const view=melodyFieldPlaybackView(song,.04,.04);
 assert.equal(view.events.length,notes.length);
 for(let i=0;i<notes.length;i++){assert.equal(view.events[i].id,notes[i].id);assert.equal(view.events[i].duration_sec,notes[i].duration_sec);assert.ok(Math.abs(view.events[i].start_sec-at(view.events[i])*.15)<1e-9);}
});
test('simultaneous personal and generated attack keeps one personal descendant and its performance metadata',()=>{
 const own=note('own',4,{provenance:'user_placed'}),field=make([...fixture(),own]);
 for(const p of points)preservedPersonal(melodyFieldVariant(field,p).notes,own);
});
test('a personal-only melody responds through explicit pitch derivatives but never receives rhythm edits',()=>{
 const source=fixture().map(n=>({...n,provenance:'user_placed'})),before=structuredClone(source),field=make(source);
 const result=melodyFieldVariant(field,{x:0,y:1}).notes;
 assert.equal(result.length,source.length);assert.ok(result.some(n=>n.generated_by==='musiclab_melody_field'));
 for(const n of source)preservedPersonal(result,n);
 assert.deepEqual(source,before);assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,before);
});
test('added replies respect the actually swung end of generated source holds',()=>{
 const source=[note('swung',1,{start_sec:1.3*.15,duration_steps:.9,duration_sec:.9*.15})];
 const field=createMelodyField(source,{version:3,bpm:100,totalSteps:64,stepsPerBar:16,swing:.8});
 const notes=melodyFieldVariant(field,{x:0,y:1}).notes;
 const view=melodyFieldPlaybackView({events:notes,bpm:100,swing:.8,total_steps:64},.04,.04);
 const original=view.events.find(n=>!n.id.endsWith('-reply'));
 for(const extra of view.events.filter(n=>n.id.endsWith('-reply')))
  assert.ok(extra.start_sec>=original.start_sec+original.duration_sec-1e-9,'new reply cuts into a swung held note');
});
