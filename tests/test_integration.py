"""End-to-end integration tests for studio-ui and app-shell."""

from __future__ import annotations

import json
import hashlib
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.request import Request, urlopen

from src.app_shell import create_studio_server


class TestStudioIntegration(unittest.TestCase):
    def test_runtime_assets_do_not_embed_remote_resource_urls(self) -> None:
        """Check executable/text resources and pin the reviewed vendor exception.

        Actual browser request traces separately verify the exercised offline route.
        Binary instruments must not be decoded as UTF-8 source.
        """
        static_dir = Path("static")
        for asset in static_dir.rglob("*"):
            if asset.is_file() and asset.suffix in {'.js', '.html', '.css', '.svg', '.json', '.webmanifest'}:
                if asset == static_dir / 'vendor/sampled-piano/engine.js':
                    # This exact audited bundle contains documentation URLs. Do not
                    # strip comments with regex: quoted markers can hide real fetches.
                    self.assertEqual(hashlib.sha256(asset.read_bytes()).hexdigest(),
                                     'd91b0d72d61dfe6260ac420746a3a5a123cd813db320698bfc19345169d0c549')
                    continue
                content = asset.read_text(encoding="utf-8")
                if asset.suffix == ".svg":
                    # SVG's standard namespace identifies markup; it is not a fetched resource.
                    # Any external image, script, stylesheet or link URL still fails below.
                    content = content.replace('xmlns="http://www.w3.org/2000/svg"', "")
                self.assertFalse("http://" in content, f"External http:// URL found in {asset}")
                self.assertFalse("https://" in content, f"External https:// URL found in {asset}")

    def test_end_to_end_server_routes_transforms_and_wav_bounce(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            server = create_studio_server(host="127.0.0.1", port=0, workspace_dir=Path(tmpdir))
            port = server.server_address[1]
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{port}"
            try:
                # 1. Index HTML & JS assets
                with urlopen(f"{base_url}/") as resp:
                    self.assertEqual(resp.status, 200)
                    html = resp.read().decode("utf-8")
                    self.assertIn("<title>MusicLab</title>", html)
                    self.assertIn('id="play-flow"', html)

                with urlopen(f"{base_url}/static/ui/app.js") as resp:
                    self.assertEqual(resp.status, 200)
                    self.assertIn("LookaheadScheduler", resp.read().decode("utf-8"))

                # 2. Patch catalog
                with urlopen(f"{base_url}/api/patches") as resp:
                    patches_data = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(len(patches_data["patches"]), 7)
                    self.assertEqual(len(patches_data["gesture_badges"]), 5)

                # 3. Load starter Heavy Bass song
                with urlopen(f"{base_url}/api/songs/heavy_bass_110") as resp:
                    song_bundle = json.loads(resp.read().decode("utf-8"))
                    song_doc = song_bundle["song"]
                    compiled = song_bundle["compiled"]
                    self.assertEqual(compiled["bpm"], 110.0)
                    self.assertEqual(compiled["total_steps"], 64)

                # 4. Apply Hocket Call & Response transform
                req_transform = Request(
                    f"{base_url}/api/hocket-transform",
                    data=json.dumps({"song": song_doc, "action": "hocket_call_response"}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_transform) as resp:
                    transformed = json.loads(resp.read().decode("utf-8"))
                    self.assertGreaterEqual(len(transformed["compiled"]["events"]), 30)

                # 5. Undo & Redo
                req_undo = Request(
                    f"{base_url}/api/undo",
                    data=json.dumps({"song": transformed["song"]}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_undo) as resp:
                    undone = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(len(undone["song"]["notes"]), len(song_doc["notes"]))

                # 6. Render WAV via POST /api/render-wav
                req_wav = Request(
                    f"{base_url}/api/render-wav",
                    data=json.dumps({"song": song_doc}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_wav) as resp:
                    wav_data = json.loads(resp.read().decode("utf-8"))
                    metrics = wav_data["metrics"]
                    self.assertEqual(wav_data["wav_path"], Path(wav_data["wav_path"]).name)
                    self.assertTrue((Path(tmpdir) / wav_data["wav_path"]).exists())
                    self.assertGreaterEqual(metrics["peak_dbfs"], -6.0)
                    self.assertLessEqual(metrics["peak_dbfs"], -3.0 + 0.01)
                    self.assertEqual(metrics["clipped_samples"], 0)

                # 7. Unfold 4-Bar Loop into 28-Bar Song Arrangement via POST /api/arrange (Phase 2)
                req_arr = Request(
                    f"{base_url}/api/arrange",
                    data=json.dumps({"song": song_doc, "action": "unfold_song"}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_arr) as resp:
                    arr_data = json.loads(resp.read().decode("utf-8"))
                    arr_comp = arr_data["compiled"]
                    self.assertEqual(arr_comp["arrangement_mode"], "song")
                    self.assertEqual(arr_comp["bars"], 28)
                    self.assertEqual(arr_comp["total_steps"], 448)
                    self.assertEqual(len(arr_comp["sections"]), 7)
                    sec_map = {s["id"]: s for s in arr_comp["sections"]}
                    self.assertLess(
                        sec_map["sec_intro"]["active_event_count"],
                        sec_map["sec_verse"]["active_event_count"],
                    )
                    self.assertLess(
                        sec_map["sec_verse"]["active_event_count"],
                        sec_map["sec_drop_1"]["active_event_count"],
                    )

                # 8. Custom Sculpted Patches API & X-Ray asset (Phase 3)
                with urlopen(f"{base_url}/static/ui/xray.js") as resp:
                    self.assertEqual(resp.status, 200)
                    self.assertIn("drawMacroXRayCanvas", resp.read().decode("utf-8"))

                req_cp = Request(
                    f"{base_url}/api/custom-patches",
                    data=json.dumps({
                        "name": "Heavy Bass Yoi Scream",
                        "patch_id": "talking_yoi",
                        "gesture": {"vowel_start": "O", "vowel_end": "I", "grit": 0.91},
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(f"{base_url}/api/custom-patches", data=req_cp.data) if False else urlopen(req_cp) as resp:
                    cp_res = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(len(cp_res["custom_patches"]), 1)
                    self.assertEqual(cp_res["custom_patches"][0]["name"], "Heavy Bass Yoi Scream")

                # 9. Phase 4 ("Photoshop for Music"): Flawed Beginner Demo, Diagnostic Ear Coach, Contrastive A/B & Ear Missions
                with urlopen(f"{base_url}/api/songs/flawed_beginner_loop?reset=1") as resp:
                    flawed_bundle = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(flawed_bundle["diagnostics"]["issue_count"], 4)
                    self.assertLess(flawed_bundle["diagnostics"]["health_score"], 50)

                req_preview = Request(
                    f"{base_url}/api/diagnose",
                    data=json.dumps({
                        "song": flawed_bundle["song"],
                        "action": "preview_diff",
                        "target_action": "kick_lock",
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_preview) as resp:
                    preview_res = json.loads(resp.read().decode("utf-8"))
                    self.assertGreater(len(preview_res["diff"]["added_notes"]), 0)

                req_ab = Request(
                    f"{base_url}/api/compile",
                    data=json.dumps({
                        "song": flawed_bundle["song"],
                        "scaffold_options": {
                            "voice_leading": "raw_block",
                            "hocket_choke": False,
                            "humanize": False,
                            "pre_drop_silence": False,
                        },
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_ab) as resp:
                    ab_bundle = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(ab_bundle["compiled"]["scaffold_options"]["voice_leading"], "raw_block")
                    self.assertFalse(ab_bundle["compiled"]["scaffold_options"]["hocket_choke"])

                req_fix = Request(
                    f"{base_url}/api/diagnose",
                    data=json.dumps({
                        "song": flawed_bundle["song"],
                        "action": "apply_fix",
                        "fix": {"fix_type": "fix_all"},
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_fix) as resp:
                    fixed_bundle = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(fixed_bundle["diagnostics"]["issue_count"], 0)
                    self.assertEqual(fixed_bundle["diagnostics"]["health_score"], 100)

                req_mission = Request(
                    f"{base_url}/api/ear-mission",
                    data=json.dumps({"song": song_doc, "action": "generate", "difficulty": "starter"}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_mission) as resp:
                    mission_res = json.loads(resp.read().decode("utf-8"))
                    mission = mission_res["mission"]
                    self.assertEqual(len(mission["target_events"]), 2)

                req_grade = Request(
                    f"{base_url}/api/ear-mission",
                    data=json.dumps({
                        "song": song_doc,
                        "action": "grade",
                        "mission": mission,
                        "user_notes": [
                            {
                                "step": t["step"],
                                "role": "lead",
                                "relational": {
                                    "chord_tone_index": t["chord_tone_index"],
                                    "scale_degree_offset": t["scale_degree_offset"],
                                },
                                "concrete": {"midi_pitch": t["midi_pitch"]},
                            }
                            for t in mission["target_events"]
                        ],
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_grade) as resp:
                    grade_res = json.loads(resp.read().decode("utf-8"))
                    self.assertTrue(grade_res["grade"]["passed"])
                    self.assertEqual(grade_res["grade"]["exact_pitch_score"], 100)

                # 10. Phase 5 (MusicLab Empirical Upgrade): Neutral Starter, Provenance & Harmony Options
                with urlopen(f"{base_url}/static/ui/standalone_compiler.js") as resp:
                    self.assertEqual(resp.status, 200)
                    self.assertIn("compileSongStandalone", resp.read().decode("utf-8"))

                with urlopen(f"{base_url}/api/songs/starter_neutral_100_cm?reset=1") as resp:
                    neutral_bundle = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(neutral_bundle["compiled"]["bpm"], 100.0)
                    self.assertEqual(neutral_bundle["compiled"]["scale_type"], "major")
                    self.assertEqual(neutral_bundle["compiled"]["bars"], 28)
                    self.assertEqual(neutral_bundle["compiled"]["total_steps"], 448)
                    self.assertIn("provenance", neutral_bundle)
                    self.assertTrue(neutral_bundle["provenance"]["not_ai_slop_verified"])
                    self.assertEqual(neutral_bundle["provenance"]["ai_audio_generated_pct"], 0.0)

                req_harm = Request(
                    f"{base_url}/api/harmony-options",
                    data=json.dumps({"root_pc": 0, "scale_type": "major"}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_harm) as resp:
                    harm_res = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(len(harm_res["options"]), 3)

                # 12. Phase 7 (On-Screen Jargon Audit, Relative Static Routes, Option Cap & Session Log)
                # Verify relative static asset routes work identically at root and /static/
                for rel_route in ("/css/studio.css", "/ui/app.js", "/js/audio/scheduler.js"):
                    with urlopen(f"{base_url}{rel_route}") as r_rel:
                        self.assertEqual(r_rel.status, 200)

                # Verify /api/session-log POST and GET
                req_log = Request(
                    f"{base_url}/api/session-log",
                    data=json.dumps({"event": "blind_ear_probe", "picked": "B", "correct": True}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req_log) as resp_log:
                    log_data = json.loads(resp_log.read().decode("utf-8"))
                    self.assertGreaterEqual(log_data["count"], 1)
                with urlopen(f"{base_url}/api/session-log") as resp_get_log:
                    events_list = json.loads(resp_get_log.read().decode("utf-8"))["events"]
                    self.assertTrue(any(e.get("event") == "blind_ear_probe" for e in events_list))

                with urlopen(f"{base_url}/") as resp_idx:
                    idx_html = resp_idx.read().decode("utf-8")
                    self.assertNotIn("Authored by You:", idx_html)
                    self.assertIn('id="studio-tools-drawer" class="studio-tools-drawer" style="display:none;"', idx_html)
                    self.assertIn('id="advanced-studio-container" style="display:none;"', idx_html)
                    self.assertIn('id="tab-falsification-btn" class="coach-tab" data-coach-tab="falsification" style="display:none;"', idx_html)

                # On-screen jargon & trademark check across index.html, app.js and standalone_compiler.js
                app_js_text = Path("static/ui/app.js").read_text(encoding="utf-8")
                comp_js_text = Path("static/ui/standalone_compiler.js").read_text(encoding="utf-8")
                banned_terms = [
                    "Skrillex",
                    "Bangarang",
                    "Bregman",
                    "Baker 2004",
                    "5-Novice Falsification",
                    "I – V – vi – IV",
                    "Max Martin",
                    "Quincy",
                    "Timbaland",
                    "Rick Rubin",
                    "Hooktheory",
                ]
                for term in banned_terms:
                    self.assertNotIn(term, idx_html, f"Banned term '{term}' found in static/index.html")
                    self.assertNotIn(term, app_js_text, f"Banned term '{term}' found in static/ui/app.js")
                    self.assertNotIn(term, comp_js_text, f"Banned term '{term}' found in static/ui/standalone_compiler.js")

            finally:
                server.shutdown()
                server.server_close()


class KeepBeatOnlyTest(unittest.TestCase):
    """Phase 9a-8: a piece kept after only a beat exports drums only (no chords nobody chose), 4 bars long."""

    def test_keep_beat_only(self):
        from src.audio_engine.synth import render_compiled_song_to_pcm
        from src.theory_core import compile_song

        notes = []
        for bar in range(4):
            for s, patch in ((0, "kick"), (8, "kick"), (4, "clap"), (12, "clap")):
                notes.append({"id": f"d-{patch}-{bar * 16 + s}", "step": bar * 16 + s, "duration_steps": 1, "velocity": 0.9,
                              "role": "drums", "patch_id": patch, "provenance": "user_placed" if patch == "clap" else "seed_template",
                              "concrete": {"midi_pitch": 36 if patch == "kick" else 39}})
        doc = {"id": "song-test", "global_context": {"bpm": 100, "swing": 0.5, "root_pc": 0, "scale_type": "major", "bars": 4},
               "notes": notes, "auto_harmony_stabs": False, "arrangement_mode": "loop"}
        compiled = compile_song(doc)
        self.assertEqual({e["role"] for e in compiled["events"]}, {"drums"})
        left, _right, _m = render_compiled_song_to_pcm(compiled, sample_rate=11025)
        seconds = len(left) / 11025
        self.assertAlmostEqual(seconds, 4 * 4 * 60 / 100 + 2.0, delta=1 / 11025)  # four bars plus shared render tail


def _find_all(text: str, sub: str) -> list[int]:
    out, k = [], text.find(sub)
    while k >= 0:
        out.append(k)
        k = text.find(sub, k + 1)
    return out


class NoArtistNamesTest(unittest.TestCase):
    """Phase 9b-7: no artist or track names in anything a person sees or downloads.
    Internal ids that are never shown are allowed (listed here)."""

    ALLOWED = ("heavy_bass_110", "heavybass-", "build_heavy_bass_starter_song")

    def _strip(self, text: str) -> str:
        for token in self.ALLOWED:
            text = text.replace(token, "")
        return text

    def test_no_artist_names_in_user_facing_strings(self):
        import re

        root = Path(__file__).resolve().parents[1]
        pattern = re.compile(r"skrillex|bangarang", re.IGNORECASE)
        files = [root / "static" / "index.html", *sorted((root / "static" / "ui").rglob("*.js")), *sorted((root / "static" / "js").rglob("*.js"))]
        # The rendered-page audit must name the words it looks for; it shows nothing to anyone.
        checker = root / "static" / "ui" / "page_audit.js"
        hits = []
        for f in files:
            if f == checker:
                continue
            for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                if pattern.search(self._strip(line)):
                    hits.append(f"{f.relative_to(root)}:{i}")
        self.assertEqual(hits, [])

    def test_download_names_never_come_from_song_ids(self):
        """Ids are allowed above only because they are never shown; a download named from an id would show one.
        Any line that names a download (any file type) must not use an `.id` (plain string checks, no regex)."""
        root = Path(__file__).resolve().parents[1]
        hits = []
        for f in sorted((root / "static").rglob("*.js")):
            for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                names_a_download = "triggerBlobDownload(" in line or ".download =" in line
                uses_an_id = any(line[k + 3 : k + 4] in ("", " ", "}", ")", "|", "?", "`", ",", ";") for k in _find_all(line, ".id"))
                if names_a_download and uses_an_id:
                    hits.append(f"{f.relative_to(root)}:{i}")
        self.assertEqual(hits, [])

    def test_no_artist_names_in_preset_titles_sections_or_default_names(self):
        import re

        from src.theory_core import compile_song

        root = Path(__file__).resolve().parents[1]
        pattern = re.compile(r"skrillex|bangarang", re.IGNORECASE)
        for f in sorted((root / "presets").glob("*.json")):
            data = json.loads(f.read_text(encoding="utf-8"))
            shown = [str(data.get("title", ""))] + [str(s.get("name", "")) for s in data.get("sections") or []]
            self.assertFalse(any(pattern.search(s) for s in shown), f"{f.name}: {shown}")
        compiled = compile_song({"notes": []})
        self.assertFalse(pattern.search(compiled["title"]) or pattern.search(compiled["song_id"]))


if __name__ == "__main__":
    unittest.main()
