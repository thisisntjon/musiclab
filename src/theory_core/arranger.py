"""Subtractive Song Blueprint, Section Energy Sculpting, and Build-to-Drop Transitions (Phase 2)."""

from __future__ import annotations

import copy
from typing import Any, Dict, List

from src.theory_core.hocket import apply_monophonic_hocket_choke
from src.theory_core.models import normalize_gesture

DEFAULT_SONG_BLUEPRINT: List[Dict[str, Any]] = [
    {
        "id": "sec_intro",
        "name": "Intro — Atmospheric Hook",
        "type": "intro",
        "bars": 4,
        "energy": 0.28,
        "active_roles": ["harmony", "lead"],
        "transition": "riser_sweep",
        "why_label": "Intro (28% Energy): Strips out heavy drums and monster bass so the Harmony Spine and Lead Hook establish the key before the groove drops.",
        "overrides": {"added_notes": [], "muted_steps": []},
    },
    {
        "id": "sec_verse",
        "name": "Verse — 110 BPM Pocket",
        "type": "verse",
        "bars": 4,
        "energy": 0.56,
        "active_roles": ["drums", "harmony", "bass", "lead"],
        "transition": "turnaround_fill",
        "why_label": "Verse (56% Energy): Brings in the 110 BPM Kick/Snare pocket and 808 Sub anchors while holding back the off-beat Monster Growls for the Drop.",
        "overrides": {"added_notes": [], "muted_steps": []},
    },
    {
        "id": "sec_build",
        "name": "Build — Snare Roll & Pre-Drop Fakeout",
        "type": "build",
        "bars": 4,
        "energy": 0.78,
        "active_roles": ["drums", "harmony", "lead"],
        "transition": "pre_drop_silence",
        "why_label": "Build (78% Energy): Accelerates snare hits (1/4 -> 1/8 -> 1/16) and cuts to complete silence on Beat 4 (steps 60-63) with a Vocal Chop shout so the Drop hits harder.",
        "overrides": {"added_notes": [], "muted_steps": []},
    },
    {
        "id": "sec_drop_1",
        "name": "Drop 1 — Heavy Bass Full Hocket",
        "type": "drop",
        "bars": 4,
        "energy": 1.00,
        "active_roles": ["drums", "harmony", "bass", "hocket", "lead"],
        "transition": "sub_drop_impact",
        "why_label": "Drop 1 (Full Energy): Unleashes the full Monophonic Hocket Matrix (FM Growls, Talking Bass, 1/16 Wobble, Laser Whip, Vocal Chop) at full multiband punch.",
        "overrides": {"added_notes": [], "muted_steps": []},
    },
    {
        "id": "sec_breakdown",
        "name": "Breakdown — Melodic Contrast",
        "type": "breakdown",
        "bars": 4,
        "energy": 0.38,
        "active_roles": ["harmony", "lead"],
        "transition": "pre_drop_silence",
        "why_label": "Breakdown (38% Energy): Clears the low end to reset ear fatigue before launching into Drop 2.",
        "overrides": {"added_notes": [], "muted_steps": []},
    },
    {
        "id": "sec_drop_2",
        "name": "Drop 2 — Max Grit Climax",
        "type": "drop",
        "bars": 4,
        "energy": 1.00,
        "active_roles": ["drums", "harmony", "bass", "hocket", "lead"],
        "transition": "sub_drop_impact",
        "why_label": "Drop 2 (100% Energy): Second full-energy hocket climax with heightened FM grit and Bar-4 stutter turnaround.",
        "overrides": {"added_notes": [], "muted_steps": []},
    },
    {
        "id": "sec_outro",
        "name": "Outro — Sub & Harmony Resolve",
        "type": "outro",
        "bars": 4,
        "energy": 0.24,
        "active_roles": ["drums", "harmony"],
        "transition": "outro_resolve",
        "why_label": "Outro (24% Energy): Winds down drum density and resolves on the Home chord.",
        "overrides": {"added_notes": [], "muted_steps": []},
    },
]

