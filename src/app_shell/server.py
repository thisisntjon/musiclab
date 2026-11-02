"""Local 127.0.0.1 HTTP server and REST API for MusicLab Studio."""

from __future__ import annotations

import copy
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlparse

from src.audio_engine import render_compiled_song_to_wav
from src.song_store.store import SongStore, safe_song_id
from src.theory_core import (
    apply_diagnostic_fix,
    compile_song,
    compute_provenance_summary,
    diagnose_song,
    ensure_fluid_song_graph,
    generate_ear_mission,
    grade_ear_mission,
    lock_bass_to_kick,
    preview_transform_diff,
    suggest_harmony_alternatives,
    transform_call_response,
    unfold_song_sections,
    voice_chord_progression,
)

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = ROOT_DIR / "static"
# Local only: requests must name a loopback host, and posts must come from this app's own pages as JSON.
LOOPBACK_HOSTS = ("127.0.0.1", "localhost", "[::1]", "::1")
MAX_BODY_BYTES = 5 * 1024 * 1024


class BadRequest(Exception):
    """A request this local server refuses (wrong host or origin, bad or oversized body)."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


def _host_name(value: str) -> str:
    value = (value or "").strip().lower()
    if value.startswith("["):
        return value.split("]", 1)[0] + "]"
    return value.rsplit(":", 1)[0] if value.count(":") == 1 else value


def _inside(base: Path, target: Path) -> bool:
    try:
        return target.resolve().is_relative_to(base.resolve())
    except (OSError, ValueError):
        return False


class MusicLabStudioState:
    """Shared server state holding the SongStore and active in-memory song snapshot."""

    def __init__(self, workspace_dir: Optional[Path] = None) -> None:
        self.store = SongStore(workspace_dir=workspace_dir) if workspace_dir else SongStore()
        self.last_compiled_doc: Dict[str, Any] = self.store.load_preset_song("starter_neutral_100_cm")


def apply_studio_transform(song_doc: Dict[str, Any], action: str) -> Dict[str, Any]:
    """Apply a white-box Kick-Lock or Call-and-Response transform to song_doc."""
    updated = copy.deepcopy(song_doc)
    ctx = updated.get("global_context") or {}
    root_pc = int(ctx.get("root_pc", 7))
    scale_type = str(ctx.get("scale_type", "dorian"))
    bars = int(ctx.get("bars", 4))
    prog_id = updated.get("active_progression_id", "prog-main")
    raw_prog = (updated.get("chord_progressions") or {}).get(prog_id) or []
    voiced_chords = voice_chord_progression(root_pc, scale_type, raw_prog)

    notes = updated.get("notes") or []
    drum_notes = [n for n in notes if n.get("role") == "drums"]
    hocket_notes = [n for n in notes if n.get("role") in ("hocket", "bass")]
    lead_notes = [n for n in notes if n.get("role") == "lead"]
    other_notes = [
        n for n in notes if n.get("role") not in ("drums", "hocket", "bass", "lead")
    ]

    if action == "kick_lock":
        new_hocket = lock_bass_to_kick(hocket_notes, drum_notes, steps_per_bar=16, bars=bars)
        updated["notes"] = drum_notes + new_hocket + lead_notes + other_notes
    elif action == "hocket_call_response":
        bar1_hocket = [n for n in hocket_notes if 0 <= int(n.get("step", 0)) < 16]
        if bar1_hocket:
            new_hocket = transform_call_response(
                bar1_hocket, voiced_chords, root_pc, scale_type, steps_per_bar=16
            )
            updated["notes"] = drum_notes + new_hocket + lead_notes + other_notes
    elif action == "lead_call_response":
        bar1_lead = [n for n in lead_notes if 0 <= int(n.get("step", 0)) < 16]
        if bar1_lead:
            new_lead = transform_call_response(
                bar1_lead, voiced_chords, root_pc, scale_type, steps_per_bar=16
            )
            updated["notes"] = drum_notes + hocket_notes + new_lead + other_notes

    return updated


def create_request_handler(state: MusicLabStudioState):
    """Create a BaseHTTPRequestHandler bound to the provided MusicLabStudioState."""

    class StudioRequestHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            # Keep test/CLI output clean
            return

        def _send_json(self, payload: Any, status: int = 200) -> None:
            raw = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)

        def _check_local(self, is_post: bool) -> None:
            """Refuse anything that is not this app talking to itself (DNS rebinding, cross-site posts)."""
            if _host_name(self.headers.get("Host", "")) not in LOOPBACK_HOSTS:
                raise BadRequest("This app only answers on this computer.", status=403)
            # Same origin means the same host AND port as this server; "null" (sandboxed pages, files) is refused for posts.
            origin = self.headers.get("Origin")
            if origin is not None:
                if origin == "null":
                    if is_post:
                        raise BadRequest("This app only answers its own pages.", status=403)
                elif urlparse(origin).netloc.lower() != (self.headers.get("Host") or "").strip().lower():
                    raise BadRequest("This app only answers its own pages.", status=403)
            if is_post:
                # Every post must say it is JSON, even an empty one: a plain form or text post from another site
                # cannot set this header without the browser asking this server first.
                ctype = (self.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
                if ctype != "application/json":
                    raise BadRequest("Send JSON.", status=415)

        def _discard_body(self) -> None:
            """Read and drop an unread request body before refusing, so the client is not reset mid-send."""
            if self._body_read:
                return
            self._body_read = True
            try:
                length = int(self.headers.get("Content-Length", "0") or 0)
            except ValueError:
                return
            if 0 < length <= MAX_BODY_BYTES:
                self.rfile.read(length)
            elif length > MAX_BODY_BYTES:
                self.close_connection = True  # too big to drain: answer, then close

        def _read_json_body(self) -> Dict[str, Any]:
            try:
                length = int(self.headers.get("Content-Length", "0") or 0)
            except ValueError as exc:
                raise BadRequest("Bad length.") from exc
            if length <= 0:
                return {}
            if length > MAX_BODY_BYTES:
                raise BadRequest("Too big.", status=413)
            raw = self.rfile.read(length)
            self._body_read = True
            try:
                body = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise BadRequest("Bad JSON.") from exc
            if not isinstance(body, dict):
                raise BadRequest("Send a JSON object.")
            return body

        def do_GET(self) -> None:
            self._guarded(self._handle_get, is_post=False)

        def do_POST(self) -> None:
            self._guarded(self._handle_post, is_post=True)

        def _guarded(self, handler, is_post: bool) -> None:
            self._body_read = False
            try:
                self._check_local(is_post)
                # API handlers share the current compiled document and undo state.
                # Hold the store's reentrant lock through each API transaction.
                if urlparse(self.path).path.startswith('/api/'):
                    with state.store.lock:
                        handler()
                else:
                    handler()
            except BadRequest as exc:
                self._discard_body()
                self._send_json({"error": str(exc)}, status=exc.status)
            except (AttributeError, KeyError, TypeError, ValueError) as exc:
                self._send_json({"error": f"Bad request: {exc}"}, status=400)

        def _handle_get(self) -> None:
            parsed = urlparse(self.path)
            path = parsed.path
            query = parse_qs(parsed.query)

            if path == "/" or path == "/index.html":
                self._serve_static_file(STATIC_DIR / "index.html")
                return

            if path.startswith("/static/"):
                rel = path[len("/static/") :]
                target = (STATIC_DIR / rel).resolve()
                if not _inside(STATIC_DIR, target) or not target.is_file():
                    self._send_json({"error": "Not found"}, status=404)
                    return
                self._serve_static_file(target)
                return

            if path.startswith(("/css/", "/ui/", "/js/", "/assets/", "/vendor/")):
                rel = path.lstrip("/")
                target = (STATIC_DIR / rel).resolve()
                if not _inside(STATIC_DIR, target) or not target.is_file():
                    self._send_json({"error": "Not found"}, status=404)
                    return
                self._serve_static_file(target)
                return

            if path == "/api/session-log":
                self._send_json({"events": state.store.get_session_log()})
                return

            if path == "/api/patches":
                self._send_json(state.store.get_patch_catalog())
                return

            if path == "/api/custom-patches":
                self._send_json({"custom_patches": state.store.list_custom_patches()})
                return

            if path == "/api/songs":
                self._send_json({"songs": state.store.list_songs()})
                return

            if path.startswith("/api/songs/"):
                song_id = path.split("/api/songs/", 1)[1].strip("/") or "starter_neutral_100_cm"
                reset = query.get("reset") == ["1"]
                # An unknown id is a 404, not a silent swap to the showcase preset.
                known = state.store.has_preset(song_id) if reset else state.store.has_song(song_id)
                if not known:
                    self._send_json({"error": "Song not found."}, status=404)
                    return
                if reset:
                    song_doc = state.store.load_preset_song(song_id)
                else:
                    song_doc = state.store.load_song(song_id)
                ensure_fluid_song_graph(song_doc)
                state.last_compiled_doc = copy.deepcopy(song_doc)
                compiled = compile_song(song_doc)
                self._send_json({
                    "song": song_doc,
                    "compiled": compiled,
                    "diagnostics": diagnose_song(song_doc),
                    "provenance": compute_provenance_summary(song_doc, compiled),
                })
                return

            self._send_json({"error": f"Unknown route: {path}"}, status=404)

        def _handle_post(self) -> None:
            parsed = urlparse(self.path)
            path = parsed.path
            body = self._read_json_body()

            if path == "/api/compile":
                song_doc = body.get("song") or state.last_compiled_doc
                scaffold_options = body.get("scaffold_options")
                record_undo = bool(body.get("record_undo", True))
                song_id = state.store.validated_song_id(song_doc.get("id", "heavy_bass_110"))
                if record_undo and state.last_compiled_doc and state.last_compiled_doc.get('id') == song_id:
                    state.store.push_snapshot(song_id, state.last_compiled_doc)
                state.last_compiled_doc = copy.deepcopy(song_doc)
                compiled = compile_song(song_doc, scaffold_options=scaffold_options)
                self._send_json({
                    "song": song_doc,
                    "compiled": compiled,
                    "diagnostics": diagnose_song(song_doc),
                    "provenance": compute_provenance_summary(song_doc, compiled),
                })
                return

            if path == "/api/songs":
                song_doc = body.get("song") or state.last_compiled_doc
                saved_path = state.store.save_song(song_doc, record_history=True)
                state.last_compiled_doc = copy.deepcopy(song_doc)
                compiled = compile_song(song_doc)
                self._send_json({
                    "saved_path": str(saved_path.relative_to(ROOT_DIR))
                    if str(saved_path).startswith(str(ROOT_DIR))
                    else str(saved_path),
                    "song": song_doc,
                    "compiled": compiled,
                    "diagnostics": diagnose_song(song_doc),
                    "provenance": compute_provenance_summary(song_doc, compiled),
                })
                return

            if path == "/api/hocket-transform":
                song_doc = body.get("song") or state.last_compiled_doc
                action = str(body.get("action", "kick_lock"))
                song_id = str(song_doc.get("id", "heavy_bass_110"))
                state.store.push_snapshot(song_id, song_doc)
                updated_doc = apply_studio_transform(song_doc, action)
                state.last_compiled_doc = copy.deepcopy(updated_doc)
                compiled = compile_song(updated_doc)
                self._send_json({
                    "song": updated_doc,
                    "compiled": compiled,
                    "diagnostics": diagnose_song(updated_doc),
                    "provenance": compute_provenance_summary(updated_doc, compiled),
                })
                return

            if path == "/api/arrange":
                song_doc = body.get("song") or state.last_compiled_doc
                action = str(body.get("action", "unfold_song"))
                song_id = str(song_doc.get("id", "heavy_bass_110"))
                state.store.push_snapshot(song_id, song_doc)
                if action == "return_loop":
                    updated_doc = copy.deepcopy(song_doc)
                    updated_doc["arrangement_mode"] = "loop"
                else:
                    updated_doc = unfold_song_sections(song_doc)
                state.last_compiled_doc = copy.deepcopy(updated_doc)
                compiled = compile_song(updated_doc)
                self._send_json({
                    "song": updated_doc,
                    "compiled": compiled,
                    "diagnostics": diagnose_song(updated_doc),
                    "provenance": compute_provenance_summary(updated_doc, compiled),
                })
                return

            if path == "/api/diagnose":
                song_doc = body.get("song") or state.last_compiled_doc
                action = str(body.get("action", "analyze"))
                if action == "preview_diff":
                    target_action = str(body.get("target_action", "kick_lock"))
                    diff = preview_transform_diff(song_doc, target_action)
                    self._send_json({"diff": diff})
                    return
                if action == "apply_fix":
                    fix = body.get("fix") or {"fix_type": "fix_all"}
                    song_id = str(song_doc.get("id", "heavy_bass_110"))
                    state.store.push_snapshot(song_id, song_doc)
                    updated_doc = apply_diagnostic_fix(song_doc, fix)
                    state.last_compiled_doc = copy.deepcopy(updated_doc)
                    compiled = compile_song(updated_doc)
                    self._send_json({
                        "song": updated_doc,
                        "compiled": compiled,
                        "diagnostics": diagnose_song(updated_doc),
                        "provenance": compute_provenance_summary(updated_doc, compiled),
                    })
                    return
                self._send_json({"diagnostics": diagnose_song(song_doc)})
                return

            if path == "/api/ear-mission":
                song_doc = body.get("song") or state.last_compiled_doc
                action = str(body.get("action", "generate"))
                if action == "grade":
                    mission = body.get("mission") or generate_ear_mission(song_doc)
                    user_notes = body.get("user_notes") or (song_doc.get("notes") or [])
                    grade = grade_ear_mission(mission, user_notes)
                    self._send_json({"grade": grade, "mission": mission})
                    return
                difficulty = str(body.get("difficulty", "starter"))
                mission = generate_ear_mission(song_doc, difficulty=difficulty)
                self._send_json({"mission": mission})
                return

            if path == "/api/harmony-options":
                root_pc = int(body.get("root_pc", 0))
                scale_type = str(body.get("scale_type", "major"))
                options = suggest_harmony_alternatives(root_pc, scale_type)
                self._send_json({"options": options})
                return

            if path == "/api/session-log":
                entry = state.store.append_session_event(body)
                self._send_json({"logged": entry, "count": len(state.store.get_session_log())})
                return

            if path == "/api/undo":
                song_doc = body.get("song") or state.last_compiled_doc
                song_id = str(song_doc.get("id", "heavy_bass_110"))
                restored = state.store.undo(song_id, song_doc)
                if restored is None:
                    restored = song_doc
                state.last_compiled_doc = copy.deepcopy(restored)
                self._send_json({
                    "song": restored,
                    "compiled": compile_song(restored),
                    "diagnostics": diagnose_song(restored),
                })
                return

            if path == "/api/redo":
                song_doc = body.get("song") or state.last_compiled_doc
                song_id = str(song_doc.get("id", "heavy_bass_110"))
                restored = state.store.redo(song_id, song_doc)
                if restored is None:
                    restored = song_doc
                state.last_compiled_doc = copy.deepcopy(restored)
                self._send_json({
                    "song": restored,
                    "compiled": compile_song(restored),
                    "diagnostics": diagnose_song(restored),
                })
                return

            if path == "/api/render-wav":
                song_doc = body.get("song") or state.last_compiled_doc
                song_id = state.store.validated_song_id(song_doc.get("id", "heavy_bass_110"))
                compiled = compile_song(song_doc)
                wav_out = state.store.workspace_dir / f"{song_id}.wav"
                if not _inside(state.store.workspace_dir, wav_out):
                    raise BadRequest("Bad song id.")
                metrics = render_compiled_song_to_wav(compiled, wav_out, sample_rate=22050)
                metrics["wav_path"] = wav_out.name  # never hand a server path to the page
                self._send_json({
                    "wav_path": wav_out.name,
                    "metrics": metrics,
                })
                return

            if path == "/api/custom-patches":
                saved = state.store.save_custom_patch(body)
                self._send_json({
                    "saved": saved,
                    "custom_patches": state.store.list_custom_patches(),
                })
                return

            self._send_json({"error": f"Unknown POST route: {path}"}, status=404)

        def _serve_static_file(self, file_path: Path) -> None:
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if file_path.suffix == ".js":
                mime_type = "application/javascript; charset=utf-8"
            elif file_path.suffix == ".css":
                mime_type = "text/css; charset=utf-8"
            elif file_path.suffix == ".html":
                mime_type = "text/html; charset=utf-8"
            raw = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)

    return StudioRequestHandler


def create_studio_server(
    host: str = "127.0.0.1",
    port: int = 8765,
    workspace_dir: Optional[Path] = None,
) -> ThreadingHTTPServer:
    """Create and bind a ThreadingHTTPServer on 127.0.0.1:<port>."""
    state = MusicLabStudioState(workspace_dir=workspace_dir)
    handler_cls = create_request_handler(state)
    return ThreadingHTTPServer((host, port), handler_cls)
