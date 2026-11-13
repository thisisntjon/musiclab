import test from 'node:test';
import assert from 'node:assert/strict';
import {createMelodyField,melodyFieldVariant,melodyFieldRegion,MELODY_FIELD_REGIONS} from '../../../static/js/theory/melody_field.js';

const source=(pitches=[60,62,64,67,65,60,67,64])=>pitches.map((pitch,i)=>({
 id:`personal-${i}`,source_note_id:`jam-live-${i}`,role:'lead',patch_id:'sampled_piano_v1',
 step:i*2,duration_steps:i===2?18.375:.75+i*.125,performance:{version:1,offset_steps:.0625},
 velocity:.55+i*.02,pitch_lock_mode:'concrete',concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},provenance:'user_placed',
}));
const position=(region,fraction=0,radius=1)=>({x:radius*Math.sin((region+fraction)*Math.PI/3),y:radius*Math.cos((region+fraction)*Math.PI/3)});
const create=notes=>createMelodyField(notes,{version:2,root:0,scale:'major',sourceId:'v2-independent'});
const midi=result=>result.notes.filter(n=>n.role==='lead').map(n=>n.concrete.midi_pitch);
const invariant=(input,result)=>{
 assert.equal(result.version,2);assert.equal(result.notes.length,input.length);
 input.forEach((old,i)=>{
  const n=result.notes[i];
  for(const key of ['step','duration_steps','performance','velocity','patch_id','role'])assert.deepEqual(n[key],old[key],key);
  if(old.role!=='lead'){assert.deepEqual(n,old);return;}
  assert.ok(Number.isInteger(n.concrete.midi_pitch)&&n.concrete.midi_pitch>=0&&n.concrete.midi_pitch<=127);
  assert.ok(Math.abs(n.concrete.midi_pitch-old.concrete.midi_pitch)<=7);
  if(n.concrete.midi_pitch!==old.concrete.midi_pitch){
   assert.notEqual(n.id,old.id);assert.equal(n.source_note_id,old.id);assert.equal(n.provenance,'jam_generated');
   assert.match(n.id,/field-v2-/);
  }else assert.deepEqual(n,old);
 });
 assert.equal(new Set(result.notes.map(n=>n.id)).size,input.length);
};

test('v2 original and backing stay exact through every region and candidate round trip',()=>{
 const input=[...source(),{...source([36])[0],id:'bass',role:'bass'}],before=structuredClone(input),field=create(input);
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,before);
 assert.equal(Object.isFrozen(field),true);
 for(let region=0;region<6;region++)for(const fraction of [0,.25,.5,.75]){
  const first=melodyFieldVariant(field,position(region,fraction));invariant(input,first);
  assert.deepEqual(melodyFieldVariant(field,first.position),first);
 }
 assert.deepEqual(input,before);
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,before);
});

test('Wave and Dip reshape the interior while keeping phrase endpoints',()=>{
 const input=source([60,62,64,65,67,65,62]),field=create(input),original=input.map(n=>n.concrete.midi_pitch);
 const wave=midi(melodyFieldVariant(field,position(1))),dip=midi(melodyFieldVariant(field,position(4)));
 assert.equal(wave[0],original[0]);assert.equal(wave.at(-1),original.at(-1));
 assert.equal(dip[0],original[0]);assert.equal(dip.at(-1),original.at(-1));
 assert.ok(wave.slice(1,-1).some((p,i)=>p>original[i+1]));
 assert.ok(dip.slice(1,-1).some((p,i)=>p<original[i+1]));
 assert.ok(wave.every((p,i)=>p>=original[i]));assert.ok(dip.every((p,i)=>p<=original[i]));
});

test('Again derives later pitches from the opening without changing the later rhythm',()=>{
 const input=source([60,62,64,65,67,65,62,60]),field=create(input),result=melodyFieldVariant(field,position(2));
 invariant(input,result);
 assert.deepEqual(midi(result).slice(0,4),[60,62,64,65]);
 // This chosen fixture fits the seven-semitone budget and the supported scale.
 assert.deepEqual(midi(result).slice(4),[60,62,64,65]);
 assert.equal(result.notes[4].source_note_id,input[4].id,'lineage records transformed source event, not borrowed motif note');
 const wide=source([48,55,60,67,84,85,86,87]),bounded=melodyFieldVariant(create(wide),position(2));
 invariant(wide,bounded);
 assert.ok(midi(bounded).slice(4).every((p,i)=>p<wide[i+4].concrete.midi_pitch),'bounded movement toward motif even when exact copy is out of scope');
});

test('Return is confined to the ending and brings the final note toward the opening',()=>{
 const input=source([60,62,64,65,67,65,64,67]),result=melodyFieldVariant(create(input),position(5));
 invariant(input,result);
 assert.deepEqual(result.notes.slice(0,5),input.slice(0,5));
 assert.ok(Math.abs(result.notes.at(-1).concrete.midi_pitch-60)<Math.abs(input.at(-1).concrete.midi_pitch-60));
});

test('intermediate coordinates produce multiple connected variants, not endpoint-only switching',()=>{
 const field=create(source()),sequences=[];
 for(const fraction of [0,.25,.5,.75,1])sequences.push(midi(melodyFieldVariant(field,position(0,fraction))));
 const unique=new Set(sequences.map(JSON.stringify));
 assert.ok(unique.size>=4,`only ${unique.size} variants in a nondegenerate Rise/Wave seam`);
 assert.ok(sequences.slice(1,-1).some(p=>JSON.stringify(p)!==JSON.stringify(sequences[0])&&JSON.stringify(p)!==JSON.stringify(sequences.at(-1))));
 // Both region selection and music must connect around the closing/opening seam.
 assert.equal(melodyFieldRegion(position(5,.99)).next,0);
 assert.deepEqual(MELODY_FIELD_REGIONS,['Rise','Wave','Again','Fall','Dip','Return']);
});

test('small movements across every region boundary and wrap seam avoid large pitch jumps',()=>{
 const input=source([48,60,72,84,96,84,72,60]),field=create(input);
 for(let region=0;region<6;region++){
  const left=melodyFieldVariant(field,position(region,-.0001)),right=melodyFieldVariant(field,position(region,.0001));
  invariant(input,left);invariant(input,right);
  midi(left).forEach((p,i)=>assert.ok(Math.abs(p-midi(right)[i])<=1,`seam ${region}, note ${i}`));
 }
});

test('full circle preserves simultaneous intervals, extreme pitch bounds and independent timing',()=>{
 const input=[...source([0,64,127]),{...source([67])[0],id:'simultaneous',step:2,duration_steps:25}];
 const field=create(input);
 for(let i=0;i<360;i++){
  const result=melodyFieldVariant(field,position(i/60));invariant(input,result);
  assert.equal(result.notes[3].concrete.midi_pitch-result.notes[1].concrete.midi_pitch,3);
 }
});

test('field versions stay explicit and v2 exploration cannot change old v1 results',()=>{
 const input=source(),v1=createMelodyField(input,{version:1}),v2=create(input),point={x:.3,y:.6};
 const before=melodyFieldVariant(v1,point);
 for(let i=0;i<100;i++)melodyFieldVariant(v2,position(i/17));
 assert.deepEqual(melodyFieldVariant(v1,point),before);
 assert.equal(before.version,1);assert.equal(melodyFieldVariant(v2,point).version,2);
 assert.deepEqual(melodyFieldVariant(createMelodyField(input),point),before);
});
