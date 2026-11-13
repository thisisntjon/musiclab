import test from 'node:test';
import assert from 'node:assert/strict';
import {melodyFieldTourPosition} from '../../../static/js/theory/melody_field_tour.js';
import {createMelodyField,melodyFieldVariant,melodyFieldPosition} from '../../../static/js/theory/melody_field.js';

const base={startPosition:{x:0,y:0},startTime:10,now:10,bpm:120,stepsPerBar:16};
const at=(elapsed,options={})=>melodyFieldTourPosition({...base,...options,now:(options.startTime??base.startTime)+elapsed});
const notes=()=>[60,62,64,65,67,64,62,60].map((midi,i)=>({id:`n${i}`,role:'lead',step:i*1.75,
 duration_steps:i===2?19.5:1.125,velocity:.6,performance:{version:1,offset_steps:.125},
 concrete:{midi_pitch:midi,freq_hz:440*2**((midi-69)/12)},provenance:'user_placed'}));

test('tour starts at the canonical requested point and never mutates its source',()=>{
 for(const p of [{x:0,y:0},{x:.3,y:-.4},{x:.998,y:.071},{x:3,y:4}]){
  const before=structuredClone(p),expected=melodyFieldPosition(p);
  assert.deepEqual(at(0,{startPosition:p}),expected);
  assert.deepEqual(at(-5,{startPosition:p}),expected);
  for(let i=0;i<30;i++)at(i,{startPosition:p});
  assert.deepEqual(p,before);
 }
});

test('tour policy is deterministic and depends on elapsed audio time, not invocation history',()=>{
 const p={x:-.43,y:.29},expected=at(37.25,{startPosition:p});
 for(let i=0;i<1000;i++)at(i*.033,{startPosition:p});
 assert.deepEqual(at(37.25,{startPosition:p}),expected);
 assert.deepEqual(at(37.25,{startPosition:p,startTime:1010}),expected);
});

test('tour approaches radius .72 in two bars and then travels one region per four bars',()=>{
 const bar=16*15/120;
 assert.ok(Math.abs(Math.hypot(...Object.values(at(bar)))-.36)<.002);
 assert.ok(Math.abs(Math.hypot(...Object.values(at(2*bar)))-.72)<.002);
 const quarter=at(4*bar);
 assert.ok(Math.abs(quarter.x-.72*Math.sin(Math.PI/3))<.002);
 assert.ok(Math.abs(quarter.y-.72*Math.cos(Math.PI/3))<.002);
 assert.deepEqual(at(24*bar),{x:0,y:.72});
 for(const p of [{x:1,y:0},{x:.1,y:0}]){
  const middle=Math.hypot(...Object.values(at(bar,{startPosition:p})));
  assert.ok(middle>=Math.min(Math.hypot(p.x,p.y),.72)-.002);
  assert.ok(middle<=Math.max(Math.hypot(p.x,p.y),.72)+.002);
 }
});

test('same musical-bar position works in triple metre and at different tempos',()=>{
 for(const bars of [.5,1,2,4,13,24]){
  const four=at(bars*16*15/120);
  assert.deepEqual(at(bars*12*15/120,{stepsPerBar:12}),four);
  assert.deepEqual(at(bars*16*15/60,{bpm:60}),four);
  assert.deepEqual(at(bars*12*15/180,{stepsPerBar:12,bpm:180}),four);
 }
});

test('tour has finite bounded coordinates and no discontinuity at the circular wrap',()=>{
 const duration=24*16*15/120;
 const left=at(duration-.001),right=at(duration+.001);
 assert.ok(Math.hypot(left.x-right.x,left.y-right.y)<.003);
 let previous=at(0);
 for(let i=1;i<=2400;i++){
  const next=at(i*.02);
  assert.ok(Number.isFinite(next.x)&&Number.isFinite(next.y));
  assert.ok(Math.hypot(next.x,next.y)<=1);
  assert.ok(Math.hypot(next.x-previous.x,next.y-previous.y)<.012,'small adjacent time steps should stay spatially close');
  previous=next;
 }
});

test('invalid clock and coordinate inputs throw rather than silently inventing music',()=>{
 for(const change of [{startTime:NaN},{startTime:Infinity},{now:NaN},{now:Infinity},{bpm:0},{bpm:-1},{bpm:NaN},{bpm:Infinity},
  {stepsPerBar:0},{stepsPerBar:3.5},{stepsPerBar:Infinity},{startPosition:{x:Infinity,y:0}}])
  assert.throws(()=>melodyFieldTourPosition({...base,...change}),RangeError);
});

test('tour composed with v2 produces varied, source-relative music with unchanged rhythm and holds',()=>{
 const input=notes(),before=structuredClone(input),field=createMelodyField(input,{version:2}),unique=new Set();
 for(let i=0;i<=400;i++){
  const p=at(i*.12),result=melodyFieldVariant(field,p);
  unique.add(JSON.stringify(result.notes.map(n=>n.concrete.midi_pitch)));
  result.notes.forEach((n,j)=>{
   for(const key of ['step','duration_steps','performance','velocity'])assert.deepEqual(n[key],input[j][key]);
   assert.ok(Math.abs(n.concrete.midi_pitch-input[j].concrete.midi_pitch)<=7);
  });
 }
 assert.ok(unique.size>6,`expected intermediates, got ${unique.size}`);
 assert.deepEqual(input,before);
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,before);
});
