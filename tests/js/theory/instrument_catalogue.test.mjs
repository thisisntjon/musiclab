import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { INSTRUMENTS, INSTRUMENT_GROUPS, getInstrument, instrumentPage } from "../../../static/js/theory/instrument_catalogue.js";
import { compileSongStandalone } from "../../../static/ui/standalone_compiler.js";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";

function example(instrument) {
  const doc = newPlayDoc();
  doc.global_context.bars = 1;
  doc.drum_kit = instrument.kitId || "punchy";
  doc.notes = [{ id: "chosen", role: instrument.role, patch_id: instrument.patchId,
    step: 0, duration_steps: 2, velocity: .6, pitch_lock_mode: "concrete",
    concrete: { midi_pitch: instrument.previewMidi }, provenance: "user_placed" }];
  return doc;
}

test("catalogue pages expose every supported voice and kit with a local picture", () => {
  const seen = [];
  for (const group of INSTRUMENT_GROUPS) {
    const first = instrumentPage(group.id);
    for (let page = 0; page < first.pages; page++) {
      const result = instrumentPage(group.id, page);
      assert.ok(result.items.length <= 3);
      seen.push(...result.items.map(item => item.id));
    }
  }
  assert.equal(new Set(seen).size, INSTRUMENTS.length);
  assert.deepEqual([...seen].sort(), INSTRUMENTS.map(item => item.id).sort());
  const patches = new Set(INSTRUMENTS.map(item => item.patchId));
  assert.equal(patches.size, 34); // 17 synthesized voices plus seventeen sampled instruments
  for (const item of INSTRUMENTS) {
    assert.equal(getInstrument(item.id), item);
    assert.ok(item.label.split(/\s+/).length <= 3);
    const svg = readFileSync(new URL(item.image), "utf8");
    assert.match(svg, /<svg /);
    assert.doesNotMatch(svg, /<script|<image|href=/i);
  }
  assert.equal(getInstrument("not-a-patch"), null);
  assert.equal(instrumentPage("drums", 99).page, 2);
});

test("every chosen voice compiles without substituting its sound or authored pitch", () => {
  for (const item of INSTRUMENTS) {
    const compiled = compileSongStandalone(example(item));
    const note = compiled.events.find(event => event.id === "chosen");
    assert.ok(note, item.id);
    assert.equal(note.patch_id, item.patchId, item.id);
    assert.equal(note.concrete.midi_pitch, item.previewMidi, item.id);
    assert.ok(note.concrete.freq_hz > 0, item.id);
    assert.equal(note.provenance, "user_placed", item.id);
  }
});

test("catalogue voices compile; Python renders its supported voices and refuses sampled substitution", () => {
  const result = spawnSync("python", ["-c", `
import json, math, sys
from src.theory_core import compile_song
from src.theory_core.models import ALL_SYNTH_PATCHES
from src.audio_engine.synth import synthesize_event
items = json.load(sys.stdin)
patches = {x['patchId'] for x in items}
assert ALL_SYNTH_PATCHES <= patches
for item in items:
    doc = item['doc']
    event = next(e for e in compile_song(doc)['events'] if e['id'] == 'chosen')
    assert event['patch_id'] == item['patchId'], item['id']
    assert event['concrete']['midi_pitch'] == item['previewMidi'], item['id']
    if item['patchId'].startswith('sampled_'):
        try:
            synthesize_event(event, sample_rate=8000)
            raise AssertionError('sampled piano silently substituted')
        except ValueError as error:
            assert 'browser WAV' in str(error)
        continue
    left, right = synthesize_event(event, sample_rate=8000)
    assert left and right and all(math.isfinite(v) for v in left + right), item['id']
    assert max(abs(v) for v in left + right) > 0, item['id']
print(len(items))
`], {
    cwd: new URL("../../../", import.meta.url), encoding: "utf8",
    input: JSON.stringify(INSTRUMENTS.map(item => ({ ...item, doc: example(item) }))),
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(Number(result.stdout.trim()), INSTRUMENTS.length);
});
