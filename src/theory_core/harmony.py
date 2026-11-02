"""Functional chord state machine, minimal-motion C3-E5 voice leading, and step-by-step chord-tone gravity."""
from __future__ import annotations

from typing import Any
from src.theory_core.models import NOTE_NAMES, SCALES, midi_to_freq, midi_to_name

# Functional State Machine roles for chord degrees in Minor/Dorian & Major
FUNCTIONAL_STATES: dict[int, dict[str, Any]] = {
    1: {
        "state": "home",
        "state_label": "Home / Tonic Anchor",
        "felt_effect": "Grounded center of gravity where phrases start or resolve.",
        "suggested_next": [6, 7, 4, 5],
    },
    3: {
        "state": "bittersweet_lift",
        "state_label": "Relative Major Lift",
        "felt_effect": "Opens up a wider, heroic horizon while sharing two tones with Home.",
        "suggested_next": [6, 7, 4, 1],
    },
    4: {
        "state": "subdominant_lift",
        "state_label": "Forward Departure (Subdominant)",
        "felt_effect": "Steps away from Home and creates forward momentum (Dorian bright lift if Major IV).",
        "suggested_next": [7, 5, 1, 6],
    },
    5: {
        "state": "dominant_tension",
        "state_label": "High Tension / Pulls Home",
        "felt_effect": "Strongest magnetic pull back to the Home chord (1).",
        "suggested_next": [1, 6],
    },
    6: {
        "state": "dark_departure",
        "state_label": "Emotional / Cinematic Turn (VI)",
        "felt_effect": "Lush, emotional shift that deepens the progression without losing stability.",
        "suggested_next": [3, 7, 4, 5],
    },
    7: {
        "state": "power_pickup",
        "state_label": "Power Pickup (bVII)",
        "felt_effect": "Energetic rock and electronic launchpad that drives back into Home (1).",
        "suggested_next": [1, 3, 4],
    },
    2: {
        "state": "pre_tension",
        "state_label": "Stepping Stone (ii)",
        "felt_effect": "Transitional tension that bridges into Dominant (5) or Power Pickup (7).",
        "suggested_next": [5, 7, 1],
    },
}

CHORD_INTERVALS: dict[str, list[int]] = {
    "min": [0, 3, 7],
    "maj": [0, 4, 7],
    "min7": [0, 3, 7, 10],
    "maj7": [0, 4, 7, 11],
    "dom7": [0, 4, 7, 10],
    "power": [0, 7, 12],
    "sus2": [0, 2, 7],
    "sus4": [0, 5, 7],
}


def chord_pitch_classes(root_pc: int, scale_type: str, degree: int, quality: str | None = None) -> tuple[int, list[int], str]:
    """Return (chord_root_pc, list_of_chord_pcs, resolved_quality) for a 1-based scale degree."""
    scale = SCALES.get(scale_type, SCALES["natural_minor"])
    deg_idx = (max(1, int(degree)) - 1) % len(scale)
    chord_root = (int(root_pc) + scale[deg_idx]) % 12

    if quality and quality in CHORD_INTERVALS:
        intervals = CHORD_INTERVALS[quality]
        pcs = [(chord_root + iv) % 12 for iv in intervals]
        return chord_root, pcs, quality

    # Diatonic triad construction from scale degrees
    third_pc = (int(root_pc) + scale[(deg_idx + 2) % len(scale)]) % 12
    fifth_pc = (int(root_pc) + scale[(deg_idx + 4) % len(scale)]) % 12
    third_iv = (third_pc - chord_root) % 12
    inferred_quality = "maj" if third_iv == 4 else "min"
    return chord_root, [chord_root, third_pc, fifth_pc], inferred_quality


