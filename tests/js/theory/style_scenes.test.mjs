import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_VARIANTS,SCENE_COMPATIBILITY} from '../../../static/js/theory/style_scenes.js';
import {startJam,setJamDirection,jamDirectionKey} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const fresh=()=>startJam(newPlayDoc(),{patchId:'warm_keys'});
test('original scenes have distinct musical structure and preserve legacy base',()=>{
  assert.deepEqual(SCENE_COMPATIBILITY.entrySteps,[0,16,32,48]);
  for(let profile=0;profile<4;profile++) {
    const base=setJamDirection(fresh(),{style_spectrum:profile,responsive:false});
    assert.deepEqual(setJamDirection(base,{scene_variant:'base'}).notes,base.notes);
    const signatures=[];
    for(const {id:scene_variant} of SCENE_VARIANTS) {
      const song=setJamDirection(base,{scene_variant});
      assert.equal(new Set(song.notes.map(n=>n.id)).size,song.notes.length);
      signatures.push(JSON.stringify(song.notes.map(n=>[n.role,n.step,n.duration_steps,n.concrete.midi_pitch])));
      const reopened=parseProjectJson(exportProjectJson(song));
      assert.equal(reopened.ok,true);
      assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(song).events);
      if(scene_variant!=='base')assert.ok(song.notes.every(n=>n.scene_version===1&&n.provenance==='jam_generated'));
    }
    assert.equal(new Set(signatures).size,3,`profile ${profile}`);
  }
});
test('scene variations protect performed personal bass intervals at all supported densities',()=>{
  const base=fresh();
  const own={id:'owned-hold',step:14,role:'bass',patch_id:'clean_bass',duration_steps:5.25,
    performance:{version:1,offset_steps:.35,hold_id:'personal'},concrete:{midi_pitch:39},velocity:.6,provenance:'user_placed'};
  base.notes.push(own);
  for(let profile=0;profile<4;profile++)for(let density=0;density<5;density++)for(const {id:scene_variant} of SCENE_VARIANTS) {
    const song=setJamDirection(base,{style_spectrum:profile,scene_variant,density});
    assert.deepEqual(song.notes.find(n=>n.id===own.id),own);
    const events=compileSongStandalone(song).events, held=events.find(e=>e.id===own.id);
    for(const event of events.filter(e=>e.role==='bass'&&e.id!==own.id))assert.ok(
      event.start_sec+event.duration_sec<=held.start_sec+1e-8 || event.start_sec>=held.start_sec+held.duration_sec-1e-8);
  }
});
test('variants change direction identity but response updates do not',()=>{
  const base=setJamDirection(fresh(),{style_spectrum:1});
  const next=setJamDirection(base,{scene_variant:'answer'});
  assert.notEqual(jamDirectionKey(base),jamDirectionKey(next));
  assert.equal(jamDirectionKey(next),jamDirectionKey(setJamDirection(next,{density:3})));
  assert.throws(()=>setJamDirection(base,{scene_variant:'future'}),/Unsupported/);
  const bad={...next,jam_session:{...next.jam_session,scene_variant:'future'}};
  assert.equal(parseProjectJson(JSON.stringify(bad)).ok,false);
});
