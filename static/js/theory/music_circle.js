import {SCENE_CATALOGUE} from './scene_catalogue.js';

// Editorial navigation families, not an objective genre-distance model.
export const CIRCLE_GROUPS=Object.freeze([
  {
    "label": "Original bands",
    "sceneIds": [
      "contrast-0",
      "contrast-1",
      "contrast-2",
      "contrast-3"
    ]
  },
  {
    "label": "Roots / country",
    "sceneIds": [
      "bluegrass-v1",
      "old-time-v1",
      "progressive-bluegrass-v1",
      "honky-tonk-v1",
      "western-swing-v1",
      "outlaw-country-v1",
      "nashville-sound-v1",
      "bakersfield-sound-v1"
    ]
  },
  {
    "label": "Blues",
    "sceneIds": [
      "piedmont-v1",
      "delta-blues-v1",
      "country-blues-v1",
      "classic-blues-v1",
      "jump-blues-v1",
      "boogie-woogie-v1",
      "chicago-blues-v1",
      "texas-blues-v1"
    ]
  },
  {
    "label": "Jazz / bossa",
    "sceneIds": [
      "ragtime-v1",
      "stride-piano-v1",
      "swing-v1",
      "new-orleans-jazz-v1",
      "bebop-v1",
      "cool-jazz-v1",
      "hard-bop-v1",
      "modal-jazz-v1",
      "jazz-fusion-v1",
      "jazz-manouche-v1",
      "bossa-nova-v1"
    ]
  },
  {
    "label": "Soul / R&B",
    "sceneIds": [
      "early-rnb-v1",
      "gospel-piano-v1",
      "doo-wop-v1",
      "soul-v1",
      "memphis-soul-v1",
      "philadelphia-soul-v1",
      "neo-soul-v1",
      "soul-jazz-v1"
    ]
  },
  {
    "label": "Ska / reggae",
    "sceneIds": [
      "ska-v1",
      "rocksteady-v1",
      "reggae-v1"
    ]
  },
  {
    "label": "Hip-hop / downtempo",
    "sceneIds": [
      "hip-hop-v1",
      "boom-bap-v1",
      "trip-hop-v1",
      "downtempo-v1",
      "trap-v1"
    ]
  },
  {
    "label": "House / techno",
    "sceneIds": [
      "house-v1",
      "deep-house-v1",
      "tech-house-v1",
      "progressive-house-v1",
      "trance-v1",
      "techno-v1",
      "minimal-techno-v1",
      "electro-v1"
    ]
  },
  {
    "label": "Garage / breaks",
    "sceneIds": [
      "uk-garage-v1",
      "two-step-v1",
      "dubstep-v1",
      "grime-v1",
      "breakbeat-v1",
      "drum-and-bass-v1",
      "jungle-v1",
      "liquid-dnb-v1",
      "jersey-club-v1",
      "baltimore-club-v1",
      "footwork-v1"
    ]
  },
  {
    "label": "Rock / metal",
    "sceneIds": [
      "new-wave-v1",
      "post-punk-v1",
      "psychedelic-rock-v1",
      "indie-rock-v1",
      "garage-rock-v1",
      "punk-rock-v1",
      "hard-rock-v1",
      "grunge-v1",
      "heavy-metal-v1",
      "thrash-metal-v1",
      "death-metal-v1",
      "black-metal-v1"
    ]
  }
].map(group=>Object.freeze({...group,sceneIds:Object.freeze(group.sceneIds)})));
export const CIRCLE_SCENES=Object.freeze(CIRCLE_GROUPS.flatMap(g=>g.sceneIds));
if(CIRCLE_SCENES.length!==SCENE_CATALOGUE.length||new Set(CIRCLE_SCENES).size!==CIRCLE_SCENES.length||CIRCLE_SCENES.some(id=>!SCENE_CATALOGUE.some(s=>s.id===id)))throw Error('Circle coverage must match the playable catalogue.');
export function circleSceneAt(x,y) {
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x-.5,y-.5)<.12)return null;
  const turn=((Math.atan2(y-.5,x-.5)/(2*Math.PI)+.25)%1+1)%1;
  const sector=turn*CIRCLE_GROUPS.length,group=CIRCLE_GROUPS[Math.min(CIRCLE_GROUPS.length-1,Math.floor(sector))];
  return group.sceneIds[Math.min(group.sceneIds.length-1,Math.floor((sector-Math.floor(sector))*group.sceneIds.length))];
}
export function circlePosition(id,radius=.44) {
  const groupIndex=CIRCLE_GROUPS.findIndex(g=>g.sceneIds.includes(id));if(groupIndex<0)return null;
  const group=CIRCLE_GROUPS[groupIndex],index=group.sceneIds.indexOf(id);
  const angle=((groupIndex+(index+.5)/group.sceneIds.length)/CIRCLE_GROUPS.length-.25)*2*Math.PI;
  return {x:.5+radius*Math.cos(angle),y:.5+radius*Math.sin(angle)};
}
export function circleStep(id,delta) {
  const i=Math.max(0,CIRCLE_SCENES.indexOf(id));return CIRCLE_SCENES[((i+delta)%CIRCLE_SCENES.length+CIRCLE_SCENES.length)%CIRCLE_SCENES.length];
}
export function circleFamilyStep(id,delta) {
  return circleFamilyScenes(id,delta)[0];
}
/** The next family's scenes in circle order; the first is the plain Next family landing. */
export function circleFamilyScenes(id,delta) {
  const i=Math.max(0,CIRCLE_GROUPS.findIndex(g=>g.sceneIds.includes(id)));return CIRCLE_GROUPS[(i+delta+CIRCLE_GROUPS.length)%CIRCLE_GROUPS.length].sceneIds;
}

// Only this explicitly scored family has continuous coordinates. Other sectors
// remain discrete authored handovers; no inferred global genre distance.
export const SCORED_CIRCLE_SCENES=Object.freeze(['ska-v1','rocksteady-v1','reggae-v1']);
export function circleFieldForScene(id) {
  const i=SCORED_CIRCLE_SCENES.indexOf(id);return i<0?null:{version:5,x:i/2,y:.5};
}
export function circleChoiceAt(x,y) {
  const id=circleSceneAt(x,y);if(!id)return null;
  if(!SCORED_CIRCLE_SCENES.includes(id))return {id,field:null};
  const turn=((Math.atan2(y-.5,x-.5)/(2*Math.PI)+.25)%1+1)%1;
  const group=CIRCLE_GROUPS.findIndex(g=>g.sceneIds.includes('ska-v1'));
  const value=Math.max(0,Math.min(1,((turn*CIRCLE_GROUPS.length-group)*3-.5)/2));
  const field={version:5,x:Math.round(value*1000)/1000,y:.5};
  return {id:SCORED_CIRCLE_SCENES[Math.round(field.x*2)],field};
}
export function circleFieldPosition(field,radius=.44) {
  if(field?.version!==5)return null;
  const group=CIRCLE_GROUPS.findIndex(g=>g.sceneIds.includes('ska-v1'));
  const angle=((group+(.5+field.x*2)/3)/CIRCLE_GROUPS.length-.25)*2*Math.PI;
  return {x:.5+radius*Math.cos(angle),y:.5+radius*Math.sin(angle)};
}
