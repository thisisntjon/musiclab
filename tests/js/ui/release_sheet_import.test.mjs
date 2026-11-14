// Open-release audit S12 and S13: a sheet file (MusicXML) can neither freeze the page nor open as a song whose own
// backup is refused. Opened through the real PlayFlow handlers, screen and storage stubbed as in
// release_import_safety.test.mjs beside this file.
//   node --test tests/js/ui/release_sheet_import.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';
import { fromMusicXML, toMusicXML, MAX_SHEET_BYTES } from '../../../static/js/theory/score_sheet.js';
import { exportProjectJson, parseProjectJson } from '../../../static/js/theory/save_store.js';
import { validateProject } from '../../../static/js/theory/project_validation.js';
import { newPlayDoc, recordAct } from '../../../static/js/theory/session_rules.js';

function setup() {
  const values = new Map(), session = new Map();
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
  globalThis.document = { body: { classList: { toggle() {}, add() {}, contains: () => false } }, activeElement: null, getElementById: id => id === 'play-flow' ? root : null };
  const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
  flow._sparkAt = () => {};
  flow.explorationRandom = () => .37;
  const file = text => ({ size: new TextEncoder().encode(text).length, text: async () => text });
  return { flow, root, file };
}

/** A small sheet in the shape a notation program saves. `measures` is the inner XML of each measure after the first. */
function sheet({ beats = 4, beatType = 4, mode = 'major', fifths = 0, tempo = 100, first = '', notes = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>', measures = [] } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><work><work-title>Test sheet</work-title></work>
<part-list><score-part id="P1"><part-name>Tune</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>${fifths}</fifths><mode>${mode}</mode></key>
<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<direction><sound tempo="${tempo}"/></direction>${first}${notes}</measure>${measures.map((m, i) => `<measure number="${i + 2}">${m}</measure>`).join('')}</part>
</score-partwise>`;
}
const timed = fn => { const start = performance.now(); const value = fn(); return { value, ms: performance.now() - start }; };
const cardsOf = doc => doc.song_cards.length;
const allNotes = doc => [doc.notes, ...doc.song_cards.slice(1).map(card => card.material?.notes || [])].flat();

test('S12: one huge rest in a tiny sheet stays inside eight parts of four bars and opens at once', async () => {
  for (const duration of ['10000000', '10000000000']) {
    const text = sheet({ first: `<forward><duration>${duration}</duration></forward>` });
    assert.ok(text.length < 1000);
    const read = timed(() => fromMusicXML(text));
    assert.equal(read.value.ok, true);
    assert.ok(read.value.notes.every(n => n.step < 8 * 4 * 16), `no note starts past the last part (${read.value.notes.map(n => n.step)})`);
    const t = setup();
    const opened = timed(() => t.flow._openSheet(read.value));
    assert.ok(cardsOf(opened.value) <= 8, `at most 8 parts (${cardsOf(opened.value)})`);
    assert.ok(read.ms + opened.ms < 1000, `quick (${Math.round(read.ms + opened.ms)} ms)`);
    validateProject(opened.value);
  }
});

test('S12: notes past eight parts are left out, and a long sheet still makes 8 parts', () => {
  const measures = Array.from({ length: 40 }, () => '<note><pitch><step>E</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>');
  const read = fromMusicXML(sheet({ measures }));
  const doc = setup().flow._openSheet(read);
  assert.equal(cardsOf(doc), 8);
  assert.ok(allNotes(doc).every(n => n.step >= 0 && n.step < 64 && n.duration_steps <= 64));
  validateProject(doc);
});

test('S12: unclosed comments or instructions end the read at once instead of rescanning to the end', () => {
  for (const tail of ['<!--'.repeat(80000), '<?'.repeat(160000), `<score-partwise>${'<!--'.repeat(80000)}`]) {
    const text = `<?xml version="1.0"?>${tail}`;
    assert.ok(text.length < MAX_SHEET_BYTES);
    const read = timed(() => fromMusicXML(text));
    assert.equal(read.value.ok, false);
    assert.ok(read.ms < 250, `${Math.round(read.ms)} ms for ${text.length} characters`);
  }
});

test('S12: a sheet over 1 MiB is refused before it is read, with words on the screen', async () => {
  assert.equal(MAX_SHEET_BYTES, 1024 * 1024);
  const big = sheet().replace('</score-partwise>', `<!--${'x'.repeat(MAX_SHEET_BYTES)}--></score-partwise>`);
  assert.equal(fromMusicXML(big).reason, 'too-large');
  const t = setup();
  await t.flow._importProjectFile(t.file(big));
  assert.equal(t.flow.saveMessage, 'This sheet is too big to open. Your song is safe.');
});

test('S12 control: a normal sheet with comments and an instruction still opens', () => {
  const text = sheet().replace('<part-list>', '<!-- made by hand --><?app hint?><part-list>');
  const read = fromMusicXML(text);
  assert.equal(read.ok, true);
  assert.equal(read.notes.length, 1);
});

test('S13: a minor sheet opens as natural minor, and wild tempo and pitch are brought into range', () => {
  assert.equal(fromMusicXML(sheet({ mode: 'minor', fifths: -3 })).scale_type, 'natural_minor');
  assert.equal(fromMusicXML(sheet({ mode: 'minor', fifths: -3 })).root_pc, 0, 'C minor');
  for (const tempo of ['-50', '1e400', '100000', '0.0001', 'x']) {
    const bpm = fromMusicXML(sheet({ tempo })).bpm;
    assert.ok(Number.isFinite(bpm) && bpm >= 20 && bpm <= 400, `tempo ${tempo} -> ${bpm}`);
  }
  const wild = fromMusicXML(sheet({ notes: '<note><pitch><step>C</step><octave>x</octave></pitch><duration>4</duration></note>'
    + '<note><pitch><step>C</step><octave>99999</octave></pitch><duration>4</duration></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>' }));
  assert.ok(wild.notes.every(n => Number.isFinite(n.concrete.midi_pitch) && n.concrete.midi_pitch >= 0 && n.concrete.midi_pitch <= 127));
  assert.ok(wild.notes.some(n => n.concrete.midi_pitch === 62), 'the ordinary note is still there');
});

test('S13: every opened sheet passes the song check, so its editable backup opens again', async () => {
  for (const options of [{ mode: 'minor' }, { tempo: '-50' }, { tempo: '100000' }, { notes: '<note><pitch><step>C</step><octave>99999</octave></pitch><duration>4</duration></note>' }]) {
    const t = setup();
    await t.flow._importProjectFile(t.file(sheet(options)));
    assert.match(t.flow.saveMessage, /^Opened the sheet/, JSON.stringify(options));
    assert.equal(parseProjectJson(exportProjectJson(t.flow._canonicalDoc())).ok, true, `backup opens: ${JSON.stringify(options)}`);
  }
});

test('S13: a 6/8 or 2/4 sheet says so in plain words, and the open song stays', async () => {
  for (const [beats, beatType] of [[6, 8], [2, 4], [5, 4]]) {
    const t = setup();
    const song = newPlayDoc(); song.title = 'Open song'; recordAct(song, 'tap');
    await t.flow._importProjectFile(t.file(exportProjectJson(song)));
    await t.flow._importProjectFile(t.file(sheet({ beats, beatType })));
    assert.equal(t.flow.saveMessage, 'This sheet uses a beat we do not have yet. Your song is safe.');
    assert.equal(t.flow.doc.title, 'Open song');
  }
});

test('S13: a minor song goes to a sheet, opens, downloads as an editable song and opens again', async () => {
  const t = setup();
  const song = newPlayDoc(); song.title = 'Minor round trip'; song.global_context.scale_type = 'natural_minor'; song.global_context.root_pc = 9;
  song.notes.push({ id: 'own', role: 'lead', step: 0, duration_steps: 4, velocity: .8, patch_id: 'pluck_lead', pitch_lock_mode: 'concrete', concrete: { midi_pitch: 69 }, provenance: 'user_placed' });
  recordAct(song, 'tap');
  await t.flow._importProjectFile(t.file(exportProjectJson(song)));
  const xml = toMusicXML(t.flow._sheetScore());
  assert.match(xml, /<mode>minor<\/mode>/);
  await t.flow._importProjectFile(t.file(xml));
  assert.equal(t.flow.doc.global_context.scale_type, 'natural_minor');
  assert.equal(t.flow.doc.global_context.root_pc, 9, 'A minor stays A minor');
  const again = parseProjectJson(exportProjectJson(t.flow._canonicalDoc()));
  assert.equal(again.ok, true, again.reason);
  assert.equal(again.song.global_context.scale_type, 'natural_minor');
});

// Review of 0efa962 (S13-regression): the app's own sheet repeats a note id wherever a part's music repeats. When parts
// are shorter than four bars, two copies land in one opened part. The song check refuses repeated ids, so the sheet
// must give each copy its own id before that check.
async function sheetRoundTrip(song) {
  const t = setup();
  await t.flow._importProjectFile(t.file(exportProjectJson(song)));
  assert.match(t.flow.saveMessage, /^Opened/, 'the song itself opens');
  const xml = toMusicXML(t.flow._sheetScore());
  const read = fromMusicXML(xml);
  await t.flow._importProjectFile(t.file(xml));
  return { t, read };
}
const repeatedIdsInOnePart = (read, perPart) => {
  const seen = new Map();
  return read.notes.some(n => { const key = `${Math.floor(n.step / perPart)}|${n.id}`; const hit = seen.has(key); seen.set(key, 1); return hit; });
};

test('S13: the example song (3/4, short parts) goes to a sheet and opens again, and its backup opens', async () => {
  const text = readFileSync(new URL('../../../examples/three-beat-song.musiclab.json', import.meta.url), 'utf8');
  const parsed = parseProjectJson(text);
  assert.equal(parsed.ok, true, parsed.reason);
  const { t, read } = await sheetRoundTrip(parsed.song);
  assert.ok(repeatedIdsInOnePart(read, 4 * read.steps_per_bar), 'the sheet itself does repeat ids inside one part');
  assert.match(t.flow.saveMessage, /^Opened the sheet/);
  const again = parseProjectJson(exportProjectJson(t.flow._canonicalDoc()));
  assert.equal(again.ok, true, again.reason);
  validateProject(t.flow._openSheet(read));
});

test('S13: a song of two 2-bar parts goes to a sheet and opens again', async () => {
  const song = newPlayDoc(); song.title = 'Two short parts';
  song.notes.push({ id: 'own', role: 'lead', step: 0, duration_steps: 4, velocity: .8, patch_id: 'pluck_lead', pitch_lock_mode: 'concrete', concrete: { midi_pitch: 64 }, provenance: 'user_placed' });
  recordAct(song, 'tap');
  song.song_cards = [{ bars: 2, role_name: 'A', beat: true, tune: true, under: true, fx: null, big: false },
    { bars: 2, role_name: 'B', beat: true, tune: true, under: true, fx: null, big: false }];
  const { t, read } = await sheetRoundTrip(song);
  assert.ok(repeatedIdsInOnePart(read, 4 * read.steps_per_bar), 'the sheet itself does repeat ids inside one part');
  assert.match(t.flow.saveMessage, /^Opened the sheet/);
  const again = parseProjectJson(exportProjectJson(t.flow._canonicalDoc()));
  assert.equal(again.ok, true, again.reason);
});

test('S13 control: a sheet part with a repeated id is still made of the same notes, each with its own id', () => {
  const notes = '<note id="n1"><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>'
    + '<note id="n1"><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>'
    + '<note id="n1"><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration></note>'
    + '<note id="n1~2"><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration></note>';
  const read = fromMusicXML(sheet({ notes }));
  assert.equal(read.notes.length, 4);
  const doc = setup().flow._openSheet(read);
  assert.deepEqual(doc.notes.map(n => n.concrete.midi_pitch), [60, 62, 64, 65]);
  assert.equal(new Set(doc.notes.map(n => n.id)).size, 4);
  assert.equal(doc.notes[0].id, 'n1', 'the first copy keeps its id');
  validateProject(doc);
});

// Review of 0efa962 (S13-legacy): the old build wrote editable backups with scale_type "minor". They open as natural minor.
test('S13: an older backup with scale "minor" opens as natural minor; other unknown scales are still refused', () => {
  const song = newPlayDoc(); song.title = 'Old minor'; song.global_context.scale_type = 'minor';
  const parsed = parseProjectJson(exportProjectJson(song));
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(parsed.song.global_context.scale_type, 'natural_minor');
  const odd = newPlayDoc(); odd.global_context.scale_type = 'lydian';
  assert.equal(parseProjectJson(exportProjectJson(odd)).reason, 'unsupported_scale');
  const audit = 'V:/musiclab-audit-20261114/redteam/payloads/minor-rt/reopened-minor_song.json';
  if (existsSync(audit)) {
    const again = parseProjectJson(readFileSync(audit, 'utf8'));
    assert.equal(again.ok, true, again.reason);
    assert.equal(again.song.global_context.scale_type, 'natural_minor');
  }
});
