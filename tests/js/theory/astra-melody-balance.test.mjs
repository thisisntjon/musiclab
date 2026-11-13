import test from 'node:test';
import assert from 'node:assert/strict';
import {balanceBasis,balancedEvents} from '../../../static/js/theory/melody_balance.js';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
const personal={id:'own',role:'lead',step:0,duration_steps:20.8114,velocity:.61,patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:60}};
const bass={...personal,id:'bass',role:'bass',velocity:.4,provenance:'jam_generated'};
const song={song_id:'balance',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:[personal,bass]};
const make=(s=song,ctx={},scheduler={isPlaying:false})=>new MelodyFieldSession(s,{scheduler,captureOrigin:0,sourceDoc:{id:'balance'},phraseContext:ctx});
test('missing velocity Original remains exact',()=>{const note={...bass};delete note.velocity;const events=[note,personal];assert.deepEqual(balancedEvents(events,balanceBasis(events),false),events);});
test('actual session toggle, rejected request, Undo and comparison preserve originals',()=>{
 let accept=true;const scheduler={isPlaying:true,gridOriginTime:0,queueContinuousPartAudition(){return {ok:accept};}};
 const f=make(song,{},scheduler),before=structuredClone(song);f.toggleBandBalance();assert.equal(f.bandBalance,true);
 assert.equal(f._candidate(f.position).song.events.find(n=>n.id==='bass').velocity,.4*.45);
 assert.deepEqual(f._candidate(f.position).song.events.find(n=>n.id==='own'),f.source.events.find(n=>n.id==='own'));
 accept=false;f.toggleBandBalance();assert.equal(f.bandBalance,true);assert.equal(f.history.length,1);f.undo();assert.equal(f.history.length,1);
 accept=true;f.undo();assert.equal(f.bandBalance,false);assert.equal(f.history.length,0);assert.deepEqual(song,before);
});
test('saved soft basis reopens without compounding and Restore retains original velocity',()=>{
 const f=make();f.toggleBandBalance();const candidate=f._candidate(f.position);
 const context={root:0,bandBalance:1,bandBasis:f.bandBasis};
 const doc=selectedMelody({id:'balance',notes:song.events,global_context:{}},candidate.song,{context,choice:{}});
 const reopened=JSON.parse(JSON.stringify(doc));const g=make({...song,events:reopened.notes},reopened.capture_notes.melody_field.context);
 assert.equal(g._candidate(g.position).song.events.find(n=>n.id==='bass').velocity,.4*.45);
 g.toggleBandBalance();assert.equal(g._candidate(g.position).song.events.find(n=>n.id==='bass').velocity,.4);
 assert.deepEqual(reopened.melody_original.notes,song.events);
});
test('actual Keep saves realized balance rather than pending requested mix',async()=>{
 const scheduler={isPlaying:true,gridOriginTime:0,queueContinuousPartAudition:()=>({ok:true}),markPerformanceKept(){}};
 const field=make(song,{root:0},scheduler);field.palette={original:{choice:{position:{x:0,y:0}},notes:field.source.events}};field.hasPlayed=true;
 const reached=field._candidate({x:0,y:0});scheduler.getPartAuditionState=()=>({realizedId:reached.id});
 field.toggleBandBalance();assert.equal(field.bandBalance,true);
 const ui=Object.create(PlayFlow.prototype);ui.doc=field.sourceDoc;ui.melodyField=field;ui.app={scheduler};
 for(const key of ['_pushUndo','_stopForScopeChange','_finishPartEdit','_reconcileRetainedPlaying','_compile','_go'])ui[key]=()=>{};
 await ui._melodyFieldAction('melody-field-keep');
 const savedContext=ui.doc.capture_notes.melody_field.context;
 assert.equal(Object.hasOwn(savedContext,'bandBalance'),false);
 assert.equal(Object.hasOwn(savedContext,'bandBasis'),false,'unplayed pending mix must not add future basis');
 assert.equal(make({...song,events:ui.doc.notes},savedContext).bandBalance,false,'missing saved mix defaults to normal');
 assert.equal(ui.doc.notes.find(n=>n.id==='bass').velocity,.4);
});
test('Original comparison restores initial mix and returns to softer alternative',()=>{
 const f=make();f.palette={original:{choice:{position:{x:0,y:0}},notes:f.source.events}};
 f.toggleBandBalance();assert.equal(f.bandBalance,true);f.toggleOriginal();assert.equal(f.bandBalance,false);
 f.toggleOriginal();assert.equal(f.bandBalance,true);assert.equal(f.comparisonPosition,null);
});
