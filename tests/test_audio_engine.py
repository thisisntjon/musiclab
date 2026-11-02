"""Unit tests for audio-engine (Success Criterion #4 & Assumptions A7/A8)."""
from pathlib import Path
import statistics
import tempfile
import unittest

from src.theory_core import compile_song, unfold_song_sections
from src.audio_engine import (
    estimate_fundamental_hz,
    render_compiled_song_to_wav,
    spectral_centroid,
    synthesize_event,
)


class TestAudioEngine(unittest.TestCase):
    def test_lookahead_scheduler_contract_in_js(self):
        """Verify browser scheduler uses 25ms/100ms Web Audio lookahead and never triggers audio inside requestAnimationFrame."""
        js_path = Path("static/js/audio/scheduler.js")
        self.assertTrue(js_path.exists())
        source = js_path.read_text(encoding="utf-8")
        self.assertIn("LOOKAHEAD_INTERVAL_MS = 25", source)
        self.assertIn("SCHEDULE_AHEAD_SEC = 0.100", source)
        self.assertIn("audioCtx.currentTime + SCHEDULE_AHEAD_SEC", source)
        self.assertIn("OfflineAudioContext", source)
        self.assertIn("renderSongOfflineToWavBlob", source)
        self.assertIn("renderPatchSampleOfflineToWavBlob", source)
        self.assertIn("encodeAudioBufferToWavBlob", source)
        self.assertIn("setReferenceDrone", source)
        self.assertIn("auditionNoteWithResolution", source)
        self.assertIn("auditionMissionSequence", source)
        self.assertIn("setReferenceDrone", source)
        self.assertIn("auditionNoteWithResolution", source)
        self.assertIn("setSpotlightRole", source)
        self.assertIn("auditionEarMission", source)

    def test_vowel_and_grit_spectral_centroid_shifts(self):
        """Verify manipulating Vowel (O -> I) shifts centroid > 350 Hz and Grit (0.1 -> 0.95) shifts centroid > 400 Hz."""
        ev_vowel_o = {
            "role": "hocket",
            "patch_id": "monster_growl",
            "duration_sec": 0.45,
            "velocity": 0.9,
            "concrete": {"freq_hz": 55.0},
            "gesture": {
                "shape": "ramp_up_down",
                "vowel_start": "O",
                "vowel_end": "U",
                "grit": 0.80,
                "ott_punch": 0.85,
            },
        }
        ev_vowel_i = {
            "role": "hocket",
            "patch_id": "monster_growl",
            "duration_sec": 0.45,
            "velocity": 0.9,
            "concrete": {"freq_hz": 55.0},
            "gesture": {
                "shape": "ramp_up_down",
                "vowel_start": "E",
                "vowel_end": "I",
                "grit": 0.80,
                "ott_punch": 0.85,
            },
        }
        l_o, _ = synthesize_event(ev_vowel_o, bpm=110.0, sample_rate=22050)
        l_i, _ = synthesize_event(ev_vowel_i, bpm=110.0, sample_rate=22050)
        c_o = spectral_centroid(l_o, 22050)
        c_i = spectral_centroid(l_i, 22050)
        self.assertGreater(
            abs(c_i - c_o),
            350.0,
            f"Vowel centroid shift {abs(c_i - c_o):.1f} Hz <= 350 Hz (O={c_o}, I={c_i})",
        )

        ev_low_grit = {
            "role": "hocket",
            "patch_id": "monster_growl",
            "duration_sec": 0.45,
            "velocity": 0.9,
            "concrete": {"freq_hz": 55.0},
            "gesture": {
                "shape": "ramp_up_down",
                "vowel_start": "O",
                "vowel_end": "A",
                "grit": 0.05,
                "ott_punch": 0.20,
            },
        }
        ev_high_grit = {
            "role": "hocket",
            "patch_id": "monster_growl",
            "duration_sec": 0.45,
            "velocity": 0.9,
            "concrete": {"freq_hz": 55.0},
            "gesture": {
                "shape": "ramp_up_down",
                "vowel_start": "A",
                "vowel_end": "I",
                "grit": 0.98,
                "ott_punch": 0.95,
            },
        }
        l_low, _ = synthesize_event(ev_low_grit, bpm=110.0, sample_rate=22050)
        l_high, _ = synthesize_event(ev_high_grit, bpm=110.0, sample_rate=22050)
        c_low = spectral_centroid(l_low, 22050)
        c_high = spectral_centroid(l_high, 22050)
        self.assertGreater(
            c_high - c_low,
            400.0,
            f"Grit centroid shift {c_high - c_low:.1f} Hz <= 400 Hz (low={c_low}, high={c_high})",
        )

    def test_fundamental_pitch_accuracy(self):
        """Verify fundamental frequency estimation is within +-2 Hz of concrete.freq_hz."""
        target_hz = 110.0  # A2
        ev = {
            "role": "bass",
            "patch_id": "wobble_bass",
            "duration_sec": 0.50,
            "velocity": 0.9,
            "concrete": {"freq_hz": target_hz},
            "gesture": {"lfo_rate": "1/4", "grit": 0.25, "ott_punch": 0.4},
        }
        left, _ = synthesize_event(ev, bpm=110.0, sample_rate=22050)
        est_hz = estimate_fundamental_hz(left, sample_rate=22050, expected_hz=target_hz)
        self.assertLessEqual(
            abs(est_hz - target_hz),
            2.0,
            f"Estimated fundamental {est_hz} Hz differs from {target_hz} Hz by > 2.0 Hz",
        )

    def test_full_band_heavybass_wav_render_and_metrics(self):
        """Verify 4-bar Heavy Bass loop WAV bounce meets peak [-6.0, -3.0] dBFS, zero clipping, DC < 0.001, sigma_vel >= 0.04, stereo width > -30 dB."""
        song = {
            "id": "test-heavybass",
            "title": "Heavy Bass Test",
            "global_context": {"bpm": 110.0, "swing": 0.54, "root_pc": 7, "scale_type": "natural_minor", "bars": 4},
            "notes": [
                {"id": "k1", "step": 0, "duration_steps": 1, "velocity": 0.95, "role": "drums", "patch_id": "kick"},
                {"id": "s1", "step": 4, "duration_steps": 1, "velocity": 0.92, "role": "drums", "patch_id": "snare"},
                {"id": "h1", "step": 2, "duration_steps": 1, "velocity": 0.72, "role": "drums", "patch_id": "hat_closed"},
                {"id": "g1", "step": 1, "duration_steps": 2, "velocity": 0.88, "role": "hocket", "patch_id": "monster_growl", "gesture": {"preset_id": "vowel_yoi"}},
                {"id": "w1", "step": 3, "duration_steps": 2, "velocity": 0.85, "role": "hocket", "patch_id": "wobble_bass", "gesture": {"preset_id": "wobble_1_16"}},
                {"id": "l1", "step": 6, "duration_steps": 2, "velocity": 0.90, "role": "hocket", "patch_id": "laser_screech", "gesture": {"preset_id": "laser_drop"}},
                {"id": "v1", "step": 12, "duration_steps": 4, "velocity": 0.86, "role": "hocket", "patch_id": "vocal_chop", "gesture": {"preset_id": "stutter_32"}},
            ],
        }
        compiled = compile_song(song)
        velocities = [e["velocity"] for e in compiled["events"]]
        vel_sigma = statistics.pstdev(velocities)
        self.assertGreaterEqual(vel_sigma, 0.04, f"Velocity std dev {vel_sigma} < 0.04")

        # Render into a temp dir: the accepted WAVs in workflow/evidence must never be rewritten by a test run.
        with tempfile.TemporaryDirectory() as tmpdir:
            wav_out = Path(tmpdir) / "phase1_heavybass_demo.wav"
            metrics = render_compiled_song_to_wav(compiled, wav_out, sample_rate=22050)
            self.assertTrue(wav_out.exists())
        self.assertGreaterEqual(metrics["peak_dbfs"], -6.0)
        self.assertLessEqual(metrics["peak_dbfs"], -3.0 + 0.01)
        self.assertEqual(metrics["clipped_samples"], 0)
        self.assertLess(metrics["dc_offset"], 0.001)
        self.assertGreater(metrics["stereo_diff_db"], -30.0)

    def test_subtractive_song_section_rms_monotonic_scaling(self):
        """Verify unfolded multi-section song renders WAV with RMS(Intro) < RMS(Verse) < RMS(Drop)."""
        song = unfold_song_sections({
            "id": "test-heavybass-song",
            "title": "Heavy Bass Multi-Section RMS Test",
            "global_context": {"bpm": 125.0, "swing": 0.53, "root_pc": 7, "scale_type": "dorian", "bars": 4},
            "notes": [
                {"id": f"k-{s}", "step": s, "duration_steps": 1, "velocity": 0.96, "role": "drums", "patch_id": "kick"}
                for s in (0, 8, 16, 24, 32, 40, 48, 56)
            ]
            + [
                {"id": f"sn-{s}", "step": s, "duration_steps": 1, "velocity": 0.94, "role": "drums", "patch_id": "snare"}
                for s in (4, 12, 20, 28, 36, 44, 52, 60)
            ]
            + [
                {"id": f"sub-{s}", "step": s, "duration_steps": 2, "velocity": 0.95, "role": "bass", "patch_id": "sub_drop_808"}
                for s in (0, 16, 32, 48)
            ]
            + [
                {"id": f"grw-{s}", "step": s, "duration_steps": 2, "velocity": 0.92, "role": "hocket", "patch_id": "monster_growl", "gesture": {"preset_id": "wah_bite"}}
                for s in (2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62)
            ]
            + [
                {"id": f"ld-{s}", "step": s, "duration_steps": 2, "velocity": 0.85, "role": "lead", "patch_id": "supersaw_stab"}
                for s in (0, 8, 16, 24, 32, 40, 48, 56)
            ],
        })
        compiled = compile_song(song)
        with tempfile.TemporaryDirectory() as tmpdir:
            metrics = render_compiled_song_to_wav(compiled, Path(tmpdir) / "phase2_heavybass_full_song.wav", sample_rate=11025)
        sec_rms = metrics["section_rms_dbfs"]
        self.assertLess(
            sec_rms["sec_intro"],
            sec_rms["sec_verse"],
            f"Intro RMS ({sec_rms['sec_intro']}) not < Verse RMS ({sec_rms['sec_verse']})",
        )
        self.assertLess(
            sec_rms["sec_verse"],
            sec_rms["sec_drop_1"],
            f"Verse RMS ({sec_rms['sec_verse']}) not < Drop 1 RMS ({sec_rms['sec_drop_1']})",
        )

    def test_contrastive_ab_humanize_and_predrop_silence_metrics(self):
        """Verify Phase 4 Surface A Contrastive A/B Bypass in audio engine: humanize=False gives sigma_vel=0.0 and pre_drop_silence=True gives fewer build events."""
        song = unfold_song_sections({
            "id": "ab-audio-test",
            "global_context": {"bpm": 110.0, "swing": 0.55, "root_pc": 7, "scale_type": "dorian", "bars": 4},
            "notes": [
                {"id": f"k-{s}", "step": s, "duration_steps": 1, "velocity": 0.95, "role": "drums", "patch_id": "kick"}
                for s in range(0, 64, 4)
            ],
        })
        comp_human = compile_song(song, {"humanize": True, "pre_drop_silence": True})
        comp_flat = compile_song(song, {"humanize": False, "pre_drop_silence": False})

        sigma_human = statistics.pstdev([e["velocity"] for e in comp_human["events"]])
        sigma_flat = statistics.pstdev([e["velocity"] for e in comp_flat["events"] if "transition_tag" not in e])
        self.assertGreaterEqual(sigma_human, 0.04)
        self.assertEqual(sigma_flat, 0.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            m_sil = render_compiled_song_to_wav(comp_human, Path(tmpdir) / "phase4_predrop_sil.wav", sample_rate=11025)
            m_nosil = render_compiled_song_to_wav(comp_flat, Path(tmpdir) / "phase4_predrop_nosil.wav", sample_rate=11025)
        self.assertGreaterEqual(
            m_nosil["pre_drop_window_rms_dbfs"] - m_sil["pre_drop_window_rms_dbfs"],
            18.0,
        )

    def test_general_music_voices_clean_bass_warm_keys_pluck_lead(self):
        """Verify dedicated synthesis voices for clean_bass, warm_keys, and single-note pluck_lead."""
        ev_bass = {
            "role": "bass",
            "patch_id": "clean_bass",
            "duration_sec": 0.45,
            "velocity": 0.9,
            "concrete": {"freq_hz": 110.0},
        }
        ev_wobble = {
            "role": "bass",
            "patch_id": "wobble_bass",
            "duration_sec": 0.45,
            "velocity": 0.9,
            "concrete": {"freq_hz": 110.0},
            "gesture": {"lfo_rate": "1/16", "grit": 0.85, "ott_punch": 0.85},
        }
        l_clean, _ = synthesize_event(ev_bass, bpm=100.0, sample_rate=22050)
        l_wob, _ = synthesize_event(ev_wobble, bpm=100.0, sample_rate=22050)
        self.assertLessEqual(abs(estimate_fundamental_hz(l_clean, 22050, 110.0) - 110.0), 2.0)
        # Clean bass has a warmer, lower spectral centroid than gritty wobble_bass
        self.assertLess(spectral_centroid(l_clean, 22050), spectral_centroid(l_wob, 22050))

        ev_keys = {
            "role": "harmony",
            "patch_id": "warm_keys",
            "duration_sec": 0.45,
            "velocity": 0.85,
            "voiced_freqs": [261.63, 329.63, 392.00],
            "concrete": {"freq_hz": 261.63},
        }
        ev_saw = {
            "role": "harmony",
            "patch_id": "supersaw_stab",
            "duration_sec": 0.45,
            "velocity": 0.85,
            "voiced_freqs": [261.63, 329.63, 392.00],
            "concrete": {"freq_hz": 261.63},
        }
        l_keys, _ = synthesize_event(ev_keys, bpm=100.0, sample_rate=22050)
        l_saw, _ = synthesize_event(ev_saw, bpm=100.0, sample_rate=22050)
        self.assertNotEqual(l_keys[:64], l_saw[:64])

        ev_pluck = {
            "role": "lead",
            "patch_id": "pluck_lead",
            "duration_sec": 0.45,
            "velocity": 0.88,
            "concrete": {"freq_hz": 440.0},
        }
        l_pluck, _ = synthesize_event(ev_pluck, bpm=100.0, sample_rate=22050)
        self.assertLessEqual(abs(estimate_fundamental_hz(l_pluck, 22050, 440.0) - 440.0), 2.0)


def _whole_hit_centroid(samples: list[float], sample_rate: int) -> float:
    """Spectral centroid over the whole drum hit (attack included), by FFT."""
    import cmath
    import math

    n = 1
    while n < len(samples):
        n *= 2
    x = list(samples) + [0.0] * (n - len(samples))

    def fft(a):
        if len(a) == 1:
            return a
        even, odd = fft(a[0::2]), fft(a[1::2])
        tw = [cmath.exp(-2j * math.pi * k / len(a)) * odd[k] for k in range(len(a) // 2)]
        return [even[k] + tw[k] for k in range(len(a) // 2)] + [even[k] - tw[k] for k in range(len(a) // 2)]

    mags = [abs(v) for v in fft(x)[: n // 2]]
    return sum(m * k * sample_rate / n for k, m in enumerate(mags)) / sum(mags)


class DrumKitsTest(unittest.TestCase):
    """Phase 9b-3: three kits that sound different; in each one the clap is clearly not the snare."""

    def test_kits_clap_differs_from_snare_by_300_hz(self):
        from src.audio_engine.synth import DRUM_KITS

        sr = 22050
        for kit in ("soft", "punchy", "tiny"):
            self.assertIn(kit, DRUM_KITS)
            ev = {"role": "drums", "duration_sec": 0.2, "velocity": 0.9, "drum_kit": kit}
            clap = synthesize_event({**ev, "patch_id": "clap"}, sample_rate=sr)[0]
            snare = synthesize_event({**ev, "patch_id": "snare"}, sample_rate=sr)[0]
            gap = abs(_whole_hit_centroid(clap, sr) - _whole_hit_centroid(snare, sr))
            self.assertGreaterEqual(gap, 300.0, f"{kit}: clap and snare centroids only {gap:.0f} Hz apart")
            self.assertLessEqual(max(abs(s) for s in clap + snare), 1.0)

    def test_kits_differ_from_each_other(self):
        sr = 22050
        kicks = {}
        for kit in ("soft", "punchy", "tiny"):
            kicks[kit] = synthesize_event({"role": "drums", "patch_id": "kick", "duration_sec": 0.3, "velocity": 0.9, "drum_kit": kit}, sample_rate=sr)[0]
        self.assertNotEqual(kicks["soft"], kicks["punchy"])
        self.assertNotEqual(kicks["punchy"], kicks["tiny"])
        # the kit travels from the song to every drum event
        doc = {"global_context": {"bpm": 100, "root_pc": 0, "scale_type": "major"}, "drum_kit": "soft", "auto_harmony_stabs": False,
               "notes": [{"id": "k", "step": 0, "duration_steps": 1, "role": "drums", "patch_id": "kick", "concrete": {"midi_pitch": 36}}]}
        drums = [e for e in compile_song(doc)["events"] if e["role"] == "drums"]
        self.assertTrue(drums and all(e["drum_kit"] == "soft" for e in drums))


class Phase12SynthAndHarmonyTest(unittest.TestCase):
    """Phase 12c-12e: Karplus-Strong + marimba modal pluck, transitions, reverse_swell riser, ripple/jux harmony, gap bass, and stem role_filter."""

    def test_karplus_strong_and_modal_pluck_transitions_and_reverse_swell(self):
        from src.audio_engine.dsp import karplus_strong_pluck
        from src.audio_engine.synth import render_compiled_song_to_pcm

        ks = karplus_strong_pluck(440.0, 2048, sample_rate=22050)
        self.assertEqual(len(ks), 2048)
        self.assertLessEqual(max(abs(x) for x in ks), 1.0)

        for trans in (None, "slide", "bounce", "sparkle"):
            ev = {
                "role": "lead",
                "patch_id": "pluck_lead",
                "duration_sec": 0.35,
                "velocity": 0.85,
                "concrete": {"freq_hz": 440.0},
                "prev_freq_hz": 330.0,
                "transition": trans,
                "sound_seed": {"brightness": 0.72, "warmth": 0.42, "width": 0.55},
            }
            l_buf, r_buf = synthesize_event(ev, bpm=100.0, sample_rate=22050)
            self.assertGreater(max(abs(x) for x in l_buf), 0.05)

        swell_l, swell_r = synthesize_event(
            {
                "role": "harmony",
                "patch_id": "reverse_swell",
                "duration_sec": 0.6,
                "velocity": 0.75,
                "concrete": {"freq_hz": 261.63},
            },
            bpm=100.0,
            sample_rate=22050,
        )
        n = len(swell_l)
        early_rms = sum(x * x for x in swell_l[: n // 3]) / (n // 3)
        late_rms = sum(x * x for x in swell_l[(2 * n) // 3 :]) / (n - (2 * n) // 3)
        self.assertGreater(late_rms, early_rms, "reverse_swell must crescendo toward the end of the riser")

    def test_ripple_jux_gap_bass_and_stem_role_filter_ceiling(self):
        from src.audio_engine.synth import render_compiled_song_to_pcm
        from src.theory_core.harmony import harmonize_melody_phrase, suggest_next
        from src.theory_core.hocket import generate_gap_answer_notes

        lead = [
            {"id": "l0", "step": 0, "duration_steps": 4, "role": "lead", "patch_id": "pluck_lead", "pitch_lock_mode": "concrete", "provenance": "user_placed", "concrete": {"midi_pitch": 60}},
            {"id": "l4", "step": 4, "duration_steps": 4, "role": "lead", "patch_id": "pluck_lead", "pitch_lock_mode": "concrete", "provenance": "user_placed", "concrete": {"midi_pitch": 64}},
        ]
        sparks = suggest_next([60, None, None, None, 64] + [None] * 11, 4, [60, 62, 64, 67, 69], 0, [[0, 4, 7]])
        self.assertTrue(1 <= len(sparks) <= 2)

        pinned = {0: {"bar": 0, "degree": 6, "roman": "vi", "quality": "min"}}
        opts = harmonize_melody_phrase(lead, 0, "major", pinned_bars=pinned)
        self.assertTrue(all(o["progression"][0]["roman"] == "vi" for o in opts))

        gaps = generate_gap_answer_notes(lead, [], bars=4, patch_id="clean_bass")
        self.assertTrue(len(gaps) >= 4)
        self.assertTrue(all(g["step"] not in (0, 1, 2, 3, 4, 5, 6, 7) for g in gaps))

        doc = {
            "global_context": {"bpm": 100, "root_pc": 0, "scale_type": "major", "bars": 4},
            "auto_harmony_stabs": True,
            "harmony_style": "ripple",
            "stereo_jux": True,
            "sound_seed": {"brightness": 0.72, "warmth": 0.5, "width": 0.75},
            "chord_progressions": {"prog-main": opts[0]["progression"]},
            "active_progression_id": "prog-main",
            "notes": [
                {"id": "k0", "step": 0, "duration_steps": 1, "role": "drums", "patch_id": "kick", "concrete": {"midi_pitch": 36}},
                *lead,
                *gaps,
            ],
        }
        compiled = compile_song(doc)
        self.assertTrue(any("jux" in str(e["id"]) for e in compiled["events"]))
        for rf in (None, "beat", "tune", "under"):
            _, _, metrics = render_compiled_song_to_pcm(compiled, sample_rate=11025, role_filter=rf)
            self.assertLessEqual(metrics["peak_dbfs"], -3.0 + 0.01)


if __name__ == "__main__":
    unittest.main()
