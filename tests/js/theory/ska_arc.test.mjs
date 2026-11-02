import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection,jamDirectionKey} from '../../../static/js/theory/jam_session.js';
import {circleChoiceAt,circleFieldPosition,circleFieldForScene} from '../../../static/js/theory/music_circle.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
const make=()=>{const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'ska-v1',responsive:false});d.jam_session.exploration_map='catalogue-circle-v2';return d;};
test('scored circle arc coordinates round-trip and preserve old discrete admission',()=>{
 for(let i=0;i<=40;i++){const field={version:5,x:i/40,y:.5},p=circleFieldPosition(field),choice=circleChoiceAt(p.x,p.y);assert.deepEqual(choice.field,field);const d=setJamDirection(make(),{music_field:field});assert.equal(jamDirectionKey(d),'music-field-v5');assert.equal(d.jam_session.scene_id,choice.id);const saved=parseProjectJson(exportProjectJson(d));assert.equal(saved.ok,true);assert.deepEqual(compileSongStandalone(saved.song).events,compileSongStandalone(d).events);}
 const d=make();d.jam_session.exploration_map='catalogue-circle-v1';assert.throws(()=>setJamDirection(d,{music_field:circleFieldForScene('ska-v1')}),/updated circle/);
 const bad=setJamDirection(make(),{music_field:circleFieldForScene('ska-v1')});bad.jam_session.scene_id='reggae-v1';assert.equal(parseProjectJson(exportProjectJson(bad)).ok,false);
 assert.equal(setJamDirection(make(),{music_field:{version:4,x:.5,y:.5}}).jam_session.exploration_map,undefined);
});
test('full chords and all four bass gestures survive the Ska to Rocksteady arc',()=>{
 for(const [x,times] of [[0,[0,4,8,12]],[.25,[0,5,9,13]],[.5,[0,6,10,14]]]){
  const d=setJamDirection(make(),{music_field:{version:5,x,y:.5}}),bass=d.notes.filter(n=>n.role==='bass');assert.equal(bass.length,16);assert.deepEqual(bass.filter(n=>n.step<16).map(n=>n.step+(n.performance?.offset_steps||0)),times);
  assert.equal(d.notes.filter(n=>n.role==='harmony').length,48);
  for(let i=0;i<bass.length-1;i++)assert.ok(bass[i].step+(bass[i].performance?.offset_steps||0)+bass[i].duration_steps<=bass[i+1].step+(bass[i+1].performance?.offset_steps||0)+1e-8);
  if(x===0)assert.equal(bass[3].concrete.midi_pitch,47); // C -> A approach is B, not a retuned chord tone.
 }
});
test('arc movement preserves a personal chromatic held note and latest intent can leave the arc',()=>{
 const d=make(),own={id:'own-arc',source_note_id:'own-arc',role:'lead',patch_id:'sampled_piano_v1',step:1,duration_steps:12,velocity:.42,provenance:'user_placed',pitch_lock_mode:'concrete',concrete:{midi_pitch:61}};d.notes.push(own);
 const flow=Object.assign(Object.create(PlayFlow.prototype),{doc:d,stage:'jam',app:{scheduler:{stopGeneration:0}},_pushUndo(){},_paintCircle(){},_acceptJamDoc(next){this.doc=next;}});
 flow._requestCircle('rocksteady-v1',true,{version:5,x:.375,y:.5});flow._flushMusicField();assert.deepEqual(flow.doc.notes.find(n=>n.id===own.id),own);assert.equal(flow.doc.jam_session.music_field.x,.375);
 flow._requestCircle('reggae-v1',true,{version:5,x:.9,y:.5});flow._requestCircle('house-v1',true,null);flow._flushMusicField();assert.equal(flow.doc.jam_session.music_field,undefined);assert.equal(flow.doc.jam_session.scene_id,'house-v1');assert.deepEqual(flow.doc.notes.find(n=>n.id===own.id),own);
});
test('three quick button nudges accumulate and stop invalidates the pending coordinate',async()=>{
 const f=Object.assign(Object.create(PlayFlow.prototype),{doc:setJamDirection(make(),{music_field:{version:5,x:.5,y:.5}}),stage:'jam',confirm:{armed:null},app:{scheduler:{stopGeneration:0}},_pushUndo(){},_paintCircle(){},_acceptJamDoc(d){this.doc=d;}});
 for(let i=0;i<3;i++)await f._onClick({target:{closest:()=>({dataset:{key:'circle-blend:more'},focus(){}})}});
 assert.equal(f.circleIntent.field.x,.575);f.app.scheduler.stopGeneration++;f._flushMusicField();assert.equal(f.doc.jam_session.music_field.x,.5);assert.equal(f.circleIntent,null);
});
