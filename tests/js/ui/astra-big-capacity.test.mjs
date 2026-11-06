import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBigMoment} from '../../../static/ui/big_moment.js';
import {exploreMelody} from '../../../static/ui/melody_explorer.js';
import {previewEchoAnswer,previewEndingIdea} from '../../../static/js/theory/melody_answer.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const fixture=()=>({id:'capacity',global_context:{bpm:113,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,scaffold_options:{humanize:false,pre_drop_silence:false},notes:[60,64,67,64].map((p,i)=>({id:'personal-'+i,step:i*3,duration_steps:1+i*.25,velocity:.6,role:'lead',patch_id:'warm_keys',provenance:'user_placed',performance:{version:1,offset_steps:.125},pitch_lock_mode:'concrete',concrete:{midi_pitch:p}})),song_cards:Array.from({length:8},(_,i)=>({section_id:'part-'+i,bars:1,tune:true,under:true,beat:true})),song_path:{version:1,step:'chorus',groups:[{kind:'start',label:'Start',sections:['part-0','part-1']},{kind:'big',label:'Big moment',sections:['part-2','part-3']},{kind:'ending',label:'Ending',sections:['part-4','part-5','part-6','part-7']}]}});
for(const direction of ['rise','fall','arch'])test(direction+' replacement works at eight pages without changing structure or other music',()=>{
 const doc=fixture(),before=structuredClone(doc),r=previewBigMoment(doc,2,direction);assert.equal(r.changed,true,r.reason);assert.deepEqual(doc,before);assert.equal(r.afterIndex,2);assert.equal(r.after.song_cards.length,8);assert.deepEqual(r.after.song_path,doc.song_path);assert.deepEqual(r.after.song_cards.map(c=>c.section_id),doc.song_cards.map(c=>c.section_id));
 for(let i=0;i<8;i++)if(i!==2)assert.deepEqual(r.after.song_cards[i],doc.song_cards[i]);
 assert.deepEqual(compileReturnSong(r.after).events.filter(e=>e.card!==2),compileReturnSong(doc).events.filter(e=>e.card!==2));
 const notes=r.after.song_cards[2].material.notes;assert.deepEqual(notes.map(n=>[n.step,n.duration_steps,n.performance,n.velocity]),doc.notes.map(n=>[n.step,n.duration_steps,n.performance,n.velocity]));
 assert.ok(notes.some(n=>n.generated_by==='musiclab_melody_explorer'&&n.source_note_id&&n.provenance==='jam_generated'));
 const reopened=parseProjectJson(exportProjectJson(r.after));assert.equal(reopened.ok,true);assert.deepEqual(compileReturnSong(reopened.song).events,compileReturnSong(r.after).events);assert.deepEqual(r.before,before);
});
test('genuine insertion still refuses at eight pages without mutation',()=>{const doc=fixture(),before=structuredClone(doc);for(const fn of [previewEchoAnswer,previewEndingIdea,exploreMelody]){const r=fn(doc,2);assert.equal(r.changed,false);assert.deepEqual(r.after,before);}assert.deepEqual(doc,before);});
test('replacement retains invalid source and held-note guards',()=>{for(const change of [d=>d.song_cards[2].tune=false,d=>d.song_cards[2].fx='high_lift',d=>d.notes[3].duration_steps=20,d=>d.notes[1].performance.offset_steps=NaN,d=>d.notes[1].pitch_lock_mode='relative']){const d=fixture();change(d);const before=structuredClone(d),r=previewBigMoment(d,2);assert.equal(r.changed,false);assert.deepEqual(d,before);assert.deepEqual(r.after,before);}});

test('replacement ignores insertion-only ending guard and retains selected capture metadata',()=>{const d=fixture();d.song_cards[7].big=true;d.song_cards[2].role_name='My moment';d.song_cards[2].capture_segment={version:1,take_id:'take',start_step:32,end_step:48};const before=structuredClone(d),r=previewBigMoment(d,2);assert.equal(r.changed,true,r.reason);const {material,...actual}=r.after.song_cards[2];assert.deepEqual(actual,d.song_cards[2]);assert.deepEqual(compileReturnSong(r.after).events.filter(e=>e.card!==2),compileReturnSong(d).events.filter(e=>e.card!==2));assert.deepEqual(d,before);});
