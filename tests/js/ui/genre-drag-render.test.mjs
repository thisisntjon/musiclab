import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

test('render keeps a captured genre target intact, including pointer id zero',()=>{
 const original=globalThis.document;
 try {
  globalThis.document={getElementById:()=>null};
  for(const id of [0,1,7]) {
   const flow=Object.create(PlayFlow.prototype);let paints=0;
   Object.assign(flow,{root:{},fieldPointer:id,_paintMusicField(){paints++;}});
   flow.render();assert.equal(paints,1);assert.equal(flow.fieldNeedsRender,true);
  }
 } finally {globalThis.document=original;}
});

test('deferred redraw runs once after release or cancellation, never replays intent',()=>{
 const flow=Object.create(PlayFlow.prototype);let renders=0;
 Object.assign(flow,{fieldNeedsRender:true,fieldPointer:1,circleIntent:{id:'house-v1'},render(){renders++;}});
 flow.cancelFieldGesture();flow._finishFieldRender();flow._finishFieldRender();
 assert.equal(renders,1);assert.equal(flow.fieldNeedsRender,false);
 assert.equal(flow.fieldPointer,null);assert.equal(flow.circleIntent,null);
});
