"""Unit tests for song-store module."""

from __future__ import annotations

import tempfile
import unittest
import copy
import json
from unittest.mock import patch
from pathlib import Path

from src.song_store import SongStore, build_heavy_bass_starter_song, load_patch_catalog
from src.theory_core import compile_song, diagnose_song
from src.song_store.store import write_json_atomic


class TestSongIdentity(unittest.TestCase):
    def test_reserved_and_alias_ids_do_not_change_any_existing_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            store = SongStore(workspace_dir=Path(folder))
            store.append_session_event({'event': 'retained'})
            write_json_atomic(Path(folder)/'custom_patches.json', {'custom_patches': [{'custom_id': 'mine'}]})
            original = {'id': 'MySong', 'notes': [{'id': 'held', 'duration_steps': 3.7}]}
            store.save_song(original)
            store.push_snapshot('MySong', original)
            before = {p.name: p.read_bytes() for p in Path(folder).iterdir()}
            for identity in ['session_log', 'SESSION_LOG', 'custom_patches', 'MySong_history',
                             'NUL', 'COM1', 'LPT²', '../MySong', 'My Song', 'x'*121, 'mysong']:
                with self.subTest(identity=identity), self.assertRaises(ValueError):
                    store.save_song({'id': identity, 'notes': []})
                self.assertEqual(before, {p.name: p.read_bytes() for p in Path(folder).iterdir()})
            reopened = SongStore(workspace_dir=Path(folder))
            self.assertEqual(reopened.load_song('MySong'), original)
            with self.assertRaises(ValueError):
                reopened.load_song('mysong')
            unicode_song = {'id': 'Chanson_été', 'notes': []}
            reopened.save_song(unicode_song)
            self.assertEqual(reopened.load_song('Chanson_été'), unicode_song)

    def test_snapshot_and_legacy_history_cannot_restore_a_different_song(self):
        with tempfile.TemporaryDirectory() as folder:
            store = SongStore(workspace_dir=Path(folder))
            a, b = {'id': 'a', 'notes': [{'id': 'a-note'}]}, {'id': 'b', 'notes': [{'id': 'b-note'}]}
            store.save_song(a); store.save_song(b)
            with self.assertRaises(ValueError):
                store.push_snapshot('b', a)
            write_json_atomic(Path(folder)/'b_history.json', {'undo': [a], 'redo': [a]})
            store = SongStore(workspace_dir=Path(folder))
            before = {p.name: p.read_bytes() for p in Path(folder).iterdir()}
            for action in [store.undo, store.redo]:
                with self.assertRaises(ValueError):
                    action('b', b)
                self.assertEqual(before, {p.name: p.read_bytes() for p in Path(folder).iterdir()})


