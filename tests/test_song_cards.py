"""Regression contracts for guided arrangements through the Python compiler."""
import copy
import json
import subprocess
import wave
from pathlib import Path

from src.theory_core import compile_song


def piece():
    return {
        "id": "cards-contract", "global_context": {"bpm": 120, "bars": 4, "root_pc": 0, "scale_type": "major", "swing": .5},
        "auto_harmony_stabs": False,
        "notes": [{"id": "mine", "role": "lead", "patch_id": "pluck_lead", "step": 0, "duration_steps": 2, "velocity": .7, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 60}, "provenance": "user_placed"}],
        "song_cards": [{"under": False}, {"under": False}],
    }


def test_independent_material_order_and_json_roundtrip():
    doc = piece()
    material = {"notes": copy.deepcopy(doc["notes"]), "auto_harmony_stabs": False}
    material["notes"][0]["concrete"]["midi_pitch"] = 67
    doc["song_cards"][1]["material"] = material
    original = copy.deepcopy(doc)
    compiled = compile_song(doc)
    lead = [e for e in compiled["events"] if e["role"] == "lead"]
    assert [e["concrete"]["midi_pitch"] for e in lead] == [60, 67]
    assert [e["step"] for e in lead] == [0, 64]
    assert compiled["total_steps"] == 128
    assert compiled["total_duration_sec"] == 16
    assert doc == original
    doc["song_cards"].reverse()
    reopened = json.loads(json.dumps(doc))
    reordered = compile_song(reopened)
    assert [e["concrete"]["midi_pitch"] for e in reordered["events"] if e["role"] == "lead"] == [67, 60]
    assert [s["start_step"] for s in reordered["sections"]] == [0, 64]


def test_card_lift_and_muted_generated_backing():
    doc = piece()
    doc["song_cards"] = [{"under": False, "tune_variant": "lift"}, {"under": False, "big": True}]
    result = compile_song(doc)
    assert all(e["role"] == "lead" for e in result["events"])
    assert [e["concrete"]["midi_pitch"] for e in result["events"]] == [72, 60]
    assert doc["notes"][0]["concrete"]["midi_pitch"] == 60


def test_empty_card_list_retains_legacy_compilation():
    doc = piece()
    doc["song_cards"] = []
    assert compile_song(doc)["total_steps"] == 64


def test_card_expansion_matches_browser_for_identical_compiled_material():
    """Compare arrangement semantics independently of individual voice compilers."""
    doc = piece()
    doc["song_cards"] = [
        {"under": False, "tune_variant": "lift", "bars": 1},
        {"big": True, "fx": "drum_roll", "bars": 2},
        {"fx": "beat_drop", "tune": False, "bars": 3},
    ]
    base = copy.deepcopy(doc)
    del base["song_cards"]
    loop = compile_song(base)
    script = """
import { songEvents } from './static/js/theory/song_view.js';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { loop, cards } = JSON.parse(input);
process.stdout.write(JSON.stringify(songEvents(loop, cards)));
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        input=json.dumps({"loop": loop, "cards": doc["song_cards"]}),
        text=True, encoding="utf-8", capture_output=True, check=True,
        cwd=Path(__file__).resolve().parents[1],
    )
    browser = json.loads(result.stdout)
    server = compile_song(doc)
    keys = ("id", "step", "start_sec", "duration_sec", "role", "patch_id", "velocity", "card", "provenance", "concrete", "voiced_freqs", "generated_by", "response_to", "source_note_id", "capture_occurrence")
    def schedule(compiled):
        return [{k: e[k] for k in keys if k in e} for e in compiled["events"]]
    assert schedule(browser) == schedule(server)
    assert browser["total_duration_sec"] == server["total_duration_sec"]


def test_short_parts_trim_without_destroying_source():
    doc = piece()
    doc["notes"][0].update(step=15, duration_steps=8)
    doc["song_cards"] = [{"bars": 1}, {"bars": 2}]
    original = copy.deepcopy(doc)
    result = compile_song(doc)
    assert result["total_steps"] == 48
    assert result["total_duration_sec"] == 6
    assert [section["start_step"] for section in result["sections"]] == [0, 16]
    assert result["events"][0]["duration_sec"] <= .125
    assert doc == original


def test_whole_arrangement_wav_includes_final_card(tmp_path):
    from src.audio_engine import render_compiled_song_to_wav
    doc = piece()
    doc["song_cards"][0]["tune"] = False
    compiled = compile_song(doc)
    wav_path = tmp_path / "guided-song.wav"
    render_compiled_song_to_wav(compiled, wav_path, sample_rate=8000)
    with wave.open(str(wav_path), "rb") as wav:
        assert wav.getnframes() / wav.getframerate() == 18.0
        wav.setpos(8 * 8000)
        assert any(wav.readframes(2000))


def test_browser_short_ending_edits_export_at_the_actual_last_bar():
    """Use the real browser tune model, then reopen its song in Python."""
    script = """
import { tuneGridFromNotes, notesFromTuneGrid, toggleEndingCell } from './static/js/theory/tune_model.js';
import { compileSongStandalone } from './static/ui/standalone_compiler.js';
import { songEvents } from './static/js/theory/song_view.js';
let input = ''; for await (const chunk of process.stdin) input += chunk;
const doc = JSON.parse(input);
const grid = tuneGridFromNotes(doc.notes, 2);
toggleEndingCell(grid, 4, 67);
const notes = notesFromTuneGrid(grid, doc.notes, 'pluck_lead', {endingOnly: true});
doc.song_cards = [{bars:2, under:false, material:{notes, auto_harmony_stabs:false}}];
const source = compileSongStandalone({...doc, notes, song_cards:undefined}, null);
const browser = songEvents(source, doc.song_cards, [source]);
process.stdout.write(JSON.stringify({doc, browser}));
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], input=json.dumps(piece()),
                            text=True, encoding="utf-8", capture_output=True, check=True,
                            cwd=Path(__file__).resolve().parents[1])
    output = json.loads(result.stdout)
    server = compile_song(output["doc"])
    def pitches(compiled):
        return [(event["step"], event["concrete"]["midi_pitch"]) for event in compiled["events"] if event["role"] == "lead"]
    assert pitches(server) == pitches(output["browser"]) == [(0, 60), (20, 67)]
    assert server["total_steps"] == output["browser"]["total_steps"] == 32
