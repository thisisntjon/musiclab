/** Plain names for every sampled patch, for places that show a saved sound by name.
 * A name here never makes a sound choosable: the jam and tune pickers still come from
 * instrument_catalogue.js, and getInstrument() still returns null for wheel-only sounds.
 * Names follow the Sound wheel. Where the wheel's name leans on its group (Game, Buzzy,
 * Brassy and Plucked sit inside Synths or Strings; Vibes is short for Vibraphone), the
 * full name is used, because a band row has no group around it. The three sounds that
 * are not on the wheel use their instrument catalogue names.
 */
export const SAMPLED_SOUND_LABELS = Object.freeze({
  // Keys
  sampled_piano_v1: 'Piano',
  sampled_electric_piano_v1: 'Electric piano',
  sampled_organ_v1: 'Organ',
  sampled_accordion_v1: 'Accordion',
  // Bells
  sampled_music_box_v1: 'Music box',
  sampled_marimba_v1: 'Marimba',
  sampled_vibraphone_v1: 'Vibraphone',
  // World
  sampled_steel_drums_v1: 'Steel pan',
  sampled_kalimba_v1: 'Kalimba',
  sampled_koto_v1: 'Koto',
  // Guitars
  sampled_guitar_v1: 'Guitar',
  sampled_steel_guitar_v1: 'Steel guitar',
  sampled_clean_guitar_v1: 'Electric guitar',
  sampled_overdrive_guitar_v1: 'Rock guitar',
  sampled_banjo_v1: 'Banjo',
  // Strings
  sampled_strings_v1: 'Violins',
  sampled_harp_v1: 'Harp',
  sampled_pizzicato_v1: 'Plucked strings',
  // Voices
  sampled_ooh_v1: 'Choir',
  sampled_solo_vox_v1: 'Solo voice',
  sampled_synth_voice_v1: 'Space voice',
  // Wind
  sampled_recorder_v1: 'Recorder',
  sampled_clarinet_v1: 'Clarinet',
  sampled_harmonica_v1: 'Harmonica',
  sampled_pan_flute_v1: 'Pan flute',
  sampled_ocarina_v1: 'Ocarina',
  sampled_bass_flute_v1: 'Bass flute',
  // Horns
  sampled_trumpet_v1: 'Trumpet',
  sampled_tenor_sax_v1: 'Saxophone',
  sampled_trombone_v1: 'Trombone',
  // Synths
  sampled_square_lead_v1: 'Game synth',
  sampled_saw_lead_v1: 'Buzzy synth',
  sampled_synth_brass_v1: 'Brassy synth',
  // Not on the wheel
  sampled_bass_v1: 'Finger bass',
  sampled_upright_bass_v1: 'Upright bass',
  sampled_muted_guitar_v1: 'Muted guitar',
});

/** The plain name of a sampled patch, or null for anything else (never a raw patch ID). */
export function sampledSoundLabel(patch) {
  return typeof patch === 'string' && Object.hasOwn(SAMPLED_SOUND_LABELS, patch) ? SAMPLED_SOUND_LABELS[patch] : null;
}
