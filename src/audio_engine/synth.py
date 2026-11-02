"""Deterministic Python stdlib PCM & WAV synthesizer implementing the 7 Heavy Bass voices + 3-Band OTT."""
from __future__ import annotations

import math
from pathlib import Path
import struct
from typing import Any
import wave

from src.audio_engine.dsp import (
    CytomicSVF,
    LFO_DIVISIONS,
    compute_wav_metrics,
    gesture_curve_at,
    interpolate_formants,
    karplus_strong_pluck,
    ott_transfer,
    wavefolder,
)

TARGET_PEAK = 0.708  # -3 dBFS export ceiling (Phase 8.0), same as master_bus.js SAFETY_CEILING


def _apply_event_pan(left: list[float], right: list[float], pan: float | None) -> tuple[list[float], list[float]]:
    if pan is None:
        return left, right
    p = max(-1.0, min(1.0, float(pan)))
    if abs(p) < 1e-4:
        return left, right
    gl = math.sqrt(0.5 * (1.0 - p)) * 1.4142
    gr = math.sqrt(0.5 * (1.0 + p)) * 1.4142
    return [x * gl for x in left], [x * gr for x in right]


def _sidechain_events(compiled_song: dict[str, Any], step_sec: float) -> list[tuple[float, float]]:
    events = compiled_song.get("events") or []
    if not any("style_weight" in event for event in events):
        return [(step * step_sec, 1.0) for step in compiled_song.get("sidechain_duck_steps", [])]
    weights: dict[float, float] = {}
    for event in events:
        if event.get("patch_id") not in ("kick", "snare", "clap") or float(event.get("velocity", .85)) <= 0:
            continue
        at = float(event.get("start_sec", float(event.get("step", 0)) * step_sec))
        raw = float(event.get("style_weight", 1))
        weight = max(0.0, min(1.0, raw)) if math.isfinite(raw) else 1.0
        weights[at] = min(1.0, weights.get(at, 0.0) + weight)
    return sorted((at, weight) for at, weight in weights.items() if weight > 0)


def synthesize_event(
    event: dict[str, Any],
    bpm: float = 110.0,
    sample_rate: int = 22050,
) -> tuple[list[float], list[float]]:
    """Synthesize a single compiled NoteEvent into stereo (left, right) float buffers."""
    dur_sec = max(0.04, float(event.get("duration_sec", 0.25)))
    role = event.get("role", "hocket")
    patch_id = event.get("patch_id", "monster_growl")
    if str(patch_id).startswith("sampled_"):
        raise ValueError("Sampled instruments require the browser WAV download. Python export cannot reproduce this instrument.")
    raw_velocity = float(event.get("velocity", 0.85))
    vel = max(0.0, min(1.0, raw_velocity)) if math.isfinite(raw_velocity) else 0.85
    if vel == 0:
        silence = [0.0] * max(1, math.ceil(dur_sec * sample_rate))
        return silence, silence.copy()
    freq_hz = float(event.get("concrete", {}).get("freq_hz", 55.0))
    gesture = event.get("gesture") or {}
    pan = event.get("pan")

    if role == "drums" or patch_id in ("kick", "snare", "clap", "hat_closed", "hat_open", "perc"):
        return _synth_drum(patch_id, dur_sec, vel, sample_rate, kit=str(event.get("drum_kit") or "punchy"))
    if patch_id == "reverse_swell":
        l_buf, r_buf = _synth_reverse_swell(freq_hz, dur_sec, vel, sample_rate)
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id in ("monster_growl", "talking_yoi"):
        l_buf, r_buf = _synth_growl(freq_hz, dur_sec, vel, gesture, bpm, sample_rate, is_yoi=(patch_id == "talking_yoi"))
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id == "clean_bass":
        l_buf, r_buf = _synth_clean_bass(freq_hz, dur_sec, vel, sample_rate)
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id in ("wobble_bass", "sub_drop_808"):
        l_buf, r_buf = _synth_wobble(freq_hz, dur_sec, vel, gesture, bpm, sample_rate, is_sub_drop=(patch_id == "sub_drop_808"))
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id == "laser_screech":
        l_buf, r_buf = _synth_laser(freq_hz, dur_sec, vel, gesture, sample_rate)
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id == "vocal_chop":
        l_buf, r_buf = _synth_vocal_chop(freq_hz, dur_sec, vel, gesture, bpm, sample_rate)
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id == "warm_keys":
        voiced_freqs = event.get("voiced_freqs") or [freq_hz]
        l_buf, r_buf = _synth_warm_keys(voiced_freqs, dur_sec, vel, sample_rate, event=event)
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id == "pluck_lead":
        l_buf, r_buf = _synth_pluck_lead(freq_hz, dur_sec, vel, sample_rate, event=event)
        return _apply_event_pan(l_buf, r_buf, pan)
    if patch_id == "supersaw_stab" or role in ("harmony", "lead"):
        voiced_freqs = event.get("voiced_freqs") or ([freq_hz] if role == "lead" else [freq_hz, freq_hz * 1.2, freq_hz * 1.5])
        l_buf, r_buf = _synth_supersaw_stab(voiced_freqs, dur_sec, vel, gesture, sample_rate, event=event)
        return _apply_event_pan(l_buf, r_buf, pan)

    l_buf, r_buf = _synth_growl(freq_hz, dur_sec, vel, gesture, bpm, sample_rate, is_yoi=False)
    return _apply_event_pan(l_buf, r_buf, pan)


