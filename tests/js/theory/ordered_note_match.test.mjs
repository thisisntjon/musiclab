import test from 'node:test';
import assert from 'node:assert/strict';
import {matchRemaining} from '../../../static/js/theory/ordered_note_match.js';
const onset=n=>n.step+(n.performance?.offset_steps||0);
function reference(left,right){
 if(!left.length)return right.map(n=>[undefined,n]);
 if(!right.length)return left.map(n=>[n,undefined]);
 const swap=left.length>right.length,small=swap?right:left,large=swap?left:right;
 let best=null,cost=Infinity;
 const choose=(at,indices,total)=>{
  if(indices.length===small.length){if(total<cost){cost=total;best=indices;}return;}
  for(let i=at;i<=large.length-(small.length-indices.length);i++)choose(i+1,[...indices,i],total+Math.abs(onset(small[indices.length])-onset(large[i])));
 };choose(0,[],0);
 return large.map((note,i)=>{const j=best.indexOf(i),other=j<0?undefined:small[j];return swap?[note,other]:[other,note];});
}
test('bounded matcher exactly preserves exhaustive pairings, ties, fractions and identities',()=>{
 let seed=17;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let trial=0;trial<1200;trial++){
  const notes=(count,prefix)=>Array.from({length:count},(_,i)=>({id:prefix+i,step:Math.floor(random()*16),performance:{offset_steps:Math.floor(random()*4)/4}})).sort((a,b)=>onset(a)-onset(b));
  const left=notes(trial%9,'L'),right=notes(Math.floor(trial/9)%9,'R'),before=JSON.stringify([left,right]);
  assert.deepEqual(matchRemaining(left,right),reference(left,right));
  assert.equal(JSON.stringify([left,right]),before);
 }
});
test('32 against 16 and larger dense groups complete without combinatorial enumeration',()=>{
 for(const size of [32,256]){
  const large=Array.from({length:size},(_,step)=>({step})),small=large.filter((_,i)=>i%2===0);
  for(const [a,b] of [[small,large],[large,small]]){
   const result=matchRemaining(a,b);
   assert.equal(result.length,size);
   assert.equal(result.filter(([l,r])=>l&&r).length,size/2);
   assert.ok(result.filter(([l,r])=>l&&r).every(([l,r])=>l.step===r.step));
  }
 }
});

test('decimal near-ties are deterministic without claiming historical floating-sum equivalence',()=>{
 const notes=values=>values.map((value,i)=>({id:i,step:Math.floor(value),performance:{offset_steps:value-Math.floor(value)}}));
 const left=notes([1.7,6.2,6.4]),right=notes([.9,.9,1.6,3.9,4.7,8.9]);
 const a=matchRemaining(left,right),b=matchRemaining(left,right);
 assert.deepEqual(a,b);
 const total=pairs=>pairs.reduce((sum,[l,r])=>sum+(l&&r?Math.abs(onset(l)-onset(r)):0),0);
 assert.ok(Math.abs(total(a)-total(reference(left,right)))<1e-12);
 assert.equal(a.filter(([l,r])=>l&&r).length,3);
});
