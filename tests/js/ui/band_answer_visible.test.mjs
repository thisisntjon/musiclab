// Phase 15.2: show the answer. One receipt per band change caused by the person and none otherwise;
// adopted notes marked on the sheet with a connector to the person's note; the confirmation fill only
// when asked and never under Calm; Read this shows a sign.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {scoreFromEvents,renderSheetSvg} from '../../../static/js/theory/score_sheet.js';
import {LookaheadScheduler as Scheduler} from '../../../static/js/audio/scheduler.js';

globalThis.performance ??= { now: () => Date.now() };
const freq=midi=>440*2**((midi-69)/12);
let seq=0;
const own=(time,hold,midi=64)=>({time,duration:hold,released_at:time+hold,occurrence:++seq,event:{provenance:'user_placed',source_note_id:`jam-live-x-${time}`,role:'lead',concrete:{freq_hz:freq(midi)}}});
const take=(events,bpm=120)=>({bpm,start:0,steps_per_bar:16,events});
const jamDoc=()=>{const doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'hip-hop-v1',scene_mix:SCENE_MIX_VERSION});doc.jam_session.exploration_map='catalogue-circle-v2';return doc;};
function makeFlow(events,scheduler={}) {
  const announced=[];
  const dom={receipt:{outerHTML:''},adopted:{textContent:''}};
  const root={querySelector:sel=>sel==='#pf-receipt'?dom.receipt:sel==='#pf-adopted'?dom.adopted:null,querySelectorAll:()=>[],prepend(el){dom.toast=el;}};
  const flow=Object.assign(Object.create(PlayFlow.prototype),{doc:jamDoc(),stage:'jam',root,undoStack:[],beatGrid:{},tuneGrid:{},comfort:{},
    _compile(){this.compiled=(this.compiled||0)+1;},render(){},_cancelCardPreview(){},
    app:{_announce:m=>announced.push(m),scheduler:{isPlaying:true,audioCtx:{currentTime:8},performanceTake:take(events),requestConfirmFill(){this.fills=(this.fills||0)+1;return true;},setQuietOrnaments(q){this.quiet=q;},...scheduler}}});
  return {flow,announced,dom};
}

test('taking the band\'s hand emits one receipt and asks for one fill; Not now emits none',()=>{
  const {flow,announced}=makeFlow([own(1,.2,64),own(2,.2,64),own(3,.2,67),own(4,.2,64)]);
  flow._serviceBandHand();
  assert.equal(flow.bandHand?.kind,'root');
  flow._handKey('hand-take');
  assert.ok(flow.receipt,'a receipt exists');
  assert.equal(flow.receipt.did,'You leaned on a note.');
  assert.equal(flow.receipt.so,'Band: E is home.');
  assert.equal(flow.receipt.glyph,'lean');assert.equal(flow.receipt.part,'tune');
  assert.equal(flow.app.scheduler.fills,1);
  assert.ok(announced.some(m=>m.includes('You leaned on a note.')));
  // A fresh phrase, skipped: no new receipt, no fill.
  flow.receipt=null;
  flow.app.scheduler.performanceTake.events.push(own(9,.2,67),own(10,.2,67),own(11,.2,67));
  flow.app.scheduler.audioCtx.currentTime=14;
  flow._serviceBandHand();flow._handKey('hand-skip');
  assert.equal(flow.receipt,null);assert.equal(flow.app.scheduler.fills,1);
});

test('Next family steered by the lean emits a receipt and a fill; with nothing to go on, neither',()=>{
  const busy=[...Array(24)].map((_,i)=>own(14+i*.25,.08));
  const {flow}=makeFlow(busy,{audioCtx:{currentTime:20}});
  flow._circleFamilyChoice('hip-hop-v1',1);
  assert.equal(flow.receipt?.so,'Band: new style.');assert.equal(flow.receipt.did,'You played a lot.');assert.equal(flow.receipt.glyph,'many');
  assert.equal(flow.app.scheduler.fills,1);
  const quiet=makeFlow([]);
  quiet.flow._circleFamilyChoice('hip-hop-v1',1);
  assert.equal(quiet.flow.receipt,undefined);assert.equal(quiet.flow.app.scheduler.fills,undefined);
});

test('a receipt lasts about a bar and the paint tick clears it',()=>{
  const {flow,dom}=makeFlow([]);
  flow._showReceipt('You played a lot.','Band: more movement.',{glyph:'many',part:'drums'});
  assert.match(dom.receipt.outerHTML,/You played a lot\./);
  assert.ok(flow.receipt.until-performance.now()>=2400);
  flow.receipt.until=performance.now()-1;
  flow._paintReceipt();
  assert.equal(flow.receipt,null);assert.match(dom.receipt.outerHTML,/hidden/);
});