def _amp_envelope(i: int, n: int, sample_rate: int, attack_s: float = 0.005, release_s: float = 0.025) -> float:
    atk_samples = max(1, int(attack_s * sample_rate))
    rel_samples = max(1, int(release_s * sample_rate))
    if i < atk_samples:
        return i / float(atk_samples)
    if i > n - rel_samples:
        return max(0.0, (n - i) / float(rel_samples))
    return 1.0


def _synth_growl(
    freq_hz: float,
    dur_sec: float,
    vel: float,
    gesture: dict[str, Any],
    bpm: float,
    sample_rate: int,
    is_yoi: bool = False,
) -> tuple[list[float], list[float]]:
    """3-Op FM + Asymmetric Wavefolder + Coupled Dual-Bandpass/Notch Formant Filter + Clean Sub (<110Hz)."""
    n = max(64, int(dur_sec * sample_rate))
    v_start = str(gesture.get("vowel_start", "I" if is_yoi else "O"))
    v_end = str(gesture.get("vowel_end", "O" if is_yoi else "I"))
    grit = float(gesture.get("grit", 0.82))
    shape = str(gesture.get("shape", "ramp_up_down"))
    lfo_rate = str(gesture.get("lfo_rate", "1/8"))
    ott_amt = float(gesture.get("ott_punch", 0.85))

    svf_notch = CytomicSVF(800.0, 5.5, sample_rate)
    svf_f1 = CytomicSVF(550.0, 7.5, sample_rate)
    svf_f2 = CytomicSVF(1200.0, 8.5, sample_rate)
    svf_f3 = CytomicSVF(2500.0, 4.5, sample_rate)

    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n
    phase_c = 0.0
    phase_m1 = 0.0
    phase_m2 = 0.0
    prev_m2 = 0.0
    r1 = 2.0
    r2 = 3.0 if is_yoi else 4.0

    # Ensure sub frequency is in 40..95 Hz
    sub_hz = freq_hz
    while sub_hz > 95.0:
        sub_hz *= 0.5
    while sub_hz < 38.0:
        sub_hz *= 2.0
    phase_sub = 0.0

    for i in range(n):
        nt = i / float(n)
        g = gesture_curve_at(shape, nt, lfo_rate, bpm, dur_sec)
        if i % 16 == 0:
            f1, f2, f3, fn = interpolate_formants(v_start, v_end, g, vocal_shift=1.0)
            svf_notch.update_coeffs(fn, 5.0, sample_rate)
            svf_f1.update_coeffs(f1, 7.0, sample_rate)
            svf_f2.update_coeffs(f2, 8.5, sample_rate)
            svf_f3.update_coeffs(f3, 4.0, sample_rate)

        dt = 1.0 / float(sample_rate)
        phase_c += 2.0 * math.pi * freq_hz * dt
        phase_m1 += 2.0 * math.pi * (freq_hz * r1) * dt
        phase_m2 += 2.0 * math.pi * (freq_hz * r2) * dt
        phase_sub += 2.0 * math.pi * sub_hz * dt

        idx1 = (0.6 + 2.6 * grit) * (0.25 + 0.75 * g)
        idx2 = (0.2 + 2.0 * grit) * (0.10 + 0.90 * (g * g))

        m2_sig = math.sin(phase_m2 + 0.22 * prev_m2)
        prev_m2 = m2_sig
        fm_raw = math.sin(phase_c + idx1 * math.sin(phase_m1) + idx2 * m2_sig)
        folded = wavefolder(fm_raw, grit)

        _, _, _, notched = svf_notch.step(folded)
        _, bp1, _, _ = svf_f1.step(notched)
        _, bp2, _, _ = svf_f2.step(notched)
        _, bp3, _, _ = svf_f3.step(notched)

        mid_char = 0.95 * bp1 + 0.90 * bp2 + (0.45 + 0.55 * grit) * bp3
        mid_ott = ott_transfer(mid_char, ott_amt)
        clean_sub = 0.52 * math.tanh(1.35 * math.sin(phase_sub))

        env = _amp_envelope(i, n, sample_rate, 0.004, 0.022) * vel
        # Subtle stereo widening on mid character
        side = 0.14 * math.sin(phase_m1 * 0.5) * mid_ott
        left[i] = env * (clean_sub + mid_ott + side)
        right[i] = env * (clean_sub + mid_ott - side)

    return left, right


