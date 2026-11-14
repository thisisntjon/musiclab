// Open-release audit, opening and keeping song files (S3, S11, S14, L5, L31). Each finding is tried through the real
// PlayFlow handlers with the screen and storage stubbed as in earlier_song_hostile.test.mjs, beside a control that
// shows the ordinary case still works.
//   node --test tests/js/ui/release_import_safety.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { newPlayDoc, recordAct } from '../../../static/js/theory/session_rules.js';
import { checkPrompt } from '../../../static/js/theory/plain_language.js';
import { exportProjectJson, parseProjectJson, savePiece, stashWorkingSong, loadPiece, loadWorkingSong, songLibrary, MAX_PROJECT_BYTES }
  from '../../../static/js/theory/save_store.js';

function setup() {
  const values = new Map(), session = new Map();
  const downloads = [];
  globalThis.window = {
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k),
      get length() { return values.size; }, key: i => [...values.keys()][i] ?? null },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }), setInterval: () => 1, clearInterval() {},
  };
  const root = { innerHTML: '', insertAdjacentHTML(where, html) { this.innerHTML = where === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const scheduler = {
    isPlaying: false, liveNotes: new Map(), masterBus: { piano: {}, disposed: false }, audioCtx: { currentTime: 0 },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {},
    unlock: async () => {}, preparePiano: async () => ({}), previewSound() {}, previewBar: () => true,
    noteOn() { return null; }, noteOff() {}, stop() { this.isPlaying = false; }, start() { this.isPlaying = true; }, markPerformanceKept() {},
    capturePerformance: () => null, activeJamBacking: () => null, activeJamContext: () => null,
    seekToStep() {}, toggleMuteLayer() {}, requestJamAnswer() { return true; }, setAutomaticAnswers() {}, freezeJamLead() {},
    jamAnswerStatus: () => '', jamAnswerReadiness: () => ({ state: 'ready', label: 'Answer this', message: '' }), cancelJamAnswer() {},
  };
  globalThis.document = { body: { classList: { toggle() {}, add() {}, contains: () => false }, appendChild() {}, removeChild() {} }, activeElement: null,
    getElementById: id => id === 'play-flow' ? root : null,
    createElement: () => { const a = { click() { downloads.push({ name: a.download, blob: a.blob }); } }; return a; } };
  globalThis.URL.createObjectURL = blob => { downloads.blob = blob; return 'blob:test'; };
  globalThis.URL.revokeObjectURL = () => {};
  const said = [];
  const flow = new PlayFlow({ scheduler, _announce: m => said.push(String(m)), _logSessionEvent() {} });
  flow._sparkAt = () => {};
  flow.explorationRandom = () => .37;
  const press = key => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
  const file = text => ({ size: new TextEncoder().encode(text).length, text: async () => text });
  return { flow, root, said, press, values, downloads, file, storage: globalThis.window.localStorage };
}

/** A song the person made: one own note and one act, so it is listed and stashed like real work. */
function ownSong({ id, title, bpm = 100 }) {
  const song = newPlayDoc();
  Object.assign(song, { id, title });
  song.global_context.bpm = bpm;
  song.play_session.start_bpm = bpm;
  song.notes.push({ id: `${id}-own`, role: 'lead', step: 0, duration_steps: 2, velocity: .8, patch_id: 'pluck_lead',
    pitch_lock_mode: 'concrete', concrete: { midi_pitch: 64 }, provenance: 'user_placed' });
  recordAct(song, 'tap_note');
  return song;
}

const visibleText = html => html.replace(/<[^>]+>/g, ' ');

test('S3: a file with the id of a song here opens as a copy; the saved song and its unsaved edits both stay', async () => {
  const t = setup();
  const mine = ownSong({ id: 'shared-start-id', title: 'My own song' });
  assert.equal(savePiece(t.storage, mine).ok, true);
  const edited = { ...JSON.parse(JSON.stringify(mine)), title: 'My own song - new chorus (unsaved)' };
  edited.global_context.bpm = 120;
  assert.equal(stashWorkingSong(t.storage, edited), true);
  const friend = ownSong({ id: 'shared-start-id', title: 'Friend song', bpm: 140 });
  await t.flow._importProjectFile(t.file(exportProjectJson(friend)));
  assert.notEqual(t.flow.doc.id, 'shared-start-id', 'the opened file gets its own id');
  assert.equal(t.flow.doc.title, 'Friend song (opened copy)');
  assert.equal(t.flow.doc.global_context.bpm, 140, 'the music in the file is what opened');
  assert.equal(loadPiece(t.storage, 'shared-start-id').title, 'My own song', 'the saved song is unchanged');
  assert.equal(loadWorkingSong(t.storage, 'shared-start-id')?.title, 'My own song - new chorus (unsaved)', 'the unsaved edits are still here');
  await t.press('save');
  assert.equal(loadPiece(t.storage, 'shared-start-id').title, 'My own song', 'Save keeps the copy in its own spot');
  assert.equal(loadPiece(t.storage, t.flow.doc.id).title, 'Friend song (opened copy)');
  assert.equal(songLibrary(t.storage).songs.length, 2);
});

test('S3: a file with the id of a song in Trash also opens as a copy, so its edits can be kept', async () => {
  const t = setup();
  const mine = ownSong({ id: 'trashed-id', title: 'Old song' });
  savePiece(t.storage, mine);
  t.storage.setItem('musiclab.trash.v1', JSON.stringify([{ id: 'trashed-id', removed_at: new Date().toISOString() }]));
  await t.flow._importProjectFile(t.file(exportProjectJson(mine)));
  assert.notEqual(t.flow.doc.id, 'trashed-id');
  assert.equal(t.flow.draftSaveFailed, false, 'the opened copy can be kept');
});

test('S3 control: a new id keeps its id and title, and the same file opened again over its own unchanged song stays one song', async () => {
  const t = setup();
  const song = ownSong({ id: 'only-here', title: 'Only here' });
  await t.flow._importProjectFile(t.file(exportProjectJson(song)));
  assert.equal(t.flow.doc.id, 'only-here');
  assert.equal(t.flow.doc.title, 'Only here');
  await t.press('save');
  const saved = loadPiece(t.storage, 'only-here');
  await t.flow._importProjectFile(t.file(exportProjectJson(saved)));
  assert.equal(t.flow.doc.id, 'only-here', 'the same song is not copied');
  assert.equal(songLibrary(t.storage).songs.length, 1);
});

for (const [name, text] of [['broken JSON', '{"not": "a song"'], ['JSON that is not a song', '{"hello":"world"}'], ['a picture', '\x89PNG\r\n\x1a\n']]) {
  test(`S11: ${name} from Import song and from Open file shows a message on the screen, next to the control`, async () => {
    const t = setup();
    t.flow.libraryOpen = true; t.flow.render();
    await t.flow._importProjectFile(t.file(text));
    const library = t.root.innerHTML;
    const at = library.indexOf('data-key="open-project"');
    assert.ok(at > 0);
    const near = visibleText(library.slice(at, at + 600));
    assert.match(near, /That is not a song we can use\. Your songs are safe\./, 'shown next to Import song');
    t.flow.libraryOpen = false; t.flow.demoToolsOpen = true; t.flow.render();
    const start = t.root.innerHTML, open = start.indexOf('data-key="open-project"');
    assert.match(visibleText(start.slice(open, open + 900)), /That is not a song we can use\./, 'shown next to Open file');
    assert.doesNotMatch(start.slice(open, open + 900), /class="[^"]*sr-only/, 'the message is not hidden');
  });
}

