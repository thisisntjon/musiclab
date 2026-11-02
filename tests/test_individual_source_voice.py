"""A saved individual-voice pitch edit must affect rendering, without rewriting chord overrides."""
import copy
import json
import subprocess

import pytest
from src.theory_core import compile_song


@pytest.mark.parametrize("kind,expected", [("individual", [53]), ("chord", [52, 59]),
                                           ("unmarked", [52]), ("owned", [52])])
def test_source_voice_render_pitch_matches_both_compilers(kind, expected):
    def freq(pitch):
        return 440 * 2 ** ((pitch - 69) / 12)
    note = {"id": "take-string", "source_note_id": "original-string", "voice_id": "string-lower",
            "role": "harmony", "patch_id": "sampled_strings_v1", "step": 0, "duration_steps": 2,
            "velocity": .5, "performance": {"version": 1, "offset_steps": 0},
            "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 53},
            "voiced_freqs": [freq(52)], "provenance": "jam_generated",
            "generated_harmony": {"version": 1, "pitch_classes": [0, 4, 7, 11]}}
    if kind == "chord":
        note["voiced_freqs"].append(freq(59))
    elif kind == "unmarked":
        del note["voice_id"]
    elif kind == "owned":
        note["provenance"] = "user_placed"
    doc = {"id": "source-voice", "global_context": {"bpm": 100, "bars": 4, "root_pc": 0,
           "scale_type": "major", "swing": .5}, "auto_harmony_stabs": False, "notes": [note]}
    before = copy.deepcopy(doc)
    script = """import{compileSongStandalone}from'./static/ui/standalone_compiler.js';
import{pianoNotes}from'./static/js/audio/sampled_piano.js';
let s='';for await(const c of process.stdin)s+=c;
const event=compileSongStandalone(JSON.parse(s)).events[0];
console.log(JSON.stringify({event,pitches:pianoNotes(event).map(n=>n.pitch)}));"""
    browser = json.loads(subprocess.run(["node", "--input-type=module", "-e", script],
                         input=json.dumps(doc), text=True, encoding="utf-8", capture_output=True, check=True).stdout)
    python = compile_song(doc)["events"][0]
    assert doc == before
    assert browser["pitches"] == expected
    assert python["voiced_freqs"] == pytest.approx(browser["event"]["voiced_freqs"], abs=.001)
    assert python["concrete"]["midi_pitch"] == browser["event"]["concrete"]["midi_pitch"] == 53
    assert python["source_note_id"] == "original-string"
    if kind != "individual":
        assert python["voiced_freqs"] == note["voiced_freqs"]
