// Develop the reviewed V6 phrases without changing saved V6 arrangements.
import {buildMelodyPalette as basePalette, melodyChoice as baseChoice} from './melody_composer_v6.js';
export {MELODY_FAMILIES, REGION_NAMES, SUPPORTED_SCENES, VOCABULARY_VERSION} from './melody_composer_v6.js';
export const DEFAULT_COMPOSER_VERSION = 7;
export const RADIAL_TREATMENTS = ['Light', 'Theme', 'Breath', 'Lift'];

export function melodyChoice(position) {
  const choice = baseChoice(position);
  if (choice.key === 'original') return choice;
  const ring = Number(choice.key.split(':')[1]);
  return {...choice, treatment: RADIAL_TREATMENTS[ring - 1],
    label: choice.label.replace(/ \d$/, ` · ${RADIAL_TREATMENTS[ring - 1]}`)};
}

export function buildMelodyPalette(ctx) {
  return developPalette(ctx, basePalette(ctx));
}

// Operates only on a freshly built palette; saved V7 output remains pinned.
export function developPalette(ctx, plans) {
  for (const [key, plan] of Object.entries(plans)) {
    if (key === 'original') continue;
    const ring = Number(key.split(':')[1]);
    plan.choice = melodyChoice(plan.choice.position);
    // Leave room before the final phrase. Work after V6's duration clamps so
    // motif protection cannot erase the release. Only generated non-core notes
    // are eligible; attacks, pitches, backing and personal material never move.
    const tail = ring >= 3 ? plan.notes.filter(n => n.role === 'lead'
      && n.generated_by === 'musiclab_phrase_composer_v6' && !n.derivation?.motif_anchor
      && n.step >= 32 && n.step < 48).sort((a, b) =>
        (b.step + (b.performance?.offset_steps || 0)) - (a.step + (a.performance?.offset_steps || 0)))[0] : null;
    for (const note of plan.notes) {
      if (note.role !== 'lead' || note.generated_by !== 'musiclab_phrase_composer_v6') continue;
      if (note === tail) {
        const oldDuration = note.duration_steps;
        note.duration_steps = Math.min(oldDuration,
          Math.round(Math.max(0.35, oldDuration - Math.max(0.5, oldDuration * 0.35)) * 1000) / 1000);
        note.duration_sec = note.duration_steps * 15 / ctx.bpm;
        note.derivation = {...note.derivation, development: {
          kind: 'breath-before-ending', original_duration_steps: oldDuration,
        }};
      }
      note.id = note.id.replace('phrase-v6-', 'phrase-v7-');
      note.generated_by = 'musiclab_phrase_composer_v7';
      note.derivation = {...note.derivation, version: 7};
    }
    plan.description = `${plan.description}. ${plan.choice.treatment}.`;
  }
  return plans;
}
