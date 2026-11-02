import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {anchorBand} from '../../../static/js/theory/band_anchor.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

function scene(id) {
 return setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',
  showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:id,scene_mix:SCENE_MIX_VERSION,responsive:false});
}
test('shared traits are neutral compatible, independent and never compound across all current recipes',()=>{
 for(const {id} of SCENE_CATALOGUE) {
  const doc=scene(id),neutral=setJamDirection(doc,{style_drums:2,style_chords:2});
  assert.deepEqual(neutral.notes,doc.notes);
  const changed=setJamDirection(doc,{style_drums:4,style_chords:4});
  assert.deepEqual(setJamDirection(changed).notes,changed.notes);
  assert.deepEqual(setJamDirection(changed,{style_drums:2,style_chords:2}).notes,doc.notes);
  assert.deepEqual(setJamDirection(setJamDirection(doc,{style_drums:4}),{style_chords:4}).notes,
   setJamDirection(setJamDirection(doc,{style_chords:4}),{style_drums:4}).notes);
  assert.deepEqual(changed.notes.filter(n=>['lead','bass'].includes(n.role)),doc.notes.filter(n=>['lead','bass'].includes(n.role)));
 }
});

test('rocksteady/reggae reversal, banjo chords and Stay preserve personal material and saved intent',()=>{
 let doc=scene('rocksteady-v1');
 const own={id:'my-chord',step:3,duration_steps:2,role:'harmony',patch_id:'warm_keys',concrete:{midi_pitch:60},
  velocity:.6,provenance:'user_placed',performance:{version:1,offset_steps:.25}};
 doc.notes.push(own);doc=setJamDirection(doc,{style_drums:4,style_chords:0,band_chord_patch:'sampled_banjo_v1'});
 const other=setJamDirection(doc,{scene_id:'reggae-v1'}),back=setJamDirection(other,{scene_id:'rocksteady-v1'});
 assert.deepEqual(back.notes,doc.notes);assert.deepEqual(other.jam_session.style_traits,doc.jam_session.style_traits);
 assert.deepEqual(other.notes.filter(n=>n.provenance==='user_placed'),[own]);
 assert.ok(other.notes.filter(n=>n.provenance==='jam_generated'&&n.role==='harmony').every(n=>n.patch_id==='sampled_banjo_v1'));
 const regular=setJamDirection(other,{band_chord_patch:null});
 assert.deepEqual(regular.notes.map(n=>({...n,patch_id:null})),other.notes.map(n=>({...n,patch_id:null})));
 const compiled=compileSongStandalone(other),kept=setJamDirection(anchorBand(other,{time:1,events:compiled.events}));
 const stored=setJamDirection(kept,{style_drums:0,style_chords:4});
 assert.deepEqual(stored.notes,kept.notes,'storing incoming-style intent cannot double-apply to Stay');
 const next=setJamDirection(stored,{scene_id:'rocksteady-v1'});
 assert.equal(next.jam_session.style_traits.drums,0);assert.equal(next.jam_session.anchor_backing,undefined);
 const parsed=parseProjectJson(exportProjectJson(next));assert.equal(parsed.ok,true);
 assert.deepEqual(compileSongStandalone(parsed.song).events,compileSongStandalone(next).events);
 const bad=structuredClone(next);bad.jam_session.style_traits.chords=5;assert.equal(parseProjectJson(exportProjectJson(bad)).ok,false);
 bad.jam_session.style_traits.chords=2;bad.jam_session.band_chord_patch='fake';assert.equal(parseProjectJson(exportProjectJson(bad)).ok,false);
});

test('shared controls retain short labels even inside the conditional Stay template',()=>{
 const flow=Object.create(PlayFlow.prototype),doc=scene('reggae-v1');
 flow.doc=setJamDirection(anchorBand(doc,{time:0,events:compileSongStandalone(doc).events}));
 const html=flow._sharedStyleControlsHtml();
 const labels=[...html.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map(m=>m[1]);
 assert.ok(labels.includes('Carry these levels'));
 assert.ok(labels.every(label=>label.trim().split(/\s+/).length<=3));
});
