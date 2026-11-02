import test from 'node:test';
import assert from 'node:assert/strict';
import {preferPlaybackAudioSession,acquireMicrophoneAudioSession,recordHummedPhraseToDraftNotes,LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
test('optional playback session is requested without making unsupported browsers fail',()=>{
 assert.equal(preferPlaybackAudioSession({}),false);
 assert.equal(preferPlaybackAudioSession(null),false);
 assert.equal(preferPlaybackAudioSession({get audioSession(){throw Error('unavailable')}}),false);
 assert.equal(preferPlaybackAudioSession({audioSession:{set type(v){throw Error('denied')}}}),false);
 let writes=0,type='auto';const nav={audioSession:{get type(){return type},set type(v){writes++;type=v}}};
 assert.equal(preferPlaybackAudioSession(nav),true);assert.equal(type,'playback');
 assert.equal(preferPlaybackAudioSession(nav),true);assert.equal(writes,1);
});
test('microphone leases preserve capture mode through playback setup and restore only after last release',()=>{
 const nav={audioSession:{type:'playback'}};
 const releaseA=acquireMicrophoneAudioSession(nav),releaseB=acquireMicrophoneAudioSession(nav);
 assert.equal(nav.audioSession.type,'play-and-record');assert.equal(preferPlaybackAudioSession(nav),false);
 releaseA();releaseA();assert.equal(nav.audioSession.type,'play-and-record');
 releaseB();assert.equal(nav.audioSession.type,'playback');
});
test('actual humming denial and cancelled permission restore the prior audio session',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),session={type:'playback'};
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:session}});
  const denied=await recordHummedPhraseToDraftNotes({mediaDevices:{getUserMedia:async()=>{assert.equal(session.type,'play-and-record');throw Object.assign(Error('denied'),{name:'NotAllowedError'});}}});
  assert.equal(denied.status,'denied');assert.equal(session.type,'playback');
  const controller={};let resolve,stops=0;
  const pending=recordHummedPhraseToDraftNotes({controller,mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}});
  assert.equal(session.type,'play-and-record');controller.stop();assert.equal((await pending).status,'cancelled');assert.equal(session.type,'playback');
  resolve({getTracks:()=>[{stop(){stops++}}]});await Promise.resolve();await Promise.resolve();assert.equal(stops,1);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
test('successful microphone setup keeps capture mode until tracks stop and restores playback',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),priorWindow=globalThis.window,session={type:'playback'};let stops=0,closed=0;
 class Context {
  constructor(){this.destination={};this.currentTime=0;}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createScriptProcessor(){return {connect(){},disconnect(){}};}
  createGain(){return {gain:{value:1},connect(){}};}
  async close(){closed++;}
 }
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:session}});globalThis.window={AudioContext:Context};
  const controller={};const result=await recordHummedPhraseToDraftNotes({controller,mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){assert.equal(session.type,'play-and-record');stops++;}}]})},onState(state){if(state==='listening'){assert.equal(session.type,'play-and-record');assert.equal(preferPlaybackAudioSession(),false);controller.stop();}}});
  assert.equal(result.status,'silent');assert.equal(stops,1);assert.equal(closed,1);assert.equal(session.type,'playback');
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
});
test('actual audio context setup requests playback mode and survives a denied setter',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');let value='auto';
 const scheduler={audioCtx:{state:'running'},masterBus:{disposed:false}};
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:{get type(){return value},set type(v){value=v}}}});
  assert.equal(LookaheadScheduler.prototype.ensureContext.call(scheduler),scheduler.audioCtx);assert.equal(value,'playback');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:{set type(v){throw Error('denied')}}}});
  assert.equal(LookaheadScheduler.prototype.ensureContext.call(scheduler),scheduler.audioCtx);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
