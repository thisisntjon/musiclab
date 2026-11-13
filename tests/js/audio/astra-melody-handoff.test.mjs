import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {melodyFieldPlaybackView} from '../../../static/js/audio/melody_field_view.js';

const opts=requestId=>({sectionId:'field',requestId});
const score=(id,steps=64)=>({song_id:'same-song',bpm:120,swing:.5,total_steps:steps,steps_per_bar:16,
 events:Array.from({length:steps},(_,step)=>({id:`${id}-${step}`,role:'lead',step,start_sec:step*.125,
 duration_sec:.08,duration_steps:.64,patch_id:'sampled_piano_v1',velocity:.6,
 concrete:{midi_pitch:60},provenance:'jam_generated',performance:{version:1,offset_steps:0}}))});
function setup(){
 const s=new LookaheadScheduler(),trace=[],calls={starts:0,stops:0,dispose:0};
 s.audioCtx={currentTime:0};s.ensureContext=()=>s.audioCtx;
 s.masterBus={fadeIn(){calls.starts++;},dispose(){calls.dispose++;},piano:{stop(){calls.stops++;},trigger(e,t){trace.push({id:e.id,time:t,duration:e.duration_sec});}}};
 s.setCompiledSong(score('A'));
 const prev=globalThis.window;globalThis.window={setInterval:()=>91,clearInterval(){}};
 try{s.start();}finally{globalThis.window=prev;}
 return {s,trace,calls};
}
function tick(s,time){s.audioCtx.currentTime=time;s._lookaheadTick();}
function advance(s,first,last){for(let i=first;i<=last;i++)tick(s,i*.125);}
function stop(s){const prev=globalThis.window;globalThis.window={clearInterval(){}};try{s.stop();}finally{globalThis.window=prev;}}

test('continuous entry uses the existing tick, bus, ledger and held voice at the next bar',()=>{
 const {s,trace,calls}=setup();tick(s,0);advance(s,1,7);
 const held={identity:'held-original'},take=s.performanceTake,bus=s.masterBus,timer=s.timerId;
 s.liveNotes.set('held',held);
 assert.equal(s.queueContinuousPartAudition(score('B',32),opts('B')).ok,true);
 assert.deepEqual(s.getPartAuditionState(),{sectionId:'field',requestedId:'B',scheduledId:null,realizedId:null,pending:true,scheduledTime:null});
 advance(s,8,16);
 assert.equal(trace.at(-1).id,'B-16');assert.ok(Math.abs(trace.at(-1).time-2.04)<1e-9);
 assert.equal(s.performanceTake,take);assert.equal(s.masterBus,bus);assert.equal(s.timerId,timer);
 assert.equal(s.liveNotes.get('held'),held);assert.deepEqual(calls,{starts:1,stops:0,dispose:0});
 assert.equal(s.getPartAuditionState().realizedId,null);
 tick(s,2.05);assert.equal(s.getPartAuditionState().realizedId,'B');
});

test('captured 40ms grid offset is removed in playback view without touching canonical notes',()=>{
 const canonical=score('B',32);
 canonical.events=canonical.events.map(e=>({...e,start_sec:e.start_sec+.04,performance:{version:1,offset_steps:.32}}));
 const original=structuredClone(canonical),view=melodyFieldPlaybackView(canonical,0,.04);
 assert.deepEqual(canonical,original);
 assert.ok(view.events.every(e=>e.performance.offset_steps===0));
 const {s,trace}=setup();tick(s,0);advance(s,1,8);
 s.queueContinuousPartAudition(view,opts('B'));advance(s,9,16);
 assert.equal(trace.at(-1).id,'B-16');assert.ok(Math.abs(trace.at(-1).time-2.04)<1e-9);
});

test('handoff latest request wins, queued score is detached, old pending generators retire',()=>{
 const {s,trace}=setup();tick(s,0);advance(s,1,5);
 s.queueContinuousPartAudition(score('B',32),opts('B'));
 const c=score('C',32);s.queueContinuousPartAudition(c,opts('C'));c.events[16].id='external-mutation';
 s.pendingJamBacking=[...score('UNPLAYED').events];
 advance(s,6,16);
 assert.equal(trace.at(-1).id,'C-16');assert.equal(s.pendingJamBacking,null);
 assert.equal(s.committedJamBacking,null);assert.equal(s.activeJamLead,null);
 assert.equal(trace.some(e=>e.id.startsWith('B-')||e.id.startsWith('UNPLAYED')),false);
});

test('shorter destination wraps at its own length without transport restart',()=>{
 const {s,trace,calls}=setup();tick(s,0);advance(s,1,7);
 s.queueContinuousPartAudition(score('B',32),opts('B'));advance(s,8,32);
 assert.equal(trace.at(-1).id,'B-0');assert.ok(Math.abs(trace.at(-1).time-4.04)<1e-9);
 assert.equal(s.currentStep,1);assert.equal(calls.starts,1);
});