test('S11: the message goes when the next thing is pressed, and a good file shows no error', async () => {
  const t = setup();
  t.flow.libraryOpen = true;
  await t.flow._importProjectFile(t.file('{"hello":"world"}'));
  assert.match(t.root.innerHTML, /not a song we can use/);
  await t.press('library-trash');
  assert.doesNotMatch(t.root.innerHTML, /not a song we can use/);
  await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: 'good', title: 'Good' }))));
  assert.equal(t.flow.doc.id, 'good');
  t.flow.stage = 'start'; t.flow.libraryOpen = true; t.flow.render();
  assert.doesNotMatch(t.root.innerHTML, /not a song we can use|too big/);
});

test('L5: a file that fails part-way leaves the open song, its grids and its screen as they were', async () => {
  for (const mutate of [
    song => { song.notes.push({ id: 'bad-patch', role: 'drums', step: 0, duration_steps: 1, velocity: .5, patch_id: 'toString', concrete: { midi_pitch: 36 }, provenance: 'jam_generated' }); },
    song => { song.tune_grid_state = { main: 5, ending: 5 }; },
  ]) {
    const t = setup();
    const mine = ownSong({ id: 'open-song', title: 'Open song' });
    await t.flow._importProjectFile(t.file(exportProjectJson(mine)));
    t.flow._go('song');
    const before = { doc: JSON.stringify(t.flow.doc), beat: JSON.stringify(t.flow.beatGrid), tune: JSON.stringify(t.flow.tuneGrid), stage: t.flow.stage };
    const bad = ownSong({ id: 'bad-file', title: 'Bad file' });
    mutate(bad);
    await t.flow._importProjectFile(t.file(JSON.stringify(bad)));
    assert.equal(t.flow.doc.id, 'open-song', 'the open song is still the open song');
    assert.equal(JSON.stringify(t.flow.doc), before.doc);
    assert.equal(JSON.stringify(t.flow.beatGrid), before.beat);
    assert.equal(JSON.stringify(t.flow.tuneGrid), before.tune);
    assert.equal(t.flow.stage, before.stage);
    assert.ok(!songLibrary(t.storage).songs.some(row => row.id === 'bad-file'), 'the refused file is never kept');
    await t.press('play');
    assert.ok(!songLibrary(t.storage).songs.some(row => row.id === 'bad-file'), 'nor after the next press');
  }
});

