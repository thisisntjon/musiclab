"""The actual browser and Python compilers must agree on captured jam arrangement intent."""
import copy
import json
import subprocess
from pathlib import Path

import pytest

from src.theory_core import compile_song


ROOT = Path(__file__).resolve().parents[1]
BUILD_BROWSER = r"""
import { newPlayDoc } from './static/js/theory/session_rules.js';
import { startJam, contributeJam, setJamDirection } from './static/js/theory/jam_session.js';
import { extractSongMaterial, applySongMaterial, songEvents } from './static/js/theory/song_view.js';
import { compileSongStandalone } from './static/ui/standalone_compiler.js';
let input = ''; for await (const chunk of process.stdin) input += chunk;
const options = JSON.parse(input);
let doc = startJam(newPlayDoc({now:1,rand:()=>.5}), options);
for (const [pad,step] of [[0,0],[1,4],[2,8]]) doc = contributeJam(doc,{pad,step});
if (options.holds && options.kind === "pitched") for (const note of doc.notes) {
 if (note.provenance === "user_placed") {
  note.duration_steps = [.25,.8,.4][Math.floor((note.step % 16)/4)] / .15;
  note.performance = {version:1,offset_steps:0,hold_id:`fixture-${note.step % 16}`};
 }
}
doc = setJamDirection(doc,{density:3,color:4});
const material = extractSongMaterial(doc);
// A distinct independent ending: new high note and retained source rhythm.
material.notes.push({id:'own-ending',role:'lead',patch_id:'warm_keys',step:28,
 duration_steps:2,velocity:.63,pitch_lock_mode:'concrete',provenance:'user_placed',concrete:{midi_pitch:72}});
doc.song_cards = [
 {role_name:'First',bars:1,beat:true,tune:true,under:false,fx:null,big:false},
 {role_name:'Ending',bars:2,beat:true,tune:true,under:true,fx:'drum_roll',big:false,material},
];
if (options.reverse) doc.song_cards.reverse();
const original = JSON.stringify(doc);
const loopDoc = {...doc,arrangement_mode:'loop'};
const loop = compileSongStandalone(loopDoc,null);
const parts = doc.song_cards.map(card=>card.material ? compileSongStandalone(applySongMaterial(loopDoc,card.material),null) : loop);
const browser = songEvents(loop,doc.song_cards,parts);
process.stdout.write(JSON.stringify({doc,browser,browserPreserved:JSON.stringify(doc)===original}));
"""


def browser_candidate(kind, reverse, holds=False):
    result = subprocess.run(
        ["node", "--input-type=module", "-e", BUILD_BROWSER],
        input=json.dumps({"kind": kind, "patchId": "snare" if kind == "drums" else "pluck_lead", "kit": "tiny", "reverse": reverse, "holds": holds}),
        text=True, encoding="utf-8", capture_output=True, check=True, cwd=ROOT,
    )
    return json.loads(result.stdout)


def event_key(event):
    return event["step"], event["role"], event["patch_id"], event["id"]


@pytest.mark.parametrize("holds", [False, True])
@pytest.mark.parametrize("kind", ["pitched", "drums"])
@pytest.mark.parametrize("reverse", [False, True])
def test_captured_jam_full_compilers_preserve_arrangement(kind, reverse, holds):
    candidate = browser_candidate(kind, reverse, holds)
    doc, browser = candidate["doc"], candidate["browser"]
    original = copy.deepcopy(doc)
    server = compile_song(doc)
    assert candidate["browserPreserved"]
    assert doc == original
    assert server["total_steps"] == browser["total_steps"] == 48
    assert server["total_duration_sec"] == browser["total_duration_sec"] == 7.2
    expected_starts = [0, 32] if reverse else [0, 16]
    for compiled in [browser, server]:
        assert [section["start_step"] for section in compiled["sections"]] == expected_starts
        assert [section["bars"] for section in compiled["sections"]] == [card["bars"] for card in doc["song_cards"]]
        muted_card = 1 if reverse else 0
        assert not any(event["card"] == muted_card and event["role"] in ["bass", "harmony", "hocket"] for event in compiled["events"])
        ending_card = 0 if reverse else 1
        ending_offset = 0 if reverse else 16
        assert any(event["card"] == ending_card and event["step"] == ending_offset + 28
                   and event["role"] == "lead" and event["concrete"]["midi_pitch"] == 72 for event in compiled["events"])
        assert any(event["id"].startswith("fx-roll") and event["step"] == ending_offset + 31 for event in compiled["events"])
        chords = [event for event in compiled["events"] if event["role"] == "harmony" and event["patch_id"] == "supersaw_stab"]
        assert chords and all(len(event["voiced_freqs"]) == 1 for event in chords)

    browser_events = sorted(browser["events"], key=event_key)
    server_events = sorted(server["events"], key=event_key)
    assert len(browser_events) == len(server_events)
    for web, python in zip(browser_events, server_events):
        assert event_key(web) == event_key(python)
        assert web["card"] == python["card"]
        assert web["provenance"] == python["provenance"]
        assert web["start_sec"] == pytest.approx(python["start_sec"], abs=.0001)
        assert web["duration_sec"] == pytest.approx(python["duration_sec"], abs=.0001)
        assert web["concrete"].get("midi_pitch", web["concrete"].get("midi")) == python["concrete"].get("midi_pitch", python["concrete"].get("midi"))
        assert web["concrete"]["freq_hz"] == pytest.approx(python["concrete"]["freq_hz"], abs=.001)
        assert web.get("voiced_freqs", []) == pytest.approx(python.get("voiced_freqs", []), abs=.001)
