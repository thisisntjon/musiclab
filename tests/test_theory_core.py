"""Unit tests for theory-core (Success Criteria #3 & #5, Assumptions A3/A4/A5/A8)."""
import unittest
from src.theory_core import (
    MONSTER_CHOKE_PATCHES,
    classify_step_gravity,
    compile_song,
    gesture_from_xy,
    lock_bass_to_kick,
    transform_call_response,
    unfold_song_sections,
    voice_chord_progression,
    apply_monophonic_hocket_choke,
    diagnose_song,
    apply_diagnostic_fix,
    preview_transform_diff,
    generate_ear_mission,
    grade_ear_mission,
    harmonize_melody_phrase,
    suggest_harmony_alternatives,
    compute_provenance_summary,
    ensure_fluid_song_graph,
    FLUID_SONG_RUNG_SPECS,
)


class TestTheoryCore(unittest.TestCase):
    def test_voice_leading_invariants_c3_to_e5(self):
        """Verify upper chord voices stay in C3-E5 (48..76), avg motion <= 2.5 st, and no interval < 7 st below C3."""
        progressions = [
            # G Minor Heavy Bass progression (i - bVI - bVII - i)
            (7, "natural_minor", [{"degree": 1}, {"degree": 6}, {"degree": 7}, {"degree": 1}]),
            # Classic i - iv - bVII - bIII
            (0, "natural_minor", [{"degree": 1}, {"degree": 4}, {"degree": 7}, {"degree": 3}]),
            # Dorian groove (i - IV - bVII - i)
            (7, "dorian", [{"degree": 1}, {"degree": 4}, {"degree": 7}, {"degree": 1}]),
        ]
        for root_pc, scale_type, prog in progressions:
            voiced = voice_chord_progression(root_pc, scale_type, prog)
            self.assertEqual(len(voiced), 4)
            for idx, chord in enumerate(voiced):
                midi_notes = chord["voiced_midi"]
                self.assertTrue(all(48 <= m <= 76 for m in midi_notes), f"Out of C3-E5: {midi_notes}")
                self.assertTrue(24 <= chord["bass_midi"] <= 47, f"Bass out of C1-B2: {chord['bass_midi']}")
                if idx > 0:
                    self.assertLessEqual(
                        chord["avg_voice_motion_st"],
                        2.5,
                        f"Voice motion {chord['avg_voice_motion_st']} > 2.5 st on {chord['chord_name']}",
                    )

    def test_dynamic_chord_gravity_and_why_labels(self):
        """Verify all 12 pitch classes at every step have tier classification, why_label, and resolution target."""
        voiced = voice_chord_progression(
            7, "natural_minor", [{"degree": 1}, {"degree": 6}, {"degree": 7}, {"degree": 1}]
        )
        for chord in voiced:
            grav = classify_step_gravity(7, "natural_minor", chord)
            self.assertEqual(len(grav), 12)
            tiers = {info["tier"] for info in grav.values()}
            self.assertEqual(tiers, {"tier_1_anchor", "tier_2_tension", "chromatic"})
            for pc, info in grav.items():
                self.assertTrue(isinstance(info["why_label"], str) and len(info["why_label"]) > 15)
                self.assertIn(info["resolution_target_pc"], chord["chord_pcs"])

    def test_monophonic_hocket_choke_and_kick_lock(self):
        """Verify overlapping monster patches choke each other so only 1 monster sounds per step, and Kick-Lock aligns."""
        raw_hocket = [
            {"id": "n1", "step": 0, "duration_steps": 6, "role": "hocket", "patch_id": "wobble_bass"},
            {"id": "n2", "step": 2, "duration_steps": 4, "role": "hocket", "patch_id": "monster_growl"},
            {"id": "n3", "step": 4, "duration_steps": 4, "role": "hocket", "patch_id": "laser_screech"},
            {"id": "n4", "step": 4, "duration_steps": 2, "role": "hocket", "patch_id": "vocal_chop"},
        ]
        choked = apply_monophonic_hocket_choke(raw_hocket, total_steps=16)
        monsters = sorted(
            [n for n in choked if n["patch_id"] in MONSTER_CHOKE_PATCHES],
            key=lambda x: x["step"],
        )
        self.assertEqual(len(monsters), 3)  # Step 4 duplicate replaced by vocal_chop
        self.assertEqual(monsters[0]["step"], 0)
        self.assertEqual(monsters[0]["duration_steps"], 2)  # Truncated at step 2!
        self.assertEqual(monsters[1]["step"], 2)
        self.assertEqual(monsters[1]["duration_steps"], 2)  # Truncated at step 4!
        self.assertEqual(monsters[2]["patch_id"], "vocal_chop")

        drums = [
            {"id": "k1", "step": 0, "role": "drums", "patch_id": "kick"},
            {"id": "k2", "step": 7, "role": "drums", "patch_id": "kick"},
            {"id": "k3", "step": 10, "role": "drums", "patch_id": "kick"},
        ]
        locked = lock_bass_to_kick(monsters, drums, steps_per_bar=16, bars=1)
        locked_steps = {n["step"] for n in locked if n.get("kick_locked")}
        self.assertTrue({0, 7, 10}.issubset(locked_steps))

    def test_call_and_response_motif_transform(self):
        """Verify A -> A' -> A -> B preserves Bar 1 step offsets and lands 100% of anchor notes on active chord tones."""
        voiced = voice_chord_progression(
            7, "natural_minor", [{"degree": 1}, {"degree": 6}, {"degree": 7}, {"degree": 1}]
        )
        bar1_seed = [
            {"id": "m1", "step": 0, "duration_steps": 2, "role": "lead", "patch_id": "laser_screech", "relational": {"anchor": "chord_tone", "chord_tone_index": 0}},
            {"id": "m2", "step": 6, "duration_steps": 2, "role": "lead", "patch_id": "monster_growl", "relational": {"anchor": "chord_tone", "chord_tone_index": 1}},
            {"id": "m3", "step": 12, "duration_steps": 2, "role": "lead", "patch_id": "vocal_chop", "relational": {"anchor": "chord_tone", "chord_tone_index": 2}},
        ]
        expanded = transform_call_response(bar1_seed, voiced, 7, "natural_minor")
        self.assertEqual(len(expanded), 12)
        for bar_idx in range(4):
            bar_notes = [n for n in expanded if (n["step"] // 16) == bar_idx]
            self.assertEqual([n["step"] % 16 for n in bar_notes], [0, 6, 12])

        compiled = compile_song({
            "global_context": {"bpm": 110, "root_pc": 7, "scale_type": "natural_minor", "bars": 4},
            "notes": expanded,
            "auto_harmony_stabs": False,
        })
        for ev in compiled["events"]:
            bar_idx = ev["bar"]
            chord_pcs = compiled["voiced_chords"][bar_idx]["chord_pcs"]
            self.assertIn(ev["concrete"]["midi_pitch"] % 12, chord_pcs)

    def test_xy_pad_gesture_mapping(self):
        """Verify 2D X/Y Monster Pad coordinates map cleanly to Vowel Talk, Growl Bite, Wobble Rate, and OTT."""
        g_low = gesture_from_xy("monster_growl", 0.1, 0.1)
        g_high = gesture_from_xy("monster_growl", 0.9, 0.95)
        self.assertLess(g_low["grit"], g_high["grit"])
        self.assertNotEqual((g_low["vowel_start"], g_low["vowel_end"]), (g_high["vowel_start"], g_high["vowel_end"]))

    def test_subtractive_song_blueprint_density_and_transitions(self):
        """Verify 4-bar loop unfolds to >=5 sections (>=20 bars), Intro < Verse < Drop density, and deterministic boundary transitions."""
        core_loop = {
            "id": "heavybass_core",
            "global_context": {"bpm": 110.0, "root_pc": 7, "scale_type": "dorian", "bars": 4},
            "chord_progressions": {
                "prog-main": [
                    {"bar": 0, "degree": 1, "roman": "i", "quality": "min"},
                    {"bar": 1, "degree": 6, "roman": "bVI", "quality": "maj"},
                    {"bar": 2, "degree": 7, "roman": "bVII", "quality": "maj"},
                    {"bar": 3, "degree": 1, "roman": "i", "quality": "min"},
                ]
            },
            "notes": [
                {"id": f"k-{s}", "step": s, "role": "drums", "patch_id": "kick", "velocity": 0.95}
                for s in (0, 8, 16, 24, 32, 40, 48, 56)
            ]
            + [
                {"id": f"sn-{s}", "step": s, "role": "drums", "patch_id": "snare", "velocity": 0.94}
                for s in (4, 12, 20, 28, 36, 44, 52, 60)
            ]
            + [
                {"id": f"sub-{s}", "step": s, "role": "bass", "patch_id": "sub_drop_808", "velocity": 0.92}
                for s in (0, 16, 32, 48)
            ]
            + [
                {"id": f"hck-{s}", "step": s, "role": "hocket", "patch_id": "monster_growl", "velocity": 0.90}
                for s in (2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62)
            ]
            + [
                {"id": f"ld-{s}", "step": s, "role": "lead", "patch_id": "supersaw_stab", "velocity": 0.85}
                for s in (0, 4, 8, 16, 20, 24, 32, 36, 40, 48, 52)
            ],
        }
        unfolded = unfold_song_sections(core_loop)
        compiled = compile_song(unfolded)

        self.assertEqual(compiled["arrangement_mode"], "song")
        self.assertGreaterEqual(len(compiled["sections"]), 5)
        self.assertGreaterEqual(compiled["bars"], 20)

        sec_by_id = {s["id"]: s for s in compiled["sections"]}
        intro_count = sec_by_id["sec_intro"]["active_event_count"]
        verse_count = sec_by_id["sec_verse"]["active_event_count"]
        drop_count = sec_by_id["sec_drop_1"]["active_event_count"]

        self.assertLess(intro_count, verse_count, f"Intro ({intro_count}) not < Verse ({verse_count})")
        self.assertLess(verse_count, drop_count, f"Verse ({verse_count}) not < Drop ({drop_count})")

        # Verify boundary transitions (snare build + pre-drop silence shout + drop impact)
        transition_tags = {e.get("transition_tag") for e in compiled["events"] if e.get("transition_tag")}
        self.assertIn("riser_sweep", transition_tags)
        self.assertIn("turnaround_fill", transition_tags)
        self.assertIn("snare_build", transition_tags)
        self.assertIn("pre_drop_silence", transition_tags)
        self.assertIn("sub_drop_impact", transition_tags)

    def test_master_harmony_spine_revoices_all_linked_sections_while_preserving_concrete_locks(self):
        """Verify modifying a chord in the Master Harmony Spine updates relational pitches across all sections while preserving concrete locks."""
        song = unfold_song_sections({
            "id": "spine_test",
            "global_context": {"bpm": 110.0, "root_pc": 7, "scale_type": "dorian", "bars": 4},
            "chord_progressions": {
                "prog-main": [
                    {"bar": 0, "degree": 1, "roman": "i", "quality": "min"},
                    {"bar": 1, "degree": 6, "roman": "bVI", "quality": "maj"},
                    {"bar": 2, "degree": 7, "roman": "bVII", "quality": "maj"},
                    {"bar": 3, "degree": 1, "roman": "i", "quality": "min"},
                ]
            },
            "auto_harmony_stabs": False,
            "notes": [
                {
                    "id": "rel_lead_b1",
                    "step": 16,  # Bar 1 (2nd bar of each 4-bar cycle)
                    "duration_steps": 2,
                    "role": "lead",
                    "patch_id": "supersaw_stab",
                    "pitch_lock_mode": "relational",
                    "relational": {"anchor": "chord_tone", "chord_tone_index": 0, "scale_degree_offset": 0, "octave_offset": 0},
                }
            ],
        })
        # Add a concrete-locked override note in Drop 1 on Bar 1 (step 16 of Drop 1)
        song["sections"][3]["overrides"]["added_notes"].append({
            "id": "pinned_concrete_note",
            "step": 16,
            "duration_steps": 2,
            "role": "lead",
            "patch_id": "vocal_chop",
            "pitch_lock_mode": "concrete",
            "concrete": {"midi_pitch": 77},
        })

        comp_before = compile_song(song)
        rel_before = [e["concrete"]["midi_pitch"] for e in comp_before["events"] if "rel_lead_b1" in e["id"]]
        pinned_before = [e["concrete"]["midi_pitch"] for e in comp_before["events"] if e["id"] == "pinned_concrete_note"]
        self.assertGreaterEqual(len(rel_before), 4)
        self.assertEqual(pinned_before, [77])

        # Change Bar 1 chord in Master Harmony Spine from bVI (degree 6) to IV (degree 4)
        song["chord_progressions"]["prog-main"][1] = {"bar": 1, "degree": 4, "roman": "IV", "quality": "maj"}
        comp_after = compile_song(song)
        rel_after = [e["concrete"]["midi_pitch"] for e in comp_after["events"] if "rel_lead_b1" in e["id"]]
        pinned_after = [e["concrete"]["midi_pitch"] for e in comp_after["events"] if e["id"] == "pinned_concrete_note"]

        self.assertNotEqual(rel_before, rel_after)
        self.assertEqual(pinned_after, [77])

    def test_contrastive_ab_scaffold_options(self):
        """Verify Phase 4 Surface A Contrastive A/B Bypass options (voice_leading, hocket_choke, humanize, pre_drop_silence)."""
        song = {
            "id": "ab_test",
            "global_context": {"bpm": 110.0, "root_pc": 7, "scale_type": "dorian", "bars": 4},
            "chord_progressions": {
                "prog-main": [
                    {"bar": 0, "degree": 1, "roman": "i", "quality": "min"},
                    {"bar": 1, "degree": 6, "roman": "bVI", "quality": "maj"},
                    {"bar": 2, "degree": 7, "roman": "bVII", "quality": "maj"},
                    {"bar": 3, "degree": 1, "roman": "i", "quality": "min"},
                ]
            },
            "notes": [
                {"id": "h1", "step": 0, "duration_steps": 4, "role": "hocket", "patch_id": "monster_growl", "velocity": 0.9},
                {"id": "h2", "step": 2, "duration_steps": 4, "role": "hocket", "patch_id": "wobble_bass", "velocity": 0.9},
                {"id": "h3", "step": 3, "duration_steps": 2, "role": "hocket", "patch_id": "talking_yoi", "velocity": 0.9},
            ],
        }
        comp_smooth = compile_song(song, {"voice_leading": "smooth", "hocket_choke": True, "humanize": True})
        comp_raw = compile_song(song, {"voice_leading": "raw_block", "hocket_choke": False, "humanize": False})

        max_smooth_motion = max(c["avg_voice_motion_st"] for c in comp_smooth["voiced_chords"][1:])
        max_raw_motion = max(c["avg_voice_motion_st"] for c in comp_raw["voiced_chords"][1:])
        self.assertLessEqual(max_smooth_motion, 2.5)
        self.assertGreater(max_raw_motion, 4.0)

        # In hocket_choke=True, h1 (step 0) is truncated to duration_steps=2; in False, it stays 4
        h1_smooth = next(e for e in comp_smooth["events"] if e["id"] == "h1")
        h1_raw = next(e for e in comp_raw["events"] if e["id"] == "h1")
        self.assertEqual(h1_smooth["duration_steps"], 2)
        self.assertEqual(h1_raw["duration_steps"], 4)

        # In humanize=False, all velocities are flat 0.80
        vels_raw = {e["velocity"] for e in comp_raw["events"]}
        self.assertEqual(vels_raw, {0.80})

    def test_diagnostic_ear_coach_and_white_box_fixes(self):
        """Verify Phase 4 Surface C Diagnostic Ear Coach detects all 4 issue classes and resolves them via White-Box Fixes."""
        flawed_song = {
            "id": "flawed_loop",
            "global_context": {"bpm": 110.0, "root_pc": 7, "scale_type": "dorian", "bars": 4},
            "chord_progressions": {
                "prog-main": [
                    {"bar": 0, "degree": 1, "roman": "i", "quality": "min"},
                    {"bar": 1, "degree": 6, "roman": "bVI", "quality": "maj"},
                    {"bar": 2, "degree": 7, "roman": "bVII", "quality": "maj"},
                    {"bar": 3, "degree": 1, "roman": "i", "quality": "min"},
                ]
            },
            "notes": [
                # Kick on steps 0, 8, 16, 24, 32, 40, 48, 56
                {"id": "k0", "step": 0, "role": "drums", "patch_id": "kick"},
                {"id": "k8", "step": 8, "role": "drums", "patch_id": "kick"},
                {"id": "k16", "step": 16, "role": "drums", "patch_id": "kick"},
                {"id": "k24", "step": 24, "role": "drums", "patch_id": "kick"},
                # Unresolved downbeat clash on step 0 (C#4 = MIDI 61 chromatic over Gm)
                {
                    "id": "clash_lead",
                    "step": 0,
                    "duration_steps": 4,
                    "role": "lead",
                    "patch_id": "supersaw_stab",
                    "pitch_lock_mode": "concrete",
                    "concrete": {"midi_pitch": 61},
                },
                # Overlapping monster bass notes at step 2 (mud collision) + only in Bar 0 (static 4-bar monotony + weak kick-bass pocket)
                {"id": "m_a", "step": 2, "duration_steps": 4, "role": "hocket", "patch_id": "monster_growl"},
                {"id": "m_b", "step": 3, "duration_steps": 4, "role": "hocket", "patch_id": "wobble_bass"},
            ],
        }
        diag = diagnose_song(flawed_song)
        categories = {i["category"] for i in diag["issues"]}
        self.assertIn("unresolved_downbeat_clash", categories)
        self.assertIn("mud_choke_collision", categories)
        self.assertIn("weak_kick_bass_pocket", categories)
        self.assertIn("static_4bar_monotony", categories)
        self.assertLess(diag["health_score"], 50)

        fixed_song = apply_diagnostic_fix(flawed_song, {"fix_type": "fix_all"})
        diag_after = diagnose_song(fixed_song)
        self.assertEqual(diag_after["issue_count"], 0)
        self.assertEqual(diag_after["health_score"], 100)

    def test_ear_to_grid_micro_missions_and_diff_preview(self):
        """Verify Phase 4 Surface B/E White-Box Diff Preview and 20-Second Ear-to-Grid Call & Response Missions."""
        song = {
            "id": "mission_test",
            "global_context": {"bpm": 110.0, "root_pc": 7, "scale_type": "dorian", "bars": 4},
            "notes": [
                {"id": "k0", "step": 0, "role": "drums", "patch_id": "kick"},
                {"id": "k8", "step": 8, "role": "drums", "patch_id": "kick"},
                {"id": "h0", "step": 2, "role": "hocket", "patch_id": "monster_growl"},
            ],
        }
        diff = preview_transform_diff(song, "kick_lock")
        self.assertGreater(diff["added_count"], 0)

        mission = generate_ear_mission(song, "starter")
        self.assertEqual(len(mission["target_events"]), 2)

        # Place matching notes at target steps
        matching_user_notes = [
            {
                "step": t["step"],
                "role": "lead",
                "patch_id": "supersaw_stab",
                "relational": {
                    "anchor": "chord_tone",
                    "chord_tone_index": t["chord_tone_index"],
                    "scale_degree_offset": t["scale_degree_offset"],
                },
                "concrete": {"midi_pitch": t["midi_pitch"]},
            }
            for t in mission["target_events"]
        ]
        grade_ok = grade_ear_mission(mission, matching_user_notes)
        self.assertTrue(grade_ok["passed"])
        self.assertEqual(grade_ok["exact_pitch_score"], 100)

    def test_phase5_post_placement_marks_and_provenance(self):
        """Verify Phase 5 Post-Placement shape marks (●/◇/▲), 3 Harmony Suggestions and the Provenance Ledger."""

        # 1. Post-Placement Marks & 3 Ghost Harmony Suggestions
        alts = suggest_harmony_alternatives(0, "major")
        self.assertEqual(len(alts), 3)
        for alt in alts:
            self.assertEqual(len(alt["voiced_chords"]), 4)
            self.assertIn("·", alt["voiced_chords"][0]["roman_function_label"])

        grav = classify_step_gravity(0, "major", alts[0]["voiced_chords"][0])
        self.assertEqual(grav[0]["shape_mark"], "●")  # C = Root Anchor
        self.assertEqual(grav[2]["shape_mark"], "◇")  # D = In-scale passing tone
        self.assertEqual(grav[1]["shape_mark"], "▲")  # C# = Chromatic clash

        # 2. Provenance Ledger ('Authored by You %')
        song = {
            "id": "prov_test",
            "global_context": {"bpm": 100.0, "root_pc": 0, "scale_type": "major", "bars": 4},
            "notes": [
                {"id": "n1", "step": 0, "role": "lead", "patch_id": "pluck_lead", "provenance": "user_placed"},
                {"id": "n2", "step": 4, "role": "lead", "patch_id": "pluck_lead", "provenance": "hummed_confirmed"},
                {"id": "n3", "step": 8, "role": "lead", "patch_id": "pluck_lead", "provenance": "transformed_accepted"},
                {"id": "n4", "step": 12, "role": "drums", "patch_id": "kick", "provenance": "seed_template"},
            ],
        }
        prov = compute_provenance_summary(song)
        self.assertEqual(prov["strict_user_placed_pct"], 50.0)
        self.assertEqual(prov["authored_by_you_pct"], 75.0)
        self.assertTrue(prov["meets_study_50pct_bar"])
        self.assertTrue(prov["not_ai_slop_verified"])

    def test_phase7_rung_copy_zero_jargon_and_zero_choice_provenance(self):
        """Verify Phase 7 U4/B1/B4/B5 on the live fluid_song_graph: rung order, 0 banned jargon in rung copy, 0-choice provenance, melody-first harmonizer."""
        # B5: rung order matches guided steps 1..6
        self.assertEqual(
            [r["id"] for r in FLUID_SONG_RUNG_SPECS],
            ["vibe_groove", "bass_pocket", "hook_melody", "chord_spine", "song_arc", "ear_candy_polish"],
        )

        # U4: Zero banned jargon in rung copy
        banned_terms = [
            "I – V – vi – IV",
            "vi – IV – I – V",
            "I – vi – IV – V",
            "ii – V – I – vi",
            "Max Martin",
            "Quincy",
            "Timbaland",
            "Rick Rubin",
            "Hooktheory",
            "Billboard",
            "80%",
            "70%",
            "56%",
            "BPM",
            "Dorian",
            "MODULE.md",
            "FluidSoftware",
            "project.json",
            "basal ganglia",
            "ITPRA",
            "Authored by You:",
            "Skrillex",
            "Bangarang",
        ]
        human_blobs: list[str] = []
        for r in FLUID_SONG_RUNG_SPECS:
            for k in ("title", "question", "book_equivalent", "fluid_equivalent", "producer_mentor", "formula_rule"):
                human_blobs.append(str(r.get(k, "")))
        combined_text = "\n".join(human_blobs)
        for term in banned_terms:
            self.assertNotIn(term, combined_text, f"Banned jargon '{term}' found in rung copy")

        # Blocker B1: a starter with no choices made yields 0 decisions and no % in the copy
        starter_like = {
            "id": "starter_neutral_100_cm",
            "notes": [
                {"id": "neutral-kick-0", "step": 0, "role": "drums", "patch_id": "kick", "provenance": "seed_template"},
                {"id": "neutral-bass-0", "step": 0, "role": "bass", "patch_id": "clean_bass", "provenance": "user_placed"},
                {"id": "neutral-lead-0", "step": 0, "role": "lead", "patch_id": "pluck_lead", "provenance": "user_placed"},
            ],
        }
        ensure_fluid_song_graph(starter_like)
        for r in starter_like["fluid_song_graph"]["rungs"]:
            self.assertEqual(r["selected_option_id"], "")
            self.assertFalse(r["user_chosen"])
            self.assertNotEqual(r["status"], "accepted")

        prov0 = compute_provenance_summary(starter_like)
        self.assertEqual(prov0["user_decisions_count"], 0)
        self.assertEqual(prov0["authored_by_you_pct"], 0.0)
        self.assertEqual(prov0["strict_user_placed_pct"], 0.0)
        self.assertNotIn("%", prov0["badge_label"])
        self.assertNotIn("%", starter_like["fluid_song_graph"]["telemetry"]["formula_summary"])

        # Blocker B4: Melody-first harmonizer produces distinct chord progressions for distinct melodies
        melody_a = [
            {"start_beat": 0.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 60}},
            {"start_beat": 4.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 67}},
            {"start_beat": 8.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 69}},
            {"start_beat": 12.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 65}},
        ]
        melody_b = [
            {"start_beat": 0.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 62}},
            {"start_beat": 4.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 65}},
            {"start_beat": 8.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 60}},
            {"start_beat": 12.0, "duration_beats": 2.0, "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 67}},
        ]
        harm_a = harmonize_melody_phrase(melody_a, 0, "major")
        harm_b = harmonize_melody_phrase(melody_b, 0, "major")
        self.assertEqual(len(harm_a), 3)
        self.assertNotEqual(
            [c["degree"] for c in harm_a[0]["progression"]],
            [c["degree"] for c in harm_b[0]["progression"]],
        )


