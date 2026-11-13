import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSER_SCENES, captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {melodyChoice, buildMelodyPalette, VOCABULARY_VERSION} from '../../../static/js/theory/melody_composer_v4.js';
import {PHRASES} from '../../../static/js/theory/melody_phrase_library_v1.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {skaBacking} from '../../../static/js/theory/ska_scene.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {materializePerformance} from '../../../static/js/theory/performance_capture.js';

function baseSong(root = 0) {
  return {
    song_id: 'lead-gate-check',
    bpm: 100,
    swing: 0.5,
    steps_per_bar: 16,
    total_steps: 64,
    events: [
      {id: 'own-0', role: 'lead', step: 0, duration_steps: 4, duration_sec: 0.6, velocity: 0.62, patch_id: 'sampled_piano_v1', provenance: 'user_placed', concrete: {midi_pitch: 60 + root}},
      {id: 'band-0', role: 'bass', step: 0, duration_steps: 4, duration_sec: 0.6, velocity: 0.4, patch_id: 'sampled_bass_v1', provenance: 'jam_generated', concrete: {midi_pitch: 36 + root}},
    ],
  };
}

test('off-circle ska-v1 exposes valid harmony matching skaBacking chord tones', () => {
  for (const [root, scale] of [[0, 'major'], [2, 'natural_minor']]) {
    const doc = {notes: [], auto_harmony_stabs: false, global_context: {bpm: 120, root_pc: root, scale_type: scale}, jam_session: {scene_id: 'ska-v1', density: 1, color: 1}};
    const ctx = phraseContext(doc);
    assert.ok(ctx?.harmony, 'ska-v1 must carry harmony off the circle');
    const events = skaBacking(doc, doc.jam_session, [], []);
    const harmonyNotes = events.filter(n => n.role === 'harmony');
    assert.ok(harmonyNotes.length > 0);
    for (const n of harmonyNotes) {
      assert.ok(ctx.harmony.bars[Math.floor(n.step / 16)].includes((n.concrete.midi_pitch - root + 120) % 12));
    }
  }
});

test('first arrow step (0.1) leaves Original while centre dead-zone keeps exact Original', () => {
  assert.equal(melodyChoice({x: 0, y: 0}).key, 'original');
  assert.equal(melodyChoice({x: 0.04, y: 0}).key, 'original');
  assert.notEqual(melodyChoice({x: 0.1, y: 0}).key, 'original');
  assert.notEqual(melodyChoice({x: -0.1, y: 0}).key, 'original');
  assert.notEqual(melodyChoice({x: 0, y: 0.1}).key, 'original');
  assert.notEqual(melodyChoice({x: 0, y: -0.1}).key, 'original');
});

