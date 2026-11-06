import test from 'node:test';
import assert from 'node:assert/strict';
import {starterSong,starterGroups,moveStarterChapter,changeStarterChapter} from '../../../static/ui/starter_song.js';
import {previewReturningPart,compileReturnSong,sameLocalEvents} from '../../../static/ui/returning_part.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const fixture=()=>{
 const d=starterSong({id:'web-chapters',title:'Web chapters',global_context:{bpm:113,bars:4,root_pc:0,scale_type:'major'},auto_harmony_stabs:false,scaffold_options:{humanize:false,pre_drop_silence:false},notes:[
 {id:'own',role:'lead',patch_id:'warm_keys',step:1,duration_steps:2,velocity:.5,concrete:{midi_pitch:60},pitch_lock_mode:'concrete',provenance:'user_placed'},
 {id:'late',role:'bass',patch_id:'clean_bass',step:14,duration_steps:1,velocity:.3,concrete:{midi_pitch:36},pitch_lock_mode:'concrete',provenance:'jam_generated'}],song_cards:[{section_id:'a',bars:1,tune:true,under:true,beat:true}]}).after;
 d.song_cards[1].big=true;return d;
};
function local(d,index){const s=compileReturnSong(d),offset=d.song_cards.slice(0,index).reduce((n,c)=>n+c.bars*16,0);return s.events.filter(e=>e.card===index).map(e=>{
 const n=structuredClone(e);delete n.card;delete n.section_id;n.step=Number((n.step-offset).toFixed(9));n.start_sec-=offset*15/s.bpm;
 if(n.generated_by==='song_card_lift'&&n.provenance==='generator_default'&&n.id.endsWith('-lift-c'+index))n.id=n.id.slice(0,-('-lift-c'+index).length)+'-lift-local';
 if(d.song_cards[index].tune_variant==='lift'&&n.id.endsWith('-variation-c'+index))n.id=n.id.slice(0,-('-variation-c'+index).length)+'-variation-local';
 if(d.song_cards[index].fx==='drum_roll'&&n.provenance==='generator_default'&&n.id.startsWith('fx-roll-c'+index+'-s'))n.id=n.id.replace('fx-roll-c'+index+'-s','fx-roll-local-s');return n;
});}
for(const [index,action] of [[0,'copy'],[0,'remove'],[0,'later'],[1,'copy'],[1,'remove'],[1,'earlier'],[1,'later'],[2,'earlier']])test(`Bigger chapter context: ${index} ${action} retains surviving local music`,()=>{
 const d=fixture(),before=structuredClone(d),id=d.song_cards[index].section_id;
 const r=['copy','remove'].includes(action)?changeStarterChapter(d,id,action):moveStarterChapter(d,id,action);
 assert.equal(r.changed,true,r.reason);assert.deepEqual(d,before);
 for(const [i,c] of d.song_cards.entries()){
  const j=r.doc.song_cards.findIndex(n=>n.section_id===c.section_id);if(j<0)continue;
  assert.ok(sameLocalEvents(local(d,i),local(r.doc,j)),`retained section ${i}`);
  assert.deepEqual(r.doc.song_cards[j].material,c.material);
 }
 if(action==='copy')assert.ok(sameLocalEvents(local(d,index),local(r.doc,r.selectedIndex)));
 const reopened=parseProjectJson(exportProjectJson(r.doc));assert.equal(reopened.ok,true);assert.deepEqual(compileReturnSong(reopened.song),compileReturnSong(r.doc));
});
test('web claim is bounded: ordinary Start return and Ending operations already work',()=>{
 const d=fixture();assert.equal(previewReturningPart(d,0).changed,true);assert.equal(previewReturningPart(d,2).changed,true);
 const id=d.song_cards[2].section_id;assert.equal(changeStarterChapter(d,id,'copy').changed,true);assert.equal(changeStarterChapter(d,id,'remove').changed,true);
});

for(const effect of ['high_lift','drum_roll','tune_variant'])test(`moving ${effect} retains its generated music and personal notes`,()=>{
 const d=fixture();d.song_cards[1].big=false;if(effect==='tune_variant')d.song_cards[1].tune_variant='lift';else d.song_cards[1].fx=effect;
 const before=structuredClone(d),r=moveStarterChapter(d,d.song_cards[1].section_id,'later');assert.equal(r.changed,true,r.reason);assert.deepEqual(d,before);
 for(const [i,c] of d.song_cards.entries()){const j=r.doc.song_cards.findIndex(n=>n.section_id===c.section_id);assert.ok(sameLocalEvents(local(d,i),local(r.doc,j)));assert.deepEqual(r.doc.song_cards[j].material,c.material);}
});