class TestAtomicPersistence(unittest.TestCase):
    def test_failures_leave_previous_file_complete(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "song.json"
            write_json_atomic(target, {"notes": [{"id": "personal", "duration_steps": 3.7}]})
            before = target.read_bytes()
            for function in ("os.fsync", "os.replace"):
                with self.subTest(function=function):
                    with patch("src.song_store.store." + function, side_effect=OSError("injected")):
                        with self.assertRaises(OSError):
                            write_json_atomic(target, {"notes": []})
                    self.assertEqual(target.read_bytes(), before)
                    self.assertEqual(list(Path(folder).glob("*.tmp")), [])
            with self.assertRaises(TypeError):
                write_json_atomic(target, {"bad": object()})
            self.assertEqual(target.read_bytes(), before)

    def test_all_four_writers_preserve_disk_on_replace_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            store = SongStore(Path(folder))
            song = {"id": "atomic", "notes": [{"id": "own", "provenance": "user_placed"}]}
            store.save_song(song)
            store.push_snapshot("atomic", song)
            store.append_session_event({"action": "before"})
            store.save_custom_patch({"custom_id": "own", "name": "Before"})
            operations = [
                ("atomic.json", lambda: store.save_song({**song, "notes": []}, record_history=False), False),
                ("atomic_history.json", lambda: store.push_snapshot("atomic", {**song, "notes": []}), True),
                ("session_log.json", lambda: store.append_session_event({"action": "after"}), False),
                ("custom_patches.json", lambda: store.save_custom_patch({"custom_id": "own", "name": "After"}), False),
            ]
            for name, operation, swallowed in operations:
                with self.subTest(name=name):
                    before = (Path(folder) / name).read_bytes()
                    with patch("src.song_store.store.os.replace", side_effect=OSError("injected")):
                        if swallowed:
                            with self.assertLogs("src.song_store.store", level="WARNING"):
                                operation()
                        else:
                            with self.assertRaises(OSError):
                                operation()
                    self.assertEqual((Path(folder) / name).read_bytes(), before)
                    json.loads(before)
                    self.assertEqual(list(Path(folder).glob("*.tmp")), [])

    def test_reopen_continue_matches_uninterrupted_with_history(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            stores = [SongStore(Path(first)), SongStore(Path(second))]
            original = build_heavy_bass_starter_song()
            for store in stores:
                store.save_song(copy.deepcopy(original))
                edited = store.load_song(original["id"])
                edited["notes"][0]["duration_steps"] = 2.375
                edited["notes"][0]["provenance"] = "user_placed"
                store.save_song(edited)
            stores[1] = SongStore(Path(second))
            results = []
            for store in stores:
                current = store.load_song(original["id"])
                undone = store.undo(original["id"], current)
                self.assertEqual(undone, original)
                redone = store.redo(original["id"], undone)
                self.assertEqual(redone, current)
                results.append((redone, compile_song(redone)))
            self.assertEqual(results[0], results[1])


class TestSongStore(unittest.TestCase):
    def test_patch_catalog_contains_7_heavybass_patches_and_5_badges(self) -> None:
        catalog = load_patch_catalog()
        patches = catalog.get("patches", [])
        badges = catalog.get("gesture_badges", [])
        self.assertEqual(len(patches), 7)
        patch_ids = {p["patch_id"] for p in patches}
        self.assertEqual(
            patch_ids,
            {
                "supersaw_stab",
                "monster_growl",
                "talking_yoi",
                "wobble_bass",
                "sub_drop_808",
                "laser_screech",
                "vocal_chop",
            },
        )
        self.assertEqual(len(badges), 5)

    def test_heavybass_preset_loads_and_compiles_cleanly(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            song = store.load_preset_song("heavy_bass_110")
            ctx = song["global_context"]
            self.assertEqual(ctx["bpm"], 110.0)
            self.assertEqual(ctx["root_pc"], 7)
            self.assertEqual(ctx["scale_type"], "dorian")
            self.assertEqual(len(song["chord_progressions"]["prog-main"]), 4)
            self.assertGreaterEqual(len(song["notes"]), 35)

            compiled = compile_song(song)
            self.assertEqual(compiled["total_steps"], 64)
            self.assertEqual(len(compiled["gravity_by_step"]), 64)
            self.assertGreaterEqual(len(compiled["events"]), 35)

    def test_save_load_roundtrip_and_undo_redo_snapshots(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            song = build_heavy_bass_starter_song()
            initial_note_count = len(song["notes"])

            # Save v1
            saved_path = store.save_song(song)
            self.assertTrue(saved_path.exists())

            # Modify song (remove last note) and save v2
            song_v2 = store.load_song(song["id"])
            song_v2["notes"].pop()
            song_v2["title"] = "Modified Showcase"
            store.save_song(song_v2)

            loaded_v2 = store.load_song(song["id"])
            self.assertEqual(len(loaded_v2["notes"]), initial_note_count - 1)
            self.assertEqual(loaded_v2["title"], "Modified Showcase")

            # Undo back to v1
            restored_v1 = store.undo(song["id"], loaded_v2)
            self.assertIsNotNone(restored_v1)
            assert restored_v1 is not None
            self.assertEqual(len(restored_v1["notes"]), initial_note_count)
            self.assertEqual(restored_v1["title"], "Heavy Bass Showcase (110 BPM G Dorian)")

            # Redo forward to v2
            restored_v2 = store.redo(song["id"], restored_v1)
            self.assertIsNotNone(restored_v2)
            assert restored_v2 is not None
            self.assertEqual(len(restored_v2["notes"]), initial_note_count - 1)
            self.assertEqual(restored_v2["title"], "Modified Showcase")

    def test_multi_section_blueprint_and_overrides_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            song = store.load_preset_song("heavy_bass_110")
            self.assertGreaterEqual(len(song.get("sections", [])), 7)
            song["arrangement_mode"] = "song"
            song["sections"][3]["overrides"]["added_notes"].append({
                "id": "custom_drop_laser",
                "step": 2,
                "duration_steps": 2,
                "role": "hocket",
                "patch_id": "laser_screech",
                "pitch_lock_mode": "concrete",
                "concrete": {"midi_pitch": 79},
                "gesture": {"preset_id": "laser_drop"},
            })
            store.save_song(song)
            reloaded = store.load_song(song["id"])
            self.assertEqual(reloaded["arrangement_mode"], "song")
            self.assertEqual(
                reloaded["sections"][3]["overrides"]["added_notes"][0]["id"],
                "custom_drop_laser",
            )
            compiled = compile_song(reloaded)
            self.assertEqual(compiled["bars"], 28)
            self.assertEqual(compiled["total_steps"], 448)

    def test_custom_patch_library_persistence(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            saved = store.save_custom_patch({
                "custom_id": "my_banger_growl",
                "name": "My Metallic Yoi Growl",
                "patch_id": "monster_growl",
                "gesture": {"vowel_start": "O", "vowel_end": "I", "grit": 0.94, "ott_punch": 0.92},
            })
            self.assertEqual(saved["custom_id"], "my_banger_growl")
            listed = store.list_custom_patches()
            self.assertEqual(len(listed), 1)
            self.assertEqual(listed[0]["name"], "My Metallic Yoi Growl")
            self.assertAlmostEqual(listed[0]["gesture"]["grit"], 0.94)

    def test_diagnostic_flawed_seed_loads_and_triggers_ear_coach(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            flawed = store.load_preset_song("flawed_beginner_loop")
            report = diagnose_song(flawed)
            self.assertGreaterEqual(report["issue_count"], 3)

    def test_genre_neutral_starter_seed_loads_and_compiles_cleanly(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            neutral = store.load_preset_song("starter_neutral_100_cm")
            self.assertEqual(neutral["id"], "starter_neutral_100_cm")
            self.assertEqual(neutral["global_context"]["bpm"], 100.0)
            self.assertEqual(neutral["global_context"]["root_pc"], 0)
            self.assertEqual(neutral["global_context"]["scale_type"], "major")
            self.assertEqual(neutral["arrangement_mode"], "song")
            compiled = compile_song(neutral)
            # Default starter is a complete 28-bar multi-section song (448 steps), never a 9.8s 4-bar loop (Blocker B2)
            self.assertEqual(compiled["bars"], 28)
            self.assertEqual(compiled["total_steps"], 448)
            self.assertEqual(compiled["scaffold_options"]["harmony_display_mode"], "post_placement")

    def test_persistent_undo_across_restarts_and_session_log(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            ws = Path(tmpdir)
            store1 = SongStore(workspace_dir=ws)
            song = store1.load_preset_song("starter_neutral_100_cm")
            song["title"] = "Original Song Name"
            store1.save_song(song)

            song_v2 = store1.load_song("starter_neutral_100_cm")
            song_v2["title"] = "Second Song Name"
            store1.save_song(song_v2)

            # Simulate server restart by instantiating a brand-new SongStore on the same directory
            store2 = SongStore(workspace_dir=ws)
            restored = store2.undo("starter_neutral_100_cm", song_v2)
            self.assertIsNotNone(restored)
            assert restored is not None
            self.assertEqual(restored["title"], "Original Song Name")

            # Verify session_log.json persistence (Blocker B7)
            store2.append_session_event({"event": "load", "ts_ms": 1000})
            store2.append_session_event({"event": "first_audio", "ts_ms": 4200, "delta_ms": 3200})
            events = store2.get_session_log()
            self.assertEqual(len(events), 2)
            self.assertEqual(events[1]["event"], "first_audio")


if __name__ == "__main__":
    unittest.main()
