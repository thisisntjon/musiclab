"""Monophonic Heavy Bass Hocket Matrix, Kick-Lock alignment, and Call & Response motif transforms."""
from __future__ import annotations

import copy
import math
from typing import Any
from src.theory_core.models import (
    MONSTER_CHOKE_PATCHES,
    SCALES,
    midi_to_freq,
    midi_to_name,
    normalize_gesture,
)


def valid_source_harmony(chord: Any) -> bool:
    if not isinstance(chord, dict):
        return False
    pcs = chord.get("pitch_classes")
    return (type(chord.get("version")) in (int, float) and chord["version"] == 1
            and isinstance(pcs, list) and 3 <= len(pcs) <= 5
            and all(type(n) in (int, float) and 0 <= n < 12 and n == int(n) for n in pcs)
            and len(set(pcs)) == len(pcs))


def align_individual_source_voice(note: dict[str, Any]) -> None:
    """Resolve a single generated voice's frequency cache on the compiler copy."""
    voices, freq = note.get("voiced_freqs"), note.get("concrete", {}).get("freq_hz")
    if (note.get("provenance") == "jam_generated" and note.get("pitch_lock_mode") == "concrete"
            and isinstance(note.get("voice_id"), str) and note["voice_id"]
            and valid_source_harmony(note.get("generated_harmony"))
            and isinstance(voices, list) and len(voices) == 1
            and type(voices[0]) in (int, float) and math.isfinite(voices[0]) and voices[0] > 0
            and type(freq) in (int, float) and math.isfinite(freq) and freq > 0
            and abs(voices[0] - freq) > .001):
        note["voiced_freqs"] = [freq]


def source_mode_guidance(note: dict[str, Any]) -> str | None:
    """Describe source context without judging an edited pitch by an unrelated chord."""
    mode = note.get("generated_mode") or note.get("performed_mode")
    scales = {"dorian": [0, 2, 3, 5, 7, 9, 10], "mixolydian": [0, 2, 4, 5, 7, 9, 10]}
    if not isinstance(mode, dict):
        mode = {}
    name, tonic = mode.get("name"), mode.get("tonic")
    if (type(mode.get("version")) not in (int, float) or mode.get("version") != 1
            or not isinstance(name, str) or name not in scales
            or type(tonic) not in (int, float) or not 0 <= tonic < 12 or tonic != int(tonic)
            or mode.get("intervals") != scales[name]
            or any(type(n) not in (int, float) for n in mode["intervals"])):
        if valid_source_harmony(note.get("generated_harmony")):
            return "Source band: harmony context. Pitch kept as written."
        if (note.get("provenance") == "user_placed" and isinstance(note.get("source_note_id"), str)
                and note["source_note_id"].startswith("jam-live-")):
            return "From your performance. Pitch kept as written."
        return None
    return f"Source band: {name.capitalize()}. Pitch kept as written."


def apply_monophonic_hocket_choke(notes: list[dict[str, Any]], total_steps: int = 64) -> list[dict[str, Any]]:
    """Enforce the Heavy Bass Monophonic Foreground Rule across monster hocket/bass patches.

    - Only one monster patch (Growl, Talking YOI, Wobble, 808 Sub-Drop, Laser Screech, Vocal Chop)
      may sound at any given 16th-note step in the hocket/bass choke group.
    - If two monster notes start on the same step, the later entry in the list wins (latest user click).
    - Each monster note's duration_steps is automatically truncated so it cuts off cleanly when the next
      hocket event fires, preventing intermodulation mud.
    """
    non_choke: list[dict[str, Any]] = []
    by_step: dict[int, dict[str, Any]] = {}

    for raw in notes:
        note = copy.deepcopy(raw)
        patch_id = note.get("patch_id", "monster_growl")
        role = note.get("role", "hocket")
        if role in ("hocket", "bass") and patch_id in MONSTER_CHOKE_PATCHES:
            step = int(max(0, min(total_steps - 1, int(note.get("step", 0)))))
            note["step"] = step
            by_step[step] = note
        else:
            non_choke.append(note)

    sorted_steps = sorted(by_step.keys())
    choked_monsters: list[dict[str, Any]] = []
    for i, step in enumerate(sorted_steps):
        note = by_step[step]
        dur = max(1, int(note.get("duration_steps", 1)))
        if i + 1 < len(sorted_steps):
            next_step = sorted_steps[i + 1]
            max_dur = max(1, next_step - step)
            if dur > max_dur:
                note["duration_steps"] = max_dur
                note["choked_by_step"] = next_step
        else:
            note["duration_steps"] = min(dur, total_steps - step)
        choked_monsters.append(note)

    return non_choke + choked_monsters


