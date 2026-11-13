import test from 'node:test';
import assert from 'node:assert/strict';
import {PHRASES,VOCABULARY_VERSION} from '../../../static/js/theory/melody_phrase_library_v1.js';
import {buildMelodyPalette as v4,planMelodyCandidate} from '../../../static/js/theory/melody_composer_v4.js';
import {buildMelodyPalette as v1,captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {buildMelodyPalette as v2} from '../../../static/js/theory/melody_composer_v2.js';
import {buildMelodyPalette as v3} from '../../../static/js/theory/melody_composer_v3.js';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
const song={song_id:'corpus-review',bpm:100,swing:.64,total_steps:64,steps_per_bar:16,events:[
{id:'own-held',role:'lead',step:63,duration_steps:7.8114,duration_sec:7.8114*.15,velocity:.61,performance:{version:1,offset_steps:.271},patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:67}},
{id:'band',role:'bass',step:0,duration_steps:4,duration_sec:.6,velocity:.4,patch_id:'clean_bass',provenance:'jam_generated',concrete:{midi_pitch:36}}]};
const context=(root=0)=>({...captureMelodyContext(song,{phraseContext:{sceneId:'house-v1',root,harmony:{version:1,bars:[[0,4,7],[0,4,9],[0,5,9],[2,7,11]],ending:7}}}),composerVersion:4,vocabularyVersion:VOCABULARY_VERSION});
const session=c=>new MelodyFieldSession(song,{scheduler:{isPlaying:false},sourceDoc:{id:song.song_id,global_context:{},notes:structuredClone(song.events)},captureOrigin:0,phraseContext:c});
test('corpus source timing and lineage survive every generated candidate; originals and backing exact',()=>{
 for(const root of [0,2,11]){const c=context(root),before=structuredClone(c),palette=v4(c);assert.equal(Object.keys(palette).length,97);assert.deepEqual(palette.original.notes,song.events);
 for(const [key,plan] of Object.entries(palette)){if(key==='original')continue;const phrase=PHRASES.find(p=>p.id===plan.phraseId),lead=plan.notes.filter(n=>n.role==='lead');assert.ok(phrase);assert.equal(lead.length,phrase.notes.length);assert.deepEqual(plan.notes.filter(n=>n.role!=='lead'),song.events.filter(n=>n.role!=='lead'));
 lead.forEach((n,i)=>{const [step,pitch,gate]=phrase.notes[i];assert.equal(n.step,step);assert.equal(n.duration_steps,gate);assert.equal(n.performance.offset_steps,0);assert.equal(n.start_sec,step*.15);assert.equal(n.duration_sec,gate*.15);assert.ok(gate>0&&Number.isFinite(gate)&&step+gate<=64);if(i)assert.ok(lead[i-1].step+lead[i-1].duration_steps<=step);assert.equal(n.derivation.source_sha256,phrase.source_sha256);assert.equal(n.derivation.source_pitch,pitch);assert.equal(n.derivation.vocabularyVersion,VOCABULARY_VERSION);assert.equal(n.provenance,'jam_generated');for(let bar=Math.floor(step/16);bar<=Math.min(3,Math.floor((step+gate-1e-7)/16));bar++)assert.ok(c.harmony.bars[bar].some(pc=>(pc+root)%12===n.concrete.midi_pitch%12));});
 }assert.deepEqual(c,before);assert.deepEqual(v4(c),palette);}
});
test('worker dispatch retains all old algorithms and validates corpus version',async()=>{
 const old=globalThis.self,result=[];globalThis.self={postMessage:x=>result.push(x)};try{await import('../../../static/ui/melody_composer_worker.js');for(const [version,fn]of [[1,v1],[2,v2],[3,v3],[4,v4]]){const c={...context(),composerVersion:version};globalThis.self.onmessage({data:c});assert.deepEqual(result.pop(),{plans:fn(c)});assert.equal(session(c).composerVersion,version);}globalThis.self.onmessage({data:{...context(),vocabularyVersion:'unknown'}});assert.match(result.pop().error,/saved version/);globalThis.self.onmessage({data:{...context(),composerVersion:55}});assert.match(result.pop().error,/version/);}finally{globalThis.self=old;}
});
test('v4 chosen score retains corpus context, original held performance, and archive on JSON reopen',()=>{
 const c=context(),palette=v4(c),chosen=palette['6:4'],source={id:song.song_id,global_context:{},notes:structuredClone(song.events)},archive={...structuredClone(source),captured_performance:{events:[{event:source.notes[0],time:4.321,duration:7.8114*.15}],end:8}};
 const before=structuredClone(source),doc=JSON.parse(JSON.stringify(selectedMelody(source,{...song,events:chosen.notes},{context:c,choice:chosen.choice,performanceArchive:archive})));
 assert.deepEqual(doc.melody_original,before);assert.deepEqual(doc.capture_source,archive);assert.deepEqual(source,before);assert.equal(doc.capture_notes.melody_field.version,4);assert.equal(doc.capture_notes.melody_field.context.composerVersion,4);assert.equal(doc.capture_notes.melody_field.context.vocabularyVersion,VOCABULARY_VERSION);assert.equal(doc.capture_notes.melody_field.context.source,undefined);const f=session({...doc.capture_notes.melody_field.context,source:{...song,events:chosen.notes}});f.palette=v4(f.phraseContext);f.candidates.clear();assert.deepEqual(f._candidate({x:0,y:0}).song.events,chosen.notes);assert.deepEqual(planMelodyCandidate(c,{x:0,y:0}).notes,song.events);
});