test('stall skips missed handoff boundary; only next actually scheduled bar commits',()=>{
 const {s,trace}=setup();tick(s,0);s.queueContinuousPartAudition(score('B',32),opts('B'));
 tick(s,2.3);assert.equal(s.getPartAuditionState().scheduledId,null);
 assert.equal(trace.some(e=>e.id.startsWith('B-')),false);
 advance(s,19,32);assert.equal(trace.at(-1).id,'B-0');
 assert.ok(Math.abs(trace.at(-1).time-4.04)<1e-9);
});

test('Stop cancels a handoff that has not been scheduled',()=>{
 const {s}=setup();tick(s,0);s.queueContinuousPartAudition(score('B',32),opts('B'));
 stop(s);assert.equal(s.pendingPartHandoff,null);assert.equal(s.getPartAuditionState(),null);
 assert.equal(s.compiledSong.events[0].id,'A-0');
});

test('Stop after handoff submission but before audio-clock boundary retains the previously realized score',()=>{
 const {s}=setup();tick(s,0);advance(s,1,7);
 s.queueContinuousPartAudition(score('B',32),opts('B'));advance(s,8,16);
 assert.equal(s.audioCtx.currentTime,2);assert.equal(s.getPartAuditionState().realizedId,null);
 stop(s);assert.equal(s.compiledSong.events[0].id,'A-0');
});

test('pre-boundary Stop falls back to reached backing A, not requested style C or submitted melody B',()=>{
 const {s}=setup();tick(s,0);advance(s,1,7);
 const personal={...score('own').events[3],id:'own-exact',provenance:'user_placed'};
 const a=score('A');a.events.push(personal);
 s.setCompiledSong(a,{quantizeJamBacking:true,jamStyleKey:'A'});
 s._rememberJamBacking(.04);
 const c=score('C');c.events.push(structuredClone(personal));
 s.setCompiledSong(c,{quantizeJamBacking:true,jamStyleKey:'C'});
 assert.ok(s.pendingJamBacking.some(e=>e.id==='C-0'));
 s.queueContinuousPartAudition(score('B',32),opts('B'));advance(s,8,16);
 assert.equal(s.getPartAuditionState().realizedId,null);stop(s);
 assert.ok(s.compiledSong.events.some(e=>e.id==='A-0'));
 assert.equal(s.compiledSong.events.some(e=>e.id.startsWith('B-')||e.id.startsWith('C-')),false);
 assert.deepEqual(s.compiledSong.events.filter(e=>e.id==='own-exact'),[personal]);
});

test('ordinary score replacement invalidates pending handoff',()=>{
 const {s,trace}=setup();tick(s,0);s.queueContinuousPartAudition(score('B',32),opts('B'));
 s.setCompiledSong(score('C'));assert.equal(s.getPartAuditionState(),null);
 advance(s,1,16);assert.equal(trace.some(e=>e.id.startsWith('B-')),false);assert.equal(trace.at(-1).id,'C-16');
});

test('capture before realized boundary excludes queued attacks and retains past heard history',()=>{
 const {s}=setup();tick(s,0);advance(s,1,7);
 s.queueContinuousPartAudition(score('B',32),opts('B'));advance(s,8,16);
 const captured=s.capturePerformance();
 assert.ok(captured.events.length>0);
 assert.equal(captured.events.some(r=>r.event.id.startsWith('B-')),false);
 assert.ok(captured.events.every(r=>r.time<2));
 tick(s,2.05);const reached=s.capturePerformance();
 assert.equal(reached.events.filter(r=>r.event.id==='B-16').length,1);
 assert.equal(reached.events.filter(r=>r.event.id==='A-15').length,1);
 assert.ok(Math.abs(reached.events.find(r=>r.event.id==='B-16').duration-.01)<1e-9);
});

test('personal held ledger record survives handoff and receives its one real release',()=>{
 const {s}=setup();tick(s,0);advance(s,1,7);
 const event={...score('personal').events[0],id:'jam-live-held',source_note_id:'jam-live-held',
  provenance:'user_placed',duration_sec:4};
 const record=s._rememberPerformance(event,.9);
 const hold={gain:{cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},disconnect(){}};
 s.liveNotes.set('personal',{hold,startTime:.9,recorded:record,timer:null});
 s.queueContinuousPartAudition(score('B',32),opts('B'));advance(s,8,17);
 const during=s.capturePerformance().events.filter(r=>r.event.id==='jam-live-held');
 assert.equal(during.length,1);assert.ok(Math.abs(during[0].duration-(2.125-.9))<1e-9);
 s.noteOff('personal');assert.equal(s.liveNotes.has('personal'),false);
 assert.equal(record.released_at,2.125);assert.ok(Math.abs(record.duration-1.225)<1e-9);
 tick(s,2.4);const after=s.capturePerformance().events.filter(r=>r.event.id==='jam-live-held');
 assert.equal(after.length,1);assert.ok(Math.abs(after[0].duration-1.225)<1e-9);
});

test('incompatible tempo and metre reject without changing the pending request',()=>{
 const {s}=setup();tick(s,0);s.queueContinuousPartAudition(score('B',32),opts('B'));
 for(const invalid of [{...score('C'),bpm:121},{...score('C'),steps_per_bar:12}])assert.equal(s.queueContinuousPartAudition(invalid,opts('C')).ok,false);
 assert.equal(s.getPartAuditionState().requestedId,'B');
});
