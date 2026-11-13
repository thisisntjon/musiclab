import test from 'node:test';
import assert from 'node:assert/strict';
import {createMelodyField,melodyFieldVariant} from '../../../static/js/theory/melody_field.js';

const note=(id,pitch,step,duration=1,extra={})=>({
 id,source_note_id:`jam-live-${id}`,role:'lead',patch_id:'sampled_piano_v1',
 step,duration_steps:duration,performance:{version:1,offset_steps:.125},
 velocity:.62,pitch_lock_mode:'concrete',
 concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},
 provenance:'user_placed',...extra,
});
const fixture=()=>[
 note('first',61,0,2.375),
 note('low',59,3,.5),
 note('peak',72,7,12.625),
 note('settle',64,11,3.25),
 note('bass',36,0,20,{role:'bass',provenance:'generator_default'}),
 {id:'kick',role:'drums',drum:'kick',step:0,duration_steps:.2,velocity:.8,provenance:'generator_default'},
];
const make=(notes=fixture(),options={})=>createMelodyField(notes,{root:0,scale:'major',sourceId:'independent-take',version:1,...options});
const pitches=result=>result.notes.filter(n=>n.role==='lead').map(n=>n.concrete.midi_pitch);
function frozen(value){
 if(!value||typeof value!=='object')return;
 assert.equal(Object.isFrozen(value),true,'descriptor must recursively freeze its owned objects');
 for(const item of Object.values(value))frozen(item);
}
function stablePerformance(source,result){
 assert.equal(result.notes.length,source.length);
 source.forEach((old,i)=>{
  const n=result.notes[i];
  if(old.role!=='lead'){assert.deepEqual(n,old,'backing must remain exact');return;}
  for(const key of ['step','duration_steps','velocity','patch_id','performance'])assert.deepEqual(n[key],old[key],key);
  assert.equal(n.role,old.role);
  assert.ok(Number.isInteger(n.concrete.midi_pitch));
  assert.ok(n.concrete.midi_pitch>=0&&n.concrete.midi_pitch<=127);
  assert.ok(Number.isFinite(n.concrete.freq_hz)&&n.concrete.freq_hz>0);
  assert.ok(Math.abs(n.concrete.freq_hz-440*2**((n.concrete.midi_pitch-69)/12))<1e-8);
  if(n.concrete.midi_pitch!==old.concrete.midi_pitch){
   assert.notEqual(n.id,old.id);
   assert.equal(n.source_note_id,old.id);
   assert.equal(n.provenance,'jam_generated');
   assert.ok(typeof n.generated_by==='string'&&n.generated_by.length);
  }
 });
 assert.equal(new Set(result.notes.map(n=>n.id)).size,result.notes.length,'unique event identities');
}

test('centre is the exact source, including chromatic notes, crossing holds and backing',()=>{
 const notes=fixture(),before=structuredClone(notes),field=make(notes);
 frozen(field);
 const result=melodyFieldVariant(field,{x:0,y:0});
 assert.deepEqual(result.notes,before);
 assert.equal(result.changed,false);assert.equal(result.version,1);
 assert.deepEqual(result.position,{x:0,y:0});assert.deepEqual(notes,before);
 // A descriptor owns its snapshot; changing the caller's source cannot alter it.
 notes[0].concrete.midi_pitch=1;notes[2].duration_steps=1;
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,before);
});

test('field explores meaningfully while preserving rhythm, held gates and unrelated music',()=>{
 const source=fixture(),before=structuredClone(source),field=make(source);
 const positions=[{x:-1,y:0},{x:1,y:0},{x:0,y:-1},{x:0,y:1},{x:.5,y:.5},{x:-.5,y:.5}];
 const results=positions.map(p=>melodyFieldVariant(field,p));
 for(const result of results)stablePerformance(source,result);
 assert.ok(results.some(r=>r.changed),'field must not be a no-op');
 assert.ok(new Set(results.map(r=>JSON.stringify(pitches(r)))).size>=3,'multiple distinct musical directions');
 assert.notDeepEqual(pitches(results[2]),pitches(results[3]),'rise and fall differ');
 assert.deepEqual(source,before);
});

test('coordinates are repeatable, canonical and independent of gesture history',()=>{
 const field=make(),point={x:.25001,y:-.37501};
 const a=melodyFieldVariant(field,point);
 assert.deepEqual(a.position,{x:.25,y:-.375});
 assert.deepEqual(a,melodyFieldVariant(field,{x:.25002,y:-.37502}));
 for(let i=0;i<200;i++)melodyFieldVariant(field,{x:Math.cos(i),y:Math.sin(i)});
 assert.deepEqual(melodyFieldVariant(field,point),a);
 assert.deepEqual(melodyFieldVariant(make(),point),a);
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,fixture());
 const outside=melodyFieldVariant(field,{x:3,y:4});
 assert.deepEqual(outside.position,{x:.6,y:.8});
 assert.deepEqual(outside,melodyFieldVariant(field,{x:.6,y:.8}));
});

