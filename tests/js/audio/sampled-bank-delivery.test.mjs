import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SAMPLED_DELIVERY,fetchSampledBank} from '../../../static/js/audio/sampled_bank_delivery.js';
import {SAMPLED_BANK,SAMPLED_PROGRAMS} from '../../../static/js/theory/sampled_sound_capabilities.js';
const bytes=readFileSync(new URL('../../../static/vendor/sampled-piano/'+SAMPLED_DELIVERY.file,import.meta.url));
test('exact admitted subset covers every current sound without changing its source identity',async()=>{
 const calls=[];const bank=await fetchSampledBank({fetcher:async(url,options)=>{calls.push({url:String(url),options});return new Response(bytes);}});
 assert.equal(bank.byteLength,11699936);assert.equal(SAMPLED_DELIVERY.bytes,11699936);assert.deepEqual(Buffer.from(bank),bytes);
 assert.deepEqual(SAMPLED_DELIVERY.programs,[...new Set(Object.values(SAMPLED_PROGRAMS))].sort((a,b)=>a-b));assert.equal(SAMPLED_DELIVERY.programs.length,36);assert.ok(SAMPLED_DELIVERY.programs.includes(73),'the bass flute plays the Flute preset');
 assert.equal(SAMPLED_DELIVERY.version,3);assert.equal(SAMPLED_DELIVERY.file,'GeneralUser-GS-2.0.3-MusicLab36-v1.sf2');assert.equal(SAMPLED_DELIVERY.sha256,'a3a9e330a46f04ece40769cec5d1ea8b469242cb5123ed5136399fc386d09fc7');
 assert.equal(SAMPLED_DELIVERY.sourceBankId,SAMPLED_BANK.id);assert.equal(SAMPLED_DELIVERY.sourceSha256,SAMPLED_BANK.sha256);
 assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith(SAMPLED_DELIVERY.file));assert.equal(calls[0].options.cache,'default');
});
test('incomplete, altered, HTTP-failed and interrupted sound files never become ready',async()=>{
 await assert.rejects(()=>fetchSampledBank({fetcher:async()=>new Response(bytes.subarray(0,100))}),/not whole/);
 const bad=Buffer.from(bytes);bad[1000]^=1;
 await assert.rejects(()=>fetchSampledBank({fetcher:async()=>new Response(bad)}),/has changed/);
 await assert.rejects(()=>fetchSampledBank({fetcher:async()=>new Response('',{status:503})}),/could not be loaded/);
 await assert.rejects(()=>fetchSampledBank({fetcher:async()=>{throw new TypeError('network reset');}}),/network reset/);
});
test('intentional retry bypasses a cached corrupt response while preserving exact sounds',async()=>{
 let cache;const result=await fetchSampledBank({retry:true,fetcher:async(_,options)=>{cache=options.cache;return new Response(bytes);}});
 assert.equal(cache,'reload');assert.deepEqual(Buffer.from(result),bytes);
});
