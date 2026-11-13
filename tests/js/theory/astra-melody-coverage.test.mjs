import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {planMelodyCandidate} from '../../../static/js/theory/melody_composer_v3.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {pulseBacking} from '../../../static/js/theory/pulse_scenes.js';
import {grimeBacking} from '../../../static/js/theory/grime_scene.js';
import {footworkBacking} from '../../../static/js/theory/footwork_scene.js';
import {baltimoreBacking} from '../../../static/js/theory/baltimore_scene.js';
const producers={'electro-v1':pulseBacking,'grime-v1':grimeBacking,'footwork-v1':footworkBacking,'baltimore-club-v1':baltimoreBacking};
function fixture(id,root,scale){
 const doc={notes:[],auto_harmony_stabs:false,global_context:{bpm:120,root_pc:root,scale_type:scale},jam_session:{scene_id:id,density:1,color:1,scene_variant:'base',exploration_map:'catalogue-circle-v2'}};
 const own={id:'personal-held',role:'lead',step:10,duration_steps:9,concrete:{midi_pitch:root+60},patch_id:'sampled_piano_v1',provenance:'user_placed'};
 const motif=[{id:'generated-motif',role:'lead',step:0,duration_steps:2,concrete:{midi_pitch:root+64},patch_id:'sampled_piano_v1',provenance:'jam_generated'}];
 const events=[...producers[id](doc,doc.jam_session,[],motif),own].map(n=>({...n,start_sec:(n.step+(n.performance?.offset_steps||0))*.125,duration_sec:n.duration_steps*.125}));
 return {doc,song:{song_id:'coverage',bpm:120,swing:.5,steps_per_bar:16,total_steps:64,events},reached:{phraseContext:phraseContext(doc)}};
}
for(const id of Object.keys(producers))test(`${id}: authored backing accepts complete phrases with distinct cardinal rhythms`,()=>{
 for(const [root,scale] of [[0,'major'],[2,'natural_minor'],[11,'major']]){
  const f=fixture(id,root,scale),before=structuredClone(f),ctx=captureMelodyContext(f.song,f.reached);assert.ok(ctx,id);
  const chords=f.song.events.filter(n=>n.role==='harmony');assert.ok(chords.length);
  for(const n of chords)assert.ok(ctx.harmony.bars[Math.floor(n.step/16)].includes((n.concrete.midi_pitch-root+120)%12));
  const plans=[{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}].map(p=>planMelodyCandidate(ctx,p));
  const rhythm=p=>p.notes.filter(n=>n.role==='lead').map(n=>n.step).join(',');assert.equal(new Set(plans.map(rhythm)).size,4);
  for(const p of plans){assert.deepEqual(p.notes.filter(n=>n.role!=='lead'),f.song.events.filter(n=>n.role!=='lead'));assert.deepEqual(planMelodyCandidate(ctx,p.choice.position),p);}
  assert.deepEqual(planMelodyCandidate(ctx,{x:0,y:0}).notes,f.song.events);assert.deepEqual(f,before);assert.deepEqual(ctx.source.events.find(n=>n.id==='personal-held'),f.song.events.find(n=>n.id==='personal-held'));
 }
});
test('coverage expansion retains unknown/mode/form/custom and malformed-harmony guards',()=>{
 const {song,reached}=fixture('electro-v1',0,'major');
 for(const extra of [{sceneId:'unknown-v1'},{mode:{name:'dorian'}},{form:{version:1,id:'electro-v1'}},{harmony:null}])assert.equal(captureMelodyContext(song,{phraseContext:{...reached.phraseContext,...extra}}),null);
 assert.equal(captureMelodyContext(song,reached,{customBacking:true}),null);
 assert.equal(captureMelodyContext({...song,steps_per_bar:12,total_steps:48},reached),null);
});

test('entry hint follows reached music, not requested doc, validates real guards and refreshes on commit',async()=>{
 const {PlayFlow}=await import('../../../static/ui/stages/play_flow.js');
 const f=fixture('electro-v1',0,'major'),flow=Object.create(PlayFlow.prototype);
 let reached={...f.reached,events:f.song.events};const scheduler={isPlaying:true,compiledSong:f.song,activeJamBacking:()=>reached};
 flow.app={scheduler};flow.doc={...f.doc,jam_session:{...f.doc.jam_session,scene_id:'unknown-v1'}};
 assert.match(flow._melodyEntryHint(),/^Try new tune patterns/);
 const coverage={textContent:''},circle={querySelector:()=>null};flow.root={querySelector:s=>s==='[data-music-circle]'?circle:s==='[data-melody-entry-coverage]'?coverage:null};flow._paintDirectionGlow=()=>{};
 flow._paintCircle();assert.match(coverage.textContent,/^Try new tune patterns/);
 reached={...reached,phraseContext:{...reached.phraseContext,sceneId:'unknown-v1'}};
 flow.doc.jam_session.scene_id='electro-v1';flow._paintCircle();assert.match(coverage.textContent,/note edits only/);
 reached={...f.reached,events:f.song.events};scheduler.compiledSong={...f.song,total_steps:48};assert.match(flow._melodyEntryHint(),/note edits only/);
 scheduler.compiledSong=f.song;flow.doc.jam_session.anchor_backing={};assert.match(flow._melodyEntryHint(),/note edits only/);
 delete flow.doc.jam_session.anchor_backing;assert.match(flow._melodyEntryHint(),/^Try new tune patterns/);
 scheduler.isPlaying=false;flow._paintCircle();assert.match(coverage.textContent,/Press Listen/);
});
