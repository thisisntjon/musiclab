import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCLE_GROUPS,CIRCLE_SCENES,circlePosition,circleSceneAt,circleStep,circleFamilyStep} from '../../../static/js/theory/music_circle.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

test('circle covers every playable scene exactly once and its seam wraps',()=>{
 assert.deepEqual([...CIRCLE_SCENES].sort(),SCENE_CATALOGUE.map(s=>s.id).sort());
 for(const id of CIRCLE_SCENES){const p=circlePosition(id);assert.equal(circleSceneAt(p.x,p.y),id);assert.equal(circleStep(circleStep(id,1),-1),id);}
 assert.equal(circleStep(CIRCLE_SCENES.at(-1),1),CIRCLE_SCENES[0]);
 for(let i=0;i<CIRCLE_GROUPS.length;i++)assert.equal(circleFamilyStep(CIRCLE_GROUPS[i].sceneIds[0],1),CIRCLE_GROUPS[(i+1)%CIRCLE_GROUPS.length].sceneIds[0]);
 assert.equal(circleSceneAt(.5,.5),null);assert.equal(circleSceneAt(NaN,0),null);
});
test('circle source metadata round-trips and field entry explicitly exits circle',()=>{
 const d=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'reggae-v1'});
 d.jam_session.exploration_map='catalogue-circle-v1';
 assert.equal(parseProjectJson(exportProjectJson(d)).ok,true);
 assert.equal(setJamDirection(d,{music_field:{version:4,x:.2,y:.5}}).jam_session.exploration_map,undefined);
 d.global_context.bpm=175;assert.equal(parseProjectJson(exportProjectJson(d)).ok,false);
 assert.throws(()=>setJamDirection(d,{scene_id:'house-v1'}),/160 BPM/);d.global_context.bpm=100;
 d.jam_session.exploration_map='invented';assert.equal(parseProjectJson(exportProjectJson(d)).ok,false);
});
test('rapid circle button presses accumulate the pending intention',async()=>{
 const doc=setJamDirection(startJam(newPlayDoc()),{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:CIRCLE_SCENES[0]});doc.jam_session.exploration_map='catalogue-circle-v1';
 const f=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',confirm:{armed:null},app:{scheduler:{stopGeneration:1}},_pushUndo(){},_paintCircle(){}});
 for(let i=0;i<3;i++)await f._onClick({target:{closest:()=>({dataset:{key:'circle-next'},focus(){}})}});
 assert.equal(f.circleIntent.id,CIRCLE_SCENES[3]);assert.equal(doc.jam_session.scene_id,CIRCLE_SCENES[0]);
});