test('L5: a file that passes the check but fails after it was drawn and kept leaves no trace: open song, grids, screen and drafts', async () => {
  const t = setup();
  await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: 'open-song', title: 'Open song' }))));
  t.flow._go('song');
  const before = { doc: JSON.stringify(t.flow.doc), beat: JSON.stringify(t.flow.beatGrid), tune: JSON.stringify(t.flow.tuneGrid), stage: t.flow.stage,
    drafts: t.storage.getItem('musiclab.working.v1') };
  const go = t.flow._go;
  t.flow._go = function (stage, options) { if (this.doc?.id === 'late-failure') throw new Error('drawing failed'); return go.call(this, stage, options); };
  await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: 'late-failure', title: 'Late failure' }))));
  t.flow._go = go;
  assert.equal(t.flow.doc.id, 'open-song');
  assert.equal(JSON.stringify(t.flow.doc), before.doc);
  assert.equal(JSON.stringify(t.flow.beatGrid), before.beat);
  assert.equal(JSON.stringify(t.flow.tuneGrid), before.tune);
  assert.equal(t.flow.stage, before.stage);
  const songsIn = raw => { const { updated_at, ...record } = JSON.parse(raw); return JSON.stringify(record); };
  assert.equal(songsIn(t.storage.getItem('musiclab.working.v1')), songsIn(before.drafts), 'the unfinished songs are as they were');
  assert.doesNotMatch(t.storage.getItem('musiclab.working.v1'), /late-failure/, 'the failed song was not kept');
  assert.equal(t.flow.importMessage, 'That is not a song we can use. Your songs are safe.');
});

test('L5: a song that fails while loading from storage also leaves the open song as it was', async () => {
  const t = setup();
  await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: 'open-song', title: 'Open song' }))));
  const before = JSON.stringify(t.flow.doc);
  const broken = ownSong({ id: 'broken-saved', title: 'Broken' });
  broken.tune_grid_state = { main: 5, ending: 5 };
  stashWorkingSong(t.storage, broken);
  assert.throws(() => t.flow._resumeWorking('broken-saved'));
  assert.equal(JSON.stringify(t.flow.doc), before);
});

test('L5 control: a good file replaces the open song', async () => {
  const t = setup();
  await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: 'first', title: 'First' }))));
  await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: 'second', title: 'Second' }))));
  assert.equal(t.flow.doc.id, 'second');
});

test('L31 and S14: Download editable song writes compact JSON named <title>.musiclab.json, keeping letters of any language', async () => {
  const names = [];
  for (const [title, expected] of [['My Song', 'my_song.musiclab.json'], ['Canción del mar', 'canción_del_mar.musiclab.json'],
    ['夜の歌', '夜の歌.musiclab.json'], ['***', 'my_song.musiclab.json'], ['a/b:c*d?', 'a_b_c_d.musiclab.json']]) {
    const t = setup();
    await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: `song-${names.length}`, title }))));
    t.flow._downloadProject();
    names.push(t.downloads.at(-1).name);
    assert.equal(t.downloads.at(-1).name, expected);
    if (names.length === 1) {
      const text = await t.downloads.blob.text();
      assert.doesNotMatch(text, /\n/, 'compact: no new lines');
      assert.equal(text, JSON.stringify(JSON.parse(text)), 'compact: no spaces between values');
      assert.equal(parseProjectJson(text).ok, true, 'and it opens again');
    }
  }
});

