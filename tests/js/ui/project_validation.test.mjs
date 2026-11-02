import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProjectJson, exportProjectJson, MAX_PROJECT_BYTES } from '../../../static/js/theory/save_store.js';
import { newPlayDoc } from '../../../static/js/theory/session_rules.js';

test('imports preserve original held notes and independent section copies', () => {
  const song = newPlayDoc();
  const note = {id:'held', role:'lead', step:50, duration_steps:3.125, velocity:.7,
    performance:{version:1, offset_steps:.23}, concrete:{midi_pitch:64}, provenance:'user_placed', source_note_id:'original'};
  song.notes = [note];
  song.song_cards = [{id:'a', bars:1, material:{notes:[note]}}, {id:'b', bars:4, material:{notes:[note]}}];
  song.capture_source = {notes:[note]};
  const parsed = parseProjectJson(exportProjectJson(song));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.song.notes, song.notes);
  assert.deepEqual(parsed.song.song_cards, song.song_cards);
  assert.deepEqual(parsed.song.capture_source, song.capture_source);
});

test('real legacy preset imports without changing musical content', () => {
  const song = JSON.parse(readFileSync(new URL('../../../presets/heavy_bass_110.json', import.meta.url), 'utf8'));
  const result = parseProjectJson(JSON.stringify(song));
  assert.equal(result.ok, true);
  assert.deepEqual(result.song.notes, song.notes);
});

test('malformed music is refused without mutating the input', () => {
  for (const mutate of [s=>s.notes=[null], s=>s.global_context.bpm=-1,
    s=>s.global_context.bpm='100', s=>s.notes=[{step:.5}],
    s=>s.drum_kit='constructor', s=>s.active_progression_id='constructor',
    s=>s.song_cards=[{bars:4,material:{notes:[null]}}],
    s=>s.jam_start={notes:[{relational:{chord_tone_index:'bad'}}]},
    s=>s.notes=[{relational:{scale_degree_offset:-8}}]]) {
    const song = newPlayDoc(); mutate(song);
    const before = JSON.stringify(song);
    assert.equal(parseProjectJson(song).ok, false);
    assert.equal(JSON.stringify(song), before);
  }
});

test('import byte limit is inclusive and unsupported envelopes are refused', () => {
  const base = JSON.stringify(newPlayDoc());
  assert.equal(parseProjectJson(base.padEnd(MAX_PROJECT_BYTES, ' ')).ok, true);
  assert.equal(parseProjectJson(base.padEnd(MAX_PROJECT_BYTES + 1, ' ')).reason, 'too_large');
  assert.equal(parseProjectJson({format:'musiclab.project.v99',song:newPlayDoc()}).reason, 'unsupported_format');
  assert.equal(parseProjectJson({format:'musiclab.project.v1',title:[],song:newPlayDoc()}).ok, false);
});