def _melody_note_midi(n: dict[str, Any], root_pc: int, scale_type: str) -> int:
    """Concrete MIDI pitch of a melody note (same resolution the harmoniser has always used)."""
    if n.get("pitch_lock_mode") == "concrete" and n.get("concrete"):
        return int(n["concrete"].get("midi_pitch", 60))
    if n.get("concrete") and "midi_pitch" in n["concrete"]:
        return int(n["concrete"]["midi_pitch"])
    if "midi_pitch" in n:
        return int(n["midi_pitch"])
    deg = int((n.get("scale_lock") or {}).get("degree", 1))
    oct_off = int((n.get("scale_lock") or {}).get("octave_offset", 0))
    scale = SCALES.get(scale_type, SCALES["major"])
    deg_idx = (max(1, deg) - 1) % len(scale)
    return 60 + (int(root_pc) % 12) + scale[deg_idx] + (oct_off * 12)


def held_pcs_by_bar(
    melody_notes: list[dict[str, Any]], root_pc: int, scale_type: str = "major", bars: int = 4, steps_per_bar: int = 16
) -> dict[int, set[int]]:
    """Pitch classes of held melody notes (a beat or longer), in EVERY bar they sound in (Phase 9b)."""
    held: dict[int, set[int]] = {}
    for n in melody_notes or []:
        if "step" not in n:
            continue
        step = int(n.get("step", 0))
        dur = int(n.get("duration_steps", 2))
        if dur < 4 or step >= bars * steps_per_bar:
            continue
        pc = _melody_note_midi(n, root_pc, scale_type) % 12
        last_bar = min(bars - 1, (step + dur - 1) // steps_per_bar)
        for b in range(step // steps_per_bar, last_bar + 1):
            held.setdefault(b, set()).add(pc)
    return held


def _clashes(held: set[int], tone: int) -> bool:
    return any((h - tone) % 12 in (1, 11) for h in held)


def rescue_chord_tones(chord_root_pc: int, chord_pcs: list[int], held: set[int]) -> tuple[list[int], str | None, bool]:
    """Re-voice chord tones that sit a semitone from a held melody note; the melody never changes (Phase 9b).

    Returns (sounding_pcs, rescue_label, bass_plays_fifth). Rules: a clashing third becomes the 4th (sus4),
    else the 2nd (sus2), else the root (open fifth); a clashing fifth becomes the root; a clashing root leaves
    the upper voices, and if the melody sits a b9 above the root the bass plays the fifth instead.
    """
    if not held or len(chord_pcs) < 3:
        return list(chord_pcs), None, False
    root, third, fifth = chord_pcs[0] % 12, chord_pcs[1] % 12, chord_pcs[2] % 12
    labels: list[str] = []
    bass_fifth = False
    root_clash = _clashes(held, root)
    if _clashes(held, third):
        sus4, sus2 = (root + 5) % 12, (root + 2) % 12
        if not _clashes(held, sus4):
            third, label = sus4, "sus4"
        elif not _clashes(held, sus2):
            third, label = sus2, "sus2"
        elif not root_clash:
            third, label = root, "open5"
        else:
            third, label = None, "open5"
        labels.append(label)
    if _clashes(held, fifth):
        fifth = None if root_clash else root
        labels.append("no_fifth" if root_clash else "root_for_fifth")
    upper = [pc for pc in (None if root_clash else root, third, fifth) if pc is not None]
    # a 7th (or other added tone) stays unless it clashes; a dropped one is named, never silent
    for extra in chord_pcs[3:]:
        if _clashes(held, extra % 12):
            labels.append("no_7th")
        else:
            upper.append(extra % 12)
    if root_clash:
        labels.append("no_root")
        bass_fifth = any((h - root) % 12 == 1 for h in held)
    # keep only tones that don't clash (a replacement tone could still clash with another held note);
    # if nothing is left, double a tone that clashes with nothing, a held melody note itself if need be
    upper = [pc for pc in upper if not _clashes(held, pc)]
    if not upper:
        safe = [pc for pc in [(root + 7) % 12, root, *sorted(held)] if not _clashes(held, pc)]
        upper = safe[:1] or [sorted(held)[0]]
    return upper, ("+".join(labels) if labels else None), bass_fifth


def generate_candidate_voicings(
    chord_root_pc: int, chord_pcs: list[int], held: set[int] | None = None
) -> list[list[int]]:
    """Generate clean 3-voice upper chord voicings strictly inside C3-E5 (MIDI 48..76) with no interval < 7 st below C3.

    A chord with fewer than 3 tones is padded with its fifth, or, when the fifth would clash with a held
    melody note (Phase 9b), by doubling one of its own tones an octave away.
    """
    unique_pcs = []
    for pc in chord_pcs:
        if pc % 12 not in unique_pcs:
            unique_pcs.append(pc % 12)
    pad = (chord_root_pc + 7) % 12
    target_pcs = list(unique_pcs)
    while len(target_pcs) < 3:
        if held and _clashes(held, pad):
            target_pcs.append(unique_pcs[(len(target_pcs) - len(unique_pcs)) % len(unique_pcs)] if unique_pcs else pad)
        else:
            target_pcs.append(pad)
    target_pcs = target_pcs[:3]

    pool: list[list[int]] = []
    for pc in target_pcs:
        notes_for_pc = [m for m in range(52, 75) if m % 12 == pc]
        pool.append(notes_for_pc)

    candidates: list[list[int]] = []
    for n0 in pool[0]:
        for n1 in pool[1]:
            for n2 in pool[2]:
                voicing = sorted([n0, n1, n2])
                if len(set(voicing)) < 3:
                    continue
                if voicing[0] < 48 or voicing[-1] > 76:
                    continue
                if voicing[1] - voicing[0] < 3 or voicing[2] - voicing[1] < 3:
                    continue
                if voicing[2] - voicing[0] > 16:
                    continue
                candidates.append(voicing)

    if not candidates:
        if held:
            # stack the chord's own tones upward from around C4
            stacked: list[int] = []
            m = 55
            for pc in target_pcs:
                m = m + ((pc - m) % 12 or (12 if stacked else 0))
                if m <= 76:
                    stacked.append(m)
            candidates.append(stacked)
        else:
            base = 60 + (chord_root_pc % 12)
            if base > 67:
                base -= 12
            candidates.append([base, base + 3, base + 7])
    return candidates


def voice_chord_progression(
    root_pc: int,
    scale_type: str,
    progression: list[dict[str, Any]],
    voice_leading_mode: str = "smooth",
    held_by_bar: dict[int, set[int]] | None = None,
) -> list[dict[str, Any]]:
    """Voice a chord progression with minimal-motion voice leading in C3-E5 (MIDI 48..76) and Bass in C1-B2.

    When voice_leading_mode == 'raw_block', uses naive root-position block triads with parallel jumps
    for Contrastive A/B Bypass auditioning.
    """
    voiced_list: list[dict[str, Any]] = []
    prev_voicing: list[int] | None = None

    for idx, item in enumerate(progression):
        degree = int(item.get("degree", 1))
        quality = item.get("quality")
        chord_root_pc, chord_pcs, resolved_quality = chord_pitch_classes(
            root_pc, scale_type, degree, quality
        )
        bar_no = int(item.get("bar", idx))
        held = (held_by_bar or {}).get(bar_no, set()) if voice_leading_mode != "raw_block" else set()
        sounding_pcs, rescue, bass_fifth = rescue_chord_tones(chord_root_pc, chord_pcs, held)

        if voice_leading_mode == "raw_block":
            # Naive beginner root-position block triad with parallel jumps
            base_oct = 48 if (idx % 2 == 0) else 60
            root_m = base_oct + chord_root_pc
            third_iv = 3 if resolved_quality.startswith("min") else 4
            best = [root_m, root_m + third_iv, root_m + 7]
            if prev_voicing is None:
                avg_motion = 0.0
            else:
                avg_motion = round(
                    sum(abs(a - b) for a, b in zip(best, prev_voicing)) / len(best), 3
                )
        else:
            candidates = generate_candidate_voicings(chord_root_pc, sounding_pcs, held)
            if prev_voicing is None:
                # Prefer a centered voicing near C4 (MIDI 60)
                best = min(
                    candidates,
                    key=lambda v: abs((sum(v) / len(v)) - 61.0) + 0.1 * (v[-1] - v[0]),
                )
                avg_motion = 0.0
            else:
                best = min(
                    candidates,
                    key=lambda v: (
                        sum(abs(a - b) for a, b in zip(v, prev_voicing)) / len(v)
                        + 0.04 * abs((sum(v) / len(v)) - 61.0)
                    ),
                )
                avg_motion = round(
                    sum(abs(a - b) for a, b in zip(best, prev_voicing)) / len(best), 3
                )

        prev_voicing = best

        # Bass root strictly in C1-B2 (MIDI 24..47), preferring E1-D#2 (MIDI 28..39)
        bass_pc = chord_pcs[2] % 12 if bass_fifth else chord_root_pc
        bass_midi = 36 + bass_pc
        if bass_midi > 43:
            bass_midi -= 12
        if bass_midi < 28:
            bass_midi += 12

        state_meta = FUNCTIONAL_STATES.get(degree, FUNCTIONAL_STATES[1])
        chord_name = f"{NOTE_NAMES[chord_root_pc]}{'' if resolved_quality == 'maj' else ('m' if resolved_quality == 'min' else resolved_quality)}"
        if rescue:
            if rescue.startswith("sus4"):
                chord_name = f"{NOTE_NAMES[chord_root_pc]}sus4"
            elif rescue.startswith("sus2"):
                chord_name = f"{NOTE_NAMES[chord_root_pc]}sus2"
            elif rescue.startswith("open5"):
                chord_name = f"{NOTE_NAMES[chord_root_pc]}5"
            if "no_root" in rescue:
                chord_name += " (no root)"
        roman_str = item.get("roman") or _default_roman(degree, resolved_quality)
        short_fn = state_meta["state_label"].split("/")[0].strip()

        voiced_list.append({
            "bar": int(item.get("bar", idx)),
            "beats": int(item.get("beats", 4)),
            "degree": degree,
            "roman": roman_str,
            "roman_function_label": f"{roman_str} · {short_fn}",
            "quality": resolved_quality,
            "chord_name": chord_name,
            "chord_root_pc": chord_root_pc,
            "chord_pcs": chord_pcs,
            "sounding_pcs": sounding_pcs,
            "rescue": rescue,
            "bass_midi": bass_midi,
            "bass_note": midi_to_name(bass_midi),
            "voiced_midi": best,
            "voiced_names": [midi_to_name(m) for m in best],
            "voiced_freqs": [midi_to_freq(m) for m in best],
            "avg_voice_motion_st": avg_motion,
            "state": state_meta["state"],
            "state_label": state_meta["state_label"],
            "why_label": f"{chord_name} ({state_meta['state_label']}): {state_meta['felt_effect']}",
            "suggested_next": state_meta["suggested_next"],
        })

    return voiced_list


def _default_roman(degree: int, quality: str) -> str:
    numerals = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII"}
    base = numerals.get(degree, "I")
    if quality.startswith("min"):
        return base.lower()
    if degree in (3, 6, 7) and quality in ("maj", "maj7", "dom7", "power"):
        return f"b{base}"
    return base


def classify_step_gravity(
    root_pc: int,
    scale_type: str,
    voiced_chord: dict[str, Any],
) -> dict[int, dict[str, Any]]:
    """Classify all 12 pitch classes at a step into tier_1_anchor, tier_2_tension, or chromatic with plain-English why_label."""
    scale_offsets = SCALES.get(scale_type, SCALES["natural_minor"])
    scale_pcs = [(int(root_pc) + off) % 12 for off in scale_offsets]
    chord_pcs = [int(pc) % 12 for pc in voiced_chord["chord_pcs"]]
    chord_root_pc = int(voiced_chord["chord_root_pc"]) % 12
    chord_name = voiced_chord["chord_name"]

    result: dict[int, dict[str, Any]] = {}
    for pc in range(12):
        note_name = NOTE_NAMES[pc]
        if pc in chord_pcs:
            role_idx = chord_pcs.index(pc)
            role_name = (
                "Chord Root (Strongest Anchor)"
                if pc == chord_root_pc
                else ("Chord 3rd (Emotional Color Anchor)" if role_idx == 1 else "Chord 5th (Power Lock Anchor)")
            )
            result[pc] = {
                "pc": pc,
                "note_name": note_name,
                "tier": "tier_1_anchor",
                "shape_mark": "●",
                "shape_kind": "filled_circle",
                "pattern": "solid",
                "is_avoid_clash": False,
                "resolution_target_pc": pc,
                "resolution_target_name": note_name,
                "why_label": (
                    f"{note_name} is the {role_name} of {chord_name} — safe to land on strong beats or hold."
                ),
            }
        elif pc in scale_pcs:
            # Find nearest chord tone for resolution
            nearest_chord_pc = min(
                chord_pcs,
                key=lambda c: min((pc - c) % 12, (c - pc) % 12),
            )
            target_name = NOTE_NAMES[nearest_chord_pc]
            # Check if pc is 1 semitone above a chord tone (classic semitone avoid clash if sustained)
            avoid = any(((pc - c) % 12) == 1 for c in chord_pcs)
            if avoid:
                why = (
                    f"{note_name} is an in-scale Tension Clash (1 semitone above {target_name} in {chord_name}) "
                    f"— use as a fast passing note resolving down to {target_name}."
                )
            else:
                why = (
                    f"{note_name} is an in-scale Color/Motion Tone over {chord_name} "
                    f"— creates melodic movement and resolves smoothly to {target_name}."
                )
            result[pc] = {
                "pc": pc,
                "note_name": note_name,
                "tier": "tier_2_tension",
                "shape_mark": "◇",
                "shape_kind": "hollow_diamond",
                "pattern": "dashed",
                "is_avoid_clash": avoid,
                "resolution_target_pc": nearest_chord_pc,
                "resolution_target_name": target_name,
                "why_label": why,
            }
        else:
            nearest_chord_pc = min(
                chord_pcs,
                key=lambda c: min((pc - c) % 12, (c - pc) % 12),
            )
            target_name = NOTE_NAMES[nearest_chord_pc]
            result[pc] = {
                "pc": pc,
                "note_name": note_name,
                "tier": "chromatic",
                "shape_mark": "▲",
                "shape_kind": "warning_triangle",
                "pattern": "dotted",
                "is_avoid_clash": True,
                "resolution_target_pc": nearest_chord_pc,
                "resolution_target_name": target_name,
                "why_label": (
                    f"{note_name} is outside the scale over {chord_name} — resolves by half-step to {target_name}."
                ),
            }
    return result


def harmonize_melody_phrase(
    melody_notes: list[dict[str, Any]],
    root_pc: int,
    scale_type: str = "major",
    pinned_bars: dict[int, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Melody-First Harmonizer (Phase 7 Decision A1 — Idea-Early Architecture).

    Takes the user's Step-3 melody notes (4 bars = 16 beats) and synthesizes 3 distinct
    4-bar chord progressions that fit underneath the user's unchanged melody notes:
      1. Warm & Grounded (`prog_pop_anthem` / `alt_warm_grounded`)
      2. Floating & Deep (`prog_warm_story` / `alt_floating_deep`)
      3. Driving & Bold (`prog_minor_lift` / `alt_driving_bold`)
    """
    is_major = scale_type == "major"
    if is_major:
        diatonic_pool = [
            {"degree": 1, "roman": "I", "quality": "maj"},
            {"degree": 2, "roman": "ii", "quality": "min"},
            {"degree": 3, "roman": "iii", "quality": "min"},
            {"degree": 4, "roman": "IV", "quality": "maj"},
            {"degree": 5, "roman": "V", "quality": "maj"},
            {"degree": 6, "roman": "vi", "quality": "min"},
        ]
    else:
        diatonic_pool = [
            {"degree": 1, "roman": "i", "quality": "min"},
            {"degree": 3, "roman": "bIII", "quality": "maj"},
            {"degree": 4, "roman": "iv", "quality": "min"},
            {"degree": 5, "roman": "v", "quality": "min"},
            {"degree": 6, "roman": "bVI", "quality": "maj"},
            {"degree": 7, "roman": "bVII", "quality": "maj"},
        ]

    # Resolve each melody note's concrete pitch class per bar (0..3)
    bar_notes: dict[int, list[tuple[int, float]]] = {0: [], 1: [], 2: [], 3: []}
    for n in melody_notes or []:
        if "step" in n:
            step_val = int(n.get("step", 0))
            if step_val >= 64:
                continue
            bar_idx = max(0, min(3, step_val // 16))
            dur = float(n.get("duration_steps", 2)) / 4.0
            beat_in_bar = (step_val % 16) / 4.0
        else:
            beat = float(n.get("start_beat", 0.0))
            if beat >= 16.0:
                continue
            bar_idx = max(0, min(3, int(beat // 4.0)))
            dur = float(n.get("duration_beats", 1.0))
            beat_in_bar = beat % 4.0
        metric_weight = dur * (1.5 if (beat_in_bar % 2.0 == 0.0) else 1.0)
        if n.get("pitch_lock_mode") == "concrete" and n.get("concrete"):
            midi_p = int(n["concrete"].get("midi_pitch", 60))
        elif n.get("concrete") and "midi_pitch" in n["concrete"]:
            midi_p = int(n["concrete"]["midi_pitch"])
        elif "midi_pitch" in n:
            midi_p = int(n["midi_pitch"])
        else:
            deg = int((n.get("scale_lock") or {}).get("degree", 1))
            oct_off = int((n.get("scale_lock") or {}).get("octave_offset", 0))
            scale = SCALES.get(scale_type, SCALES["major"])
            deg_idx = (max(1, deg) - 1) % len(scale)
            midi_p = 60 + (int(root_pc) % 12) + scale[deg_idx] + (oct_off * 12)
        bar_notes[bar_idx].append((midi_p % 12, metric_weight))
        if "step" in n:
            # Phase 9b: a held note also sounds in the following bars; score it there too.
            end_step = int(n.get("step", 0)) + int(n.get("duration_steps", 2))
            for later in range(bar_idx + 1, min(4, (end_step - 1) // 16 + 1)):
                beats_here = (min(end_step, (later + 1) * 16) - later * 16) / 4.0
                bar_notes[later].append((midi_p % 12, beats_here))

    def _score_candidate(cand: dict[str, Any], bar_idx: int, mood: str) -> float:
        c_root, c_pcs, _ = chord_pitch_classes(root_pc, scale_type, cand["degree"], cand["quality"])
        notes_in_bar = bar_notes.get(bar_idx, [])
        score = 0.0
        for pc, w in notes_in_bar:
            if pc == c_root:
                score += 3.5 * w
            elif pc in c_pcs:
                score += 2.6 * w
            else:
                # Check if pc is 1 semitone above any chord tone (avoid clash)
                is_avoid_semitone = any(((pc - cp) % 12) == 1 for cp in c_pcs)
                if is_avoid_semitone:
                    score -= 50.0
                else:
                    score += 0.6 * w
        deg = cand["degree"]
        if mood == "warm":
            if bar_idx == 0 and deg == 1:
                score += 4.0
            elif bar_idx == 3 and deg in (4, 5):
                score += 2.2
            if deg in (1, 4, 5):
                score += 1.2
        elif mood == "floating":
            if bar_idx == 0 and deg in (6, 4, 3):
                score += 3.5
            if deg in (6, 4, 2, 3):
                score += 1.5
        elif mood == "driving":
            if bar_idx == 0 and deg in (6, 2, 4, 7):
                score += 2.8
            elif bar_idx == 3 and deg in (5, 7):
                score += 3.2
            if deg in (5, 7, 6, 3):
                score += 1.3
        return round(score, 4)

    pinned_lookup: dict[int, dict[str, Any]] = {}
    if isinstance(pinned_bars, dict):
        for k, v in pinned_bars.items():
            try:
                b_key = int(k)
            except (TypeError, ValueError):
                continue
            if 0 <= b_key < 4 and isinstance(v, dict) and "degree" in v:
                pinned_lookup[b_key] = v

    def _build_progression_for_mood(mood: str, fallback_degrees: list[int], avoid_first_deg: set[int]) -> list[dict[str, Any]]:
        prog: list[dict[str, Any]] = []
        prev_deg: int | None = None
        for b in range(4):
            if b in pinned_lookup:
                p_item = pinned_lookup[b]
                p_deg = int(p_item["degree"])
                chosen = next(
                    (c for c in diatonic_pool if c["degree"] == p_deg),
                    {
                        "degree": p_deg,
                        "roman": str(p_item.get("roman") or "I"),
                        "quality": str(p_item.get("quality") or ("maj" if is_major else "min")),
                    },
                )
            else:
                notes_in_bar = bar_notes.get(b, [])
                if not notes_in_bar:
                    target_deg = fallback_degrees[b]
                    chosen = next((c for c in diatonic_pool if c["degree"] == target_deg), diatonic_pool[0])
                else:
                    ranked = sorted(
                        diatonic_pool,
                        key=lambda c: (
                            _score_candidate(c, b, mood)
                            - (2.0 if prev_deg == c["degree"] else 0.0)
                            - (3.0 if (b == 0 and c["degree"] in avoid_first_deg) else 0.0)
                        ),
                        reverse=True,
                    )
                    chosen = ranked[0]
            prev_deg = chosen["degree"]
            prog.append({
                "bar": b,
                "beats": 4,
                "degree": chosen["degree"],
                "roman": chosen["roman"],
                "quality": chosen["quality"],
            })
        return prog

    held_map = held_pcs_by_bar(melody_notes, root_pc, scale_type)
    used_first_bar_degs: set[int] = set()
    prog_warm = _build_progression_for_mood(
        "warm",
        [1, 5, 6, 4] if is_major else [1, 6, 3, 7],
        used_first_bar_degs,
    )
    used_first_bar_degs.add(prog_warm[0]["degree"])

    prog_floating = _build_progression_for_mood(
        "floating",
        [6, 4, 1, 5] if is_major else [6, 4, 1, 7],
        used_first_bar_degs,
    )
    used_first_bar_degs.add(prog_floating[0]["degree"])

    prog_driving = _build_progression_for_mood(
        "driving",
        [4, 5, 6, 5] if is_major else [1, 7, 6, 5],
        used_first_bar_degs,
    )

    specs = [
        {
            "id": "prog_pop_anthem",
            "alt_id": "alt_anthemic_lift",
            "title": "Warm & Grounded",
            "summary": "Wraps your melody in home-base chords so every phrase feels solid and resolved.",
            "why": "Fits warm home chords directly underneath the longest notes of your melody.",
            "progression": prog_warm,
        },
        {
            "id": "prog_warm_story",
            "alt_id": "alt_warm_story",
            "title": "Floating & Deep",
            "summary": "Shifts the chords underneath your exact same melody for a deeper, bittersweet color.",
            "why": "Keeps your melody untouched while changing the underlying chords to a deeper emotional shade.",
            "progression": prog_floating,
        },
        {
            "id": "prog_minor_lift",
            "alt_id": "alt_soul_turnaround",
            "title": "Driving & Bold",
            "summary": "Pushes forward underneath your melody and builds strong momentum back to the start.",
            "why": "Uses forward-leaning chords on the final bar so your melody pulls strongly into the next section.",
            "progression": prog_driving,
        },
    ]

    out: list[dict[str, Any]] = []
    for sp in specs:
        voiced = voice_chord_progression(
            root_pc, scale_type, sp["progression"], voice_leading_mode="smooth", held_by_bar=held_map
        )
        out.append({
            "id": sp["id"],
            "alt_id": sp["alt_id"],
            "title": sp["title"],
            "summary": sp["summary"],
            "why": sp["why"],
            "progression": sp["progression"],
            "voiced_chords": voiced,
        })
    return out


def suggest_harmony_alternatives(
    root_pc: int,
    scale_type: str = "major",
    melody_notes: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Return 3 harmony progression alternatives fitted around the user's melody phrase (Louie et al. CHI 2020 steering pattern)."""
    harmonized = harmonize_melody_phrase(melody_notes or [], root_pc, scale_type)
    out = []
    for idx, item in enumerate(harmonized, start=1):
        out.append({
            "id": item["alt_id"],
            "wizard_id": item["id"],
            "title": f"Option {idx}: {item['title']}",
            "summary": item["summary"],
            "why": item["why"],
            "progression": item["progression"],
            "voiced_chords": item["voiced_chords"],
        })
    return out


def suggest_next(
    cells: list[int | None],
    just_col: int,
    rows: list[int],
    root_pc: int = 0,
    chord_pcs_list: list[list[int]] | None = None,
) -> list[dict[str, Any]]:
    """Python mirror of `suggestNext` in `static/js/theory/suggest.js` (#4 Heard-First Ghost Sparks)."""
    if just_col < 0 or just_col >= len(cells) or cells[just_col] is None or not rows:
        return []
    prev_midi = int(cells[just_col])  # type: ignore[arg-type]
    before = just_col - 1
    while before >= 0 and cells[before] is None:
        before -= 1
    stride = (just_col - before) if (before >= 0 and (just_col - before) <= 4) else 2
    col = next((c for c in (just_col + stride, just_col + 2, just_col + 1) if c < len(cells) and cells[c] is None), None)
    if col is None:
        return []

    if prev_midi in rows:
        prev = rows.index(prev_midi)
    else:
        prev = min(range(len(rows)), key=lambda i: abs(rows[i] - prev_midi))

    c_list = chord_pcs_list or []
    pc_of = lambda m: ((int(m) % 12) + 12) % 12
    clashes = lambda r: any(any(pc_of(rows[r] - c) == 1 for c in pcs) for pcs in c_list)
    is_chord_tone = lambda r: any(any(pc_of(rows[r]) == pc_of(c) for c in pcs) for pcs in c_list)

    home_row = -1
    for r, m in enumerate(rows):
        if pc_of(m) == pc_of(root_pc) and (home_row < 0 or abs(r - prev) < abs(home_row - prev)):
            home_row = r

    is_cadence = col >= len(cells) - 2
    base_order = (
        [("home", home_row), ("repeat", prev), ("down", prev - 1), ("up", prev + 1)]
        if is_cadence
        else [("repeat", prev), ("up", prev + 1), ("down", prev - 1), ("home", home_row)]
    )
    valid: list[dict[str, Any]] = []
    seen: set[int] = set()
    for kind, row in base_order:
        if row < 0 or row >= len(rows) or row in seen or clashes(row):
            continue
        seen.add(row)
        valid.append({"col": col, "midi": rows[row], "kind": kind, "chord_tone": is_chord_tone(row)})

    if not is_cadence and col % 4 == 0 and c_list:
        valid.sort(key=lambda item: int(bool(item["chord_tone"])), reverse=True)

    return [{"col": v["col"], "midi": v["midi"], "kind": v["kind"]} for v in valid[:2]]

