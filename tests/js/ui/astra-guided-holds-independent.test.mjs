import test from 'node:test';
import assert from 'node:assert/strict';
import {songEvents,normalizeSongCards} from '../../../static/js/theory/song_view.js';
const loop=()=>({bpm:120,total_steps:16,steps_per_bar:16,events:[{id:'held',role:'lead',step:14,start_sec:1.75,duration_sec:1,duration_steps:8,performance:{version:1}}]});
test('only strict true opts a nonfinal card into preserving performed holds',()=>{for(const flag of [undefined,false,'true',1,true]){const c={bars:1,tune:true,beat:true,under:true,preserve_performed_holds:flag};const r=songEvents(loop(),[c,{bars:1,tune:true,beat:true,under:true}]);assert.equal(r.events[0].duration_sec,flag===true?1:.25);assert.equal(normalizeSongCards([c])[0].preserve_performed_holds,flag===true?true:undefined);}});
test('invalid or oversized performed duration does not enable unbounded section tails',()=>{for(const duration of [0,65,Infinity,NaN]){const bad=loop();bad.events[0].duration_steps=duration;assert.equal(songEvents(bad,[{bars:1,tune:true,preserve_performed_holds:true},{bars:1,tune:true}]).events[0].duration_sec,.25);}});
test('flag does not change legacy nonperformed notes',()=>{const d=loop();delete d.events[0].performance;assert.equal(songEvents(d,[{bars:1,tune:true,preserve_performed_holds:true},{bars:1,tune:true}]).events[0].duration_sec,.25);});
