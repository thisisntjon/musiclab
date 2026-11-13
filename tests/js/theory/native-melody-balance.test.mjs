import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureNativeMelodyBalance,balanceNativeMelodyPlans} from '../../../static/js/theory/native_melody_balance.js';
import {buildMelodyPalette,VOCABULARY_VERSION} from '../../../static/js/theory/melody_composer_v5.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';

for(const [scene,level,expected] of [['trance-v1',.0042,.0075],['progressive-house-v1',.0063,.0126]]){
 test(`${scene}: fresh native balance preserves Originals, personal notes and legacy saved wheels`,()=>{
  const notes=[60,64,67,72].map((pitch,i)=>({id:'n'+i,role:'lead',step:i*16,duration_steps:3,velocity:level,patch_id:'pluck_lead',provenance:'jam_generated',concrete:{midi_pitch:pitch}}));
  const song={song_id:'fixture',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:notes};
  const doc={id:'fixture',global_context:{root_pc:0,scale_type:'major'},jam_session:{scene_id:scene}};
  const ctx={...captureMelodyContext(song,{phraseContext:phraseContext(doc)}),composerVersion:5,vocabularyVersion:VOCABULARY_VERSION};
  assert.equal(ctx.sceneId,scene);
  const original=buildMelodyPalette(ctx),before=structuredClone(original);
  assert.equal(balanceNativeMelodyPlans(original,ctx),original,'old contexts are unchanged');
  const fresh=captureNativeMelodyBalance(ctx),adjusted=balanceNativeMelodyPlans(original,fresh);
  assert.equal(adjusted.original,original.original);
  for(const [key,plan]of Object.entries(original))if(key!=='original')for(let i=0;i<plan.notes.length;i++){
   const n=plan.notes[i],actual=adjusted[key].notes[i];
   if(n.generated_by==='musiclab_phrase_composer_v5')assert.ok(Math.abs(actual.velocity-n.velocity*expected)<1e-12);
   assert.deepEqual({...actual,velocity:n.velocity},n);
  }
  assert.deepEqual(original,before,'no source mutation');
  assert.deepEqual(balanceNativeMelodyPlans(original,JSON.parse(JSON.stringify(fresh))),adjusted,'saved scale restores exactly');
  const personal={...notes[0],id:'mine',provenance:'user_placed',velocity:.9};
  const captured=captureNativeMelodyBalance({...ctx,source:{...song,events:[...notes,personal]}});
  assert.equal(captured.nativeLeadBalance.level,level,'personal loudness is not adopted');
  const p={original:{notes:[personal]},alt:{notes:[personal]}};
  assert.deepEqual(balanceNativeMelodyPlans(p,fresh),p);
 });
}
test('other styles and patches do not opt in; corrupt saved scales fail explicitly',()=>{
 const c={sceneId:'house-v1',patch:'pluck_lead'};assert.equal(captureNativeMelodyBalance(c),c);
 assert.throws(()=>balanceNativeMelodyPlans({}, {...c,nativeLeadBalance:{version:1,level:NaN}}),/not supported/);
});
