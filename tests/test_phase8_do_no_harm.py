"""Phase 8.0 "Do No Harm" acceptance tests (workflow/phases/phase-8.md section 5).

Server-side criteria run here directly. The JS criteria live in tests/js/*.test.mjs and are run
by test_js_unit_suite via `node --test tests/js`.
"""
from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.theory_core.diagnostics import ensure_fluid_song_graph  # noqa: E402
from src.theory_core.phrase_transforms import SHAPES  # noqa: E402

# 16 hummed notes over 4 bars, placed the way the guided flow placed a hummed phrase.
HUM_BAR = [(0, 65, 3), (3, 69, 2), (6, 72, 4), (11, 70, 3)]


def _hummed_song() -> dict:
    lead = []
    for bar in range(4):
        for step, midi, dur in HUM_BAR:
            lead.append({
                "id": f"hum-wiz-{bar * 16 + step}", "step": bar * 16 + step, "duration_steps": dur,
                "velocity": 0.85, "role": "lead", "patch_id": "pluck_lead", "pitch_lock_mode": "concrete",
                "concrete": {"midi_pitch": midi}, "provenance": "hummed_confirmed",
            })
    song = {"id": "p8_fixture", "notes": lead}
    ensure_fluid_song_graph(song)
    return song


def _lead(doc: dict) -> dict:
    return {n["id"]: n for n in doc["notes"] if n.get("role") == "lead"}


class PythonJsParityTest(unittest.TestCase):
    """Decision 3: the Python and JS phrase transforms give identical results on the same input."""

    def test_python_js_parity(self):
        import random

        from src.theory_core.phrase_transforms import transform_phrase_ending

        node = shutil.which("node")
        self.assertIsNotNone(node)
        rng = random.Random(8)
        fixtures = [list(_lead(_hummed_song()).values())]
        for _ in range(12):
            lead = []
            for bar in range(4):
                for step in sorted(rng.sample(range(16), rng.randint(1, 5))):
                    lead.append({"id": f"r{bar * 16 + step}", "step": bar * 16 + step, "duration_steps": rng.randint(1, 4),
                                 "concrete": {"midi_pitch": rng.randint(55, 80)}, "provenance": "user_placed"})
            fixtures.append(lead)
        cases = [{"lead": lead, "shape": shape, "root": rng.randint(0, 11), "scale": rng.choice(["major", "natural_minor", "dorian"])}
                 for lead in fixtures for shape in SHAPES]
        script = (
            "import { transformPhraseEnding } from './static/js/theory/phrase_transforms.js';"
            "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const cs=JSON.parse(s);"
            "console.log(JSON.stringify(cs.map(c=>transformPhraseEnding(c.lead,c.shape,c.root,c.scale))));});"
        )
        out = subprocess.run([node, "--input-type=module", "-e", script], input=json.dumps(cases), cwd=ROOT,
                             capture_output=True, text=True, check=True)
        js_results = json.loads(out.stdout)

        def key(lead):
            return sorted((n["id"], n["step"], n["duration_steps"], n["concrete"]["midi_pitch"], tuple(n.get("shaped_by") or []))
                          for n in lead)

        for case, js in zip(cases, js_results):
            py = transform_phrase_ending(case["lead"], case["shape"], case["root"], case["scale"])
            self.assertEqual(key(py), key(js), f"mismatch for shape {case['shape']} root {case['root']} {case['scale']}")

    def test_deja_vu_and_decorator_python_js_parity(self):
        from src.theory_core.phrase_transforms import DEJA_VU_MODES, NOTE_DECORATORS, decorate_phrase_notes, mutate_deja_vu

        node = shutil.which("node")
        self.assertIsNotNone(node)
        base_lead = [n for n in _hummed_song()["notes"] if n.get("role") == "lead"]
        js_module = (ROOT / "static/js/theory/phrase_transforms.js").as_uri()
        script = (
            f"import {{ mutateDejaVu, decoratePhraseNotes }} from {json.dumps(js_module)};"
            "const input = JSON.parse(process.argv[1]);"
            "const deja = input.modes.map(m => mutateDejaVu(input.lead, m, 3));"
            "const deco = input.decos.map(d => decoratePhraseNotes(input.lead, d));"
            "console.log(JSON.stringify({ deja, deco }));"
        )
        proc = subprocess.run([node, "--input-type=module", "-e", script, json.dumps({"lead": base_lead, "modes": list(DEJA_VU_MODES), "decos": list(NOTE_DECORATORS)})], capture_output=True, text=True, check=True)
        res = json.loads(proc.stdout)
        key = lambda lead: [(n["id"], n["step"], n["concrete"]["midi_pitch"], n["duration_steps"], n["provenance"], n.get("transition")) for n in lead]
        for mode, js_out in zip(DEJA_VU_MODES, res["deja"]):
            py_out = mutate_deja_vu(base_lead, mode, 3)
            self.assertEqual(key(py_out), key(js_out), f"deja_vu mismatch for {mode}")
        for deco, js_out in zip(NOTE_DECORATORS, res["deco"]):
            py_out = decorate_phrase_notes(base_lead, deco)
            self.assertEqual(key(py_out), key(js_out), f"decorator mismatch for {deco}")


class PeakCeilingTest(unittest.TestCase):
    """AC4: every starter renders with peak between -6.0 and -3.0 dBFS."""

    def test_peak_ceiling(self):
        from src.audio_engine.synth import render_compiled_song_to_pcm
        from src.song_store import seeds
        from src.theory_core import compile_song

        docs = {
            "starter": seeds.build_neutral_starter_seed(),
            "heavy_showcase": seeds.build_heavy_bass_starter_song(),
            "flawed": seeds.build_flawed_diagnostic_seed(),
            "diagnostic_demo": seeds.build_diagnostic_demo_song(),
        }
        for label, doc in docs.items():
            left, right, _ = render_compiled_song_to_pcm(compile_song(doc), sample_rate=11025)
            peak = max(max(map(abs, left)), max(map(abs, right)))
            peak_db = 20 * math.log10(max(peak, 1e-9))
            self.assertLessEqual(peak_db, -3.0 + 0.01, f"{label}: peak {peak_db:.2f} dBFS above ceiling")
            self.assertGreaterEqual(peak_db, -6.0, f"{label}: peak {peak_db:.2f} dBFS below the G3 floor")


class JsUnitSuiteTest(unittest.TestCase):
    """Runs the JS acceptance tests (AC2, AC3, AC5, AC7, AC8, AC12)."""

    def test_js_unit_suite(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "node is required for the Phase 8 JS tests")
        js_dir = ROOT / "tests" / "js"
        files = sorted(str(p) for p in js_dir.rglob("*.test.mjs"))
        self.assertTrue(files, "no JS tests found in tests/js")
        result = subprocess.run([node, "--test", *files], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout[-3000:] + result.stderr[-3000:])


if __name__ == "__main__":
    unittest.main()
