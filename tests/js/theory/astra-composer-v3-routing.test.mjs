import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
import {captureMelodyContext,buildMelodyPalette as v1} from '../../../static/js/theory/melody_composer.js';
import {buildMelodyPalette as v2} from '../../../static/js/theory/melody_composer_v2.js';
import {buildMelodyPalette as v3} from '../../../static/js/theory/melody_composer_v3.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';

const song={song_id:'v3-routing',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,
 events:[0,4,8].map((step,i)=>({id:`personal-${i}`,step,duration_steps:i===2?20.8114:2,
 duration_sec:(i===2?20.8114:2)*.15,role:'lead',patch_id:'sampled_piano_v1',provenance:'user_placed',
 performance:{version:1,offset_steps:.271},velocity:.6,concrete:{midi_pitch:60+i*2}}))};
const context=()=>captureMelodyContext(song,{phraseContext:{sceneId:'house-v1',root:0,
 harmony:{version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7}}});
const create=ctx=>new MelodyFieldSession(song,{scheduler:{isPlaying:false},sourceDoc:{id:song.song_id,global_context:{}},captureOrigin:0,phraseContext:ctx});

test('actual worker dispatch preserves all three composer versions and rejects unknown versions',async()=>{
 const prior=globalThis.self,out=[];globalThis.self={postMessage:value=>out.push(value)};
 try {
  await import('../../../static/ui/melody_composer_worker.js');
  for(const [version,planner] of [[1,v1],[2,v2],[3,v3]]){
   const c={...context(),composerVersion:version};globalThis.self.onmessage({data:c});
   const actual=out.pop();assert.equal(actual.error,undefined);assert.deepEqual(actual.plans,planner(c));
  }
  const c=context();globalThis.self.onmessage({data:c});assert.deepEqual(out.pop().plans,v1(c));
  globalThis.self.onmessage({data:{...c,composerVersion:99}});assert.match(out.pop().error,/version/);
 }finally{globalThis.self=prior;}
});
test('v1/v2/v3 keep and JSON reopen preserve explicit routing and exact personal original',()=>{
 for(const [version,planner] of [[1,v1],[2,v2],[3,v3]]){
  const ctx={...context(),composerVersion:version},original={id:song.song_id,global_context:{},notes:structuredClone(song.events)};
  const sourceBefore=structuredClone(original),palette=planner(ctx),chosen=palette['6:4'];
  const doc=selectedMelody(original,{...song,events:chosen.notes},{context:ctx,choice:chosen.choice,performanceArchive:original});
  const reopened=JSON.parse(JSON.stringify(doc));assert.equal(reopened.capture_notes.melody_field.context.composerVersion,version);
  assert.deepEqual(reopened.melody_original,sourceBefore);assert.deepEqual(reopened.capture_source,sourceBefore);assert.deepEqual(original,sourceBefore);
  const session=create({...reopened.capture_notes.melody_field.context,source:song});
  assert.equal(session.composerVersion,version);session.palette=palette;session.candidates.clear();
  assert.deepEqual(session._candidate({x:1,y:0}).song.events,chosen.notes);
  assert.deepEqual(palette.original.notes,ctx.source.events);
  assert.equal(session.melodyFamilies.length,version===1?6:4);
 }
 assert.equal(create(context()).composerVersion,1);
 assert.throws(()=>create({...context(),composerVersion:99}),/newer version/);
});
test('v3 accessible wheel and four labels use matching right-angle geometry',()=>{
 const c={...context(),composerVersion:3},session=create(c);session.palette=v3(c);session.candidates.clear();
 const html=session.html();assert.equal((html.match(/class="pf-mf-label pf-mf-region"/g)||[]).length,4);
 assert.ok(html.includes('left:86%;top:50%'));
 for(const label of session.melodyFamilies)assert.ok(html.includes(label));
 assert.ok(html.includes('data-composer-version="3"'));
 assert.ok(session.chooseMelody({x:1,y:0}).label.includes(session.melodyFamilies[1]));
});
