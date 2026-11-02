import test from 'node:test';
import assert from 'node:assert/strict';
import {quieterBandComparison} from '../../../static/js/theory/part_comparison.js';
import {startJam} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
test('comparison preserves originals and personal held notes; only selected part changes',()=>{
  const song=startJam(newPlayDoc(),{patchId:'warm_keys'});
  song.notes.push({id:'own',step:2,role:'bass',patch_id:'clean_bass',velocity:.7,
    duration_steps:5.3,performance:{version:1,offset_steps:.2,hold_id:'held'},
    concrete:{midi_pitch:40},provenance:'user_placed'});
  song.song_cards=[{bars:4},{bars:4}];
  const original=structuredClone(song), result=quieterBandComparison(song,1);
  assert.deepEqual(song,original);assert.deepEqual(result.before,original);
  assert.ok(result.changed>0);assert.equal(result.after.song_cards[0].material,undefined);
  assert.deepEqual(result.after.notes,original.notes);
  assert.deepEqual(result.after.song_cards[1].material.notes.find(n=>n.id==='own'),original.notes.at(-1));
  const reopened=parseProjectJson(exportProjectJson(result.after));
  assert.equal(reopened.ok,true);
  assert.deepEqual(reopened.song.song_cards,result.after.song_cards);
  assert.deepEqual(compileSongStandalone(reopened.song).events,compileSongStandalone(result.after).events);
});
test('muted backing and unknown provenance are untouched',()=>{
  const song=startJam(newPlayDoc(),{patchId:'warm_keys'});
  song.song_cards=[{bars:4,beat:false,under:false}];
  assert.equal(quieterBandComparison(song,0).changed,0);
  song.song_cards=[{bars:4}];song.notes.forEach(n=>delete n.provenance);
  assert.equal(quieterBandComparison(song,0).changed,0);
  assert.throws(()=>quieterBandComparison(song,2));
});
