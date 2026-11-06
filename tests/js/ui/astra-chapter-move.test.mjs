import test from 'node:test';
import assert from 'node:assert/strict';
import {starterSong,starterGroups,chapterKind,moveStarterChapter,changeStarterChapter} from '../../../static/ui/starter_song.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const fixture=()=>starterSong({id:'chapters',global_context:{bpm:113,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,notes:[{id:'own',role:'lead',patch_id:'warm_keys',step:1,duration_steps:2,velocity:.5,concrete:{midi_pitch:60},provenance:'user_placed'}],song_cards:['a','b','c'].map(section_id=>({section_id,bars:1,tune:true,beat:true,under:true}))}).after;
test('whole Start moves all pages together, exact cards and source stay intact, reverse restores',()=>{
 const d=fixture(),before=structuredClone(d),r=moveStarterChapter(d,'b','later');assert.ok(r.changed,r.reason);assert.deepEqual(d,before);assert.deepEqual(starterGroups(r.doc).map(g=>g.label),['Big moment','Start','Ending']);assert.deepEqual(r.doc.song_cards.slice(1,4),d.song_cards.slice(0,3));assert.deepEqual(r.doc.notes,d.notes);assert.equal(r.doc.song_cards[r.selectedIndex].section_id,'b');assert.deepEqual(moveStarterChapter(r.doc,'b','earlier').doc,before);
 const reopened=parseProjectJson(exportProjectJson(r.doc));assert.equal(reopened.ok,true);assert.deepEqual(reopened.song.song_cards,r.doc.song_cards);assert.deepEqual(reopened.song.song_path,r.doc.song_path);
});
test('old chapter labels retain Big identity after movement',()=>{const d=fixture();for(const g of d.song_path.groups)delete g.kind;const r=moveStarterChapter(d,'b','later');assert.ok(r.changed);assert.equal(chapterKind(starterGroups(r.doc)[0]),'big');});
test('edge, invalid direction and malformed identities do not mutate',()=>{const d=fixture(),before=structuredClone(d);assert.equal(moveStarterChapter(d,'a','earlier').changed,false);assert.equal(moveStarterChapter(d,'a','sideways').changed,false);assert.deepEqual(d,before);d.song_cards[1].section_id='a';assert.equal(starterGroups(d),null);});

test('copy and remove whole chapters preserve identities, original notes and independent material',()=>{
 const d=fixture(),before=structuredClone(d),r=changeStarterChapter(d,'b','copy');assert.ok(r.changed,r.reason);assert.deepEqual(d,before);assert.equal(starterGroups(r.doc).length,4);assert.equal(r.doc.song_cards.length,8);assert.equal(new Set(r.doc.song_cards.map(c=>c.section_id)).size,8);
 const copied=starterGroups(r.doc)[1];assert.equal(copied.sections.length,3);r.doc.song_cards[3].material.notes[0].concrete.midi_pitch=72;assert.equal(d.notes[0].concrete.midi_pitch,60);
 const removed=changeStarterChapter(r.doc,copied.sections[1],'remove');assert.ok(removed.changed,removed.reason);assert.deepEqual(removed.doc.song_cards,d.song_cards);assert.equal(starterGroups(removed.doc).length,3);
 const onlyStart=changeStarterChapter(changeStarterChapter(d,starterGroups(d)[1].sections[0],'remove').doc,starterGroups(d)[2].sections[0],'remove');assert.ok(onlyStart.changed);assert.equal(starterGroups(onlyStart.doc).length,1);assert.equal(changeStarterChapter(onlyStart.doc,'a','remove').changed,false);
});
test('copy refuses capacity overflow without replacing notes',()=>{const d=fixture(),r=changeStarterChapter(d,'a','copy');assert.ok(r.changed);const before=structuredClone(r.doc);assert.equal(changeStarterChapter(r.doc,'a','copy').changed,false);assert.deepEqual(r.doc,before);});

test('distinct page pitches follow chapter order through editable roundtrip',()=>{
 const d=fixture();d.song_cards.forEach((c,i)=>{c.material={...(c.material||{}),auto_harmony_stabs:false,notes:[{...structuredClone(d.notes[0]),id:'tone-'+i,pitch_lock_mode:'concrete',concrete:{midi_pitch:60+i*2}}]};});
 const before=structuredClone(d),r=moveStarterChapter(d,'b','later');assert.ok(r.changed,r.reason);const reopened=parseProjectJson(exportProjectJson(r.doc));assert.equal(reopened.ok,true);
 const a=compileReturnSong(r.doc),b=compileReturnSong(reopened.song);assert.deepEqual(a.events,b.events);assert.deepEqual(a.events.filter(e=>e.role==='lead').map(e=>e.concrete.midi_pitch),[66,60,62,64,68]);assert.deepEqual(d,before);
});
