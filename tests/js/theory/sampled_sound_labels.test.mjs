import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLED_SOUND_LABELS,sampledSoundLabel} from '../../../static/js/theory/sampled_sound_labels.js';
import {SAMPLED_PROGRAMS} from '../../../static/js/theory/sampled_sound_capabilities.js';
import {getInstrument} from '../../../static/js/theory/instrument_catalogue.js';
import {LEAD_SOUNDS} from '../../../static/js/theory/tune_model.js';
import {startJam} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';

// The 18 sounds added for the Sound wheel (13 Nov 2026) and the names a band row shows for them.
const NEW_WHEEL={
  sampled_accordion_v1:'Accordion',sampled_music_box_v1:'Music box',sampled_marimba_v1:'Marimba',
  sampled_vibraphone_v1:'Vibraphone',sampled_steel_drums_v1:'Steel pan',sampled_kalimba_v1:'Kalimba',
  sampled_koto_v1:'Koto',sampled_harp_v1:'Harp',sampled_pizzicato_v1:'Plucked strings',
  sampled_solo_vox_v1:'Solo voice',sampled_synth_voice_v1:'Space voice',sampled_recorder_v1:'Recorder',
  sampled_pan_flute_v1:'Pan flute',sampled_ocarina_v1:'Ocarina',sampled_trombone_v1:'Trombone',
  sampled_square_lead_v1:'Game synth',sampled_saw_lead_v1:'Buzzy synth',sampled_synth_brass_v1:'Brassy synth',
};
// Bass flute (13 Nov 2026): the bank's Flute an octave down, a wheel-only sound like the 18 above.
const BASS_FLUTE={sampled_bass_flute_v1:'Bass flute'};

test('every sampled patch has exactly one plain name, and nothing else does',()=>{
  assert.deepEqual(Object.keys(SAMPLED_SOUND_LABELS).sort(),Object.keys(SAMPLED_PROGRAMS).sort());
  assert.equal(Object.keys(SAMPLED_SOUND_LABELS).length,36);
  assert.ok(Object.isFrozen(SAMPLED_SOUND_LABELS));
  const names=Object.values(SAMPLED_SOUND_LABELS);
  assert.equal(new Set(names.map(n=>n.toLowerCase())).size,names.length,'two sounds never share a name');
  for(const [patch,name] of Object.entries(SAMPLED_SOUND_LABELS)) {
    assert.equal(sampledSoundLabel(patch),name);
    assert.match(name,/^[A-Z][a-z]+( [a-z]+)?$/,`${patch}: short plain words, sentence case`);
    assert.doesNotMatch(name,/sampled|_|\bv1\b/i,`${patch}: never a raw patch ID`);
  }
  for(const [patch,name] of Object.entries({...NEW_WHEEL,...BASS_FLUTE}))assert.equal(sampledSoundLabel(patch),name);
  // The lead renamed the wheel's Strings sound so the group and the sound differ.
  assert.equal(sampledSoundLabel('sampled_strings_v1'),'Violins');
});

test('unknown, dropped, native and prototype names get no sampled label',()=>{
  for(const patch of ['sampled_fiddle_v1','sampled_tuba_v1','sampled_kalimba_v2','pluck_lead','warm_keys','kick',
    'toString','__proto__','constructor','',null,undefined,42,{}])
    assert.equal(sampledSoundLabel(patch),null);
});

test('a name never makes a wheel-only sound choosable in jam or tune pickers',()=>{
  const pickers=new Set(LEAD_SOUNDS.map(s=>s.id));
  for(const patch of Object.keys({...NEW_WHEEL,...BASS_FLUTE})) {
    assert.equal(getInstrument(patch),null,`${patch} stays out of the instrument catalogue`);
    assert.equal(pickers.has(patch),false,`${patch} stays out of the tune picker`);
    const doc=startJam(newPlayDoc(),{kind:'pitched',patchId:patch});
    assert.notEqual(doc.jam_session.patchId,patch,`${patch} is not accepted as a jam instrument`);
    assert.notEqual(doc.lead_patch_id,patch);
  }
});
