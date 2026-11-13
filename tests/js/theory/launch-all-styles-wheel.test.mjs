// Launch gate: every catalogue style, and every four-bar block of a long-form style, builds its own tune wheel.
import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSER_SCENES, FORM_COMPOSER_SCENES, captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {GENRE_PROFILES, VOCABULARY_VERSION, buildMelodyPalette} from '../../../static/js/theory/melody_composer_v5.js';
import {LAUNCH_PROFILES} from '../../../static/js/theory/melody_genre_profiles_launch.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {formBlockCount} from '../../../static/js/theory/form_scenes.js';
import {SCENE_CATALOGUE} from '../../../static/js/theory/scene_catalogue.js';

const song = root => ({song_id: 's', bpm: 100, swing: .5, total_steps: 64, steps_per_bar: 16,
  events: [60, 64, 67, 72].map((m, i) => ({id: 'l' + i, role: 'lead', step: i * 16, duration_steps: 4, velocity: .6, provenance: 'jam_generated', patch_id: 'p', concrete: {midi_pitch: m + root}}))});
const reachedFor = (id, block, root, scale) => ({phraseContext: phraseContext({id: 'd', global_context: {root_pc: root, scale_type: scale},
  jam_session: {scene_id: id, ...(FORM_COMPOSER_SCENES.includes(id) ? {form_cursor: {id, blockIndex: block, cycle: 0}} : {})}})});
const contextFor = (id, block, root, scale) => {
  const c = captureMelodyContext(song(root), reachedFor(id, block, root, scale));
  return c && {...c, composerVersion: 5, vocabularyVersion: VOCABULARY_VERSION};
};
const lead = plan => plan.notes.filter(n => n.role === 'lead').sort((a, b) => a.step + (a.performance?.offset_steps || 0) - b.step - (b.performance?.offset_steps || 0));
const sig = plan => lead(plan).map(n => `${n.step}+${n.performance?.offset_steps || 0}:${n.duration_steps}:${n.concrete.midi_pitch}`).join(' ');
const units = COMPOSER_SCENES.flatMap(id => Array.from({length: formBlockCount(id) || 1}, (_, block) => [id, block]));

test('the composer list is exactly the catalogue, and long-form styles are admitted block by block', () => {
  assert.deepEqual([...COMPOSER_SCENES].sort(), SCENE_CATALOGUE.map(s => s.id).sort());
  assert.equal(FORM_COMPOSER_SCENES.length, 33);
  for (const id of COMPOSER_SCENES) assert.equal(Boolean(formBlockCount(id)), FORM_COMPOSER_SCENES.includes(id), `${id} long-form flag agrees`);
  assert.equal(units.length, 117);
  for (const id of FORM_COMPOSER_SCENES) {
    assert.equal(contextFor(id, 0, 0, 'major').form.blockIndex, 0);
    // A long-form context with no usable block, or a block past the end of the admitted range, is refused.
    const pc = reachedFor(id, 0, 0, 'major').phraseContext;
    for (const form of [{...pc.form, blockIndex: 3}, {...pc.form, blockIndex: -1}, {...pc.form, blockIndex: 1.5}, {version: 1, id}])
      assert.equal(captureMelodyContext(song(0), {phraseContext: {...pc, form}}), null, `${id} refuses a bad block`);
  }
  // A style that is not long-form still refuses a form or a mode.
  const plain = reachedFor('house-v1', 0, 0, 'major').phraseContext;
  assert.equal(captureMelodyContext(song(0), {phraseContext: {...plain, form: {version: 1, id: 'house-v1', blockIndex: 0, cycle: 0}}}), null);
  assert.equal(captureMelodyContext(song(0), {phraseContext: {...plain, mode: {name: 'dorian'}}}), null);
});

test('every style and block has its own authored profile; a missing one fails loudly instead of borrowing', () => {
  for (const [id, block] of units) {
    const own = GENRE_PROFILES[id] || LAUNCH_PROFILES[FORM_COMPOSER_SCENES.includes(id) ? `${id}#${block}` : id];
    assert.ok(own, `${id} block ${block}`);
  }
  for (const key of Object.keys(LAUNCH_PROFILES)) assert.ok(!GENRE_PROFILES[key.split('#')[0]], `${key} does not shadow a profile that saved songs rely on`);
  const c = contextFor('house-v1', 0, 0, 'major');
  assert.throws(() => buildMelodyPalette({...c, sceneId: 'no-such-style-v1'}), /no tune patterns yet/);
});

test('all 117 style blocks in two keys: 96 distinct tunes, chord tones only, inside four bars, never one repeated note', () => {
  for (const [id, block] of units) for (const [root, scale] of [[0, 'major'], [9, 'natural_minor']]) {
    const tag = `${id} block ${block} (${scale})`, ctx = contextFor(id, block, root, scale);
    assert.ok(ctx, `${tag} reaches the composer`);
    const pal = buildMelodyPalette(ctx), cells = Object.entries(pal).filter(([k]) => k !== 'original');
    assert.equal(cells.length, 96, tag);
    assert.equal(new Set(cells.map(([, p]) => sig(p))).size, 96, `${tag} 96 distinct cells`);
    for (const [key, plan] of cells) {
      const l = lead(plan);
      assert.ok(l.length >= 4, `${tag} ${key} has at least four notes`);
      let run = 1, best = 1;
      l.forEach((n, i) => {
        const start = n.step + (n.performance?.offset_steps || 0), end = start + n.duration_steps;
        assert.ok(start >= 0 && end <= 64 + 1e-9, `${tag} ${key} stays inside four bars`);
        for (let bar = Math.floor(start / 16); bar <= Math.min(3, Math.floor((end - 1e-6) / 16)); bar++)
          assert.ok(ctx.harmony.bars[bar].includes((n.concrete.midi_pitch - root + 120) % 12), `${tag} ${key} bar ${bar} chord tone`);
        if (i) { run = n.concrete.midi_pitch === l[i - 1].concrete.midi_pitch ? run + 1 : 1; best = Math.max(best, run); }
      });
      assert.ok(best / l.length <= .5, `${tag} ${key} is not one repeated note`);
      assert.deepEqual(plan.notes.filter(n => n.role !== 'lead'), ctx.source.events.filter(n => n.role !== 'lead'), `${tag} ${key} leaves the band alone`);
    }
  }
});

test('no two style blocks share a single identical tune at the same wheel position', () => {
  const sigs = units.map(([id, block]) => {
    const pal = buildMelodyPalette(contextFor(id, block, 0, 'major'));
    return [`${id}#${block}`, Object.fromEntries(Object.entries(pal).filter(([k]) => k !== 'original').map(([k, p]) => [k, sig(p)]))];
  });
  let pairs = 0;
  for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length; j++) {
    pairs++;
    const same = Object.keys(sigs[i][1]).filter(k => sigs[i][1][k] === sigs[j][1][k]).length;
    assert.equal(same, 0, `${sigs[i][0]} vs ${sigs[j][0]} share ${same} cells`);
  }
  assert.equal(pairs, 117 * 116 / 2);
  // Negative control: the same comparison does flag a wheel compared with itself.
  assert.equal(Object.keys(sigs[0][1]).filter(k => sigs[0][1][k] === sigs[0][1][k]).length, 96);
});
