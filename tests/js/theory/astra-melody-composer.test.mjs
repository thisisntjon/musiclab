import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMelodyContext,planMelodyCandidate,buildMelodyPalette} from '../../../static/js/theory/melody_composer.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {musicFieldBacking} from '../../../static/js/theory/music_field.js';
const song=()=>({song_id:'source',bpm:100,swing:.6,steps_per_bar:16,total_steps:64,events:[
 ...[0,16,32,48].map((step,i)=>({id:`own-${i}`,role:'lead',step,start_sec:step*.15,duration_steps:3,duration_sec:.45,patch_id:'sampled_piano_v1',velocity:.5,provenance:'user_placed',concrete:{midi_pitch:62+i,freq_hz:440*2**((62+i-69)/12)}})),
 {id:'bass',role:'bass',step:0,duration_steps:2,duration_sec:.3,provenance:'jam_generated',concrete:{midi_pitch:38},patch_id:'sampled_bass_v1'}]});
const reached=(scene='rocksteady-v1',root=2)=>({time:.04,source_song_id:'source',phraseContext:phraseContext({notes:[],global_context:{root_pc:root,scale_type:'natural_minor',bpm:100},jam_session:{scene_id:scene,exploration_map:'catalogue-circle-v2'}})});
test('five explicit reached recipes carry D-minor chord metadata, deep-frozen independent of requested context',()=>{
 for(const id of ['ska-v1','reggae-v1','rocksteady-v1','house-v1','doo-wop-v1']){
  const s=song(),r=reached(id),before=structuredClone({s,r}),c=captureMelodyContext(s,r);
  assert.ok(c);assert.equal(c.root,2);assert.deepEqual(c.harmony.bars.map(b=>b.map(n=>(n+c.root)%12)),[[2,5,9],[2,5,10],[2,7,10],[4,9,0]]);
  assert.ok(Object.isFrozen(c.source.events));assert.deepEqual({s,r},before);
  r.phraseContext.root=9;assert.equal(c.root,2);
 }
});
test('unsupported context falls back instead of inventing harmonic support',()=>{
 for(const r of [null,reached('unknown-v1'),{...reached(),phraseContext:{...reached().phraseContext,mode:{name:'dorian'}}},{...reached(),phraseContext:{...reached().phraseContext,musicField:{version:4,x:.5,y:.5}}}])assert.equal(captureMelodyContext(song(),r),null);
 assert.equal(captureMelodyContext({...song(),steps_per_bar:12,total_steps:48},reached()),null);
 assert.equal(captureMelodyContext(song(),reached(),{customBacking:true}),null);
});
test('actual field5 producer chord tones agree with shared context across endpoints/intermediates, modes and roots',()=>{
 for(const root of [0,2,11])for(const scale of ['major','natural_minor'])for(const x of [0,.25,.5,.75,1]){
  const doc={notes:[],auto_harmony_stabs:false,global_context:{root_pc:root,scale_type:scale,bpm:100},jam_session:{scene_id:x<.25?'ska-v1':x>.75?'reggae-v1':'rocksteady-v1',music_field:{version:5,x,y:.5}}};
  const ctx=phraseContext(doc),backing=musicFieldBacking(doc,doc.jam_session,[]),c=captureMelodyContext(song(),{phraseContext:ctx});assert.ok(c);
  const chords=backing.filter(n=>n.role==='harmony');assert.ok(chords.length);
  for(const n of chords)assert.ok(ctx.harmony.bars[Math.floor(n.step/16)].includes((n.concrete.midi_pitch-root+120)%12));
 }
 const wrong={...reached('house-v1').phraseContext,musicField:{version:5,x:.5,y:.5}};
 assert.equal(captureMelodyContext(song(),{phraseContext:wrong}),null);
});
test('personal contour inspiration is bounded and source-linked without changing source gates',()=>{
 const s=song();s.events.filter(n=>n.role==='lead').forEach((n,i)=>{n.concrete.midi_pitch=[30,100,20,90][i];});
 const before=structuredClone(s),c=captureMelodyContext(s,reached());
 assert.deepEqual(c.inspiration.contour,[0,5,-5,5]);assert.deepEqual(c.inspiration.sourceIds,['own-0','own-1','own-2','own-3']);
 const p=planMelodyCandidate(c,{x:0,y:1});
 for(const n of p.notes.filter(n=>n.generated_by==='musiclab_phrase_composer')){
  assert.deepEqual(n.derivation.source_ids,c.inspiration.sourceIds);
  assert.ok(n.concrete.midi_pitch>=c.register[0]&&n.concrete.midi_pitch<=c.register[1]);
 }
 assert.deepEqual(s,before);assert.deepEqual(planMelodyCandidate(c,{x:0,y:0}).notes,s.events);
});
test('full palette preserves source/original/band and all generated notes fit their local bar chord',()=>{
 const s=song(),before=structuredClone(s),c=captureMelodyContext(s,reached()),plans=buildMelodyPalette(c);
 assert.equal(Object.keys(plans).length,97);assert.deepEqual(plans.original.notes,s.events);
 for(const plan of Object.values(plans)){
  assert.deepEqual(plan.notes.filter(n=>n.role!=='lead'),s.events.filter(n=>n.role!=='lead'));
  assert.equal(new Set(plan.notes.map(n=>n.id)).size,plan.notes.length);
  for(const n of plan.notes.filter(n=>n.generated_by==='musiclab_phrase_composer')){
   const bar=Math.floor(n.step/16);assert.ok(c.harmony.bars[bar].includes((n.concrete.midi_pitch-c.root+12)%12));
   assert.ok(n.duration_steps>0&&n.step+n.performance.offset_steps+n.duration_steps<=(bar+1)*16);
   assert.ok(Math.abs(n.duration_sec-n.duration_steps*.15)<1e-9);assert.ok(Math.abs(n.start_sec-(n.step+n.performance.offset_steps)*.15)<1e-9);
   assert.equal(n.provenance,'jam_generated');assert.deepEqual(n.derivation.source_ids,['own-0','own-1','own-2','own-3']);
  }
 }
 assert.deepEqual(s,before);
});
test('all six full departures are deterministic complete phrases with chord cadence',()=>{
 const c=captureMelodyContext(song(),reached());
 for(let i=0;i<6;i++){
  const p={x:Math.sin(i*Math.PI/3),y:Math.cos(i*Math.PI/3)},a=planMelodyCandidate(c,p);
  assert.deepEqual(planMelodyCandidate(c,p),a);
  const lead=a.notes.filter(n=>n.role==='lead');
  for(let b=0;b<4;b++)assert.ok(lead.some(n=>Math.floor(n.step/16)===b));
  assert.equal(lead.at(-1).concrete.midi_pitch%12,9);
 }
});
test('retained source hold suppresses generated overlap into neighboring changed bar',()=>{
 const s=song();s.events[0].duration_steps=24;s.events[0].duration_sec=3.6;
 const c=captureMelodyContext(s,reached()),p=planMelodyCandidate(c,{x:0,y:.5});
 assert.deepEqual(p.notes.find(n=>n.id==='own-0'),s.events[0]);
 for(const n of p.notes.filter(n=>n.generated_by==='musiclab_phrase_composer'))assert.ok(n.step+n.performance.offset_steps>=24);
});
test('actual scheduler reached selector excludes queued future harmonic context',()=>{
 const scheduler=new LookaheadScheduler();scheduler.isPlaying=true;scheduler.audioCtx={currentTime:8};
 const earlier=reached('rocksteady-v1',2),future={...reached('house-v1',9),time:16.04};
 scheduler.jamBackingTimeline=[earlier,future];scheduler.pendingPhraseContext=future.phraseContext;
 const c=captureMelodyContext(song(),scheduler.activeJamBacking());assert.equal(c.sceneId,'rocksteady-v1');assert.equal(c.root,2);
 scheduler.audioCtx.currentTime=16.04;
 const next=captureMelodyContext(song(),scheduler.activeJamBacking());assert.equal(next.sceneId,'house-v1');assert.equal(next.root,9);
 assert.equal(c.root,2,'pinned candidate context must not follow later clock changes');
});