def _synth_wobble(
    freq_hz: float,
    dur_sec: float,
    vel: float,
    gesture: dict[str, Any],
    bpm: float,
    sample_rate: int,
    is_sub_drop: bool = False,
) -> tuple[list[float], list[float]]:
    """Phase-locked clean sub + tempo-synced resonant 24dB/oct LFO mid-wobble (or 808 sub-drop)."""
    n = max(64, int(dur_sec * sample_rate))
    lfo_rate = str(gesture.get("lfo_rate", "1/16"))
    grit = float(gesture.get("grit", 0.72))
    ott_amt = float(gesture.get("ott_punch", 0.80))

    svf1 = CytomicSVF(400.0, 1.2, sample_rate)
    svf2 = CytomicSVF(400.0, 2.8, sample_rate)
    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n

    phase1 = 0.0
    phase2 = 0.0
    phase_sub = 0.0
    dt = 1.0 / float(sample_rate)

    for i in range(n):
        nt = i / float(n)
        if is_sub_drop:
            cur_f = 135.0 * math.pow(38.0 / 135.0, math.pow(nt, 0.65))
            phase_sub += 2.0 * math.pi * cur_f * dt
            env = _amp_envelope(i, n, sample_rate, 0.003, 0.04) * vel
            val = env * 0.82 * math.tanh(1.5 * math.sin(phase_sub))
            left[i] = val
            right[i] = val
            continue

        w = gesture_curve_at("lfo_sync", nt, lfo_rate, bpm, dur_sec)
        if i % 16 == 0:
            cutoff = 130.0 * math.pow(4400.0 / 130.0, w)
            svf1.update_coeffs(cutoff, 0.9, sample_rate)
            svf2.update_coeffs(cutoff, 2.8, sample_rate)

        phase1 += 2.0 * math.pi * freq_hz * dt
        phase2 += 2.0 * math.pi * (freq_hz * 1.004) * dt
        phase_sub += 2.0 * math.pi * freq_hz * dt

        saw1 = 2.0 * ((phase1 / (2.0 * math.pi)) % 1.0) - 1.0
        saw2 = 2.0 * ((phase2 / (2.0 * math.pi)) % 1.0) - 1.0
        raw_mid = math.tanh((1.5 + 2.5 * grit) * 0.5 * (saw1 + saw2))
        lp1, _, _, _ = svf1.step(raw_mid)
        lp2, bp2, _, _ = svf2.step(lp1)

        mid_sig = ott_transfer(lp2 + 0.4 * bp2, ott_amt)
        sub_sig = 0.55 * math.sin(phase_sub) * (0.45 + 0.55 * w)
        env = _amp_envelope(i, n, sample_rate, 0.004, 0.020) * vel
        pan_w = 0.12 * (saw1 - saw2)
        left[i] = env * (sub_sig + mid_sig + pan_w)
        right[i] = env * (sub_sig + mid_sig - pan_w)

    return left, right


def _synth_laser(
    freq_hz: float,
    dur_sec: float,
    vel: float,
    gesture: dict[str, Any],
    sample_rate: int,
) -> tuple[list[float], list[float]]:
    """Heavy Bass Laser / Screech Pitch-Dive Lead with fast exponential pitch whip and Haas stereo width."""
    n = max(64, int(dur_sec * sample_rate))
    bend_st = float(gesture.get("pitch_bend_st", 12))
    grit = float(gesture.get("grit", 0.85))
    shape = str(gesture.get("shape", "laser_attack"))

    svf_hp = CytomicSVF(550.0, 2.2, sample_rate)
    svf_bite = CytomicSVF(2300.0, 3.0, sample_rate)
    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n

    p1 = 0.0
    p2 = 0.0
    p3 = 0.0
    dt = 1.0 / float(sample_rate)
    haas_delay = max(1, int(0.0065 * sample_rate))

    mono_buf: list[float] = [0.0] * n
    for i in range(n):
        t = i * dt
        nt = i / float(n)
        if shape == "laser_dive" or bend_st < 0:
            cur_st = abs(bend_st) * (0.5 - 1.5 * nt)
        else:
            whip_tau = 0.038
            if t < whip_tau:
                rem = 1.0 - (t / whip_tau)
                cur_st = bend_st * (rem * rem)
            else:
                cur_st = 0.14 * math.sin(2.0 * math.pi * 6.5 * t)

        cur_f = freq_hz * math.pow(2.0, cur_st / 12.0)
        p1 += 2.0 * math.pi * (cur_f * 0.992) * dt
        p2 += 2.0 * math.pi * (cur_f * 1.008) * dt
        p3 += 2.0 * math.pi * (cur_f * 2.0) * dt

        saw1 = 2.0 * ((p1 / (2.0 * math.pi)) % 1.0) - 1.0
        saw2 = 2.0 * ((p2 / (2.0 * math.pi)) % 1.0) - 1.0
        sq3 = 1.0 if math.sin(p3) >= 0.0 else -1.0
        folded = wavefolder(0.42 * (saw1 + saw2) + 0.25 * sq3, grit)
        _, _, hp, _ = svf_hp.step(folded)
        _, bp, _, _ = svf_bite.step(hp)
        env = _amp_envelope(i, n, sample_rate, 0.002, 0.018) * vel
        mono_buf[i] = env * ott_transfer(0.65 * hp + 0.85 * bp, 0.85)

    for i in range(n):
        delayed = mono_buf[i - haas_delay] if i >= haas_delay else 0.0
        left[i] = mono_buf[i]
        right[i] = 0.72 * mono_buf[i] + 0.45 * delayed

    return left, right


