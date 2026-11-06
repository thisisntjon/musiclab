import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

function setup() {
  const values=new Map();
  globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},scrollTo(){},matchMedia:()=>({matches:false})};
  globalThis.document={body:{classList:{toggle(){},add(){}}},activeElement:null,getElementById:()=>null};
  globalThis.CSS||={escape:s=>String(s)};
  const f=Object.create(PlayFlow.prototype);
  f.root={querySelector:()=>null,querySelectorAll:()=>[]};
  f.app={scheduler:{isPlaying:false,setCompiledSong(){},setLoopRange(){},setRepeatPlayback(){},clearMuteLayers(){},setSpotlightRole(){},stop(){},previewSound(){},capturePerformance:()=>null,activeJamBacking:()=>null,masterBus:{piano:{}}},_announce(){},_logSessionEvent(){}};
  f.render=()=>{};f.stage='song';f.trail=[];f.confirm={};f._freshState();f.stage='tune';f.melodyFocus=true;f.editingCard=0;
  f.doc.song_cards=[{bars:4,beat:true,tune:true,under:true},{bars:4,beat:true,tune:true,under:true}];
  f.doc.notes=[{id:'hold',role:'lead',step:14,duration_steps:8,performance:{version:1,offset_steps:.25},concrete:{midi_pitch:60},provenance:'user_placed'},
    {id:'high',role:'lead',step:48,duration_steps:2,concrete:{midi_pitch:90},provenance:'jam_generated'}];
  f.tuneGrid={eventEditor:true};return f;
}

test('whole-part picture includes later notes and keeps pitch range when zooming',()=>{
  const f=setup();f.eventTuneBar=0;
  const full=f._renderEventTune(),range={...f.phraseRange};
  assert.match(full,/data-phrase-note="high"/);assert.equal(range.stepCount,64);assert.equal(range.startStep,0);assert.equal(range.totalSteps,64);
  f.eventTuneZoom=true;f.eventTuneBar=1;
  const zoom=f._renderEventTune();assert.match(zoom,/data-phrase-note="hold"/);assert.doesNotMatch(zoom,/data-phrase-note="high"/);
  assert.equal(f.phraseRange.low,range.low);assert.equal(f.phraseRange.high,range.high);assert.equal(f.phraseRange.startStep,16);assert.equal(f.phraseRange.totalSteps,64);
});

test('full-part geometry never multiplies duration by bar count again',()=>{
  const f=setup();f._renderEventTune();const surface={getBoundingClientRect:()=>({left:0,top:0,width:1000})};
  f._livePicture=()=>surface;
  assert.equal(f._pictureGeometry({clientX:1000,clientY:34},surface).step,63);
  f.noteDrag={id:'hold',picture:surface,mode:'resize',startStep:14,startPitch:60,grabStep:14};
  let changes;f._applyNoteDrag=(_,change)=>{changes=change;};f._moveNoteDrag({clientX:1000,clientY:34});
  assert.equal(changes.duration,64-14.25);
});

test('zoomed pitch-only movement retains earlier-bar onset and fractional feel',()=>{
  const f=setup();f.eventTuneZoom=true;f.eventTuneBar=1;f._renderEventTune();
  f.noteDrag={id:'hold',mode:'move',startStep:14,startPitch:60,grabStep:0};
  f._pictureGeometry=()=>({local:0,pitch:62,stepCount:16});
  let changes;f._applyNoteDrag=(_,change)=>{changes=change;};f._moveNoteDrag({});
  assert.deepEqual(changes,{pitch:62});assert.equal(f.doc.notes[0].performance.offset_steps,.25);
});

test('exact sounding highlights require role/card/occurrence, not source ancestry; Stop clears',()=>{
  const f=setup();f._renderEventTune();
  const ids=['hold','same-pitch','third','fourth','ancestor'];
  const marks=ids.map(id=>({dataset:{phraseNote:id},classList:{toggle(name,on){this[name]=on;}}}));
  const cursor={style:{}},status={};
  f.root={querySelector:s=>s==='.pf-phrase-cursor'?cursor:s==='#pf-phrase-status'?status:null,querySelectorAll:s=>s==='[data-phrase-note]'?marks:[]};
  f.playhead=null;f.soundingNotes=[...ids.slice(0,4).map(id=>({id,role:'lead',card:0})),{id:'echo-other',source_note_id:'ancestor',role:'lead',card:0},{id:'ancestor',role:'lead',card:1}];
  f._paintPlayhead();assert.deepEqual(marks.map(n=>n.classList['pf-note-playing']),[true,true,true,true,false]);
  f.soundingNotes=[{id:'hold-variation-c0',role:'lead',card:0}];f._paintPlayhead();assert.equal(marks[0].classList['pf-note-playing'],true);
  for(const name of ['_showBandAnswers','_paintSheet','_paintTimeline','_paintListeningVisual','_paintJamPads','_paintJamAnswer'])f[name]=()=>{};
  f.playhead={step:1};f.onTick(null,false);assert.ok(marks.every(n=>n.classList['pf-note-playing']===false));
});

test('unpitched effects and drums never offer or dispatch pitch edits; timing still edits',async()=>{
  for(const note of [
    {id:'noise',role:'fx',patch_id:'reverse_swell',step:4,duration_steps:2,provenance:'jam_generated'},
    {id:'drum',role:'drums',patch_id:'snare',step:4,duration_steps:2,concrete:{midi_pitch:38},provenance:'jam_generated'},
  ]){
    const f=setup();f.doc.notes=[structuredClone(note)];f.eventRole=note.role;f.eventTuneId=note.id;f.eventSelectionExplicit=true;let undo=0;
    f._pushUndo=()=>undo++;f._compile=()=>{};
    const html=f._renderEventTune();assert.doesNotMatch(html,/data-key="event-edit:(?:up|down)"/);assert.match(html,/data-key="event-edit:later"/);
    await f._editEvent('up');await f._editEvent('down');assert.deepEqual(f.doc.notes,[note]);assert.equal(undo,0);
    f.noteDrag={id:note.id,mode:'move',startStep:4,startPitch:60,grabStep:4};f._pictureGeometry=()=>({local:4,pitch:80,stepCount:64});
    let mutations=0;f._applyNoteDrag=()=>mutations++;f._moveNoteDrag({});assert.equal(mutations,0,'vertical drag mutates unpitched note');
    await f._editEvent('later');assert.equal(undo,1);assert.equal(f.doc.notes[0].step,4);assert.equal(f.doc.notes[0].performance.offset_steps,.25);
    assert.deepEqual(f.doc.notes[0].concrete,note.concrete);
  }
});

test('part effects explain source notes versus derived sounding pitches',()=>{
  const f=setup();f.doc.song_cards[0].tune_variant='lift';f.doc.song_cards[0].big=true;
  const html=f._renderEventTune();assert.match(html,/plays your tune higher/);assert.match(html,/band adds higher notes/);
});