test('the receipt for an answer fires once, when the answering note has sounded, on either path',()=>{
  const {flow,dom}=makeFlow([]);
  flow.padFlashes=new Map();flow.answerPads=new Map([['jam-live-1',2]]);
  // Not yet sounded, or a note answering something the person did not play: nothing.
  flow._showBandAnswers({passed:[{events:[{role:'lead'}]}]});
  flow._showBandAnswers({passed:[{events:[{evolution:{answered:{source_note_id:'someone-else'}}}]}]});
  assert.equal(flow.receipt,undefined);
  flow._showBandAnswers({passed:[{events:[{evolution:{answered:{source_note_id:'jam-live-1'}}}]}]});
  assert.equal(flow.receipt?.so,'Band: picks up your note.');
  assert.match(dom.receipt.outerHTML,/You played a note\./);
  flow.receipt=null;
  flow._showBandAnswers({passed:[{events:[{evolution:{answered:{source_note_id:'jam-live-1'}}}]}]});
  assert.equal(flow.receipt,null,'one receipt per answer');
});

test('an answer cannot hide a move the person just took; the same card twice announces once',()=>{
  // Found by the browser probe: an answering note sounding just after the take replaced "E is home".
  const {flow,announced}=makeFlow([]);
  flow._showReceipt('You leaned on a note.','Band: E is home.',{glyph:'lean',part:'tune'});
  flow._showReceipt('You played a note.','Band: picks up your note.',{glyph:'tune',part:'tune',minor:true});
  assert.equal(flow.receipt.so,'Band: E is home.');
  assert.equal(announced.length,1);
  // Once the move's card has expired, an answer shows; repeats of it do not announce again.
  flow.receipt.until=performance.now()-1;
  flow._showReceipt('You played a note.','Band: picks up your note.',{glyph:'tune',part:'tune',minor:true});
  flow._showReceipt('You played a note.','Band: picks up your note.',{glyph:'tune',part:'tune',minor:true});
  assert.equal(flow.receipt.so,'Band: picks up your note.');
  assert.equal(announced.length,2);
  // A move always replaces a live answer.
  flow._showReceipt('You played a lot.','Band: more movement.',{glyph:'many',part:'drums'});
  assert.equal(flow.receipt.so,'Band: more movement.');
});

test('adoption of the person\'s note shows a bar count without overclaiming, and ends when the lead changes',()=>{
  const lead={planVersion:3,events:[{role:'lead',step:0,concrete:{midi_pitch:64},evolution:{answered:{source_note_id:'jam-live-x-1',midi:64}}},{role:'lead',step:4,concrete:{midi_pitch:67}}]};
  const {flow,dom}=makeFlow([],{audioCtx:{currentTime:10},lastJamLeadCommit:{planVersion:3,audioTime:10},activeJamLead:lead});
  flow.doc.global_context.bpm=120; // a bar is 2 s
  flow._paintAdoption();
  assert.equal(flow.adoption?.planVersion,3);
  assert.equal(dom.adopted.textContent,"The band's tune starts on your note. Bar 1.");
  flow.app.scheduler.audioCtx.currentTime=14.5;flow._paintAdoption();
  assert.equal(dom.adopted.textContent,"The band's tune starts on your note. Bar 3.");
  flow.app.scheduler.activeJamLead=null;flow._paintAdoption();
  assert.equal(flow.adoption,null);assert.equal(dom.adopted.textContent,'');
  // A lead with no answered note is development, not adoption: nothing shown.
  flow.app.scheduler.activeJamLead={planVersion:4,events:[{role:'lead',step:0,concrete:{midi_pitch:60}}]};flow._paintAdoption();
  assert.equal(flow.adoption,null);
});

test('only the pad of the note the band took lights up, not every note of its lead',()=>{
  const lead={planVersion:3,events:[{role:'lead',step:0,concrete:{midi_pitch:64},evolution:{answered:{source_note_id:'x',midi:64}}},{role:'lead',step:4,concrete:{midi_pitch:67}},{role:'lead',step:8,concrete:{midi_pitch:60}}]};
  const {flow}=makeFlow([],{audioCtx:{currentTime:10},lastJamLeadCommit:{planVersion:3,audioTime:10},activeJamLead:lead});
  let lit=null;flow._paintAdoptionDom=pcs=>{lit=pcs;};
  flow._paintAdoption();
  assert.deepEqual([...lit],[4]);
});