def _synth_vocal_chop(
    freq_hz: float,
    dur_sec: float,
    vel: float,
    gesture: dict[str, Any],
    bpm: float,
    sample_rate: int,
) -> tuple[list[float], list[float]]:
    """Glottal pulse/saw + consonant burst through 1.22x vocal formants + 1/16 or 1/32 stutter gate."""
    n = max(64, int(dur_sec * sample_rate))
    v_start = str(gesture.get("vowel_start", "A"))
    v_end = str(gesture.get("vowel_end", "I"))
    stutter_div = str(gesture.get("stutter_div", "1/32"))
    div_mult = LFO_DIVISIONS.get(stutter_div, 4.0) or 4.0
    gate_hz = (bpm / 60.0) * div_mult

    svf_f1 = CytomicSVF(700.0, 9.0, sample_rate)
    svf_f2 = CytomicSVF(1800.0, 10.0, sample_rate)
    svf_f3 = CytomicSVF(3100.0, 5.0, sample_rate)

    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n
    phase = 0.0
    dt = 1.0 / float(sample_rate)

    for i in range(n):
        t = i * dt
        nt = i / float(n)
        if i % 16 == 0:
            f1, f2, f3, _ = interpolate_formants(v_start, v_end, nt, vocal_shift=1.22)
            svf_f1.update_coeffs(f1, 8.5, sample_rate)
            svf_f2.update_coeffs(f2, 9.5, sample_rate)
            svf_f3.update_coeffs(f3, 5.0, sample_rate)

        slice_idx = int(t * gate_hz)
        cur_f = freq_hz * math.pow(2.0, min(4, slice_idx) * 0.0 / 12.0)
        phase += 2.0 * math.pi * cur_f * dt
        norm_p = (phase / (2.0 * math.pi)) % 1.0
        glottal = (1.0 if norm_p < 0.22 else -0.28) + 0.5 * (2.0 * norm_p - 1.0)
        if t < 0.012:
            # Plosive consonant click at start
            glottal += 0.35 * math.sin(i * 1.73)

        _, bp1, _, _ = svf_f1.step(glottal)
        _, bp2, _, _ = svf_f2.step(glottal)
        _, bp3, _, _ = svf_f3.step(glottal)

        gate_phase = (t * gate_hz) % 1.0
        stutter_env = 1.0 if gate_phase < 0.62 else 0.08
        env = _amp_envelope(i, n, sample_rate, 0.003, 0.015) * vel * stutter_env
        sig = env * ott_transfer(bp1 + 0.95 * bp2 + 0.65 * bp3, 0.82)
        left[i] = sig * 0.95
        right[i] = sig * 1.05

    return left, right


def _extract_sound_seed(event: dict[str, Any] | None) -> tuple[float, float, float]:
    ev = event or {}
    seed = ev.get("sound_seed") or {}
    gesture = ev.get("gesture") or {}
    xy = gesture.get("xy_pad") or {}
    bright = float(seed.get("brightness", 0.5))
    if "y" in xy:
        bright = max(0.15, min(0.95, 0.5 * bright + 0.5 * float(xy.get("y", 0.5))))
    warmth = max(0.15, min(0.95, float(seed.get("warmth", 0.5))))
    width = max(0.15, min(0.95, float(seed.get("width", 0.5))))
    return bright, warmth, width


def _synth_supersaw_stab(
    voiced_freqs: list[float],
    dur_sec: float,
    vel: float,
    gesture: dict[str, Any],
    sample_rate: int,
    event: dict[str, Any] | None = None,
) -> tuple[list[float], list[float]]:
    """5-voice detuned Supersaw Chord Stab high-passed at 180Hz with punchy pluck filter."""
    n = max(64, int(dur_sec * sample_rate))
    bright, warmth, width = _extract_sound_seed(event)
    spread = 0.65 + 0.70 * width
    detunes = [-0.011 * spread, -0.0045 * spread, 0.0, 0.005 * spread, 0.012 * spread]
    pans = [-0.65 * spread, -0.30 * spread, 0.0, 0.30 * spread, 0.65 * spread]
    phases = [[0.0 for _ in detunes] for _ in voiced_freqs]

    svf_lp_l = CytomicSVF(3200.0, 1.1, sample_rate)
    svf_lp_r = CytomicSVF(3200.0, 1.1, sample_rate)
    svf_hp_l = CytomicSVF(180.0, 0.707, sample_rate)
    svf_hp_r = CytomicSVF(180.0, 0.707, sample_rate)

    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n
    dt = 1.0 / float(sample_rate)
    norm_scale = 0.22 / max(1.0, math.sqrt(len(voiced_freqs)))
    base_cut = 900.0 + 900.0 * bright
    env_cut = 2200.0 + 2400.0 * bright

    for i in range(n):
        nt = i / float(n)
        if i % 16 == 0:
            cutoff = base_cut + env_cut * math.exp(-nt * (4.8 - 1.2 * warmth))
            svf_lp_l.update_coeffs(cutoff, 1.15, sample_rate)
            svf_lp_r.update_coeffs(cutoff, 1.15, sample_rate)

        sum_l = 0.0
        sum_r = 0.0
        for f_idx, base_f in enumerate(voiced_freqs):
            for d_idx, det in enumerate(detunes):
                phases[f_idx][d_idx] += 2.0 * math.pi * (base_f * (1.0 + det)) * dt
                saw = 2.0 * ((phases[f_idx][d_idx] / (2.0 * math.pi)) % 1.0) - 1.0
                pan = max(-0.95, min(0.95, pans[d_idx]))
                sum_l += saw * (0.5 * (1.0 - pan))
                sum_r += saw * (0.5 * (1.0 + pan))

        lp_l, _, _, _ = svf_lp_l.step(sum_l * norm_scale)
        lp_r, _, _, _ = svf_lp_r.step(sum_r * norm_scale)
        _, _, hp_l, _ = svf_hp_l.step(lp_l)
        _, _, hp_r, _ = svf_hp_r.step(lp_r)

        env = _amp_envelope(i, n, sample_rate, 0.003, 0.025) * vel * math.exp(-nt * 1.4)
        left[i] = env * hp_l
        right[i] = env * hp_r

    return left, right


