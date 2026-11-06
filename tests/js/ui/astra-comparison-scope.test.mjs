import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

test('comparison with a missing selected card returns without throwing, playing or mutating source',async()=>{
 for(const alternative of [false,true]){
  const doc={id:'song',song_cards:[{section_id:'kept',bars:1}],notes:[{id:'mine',duration_steps:7.3,provenance:'user_placed'}]};
  const before=structuredClone(doc),flow=Object.create(PlayFlow.prototype);
  flow.partComparison={before:structuredClone(doc),after:structuredClone(doc),index:99,afterIndex:99};
  flow._canonicalDoc=()=>doc;flow.stage='song';flow._stopForScopeChange=()=>{};
  flow.app={scheduler:{stopGeneration:0,playComparisonOnce(){assert.fail('missing card played');}},_announce(){}};
  await assert.doesNotReject(()=>flow._playComparison(alternative));assert.deepEqual(doc,before);
 }
});
