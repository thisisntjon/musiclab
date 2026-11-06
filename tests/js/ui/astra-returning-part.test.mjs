import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewReturningPart,compileReturnSong} from '../../../static/ui/returning_part.js';
import {ensureSectionIds,extractSongMaterial} from '../../../static/js/theory/song_view.js';
import {startJam,contributeJam} from '../../../static/js/theory/jam_session.js';
import {validateProject} from '../../../static/js/theory/project_validation.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
function song(){
 let d=startJam({id:'return-fixture',notes:[],global_context:{root_pc:0,scale_type:'major',bpm:100,meter:'4/4',steps_per_bar:16},lead_patch_id:'warm_keys',drum_kit:'soft',song_cards:[{bars:4}]},{kind:'pitched',patchId:'warm_keys'});
 d=contributeJam(d,{pad:0,step:2});const edit=d.notes.find(n=>n.role==='bass');edit.edited_from_generator=edit.generated_by;edit.velocity=.37;
 d.song_cards=ensureSectionIds([0,1,2].map(i=>({bars:4,role_name:`Source ${i}`,material:extractSongMaterial(d)})));
 d.song_cards[2].material.notes.find(n=>n.provenance==='user_placed').step=9;
 return d;
}
test('selected last part copies exactly with provenance, remains independent, and original compiled music is unchanged',()=>{
 const d=song(),snapshot=structuredClone(d),p=previewReturningPart(d,2);assert.equal(p.changed,true,p.reason);assert.deepEqual(d,snapshot);
 const source=p.after.song_cards[2],copy=p.after.song_cards[3];assert.deepEqual(copy.material,source.material);assert.notEqual(copy.section_id,source.section_id);assert.equal(copy.capture_segment,undefined);
 assert.deepEqual(compileReturnSong(p.after).events.filter(e=>e.card<3),compileReturnSong(d).events);
 copy.material.notes[0].velocity=.01;assert.deepEqual(source.material,d.song_cards[2].material);
 source.material.notes[1].step=21;assert.notEqual(copy.material.notes[1].step,21);
});
test('saved return validates and reopens with exact material and compiled export input',()=>{
 const p=previewReturningPart(song(),2);assert.equal(p.changed,true,p.reason);const reopened=JSON.parse(JSON.stringify(p.after));validateProject(reopened);
 assert.deepEqual(reopened.song_cards,p.after.song_cards);assert.deepEqual(compileReturnSong(reopened),compileReturnSong(p.after));
});
test('Big predecessor changes and held-release changes decline without mutation',()=>{
 for(const big of [true,false]){
  const d=song();if(big)d.song_cards[0].big=true;else {const n=d.song_cards[2].material.notes.find(n=>n.provenance==='user_placed');n.step=63;n.duration_steps=8;n.performance={version:1,offset_steps:.25};}
  const before=structuredClone(d),p=previewReturningPart(d,0);assert.equal(p.changed,false);assert.deepEqual(p.after,before);assert.deepEqual(d,before);
 }
});
test('captured hold is preserved across contiguous parts; changed final-release semantics decline',()=>{
 const d=song();const n=d.song_cards[0].material.notes.find(n=>n.provenance==='user_placed');n.step=60;n.duration_steps=12;n.performance={version:1,offset_steps:.25};n.capture_occurrence=1;
 d.song_cards[0].capture_segment={version:1,take_id:'take-a',start_step:0,end_step:64};d.song_cards[1].capture_segment={version:1,take_id:'take-a',start_step:64,end_step:128};
 const p=previewReturningPart(d,0);assert.equal(p.changed,true,p.reason);const own=e=>e.provenance==='user_placed';assert.equal(compileReturnSong(p.after).events.find(e=>e.card===3&&own(e)).duration_sec,compileReturnSong(d).events.find(e=>e.card===0&&own(e)).duration_sec);d.song_cards[1].capture_segment.take_id='other-take';const long=previewReturningPart(d,0);assert.equal(long.changed,false);assert.deepEqual(long.after,d);
});
test('stale return Keep preserves later edit and adds no Undo',async()=>{
 const f=Object.create(PlayFlow.prototype);f.doc=song();f.editingCard=null;f.stage='song';f.root={querySelector:()=>null};f.render=()=>{};f.cancelFieldGesture=()=>{};f._stopForScopeChange=()=>{};f.undoStack=[];
 f.app={scheduler:{},_announce(){}};f.partComparison=previewReturningPart(f._canonicalDoc(),2);assert.equal(f.partComparison.changed,true);
 f.doc.song_cards[1].role_name='Later edit';const before=structuredClone(f._canonicalDoc());
 await f._onClick({target:{closest:()=>({dataset:{key:'compare-keep'},focus(){}})}});assert.deepEqual(f._canonicalDoc(),before);assert.equal(f.undoStack.length,0);
});


test('whole-song return audition uses normal transport and Stop restores canonical music',async()=>{
 const f=Object.create(PlayFlow.prototype);f.doc=song();f.editingCard=null;f.stage='song';f.root={querySelector:()=>null,querySelectorAll:()=>[]};
 f.partComparison=previewReturningPart(f._canonicalDoc(),2);const canonical=compileReturnSong(f.doc),before=structuredClone(f._canonicalDoc());let starts=0;
 const scheduler={isPlaying:false,stopGeneration:0,setLoopRange(){},setRepeatPlayback(v){this.repeat=v;},setCompiledSong(v){this.compiledSong=v;},preparePiano:async()=>{},start(){this.isPlaying=true;starts++;},playComparisonOnce(){assert.fail('return must use normal transport');}};
 f.app={compiledSong:canonical,scheduler,_announce(){}};f.render=()=>f._syncPartAudition();f._stopForScopeChange=()=>{scheduler.isPlaying=false;scheduler.stopGeneration++;f.render();};
 await f._playComparison(true);assert.equal(starts,1);assert.equal(scheduler.repeat,false);assert.deepEqual(scheduler.compiledSong,compileReturnSong(f.partComparison.after));assert.deepEqual(f._canonicalDoc(),before);
 scheduler.isPlaying=false;f._syncPartAudition();assert.equal(scheduler.compiledSong,canonical);
 await f._playComparison(false);assert.equal(starts,2);assert.deepEqual(scheduler.compiledSong,canonical);
});
