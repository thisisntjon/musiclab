import {applyAnchorTraits} from './band_anchor.js';

export const CHORD_VOICE_SCENES=Object.freeze(['rocksteady-v1','reggae-v1']);

/** Apply shared intent once to a freshly generated recipe, never to a Stay snapshot. */
export function applyStyleTraits(notes,session,preserved,doc) {
  let result=notes;
  if(session.band_chord_patch==='sampled_banjo_v1'&&CHORD_VOICE_SCENES.includes(session.scene_id))
    result=result.map(n=>n.provenance==='jam_generated'&&n.role==='harmony'?{...n,patch_id:'sampled_banjo_v1'}:n);
  return applyAnchorTraits(result,session.style_traits,preserved,doc);
}
