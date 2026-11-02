"""Canonical song compiler producing the shared CompiledSong schedule for Web Audio and Python WAV synthesis."""
from __future__ import annotations

import copy
import math
from typing import Any
from src.theory_core.models import NOTE_NAMES, midi_to_freq
from src.theory_core.harmony import held_pcs_by_bar, voice_chord_progression, classify_step_gravity
from src.theory_core.hocket import apply_monophonic_hocket_choke, resolve_note_pitch
from src.theory_core.arranger import expand_sections_for_compiler

# Natural metric accent weights across a 16-step bar (ensures velocity variance sigma >= 0.04)
METRIC_ACCENT_WEIGHTS = [
    1.12, 0.84, 0.94, 0.86,
    1.06, 0.85, 0.96, 0.88,
    1.09, 0.84, 0.95, 0.87,
    1.05, 0.86, 0.98, 0.91,
]


def _performed_values(note: dict[str, Any]) -> dict[str, float]:
    """Versioned exact ordinary note values plus a fractional onset offset."""
    source = note.get("performance")
    if not isinstance(source, dict) or type(source.get("version")) not in (int, float) or source.get("version") != 1:
        return {}
    result = {"offset_steps": 0, "duration_steps": 1, "velocity": .85}
    for key, upper in (("offset_steps", 1), ("duration_steps", 64), ("velocity", 1)):
        value = source.get(key) if key == "offset_steps" else note.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        if value < 0 or value > upper or (key == "offset_steps" and value == upper) or (key == "duration_steps" and value == 0):
            continue
        if not math.isfinite(value):
            continue
        result[key] = value
    return result


