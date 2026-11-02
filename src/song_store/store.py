"""Local JSON project persistence, preset management, and undo/redo history for song-store."""

from __future__ import annotations

import copy
import json
import logging
import os
import tempfile
from functools import wraps
from threading import RLock
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.song_store.seeds import (
    PRESETS_DIR,
    build_heavy_bass_starter_song,
    build_flawed_diagnostic_seed,
    build_neutral_starter_seed,
    load_patch_catalog,
)

DEFAULT_WORKSPACE_DIR = Path(__file__).resolve().parent.parent.parent / "workspace_songs"
# The session log keeps only the most recent events so it cannot grow without bound.
MAX_SESSION_EVENTS = 2000
# Ids load_preset_song answers without a presets/<id>.json file.
BUILT_IN_PRESET_IDS = (
    "starter_neutral_100_cm",
    "neutral_starter",
    "flawed_beginner_loop",
    "fix_my_loop_demo",
    "heavy_bass_showcase",
)

logger = logging.getLogger(__name__)


def write_json_atomic(path: Path, payload: Any) -> None:
    """Replace one JSON file only after a complete, flushed temporary write.

    Same-directory replacement keeps existing readers on a complete old or new
    file. This is not a transaction across song/history files or a guarantee
    against hardware failure. JSON shape is unchanged for existing saves.
    """
    content = json.dumps(payload, indent=2)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent,
            prefix=f".{path.name}.", suffix=".tmp", delete=False,
        ) as stream:
            temporary = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        # Close first: Windows cannot replace an open temporary file.
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def safe_song_id(raw: Any) -> str:
    """Validate identity without silently aliasing another song or internal file."""
    if not isinstance(raw, str) or not raw or len(raw.encode('utf-16-le')) > 240:
        raise ValueError("Song id must be text of 1 to 120 characters.")
    if not all(ch.isalnum() or ch in ('_', '-') for ch in raw):
        raise ValueError("Song id may use letters, numbers, underscores and hyphens.")
    folded = raw.casefold()
    devices = {'con', 'prn', 'aux', 'nul', 'clock$'}
    devices.update(prefix + digit for prefix in ('com', 'lpt') for digit in '123456789¹²³')
    if folded in devices | {'session_log', 'custom_patches'} or folded.endswith('_history'):
        raise ValueError("This song id is reserved. Choose another id.")
    return raw

def serialized(method):
    """Keep validation and mutation together within one store instance."""
    @wraps(method)
    def call(self, *args, **kwargs):
        with self.lock:
            return method(self, *args, **kwargs)
    return call


