import test from 'node:test';
import assert from 'node:assert/strict';
import {drumLanes, drumKit, drumLaneTop} from '../../../static/ui/drum_lanes.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

const hit=(id,patch,midi=36,extra={})=>({id,role:'drums',patch_id:patch,step:2,duration_steps:1.5,concrete:{midi_pitch:midi},provenance:'user_placed',performance:{version:1,offset_steps:.125},...extra});
const doc=()=>({drum_kit:'punchy',notes:[hit('a','kick'),hit('b','snare'),hit('c','kick',50),hit('d','kick',36,{drum_kit:'soft'})]});
test('sound lanes ignore synth MIDI but preserve distinct patches and effective kits',()=>{
 const d=doc(),before=structuredClone(d),lanes=drumLanes(d);
 assert.equal(lanes.length,3);assert.deepEqual(lanes.map(l=>l.label),['Kick drum (punchy)','Snare drum','Kick drum (soft)']);
 assert.equal(drumLaneTop(d.notes[0],d,lanes),drumLaneTop(d.notes[2],d,lanes));
 assert.notEqual(drumLaneTop(d.notes[0],d,lanes),drumLaneTop(d.notes[1],d,lanes));assert.deepEqual(d,before);
 assert.equal(drumKit(hit('old','kick',36,{performance:undefined,drum_kit:'soft'}),d),'punchy');
 assert.equal(drumLanes({notes:[]})[0].patch,'kick');
});
test('unknown and legacy sampled drum sounds keep identity without false drum labels',()=>{
 const d={notes:[hit('x','odd_patch'),hit('y','sampled_piano_v1',60),hit('z','sampled_piano_v1',72)]};
 const lanes=drumLanes(d);assert.equal(lanes.length,3);assert.equal(lanes[0].label,'Sound: odd patch');
 assert.match(lanes[1].label,/piano, note 60/i);assert.match(lanes[2].label,/note 72/);
 for(const concrete of [{midi:72},{}, {midi_pitch:0}]) {
   assert.match(drumLanes({notes:[hit('legacy','sampled_piano_v1',60,{concrete})]})[0].label,/note 36/);
 }
});
test('pointer lane geometry and button insertion preserve chosen kit and concrete values',()=>{
 const f=Object.create(PlayFlow.prototype);f.doc=doc();f.eventRole='drums';f.eventTuneId='a';
 const lanes=drumLanes(f.doc);f.phraseRange={low:36,high:72,stepCount:16,startStep:16,bar:1,lanes};
 const picture={getBoundingClientRect:()=>({left:0,top:0,width:400})};f._livePicture=()=>picture;
 const g=f._pictureGeometry({clientX:200,clientY:134},picture);assert.equal(g.step,24);assert.equal(g.lane.kit,'soft');
 const added=f._newEventSound(g.lane);assert.equal(added.patch_id,'kick');assert.equal(added.drum_kit,'soft');assert.deepEqual(added.concrete,{midi_pitch:36});
 f.eventDrumLane=lanes[1].key;assert.equal(f._newEventSound().patch_id,'snare');
 f.eventDrumLane=lanes[2].key;assert.equal(f._newEventSound().drum_kit,'soft');
});
test('vertical-only drum drag preserves exact timing and identity; pitched effects remain editable',()=>{
 const f=Object.create(PlayFlow.prototype);f.doc=doc();const before=structuredClone(f.doc);
 f.noteDrag={id:'a',startStep:2,grabStep:2,mode:'move'};f.phraseRange={startStep:0,totalSteps:16};
 f._pictureGeometry=()=>({local:2,pitch:90,stepCount:16});f._applyNoteDrag=()=>assert.fail('vertical drag mutated drum');f._moveNoteDrag({});
 assert.deepEqual(f.doc,before);assert.equal(f._canPitch(hit('drum','kick')),false);
 assert.equal(f._canPitch({...hit('fx','reverse_swell',60),role:'fx'}),true);
});
