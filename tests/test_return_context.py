"""Persisted return breath keeps browser/server attacks in agreement."""
import json
import subprocess
from pathlib import Path
import pytest
from src.theory_core import compile_song
from src.song_store import SongStore

@pytest.mark.parametrize('value,following,expected', [(True,False,False),(False,True,True),(None,True,False),(1,False,True),('false',True,False)])
def test_breath_parity_storage(tmp_path,value,following,expected):
    card={'section_id':'a','bars':1,'beat':True,'tune':True,'under':True,'fx':'drum_roll'}
    if value is not None: card['pre_big_breath']=value
    doc={'id':'return-context','arrangement_mode':'song','global_context':{'bpm':113,'bars':4,'root_pc':0,'scale_type':'major'},'auto_harmony_stabs':False,'notes':[{'id':'late','step':14,'duration_steps':1,'role':'bass','patch_id':'clean_bass','velocity':.5,'pitch_lock_mode':'concrete','concrete':{'midi_pitch':40},'provenance':'user_placed'}],'song_cards':[card,{'section_id':'b','bars':1,'big':following}]}
    script="""import {compileReturnSong} from './static/ui/returning_part.js';let s='';for await(const c of process.stdin)s+=c;process.stdout.write(JSON.stringify(compileReturnSong(JSON.parse(s))));"""
    r=subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(doc),capture_output=True,text=True,encoding="utf-8",check=True,cwd=Path(__file__).resolve().parents[1])
    browser=json.loads(r.stdout)
    store=SongStore(workspace_dir=tmp_path);store.save_song(doc);server=compile_song(store.load_song(doc['id']))
    for compiled in [browser,server]:
        events=[e for e in compiled['events'] if e['card']==0]
        assert any(e['id']=='late' for e in events) is expected
        assert any(e['role']=='drums' and e['step']>=13 for e in events) is expected

