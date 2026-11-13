import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMelodyPalette as build} from '../../../static/js/theory/melody_composer_v8.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {VOCABULARY_VERSION} from '../../../static/js/theory/melody_phrase_library_v1.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
for(const sceneId of ['ska-v1','rocksteady-v1','swing-v1'])for(const swing of [.5,1])test(`${sceneId} swing ${swing}: radial identity, motif, backing, deterministic persistence`,()=>{
 const events=[60,64,67,72].map((p,i)=>({id:`n${i}`,role:'lead',step:i*16,duration_steps:3,velocity:.6,patch_id:'electric_piano',provenance:'jam_generated',concrete:{midi_pitch:p}}));
 events.push({id:'mine',role:'lead',step:10,duration_steps:21,velocity:.7,patch_id:'electric_piano',provenance:'user_placed',concrete:{midi_pitch:60}});
 events.push({id:'bass',role:'bass',step:0,duration_steps:16,velocity:.4,patch_id:'sine_bass',provenance:'jam_generated',concrete:{midi_pitch:36}});
 events.push({id:'retained-backing',role:'harmony',step:32,duration_steps:20,velocity:.3,patch_id:'electric_piano',provenance:'user_placed',generated_by:'musiclab_phrase_composer_v7',derivation:{motif_anchor:true},concrete:{midi_pitch:60}});
 const song={song_id:'fixed',bpm:100,swing,total_steps:64,steps_per_bar:16,events};
 const doc={id:'fixed',global_context:{root_pc:0,scale_type:'major'},jam_session:{scene_id:sceneId}};
 const ctx={...captureMelodyContext(song,{phraseContext:phraseContext(doc)}),composerVersion:8,vocabularyVersion:VOCABULARY_VERSION};
 const snapshot=structuredClone(ctx),plans=build(ctx);
 assert.deepEqual(plans.original.notes,events);
 for(let t=0;t<24;t++){
  const radial=[1,2,3,4].map(r=>plans[`${t}:${r}`]);
  assert.equal(new Set(radial.map(p=>p.phraseId)).size,1);
  const anchors=p=>p.notes.filter(n=>n.role==='lead'&&n.derivation?.motif_anchor).map(n=>[n.step,n.performance.offset_steps,n.concrete.midi_pitch,n.duration_steps]);
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


test('saved V6/V7 palettes stay byte-identical to pre-V8 candidate', async () => {
 const {readFileSync} = await import('node:fs');
 const {createHash} = await import('node:crypto');
 const old6 = await import('../../../static/js/theory/melody_composer_v6.js');
 const old7 = await import('../../../static/js/theory/melody_composer_v7.js');
 const fixture = JSON.parse(readFileSync(new URL('../../fixtures/melody-v6-v7-before-v8.json', import.meta.url)));
 for (const {context,sha256} of fixture.fixtures) {
  const plans = (context.composerVersion === 6 ? old6 : old7).buildMelodyPalette(context);
  assert.equal(createHash('sha256').update(JSON.stringify(plans)).digest('hex'),sha256);
 }
 assert.deepEqual([...old6.SUPPORTED_SCENES], ['house-v1','reggae-v1','soul-v1']);
 assert.deepEqual([...old7.SUPPORTED_SCENES], ['house-v1','reggae-v1','soul-v1']);
});