def compile_song(
    song_doc: dict[str, Any],
    scaffold_options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compile a SongDocument (in 4-bar 'loop' mode or multi-section 'song' mode) into a deterministic CompiledSong schedule."""
    if isinstance(song_doc.get("song_cards"), list) and song_doc["song_cards"]:
        from src.theory_core.song_cards import compile_song_cards
        return compile_song_cards(song_doc, scaffold_options, compile_song)
    # Validate opt-in ordinary fields before harmony/choke helpers inspect them.
    # This local view never repairs or overwrites the saved source document.
    validated_notes = []
    for note in song_doc.get("notes") or []:
        performed = _performed_values(note)
        validated_notes.append({**note, "duration_steps": performed["duration_steps"], "velocity": performed["velocity"]}
                               if performed else note)
    song_doc = {**song_doc, "notes": validated_notes}
    opts = dict(song_doc.get("scaffold_options") or {})
    if scaffold_options:
        opts.update(scaffold_options)
    voice_leading_mode = str(opts.get("voice_leading", "smooth"))
    hocket_choke_enabled = bool(opts.get("hocket_choke", True))
    humanize_enabled = bool(opts.get("humanize", True))
    pre_drop_silence_enabled = bool(opts.get("pre_drop_silence", True))
    harmony_display_mode = str(opts.get("harmony_display_mode", "post_placement"))

    ctx = song_doc.get("global_context") or song_doc.get("global_Context") or {}
    bpm = float(ctx.get("bpm", 110.0))
    swing = max(0.50, min(0.68, float(ctx.get("swing", 0.53)))) if humanize_enabled else 0.50
    root_pc = int(ctx.get("root_pc", 7)) % 12
    scale_type = str(ctx.get("scale_type", "natural_minor"))
    core_bars = int(ctx.get("bars", 4))
    steps_per_bar = ctx.get("steps_per_bar", 16)
    if type(steps_per_bar) is not int or steps_per_bar not in (12, 16):
        raise ValueError("Unsupported musical cycle.")
    step_sec = (60.0 / bpm) / 4.0

    prog_map = song_doc.get("chord_progressions") or {}
    active_prog_id = song_doc.get("active_progression_id", "prog-main")
    raw_prog = prog_map.get(active_prog_id) or [
        {"bar": 0, "beats": 4, "degree": 1, "roman": "i", "quality": "min"},
        {"bar": 1, "beats": 4, "degree": 6, "roman": "bVI", "quality": "maj"},
        {"bar": 2, "beats": 4, "degree": 7, "roman": "bVII", "quality": "maj"},
        {"bar": 3, "beats": 4, "degree": 1, "roman": "i", "quality": "min"},
    ]

    lead_for_rescue = [
        n for n in (song_doc.get("notes") or [])
        if n.get("role") == "lead" and (n.get("concrete") or {}).get("midi_pitch") is not None
    ]
    voiced_chords = voice_chord_progression(
        root_pc, scale_type, raw_prog, voice_leading_mode=voice_leading_mode,
        held_by_bar=held_pcs_by_bar(lead_for_rescue, root_pc, scale_type, bars=4, steps_per_bar=steps_per_bar),
    )
    chord_by_bar = {int(c["bar"]): c for c in voiced_chords}

    raw_notes = copy.deepcopy(song_doc.get("notes") or [])
    arrangement_mode = str(song_doc.get("arrangement_mode", "loop"))
    has_sections = bool(song_doc.get("sections")) and arrangement_mode == "song"

    if has_sections:
        if steps_per_bar != 16:
            raise ValueError("Use song cards for this musical cycle; legacy arranger requires 4/4.")
        choked_notes, compiled_sections, total_bars = expand_sections_for_compiler(
            song_doc,
            raw_notes,
            core_steps=core_bars * steps_per_bar,
            hocket_choke=hocket_choke_enabled,
            pre_drop_silence=pre_drop_silence_enabled,
        )
    else:
        total_bars = core_bars
        total_steps_loop = total_bars * steps_per_bar
        choked_notes = (
            apply_monophonic_hocket_choke(raw_notes, total_steps=total_steps_loop)
            if hocket_choke_enabled
            else copy.deepcopy(raw_notes)
        )
        compiled_sections = [
            {
                "id": "sec_loop",
                "index": 0,
                "name": "4-Bar Core Loop",
                "type": "drop",
                "bars": total_bars,
                "start_bar": 0,
                "end_bar": total_bars,
                "start_step": 0,
                "end_step": total_steps_loop,
                "energy": 1.0,
                "active_roles": ["drums", "harmony", "bass", "hocket", "lead"],
                "transition": "none",
                "active_note_count": len(choked_notes),
                "why_label": "Core 4-bar full-energy loop stack.",
            }
        ]

    total_steps = total_bars * steps_per_bar

    gravity_by_bar: dict[int, dict[int, dict[str, Any]]] = {}
    gravity_by_step: list[dict[int, dict[str, Any]]] = []
    for step in range(total_steps):
        bar_idx = (step // steps_per_bar) % max(1, len(voiced_chords))
        if bar_idx not in gravity_by_bar:
            chord = chord_by_bar.get(bar_idx, voiced_chords[bar_idx % len(voiced_chords)])
            gravity_by_bar[bar_idx] = classify_step_gravity(root_pc, scale_type, chord)
        gravity_by_step.append(gravity_by_bar[bar_idx])

    compiled_events: list[dict[str, Any]] = []
    kick_steps: list[int] = []
    snare_steps: list[int] = []
    prev_lead_freq_hz: float | None = None
    sound_seed = song_doc.get("sound_seed")
    under_cfg = song_doc.get("underneath") or {}
    harmony_style = str(song_doc.get("harmony_style") or under_cfg.get("harmony_style") or "hold")
    stereo_jux = bool(song_doc.get("stereo_jux") or harmony_style == "wide_echo")

    for note in sorted(choked_notes, key=lambda n: (int(n.get("step", 0)), n.get("role", ""))):
        step = int(note.get("step", 0))
        if step < 0 or step >= total_steps:
            continue
        bar_idx = (step // steps_per_bar) % max(1, len(voiced_chords))
        chord = chord_by_bar.get(bar_idx, voiced_chords[bar_idx % len(voiced_chords)])
        resolved = resolve_note_pitch(note, root_pc, scale_type, chord, gravity_by_step[step])
        performed = _performed_values(resolved)
        if performed.get("velocity") == 0:
            continue

        if performed:
            humanized_vel = performed["velocity"]
        elif humanize_enabled:
            base_vel = float(resolved.get("velocity", 0.85))
            metric_weight = METRIC_ACCENT_WEIGHTS[step % steps_per_bar]
            humanized_vel = round(max(0.18, min(1.0, base_vel * metric_weight)), 4)
        else:
            humanized_vel = 0.80
        resolved["velocity"] = performed.get("velocity", humanized_vel)

        swing_delay_sec = ((swing - 0.50) * 2.0 * step_sec * 0.5) if (step % 2 == 1) else 0.0
        start_sec = round(step * step_sec + swing_delay_sec, 6)
        dur_steps = performed["duration_steps"] if performed else max(1, int(resolved.get("duration_steps", 1)))
        dur_sec = round(max(0.035, dur_steps * step_sec - (swing_delay_sec if (step % 2 == 1) else 0.0)), 6)
        if "offset_steps" in performed:
            start_sec = round((step + performed["offset_steps"]) * step_sec, 6)
        if "duration_steps" in performed:
            dur_sec = round(performed["duration_steps"] * step_sec, 6)

        resolved["start_sec"] = start_sec
        resolved["duration_sec"] = dur_sec
        resolved["bar"] = step // steps_per_bar

        if sound_seed and not (performed and resolved.get("sound_seed")) and resolved.get("role") in ("lead", "harmony"):
            resolved["sound_seed"] = copy.deepcopy(sound_seed)

        if resolved.get("role") == "lead":
            cur_freq = float((resolved.get("concrete") or {}).get("freq_hz") or 261.63)
            if prev_lead_freq_hz is not None:
                resolved["prev_freq_hz"] = round(prev_lead_freq_hz, 4)
            prev_lead_freq_hz = cur_freq
            if stereo_jux:
                resolved["pan"] = -0.35

        if resolved.get("role") == "drums":
            resolved["drum_kit"] = (note["drum_kit"] if performed and note.get("drum_kit") in ("soft", "punchy", "tiny")
                                     else str(song_doc.get("drum_kit") or "punchy"))
            patch = resolved.get("patch_id") or resolved.get("drum_lane")
            if patch == "kick":
                kick_steps.append(step)
            elif patch in ("snare", "clap"):
                snare_steps.append(step)

        compiled_events.append(resolved)

        # #9 Strudel Stereo `jux` Twin: panned shadow twin in the right channel
        if stereo_jux and resolved.get("role") == "lead":
            jux_step = step + 2 if (step % steps_per_bar) + 2 < steps_per_bar else step
            jux_midi = min(84, int((resolved.get("concrete") or {}).get("midi_pitch", 60)) + 12)
            jux_freq = round(midi_to_freq(jux_midi), 4)
            jux_ev = {
                "id": f"auto-jux-{resolved.get('id', step)}",
                "step": jux_step,
                "bar": jux_step // steps_per_bar,
                "duration_steps": max(1, min(2, dur_steps)),
                "start_sec": round(jux_step * step_sec, 6),
                "duration_sec": round(max(0.05, min(2, dur_steps) * step_sec * 0.85), 6),
                "velocity": round(float(resolved["velocity"]) * 0.42, 4),
                "role": "harmony",
                "patch_id": str(resolved.get("patch_id", "pluck_lead")),
                "pitch_lock_mode": "concrete",
                "provenance": "scaffold_generated",
                "pan": 0.65,
                "concrete": {
                    "midi_pitch": jux_midi,
                    "freq_hz": jux_freq,
                    "note_name": NOTE_NAMES[jux_midi % 12],
                    "micro_offset_ms": 0.0,
                },
            }
            if sound_seed:
                jux_ev["sound_seed"] = copy.deepcopy(sound_seed)
            compiled_events.append(jux_ev)

    # Auto-generate harmony supersaw chord events if harmony lane is active and not explicitly overridden
    if song_doc.get("auto_harmony_stabs", True):
        has_explicit_harmony = any(
            e.get("role") == "harmony" and not str(e.get("id", "")).startswith("auto-jux-")
            for e in compiled_events
        )
        if not has_explicit_harmony:
            arp_pattern = (0, 1, 2, 1, 0, 2, 1, 2)
            for sec in compiled_sections:
                if "harmony" not in (sec.get("active_roles") or ["harmony"]):
                    continue
                sec_energy = float(sec.get("energy", 1.0))
                vel_scale = 0.40 + 0.60 * sec_energy
                if harmony_style == "ripple":
                    sub_steps: tuple[int, ...] = (0, 2, 4, 6, 8, 10, 12, 14)
                elif sec_energy <= 0.35:
                    sub_steps = (0,)
                elif sec_energy <= 0.65:
                    sub_steps = (0, 6)
                else:
                    sub_steps = (0, 3, 6, 12)

                silence_cutoff = (
                    sec["end_step"] - 4
                    if (sec.get("transition") == "pre_drop_silence" and pre_drop_silence_enabled)
                    else sec["end_step"] + 99
                )

                for global_bar in range(int(sec["start_bar"]), int(sec["end_bar"])):
                    vc = chord_by_bar.get(
                        global_bar % len(voiced_chords),
                        voiced_chords[global_bar % len(voiced_chords)],
                    )
                    bar_step = global_bar * steps_per_bar
                    for idx_sub, sub_step in enumerate(sub_steps):
                        if sub_step >= steps_per_bar:
                            continue
                        s = bar_step + sub_step
                        if s >= total_steps or s >= silence_cutoff:
                            continue
                        w = METRIC_ACCENT_WEIGHTS[s % steps_per_bar] if humanize_enabled else 1.0
                        stab_vel = round(min(1.0, 0.78 * vel_scale * w), 4) if humanize_enabled else 0.80
                        v_midis = vc["voiced_midi"]
                        v_freqs = vc["voiced_freqs"]
                        v_names = vc["voiced_names"]
                        if harmony_style == "ripple" and v_midis:
                            pick = arp_pattern[idx_sub % len(arp_pattern)] % len(v_midis)
                            ev_midis = [v_midis[pick]]
                            ev_freqs = [v_freqs[pick]]
                            c_midi, c_freq, c_name = v_midis[pick], v_freqs[pick], v_names[pick]
                        else:
                            ev_midis = v_midis
                            ev_freqs = v_freqs
                            c_midi, c_freq, c_name = v_midis[0], v_freqs[0], v_names[0]
                        stab_ev: dict[str, Any] = {
                            "id": f"auto-stab-{s}",
                            "step": s,
                            "bar": global_bar,
                            "section_id": sec["id"],
                            "duration_steps": 2,
                            "start_sec": round(s * step_sec, 6),
                            "duration_sec": round(2 * step_sec * 0.85, 6),
                            "velocity": stab_vel,
                            "role": "harmony",
                            "patch_id": str(song_doc.get("harmony_patch_id", "supersaw_stab")),
                            "pitch_lock_mode": "relational",
                            "provenance": "scaffold_generated",
                            "post_placement_mark": "●",
                            "post_placement_shape_kind": "filled_circle",
                            "voiced_midi": ev_midis,
                            "voiced_freqs": ev_freqs,
                            "concrete": {
                                "midi_pitch": c_midi,
                                "freq_hz": c_freq,
                                "note_name": c_name,
                                "micro_offset_ms": 0.0,
                            },
                            "gesture": {
                                "preset_id": "pluck_stab",
                                "shape": "pluck_stab",
                                "vowel_start": "A",
                                "vowel_end": "E",
                                "lfo_rate": "off",
                                "grit": round(0.45 * vel_scale, 3),
                                "pitch_bend_st": 0,
                                "stutter_div": "off",
                                "ott_punch": round(0.75 * vel_scale, 3),
                                "xy_pad": {"x": 0.55, "y": round(0.45 * vel_scale, 2)},
                            },
                            "why_label": vc["why_label"],
                        }
                        if sound_seed:
                            stab_ev["sound_seed"] = copy.deepcopy(sound_seed)
                        compiled_events.append(stab_ev)

    compiled_events.sort(key=lambda e: (e["start_sec"], e["step"], e["role"]))

    for sec in compiled_sections:
        s_start = int(sec["start_step"])
        s_end = int(sec["end_step"])
        sec["start_sec"] = round(s_start * step_sec, 6)
        sec["end_sec"] = round(s_end * step_sec, 6)
        sec_evs = [e for e in compiled_events if s_start <= int(e["step"]) < s_end]
        sec["active_event_count"] = len(sec_evs)

    return {
        "schema_version": 1,
        "song_id": song_doc.get("id", "song"),
        "title": song_doc.get("title", "My loop"),
        "arrangement_mode": "song" if has_sections else "loop",
        "bpm": bpm,
        "swing": swing,
        "root_pc": root_pc,
        "root_name": NOTE_NAMES[root_pc],
        "scale_type": scale_type,
        "bars": total_bars,
        "core_bars": core_bars,
        "steps_per_bar": steps_per_bar,
        "total_steps": total_steps,
        "step_sec": round(step_sec, 6),
        "total_duration_sec": round(total_steps * step_sec, 6),
        "voiced_chords": voiced_chords,
        "sections": compiled_sections,
        "gravity_by_step": gravity_by_step,
        "sidechain_duck_steps": sorted(set(kick_steps + snare_steps)),
        "scaffold_options": {
            "voice_leading": voice_leading_mode,
            "hocket_choke": hocket_choke_enabled,
            "humanize": humanize_enabled,
            "pre_drop_silence": pre_drop_silence_enabled,
            "harmony_display_mode": harmony_display_mode,
        },
        "events": compiled_events,
    }
