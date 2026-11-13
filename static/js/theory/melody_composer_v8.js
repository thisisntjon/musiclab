// Extend recognizable development to the existing Ska / Rocksteady neighbourhood and Swing.
// V6 and V7 keep their own admission and exact saved output.
import {buildPaletteWithProfile} from './melody_composer_v6.js';
import {developPalette} from './melody_composer_v7.js';
import {GENRE_PROFILES} from './melody_composer_v5.js';
export {melodyChoice, RADIAL_TREATMENTS, MELODY_FAMILIES, VOCABULARY_VERSION} from './melody_composer_v7.js';
export const SUPPORTED_SCENES = new Set(['ska-v1', 'rocksteady-v1', 'swing-v1']);
export const DEFAULT_COMPOSER_VERSION = 8;

export function buildMelodyPalette(ctx) {
  if (!SUPPORTED_SCENES.has(ctx.sceneId)) throw new Error('This tune map is not ready for this band. Your tune stays.');
  const plans = developPalette(ctx, buildPaletteWithProfile(ctx, GENRE_PROFILES[ctx.sceneId]));
  // Swing can bring a following note closer to a core note in a denser ring.
  // Use the shortest already-valid gate at every radius, so the core hold stays
  // recognizable too. Only these newly generated notes are changed.
  for (let turn = 0; turn < 24; turn++) {
    const rings = [1, 2, 3, 4].map(r => plans[`${turn}:${r}`]);
    const key = n => `${n.step}:${n.performance?.offset_steps || 0}:${n.concrete.midi_pitch}`;
    const cores = rings.map(p => new Map(p.notes.filter(n => n.role === 'lead' && n.generated_by === 'musiclab_phrase_composer_v7' && n.derivation?.motif_anchor).map(n => [key(n), n])));
    for (const [id] of cores[0]) {
      const notes = cores.map(c => c.get(id));
      if (notes.some(n => !n)) throw new Error('This phrase does not fit. Your groove stays.');
      const gate = Math.min(...notes.map(n => n.duration_steps));
      for (const note of notes) {
        if (note.duration_steps !== gate) note.derivation = {...note.derivation, core_gate: {kind: 'shared-radial-gate', original_duration_steps: note.duration_steps}};
        note.duration_steps = gate;
        note.duration_sec = gate * 15 / ctx.bpm;
      }
    }
  }
  for (const [key, plan] of Object.entries(plans)) {
    if (key === 'original') continue;
    for (const note of plan.notes) {
      if (note.role !== 'lead' || note.generated_by !== 'musiclab_phrase_composer_v7') continue;
      note.id = note.id.replace('phrase-v7-', 'phrase-v8-');
      note.generated_by = 'musiclab_phrase_composer_v8';
      note.derivation = {...note.derivation, version: 8};
    }
  }
  return plans;
}
