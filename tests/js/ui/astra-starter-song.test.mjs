import test from 'node:test';
import assert from 'node:assert/strict';
import {starterSong,starterGroups} from '../../../static/ui/starter_song.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {ensureSectionIds} from '../../../static/js/theory/song_view.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
const fixture=()=>({id:'starter-test',global_context:{bpm:100,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,scaffold_options:{humanize:false,pre_drop_silence:false},notes:[{id:'personal',source_note_id:'jam-live-1',role:'lead',patch_id:'warm_keys',step:1,duration_steps:3,velocity:.6,provenance:'user_placed',pitch_lock_mode:'concrete',concrete:{midi_pitch:64}}],song_cards:[{bars:4,section_id:'first',tune:true,beat:true,under:true}]});
test('starter preview is detached, preserves original and personal notes and yields three independent chapters',()=>{
 const d=fixture(),before=structuredClone(d),r=starterSong(d);
 assert.deepEqual(d,before);assert.deepEqual(r.before,before);assert.equal(r.after.song_cards.length,3);assert.equal(starterGroups(r.after).length,3);
 assert.deepEqual(r.after.song_cards[1].material.notes,d.notes);assert.deepEqual(r.after.song_cards[2].material.notes,d.notes);
 r.after.song_cards[1].material.notes[0].concrete.midi_pitch=70;assert.deepEqual(d,before);assert.equal(r.after.song_cards[2].material.notes[0].concrete.midi_pitch,64);
});
test('long capture remains in full inside first chapter without dropping or wrapping occurrences',()=>{
 const d=fixture();const capture={source_song_id:d.id,bpm:100,start:0,end:28.8,bars:12,events:Array.from({length:12},(_,i)=>({event:{...d.notes[0],id:'live-'+i},time:i*2.4,duration:.4,occurrence:i}))};
 const kept=materializePerformance(d,capture),r=starterSong(kept,1);
 assert.equal(kept.song_cards.length,3);assert.equal(r.after.song_cards.length,5);assert.equal(starterGroups(r.after).length,3);
 assert.deepEqual(r.after.song_cards.slice(0,3),ensureSectionIds(r.before.song_cards));
 const a=compileReturnSong(kept).events,b=compileReturnSong(r.after).events.filter(e=>e.card<3);assert.deepEqual(b,a);
 assert.equal(JSON.parse(JSON.stringify(r.after)).song_path.groups[0].sections.length,3);
});
test('old arrangements have no grouped UI; altered order invalidates grouping rather than mislabels parts',()=>{
 assert.equal(starterGroups(fixture()),null);const r=starterSong(fixture()).after;r.song_cards.reverse();assert.equal(starterGroups(r),null);
});

test('starter preserves the original final hold when appending guided parts',()=>{const d=fixture();d.song_cards[0].bars=1;d.notes[0].step=14;d.notes[0].duration_steps=8;d.notes[0].performance={version:1,offset_steps:0};const r=starterSong(d);assert.ok(r);const before=compileReturnSong(d),after=compileReturnSong(r.after);assert.deepEqual(after.events.filter(e=>e.card===0),before.events);assert.equal(after.events.find(e=>e.card===1).duration_sec,before.events[0].duration_sec);assert.equal(r.after.notes[0].duration_steps,8);});

test('a copied cross-chunk hold is not silently shortened',()=>{
 const d=fixture();d.notes[0]={...d.notes[0],step:14,duration_steps:8,performance:{version:1,offset_steps:0},capture_occurrence:1};
 d.song_cards=[{...d.song_cards[0],bars:1,capture_segment:{version:1,take_id:'take',start_step:0,end_step:16}},{bars:1,section_id:'second',beat:true,tune:true,under:true,capture_segment:{version:1,take_id:'take',start_step:16,end_step:32},material:{...d,notes:[]}}];
 const before=structuredClone(d),r=starterSong(d);assert.ok(r);assert.deepEqual(d,before);const events=compileReturnSong(r.after).events;assert.equal(events.filter(e=>e.card===2).length,1);assert.equal(events.find(e=>e.card===2).duration_sec,compileReturnSong(d).events[0].duration_sec);
});

test('invalid imported chapter metadata falls back to ordinary song blocks',()=>{const d=starterSong(fixture()).after;d.song_path.groups=d.song_path.groups.map(g=>({...g,sections:g.sections[0]}));assert.equal(starterGroups(d),null);});
