"""Data models, scale tables, and perceptual gesture mappings for theory-core."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
import math
from typing import Any

NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

SCALES: dict[str, list[int]] = {
    "natural_minor": [0, 2, 3, 5, 7, 8, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "major": [0, 2, 4, 5, 7, 9, 11],
    "phrygian_dominant": [0, 1, 4, 5, 7, 8, 10],
}

VOWELS = ("A", "E", "I", "O", "U")
LFO_RATES = ("off", "1/2", "1/4", "1/8", "1/8t", "1/16", "1/32")

MONSTER_CHOKE_PATCHES = frozenset({
    "monster_growl",
    "talking_yoi",
    "wobble_bass",
    "sub_drop_808",
    "laser_screech",
    "vocal_chop",
})

NEUTRAL_SYNTH_PATCHES = frozenset({
    "warm_keys",
    "clean_bass",
    "pluck_lead",
})

ALL_SYNTH_PATCHES = frozenset({
    "supersaw_stab",
    *MONSTER_CHOKE_PATCHES,
    *NEUTRAL_SYNTH_PATCHES,
})

GESTURE_PRESETS: dict[str, dict[str, Any]] = {
    "vowel_yoi": {
        "preset_id": "vowel_yoi",
        "shape": "ramp_up_down",
        "vowel_start": "O",
        "vowel_end": "I",
        "lfo_rate": "1/8",
        "grit": 0.82,
        "pitch_bend_st": 0,
        "stutter_div": "off",
        "ott_punch": 0.85,
        "xy_pad": {"x": 0.78, "y": 0.82},
    },
    "wah_bite": {
        "preset_id": "wah_bite",
        "shape": "ramp_up_down",
        "vowel_start": "U",
        "vowel_end": "A",
        "lfo_rate": "1/4",
        "grit": 0.88,
        "pitch_bend_st": 0,
        "stutter_div": "off",
        "ott_punch": 0.88,
        "xy_pad": {"x": 0.42, "y": 0.88},
    },
    "wobble_1_16": {
        "preset_id": "wobble_1_16",
        "shape": "lfo_sync",
        "vowel_start": "A",
        "vowel_end": "U",
        "lfo_rate": "1/16",
        "grit": 0.74,
        "pitch_bend_st": 0,
        "stutter_div": "off",
        "ott_punch": 0.82,
        "xy_pad": {"x": 0.88, "y": 0.74},
    },
    "wobble_1_8t": {
        "preset_id": "wobble_1_8t",
        "shape": "lfo_sync",
        "vowel_start": "O",
        "vowel_end": "A",
        "lfo_rate": "1/8t",
        "grit": 0.70,
        "pitch_bend_st": 0,
        "stutter_div": "off",
        "ott_punch": 0.80,
        "xy_pad": {"x": 0.68, "y": 0.70},
    },
    "laser_drop": {
        "preset_id": "laser_drop",
        "shape": "laser_attack",
        "vowel_start": "E",
        "vowel_end": "I",
        "lfo_rate": "off",
        "grit": 0.85,
        "pitch_bend_st": 12,
        "stutter_div": "off",
        "ott_punch": 0.90,
        "xy_pad": {"x": 0.92, "y": 0.85},
    },
    "stutter_32": {
        "preset_id": "stutter_32",
        "shape": "stutter_gate",
        "vowel_start": "A",
        "vowel_end": "I",
        "lfo_rate": "1/16",
        "grit": 0.65,
        "pitch_bend_st": 3,
        "stutter_div": "1/32",
        "ott_punch": 0.84,
        "xy_pad": {"x": 0.84, "y": 0.65},
    },
    "pluck_stab": {
        "preset_id": "pluck_stab",
        "shape": "pluck_stab",
        "vowel_start": "A",
        "vowel_end": "E",
        "lfo_rate": "off",
        "grit": 0.45,
        "pitch_bend_st": 0,
        "stutter_div": "off",
        "ott_punch": 0.75,
        "xy_pad": {"x": 0.55, "y": 0.45},
    },
    "sub_dive": {
        "preset_id": "sub_dive",
        "shape": "laser_dive",
        "vowel_start": "U",
        "vowel_end": "O",
        "lfo_rate": "off",
        "grit": 0.28,
        "pitch_bend_st": -12,
        "stutter_div": "off",
        "ott_punch": 0.70,
        "xy_pad": {"x": 0.15, "y": 0.28},
    },
}

DEFAULT_PATCH_GESTURE: dict[str, str] = {
    "monster_growl": "vowel_yoi",
    "talking_yoi": "vowel_yoi",
    "wobble_bass": "wobble_1_16",
    "sub_drop_808": "sub_dive",
    "laser_screech": "laser_drop",
    "vocal_chop": "stutter_32",
    "supersaw_stab": "pluck_stab",
    "warm_keys": "pluck_stab",
    "clean_bass": "sub_dive",
    "pluck_lead": "pluck_stab",
}


def midi_to_freq(midi_pitch: float) -> float:
    """Convert a MIDI note number to frequency in Hz (A4 = 69 = 440.0 Hz)."""
    return round(440.0 * math.pow(2.0, (float(midi_pitch) - 69.0) / 12.0), 4)


def midi_to_name(midi_pitch: int) -> str:
    """Convert integer MIDI note number to note name with octave (e.g. 31 -> G1)."""
    pc = int(midi_pitch) % 12
    octave = (int(midi_pitch) // 12) - 1
    return f"{NOTE_NAMES[pc]}{octave}"


def normalize_gesture(patch_id: str, gesture: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return a complete, validated NoteGesture dictionary for a given patch_id."""
    default_key = DEFAULT_PATCH_GESTURE.get(patch_id, "vowel_yoi")
    base = dict(GESTURE_PRESETS[default_key])
    base["xy_pad"] = dict(base["xy_pad"])
    if gesture:
        if "preset_id" in gesture and gesture["preset_id"] in GESTURE_PRESETS and len(gesture) == 1:
            preset_copy = dict(GESTURE_PRESETS[gesture["preset_id"]])
            preset_copy["xy_pad"] = dict(preset_copy["xy_pad"])
            return preset_copy
        for key in (
            "preset_id",
            "shape",
            "vowel_start",
            "vowel_end",
            "lfo_rate",
            "grit",
            "pitch_bend_st",
            "stutter_div",
            "ott_punch",
        ):
            if key in gesture and gesture[key] is not None:
                base[key] = gesture[key]
        if isinstance(gesture.get("xy_pad"), dict):
            base["xy_pad"] = {
                "x": max(0.0, min(1.0, float(gesture["xy_pad"].get("x", base["xy_pad"]["x"])))),
                "y": max(0.0, min(1.0, float(gesture["xy_pad"].get("y", base["xy_pad"]["y"])))),
            }
    base["grit"] = round(max(0.0, min(1.0, float(base["grit"]))), 3)
    base["ott_punch"] = round(max(0.0, min(1.0, float(base["ott_punch"]))), 3)
    base["pitch_bend_st"] = int(max(-24, min(24, int(base["pitch_bend_st"]))))
    if base["vowel_start"] not in VOWELS:
        base["vowel_start"] = "O"
    if base["vowel_end"] not in VOWELS:
        base["vowel_end"] = "I"
    return base


