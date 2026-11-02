"""Deterministic Diagnostic Ear Coach, Ear-to-Grid Micro-Missions, and White-Box Diff Previewer (Phase 4)."""
from __future__ import annotations

import copy
from typing import Any

from src.theory_core.models import MONSTER_CHOKE_PATCHES, midi_to_freq, midi_to_name
from src.theory_core.harmony import classify_step_gravity, voice_chord_progression
from src.theory_core.hocket import (
    apply_monophonic_hocket_choke,
    lock_bass_to_kick,
    resolve_note_pitch,
    transform_call_response,
)


def diagnose_song(song_doc: dict[str, Any]) -> dict[str, Any]:
    """Deterministically analyze a SongDocument for the 4 core beginner compositional & psychoacoustic pitfalls.

    Returns a structured diagnostic report with:
      - issues: list of diagnostic items (id, category, severity, bar, step, role, problem_summary,
                why_explanation, ab_scaffold_toggle, white_box_fix)
      - health_score: 0..100
      - summary_label: plain-English coaching headline
    """
    ctx = song_doc.get("global_context") or {}
    root_pc = int(ctx.get("root_pc", 7)) % 12
    scale_type = str(ctx.get("scale_type", "dorian"))
    bars = int(ctx.get("bars", 4))
    steps_per_bar = 16
    total_steps = bars * steps_per_bar

    prog_id = song_doc.get("active_progression_id", "prog-main")
    raw_prog = (song_doc.get("chord_progressions") or {}).get(prog_id) or [
        {"bar": 0, "beats": 4, "degree": 1, "roman": "i", "quality": "min"},
        {"bar": 1, "beats": 4, "degree": 6, "roman": "bVI", "quality": "maj"},
        {"bar": 2, "beats": 4, "degree": 7, "roman": "bVII", "quality": "maj"},
        {"bar": 3, "beats": 4, "degree": 1, "roman": "i", "quality": "min"},
    ]
    voiced_chords = voice_chord_progression(root_pc, scale_type, raw_prog)
    chord_by_bar = {int(c["bar"]): c for c in voiced_chords}

    gravity_by_step: list[dict[int, dict[str, Any]]] = []
    for step in range(total_steps):
        b_idx = (step // steps_per_bar) % max(1, len(voiced_chords))
        chord = chord_by_bar.get(b_idx, voiced_chords[b_idx % len(voiced_chords)])
        gravity_by_step.append(classify_step_gravity(root_pc, scale_type, chord))

    notes = copy.deepcopy(song_doc.get("notes") or [])
    issues: list[dict[str, Any]] = []

    # 1. Check Unresolved Downbeat Clashes in Lead / Melody
    lead_notes = [n for n in notes if n.get("role") == "lead" and 0 <= int(n.get("step", 0)) < total_steps]
    for ln in lead_notes:
        step = int(ln.get("step", 0))
        dur = max(1, int(ln.get("duration_steps", 1)))
        b_idx = (step // steps_per_bar) % max(1, len(voiced_chords))
        chord = chord_by_bar.get(b_idx, voiced_chords[b_idx % len(voiced_chords)])
        resolved = resolve_note_pitch(ln, root_pc, scale_type, chord, gravity_by_step[step])
        midi_pitch = int(resolved["concrete"]["midi_pitch"])
        pc = midi_pitch % 12
        grav = gravity_by_step[step].get(pc, {})
        tier = grav.get("tier", "tier_1_anchor")
        is_avoid = bool(grav.get("is_avoid_clash", False))

        if (step % 4 == 0 or dur >= 2) and (tier == "chromatic" or is_avoid):
            target_pc = int(grav.get("resolution_target_pc", chord["chord_root_pc"]))
            target_name = grav.get("resolution_target_name", chord["chord_name"])
            # Compute nearest MIDI pitch with target_pc in C4-C6 (60..84)
            candidates = [m for m in range(60, 85) if m % 12 == target_pc]
            target_midi = min(candidates, key=lambda m: abs(m - midi_pitch)) if candidates else 60 + target_pc
            chord_pcs = chord["chord_pcs"]
            ct_index = chord_pcs.index(target_pc) if target_pc in chord_pcs else 0

            issues.append({
                "id": f"clash-step-{step}",
                "category": "unresolved_downbeat_clash",
                "severity": "high",
                "bar": b_idx,
                "step": step,
                "role": "lead",
                "problem_summary": (
                    f"Bar {b_idx + 1}, Step {step + 1}: Held note {resolved['concrete']['note_name']} "
                    f"rubs against the {chord['chord_name']} chord on a main beat."
                ),
                "why_explanation": (
                    f"Because this note is held on a main beat right next to a chord note, it creates harsh friction. "
                    f"Moving it one step to {midi_to_name(target_midi)} ({target_name}) makes it blend smoothly."
                ),
                "ab_preview_patch": {
                    "note_id": ln.get("id"),
                    "problem_midi": midi_pitch,
                    "resolved_midi": target_midi,
                },
                "white_box_fix": {
                    "fix_type": "resolve_note_to_anchor",
                    "note_id": ln.get("id"),
                    "step": step,
                    "target_midi": target_midi,
                    "target_chord_tone_index": ct_index,
                },
            })

    # 2. Check Mud / Choke Collisions in Hocket & Bass
    monster_notes = [
        n
        for n in notes
        if n.get("role") in ("hocket", "bass")
        and n.get("patch_id", "monster_growl") in MONSTER_CHOKE_PATCHES
        and 0 <= int(n.get("step", 0)) < total_steps
    ]
    step_occupancy: dict[int, list[dict[str, Any]]] = {}
    for mn in monster_notes:
        s0 = int(mn.get("step", 0))
        dur = max(1, int(mn.get("duration_steps", 1)))
        for s in range(s0, min(total_steps, s0 + dur)):
            step_occupancy.setdefault(s, []).append(mn)

    collision_steps = sorted(s for s, occ in step_occupancy.items() if len(occ) >= 2)
    if collision_steps:
        first_s = collision_steps[0]
        colliding_names = [n.get("patch_id", "monster") for n in step_occupancy[first_s]]
        issues.append({
            "id": f"mud-collision-step-{first_s}",
            "category": "mud_choke_collision",
            "severity": "high",
            "bar": first_s // steps_per_bar,
            "step": first_s,
            "role": "hocket",
            "problem_summary": (
                f"Bar {(first_s // steps_per_bar) + 1}, Step {first_s + 1}: Two heavy bass sounds "
                f"({', '.join(colliding_names[:2])}) overlap at the same moment."
            ),
            "why_explanation": (
                "When two deep bass sounds play on top of each other, they blur together and make the low end muddy. "
                "Letting the first bass note finish cleanly right as the next one starts keeps every sound clear."
            ),
            "ab_preview_patch": {"scaffold_toggle": "hocket_choke"},
            "white_box_fix": {
                "fix_type": "apply_monophonic_choke",
                "step": first_s,
            },
        })

    # 3. Check Weak Kick-Bass Pocket Alignment
    kick_steps = sorted({
        int(d["step"])
        for d in notes
        if d.get("role") == "drums"
        and (d.get("patch_id") == "kick" or d.get("drum_lane") == "kick")
        and 0 <= int(d.get("step", 0)) < total_steps
    })
    bass_all_notes = [
        n for n in notes if n.get("role") in ("hocket", "bass") and 0 <= int(n.get("step", 0)) < total_steps
    ]
    hocket_steps = {int(n.get("step", 0)) for n in bass_all_notes}
    if kick_steps:
        matched_kicks = [ks for ks in kick_steps if ks in hocket_steps]
        coverage = len(matched_kicks) / len(kick_steps)
        if coverage < 0.50:
            missing_step = next((ks for ks in kick_steps if ks not in hocket_steps), kick_steps[0])
            issues.append({
                "id": "weak-kick-bass-pocket",
                "category": "weak_kick_bass_pocket",
                "severity": "medium",
                "bar": missing_step // steps_per_bar,
                "step": missing_step,
                "role": "bass",
                "problem_summary": (
                    "Low-End Timing Gap: The bass notes and main drum beat are landing at different moments."
                ),
                "why_explanation": (
                    "Lining up the first bass note with the main drum hit gives the song a steady, grounded pulse."
                ),
                "ab_preview_patch": {"transform_action": "kick_lock"},
                "white_box_fix": {
                    "fix_type": "lock_bass_to_kick",
                    "step": missing_step,
                },
            })

    # 4. Check Static 4-Bar Monotony (Identical bars or missing Bar-4 Turnaround)
    def _bar_signature(role_filter: tuple[str, ...], bar_idx: int) -> list[tuple[int, str, int]]:
        b_start = bar_idx * steps_per_bar
        b_end = b_start + steps_per_bar
        sig = []
        for n in notes:
            if n.get("role") in role_filter and b_start <= int(n.get("step", 0)) < b_end:
                rel = n.get("relational") or {}
                conc = n.get("concrete") or {}
                pitch_sig = (
                    int(conc["midi_pitch"])
                    if (n.get("pitch_lock_mode") == "concrete" and "midi_pitch" in conc)
                    else int(rel.get("chord_tone_index", 0))
                )
                sig.append((
                    int(n.get("step", 0)) - b_start,
                    str(n.get("patch_id", "")),
                    pitch_sig,
                ))
        return sorted(sig)

    bar0_hocket = _bar_signature(("hocket", "bass"), 0)
    bar1_hocket = _bar_signature(("hocket", "bass"), 1)
    bar2_hocket = _bar_signature(("hocket", "bass"), 2)
    bar3_hocket = _bar_signature(("hocket", "bass"), 3)

    bar0_lead = _bar_signature(("lead",), 0)
    bar1_lead = _bar_signature(("lead",), 1)
    bar2_lead = _bar_signature(("lead",), 2)
    bar3_lead = _bar_signature(("lead",), 3)
    lead_has_variation = bool(bar0_lead and bar1_lead and bar2_lead and bar3_lead) and not (
        bar0_lead == bar1_lead == bar2_lead == bar3_lead
    )

    if (
        bar0_hocket
        and not lead_has_variation
        and (
            (bar0_hocket == bar1_hocket == bar2_hocket == bar3_hocket)
            or (not bar1_hocket and not bar2_hocket and not bar3_hocket)
        )
    ):
        issues.append({
            "id": "static-4bar-monotony",
            "category": "static_4bar_monotony",
            "severity": "medium",
            "bar": 3,
            "step": 48,
            "role": "hocket",
            "problem_summary": (
                "Repeating Pattern: All four bars play the exact same pattern without a change at the end."
            ),
            "why_explanation": (
                "Adding a small lift in the second bar and a gentle turnaround in the fourth bar makes the phrase feel like a conversation instead of a repeat."
            ),
            "ab_preview_patch": {"transform_action": "hocket_call_response"},
            "white_box_fix": {
                "fix_type": "apply_hocket_call_response",
                "step": 48,
            },
        })

    # Compute overall compositional health score
    penalty = sum(25 if item["severity"] == "high" else 15 for item in issues)
    health_score = max(10, 100 - penalty)
    if not issues:
        summary_label = (
            "Everything sounds clean and balanced: notes fit the chords, the bass has room to breathe, "
            "and the phrase has natural movement."
        )
    else:
        summary_label = (
            f"Found {len(issues)} place(s) that could sound clearer — listen to the before/after comparison or "
            f"apply a 1-click fix below."
        )

    return {
        "health_score": health_score,
        "issue_count": len(issues),
        "summary_label": summary_label,
        "issues": issues,
    }


def apply_diagnostic_fix(song_doc: dict[str, Any], issue_or_fix: dict[str, Any]) -> dict[str, Any]:
    """Apply a deterministic White-Box Fix from diagnose_song() directly to song_doc['notes']."""
    updated = copy.deepcopy(song_doc)
    fix = issue_or_fix.get("white_box_fix", issue_or_fix)
    fix_type = str(fix.get("fix_type", ""))

    ctx = updated.get("global_context") or {}
    root_pc = int(ctx.get("root_pc", 7)) % 12
    scale_type = str(ctx.get("scale_type", "dorian"))
    bars = int(ctx.get("bars", 4))
    prog_id = updated.get("active_progression_id", "prog-main")
    raw_prog = (updated.get("chord_progressions") or {}).get(prog_id) or []
    voiced_chords = voice_chord_progression(root_pc, scale_type, raw_prog)

    notes = copy.deepcopy(updated.get("notes") or [])

    if fix_type == "resolve_note_to_anchor":
        note_id = fix.get("note_id")
        target_step = fix.get("step")
        target_ct = int(fix.get("target_chord_tone_index", 0))
        target_midi = int(fix.get("target_midi", 67))
        for n in notes:
            if (note_id and n.get("id") == note_id) or (
                n.get("role") == "lead" and int(n.get("step", -1)) == int(target_step or -2)
            ):
                n["pitch_lock_mode"] = "relational"
                n["provenance"] = "transformed_accepted"
                rel = n.setdefault("relational", {})
                rel["anchor"] = "chord_tone"
                rel["chord_tone_index"] = target_ct
                rel["scale_degree_offset"] = 0
                rel["octave_offset"] = 1 if target_midi >= 72 else 0
                n["concrete"] = {
                    "midi_pitch": target_midi,
                    "freq_hz": midi_to_freq(target_midi),
                    "note_name": midi_to_name(target_midi),
                    "micro_offset_ms": 0.0,
                }
        updated["notes"] = notes

    elif fix_type == "apply_monophonic_choke":
        updated["notes"] = apply_monophonic_hocket_choke(notes, total_steps=bars * 16)

    elif fix_type == "lock_bass_to_kick":
        drum_notes = [n for n in notes if n.get("role") == "drums"]
        hocket_notes = [n for n in notes if n.get("role") in ("hocket", "bass")]
        other_notes = [n for n in notes if n.get("role") not in ("drums", "hocket", "bass")]
        new_hocket = lock_bass_to_kick(hocket_notes, drum_notes, steps_per_bar=16, bars=bars)
        updated["notes"] = drum_notes + new_hocket + other_notes

    elif fix_type == "apply_hocket_call_response":
        drum_notes = [n for n in notes if n.get("role") == "drums"]
        hocket_notes = [n for n in notes if n.get("role") in ("hocket", "bass")]
        other_notes = [n for n in notes if n.get("role") not in ("drums", "hocket", "bass")]
        bar1_hocket = [n for n in hocket_notes if 0 <= int(n.get("step", 0)) < 16]
        if bar1_hocket:
            new_hocket = transform_call_response(bar1_hocket, voiced_chords, root_pc, scale_type, steps_per_bar=16)
            updated["notes"] = drum_notes + new_hocket + other_notes

    elif fix_type == "fix_all":
        # Iteratively apply all fixes in deterministic order
        report = diagnose_song(updated)
        for issue in report["issues"]:
            updated = apply_diagnostic_fix(updated, issue)

    return updated


def preview_transform_diff(song_doc: dict[str, Any], action: str) -> dict[str, Any]:
    """Compute a non-destructive White-Box Diff Preview before applying a studio transform or fix."""
    before_notes = copy.deepcopy(song_doc.get("notes") or [])
    if action in ("kick_lock", "hocket_call_response", "lead_call_response"):
        ctx = song_doc.get("global_context") or {}
        root_pc = int(ctx.get("root_pc", 7)) % 12
        scale_type = str(ctx.get("scale_type", "dorian"))
        bars = int(ctx.get("bars", 4))
        prog_id = song_doc.get("active_progression_id", "prog-main")
        raw_prog = (song_doc.get("chord_progressions") or {}).get(prog_id) or []
        voiced_chords = voice_chord_progression(root_pc, scale_type, raw_prog)
        drum_notes = [n for n in before_notes if n.get("role") == "drums"]
        hocket_notes = [n for n in before_notes if n.get("role") in ("hocket", "bass")]
        lead_notes = [n for n in before_notes if n.get("role") == "lead"]
        other_notes = [n for n in before_notes if n.get("role") not in ("drums", "hocket", "bass", "lead")]

        if action == "kick_lock":
            after_notes = drum_notes + lock_bass_to_kick(hocket_notes, drum_notes, 16, bars) + lead_notes + other_notes
        elif action == "hocket_call_response":
            b1 = [n for n in hocket_notes if 0 <= int(n.get("step", 0)) < 16]
            after_notes = (
                drum_notes + transform_call_response(b1, voiced_chords, root_pc, scale_type, 16) + lead_notes + other_notes
                if b1
                else before_notes
            )
        else:
            b1 = [n for n in lead_notes if 0 <= int(n.get("step", 0)) < 16]
            after_notes = (
                drum_notes + hocket_notes + transform_call_response(b1, voiced_chords, root_pc, scale_type, 16) + other_notes
                if b1
                else before_notes
            )
    else:
        after_doc = apply_diagnostic_fix(song_doc, {"fix_type": action})
        after_notes = after_doc.get("notes") or []

    before_map = {(int(n.get("step", 0)), str(n.get("role", "")), str(n.get("patch_id", ""))): n for n in before_notes}
    after_map = {(int(n.get("step", 0)), str(n.get("role", "")), str(n.get("patch_id", ""))): n for n in after_notes}

    added = [after_map[k] for k in sorted(after_map.keys()) if k not in before_map]
    removed = [before_map[k] for k in sorted(before_map.keys()) if k not in after_map]

    return {
        "action": action,
        "added_count": len(added),
        "removed_count": len(removed),
        "added_notes": added,
        "removed_notes": removed,
    }


def generate_ear_mission(song_doc: dict[str, Any], difficulty: str = "starter") -> dict[str, Any]:
    """Generate a deterministic 20-second Ear-to-Grid Call & Response micro-mission grounded in the active key."""
    ctx = song_doc.get("global_context") or {}
    root_pc = int(ctx.get("root_pc", 7)) % 12
    scale_type = str(ctx.get("scale_type", "dorian"))
    prog_id = song_doc.get("active_progression_id", "prog-main")
    raw_prog = (song_doc.get("chord_progressions") or {}).get(prog_id) or [
        {"bar": 0, "beats": 4, "degree": 1, "roman": "i", "quality": "min"},
        {"bar": 1, "beats": 4, "degree": 6, "roman": "bVI", "quality": "maj"},
    ]
    voiced_chords = voice_chord_progression(root_pc, scale_type, raw_prog)
    bar0_chord = voiced_chords[0]
    bar1_chord = voiced_chords[1 % len(voiced_chords)]

    # Call (Bar 1, steps 0, 4, 8) + Mystery Response (Bar 2, steps 16, 20, 24 where last 2 are masked)
    call_events = [
        {
            "step": 0,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "chord_tone_index": 0,
            "scale_degree_offset": 0,
            "octave_offset": 0,
            "midi_pitch": 60 + bar0_chord["chord_pcs"][0],
            "note_name": midi_to_name(60 + bar0_chord["chord_pcs"][0]),
            "freq_hz": midi_to_freq(60 + bar0_chord["chord_pcs"][0]),
        },
        {
            "step": 4,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "chord_tone_index": 1,
            "scale_degree_offset": 0,
            "octave_offset": 0,
            "midi_pitch": 60 + bar0_chord["chord_pcs"][1],
            "note_name": midi_to_name(60 + bar0_chord["chord_pcs"][1]),
            "freq_hz": midi_to_freq(60 + bar0_chord["chord_pcs"][1]),
        },
        {
            "step": 8,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "chord_tone_index": 2,
            "scale_degree_offset": 0,
            "octave_offset": 0,
            "midi_pitch": 60 + bar0_chord["chord_pcs"][2],
            "note_name": midi_to_name(60 + bar0_chord["chord_pcs"][2]),
            "freq_hz": midi_to_freq(60 + bar0_chord["chord_pcs"][2]),
        },
    ]

    # Target Response in Bar 2 (steps 16, 20, 24 resolving down to the Root of Bar 2's chord)
    target_events = [
        {
            "step": 20,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "chord_tone_index": 1,
            "scale_degree_offset": 0,
            "octave_offset": 0,
            "midi_pitch": 60 + bar1_chord["chord_pcs"][1],
            "note_name": midi_to_name(60 + bar1_chord["chord_pcs"][1]),
            "freq_hz": midi_to_freq(60 + bar1_chord["chord_pcs"][1]),
            "hint_label": f"Step 21 (Bar 2 Beat 2): Place the 3rd Chord Anchor ({midi_to_name(60 + bar1_chord['chord_pcs'][1])}) of {bar1_chord['chord_name']}.",
        },
        {
            "step": 24,
            "role": "lead",
            "patch_id": "supersaw_stab",
            "chord_tone_index": 0,
            "scale_degree_offset": 0,
            "octave_offset": 0,
            "midi_pitch": 60 + bar1_chord["chord_pcs"][0],
            "note_name": midi_to_name(60 + bar1_chord["chord_pcs"][0]),
            "freq_hz": midi_to_freq(60 + bar1_chord["chord_pcs"][0]),
            "hint_label": f"Step 25 (Bar 2 Beat 3): Resolve down to the 1st Chord Root ({midi_to_name(60 + bar1_chord['chord_pcs'][0])}) of {bar1_chord['chord_name']}.",
        },
    ]

    return {
        "mission_id": f"ear-mission-{root_pc}-{scale_type}-{difficulty}",
        "difficulty": difficulty,
        "title": "20-Second Ear-to-Grid Call & Response",
        "instructions": (
            f"Listen to the mystery 2-bar hook over {bar0_chord['chord_name']} -> {bar1_chord['chord_name']}. "
            f"Bar 1 climbs up the triad (1st -> 3rd -> 5th). Place the 2 missing Answer notes on Steps 21 and 25 "
            f"in the Chord-Gravity Hook Grid so the phrase steps down (3rd -> 1st Root) to resolve!"
        ),
        "call_events": call_events,
        "target_events": target_events,
        "target_steps": [t["step"] for t in target_events],
    }


def grade_ear_mission(mission: dict[str, Any], user_notes: list[dict[str, Any]]) -> dict[str, Any]:
    """Grade the user's placed grid notes against the Ear-to-Grid mission targets."""
    targets = mission.get("target_events") or []
    if not targets:
        return {"passed": True, "score": 100, "feedback": "Mission complete!"}

    lead_by_step = {
        int(n.get("step", -1)): n
        for n in user_notes
        if n.get("role") in ("lead", "hocket", None)
    }

    exact_matches = 0
    anchor_matches = 0
    details: list[str] = []

    for tgt in targets:
        s = int(tgt["step"])
        user_n = lead_by_step.get(s)
        if not user_n:
            details.append(f"Step {s + 1}: Missing note (hint: try {tgt['hint_label']}).")
            continue

        rel = user_n.get("relational") or {}
        u_ct = int(rel.get("chord_tone_index", -1))
        u_deg = int(rel.get("scale_degree_offset", 0))
        u_midi = int(user_n.get("concrete", {}).get("midi_pitch", -1))

        if (u_ct == int(tgt["chord_tone_index"]) and u_deg == int(tgt["scale_degree_offset"])) or (
            u_midi != -1 and (u_midi % 12) == (int(tgt["midi_pitch"]) % 12)
        ):
            exact_matches += 1
            anchor_matches += 1
            details.append(f"Step {s + 1}: Exact match ({tgt['note_name']} Chord Anchor)!")
        elif u_deg == 0:
            anchor_matches += 1
            details.append(
                f"Step {s + 1}: Landed on a consonant Tier 1 Chord Anchor, though the target was {tgt['note_name']}."
            )
        else:
            details.append(
                f"Step {s + 1}: Placed a Tier 2 tension tone; move to the green Chord Anchor ({tgt['note_name']}) to resolve."
            )

    total = len(targets)
    exact_score = round((exact_matches / total) * 100)
    gravity_score = round((anchor_matches / total) * 100)
    passed = exact_matches == total or gravity_score == 100

    return {
        "passed": passed,
        "exact_pitch_score": exact_score,
        "chord_tone_gravity_score": gravity_score,
        "matched_count": exact_matches,
        "total_targets": total,
        "details": details,
        "feedback": (
            "Ear Mission Passed — your ear accurately guided your placement onto the home and chord notes!"
            if passed
            else f"Almost there ({exact_matches}/{total} matched): {' '.join(details)}"
        ),
    }



def compute_provenance_summary(
    song_doc: dict[str, Any],
    compiled: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compute the Authorship Provenance Ledger and plain-English decision summary."""
    notes = song_doc.get("notes") or []
    graph = song_doc.get("fluid_song_graph")
    has_graph = isinstance(graph, dict)
    user_decisions_count = int((graph or {}).get("user_decisions_count", 0)) if has_graph else 0
    phrase_shaped = bool((graph or {}).get("phrase_shaped", False)) if has_graph else False

    counts = {
        "user_placed": 0,
        "hummed_confirmed": 0,
        "transformed_accepted": 0,
        "seed_template": 0,
        "scaffold_generated": 0,
    }
    ledger_entries: list[dict[str, Any]] = []

    for n in notes:
        nid = str(n.get("id", ""))
        prov = str(n.get("provenance") or "seed_template")
        if prov not in counts:
            prov = "seed_template"
        # Honest accounting: if a starter seed has a fluid_song_graph with 0 user decisions,
        # pre-populated starter notes (neutral-* / heavybass-*) are seed_template, not user_placed.
        if has_graph and user_decisions_count == 0 and prov in ("user_placed", "transformed_accepted"):
            if nid.startswith(("neutral-", "heavybass-", "drum-", "bass-", "lead-hook-")):
                prov = "seed_template"
        counts[prov] += 1
        ledger_entries.append({
            "id": nid,
            "step": int(n.get("step", 0)),
            "role": str(n.get("role", "lead")),
            "patch_id": str(n.get("patch_id", "")),
            "provenance": prov,
        })

    if compiled:
        for ev in compiled.get("events") or []:
            if str(ev.get("id", "")).startswith("auto-stab-"):
                counts["scaffold_generated"] += 1

    total_notes = len(notes)
    direct_user = counts["user_placed"] + counts["hummed_confirmed"]
    steered_user = direct_user + counts["transformed_accepted"]

    if total_notes > 0:
        strict_user_placed_pct = round((direct_user / total_notes) * 100.0, 1)
        authored_by_you_pct = round((steered_user / total_notes) * 100.0, 1)
    else:
        strict_user_placed_pct = 0.0 if (has_graph and user_decisions_count == 0) else 100.0
        authored_by_you_pct = 0.0 if (has_graph and user_decisions_count == 0) else 100.0

    # Phase 9a, "one act makes it yours": a piece with zero acts of the person's own is never labelled theirs.
    session = song_doc.get("play_session") or {}
    acts_count = int(session.get("acts_count", 0) or 0)
    start_bpm = float(session.get("start_bpm", 100) or 100)
    tempo_changed = acts_count > 0 and float((song_doc.get("global_context") or {}).get("bpm", start_bpm)) != start_bpm
    # Something of the person's must be in the piece: their notes, a kept choice, a shaped phrase, or a chosen speed.
    # Phase 9b: a kit or feel the person picked by ear and kept is theirs too.
    kept_choice = acts_count > 0 and bool(session.get("choices"))
    made_by_you = direct_user > 0 or user_decisions_count > 0 or bool(phrase_shaped) or tempo_changed or kept_choice
    badge_label = "Made by you" if made_by_you else "Starting point (make one change to make it yours)"

    return {
        "total_canvas_notes": total_notes,
        "counts": counts,
        "user_decisions_count": user_decisions_count,
        "acts_count": acts_count,
        "made_by_you": made_by_you,
        "phrase_shaped": phrase_shaped,
        "strict_user_placed_pct": strict_user_placed_pct,
        "authored_by_you_pct": authored_by_you_pct,
        "meets_study_50pct_bar": strict_user_placed_pct >= 50.0,
        "not_ai_slop_verified": True,
        "ai_audio_generated_pct": 0.0,
        "badge_label": badge_label,
        "ledger": ledger_entries,
    }


# ==============================================================================
# 6-STEP FLUID SONG GRAPH (the browser reads song_doc["fluid_song_graph"])
# ==============================================================================

FLUID_SONG_RUNG_SPECS: list[dict[str, Any]] = [
    {
        "id": "vibe_groove",
        "rung_number": 1,
        "guided_step": 1,
        "title": "1. Find a starting sound",
        "question": "Hear something you like?",
        "book_equivalent": "Step 1: Starting Sound",
        "fluid_equivalent": "Starting Palette",
        "producer_mentor": "Patient Collaborator — Starting Sound",
        "formula_rule": "Listen to three contrasting starting points and choose the sound world that feels good right away.",
        "depends_on": [],
    },
    {
        "id": "bass_pocket",
        "rung_number": 2,
        "guided_step": 2,
        "title": "2. Give it movement",
        "question": "How should this move?",
        "book_equivalent": "Step 2: Rhythmic Feel",
        "fluid_equivalent": "Rhythm & Pulse",
        "producer_mentor": "Patient Collaborator — Movement & Pulse",
        "formula_rule": "When the beat and low end move together, your song gets a natural, steady pulse.",
        "depends_on": ["vibe_groove"],
    },
    {
        "id": "hook_melody",
        "rung_number": 3,
        "guided_step": 3,
        "title": "3. Make a little idea yours",
        "question": "What should happen next?",
        "book_equivalent": "Step 3: Personal Phrase Idea",
        "fluid_equivalent": "Core Melodic Idea",
        "producer_mentor": "Patient Collaborator — Phrase Shaping",
        "formula_rule": "Start with a short phrase and shape how it ends: repeat it, climb higher, settle lower, hold a note, or leave a gap.",
        "depends_on": ["vibe_groove", "bass_pocket"],
    },
    {
        "id": "chord_spine",
        "rung_number": 4,
        "guided_step": 4,
        "title": "4. Build around it",
        "question": "What belongs underneath?",
        "book_equivalent": "Step 4: Accompaniment Underneath",
        "fluid_equivalent": "Harmonic Support",
        "producer_mentor": "Patient Collaborator — Warm Accompaniment",
        "formula_rule": "Hear how different chord movements feel underneath your melody while your phrase stays protected.",
        "depends_on": ["vibe_groove", "hook_melody"],
    },
    {
        "id": "song_arc",
        "rung_number": 5,
        "guided_step": 5,
        "title": "5. Shape the journey",
        "question": "Where should it build, breathe, or return?",
        "book_equivalent": "Step 5: Song Journey",
        "fluid_equivalent": "Multi-Section Arrangement",
        "producer_mentor": "Patient Collaborator — Song Pacing",
        "formula_rule": "A big moment lands best when the section before it leaves a little breathing room.",
        "depends_on": ["vibe_groove", "bass_pocket", "hook_melody", "chord_spine"],
    },
    {
        "id": "ear_candy_polish",
        "rung_number": 6,
        "guided_step": 6,
        "title": "6. Keep your song",
        "question": "Anything you want to change?",
        "book_equivalent": "Step 6: Finishing Touches",
        "fluid_equivalent": "Finished Song",
        "producer_mentor": "Patient Collaborator — Finishing & Saving",
        "formula_rule": "Listen back to your whole song, adjust any single part if you like, and save or download your work.",
        "depends_on": ["song_arc"],
    },
]


def compute_hit_producer_formula_telemetry(song_doc: dict[str, Any]) -> dict[str, Any]:
    """Compute internal musical balance metrics with a plain-English, zero-score summary."""
    notes = song_doc.get("notes") or []
    active_roles = sorted({str(n.get("role", "lead")) for n in notes})
    if song_doc.get("auto_harmony_stabs", True) and "harmony" not in active_roles:
        active_roles.append("harmony")

    kick_steps = {
        int(n.get("step", 0)) % 16
        for n in notes
        if n.get("role") == "drums" and n.get("patch_id") == "kick"
    }
    bass_notes = [n for n in notes if n.get("role") in ("bass", "hocket")]
    bass_on_kick = sum(1 for b in bass_notes if (int(b.get("step", 0)) % 16) in kick_steps)
    kick_lock_pct = round((bass_on_kick / max(1, len(bass_notes))) * 100.0, 1) if bass_notes else 100.0

    lead_notes = [n for n in notes if n.get("role") == "lead"]
    bar0_offsets = sorted({int(n.get("step", 0)) % 16 for n in lead_notes if 0 <= int(n.get("step", 0)) < 16})
    bar2_offsets = sorted({int(n.get("step", 0)) % 16 for n in lead_notes if 32 <= int(n.get("step", 0)) < 48})
    if bar0_offsets and bar0_offsets == bar2_offsets:
        symmetry_pct = 100.0
    elif bar0_offsets and bar2_offsets:
        overlap = len(set(bar0_offsets) & set(bar2_offsets))
        symmetry_pct = round((overlap / max(1, len(set(bar0_offsets) | set(bar2_offsets)))) * 100.0, 1)
    else:
        symmetry_pct = 85.0

    return {
        "active_stream_count": len(active_roles),
        "quincy_rule_of_4_ok": len(active_roles) <= 4,
        "kick_bass_lock_pct": kick_lock_pct,
        "melodic_math_symmetry_pct": symmetry_pct,
        "formula_summary": "Clear balance · Steady rhythm and bass · Connected melodic phrase",
    }


def ensure_fluid_song_graph(song_doc: dict[str, Any]) -> dict[str, Any]:
    """Ensure song_doc contains a valid 6-step `fluid_song_graph` state object."""
    existing = song_doc.get("fluid_song_graph")
    if isinstance(existing, dict) and isinstance(existing.get("rungs"), list) and len(existing["rungs"]) == 6:
        existing.setdefault("user_decisions_count", 0)
        existing.setdefault("phrase_shaped", False)
        existing.setdefault("active_guided_step", 1)
        existing["telemetry"] = compute_hit_producer_formula_telemetry(song_doc)
        return existing

    rungs_state = []
    for idx, spec in enumerate(FLUID_SONG_RUNG_SPECS):
        r_id = spec["id"]
        rungs_state.append({
            "id": r_id,
            "rung_number": spec["rung_number"],
            "guided_step": spec.get("guided_step", idx + 1),
            "title": spec["title"],
            "question": spec.get("question", ""),
            "book_equivalent": spec["book_equivalent"],
            "fluid_equivalent": spec["fluid_equivalent"],
            "producer_mentor": spec["producer_mentor"],
            "formula_rule": spec["formula_rule"],
            "depends_on": list(spec["depends_on"]),
            "status": "active" if idx == 0 else "planned",
            "selected_option_id": "",
            "user_chosen": False,
            "stale_reason": None,
        })

    graph = {
        "schema_version": 2,
        "active_rung_id": "vibe_groove",
        "active_guided_step": 1,
        "user_decisions_count": 0,
        "phrase_shaped": False,
        "melody_adapted_notice": None,
        "rungs": rungs_state,
        "telemetry": compute_hit_producer_formula_telemetry(song_doc),
    }
    song_doc["fluid_song_graph"] = graph
    return graph
