import test from 'node:test';
import assert from 'node:assert/strict';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';

const program=(bpm=100,cursor)=>({version:1,id:'review-form',cursor,blocks:[0,5,7].map((root,i)=>({label:`Block ${i}`,
 variants:[{harmony:{version:1,bars:Array.from({length:4},()=>[root,(root+4)%12,(root+7)%12]),ending:root},
 events:[{id:`generated-${i}`,role:'lead',patch_id:'warm_keys',step:0,start_sec:0,duration_sec:30/bpm,
 velocity:.4,provenance:'jam_generated',generated_by:'musiclab_jam',concrete:{midi_pitch:60+root}}]}]}))});
const song=(bpm=100)=>({song_id:'review',bpm,swing:.5,total_steps:64,steps_per_bar:16,events:program(bpm).blocks[0].variants[0].events});
const options=p=>({quantizeJamBacking:true,jamStyleKey:'review',phraseContext:{sceneId:'review-form',root:0,minor:false},jamFormProgram:p});
function playing(){const s=new LookaheadScheduler();s.audioCtx={currentTime:10};s.setCompiledSong(song(),options(program()));
 s.isPlaying=true;s.performanceTake={start:0,bpm:100,sequence:0,events:[]};s._activateJamForm();
 s.currentStep=0;s.jamPhraseOrdinal=1;s.nextStepAudioTime=9.6;s._commitJamFormIfDue();
 s.liveNotes.set('personal',{id:'held'});return s;}

test('incompatible tempo compilation refreshes form events without rewinding reached block',()=>{
 const s=playing();assert.equal(s.activeJamForm.cursor.blockIndex,1);
 s.currentStep=8;s.nextStepAudioTime=10.8;s.setCompiledSong(song(120),options(program(120)));
 assert.equal(s.activeJamForm.cursor.blockIndex,1);
 assert.equal(s.committedJamBacking[0].duration_sec,.25);
 assert.equal(s.activeJamBacking().events[0].duration_sec,.3);
 s.audioCtx.currentTime=10.81;assert.equal(s.activeJamBacking().events[0].duration_sec,.25);
 s.currentStep=0;s.jamPhraseOrdinal=2;s.nextStepAudioTime=18.8;s._commitJamFormIfDue();
 assert.equal(s.activeJamForm.cursor.blockIndex,2);assert.equal(s.committedJamBacking[0].duration_sec,.25);
 assert.deepEqual(s.liveNotes.get('personal'),{id:'held'});
});

test('cursor-only persistence does not request a backing edit or reset active position',()=>{
 const s=playing(),cursor=structuredClone(s.activeJamForm.cursor);
 s.setCompiledSong(song(),options(program(100,cursor)));
 assert.equal(s.pendingJamBacking,null);assert.deepEqual(s.activeJamForm.cursor,cursor);
 assert.equal(s.committedJamBacking[0].concrete.midi_pitch,65);
});
