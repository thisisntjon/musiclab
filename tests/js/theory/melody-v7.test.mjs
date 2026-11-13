import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMelodyPalette as build} from '../../../static/js/theory/melody_composer_v7.js';
import {buildMelodyPalette as baseline} from '../../../static/js/theory/melody_composer_v6.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {VOCABULARY_VERSION} from '../../../static/js/theory/melody_phrase_library_v1.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
for(const sceneId of ['house-v1','reggae-v1','soul-v1'])test(`${sceneId}: radial identity, motif, backing, deterministic persistence`,()=>{
 const events=[60,64,67,72].map((p,i)=>({id:`n${i}`,role:'lead',step:i*16,duration_steps:3,velocity:.6,patch_id:'electric_piano',provenance:'jam_generated',concrete:{midi_pitch:p}}));
 events.push({id:'mine',role:'lead',step:10,duration_steps:21,velocity:.7,patch_id:'electric_piano',provenance:'user_placed',concrete:{midi_pitch:60}});
 events.push({id:'bass',role:'bass',step:0,duration_steps:16,velocity:.4,patch_id:'sine_bass',provenance:'jam_generated',concrete:{midi_pitch:36}});
 const song={song_id:'fixed',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events};
 const doc={id:'fixed',global_context:{root_pc:0,scale_type:'major'},jam_session:{scene_id:sceneId}};
 const ctx={...captureMelodyContext(song,{phraseContext:phraseContext(doc)}),composerVersion:7,vocabularyVersion:VOCABULARY_VERSION};
 const snapshot=structuredClone(ctx),before=baseline(ctx),plans=build(ctx);
 assert.deepEqual(plans.original.notes,events);
 for(const [key,plan] of Object.entries(plans)){
  if(key==='original')continue;
  const old=before[key];
  for(const note of plan.notes){
   const was=old.notes.find(n=>n.id===note.id.replace('phrase-v7-','phrase-v6-'));
   assert.ok(was);
   assert.equal(note.step,was.step);assert.deepEqual(note.concrete,was.concrete);
   assert.equal(note.velocity,was.velocity);
   if(note.derivation?.motif_anchor)assert.equal(note.duration_steps,was.duration_steps);
   assert.ok(note.duration_steps<=was.duration_steps);
  }
 }
 assert.deepEqual(baseline(ctx),before,'V7 must not mutate cached/shared V6 results');
 for(let t=0;t<24;t++){
  const radial=[1,2,3,4].map(r=>plans[`${t}:${r}`]);
  assert.equal(new Set(radial.map(p=>p.phraseId)).size,1);
  const anchors=p=>p.notes.filter(n=>n.derivation?.motif_anchor).map(n=>[n.step,n.performance.offset_steps,n.concrete.midi_pitch]);
  assert.equal(anchors(radial[0]).length,4);
  radial.forEach(p=>{assert.deepEqual(anchors(p),anchors(radial[0]));assert.deepEqual(p.notes.filter(n=>n.role!=='lead'),events.filter(n=>n.role!=='lead'));});
  const signatures = radial.map(p=>JSON.stringify(p.notes.map(n=>[n.step,n.duration_steps,n.concrete.midi_pitch])));
  assert.ok(new Set(signatures).size===4);
 }
 for(let r=1;r<=4;r++)for(let t=0;t<24;t++){
  const signature=n=>JSON.stringify([n.step,n.performance?.offset_steps,n.duration_steps,n.concrete.midi_pitch]);
  const left=plans[`${t}:${r}`].notes.filter(n=>n.role==='lead'),right=plans[`${(t+1)%24}:${r}`].notes.filter(n=>n.role==='lead');
  const keys=new Set(left.map(signature));assert.ok(right.some(n=>keys.has(signature(n))),`seam ${t}->${(t+1)%24} ring${r} loses all material`);
  assert.ok(left.every(n=>n.duration_steps>0));
 }
 assert.deepEqual(ctx,snapshot);assert.deepEqual(build(JSON.parse(JSON.stringify(ctx))),plans);
});
