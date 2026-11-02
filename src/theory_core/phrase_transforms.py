"""Shape the ending of the person's own phrase without replacing it (Phase 8.0, decision 1 + Phase 12b).

Each shape changes only the last note of each bar. Every note keeps its id and provenance;
changed notes gain a ``shaped_by`` record. The JS mirror is static/js/theory/phrase_transforms.js
and both are tested against the same fixture.

Phase 12b adds:
- #2 Mutable Instruments Marbles "Déjà Vu" loop-locked mutator (``mutate_deja_vu``)
- #14 BeepBox 1-click note transition decorators (``decorate_phrase_notes``)
"""
from __future__ import annotations

import copy
from typing import Any

from src.theory_core.models import SCALES

SHAPES = ("climb", "fall", "hang", "repeat", "leave_space")
DEJA_VU_MODES = ("spin_notes", "spin_rhythm", "shuffle_loop")
NOTE_DECORATORS = ("slide", "bounce", "sparkle")

# shape_step actions -> phrase shapes (mirrors SHAPE_ACTIONS in static/js/theory/phrase_transforms.js)
SHAPE_ACTIONS = {
    "melody_climb": "climb",
    "melody_fall": "fall",
    "melody_hang": "hang",
    "melody_repeat": "repeat",
    "melody_silence_drop": "leave_space",
}

STEPS_PER_BAR = 16


def _midi(note: dict[str, Any]) -> int | None:
    conc = note.get("concrete")
    if isinstance(conc, dict) and "midi_pitch" in conc:
        return int(conc["midi_pitch"])
    return None


def _set_midi(note: dict[str, Any], midi: int) -> None:
    note["pitch_lock_mode"] = "concrete"
    note["concrete"] = {**(note.get("concrete") or {}), "midi_pitch": int(midi)}


def _scale_pcs(root_pc: int, scale_type: str) -> list[int]:
    offsets = SCALES.get(scale_type, SCALES["major"])
    return [(int(root_pc) + o) % 12 for o in offsets]


def _next_scale_tone_up(midi: int, pcs: list[int]) -> int:
    m = midi + 1
    while m % 12 not in pcs:
        m += 1
    return m


def _home_at_or_below(midi: int, root_pc: int) -> int:
    return midi - ((midi - int(root_pc)) % 12)


