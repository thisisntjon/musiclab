import test from 'node:test';
import assert from 'node:assert/strict';
import {starterSong} from '../../../static/ui/starter_song.js';
import {previewBigMoment} from '../../../static/ui/big_moment.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
const fixture=()=>starterSong({id:'big-test',global_context:{bpm:100,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,scaffold_options:{humanize:false,pre_drop_silence:false},notes:[60,64,67,64].map((p,i)=>({id:'personal-'+i,step:i*3,duration_steps:1+i*.25,velocity:.6,role:'lead',patch_id:'warm_keys',provenance:'user_placed',performance:{version:1,offset_steps:.125},pitch_lock_mode:'concrete',concrete:{midi_pitch:p}})),song_cards:[{section_id:'start',bars:1,tune:true,under:true,beat:true}]}).after;
for(const direction of ['rise','fall','arch'])test(direction+' keeps three parts and changes only the selected big moment',()=>{
 const doc=fixture(),before=structuredClone(doc),r=previewBigMoment(doc,1,direction);assert.equal(r.changed,true,r.reason);assert.deepEqual(doc,before);assert.equal(r.after.song_cards.length,3);assert.deepEqual(r.after.song_path,before.song_path);assert.deepEqual(r.after.song_cards.map(c=>c.section_id),doc.song_cards.map(c=>c.section_id));
 assert.deepEqual(r.after.song_cards[0],doc.song_cards[0]);assert.deepEqual(r.after.song_cards[2],doc.song_cards[2]);
 assert.deepEqual(compileReturnSong(r.after).events.filter(e=>e.card!==1),compileReturnSong(doc).events.filter(e=>e.card!==1));
 const source=doc.song_cards[1].material.notes,notes=r.after.song_cards[1].material.notes;
 assert.deepEqual(notes.map(n=>[n.step,n.duration_steps,n.velocity,n.performance]),source.map(n=>[n.step,n.duration_steps,n.velocity,n.performance]));
 assert.ok(notes.some(n=>n.generated_by==='musiclab_melody_explorer'&&n.provenance==='jam_generated'));
 r.after.song_cards[1].material.notes[0].duration_steps=99;assert.deepEqual(doc,before);
});
