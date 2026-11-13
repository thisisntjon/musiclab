import {test} from 'node:test';
import assert from 'node:assert/strict';
import {songLibrary} from '../../../static/js/theory/save_store.js';
test('recent library ordering preserves bytes and uses newest checkpoint or draft',()=>{
 const rows=[{id:'old',source:'person',saved_at:'2026-11-01T00:00:00Z',song:{id:'old',title:'Old'}},{id:'new',source:'person',saved_at:'2026-11-13T00:00:00Z',song:{id:'new',title:'New'}}];
 const data={'musiclab.saves.v1':JSON.stringify(rows), 'musiclab.working.v1':JSON.stringify({source:'person',updated_at:'2026-10-01T00:00:00Z',song:{id:'new',title:'Draft'}})};
 const storage={getItem:k=>data[k]??null,setItem(){throw Error('read-only');}};
 assert.deepEqual(songLibrary(storage).songs.map(x=>x.id),['new','old']);
 assert.equal(data['musiclab.saves.v1'],JSON.stringify(rows));
 data['musiclab.working.v1']=JSON.stringify({source:'person',updated_at:'2026-11-14T00:00:00Z',song:{id:'old',title:'Edited old'}});
 assert.deepEqual(songLibrary(storage).songs.map(x=>x.id),['old','new']);
});
