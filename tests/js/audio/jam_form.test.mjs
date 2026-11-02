import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
import {validJamForm} from '../../../static/js/theory/jam_form.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {songEvents,applySongMaterial,normalizeSongCards} from '../../../static/js/theory/song_view.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {exportProjectJson,parseProjectJson} from '../../../static/js/theory/save_store.js';
const event=(id,pitch,step=0,role='lead')=>({id,role,patch_id:'sampled_piano_v1',step,start_sec:step*.15,
 duration_sec:.3,duration_steps:2,velocity:.5,provenance:'jam_generated',generated_by:'musiclab_jam',
 concrete:{midi_pitch:pitch,freq_hz:440*2**((pitch-69)/12)},performance:{version:1,offset_steps:0}});
const program=()=>({version:1,id:'fixture-blues-v1',blocks:[0,5,7].map((r,i)=>({label:`Chapter ${i+1}`,
 variants:[0,1].map(v=>({harmony:{version:1,bars:Array.from({length:4},()=>[r,(r+4)%12,(r+7)%12]),ending:r},
 events:[event(`block${i}-v${v}`,60+r+12*v)]}))}))});
function scheduler(){const s=new LookaheadScheduler(),p=program();s.audioCtx={currentTime:0};
 s.setCompiledSong({song_id:'form-fixture',bpm:100,swing:.5,steps_per_bar:16,total_steps:64,events:p.blocks[0].variants[0].events},
 {quantizeJamBacking:true,jamStyleKey:'form',phraseContext:{sceneId:'fixture',root:0,minor:false},jamFormProgram:p});
 s.isPlaying=true;s.performanceTake={song_id:'form-fixture',start:0,bpm:100,sequence:0,events:[]};s._activateJamForm();s._rememberJamBacking(0);return s;}
export function compileArrangement(doc){const base=structuredClone(doc);delete base.song_cards;const loop=compileSongStandalone(base);
 return songEvents(loop,doc.song_cards,doc.song_cards.map(c=>c.material?compileSongStandalone(applySongMaterial(base,c.material)):null));}

test('form blocks advance atomically, snapshots distinguish queued clock from reached music',()=>{
 const s=scheduler();assert.ok(validJamForm(program()));assert.equal(s.performanceTake.capture_bars,12);
 s.liveNotes.set('own',{marker:'held'});
 s.currentStep=0;s.jamPhraseOrdinal=1;s.nextStepAudioTime=9.6;s.audioCtx.currentTime=9.55;s._commitJamFormIfDue();
 assert.equal(s.committedJamBacking[0].concrete.midi_pitch,65);assert.equal(s.activeJamBacking().phraseContext.form.blockIndex,0);
 s.audioCtx.currentTime=9.61;assert.equal(s.activeJamBacking().phraseContext.form.blockIndex,1);
 s.jamPhraseOrdinal=3;s.nextStepAudioTime=28.8;s._commitJamFormIfDue();
 assert.equal(s.activeJamForm.cursor.cycle,1);assert.equal(s.committedJamBacking[0].concrete.midi_pitch,72);
 assert.deepEqual(s.liveNotes.get('own'),{marker:'held'});
 assert.equal(s.queueJamLead({events:[],planVersion:1,phraseOrdinal:4}),false);
});

test('pending style/reversal supersedes old form; skipped cycles advance without emitting attacks',()=>{
 const s=scheduler();s.pendingJamBacking=[event('other',70)];s.currentStep=0;s.jamPhraseOrdinal=2;s.nextStepAudioTime=19.2;
 s._commitJamFormIfDue();assert.equal(s.activeJamForm.cursor.blockIndex,0);
 s.pendingJamBacking=null;s._commitJamFormIfDue();assert.equal(s.activeJamForm.cursor.blockIndex,2);assert.equal(s.performanceTake.events.length,0);
 s.requestedJamFormProgram=null;s.pendingJamBacking=[event('new',70)];s.pendingPhraseContext={sceneId:'other'};
 s._commitJamBackingIfDue();assert.equal(s.activeJamForm,null);assert.equal(s.committedJamBacking[0].id,'new');
});

