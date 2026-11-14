/** Versioned identity for the existing bank; changing a record requires a new patch ID.
 * Probe ranges are test coverage, not a claim of idiomatic or full acoustic range.
 * No per-note bends, pedals, bank selection or articulation switching are implied.
 * Transpose (13 Nov 2026): a patch may sound a fixed number of semitones away from the note's
 * written pitch (SAMPLED_TRANSPOSE, and transposeSemitones on its record; a record without it
 * sounds as written). The bank has no bass flute preset (and no MSB variation of one), so
 * sampled_bass_flute_v1 plays the unmodified Flute preset (program 73) 12 semitones below the
 * written note, as a real bass flute sounds an octave below its written pitch. Only the browser
 * audio path applies it (pianoNotes in static/js/audio/sampled_piano.js, which serves live play,
 * previews, jam answers and the offline/WAV render). Notes, saved songs, the score and all pitch
 * data keep the written pitch, and no bank preset is edited. While the bank loads, the native
 * stand-in voice (scheduler LOADING_VOICES) plays the written pitch, as it does for every patch.
 */
export const SAMPLED_BANK = Object.freeze({
  id:'generaluser-gs-2.0.3', bank:0,
  sha256:'9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe',
  renderer:'spessasynth-browser', releasePolicySeconds:6,
});
const programs={
  sampled_overdrive_guitar_v1:29, sampled_organ_v1:16, sampled_harmonica_v1:22,
  sampled_trumpet_v1:56, sampled_tenor_sax_v1:66, sampled_clarinet_v1:71,
  sampled_piano_v1:0, sampled_electric_piano_v1:4, sampled_ooh_v1:53,
  sampled_strings_v1:48, sampled_steel_guitar_v1:25, sampled_guitar_v1:24,
  sampled_clean_guitar_v1:27, sampled_bass_v1:33, sampled_banjo_v1:105,
  sampled_muted_guitar_v1:28, sampled_upright_bass_v1:32,
  // Sound wheel additions (13 Nov 2026): melodic presets measured in
  // workflow/evidence/sound-wheel-more-2026-11-13/candidate-metrics.json.
  sampled_accordion_v1:21, sampled_music_box_v1:10, sampled_marimba_v1:12, sampled_vibraphone_v1:11,
  sampled_steel_drums_v1:114, sampled_kalimba_v1:108, sampled_koto_v1:107, sampled_harp_v1:46,
  sampled_pizzicato_v1:45, sampled_solo_vox_v1:85, sampled_synth_voice_v1:54, sampled_recorder_v1:74,
  sampled_pan_flute_v1:75, sampled_ocarina_v1:79, sampled_trombone_v1:57, sampled_square_lead_v1:80,
  sampled_saw_lead_v1:81, sampled_synth_brass_v1:62,
  // Bass flute (13 Nov 2026): the bank's Flute preset, sounded an octave down (see transpose).
  sampled_bass_flute_v1:73,
};
// Semitones a patch sounds from the written pitch. Patches not listed sound as written.
const transpose={sampled_bass_flute_v1:-12};
const probes=Object.freeze({pitches:Object.freeze([36,48,60,72,84]),velocities:Object.freeze([48,96,127]),gatesSeconds:Object.freeze([.08,.6,3]),sampleRate:44100,reverb:0,chorus:0});
export const SAMPLED_SOUND_CAPABILITIES=Object.freeze(Object.fromEntries(Object.entries(programs).map(([id,program])=>[id,Object.freeze({
  id,version:1,bankId:SAMPLED_BANK.id,bank:0,program,pitchResolution:'semitone',
  release:'independent-note-off',articulation:'preset',pythonAudio:false,browserAudio:true,
  ...(program===28||program===32?{probe:probes,observedReleaseUpperBoundSeconds:program===28?.25:1.25}:{}),
  ...(Object.hasOwn(transpose,id)?{transposeSemitones:transpose[id]}:{}),
})])));
export const SAMPLED_PROGRAMS=Object.freeze({...programs});
export const SAMPLED_TRANSPOSE=Object.freeze({...transpose});
