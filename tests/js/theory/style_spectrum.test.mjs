import test from 'node:test';
import assert from 'node:assert/strict';
import {startJam,setJamDirection,contributeJam,jamDirectionKey} from '../../../static/js/theory/jam_session.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
const fresh=()=>startJam(newPlayDoc(),{patchId:'sampled_guitar_v1'});
test('four profiles differ in rhythmic structure and adjacent blends remain editable',()=>{
  const doc=fresh();
  const profiles=[0,1,2,3].map(style_spectrum=>setJamDirection(doc,{style_spectrum}));
  for(const role of ['drums','bass','harmony']) {
    const signatures=profiles.map(d=>JSON.stringify(d.notes.filter(n=>n.role===role).map(n=>[n.step,n.duration_steps,n.concrete.midi_pitch])));
    assert.equal(new Set(signatures).size,4,role);
  }
  for(let i=0;i<=60;i++) {
    const song=setJamDirection(doc,{style_spectrum:i/20});
    assert.equal(new Set(song.notes.map(n=>n.id)).size,song.notes.length);
    assert.ok(song.notes.every(n=>n.velocity>0&&n.velocity<=1));
    assert.deepEqual(compileSongStandalone(song).events,compileSongStandalone(JSON.parse(JSON.stringify(song))).events);
  }
});
test('style requests preserve personal events and the complete held bass interval',()=>{
  const doc=contributeJam(fresh(),{pad:0,step:0});
  doc.notes.push({id:'my-bass',role:'bass',patch_id:'clean_bass',step:3,duration_steps:6.75,
    performance:{version:1,offset_steps:.5},concrete:{midi_pitch:40},velocity:.6,provenance:'user_placed'});
  const own=doc.notes.filter(n=>n.provenance==='user_placed');
  for(const style_spectrum of [0,.5,1,1.5,2,2.5,3]) {
    const next=setJamDirection(doc,{style_spectrum,responsive:false});
    assert.deepEqual(next.notes.filter(n=>n.provenance==='user_placed'),own);
    assert.ok(next.notes.filter(n=>n.role==='bass'&&n.provenance==='jam_generated').every(n=>n.step>=10.25||n.step+n.duration_steps<=3.5));
  }
});
test('direction identity excludes activity and input while retaining version',()=>{
  const old=setJamDirection(fresh(),{style_blend:1});
  assert.equal(jamDirectionKey(old),null);
  const pop=setJamDirection(old,{style_spectrum:1});
  assert.equal(jamDirectionKey(pop),'connected-four-v1:1');
  assert.equal(jamDirectionKey(setJamDirection(pop,{density:4})),jamDirectionKey(pop));
  assert.equal(jamDirectionKey(contributeJam(pop,{pad:2,step:8})),jamDirectionKey(pop));
  assert.notEqual(jamDirectionKey(setJamDirection(pop,{style_spectrum:3})),jamDirectionKey(pop));
  assert.equal(old.jam_session.style_spectrum,undefined);
});
test('ordinary swung personal bass protects its audible gate too',()=>{
  const doc=fresh(); doc.global_context.swing=.68;
  doc.notes.push({id:'swung-bass',role:'bass',patch_id:'clean_bass',step:9,duration_steps:1,
    concrete:{midi_pitch:40},provenance:'user_placed'});
  const next=setJamDirection(doc,{style_spectrum:2,responsive:false});
  assert.ok(!next.notes.some(n=>n.role==='bass'&&n.provenance==='jam_generated'&&n.step===10));
  assert.deepEqual(next.notes.find(n=>n.id==='swung-bass'),doc.notes.find(n=>n.id==='swung-bass'));
  const responsive=contributeJam(setJamDirection(doc,{style_spectrum:2,responsive:true}),{pad:1,step:8});
  assert.ok(!responsive.notes.some(n=>n.role==='bass'&&n.provenance==='jam_generated'&&n.step===10));
  assert.equal(responsive.jam_session.response.note_count,responsive.notes.filter(n=>n.response_version).length);
});

test('dense connected-style input keeps a distinct bass foundation and first chord without inventing responses',()=>{
  let doc=fresh();
  for(let step=0;step<16;step++)doc=contributeJam(doc,{pad:step%4,step});
  const personal=doc.notes.filter(n=>n.provenance==='user_placed');
  const signatures=[];
  for(const style_spectrum of [0,1,2,3]) {
    const next=setJamDirection(doc,{style_spectrum,responsive:true});
    assert.deepEqual(next.notes.filter(n=>n.provenance==='user_placed'),personal);
    assert.equal(next.jam_session.response.note_count,0);
    assert.deepEqual(next.jam_session.response.source_ids,[]);
    const bass=next.notes.filter(n=>n.role==='bass'&&n.provenance==='jam_generated');
    signatures.push(JSON.stringify(bass.map(n=>[n.step,n.duration_steps,n.concrete.midi_pitch])));
    for(let bar=0;bar<4;bar++)assert.ok(next.notes.some(n=>n.role==='harmony'&&Math.floor(n.step/16)===bar));
  }
  assert.equal(new Set(signatures).size,4);
});
