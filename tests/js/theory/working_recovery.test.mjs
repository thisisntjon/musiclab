import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savePiece,stashWorkingSong,workingDiffersFromSave,loadPiece,loadWorkingSong,listWorkingSongs,WORKING_KEY} from '../../../static/js/theory/save_store.js';
test('working changes compare content, not just id or save time',()=>{
  const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const song={id:'one',title:'Mine',notes:[{id:'held',duration_steps:3.7}],global_context:{bpm:100},
    song_cards:[{bars:2}],tune_grid_state:{baseEnding:[{midi:60}]}};
  savePiece(storage,song);stashWorkingSong(storage,song);
  assert.equal(workingDiffersFromSave(storage),false);
  for(const mutate of [s=>s.notes[0].duration_steps++,s=>s.song_cards[0].bars++,s=>s.tune_grid_state.baseEnding[0].midi++]) {
    const edited=structuredClone(song);mutate(edited);stashWorkingSong(storage,edited);
    assert.equal(workingDiffersFromSave(storage),true);
    assert.deepEqual(loadWorkingSong(storage),edited);assert.deepEqual(loadPiece(storage,'one'),song);
  }
});

test('switching song ids retains each unfinished draft, legacy state, and separate saved versions',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const a={id:'a',notes:[{id:'held',duration_steps:3.7,performance:{offset_steps:.2},provenance:'user_placed'}],song_cards:[{bars:2}]};
 savePiece(storage,a);storage.setItem(WORKING_KEY,JSON.stringify({source:'person',song:a}));
 const edited=structuredClone(a);edited.notes[0].duration_steps=4.2;
 stashWorkingSong(storage,edited);const b={id:'b',notes:[{id:'other'}]};stashWorkingSong(storage,b);
 assert.deepEqual(loadWorkingSong(storage,'a'),edited);assert.deepEqual(loadPiece(storage,'a'),a);
 assert.deepEqual(loadWorkingSong(storage),b);
 for(let i=0;i<30;i++)stashWorkingSong(storage,{id:`draft-${i}`,notes:[{id:`note-${i}`}]});
 assert.equal(listWorkingSongs(storage).length,32,'no eviction at library slot limit');
 stashWorkingSong(storage,edited);assert.equal(listWorkingSongs(storage).length,32,'one draft per song');
 assert.deepEqual(loadWorkingSong(storage,'b'),b);
 const read=loadWorkingSong(storage,'a');read.notes.length=0;assert.equal(loadWorkingSong(storage,'a').notes.length,1);
});

test('failed or malformed draft writes retain the exact previous storage bytes',()=>{
 let raw=null,fail=false;const storage={getItem:()=>raw,setItem:(k,v)=>{if(fail)throw Error('quota');raw=v;}};
 stashWorkingSong(storage,{id:'a',notes:[{id:'mine'}]});const before=raw;fail=true;
 assert.equal(stashWorkingSong(storage,{id:'b',notes:[]}),false);assert.equal(raw,before);
 fail=false;raw='{broken';assert.equal(stashWorkingSong(storage,{id:'c',notes:[]}),false);assert.equal(raw,'{broken');
});
