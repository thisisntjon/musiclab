import test from 'node:test';
import assert from 'node:assert/strict';
import {previewReturningPart,compileReturnSong,sameLocalEvents} from '../../../static/ui/returning_part.js';
import {ensureSectionIds,extractSongMaterial,songCardRanges} from '../../../static/js/theory/song_view.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
import {startJam,contributeJam} from '../../../static/js/theory/jam_session.js';

function plain(bpm) {
 const d={id:'return-rounding',title:'Return rounding',global_context:{bpm,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,
  scaffold_options:{humanize:false,pre_drop_silence:false},notes:[60,64,67,64].map((pitch,i)=>({id:`personal-${i}`,
  step:i*3,duration_steps:1,velocity:.6,role:'lead',patch_id:'warm_keys',provenance:'user_placed',
  performance:{version:1,offset_steps:.125},pitch_lock_mode:'concrete',concrete:{midi_pitch:pitch}})),song_cards:[]};
 d.song_cards=ensureSectionIds(Array.from({length:3},()=>({bars:1,tune:true,under:true,beat:true,material:extractSongMaterial(d)})));
 return d;
}
function local(song,doc,index) {
 const range=songCardRanges(doc.song_cards,64,song.bpm,16)[index];
 return song.events.filter(e=>e.card===index).map(e=>{const n=structuredClone(e);delete n.card;
  n.step-=range.start_step;n.start_sec-=range.start_sec;return n;});
}
for(const bpm of [100,113,137])test(`ordinary return at ${bpm} BPM preserves musical payload and survives editable reopening`,()=>{
 const d=plain(bpm),before=structuredClone(d),r=previewReturningPart(d,0);
 assert.equal(r.changed,true,r.reason);assert.deepEqual(d,before);assert.equal(r.after.song_cards.length,4);
 assert.deepEqual(r.after.song_cards.slice(0,3),d.song_cards);
 assert.notEqual(r.after.song_cards[3].section_id,d.song_cards[0].section_id);
 assert.deepEqual(r.after.song_cards[3].material,d.song_cards[0].material);
 const a=compileReturnSong(d),b=compileReturnSong(r.after);
 assert.deepEqual(b.events.filter(e=>e.card<3),a.events);
 const source=local(a,d,0),copy=local(b,r.after,3);assert.equal(copy.length,source.length);
 source.forEach((n,i)=>{const {start_sec:t,...payload}=n,{start_sec:u,...copied}=copy[i];
  assert.ok(Math.abs(t-u)<=.000100001);assert.deepEqual(copied,payload);});
 const reopened=parseProjectJson(exportProjectJson(r.after));assert.equal(reopened.ok,true);
 assert.deepEqual(compileReturnSong(reopened.song),b);
 r.after.song_cards[3].material.notes[0].concrete.midi_pitch=77;
 assert.deepEqual(d,before);assert.equal(r.after.song_cards[0].material.notes[0].concrete.midi_pitch,60);
});
function backing(){
 let d=startJam({id:'guard',notes:[],global_context:{root_pc:0,scale_type:'major',bpm:113,meter:'4/4',steps_per_bar:16},
 lead_patch_id:'warm_keys',drum_kit:'soft',song_cards:[{bars:4}]},{kind:'pitched',patchId:'warm_keys'});
 d=contributeJam(d,{pad:0,step:2});d.song_cards=ensureSectionIds([0,1,2].map(()=>({bars:4,material:extractSongMaterial(d)})));return d;
}
test('pre-Big return preserves suppressed attacks rather than weakening rounding comparison',()=>{
 const d=backing();d.song_cards[1].big=true;const before=structuredClone(d),r=previewReturningPart(d,0);
 assert.equal(r.changed,true,r.reason);assert.deepEqual(d,before);
 assert.equal(sameLocalEvents(local(compileReturnSong(d),d,0),local(compileReturnSong(r.after),r.after,3)),true);
});
test('rounding tolerance must not admit a changed previous ending from a Big return',()=>{
 const d=backing();d.song_cards[0].big=true;const before=structuredClone(d),r=previewReturningPart(d,0);
 assert.equal(r.changed,false);assert.deepEqual(r.after,before);assert.deepEqual(d,before);
});
test('rounding tolerance must not admit shortened personal final holds',()=>{
 const d=plain(113),n=d.song_cards[2].material.notes[0];n.step=15;n.duration_steps=8;
 n.performance={version:1,offset_steps:.25};const before=structuredClone(d),r=previewReturningPart(d,0);
 assert.equal(r.changed,false);assert.deepEqual(r.after,before);assert.deepEqual(d,before);
});

test('event equality tolerates only finite absolute-clock rounding, never musical payload changes',()=>{
 const event={id:'own',step:3.125,start_sec:.8131,duration_sec:.2655,velocity:.6,provenance:'user_placed',concrete:{midi_pitch:67}};
 assert.equal(sameLocalEvents([event],[{...event,start_sec:.8130}]),true);
 for(const change of [{step:3.126},{duration_sec:.2656},{velocity:.61},{provenance:'jam_generated'},{concrete:{midi_pitch:68}},{id:'other'},{start_sec:.8129},{start_sec:NaN},{start_sec:Infinity},{start_sec:undefined}]){
  assert.equal(sameLocalEvents([event],[{...event,...change}]),false,JSON.stringify(change));
 }
 assert.equal(sameLocalEvents([{...event,start_sec:NaN}],[{...event,start_sec:NaN}]),false);
 assert.equal(sameLocalEvents([event],[]),false);
});
