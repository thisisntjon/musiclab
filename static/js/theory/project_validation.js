import {validMusicField,musicFieldTempoAllowed} from './music_field.js';
// Import limits protect the synchronous editor/compiler, without normalizing notes.
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION,sceneIndex} from './scene_catalogue.js';
import {restoreMelodicPhrase} from './melodic_evolution.js';
import {validSectionDirection} from './song_view.js';
export const MAX_PROJECT_BYTES = 5 * 1024 * 1024;
export const MAX_PROJECT_NOTES = 16384;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
function fail(reason) { throw new Error(reason); }
function numeric(value, key, min, max, integer = false) {
  if (!own(value, key)) return;
  const n = value[key];
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) fail('invalid_values');
}

export function validateProject(song) {
  if (!object(song) || !Array.isArray(song.notes) || !object(song.global_context)) fail('invalid_project');
  for (const key of ['id', 'title']) if (own(song, key) && typeof song[key] !== 'string') fail('invalid_project');
  let noteCount = 0;
  function notes(list) {
    if (!Array.isArray(list)) fail('invalid_notes');
    noteCount += list.length;
    if (noteCount > MAX_PROJECT_NOTES) fail('too_large');
    const ids = new Set();
    for (const note of list) {
      if (!object(note)) fail('invalid_notes');
      if (own(note, 'id')) {
        if (typeof note.id !== 'string' || !note.id || ids.has(note.id)) fail('invalid_notes');
        ids.add(note.id);
      }
      numeric(note, 'step', 0, 65535, true);
      numeric(note, 'duration_steps', Number.MIN_VALUE, 1024);
      numeric(note, 'velocity', 0, 1);
      for (const key of ['concrete', 'relational', 'performance']) {
        if (own(note, key) && !object(note[key])) fail('invalid_notes');
      }
      if (note.concrete) numeric(note.concrete, 'midi_pitch', 0, 127);
      if (note.relational) {
        numeric(note.relational, 'chord_tone_index', 0, 15, true);
        // The current compiler adds one scale length before its remainder.
        numeric(note.relational, 'scale_degree_offset', -7, 64, true);
        numeric(note.relational, 'octave_offset', -8, 8, true);
      }
      if (note.performance) numeric(note.performance, 'offset_steps', 0, 1 - Number.EPSILON);
    }
  }
  function visit(value, depth = 0) {
    if (depth > 64) fail('too_large');
    if (typeof value === 'number' && !Number.isFinite(value)) fail('invalid_values');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return; }
    if (own(value, 'notes')) notes(value.notes);
    if (own(value, 'global_context')) {
      const ctx = value.global_context;
      if (!object(ctx)) fail('invalid_context');
      numeric(ctx, 'bpm', 20, 400);
      numeric(ctx, 'bars', 1, 64, true);
      if(own(ctx,'steps_per_bar') && ![12,16].includes(ctx.steps_per_bar))fail('invalid_context');
      numeric(ctx, 'swing', .5, .68);
      numeric(ctx, 'root_pc', 0, 11, true);
      if (own(ctx, 'scale_type') && !['major', 'natural_minor', 'dorian', 'phrygian_dominant'].includes(ctx.scale_type)) fail('unsupported_scale');
    }
    if (own(value, 'drum_kit') && !['soft', 'punchy', 'tiny'].includes(value.drum_kit)) fail('unsupported_kit');
    if (object(value.jam_session) && own(value.jam_session,'scene_variant')
      && !['base','answer','space'].includes(value.jam_session.scene_variant)) fail('invalid_project');
    if(object(value.jam_session)) {
      if(own(value.jam_session,'exploration_map')&&(!['catalogue-circle-v1','catalogue-circle-v2'].includes(value.jam_session.exploration_map)||value.jam_session.scene_catalogue!==SCENE_CATALOGUE_VERSION||(own(value.jam_session,'music_field')&&(value.jam_session.exploration_map!=='catalogue-circle-v2'||value.jam_session.music_field?.version!==5))))fail('invalid_project');
      if(value.jam_session.music_field?.version===5&&(value.jam_session.exploration_map!=='catalogue-circle-v2'||value.jam_session.scene_id!==['ska-v1','rocksteady-v1','reggae-v1'][Math.round(value.jam_session.music_field.x*2)]))fail('invalid_project');
      if(!musicFieldTempoAllowed(value))fail('invalid_context');
      if(own(value.jam_session,'music_field')&&(!validMusicField(value.jam_session.music_field)||(value.global_context?.steps_per_bar??16)!==16))fail('invalid_project');
      if(own(value.jam_session,'melodic_evolution')&&!restoreMelodicPhrase(value.jam_session.melodic_evolution))fail('invalid_project');
      if(own(value.jam_session,'scene_catalogue')&&(value.jam_session.scene_catalogue!==SCENE_CATALOGUE_VERSION||sceneIndex(value.jam_session.scene_id)<0))fail('invalid_project');
      if(own(value.jam_session,'scene_catalogue')&&(value.jam_session.style_spectrum!==sceneIndex(value.jam_session.scene_id)||(value.global_context?.steps_per_bar??16)!==16))fail('invalid_project');
      if(own(value.jam_session,'scene_id')&&!own(value.jam_session,'scene_catalogue'))fail('invalid_project');
      if(own(value.jam_session,'scene_mix')&&(value.jam_session.scene_mix!==SCENE_MIX_VERSION||value.jam_session.scene_catalogue!==SCENE_CATALOGUE_VERSION))fail('invalid_project');
      if(own(value.jam_session,'showcase_version')&&value.jam_session.showcase_version!==1)fail('invalid_project');
      if(own(value.jam_session,'showcase_palette')&&value.jam_session.showcase_palette!=='sampled')fail('invalid_project');
      if(own(value.jam_session,'showcase_arrangement')&&value.jam_session.showcase_arrangement!=='contrast-v1')fail('invalid_project');
    }
    if(object(value.jam_session)&&own(value.jam_session,'anchor_backing')) {
      const anchor=value.jam_session.anchor_backing;
      if(!object(anchor)||anchor.version!==1||![12,16].includes(anchor.steps_per_bar)
        ||!Array.isArray(anchor.notes)||!anchor.notes.length||!Number.isFinite(anchor.time)||anchor.time<0
        ||anchor.steps_per_bar!==(value.global_context?.steps_per_bar??16))fail('invalid_project');
      if(anchor.notes.some(note=>note.provenance!=='jam_generated'||note.generated_by!=='musiclab_jam'))fail('invalid_project');
      if(anchor.notes.some(note=>!Number.isInteger(note.step)||note.step<0||note.step>=anchor.steps_per_bar*4
        ||(note.performance?.offset_steps??0)<0||(note.performance?.offset_steps??0)>=1))fail('invalid_project');
    }
    if(object(value.jam_session)&&own(value.jam_session,'anchor_traits')) {
      const traits=value.jam_session.anchor_traits;
      if(!value.jam_session.anchor_backing||!object(traits)||traits.version!==1
        ||![traits.drums,traits.chords].every(n=>Number.isInteger(n)&&n>=0&&n<=4))fail('invalid_project');
    }
    if(object(value.jam_session)&&own(value.jam_session,'style_traits')) {
      const traits=value.jam_session.style_traits;
      if(value.jam_session.scene_catalogue!==SCENE_CATALOGUE_VERSION||!object(traits)||traits.version!==1
        ||![traits.drums,traits.chords].every(n=>Number.isInteger(n)&&n>=0&&n<=4))fail('invalid_project');
    }
    if(object(value.jam_session)&&own(value.jam_session,'band_chord_patch')
      &&(value.jam_session.scene_catalogue!==SCENE_CATALOGUE_VERSION||value.jam_session.band_chord_patch!=='sampled_banjo_v1'))fail('invalid_project');
    if (own(value, 'song_cards')) {
      if (!Array.isArray(value.song_cards) || value.song_cards.length > 8) fail('invalid_arrangement');
      const sectionIds = new Set();
      for (const card of value.song_cards) {
        if (!object(card)) fail('invalid_arrangement');
        numeric(card, 'bars', 1, 4, true);
        if (own(card, 'material') && !object(card.material)) fail('invalid_arrangement');
        if (own(card, 'section_id') && (typeof card.section_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(card.section_id))) fail('invalid_arrangement');
        if (own(card, 'section_id')) { if (sectionIds.has(card.section_id)) fail('invalid_arrangement'); sectionIds.add(card.section_id); }
        if (own(card, 'section_direction') && !validSectionDirection(card.section_direction)) fail('invalid_arrangement');
      }
    }
    if (own(value, 'chord_progressions')) {
      if (!object(value.chord_progressions)) fail('invalid_progression');
      for (const [key, progression] of Object.entries(value.chord_progressions)) {
        if ((Object.hasOwn(Object.prototype, key) || key === 'prototype') || !Array.isArray(progression) || !progression.length || progression.length > 64) fail('invalid_progression');
        for (const chord of progression) {
          if (!object(chord)) fail('invalid_progression');
          numeric(chord, 'bar', 0, 63, true);
          numeric(chord, 'beats', Number.MIN_VALUE, 16);
          numeric(chord, 'degree', 1, 7, true);
        }
      }
    }
    if (own(value, 'active_progression_id') && (typeof value.active_progression_id !== 'string' || Object.hasOwn(Object.prototype, value.active_progression_id) || value.active_progression_id === 'prototype')) fail('invalid_progression');
    for (const child of Object.values(value)) visit(child, depth + 1);
  }
  visit(song);
  return song;
}
