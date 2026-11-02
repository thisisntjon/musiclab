"""Optional live performance timing survives the real browser/server compilers."""
import copy
import json
import subprocess
from pathlib import Path

import pytest

from src.theory_core import compile_song
from src.song_store import SongStore

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = """
import {compileSongStandalone} from './static/ui/standalone_compiler.js';
import {songEvents} from './static/js/theory/song_view.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {doc,options}=JSON.parse(input);
const loop=compileSongStandalone(doc,options);
process.stdout.write(JSON.stringify(doc.song_cards ? songEvents(loop,doc.song_cards) : loop));
"""


def fixture_doc():
    return dict(id="performed-fixture", global_context=dict(bpm=100,swing=.65,root_pc=0,scale_type="major",bars=4),
                arrangement_mode="loop", auto_harmony_stabs=False, sound_seed={"brightness":.8}, drum_kit="soft",
                notes=[dict(id="press",step=63,duration_steps=2.375,velocity=.37123,role="lead",patch_id="warm_keys",
                            pitch_lock_mode="concrete",concrete={"midi_pitch":67},provenance="user_placed",
                            sound_seed={"brightness":.25}, performance=dict(version=1,offset_steps=.8)),
                       dict(id="hit",step=1,duration_steps=1.3,velocity=.42,role="drums",patch_id="snare",drum_kit="tiny",
                            concrete={"midi_pitch":38},performance=dict(version=1,offset_steps=.25))])


def browser(doc, options=None):
    result = subprocess.run(["node","--input-type=module","-e",SCRIPT],input=json.dumps(dict(doc=doc,options=options)),
                            text=True,encoding="utf-8",capture_output=True,check=True,cwd=ROOT)
    return json.loads(result.stdout)


@pytest.mark.parametrize("humanize",[True,False])
def test_actual_compilers_preserve_realized_events_and_storage(tmp_path,humanize):
    doc=fixture_doc()
    before=copy.deepcopy(doc)
    store=SongStore(workspace_dir=tmp_path)
    store.save_song(doc)
    reopened=store.load_song(doc["id"])
    assert reopened["notes"] == before["notes"]
    results=[compile_song(reopened,{"humanize":humanize}),browser(reopened,{"humanize":humanize})]
    for result in results:
        events={event["id"]:event for event in result["events"]}
        assert events["press"]["start_sec"] == pytest.approx(9.57)
        assert events["press"]["duration_sec"] == pytest.approx(.35625)
        assert events["press"]["velocity"] == .37123
        assert events["press"]["sound_seed"] == {"brightness":.25}
        assert events["press"]["concrete"]["midi_pitch"] == 67
        assert events["hit"]["drum_kit"] == "tiny"
        assert events["hit"]["start_sec"] == pytest.approx(.1875)
        assert events["hit"]["duration_sec"] == pytest.approx(.195)
    assert doc == before


@pytest.mark.parametrize("invalid",[None,[],"bad",dict(offset_steps=-.1,duration_steps=0,velocity=2),
                                    dict(offset_steps=1,duration_steps=65,velocity=-1),
                                    dict(offset_steps=10**400,duration_steps=10**400,velocity=10**400),
                                    dict(offset_steps="0.2",duration_steps=True,velocity=".4")])
def test_invalid_performance_falls_back_without_mutation(invalid):
    doc=fixture_doc()
    for note in doc["notes"]:
        note.pop("performance")
    baseline=compile_song(doc)["events"]
    for note in doc["notes"]:
        note["performance"]=invalid
    events=compile_song(doc)["events"]
    for event in events:
        event.pop("performance",None)
    assert events == baseline


def test_zero_performance_velocity_is_silent():
    doc=fixture_doc()
    for note in doc["notes"]:
        note["velocity"]=0
    assert compile_song(doc)["events"] == browser(doc)["events"] == []


def test_arrangement_final_release_preserved_earlier_part_clipped():
    doc=fixture_doc()
    doc["song_cards"]=[dict(bars=4,beat=True,tune=True,under=True),dict(bars=4,beat=True,tune=True,under=True)]
    for result in [compile_song(doc),browser(doc)]:
        presses=[event for event in result["events"] if event["role"] == "lead"]
        assert len(presses) == 2
        assert presses[0]["duration_sec"] == pytest.approx(.03)
        assert presses[1]["start_sec"] == pytest.approx(19.17)
        assert presses[1]["duration_sec"] == pytest.approx(.35625)


def test_intentional_edits_use_ordinary_fields_and_invalid_values_have_safe_defaults():
    doc=fixture_doc()
    press=doc["notes"][0]
    press["duration_steps"]=.75
    press["velocity"]=.23
    press["performance"].update(duration_steps=50,velocity=.99)
    for result in [compile_song(doc),browser(doc)]:
        event=next(event for event in result["events"] if event["id"] == "press")
        assert event["duration_sec"] == pytest.approx(.1125)
        assert event["velocity"] == .23
    press["duration_steps"]="invalid"
    press["velocity"]="invalid"
    press["performance"]["offset_steps"]=-.5
    for result in [compile_song(doc),browser(doc)]:
        event=next(event for event in result["events"] if event["id"] == "press")
        assert event["duration_sec"] == pytest.approx(.15)
        assert event["velocity"] == .85
        assert event["start_sec"] == pytest.approx(9.45)