def _synth_clean_bass(
    freq_hz: float,
    dur_sec: float,
    vel: float,
    sample_rate: int,
) -> tuple[list[float], list[float]]:
    """Warm studio electric/synth bass: pure fundamental sine + soft 2nd-harmonic saturation + 480Hz lowpass (zero LFO wobble)."""
    n = max(64, int(dur_sec * sample_rate))
    svf_lp = CytomicSVF(480.0, 0.85, sample_rate)
    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n
    phase = 0.0
    dt = 1.0 / float(sample_rate)

    for i in range(n):
        nt = i / float(n)
        if i % 16 == 0:
            cutoff = 240.0 + 380.0 * math.exp(-nt * 3.8)
            svf_lp.update_coeffs(cutoff, 0.85, sample_rate)

        phase += 2.0 * math.pi * freq_hz * dt
        fund = math.sin(phase)
        harm2 = 0.28 * math.sin(2.0 * phase)
        tri = (2.0 / math.pi) * math.asin(fund)
        raw = 0.68 * fund + 0.22 * tri + harm2
        lp, _, _, _ = svf_lp.step(raw)
        env = _amp_envelope(i, n, sample_rate, 0.004, 0.028) * vel * math.exp(-nt * 1.1)
        sig = 0.82 * env * math.tanh(lp * 1.25)
        left[i] = sig * 0.98
        right[i] = sig * 1.02

    return left, right


def _synth_warm_keys(
    voiced_freqs: list[float],
    dur_sec: float,
    vel: float,
    sample_rate: int,
    event: dict[str, Any] | None = None,
) -> tuple[list[float], list[float]]:
    """Warm electric piano (Rhodes-style tine + fundamental) with gentle stereo chorus/tremolo."""
    n = max(64, int(dur_sec * sample_rate))
    bright, warmth, width = _extract_sound_seed(event)
    phases = [0.0 for _ in voiced_freqs]
    lp_cut = 1400.0 + 1800.0 * bright
    svf_lp_l = CytomicSVF(lp_cut, 0.8, sample_rate)
    svf_lp_r = CytomicSVF(lp_cut, 0.8, sample_rate)
    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n
    dt = 1.0 / float(sample_rate)
    norm_scale = 0.34 / max(1.0, math.sqrt(len(voiced_freqs)))
    pan_amt = 0.15 + 0.30 * width

    for i in range(n):
        t = i * dt
        nt = i / float(n)
        tine_env = math.exp(-nt * 6.5)
        body_env = math.exp(-nt * (1.55 - 0.45 * warmth))
        sum_l = 0.0
        sum_r = 0.0
        for idx, f in enumerate(voiced_freqs):
            phases[idx] += 2.0 * math.pi * f * dt
            p = phases[idx]
            # Rhodes FM tine (ratio 7:1 gentle bell attack) + warm fundamental + 2nd harmonic
            tine = (0.08 + 0.14 * bright) * tine_env * math.sin(7.0 * p)
            voice = math.sin(p + (0.25 + 0.25 * warmth) * body_env * math.sin(2.0 * p) + tine)
            pan = -pan_amt if (idx % 2 == 0) else pan_amt
            sum_l += voice * (0.5 * (1.0 - pan))
            sum_r += voice * (0.5 * (1.0 + pan))

        # Gentle 4.2 Hz stereo tremolo pan
        trem = (0.04 + 0.08 * width) * math.sin(2.0 * math.pi * 4.2 * t)
        lp_l, _, _, _ = svf_lp_l.step(sum_l * norm_scale * (1.0 + trem))
        lp_r, _, _, _ = svf_lp_r.step(sum_r * norm_scale * (1.0 - trem))
        env = _amp_envelope(i, n, sample_rate, 0.006, 0.035) * vel * body_env
        left[i] = env * lp_l
        right[i] = env * lp_r

    return left, right


