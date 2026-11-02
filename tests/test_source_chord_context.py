"""Chord source labels survive intentional editing; neither compiler retunes them."""
import copy
import json
import subprocess

import pytest
from src.theory_core import compile_song
from src.theory_core.hocket import source_mode_guidance


@pytest.mark.parametrize("pcs", [[0, 3, 7, 9], [0, 0, 7], [False, 4, 7], [0, 4, 12], [0, 4, "7"]])
def test_chord_context_matches_browser_without_retuning(pcs):
    note = {"id": "edited-chord", "role": "lead", "patch_id": "sampled_steel_guitar_v1",
            "step": 1, "duration_steps": 2, "velocity": .7, "pitch_lock_mode": "concrete",
            "concrete": {"midi_pitch": 58}, "provenance": "jam_generated",
            "generated_harmony": {"version": 1, "pitch_classes": pcs}}
    doc = {"id": "chord-context", "global_context": {"bpm": 100, "bars": 4, "root_pc": 0,
           "scale_type": "natural_minor", "swing": .5}, "auto_harmony_stabs": False, "notes": [note]}
    original = copy.deepcopy(doc)
    script = "import{compileSongStandalone}from'./static/ui/standalone_compiler.js';let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(compileSongStandalone(JSON.parse(s))));"
    browser = json.loads(subprocess.run(["node", "--input-type=module", "-e", script], input=json.dumps(doc),
                         text=True, encoding="utf-8", capture_output=True, check=True).stdout)["events"][0]
    python = compile_song(doc)["events"][0]
    assert doc == original
    assert python["concrete"]["midi_pitch"] == browser["concrete"]["midi_pitch"] == 58
    assert python["generated_harmony"] == browser["generated_harmony"] == note["generated_harmony"]
    expected = "Source band: harmony context. Pitch kept as written."
    assert (python["why_label"] == expected) == (browser["why_label"] == expected) == (pcs == [0, 3, 7, 9])


def test_recorded_performance_guidance_does_not_invent_history_or_relabel_generated_notes():
    note = {"provenance": "user_placed", "source_note_id": "jam-live-original", "concrete": {"midi_pitch": 58}}
    original = copy.deepcopy(note)
    assert source_mode_guidance(note) == "From your performance. Pitch kept as written."
    assert note == original
    assert source_mode_guidance({**note, "source_note_id": "manual-grid-note"}) is None
    assert source_mode_guidance({**note, "provenance": "jam_generated"}) is None
    mode = {"version": 1, "name": "dorian", "tonic": 0, "intervals": [0, 2, 3, 5, 7, 9, 10]}
    assert source_mode_guidance({**note, "performed_mode": mode}) == "Source band: Dorian. Pitch kept as written."
