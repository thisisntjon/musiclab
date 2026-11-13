import test from 'node:test';
import assert from 'node:assert/strict';
import {padNoteName, padNoteNames, spokenNoteName, usesFlats, loadPadNoteNames, savePadNoteNames, PAD_NOTE_NAMES_KEY} from '../../../static/js/theory/pad_note_names.js';
import {melodyPads} from '../../../static/js/theory/dynamic_keys.js';

const names = (root, scale) => melodyPads({global_context: {root_pc: root, scale_type: scale}, jam_session: {live_keys: true, patchId: 'sampled_piano_v1'}}, null)
  .map(p => padNoteName(p, {rootPc: root, minor: /minor/.test(scale)}));

test('pads spell the scale the way that key is written', () => {
  assert.deepEqual(names(0, 'major'), ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
  assert.deepEqual(names(7, 'major'), ['G', 'A', 'B', 'C', 'D', 'E', 'F♯', 'G']);
  assert.deepEqual(names(5, 'major'), ['F', 'G', 'A', 'B♭', 'C', 'D', 'E', 'F']);
  assert.deepEqual(names(9, 'natural_minor'), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A']);
  assert.deepEqual(names(2, 'natural_minor'), ['D', 'E', 'F', 'G', 'A', 'B♭', 'C', 'D']);
  assert.deepEqual(names(4, 'natural_minor'), ['E', 'F♯', 'G', 'A', 'B', 'C', 'D', 'E']);
});

test('every one of the 24 keys gives eight names and never mixes sharps with flats', () => {
  for (let root = 0; root < 12; root++) for (const scale of ['major', 'natural_minor']) {
    const n = names(root, scale);
    assert.equal(n.length, 8);
    assert.equal(n[0], n[7], `${root} ${scale} starts and ends on home`);
    assert.ok(n.every(x => /^[A-G][♯♭]?$/.test(x)), `${root} ${scale}: ${n}`);
    assert.ok(!(n.some(x => x.includes('♭')) && n.some(x => x.includes('♯'))), `${root} ${scale} never mixes sharps and flats: ${n}`);
    assert.equal(n.some(x => x.includes('♯')), !usesFlats(root, /minor/.test(scale)) && n.some(x => x.length > 1), `${root} ${scale} follows its key`);
  }
});

test('drum pads and pads without a pitch get no note name', () => {
  assert.equal(padNoteName({role: 'drums', midi: 36}), null);
  assert.equal(padNoteName({role: 'lead'}), null);
  assert.equal(padNoteName(null), null);
});

test('spoken names and the remembered setting; off unless turned on, safe without storage', () => {
  assert.equal(spokenNoteName('B♭'), 'B flat');
  assert.equal(spokenNoteName('F♯'), 'F sharp');
  assert.equal(spokenNoteName('C'), 'C');
  const store = new Map(), storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
  assert.equal(loadPadNoteNames(storage), false);
  assert.equal(savePadNoteNames(storage, true), true);
  assert.equal(store.get(PAD_NOTE_NAMES_KEY), 'on');
  assert.equal(loadPadNoteNames(storage), true);
  savePadNoteNames(storage, false);
  assert.equal(loadPadNoteNames(storage), false);
  assert.equal(loadPadNoteNames(undefined), false);
  assert.equal(loadPadNoteNames({getItem() { throw new Error('blocked'); }}), false);
  assert.equal(savePadNoteNames({setItem() { throw new Error('blocked'); }}, true), false);
});

test('a row of pads avoids using one letter twice when the other spelling can', () => {
  const row = pcs => pcs.map(n => ({role: 'lead', midi: 60 + n}));
  // C mixolydian (modal jazz, blues): the seventh is B flat, not A sharp.
  assert.deepEqual(padNoteNames(row([0, 2, 4, 5, 7, 9, 10, 12]), {rootPc: 0}), ['C', 'D', 'E', 'F', 'G', 'A', 'B♭', 'C']);
  // C dorian: E flat and B flat.
  assert.deepEqual(padNoteNames(row([0, 2, 3, 5, 7, 9, 10, 12]), {rootPc: 0}), ['C', 'D', 'E♭', 'F', 'G', 'A', 'B♭', 'C']);
  // G major keeps its F sharp; a plain C major row is unchanged.
  assert.deepEqual(padNoteNames(row([7, 9, 11, 12, 14, 16, 18, 19]), {rootPc: 7}), ['G', 'A', 'B', 'C', 'D', 'E', 'F♯', 'G']);
  assert.deepEqual(padNoteNames(row([0, 2, 4, 5, 7, 9, 11, 12]), {rootPc: 0}), ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
  // Drum pads in a row get no name.
  assert.deepEqual(padNoteNames([{role: 'drums', midi: 36}, {role: 'lead', midi: 60}]), [null, 'C']);
  assert.deepEqual(padNoteNames(null), []);
});