def _synth_pluck_lead(
    freq_hz: float,
    dur_sec: float,
    vel: float,
    sample_rate: int,
    event: dict[str, Any] | None = None,
) -> tuple[list[float], list[float]]:
    """Physical-modeled plucked string + Rings wooden marimba bar modes (1 : 3.98 : 9.2) + note transitions (#14, #18)."""
    n = max(64, int(dur_sec * sample_rate))
    ev = event or {}
    transition = ev.get("transition")
    prev_freq = float(ev.get("prev_freq_hz") or freq_hz)
    bright, warmth, width = _extract_sound_seed(ev)

    ks_buf = karplus_strong_pluck(
        freq_hz,
        n,
        sample_rate=sample_rate,
        damping=0.989 + 0.007 * warmth,
        brightness=0.48 + 0.36 * bright,
    )
    svf_lp = CytomicSVF(3400.0, 1.2, sample_rate)
    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n
    phase1 = 0.0
    phase_m2 = 0.0
    phase_m3 = 0.0
    phase_spark = 0.0
    dt = 1.0 / float(sample_rate)
    haas_samples = max(1, int((0.004 + 0.005 * width) * sample_rate))
    mono_buf: list[float] = [0.0] * n
    nyquist_limit = sample_rate * 0.44

    for i in range(n):
        t = i * dt
        nt = i / float(n)
        cur_f = freq_hz
        if transition == "slide" and abs(prev_freq - freq_hz) > 1.0:
            glide_tau = min(0.065, dur_sec * 0.35)
            if t < glide_tau:
                alpha = t / max(1e-4, glide_tau)
                cur_f = prev_freq * math.pow(freq_hz / max(20.0, prev_freq), alpha)
        elif transition == "bounce":
            if t < 0.035:
                cur_f = freq_hz * math.pow(2.0, 2.0 / 12.0)

        if i % 16 == 0:
            cutoff = (520.0 + 380.0 * bright) + (2800.0 + 1800.0 * bright) * math.exp(-nt * 5.6)
            svf_lp.update_coeffs(cutoff, 1.15, sample_rate)

        phase1 += 2.0 * math.pi * cur_f * dt
        f_mode2 = min(nyquist_limit, cur_f * 3.98)
        f_mode3 = min(nyquist_limit, cur_f * 9.20)
        phase_m2 += 2.0 * math.pi * f_mode2 * dt
        phase_m3 += 2.0 * math.pi * f_mode3 * dt

        fund = math.sin(phase1)
        # Rings wooden marimba bar modes (1 : 3.98 : 9.2) + mallet strike transient
        mode2 = 0.24 * math.exp(-nt * 7.5) * math.sin(phase_m2)
        mode3 = (0.09 * bright) * math.exp(-nt * 14.0) * math.sin(phase_m3)
        mallet = 0.18 * math.exp(-t / 0.0045) * math.sin(i * 1.91)
        spark = 0.0
        if transition == "sparkle" and t >= 0.055:
            phase_spark += 2.0 * math.pi * min(nyquist_limit, cur_f * 1.498) * dt
            spark = 0.22 * math.exp(-(t - 0.055) * 6.0) * math.sin(phase_spark)

        raw = 0.48 * fund + 0.38 * ks_buf[i] + mode2 + mode3 + mallet + spark
        lp, _, _, _ = svf_lp.step(raw)
        pluck_decay = math.exp(-nt * (2.6 - 0.5 * warmth))
        env = _amp_envelope(i, n, sample_rate, 0.002, 0.022) * vel * pluck_decay
        mono_buf[i] = 0.85 * env * lp

    for i in range(n):
        delayed = mono_buf[i - haas_samples] if i >= haas_samples else 0.0
        left[i] = mono_buf[i]
        right[i] = (0.82 - 0.12 * width) * mono_buf[i] + (0.22 + 0.22 * width) * delayed

    return left, right


def _synth_reverse_swell(
    freq_hz: float,
    dur_sec: float,
    vel: float,
    sample_rate: int,
) -> tuple[list[float], list[float]]:
    """Pitched reverse-cymbal / shimmer pre-drop riser tuned to the user's first lead note (#13)."""
    n = max(64, int(dur_sec * sample_rate))
    svf_bp = CytomicSVF(max(180.0, min(3600.0, freq_hz * 2.0)), 3.2, sample_rate)
    left: list[float] = [0.0] * n
    right: list[float] = [0.0] * n
    p1 = 0.0
    p2 = 0.0
    dt = 1.0 / float(sample_rate)

    for i in range(n):
        nt = i / float(n)
        # Exponential reverse-envelope crescendo that peaks right before the bar line
        swell_env = math.pow(nt, 2.6) * _amp_envelope(i, n, sample_rate, 0.015, 0.012) * vel
        if i % 16 == 0:
            sweep_f = max(220.0, min(sample_rate * 0.42, freq_hz * (1.0 + 3.0 * (nt * nt))))
            svf_bp.update_coeffs(sweep_f, 2.8, sample_rate)
        p1 += 2.0 * math.pi * freq_hz * dt
        p2 += 2.0 * math.pi * (freq_hz * 1.996) * dt
        noise = math.sin(i * 12.9898 + math.cos(i * 78.233) * 43758.5453)
        shimmer = 0.50 * math.sin(p1) + 0.30 * math.sin(p2) + 0.45 * noise
        _, bp, _, _ = svf_bp.step(shimmer)
        pan_spin = 0.25 * math.sin(2.0 * math.pi * 3.5 * (i * dt))
        sig = 0.72 * swell_env * math.tanh(1.6 * (bp + 0.35 * shimmer))
        left[i] = sig * (1.0 - pan_spin)
        right[i] = sig * (1.0 + pan_spin)

    return left, right


# Phase 9b: three drum kits chosen by ear. "punchy" is the original sound. The clap is its own sound
# (three quick band-passed noise bursts, no drum body), so a clap row never sounds like a snare.
DRUM_KITS: dict[str, dict[str, float]] = {
    "punchy": {"kick_lo": 49.0, "kick_sweep": 125.0, "kick_drop": 0.022, "kick_decay": 0.095,
               "snare_noise": 0.085, "clap_bp": 1500.0, "clap_tail": 0.06, "hat_hp": 5500.0, "hat_decay": 0.042},
    "soft": {"kick_lo": 45.0, "kick_sweep": 75.0, "kick_drop": 0.035, "kick_decay": 0.15,
             "snare_noise": 0.13, "clap_bp": 1000.0, "clap_tail": 0.09, "hat_hp": 3800.0, "hat_decay": 0.06},
    "tiny": {"kick_lo": 70.0, "kick_sweep": 150.0, "kick_drop": 0.012, "kick_decay": 0.05,
             "snare_noise": 0.05, "clap_bp": 2200.0, "clap_tail": 0.04, "hat_hp": 8500.0, "hat_decay": 0.03},
}


