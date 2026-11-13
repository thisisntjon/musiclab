import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMelodyContext,planMelodyCandidate,buildMelodyPalette,melodyChoice,BENCH_DIRECTIONS} from '../../../static/js/theory/melody_composer_v2.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';

// Sanity properties for the phrase-form composer. These catch regressions; they are not
// listening acceptance, which is measured on the melody bench.
const lead=(step,m,i,prov='user_placed')=>({id:`own-${i}`,role:'lead',step,start_sec:step*.125,duration_steps:2,duration_sec:.25,patch_id:'p',velocity:.5,provenance:prov,concrete:{midi_pitch:m}});
const SOURCES={
  tune:[[0,60],[4,62],[6,64],[8,67],[16,65],[20,64],[24,62],[32,64],[40,67],[48,62]],
  four:[[0,62],[16,63],[32,64],[48,65]],
  single:[[0,64]],
};
const song=notes=>({song_id:'s',bpm:120,swing:.58,steps_per_bar:16,total_steps:64,events:[
  ...notes.map(([s,m],i)=>lead(s,m,i)),
  {id:'bass',role:'bass',step:0,duration_steps:2,duration_sec:.25,provenance:'jam_generated',concrete:{midi_pitch:36},patch_id:'b'}]});
const ctxFor=(src='tune',scene='house-v1',root=0,scale='major')=>captureMelodyContext(song(SOURCES[src]),
  {phraseContext:phraseContext({notes:[],global_context:{root_pc:root,scale_type:scale,bpm:120},jam_session:{scene_id:scene,exploration_map:'catalogue-circle-v2'}})});
const at=(deg,r)=>({x:Math.sin(deg*Math.PI/180)*r,y:Math.cos(deg*Math.PI/180)*r});
const leadOf=plan=>plan.notes.filter(n=>n.role==='lead').sort((a,b)=>a.step-b.step);
const start=n=>n.step+(n.performance?.offset_steps||0);
const chord=(ctx,bar)=>ctx.harmony.bars[bar].map(pc=>(pc+ctx.root)%12);
const contexts=()=>{const out=[];for(const src of Object.keys(SOURCES))for(const scene of ['house-v1','doo-wop-v1','rocksteady-v1','reggae-v1'])for(const [root,scale] of [[0,'major'],[2,'natural_minor'],[9,'major']])out.push(ctxFor(src,scene,root,scale));return out;};
const everyPlan=(fn)=>{for(const ctx of contexts()){assert.ok(ctx);for(const [key,plan] of Object.entries(buildMelodyPalette(ctx)))if(key!=='original')fn(ctx,plan,key);}};

test('centre is the exact original and the band is untouched everywhere',()=>{
  const ctx=ctxFor();const src=ctx.source.events;
  assert.deepEqual(planMelodyCandidate(ctx,{x:0,y:0}).notes,structuredClone(src));
  everyPlan((c,plan)=>assert.deepEqual(plan.notes.filter(n=>n.role!=='lead'),c.source.events.filter(n=>n.role!=='lead')));
});

test('same position gives the same phrase; ids are unique and values finite',()=>{
  const ctx=ctxFor();
  for(const deg of [0,37,90,181,270])assert.deepEqual(planMelodyCandidate(ctx,at(deg,.8)),planMelodyCandidate(ctx,at(deg,.8)));
  everyPlan((c,plan)=>{const l=leadOf(plan);assert.ok(l.length>=3);assert.equal(new Set(l.map(n=>n.id)).size,l.length);
    for(const n of l){for(const v of [n.step,n.duration_steps,n.velocity,n.concrete.midi_pitch])assert.ok(Number.isFinite(v));
      assert.ok(n.concrete.midi_pitch>=c.register[0]&&n.concrete.midi_pitch<=c.register[1]);assert.ok(n.step>=0&&n.step<64&&n.duration_steps>0);}});
});

test('one voice: generated lead notes never overlap and stay inside the loop',()=>{
  everyPlan((c,plan)=>{const l=leadOf(plan);
    l.forEach((n,i)=>{const next=l[i+1];if(next)assert.ok(start(n)+n.duration_steps<=start(next)+1e-9,`${plan.choice.key} overlap at ${n.step}`);
      assert.ok(start(n)+n.duration_steps<=64+1e-9);});});
});

