/** Generated-score reference velocities through the current native synth bus.
 * Calibrated against sampled-role renders; do not apply to personal notes or
 * reinterpret older saved velocities. New recipes still need matched renders.
 */
export const NATIVE_SCENE_BASS_LEVEL=.0036;
// Program53 matched against the existing soul/R&B neighborhood, generated only.
export const OOH_SCENE_LEVEL=1.75;
export const GRIME_SCENE_LEVEL=1.25;
export function sceneHarmonyLevel(patch){
  if(patch.startsWith('sampled_'))return .3;
  return patch==='supersaw_stab'?.0035:.0021;
}

export const OUTLAW_STUDY_LEVEL=2;
export const PROGRESSIVE_STUDY_LEVEL=1.75;
export const DELTA_STUDY_LEVEL=2;
