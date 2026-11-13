import test from 'node:test';
import assert from 'node:assert/strict';
import {melodyWorkspace} from '../../../static/js/theory/melody_workspace.js';
import {createMelodyField,melodyFieldVariant} from '../../../static/js/theory/melody_field.js';

const event=(id,step,extra={})=>({id,role:'lead',step,start_sec:step*.15,duration_sec:.3,
 duration_steps:2,patch_id:'sampled_piano_v1',provenance:'jam_generated',velocity:.7,
 concrete:{midi_pitch:60,freq_hz:261.625565},...extra});
const score=()=>({song_id:'s',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,
 events:[event('requested-unplayed',0)]});
const reached=()=>({source_song_id:'s',time:.04,events:[event('reached-first',0),event('reached-middle',32),event('reached-last',60)]});
const record=(id,time,occurrence,duration=.3,extra={})=>({event:event(id,0,{provenance:'user_placed',source_note_id:`jam-live-${id}`,...extra}),time,duration,occurrence});

test('one-second entry keeps full reached groove, including its later bars, not sparse recorded attacks',()=>{
 const song=score(),backing=reached(),capture={end:1,events:[{event:backing.events[0],time:.04,duration:.3,occurrence:1}]};
 const before=structuredClone({song,backing,capture});
 const result=melodyWorkspace(song,backing,capture,.04);
 assert.equal(result.total_steps,64);assert.deepEqual(result.events,backing.events);
 assert.ok(result.events.some(e=>e.step===60));assert.ok(!result.events.some(e=>e.id==='requested-unplayed'));
 assert.deepEqual({song,backing,capture},before,'source inputs must not be modified or fabricated as history');
});

test('long history does not grow the field; latest cycle of personal attacks is phase-mapped while archive stays exact',()=>{
 const song=score(),backing=reached(),capture={start:0,end:101,events:[record('older',5,1),record('recent',95.765,2,.8114),record('future',102,3)]};
 const archive=structuredClone(capture),result=melodyWorkspace(song,backing,capture,.04);
 assert.equal(result.total_steps,64);assert.equal(result.events.length,4);
 const own=result.events.find(e=>e.source_note_id==='jam-live-recent');assert.ok(own);
 const phase=((95.765-.04)/.15)%64;assert.ok(Math.abs(own.step+own.performance.offset_steps-phase)<1e-9);
 assert.equal(own.duration_sec,.8114);assert.equal(own.duration_steps,.8114/.15);
 assert.equal(result.events.some(e=>e.source_note_id==='jam-live-older'||e.source_note_id==='jam-live-future'),false);
 assert.deepEqual(capture,archive);assert.equal(capture.events[0].event.id,'older');
});

test('compiled personal loop and its recent occurrence appear once, with held duration unchanged',()=>{
 const own=event('personal-loop',10,{provenance:'user_placed',source_note_id:'jam-live-personal'});
 const song=score();song.events.push(own);
 const capture={end:5,events:[{event:own,time:1.54,duration:3.1,occurrence:7}]};
 const result=melodyWorkspace(song,reached(),capture,.04);
 const personal=result.events.filter(e=>e.source_note_id==='jam-live-personal');
 assert.equal(personal.length,1);assert.equal(personal[0].duration_sec,3.1);
 assert.equal(personal[0].concrete.midi_pitch,60);assert.equal(personal[0].provenance,'user_placed');
 assert.equal(new Set(result.events.map(e=>e.id)).size,result.events.length);
});

test('frequency-only actual live event enters melody field without losing its pitch',()=>{
 const hz=440*2**((67-69)/12);
 const capture={end:2,events:[record('live',1.25,1,.5,{concrete:{freq_hz:hz}})]};
 const result=melodyWorkspace(score(),reached(),capture,.04);
 const own=result.events.find(e=>e.source_note_id==='jam-live-live');
 assert.equal(own.concrete.midi_pitch,67);assert.equal(own.concrete.freq_hz,hz);
 const field=createMelodyField(result.events,{version:2});
 assert.deepEqual(melodyFieldVariant(field,{x:0,y:0}).notes,result.events);
});

test('an intentionally empty reached backing does not fall back to an unplayed requested score',()=>{
 const result=melodyWorkspace(score(),{source_song_id:'s',events:[]},{end:1,events:[]},.04);
 assert.deepEqual(result.events,[]);
});
