import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProjectJson, exportProjectJson, MAX_PROJECT_BYTES, MAX_PROJECT_FILE_BYTES } from '../../../static/js/theory/save_store.js';
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

// Open-release audit S14: the limit is for the song, without spacing, so an older spaced-out download still opens.
test('import byte limit is inclusive, counts the song and not its spacing, and unsupported envelopes are refused', () => {
  const base = JSON.stringify(newPlayDoc());
  assert.equal(parseProjectJson(base.padEnd(MAX_PROJECT_BYTES + 1, ' ')).ok, true, 'spacing does not count');
  assert.equal(parseProjectJson(base.padEnd(MAX_PROJECT_FILE_BYTES + 1, ' ')).reason, 'too_large', 'a file too big to read');
  const song = newPlayDoc(); song.title = '';
  const room = MAX_PROJECT_BYTES - JSON.stringify(song).length;
  song.title = 'x'.repeat(room);
  assert.equal(parseProjectJson(JSON.stringify(song)).ok, true, 'exactly at the limit');
  song.title += 'x';
  assert.equal(parseProjectJson(JSON.stringify(song)).reason, 'too_large', 'one byte over');
  assert.equal(parseProjectJson(song).reason, 'too_large', 'the same song handed over as an object');
  assert.equal(parseProjectJson({format:'musiclab.project.v99',song:newPlayDoc()}).reason, 'unsupported_format');
  assert.equal(parseProjectJson({format:'musiclab.project.v1',title:[],song:newPlayDoc()}).ok, false);
});

// Open-release audit B1: a part name is a short plain label. Markup characters or a long text never open.
test('part names with markup, over 40 characters, or not text are refused; ordinary names open', () => {
  const withName = role_name => { const song = newPlayDoc(); song.song_cards = [{ bars: 4, role_name }]; return song; };
  for (const name of ['Intro<meta http-equiv="refresh" content="0;url=http://example.test/">', '<style>body{}</style>', 'a>b', 'x'.repeat(41), 7, null, ['Intro']]) {
    assert.equal(parseProjectJson(withName(name)).ok, false, JSON.stringify(name));
  }
  for (const name of ['Intro', 'Big moment', 'Part 8 returns', 'x'.repeat(40), 'Canción & coda "two"']) {
    assert.equal(parseProjectJson(withName(name)).ok, true, name);
  }
});

// Open-release audit L5: names that a lookup table would mistake for its own built-ins, and a tune grid of the wrong shape.
test('built-in object names as sounds and a wrongly shaped tune grid are refused', () => {
  for (const patch of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
    const song = newPlayDoc(); song.notes[0].patch_id = patch;
    assert.equal(parseProjectJson(JSON.stringify(song)).ok, false, patch);
  }
  for (const grid of [{ main: 5, ending: 5 }, 'grid', [], { main: [], endingStates: { 2: { ending: 'x' } } }]) {
    const song = newPlayDoc(); song.tune_grid_state = grid;
    assert.equal(parseProjectJson(JSON.stringify(song)).ok, false, JSON.stringify(grid));
  }
  const song = newPlayDoc(); song.tune_grid_state = { main: [null], ending: [null], endingStates: { 2: { main: [], ending: [] } } };
  assert.equal(parseProjectJson(JSON.stringify(song)).ok, true, 'a grid of the right shape opens');
});
