import {isSampledPatch} from '../js/audio/sampled_piano.js';
import {melodyChoice as developedNineChoice} from '../js/theory/melody_composer_v9.js';
import {melodyChoice as developedChoice} from '../js/theory/melody_composer_v7.js';
import {MELODY_FAMILIES as MOTIF_FAMILIES,melodyChoice as motifChoice} from '../js/theory/melody_composer_v6.js';
import {MELODY_FAMILIES as GENRE_FAMILIES,melodyChoice as genreChoice} from '../js/theory/melody_composer_v5.js';
import {MELODY_FAMILIES as CORPUS_FAMILIES,melodyChoice as corpusChoice} from '../js/theory/melody_composer_v4.js';
import {balanceBasis,balancedEvents} from '../js/theory/melody_balance.js';
import {MELODY_FAMILIES as VOCAB_FAMILIES,melodyChoice as vocabularyChoice} from '../js/theory/melody_composer_v3.js';
import {MELODY_FAMILIES as PHRASE_FAMILIES,melodyChoice as phraseChoice} from '../js/theory/melody_composer_v2.js';
import {MELODY_FAMILIES as LEGACY_FAMILIES,melodyChoice as legacyChoice} from '../js/theory/melody_composer.js';
import {createMelodyField,melodyFieldVariant,melodyFieldPosition,melodyFieldRegion,MELODY_FIELD_V3_REGIONS} from '../js/theory/melody_field.js';
import {melodyFieldPlaybackView} from '../js/audio/melody_field_view.js';
import {melodyFieldTourPosition} from '../js/theory/melody_field_tour.js';
import {VIEWBOX_WIDTH,VIEWBOX_HEIGHT,buildLiveScoreModel,computeLiveScoreFrame} from '../js/theory/live_score_model.js';
import {syncLiveScoreSvg,isCalmVisuals,extractLivePersonalEvents} from './live_score_visualizer.js';
import {BASS_BAND,BASS_WAYS,BASS_SIZES,BASS_HUB_RADIUS,BASS_RING_EDGES,bassAdmission,applyBassMove,bassBasis,bassKeyMove,bassSector,bassWheelRecord,parseBassMove} from '../js/theory/bass_wheel.js';

/** Every pitched sound in the bundled bank except the two basses (kept for a bass wheel) and
 * muted guitar (a click with little note body: 9-10 dB under piano even at full velocity).
 * level scales generated-note velocity so sounds land within about 2 dB of piano; measured
 * lead-only in development records and, for the
 * 13 Nov additions, development records.
 * Nine groups sit clockwise from the top; each group's sounds are contiguous and its first sound
 * is the one a group plays when it is picked. Entry 0 is the tune's own sound (no wheel choice).
 * Saved patch IDs never change; only the group a sound sits in may. */
export const MELODY_SOUND_FAMILIES=Object.freeze([
  {name:'Keys',hue:'#5aa9e6'},{name:'Bells',hue:'#f2d04b'},{name:'World',hue:'#4fd1c5'},
  {name:'Guitars',hue:'#e6a34f'},{name:'Strings',hue:'#7fcf8a'},{name:'Voices',hue:'#b59cf0'},
  {name:'Wind',hue:'#d86fae'},{name:'Horns',hue:'#f07a5a'},{name:'Synths',hue:'#b8e04f'},
].map(Object.freeze));
export const MELODY_SOUNDS=Object.freeze([
  {label:'Own sound',short:'Own',patch:null,family:null},
  {label:'Piano',short:'Piano',patch:'sampled_piano_v1',level:1,family:'Keys'},
  {label:'Electric piano',short:'E-piano',patch:'sampled_electric_piano_v1',level:1.02,family:'Keys'},
  {label:'Organ',short:'Organ',patch:'sampled_organ_v1',level:1,family:'Keys'},
  {label:'Accordion',short:'Accordion',patch:'sampled_accordion_v1',level:1.23,family:'Keys'},
  {label:'Music box',short:'Music box',patch:'sampled_music_box_v1',level:1.59,family:'Bells'},
  {label:'Marimba',short:'Marimba',patch:'sampled_marimba_v1',level:1.04,family:'Bells'},
  {label:'Vibes',short:'Vibes',patch:'sampled_vibraphone_v1',level:0.85,family:'Bells'},
  {label:'Steel pan',short:'Steel pan',patch:'sampled_steel_drums_v1',level:1.2,family:'World'},
  {label:'Kalimba',short:'Kalimba',patch:'sampled_kalimba_v1',level:1.09,family:'World'},
  {label:'Koto',short:'Koto',patch:'sampled_koto_v1',level:1.23,family:'World'},
  {label:'Guitar',short:'Guitar',patch:'sampled_guitar_v1',level:1.16,family:'Guitars'},
  {label:'Steel guitar',short:'Steel',patch:'sampled_steel_guitar_v1',level:1.4,family:'Guitars'},
  {label:'Electric guitar',short:'Electric',patch:'sampled_clean_guitar_v1',level:1.2,family:'Guitars'},
  {label:'Rock guitar',short:'Rock',patch:'sampled_overdrive_guitar_v1',level:0.9,family:'Guitars'},
  {label:'Banjo',short:'Banjo',patch:'sampled_banjo_v1',level:1.3,family:'Guitars'},
  {label:'Violins',short:'Violins',patch:'sampled_strings_v1',level:1.1,family:'Strings'},
  {label:'Harp',short:'Harp',patch:'sampled_harp_v1',level:0.83,family:'Strings'},
  {label:'Plucked',short:'Plucked',patch:'sampled_pizzicato_v1',level:1.25,family:'Strings'},
  {label:'Choir',short:'Choir',patch:'sampled_ooh_v1',level:0.9,family:'Voices'},
  {label:'Solo voice',short:'Solo',patch:'sampled_solo_vox_v1',level:0.76,family:'Voices'},
  {label:'Space voice',short:'Space',patch:'sampled_synth_voice_v1',level:1.2,family:'Voices'},
  {label:'Recorder',short:'Recorder',patch:'sampled_recorder_v1',level:0.89,family:'Wind'},
  {label:'Clarinet',short:'Clarinet',patch:'sampled_clarinet_v1',level:0.84,family:'Wind'},
  {label:'Harmonica',short:'Harmonica',patch:'sampled_harmonica_v1',level:1.2,family:'Wind'},
  {label:'Pan flute',short:'Pan flute',patch:'sampled_pan_flute_v1',level:1,family:'Wind'},
  // Flute (GM 73) an octave below the written tune; level from bank-36/bass-flute-level.json.
  {label:'Bass flute',short:'Bass flute',patch:'sampled_bass_flute_v1',level:1.04,family:'Wind'},
  {label:'Ocarina',short:'Ocarina',patch:'sampled_ocarina_v1',level:0.66,family:'Wind'},
  {label:'Trumpet',short:'Trumpet',patch:'sampled_trumpet_v1',level:0.93,family:'Horns'},
  {label:'Saxophone',short:'Sax',patch:'sampled_tenor_sax_v1',level:0.97,family:'Horns'},
  {label:'Trombone',short:'Trombone',patch:'sampled_trombone_v1',level:0.88,family:'Horns'},
  {label:'Game',short:'Game',patch:'sampled_square_lead_v1',level:0.96,family:'Synths'},
  {label:'Buzzy',short:'Buzzy',patch:'sampled_saw_lead_v1',level:0.95,family:'Synths'},
  {label:'Brassy',short:'Brassy',patch:'sampled_synth_brass_v1',level:1.01,family:'Synths'},
].map(Object.freeze));
const OWN_SOUND=MELODY_SOUNDS[0].label;
const soundLabel=patch=>MELODY_SOUNDS.find(s=>s.patch===patch)?.label||OWN_SOUND;

/** The group a sound sits in, or null for the tune's own sound and unknown patches. */
export function familyOf(patch) {
  return patch?MELODY_SOUNDS.find(s=>s.patch===patch)?.family??null:null;
}
/** A group's sounds in ring order (the first is the one the group plays when picked). */
export function familySounds(name) {
  return name?MELODY_SOUNDS.filter(s=>s.family===name):[];
}
const familyIndex=name=>MELODY_SOUND_FAMILIES.findIndex(f=>f.name===name);
const soundIndex=patch=>MELODY_SOUNDS.findIndex(s=>s.patch===patch);
export const SOUND_HUB_RADIUS=.3;
export const SOUND_HYSTERESIS_DEG=4;
export const SOUND_HUB_MARGIN=.05;

/** Which part of the Sound wheel a disk point is on. x and y run from -1 to 1 with y up; 0 degrees is
 * the top and angles run clockwise. view null is the group ring (9 sectors of 40 degrees, sector i
 * centred on i*40); a group name is that group's sound ring (n sectors of 360/n, sector i centred on
 * i*360/n). Returns 'hub' inside radius .30, a sector index, or null outside the disk. prev is the
 * sector held by a drag: it stays until the angle is 4 degrees past its edge, and a drag that slips
 * off the rim keeps turning the wheel. The middle's edge holds the same way: a drag that holds the middle
 * stays in it until .05 past its edge, and a drag that holds a sector stays on it until .05 inside. */
export function soundSector(view,x,y,prev=null) {
  const r=Math.hypot(x,y);
  if(r<SOUND_HUB_RADIUS+(prev==='hub'?SOUND_HUB_MARGIN:prev==null?0:-SOUND_HUB_MARGIN))return 'hub';
  if(r>1&&prev==null)return null;
  const n=view?familySounds(view).length:MELODY_SOUND_FAMILIES.length;
  if(!n)return null;
  const width=360/n,angle=(Math.atan2(x,y)*180/Math.PI+360)%360;
  if(Number.isInteger(prev)&&prev>=0&&prev<n) {
    const off=Math.abs((((angle-prev*width)%360)+540)%360-180);
    if(off<=width/2+SOUND_HYSTERESIS_DEG)return prev;
  }
  return Math.round(angle/width)%n;
}

/** What one key does on the Sound wheel. Returns null for keys the wheel leaves alone, otherwise
 * {view, patch, focus}: the ring to show, the sound to choose (undefined keeps the sound) and the
 * data-key that takes focus. Group ring: Right/Down and Left/Up step round the groups and Own sound,
 * which sits between Synths and Keys; each group plays the sound last chosen in it (kept, by group
 * name) or else its first sound, as a drag back to the group it started on does. Home picks the
 * tune's own sound. Sound ring: Left/Right step round the group's sounds, Up/Down open the
 * previous/next group, Backspace shows all groups, Home picks the tune's own sound and shows all groups. */
