import test from 'node:test';
import assert from 'node:assert/strict';
import {bandRows} from '../../../static/ui/band_view.js';
test('band overview uses compiled timing and gates, keeps sources and all generated roles',()=>{
 const sources=[{id:'mine',role:'lead',patch_id:'a'},{id:'silent',role:'lead',patch_id:'b'}];
 const events=[{id:'heard',card:1,role:'lead',patch_id:'a',start_sec:2.125,duration_sec:.75,concrete:{midi_pitch:72}},{id:'generated',card:1,role:'fx',patch_id:'swell',start_sec:3,duration_sec:.25},{id:'elsewhere',card:0,role:'bass',patch_id:'bass',start_sec:1,duration_sec:1}];
 const before=JSON.stringify({events,sources});const rows=bandRows(events,sources,{card:1,start:8,stepSeconds:.25});
 assert.equal(rows.length,3);assert.deepEqual(rows[0].events,[{id:'heard',onset:.5,duration:3,pitch:72}]);assert.deepEqual(rows[1].events,[]);assert.deepEqual(rows[2].sources,[]);assert.equal(JSON.stringify({events,sources}),before);
});
test('same instrument in different musical roles stays separate; invalid timing is not drawn',()=>{
 const rows=bandRows([{card:0,role:'lead',patch_id:'keys',start_sec:NaN,duration_sec:1},{card:0,role:'bass',patch_id:'keys',start_sec:0,duration_sec:1}], [{id:'x',role:'lead',patch_id:'keys'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].events.length,0);assert.equal(rows[1].events.length,1);
});
