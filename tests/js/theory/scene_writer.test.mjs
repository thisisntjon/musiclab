import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneWriter} from '../../../static/js/theory/scene_writer.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {nextExplorationStyle} from '../../../static/js/theory/exploration_route.js';

test('shared writer encodes triplets, identities and intentional gates without global swing',()=>{
 const doc=newPlayDoc();doc.global_context.bpm=120;
 const {add,finish}=createSceneWriter('triplets',doc,{},[]);
 for(const position of [0,4/3,8/3])add('lead','sampled_piano_v1',position,60,.8,.6);
 doc.notes=finish();
 assert.equal(new Set(doc.notes.map(n=>n.id)).size,3);
 assert.ok(doc.notes.every(n=>n.provenance==='jam_generated'&&n.generated_by==='musiclab_jam'&&n.performance.offset_steps>=0&&n.performance.offset_steps<1));
 const events=compileSongStandalone(doc).events.filter(e=>e.role==='lead');
 assert.deepEqual(events.map(e=>e.start_sec),[0,.166667,.333333]);
 assert.ok(events.every(e=>e.duration_sec===.1));
 doc.global_context.swing=.68;
 assert.deepEqual(compileSongStandalone(doc).events.filter(e=>e.role==='lead'),events);
 assert.deepEqual(doc.notes.map(n=>n.step+n.performance.offset_steps),[0,4/3,8/3]);
 assert.equal(events.length,3);
});

test('writer excludes full performed personal intervals, preserves boundary rests and rejects invalid recipe events',()=>{
 const doc=newPlayDoc(),own={id:'own',role:'bass',patch_id:'sampled_bass_v1',step:1,duration_steps:2,performance:{version:1,offset_steps:.25},velocity:.61,provenance:'user_placed',concrete:{midi_pitch:48}};
 const before=structuredClone(own),writer=createSceneWriter('fixture',doc,{},[own]);
 writer.add('bass','sampled_bass_v1',1,36,.5,.3);
 writer.add('bass','sampled_bass_v1',3,36,.5,.3);
 writer.add('bass','sampled_bass_v1',3.25,36,.5,.3);
 assert.equal(writer.finish().length,1);assert.equal(writer.finish()[0].performance.offset_steps,.25);
 assert.deepEqual(own,before);
 assert.throws(()=>writer.add('bass','sampled_bass_v1',NaN,36,1,.3));
 assert.throws(()=>writer.add('bass','sampled_bass_v1',0,36,-1,.3));
});

test('compatible-neighbor probability does not depend on numeric catalogue distance',()=>{
 for(const random of [.1,.4,.6,.9])assert.equal([1,2].indexOf(nextExplorationStyle(0,[],()=>random,[1,2])),[99,7].indexOf(nextExplorationStyle(0,[],()=>random,[99,7])));
});

test('writer refuses ambiguous editable identities for repeated offset attacks',()=>{
 const writer=createSceneWriter('identity',newPlayDoc(),{},[]);
 writer.add('lead','sampled_piano_v1',0,60,.1,.5,.1);
 assert.throws(()=>writer.add('lead','sampled_piano_v1',0,60,.1,.5,.3),/identity/);
 writer.add('lead','sampled_piano_v1',.3,60,.1,.5);
 assert.equal(new Set(writer.finish().map(n=>n.id)).size,2);
 assert.throws(()=>createSceneWriter('identity',newPlayDoc(),{},[],[{id:'a'},{id:'a'}]),/identity/);
});
