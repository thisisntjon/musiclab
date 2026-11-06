import test from 'node:test';
import assert from 'node:assert/strict';
import {songLibrary,trashSong,restoreSong,savePiece,stashWorkingSong,listSaves,listWorkingSongs,loadPiece,loadWorkingSong,replacePiece,WORKING_KEY,TRASH_KEY,SLOT_COUNT} from '../../../static/js/theory/save_store.js';

const SAVES='musiclab.saves.v1';
function memory(initial={}) {
  const data={...initial};
  return {data,fail:false,getItem:k=>data[k]??null,setItem(k,v){if(this.fail)throw Error('quota');data[k]=String(v);}};
}
const song=id=>({id,title:`Song ${id}`,notes:[{id:`held-${id}`,role:'lead',step:2,duration_steps:7.3,performance:{offset_steps:.17},concrete:{midi_pitch:61},provenance:'user_placed'}],global_context:{bpm:100},song_cards:[{section_id:`part-${id}`,bars:2}]});
function fixture(){const storage=memory(),saved=song('a'),draft=structuredClone(saved);draft.notes[0].duration_steps=8.7;savePiece(storage,saved);stashWorkingSong(storage,draft);savePiece(storage,song('b'));stashWorkingSong(storage,song('b'));return {storage,saved,draft};}

test('one identity retains distinct saved and unfinished versions; trash only changes ledger',()=>{
 const {storage,saved,draft}=fixture(),before={...storage.data};
 const a=songLibrary(storage).songs.find(s=>s.id==='a');assert.deepEqual(a.saved,saved);assert.deepEqual(a.draft,draft);assert.equal(a.unfinished,true);
 assert.equal(songLibrary(storage).songs.length,2);
 assert.equal(trashSong(storage,'a').ok,true);
 assert.equal(storage.data[SAVES],before[SAVES]);assert.equal(storage.data[WORKING_KEY],before[WORKING_KEY]);
 assert.deepEqual(listSaves(storage).map(s=>s.id),['b']);assert.deepEqual(listWorkingSongs(storage).map(s=>s.id),['b']);
 assert.deepEqual(songLibrary(storage,{trash:true}).songs[0].draft,draft);
 assert.equal(restoreSong(storage,'a').ok,true);assert.deepEqual(loadPiece(storage,'a'),saved);assert.deepEqual(loadWorkingSong(storage,'a'),draft);
});

test('quota failures cannot hide or restore a song or change original bytes',()=>{
 const {storage}=fixture(),before={...storage.data};storage.fail=true;
 assert.equal(trashSong(storage,'a').ok,false);assert.deepEqual(storage.data,before);
 storage.fail=false;trashSong(storage,'a');const deleted={...storage.data};storage.fail=true;
 assert.equal(restoreSong(storage,'a').ok,false);assert.deepEqual(storage.data,deleted);
});

test('restore honors visible saved capacity without losing removed checkpoint or draft',()=>{
 const {storage,saved,draft}=fixture();trashSong(storage,'a');
 for(let i=0;i<SLOT_COUNT-1;i++)assert.equal(savePiece(storage,song(`extra-${i}`)).ok,true);
 const before={...storage.data};assert.equal(restoreSong(storage,'a').reason,'slots_full');assert.deepEqual(storage.data,before);
 assert.equal(trashSong(storage,'b').ok,true);assert.equal(restoreSong(storage,'a').ok,true);
 assert.deepEqual(loadPiece(storage,'a'),saved);assert.deepEqual(loadWorkingSong(storage,'a'),draft);
});

test('unfinished-only recovery does not consume a saved slot',()=>{
 const storage=memory();stashWorkingSong(storage,song('draft'));trashSong(storage,'draft');
 for(let i=0;i<SLOT_COUNT;i++)savePiece(storage,song(`saved-${i}`));
 assert.equal(restoreSong(storage,'draft').ok,true);assert.deepEqual(loadWorkingSong(storage,'draft'),song('draft'));
});

test('stale editing cannot overwrite or resurrect a trashed identity',()=>{
 const {storage}=fixture();trashSong(storage,'a');const before={...storage.data},edited=song('a');edited.notes=[];
 assert.equal(savePiece(storage,edited).reason,'trashed');assert.equal(stashWorkingSong(storage,edited),false);
 assert.equal(replacePiece(storage,'b',edited).reason,'trashed');assert.equal(replacePiece(storage,'a',song('new')).reason,'trashed');
 assert.deepEqual(storage.data,before);
 stashWorkingSong(storage,song('fresh'));assert.equal(restoreSong(storage,'a').ok,true);assert.equal(loadWorkingSong(storage,'a').notes[0].duration_steps,8.7);
});

test('malformed tombstones refuse mutations without interpreting the ledger as empty',()=>{
 for(const raw of ['{broken','{}','[null]','[{"id":false}]']){
  const {storage}=fixture();storage.data[TRASH_KEY]=raw;const before={...storage.data};
  assert.equal(songLibrary(storage).ok,false);assert.equal(trashSong(storage,'a').ok,false);assert.equal(restoreSong(storage,'a').ok,false);
  assert.equal(savePiece(storage,song('a')).ok,false);assert.equal(stashWorkingSong(storage,song('c')),false);
  assert.equal(replacePiece(storage,'b',song('c')).ok,false);assert.deepEqual(storage.data,before);
 }
});

test('syntactically valid malformed working records cannot be overwritten',()=>{
 for(const raw of ['{}','[]','{"source":"person","song":{"id":"a"},"drafts":[null]}']){
  const storage=memory({[WORKING_KEY]:raw});assert.equal(stashWorkingSong(storage,song('new')),false);assert.equal(storage.data[WORKING_KEY],raw);assert.equal(songLibrary(storage).ok,false);
 }
});

test('unavailable reads refuse mutations and never issue a write',()=>{
 const storage={getItem(){throw Error('denied');},setItem(){assert.fail('write after denied read');}};
 assert.equal(songLibrary(storage).ok,false);assert.equal(trashSong(storage,'a').ok,false);assert.equal(restoreSong(storage,'a').ok,false);assert.equal(stashWorkingSong(storage,song('a')),false);assert.equal(savePiece(storage,song('a')).ok,false);
});
