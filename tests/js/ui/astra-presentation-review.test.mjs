import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {previewReturningPart,compileReturnSong} from '../../../static/ui/returning_part.js';
import {ensureSectionIds} from '../../../static/js/theory/song_view.js';
function fixture(){
 const f=Object.create(PlayFlow.prototype);f.doc={id:'presentation',notes:[{id:'own',role:'lead',step:2,duration_steps:2,velocity:.7,patch_id:'warm_keys',provenance:'user_placed',concrete:{midi_pitch:60}}],global_context:{bpm:100,root_pc:0,scale_type:'major',meter:'4/4',steps_per_bar:16},song_cards:ensureSectionIds([{bars:4,role_name:'Theme'},{bars:4,role_name:'Ending'}])};
 f.app={scheduler:{isPlaying:false}};f._songBlockSvg=()=>'';f._keepLostHtml=()=>'';f._timelineHtml=()=>'';f._sheetBoxHtml=()=>'';f.editingCard=null;return f;
}
test('returning part keeps authored name with separate end-position labels',()=>{
 const f=fixture(),p=previewReturningPart(f.doc,0);assert.equal(p.changed,true,p.reason);f.doc=p.after;f.activeSongCard=2;
 assert.equal(f.doc.song_cards[2].role_name,'Part 1 returns');const html=f._renderSong();
 assert.doesNotMatch(html,/Select part 3: Ending/);assert.match(html,/Select part 3: Part 1 returns/);assert.match(html,/Ends here/);assert.match(html,/How it ends:/);
});
test('muted tune shows notes with layer-off notice and inline Turn on',()=>{
 const f=fixture();f.doc.song_cards[0].tune=false;f.editingCard=0;f.melodyFocus=true;f.eventRole='lead';
 assert.equal(compileReturnSong(f.doc).events.filter(e=>e.card===0&&e.role==='lead').length,0);
 const html=f._renderEventTune();assert.match(html,/data-phrase-note="own"/);assert.match(html,/Play part 1/);assert.match(html,/This sound is off in this part/);assert.match(html,/data-key="card-layer:0:tune"[^>]*>Turn on/);
});

test('editor Turn on changes compiled lead audibility without changing notes; one Undo restores silence',async()=>{
 const f=fixture();f.doc.song_cards[0].tune=false;f.editingCard=0;f.stage='tune';f.melodyFocus=true;f.eventRole='lead';f.beatGrid={};f.tuneGrid={};f.undoStack=[];f.confirm={};f.root={querySelector:()=>null};
 f.render=()=>{};f.cancelFieldGesture=()=>{};f._noteChoice=()=>{};f._stashDraft=()=>true;f.app._announce=()=>{};f.app.scheduler.setCompiledSong=()=>{};f.app.scheduler.unlock=async()=>{};
 const notes=structuredClone(f.doc.notes);f._compile();const before=structuredClone(f.app.compiledSong);assert.equal(before.events.filter(e=>e.card===0&&e.role==='lead').length,0);
 await f._onClick({target:{closest:()=>({dataset:{key:'card-layer:0:tune'},focus(){}})}});
 assert.equal(f.doc.song_cards[0].tune,true);assert.equal(f.app.compiledSong.events.filter(e=>e.card===0&&e.role==='lead').length,1);assert.deepEqual(f.doc.notes,notes);assert.equal(f.undoStack.length,1);
 f._undo();assert.equal(f.doc.song_cards[0].tune,false);assert.deepEqual(f.doc.notes,notes);assert.deepEqual(f.app.compiledSong.events,before.events);assert.equal(f.undoStack.length,0);
});