test('v4 wheel map eliminates duplicate cells, monotone collapse, reversals, and late starts across roots and modes', () => {
  const phraseDistance = (a, b) => {
    const aa = new Set(a.notes.map(n => n[0])), bb = new Set(b.notes.map(n => n[0])), union = new Set([...aa, ...bb]);
    const rhythm = 1 - [...aa].filter(t => bb.has(t)).length / union.size;
    const contour = p => Array.from({length: 8}, (_, i) => p.notes[Math.round(i * (p.notes.length - 1) / 7)][1] / Math.max(1, p.range));
    const ac = contour(a), bc = contour(b), shape = ac.reduce((sum, v, i) => sum + Math.abs(v - bc[i]), 0) / 8;
    const ending = p => p.notes.at(-1)[1] - p.notes.at(-2)[1];
    return rhythm * 4 + shape * 3 + Math.abs(ending(a) - ending(b)) / 8 + Math.abs(a.notes.length - b.notes.length) / 12 + Math.abs(a.range - b.range) / 12 + Math.abs(a.rest - b.rest) / 32 + Math.abs(a.repeats - b.repeats);
  };

  const V4_SCENES = ['ska-v1', 'rocksteady-v1', 'reggae-v1', 'house-v1', 'doo-wop-v1', 'electro-v1', 'grime-v1', 'footwork-v1', 'baltimore-club-v1'];
  for (const sceneId of V4_SCENES) {
    for (const [root, scale] of [[0, 'major'], [9, 'natural_minor']]) {
      const doc = {global_context: {root_pc: root, scale_type: scale}, jam_session: {scene_id: sceneId}};
      const ctx = {...captureMelodyContext(baseSong(root), {phraseContext: phraseContext(doc)}), composerVersion: 4, vocabularyVersion: VOCABULARY_VERSION};
      const palette = buildMelodyPalette(ctx);
      const sigs = new Map();
      let moves = 0, flat = 0, rev = 0;

      for (let t = 0; t < 24; t++) {
        for (let r = 1; r <= 4; r++) {
          const key = `${t}:${r}`, plan = palette[key];
          const lead = plan.notes.filter(n => n.role === 'lead').sort((a, b) => a.step - b.step);
          assert.ok(lead[0].step < 12, `${sceneId} ${key} starts before beat 4`);
          const sig = lead.map(n => `${n.step}:${n.duration_steps}:${n.concrete.midi_pitch}`).join('|');
          sigs.set(key, sig);

          let run = 1, best = 1;
          for (let i = 1; i < lead.length; i++) {
            const sm = lead[i].derivation.source_pitch - lead[i - 1].derivation.source_pitch;
            const m = lead[i].concrete.midi_pitch - lead[i - 1].concrete.midi_pitch;
            if (sm) {
              moves++;
              if (m === 0) flat++;
              else if (Math.sign(m) !== Math.sign(sm)) rev++;
            }
            run = m === 0 ? run + 1 : 1;
            if (run > best) best = run;
          }
          assert.ok(best / lead.length < 0.5, `${sceneId} ${key} avoids monotone collapse`);
        }
      }

      // Every single one of the 96 wheel cells is distinct (no opposite or adjacent duplicates).
      assert.equal(new Set(sigs.values()).size, 96, `${sceneId} (${scale}): all 96 wheel cells distinct`);
      assert.equal(rev, 0, `${sceneId} (${scale}): zero contour direction reversals`);
      assert.ok(flat / moves < 0.15, `${sceneId} (${scale}): flattened share ${flat / moves} < 0.15`);

      // Radial steps inside each sector step monotonically outward from the Ring 1 anchor.
      for (let region = 0; region < 8; region++) {
        const turn = (region * 3) % 24;
        const p1 = PHRASES.find(p => p.id === palette[`${turn}:1`].phraseId);
        const dists = [2, 3, 4].map(r => phraseDistance(p1, PHRASES.find(p => p.id === palette[`${turn}:${r}`].phraseId)));
        assert.ok(dists[0] <= dists[1] + 1e-9 && dists[1] <= dists[2] + 1e-9, `${sceneId} region ${region} develops outward monotonically`);
      }
    }
  }
});

