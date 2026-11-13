"""Independent selected-score browser/Python parity, including real storage."""
import json
import subprocess
from pathlib import Path

import pytest

from src.song_store import SongStore
from src.theory_core import compile_song


SCRIPT = r"""
import {buildStandaloneSeed,compileSongStandalone} from './static/ui/standalone_compiler.js';
import {phraseContext} from './static/js/theory/phrase_harmony.js';
import {captureMelodyContext,planMelodyCandidate} from './static/js/theory/melody_composer.js';
import {selectedMelody} from './static/js/theory/selected_melody.js';
import {songEvents} from './static/js/theory/song_view.js';
let text='';for await(const chunk of process.stdin)text+=chunk;
const input=JSON.parse(text),source=buildStandaloneSeed();
source.id='selected-parity';source.arrangement_mode='loop';source.auto_harmony_stabs=false;
source.global_context={...source.global_context,root_pc:input.root,scale_type:input.scale,swing:.64};
source.notes=[{id:'personal-held',step:63,duration_steps:7.8114,velocity:.61,role:'lead',
 patch_id:'sampled_piano_v1',provenance:'user_placed',pitch_lock_mode:'concrete',
 concrete:{midi_pitch:60+input.root},performance:{version:1,offset_steps:.271}},
 {id:'band-source',step:1,duration_steps:2,velocity:.4,role:'lead',patch_id:'sampled_piano_v1',
 provenance:'jam_generated',concrete:{midi_pitch:67},pitch_lock_mode:'concrete'},
 {id:'backing-bass',step:0,duration_steps:3,velocity:.3,role:'bass',patch_id:'clean_bass',
 provenance:'jam_generated',concrete:{midi_pitch:36+input.root},pitch_lock_mode:'concrete'}];
const score=compileSongStandalone(source);
if(input.early){
 score.swing=.3;
 const n=score.events.find(e=>e.id==='band-source');
 delete n.performance;n.start_sec=.12;
}
const context=captureMelodyContext(score,{phraseContext:phraseContext({...source,jam_session:{scene_id:'house-v1'}})});
const plan=planMelodyCandidate(context,input.original?{x:0,y:0}:{x:0,y:1});
const archive={...structuredClone(source),captured_performance:{version:1,start:0,end:1,
 events:[{event:source.notes[0],time:.55,duration:.45,occurrence:1}]}};
const doc=selectedMelody(source,{...score,events:plan.notes},{context,choice:plan.choice,performanceArchive:archive});
process.stdout.write(JSON.stringify({doc,browser:songEvents(compileSongStandalone(doc),doc.song_cards),source,archive}));
"""


@pytest.mark.parametrize("root,scale", [(0, "major"), (2, "natural_minor"), (11, "major")])
@pytest.mark.parametrize("original,early", [(True, False), (False, False), (True, True)])
def test_selected_melody_compiler_and_storage_parity(tmp_path, root, scale, original, early):
    result = subprocess.run(
        ["node", "--input-type=module", "-e", SCRIPT],
        input=json.dumps({"root": root, "scale": scale, "original": original, "early": early}),
        text=True, encoding="utf-8", capture_output=True, check=True,
        cwd=Path(__file__).resolve().parents[1],
    )
    fixture = json.loads(result.stdout)
    store = SongStore(workspace_dir=tmp_path)
    store.save_song(fixture["doc"])
    reopened = store.load_song("selected-parity")
    assert reopened["capture_source"] == fixture["archive"]
    assert reopened["melody_original"] == fixture["source"]
    assert reopened["notes"] == fixture["doc"]["notes"]
    assert "captured_performance" not in reopened
    server, browser = compile_song(reopened), fixture["browser"]
    assert server["total_steps"] == browser["total_steps"] == 64
    assert len(server["events"]) == len(browser["events"])
    expected = {event["id"]: event for event in browser["events"]}
    assert len(expected) == len(browser["events"])
    for event in server["events"]:
        other = expected[event["id"]]
        for key in ["role", "patch_id", "provenance"]:
            assert event[key] == other[key]
        assert event["concrete"]["midi_pitch"] == other["concrete"]["midi_pitch"]
        assert event["start_sec"] == pytest.approx(other["start_sec"], abs=1e-5)
        assert event["duration_sec"] == pytest.approx(other["duration_sec"], abs=1e-5)
        assert event["velocity"] == pytest.approx(other["velocity"], abs=1e-6)
    if original:
        personal = next(event for event in server["events"] if event["id"] == "personal-held")
        # Both song-card renderers round attacks to four decimal seconds.
        assert personal["start_sec"] == pytest.approx(63.271 * .15, abs=5.1e-5)
        assert personal["duration_sec"] == pytest.approx(7.8114 * .15, abs=1e-5)
        assert personal["provenance"] == "user_placed"
        if early:
            early_note = next(event for event in server["events"] if event["id"] == "band-source")
            assert early_note["start_sec"] == pytest.approx(.12, abs=1e-6)
            saved = next(note for note in reopened["notes"] if note["id"] == "band-source")
            assert saved["step"] == 0
            assert saved["performance"]["offset_steps"] == pytest.approx(.8)
    else:
        assert any(event.get("generated_by") == "musiclab_phrase_composer" for event in reopened["notes"])