def _bar_endings(lead: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    """Last note of each bar (highest step; first one wins on ties)."""
    endings: dict[int, dict[str, Any]] = {}
    for n in sorted(lead, key=lambda x: int(x.get("step", 0))):
        bar = int(n.get("step", 0)) // STEPS_PER_BAR
        endings[bar] = n
    return endings


def transform_phrase_ending(
    lead_notes: list[dict[str, Any]],
    shape: str,
    root_pc: int = 0,
    scale_type: str = "major",
) -> list[dict[str, Any]]:
    """Return a new list where only each bar's last note is shaped; nothing is added or removed."""
    if shape not in SHAPES:
        raise ValueError(f"Unknown phrase shape: {shape}")
    lead = copy.deepcopy(lead_notes)
    if not lead:
        return lead
    pcs = _scale_pcs(root_pc, scale_type)
    endings = _bar_endings(lead)
    first_bar = min(endings)
    reference = endings[first_bar]

    for bar, note in endings.items():
        step = int(note.get("step", 0))
        bar_end = (bar + 1) * STEPS_PER_BAR
        midi = _midi(note)
        changed = False
        if shape == "climb" and midi is not None:
            _set_midi(note, _next_scale_tone_up(midi, pcs))
            changed = True
        elif shape == "fall" and midi is not None:
            home = _home_at_or_below(midi, root_pc)
            if home != midi:
                _set_midi(note, home)
                changed = True
        elif shape == "hang":
            longer = max(int(note.get("duration_steps", 1)), bar_end - step)
            if longer != int(note.get("duration_steps", 1)):
                note["duration_steps"] = longer
                changed = True
        elif shape == "repeat" and bar != first_bar:
            ref_midi = _midi(reference)
            if ref_midi is not None:
                _set_midi(note, ref_midi)
            note["duration_steps"] = max(1, min(int(reference.get("duration_steps", 1)), bar_end - step))
            changed = True
        elif shape == "leave_space" and (bar - first_bar) % 2 == 1:
            if int(note.get("duration_steps", 1)) != 1:
                note["duration_steps"] = 1
                changed = True
        if changed:
            note["shaped_by"] = list(note.get("shaped_by") or []) + [shape]
    return lead


def mutate_deja_vu(
    lead_notes: list[dict[str, Any]],
    mode: str = "spin_notes",
    seed: int = 1,
) -> list[dict[str, Any]]:
    """Mutable Instruments Marbles Déjà Vu loop-locked mutator (#2).

    Permutes the user's own phrase per bar while keeping every note's id, provenance,
    and pitch multiset (or pitch sequence for spin_rhythm) intact:
    - ``spin_notes``: keeps exact rhythmic steps and durations, rotates/permutes the bar's pitch ring.
    - ``spin_rhythm``: keeps exact pitch sequence order, shifts step offsets inside the bar pocket.
    - ``shuffle_loop``: swaps adjacent note pairs or rotates the loop order deterministically.
    """
    if mode not in DEJA_VU_MODES:
        raise ValueError(f"Unknown deja vu mode: {mode}")
    lead = copy.deepcopy(lead_notes)
    if not lead:
        return lead

    s_val = max(1, abs(int(seed or 1)))
    by_bar: dict[int, list[dict[str, Any]]] = {}
    for n in sorted(lead, key=lambda x: int(x.get("step", 0))):
        bar = int(n.get("step", 0)) // STEPS_PER_BAR
        by_bar.setdefault(bar, []).append(n)

    tag = f"deja_vu:{mode}"
    for bar, notes in sorted(by_bar.items()):
        k = len(notes)
        if k == 0:
            continue
        bar_base = bar * STEPS_PER_BAR
        if mode == "spin_notes":
            if k >= 2:
                midis = [_midi(n) for n in notes]
                shift = ((s_val - 1) % (k - 1)) + 1
                rotated = [midis[(i + shift) % k] for i in range(k)]
                if s_val % 2 == 0 and k >= 3:
                    rotated[0], rotated[-1] = rotated[-1], rotated[0]
                for i, n in enumerate(notes):
                    if rotated[i] is not None:
                        _set_midi(n, int(rotated[i]))
                    n["shaped_by"] = list(n.get("shaped_by") or []) + [tag]
        elif mode == "spin_rhythm":
            shift_steps = (((s_val - 1) % 3) + 1) * 2
            local_steps = [((int(n.get("step", 0)) - bar_base) + shift_steps) % STEPS_PER_BAR for n in notes]
            used: set[int] = set()
            resolved: list[int] = []
            for st in sorted(local_steps):
                cand = st
                while cand in used and len(used) < STEPS_PER_BAR:
                    cand = (cand + 1) % STEPS_PER_BAR
                used.add(cand)
                resolved.append(cand)
            resolved.sort()
            for i, n in enumerate(notes):
                next_col = resolved[i]
                next_col_end = resolved[i + 1] if i + 1 < k else STEPS_PER_BAR
                n["step"] = bar_base + next_col
                n["duration_steps"] = max(1, min(int(n.get("duration_steps", 2)), next_col_end - next_col))
                n["shaped_by"] = list(n.get("shaped_by") or []) + [tag]
        elif mode == "shuffle_loop":
            if k >= 2:
                midis = [_midi(n) for n in notes]
                durs = [int(n.get("duration_steps", 2)) for n in notes]
                order = list(range(k))
                if s_val % 2 == 1:
                    for i in range(0, k - 1, 2):
                        order[i], order[i + 1] = order[i + 1], order[i]
                else:
                    order = list(reversed(order))
                for i, n in enumerate(notes):
                    src_idx = order[i]
                    if midis[src_idx] is not None:
                        _set_midi(n, int(midis[src_idx]))
                    next_col = (int(notes[i + 1].get("step", 0)) - bar_base) if i + 1 < k else STEPS_PER_BAR
                    cur_col = int(n.get("step", 0)) - bar_base
                    n["duration_steps"] = max(1, min(durs[src_idx], next_col - cur_col))
                    n["shaped_by"] = list(n.get("shaped_by") or []) + [tag]
    return lead


def decorate_phrase_notes(
    lead_notes: list[dict[str, Any]],
    decorator: str | None,
) -> list[dict[str, Any]]:
    """BeepBox 1-click note transition decorators (#14): ``slide``, ``bounce``, ``sparkle``.

    Applies or toggles the transition decorator on each note in ``lead_notes`` while preserving
    every note's id, step, midi_pitch, and provenance.
    """
    if decorator is not None and decorator not in NOTE_DECORATORS:
        raise ValueError(f"Unknown note decorator: {decorator}")
    lead = copy.deepcopy(lead_notes)
    if not lead:
        return lead

    all_have = decorator is not None and all(n.get("transition") == decorator for n in lead)
    target = None if all_have else decorator
    tag = f"decorator:{decorator}" if decorator else None

    for n in lead:
        shaped = [s for s in (n.get("shaped_by") or []) if not str(s).startswith("decorator:")]
        if target is None:
            n.pop("transition", None)
            if shaped:
                n["shaped_by"] = shaped
            else:
                n.pop("shaped_by", None)
        else:
            n["transition"] = target
            n["shaped_by"] = shaped + ([tag] if tag else [])
    return lead