test('twelve-bar actual capture becomes editable cards with one cross-boundary held attack',()=>{
 const s=scheduler();
 for(let step=0;step<192;step+=8){s.audioCtx.currentTime=step*.15;s._rememberPerformance(event(`at${step}`,60+Math.floor(step/64)*5,step%64),step*.15);}
 const own={...event('jam-live-hold',67,63),provenance:'user_placed',duration_sec:2.4,duration_steps:16};
 s._rememberPerformance(own,63.25*.15);s._rememberPerformance(event('future',80),28.8);
 s.audioCtx.currentTime=28.575;const capture=s.capturePerformance();assert.equal(capture.bars,12);assert.ok(!capture.events.some(r=>r.event.id==='future'));
 const source=newPlayDoc();source.title='Form fixture';const before=structuredClone(source),doc=materializePerformance(source,capture);
 assert.deepEqual(source,before);assert.equal(doc.song_cards.length,3);assert.equal(doc.song_cards[0].material,undefined);
 const compiled=compileArrangement(doc),held=compiled.events.filter(e=>e.source_note_id==='jam-live-hold');
 assert.equal(held.length,1);assert.equal(held[0].duration_sec,2.4);assert.equal(compiled.total_steps,192);
 const saved=parseProjectJson(exportProjectJson(doc));assert.equal(saved.ok,true);assert.deepEqual(compileArrangement(saved.song),compiled);
 const changed=structuredClone(doc);changed.song_cards[1].tune=false;
 assert.ok(compileArrangement(changed).events.find(e=>e.source_note_id==='jam-live-hold').duration_sec<.12);
 const reordered=structuredClone(doc);[reordered.song_cards[0],reordered.song_cards[1]]=[reordered.song_cards[1],reordered.song_cards[0]];
 assert.ok(compileArrangement(reordered).events.find(e=>e.source_note_id==='jam-live-hold').duration_sec<.12);
 const last=structuredClone(doc);last.song_cards=[last.song_cards[1],last.song_cards[2],last.song_cards[0]];
 assert.ok(compileArrangement(last).events.find(e=>e.source_note_id==='jam-live-hold').duration_sec<.12);
 assert.deepEqual(compileArrangement(doc),compiled);
});

test('ordinary four-bar capture and malformed segment metadata keep legacy clipping',()=>{
 const s=scheduler();delete s.performanceTake.capture_bars;s.audioCtx.currentTime=12;
 const capture=s.capturePerformance();assert.equal(capture.bars,4);assert.equal(capture.window_bars,undefined);
 assert.equal(normalizeSongCards([{capture_segment:{version:1,take_id:'x',start_step:'bad',end_step:64}}])[0].capture_segment,undefined);
 const p=program();p.blocks[0].variants[0].events[0].provenance='user_placed';assert.equal(validJamForm(p),false);
});

test('a late form entry retains actually played older history, and routine cursor saves do not reset form',()=>{
 const s=scheduler();s.requestedJamFormProgram=null;s._activateJamForm();
 for(let bar=0;bar<20;bar++){s.audioCtx.currentTime=bar*2.4;s._rememberPerformance(event(`old${bar}`,60),bar*2.4);}
 s.audioCtx.currentTime=48;s.requestedJamFormProgram=program();s._activateJamForm();
 const captured=s.capturePerformance();assert.equal(captured.bars,12);assert.ok(captured.events.some(r=>r.event.id==='old8'));
 s.jamPhraseOrdinal=1;s.currentStep=0;s.nextStepAudioTime=48;s._commitJamFormIfDue();
 const cursor=structuredClone(s.activeJamForm.cursor),p={...program(),cursor};
 s.setCompiledSong(s.compiledSong,{quantizeJamBacking:true,jamStyleKey:'form',phraseContext:{sceneId:'fixture',root:0,minor:false},jamFormProgram:p});
 assert.equal(s.pendingJamBacking,null);assert.deepEqual(s.activeJamForm.cursor,cursor);
 s.requestedJamFormProgram=program();s._activateJamForm(true);assert.equal(s.activeJamForm.cursor.blockIndex,1);
});

test('Stop then Play resumes the reached form block, not its old requested cursor or lookahead future',()=>{
 const s=scheduler();s.currentStep=0;s.jamPhraseOrdinal=1;s.nextStepAudioTime=9.6;s.audioCtx.currentTime=9.7;s._commitJamFormIfDue();
 s.jamPhraseOrdinal=2;s.nextStepAudioTime=19.2;s._commitJamFormIfDue();
 assert.equal(s.activeJamForm.cursor.blockIndex,2);assert.equal(s.activeJamBacking().phraseContext.form.blockIndex,1);
 s.stop();assert.equal(s.requestedJamFormProgram.cursor.blockIndex,1);
 const oldWindow=globalThis.window;
 globalThis.window={setInterval:()=>1,clearInterval:()=>{}};
 s.masterBus={fadeIn(){},piano:{stop(){}}};s.ensureContext=()=>s.audioCtx;
 try{s.start();assert.equal(s.activeJamForm.cursor.blockIndex,1);s.stop();}finally{globalThis.window=oldWindow;}
});