class SongStore:
    """Manages local JSON song document persistence (in workspace_songs/) and undo/redo snapshots."""

    def __init__(
        self,
        workspace_dir: Path = DEFAULT_WORKSPACE_DIR,
        presets_dir: Path = PRESETS_DIR,
        max_history: int = 50,
    ) -> None:
        self.workspace_dir = Path(workspace_dir)
        self.presets_dir = Path(presets_dir)
        self.max_history = max_history
        self.lock = RLock()
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        self._undo_stacks: Dict[str, List[Dict[str, Any]]] = {}
        self._redo_stacks: Dict[str, List[Dict[str, Any]]] = {}

    def get_patch_catalog(self) -> Dict[str, Any]:
        """Return the 7 Heavy Bass & Glitch patches and 5 Gesture Badges."""
        return load_patch_catalog(self.presets_dir)

    def load_preset_song(self, preset_id: str = "heavy_bass_110") -> Dict[str, Any]:
        """Load a starter song dict from presets/<preset_id>.json, falling back to seed builder."""
        preset_id = safe_song_id(preset_id)
        if preset_id in ("starter_neutral_100_cm", "neutral_starter"):
            return build_neutral_starter_seed()
        if preset_id in ("flawed_beginner_loop", "fix_my_loop_demo"):
            return build_flawed_diagnostic_seed()
        if preset_id == "heavy_bass_showcase":
            preset_id = "heavy_bass_110"
        preset_path = self.presets_dir / f"{preset_id}.json"
        if preset_path.exists():
            with preset_path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        return build_heavy_bass_starter_song()

    def has_preset(self, preset_id: str) -> bool:
        """True when load_preset_song would find this id rather than fall back to the showcase."""
        try:
            preset_id = safe_song_id(preset_id)
        except ValueError:
            return False
        if preset_id in BUILT_IN_PRESET_IDS:
            return True
        return preset_id != "patches" and (self.presets_dir / f"{preset_id}.json").exists()

    def has_song(self, song_id: str) -> bool:
        """True when load_song would find a saved song or a preset for this id."""
        try:
            safe_id = self.validated_song_id(song_id)
        except ValueError:
            return False
        return (self.workspace_dir / f"{safe_id}.json").exists() or self.has_preset(safe_id)

    @serialized
    def validated_song_id(self, song_id: str) -> str:
        """Use exact spelling, even on a case-insensitive Windows filesystem."""
        safe_id = safe_song_id(song_id)
        names = {f'{safe_id}.json', f'{safe_id}_history.json', f'{safe_id}.wav'}
        folded = {name.casefold() for name in names}
        for path in self.workspace_dir.iterdir():
            if path.name.casefold() in folded and path.name not in names:
                raise ValueError("A song with different capitalization already exists. Use its exact id.")
        for existing in self._undo_stacks.keys() | self._redo_stacks.keys():
            if existing.casefold() == safe_id.casefold() and existing != safe_id:
                raise ValueError("Use the existing song id's exact capitalization.")
        return safe_id

    def _history_path(self, safe_id: str) -> Path:
        return self.workspace_dir / f"{safe_id}_history.json"

    def _load_history_from_disk(self, safe_id: str) -> None:
        if safe_id in self._undo_stacks or safe_id in self._redo_stacks:
            return
        hp = self._history_path(safe_id)
        if hp.exists():
            try:
                with hp.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
                self._undo_stacks[safe_id] = list(data.get("undo") or [])
                self._redo_stacks[safe_id] = list(data.get("redo") or [])
                return
            except Exception as exc:
                logger.warning("Could not read undo history %s: %s", hp.name, exc)
        self._undo_stacks.setdefault(safe_id, [])
        self._redo_stacks.setdefault(safe_id, [])

    def _save_history_to_disk(self, safe_id: str) -> None:
        # Undo for a song that was never saved stays in memory; no orphan <id>_history.json files.
        if not (self.workspace_dir / f"{safe_id}.json").exists():
            return
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        hp = self._history_path(safe_id)
        payload = {
            "undo": self._undo_stacks.get(safe_id, []),
            "redo": self._redo_stacks.get(safe_id, []),
        }
        try:
            write_json_atomic(hp, payload)
        except Exception as exc:
            logger.warning("Could not save undo history %s: %s", hp.name, exc)

    @serialized
    def save_song(self, song_doc: Dict[str, Any], record_history: bool = True) -> Path:
        """Persist a song document as formatted JSON in workspace_songs/<song_id>.json."""
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        raw_id = song_doc.get("id", song_doc.get("project_id", "starter_neutral_100_cm"))
        safe_id = self.validated_song_id(raw_id)
        song_doc["id"] = safe_id
        out_path = self.workspace_dir / f"{safe_id}.json"
        if record_history and out_path.exists():
            try:
                with out_path.open("r", encoding="utf-8") as fh:
                    prev_data = json.load(fh)
                self.push_snapshot(safe_id, prev_data)
            except Exception as exc:
                logger.warning("Could not snapshot previous %s before saving: %s", out_path.name, exc)
        write_json_atomic(out_path, song_doc)
        return out_path

    @serialized
    def load_song(self, song_id: str = "starter_neutral_100_cm") -> Dict[str, Any]:
        """Load a song document from workspace_songs/, falling back to presets/ if not yet saved."""
        safe_id = self.validated_song_id(song_id)
        ws_path = self.workspace_dir / f"{safe_id}.json"
        if ws_path.exists():
            with ws_path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        return self.load_preset_song(safe_id)

    def list_songs(self) -> List[Dict[str, Any]]:
        """List all available songs across presets and workspace_songs."""
        entries: Dict[str, Dict[str, Any]] = {}
        for p_file in sorted(self.presets_dir.glob("*.json")):
            if p_file.name == "patches.json":
                continue
            try:
                with p_file.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
                sid = data.get("id") or data.get("project_id")
                if sid:
                    ctx = data.get("global_context") or {}
                    title = str(data.get("title", sid))
                    if sid == "heavy_bass_110" or "Heavy Bass" in title:
                        title = "Heavy Bass Showcase"
                    entries[sid] = {
                        "id": sid,
                        "title": title,
                        "bpm": ctx.get("bpm", data.get("bpm", 110.0)),
                        "source": "preset",
                    }
            except Exception as exc:
                logger.warning("Skipping unreadable preset %s: %s", p_file.name, exc)
                continue

        if self.workspace_dir.exists():
            for w_file in sorted(self.workspace_dir.glob("*.json")):
                if w_file.name in ("custom_patches.json", "session_log.json") or w_file.name.endswith("_history.json"):
                    continue
                try:
                    with w_file.open("r", encoding="utf-8") as fh:
                        data = json.load(fh)
                    sid = data.get("id") or data.get("project_id")
                    if sid:
                        ctx = data.get("global_context") or {}
                        entries[sid] = {
                            "id": sid,
                            "title": data.get("title", sid),
                            "bpm": ctx.get("bpm", data.get("bpm", 104.0)),
                            "source": "workspace",
                        }
                except Exception as exc:
                    logger.warning("Skipping unreadable song %s: %s", w_file.name, exc)
                    continue
        if "starter_neutral_100_cm" not in entries:
            entries["starter_neutral_100_cm"] = {
                "id": "starter_neutral_100_cm",
                "title": "MusicLab Starter — Warm Keys & Clean Groove",
                "bpm": 100.0,
                "source": "preset",
            }
        if "fix_my_loop_demo" not in entries:
            entries["fix_my_loop_demo"] = {
                "id": "fix_my_loop_demo",
                "title": "Diagnostic Challenge — Fix My Loop (4 Clashes)",
                "bpm": 110.0,
                "source": "preset",
            }
        return list(entries.values())

    @serialized
    def push_snapshot(self, song_id: str, song_doc: Dict[str, Any]) -> None:
        """Record a deep-copied state snapshot on the project's undo stack, clear redo, and persist to disk."""
        safe_id = self.validated_song_id(song_id)
        if song_doc.get('id') != safe_id:
            raise ValueError("Undo history must belong to the same song.")
        self._load_history_from_disk(safe_id)
        stack = self._undo_stacks.setdefault(safe_id, [])
        stack.append(copy.deepcopy(song_doc))
        if len(stack) > self.max_history:
            stack.pop(0)
        self._redo_stacks[safe_id] = []
        self._save_history_to_disk(safe_id)

    @serialized
    def undo(self, song_id: str, current_doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Pop the most recent snapshot from undo stack, push current state to redo, and persist."""
        safe_id = self.validated_song_id(song_id)
        if current_doc.get('id') != safe_id:
            raise ValueError("Undo must use the current song's id.")
        self._load_history_from_disk(safe_id)
        stack = self._undo_stacks.get(safe_id, [])
        if not stack:
            return None
        if stack[-1].get('id') != safe_id:
            raise ValueError("This undo history belongs to a different song.")
        redo_stack = self._redo_stacks.setdefault(safe_id, [])
        redo_stack.append(copy.deepcopy(current_doc))
        prev_dict = stack.pop()
        self._save_history_to_disk(safe_id)
        self.save_song(prev_dict, record_history=False)
        return prev_dict

    @serialized
    def redo(self, song_id: str, current_doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Pop the most recent snapshot from redo stack, push current state to undo, and persist."""
        safe_id = self.validated_song_id(song_id)
        if current_doc.get('id') != safe_id:
            raise ValueError("Redo must use the current song's id.")
        self._load_history_from_disk(safe_id)
        redo_stack = self._redo_stacks.get(safe_id, [])
        if not redo_stack:
            return None
        if redo_stack[-1].get('id') != safe_id:
            raise ValueError("This redo history belongs to a different song.")
        undo_stack = self._undo_stacks.setdefault(safe_id, [])
        undo_stack.append(copy.deepcopy(current_doc))
        next_dict = redo_stack.pop()
        self._save_history_to_disk(safe_id)
        self.save_song(next_dict, record_history=False)
        return next_dict

    def append_session_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Append a structured telemetry event to workspace_songs/session_log.json (Blocker B7)."""
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        log_path = self.workspace_dir / "session_log.json"
        events: List[Dict[str, Any]] = []
        if log_path.exists():
            try:
                with log_path.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, list):
                    events = data
                elif isinstance(data, dict):
                    events = list(data.get("events") or [])
            except Exception as exc:
                logger.warning("Session log unreadable, starting a new one: %s", exc)
                events = []
        entry = copy.deepcopy(event)
        events.append(entry)
        events = events[-MAX_SESSION_EVENTS:]
        write_json_atomic(log_path, {"events": events})
        return entry

    def get_session_log(self) -> List[Dict[str, Any]]:
        """Read all recorded session events from workspace_songs/session_log.json."""
        log_path = self.workspace_dir / "session_log.json"
        if not log_path.exists():
            return []
        try:
            with log_path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return list(data.get("events") or [])
        except Exception as exc:
            logger.warning("Could not read session log: %s", exc)
        return []

    def list_custom_patches(self) -> List[Dict[str, Any]]:
        """List user-saved custom sculpted patches from workspace_songs/custom_patches.json."""
        cp_path = self.workspace_dir / "custom_patches.json"
        if not cp_path.exists():
            return []
        try:
            with cp_path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            return list(data.get("custom_patches") or [])
        except Exception as exc:
            logger.warning("Could not read custom patches: %s", exc)
            return []

    def save_custom_patch(self, patch_entry: Dict[str, Any]) -> Dict[str, Any]:
        """Save a custom sculpted bass/synth patch preset into workspace_songs/custom_patches.json."""
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        existing = self.list_custom_patches()
        custom_id = str(patch_entry.get("custom_id") or f"custom_{len(existing) + 1}")
        entry = {
            "custom_id": custom_id,
            "name": str(patch_entry.get("name") or f"Custom {patch_entry.get('patch_id', 'Growl')}"),
            "patch_id": str(patch_entry.get("patch_id") or "monster_growl"),
            "gesture": copy.deepcopy(patch_entry.get("gesture") or {}),
        }
        existing = [p for p in existing if p.get("custom_id") != custom_id]
        existing.append(entry)
        cp_path = self.workspace_dir / "custom_patches.json"
        write_json_atomic(cp_path, {"custom_patches": existing})
        return entry