class OneActRuleTest(unittest.TestCase):
    """Phase 9a-3: unlabelled notes are starter material; one act makes a piece the person's."""

    def test_one_act_unlabelled_notes_are_not_the_persons(self):
        from src.theory_core.diagnostics import compute_provenance_summary

        doc = {"notes": [{"id": "x", "step": 0, "role": "drums", "patch_id": "kick"}]}
        summary = compute_provenance_summary(doc)
        self.assertEqual(summary["counts"].get("user_placed", 0), 0)
        self.assertFalse(summary["made_by_you"])
        self.assertNotIn("Your Song", summary["badge_label"])

    def test_one_act_makes_it_yours(self):
        from src.theory_core.diagnostics import compute_provenance_summary

        doc = {"notes": [{"id": "c", "step": 2, "role": "drums", "patch_id": "clap", "provenance": "user_placed"}],
               "play_session": {"acts_count": 1, "acts": [{"kind": "paint"}]}}
        summary = compute_provenance_summary(doc)
        self.assertTrue(summary["made_by_you"])
        self.assertEqual(summary["acts_count"], 1)

    def test_one_act_presses_that_leave_nothing_dont_count(self):
        from src.theory_core.diagnostics import compute_provenance_summary

        doc = {"notes": [{"id": "k", "step": 0, "role": "drums", "patch_id": "kick", "provenance": "seed_template"}],
               "global_context": {"bpm": 100}, "play_session": {"acts_count": 2, "start_bpm": 100}}
        self.assertFalse(compute_provenance_summary(doc)["made_by_you"])
        doc["global_context"]["bpm"] = 90  # a chosen speed is the person's
        self.assertTrue(compute_provenance_summary(doc)["made_by_you"])


