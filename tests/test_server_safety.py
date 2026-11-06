"""Local-only hardening of the studio server: Host/Origin/Content-Type checks, bad bodies, path traversal."""

from __future__ import annotations

import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path

from src.app_shell import create_studio_server
from src.song_store.store import MAX_SESSION_EVENTS, SongStore


class ServerSafetyTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        # The workspace sits one level down so a traversal escape would land in self.tmp, where we can see it.
        self.workspace = self.tmp / "ws"
        self.server = create_studio_server(host="127.0.0.1", port=0, workspace_dir=self.workspace)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self._tmp.cleanup()

    def _request(self, method: str, path: str, body: bytes | None = None, headers: dict | None = None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        try:
            all_headers = {"Host": f"127.0.0.1:{self.port}"}
            all_headers.update(headers or {})
            conn.request(method, path, body=body, headers=all_headers)
            resp = conn.getresponse()
            return resp.status, resp.read()
        finally:
            conn.close()

    def _post_json(self, path: str, raw: bytes, extra: dict | None = None):
        headers = {"Content-Type": "application/json"}
        headers.update(extra or {})
        return self._request("POST", path, body=raw, headers=headers)

    def test_foreign_host_is_refused(self) -> None:
        status, body = self._request("GET", "/api/patches", headers={"Host": "evil.example"})
        self.assertEqual(status, 403)
        self.assertIn("error", json.loads(body))

    def test_cross_site_origin_post_is_refused(self) -> None:
        status, _ = self._post_json("/api/session-log", b'{"event": "x"}', {"Origin": "http://evil.example"})
        self.assertEqual(status, 403)
        self.assertFalse((self.workspace / "session_log.json").exists())

    def test_same_origin_post_is_accepted(self) -> None:
        status, _ = self._post_json("/api/session-log", b'{"event": "x"}', {"Origin": f"http://127.0.0.1:{self.port}"})
        self.assertEqual(status, 200)

    def test_text_plain_post_is_refused(self) -> None:
        status, _ = self._request("POST", "/api/session-log", body=b'{"event": "x"}', headers={"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        self.assertFalse((self.workspace / "session_log.json").exists())

    def test_sandboxed_null_origin_post_is_refused(self) -> None:
        # A sandboxed iframe on any site sends Origin: null; an empty undo from it once rolled a saved song back.
        status, _ = self._request("POST", "/api/undo", headers={"Origin": "null", "Content-Type": "application/json"})
        self.assertEqual(status, 403)

    def test_empty_post_without_json_type_is_refused(self) -> None:
        status, _ = self._request("POST", "/api/undo")
        self.assertEqual(status, 415)

    def test_origin_on_another_local_port_is_refused(self) -> None:
        other = self.port + 1 if self.port < 65535 else self.port - 1
        status, _ = self._post_json("/api/session-log", b'{"event": "x"}', {"Origin": f"http://127.0.0.1:{other}"})
        self.assertEqual(status, 403)

    def test_song_that_is_not_an_object_is_a_400(self) -> None:
        status, body = self._post_json("/api/compile", b'{"song": "x"}')
        self.assertEqual(status, 400)
        self.assertIn("error", json.loads(body))

    def test_invalid_json_is_a_400_not_a_dropped_connection(self) -> None:
        status, body = self._post_json("/api/compile", b"{not json")
        self.assertEqual(status, 400)
        self.assertIn("error", json.loads(body))

    def test_json_list_body_is_a_400(self) -> None:
        status, _ = self._post_json("/api/compile", b"[1, 2, 3]")
        self.assertEqual(status, 400)

    def test_body_over_5_mb_is_a_413(self) -> None:
        # The server refuses on Content-Length alone, so the full 5 MB never has to be sent.
        status, _ = self._post_json("/api/compile", b"{}", {"Content-Length": str(5 * 1024 * 1024 + 1)})
        self.assertEqual(status, 413)

    def test_preset_reset_cannot_read_files_outside_presets(self) -> None:
        status, body = self._request("GET", "/api/songs/../project?reset=1")
        self.assertEqual(status, 404)
        self.assertNotIn(b"constraints", body)

    def test_unknown_song_id_is_a_404(self) -> None:
        status, _ = self._request("GET", "/api/songs/no_such_song_here")
        self.assertEqual(status, 404)
        status, _ = self._request("GET", "/api/songs/starter_neutral_100_cm")
        self.assertEqual(status, 200)

    def test_render_wav_stays_inside_the_workspace(self) -> None:
        song = {
            "id": "../escaped",
            "global_context": {"bpm": 100.0, "root_pc": 0, "scale_type": "major", "bars": 1},
            "notes": [{"id": "k", "step": 0, "duration_steps": 1, "velocity": 0.9, "role": "drums", "patch_id": "kick"}],
        }
        status, body = self._post_json("/api/render-wav", json.dumps({"song": song}).encode("utf-8"))
        self.assertEqual(status, 400, 'invalid identities must not alias another exported song')
        self.assertFalse(list(self.workspace.glob('*.wav')))
        song['id'] = 'escaped'
        status, body = self._post_json("/api/render-wav", json.dumps({"song": song}).encode("utf-8"))
        self.assertEqual(status, 200)
        payload = json.loads(body)
        name = payload["wav_path"]
        self.assertEqual(name, Path(name).name, "render-wav must return a bare file name, not a server path")
        self.assertEqual(payload["metrics"]["wav_path"], name)
        self.assertTrue((self.workspace / name).is_file())
        self.assertEqual(list(self.tmp.glob("*.wav")), [], "a WAV was written outside the workspace")

    def test_sampled_piano_export_refuses_substitution_and_preserves_existing_file(self):
        song = {'id': 'Piano', 'global_context': {'bpm': 100, 'bars': 1},
                'notes': [{'id': 'held', 'step': 0, 'duration_steps': 2.54, 'role': 'lead',
                           'patch_id': 'sampled_piano_v1', 'pitch_lock_mode': 'concrete',
                           'concrete': {'midi_pitch': 60}, 'provenance': 'user_placed'}]}
        existing = self.workspace / 'Piano.wav'
        existing.write_bytes(b'previous-export')
        status, body = self._post_json('/api/render-wav', json.dumps({'song': song}).encode())
        self.assertEqual(status, 400)
        self.assertIn('browser WAV', json.loads(body)['error'])
        self.assertEqual(existing.read_bytes(), b'previous-export')

    def test_desktop_vendor_route_serves_the_same_local_engine(self):
        status, body = self._request('GET', '/vendor/sampled-piano/engine.js')
        self.assertEqual(status, 200)
        static_status, static_body = self._request('GET', '/static/vendor/sampled-piano/engine.js')
        self.assertEqual(static_status, 200)
        self.assertEqual(body, static_body)

    def test_internal_ids_and_case_aliases_are_refused_without_mutation(self):
        self._post_json('/api/session-log', b'{"event":"keep"}')
        song = {'id': 'SongA', 'global_context': {'bpm': 100, 'bars': 1}, 'notes': []}
        self.assertEqual(self._post_json('/api/songs', json.dumps({'song': song}).encode())[0], 200)
        before = {p.name: p.read_bytes() for p in self.workspace.iterdir()}
        for identity in ['session_log', 'custom_patches', 'SongA_history', 'songa', 'CON']:
            with self.subTest(identity=identity):
                for endpoint in ['/api/songs', '/api/compile', '/api/render-wav']:
                    status, body = self._post_json(endpoint, json.dumps({'song': {**song, 'id': identity}}).encode())
                    self.assertEqual(status, 400)
                    self.assertIn('error', json.loads(body))
                self.assertEqual(self._request('GET', '/api/songs/'+identity)[0], 404)
                self.assertEqual(before, {p.name: p.read_bytes() for p in self.workspace.iterdir()})

    def test_switching_compiled_song_does_not_cross_pollute_undo(self):
        def post(endpoint, song):
            status, body = self._post_json(endpoint, json.dumps({'song': song}).encode())
            self.assertEqual(status, 200)
            return json.loads(body)
        a = {'id': 'a', 'title': 'A', 'global_context': {'bpm': 100, 'bars': 1}, 'notes': []}
        b = {**a, 'id': 'b', 'title': 'B'}
        post('/api/songs', a)
        post('/api/songs', b)
        post('/api/compile', a)
        post('/api/compile', b)
        self.assertEqual(post('/api/undo', b)['song']['id'], 'b')
        edited = {**b, 'title': 'B changed'}
        post('/api/compile', edited)
        self.assertEqual(post('/api/undo', edited)['song']['title'], 'B')
        self.assertEqual(post('/api/redo', b)['song']['title'], 'B changed')
        self.assertEqual(json.loads((self.workspace/'a.json').read_text())['title'], 'A')


class SessionLogCapTest(unittest.TestCase):
    def test_session_log_keeps_only_the_latest_events(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            old = [{"event": "old", "n": i} for i in range(MAX_SESSION_EVENTS)]
            (Path(tmpdir) / "session_log.json").write_text(json.dumps({"events": old}), encoding="utf-8")
            store.append_session_event({"event": "new"})
            events = store.get_session_log()
            self.assertEqual(len(events), MAX_SESSION_EVENTS)
            self.assertEqual(events[-1]["event"], "new")
            self.assertEqual(events[0]["n"], 1)

    def test_unsaved_song_leaves_no_history_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SongStore(workspace_dir=Path(tmpdir))
            store.push_snapshot("never_saved", {"id": "never_saved", "notes": []})
            self.assertFalse((Path(tmpdir) / "never_saved_history.json").exists())
            self.assertIsNotNone(store.undo("never_saved", {"id": "never_saved", "notes": []}))


if __name__ == "__main__":
    unittest.main()
