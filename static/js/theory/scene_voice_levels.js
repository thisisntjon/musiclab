/** Generated-score reference velocities through the current native synth bus.
 * Calibrated against sampled-role renders; do not apply to personal notes or
 * reinterpret older saved velocities. New recipes still need matched renders.
 */
export const NATIVE_SCENE_BASS_LEVEL=.0036;
// Sampled velocity to native velocity, measured against the sampled voices: .qa-tools/pad-level-probe.cjs.
const STAND_IN_LEVEL={bass:.008,lead:.012,harmony:.01,hocket:.01};
export const standInLevel=role=>STAND_IN_LEVEL[role]??.01;
const LIVE_SAMPLED_VELOCITY=.85,LIVE_DRUM_VELOCITY=.1;
/** What the band adds when a person's playing builds energy, in the same native levels as the band it joins. */
export const ENERGY_ROLL_LEVEL=.1;
export const ENERGY_RISER_VELOCITY=.0055,ENERGY_DROP_VELOCITY=.0065;
/** Dimming quiets a note and keeps it audible. A native voice already below the floor stays where it is, never raised. */
export const dimmedVelocity=velocity=>{const v=velocity||.8;return Math.max(Math.min(v,.08),v*.22);};
/** How hard a live key strikes. Sampled voices take the usual velocity; a stand-in is scaled where it sounds, not here. */
export const liveVelocity=(patchId,role,sampled)=>sampled?LIVE_SAMPLED_VELOCITY:role==='drums'?LIVE_DRUM_VELOCITY:LIVE_SAMPLED_VELOCITY*standInLevel(role);
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