export function soundKeyMove(view,patch,key,kept={}) {
  const groups=MELODY_SOUND_FAMILIES.length,soundKey=p=>`melody-field-sound-${soundIndex(p)}`;
  const openGroup=i=>{const name=MELODY_SOUND_FAMILIES[i].name,lead=familySounds(name)[0].patch;return {view:name,patch:lead,focus:soundKey(lead)};};
  if(key==='Home')return {view:null,patch:null,focus:soundKey(null)};
  const at=familyIndex(familyOf(patch));
  if(!view) {
    const step=key==='ArrowRight'||key==='ArrowDown'?1:key==='ArrowLeft'||key==='ArrowUp'?-1:0;
    if(!step)return null;
    const i=at<0?(step>0?0:groups-1):at+step;
    if(i<0||i>=groups)return {view:null,patch:null,focus:soundKey(null)};
    const name=MELODY_SOUND_FAMILIES[i].name,back=kept?.[name];
    return {view:null,patch:familyOf(back)===name?back:familySounds(name)[0].patch,focus:`melody-field-family-${i}`};
  }
  const open=familyIndex(view);if(open<0)return null;
  if(key==='Backspace')return {view:null,patch:undefined,focus:`melody-field-family-${open}`};
  if(key==='ArrowUp'||key==='ArrowDown')return openGroup((open+(key==='ArrowDown'?1:-1)+groups)%groups);
  if(key!=='ArrowLeft'&&key!=='ArrowRight')return null;
  const sounds=familySounds(view),j=sounds.findIndex(s=>s.patch===patch),n=sounds.length;
  const next=j<0?(key==='ArrowRight'?0:n-1):(j+(key==='ArrowRight'?1:-1)+n)%n;
  return {view,patch:sounds[next].patch,focus:soundKey(sounds[next].patch)};
}

/** A group button's name: it opens that group's sounds, and says which one is chosen when it is in the group. */
// The spoken name starts with the visible words (WCAG 2.5.3 label in name), then says what the button opens.
const soundGroupLabel=(name,patch)=>familyOf(patch)===name?`${name} ${MELODY_SOUNDS[soundIndex(patch)].short}, ${name} sounds`:`${name} sounds`;
/** Disk markup for one ring. Labels sit on their sector centres; states are drawn on the labels. Every hub,
 * group and sound button is a Tab stop of its own, so Tab and Enter alone can change the sound. */
function soundRingHtml(view,patch) {
  const chosenFamily=familyOf(patch),place=(a,r)=>`left:${(50+Math.sin(a)*r).toFixed(3)}%;top:${(50-Math.cos(a)*r).toFixed(3)}%`;
  const sector=(hue,i,n,alpha)=>`${hue}${alpha} ${i*360/n}deg ${(i+1)*360/n}deg`;
  const dividers=n=>`repeating-conic-gradient(from ${-180/n-.45}deg, #090c16 0deg .9deg, transparent .9deg ${360/n}deg)`;
  if(!view) {
    const n=MELODY_SOUND_FAMILIES.length;
    const fill=MELODY_SOUND_FAMILIES.map((f,i)=>sector(f.hue,i,n,i%2?'40':'70')).join(',');
    // The chosen sound's name hangs off its group on the side with room, so it never widens the label
    // towards its neighbours or reaches past the rim: up at the very top and on the lower slopes, else down.
    const groups=MELODY_SOUND_FAMILIES.map((f,i)=>{const on=f.name===chosenFamily,now=on?MELODY_SOUNDS[soundIndex(patch)].short:'',a=i*Math.PI*2/n,c=Math.cos(a);
      return `<button type="button" class="pf-sound-sector pf-sound-group" data-key="melody-field-family-${i}" data-sound-family="${i}" data-out="${c>.9||(c<0&&c>-.9)?'up':'down'}" aria-label="${soundGroupLabel(f.name,patch)}"${on?' data-chosen="true"':''} style="${place(a,36)};--hue:${f.hue}">${f.name} <span class="pf-sound-now" data-sound-now>${now}</span></button>`;}).join('');
    const own=!patch;
    return `<div class="pf-sound-ring" data-ring="groups" style="background:${dividers(n)},conic-gradient(from ${-180/n}deg, ${fill})">`
      +`<button type="button" class="pf-sound-sector pf-sound-hub" data-key="melody-field-sound-0" data-sound-choice="0" aria-pressed="${own}"${own?' data-chosen="true"':''}>${OWN_SOUND}</button>${groups}</div>`;
  }
  const f=MELODY_SOUND_FAMILIES[familyIndex(view)],sounds=familySounds(view),n=sounds.length;
  const fill=sounds.map((s,i)=>sector(f.hue,i,n,n%2?['80','4c','66'][i%3]:['80','4c'][i%2])).join(',');
  const rim=MELODY_SOUND_FAMILIES.map((g,i)=>`${g.hue}${g.name===view?'':'59'} ${i*40}deg ${(i+1)*40}deg`).join(',');
  // Sound labels sit in the middle of the band between the hub (15%) and the rim (50%), so a side label keeps
  // room for its filled pill and focus ring inside the round edge on a 230 px disk.
  const buttons=sounds.map((s,i)=>{const on=s.patch===patch,index=soundIndex(s.patch);
    return `<button type="button" class="pf-sound-sector pf-sound-choice" data-key="melody-field-sound-${index}" data-sound-choice="${index}" aria-pressed="${on}"${on?' data-chosen="true"':''} style="${place(i*Math.PI*2/n,32.5)};--hue:${f.hue}">${s.label}</button>`;}).join('');
  return `<div class="pf-sound-ring" data-ring="sounds" style="background:${dividers(n)},conic-gradient(from ${-180/n}deg, ${fill});--hue:${f.hue}">`
    +`<span class="pf-sound-rim" aria-hidden="true" style="background:conic-gradient(from -20deg, ${rim})"></span>${buttons}`
    +`<button type="button" class="pf-sound-sector pf-sound-hub" data-key="melody-field-families" style="--hue:${f.hue}">All groups</button></div>`;
}
const soundPrompt=view=>view?'Turn to hear each sound. The middle shows all groups.':'Turn to hear each group. Let go to see its sounds. Your notes stay.';
// The disk's words lead with what works in a screen reader's browse mode too (press a button), then the keys.
const soundDiskLabel=view=>view?`${view} sounds. Press a sound to pick it. All groups goes back. Left and right change the sound. Up and down change the group. Home picks Own sound.`
  :'Sound groups. Press a group to see its sounds. Arrows hear each group. Home picks Own sound.';
/** Said through the wheel's polite live region when the view changes (focus alone does not say it). */
const soundViewSay=view=>view?`${view} sounds.`:'All groups.';
export function melodySoundEvents(events,patch) {
  if(!MELODY_SOUNDS.some(s=>s.patch===patch))throw new Error('Unknown melody sound');
  const level=MELODY_SOUNDS.find(s=>s.patch===patch)?.level??1;
  // sound_base keeps each note's sound before any wheel choice, so levels never stack across
  // reopen or repeated choices, and Original restores it exactly. A note already in this sound
  // without a base (older saves, which were never scaled) is left as it is.
  return events.map(e=>{
    if(e.role!=='lead'||e.provenance!=='jam_generated'||e.edited_from_generator)return e;
    if(!patch){
      if(!e.sound_base)return e;
      const {sound_base:base,...rest}=e,restored={...rest,patch_id:base.patch_id};
      if(Object.hasOwn(base,'velocity'))restored.velocity=base.velocity;else delete restored.velocity;
      return restored;
    }
    if(!e.sound_base&&e.patch_id===patch)return e;
    const base=e.sound_base||{patch_id:e.patch_id,...(Object.hasOwn(e,'velocity')?{velocity:e.velocity}:{})};
    return {...e,patch_id:patch,velocity:Math.min(1,Number(base.velocity??.85)*level),sound_base:base};
  });
}
// ---- Bass wheel (bass_wheel.js has the music; this is the disk, its words and its states) ----
/** One hue per way, clockwise from the top: Deep, Steady, Walk, Bounce, Funky, Chill. */
export const BASS_HUES=Object.freeze({deep:'#6f8df0',steady:'#4fd1c5',walk:'#7fcf8a',bounce:'#f2d04b',funky:'#f07a5a',chill:'#b59cf0'});
const BASS_RINGS=[[BASS_HUB_RADIUS,BASS_RING_EDGES[0]],[BASS_RING_EDGES[0],BASS_RING_EDGES[1]],[BASS_RING_EDGES[1],1]];
/** Way labels sit in the middle of the Full ring, as a share of the disk from its centre. */
export const BASS_LABEL_RADIUS=(BASS_RING_EDGES[0]+BASS_RING_EDGES[1])/4*100;
const wayOf=id=>BASS_WAYS.find(w=>w.id===id);
const sizeName=id=>BASS_SIZES.find(s=>s.id===id)?.label??'';
/** Words for a move in the status line: 'Funky bass. It is big', 'Band bass', or 'Your kept bass' (an untagged kept line). */
export function bassSay(move) {
  const m=parseBassMove(move);
  if(!m)return 'Your kept bass';
  if(!m.way)return 'Band bass';
  return `${wayOf(m.way).label} bass. It is ${m.size}`;
}
/** Under the disk: what the rings mean (the picture also names them on the spoke between Steady and Walk). */
export const BASS_LEGEND='Near the middle: light. At the edge: big.';
/** Hear bass clearly: the scheduler's spotlight layer that keeps bass and beat full and softens the rest (scheduler.js). */
export const BASS_SPOTLIGHT='bass-beat';
export const BASS_PROMPT='Turn to try a new bass. Go out for more notes. Your tune stays.';
/** The Sound wheel's own first line, and the Tune wheel's keys line (the disk's description). */
export const SOUND_WHEEL_LINE='Your tune stays. Pick how it sounds.';
export const TUNE_WHEEL_KEYS='Arrow keys move it. Or use Move with buttons.';
/** Beside the keep message while full sounds have failed; only then is it a button (and a scan stop). */
const SOUNDS_RETRY='<button class="pf-btn pf-small" data-key="sounds-retry">Load sounds again</button>';
export const BASS_PERSONAL='Your notes on the bass stay. The new bass goes round them.';
export const BASS_SOFTER='The band is softer. Use the tune wheel to change it.';
export const BASS_ERROR='That move did not play. Your bass stays. Stop, then play to try again.';
export const BASS_KEEP_HELP='Keep saves your tune with this bass. Next, Save here keeps it in this browser.';
/** Original and Undo turn the whole session; on the Bass wheel the status adds one of these when they also changed the tune. */
export const BASS_TUNE_CHANGED='Your tune changed too.';
export const BASS_SOUND_CHANGED='Your tune sound changed too.';
/** What each way does, in the app's own child words (the drums are the beat, never the kick): said in its button's name
 * and shown in the status and under the disk. A way missing here would use its BASS_WAYS hint. */
