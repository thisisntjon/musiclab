// A committed melody can carry any Sound wheel sound into the jam's saved phrase state
// (jam_session.melodic_evolution.previousPatch). Reopening that save must not refuse the
// whole project, and an unknown sound name must still be refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planMelodicPhrase,restoreMelodicPhrase,leadPalette} from '../../../static/js/theory/melodic_evolution.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {validateProject} from '../../../static/js/theory/project_validation.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {SAMPLED_PROGRAMS} from '../../../static/js/theory/sampled_sound_capabilities.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

// The 18 sounds added for the Sound wheel (13 Nov 2026), plus Trumpet, which a jam can
// already hand to the next phrase today.
const NEW_WHEEL=['sampled_accordion_v1','sampled_music_box_v1','sampled_marimba_v1','sampled_vibraphone_v1',
  'sampled_steel_drums_v1','sampled_kalimba_v1','sampled_koto_v1','sampled_harp_v1','sampled_pizzicato_v1',
  'sampled_solo_vox_v1','sampled_synth_voice_v1','sampled_recorder_v1','sampled_pan_flute_v1','sampled_ocarina_v1',
  'sampled_trombone_v1','sampled_square_lead_v1','sampled_saw_lead_v1','sampled_synth_brass_v1'];
const REACHABLE_TODAY='sampled_trumpet_v1';
// Unknown names stay refused, including the two the lead dropped and prototype keys.
const UNKNOWN=['alien','sampled_fiddle_v1','sampled_tuba_v1','sampled_kalimba_v2','toString','__proto__','constructor','hasOwnProperty','',42,true,{}];

function jamDoc() {
  let doc=startJam(newPlayDoc(),{patchId:'sampled_piano_v1'});
  doc=setJamDirection(doc,{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',
    scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'reggae-v1'});
  return doc;
}
function descriptorFor(doc,previousPatch,version=3) {
  const context=phraseContext(doc);
  return planMelodicPhrase({version,harmony:context.harmony,phraseOrdinal:5,sceneId:'reggae-v1',root:context.root,
    minor:context.minor,bpm:doc.global_context.bpm||100,seed:23,previousPatch,recentOpenings:[]}).descriptor;
}
/** A kept wheel melody: its generated lead plays the wheel sound and the jam remembers it as the last phrase's sound. */
function savedWheelSong(patch,version=3) {
  const doc=jamDoc();
  const lead=doc.notes.find(n=>n.role==='lead'&&n.provenance==='jam_generated');
  assert.ok(lead,'the jam fixture has a generated lead to re-sound');
  const base={patch_id:lead.patch_id,...(Object.hasOwn(lead,'velocity')?{velocity:lead.velocity}:{})};
  doc.notes=doc.notes.map(n=>n===lead?{...n,patch_id:patch,sound_base:base}:n);
  doc.capture_notes={melody_field:{version:4,context:{melodySound:patch},choice:{position:{x:0,y:0}}}};
  doc.jam_session.melodic_evolution=JSON.parse(JSON.stringify(descriptorFor(doc,patch,version)));
  return doc;
}

test('a jam saved after a wheel sound reopens: project file round trip and validation',()=>{
  for(const patch of [REACHABLE_TODAY,...NEW_WHEEL]) for(const version of [1,2,3]) {
    const song=savedWheelSong(patch,version);
    assert.equal(song.jam_session.melodic_evolution.previousPatch,patch);
    assert.doesNotThrow(()=>validateProject(structuredClone(song)),`${patch} v${version} validates`);
    const reopened=parseProjectJson(exportProjectJson(song));
    assert.equal(reopened.ok,true,`${patch} v${version} reopens (${reopened.reason})`);
    assert.deepEqual(reopened.song.jam_session.melodic_evolution,song.jam_session.melodic_evolution);
    assert.deepEqual(reopened.song.notes,song.notes,'wheel sound and its sound_base survive the round trip');
  }
});

test('every sampled patch, and every previously accepted palette patch, restores as the last phrase sound',()=>{
  const doc=jamDoc();
  const palettes=new Set(['reggae-v1','bluegrass-v1','gospel-piano-v1','doo-wop-v1','delta-blues-v1','outlaw-country-v1','house-v1']
    .flatMap(leadPalette));
  for(const patch of new Set([...Object.keys(SAMPLED_PROGRAMS),...palettes,null])) {
    const saved=descriptorFor(doc,patch);
    const restored=restoreMelodicPhrase(JSON.parse(JSON.stringify(saved)));
    assert.ok(restored,`${patch} restores`);
    assert.equal(restored.descriptor.previousPatch,patch);
  }
});

test('unknown sound names in saved phrase state are still refused',()=>{
  for(const patch of UNKNOWN) {
    const song=savedWheelSong(REACHABLE_TODAY);
    song.jam_session.melodic_evolution.previousPatch=patch;
    assert.equal(restoreMelodicPhrase(song.jam_session.melodic_evolution),null,`${String(patch)} is refused`);
    assert.throws(()=>validateProject(structuredClone(song)),/invalid_project/);
    const reopened=parseProjectJson(JSON.stringify(song));
    assert.equal(reopened.ok,false);assert.equal(reopened.reason,'invalid_project');
  }
});

test('a non-palette last sound cannot break the next phrase',()=>{
  const doc=jamDoc(),context=phraseContext(doc);
  const base={phraseOrdinal:5,sceneId:'reggae-v1',root:context.root,minor:context.minor,bpm:100,seed:23,recentOpenings:[]};
  const pitches=p=>p.events.map(e=>[e.step,e.concrete.midi_pitch,e.duration_sec]);
  for(const patch of [REACHABLE_TODAY,...NEW_WHEEL]) {
    // v2 and v3: the sound handed over never changes the notes or picks a non-palette lead.
    for(const options of [{version:2},{version:3,harmony:context.harmony}]) {
      const after=planMelodicPhrase({...base,...options,previousPatch:patch});
      const plain=planMelodicPhrase({...base,...options,previousPatch:null});
      assert.deepEqual(pitches(after),pitches(plain));
      assert.ok(leadPalette('reggae-v1').includes(after.patch));
      assert.ok(after.events.length&&after.events.every(e=>e.patch_id===after.patch&&Number.isFinite(e.concrete.midi_pitch)));
      assert.equal(after.descriptor.previousPatch,patch);
      assert.deepEqual(restoreMelodicPhrase(JSON.parse(JSON.stringify(after.descriptor))),after);
    }
    // v1: a different last sound is a handoff, which restates the statement in a palette sound.
    const legacy=planMelodicPhrase({...base,version:1,phraseOrdinal:1,previousPatch:patch});
    assert.equal(legacy.variant,'statement');
    assert.ok(leadPalette('reggae-v1').includes(legacy.patch));
    assert.deepEqual(pitches(legacy),pitches(planMelodicPhrase({...base,version:1,phraseOrdinal:0,previousPatch:null})));
    assert.deepEqual(restoreMelodicPhrase(JSON.parse(JSON.stringify(legacy.descriptor))),legacy);
  }
});

test('reopening the jam resumes the saved phrase instead of dropping it',()=>{
  for(const patch of [REACHABLE_TODAY,'sampled_kalimba_v1']) {
    const flow=Object.create(PlayFlow.prototype);
    flow.stage='jam';
    flow.doc=parseProjectJson(exportProjectJson(savedWheelSong(patch))).song;
    const lead=flow._savedMelodicLead();
    assert.ok(lead,`${patch}: the saved phrase resumes`);
    assert.equal(lead.descriptor.previousPatch,patch);
    assert.ok(lead.events.length>0);
  }
});
