"""Guided build keeps performed tails in both production compilers and storage."""
import json
import subprocess
from pathlib import Path
import pytest
from src.theory_core import compile_song
from src.song_store import SongStore

SCRIPT = """
import {starterSong} from './static/ui/starter_song.js';
import {compileReturnSong} from './static/ui/returning_part.js';
let input='';for await(const c of process.stdin)input+=c;
const doc=JSON.parse(input), result=starterSong(doc);
process.stdout.write(JSON.stringify({doc:result.after,compiled:compileReturnSong(result.after)}));
"""
@pytest.mark.parametrize('offset',[0,.75])
def test_guided_hold_parity_and_reopen(tmp_path,offset):
    doc={'id':'held-build','global_context':{'bpm':100,'bars':4,'root_pc':0,'scale_type':'major'},'arrangement_mode':'loop','auto_harmony_stabs':False,'scaffold_options':{'humanize':False,'pre_drop_silence':False},'notes':[{'id':'personal','step':14,'duration_steps':8,'role':'lead','patch_id':'warm_keys','velocity':.6,'provenance':'user_placed','pitch_lock_mode':'concrete','performance':{'version':1,'offset_steps':offset},'concrete':{'midi_pitch':64}}],'song_cards':[{'section_id':'first','bars':1,'tune':True,'under':True,'beat':True}]}
    r=subprocess.run(['node','--input-type=module','-e',SCRIPT],input=json.dumps(doc),text=True,encoding="utf-8",capture_output=True,check=True,cwd=Path(__file__).resolve().parents[1])
    built=json.loads(r.stdout)
    store=SongStore(workspace_dir=tmp_path);store.save_song(built['doc']);reopened=store.load_song(doc['id'])
    assert reopened['song_cards']==built['doc']['song_cards']
    server=compile_song(reopened)
    for result in [server,built['compiled']]:
        personal=[e for e in result['events'] if e['id']=='personal']
        assert len(personal)==3
        assert [e['duration_sec'] for e in personal]==pytest.approx([1.2]*3)
        assert [e['start_sec'] for e in personal]==pytest.approx([(14+offset+i*16)*.15 for i in range(3)])
        assert [e['concrete']['midi_pitch'] for e in personal]==[64]*3