const BASS_HINTS=Object.freeze({deep:'Long low notes.',steady:'Plays with the beat.',walk:'Steps up and down.',bounce:'Jumps low and high.',funky:'Short notes with gaps.',chill:'Easy, with lots of space.'});
const hintOf=way=>BASS_HINTS[way]??wayOf(way).hint;
/** A way's hint ('Short notes with gaps.'), or '' for anything that is not a way. */
export const bassWayHint=way=>wayOf(way)?hintOf(way):'';
// The disk's words lead with what works in a screen reader's browse mode too (press a button), then the keys.
export const BASS_DISK_LABEL='Bass ways. Press a way to hear it. Press it again for a new size. Left and right change the way. Up makes it bigger. Down makes it smaller. Home picks the band bass.';
/** A way button's name starts with its visible words (WCAG 2.5.3 label in name): the way, and its size when chosen. */
export function bassWayLabel(way,size=null) {
  const w=wayOf(way);
  return size?`${w.label} ${sizeName(size)}. ${w.hint} Press again for a new size.`:`${w.label} bass. ${w.hint}`;
}
/** One cell of the disk picture: way i (60 degrees centred on i*60, clockwise from the top) in one size ring. */
function bassCellPath(i,ring) {
  const [r0,r1]=BASS_RINGS[ring].map(r=>r*100),a0=(i*60-30)*Math.PI/180,a1=(i*60+30)*Math.PI/180;
  const pt=(a,r)=>`${(Math.sin(a)*r).toFixed(2)} ${(-Math.cos(a)*r).toFixed(2)}`;
  return `M${pt(a0,r1)}A${r1} ${r1} 0 0 1 ${pt(a1,r1)}L${pt(a1,r0)}A${r0} ${r0} 0 0 0 ${pt(a0,r0)}Z`;
}
/** Disk markup: a picture of the 18 cells and the middle (no pointer or keyboard role), then the middle button
 * and one button per way. Every button is a Tab stop of its own; pressing a way picks it at Full, pressing the
 * chosen way changes its size (Full, Big, Light). States are drawn on the labels and cells, never as rings. */
function bassDiskInner(move) {
  const m=parseBassMove(move);
  const cells=BASS_WAYS.flatMap((w,i)=>BASS_SIZES.map((s,ring)=>{const on=m?.way===w.id&&m.size===s.id;
    return `<path class="pf-bass-cell" data-bass-cell="${w.id}-${s.id}" data-ring="${s.id}" d="${bassCellPath(i,ring)}" style="--hue:${BASS_HUES[w.id]}"${on?' data-chosen="true"':''}></path>`;})).join('');
  const band=move===BASS_BAND;
  // The size rings named once, faintly, in the middle of each ring on the spoke between Steady and Walk (a picture only).
  // Light sits a little out from the hub and Big a little in from the disk edge, so neither word touches an edge.
  const rings=BASS_SIZES.map((s,i)=>{const [a,b]=BASS_RINGS[i],t=[.6,.5,.4][i];return `<span class="pf-bass-ring-word" data-ring-word="${s.id}" aria-hidden="true" style="left:${(50+(a+(b-a)*t)*50).toFixed(3)}%;top:50%">${s.label}</span>`;}).join('');
  const place=a=>`left:${(50+Math.sin(a)*BASS_LABEL_RADIUS).toFixed(3)}%;top:${(50-Math.cos(a)*BASS_LABEL_RADIUS).toFixed(3)}%`;
  const ways=BASS_WAYS.map((w,i)=>{const on=m?.way===w.id;
    return `<button type="button" class="pf-bass-sector pf-bass-way" data-key="melody-field-bass-${i}" data-bass-way="${w.id}" aria-pressed="${on}" aria-label="${bassWayLabel(w.id,on?m.size:null)}"${on?' data-chosen="true"':''} style="${place(i*Math.PI/3)};--hue:${BASS_HUES[w.id]}">${w.label}<span class="pf-bass-size" data-bass-size>${on?sizeName(m.size):''}</span></button>`;}).join('');
  return `<svg class="pf-bass-art" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">${cells}<circle class="pf-bass-cell pf-bass-hub-cell" data-bass-cell="band" r="${BASS_HUB_RADIUS*100}"${band?' data-chosen="true"':''}></circle></svg>${rings}`
    +`<button type="button" class="pf-bass-sector pf-bass-hub" data-key="melody-field-bass-hub" data-bass-move="band" aria-pressed="${band}"${band?' data-chosen="true"':''}>Band bass</button>${ways}`;
}

let sequence=0;
export const MELODY_JOIN_STEPS=4;
/** Every melody-session request asks for a beat join; the scheduler moves it to a bass-safe half-bar join whenever
 * the request's bass differs from the score it has scheduled (bass wheel attack fix 1, scheduler.js). */
export const MELODY_JOIN={joinSteps:MELODY_JOIN_STEPS,bassSafe:'auto'};
const copy=value=>structuredClone(value);

/** The last heard score survives Stop and the brief restart scheduling gap. */
export function heardMelodyCandidate(field,scheduler=field.scheduler) {
  const state=scheduler.getPartAuditionState?.()||scheduler.lastPartAuditionState;
  if(state?.sectionId===field.sectionId&&state?.realizedId)field.realizedId=state.realizedId;
  // Nothing heard yet: the session as it opened, its bass included (never the requested bass).
  return field.realizedId?field.candidates.get(field.realizedId):field._candidate({x:0,y:0},field.initialBandBalance,field.initialSoundPatch,field.initialBassMove);
}

/** Complete-score saving must not replace an audible loading voice with an unheard sample.
 * The played-take route still records the actual resolved voices. Stop freezes its clock. */
export function melodyKeepReadiness(field,scheduler=field.scheduler) {
  const candidate=heardMelodyCandidate(field,scheduler);
  if(!field.palette||!field.hasPlayed||!candidate?.song?.events?.some(e=>isSampledPatch(e.patch_id)))return {ok:true};
  const state=scheduler.getPartAuditionState?.();
  const restarting=scheduler.isPlaying&&!scheduler.loadingSession&&scheduler.lastStoppedLoadingState
    &&!(state?.sectionId===field.sectionId&&state.realizedId);
  const loading=scheduler.isPlaying&&!restarting?scheduler.loadingSession:scheduler.lastStoppedLoadingState;
  const cutoff=scheduler.isPlaying&&!restarting?scheduler.audioCtx?.currentTime:loading?.cutoff;
  if(!loading||(loading.state==='live'&&Number.isFinite(loading.liveAt)&&Number.isFinite(cutoff)&&cutoff>=loading.liveAt))return {ok:true};
  const message=!scheduler.isPlaying?'Play with full sounds to keep this tune. Or save played take.'
    :loading.state==='failed'?'Full sounds did not load. Save played take keeps what you hear.'
    :'Full sounds are still loading. Save played take keeps what you hear.';
  return {ok:false,message};
}

/** One pinned musical source and one running audition. This object never edits a song. */
export class MelodyFieldSession {
  constructor(song,{scheduler,captureOrigin,root=0,scale='major',sourceDoc,phraseContext=null,canUpgrade=false}={}) {
    this.scheduler=scheduler;this.phraseContext=phraseContext;this.canUpgrade=Boolean(canUpgrade);this.algorithmVersion=phraseContext?4:3;
    this.composerVersion=phraseContext?.composerVersion??1;
    if(![1,2,3,4,5,6,7,8,9].includes(this.composerVersion))throw new Error('This melody needs a newer version of MusicLab.');
    this.chooseMelody=this.composerVersion===9?developedNineChoice:this.composerVersion>=7?developedChoice:this.composerVersion===6?motifChoice:this.composerVersion===5?genreChoice:this.composerVersion===4?corpusChoice:this.composerVersion===3?vocabularyChoice:this.composerVersion===2?phraseChoice:legacyChoice;
    this.melodyFamilies=this.composerVersion>=6?MOTIF_FAMILIES:this.composerVersion===5?GENRE_FAMILIES:this.composerVersion===4?CORPUS_FAMILIES:this.composerVersion===3?VOCAB_FAMILIES:this.composerVersion===2?PHRASE_FAMILIES:LEGACY_FAMILIES;
    this.sourceDoc=copy(sourceDoc);
    this.source=copy(song);
    const stepSec=15/song.bpm;
    this.source.events=this.source.events.map(e=>({...e,
      duration_steps:e.duration_steps??e.duration_sec/stepSec}));
    this.field=createMelodyField(this.source.events,{root,scale,sourceId:song.song_id,version:3,bpm:song.bpm,totalSteps:song.total_steps,stepsPerBar:song.steps_per_bar||16,swing:song.swing??.5});
    this.bandBalance=phraseContext?.bandBalance===1;this.initialBandBalance=this.bandBalance;
    this.bandBasis=balanceBasis(this.source.events,phraseContext?.bandBasis);
    this.soundPatch=MELODY_SOUNDS.some(s=>s.patch===phraseContext?.melodySound)?phraseContext.melodySound:null;this.initialSoundPatch=this.soundPatch;
    this.soundKept={};this._keepSound(this.soundPatch);
    // Bass wheel: admitted only over the six V9 scenes' own band bass, or a kept line with its band snapshot.
    const bass=phraseContext?bassAdmission(phraseContext,this.source.events,{saved:phraseContext.bassWheel??null,bandBasis:phraseContext.bandBasis??null}):{ok:false,reason:'no-context'};
    this.bassCtx=bass.ok?bass.ctx:null;this.bassReason=bass.ok?null:bass.reason;
    // Unsoftened levels for every bass note the wheel can play; stored levels of a reopened save win.
    this.bassSlotBasis=this.bassCtx?bassBasis(this.bassCtx):null;
    this.initialBassMove=this.bassCtx?this.bassCtx.openingMove:null;this.bassMove=this.initialBassMove;this.bassMoved=false;
    this.wheel='tune';
    this.captureOrigin=captureOrigin;
    this.sectionId=`melody-field-${++sequence}`;
    this.position={x:0,y:0};this.history=[];this.candidates=new Map();
    this.requestId=this._candidate(this.position).id;
    this.realizedId=null;this.hasPlayed=false;
  }

