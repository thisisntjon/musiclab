import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

test('visual cursor interpolates only the reached latency-adjusted step and clamps stalls',()=>{
 const s=Object.create(LookaheadScheduler.prototype);s.audioCtx={currentTime:1.05,outputLatency:.1};s.compiledSong={bpm:120};
 s.visualQueue=[{step:16,time:1,scheduledVisual:true}];s.visualNotes=[];
 assert.equal(s.drainVisualStep(),null);
 s.audioCtx.currentTime=1.1625;assert.equal(s.drainVisualStep().position,16.5);
 s.audioCtx.currentTime=5;assert.ok(s.drainVisualStep().position<17);
 s.visualQueue=[{step:0,time:5,scheduledVisual:true}];s.audioCtx.currentTime=5.1;assert.equal(s.drainVisualStep().position,0);
});

test('melody sound picker precedes canvas and excludes drum-kit changes',()=>{
 const f=Object.create(PlayFlow.prototype);f.instrumentGroup='drums';f._choice=()=>'';f._btn=(key)=>key;
 const html=f._instrumentPickerHtml({changing:true,melodyOnly:true});
 assert.doesNotMatch(html,/change-instrument:(kick|soft|snare)/);assert.match(html,/change-instrument:sampled_/);
});

test('sample load cannot retimbre a different part after navigation or Stop',async()=>{
 for(const alter of [f=>f.editingCard=1,f=>f.app.scheduler.stopGeneration++,f=>f.doc.notes.push({id:'later'})]){
  const f=Object.create(PlayFlow.prototype);f.doc={id:'song',notes:[]};f.stage='tune';f.editingCard=0;f.tuneGrid={eventEditor:true};f.eventRole='lead';f.app={scheduler:{stopGeneration:0}};
  let release;f._loadPiano=()=>new Promise(r=>release=r);f._canonicalDoc=()=>f.doc;f._pushUndo=()=>assert.fail('stale instrument change applied');
  const action=f._changeInstrument('sampled_piano_v1');alter(f);release(true);await action;
 }
});
