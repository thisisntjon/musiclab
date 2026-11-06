import test from 'node:test';
import assert from 'node:assert/strict';
import {exploreMelody,melodyPictures} from '../../../static/ui/melody_explorer.js';
import {ensureSectionIds} from '../../../static/js/theory/song_view.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const fixture=()=>({id:'explore',title:'My tune',global_context:{bpm:100,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,scaffold_options:{pre_drop_silence:false},notes:[60,64,67,64].map((m,i)=>({id:'mine-'+i,source_note_id:'jam-live-'+i,role:'lead',patch_id:'warm_keys',step:i*3,duration_steps:1+i*.25,performance:{version:1,offset_steps:.125},velocity:.6,pitch_lock_mode:'concrete',concrete:{midi_pitch:m,freq_hz:440*2**((m-69)/12)},provenance:'user_placed'})),song_cards:ensureSectionIds([{bars:1,tune:true,under:true,beat:true},{bars:1,tune:true,under:true,beat:true}])});
for(const direction of ['rise','fall','arch'])test(direction+' preserves original, rhythm, holds, source attribution and editable round trip',()=>{
 const doc=fixture(),before=structuredClone(doc),p=exploreMelody(doc,0,direction);assert.equal(p.changed,true,p.reason);assert.deepEqual(doc,before);assert.deepEqual(p.after.song_cards[0],doc.song_cards[0]);
 const notes=p.after.song_cards[p.afterIndex].material.notes;
 assert.ok(notes.some(n=>n.generated_by==='musiclab_melody_explorer'));
 notes.forEach((n,i)=>{assert.equal(n.step,doc.notes[i].step);assert.equal(n.duration_steps,doc.notes[i].duration_steps);assert.deepEqual(n.performance,doc.notes[i].performance);if(n.concrete.midi_pitch!==doc.notes[i].concrete.midi_pitch){assert.equal(n.provenance,'jam_generated');assert.equal(n.source_note_id,doc.notes[i].id);assert.notEqual(n.id,doc.notes[i].id);}});
 const old=compileReturnSong(doc).events.filter(e=>e.card===0),now=compileReturnSong(p.after).events.filter(e=>e.card===0);assert.deepEqual(now,old);
 const parsed=parseProjectJson(exportProjectJson(p.after));assert.equal(parsed.ok,true);assert.deepEqual(compileReturnSong(parsed.song),compileReturnSong(p.after));assert.match(melodyPictures(p),/Original/);
});
test('directions have distinct contours and arch retains endpoints',()=>{const doc=fixture(),ps=['rise','fall','arch'].map(d=>exploreMelody(doc,0,d).afterNotes.map(n=>n.concrete.midi_pitch));assert.deepEqual(ps,[[60,64,69,65],[60,64,65,62],[60,65,69,64]]);});
test('short, bent, crossing-held and invalid direction inputs decline without mutation',()=>{for(const change of [d=>d.notes=d.notes.slice(0,2),d=>d.notes[0].concrete.midi_pitch=60.5,d=>d.notes[0].duration_steps=20]){const d=fixture();change(d);const before=structuredClone(d),p=exploreMelody(d,0);assert.equal(p.changed,false);assert.deepEqual(d,before);assert.deepEqual(p.after,before);}assert.equal(exploreMelody(fixture(),0,'bad').changed,false);});

test('preview pictures cannot mutate original notes through object references',()=>{const d=fixture(),before=structuredClone(d),p=exploreMelody(d,0);p.beforeNotes[0].concrete.midi_pitch=1;p.afterNotes[0].performance.offset_steps=9;assert.deepEqual(d,before);});