def resolve_note_pitch(
    note: dict[str, Any],
    root_pc: int,
    scale_type: str,
    voiced_chord: dict[str, Any],
    step_gravity: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    """Resolve a NoteEvent's concrete MIDI pitch, frequency, and plain-English why_label."""
    resolved = copy.deepcopy(note)
    role = resolved.get("role", "lead")
    patch_id = resolved.get("patch_id", "supersaw_stab")
    resolved["gesture"] = normalize_gesture(patch_id, resolved.get("gesture"))
    resolved["provenance"] = str(resolved.get("provenance") or "seed_template")

    if role == "drums":
        midi_pitch = int(resolved.get("concrete", {}).get("midi_pitch", 36))
        resolved["concrete"] = {
            "midi_pitch": midi_pitch,
            "freq_hz": midi_to_freq(midi_pitch),
            "note_name": midi_to_name(midi_pitch),
            "micro_offset_ms": 0.0,
        }
        resolved["post_placement_mark"] = "●"
        resolved["post_placement_shape_kind"] = "filled_circle"
        resolved["why_label"] = "Rhythmic transient anchor (pocket)."
        return resolved

    lock_mode = resolved.get("pitch_lock_mode", "relational")
    rel = resolved.get("relational") or {}
    chord_pcs = voiced_chord.get("sounding_pcs") or voiced_chord["chord_pcs"]
    scale_offsets = SCALES.get(scale_type, SCALES["natural_minor"])
    scale_pcs = [(int(root_pc) + off) % 12 for off in scale_offsets]

    if lock_mode == "concrete" and isinstance(resolved.get("concrete"), dict) and "midi_pitch" in resolved["concrete"]:
        midi_pitch = int(resolved["concrete"]["midi_pitch"])
    else:
        anchor = rel.get("anchor", "chord_tone")
        ct_idx = int(rel.get("chord_tone_index", 0))
        deg_off = int(rel.get("scale_degree_offset", 0))
        oct_off = int(rel.get("octave_offset", 0))

        if anchor == "chord_tone":
            target_pc = chord_pcs[ct_idx % len(chord_pcs)]
            if deg_off != 0 and target_pc in scale_pcs:
                s_idx = (scale_pcs.index(target_pc) + deg_off) % len(scale_pcs)
                target_pc = scale_pcs[s_idx]
        elif anchor == "tension_tone":
            tension_pcs = [pc for pc in scale_pcs if pc not in chord_pcs] or scale_pcs
            target_pc = tension_pcs[ct_idx % len(tension_pcs)]
        else:
            s_idx = (ct_idx + deg_off) % len(scale_pcs)
            target_pc = scale_pcs[s_idx]

        # Enforce clean register boundaries by role/patch
        if role == "bass" or (role == "hocket" and patch_id in ("monster_growl", "talking_yoi", "wobble_bass", "sub_drop_808")):
            base_midi = 24 + (12 * max(0, min(1, oct_off + 1))) + target_pc
            while base_midi < 24:
                base_midi += 12
            while base_midi > 47:
                base_midi -= 12
            midi_pitch = base_midi
        elif role == "harmony" or patch_id == "supersaw_stab":
            base_midi = 60 + target_pc + (12 * oct_off)
            while base_midi < 48:
                base_midi += 12
            while base_midi > 76:
                base_midi -= 12
            midi_pitch = base_midi
        else:
            # Lead / Laser Screech / Vocal Chop in C4-C6 (MIDI 60..84)
            base_midi = 60 + target_pc + (12 * max(0, min(1, oct_off)))
            while base_midi < 60:
                base_midi += 12
            while base_midi > 84:
                base_midi -= 12
            midi_pitch = base_midi

    pc = midi_pitch % 12
    grav = step_gravity.get(pc, {})
    resolved["concrete"] = {
        "midi_pitch": midi_pitch,
        "freq_hz": midi_to_freq(midi_pitch),
        "note_name": midi_to_name(midi_pitch),
        "micro_offset_ms": float(resolved.get("concrete", {}).get("micro_offset_ms", 0.0)),
    }
    align_individual_source_voice(resolved)
    resolved["gravity_tier"] = grav.get("tier", "tier_1_anchor")
    resolved["post_placement_mark"] = grav.get("shape_mark", "●")
    resolved["post_placement_shape_kind"] = grav.get("shape_kind", "filled_circle")
    gesture_id = resolved["gesture"].get("preset_id", "vowel_yoi")
    resolved["why_label"] = (
        f"{resolved['post_placement_mark']} [{patch_id} · {gesture_id}] {grav.get('why_label', '')}"
    ).strip()
    source_guidance = source_mode_guidance(resolved)
    if source_guidance:
        for key in ("gravity_tier", "post_placement_mark", "post_placement_shape_kind"):
            resolved.pop(key, None)
        resolved["why_label"] = source_guidance
    return resolved


def lock_bass_to_kick(
    hocket_notes: list[dict[str, Any]],
    drum_notes: list[dict[str, Any]],
    steps_per_bar: int = 16,
    bars: int = 4,
) -> list[dict[str, Any]]:
    """Align bass/sub/stab anchor hits to active Kick drum steps while preserving off-beat Growl/Laser responses."""
    kick_steps = sorted({
        int(d["step"])
        for d in drum_notes
        if d.get("patch_id") == "kick" or d.get("drum_lane") == "kick"
    })
    if not kick_steps:
        kick_steps = [b * steps_per_bar for b in range(bars)]

    existing_steps = {int(n["step"]): copy.deepcopy(n) for n in hocket_notes}
    aligned: list[dict[str, Any]] = []

    for k_step in kick_steps:
        if k_step in existing_steps:
            note = existing_steps.pop(k_step)
            note["kick_locked"] = True
            note.setdefault("relational", {})["function_tag"] = "kick_locked_anchor"
            aligned.append(note)
        else:
            aligned.append({
                "id": f"hocket-kicklock-{k_step}",
                "step": k_step,
                "duration_steps": 2,
                "velocity": 0.92,
                "role": "bass",
                "patch_id": "wobble_bass" if (k_step % steps_per_bar) != 0 else "sub_drop_808",
                "pitch_lock_mode": "relational",
                "kick_locked": True,
                "provenance": "transformed_accepted",
                "relational": {
                    "anchor": "chord_tone",
                    "chord_tone_index": 0,
                    "scale_degree_offset": 0,
                    "octave_offset": 0,
                    "function_tag": "kick_locked_anchor",
                    "motif_id": "kick-lock",
                    "motif_transform": "identity",
                },
                "gesture": {"preset_id": "wobble_1_16" if (k_step % steps_per_bar) != 0 else "sub_dive"},
            })

    # Keep off-kick response notes (Growls, Lasers, Chops) and tag them as call-and-response pockets
    for step, note in sorted(existing_steps.items()):
        note["kick_locked"] = False
        note.setdefault("relational", {})["function_tag"] = "offbeat_hocket_response"
        aligned.append(note)

    return apply_monophonic_hocket_choke(aligned, total_steps=steps_per_bar * bars)


def transform_call_response(
    bar1_notes: list[dict[str, Any]],
    voiced_chords: list[dict[str, Any]],
    root_pc: int,
    scale_type: str,
    steps_per_bar: int = 16,
) -> list[dict[str, Any]]:
    """Expand a 1-bar seed motif (steps 0..15) into a 4-bar Call & Response phrase (A -> A' -> A -> B).

    - Preserves Bar 1's rhythmic step offsets (0..15) across Bars 2, 3, and 4.
    - Remaps relational.chord_tone_index so 100% of anchor notes land on the target bar's active chord tones.
    - Applies melodic/timbral variation on Bar 2 (Response A') and Bar 4 (Turnaround B).
    """
    seed = [copy.deepcopy(n) for n in bar1_notes if 0 <= int(n.get("step", 0)) < steps_per_bar]
    if not seed:
        return []

    full_phrase: list[dict[str, Any]] = []
    transforms = [
        (0, "identity_call_A"),
        (1, "response_A_prime"),
        (2, "repeat_call_A"),
        (3, "turnaround_B"),
    ]

    for bar_idx, transform_name in transforms:
        bar_offset = bar_idx * steps_per_bar
        for idx, base_note in enumerate(seed):
            n = copy.deepcopy(base_note)
            rel_step = int(base_note["step"]) % steps_per_bar
            n["step"] = bar_offset + rel_step
            n["id"] = f"{base_note.get('id', 'motif')}-b{bar_idx + 1}-{idx}"
            n["pitch_lock_mode"] = "relational"
            n["provenance"] = (
                str(base_note.get("provenance") or "seed_template")
                if bar_idx == 0
                else "transformed_accepted"
            )
            rel = n.setdefault("relational", {})
            rel["anchor"] = "chord_tone"
            rel["scale_degree_offset"] = 0
            rel["motif_id"] = rel.get("motif_id", "motif-a")
            rel["motif_transform"] = transform_name

            base_ct = int(rel.get("chord_tone_index", 0))
            if transform_name == "identity_call_A" or transform_name == "repeat_call_A":
                rel["chord_tone_index"] = base_ct % 3
            elif transform_name == "response_A_prime":
                # Answer by inverting the last note of the bar to the 3rd/5th chord tone
                if idx == len(seed) - 1:
                    rel["chord_tone_index"] = (base_ct + 1) % 3
                else:
                    rel["chord_tone_index"] = base_ct % 3
            elif transform_name == "turnaround_B":
                # Turnaround steps up to the upper chord tone and resolves to Root (0) on final note
                if idx == len(seed) - 1:
                    rel["chord_tone_index"] = 0
                    if n.get("role") in ("hocket", "bass"):
                        n["patch_id"] = "vocal_chop"
                        n["gesture"] = {"preset_id": "stutter_32"}
                else:
                    rel["chord_tone_index"] = (base_ct + 2) % 3

            full_phrase.append(n)

    return full_phrase


def generate_gap_answer_notes(
    lead_notes: list[dict[str, Any]],
    drum_notes: list[dict[str, Any]] | None = None,
    bars: int = 4,
    steps_per_bar: int = 16,
    patch_id: str = "clean_bass",
) -> list[dict[str, Any]]:
    """Monophonic Bass Call-and-Response ("Answer my tune" gap filler, #16).

    Finds silent contiguous gaps between the user's ``lead`` melody notes in each bar
    and places up to 2 relational chord-tone bass answer notes strictly inside those
    silent steps (zero step overlap with any lead note), then enforces monophonic choke.
    """
    total_steps = bars * steps_per_bar
    occupied: list[bool] = [False] * total_steps
    for n in lead_notes or []:
        if n.get("role", "lead") != "lead":
            continue
        st = max(0, int(n.get("step", 0)))
        dur = max(1, int(n.get("duration_steps", 2)))
        for s in range(st, min(total_steps, st + dur)):
            occupied[s] = True

    out: list[dict[str, Any]] = []
    candidate_offsets = (8, 12, 4, 6, 10, 14, 0, 2)
    for bar in range(bars):
        b_base = bar * steps_per_bar
        placed_in_bar = 0
        bar_occ = list(occupied[b_base : b_base + steps_per_bar])
        for idx_c, rel_step in enumerate(candidate_offsets):
            if placed_in_bar >= 2:
                break
            if rel_step >= steps_per_bar or bar_occ[rel_step]:
                continue
            free_len = 0
            while (rel_step + free_len) < steps_per_bar and not bar_occ[rel_step + free_len]:
                free_len += 1
            if free_len < 2:
                continue
            dur = min(4, free_len)
            for s in range(rel_step, rel_step + dur):
                bar_occ[s] = True
            step = b_base + rel_step
            ct_idx = 0 if placed_in_bar == 0 else 2
            oct_off = 1 if (placed_in_bar == 1 and rel_step >= 10) else 0
            out.append({
                "id": f"bass-gap-{step}",
                "step": step,
                "duration_steps": dur,
                "velocity": 0.88 if placed_in_bar == 0 else 0.82,
                "role": "bass",
                "patch_id": patch_id,
                "pitch_lock_mode": "relational",
                "provenance": "transformed_accepted",
                "relational": {
                    "anchor": "chord_tone",
                    "chord_tone_index": ct_idx,
                    "scale_degree_offset": 0,
                    "octave_offset": oct_off,
                },
            })
            placed_in_bar += 1

    out.sort(key=lambda x: int(x["step"]))
    return apply_monophonic_hocket_choke(out, total_steps=total_steps)

