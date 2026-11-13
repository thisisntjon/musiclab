import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
import {captureMelodyContext,buildMelodyPalette as v1} from '../../../static/js/theory/melody_composer.js';
import {buildMelodyPalette as v2} from '../../../static/js/theory/melody_composer_v2.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
const song={song_id:'routing',bpm:100,swing:.5,steps_per_bar:16,total_steps:64,events:[0,4,8].map((step,i)=>({id:`own-${i}`,role:'lead',step,duration_steps:2,duration_sec:.3,provenance:'user_placed',patch_id:'sampled_piano_v1',concrete:{midi_pitch:60+i*2}}))};
const context=()=>captureMelodyContext(song,{phraseContext:{sceneId:'house-v1',root:0,harmony:{version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7}}});
const session=ctx=>new MelodyFieldSession(song,{scheduler:{isPlaying:false},sourceDoc:{id:'routing',global_context:{}},captureOrigin:0,phraseContext:ctx});

test('versioned worker generates matching v1/v2 palettes and rejects unknown versions',async()=>{
 const old=globalThis.self,out=[];globalThis.self={postMessage:value=>out.push(value)};
 try {
  await import('../../../static/ui/melody_composer_worker.js');
  const legacy=context();globalThis.self.onmessage({data:legacy});assert.deepEqual(out.pop().plans,v1(legacy));
  const next={...context(),composerVersion:2};globalThis.self.onmessage({data:next});assert.deepEqual(out.pop().plans,v2(next));
  globalThis.self.onmessage({data:{...context(),composerVersion:77}});assert.match(out.pop().error,/version/);
 }finally{globalThis.self=old;}
});
test('four-direction session has matching geometry, choices and accessible names',()=>{
 const ctx={...context(),composerVersion:2},f=session(ctx);f.palette=v2(ctx);f.candidates.clear();
 assert.equal(f.composerVersion,2);assert.equal(f.melodyFamilies.length,4);
 const html=f.html();assert.equal((html.match(/class="pf-mf-label pf-mf-region"/g)||[]).length,4);
 for(const label of ['Memorable hook','More flowing','More playful','More space'])assert.ok(html.includes(label));
 assert.ok(html.includes('left:86%;top:50%'));
 assert.ok(f.chooseMelody({x:1,y:0}).label.startsWith('More flowing'));
 assert.deepEqual(f._candidate({x:1,y:0}).song.events,v2(ctx)['6:4'].notes);
});
test('missing saved version stays legacy and known new version survives selected-score save/reopen',()=>{
 const legacy=session(context());legacy.palette=v1(context());assert.equal(legacy.composerVersion,1);assert.equal(legacy.melodyFamilies.length,6);
 const ctx={...context(),composerVersion:2},doc=selectedMelody({id:'routing',global_context:{}},song,{context:ctx,choice:{position:{x:0,y:0}}});
 const reopened=JSON.parse(JSON.stringify(doc));assert.equal(reopened.capture_notes.melody_field.context.composerVersion,2);
 const next=session({...reopened.capture_notes.melody_field.context,source:song});assert.equal(next.composerVersion,2);
 assert.throws(()=>session({...context(),composerVersion:77}),/newer version/);
});
