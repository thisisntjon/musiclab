"""Real JS materialization and both compilers preserve segmented performed holds."""
import copy
import json
import subprocess
from pathlib import Path

import pytest

from src.theory_core import compile_song


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = """
import {materializePerformance} from './static/js/theory/performance_capture.js';
import {newPlayDoc} from './static/js/theory/session_rules.js';
import {compileSongStandalone} from './static/ui/standalone_compiler.js';
import {songEvents,applySongMaterial} from './static/js/theory/song_view.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const request=JSON.parse(input);
let doc=request.doc;
if(!doc){
 const source=newPlayDoc();source.id='segmented-take';source.global_context.swing=.5;
 const records=[0,70,140].map((step,i)=>({time:step*.15,duration:.3,occurrence:i+1,event:{
  id:`generated-${i}`,step:step%64,role:'lead',patch_id:'warm_keys',duration_sec:.3,
  velocity:.4,provenance:'jam_generated',generated_by:'musiclab_jam',concrete:{midi_pitch:60+i*5}}}));
 records.push({time:63.25*.15,duration:2.4,occurrence:4,event:{id:'jam-live-hold',role:'lead',
  patch_id:'warm_keys',duration_sec:2.4,velocity:.62,provenance:'user_placed',concrete:{midi_pitch:67}}});
 doc=materializePerformance(source,{version:1,start:0,end:28.575,bpm:100,bars:12,events:records});
}
const base=structuredClone(doc);delete base.song_cards;
const loop=compileSongStandalone(base);
const compiled=songEvents(loop,doc.song_cards,doc.song_cards.map(c=>c.material?
 compileSongStandalone(applySongMaterial(base,c.material)):null));
process.stdout.write(JSON.stringify({doc,compiled}));
"""


def browser(doc=None):
    result = subprocess.run(
        ["node", "--input-type=module", "-e", SCRIPT], input=json.dumps({"doc": doc}),
        text=True, encoding="utf-8", capture_output=True, check=True, cwd=ROOT,
    )
    return json.loads(result.stdout)


@pytest.mark.parametrize("change", ["intact", "muted", "reordered", "last", "removed", "shortened", "lifted"])
def test_segmented_hold_actual_browser_python_parity(change):
    doc = browser()["doc"]
    cards = doc["song_cards"]
    assert [card["bars"] for card in cards] == [4, 4, 4]
    if change == "muted":
        cards[1]["tune"] = False
    elif change == "reordered":
        cards[0], cards[1] = cards[1], cards[0]
    elif change == "last":
        cards[:] = [cards[1], cards[2], cards[0]]
    elif change == "removed":
        cards.pop(1)
    elif change == "shortened":
        cards[1]["bars"] = 2
    elif change == "lifted":
        cards[1]["tune_variant"] = "lift"
    reopened = json.loads(json.dumps(doc))
    before = copy.deepcopy(reopened)
    server = compile_song(reopened)
    client = browser(reopened)["compiled"]
    fields = ("step", "start_sec", "duration_sec", "role", "patch_id", "velocity",
              "provenance", "source_note_id", "capture_occurrence")
    schedule = lambda result: [{k: e[k] for k in fields if k in e} for e in result["events"]]
    assert schedule(server) == schedule(client)
    assert server["total_steps"] == client["total_steps"]
    held = [e for e in server["events"] if e.get("source_note_id") == "jam-live-hold"]
    assert len(held) == 1
    assert held[0]["duration_sec"] == pytest.approx(2.4 if change == "intact" else .1125)
    assert held[0]["provenance"] == "user_placed"
    assert held[0]["capture_occurrence"] == 4
    assert reopened == before