test('preview results cannot mutate the descriptor or future previews',()=>{
 const field=make(),point={x:0,y:1},before=melodyFieldVariant(field,point);
 const expected=structuredClone(before);
 // Frozen outputs and detached mutable outputs are both safe API choices.
 try{before.notes[0].concrete.midi_pitch=1;}catch(error){assert.ok(error instanceof TypeError);}
 try{before.notes[1].performance.offset_steps=99;}catch(error){assert.ok(error instanceof TypeError);}
 assert.deepEqual(melodyFieldVariant(field,point),expected);
});

test('empty and single-note sources remain usable rather than requiring three attacks',()=>{
 const empty=melodyFieldVariant(make([]),{x:1,y:0});
 assert.deepEqual(empty.notes,[]);assert.equal(empty.changed,false);
 const source=[note('solo',64,2,18.5)],field=make(source);
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,source);
 const rise=melodyFieldVariant(field,{x:0,y:1}),fall=melodyFieldVariant(field,{x:0,y:-1});
 stablePerformance(source,rise);stablePerformance(source,fall);
 assert.notDeepEqual(pitches(rise),pitches(fall));
});

test('simultaneous groups preserve internal intervals without affecting held timing',()=>{
 const source=[note('a',60,0,5),note('b',64,0,2),note('c',67,0,1),note('d',62,6,2),note('e',65,6,3),note('f',72,11,4)];
 const field=make(source);
 for(const position of [{x:1,y:0},{x:0,y:1},{x:-.6,y:-.8}]){
  const result=melodyFieldVariant(field,position);stablePerformance(source,result);
  const p=pitches(result);
  assert.equal(p[1]-p[0],4);assert.equal(p[2]-p[0],7);assert.equal(p[4]-p[3],3);
 }
});

test('extreme valid pitches and 3/4-like positions stay bounded and preserve exact time',()=>{
 const source=[note('bottom',0,0,12.5),note('mid',64,3.375,1.875),note('top',127,11.875,24.25)];
 const field=make(source);
 for(let i=0;i<64;i++)stablePerformance(source,melodyFieldVariant(field,{x:Math.cos(i/64*2*Math.PI),y:Math.sin(i/64*2*Math.PI)}));
});

test('nonfinite gesture coordinates fail explicitly without corrupting the field',()=>{
 const field=make(),before=melodyFieldVariant(field,{x:.2,y:.3});
 for(const position of [{x:NaN,y:0},{x:Infinity,y:0},{x:0,y:-Infinity},{x:0,y:NaN}])
  assert.throws(()=>melodyFieldVariant(field,position),RangeError);
 assert.deepEqual(melodyFieldVariant(field,{x:.2,y:.3}),before);
});

test('invalid source pitch and timing fail descriptively before normalization hides them',()=>{
 const changes=[
  n=>n.concrete.midi_pitch=NaN,n=>n.concrete.midi_pitch=Infinity,
  n=>n.step=NaN,n=>n.step=Infinity,n=>n.duration_steps=Infinity,
  n=>n.duration_steps=NaN,n=>n.duration_steps=0,
  n=>n.performance.offset_steps=NaN,n=>n.performance.offset_steps=Infinity,
 ];
 for(const change of changes){
  const source=fixture();change(source[0]);const before=structuredClone(source);
  assert.throws(()=>make(source),error=>error instanceof Error&&error.message.length>=8);
  assert.deepEqual(source,before);
 }
});

test('canonical rim coordinates survive reuse and serialization unchanged',()=>{
 const field=make();
 // Rounding both components outward can put a canonical point outside the disk.
 // A saved position must not acquire another normalization on the next call.
 for(let i=0;i<2048;i++){
  const angle=i/2048*Math.PI*2;
  const first=melodyFieldVariant(field,{x:Math.cos(angle),y:Math.sin(angle)});
  const again=melodyFieldVariant(field,JSON.parse(JSON.stringify(first.position)));
  assert.deepEqual(again,first,`coordinate drift at rim sample ${i}`);
 }
});

test('inherited object properties are not valid musical scales',()=>{
 for(const scale of ['toString','constructor','__proto__'])
  assert.throws(()=>make(fixture(),{scale}),error=>error instanceof Error&&/source|context|scale/i.test(error.message));
});

test('source validation rejects arithmetic-overflowing effective note time',()=>{
 const source=[note('overflow',60,Number.MAX_VALUE,1,{performance:{version:1,offset_steps:Number.MAX_VALUE}})];
 assert.throws(()=>make(source),error=>error instanceof Error&&/source|tim|note/i.test(error.message));
});
