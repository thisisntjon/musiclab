/** Versioned identity for the existing bank; changing a record requires a new patch ID.
 * Probe ranges are test coverage, not a claim of idiomatic or full acoustic range.
 * No per-note bends, pedals, bank selection or articulation switching are implied.
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
};
const probes=Object.freeze({pitches:Object.freeze([36,48,60,72,84]),velocities:Object.freeze([48,96,127]),gatesSeconds:Object.freeze([.08,.6,3]),sampleRate:44100,reverb:0,chorus:0});
export const SAMPLED_SOUND_CAPABILITIES=Object.freeze(Object.fromEntries(Object.entries(programs).map(([id,program])=>[id,Object.freeze({
  id,version:1,bankId:SAMPLED_BANK.id,bank:0,program,pitchResolution:'semitone',
  release:'independent-note-off',articulation:'preset',pythonAudio:false,browserAudio:true,
  ...(program===28||program===32?{probe:probes,observedReleaseUpperBoundSeconds:program===28?.25:1.25}:{}),
})])));
export const SAMPLED_PROGRAMS=Object.freeze({...programs});
