import test from 'node:test';
import assert from 'node:assert/strict';
import {previewReturningPart,compileReturnSong,sameLocalEvents} from '../../../static/ui/returning_part.js';
import {ensureSectionIds,extractSongMaterial,normalizeSongCards} from '../../../static/js/theory/song_view.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
function song(){
 const d={id:'return-context',title:'Context',global_context:{bpm:113,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,
 scaffold_options:{humanize:false,pre_drop_silence:false},notes:[
 {id:'own',step:14,duration_steps:1,velocity:.6,role:'lead',patch_id:'warm_keys',provenance:'user_placed',pitch_lock_mode:'concrete',concrete:{midi_pitch:64}},
 {id:'bass-early',step:1,duration_steps:1,velocity:.3,role:'bass',patch_id:'clean_bass',provenance:'jam_generated',pitch_lock_mode:'concrete',concrete:{midi_pitch:36}},
 {id:'bass-late',step:14,duration_steps:1,velocity:.3,role:'bass',patch_id:'clean_bass',provenance:'jam_generated',pitch_lock_mode:'concrete',concrete:{midi_pitch:36}}],song_cards:[]};
 d.song_cards=ensureSectionIds(Array.from({length:3},()=>({bars:1,tune:true,under:true,beat:true,material:extractSongMaterial(d)})));
 d.song_cards[1].big=true;return d;
}
const ids=(d,index)=>compileReturnSong(d).events.filter(e=>e.card===index).map(e=>e.id);
function local(d,index){const s=compileReturnSong(d),offset=index*16;return s.events.filter(e=>e.card===index).map(e=>{const n=structuredClone(e);delete n.card;n.step-=offset;n.start_sec-=offset*15/s.bpm;return n;});}
test('ordinary pre-Big return freezes heard breath, leaves original cards untouched and reopens',()=>{
 const d=song(),before=structuredClone(d);assert.ok(!ids(d,0).includes('bass-late'));assert.ok(ids(d,0).includes('own'));
 const r=previewReturningPart(d,0);assert.equal(r.changed,true,r.reason);assert.deepEqual(d,before);
 assert.equal(r.after.song_cards[3].pre_big_breath,true);assert.deepEqual(r.after.song_cards.slice(0,3),d.song_cards);
 assert.equal(sameLocalEvents(local(d,0),local(r.after,3)),true);
 const reopened=parseProjectJson(exportProjectJson(r.after));assert.equal(reopened.ok,true);
 assert.equal(reopened.song.song_cards[3].pre_big_breath,true);assert.deepEqual(compileReturnSong(reopened.song),compileReturnSong(r.after));
});
test('explicit false overrides following Big, persists on independent return and reopens',()=>{
 const d=song();d.song_cards[0].pre_big_breath=false;assert.ok(ids(d,0).includes('bass-late'));
 const r=previewReturningPart(d,0);assert.equal(r.changed,true,r.reason);assert.equal(r.after.song_cards[3].pre_big_breath,false);
 assert.equal(sameLocalEvents(local(d,0),local(r.after,3)),true);
 const reopened=parseProjectJson(exportProjectJson(r.after));assert.equal(reopened.ok,true);assert.equal(reopened.song.song_cards[3].pre_big_breath,false);
 assert.deepEqual(compileReturnSong(reopened.song),compileReturnSong(r.after));
});
test('absent and malformed breath metadata retain legacy contextual inference',()=>{
 const base=song(),expected=compileReturnSong(base);
 for(const value of [undefined,null,0,1,'false','true',{},[]]){const d=structuredClone(base);d.song_cards[0].pre_big_breath=value;
 assert.equal(Object.hasOwn(normalizeSongCards(d.song_cards)[0],'pre_big_breath'),false);assert.deepEqual(compileReturnSong(d),expected);}
});
test('explicit true breath is effective without a following Big and preserves personal lead',()=>{
 const d=song();d.song_cards[1].big=false;d.song_cards[0].pre_big_breath=true;
 assert.ok(!ids(d,0).includes('bass-late'));assert.ok(ids(d,0).includes('bass-early'));assert.ok(ids(d,0).includes('own'));
});
test('generated drum roll uses the same strict breath override',()=>{
 const d=song();d.song_cards[0].fx='drum_roll';
 const roll=()=>compileReturnSong(d).events.filter(e=>e.card===0&&e.id.startsWith('fx-roll')).map(e=>e.step);
 assert.deepEqual(roll(),[8,9,10,11,12]);d.song_cards[0].pre_big_breath=false;assert.deepEqual(roll(),[8,9,10,11,12,13,14,15]);
 d.song_cards[1].big=false;d.song_cards[0].pre_big_breath=true;assert.deepEqual(roll(),[8,9,10,11,12]);
});
