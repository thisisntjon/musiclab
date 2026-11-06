import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';

test('Faster and Slower retain direction across legacy tempos and circle limits',async()=>{
 for(const circle of[false,true])for(const bpm of(circle?[20,50,100,160]:[20,50,100,160,175,300,400]))for(const key of['faster','slower']){
  const doc=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:'first-neighborhood-v1',scene_id:'house-v1'});doc.global_context.bpm=bpm;if(circle)doc.jam_session.exploration_map='catalogue-circle-v2';
  const notes=structuredClone(doc.notes),flow=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',app:{scheduler:{async unlock(){}},_announce(){}},confirm:{armed:null},_pushUndo(){},_compile(){},render(){}});
  await flow._onClick({target:{closest:()=>({dataset:{key},focus(){}})}});
  assert.equal(doc.global_context.bpm,Math.max(20,Math.min(circle?160:400,bpm+(key==='faster'?5:-5))));
  assert.deepEqual(doc.notes,notes);
 }
});
