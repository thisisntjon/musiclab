"""Browser/Python compiler & SongStore parity across contrasting v5 genres and fractional offsets."""
import json
import subprocess
from pathlib import Path

import pytest

from src.song_store import SongStore
from src.theory_core import compile_song

SCRIPT = r"""
import {buildStandaloneSeed, compileSongStandalone} from './static/ui/standalone_compiler.js';
import {phraseContext} from './static/js/theory/phrase_harmony.js';
import {captureMelodyContext} from './static/js/theory/melody_composer.js';
import {planMelodyCandidate, VOCABULARY_VERSION} from './static/js/theory/melody_composer_v5.js';
import {balanceBasis, balancedEvents} from './static/js/theory/melody_balance.js';
import {selectedMelody} from './static/js/theory/selected_melody.js';
import {songEvents} from './static/js/theory/song_view.js';

let text = '';
for await (const chunk of process.stdin) text += chunk;
const input = JSON.parse(text);
const source = buildStandaloneSeed();
source.id = `v5-parity-${input.scene}`;
source.arrangement_mode = 'loop';
source.auto_harmony_stabs = false;
source.global_context = {...source.global_context, bpm: input.bpm, root_pc: input.root, scale_type: input.scale, swing: 0.58};
source.jam_session = {scene_id: input.scene};
source.notes = [
  {id: 'personal-own', step: 2, duration_steps: 3.5, velocity: 0.64, role: 'lead',
   patch_id: 'sampled_piano_v1', provenance: 'user_placed', pitch_lock_mode: 'concrete',
   concrete: {midi_pitch: 60 + input.root}, performance: {version: 1, offset_steps: 0.125}},
  {id: 'band-lead', step: 0, duration_steps: 2, velocity: 0.55, role: 'lead',
   patch_id: input.patch, provenance: 'jam_generated', pitch_lock_mode: 'concrete',
   concrete: {midi_pitch: 64 + input.root}},
  {id: 'backing-bass', step: 0, duration_steps: 4, velocity: 0.35, role: 'bass',
   patch_id: 'clean_bass', provenance: 'jam_generated', pitch_lock_mode: 'concrete',
   concrete: {midi_pitch: 36 + input.root}},
];
const score = compileSongStandalone(source);
const context = {...captureMelodyContext(score, {phraseContext: phraseContext(source)})};
context.composerVersion = 5;
context.vocabularyVersion = VOCABULARY_VERSION;
context.bandBasis = balanceBasis(score.events);
context.bandBalance = input.soft ? 1 : 0;
const plan = planMelodyCandidate(context, input.pos);
const archive = {...structuredClone(source), captured_performance: {version: 1, start: 0, end: 2,
  events: [{event: source.notes[0], time: 0.3, duration: 0.45, occurrence: 1}]}};
const doc = selectedMelody(source, {...score, events: balancedEvents(plan.notes, context.bandBasis, Boolean(input.soft))},
  {context, choice: plan.choice, performanceArchive: archive});
process.stdout.write(JSON.stringify({doc, browser: songEvents(compileSongStandalone(doc), doc.song_cards), source, archive}));
"""


@pytest.mark.parametrize(
    "scene,patch,bpm,root,scale,pos,soft",
    [
        ("ska-v1", "sampled_piano_v1", 126, 0, "major", {"x": 0, "y": 1}, False),
        ("grime-v1", "sampled_electric_piano_v1", 140, 2, "natural_minor", {"x": 1, "y": 0}, True),
        ("footwork-v1", "sampled_banjo_v1", 160, 7, "natural_minor", {"x": 0, "y": -1}, False),
        ("delta-blues-v1", "sampled_guitar_v1", 92, 4, "major", {"x": -0.75, "y": 0.5}, False),
        ("gospel-piano-v1", "sampled_piano_v1", 96, 5, "major", {"x": 0.5, "y": 0.85}, True),
        ("neo-soul-v1", "sampled_electric_piano_v1", 88, 9, "natural_minor", {"x": -1, "y": 0}, False),
        ("dubstep-v1", "sampled_electric_piano_v1", 140, 0, "natural_minor", {"x": 0.6, "y": -0.6}, False),
    ],
)
def test_genre_v5_melody_compiler_and_storage_parity(tmp_path, scene, patch, bpm, root, scale, pos, soft):
    result = subprocess.run(
        ["node", "--input-type=module", "-e", SCRIPT],
        input=json.dumps({"scene": scene, "patch": patch, "bpm": bpm, "root": root, "scale": scale, "pos": pos, "soft": soft}),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
        cwd=Path(__file__).resolve().parents[1],
    )
    fixture = json.loads(result.stdout)
    store = SongStore(workspace_dir=tmp_path)
    store.save_song(fixture["doc"])
    reopened = store.load_song(f"v5-parity-{scene}")

    assert reopened["capture_source"] == fixture["archive"]
    assert reopened["melody_original"] == fixture["source"]
    assert reopened["capture_notes"]["melody_field"]["context"]["composerVersion"] == 5
    assert reopened["capture_notes"]["melody_field"]["context"]["sceneId"] == scene
    assert any(n.get("generated_by") == "musiclab_phrase_composer_v5" for n in reopened["notes"])

    server, browser = compile_song(reopened), fixture["browser"]
    assert server["total_steps"] == browser["total_steps"] == 64
    assert len(server["events"]) == len(browser["events"])
    expected = {event["id"]: event for event in browser["events"]}
    for event in server["events"]:
        other = expected[event["id"]]
        for key in ["role", "patch_id", "provenance"]:
            assert event[key] == other[key]
        assert event["concrete"]["midi_pitch"] == other["concrete"]["midi_pitch"]
        assert event["start_sec"] == pytest.approx(other["start_sec"], abs=1e-4)
        assert event["duration_sec"] == pytest.approx(other["duration_sec"], abs=1e-4)
        assert event["velocity"] == pytest.approx(other["velocity"], abs=1e-6)