def gesture_from_xy(
    patch_id: str,
    x: float,
    y: float,
    base_gesture: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Map 2D X/Y Monster Pad coordinates in [0, 1]^2 to coupled heavy-bass gesture parameters."""
    gx = max(0.0, min(1.0, float(x)))
    gy = max(0.0, min(1.0, float(y)))
    g = normalize_gesture(patch_id, base_gesture)
    g["xy_pad"] = {"x": round(gx, 3), "y": round(gy, 3)}
    g["grit"] = round(0.15 + 0.85 * gy, 3)
    g["ott_punch"] = round(0.35 + 0.60 * gy, 3)

    vowel_pairs = [("U", "O"), ("O", "A"), ("A", "E"), ("O", "I"), ("E", "I")]
    pair_idx = min(len(vowel_pairs) - 1, int(gx * len(vowel_pairs)))
    v_start, v_end = vowel_pairs[pair_idx]
    g["vowel_start"] = v_start
    g["vowel_end"] = v_end

    if patch_id == "wobble_bass":
        rates = ["1/4", "1/8", "1/8t", "1/16", "1/32"]
        g["lfo_rate"] = rates[min(len(rates) - 1, int(gx * len(rates)))]
        g["shape"] = "lfo_sync"
    elif patch_id == "laser_screech":
        g["pitch_bend_st"] = 24 if gx >= 0.65 else (12 if gx >= 0.3 else -12)
        g["shape"] = "laser_attack" if g["pitch_bend_st"] > 0 else "laser_dive"
    elif patch_id == "vocal_chop":
        g["stutter_div"] = "1/32" if gx >= 0.6 else "1/16"
        g["shape"] = "stutter_gate"
    return g