test('strong beats and the cadence sit on the bar\'s chord; notes off the chord resolve by step',()=>{
  everyPlan((c,plan)=>{const l=leadOf(plan);
    l.forEach((n,i)=>{const bar=Math.floor(n.step/16),pc=n.concrete.midi_pitch%12,tones=chord(c,bar);
      if(n.step%8===0)assert.ok(tones.includes(pc),`${plan.choice.key} strong beat ${n.step}`);
      if(!tones.includes(pc)){const next=l[i+1];assert.ok(next&&next.step-n.step<=4&&Math.abs(next.concrete.midi_pitch-n.concrete.midi_pitch)<=2&&next.concrete.midi_pitch!==n.concrete.midi_pitch,`${plan.choice.key} unresolved ${n.step}`);}});
    const last=l.at(-1);assert.equal(Math.floor(last.step/16),3);assert.ok(chord(c,3).includes(last.concrete.midi_pitch%12));});
});

test('a memorable hook restates its motif rhythm in at least three of four bars',()=>{
  for(const ctx of contexts()){const l=leadOf(planMelodyCandidate(ctx,at(BENCH_DIRECTIONS.hook,1)));
    const bars=[0,1,2,3].map(b=>l.filter(n=>Math.floor(n.step/16)===b).map(n=>n.step%16).join(','));
    assert.ok(bars.filter(b=>bars[0].split(',').every(o=>b.split(',').includes(o))).length>=3,bars.join(' | '));}
});

test('directions differ in density: space < hook < flowing, and space thins as you move out',()=>{
  for(const ctx of contexts()){
    const n=(d,r=1)=>leadOf(planMelodyCandidate(ctx,at(BENCH_DIRECTIONS[d],r))).length;
    assert.ok(n('space')<n('hook')&&n('hook')<n('flowing'),`space ${n('space')} hook ${n('hook')} flowing ${n('flowing')}`);
    assert.ok(n('space',1)<=n('space',.5),`space far ${n('space',1)} half ${n('space',.5)}`);
  }
});

test('mostly stepwise overall (55-80% of moves within two semitones), flowing smoothest',()=>{
  let steps=0,moves=0;const ratio=(ctx,d)=>{const l=leadOf(planMelodyCandidate(ctx,at(BENCH_DIRECTIONS[d],1)));let s=0;for(let i=1;i<l.length;i++)if(Math.abs(l[i].concrete.midi_pitch-l[i-1].concrete.midi_pitch)<=2)s++;return s/(l.length-1);};
  everyPlan((c,plan)=>{const l=leadOf(plan);for(let i=1;i<l.length;i++){moves++;if(Math.abs(l[i].concrete.midi_pitch-l[i-1].concrete.midi_pitch)<=2)steps++;}});
  assert.ok(steps/moves>=.55&&steps/moves<=.8,`step ratio ${(steps/moves).toFixed(2)}`);
  const ctx=ctxFor();assert.ok(ratio(ctx,'flowing')>ratio(ctx,'playful'));
});

test('nearby moves stay related; different directions are different ideas',()=>{
  const dist=(a,b)=>{const x=leadOf(a).map(n=>`${n.step}:${n.concrete.midi_pitch}`),y=new Set(leadOf(b).map(n=>`${n.step}:${n.concrete.midi_pitch}`));return 1-x.filter(k=>y.has(k)).length/Math.max(x.length,y.size);};
  for(const ctx of contexts()){
    const dirs=Object.entries(BENCH_DIRECTIONS);
    for(const [d,deg] of dirs){
      const near=dist(planMelodyCandidate(ctx,at(deg,.75)),planMelodyCandidate(ctx,at(deg+15,.75)));
      for(const [e,deg2] of dirs)if(e!==d)assert.ok(near<dist(planMelodyCandidate(ctx,at(deg,1)),planMelodyCandidate(ctx,at(deg2,1))),`${d} near ${near.toFixed(2)} vs ${e}`);
    }
  }
});

test('wheel labels name the direction and how much',()=>{
  assert.equal(melodyChoice({x:0,y:0}).label,'Your tune');
  assert.equal(melodyChoice(at(0,1)).label,'Memorable hook, all the way');
  assert.equal(melodyChoice(at(90,.25)).label,'More flowing, a little');
  assert.equal(melodyChoice(at(270,.5)).label,'More space, more');
});