// Review of the L31 fix (sibling): the sound file, each part's sound file and the sheet keep the title's letters too.
test('L31: Download sound, a part sound and the sheet are named from the title in any language', async () => {
  for (const [title, base] of [['My Song', 'my_song'], ['Canción del mar', 'canción_del_mar'], ['夜の歌', '夜の歌'], ['***', 'my_song']]) {
    const t = setup();
    await t.flow._importProjectFile(t.file(exportProjectJson(ownSong({ id: `song-${base}`, title }))));
    t.flow.app.scheduler.renderSongOfflineToWavBlob = async () => new Blob(['RIFF'], { type: 'audio/wav' });
    await t.flow._download();
    assert.equal(t.downloads.at(-1)?.name, `${base}.wav`, title);
    await t.flow._downloadStem('drums');
    assert.equal(t.downloads.at(-1)?.name, `${base}_drums.wav`, title);
    assert.equal(t.flow.saveMessage, `Downloaded "${base}_drums.wav".`);
    t.flow._downloadSheet();
    assert.equal(t.downloads.at(-1)?.name, `${base}.musicxml`, title);
  }
});

test('S14: a song near the size limit says so when it is downloaded; a small one does not', async () => {
  const t = setup();
  const big = ownSong({ id: 'big-song', title: 'Big song' });
  big.long_notes = '';
  big.long_notes = 'x'.repeat(Math.floor(MAX_PROJECT_BYTES * .95) - exportProjectJson(big).length);
  const text = exportProjectJson(big);
  assert.ok(text.length > MAX_PROJECT_BYTES * .9 && text.length <= MAX_PROJECT_BYTES, `test song is near the limit (${text.length})`);
  await t.flow._importProjectFile(t.file(text));
  assert.equal(t.flow.doc.id, 'big-song', 'it opens');
  t.flow._downloadProject();
  assert.match(t.flow.saveMessage, /This song is big\. It may be too big to load here again\./);
  const small = setup();
  await small.flow._importProjectFile(small.file(exportProjectJson(ownSong({ id: 'small', title: 'Small' }))));
  small.flow._downloadProject();
  assert.doesNotMatch(small.flow.saveMessage, /too big/);
});

test('S14: an older spaced-out download over 5 MiB opens when the song itself fits', async () => {
  const t = setup();
  const song = ownSong({ id: 'spaced', title: 'Spaced' });
  song.notes.push(...Array.from({ length: 9000 }, (_, i) => ({ id: `n-${i}`, role: 'lead', step: i % 64, duration_steps: 1, velocity: .5,
    patch_id: 'pluck_lead', pitch_lock_mode: 'concrete', concrete: { midi_pitch: 60 }, provenance: 'jam_generated' })));
  const spaced = JSON.stringify({ format: 'musiclab.project.v1', title: 'Spaced', song }, null, 8);
  assert.ok(spaced.length > MAX_PROJECT_BYTES && JSON.stringify(JSON.parse(spaced)).length < MAX_PROJECT_BYTES, 'spaced file over, compact under');
  await t.flow._importProjectFile(t.file(spaced));
  assert.equal(t.flow.doc?.id, 'spaced');
});

test('the new words on the screen read at grade 2, and each sentence is short', async () => {
  const t = setup();
  const shown = new Set();
  const note = () => { for (const words of [t.flow.saveMessage, t.flow.importMessage]) if (words) shown.add(words); };
  for (const text of ['{"hello":"world"}', ' '.repeat(17 * 1024 * 1024)]) { await t.flow._importProjectFile(t.file(text)); note(); }
  const sheetWith = time => `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>T</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions>${time}</attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
  for (const text of [sheetWith('<time><beats>6</beats><beat-type>8</beat-type></time>'), '<?xml version="1.0"?><score-partwise><!--', `${sheetWith('')}<!--${'x'.repeat(1024 * 1024)}-->`]) {
    await t.flow._importProjectFile(t.file(text)); note();
  }
  const mine = ownSong({ id: 'twice', title: 'Twice' });
  savePiece(t.storage, mine);
  await t.flow._importProjectFile(t.file(exportProjectJson({ ...mine, title: 'Twice changed' }))); note();
  const big = ownSong({ id: 'big-words', title: 'Big' }); big.long_notes = ''; big.long_notes = 'x'.repeat(Math.floor(MAX_PROJECT_BYTES * .95) - exportProjectJson(big).length);
  await t.flow._importProjectFile(t.file(exportProjectJson(big))); t.flow._downloadProject(); note();
  shown.add('Songs here will be lost when you close the page. Use Download to keep songs.');
  assert.ok(shown.size >= 7, [...shown].join(' | '));
  for (const words of shown) {
    const plain = words.replace(/"[^"]*"/g, 'it');
    assert.deepEqual(checkPrompt(plain).problems, [], words);
  }
});