def _synth_drum(
    patch_id: str,
    dur_sec: float,
    vel: float,
    sample_rate: int,
    kit: str = "punchy",
) -> tuple[list[float], list[float]]:
    """Procedural kick, snare, clap and metallic hi-hats, in one of three kits."""
    k = DRUM_KITS.get(kit, DRUM_KITS["punchy"])
    if patch_id == "kick":
        n = max(64, int(min(dur_sec, 0.22) * sample_rate))
        out = [0.0] * n
        phase = 0.0
        dt = 1.0 / float(sample_rate)
        for i in range(n):
            t = i * dt
            f = k["kick_lo"] + k["kick_sweep"] * math.exp(-t / k["kick_drop"])
            phase += 2.0 * math.pi * f * dt
            click = 0.35 * math.sin(2.0 * math.pi * 2200.0 * t) * math.exp(-t / 0.004)
            env = math.exp(-t / k["kick_decay"]) * vel
            out[i] = env * math.tanh(2.1 * (math.sin(phase) + click))
        return out, list(out)

    if patch_id == "clap":
        n = max(64, int(min(max(dur_sec, 0.12), 0.25) * sample_rate))
        left = [0.0] * n
        right = [0.0] * n
        svf_bp = CytomicSVF(k["clap_bp"], 1.4, sample_rate)
        dt = 1.0 / float(sample_rate)
        bursts = (0.0, 0.011, 0.022)
        for i in range(n):
            t = i * dt
            env = sum(math.exp(-(t - b) / 0.006) for b in bursts if t >= b)
            if t >= bursts[-1]:
                env += 0.6 * math.exp(-(t - bursts[-1]) / k["clap_tail"])
            noise = math.sin(i * 12.9898 + math.cos(i * 78.233) * 43758.5453)
            _, bp, _, _ = svf_bp.step(noise)
            sig = vel * math.tanh(1.6 * bp * env)
            left[i] = sig * 1.04
            right[i] = sig * 0.96
        return left, right

    if patch_id == "snare":
        n = max(64, int(min(dur_sec, 0.20) * sample_rate))
        left = [0.0] * n
        right = [0.0] * n
        p1 = 0.0
        p2 = 0.0
        dt = 1.0 / float(sample_rate)
        for i in range(n):
            t = i * dt
            p1 += 2.0 * math.pi * (200.0 + 90.0 * math.exp(-t / 0.015)) * dt
            p2 += 2.0 * math.pi * 330.0 * dt
            body = (0.65 * math.sin(p1) + 0.35 * math.sin(p2)) * math.exp(-t / 0.048)
            noise = math.sin(i * 12.9898 + math.cos(i * 78.233) * 43758.5453)
            noise_env = math.exp(-t / k["snare_noise"])
            sig = vel * math.tanh(1.9 * (body + 0.72 * noise * noise_env))
            left[i] = sig * 0.96
            right[i] = sig * 1.04
        return left, right

    # Hi-hat / Percussion (6 inharmonic metallic oscillators high-passed)
    decay = k["hat_decay"] if patch_id == "hat_closed" else 0.16
    n = max(64, int(min(dur_sec, decay * 2.2) * sample_rate))
    left = [0.0] * n
    right = [0.0] * n
    ratios = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)
    svf_hp = CytomicSVF(k["hat_hp"], 0.9, sample_rate)
    dt = 1.0 / float(sample_rate)
    for i in range(n):
        t = i * dt
        s = sum(1.0 if math.sin(2.0 * math.pi * r * t * 6.0) >= 0.0 else -1.0 for r in ratios) / 6.0
        _, _, hp, _ = svf_hp.step(s)
        env = math.exp(-t / decay) * vel * 0.48
        left[i] = env * hp * 0.92
        right[i] = env * hp * 1.08
    return left, right


def _role_matches_filter(role: str, role_filter: str | None) -> bool:
    if not role_filter:
        return True
    if role_filter == "beat":
        return role == "drums"
    if role_filter == "tune":
        return role == "lead"
    if role_filter == "under":
        return role in ("harmony", "bass", "hocket")
    return role == role_filter


RENDER_TAIL_SEC = 2.0  # Browser 1.5s convolution plus voice/percussion release reserve.


def render_duration_seconds(song: dict[str, Any]) -> float:
    """Shared browser/Python output extent; fixed tail, not measured silence."""
    def finite(value: Any) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, number) if math.isfinite(number) else 0.0

    declared = finite(song.get("total_duration_sec"))
    note_end = max((finite(event.get("start_sec")) + finite(event.get("duration_sec"))
                    for event in song.get("events", [])), default=0.0)
    return max(declared, note_end) + RENDER_TAIL_SEC


