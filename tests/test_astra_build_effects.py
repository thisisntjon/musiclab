"""Automatic swell removal must not remove deliberately placed sound effects."""
import copy

from src.theory_core import compile_song


def test_big_section_never_injects_swell_and_personal_effects_survive():
    notes = [
        {"id": patch, "role": "lead", "patch_id": patch, "step": i * 8,
         "duration_steps": 2, "velocity": .3, "pitch_lock_mode": "concrete",
         "concrete": {"midi_pitch": 60}, "provenance": "user_placed"}
        for i, patch in enumerate(["reverse_swell", "sub_drop_808"])
    ]
    doc = {"id": "manual-fx", "global_context": {"bpm": 120, "bars": 4,
           "root_pc": 0, "scale_type": "major", "swing": .5},
           "auto_harmony_stabs": False, "notes": notes,
           "song_cards": [{"under": True}, {"under": True, "big": True}]}
    before = copy.deepcopy(doc)
    result = compile_song(doc)
    assert doc == before
    assert not any(e["id"].startswith("fx-swell-") for e in result["events"])
    for patch in ["reverse_swell", "sub_drop_808"]:
        events = [e for e in result["events"] if e["patch_id"] == patch
                  and e["provenance"] == "user_placed"]
        assert len(events) == 2
        assert all(e["provenance"] == "user_placed" for e in events)
