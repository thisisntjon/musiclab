// Native voices run through a saturating chain and need velocities about a hundredth of a sampled voice's (scene_voice_levels.js).
// Generated scores already use them. Stand-ins and live keys did not, so they pinned the ceiling 24 dB above the sampled voices.
// The levels themselves are measured in a real browser: .qa-tools/pad-level-probe.cjs with PAD_GATE=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveVelocity, standInLevel, dimmedVelocity } from '../../../static/js/theory/scene_voice_levels.js';
import { materializePerformance } from '../../../static/js/theory/performance_capture.js';

test('a live key on a sampled voice stays as it was; a native voice comes down; drums come down', () => {
  assert.equal(liveVelocity('sampled_piano_v1', 'lead', true), .85);
  assert.ok(liveVelocity('pluck_lead', 'lead', false) < .05);
  assert.ok(liveVelocity('clean_bass', 'bass', false) < .05);
  assert.ok(liveVelocity('kick', 'drums', false) < .2);
});

test('dimming never raises a note', () => {
  assert.equal(dimmedVelocity(.0036), .0036, 'a native voice stays where it was');
  assert.equal(dimmedVelocity(.05), .05);
  assert.equal(dimmedVelocity(.2), .08, 'a sampled voice keeps its audible floor');
  assert.ok(Math.abs(dimmedVelocity(.8) - .176) < 1e-9);
  assert.ok(Math.abs(dimmedVelocity(0) - .176) < 1e-9, 'unset means the usual velocity');
});

test('what playing adds to the band stays at the band level', () => {
  const source = readFileSync(new URL('../../../static/js/audio/scheduler.js', import.meta.url), 'utf8');
  assert.match(source, /ENERGY_ROLL_LEVEL \* Math\.min\(\.95/);
  // Automatic rises/drops were removed; astra-build-effects exercises that behavior.
  assert.doesNotMatch(source, /Math\.max\(0?\.08/);
});

test('every role has a stand-in level', () => {
  for (const role of ['bass', 'lead', 'harmony', 'hocket', 'unknown']) assert.ok(standInLevel(role) > 0 && standInLevel(role) < .05, role);
});

test('both live routes use the live velocity and start one render block ahead', () => {
  const source = readFileSync(new URL('../../../static/js/audio/scheduler.js', import.meta.url), 'utf8');
  assert.match(source, /LIVE_START_DELAY_SEC = 0\.003/);
  assert.equal((source.match(/const now = ctx\.currentTime \+ LIVE_START_DELAY_SEC;/g) || []).length, 2);
  assert.ok((source.match(/liveVelocity\(/g) || []).length >= 2);
});

test('a stand-in is scaled where it sounds, so its recorded velocity still suits the voice it stands in for', () => {
  const source = readFileSync(new URL('../../../static/js/audio/voices.js', import.meta.url), 'utf8');
  assert.match(source, /event\.loading_voice \? standInLevel\(event\.role\)/);
});

test('a stand-in note kept in a song keeps the level it was heard at, on replay too', () => {
  const source = { id: 's', global_context: { bpm: 100 }, notes: [], song_cards: [] };
  const standIn = { time: 0, duration: .5, occurrence: 1, event: { id: 'k', source_note_id: 'jam-live-1', role: 'lead', patch_id: 'pluck_lead', requested_patch_id: 'sampled_piano_v1', loading_voice: true, provenance: 'user_placed', velocity: .85, concrete: { freq_hz: 440 } } };
  const nativeKey = { time: .5, duration: .5, occurrence: 2, event: { id: 'n', source_note_id: 'jam-live-2', role: 'lead', patch_id: 'pluck_lead', provenance: 'user_placed', velocity: .01, concrete: { freq_hz: 440 } } };
  const doc = materializePerformance(source, { version: 1, start: 0, end: 1, bpm: 100, bars: 1, events: [standIn, nativeKey] });
  assert.ok(Math.abs(doc.notes[0].velocity - .85 * standInLevel('lead')) < 1e-9);
  assert.equal(doc.notes[0].loading_voice, undefined, 'replay is not scaled a second time');
  assert.equal(doc.notes[0].requested_patch_id, 'sampled_piano_v1', 'what was asked for is still known');
  assert.equal(doc.notes[1].velocity, .01, 'a note that was not a stand-in is untouched');
  assert.equal(standIn.event.velocity, .85, 'the take itself is not changed');
});