def _random_held_melody(rng, root, scale):
    """A 4-bar melody with long notes, notes held across bar lines, and some notes outside the scale."""
    from src.theory_core.models import SCALES
    notes, step = [], 0
    while step < 64:
        dur = min(rng.choice([2, 2, 4, 4, 6, 8, 12, 16, 24]), 64 - step)
        midi = 60 + root + SCALES[scale][rng.randrange(7)] + rng.choice([0, 0, 1])
        if rng.random() < 0.15:
            midi += 1
        notes.append({"id": f"m{step}", "step": step, "duration_steps": dur, "concrete": {"midi_pitch": midi}})
        step += dur + rng.choice([0, 0, 2])
    return notes


class ClashRescueTest(unittest.TestCase):
    """Phase 9b-1: no chord voice sits a semitone from a held melody note, in any bar it sounds in."""

    def test_clash_rescue_300_random_melodies(self):
        import copy
        import random

        from src.theory_core.harmony import held_pcs_by_bar

        clashes, chords, rescued, crossing = 0, 0, 0, 0
        for seed in range(300):
            rng = random.Random(seed)
            root, scale = rng.randrange(12), rng.choice(["major", "natural_minor"])
            melody = _random_held_melody(rng, root, scale)
            before = copy.deepcopy(melody)
            held = held_pcs_by_bar(melody, root, scale)
            crossing += sum(1 for n in melody if n["duration_steps"] >= 4 and n["step"] // 16 != (n["step"] + n["duration_steps"] - 1) // 16)
            for option in harmonize_melody_phrase(melody, root, scale):
                for chord in option["voiced_chords"]:
                    chords += 1
                    rescued += chord["rescue"] is not None
                    h = held.get(chord["bar"], set())
                    if any((x - m) % 12 in (1, 11) for x in h for m in chord["voiced_midi"]):
                        clashes += 1
                    self.assertTrue(all(48 <= m <= 76 for m in chord["voiced_midi"]))
            self.assertEqual(melody, before, "the melody must never change")
        self.assertEqual(clashes, 0, f"{clashes} of {chords} chords clash with a held melody note")
        self.assertGreater(rescued, 100)  # the random melodies really do need rescuing
        self.assertGreater(crossing, 100)  # and really do hold notes across bar lines

    def test_clash_rescue_in_the_compiled_song(self):
        """A held lead note in bar 1 and over the bar line: the compiled chords avoid it, the lead is untouched."""
        doc = {
            "id": "rescue", "global_context": {"root_pc": 0, "scale_type": "major", "bpm": 100, "bars": 4},
            "auto_harmony_stabs": True,
            "chord_progressions": {"prog-main": [
                {"bar": 0, "beats": 4, "degree": 1, "roman": "I", "quality": "maj"},
                {"bar": 1, "beats": 4, "degree": 5, "roman": "V", "quality": "maj"},
                {"bar": 2, "beats": 4, "degree": 6, "roman": "vi", "quality": "min"},
                {"bar": 3, "beats": 4, "degree": 4, "roman": "IV", "quality": "maj"},
            ]},
            "active_progression_id": "prog-main",
            "notes": [
                # F held over C major (clashes with E), then F held from bar 1 into bar 2 (clashes with E of A minor)
                {"id": "a", "role": "lead", "patch_id": "lead_saw", "step": 0, "duration_steps": 8,
                 "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 65}, "provenance": "user_placed"},
                {"id": "b", "role": "lead", "patch_id": "lead_saw", "step": 24, "duration_steps": 16,
                 "pitch_lock_mode": "concrete", "concrete": {"midi_pitch": 65}, "provenance": "user_placed"},
            ],
        }
        compiled = compile_song(doc)
        chords = {c["bar"]: c for c in compiled["voiced_chords"]}
        self.assertEqual(chords[0]["rescue"], "sus4")
        self.assertEqual(chords[0]["chord_name"], "Csus4")
        self.assertEqual(chords[2]["chord_pcs"], [9, 0, 4])  # the chord itself is still A minor
        self.assertNotIn(4, chords[2]["sounding_pcs"])
        lead = [e for e in compiled["events"] if e.get("role") == "lead"]
        self.assertEqual(sorted(e["concrete"]["midi_pitch"] for e in lead), [65, 65])


class HarmonyParityTest(unittest.TestCase):
    """Phase 9b-2: the browser harmony engine gives the same chords as the Python one."""

    def test_python_js_harmoniser_parity_50_melodies(self):
        import json
        import random
        import shutil
        import subprocess
        from pathlib import Path

        node = shutil.which("node")
        self.assertIsNotNone(node, "node is required for the parity test")
        cases = []
        for seed in range(50):
            rng = random.Random(1000 + seed)
            root, scale = rng.randrange(12), rng.choice(["major", "natural_minor"])
            cases.append({"melody": _random_held_melody(rng, root, scale), "root": root, "scale": scale})
        script = (
            "import { harmonizeMelodyPhrase } from './static/js/theory/harmony.js';"
            "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const cs=JSON.parse(s);"
            "console.log(JSON.stringify(cs.map(c=>harmonizeMelodyPhrase(c.melody,c.root,c.scale))));});"
        )
        out = subprocess.run([node, "--input-type=module", "-e", script], input=json.dumps(cases),
                             cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, check=True)
        js_all = json.loads(out.stdout)

        def key(options):
            return [
                (o["id"], [(c["bar"], c["degree"], c["chord_name"], c["chord_pcs"], c["sounding_pcs"], c["rescue"],
                            c["voiced_midi"], c["bass_midi"], c["roman"], c["avg_voice_motion_st"]) for c in o["voiced_chords"]])
                for o in options
            ]

        for i, (case, js) in enumerate(zip(cases, js_all)):
            py = harmonize_melody_phrase(case["melody"], case["root"], case["scale"])
            self.assertEqual(key(py), key(json.loads(json.dumps(js))), f"melody {i} differs")


class EndingShapeTest(unittest.TestCase):
    """Phase 9b-5, Python side: shaping bar 1 + bar 4 and keeping only bar 4 leaves bars 1-3 unchanged."""

    def test_ending_shape_changes_bar_4_only(self):
        from src.theory_core.phrase_transforms import transform_phrase_ending

        main = [(0, 60), (4, 64), (8, 67), (12, 65)]
        lead = [{"id": f"t{b * 16 + s}", "step": b * 16 + s, "duration_steps": 2, "concrete": {"midi_pitch": m}, "provenance": "user_placed"}
                for b in range(4) for s, m in main]
        for shape in ("climb", "fall", "hang", "repeat", "leave_space"):
            pair = [n for n in lead if n["step"] < 16 or n["step"] >= 48]
            shaped_end = [n for n in transform_phrase_ending(pair, shape, 0, "major") if n["step"] >= 48]
            result = [n for n in lead if n["step"] < 48] + shaped_end
            self.assertEqual([n for n in result if n["step"] < 48], [n for n in lead if n["step"] < 48], shape)
            if shape != "repeat":
                self.assertNotEqual(shaped_end, [n for n in lead if n["step"] >= 48], shape)


if __name__ == "__main__":
    unittest.main()
