"""Historical modal context never substitutes notes or invents current chord judgments."""
import copy
import json
import subprocess

import pytest

from src.theory_core import compile_song


@pytest.mark.parametrize("field", ["generated_mode", "performed_mode"])
@pytest.mark.parametrize("name,third", [("dorian", 3), ("mixolydian", 4)])
def test_modal_guidance_matches_browser_without_retuning(field, name, third):
    mode = {"version": 1, "name": name, "tonic": 0, "intervals": [0, 2, third, 5, 7, 9, 10]}
    note = {"id": "modal-note", "role": "lead", "patch_id": "sampled_tenor_sax_v1",
            "step": 20, "duration_steps": 3, "velocity": .7, "pitch_lock_mode": "concrete",
            "concrete": {"midi_pitch": 70}, "provenance": "user_placed", field: mode,
            "performance": {"version": 1, "offset_steps": .25}}
    doc = {"id": "modal-guidance", "global_context": {"bpm": 100, "bars": 4, "root_pc": 0,
            "scale_type": "major", "swing": .5}, "auto_harmony_stabs": False, "notes": [note]}
    original = copy.deepcopy(doc)
    script = "import{compileSongStandalone}from'./static/ui/standalone_compiler.js';let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(compileSongStandalone(JSON.parse(s))));"
    browser = json.loads(subprocess.run(["node", "--input-type=module", "-e", script], input=json.dumps(doc),
                         text=True, encoding="utf-8", capture_output=True, check=True).stdout)["events"][0]
    python = compile_song(doc)["events"][0]
    assert doc == original
    assert python["concrete"]["midi_pitch"] == browser["concrete"]["midi_pitch"] == 70
    assert python[field] == browser[field] == mode
    assert python["why_label"] == browser["why_label"] == f"Source band: {name.capitalize()}. Pitch kept as written."
    assert "gravity_tier" not in python and "gravity_tier" not in browser