test('picked-band guard flushes circleIntent and detects pending scene/blend/timeout cleanly', async () => {
  const flow = Object.create(PlayFlow.prototype);
  let flushed = 0;
  flow._flushMusicField = () => {
    flushed++;
    if (flow.circleIntent) {
      flow.doc.jam_session.scene_id = flow.circleIntent.id;
      flow.circleIntent = null;
    }
  };
  let reached = {phraseContext: {sceneId: 'hip-hop-v1'}};
  flow.doc = {id: 'tx-check', jam_session: {scene_id: 'hip-hop-v1'}};
  flow.circleIntent = {id: 'house-v1', field: null};
  flow.stage = 'jam';
  flow.app = {
    scheduler: {isPlaying: true, stopGeneration: 0, activeJamBacking: () => reached, capturePerformance: () => null},
    _announce: () => {},
  };
  assert.equal(flow._pickedBandPending(), true, 'unflushed circleIntent counts as pending');

  const realSetTimeout = globalThis.setTimeout;
  try {
    globalThis.setTimeout = cb => { queueMicrotask(cb); return 0; };
    await flow._enterMelodyField();
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
  assert.equal(flushed, 1, '_enterMelodyField flushes pending circleIntent before waiting');
  assert.equal(flow.melodyField, undefined, 'timeout refuses rather than opening outgoing band');

  // Also verify bridge, pendingJamBacking, future commit, and 40ms cold-clock timeline windows:
  reached = {phraseContext: {sceneId: 'house-v1'}};
  flow.doc.jam_session.scene_id = 'house-v1';
  assert.equal(flow._pickedBandPending(), false, 'cleanly reached scene is not pending');
  flow.app.scheduler.jamBridgeStage = 1;
  assert.equal(flow._pickedBandPending(), true, 'hybrid bridge bar 1 counts as pending');
  flow.app.scheduler.jamBridgeStage = null;
  flow.app.scheduler.pendingJamBacking = [];
  assert.equal(flow._pickedBandPending(), true, 'queued pendingJamBacking counts as pending');
  flow.app.scheduler.pendingJamBacking = null;
  flow.app.scheduler.audioCtx = {currentTime: 1.0};
  flow.app.scheduler.lastJamBackingCommit = {audioTime: 1.04};
  assert.equal(flow._pickedBandPending(), true, 'future commit audioTime counts as pending');
  flow.app.scheduler.lastJamBackingCommit = {audioTime: 0.9};
  flow.app.scheduler.jamBackingTimeline = [{time: 1.04}];
  const prevActive = flow.app.scheduler.activeJamBacking;
  flow.app.scheduler.activeJamBacking = () => null;
  assert.equal(flow._pickedBandPending(), true, '40ms pre-commit jamBackingTimeline window counts as pending');
  flow.app.scheduler.activeJamBacking = prevActive;
});

test('opt-in upgrade works while playing and preserves user_placed notes on legacy fallback saves (paused & played)', async () => {
  const legacyJamPreKeep = {
    id: 'legacy-save',
    global_context: {bpm: 100, bars: 4, steps_per_bar: 16, root_pc: 0, scale_type: 'major'},
    jam_session: {scene_id: 'ska-v1'},
    notes: [{id: 'band-0', role: 'bass', step: 0, duration_steps: 4, velocity: 0.4, patch_id: 'sampled_bass_v1', provenance: 'jam_generated', concrete: {midi_pitch: 36}}],
  };
  const personalNote = {id: 'jam-live-own-1', role: 'lead', step: 2, duration_steps: 4, velocity: 0.72, patch_id: 'sampled_piano_v1', provenance: 'user_placed', concrete: {midi_pitch: 64}};
  const legacySavedDoc = {
    ...structuredClone(legacyJamPreKeep),
    notes: [personalNote, ...legacyJamPreKeep.notes],
    capture_source: structuredClone(legacyJamPreKeep), // empty Jam pre-Keep doc!
    captured_performance: {version: 1, start: 0, end: 2, events: [{event: personalNote, time: 0.3, duration: 0.6}]},
    capture_notes: {melody_field: {version: 3, realized_position: {x: 0, y: 0}}},
  };
  const song = baseSong(0);
  song.events = [
    {...personalNote, duration_sec: 0.6},
    {...legacyJamPreKeep.notes[0], duration_sec: 0.6},
  ];
  const upgradeCtx = {...captureMelodyContext(song, {phraseContext: phraseContext(legacySavedDoc)}), composerVersion: 4, vocabularyVersion: VOCABULARY_VERSION};
  const palette = buildMelodyPalette(upgradeCtx);

  // 1. Check UI copy & <=3-word button on fallback session with canUpgrade=true
  const fallbackSession = new MelodyFieldSession(song, {
    scheduler: {isPlaying: false},
    captureOrigin: 0,
    sourceDoc: legacySavedDoc,
    phraseContext: null,
    canUpgrade: true,
  });
  const html = fallbackSession.html();
  assert.match(html, />Try new tunes<\/button>/);
  assert.match(html, /Your saved take is open as it was\. Try new tunes when ready\./);
  fallbackSession.upgradeContext = upgradeCtx;
  fallbackSession.fromSaved = true;

  // 2. Upgrade while playing clears prior partAudition sectionId and updates captureOrigin
  let cleared = 0, queuedSection = null;
  const scheduler = {
    isPlaying: true,
    stopGeneration: 3,
    gridOriginTime: 12.5,
    clearPartAudition() { cleared++; },
    queueContinuousPartAudition(_view, opts) { queuedSection = opts.sectionId; return {ok: true}; },
    getPartAuditionState() { return {realizedId: `${queuedSection}:6:4`}; },
  };
  fallbackSession.scheduler = scheduler;
  const origPrepare = MelodyFieldSession.prototype.prepare;
  MelodyFieldSession.prototype.prepare = async function () {
    if (this.phraseContext) {
      this.palette = palette;
      this.candidates.clear();
      this.requestId = this._candidate(this.position).id;
    }
  };
  try {
    const flow = Object.create(PlayFlow.prototype);
    flow.melodyField = fallbackSession;
    flow.app = {scheduler, _announce: () => {}};
    flow.render = () => {};
    flow.root = {querySelector: () => null};
    await flow._melodyFieldAction('melody-field-upgrade');
    assert.equal(cleared, 1, 'clearPartAudition called before nextField.begin() while playing');
    assert.equal(flow.melodyField.captureOrigin, 12.5, 'captureOrigin updated from live scheduler.gridOriginTime');
    assert.ok(flow.melodyField.palette, 'upgraded session has composer palette');

    // 3. Paused upgrade -> Keep retains legacy user_placed personal note in capture_source
    const chosen = flow.melodyField._candidate({x: 0.9, y: 0});
    const keptPaused = selectedMelody(legacySavedDoc, chosen.song, {context: upgradeCtx, choice: chosen.position, performanceArchive: null});
    assert.ok(keptPaused.capture_source.notes.some(n => n.id === 'jam-live-own-1' && n.provenance === 'user_placed'), 'paused Keep retains user_placed note in capture_source');

    // 4. Played upgrade (band notes only in capture) -> real _melodyFieldAction('melody-field-keep') retains legacy user_placed note directly in capture_source
    flow._pushUndo = () => {}; flow._stopForScopeChange = () => {}; flow._finishPartEdit = () => {};
    flow._reconcileRetainedPlaying = () => {}; flow._compile = () => {}; flow._go = s => { flow.stage = s; };
    scheduler.markPerformanceKept = () => {};
    flow.melodyField.hasPlayed = true;
    flow.melodyField.candidates.set(`${queuedSection}:6:4`, chosen);
    scheduler.capturePerformance = () => ({
      version: 1, bpm: 100, steps_per_bar: 16, bars: 4, start: 0, end: 4,
      events: [{event: legacyJamPreKeep.notes[0], time: 0, duration: 0.6}],
    });
    await flow._melodyFieldAction('melody-field-keep');
    assert.ok(flow.doc.capture_source.notes.some(n => n.id === 'jam-live-own-1' && n.provenance === 'user_placed'), 'played Keep without new live keys retains legacy user_placed note directly in capture_source');

    // 5. Played upgrade WITH new live keys archives new live note in capture_source.notes AND retains earlier legacy note in melody_original & nested capture_source
    const newLive = {id: 'jam-live-own-2', role: 'lead', step: 8, duration_steps: 2, velocity: 0.7, patch_id: 'sampled_piano_v1', provenance: 'user_placed', concrete: {midi_pitch: 67}};
    const archiveWithNewLive = materializePerformance(legacySavedDoc, {
      version: 1, bpm: 100, steps_per_bar: 16, bars: 4, start: 0, end: 4,
      events: [{event: newLive, time: 1.2, duration: 0.3}],
    }, {keepWholeSource: true});
    const keptPlayed = selectedMelody(legacySavedDoc, chosen.song, {context: upgradeCtx, choice: chosen.position, performanceArchive: archiveWithNewLive});
    assert.ok(keptPlayed.capture_source.notes.some(n => n.source_note_id === 'jam-live-own-2' && n.provenance === 'user_placed'), 'played Keep archives new live user_placed note');
    assert.ok(keptPlayed.melody_original.notes.some(n => n.id === 'jam-live-own-1' && n.provenance === 'user_placed'), 'melody_original retains earlier legacy user_placed note');
    assert.ok(keptPlayed.capture_source.capture_source.notes.some(n => n.id === 'jam-live-own-1' && n.provenance === 'user_placed'), 'keepWholeSource retains earlier legacy user_placed note in archive lineage');
  } finally {
    MelodyFieldSession.prototype.prepare = origPrepare;
  }
});

test('Gate 4 declutter, Refine event-editor handoff, 2-bar _partBars, and switch-scan budget guards', async () => {
  const twoBarSong = {...baseSong(0), total_steps: 32};
  const doc = {id: 'gate4-check', global_context: {bpm: 120, bars: 2, steps_per_bar: 16, root_pc: 0, scale_type: 'major'}, jam_session: {scene_id: 'house-v1'}, notes: twoBarSong.events};
  const ctx = {...captureMelodyContext(twoBarSong, {phraseContext: phraseContext(doc)}), composerVersion: 4, vocabularyVersion: VOCABULARY_VERSION};
  const session = new MelodyFieldSession(twoBarSong, {
    scheduler: {isPlaying: true, getPartAuditionState: () => ({realizedId: null}), markPerformanceKept() {}},
    captureOrigin: 0,
    sourceDoc: doc,
    phraseContext: ctx,
  });
  session.palette = {original: {choice: {position: {x: 0, y: 0}}, notes: twoBarSong.events}};
  session.hasPlayed = true;
  const html = session.html();
  assert.match(html, /class="pf-melody-keep-more"/, 'Save played take is tucked into secondary disclosure');
  assert.match(html, /Softer band stays when you save\. Hear tune clearly is just for now\./);

  // Refine notes works even inside the <500ms initial join window (realizedId: null), sets melodyFocus BEFORE _compile(), and keeps 2-bar card length in _partBars()
  const flow = Object.create(PlayFlow.prototype);
  flow.doc = doc;
  flow.melodyField = session;
  flow.app = {scheduler: session.scheduler, _announce: msg => { throw new Error(msg); }};
  let focusDuringCompile = null;
  flow._pushUndo = () => {};
  flow._stopForScopeChange = () => {};
  flow._finishPartEdit = () => {};
  flow._reconcileRetainedPlaying = () => {};
  flow._compile = () => { focusDuringCompile = flow.melodyFocus; };
  flow._go = stage => { flow.stage = stage; };
  await flow._melodyFieldAction('melody-field-refine');
  assert.equal(flow.stage, 'tune');
  assert.equal(focusDuringCompile, true, 'melodyFocus must be true before _compile() so straight-16th composer phrases open _renderEventTune');
  assert.equal(flow._partBars(), 2, '2-bar selectedMelody song preserves exact card bars in _partBars() rather than defaulting to 4');

  // _scanItems skips unselected generated .pf-phrase-note pills while .pf-note-list is closed, keeping selected + user_placed notes
  const makePill = ({selected = false, own = false}) => ({
    disabled: false,
    offsetParent: {},
    parentElement: null,
    tagName: 'BUTTON',
    dataset: {},
    classList: {contains: cls => (cls === 'pf-phrase-note') || (cls === 'pf-phrase-own' && own)},
    getAttribute: attr => (attr === 'aria-pressed' ? String(selected) : null),
  });
  const pills = [makePill({selected: true}), makePill({own: true}), makePill({}), makePill({})];
  let noteListClosed = true;
  const origDoc = globalThis.document;
  try {
    globalThis.document = {getElementById: () => null, activeElement: {matches: sel => sel === '[data-melody-disk]'}};
    flow.root = {
      style: {display: 'block'},
      querySelectorAll: () => pills,
      querySelector: sel => (sel === '.pf-note-list:not([open])' && noteListClosed ? {} : null),
    };
    assert.equal(flow._scanItems().length, 2, 'closed .pf-note-list keeps only selected and user_placed canvas pills in Space scan');
    noteListClosed = false;
    assert.equal(flow._scanItems().length, 4, 'opened .pf-note-list restores all pills');

    // Enter on focused [data-melody-disk] prevents default and stops propagation without activating scan target
    let prevented = false, stopped = false;
    flow._onKey({key: 'Enter', preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; }});
    assert.equal(prevented && stopped, true, 'Enter on [data-melody-disk] is guarded');
  } finally {
    globalThis.document = origDoc;
  }
});
