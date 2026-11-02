import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {anchorBand,applyAnchorTraits} from '../../../static/js/theory/band_anchor.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
test('nearby anchor selects active bridge rather than future destination on both clocks',()=>{
  for(const cycle of [12,16]) {
    const doc=newPlayDoc();doc.global_context.steps_per_bar=cycle;
    const before=setJamDirection(startJam(doc),{style_spectrum:0,responsive:false});
    const after=setJamDirection(before,{style_spectrum:3});
    const a=compileSongStandalone(before),b=compileSongStandalone(after),scheduler=new LookaheadScheduler();
    scheduler.setCompiledSong(a,{quantizeJamBacking:true,jamStyleKey:'a'});
    scheduler.audioCtx={currentTime:.5};scheduler.isPlaying=true;scheduler._rememberJamBacking(0);
    scheduler.setCompiledSong(b,{quantizeJamBacking:true,jamStyleKey:'b'});
    scheduler.currentStep=cycle;scheduler.nextStepAudioTime=cycle*.15;scheduler._commitJamBackingIfDue();
    assert.deepEqual(scheduler.activeJamBacking().events,a.events.filter(n=>n.provenance==='jam_generated'));
    scheduler.audioCtx.currentTime=cycle*.15+.01;
    const snapshot=scheduler.activeJamBacking(),anchored=setJamDirection(anchorBand(after,snapshot));
    assert.deepEqual(anchored.jam_session.anchor_backing.notes.map(n=>n.id),snapshot.events.map(n=>n.id));
    const original=structuredClone(anchored.jam_session.anchor_backing);
    const variant=setJamDirection(anchored,{scene_variant:'space'});
    assert.deepEqual(variant.jam_session.anchor_backing,original);
    assert.equal(setJamDirection(variant,{color:3}).jam_session.anchor_backing,undefined);
    assert.equal(parseProjectJson(exportProjectJson(variant)).ok,true);
    const bad=structuredClone(variant);bad.jam_session.anchor_backing.steps_per_bar=cycle===12?16:12;
    assert.equal(parseProjectJson(exportProjectJson(bad)).ok,false);
  }
});

test('kept-band traits preserve all catalogue baselines, commute, and round-trip without compounding',()=>{
 for(const scene of SCENE_CATALOGUE) {
  let doc=setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',
    scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:scene.id,scene_mix:SCENE_MIX_VERSION,responsive:true});
  const own={id:'jam-user-own',step:7,duration_steps:3.25,velocity:.7,role:'lead',patch_id:'warm_keys',
    concrete:{midi_pitch:67},provenance:'user_placed',performance:{version:1,offset_steps:.25}};
  doc.notes.push(own);doc=setJamDirection(doc);
  const events=compileSongStandalone(doc).events.filter(e=>e.provenance==='jam_generated');
  const anchored=setJamDirection(anchorBand(doc,{time:4,events}));
  const baseline=structuredClone(anchored.jam_session.anchor_backing);
  const personal=anchored.notes.filter(n=>n.provenance!=='jam_generated');
  assert.deepEqual(personal,[own]);
  assert.deepEqual(anchored.notes.filter(n=>n.provenance==='jam_generated'),baseline.notes,'neutral must not answer the player again');
  const a=setJamDirection(setJamDirection(anchored,{anchor_drums:4}),{anchor_chords:4});
  const b=setJamDirection(setJamDirection(anchored,{anchor_chords:4}),{anchor_drums:4});
  assert.deepEqual(a.notes,b.notes);assert.deepEqual(a.jam_session.anchor_backing,baseline);
  assert.deepEqual(a.notes.filter(n=>n.provenance!=='jam_generated'),personal);
  const reset=setJamDirection(a,{anchor_drums:2,anchor_chords:2});assert.deepEqual(reset.notes,anchored.notes);
  const drums=setJamDirection(anchored,{anchor_drums:4});
  assert.deepEqual(drums.notes.filter(n=>n.role!=='drums'),anchored.notes.filter(n=>n.role!=='drums'));
  const chords=setJamDirection(anchored,{anchor_chords:0});
  assert.deepEqual(chords.notes.filter(n=>n.role!=='harmony'),anchored.notes.filter(n=>n.role!=='harmony'));
  const parsed=parseProjectJson(exportProjectJson(a));assert.equal(parsed.ok,true);
  assert.deepEqual(compileSongStandalone(parsed.song).events,compileSongStandalone(a).events);
  const bad=structuredClone(a);bad.jam_session.anchor_traits.drums=5;assert.equal(parseProjectJson(exportProjectJson(bad)).ok,false);
  assert.equal(setJamDirection(a,{color:3}).jam_session.anchor_traits,undefined);
 }
});

test('longer chord gates cap at new attacks and personal notes while neutral preserves old tails',()=>{
 const doc=newPlayDoc(),note=(id,step,duration,pitch=60)=>({id,step,duration_steps:duration,role:'harmony',
  patch_id:'sampled_piano_v1',provenance:'jam_generated',velocity:.5,concrete:{midi_pitch:pitch},performance:{version:1,offset_steps:.25}});
 const notes=[note('first',0,4),note('next',5,2),note('tail',63,3)];
 const own={...note('mine',4,1,64),provenance:'user_placed'};
 const long=applyAnchorTraits(notes,{drums:2,chords:4},[own],doc);
 assert.equal(long[0].duration_steps,4);assert.equal(long[2].duration_steps,3);
 assert.deepEqual(applyAnchorTraits(notes,{drums:2,chords:2},[own],doc),notes);
 assert.equal(applyAnchorTraits(notes,{drums:2,chords:0},[],doc)[0].duration_steps,2.4);
 const loud={...notes[0],role:'drums',velocity:1};
 assert.equal(applyAnchorTraits([loud],{drums:4,chords:2},[],doc)[0].velocity,1);
});

test('kept-band controls explain absent roles instead of offering inaudible adjustments',()=>{
 const flow=Object.create(PlayFlow.prototype);flow.app={scheduler:{isPlaying:false}};
 flow.doc={jam_session:{anchor_backing:{notes:[]}}};
 const html=flow._keptBandControlsHtml();
 for(const part of ['drums','chords'])for(const direction of ['less','more'])
  assert.match(html,new RegExp(`data-key="kept-${part}:${direction}"[^>]*disabled`));
 assert.match(html,/This band has no drums/);assert.match(html,/This band has no chords/);
 flow.keptBandNoChange='No note change at this limit.';assert.equal(flow._keptBandStatus(),flow.keptBandNoChange);
});
