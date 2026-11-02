"""Starter song seeds and preset patch loaders for song-store."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Dict, List

from src.theory_core.arranger import DEFAULT_SONG_BLUEPRINT, unfold_song_sections
from src.theory_core.diagnostics import ensure_fluid_song_graph
from src.theory_core.models import normalize_gesture

PRESETS_DIR = Path(__file__).resolve().parent.parent.parent / "presets"


def load_patch_catalog(presets_dir: Path = PRESETS_DIR) -> Dict[str, Any]:
    """Load the 7 Heavy Bass & Glitch SoundPatch definitions and 5 Gesture Badges from presets/patches.json."""
    patches_path = presets_dir / "patches.json"
    with patches_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_heavy_bass_starter_song() -> Dict[str, Any]:
    """Build the canonical 4-bar 110 BPM G-Dorian Heavy Bass Hocket starter song document."""
    notes: List[Dict[str, Any]] = []

    # 1. 110 BPM Electro-House / Moombahton Drum Groove across 4 bars (64 steps)
    for bar in range(4):
        base = bar * 16
        # Heavy kick on beat 1 (step 0) and syncopated beat 3 (step 8), plus pickup on step 11 in bars 1 & 3
        notes.append({
            "id": f"drum-kick-{base}",
            "step": base + 0,
            "duration_steps": 1,
            "velocity": 0.96,
            "role": "drums",
            "patch_id": "kick",
        })
        notes.append({
            "id": f"drum-kick-{base + 8}",
            "step": base + 8,
            "duration_steps": 1,
            "velocity": 0.94,
            "role": "drums",
            "patch_id": "kick",
        })
        if bar in (1, 3):
            notes.append({
                "id": f"drum-kick-{base + 11}",
                "step": base + 11,
                "duration_steps": 1,
                "velocity": 0.85,
                "role": "drums",
                "patch_id": "kick",
            })

        # Crack snare + clap on beats 2 (step 4) and 4 (step 12)
        for s_off in (4, 12):
            notes.append({
                "id": f"drum-snare-{base + s_off}",
                "step": base + s_off,
                "duration_steps": 1,
                "velocity": 0.95,
                "role": "drums",
                "patch_id": "snare",
            })
            notes.append({
                "id": f"drum-clap-{base + s_off}",
                "step": base + s_off,
                "duration_steps": 1,
                "velocity": 0.82,
                "role": "drums",
                "patch_id": "clap",
            })

        # Offbeat closed hi-hats on steps 2, 6, 10, 14
        for h_off in (2, 6, 10, 14):
            notes.append({
                "id": f"drum-hat-{base + h_off}",
                "step": base + h_off,
                "duration_steps": 1,
                "velocity": 0.72,
                "role": "drums",
                "patch_id": "hat_closed",
            })

    # Bar 4 turnaround snare roll (steps 61, 62, 63)
    for fill_step, vel in ((61, 0.80), (62, 0.88), (63, 0.96)):
        notes.append({
            "id": f"drum-fill-{fill_step}",
            "step": fill_step,
            "duration_steps": 1,
            "velocity": vel,
            "role": "drums",
            "patch_id": "snare",
        })

    # 2. Monophonic Heavy Bass Hocket & Bass Matrix (6 choke-group patches trading off across 4 bars)
    hocket_specs = [
        # Bar 0 (Gm - Home): 808 Sub -> FM Monster Growl -> Talking YOI -> 808 Sub -> Laser Screech -> Vocal Chop
        (0, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.96),
        (2, 2, "hocket", "monster_growl", 0, 0, "wah_bite", 0.92),
        (6, 2, "hocket", "talking_yoi", 1, 0, "vowel_yoi", 0.90),
        (8, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.94),
        (10, 2, "hocket", "laser_screech", 2, 1, "laser_drop", 0.89),
        (14, 2, "hocket", "vocal_chop", 1, 1, "stutter_32", 0.87),
        # Bar 1 (Eb - Lift): 808 Sub -> 1/16 Sync Wobble -> 808 Sub -> FM Monster Growl -> Vocal Chop
        (16, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.96),
        (18, 4, "hocket", "wobble_bass", 0, 0, "wobble_1_16", 0.91),
        (24, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.94),
        (26, 2, "hocket", "monster_growl", 1, 0, "wah_bite", 0.92),
        (30, 2, "hocket", "vocal_chop", 2, 1, "stutter_32", 0.88),
        # Bar 2 (F - Tension): Return of Call A on F chord
        (32, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.96),
        (34, 2, "hocket", "monster_growl", 0, 0, "wah_bite", 0.93),
        (38, 2, "hocket", "talking_yoi", 1, 0, "vowel_yoi", 0.91),
        (40, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.94),
        (42, 2, "hocket", "laser_screech", 2, 1, "laser_drop", 0.90),
        (46, 2, "hocket", "wobble_bass", 1, 0, "wobble_1_8t", 0.88),
        # Bar 3 (Gm - Home Turnaround B): Rapid hocket trade-offs into bar-4 stutter turnaround
        (48, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.97),
        (50, 2, "hocket", "talking_yoi", 2, 0, "vowel_yoi", 0.92),
        (54, 2, "hocket", "wobble_bass", 1, 0, "wobble_1_16", 0.91),
        (56, 2, "bass", "sub_drop_808", 0, 0, "sub_dive", 0.95),
        (58, 2, "hocket", "laser_screech", 0, 1, "laser_drop", 0.92),
        (60, 4, "hocket", "vocal_chop", 0, 1, "stutter_32", 0.94),
    ]
    for step, dur, role, patch_id, ct_idx, oct_off, preset_id, vel in hocket_specs:
        notes.append({
            "id": f"hocket-{step}-{patch_id}",
            "step": step,
            "duration_steps": dur,
            "velocity": vel,
            "role": role,
            "patch_id": patch_id,
            "pitch_lock_mode": "relational",
            "kick_locked": step % 8 == 0,
            "relational": {
                "anchor": "chord_tone",
                "chord_tone_index": ct_idx,
                "scale_degree_offset": 0,
                "octave_offset": oct_off,
                "function_tag": "kick_locked_anchor" if step % 8 == 0 else "offbeat_hocket_response",
            },
            "gesture": normalize_gesture(patch_id, {"preset_id": preset_id}),
        })

    # 3. Lead Call-and-Response Motif (A -> A' -> A -> B) in C4-C6
    lead_specs = [
        (0, 2, 0, 0, "A", 0.84),
        (4, 2, 1, 0, "A", 0.82),
        (8, 2, 2, 0, "A", 0.86),
        (16, 2, 0, 0, "A_prime", 0.84),
        (20, 2, 2, 0, "A_prime", 0.83),
        (24, 2, 1, 0, "A_prime", 0.87),
        (32, 2, 0, 0, "A", 0.85),
        (36, 2, 1, 0, "A", 0.82),
        (40, 2, 2, 0, "A", 0.86),
        (48, 2, 2, 0, "B", 0.88),
        (52, 4, 0, 0, "B", 0.90),
    ]
    for step, dur, ct_idx, deg_off, phrase_tag, vel in lead_specs:
        notes.append({
            "id": f"lead-{step}",
            "step": step,
            "duration_steps": dur,
            "velocity": vel,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "pitch_lock_mode": "relational",
            "relational": {
                "anchor": "chord_tone",
                "chord_tone_index": ct_idx,
                "scale_degree_offset": deg_off,
                "octave_offset": 0,
                "function_tag": f"phrase_{phrase_tag}",
            },
            "gesture": normalize_gesture("supersaw_stab", {"preset_id": "pluck_stab"}),
        })

    return {
        "id": "heavy_bass_110",
        "title": "Heavy Bass Showcase (110 BPM G Dorian)",
        "arrangement_mode": "loop",
        "global_context": {
            "bpm": 110.0,
            "swing": 0.53,
            "root_pc": 7,
            "scale_type": "dorian",
            "bars": 4,
        },
        "active_progression_id": "prog-main",
        "chord_progressions": {
            "prog-main": [
                {"bar": 0, "beats": 4, "degree": 1, "roman": "i", "quality": "min"},
                {"bar": 1, "beats": 4, "degree": 6, "roman": "bVI", "quality": "maj"},
                {"bar": 2, "beats": 4, "degree": 7, "roman": "bVII", "quality": "maj"},
                {"bar": 3, "beats": 4, "degree": 1, "roman": "i", "quality": "min"},
            ]
        },
        "sections": copy.deepcopy(DEFAULT_SONG_BLUEPRINT),
        "auto_harmony_stabs": True,
        "notes": copy.deepcopy(notes),
    }


def build_diagnostic_demo_song() -> Dict[str, Any]:
    """Build an intentionally flawed 4-bar loop seed so users can experience the Diagnostic Ear Coach (Phase 4)."""
    base = build_heavy_bass_starter_song()
    base["id"] = "fix_my_loop_demo"
    base["title"] = "Diagnostic Challenge — Fix My Loop (4 Clashes)"
    # Keep drums from Bar 0..3, keep only Bar 0 hocket with an overlapping collision at step 2, and inject a chromatic clash on step 0
    drums = [n for n in base["notes"] if n.get("role") == "drums"]
    flawed_notes: List[Dict[str, Any]] = list(drums) + [
        {
            "id": "flawed-clash-lead-0",
            "step": 0,
            "duration_steps": 4,
            "velocity": 0.92,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "pitch_lock_mode": "concrete",
            "concrete": {"midi_pitch": 61, "freq_hz": 277.18, "note_name": "C#4", "micro_offset_ms": 0.0},
            "gesture": normalize_gesture("supersaw_stab", {"preset_id": "pluck_stab"}),
        },
        {
            "id": "flawed-mud-growl-2",
            "step": 2,
            "duration_steps": 4,
            "velocity": 0.92,
            "role": "hocket",
            "patch_id": "monster_growl",
            "pitch_lock_mode": "relational",
            "relational": {"anchor": "chord_tone", "chord_tone_index": 0, "scale_degree_offset": 0, "octave_offset": 0},
            "gesture": normalize_gesture("monster_growl", {"preset_id": "wah_bite"}),
        },
        {
            "id": "flawed-mud-wobble-3",
            "step": 3,
            "duration_steps": 4,
            "velocity": 0.90,
            "role": "hocket",
            "patch_id": "wobble_bass",
            "pitch_lock_mode": "relational",
            "relational": {"anchor": "chord_tone", "chord_tone_index": 0, "scale_degree_offset": 0, "octave_offset": 0},
            "gesture": normalize_gesture("wobble_bass", {"preset_id": "wobble_1_16"}),
        },
    ]
    base["notes"] = flawed_notes
    return base


def build_flawed_diagnostic_seed() -> Dict[str, Any]:
    """Build an intentionally flawed 4-bar beginner loop for testing the Diagnostic Ear Coach ('Fix My Loop')."""
    base = build_heavy_bass_starter_song()
    base["id"] = "flawed_beginner_loop"
    base["title"] = "Diagnostic Demo: 4 Beginner Traps (Click 'Fix My Loop')"
    # Keep drums from Bar 0-3, but replace hocket & lead with 4 classic beginner mistakes:
    drum_notes = [n for n in base["notes"] if n.get("role") == "drums"]
    flawed_notes = drum_notes + [
        # Mistake 1 & 2: Off-kick bass + overlapping monster mud collision on steps 2 & 3, only in Bar 1 (Mistake 3: 4-bar monotony)
        {
            "id": "flaw-growl-2",
            "step": 2,
            "duration_steps": 4,
            "velocity": 0.92,
            "role": "hocket",
            "patch_id": "monster_growl",
            "pitch_lock_mode": "relational",
            "relational": {"anchor": "chord_tone", "chord_tone_index": 0, "scale_degree_offset": 0, "octave_offset": 0},
            "gesture": normalize_gesture("monster_growl", {"preset_id": "wah_bite"}),
        },
        {
            "id": "flaw-wobble-3",
            "step": 3,
            "duration_steps": 4,
            "velocity": 0.90,
            "role": "bass",
            "patch_id": "wobble_bass",
            "pitch_lock_mode": "relational",
            "relational": {"anchor": "chord_tone", "chord_tone_index": 1, "scale_degree_offset": 0, "octave_offset": 0},
            "gesture": normalize_gesture("wobble_bass", {"preset_id": "wobble_1_16"}),
        },
        # Mistake 4: Unresolved downbeat semitone clash in Lead (Ab4 / MIDI 68 held for 4 steps over Gm on Step 0)
        {
            "id": "flaw-clash-lead-0",
            "step": 0,
            "duration_steps": 4,
            "velocity": 0.90,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "pitch_lock_mode": "concrete",
            "concrete": {"midi_pitch": 68},
            "gesture": normalize_gesture("supersaw_stab", {"preset_id": "pluck_stab"}),
        },
    ]
    base["notes"] = flawed_notes
    return base



def build_neutral_starter_seed() -> Dict[str, Any]:
    """Build the Genre-Neutral Default Starter Seed ('starter_neutral_100_cm': Warm Keys & Clean Groove).

    Defaults to `arrangement_mode = "song"` (`selected_song_arc = "arc_radio_hit"`, unfolded across 28 bars)
    so a default song is always a complete multi-section song (Blocker B2), never a 9.8-second loop.
    """
    notes: List[Dict[str, Any]] = []

    for bar in range(4):
        base = bar * 16
        for k_off in (0, 8):
            notes.append({
                "id": f"neutral-kick-{base + k_off}",
                "step": base + k_off,
                "duration_steps": 1,
                "velocity": 0.92,
                "role": "drums",
                "patch_id": "kick",
                "provenance": "seed_template",
            })
        for s_off in (4, 12):
            notes.append({
                "id": f"neutral-snare-{base + s_off}",
                "step": base + s_off,
                "duration_steps": 1,
                "velocity": 0.88,
                "role": "drums",
                "patch_id": "snare",
                "provenance": "seed_template",
            })
        for h_off in (2, 6, 10, 14):
            notes.append({
                "id": f"neutral-hat-{base + h_off}",
                "step": base + h_off,
                "duration_steps": 1,
                "velocity": 0.68,
                "role": "drums",
                "patch_id": "hat_closed",
                "provenance": "seed_template",
            })

        # Clean Bass locked to Beat 1 and Beat 3 kicks, plus pickup on step 14
        notes.append({
            "id": f"neutral-bass-{base}",
            "step": base + 0,
            "duration_steps": 3,
            "velocity": 0.90,
            "role": "bass",
            "patch_id": "clean_bass",
            "pitch_lock_mode": "relational",
            "provenance": "seed_template",
            "relational": {"anchor": "chord_tone", "chord_tone_index": 0, "scale_degree_offset": 0, "octave_offset": 0},
            "gesture": normalize_gesture("clean_bass", {"preset_id": "sub_dive"}),
        })
        notes.append({
            "id": f"neutral-bass-{base + 8}",
            "step": base + 8,
            "duration_steps": 3,
            "velocity": 0.86,
            "role": "bass",
            "patch_id": "clean_bass",
            "pitch_lock_mode": "relational",
            "provenance": "seed_template",
            "relational": {"anchor": "chord_tone", "chord_tone_index": 2, "scale_degree_offset": 0, "octave_offset": 0},
            "gesture": normalize_gesture("clean_bass", {"preset_id": "sub_dive"}),
        })

        # Pluck Lead Call & Response starting phrase (seed_template until user shapes or chooses their own)
        lead_pattern = [
            (0, 2, 0, 0),
            (4, 2, 1, 0),
            (6, 2, 2, 0),
            (10, 2, 1 if bar % 2 == 0 else 0, 0),
        ]
        for s_off, dur, ct_idx, deg_off in lead_pattern:
            notes.append({
                "id": f"neutral-lead-{base + s_off}",
                "step": base + s_off,
                "duration_steps": dur,
                "velocity": 0.86,
                "role": "lead",
                "patch_id": "pluck_lead",
                "pitch_lock_mode": "relational",
                "provenance": "seed_template",
                "relational": {
                    "anchor": "chord_tone",
                    "chord_tone_index": ct_idx,
                    "scale_degree_offset": deg_off,
                    "octave_offset": 0,
                },
                "gesture": normalize_gesture("pluck_lead", {"preset_id": "pluck_stab"}),
            })

    doc: Dict[str, Any] = {
        "schema_version": 1,
        "id": "starter_neutral_100_cm",
        "title": "MusicLab — Warm Keys & Clean Groove",
        "genre_family": "neutral_pop_indie",
        "genre_preset": "neutral_starter",
        "harmony_patch_id": "warm_keys",
        "bass_patch_id": "clean_bass",
        "lead_patch_id": "pluck_lead",
        "arrangement_mode": "song",
        "selected_song_arc": "arc_radio_hit",
        "auto_harmony_stabs": True,
        "scaffold_options": {
            "voice_leading": "smooth",
            "hocket_choke": True,
            "humanize": True,
            "pre_drop_silence": True,
            "harmony_display_mode": "post_placement",
        },
        "global_context": {
            "bpm": 100.0,
            "swing": 0.52,
            "root_pc": 0,
            "scale_type": "major",
            "bars": 4,
        },
        "active_progression_id": "prog-main",
        "chord_progressions": {
            "prog-main": [
                {"bar": 0, "beats": 4, "degree": 1, "roman": "I", "quality": "maj"},
                {"bar": 1, "beats": 4, "degree": 5, "roman": "V", "quality": "maj"},
                {"bar": 2, "beats": 4, "degree": 6, "roman": "vi", "quality": "min"},
                {"bar": 3, "beats": 4, "degree": 4, "roman": "IV", "quality": "maj"},
            ]
        },
        "sections": copy.deepcopy(DEFAULT_SONG_BLUEPRINT),
        "notes": notes,
    }
    doc = unfold_song_sections(doc, arc_id="arc_radio_hit")
    ensure_fluid_song_graph(doc)
    return doc
