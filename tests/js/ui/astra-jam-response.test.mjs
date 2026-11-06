import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';

test('one key dispatch resolves dynamic pads once and triggers its realized sound',()=>{
 globalThis.document={activeElement:null,getElementById:()=>null};
 const f=Object.create(PlayFlow.prototype);f.root={style:{}};f.stage='jam';f.jamPlayed=true;
 f.doc={id:'latency',jam_session:{live_keys:true}};f.liveHolds=new Map();let reads=0;const calls=[];
 f._liveJamPads=()=>{reads++;return[{key:'a',role:'lead',patchId:'warm_keys',midi:64}]};
 f.app={scheduler:{isPlaying:true,liveNotes:new Map(),noteOn:s=>{calls.push(s);return 1;}}};
 f._releaseLive=()=>{};f._rememberUnkeptPlaying=()=>{};f._markJamPad=()=>{};f._answerNextBar=()=>false;
 f._onKey({key:'a',preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(reads,1);assert.equal(calls.length,1);assert.equal(calls[0].midi,64);assert.equal(f.liveHolds.get('key:a'),1);
 f._onKey({key:'a',repeat:true,preventDefault(){},stopImmediatePropagation(){}});assert.equal(reads,1);assert.equal(calls.length,1);
 f._onKey({key:'s',ctrlKey:true});assert.equal(reads,1);
});

test('read-only pad context reuses a frozen reached score but advances audio-clock position and boundary',()=>{
 const s=Object.create(LookaheadScheduler.prototype);s.isPlaying=true;s.audioCtx={currentTime:1.1};s.performanceTake={bpm:100};
 s.jamClockTimeline=[{time:1,step:0},{time:1.15,step:1},{time:2,step:16}];
 s.jamBackingTimeline=[{time:1,events:[{concrete:{midi_pitch:60}}]},{time:2,events:[{concrete:{midi_pitch:67}}]}];
 const a=s.activeJamContext({readOnly:true});s.audioCtx.currentTime=1.2;const b=s.activeJamContext({readOnly:true});
 assert.equal(a.backing,b.backing);assert.ok(b.position>a.position);assert.equal(b.backing.time,1);
 assert.throws(()=>{b.backing.events[0].concrete.midi_pitch=80},TypeError);assert.equal(s.jamBackingTimeline[0].events[0].concrete.midi_pitch,60);
 const detached=s.activeJamContext();detached.backing.events[0].concrete.midi_pitch=90;assert.equal(a.backing.events[0].concrete.midi_pitch,60);
 s.audioCtx.currentTime=2;const c=s.activeJamContext({readOnly:true});assert.notEqual(c.backing,b.backing);assert.equal(c.backing.events[0].concrete.midi_pitch,67);
 s.isPlaying=false;assert.equal(s.activeJamContext({readOnly:true}),null);
 s.isPlaying=true;s.jamBackingTimeline=[{time:0,events:[{concrete:{midi_pitch:50}}]}];assert.equal(s.activeJamContext({readOnly:true}).backing.events[0].concrete.midi_pitch,50);
});
