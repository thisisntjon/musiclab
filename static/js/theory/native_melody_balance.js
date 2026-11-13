import {LAUNCH_PROFILES} from './melody_genre_profiles_launch.js';

const nativeScenes=new Set(['trance-v1','progressive-house-v1']);
/** Fresh sessions opt in; saved contexts without this record retain their original wheel. */
export function captureNativeMelodyBalance(context){
  if(!context||!nativeScenes.has(context.sceneId)||context.patch!=='pluck_lead')return context;
  const notes=context.source.events.filter(n=>n.role==='lead'&&n.patch_id==='pluck_lead'
    &&n.provenance==='jam_generated'&&Number.isFinite(n.velocity)&&n.velocity>0);
  if(!notes.length)return context;
  const level=notes.reduce((sum,n)=>sum+n.velocity,0)/notes.length;
  return {...context,nativeLeadBalance:{version:1,patch:'pluck_lead',level}};
}

/** Adapt only generated alternatives, never Original, personal notes or accompaniment. */
export function balanceNativeMelodyPlans(plans,context){
  const spec=context.nativeLeadBalance;
  if(!spec)return plans;
  const profile=LAUNCH_PROFILES[`${context.sceneId}#${context.form?.blockIndex??0}`];
  if(spec.version!==1||spec.patch!=='pluck_lead'||context.patch!==spec.patch||!nativeScenes.has(context.sceneId)
    ||!Number.isFinite(spec.level)||spec.level<=0||spec.level>1||!profile?.level)
    throw new Error('This saved sound level is not supported. Your tune stays.');
  const gain=Math.min(1,spec.level/profile.level);
  return Object.fromEntries(Object.entries(plans).map(([key,plan])=>[key,key==='original'?plan:{...plan,
    notes:plan.notes.map(n=>n.role==='lead'&&n.patch_id===spec.patch&&n.provenance==='jam_generated'
      &&n.generated_by==='musiclab_phrase_composer_v5'?{...n,velocity:n.velocity*gain}:n)}]));
}
