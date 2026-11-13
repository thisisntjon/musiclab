import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMelodyContext,buildMelodyPalette} from '../../../static/js/theory/melody_composer_v2.js';
const reached={phraseContext:{sceneId:'house-v1',root:0,harmony:{version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7}}};
test('late-entry personal motifs produce complete palettes without altering originals or holds',()=>{
 for(const offsets of [[8],[10,12,14],[15],[24,28,30]]) {
  const song={bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:offsets.map((step,i)=>({id:`personal-${i}`,role:'lead',step,duration_steps:18.75,duration_sec:2.8125,patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:60+i*2}}))};
  const before=structuredClone(song),context=captureMelodyContext(song,reached),plans=buildMelodyPalette(context);
  assert.equal(Object.keys(plans).length,97);assert.deepEqual(song,before);assert.deepEqual(plans.original.notes,before.events);
  for(const [key,p] of Object.entries(plans))if(key!=='original'){
   const notes=p.notes.filter(n=>n.role==='lead');assert.ok(notes.length);
   assert.equal(new Set(notes.map(n=>n.id)).size,notes.length);
   for(const n of notes){assert.ok(Number.isFinite(n.concrete.midi_pitch));assert.ok(n.duration_steps>0);assert.ok(n.step>=0&&n.step+n.duration_steps<=64+.00001);assert.equal(n.provenance,'jam_generated');}
  }
 }
});