test('the sheet marks an answering band note and draws a connector from the person\'s note to it',()=>{
  const events=[{id:'mine',role:'lead',step:14,duration_steps:2,provenance:'user_placed',concrete:{midi_pitch:64},velocity:.8},
    {id:'band-1',role:'lead',step:16,duration_steps:4,provenance:'jam_generated',concrete:{midi_pitch:64},velocity:.8,evolution:{answered:{source_note_id:'mine',midi:64}}},
    {id:'band-2',role:'lead',step:20,duration_steps:4,provenance:'jam_generated',concrete:{midi_pitch:67},velocity:.8}];
  const score=scoreFromEvents(events,{bpm:100,totalSteps:32});
  const notes=score.measures.flatMap(m=>Object.values(m.parts).flatMap(items=>items.flatMap(i=>i.notes||[])));
  assert.equal(notes.find(n=>n.id==='band-1').answered,'mine');
  assert.equal(notes.find(n=>n.id==='band-2').answered,null);
  const svg=renderSheetSvg(score);
  assert.match(svg,/class="pf-sheet-note pf-part-tune adopted"[^>]*data-id="band-1"[^>]*data-answers="mine"/);
  assert.doesNotMatch(svg,/data-id="band-2"[^>]*adopted/);
  assert.match(svg,/<path d="M[^"]+" class="pf-sheet-connector" fill="none" data-from="mine"\/>/);
  assert.equal((svg.match(/pf-sheet-connector/g)||[]).length,1);
});

test('the confirmation fill adds a roll in the last beat of the current bar once, and never under Calm',()=>{
  const s=Object.create(Scheduler.prototype);
  Object.assign(s,{isPlaying:true,currentStep:5,jamPhraseOrdinal:2,committedJamBacking:[],repeatPlayback:true,compiledSong:{steps_per_bar:16},committedPhraseContext:{root:0}});
  assert.equal(s.requestConfirmFill(),true);
  assert.deepEqual(s.confirmFill,{phrase:2,bar:0});
  assert.equal(s._energyOrnaments(8,.15,0).length,0,'nothing before the last beat');
  assert.equal(s._energyOrnaments(12,.15,0).filter(e=>e.patch_id==='snare').length,1,'a roll step in the last beat');
  assert.equal(s._energyOrnaments(15,.15,0).filter(e=>e.patch_id==='snare').length,1);
  s._energyOrnaments(16,.15,0);
  assert.equal(s.confirmFill,null,'the next bar clears it');
  assert.equal(s._energyOrnaments(28,.15,0).length,0,'no roll in later bars');
  s.setQuietOrnaments(true);
  assert.equal(s.requestConfirmFill(),false);
  assert.equal(s.confirmFill,null);
  s.setQuietOrnaments(false);s.isPlaying=false;
  assert.equal(s.requestConfirmFill(),false,'nothing when stopped');
});

test('Read this shows a Reading sign while the voice speaks, and removes it when it stops',async()=>{
  const {flow,dom}=makeFlow([]);
  flow.speaker={speak:()=>true};
  flow.root.querySelectorAll=sel=>sel==='.pf-heading, .pf-say'?[{textContent:'Find your groove'}]:[];
  flow.root.querySelector=sel=>sel==='.pf-reading'?dom.toast||null:sel==='#pf-receipt'?dom.receipt:sel==='#pf-adopted'?dom.adopted:null;
  globalThis.document??={createElement:()=>({setAttribute(){},remove(){dom.toast=null;}})};
  flow._speakScreen();
  assert.equal(dom.toast?.textContent,'Reading this screen.');
  assert.ok(flow.readingUntil>performance.now());
  // It clears on its own timer, with no music playing and no paint tick (the start screen's case).
  flow.app.scheduler.isPlaying=false;
  flow.readingUntil=performance.now()-1;
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(flow.readingUntil,null);
  clearInterval(flow.readingTimer);
});

test('a live key press recorded with only a source id still anchors the connector',()=>{
  // noteOn records source_note_id and no id; the answer points at that source id.
  const events=[{role:'lead',step:14,duration_steps:1,provenance:'user_placed',source_note_id:'jam-live-7',concrete:{midi_pitch:64},velocity:.85},
    {id:'band-1',role:'lead',step:16,duration_steps:4,provenance:'jam_generated',concrete:{midi_pitch:64},velocity:.8,evolution:{answered:{source_note_id:'jam-live-7',midi:64}}}];
  const svg=renderSheetSvg(scoreFromEvents(events,{bpm:100,totalSteps:32}));
  assert.equal((svg.match(/pf-sheet-connector/g)||[]).length,1);
});