def render_compiled_song_to_pcm(
    compiled_song: dict[str, Any],
    sample_rate: int = 22050,
    role_filter: str | None = None,
) -> tuple[list[float], list[float], dict[str, Any]]:
    """Render a CompiledSong schedule to stereo float buffers (left, right) and return audio metrics."""
    total_dur = max(0.5, float(compiled_song.get("total_duration_sec", 8.727)))
    bpm = float(compiled_song.get("bpm", 110.0))
    step_sec = float(compiled_song.get("step_sec", (60.0 / bpm) / 4.0))
    total_samples = math.ceil(render_duration_seconds(compiled_song) * sample_rate)

    drum_l = [0.0] * total_samples
    drum_r = [0.0] * total_samples
    synth_l = [0.0] * total_samples
    synth_r = [0.0] * total_samples

    for ev in compiled_song.get("events", []):
        if not _role_matches_filter(str(ev.get("role", "hocket")), role_filter):
            continue
        start_idx = max(0, int(float(ev.get("start_sec", 0.0)) * sample_rate))
        ev_l, ev_r = synthesize_event(ev, bpm=bpm, sample_rate=sample_rate)
        is_drum = ev.get("role") == "drums"
        target_l = drum_l if is_drum else synth_l
        target_r = drum_r if is_drum else synth_r
        end_idx = min(total_samples, start_idx + len(ev_l))
        for j in range(start_idx, end_idx):
            target_l[j] += ev_l[j - start_idx]
            target_r[j] += ev_r[j - start_idx]

    # Apply automatic Kick/Snare sidechain ducking envelope to Synth/Bass bus
    duck_samples = int(0.110 * sample_rate)
    for duck_time, weight in _sidechain_events(compiled_song, step_sec):
        d_start = int(duck_time * sample_rate)
        d_end = min(total_samples, d_start + duck_samples)
        for j in range(d_start, d_end):
            prog = (j - d_start) / float(max(1, duck_samples))
            duck_gain = 1.0 - weight * .78 * (1.0 - prog * prog)
            synth_l[j] *= duck_gain
            synth_r[j] *= duck_gain

    # Add subtle stereo chorus/reverb spatial reflection to synth bus so L/R width is rich
    delay_l = int(0.017 * sample_rate)
    delay_r = int(0.023 * sample_rate)
    out_l = [0.0] * total_samples
    out_r = [0.0] * total_samples

    for i in range(total_samples):
        rev_l = synth_r[i - delay_l] * 0.18 if i >= delay_l else 0.0
        rev_r = synth_l[i - delay_r] * 0.18 if i >= delay_r else 0.0
        out_l[i] = drum_l[i] + synth_l[i] + rev_l
        out_r[i] = drum_r[i] + synth_r[i] + rev_r

    # Remove DC offset and normalize peak cleanly into [-1.8 dBFS, -0.8 dBFS] (0.81 .. 0.91)
    mean_l = sum(out_l) / float(total_samples)
    mean_r = sum(out_r) / float(total_samples)
    peak = 1e-6
    for i in range(total_samples):
        out_l[i] = math.tanh(0.85 * (out_l[i] - mean_l))
        out_r[i] = math.tanh(0.85 * (out_r[i] - mean_r))
        if abs(out_l[i]) > peak:
            peak = abs(out_l[i])
        if abs(out_r[i]) > peak:
            peak = abs(out_r[i])

    # Phase 8.0 safe sound: same -3 dBFS ceiling as the browser safety clip (master_bus.js SAFETY_CEILING),
    # applied only as a reduction so exports never come out louder than the mix.
    scale = min(1.0, TARGET_PEAK / peak)
    for i in range(total_samples):
        out_l[i] *= scale
        out_r[i] *= scale

    metrics = compute_wav_metrics(out_l, out_r, sample_rate=sample_rate)
    section_rms: dict[str, float] = {}
    pre_drop_window_rms_dbfs: float | None = None
    step_sec = float(compiled_song.get("step_sec", (60.0 / float(compiled_song.get("bpm", 110.0))) / 4.0))

    for sec in compiled_song.get("sections", []):
        s_idx = max(0, int(float(sec.get("start_sec", 0.0)) * sample_rate))
        e_idx = min(total_samples, int(float(sec.get("end_sec", total_dur)) * sample_rate))
        if e_idx > s_idx:
            seg_len = e_idx - s_idx
            power = sum(
                0.5 * (out_l[k] * out_l[k] + out_r[k] * out_r[k])
                for k in range(s_idx, e_idx)
            ) / float(seg_len)
            rms_val = math.sqrt(max(1e-12, power))
            section_rms[str(sec.get("id", "sec"))] = round(20.0 * math.log10(rms_val), 3)

            if sec.get("id") == "sec_build" or sec.get("type") == "build":
                w_start = max(s_idx, int((float(sec.get("end_sec", total_dur)) - 3.0 * step_sec) * sample_rate))
                w_end = e_idx
                if w_end > w_start:
                    w_pow = sum(
                        0.5 * (out_l[k] * out_l[k] + out_r[k] * out_r[k])
                        for k in range(w_start, w_end)
                    ) / float(w_end - w_start)
                    pre_drop_window_rms_dbfs = round(20.0 * math.log10(math.sqrt(max(1e-12, w_pow))), 3)

    metrics["section_rms_dbfs"] = section_rms
    metrics["pre_drop_window_rms_dbfs"] = pre_drop_window_rms_dbfs
    return out_l, out_r, metrics


def render_compiled_song_to_wav(
    compiled_song: dict[str, Any],
    wav_path: str | Path,
    sample_rate: int = 22050,
) -> dict[str, Any]:
    """Render a CompiledSong schedule to a 16-bit stereo PCM .wav file and return verification metrics."""
    out_l, out_r, metrics = render_compiled_song_to_pcm(compiled_song, sample_rate=sample_rate)
    dest = Path(wav_path)
    dest.parent.mkdir(parents=True, exist_ok=True)

    pcm_frames = bytearray(len(out_l) * 4)
    offset = 0
    for l_val, r_val in zip(out_l, out_r):
        s_l = int(max(-32767, min(32767, round(l_val * 32767.0))))
        s_r = int(max(-32767, min(32767, round(r_val * 32767.0))))
        struct.pack_into("<hh", pcm_frames, offset, s_l, s_r)
        offset += 4

    with wave.open(str(dest), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_frames)

    metrics["wav_path"] = str(dest)
    metrics["file_size_bytes"] = dest.stat().st_size
    return metrics
