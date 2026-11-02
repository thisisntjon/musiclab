"""Cross-runtime frame allocation contract; does not assert synthesis equivalence."""
import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest

from src.audio_engine.synth import render_duration_seconds, render_compiled_song_to_pcm


def test_render_duration_includes_note_extent_and_fixed_tail():
    song = {"total_duration_sec": 4, "events": [{"start_sec": 3.9, "duration_sec": 1.1}]}
    assert render_duration_seconds(song) == 7
    assert render_duration_seconds({"total_duration_sec": 4, "events": []}) == 6


def test_browser_python_allocate_identical_frames():
    if not shutil.which("node"):
        pytest.skip("Node required for cross-runtime contract")
    fixtures = [
        {"total_duration_sec": 1.23456, "events": []},
        {"total_duration_sec": 4, "events": [{"start_sec": 3.9, "duration_sec": 1.1}]},
        {"total_duration_sec": 0, "events": []},
    ]
    script = "import {renderDurationSeconds} from './static/js/audio/scheduler.js'; const x=JSON.parse(process.argv[1]); console.log(JSON.stringify(x.map(s=>Math.ceil(renderDurationSeconds(s)*44100))));"
    result = subprocess.run(["node", "--input-type=module", "-e", script, json.dumps(fixtures)],
                            cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, check=True)
    assert json.loads(result.stdout) == [math.ceil(render_duration_seconds(s) * 44100) for s in fixtures]
    left, right, _ = render_compiled_song_to_pcm(fixtures[0], sample_rate=8000)
    assert len(left) == len(right) == math.ceil(render_duration_seconds(fixtures[0]) * 8000)
