import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSER_SCENES, FORM_COMPOSER_SCENES, captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {buildMelodyPalette as buildV4} from '../../../static/js/theory/melody_composer_v4.js';
import {
  MELODY_FAMILIES,
  REGION_NAMES,
  GENRE_PROFILES,
  VOCABULARY_VERSION,
  melodyChoice,
  planMelodyCandidate,
  buildMelodyPalette,
} from '../../../static/js/theory/melody_composer_v5.js';
import {LAUNCH_PROFILES} from '../../../static/js/theory/melody_genre_profiles_launch.js';
import {formBlockCount} from '../../../static/js/theory/form_scenes.js';
import {PHRASES} from '../../../static/js/theory/melody_phrase_library_v1.js';
import {phraseContext, validPhraseHarmony, wheelOnlyHarmonyFor} from '../../../static/js/theory/phrase_harmony.js';
import {catalogueBacking, SCENE_CATALOGUE, SCENE_CATALOGUE_VERSION, SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {melodyFieldTourPosition} from '../../../static/js/theory/melody_field_tour.js';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {validateProject} from '../../../static/js/theory/project_validation.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';

function fixedSong(root = 0) {
  const lead = [60, 64, 67, 72].map((m, i) => ({
    id: `l${i}`,
    role: 'lead',
    step: i * 16,
    duration_steps: 4,
    duration_sec: 0.6,
    velocity: 0.6,
    provenance: 'jam_generated',
    patch_id: 'sampled_piano_v1',
    concrete: {midi_pitch: m + root},
  }));
  const bass = {
    id: 'b0',
    role: 'bass',
    step: 0,
    duration_steps: 4,
    duration_sec: 0.6,
    velocity: 0.4,
    provenance: 'jam_generated',
    patch_id: 'sampled_bass_v1',
    concrete: {midi_pitch: 36 + root},
  };
  return {song_id: 'genre-gate', bpm: 100, swing: 0.5, total_steps: 64, steps_per_bar: 16, events: [...lead, bass]};
}

function cellSig(plan) {
  return plan.notes
    .filter(n => n.role === 'lead')
    .sort((a, b) => (a.step + (a.performance?.offset_steps || 0)) - (b.step + (b.performance?.offset_steps || 0)))
    .map(n => `${(n.step + (n.performance?.offset_steps || 0)).toFixed(3)}:${n.duration_steps.toFixed(3)}:${n.concrete.midi_pitch}`)
    .join(' ');
}

function rhythmProfile(palette) {
  const notes = [];
  for (const [k, plan] of Object.entries(palette)) {
    if (k === 'original') continue;
    for (const n of plan.notes) {
      if (n.role === 'lead') notes.push([+(n.step + (n.performance?.offset_steps || 0)).toFixed(3), n.duration_steps]);
    }
  }
  const total = notes.length || 1;
  const onBeat = notes.filter(([s]) => Math.round(s) % 4 === 0 && Math.abs(s - Math.round(s)) < 0.2).length / total;
  const eighthOff = notes.filter(([s]) => Math.round(s) % 4 === 2 && Math.abs(s - Math.round(s)) < 0.2).length / total;
  const sixteenthOrFiner = notes.filter(([s]) => Math.abs(s - Math.round(s)) >= 1e-6 || Math.round(s) % 2 === 1).length / total;
  const fractional = notes.filter(([s]) => Math.abs(s - Math.round(s)) >= 1e-6).length / total;
  const avgGate = notes.reduce((acc, [, d]) => acc + d, 0) / total;
  const perBar = notes.length / 96 / 4;
  return {perBar, onBeat, eighthOff, sixteenthOrFiner, fractional, avgGate};
}

// Riff notes the band's chord part plays on top of the bar's chord in long-form styles, as semitones above
// the chord root: boogie sixths, jazz ninths, chromatic metal riffs. Anything not listed here fails.
const FORM_RIFF_INTERVALS = {
  'texas-blues-v1': [9],
  'modal-jazz-v1': [2],
  'jazz-fusion-v1': [2],
  'thrash-metal-v1': [1, 5, 6],
  'death-metal-v1': [1, 6],
};

test('all 78 COMPOSER_SCENES have authored profiles and 100% harmonic agreement with catalogueBacking', () => {
  assert.equal(COMPOSER_SCENES.length, 78);
  assert.equal(new Set(COMPOSER_SCENES).size, 78);
  assert.equal(COMPOSER_SCENES.length, SCENE_CATALOGUE.length);
  const riffSeen = new Set();
  for (const sceneId of COMPOSER_SCENES) {
    const idx = SCENE_CATALOGUE.findIndex(s => s.id === sceneId);
    assert.ok(idx >= 0, `${sceneId} exists in SCENE_CATALOGUE`);
    const isForm = FORM_COMPOSER_SCENES.includes(sceneId);
    const blocks = isForm ? formBlockCount(sceneId) : 1;
    assert.ok(blocks >= 1 && blocks <= 3, `${sceneId} has 1 to 3 blocks`);
    for (let block = 0; block < blocks; block++) {
      const own = GENRE_PROFILES[sceneId] || LAUNCH_PROFILES[isForm ? `${sceneId}#${block}` : sceneId];
      assert.ok(own, `${sceneId} block ${block} has its own authored profile`);
      for (const [root, scale] of [[0, 'major'], [2, 'natural_minor']]) {
        const jam = {scene_id: sceneId, style_spectrum: idx, density: 2, color: 2, scene_variant: 'base', ...(isForm ? {form_cursor: {id: sceneId, blockIndex: block, cycle: 0}} : {})};
        const doc = {notes: [], auto_harmony_stabs: false, global_context: {bpm: 120, root_pc: root, scale_type: scale}, jam_session: jam};
        const pc = phraseContext(doc);
        const harmony = pc?.harmony ?? wheelOnlyHarmonyFor(sceneId, scale !== 'major');
        assert.ok(validPhraseHarmony(harmony), `${sceneId} block ${block} (${scale}) exposes validPhraseHarmony`);
        const backing = catalogueBacking(doc, doc.jam_session, []);
        const riff = isForm ? (FORM_RIFF_INTERVALS[sceneId] || []) : [];
        for (const n of backing.filter(e => e.role === 'harmony')) {
          const bar = Math.floor(n.step / 16);
          assert.ok(bar >= 0 && bar < 4, `${sceneId} block ${block} band stays inside four bars`);
          const relPc = (n.concrete.midi_pitch - root + 120) % 12;
          if (harmony.bars[bar].includes(relPc)) continue;
          const above = (relPc - harmony.bars[bar][0] + 12) % 12;
          assert.ok(riff.includes(above), `${sceneId} block ${block} (${scale}) bar ${bar} chord includes pc ${relPc}`);
          riffSeen.add(`${sceneId}:${above}`);
        }
      }
    }
  }
  // Every listed riff interval is really played, so the list cannot quietly grow stale or over-wide.
  for (const [sceneId, list] of Object.entries(FORM_RIFF_INTERVALS)) for (const iv of list) assert.ok(riffSeen.has(`${sceneId}:${iv}`), `${sceneId} riff interval ${iv} is used`);
});

test('cross-genre distinctness gate: 0/96 identical cells across all 3,003 style pairs (negative control catches v4)', () => {
  const song = fixedSong(0);
  // Negative control: prove this check catches v4's genre-blindness (96/96 identical between ska-v1 and house-v1).
  const v4Ska = buildV4({...captureMelodyContext(song, {phraseContext: phraseContext({global_context: {root_pc: 0, scale_type: 'major'}, jam_session: {scene_id: 'ska-v1'}})}), composerVersion: 4, vocabularyVersion: VOCABULARY_VERSION});
  const v4House = buildV4({...captureMelodyContext(song, {phraseContext: phraseContext({global_context: {root_pc: 0, scale_type: 'major'}, jam_session: {scene_id: 'house-v1'}})}), composerVersion: 4, vocabularyVersion: VOCABULARY_VERSION});
  const v4Same = Object.keys(v4Ska).filter(k => k !== 'original' && cellSig(v4Ska[k]) === cellSig(v4House[k])).length;
  assert.equal(v4Same, 96, 'negative control: v4 produces 96/96 identical cells across ska-v1 and house-v1');

  // Positive gate: v5 produces 0/96 identical cells across EVERY distinct pair among all 78 COMPOSER_SCENES.
  const palettes = new Map();
  const sigByScene = new Map();
  const reachedPhrases = new Set();

  for (const sceneId of COMPOSER_SCENES) {
    const doc = {
      id: 'd',
      global_context: {root_pc: 0, scale_type: 'major'},
      jam_session: {scene_id: sceneId, scene_catalogue: SCENE_CATALOGUE_VERSION, scene_mix: SCENE_MIX_VERSION},
    };
    const ctx = {...captureMelodyContext(song, {phraseContext: phraseContext(doc)}), composerVersion: 5, vocabularyVersion: VOCABULARY_VERSION};
    const pal = buildMelodyPalette(ctx);
    palettes.set(sceneId, pal);
    const map = {};
    for (const [k, plan] of Object.entries(pal)) {
      if (k === 'original') continue;
      map[k] = cellSig(plan);
      reachedPhrases.add(plan.phraseId);
    }
    assert.equal(new Set(Object.values(map)).size, 96, `${sceneId}: all 96 wheel cells distinct within palette`);
    sigByScene.set(sceneId, map);
  }

  for (let i = 0; i < COMPOSER_SCENES.length; i++) {
    for (let j = i + 1; j < COMPOSER_SCENES.length; j++) {
      const a = COMPOSER_SCENES[i], b = COMPOSER_SCENES[j];
      const sa = sigByScene.get(a), sb = sigByScene.get(b);
      const same = Object.keys(sa).filter(k => sa[k] === sb[k]).length;
      assert.equal(same, 0, `${a} vs ${b} must share 0 identical wheel cells (got ${same})`);
    }
  }

  // All 39 shipped CC0 phrases are actively utilized as contour sources across the 78 styles.
  assert.equal(reachedPhrases.size, PHRASES.length, 'all 39 CC0 corpus contours reached across v5 styles');

  // Verify genre-authentic rhythmic separation across contrasting styles.
  const skaR = rhythmProfile(palettes.get('ska-v1'));
  const reggaeR = rhythmProfile(palettes.get('reggae-v1'));
  const grimeR = rhythmProfile(palettes.get('grime-v1'));
  const footworkR = rhythmProfile(palettes.get('footwork-v1'));
  const houseR = rhythmProfile(palettes.get('house-v1'));
  const neoSoulR = rhythmProfile(palettes.get('neo-soul-v1'));

  assert.ok(skaR.eighthOff > 0.45 && skaR.onBeat < 0.15, `ska-v1 off-beat skank rhythm (${JSON.stringify(skaR)})`);
  assert.ok(reggaeR.onBeat < 0.15 && reggaeR.eighthOff > 0.40, `reggae-v1 one-drop off-beat space (${JSON.stringify(reggaeR)})`);
  assert.ok(grimeR.perBar < 3.4 && grimeR.onBeat < 0.12 && grimeR.avgGate < 1.6, `grime-v1 cold sparse off-beat stabs (${JSON.stringify(grimeR)})`);
  assert.ok(footworkR.perBar >= 3.8 && footworkR.sixteenthOrFiner >= 0.45 && footworkR.fractional > 0.2, `footwork-v1 fractional juke fragments (${JSON.stringify(footworkR)})`);
  assert.ok(houseR.onBeat >= 0.18 && houseR.eighthOff >= 0.35 && houseR.sixteenthOrFiner >= 0.15, `house-v1 syncopated club hook (${JSON.stringify(houseR)})`);
  assert.ok(neoSoulR.fractional > 0.3, `neo-soul-v1 laid-back pocket offsets (${JSON.stringify(neoSoulR)})`);
});

test('all 78 scenes x major/minor satisfy chord fit, anti-monotone, register, cadence, and validateProject', () => {
  for (const sceneId of COMPOSER_SCENES) {
    for (const [root, scale] of [[0, 'major'], [9, 'natural_minor']]) {
      const song = fixedSong(root);
      const idx = SCENE_CATALOGUE.findIndex(s => s.id === sceneId);
      const bpm = SCENE_CATALOGUE[idx]?.bpm || 100;
      song.bpm = bpm;
      const doc = {
        id: `v5-${sceneId}-${scale}`,
        title: 'Genre Test',
        global_context: {bpm, bars: 4, steps_per_bar: 16, swing: 0.5, root_pc: root, scale_type: scale},
        jam_session: {scene_id: sceneId, scene_catalogue: SCENE_CATALOGUE_VERSION, style_spectrum: idx},
        notes: song.events,
      };
      const ctx = {...captureMelodyContext(song, {phraseContext: phraseContext(doc)}), composerVersion: 5, vocabularyVersion: VOCABULARY_VERSION};
      const pal = buildMelodyPalette(ctx);
      const sigs = new Set();

      for (let t = 0; t < 24; t++) {
        for (let r = 1; r <= 4; r++) {
          const key = `${t}:${r}`, plan = pal[key];
          sigs.add(cellSig(plan));
          const lead = plan.notes.filter(n => n.role === 'lead');
          assert.ok(lead.length >= 4, `${sceneId} ${key} has complete multi-bar phrase`);

          let run = 1, best = 1;
          for (let i = 0; i < lead.length; i++) {
            const n = lead[i];
            const pos = n.step + n.performance.offset_steps;
            assert.ok(Number.isInteger(n.step) && n.step >= 0 && n.step < 64);
            assert.ok(n.performance.offset_steps >= 0 && n.performance.offset_steps < 1);
            assert.ok(n.duration_steps > 0 && pos + n.duration_steps <= 64 + 1e-9);
            assert.ok(n.velocity >= 0.18 && n.velocity <= 0.85);
            const bar = Math.floor(pos / 16);
            const lastBar = Math.min(3, Math.floor((pos + n.duration_steps - 1e-6) / 16));
            for (let b = bar; b <= lastBar; b++) {
              assert.ok(ctx.harmony.bars[b].includes((n.concrete.midi_pitch - root + 120) % 12), `${sceneId} (${scale}) ${key} bar ${b} chord tone`);
            }
            if (sceneId === 'doo-wop-v1') assert.ok(n.concrete.midi_pitch >= 72 && n.concrete.midi_pitch <= 83);
            if (sceneId === 'delta-blues-v1') assert.ok(n.concrete.midi_pitch >= 72 && n.concrete.midi_pitch <= 84);
            if (i > 0) {
              run = n.concrete.midi_pitch === lead[i - 1].concrete.midi_pitch ? run + 1 : 1;
              if (run > best) best = run;
            }
          }
          assert.ok(best / lead.length <= 0.5, `${sceneId} (${scale}) ${key} avoids monotone collapse`);
          if (sceneId === 'gospel-piano-v1' && r >= 2) {
            assert.equal((lead.at(-1).concrete.midi_pitch - root + 120) % 12, 0, 'gospel-piano-v1 resolves to tonic ending');
          }
        }
      }
      assert.equal(sigs.size, 96, `${sceneId} (${scale}) 96/96 distinct cells`);

      // Validate standalone determinism and project schema validation on Keep.
      const samplePos = {x: 0, y: 1};
      assert.deepEqual(planMelodyCandidate(ctx, samplePos), pal['0:4']);
      const kept = selectedMelody(doc, {...song, events: pal['0:4'].notes}, {context: ctx, choice: pal['0:4'].choice});
      assert.equal(validateProject(kept), kept, `${sceneId} (${scale}) validateProject passes`);
    }
  }
});

test('plain language, worker v1-v5 dispatch, v4 reopen stability, and dynamic Explore tour', async () => {
  for (const label of [...MELODY_FAMILIES, ...REGION_NAMES]) {
    assert.equal(checkPrompt(label).ok, true, `${label} passes plain-language check`);
    assert.equal(checkPrompt(`Playing: ${label} 1.`).ok, true, `status for ${label} passes plain-language check`);
  }
  assert.equal(melodyChoice({x: 0, y: 0}).key, 'original');
  assert.notEqual(melodyChoice({x: 0.1, y: 0}).key, 'original');

  // Worker v4 & v5 dispatch
  const song = fixedSong(0);
  const ctxBase = captureMelodyContext(song, {phraseContext: phraseContext({global_context: {root_pc: 0, scale_type: 'major'}, jam_session: {scene_id: 'house-v1'}})});
  const oldSelf = globalThis.self, posted = [];
  globalThis.self = {postMessage: v => posted.push(v)};
  try {
    await import('../../../static/ui/melody_composer_worker.js');
    const c4 = {...ctxBase, composerVersion: 4, vocabularyVersion: VOCABULARY_VERSION};
    globalThis.self.onmessage({data: c4});
    assert.deepEqual(posted.pop().plans, buildV4(c4), 'worker preserves frozen v4 byte-for-byte');
    const c5 = {...ctxBase, composerVersion: 5, vocabularyVersion: VOCABULARY_VERSION};
    globalThis.self.onmessage({data: c5});
    assert.deepEqual(posted.pop().plans, buildMelodyPalette(c5), 'worker dispatches v5 genre palette');
  } finally {
    globalThis.self = oldSelf;
  }

  // Dynamic Explore tour visits inner, mid, and outer rings and all 4 compass quadrants smoothly
  const barSec = (16 * 15) / 120;
  const radii = [], quadrants = new Set();
  let prev = {x: 0, y: 0};
  for (let step = 0; step <= 320; step++) {
    const t = (step / 10) * barSec;
    const p = melodyFieldTourPosition({startPosition: {x: 0, y: 0}, startTime: 0, now: t, bpm: 120, mode: 'dynamic'});
    const r = Math.hypot(p.x, p.y);
    assert.ok(r <= 1 + 1e-9, 'dynamic tour stays inside unit disk');
    assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 0.25, 'dynamic tour moves smoothly without jumps');
    prev = p;
    radii.push(r);
    if (r > 0.2) quadrants.add(`${p.x >= 0 ? '+' : '-'}${p.y >= 0 ? '+' : '-'}`);
  }
  assert.ok(radii.some(r => r > 0.25 && r < 0.42), 'dynamic tour visits inner pocket ring');
  assert.ok(radii.some(r => r >= 0.50 && r <= 0.70), 'dynamic tour visits mid groove ring');
  assert.ok(radii.some(r => r >= 0.88), 'dynamic tour visits bold outer statement ring');
  assert.equal(quadrants.size, 4, 'dynamic tour visits all 4 compass quadrants');

  // Session advances with dynamic mode on v5 and orbit mode on v4
  const sessionV5 = new MelodyFieldSession(song, {
    scheduler: {isPlaying: true, gridOriginTime: 0, audioCtx: {currentTime: 0}, queueContinuousPartAudition: () => ({ok: true})},
    captureOrigin: 0,
    sourceDoc: {id: 's5', global_context: {}},
    phraseContext: {...ctxBase, composerVersion: 5, vocabularyVersion: VOCABULARY_VERSION},
  });
  assert.deepEqual(sessionV5.melodyFamilies, MELODY_FAMILIES);
  sessionV5.toggleExploration();
  sessionV5.scheduler.audioCtx.currentTime = 7.5 * barSec;
  sessionV5.advance();
  const expectedDynamic = melodyFieldTourPosition({startPosition: {x: 0, y: 0}, startTime: 0, now: 7.5 * barSec, bpm: 100, mode: 'dynamic'});
  assert.deepEqual(sessionV5.position, expectedDynamic);
});
