import test from 'node:test';
import assert from 'node:assert/strict';
import {pitchRows,pitchTop,pitchName} from '../../../static/ui/pitch_rows.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
test('pitch rows preserve actual pitch placement and bound extreme legacy data',()=>{
 const notes=[{concrete:{midi_pitch:60.5}},{concrete:{midi_pitch:72}}],before=structuredClone(notes);const r=pitchRows(notes);
 assert.equal(r.rows[0].midi,r.high);assert.equal(pitchTop(60.5,r),pitchTop(60,r)-14);assert.deepEqual(notes,before);assert.equal(pitchName(60),'C4');
 for(const p of [0,127,-100,10000,Infinity]){const model=pitchRows([{concrete:{midi_pitch:p}}]);assert.ok(model.rows.length>=12&&model.rows.length<=128);}
});
test('row centers map to written pitches and assistance can be disabled',()=>{
 const f=Object.create(PlayFlow.prototype);f.doc={global_context:{root_pc:0,scale_type:'major'}};const r=pitchRows([{concrete:{midi_pitch:60}}]);f.phraseRange={...r,stepCount:16,startStep:16};
 const surface={getBoundingClientRect:()=>({left:52,top:-100,width:500})};f._livePicture=()=>surface;
 f.pitchSnap=false;const point={clientX:302,clientY:-100+pitchTop(61,r)+14};assert.equal(f._pictureGeometry(point,surface).pitch,61);assert.equal(f._pictureGeometry(point,surface).step,24);
 f.pitchSnap=true;assert.equal(f._pictureGeometry(point,surface).pitch,60);
});
test('horizontal-only drags never snap off-key, fractional or legacy alias pitches',()=>{
 for(const concrete of [{midi_pitch:61},{midi_pitch:60.5},{midi:73}]){
  const f=Object.create(PlayFlow.prototype);f.doc={notes:[{id:'own',role:'lead',step:2,concrete}]};
  f.phraseRange={rowHeight:28,startStep:0,totalSteps:16};f.noteDrag={id:'own',mode:'move',grabStep:2,startStep:2,grabY:100,startPitch:concrete.midi_pitch??concrete.midi};
  f._pictureGeometry=()=>({local:4,pitch:60,stepCount:16});let edit;f._applyNoteDrag=(_,change)=>edit=change;
  f._moveNoteDrag({clientY:100});assert.deepEqual(edit,{step:4});
 }
});
