// Saved songs regenerate their melody wheel from the composer, so the wheel each already-admitted
// style produces must never change. This pins a digest of every wheel cell for the styles admitted
// before the launch batch. Regenerate ONLY when a new composer version is introduced:
//   node tests/js/theory/composer-v5-saved-songs-stable.test.mjs --write
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v5.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {VOCABULARY_VERSION} from '../../../static/js/theory/melody_phrase_library_v1.js';

const goldenPath = fileURLToPath(new URL('./composer-v5-golden.json', import.meta.url));
const lead = [60, 64, 67, 72].map((m, i) => ({id: 'l' + i, role: 'lead', step: i * 16, duration_steps: 4, velocity: .6,
  provenance: 'jam_generated', patch_id: 'p', concrete: {midi_pitch: m}}));

export function wheelDigest(sceneId, root, scale) {
  const doc = {id: 'd', global_context: {root_pc: root, scale_type: scale}, jam_session: {scene_id: sceneId}};
  const ctx = captureMelodyContext({song_id: 's', bpm: 100, swing: .5, total_steps: 64, steps_per_bar: 16,
    events: lead.map(n => ({...n, concrete: {midi_pitch: n.concrete.midi_pitch + root}}))}, {phraseContext: phraseContext(doc)});
  const palette = buildMelodyPalette({...ctx, composerVersion: 5, vocabularyVersion: VOCABULARY_VERSION});
  const cells = Object.keys(palette).sort().map(key => [key, palette[key].notes.filter(n => n.role === 'lead')
    .map(n => [n.step, n.performance?.offset_steps ?? 0, n.duration_steps, n.concrete.midi_pitch, n.velocity])]);
  return crypto.createHash('sha256').update(JSON.stringify(cells)).digest('hex');
}

if (process.argv.includes('--write')) {
  const {COMPOSER_SCENES} = await import('../../../static/js/theory/melody_composer.js');
  const out = {};
  for (const id of COMPOSER_SCENES) out[id] = {'C major': wheelDigest(id, 0, 'major'), 'A minor': wheelDigest(id, 9, 'minor')};
  fs.writeFileSync(goldenPath, JSON.stringify(out, null, 1) + '\n');
  console.log('wrote', Object.keys(out).length, 'styles');
} else {
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  test('every style admitted before the launch batch still produces the identical wheel', () => {
    assert.equal(Object.keys(golden).length, 42);
    for (const [id, keys] of Object.entries(golden)) {
      assert.equal(wheelDigest(id, 0, 'major'), keys['C major'], `${id} in C major changed; saved songs would reopen differently`);
      assert.equal(wheelDigest(id, 9, 'minor'), keys['A minor'], `${id} in A minor changed; saved songs would reopen differently`);
    }
  });
}