  async prepare() {
    if(!this.phraseContext)return;
    this.palette=await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./melody_composer_worker.js',import.meta.url),{type:'module'});
      const done=(error,value)=>{clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);};
      const timer=setTimeout(()=>done(new Error('Melody choices took too long. Your groove stays.')),10000);
      worker.onmessage=({data})=>done(data.error?new Error(data.error):null,data.plans);
      worker.onerror=()=>done(new Error('Melody choices could not load. Your groove stays.'));
      worker.postMessage(this.phraseContext);
    });
    this.candidates.clear();this.requestId=this._candidate(this.position).id;
  }

  /** The whole session as it opened (tune, sound, band level and bass), and back. */
  toggleOriginal() {
    const before=this._state();
    if(this.comparisonPosition) {
      const p=this.comparisonPosition;
      if(this.request({...p,bandBalance:this.comparisonBandBalance,soundPatch:this.comparisonSoundPatch,bassMove:this.comparisonBassMove},{comparison:true}))this.comparisonPosition=null;
    } else {
      const p={...this.position},balance=this.bandBalance,sound=this.soundPatch,bass=this.bassMove;
      if(this.request({x:0,y:0,bandBalance:this.initialBandBalance,soundPatch:this.initialSoundPatch,bassMove:this.initialBassMove},{comparison:true})){this.comparisonPosition=p;this.comparisonBandBalance=balance;this.comparisonSoundPatch=sound;this.comparisonBassMove=bass;}
    }
    this._noteMixChange(before);
    this.followSoundView();
    this.paint();
  }

  /** On the Bass wheel the tune is out of sight, so when Original or Undo also changes the tune (or its sound) the status
   * says so until the next move. Returns whether there is such a line. */
  _noteMixChange(before) {
    if(!this.bassMode){this.bassNote=null;return false;}
    const tune=this._tuneKey(before)!==this._tuneKey(this.position),sound=(before.soundPatch??null)!==(this.soundPatch??null);
    this.bassNote=tune?BASS_TUNE_CHANGED:sound?BASS_SOUND_CHANGED:null;
    return Boolean(this.bassNote);
  }

  /** Whether the state Original goes back to differs from the opening state in its bass alone. */
  _comparisonBassOnly() {
    return Boolean(this.comparisonPosition)&&this.comparisonBassMove!==this.initialBassMove
      &&this._mixKey(this.comparisonPosition,this.comparisonBandBalance,this.comparisonSoundPatch)===this._mixKey({x:0,y:0},this.initialBandBalance,this.initialSoundPatch);
  }

  /** Whether a state differs from the opening one in the tune's sound alone (same tune, band level and bass). */
  _soundOnly(position,balance,sound,bass) {
    return (sound??null)!==(this.initialSoundPatch??null)&&this._tuneKey(position)===this._tuneKey({x:0,y:0})
      &&Boolean(balance)===Boolean(this.initialBandBalance)&&(bass??null)===(this.initialBassMove??null);
  }

  /** The Original button's words: what pressing it brings back. */
  _originalLabel() {
    const c=this.comparisonPosition;
    if(this.bassMode)return c?(this._comparisonBassOnly()?'New bass':'Your changes'):'Original';
    if(!c)return this._soundOnly(this.position,this.bandBalance,this.soundPatch,this.bassMove)?'First sound':'Original';
    return this._soundOnly(c,this.comparisonBandBalance,this.comparisonSoundPatch,this.comparisonBassMove)?'New sound'
      :this._tuneKey(c)!==this._tuneKey({x:0,y:0})?'New melody':'Your changes';
  }

  /** How far out the Tune wheel's dot is, 0 at the centre to 100 at the edge (the slider's number). */
  _diskReach() {return Math.min(100,Math.round(Math.hypot(this.position.x,this.position.y)*100));}

  melodyLabel(position) {
    const choice=this.palette?this.chooseMelody(position):melodyFieldRegion(position,3);
    const development=this.palette?.[choice.key]?.development;
    return development?.applied===false?'Theme kept. This change does not fit.':choice.label;
  }

  /** One score: a tune choice, the band level, the tune's sound and the bass move. bass defaults to the requested
   * bass; callers that mean the opening state pass initialBassMove explicitly. At the opening move the score's own
   * bass plays untouched (a reopened save keeps its stored line even when the tune moves). */
  _candidate(position,balance=this.bandBalance,sound=this.soundPatch,bass=this.bassMove) {
    const moved=Boolean(this.bassCtx)&&bass!=null&&bass!==this.initialBassMove;
    const p=melodyFieldPosition(position),choice=this.palette?this.chooseMelody(p):null,id=`${this.sectionId}:${this._mixKey(p,balance,sound)}${moved?':bass:'+bass:''}`;
    if(!this.candidates.has(id)) {
      const variant=this.palette?this.palette[choice.key]:melodyFieldVariant(this.field,p);
      const notes=moved?applyBassMove(this.bassCtx,bass,variant.notes):variant.notes;
      this.candidates.set(id,{id,position:variant.choice?.position||p,song:{...this.source,events:melodySoundEvents(balancedEvents(notes,this._basis(),balance),sound)},soundPatch:sound,bandBalance:balance,bassMove:this.bassCtx?(moved?bass:this.initialBassMove):null,changed:variant.changed});
      // Never evict the requested, scheduled or realized score while the clock can still reach it.
      const state=this.scheduler.getPartAuditionState?.();
      const protectedIds=new Set([id,this.requestId,this.realizedId,state?.scheduledId]);
      for(const key of this.candidates.keys())if(this.candidates.size>32&&!protectedIds.has(key))this.candidates.delete(key);
    }
    return this.candidates.get(id);
  }

  /** The tune in a candidate id: the tune choice's key, or the map point while no choices are loaded. */
  _tuneKey(position) {
    const p=melodyFieldPosition(position),choice=this.palette?this.chooseMelody(p):null;
    return choice?choice.key:`${p.x}:${p.y}`;
  }
  /** Everything in a candidate id but the bass: the tune, the band level and the tune's sound. */
  _mixKey(position,balance,sound) {return `${this._tuneKey(position)}${balance?':soft':''}${sound?':sound:'+sound:''}`;}

  view(candidate) {
    return melodyFieldPlaybackView(candidate.song,this.captureOrigin,this.scheduler.gridOriginTime);
  }

  begin() {
    const candidate=this._candidate(this.position);
    if(!this.scheduler.isPlaying)return false;
    const ok=this.scheduler.queueContinuousPartAudition(this.view(candidate),
      {sectionId:this.sectionId,requestId:candidate.id,...MELODY_JOIN}).ok;
    if(ok)this.hasPlayed=true;return ok;
  }

  request(position,{automatic=false,comparison=false,guide=false}={}) {
    if(this.guide&&!guide)return false;
    if(!comparison)this.comparisonPosition=null;
    if(!automatic)this.exploring=null;
    const balance=position.bandBalance??this.bandBalance;
    const sound=Object.hasOwn(position,'soundPatch')?position.soundPatch:this.soundPatch;
    const bass=Object.hasOwn(position,'bassMove')?position.bassMove:this.bassMove;
    const candidate=this._candidate(position,balance,sound,bass);
    if(candidate.id!==this.requestId&&this.scheduler.isPlaying) {
      const result=this.scheduler.queueContinuousPartAudition(this.view(candidate),
        {sectionId:this.sectionId,requestId:candidate.id,...MELODY_JOIN});
      if(!result?.ok) {
        this.exploring=null;
        this.requestError=this.bassMode?BASS_ERROR:'That move did not play. Your tune stays. Stop, then play to try again.';
        this.paint();return false;
      }
    }
    this.requestError=null;this.bassNote=null;
    this.position=melodyFieldPosition(position);this.bandBalance=balance;this.soundPatch=sound;this._keepSound(sound);
    if(this.bassCtx)this.bassMove=bass??this.initialBassMove;
    this.requestId=candidate.id;
    this.paint();return true;
  }

  /** The sound last chosen in each group (UI memory only): group-ring arrows come back to it. */
  _keepSound(patch) {const family=familyOf(patch);if(family)this.soundKept[family]=patch;}

  /** Everything one Undo step restores: the tune position, the band level, the tune's sound and the bass. */
  _state() {return {...copy(this.position),bandBalance:this.bandBalance,soundPatch:this.soundPatch,bassMove:this.bassMove};}
  _pushHistory(entry) {this.history.push(entry);this.history=this.history.slice(-32);}
  /** Unsoftened levels by note id for Softer band: the band's, and every bass note the wheel can play (stored levels win). */
  _basis() {return this.bassSlotBasis?{...this.bassSlotBasis,...this.bandBasis}:this.bandBasis;}

  remember(position) {
    if(position.x!==this.position.x||position.y!==this.position.y) {
      this._pushHistory({...copy(position),bandBalance:this.bandBalance,soundPatch:this.soundPatch,bassMove:this.bassMove});
    }
  }

  startGuide() {
    if(this.guide)return false;
    const heard=heardMelodyCandidate(this);
    if(!this.scheduler.isPlaying||!this.realizedId||heard?.id!==this.requestId||!melodyKeepReadiness(this).ok){
      this.requestError='Play this tune first. Then try Show me.';this.paint();return false;
    }
    const before=this._state();
    const alternate=this._candidate(this.position,!this.bandBalance);
    if(JSON.stringify(alternate.song.events)===JSON.stringify(heard.song.events)){
      this.requestError='This tune has no band notes to change.';this.paint();return false;
    }
    const comparison=this.comparisonPosition?{position:copy(this.comparisonPosition),balance:this.comparisonBandBalance,sound:this.comparisonSoundPatch,bass:this.comparisonBassMove}:null;
    if(!this.request({...before,bandBalance:!before.bandBalance}))return false;
    this.guide={before,comparison,previewId:this.requestId,restoring:false};return true;
  }

  finishGuide(use) {
    if(!this.guide)return false;
    const g=this.guide;
    if(use){
      if(g.restoring||heardMelodyCandidate(this)?.id!==g.previewId||!melodyKeepReadiness(this).ok)return false;
      this.history.push(g.before);this.history=this.history.slice(-32);this.guide=null;this.paint();return true;
    }
    if(!this.request(g.before,{guide:true}))return false;
    g.restoring=true;g.restoreId=this.requestId;this.paint();return true;
  }

  toggleBandBalance(){
    const before=this._state();
    if(this.request({...this.position,bandBalance:!this.bandBalance}))this._pushHistory(before);
  }

  selectSound(patch) {
    const before=this._state();
    if(patch===this.soundPatch)return;
    if(patch&&!this._candidate(this.position).song.events.some(e=>e.role==='lead'&&e.provenance==='jam_generated'&&!e.edited_from_generator)){
      this.requestError='Your notes keep their sound. Try a new tune first.';this.paint();return;
    }
    if(this.request({...this.position,soundPatch:patch})&&!this.dragging)this._pushHistory(before);
  }

  undo() {const p=this.history.at(-1),before=this._state();if(p&&this.request(p)){this.history.pop();const noted=this._noteMixChange(before),view=this.followSoundView();if(noted||view)this.paint();}}

  /** Which wheel shows: 'tune', 'sound' or 'bass' (only when the bass is ready). Each tab looks at one part of the
   * same pinned song while it keeps playing; a tab change never enters history, candidates or the saved state.
   * The Sound wheel opens on its group ring. 'Hear tune clearly' would dim the bass, so the Bass wheel ends it. */
  setWheel(wheel) {
    const next=wheel==='sound'||(wheel==='bass'&&this.bassReady)?wheel:'tune';
    this.wheel=next;this.soundView=null;this.soundZoom=null;
    if(next!=='tune')this.exploring=null;
    if(next==='bass'&&this.scheduler.spotlightRole==='tune')this.scheduler.setSpotlightRole?.(null);
    // Hear bass clearly belongs to the Bass wheel: another tab ends it (leaving the wheel ends every spotlight, play_flow _go).
    if(next!=='bass'&&this.scheduler.spotlightRole===BASS_SPOTLIGHT)this.scheduler.setSpotlightRole?.(null);
    return next===wheel;
  }
  get soundMode() {return this.wheel==='sound';}
  get bassMode() {return this.wheel==='bass';}
  /** The Bass wheel needs an admitted context (bass_wheel.js bassAdmission) and the tune choices to play over. */
  get bassReady() {return Boolean(this.bassCtx&&this.palette);}

  /** Sound wheel view (UI only): null shows the group ring, a group name shows that group's sounds.
   * It never enters history, candidates, candidate ids, comparison state or the saved sound. */
  setSoundMode(on) {this.setWheel(on?'sound':'tune');}

  /** Pick a bass move ('band' or '<way>-<size>'): one Undo entry per press, or one per drag (added when it ends). */
  selectBass(move) {
    if(!this.bassReady||this.guide||move===this.bassMove)return false;
    if(move!==this.initialBassMove&&!parseBassMove(move))return false;
    const before=this._state();
    if(!this.request({...this.position,bassMove:move}))return false;
    this.bassMoved=true;
    if(!this.dragging)this._pushHistory(before);
    return true;
  }

  /** A press on way i: a new way plays at Full; the chosen way changes size, Full, Big, Light, then Full again. */
  pressBassWay(i) {
    const way=BASS_WAYS[i]?.id;if(!way)return false;
    return this.chooseBass(parseBassMove(this.bassMove)?.way===way?bassKeyMove(this.bassMove,'Enter'):`${way}-full`);
  }

  /** Hear bass clearly (Bass wheel only): bass and beat stay full while the tune and chords play softer (the scheduler's
   * spotlight). It is only a way of listening: another tab or leaving the wheel ends it, and a take keeps every note at
   * its own level (scheduler.js), so nothing saved ever changes. */
  toggleBassFocus() {
    if(!this.bassMode)return false;
    this.scheduler.setSpotlightRole?.(this.scheduler.spotlightRole===BASS_SPOTLIGHT?null:BASS_SPOTLIGHT);
    this.paint();return true;
  }

  /** Show what a way does before it plays: the way with focus, or under a mouse or pen (that one wins while it is there);
   * null clears. On screen only: the button's name already says it to a screen reader, and the live status stays. */
  peekBass(way,from='focus') {
    this.bassPeeks={...this.bassPeeks,[from]:wayOf(way)?way:null};
    this._paintBassPeek();
  }

  /** The legend line under the disk: the legend, or the hint of a way being looked at that is not the chosen one. */
  _paintBassPeek() {
    const peek=this.root?.querySelector?.('[data-bass-peek]'),legend=this.root?.querySelector?.('[data-bass-legend-text]');
    if(!peek||!legend)return;
    const look=this.bassPeeks?.hover??this.bassPeeks?.focus??null;
    const way=this.bassMode&&look&&look!==parseBassMove(this.bassMove)?.way?look:null,text=way?bassWayLabel(way):'';
    if(peek.textContent!==text)peek.textContent=text;
    if(way)peek.style?.setProperty?.('--hue',BASS_HUES[way]); // the hint takes its way's colour, so it reads as that way's
    if(peek.hidden!==!way)peek.hidden=!way;
    if(legend.hidden!==Boolean(way))legend.hidden=Boolean(way);
  }

  /** Apply one bass move from a key or button, then paint and put focus on the chosen button. */
  chooseBass(move) {
    if(!this.bassMode||this.guide||!move)return false;
    this.selectBass(move);
    this.paint();this.focusBassChoice();return true;
  }

  /** The data-key of the button that holds the chosen state (the middle for the band bass or an untagged kept line). */
  chosenBassKey() {
    const m=parseBassMove(this.bassMove);
    return m?.way?`melody-field-bass-${BASS_WAYS.findIndex(w=>w.id===m.way)}`:'melody-field-bass-hub';
  }

  /** Every change sets focus explicitly, so keyboard and switch users stay on the wheel. */
  focusBassChoice(key=this.chosenBassKey()) {
    const disk=this.root?.querySelector?.('[data-melody-disk]');if(!disk)return false;
    const el=disk.querySelector(`[data-key="${key}"]`)||disk.querySelector('[data-key]');
    if(!el||el.disabled)return false;
    el.focus({preventScroll:true});return true;
  }

  /** What Keep stores for the bass of the heard score: the record with the band's ORIGINAL bass (bass wheel attack
   * fix 2) and the unsoftened levels of the heard bass notes, so a saved Softer band never softens them twice.
   * null keeps the context as it is (no bass wheel here, an untagged kept line, or a live band bass never moved).
   * played: a played take records every bass heard during the take, so any bass move this session counts. */
  bassSave(candidate,{played=false}={}) {
    if(!this.bassCtx||!candidate?.song?.events)return null;
    const heardMove=candidate.bassMove??this.initialBassMove,move=parseBassMove(heardMove)?heardMove:played?BASS_BAND:null;
    if(!move)return null;
    const wheel=candidate.song.events.some(n=>n.role==='bass'&&n.generated_by==='musiclab_bass_wheel_v1');
    if(move===BASS_BAND&&!wheel&&!this.phraseContext?.bassWheel&&!(played&&(this.bassMoved||this.initialBassMove!==BASS_BAND)))return null;
    const basis=this._basis();
    const heard=Object.fromEntries(candidate.song.events.filter(n=>n.role==='bass'&&Number.isFinite(basis[n.id])&&!Object.hasOwn(this.bandBasis,n.id))
      .map(n=>[n.id,basis[n.id]]));
    return {bassWheel:bassWheelRecord(this.bassCtx,move),bandBasis:{...this.bandBasis,...heard}};
  }

  _showSoundView(view,zoom) {
    if((this.soundView||null)===(view||null))return false;
    this.soundView=view||null;this.soundZoom=zoom||(view?'in':'out');return true;
  }

  /** Open a group. Its first sound plays unless the chosen sound is already in it. */
  openSoundFamily(name) {
    const sounds=familySounds(name);
    if(!this.soundMode||!sounds.length)return false;
    this._showSoundView(name,'in');
    if(familyOf(this.soundPatch)!==name)this.selectSound(sounds[0].patch);
    this.paint();return true;
  }

  /** Back to the group ring. This changes only what the wheel shows. */
  closeSoundFamily() {
    if(!this.soundMode)return false;
    const changed=this._showSoundView(null,'out');this.paint();return changed;
  }

  /** After Undo, Original or Home: an open sound ring follows the requested sound to its group,
   * and the tune's own sound returns to the group ring. The group ring stays as it is. */
  followSoundView() {
    if(!this.soundMode||!this.soundView)return false;
    const family=familyOf(this.soundPatch);
    return family===this.soundView?false:this._showSoundView(family,family?'in':'out');
  }

  /** The data-key of the element that holds the chosen state on the ring now shown. */
  chosenSoundKey() {
    if(!this.soundView)return this.soundPatch?`melody-field-family-${familyIndex(familyOf(this.soundPatch))}`:'melody-field-sound-0';
    const sounds=familySounds(this.soundView),patch=sounds.some(s=>s.patch===this.soundPatch)?this.soundPatch:sounds[0]?.patch;
    return `melody-field-sound-${soundIndex(patch)}`;
  }

  /** Every view change sets focus explicitly, so keyboard and switch users stay on the wheel. */
  focusSoundChoice(key=this.chosenSoundKey()) {
    const disk=this.root?.querySelector?.('[data-melody-disk]');if(!disk)return false;
    const el=disk.querySelector(`[data-key="${key}"]`)||disk.querySelector('[data-key][data-chosen="true"]')||disk.querySelector('[data-key]');
    if(!el||el.disabled)return false;
    el.focus({preventScroll:true});return true;
  }

  /** Apply one soundKeyMove result: the view, then the sound (one Undo entry), then focus. */
  applySoundMove(move) {
    if(!move||this.guide)return false;
    this._showSoundView(move.view,move.view?'in':'out');
    if(move.patch!==undefined)this.selectSound(move.patch);
    this.paint();this.focusSoundChoice(move.focus);return true;
  }

  toggleExploration() {
    if(this.wheel!=='tune'||this.guide)return;
    if(this.exploring) {
      this.exploring=null;
      const reached=this.candidates.get(this.realizedId);
      if(reached)this.request(reached.position);
    } else if(this.scheduler.isPlaying) {
      this.exploring={startPosition:{...this.position},startTime:this.scheduler.audioCtx.currentTime};
      this.lastExploreTick=-Infinity;
    }
    this.paint();
  }

  advance() {
    if(!this.exploring||!this.scheduler.isPlaying)return;
    const now=this.scheduler.audioCtx.currentTime;
    if(now-this.lastExploreTick<.12)return;
    this.lastExploreTick=now;
    this.request(melodyFieldTourPosition({...this.exploring,now,bpm:this.source.bpm,
      stepsPerBar:this.source.steps_per_bar||16,mode:this.composerVersion>=5?'dynamic':'orbit'}),{automatic:true});
  }

  _wheelTabsHtml() {
    const tab=(key,on,title)=>`<button class="pf-btn pf-wheel-tab" data-key="${key}" aria-pressed="${on}">${title}</button>`;
    return `<div class="pf-wheel-tabs" role="group" aria-label="Wheels">${tab('melody-field-tune-mode',this.wheel==='tune','Tune wheel')}${tab('melody-field-sound-mode',Boolean(this.soundMode),'Sound wheel')}${this.bassReady?tab('melody-field-bass-mode',this.bassMode,'Bass wheel'):''}</div>`;
  }

  /** The Bass wheel disk: the disk owns pointer input (its picture and buttons take none); the buttons serve keys,
   * switches and assistive technology, and each is a Tab stop (the disk itself is not a Tab stop here). */
  _bassDiskHtml() {
    return `<div class="pf-melody-disk pf-bass-disk" data-melody-disk data-bass-disk tabindex="-1" role="group" aria-label="${BASS_DISK_LABEL}">${bassDiskInner(this.bassMove)}</div>`
      +`<p class="pf-sub pf-bass-legend" data-mf-bass-legend><span data-bass-legend-text>${BASS_LEGEND}</span><span data-bass-peek aria-hidden="true" hidden></span></p>`;
  }

  /** The Sound wheel disk (its prompt holds both views' words in one cell, so a view change never
   * moves the disk). The disk owns pointer input; its buttons serve keys, switches and
   * assistive technology, and each is a Tab stop (the disk itself is not a Tab stop here). */
  _soundDiskHtml() {
    return `<div class="pf-melody-disk pf-sound-disk" data-melody-disk data-sound-view="${this.soundView||''}" tabindex="-1" role="group" aria-label="${soundDiskLabel(this.soundView)}">${soundRingHtml(this.soundView,this.soundPatch)}</div>`;
  }

  html() {
    const families=this.palette?this.melodyFamilies:MELODY_FIELD_V3_REGIONS;
    const bass=this.bassMode;
    return `<section class="pf-stage pf-melody-field" data-melody-mode="${this.palette?'phrase-composer':'note-variation'}" data-composer-version="${this.composerVersion}"${bass?' data-wheel="bass"':''}><h1 class="pf-heading">${bass?'Feel the bass':this.soundMode?'Pick a sound':this.palette?'Make your tune':'Try note changes'}</h1>
      <p>${bass?BASS_PROMPT:this.soundMode?SOUND_WHEEL_LINE:this.composerVersion>=7?'Turn to try ideas. Move out to shape one. Band notes stay.':this.composerVersion>=6?'Move out to shape this idea. Move round to try more.' :this.palette?'Try a new phrase with this band. Your first tune stays.':'This map changes notes in your tune. It does not build a new melody.'}</p>
      ${bass&&this.bassCtx.personal.length?`<p class="pf-sub" data-mf-bass-personal>${BASS_PERSONAL}</p>`:''}
      ${this.palette&&this.composerVersion===2?'<p class="pf-sub">New melody preview. Move out for more change.</p>':''}
      ${this.palette?'':this.canUpgrade?'<p class="pf-sub" data-mf-coverage>Your saved take is open as it was. Try new tunes when ready.</p><div class="pf-row"><button class="pf-btn" data-key="melody-field-upgrade">Try new tunes</button></div>':'<p class="pf-sub" data-mf-coverage>New melody choices are not ready for this groove. Your groove stays. Use Back to groove to keep playing.</p>'}
      <div class="pf-row"><button class="pf-btn pf-play" data-key="melody-field-play">${this.scheduler.isPlaying?'Stop':'Play'}</button>
      <button class="pf-btn" data-key="melody-field-original">Original</button><button class="pf-btn" data-key="melody-field-undo">Undo move</button>
      ${bass?'':`<button class="pf-btn" data-key="melody-field-explore" ${this.soundMode?'disabled':''}>Explore</button>`}
      ${this.palette&&!bass?`<button class="pf-btn" data-key="melody-field-balance" aria-pressed="${this.bandBalance}">${this.bandBalance?"Restore band":"Softer band"}</button>`:''}${bass?`<button class="pf-btn" data-key="melody-field-bass-focus" aria-pressed="${this.scheduler.spotlightRole===BASS_SPOTLIGHT}">${this.scheduler.spotlightRole===BASS_SPOTLIGHT?'Hear full band':'Hear bass clearly'}</button><button class="pf-btn" data-key="melody-field-back-top">Back to jam</button>`:`<button class="pf-btn" data-key="melody-field-focus" aria-pressed="${this.scheduler.spotlightRole==='tune'}">Hear tune clearly</button>`}</div>
      ${this.palette?this._wheelTabsHtml():''}
      ${this.soundMode?`<p class="pf-sound-prompt" data-mf-sound-prompt data-view="${this.soundView?'sounds':'groups'}"><span data-prompt="groups">${soundPrompt(null)}</span><span data-prompt="sounds">${soundPrompt('sounds')}</span></p><p class="sr-only" data-mf-sound-say aria-live="polite" aria-atomic="true"></p>`:''}
      <div data-mf-guide ${this.guide?'':'hidden'} role="region" aria-label="Hear one change"><p data-mf-guide-text></p><div class="pf-row"><button class="pf-btn" data-key="melody-field-guide-use">Use this</button><button class="pf-btn" data-key="melody-field-guide-back">Put back</button></div></div>
      <div class="pf-mf-main${this.soundMode?' pf-sound-main':bass?' pf-bass-main':''}"><div class="pf-mf-wheel${this.soundMode?' pf-sound-wheel':bass?' pf-bass-wheel':''}">${this.soundMode?this._soundDiskHtml():bass?this._bassDiskHtml():`<div class="pf-melody-disk" data-melody-disk tabindex="0" role="slider" aria-roledescription="tune wheel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${this._diskReach()}" aria-valuetext="${this.melodyLabel(this.position)}" aria-describedby="${this.sectionId}-keys" aria-label="${this.composerVersion>=7?'Tune choices. Band notes stay':this.palette?'Whole melody choices':'Note changes'}. ${"Move between "+families.join(", ")+"."} Centre is your original.">
        ${families.map((name,i)=>`<span class="pf-mf-label pf-mf-region" style="left:${50+Math.sin(i*Math.PI*2/families.length)*36}%;top:${50-Math.cos(i*Math.PI*2/families.length)*36}%">${name}</span>`).join('')}
        <span class="pf-mf-centre">Your tune</span><span class="pf-mf-request" data-mf-request></span><span class="pf-mf-reached" data-mf-reached></span>
      </div><p class="sr-only" id="${this.sectionId}-keys">${TUNE_WHEEL_KEYS}</p>`}<p class="pf-sub" data-mf-status role="status" aria-live="polite"></p></div>
      <div class="pf-mf-band"><div class="pf-live-score-head"><span class="pf-live-score-caption" data-mf-score-caption>Showing your first tune.</span></div><svg class="pf-mf-score pf-live-score" data-mf-score viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" role="img" aria-label="The band playing now. Tune above; chords, bass and beat below. Time goes left to right."></svg></div></div>
      <div class="pf-row"><button class="pf-btn pf-next" data-key="melody-field-keep">${bass?'Keep this bass':this.palette?"Keep this melody":"Keep this take"}</button>
      ${bass?'':'<button class="pf-btn" data-key="melody-field-refine">Refine notes</button>'}
      <button class="pf-btn" data-key="melody-field-back">${this.palette?"Back to jam":"Back to groove"}</button></div>
      <p class="pf-sub" data-mf-keep-help>${bass?BASS_KEEP_HELP:this.palette?'Keep chooses this tune. Next, Save here keeps it in this browser. Your first tune stays safe.':'Keep this take saves your live play up to now. Your first tune stays safe.'}</p>
      ${this.palette?(this.scheduler.loadingSession?.state==='failed'?`<p class="pf-sub" data-mf-retry>${SOUNDS_RETRY}</p>`:'<p class="pf-sub" data-mf-retry hidden></p>'):''}
      ${bass?`<p class="pf-sub" data-mf-bass-softer${this.bandBalance?'':' hidden'}>${BASS_SOFTER}</p>`:`<p class="pf-sub" data-mf-focus-help>${this.palette?'Softer band stays when you save. Hear tune clearly is just for now.':'Hear with less band. Your saved mix stays.'}</p>`}
      ${this.wheel!=='tune'?'':`<details><summary data-key="melody-field-controls">Move with buttons</summary><div class="pf-row">
      <button class="pf-btn" data-key="melody-field-left">Left</button><button class="pf-btn" data-key="melody-field-right">Right</button>
      <button class="pf-btn" data-key="melody-field-up">Up</button><button class="pf-btn" data-key="melody-field-down">Down</button></div>
      <label>Across <input data-mf-axis="x" type="range" min="-100" max="100" value="${this.position.x*100}" aria-label="Across the melody map"></label>
      <label>Up or down <input data-mf-axis="y" type="range" min="-100" max="100" value="${this.position.y*100}" aria-label="Up or down the melody map"></label></details>`}
      ${this.palette?`<details class="pf-melody-keep-more" ${this.moreOpen?'open':''}><summary data-key="melody-keep-more">More ways</summary><div class="pf-row">${bass?'':'<button class="pf-btn" data-key="melody-field-guide">Show me</button>'}<button class="pf-btn" data-key="melody-field-take">Save played take</button></div>${this.composerVersion===9&&!bass?'<p class="pf-sub">Move round for new ideas. Move out: Light has fewer notes. Theme is the full idea. Breathe adds a gap near the end. Return brings the first rhythm back.</p>':''}<p class="pf-sub">Save played take keeps your live play too.</p></details>`:''}</section>`;
  }

  bind(root) {
    this.root=root;this.bassPeeks=null;
    const disk=root.querySelector('[data-melody-disk]');if(!disk)return;
    const point=e=>{
      const r=disk.getBoundingClientRect();
      return {x:2*(e.clientX-r.left)/r.width-1,y:1-2*(e.clientY-r.top)/r.height};
    };
    // Sound wheel pointer gesture: g.view is the ring it started on, g.sector the part held now,
    // g.start the sound chosen when it began, g.hubPress whether it is still a press in the middle.
    let g=null;
    const soundAt=sector=>{
      if(!g.view){
        if(sector==='hub')return this.selectSound(null);
        const name=MELODY_SOUND_FAMILIES[sector].name;
        return this.selectSound(familyOf(g.start)===name?g.start:familySounds(name)[0].patch);
      }
      if(sector==='hub')return; // the last sound holds; the middle never chooses a sound on this ring
      g.hubPress=false;this.selectSound(familySounds(g.view)[sector].patch);
    };
    const move=e=>{
      const {x,y}=point(e);
      if(this.soundMode){
        if(!g)return;
        const sector=soundSector(g.view,x,y,g.sector);
        if(sector==null||sector===g.sector)return;
        g.sector=sector;
        if(sector==='hub'&&!g.view)return; // passing through the middle of the group ring holds; letting go there chooses Own sound
        soundAt(sector);
      }else if(this.bassMode){
        // The held way stays until 4 degrees past its edge and the held size until .03 past a ring edge.
        if(!g)return;
        // A press on the chosen label stays a tap while it stays on the label; once it leaves, it is a drag from the chosen move.
        if(g.label){if(onLabel(g.label,e))return;g.label=null;g.bass=this.bassMove;}
        const next=bassSector(x,y,g.bass);
        if(next==null||next===g.bass)return;
        g.bass=next;this.selectBass(next);
      }else this.request({x,y});
    };
    // The chosen way's label is the brightest thing on the disk. A tap on it presses that button, as Enter and a switch
    // do (Full, Big, Light), instead of picking the Full cell under it; its box is taken when the press starts.
    const onLabel=(box,e)=>e.clientX>=box.left&&e.clientX<=box.right&&e.clientY>=box.top&&e.clientY<=box.bottom;
    const chosenLabel=e=>{
      const key=this.chosenBassKey();if(key==='melody-field-bass-hub')return null;
      const r=disk.querySelector(`[data-key="${key}"]`)?.getBoundingClientRect?.();
      if(!r||!(r.right>r.left&&r.bottom>r.top))return null;
      const box={index:Number(key.split('-').at(-1)),left:r.left,right:r.right,top:r.top,bottom:r.bottom};
      return onLabel(box,e)?box:null;
    };
    let pointer=null,origin=null;
    disk.addEventListener('pointerdown',e=>{
      if(e.button!==0||pointer!=null)return;
      if(this.soundMode){
        const {x,y}=point(e),sector=soundSector(this.soundView,x,y);
        if(sector==null||this.guide)return;
        g={view:this.soundView,sector,start:this.soundPatch,hubPress:sector==='hub'};
      }else if(this.bassMode){
        const {x,y}=point(e),bass=bassSector(x,y);
        if(bass==null||this.guide)return;
        g={bass,label:chosenLabel(e)};
      }
      e.preventDefault();if(this.wheel==='tune')disk.focus({preventScroll:true});pointer=e.pointerId;origin=this._state();this.dragging=true;
      disk.setPointerCapture(e.pointerId);
      if(this.soundMode)soundAt(g.sector);else if(this.bassMode){if(!g.label)this.selectBass(g.bass);}else move(e);
    });
    disk.addEventListener('pointermove',e=>{if(e.pointerId===pointer)move(e);});
    // Bass wheel: the way under a mouse or pen (no press) or with focus shows what it does under the disk, before it plays.
    disk.addEventListener('pointermove',e=>{if(pointer!=null||!this.bassMode||e.pointerType==='touch')return;const {x,y}=point(e);this.peekBass(parseBassMove(bassSector(x,y))?.way??null,'hover');});
    disk.addEventListener('pointerleave',()=>{if(this.bassMode)this.peekBass(null,'hover');});
    disk.addEventListener('focusin',e=>{if(this.bassMode)this.peekBass(e.target?.getAttribute?.('data-bass-way')??null);});
    disk.addEventListener('focusout',()=>{if(this.bassMode)this.peekBass(null);});
    const end=e=>{if(e.pointerId===pointer){
      const gesture=g;g=null;
      // Still inside the gesture (this.dragging), so Own sound shares the gesture's one Undo entry.
      if(this.soundMode&&gesture&&e.type==='pointerup'&&!gesture.view&&gesture.sector==='hub')this.selectSound(null);
      // A tap that began and ended on the chosen label presses it (one Undo entry, like the gesture's).
      if(this.bassMode&&gesture?.label&&e.type==='pointerup'&&onLabel(gesture.label,e))this.pressBassWay(gesture.label.index);
      if(this.soundMode){if(origin.soundPatch!==this.soundPatch)this._pushHistory(origin);}
      else if(this.bassMode){if(origin.bassMove!==this.bassMove)this._pushHistory(origin);}
      else this.remember(origin);
      pointer=null;this.dragging=false;
      if(this.soundMode&&gesture){
        // Letting go on a group shows its sounds; letting go after a press in the middle of a
        // sound ring shows all groups, however long the press. A cancelled gesture changes no view.
        if(e.type==='pointerup'&&!gesture.view&&Number.isInteger(gesture.sector))this._showSoundView(MELODY_SOUND_FAMILIES[gesture.sector].name,'in');
        else if(e.type==='pointerup'&&gesture.view&&gesture.hubPress&&gesture.sector==='hub')this._showSoundView(null,'out');
        this.paint();this.focusSoundChoice();
      }
      if(this.bassMode&&gesture){this.paint();this.focusBassChoice();}
      this.onGestureEnd?.();}};
    disk.addEventListener('pointerup',end);disk.addEventListener('pointercancel',end);disk.addEventListener('lostpointercapture',end);
    // Focusing the disk itself (entering the Sound or Bass wheel) lands on the chosen button, so Enter works.
    disk.addEventListener('focus',()=>{if(this.soundMode)this.focusSoundChoice();else if(this.bassMode)this.focusBassChoice();});
    disk.addEventListener('keydown',e=>{
      if(e.altKey||e.ctrlKey||e.metaKey)return; // Alt+Left (Back), Ctrl+Home and the like stay the browser's
      if(this.soundMode){
        const move=soundKeyMove(this.soundView,this.soundPatch,e.key,this.soundKept);
        if(!move)return;e.preventDefault();e.stopPropagation();this.applySoundMove(move);return;
      }
      if(this.bassMode){
        // Arrows and Home. Enter and Space press the focused button itself (a new way plays at Full, the chosen
        // way changes size), so the disk leaves them to the button and to the two-switch scan.
        const next=e.key==='Enter'||e.key===' '?null:bassKeyMove(this.bassMove,e.key);
        if(!next)return;e.preventDefault();e.stopPropagation();this.chooseBass(next);return;
      }
      const vectors={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1],Home:[-this.position.x,-this.position.y]};
      if(!vectors[e.key])return;e.preventDefault();e.stopPropagation();this.nudge(...vectors[e.key]);
    });
    root.querySelectorAll('[data-mf-axis]').forEach(input=>{
      let before=copy(this.position);
      input.addEventListener('focus',()=>{before=copy(this.position);});
      input.addEventListener('input',()=>this.request({...this.position,[input.dataset.mfAxis]:Number(input.value)/100}));
      input.addEventListener('change',()=>{this.remember(before);before=copy(this.position);});
    });
    this.paint();
  }

  nudge(x,y) {
    if(this.soundMode){this.applySoundMove(soundKeyMove(this.soundView,this.soundPatch,x+y>=0?'ArrowRight':'ArrowLeft',this.soundKept));return;}
    if(this.bassMode){this.chooseBass(bassKeyMove(this.bassMove,x>0?'ArrowRight':x<0?'ArrowLeft':y>0?'ArrowUp':'ArrowDown'));return;}
    const before=copy(this.position);this.request({x:before.x+x,y:before.y+y});this.remember(before);}

  /** Sound wheel states are drawn on the labels, never as dots over names: chosen is filled (and
   * aria-pressed on the hub and sounds; a group's name says its chosen sound); heard (only while the
   * tune plays its real sound, not the loading stand-in) carries data-heard and a small playing mark.
   * A view change rebuilds only the ring inside the disk, which keeps its pointer capture. */
  _paintSoundWheel(heardPatch) {
    const disk=this.root.querySelector('[data-melody-disk]');
    if(!disk?.classList?.contains('pf-sound-disk'))return;
    const view=this.soundView||'';
    if(disk.dataset.soundView!==view) {
      const hadFocus=disk.contains(globalThis.document?.activeElement);
      disk.dataset.soundView=view;
      if(this.soundZoom)disk.dataset.soundZoom=this.soundZoom;
      disk.setAttribute('aria-label',soundDiskLabel(this.soundView));
      disk.innerHTML=soundRingHtml(this.soundView,this.soundPatch);
      const prompt=this.root.querySelector('[data-mf-sound-prompt]');if(prompt)prompt.dataset.view=this.soundView?'sounds':'groups';
      const say=this.root.querySelector('[data-mf-sound-say]');if(say)say.textContent=soundViewSay(this.soundView);
      if(hadFocus)this.focusSoundChoice();
    }
    this.soundZoom=null;
    const set=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
    const flag=(el,name,on)=>{if(on)set(el,name,'true');else if(el.hasAttribute(name))el.removeAttribute(name);};
    const off=Boolean(this.guide);
    disk.querySelectorAll('[data-key]').forEach(el=>{if(el.disabled!==off)el.disabled=off;});
    disk.querySelectorAll('[data-sound-choice]').forEach(el=>{
      const patch=MELODY_SOUNDS[Number(el.dataset.soundChoice)]?.patch??null,on=patch===this.soundPatch;
      set(el,'aria-pressed',String(on));flag(el,'data-chosen',on);flag(el,'data-heard',patch===heardPatch);
    });
    const chosenFamily=familyOf(this.soundPatch),heardFamily=heardPatch===undefined?undefined:familyOf(heardPatch);
    disk.querySelectorAll('[data-sound-family]').forEach(el=>{
      const name=MELODY_SOUND_FAMILIES[Number(el.dataset.soundFamily)]?.name,on=name===chosenFamily;
      set(el,'aria-label',soundGroupLabel(name,this.soundPatch));flag(el,'data-chosen',on);flag(el,'data-heard',name===heardFamily);
      const now=el.querySelector('[data-sound-now]'),text=on?MELODY_SOUNDS[soundIndex(this.soundPatch)].short:'';
      if(now&&now.textContent!==text)now.textContent=text;
    });
  }

  /** Bass wheel states: chosen is the filled cell, a filled label with its size inside and aria-pressed; heard
   * (while it plays) is a lighter filled cell and a small playing mark on its label, never an outline (the focus
   * ring). heardMove undefined marks nothing. Nothing here pulses or animates. */
  _paintBassWheel(heardMove) {
    const disk=this.root.querySelector('[data-melody-disk]');
    if(!disk?.classList?.contains('pf-bass-disk'))return;
    const set=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
    const flag=(el,name,on)=>{if(on)set(el,name,'true');else if(el.hasAttribute(name))el.removeAttribute(name);};
    const off=Boolean(this.guide),chosen=parseBassMove(this.bassMove),heard=heardMove===undefined?null:parseBassMove(heardMove);
    disk.querySelectorAll('[data-key]').forEach(el=>{if(el.disabled!==off)el.disabled=off;});
    disk.querySelectorAll('[data-bass-move]').forEach(el=>{
      const on=this.bassMove===BASS_BAND;set(el,'aria-pressed',String(on));flag(el,'data-chosen',on);flag(el,'data-heard',heardMove===BASS_BAND);
    });
    disk.querySelectorAll('[data-bass-way]').forEach(el=>{
      const way=el.getAttribute('data-bass-way'),on=chosen?.way===way;
      set(el,'aria-pressed',String(on));flag(el,'data-chosen',on);flag(el,'data-heard',heard?.way===way);
      set(el,'aria-label',bassWayLabel(way,on?chosen.size:null));
      const size=el.querySelector('[data-bass-size]'),text=on?sizeName(chosen.size):'';
      if(size&&size.textContent!==text)size.textContent=text;
    });
    disk.querySelectorAll('[data-bass-cell]').forEach(el=>{
      const cell=el.getAttribute('data-bass-cell');flag(el,'data-chosen',cell===this.bassMove);flag(el,'data-heard',heardMove!==undefined&&cell===heardMove);
    });
  }

  /** The status line while the Bass wheel shows: what plays now, and the bass that comes next, each way with its size
   * and what it does ('Playing: Funky bass. It is big. Short notes with gaps.'). */
  _bassStatus({current,realized,pending,state,loading,standIn}) {
    if(this.requestError)return this.requestError;
    const next=bassSay(this.bassMove),now=bassSay(current.bassMove),note=this.bassNote?` ${this.bassNote}`:'';
    const does=move=>{const way=parseBassMove(move)?.way;return way?` ${hintOf(way)}`:'';};
    if(!this.scheduler.isPlaying)return (pending?'Stopped. Press Play to hear your next bass.':'Stopped. Press Play to hear this bass.')+note;
    const text=!realized?(state?.scheduledId==null?`Next: ${next}. Your bass will join soon.`:`Starting: ${next}.${does(this.bassMove)}`)
      :pending?(current.bassMove===this.bassMove?`Playing: ${now}.${does(current.bassMove)} Your next change joins soon.`:`Playing: ${now}. Next: ${next}.${does(this.bassMove)}`)
      :current.bassMove===BASS_BAND&&this.bassMoved&&!note?'The band bass is back. Your tune stays.':`Playing: ${now}.${does(current.bassMove)}`;
    return text+note+(standIn?(loading.state==='failed'?' Full sounds did not load.':' Full sounds are on the way.'):'');
  }

  paint() {
    if(!this.root)return;
    const state=this.scheduler.getPartAuditionState?.()||this.scheduler.lastPartAuditionState;
    const heard=heardMelodyCandidate(this);
    if(this.guide?.restoring&&heard?.id===this.guide.restoreId&&state?.scheduledId===this.guide.restoreId&&!state.pending&&Number.isFinite(state.scheduledTime)&&state.scheduledTime<=this.scheduler.audioCtx?.currentTime){
      const c=this.guide.comparison;this.comparisonPosition=c?.position||null;this.comparisonBandBalance=c?.balance;this.comparisonSoundPatch=c?.sound;this.comparisonBassMove=c?.bass;this.guide=null;
    }
    const panel=this.root.querySelector('[data-mf-guide]');if(panel)panel.hidden=!this.guide;
    const guideText=this.root.querySelector('[data-mf-guide-text]');
    if(guideText&&this.guide)guideText.textContent=this.guide.restoring?'Putting your mix back. Press Play if stopped.':heard?.id!==this.guide.previewId?'This mix is next. Press Play if stopped.':this.bandBalance?'The band is softer. Your tune notes stay.':'The full band is back. Your tune notes stay.';
    const use=this.root.querySelector('[data-key="melody-field-guide-use"]');if(use)use.disabled=!this.guide||this.guide.restoring||heard?.id!==this.guide.previewId||!melodyKeepReadiness(this).ok;
    for(const key of ['original','undo','explore','balance','sound-mode','tune-mode','bass-mode','keep','refine','back','take']){
      const el=this.root.querySelector('[data-key="melody-field-'+key+'"]');if(el)el.disabled=Boolean(this.guide);
    }
    const realized=this.candidates.get(this.realizedId),current=heard||this._candidate({x:0,y:0},this.initialBandBalance,this.initialSoundPatch,this.initialBassMove);
    // While the bank loads (or after it failed) every sampled lead plays the native stand-in, so no sound is heard as itself.
    const loading=this.scheduler.loadingSession;
    const standIn=Boolean(this.scheduler.isPlaying&&loading&&loading.state!=='live'&&current.song?.events?.some(e=>e.role==='lead'&&isSampledPatch(e.patch_id)));
    const heardSound=standIn?null:current.soundPatch;
    if(this.soundMode)this._paintSoundWheel(this.scheduler.isPlaying&&realized&&!standIn?current.soundPatch??null:undefined);
    // The bass line is heard even on a stand-in voice: its notes and timing are the move.
    else if(this.bassMode)this._paintBassWheel(this.scheduler.isPlaying&&realized?current.bassMove:undefined);
    else {
      const place=(selector,p)=>{
        const el=this.root.querySelector(selector);if(el){el.style.left=`${(p.x+1)*50}%`;el.style.top=`${(1-p.y)*50}%`;}
      };
      place('[data-mf-request]',this.position);place('[data-mf-reached]',current.position);
    }
    // A marker sitting on a region name hides it; the centre text already names the choice, so let that name fade.
    const regions=this.root.querySelectorAll('.pf-mf-region');
    regions.forEach((el,i)=>{const a=i*Math.PI*2/regions.length,lx=Math.sin(a)*.72,ly=Math.cos(a)*.72;
      el.dataset.near=String(!this.soundMode&&[this.position,current.position].some(q=>Math.hypot(q.x-lx,(q.y-ly)*2.2)<.42));});
    this.root.querySelectorAll('[data-mf-axis]').forEach(input=>{input.value=String(this.position[input.dataset.mfAxis]*100);input.setAttribute('aria-valuetext',this.melodyLabel(this.position));});
    const tuneDisk=this.wheel==='tune'&&this.root.querySelector('[data-melody-disk]');
    if(tuneDisk){tuneDisk.setAttribute('aria-valuetext',this.melodyLabel(this.position));tuneDisk.setAttribute('aria-valuenow',String(this._diskReach()));}
    const title=this.root.querySelector('.pf-mf-centre');if(title)title.textContent=this.melodyLabel(this.position);
    const status=this.root.querySelector('[data-mf-status]');
    const mix=this.root.querySelector('[data-key="melody-field-balance"]');
    if(mix){mix.textContent=this.bandBalance?'Restore band':'Softer band';mix.setAttribute('aria-pressed',String(this.bandBalance));}
    const focus=this.root.querySelector('[data-key="melody-field-focus"]');
    if(focus){const on=this.scheduler.spotlightRole==='tune';focus.setAttribute('aria-pressed',String(on));focus.textContent=on?'Hear full band':'Hear tune clearly';}
    const bassFocus=this.root.querySelector('[data-key="melody-field-bass-focus"]');
    const bassOn=this.scheduler.spotlightRole===BASS_SPOTLIGHT;
    if(bassFocus){bassFocus.setAttribute('aria-pressed',String(bassOn));bassFocus.textContent=bassOn?'Hear full band':'Hear bass clearly';}
    // The score shows it too: the tune and chord lanes fade while bass and beat stay (studio.css).
    const score=this.root.querySelector('[data-mf-score]');
    if(score){if(this.bassMode&&bassOn)score.setAttribute('data-spotlight','bass');else score.removeAttribute?.('data-spotlight');}
    if(this.bassMode)this._paintBassPeek();
    const label=(p,soft=false,sound=null)=>this.melodyLabel(p)+(soft?' with softer band':'')+(sound?' / '+soundLabel(sound):'');
    const pending=current.id!==this.requestId;
    const standInBass=Boolean(this.scheduler.isPlaying&&loading&&loading.state!=='live'&&current.song?.events?.some(e=>e.role==='bass'&&isSampledPatch(e.patch_id)));
    const softer=this.root.querySelector('[data-mf-bass-softer]');if(softer)softer.hidden=!this.bandBalance;
    const text=this.bassMode?this._bassStatus({current,realized,pending,state,loading,standIn:standInBass}):this.requestError||(!this.scheduler.isPlaying?(pending?'Stopped. Press Play to hear your next tune.':'Stopped. Press Play to hear this tune.'):
      !realized?(state?.scheduledId==null?`Next: ${label(this.position,this.bandBalance,this.soundPatch)}. Your tune will join soon.`:`Starting: ${label(this.position,this.bandBalance,this.soundPatch)}.`):
      (pending?`Playing: ${label(current.position,current.bandBalance,heardSound)}. Next: ${label(this.position,this.bandBalance,this.soundPatch)}.`:
      `Playing: ${label(current.position,current.bandBalance,heardSound)}.`)
      +(standIn&&(this.soundMode||current.soundPatch)?(loading.state==='failed'?' Full sounds did not load.':' Full sounds are on the way.'):''));
    if(status&&status.textContent!==text)status.textContent=text;
    // Keep and Refine use the heard score, even when a newer choice is waiting.
    // Show that same score as the main picture; an unheard choice is only a preview.
    if(this.palette){
      const keep=this.root.querySelector('[data-key="melody-field-keep"]');
      if(keep)keep.textContent=pending?(realized?'Keep last heard':'Keep original'):this.bassMode?'Keep this bass':'Keep this melody';
      const refine=this.root.querySelector('[data-key="melody-field-refine"]');
      if(refine)refine.textContent=pending?(realized?'Refine last heard':'Refine original'):'Refine notes';
      const help=this.root.querySelector('[data-mf-keep-help]');
      const nextHelp=this.scheduler.isPlaying?'Wait for this choice to play.':'Play this choice first to keep it.';
      const readiness=melodyKeepReadiness(this);
      if(keep&&!readiness.ok)keep.textContent='Keep when ready';
      // Back to jam never waits for full sounds: it leaves without keeping (play_flow.js). Keep and Refine wait.
      for(const key of ['melody-field-keep','melody-field-refine','melody-field-back','melody-field-back-top'])
        this.root.querySelector(`[data-key="${key}"]`)?.setAttribute('aria-disabled',String(Boolean(this.guide)||(!readiness.ok&&!key.startsWith('melody-field-back'))));
      const retry=this.root.querySelector('[data-mf-retry]'),failed=this.scheduler.loadingSession?.state==='failed';
      if(retry&&retry.hidden===failed){retry.hidden=!failed;retry.innerHTML=failed?SOUNDS_RETRY:'';}
      if(!readiness.ok&&!this.loadingSaveShown){
        const more=this.root.querySelector('.pf-melody-keep-more');if(more)more.open=true;
        this.loadingSaveShown=true;
      }
      const helpText=this.bassMode
        ?(!readiness.ok?readiness.message:pending?`${realized?'Keep saves the last bass you heard. Next, Save here keeps it in this browser.':'Keep saves the bass you started with. Next, Save here keeps it in this browser.'} ${nextHelp}`:BASS_KEEP_HELP)
        :!readiness.ok?readiness.message:pending?`${realized?'Keep chooses the last tune you heard. Next, Save here keeps it in this browser.':'Keep chooses your first tune. Next, Save here keeps it in this browser.'} ${nextHelp}`:'Keep chooses this tune. Next, Save here keeps it in this browser. Your first tune stays safe.';
      if(help&&help.textContent!==helpText)help.textContent=helpText;
    }
    // The button names what it brings back. Bass wheel: New bass only when the bass alone differs from the opening.
    // Tune and Sound wheels: a sound alone is First sound and New sound; New melody only when the tune differs.
    const original=this.root.querySelector('[data-key="melody-field-original"]');if(original)original.textContent=this._originalLabel();
    const button=this.root.querySelector('[data-key="melody-field-play"]');if(button)button.textContent=this.scheduler.isPlaying?'Stop':'Play';
    if(!this.scheduler.isPlaying)this.exploring=null;
    const explore=this.root.querySelector('[data-key="melody-field-explore"]');
    if(explore){explore.textContent=this.exploring?'Stay here':'Explore';explore.disabled=Boolean(this.guide)||this.soundMode||!this.scheduler.isPlaying;explore.setAttribute('aria-pressed',String(Boolean(this.exploring)));}
    const svg=this.root.querySelector('[data-mf-score]');if(!svg)return;
    const originCandidate=this._candidate({x:0,y:0},this.initialBandBalance,this.initialSoundPatch,this.initialBassMove);
    const requestedCandidate=this.candidates.get(this.requestId)||current;
    const playing=Boolean(this.scheduler.isPlaying);
    svg.setAttribute('aria-label',`${playing?'The band playing now':this.palette?'The tune Keep will save':'Your tune preview'}. Tune above; chords, bass and beat below. Time goes left to right.`);
    const displayed=playing||this.palette?current:requestedCandidate;
    // The score's preview and ghost draw the tune only; on the Bass wheel the score shows what plays now.
    const hasPendingPreview=!this.bassMode&&Boolean(playing||this.palette)&&requestedCandidate.id!==displayed.id;
    const showGhost=!this.bassMode&&displayed.id!==originCandidate.id;
    const caption=this.root.querySelector('[data-mf-score-caption]');
    if(caption){
      const capText=this.bassMode?(requestedCandidate.id!==displayed.id?'Your next bass joins soon. This shows what plays now.':'Find the bass below the chords.')
        :hasPendingPreview?(this.palette?'Next choice is a preview. Keep saves the main tune.':'Next tune shown with your first tune.'):showGhost?(this._tuneKey(displayed.position)!==this._tuneKey({x:0,y:0})?'New tune shown over your first tune.':(displayed.soundPatch??null)!==(this.initialSoundPatch??null)?'Same tune, new sound.':'Showing your first tune.'):'Showing your first tune.';
      if(caption.textContent!==capText)caption.textContent=capText;
    }
    const liveOwn=extractLivePersonalEvents(this.scheduler,{totalSteps:displayed.song.total_steps,bpm:displayed.song.bpm,originTime:this.captureOrigin});
    const model=buildLiveScoreModel({
      events:displayed.song.events,
      originalEvents:showGhost?originCandidate.song.events:null,
      previewEvents:hasPendingPreview?requestedCandidate.song.events:null,
      liveUserEvents:liveOwn,
      totalSteps:displayed.song.total_steps||64,
      stepsPerBar:displayed.song.steps_per_bar||16,
      bpm:displayed.song.bpm||100,
      swing:displayed.song.swing??0.5,
      bandBalance:displayed.bandBalance?0.45:1,
      spotlightRole:this.scheduler.spotlightRole,
      showOriginalGhost:showGhost,
    });
    const latency=Number(this.scheduler.audioCtx?.outputLatency||this.scheduler.audioCtx?.baseLatency||0);
    const now=(this.scheduler.audioCtx?.currentTime||0)-latency;
    const sounding=new Set((this.scheduler.visualNotes||[]).filter(n=>n.time<=now&&n.end>now).map(n=>n.event.id));
    const clock=this.scheduler.lastVisualClock;
    const stepSec=15/displayed.song.bpm;
    const quiet=isCalmVisuals();
    const at=clock?Math.min(now,clock.time+stepSec):now;
    const positionSteps=playing&&clock?(at-this.captureOrigin)/stepSec:null;
    const frame=computeLiveScoreFrame({
      isPlaying:playing&&Boolean(clock),
      positionSteps,
      startStep:0,
      windowSteps:displayed.song.total_steps||64,
      bpm:displayed.song.bpm||100,
      quiet,
    });
    syncLiveScoreSvg(svg,{
      model,
      frame,
      soundingIds:sounding,
      includeMfAttrs:true,
      showLaneLabels:true,
    });
  }
}