GENERAL_SONG_BLUEPRINTS: Dict[str, List[Dict[str, Any]]] = {
    "arc_radio_hit": [
        {
            "id": "sec_intro",
            "name": "Intro — Warm Opening",
            "type": "intro",
            "bars": 4,
            "energy": 0.30,
            "active_roles": ["harmony", "lead"],
            "transition": "intro_swell",
            "why_label": "Starts with chords and a hint of your melody so the listener settles into the mood.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_verse",
            "name": "Verse — Steady Groove",
            "type": "verse",
            "bars": 4,
            "energy": 0.56,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "turnaround_fill",
            "why_label": "Brings in the beat and bass foundation underneath your phrase.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_build",
            "name": "Pre-Chorus — Rising Lift",
            "type": "build",
            "bars": 4,
            "energy": 0.76,
            "active_roles": ["drums", "harmony", "lead"],
            "transition": "pre_chorus_pause",
            "why_label": "Builds momentum and leaves a brief breath right before the Chorus opens up.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_drop_1",
            "name": "Chorus 1 — Full Lift",
            "type": "chorus",
            "bars": 4,
            "energy": 1.00,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "chorus_lift",
            "why_label": "Opens up the full arrangement and doubles your melody an octave higher on key beats.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_breakdown",
            "name": "Bridge — Breathing Room",
            "type": "breakdown",
            "bars": 4,
            "energy": 0.38,
            "active_roles": ["harmony", "lead"],
            "transition": "pre_chorus_pause",
            "why_label": "Drops the heavy beat back for a moment of contrast so the final chorus feels fresh.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_drop_2",
            "name": "Final Chorus — Big Payoff",
            "type": "chorus",
            "bars": 4,
            "energy": 1.00,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "chorus_lift",
            "why_label": "Brings every layer back together with the upper-octave melody lift for the climax.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_outro",
            "name": "Outro — Gentle Landing",
            "type": "outro",
            "bars": 4,
            "energy": 0.25,
            "active_roles": ["drums", "harmony"],
            "transition": "outro_resolve",
            "why_label": "Winds the beat down and lets the final chord ring home.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
    ],
    "arc_early_lift": [
        {
            "id": "sec_intro",
            "name": "Quick Intro — Right In",
            "type": "intro",
            "bars": 4,
            "energy": 0.45,
            "active_roles": ["drums", "harmony", "lead"],
            "transition": "turnaround_fill",
            "why_label": "Jumps straight into the pulse and melody with zero waiting.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_drop_1",
            "name": "Early Chorus — Immediate Hook",
            "type": "chorus",
            "bars": 4,
            "energy": 0.96,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "chorus_lift",
            "why_label": "Delivers the full chorus and octave melody lift right away.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_verse",
            "name": "Verse — Deep Pocket",
            "type": "verse",
            "bars": 4,
            "energy": 0.58,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "turnaround_fill",
            "why_label": "Settles into a warm groove after the opening hook.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_build",
            "name": "Pre-Chorus — Second Lift",
            "type": "build",
            "bars": 4,
            "energy": 0.78,
            "active_roles": ["drums", "harmony", "lead"],
            "transition": "pre_chorus_pause",
            "why_label": "Ramps the energy back up toward the main chorus.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_drop_2",
            "name": "Main Chorus — Full Energy",
            "type": "chorus",
            "bars": 4,
            "energy": 1.00,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "chorus_lift",
            "why_label": "Full arrangement with upper-octave lead shine.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_breakdown",
            "name": "Bridge — Warm Contrast",
            "type": "breakdown",
            "bars": 4,
            "energy": 0.40,
            "active_roles": ["harmony", "lead"],
            "transition": "intro_swell",
            "why_label": "Gives the listener a quiet breath before the outro.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_outro",
            "name": "Outro — Warm Fade",
            "type": "outro",
            "bars": 4,
            "energy": 0.26,
            "active_roles": ["drums", "harmony"],
            "transition": "outro_resolve",
            "why_label": "Smoothly resolves the song on the home chord.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
    ],
    "arc_two_peaks": [
        {
            "id": "sec_intro",
            "name": "Intro — Gentle Setup",
            "type": "intro",
            "bars": 4,
            "energy": 0.28,
            "active_roles": ["harmony", "lead"],
            "transition": "intro_swell",
            "why_label": "Sets the stage softly with chords and melody.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_verse",
            "name": "Verse — Rising Motion",
            "type": "verse",
            "bars": 4,
            "energy": 0.62,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "pre_chorus_pause",
            "why_label": "Builds steady momentum toward the first peak.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_drop_1",
            "name": "First Peak — High Chorus",
            "type": "chorus",
            "bars": 4,
            "energy": 1.00,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "chorus_lift",
            "why_label": "First full-energy chorus peak with octave melody lift.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_breakdown",
            "name": "Valley — Quiet Breath",
            "type": "breakdown",
            "bars": 4,
            "energy": 0.32,
            "active_roles": ["harmony", "lead"],
            "transition": "intro_swell",
            "why_label": "Pulls the drums and bass away to create space between the two peaks.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_build",
            "name": "Climb — Building Back",
            "type": "build",
            "bars": 4,
            "energy": 0.78,
            "active_roles": ["drums", "harmony", "lead"],
            "transition": "pre_chorus_pause",
            "why_label": "Climbs out of the quiet valley toward the final payoff.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_drop_2",
            "name": "Second Peak — Grand Chorus",
            "type": "chorus",
            "bars": 4,
            "energy": 1.00,
            "active_roles": ["drums", "harmony", "bass", "lead"],
            "transition": "chorus_lift",
            "why_label": "Second high-energy peak with full instrumentation and octave lead lift.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
        {
            "id": "sec_outro",
            "name": "Outro — Peaceful Finish",
            "type": "outro",
            "bars": 4,
            "energy": 0.24,
            "active_roles": ["drums", "harmony"],
            "transition": "outro_resolve",
            "why_label": "Lets the energy settle back home.",
            "overrides": {"added_notes": [], "muted_steps": []},
        },
    ],
}


def unfold_song_sections(song_doc: Dict[str, Any], arc_id: str | None = None) -> Dict[str, Any]:
    """Unfold a 4-bar loop document into a 7-section, 28-bar Subtractive Song Blueprint."""
    updated = copy.deepcopy(song_doc)
    effective_arc = arc_id or updated.get("selected_song_arc")
    is_general = (
        effective_arc in GENERAL_SONG_BLUEPRINTS
        or updated.get("genre_preset") == "neutral_starter"
    )
    if is_general:
        blueprint = GENERAL_SONG_BLUEPRINTS.get(str(effective_arc), GENERAL_SONG_BLUEPRINTS["arc_radio_hit"])
        updated["sections"] = copy.deepcopy(blueprint)
    elif not updated.get("sections") or len(updated["sections"]) < 5:
        updated["sections"] = copy.deepcopy(DEFAULT_SONG_BLUEPRINT)
    updated["arrangement_mode"] = "song"
    return updated


def _project_section_notes(
    sec: Dict[str, Any],
    sec_idx: int,
    sec_start_step: int,
    core_notes: List[Dict[str, Any]],
    core_steps: int = 64,
    pre_drop_silence_enabled: bool = True,
) -> List[Dict[str, Any]]:
    """Project core 4-bar loop notes into a section with energy scaling, role filtering, and transitions."""
    sec_bars = max(1, int(sec.get("bars", 4)))
    sec_steps = sec_bars * 16
    energy = max(0.05, min(1.0, float(sec.get("energy", 1.0))))
    active_roles = set(sec.get("active_roles") or ["drums", "harmony", "bass", "hocket", "lead"])
    transition = str(sec.get("transition", "none"))
    sec_type = str(sec.get("type", "drop"))
    overrides = sec.get("overrides") or {}
    muted_steps = set(int(s) for s in (overrides.get("muted_steps") or []))

    vel_scale = 0.42 + 0.58 * energy
    grit_scale = 0.40 + 0.60 * energy
    projected: List[Dict[str, Any]] = []

    # Pre-drop / Pre-chorus silence window on the final beat (last 4 steps)
    silence_start_rel = (
        (sec_steps - 4)
        if (transition in ("pre_drop_silence", "pre_chorus_pause") and pre_drop_silence_enabled)
        else sec_steps + 999
    )

    for base_note in core_notes:
        role = base_note.get("role", "lead")
        if role not in active_roles:
            continue

        rel_step = int(base_note.get("step", 0)) % core_steps
        for rep in range(0, sec_steps, core_steps):
            local_step = rep + rel_step
            if local_step >= sec_steps:
                continue
            if local_step in muted_steps or local_step >= silence_start_rel:
                continue

            # Subtractive density rules by energy tier
            if energy <= 0.35:
                # Low energy (Intro/Outro): sparse rhythms only (every 4th or 8th step)
                if role == "drums" and base_note.get("patch_id") not in ("hat_closed", "kick"):
                    continue
                if role == "drums" and (local_step % 8 != 0):
                    continue
                if role == "lead" and (local_step % 8 != 0):
                    continue
            elif energy <= 0.65:
                # Medium energy (Verse): keep kick/snare/hat, harmony, lead, and downbeat bass anchors only
                if role == "bass" and (local_step % 8 != 0):
                    continue

            # In a Build section, replace standard drums in Bars 3-4 with an accelerating snare build
            if (sec_type == "build" or transition in ("pre_drop_silence", "pre_chorus_pause")) and role == "drums" and local_step >= sec_steps // 2:
                continue

            n = copy.deepcopy(base_note)
            global_step = sec_start_step + local_step
            n["step"] = global_step
            n["section_id"] = sec.get("id", f"sec_{sec_idx}")
            n["id"] = f"{sec.get('id', f'sec{sec_idx}')}-{base_note.get('id', 'n')}-{local_step}"
            n["velocity"] = round(max(0.20, min(1.0, float(n.get("velocity", 0.85)) * vel_scale)), 4)

            if isinstance(n.get("gesture"), dict):
                g = copy.deepcopy(n["gesture"])
                g["grit"] = round(max(0.10, min(1.0, float(g.get("grit", 0.75)) * grit_scale)), 3)
                g["ott_punch"] = round(max(0.20, min(1.0, float(g.get("ott_punch", 0.80)) * vel_scale)), 3)
                n["gesture"] = g

            projected.append(n)

            # Automatic Chorus +1 Octave Lead Lift on strong beats (every 4 steps)
            if (sec_type == "chorus" or transition == "chorus_lift") and role == "lead" and (local_step % 4 == 0):
                oct_n = copy.deepcopy(n)
                oct_n["id"] = f"{n['id']}-octlift"
                oct_n["velocity"] = round(max(0.20, min(0.88, float(n["velocity"]) * 0.76)), 4)
                oct_n["transition_tag"] = "chorus_octave_lift"
                if oct_n.get("pitch_lock_mode") == "concrete" and isinstance(oct_n.get("concrete"), dict):
                    oct_n["concrete"]["midi_pitch"] = min(96, int(oct_n["concrete"].get("midi_pitch", 60)) + 12)
                else:
                    oct_n.setdefault("relational", {})
                    oct_n["relational"]["octave_offset"] = int(oct_n["relational"].get("octave_offset", 0)) + 1
                projected.append(oct_n)

    # Inject deterministic boundary transitions & Bar-4/8 turnarounds
    if transition == "riser_sweep":
        # Ascending pitch-whip riser on final bar of Intro
        riser_step = sec_start_step + max(0, sec_steps - 16)
        projected.append({
            "id": f"{sec.get('id', 'sec')}-transition-riser",
            "step": riser_step,
            "duration_steps": 12,
            "velocity": round(0.55 * vel_scale, 3),
            "role": "hocket",
            "patch_id": "laser_screech",
            "section_id": sec.get("id", f"sec_{sec_idx}"),
            "transition_tag": "riser_sweep",
            "pitch_lock_mode": "relational",
            "relational": {"anchor": "chord_tone", "chord_tone_index": 0, "scale_degree_offset": 0, "octave_offset": 0},
            "gesture": normalize_gesture("laser_screech", {"preset_id": "laser_drop", "pitch_bend_st": -12, "grit": 0.45}),
        })

    elif transition == "intro_swell":
        # Gentle open-hat cymbal swell on the final beat of Intro/Bridge
        if sec_steps >= 4:
            projected.append({
                "id": f"{sec.get('id', 'sec')}-intro-swell-hat",
                "step": sec_start_step + (sec_steps - 4),
                "duration_steps": 4,
                "velocity": round(0.68 * vel_scale, 3),
                "role": "drums",
                "patch_id": "hat_open",
                "section_id": sec.get("id", f"sec_{sec_idx}"),
                "transition_tag": "intro_swell",
            })

    elif transition == "turnaround_fill":
        # Bar-4 snare turnaround roll on last 4 steps
        for offset, vel in ((4, 0.68), (3, 0.74), (2, 0.82), (1, 0.90)):
            if sec_steps >= offset:
                projected.append({
                    "id": f"{sec.get('id', 'sec')}-turnaround-snare-{offset}",
                    "step": sec_start_step + (sec_steps - offset),
                    "duration_steps": 1,
                    "velocity": round(vel * vel_scale, 3),
                    "role": "drums",
                    "patch_id": "snare",
                    "section_id": sec.get("id", f"sec_{sec_idx}"),
                    "transition_tag": "turnaround_fill",
                })

    elif transition == "pre_chorus_pause":
        # Clean general-music pre-chorus snare lift in Bar 3 and beats 1-3 of Bar 4, followed by a 1-beat breath (no vocal_chop/laser_screech)
        half_step = sec_steps // 2
        q_step = sec_steps - 16
        for s in range(half_step, max(half_step, q_step), 4):
            projected.append({
                "id": f"{sec.get('id', 'sec')}-prechorus-snare4-{s}",
                "step": sec_start_step + s,
                "duration_steps": 1,
                "velocity": round(0.70 * vel_scale, 3),
                "role": "drums",
                "patch_id": "snare",
                "section_id": sec.get("id", f"sec_{sec_idx}"),
                "transition_tag": "pre_chorus_pause",
            })
        snare_end_rel = max(0, sec_steps - 4) if pre_drop_silence_enabled else sec_steps
        for s in range(max(0, q_step), snare_end_rel, 2):
            prog_ratio = (s - q_step) / max(1, (snare_end_rel - q_step))
            projected.append({
                "id": f"{sec.get('id', 'sec')}-prechorus-snare8-{s}",
                "step": sec_start_step + s,
                "duration_steps": 1,
                "velocity": round((0.72 + 0.22 * prog_ratio) * vel_scale, 3),
                "role": "drums",
                "patch_id": "snare",
                "section_id": sec.get("id", f"sec_{sec_idx}"),
                "transition_tag": "pre_chorus_pause",
            })

    elif transition == "pre_drop_silence":
        # Accelerating snare build across second half of section, stopping 4 steps before the end
        half_step = sec_steps // 2
        q_step = sec_steps - 16
        # Bar 3: 8th-note snares (every 2 steps)
        for s in range(half_step, max(half_step, q_step), 2):
            projected.append({
                "id": f"{sec.get('id', 'sec')}-build-snare8-{s}",
                "step": sec_start_step + s,
                "duration_steps": 1,
                "velocity": round(0.72 * vel_scale, 3),
                "role": "drums",
                "patch_id": "snare",
                "section_id": sec.get("id", f"sec_{sec_idx}"),
                "transition_tag": "snare_build",
            })
        # Bar 4 beats 1-3 (steps 48..59, or through 63 if pre_drop_silence is bypassed): 16th-note accelerating snare roll
        snare_end_rel = max(0, sec_steps - 4) if pre_drop_silence_enabled else sec_steps
        for s in range(max(0, q_step), snare_end_rel):
            prog_ratio = (s - q_step) / max(1, (snare_end_rel - q_step))
            projected.append({
                "id": f"{sec.get('id', 'sec')}-build-snare16-{s}",
                "step": sec_start_step + s,
                "duration_steps": 1,
                "velocity": round((0.74 + 0.24 * prog_ratio) * vel_scale, 3),
                "role": "drums",
                "patch_id": "snare",
                "section_id": sec.get("id", f"sec_{sec_idx}"),
                "transition_tag": "snare_build",
            })
        # Pre-Drop Vocal Chop Shout right before the 4-step fakeout silence window (steps -4..-1 are total silence)
        if sec_steps >= 6 and pre_drop_silence_enabled:
            shout_step = sec_start_step + (sec_steps - 6)
            projected.append({
                "id": f"{sec.get('id', 'sec')}-predrop-shout",
                "step": shout_step,
                "duration_steps": 2,
                "velocity": 0.92,
                "role": "hocket",
                "patch_id": "vocal_chop",
                "section_id": sec.get("id", f"sec_{sec_idx}"),
                "transition_tag": "pre_drop_silence",
                "pitch_lock_mode": "relational",
                "relational": {"anchor": "chord_tone", "chord_tone_index": 0, "scale_degree_offset": 0, "octave_offset": 1},
                "gesture": normalize_gesture("vocal_chop", {"preset_id": "stutter_32"}),
            })

    if transition == "chorus_lift":
        # Open-hat downbeat shimmer + clap accent on step 0 of the Chorus
        projected.append({
            "id": f"{sec.get('id', 'sec')}-chorus-lift-hat",
            "step": sec_start_step,
            "duration_steps": 4,
            "velocity": 0.86,
            "role": "drums",
            "patch_id": "hat_open",
            "section_id": sec.get("id", f"sec_{sec_idx}"),
            "transition_tag": "chorus_lift",
        })

    if transition == "sub_drop_impact":
        # Ensure step 0 of the Drop has a high-impact 808 Sub-Drop + Clap impact
        projected.append({
            "id": f"{sec.get('id', 'sec')}-drop-impact-clap",
            "step": sec_start_step,
            "duration_steps": 1,
            "velocity": 0.98,
            "role": "drums",
            "patch_id": "clap",
            "section_id": sec.get("id", f"sec_{sec_idx}"),
            "transition_tag": "sub_drop_impact",
        })

    # Merge explicit white-box section overrides (preserving concrete or relational pitch lock)
    for custom_note in overrides.get("added_notes") or []:
        cn = copy.deepcopy(custom_note)
        rel_s = int(cn.get("step", 0)) % sec_steps
        cn["step"] = sec_start_step + rel_s
        cn["section_id"] = sec.get("id", f"sec_{sec_idx}")
        projected.append(cn)

    return projected


def expand_sections_for_compiler(
    song_doc: Dict[str, Any],
    core_notes: List[Dict[str, Any]],
    core_steps: int = 64,
    hocket_choke: bool = True,
    pre_drop_silence: bool = True,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """Expand all sections in song_doc['sections'] into a unified note list, section metadata list, and total_bars."""
    sections = song_doc.get("sections") or []
    if not sections:
        sections = copy.deepcopy(DEFAULT_SONG_BLUEPRINT)

    all_notes: List[Dict[str, Any]] = []
    compiled_sections: List[Dict[str, Any]] = []
    current_bar = 0

    for idx, sec in enumerate(sections):
        sec_bars = max(1, int(sec.get("bars", 4)))
        sec_start_step = current_bar * 16
        sec_end_step = (current_bar + sec_bars) * 16
        sec_notes = _project_section_notes(
            sec,
            idx,
            sec_start_step,
            core_notes,
            core_steps=core_steps,
            pre_drop_silence_enabled=pre_drop_silence,
        )
        choked_sec_notes = (
            apply_monophonic_hocket_choke(sec_notes, total_steps=sec_end_step)
            if hocket_choke
            else copy.deepcopy(sec_notes)
        )
        all_notes.extend(choked_sec_notes)

        compiled_sections.append({
            "id": sec.get("id", f"sec_{idx}"),
            " index": idx,
            "name": sec.get("name", f"Section {idx + 1}"),
            "type": sec.get("type", "drop"),
            "bars": sec_bars,
            "start_bar": current_bar,
            "end_bar": current_bar + sec_bars,
            "start_step": sec_start_step,
            "end_step": sec_end_step,
            "energy": round(float(sec.get("energy", 1.0)), 2),
            "active_roles": list(sec.get("active_roles") or []),
            "transition": sec.get("transition", "none"),
            "active_note_count": len(choked_sec_notes),
            "why_label": sec.get("why_label", ""),
        })
        current_bar += sec_bars

    return all_notes, compiled_sections, current_bar
