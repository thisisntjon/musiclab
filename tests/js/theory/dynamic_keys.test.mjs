import test from 'node:test';
import assert from 'node:assert/strict';
import {dynamicJamPads,personalPerformance} from '../../../static/js/theory/dynamic_keys.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam} from '../../../static/js/theory/jam_session.js';
import {nextExplorationStyle} from '../../../static/js/theory/exploration_route.js';
import {loadStyleFavorites,saveStyleFavorites} from '../../../static/js/theory/style_favorites.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';
const doc=()=>startJam(newPlayDoc(),{patchId:'sampled_piano_v1'});
const chord=(step,pitches,patch)=>pitches.map(p=>({step,start_sec:step*.15,duration_sec:2.4,role:'harmony',patch_id:patch,concrete:{midi_pitch:p}}));
test('fresh keys follow active local harmony and sound, with a manual sound lock',()=>{
 const song=doc(),events=[...chord(0,[60,64,67],'sampled_guitar_v1'),...chord(16,[57,60,64],'sampled_clean_guitar_v1')];
 const first=dynamicJamPads(song,{bpm:100,position:1,backing:{events}});
 const second=dynamicJamPads(song,{bpm:100,position:17,backing:{events}});
 assert.deepEqual(first.map(p=>p.midi),[60,64,67,72]);assert.deepEqual(second.map(p=>p.midi),[60,64,69,72]);
 assert.ok(first.every(p=>p.patchId==='sampled_guitar_v1'));assert.ok(second.every(p=>p.patchId==='sampled_clean_guitar_v1'));
 song.jam_session.follow_band_sound=false;assert.ok(dynamicJamPads(song,{bpm:100,position:17,backing:{events}}).every(p=>p.patchId==='sampled_piano_v1'));
 assert.equal(first[0].patchId,'sampled_guitar_v1');
});
test('audio-clock key context ignores queued future grids and committed future backing',()=>{
 const scheduler={isPlaying:true,audioCtx:{currentTime:10.1},performanceTake:{bpm:100},jamClockTimeline:[{step:15,time:10},{step:16,time:10.15}],jamBackingTimeline:[{time:9,events:chord(0,[60,64,67],'sampled_guitar_v1')},{time:10.15,events:chord(16,[57,60,64],'sampled_clean_guitar_v1')}],activeJamBacking:LookaheadScheduler.prototype.activeJamBacking};
 let context=LookaheadScheduler.prototype.activeJamContext.call(scheduler);assert.ok(context.position<16);assert.equal(context.backing.time,9);
 scheduler.audioCtx.currentTime=10.2;context=LookaheadScheduler.prototype.activeJamContext.call(scheduler);assert.ok(context.position>=16);assert.equal(context.backing.time,10.15);
});
test('personal-only performance preserves exact occurrences/timing and excludes band and old loop notes',()=>{
 const take={start:2,end:4,bars:1,bpm:100,events:[{occurrence:1,time:2.2,duration:1,event:{provenance:'user_placed',source_note_id:'jam-live-x-1',patch_id:'sampled_guitar_v1'}},{occurrence:2,event:{provenance:'jam_generated',source_note_id:'jam-live-fake'}},{occurrence:3,event:{provenance:'user_placed',id:'jam-user-old-loop'}}]};
 const kept=personalPerformance(take);assert.deepEqual(kept.events,[take.events[0]]);assert.equal(kept.start,2);assert.equal(take.events.length,3);
});
test('favorites persist explicit IDs and increase compatible visits without trapping exploration',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}};
 assert.ok(saveStyleFavorites(storage,['a','a','unknown']));assert.deepEqual(loadStyleFavorites(storage,['a','b']),['a']);
 const counts=[0,0];for(let i=0;i<1000;i++){const picked=nextExplorationStyle(0,[],()=>i/1000,[0,1,2],[1]);counts[picked-1]++;}
 assert.deepEqual(counts,[750,250]);assert.equal(nextExplorationStyle(0,[],()=>0,[0,2],[1]),2);
 assert.equal(saveStyleFavorites({setItem(){throw Error('full');}},['a']),false);
 assert.equal(saveStyleFavorites(()=>{throw Error('denied');},['a']),false);
 assert.deepEqual(loadStyleFavorites(()=>{throw Error('denied');},['a']),[]);
 raw='bad';assert.deepEqual(loadStyleFavorites(storage,['a']),[]);
});
