import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMelodyPalette,phraseBreath,rhythmicReturn,SUPPORTED_SCENES,melodyChoice} from '../../../static/js/theory/melody_composer_v9.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {VOCABULARY_VERSION} from '../../../static/js/theory/melody_phrase_library_v1.js';
const at=n=>n.step+(n.performance?.offset_steps||0);
const lead=p=>p.notes.filter(n=>n.role==='lead').sort((a,b)=>at(a)-at(b));
const music=n=>[at(n),n.duration_steps,n.concrete?.midi_pitch,n.velocity,n.patch_id];
const leap=p=>Math.max(0,...lead(p).slice(1).map((n,i)=>Math.abs(n.concrete.midi_pitch-lead(p)[i].concrete.midi_pitch)));
function context(sceneId,root,swing){
 const events=[60,64,67,72].map((pitch,i)=>({id:`original-${i}`,role:'lead',step:i*16,duration_steps:3,velocity:.6,patch_id:'electric_piano',provenance:'jam_generated',concrete:{midi_pitch:pitch}}));
 events.push({id:'personal-held',role:'lead',step:10,duration_steps:21.271,performance:{version:1,offset_steps:.273},velocity:.71,patch_id:'electric_piano',provenance:'user_placed',concrete:{midi_pitch:60}});
 events.push({id:'personal-backing',role:'harmony',step:20,duration_steps:20,velocity:.4,patch_id:'electric_piano',provenance:'user_placed',generated_by:'musiclab_phrase_composer_v7',derivation:{motif_anchor:true},concrete:{midi_pitch:36}});
 const song={song_id:'v9-test',bpm:110,swing,total_steps:64,steps_per_bar:16,events};
 const doc={id:'v9-test',global_context:{root_pc:root,scale_type:root===9?'minor':'major'},jam_session:{scene_id:sceneId}};
 return {...captureMelodyContext(song,{phraseContext:phraseContext(doc)}),composerVersion:9,vocabularyVersion:VOCABULARY_VERSION};
}
for(const scene of SUPPORTED_SCENES)for(const root of [0,9])for(const swing of [.5,.68])test(`${scene}/${root}/${swing}: developed phrase, fixed anchors and ending, exact source`,()=>{
 const ctx=context(scene,root,swing),snapshot=structuredClone(ctx),plans=buildMelodyPalette(ctx);
 assert.deepEqual(plans.original.notes,ctx.source.events);
 for(let turn=0;turn<24;turn++){
  const theme=plans[`${turn}:2`],breath=plans[`${turn}:3`],answer=plans[`${turn}:4`];
  for(const p of [breath,answer]){
   assert.equal(p.development.applied,true,`${turn} ${p.development.reason}`);
   assert.deepEqual(p.notes.filter(n=>n.role!=='lead'),ctx.source.events.filter(n=>n.role!=='lead'));
   assert.deepEqual(lead(p).filter(n=>n.derivation?.motif_anchor).map(music),lead(theme).filter(n=>n.derivation?.motif_anchor).map(music));
   assert.deepEqual(lead(p).filter(n=>at(n)>=48).map(music),lead(theme).filter(n=>at(n)>=48).map(music));
   assert.notDeepEqual(lead(p).map(music),lead(theme).map(music));
   assert.ok(leap(p)<=Math.max(12,leap(theme)),`new leap ${turn}`);
   assert.equal(new Set(p.notes.map(n=>n.id)).size,p.notes.length);
   const ns=lead(p);for(let i=0;i<ns.length;i++){
    const n=ns[i],end=at(n)+n.duration_steps;
    assert.ok(Number.isFinite(end)&&n.duration_steps>=.25&&end<=64);
    if(i)assert.ok(at(ns[i-1])+ns[i-1].duration_steps<=at(n)+1e-6,'overlap');
    for(let bar=Math.floor(at(n)/16);bar<=Math.floor((end-1e-6)/16);bar++)assert.ok(ctx.harmony.bars[bar].some(pc=>(pc+root)%12===n.concrete.midi_pitch%12),'harmony');
   }
  }
  assert.ok(lead(breath).every(n=>at(n)>=48||at(n)+n.duration_steps<=44),'audible gap');
  assert.equal(new Set([1,2,3,4].map(r=>JSON.stringify(lead(plans[`${turn}:${r}`]).map(music)))).size,4);
 }
 assert.deepEqual(ctx,snapshot);assert.deepEqual(buildMelodyPalette(JSON.parse(JSON.stringify(ctx))),plans);
});
test('breathing never shortens protected crossing notes; return keeps personal input',()=>{
 const ctx=context('ska-v1',0,.5),plans=buildMelodyPalette(ctx);
 // Treatment helpers operate on the old-version generated Theme, as the builder does.
 const theme=structuredClone(plans['0:2']);for(const n of theme.notes)if(n.role==='lead')n.generated_by='musiclab_phrase_composer_v8';
 for(const provenance of ['user_placed','jam_generated']){
  const p=structuredClone(theme),held={...p.notes.find(n=>n.role==='lead'),id:'protected',step:42,duration_steps:9,performance:{offset_steps:0},provenance,derivation:{motif_anchor:true}};
  p.notes.push(held);const before=structuredClone(p),result=phraseBreath(ctx,p);
  assert.equal(result.applied,false);assert.deepEqual(result.plan,before);assert.deepEqual(p,before);
 }
 const p=structuredClone(theme),mine={...p.notes.find(n=>n.role==='lead'),id:'my-extra',step:39,duration_steps:2,provenance:'user_placed'};p.notes.push(mine);
 assert.deepEqual(rhythmicReturn(ctx,p).plan.notes.find(n=>n.id===mine.id),mine);
});
test('V9 names actual radial behavior and rejects unsupported scenes',()=>{
 assert.match(melodyChoice({x:0,y:.75}).label,/Breathe/);assert.match(melodyChoice({x:0,y:1}).label,/Return/);
 assert.throws(()=>buildMelodyPalette(context('blues-v1',0,.5)),/not ready/);
});
