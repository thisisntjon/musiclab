"""launch.cmd on Windows: find a working Python (py -3, then python), and say so plainly when there is none."""
from __future__ import annotations

import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAUNCH = ROOT / "launch.cmd"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LaunchScript(unittest.TestCase):
    def setUp(self):
        self.text = LAUNCH.read_text(encoding="utf-8")

    def test_tries_the_python_launcher_first_and_checks_that_python_runs(self):
        lines = [line.strip() for line in self.text.splitlines()]
        tries = [i for i, line in enumerate(lines) if re.search(r"\b(py -3|python)\b.*-c ", line)]
        self.assertGreaterEqual(len(tries), 2, "both commands are tried")
        self.assertIn("py -3", lines[tries[0]], "the launcher that ignores PATH comes first")
        self.assertRegex(lines[tries[1]], r"\bpython\b")
        start = next(i for i, line in enumerate(lines) if line.lower().startswith("start ") and "app.py" in line)
        self.assertGreater(start, tries[1], "the server starts only after a Python was found")
        self.assertIn("cmd /k", lines[start], "the server window stays open to show any error")
        self.assertIn("%PY%", lines[start])
        self.assertNotRegex(self.text, r"(?im)^start [^\n]*\bpython app\.py", "no bare python start that can vanish")

    def test_plain_words_and_a_pause_when_no_python_is_found(self):
        block = self.text[self.text.index("if not defined PY ("):]
        block = block[:block.index("\n)") + 2]
        self.assertIn("python.org", block)
        self.assertIn("Add python.exe to PATH", block)
        self.assertIn("pause", block)
        self.assertIn("exit /b 1", block)
        for line in block.splitlines()[1:-1]:
            self.assertNotRegex(line.split("echo", 1)[-1], r"[()]", "a bracket inside the block would end it early")

    @unittest.skipUnless(sys.platform == "win32", "launch.cmd runs on Windows")
    def test_without_python_it_explains_and_stops(self):
        # Never run a script that could start a server or a missing program: it must check for Python first.
        self.assertIn("if not defined PY (", self.text)
        self.assertNotRegex(self.text, r"(?im)^start [^\n]*\bpython app\.py")
        system32 = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32"
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "launch.cmd"
            raw = LAUNCH.read_bytes()
            self.assertIn(b"set PORT=8777", raw)
            copy.write_bytes(raw.replace(b"set PORT=8777", f"set PORT={free_port()}".encode()))
            env = {k: v for k, v in os.environ.items() if k.upper() not in {"PATH", "PYTHONHOME", "PYTHONPATH"}}
            env["PATH"] = str(system32)
            self.assertIsNone(shutil.which("py", path=env["PATH"]))
            self.assertIsNone(shutil.which("python", path=env["PATH"]))
            result = subprocess.run(["cmd", "/d", "/c", str(copy)], cwd=tmp, env=env, stdin=subprocess.DEVNULL,
                                    capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("MusicLab needs Python 3", result.stdout)
        self.assertIn("Add python.exe to PATH", result.stdout)
        self.assertNotIn("server window", result.stdout, "no pointer to a window that never opened")


if __name__ == "__main__":
    unittest.main()
