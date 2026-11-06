import test from 'node:test';
import assert from 'node:assert/strict';
import {starterSong} from '../../../static/ui/starter_song.js';
import {previewEchoAnswer,previewEndingIdea} from '../../../static/js/theory/melody_answer.js';
import {exploreMelody} from '../../../static/ui/melody_explorer.js';
import {previewBigMoment} from '../../../static/ui/big_moment.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const fixture=()=>starterSong({id:'web-held',title:'Held tune',global_context:{bpm:100,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,scaffold_options:{humanize:false,pre_drop_silence:false},notes:[60,64,67].map((pitch,i)=>({id:'own-'+i,step:[1,6,14][i],duration_steps:i===2?8:1,velocity:.6,role:'lead',patch_id:'warm_keys',provenance:'user_placed',performance:{version:1,offset_steps:.125},pitch_lock_mode:'concrete',concrete:{midi_pitch:pitch}})),song_cards:[{section_id:'start',bars:1,tune:true,under:true,beat:true}]}).after;
const tools=[['echo',previewEchoAnswer,0],['ending',previewEndingIdea,0],['explorer',exploreMelody,0],['big',previewBigMoment,1]];
for(const [name,fn,index] of tools)test(name+' accepts deliberately preserved performed hold without clipping or mutating original',()=>{
 const doc=fixture(),before=structuredClone(doc),r=fn(doc,index);assert.equal(r.changed,true,r.reason);assert.deepEqual(doc,before);
 const source=doc.song_cards[index].material?.notes||doc.notes,after=r.after.song_cards[r.afterIndex];assert.equal(after.preserve_performed_holds,true);
 const notes=after.material.notes;assert.deepEqual(notes.map(n=>[n.step,n.duration_steps,n.performance]),source.map(n=>[n.step,n.duration_steps,n.performance]));
 const compiled=compileReturnSong(r.after),held=compiled.events.find(e=>e.card===r.afterIndex&&e.role==='lead'&&e.duration_steps===8);assert.ok(held);assert.equal(held.duration_sec,1.2);
 const parsed=parseProjectJson(exportProjectJson(r.after));assert.equal(parsed.ok,true);assert.deepEqual(compileReturnSong(parsed.song).events,compiled.events);
 if(name==='big')assert.deepEqual(compiled.events.filter(e=>e.card!==index),compileReturnSong(doc).events.filter(e=>e.card!==index));
 else assert.deepEqual(r.after.song_cards[index],doc.song_cards[index]);
});
test('cross-page permission is explicit and rejects malformed performance bounds',()=>{
 for(const mutate of [d=>delete d.song_cards[1].preserve_performed_holds,d=>d.song_cards[1].preserve_performed_holds='true',d=>delete d.song_cards[1].material.notes[2].performance,d=>d.song_cards[1].material.notes[2].duration_steps=65]){
  const d=fixture();mutate(d);const before=structuredClone(d);const r=previewBigMoment(d,1);assert.equal(r.changed,false);assert.deepEqual(d,before);assert.deepEqual(r.after,before);
 }
});
test('Bigger selected Big can develop while all other sounding events and metadata stay',()=>{
 const d=fixture();d.song_cards[1].big=true;const before=structuredClone(d),r=previewBigMoment(d,1,'rise');assert.equal(r.changed,true,r.reason);assert.deepEqual(d,before);
 const {material:a,...metaA}=r.after.song_cards[1],{material:b,...metaB}=d.song_cards[1];assert.deepEqual(metaA,metaB);assert.equal(metaA.big,true);
 const old=compileReturnSong(d),now=compileReturnSong(r.after);assert.deepEqual(now.events.filter(e=>e.card!==1),old.events.filter(e=>e.card!==1));
 assert.ok(now.events.some(e=>e.card===1&&e.generated_by==='song_card_lift'));assert.deepEqual(a.notes.map(n=>n.duration_steps),b.notes.map(n=>n.duration_steps));
 const parsed=parseProjectJson(exportProjectJson(r.after));assert.equal(parsed.ok,true);assert.deepEqual(compileReturnSong(parsed.song).events,now.events);
});

test('preservation flag cannot admit a nonfinite held offset',()=>{const d=fixture();d.song_cards[1].material.notes[2].performance.offset_steps=Infinity;const before=structuredClone(d),r=previewEchoAnswer(d,1);assert.equal(r.changed,false);assert.deepEqual(d,before);assert.deepEqual(r.after,before);});
