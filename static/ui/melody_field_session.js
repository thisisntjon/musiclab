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

/** Every pitched sound in the bundled bank except the two basses (kept for a bass wheel) and
 * muted guitar (a click with little note body: 9-10 dB under piano even at full velocity).
 * level scales generated-note velocity so sounds land within about 2 dB of piano; measured
 * lead-only in workflow/evidence/sound-wheel-2026-11-13/instrument-levels.json and, for the
 * 13 Nov additions, workflow/evidence/sound-wheel-more-2026-11-13/candidate-metrics.json.
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
let sequence=0;
export const MELODY_JOIN_STEPS=4;
const copy=value=>structuredClone(value);

/** The last heard score survives Stop and the brief restart scheduling gap. */
export function heardMelodyCandidate(field,scheduler=field.scheduler) {
  const state=scheduler.getPartAuditionState?.()||scheduler.lastPartAuditionState;
  if(state?.sectionId===field.sectionId&&state?.realizedId)field.realizedId=state.realizedId;
  return field.realizedId?field.candidates.get(field.realizedId):field._candidate({x:0,y:0},field.initialBandBalance,field.initialSoundPatch);
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

  toggleOriginal() {
    if(this.comparisonPosition) {
      const p=this.comparisonPosition;
      if(this.request({...p,bandBalance:this.comparisonBandBalance,soundPatch:this.comparisonSoundPatch},{comparison:true}))this.comparisonPosition=null;
    } else {
      const p={...this.position},balance=this.bandBalance,sound=this.soundPatch;
      if(this.request({x:0,y:0,bandBalance:this.initialBandBalance,soundPatch:this.initialSoundPatch},{comparison:true})){this.comparisonPosition=p;this.comparisonBandBalance=balance;this.comparisonSoundPatch=sound;}
    }
    this.followSoundView();
    this.paint();
  }

  melodyLabel(position) {
    const choice=this.palette?this.chooseMelody(position):melodyFieldRegion(position,3);
    const development=this.palette?.[choice.key]?.development;
    return development?.applied===false?'Theme kept. This change does not fit.':choice.label;
  }

  _candidate(position,balance=this.bandBalance,sound=this.soundPatch) {
    const p=melodyFieldPosition(position),choice=this.palette?this.chooseMelody(p):null,id=`${this.sectionId}:${choice?choice.key:`${p.x}:${p.y}`}${balance?':soft':''}${sound?':sound:'+sound:''}`;
    if(!this.candidates.has(id)) {
      const variant=this.palette?this.palette[choice.key]:melodyFieldVariant(this.field,p);
      this.candidates.set(id,{id,position:variant.choice?.position||p,song:{...this.source,events:melodySoundEvents(balancedEvents(variant.notes,this.bandBasis,balance),sound)},soundPatch:sound,bandBalance:balance,changed:variant.changed});
      // Never evict the requested, scheduled or realized score while the clock can still reach it.
      const state=this.scheduler.getPartAuditionState?.();
      const protectedIds=new Set([id,this.requestId,this.realizedId,state?.scheduledId]);
      for(const key of this.candidates.keys())if(this.candidates.size>32&&!protectedIds.has(key))this.candidates.delete(key);
    }
    return this.candidates.get(id);
  }

  view(candidate) {
    return melodyFieldPlaybackView(candidate.song,this.captureOrigin,this.scheduler.gridOriginTime);
  }

  begin() {
    const candidate=this._candidate(this.position);
    if(!this.scheduler.isPlaying)return false;
    const ok=this.scheduler.queueContinuousPartAudition(this.view(candidate),
      {sectionId:this.sectionId,requestId:candidate.id,joinSteps:MELODY_JOIN_STEPS}).ok;
    if(ok)this.hasPlayed=true;return ok;
  }

  request(position,{automatic=false,comparison=false,guide=false}={}) {
    if(this.guide&&!guide)return false;
    if(!comparison)this.comparisonPosition=null;
    if(!automatic)this.exploring=null;
    const balance=position.bandBalance??this.bandBalance;
    const sound=Object.hasOwn(position,'soundPatch')?position.soundPatch:this.soundPatch;
    const candidate=this._candidate(position,balance,sound);
    if(candidate.id!==this.requestId&&this.scheduler.isPlaying) {
      const result=this.scheduler.queueContinuousPartAudition(this.view(candidate),
        {sectionId:this.sectionId,requestId:candidate.id,joinSteps:MELODY_JOIN_STEPS});
      if(!result?.ok) {
        this.exploring=null;
        this.requestError='That move did not play. Your tune stays. Stop, then play to try again.';
        this.paint();return false;
      }
    }
    this.requestError=null;
    this.position=melodyFieldPosition(position);this.bandBalance=balance;this.soundPatch=sound;this._keepSound(sound);
    this.requestId=candidate.id;
    this.paint();return true;
  }

  /** The sound last chosen in each group (UI memory only): group-ring arrows come back to it. */
  _keepSound(patch) {const family=familyOf(patch);if(family)this.soundKept[family]=patch;}

  remember(position) {
    if(position.x!==this.position.x||position.y!==this.position.y) {
      this.history.push({...copy(position),bandBalance:this.bandBalance,soundPatch:this.soundPatch});this.history=this.history.slice(-32);
    }
  }

  startGuide() {
    if(this.guide)return false;
    const heard=heardMelodyCandidate(this);
    if(!this.scheduler.isPlaying||!this.realizedId||heard?.id!==this.requestId||!melodyKeepReadiness(this).ok){
      this.requestError='Play this tune first. Then try Show me.';this.paint();return false;
    }
    const before={...this.position,bandBalance:this.bandBalance,soundPatch:this.soundPatch};
    const alternate=this._candidate(this.position,!this.bandBalance);
    if(JSON.stringify(alternate.song.events)===JSON.stringify(heard.song.events)){
      this.requestError='This tune has no band notes to change.';this.paint();return false;
    }
    const comparison=this.comparisonPosition?{position:copy(this.comparisonPosition),balance:this.comparisonBandBalance,sound:this.comparisonSoundPatch}:null;
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
    const before={...this.position,bandBalance:this.bandBalance,soundPatch:this.soundPatch};
    if(this.request({...this.position,bandBalance:!this.bandBalance})){this.history.push(before);this.history=this.history.slice(-32);}
  }

  selectSound(patch) {
    const before={...this.position,bandBalance:this.bandBalance,soundPatch:this.soundPatch};
    if(patch===this.soundPatch)return;
    if(patch&&!this._candidate(this.position).song.events.some(e=>e.role==='lead'&&e.provenance==='jam_generated'&&!e.edited_from_generator)){
      this.requestError='Your notes keep their sound. Try a new tune first.';this.paint();return;
    }
    if(this.request({...this.position,soundPatch:patch})&&!this.dragging){this.history.push(before);this.history=this.history.slice(-32);}
  }

  undo() {const p=this.history.at(-1);if(p&&this.request(p)){this.history.pop();if(this.followSoundView())this.paint();}}

  /** Sound wheel view (UI only): null shows the group ring, a group name shows that group's sounds.
   * It never enters history, candidates, candidate ids, comparison state or the saved sound. */
  setSoundMode(on) {
    this.soundMode=Boolean(on);this.soundView=null;this.soundZoom=null;
    if(this.soundMode)this.exploring=null;
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
    if(this.soundMode||this.guide)return;
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
    return `<div class="pf-wheel-tabs" role="group" aria-label="Wheels">${tab('melody-field-tune-mode',!this.soundMode,'Tune wheel')}${tab('melody-field-sound-mode',Boolean(this.soundMode),'Sound wheel')}</div>`;
  }

  /** The Sound wheel disk (its prompt holds both views' words in one cell, so a view change never
   * moves the disk). The disk owns pointer input; its buttons serve keys, switches and
   * assistive technology, and each is a Tab stop (the disk itself is not a Tab stop here). */
  _soundDiskHtml() {
    return `<div class="pf-melody-disk pf-sound-disk" data-melody-disk data-sound-view="${this.soundView||''}" tabindex="-1" role="group" aria-label="${soundDiskLabel(this.soundView)}">${soundRingHtml(this.soundView,this.soundPatch)}</div>`;
  }

  html() {
    const families=this.palette?this.melodyFamilies:MELODY_FIELD_V3_REGIONS;
    return `<section class="pf-stage pf-melody-field" data-melody-mode="${this.palette?'phrase-composer':'note-variation'}" data-composer-version="${this.composerVersion}"><h1 class="pf-heading">${this.palette?'Make your tune':'Try note changes'}</h1>
      <p>${this.composerVersion>=7?'Turn to try ideas. Move out to shape one. Band notes stay.':this.composerVersion>=6?'Move out to shape this idea. Move round to try more.' :this.palette?'Try a new phrase with this band. Your first tune stays.':'This map changes notes in your tune. It does not build a new melody.'}</p>
      ${this.palette&&this.composerVersion===2?'<p class="pf-sub">New melody preview. Move out for more change.</p>':''}
      ${this.palette?'':this.canUpgrade?'<p class="pf-sub" data-mf-coverage>Your saved take is open as it was. Try new tunes when ready.</p><div class="pf-row"><button class="pf-btn" data-key="melody-field-upgrade">Try new tunes</button></div>':'<p class="pf-sub" data-mf-coverage>New melody choices are not ready for this groove. Your groove stays. Use Back to groove to keep playing.</p>'}
      <div class="pf-row"><button class="pf-btn pf-play" data-key="melody-field-play">${this.scheduler.isPlaying?'Stop':'Play'}</button>
      <button class="pf-btn" data-key="melody-field-original">Original</button><button class="pf-btn" data-key="melody-field-undo">Undo move</button>
      <button class="pf-btn" data-key="melody-field-explore" ${this.soundMode?'disabled':''}>Explore</button>
      ${this.palette?`<button class="pf-btn" data-key="melody-field-balance" aria-pressed="${this.bandBalance}">${this.bandBalance?"Restore band":"Softer band"}</button>`:''}<button class="pf-btn" data-key="melody-field-focus" aria-pressed="${this.scheduler.spotlightRole==='tune'}">Hear tune clearly</button></div>
      ${this.palette?this._wheelTabsHtml():''}
      ${this.soundMode?`<p class="pf-sound-prompt" data-mf-sound-prompt data-view="${this.soundView?'sounds':'groups'}"><span data-prompt="groups">${soundPrompt(null)}</span><span data-prompt="sounds">${soundPrompt('sounds')}</span></p><p class="sr-only" data-mf-sound-say aria-live="polite" aria-atomic="true"></p>`:''}
      <div data-mf-guide ${this.guide?'':'hidden'} role="region" aria-label="Hear one change"><p data-mf-guide-text></p><div class="pf-row"><button class="pf-btn" data-key="melody-field-guide-use">Use this</button><button class="pf-btn" data-key="melody-field-guide-back">Put back</button></div></div>
      <div class="pf-mf-main${this.soundMode?' pf-sound-main':''}"><div class="pf-mf-wheel${this.soundMode?' pf-sound-wheel':''}">${this.soundMode?this._soundDiskHtml():`<div class="pf-melody-disk" data-melody-disk tabindex="0" role="group" aria-label="${this.composerVersion>=7?'Tune choices. Band notes stay':this.palette?'Whole melody choices':'Note changes'}. ${"Move between "+families.join(", ")+"."} Centre is your original.">
        ${families.map((name,i)=>`<span class="pf-mf-label pf-mf-region" style="left:${50+Math.sin(i*Math.PI*2/families.length)*36}%;top:${50-Math.cos(i*Math.PI*2/families.length)*36}%">${name}</span>`).join('')}
        <span class="pf-mf-centre">Your tune</span><span class="pf-mf-request" data-mf-request></span><span class="pf-mf-reached" data-mf-reached></span>
      </div>`}<p class="pf-sub" data-mf-status role="status" aria-live="polite"></p></div>
      <div class="pf-mf-band"><div class="pf-live-score-head"><span class="pf-live-score-caption" data-mf-score-caption>Showing your first tune.</span></div><svg class="pf-mf-score pf-live-score" data-mf-score viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" role="img" aria-label="The band playing now. Tune above; chords, bass and beat below. Time goes left to right."></svg></div></div>
      <div class="pf-row"><button class="pf-btn pf-next" data-key="melody-field-keep">${this.palette?"Keep this melody":"Keep this take"}</button>
      <button class="pf-btn" data-key="melody-field-refine">Refine notes</button>
      <button class="pf-btn" data-key="melody-field-back">${this.palette?"Back to jam":"Back to groove"}</button></div>
      <p class="pf-sub" data-mf-keep-help>${this.palette?'Keep chooses this tune. Next, Save here keeps it in this browser. Your first tune stays safe.':'Keep this take saves your live play up to now. Your first tune stays safe.'}</p>
      <p class="pf-sub" data-mf-focus-help>${this.palette?'Softer band stays when you save. Hear tune clearly is just for now.':'Hear with less band. Your saved mix stays.'}</p>
      ${this.soundMode?'':`<details><summary data-key="melody-field-controls">Move with buttons</summary><div class="pf-row">
      <button class="pf-btn" data-key="melody-field-left">Left</button><button class="pf-btn" data-key="melody-field-right">Right</button>
      <button class="pf-btn" data-key="melody-field-up">Up</button><button class="pf-btn" data-key="melody-field-down">Down</button></div>
      <label>Across <input data-mf-axis="x" type="range" min="-100" max="100" value="${this.position.x*100}" aria-label="Across the melody map"></label>
      <label>Up or down <input data-mf-axis="y" type="range" min="-100" max="100" value="${this.position.y*100}" aria-label="Up or down the melody map"></label></details>`}
      ${this.palette?`<details class="pf-melody-keep-more" ${this.moreOpen?'open':''}><summary data-key="melody-keep-more">More ways</summary><div class="pf-row"><button class="pf-btn" data-key="melody-field-guide">Show me</button><button class="pf-btn" data-key="melody-field-take">Save played take</button></div>${this.composerVersion===9?'<p class="pf-sub">Move round for new ideas. Move out: Light has fewer notes. Theme is the full idea. Breathe adds a gap near the end. Return brings the first rhythm back.</p>':''}<p class="pf-sub">Save played take keeps your live play too.</p></details>`:''}</section>`;
  }

  bind(root) {
    this.root=root;
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
      }else this.request({x,y});
    };
    let pointer=null,origin=null;
    disk.addEventListener('pointerdown',e=>{
      if(e.button!==0||pointer!=null)return;
      if(this.soundMode){
        const {x,y}=point(e),sector=soundSector(this.soundView,x,y);
        if(sector==null||this.guide)return;
        g={view:this.soundView,sector,start:this.soundPatch,hubPress:sector==='hub'};
      }
      e.preventDefault();if(!this.soundMode)disk.focus({preventScroll:true});pointer=e.pointerId;origin={...copy(this.position),bandBalance:this.bandBalance,soundPatch:this.soundPatch};this.dragging=true;
      disk.setPointerCapture(e.pointerId);
      if(this.soundMode)soundAt(g.sector);else move(e);
    });
    disk.addEventListener('pointermove',e=>{if(e.pointerId===pointer)move(e);});
    const end=e=>{if(e.pointerId===pointer){
      const gesture=g;g=null;
      // Still inside the gesture (this.dragging), so Own sound shares the gesture's one Undo entry.
      if(this.soundMode&&gesture&&e.type==='pointerup'&&!gesture.view&&gesture.sector==='hub')this.selectSound(null);
      if(this.soundMode){if(origin.soundPatch!==this.soundPatch){this.history.push(origin);this.history=this.history.slice(-32);}}else this.remember(origin);
      pointer=null;this.dragging=false;
      if(this.soundMode&&gesture){
        // Letting go on a group shows its sounds; letting go after a press in the middle of a
        // sound ring shows all groups, however long the press. A cancelled gesture changes no view.
        if(e.type==='pointerup'&&!gesture.view&&Number.isInteger(gesture.sector))this._showSoundView(MELODY_SOUND_FAMILIES[gesture.sector].name,'in');
        else if(e.type==='pointerup'&&gesture.view&&gesture.hubPress&&gesture.sector==='hub')this._showSoundView(null,'out');
        this.paint();this.focusSoundChoice();
      }
      this.onGestureEnd?.();}};
    disk.addEventListener('pointerup',end);disk.addEventListener('pointercancel',end);disk.addEventListener('lostpointercapture',end);
    // Focusing the disk itself (entering the Sound wheel) lands on the chosen hub, group or sound, so Enter works.
    disk.addEventListener('focus',()=>{if(this.soundMode)this.focusSoundChoice();});
    disk.addEventListener('keydown',e=>{
      if(e.altKey||e.ctrlKey||e.metaKey)return; // Alt+Left (Back), Ctrl+Home and the like stay the browser's
      if(this.soundMode){
        const move=soundKeyMove(this.soundView,this.soundPatch,e.key,this.soundKept);
        if(!move)return;e.preventDefault();e.stopPropagation();this.applySoundMove(move);return;
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

  paint() {
    if(!this.root)return;
    const state=this.scheduler.getPartAuditionState?.()||this.scheduler.lastPartAuditionState;
    const heard=heardMelodyCandidate(this);
    if(this.guide?.restoring&&heard?.id===this.guide.restoreId&&state?.scheduledId===this.guide.restoreId&&!state.pending&&Number.isFinite(state.scheduledTime)&&state.scheduledTime<=this.scheduler.audioCtx?.currentTime){
      const c=this.guide.comparison;this.comparisonPosition=c?.position||null;this.comparisonBandBalance=c?.balance;this.comparisonSoundPatch=c?.sound;this.guide=null;
    }
    const panel=this.root.querySelector('[data-mf-guide]');if(panel)panel.hidden=!this.guide;
    const guideText=this.root.querySelector('[data-mf-guide-text]');
    if(guideText&&this.guide)guideText.textContent=this.guide.restoring?'Putting your mix back. Press Play if stopped.':heard?.id!==this.guide.previewId?'This mix is next. Press Play if stopped.':this.bandBalance?'The band is softer. Your tune notes stay.':'The full band is back. Your tune notes stay.';
    const use=this.root.querySelector('[data-key="melody-field-guide-use"]');if(use)use.disabled=!this.guide||this.guide.restoring||heard?.id!==this.guide.previewId||!melodyKeepReadiness(this).ok;
    for(const key of ['original','undo','explore','balance','sound-mode','tune-mode','keep','refine','back','take']){
      const el=this.root.querySelector('[data-key="melody-field-'+key+'"]');if(el)el.disabled=Boolean(this.guide);
    }
    const realized=this.candidates.get(this.realizedId),current=heard||this._candidate({x:0,y:0},this.initialBandBalance,this.initialSoundPatch);
    // While the bank loads (or after it failed) every sampled lead plays the native stand-in, so no sound is heard as itself.
    const loading=this.scheduler.loadingSession;
    const standIn=Boolean(this.scheduler.isPlaying&&loading&&loading.state!=='live'&&current.song?.events?.some(e=>e.role==='lead'&&isSampledPatch(e.patch_id)));
    const heardSound=standIn?null:current.soundPatch;
    if(this.soundMode)this._paintSoundWheel(this.scheduler.isPlaying&&realized&&!standIn?current.soundPatch??null:undefined);
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
    const title=this.root.querySelector('.pf-mf-centre');if(title)title.textContent=this.melodyLabel(this.position);
    const status=this.root.querySelector('[data-mf-status]');
    const mix=this.root.querySelector('[data-key="melody-field-balance"]');
    if(mix){mix.textContent=this.bandBalance?'Restore band':'Softer band';mix.setAttribute('aria-pressed',String(this.bandBalance));}
    const focus=this.root.querySelector('[data-key="melody-field-focus"]');
    if(focus){const on=this.scheduler.spotlightRole==='tune';focus.setAttribute('aria-pressed',String(on));focus.textContent=on?'Hear full band':'Hear tune clearly';}
    const label=(p,soft=false,sound=null)=>this.melodyLabel(p)+(soft?' with softer band':'')+(sound?' / '+soundLabel(sound):'');
    const pending=current.id!==this.requestId;
    const text=this.requestError||(!this.scheduler.isPlaying?(pending?'Stopped. Press Play to hear your next tune.':'Stopped. Press Play to hear this tune.'):
      !realized?(state?.scheduledId==null?`Next: ${label(this.position,this.bandBalance,this.soundPatch)}. Your tune will join soon.`:`Starting: ${label(this.position,this.bandBalance,this.soundPatch)}.`):
      (pending?`Playing: ${label(current.position,current.bandBalance,heardSound)}. Next: ${label(this.position,this.bandBalance,this.soundPatch)}.`:
      `Playing: ${label(current.position,current.bandBalance,heardSound)}.`)
      +(standIn&&(this.soundMode||current.soundPatch)?(loading.state==='failed'?' Full sounds did not load.':' Full sounds are on the way.'):''));
    if(status&&status.textContent!==text)status.textContent=text;
    // Keep and Refine use the heard score, even when a newer choice is waiting.
    // Show that same score as the main picture; an unheard choice is only a preview.
    if(this.palette){
      const keep=this.root.querySelector('[data-key="melody-field-keep"]');
      if(keep)keep.textContent=pending?(realized?'Keep last heard':'Keep original'):'Keep this melody';
      const refine=this.root.querySelector('[data-key="melody-field-refine"]');
      if(refine)refine.textContent=pending?(realized?'Refine last heard':'Refine original'):'Refine notes';
      const help=this.root.querySelector('[data-mf-keep-help]');
      const nextHelp=this.scheduler.isPlaying?'Wait for this choice to play.':'Play this choice first to keep it.';
      const readiness=melodyKeepReadiness(this);
      if(keep&&!readiness.ok)keep.textContent='Keep when ready';
      for(const key of ['melody-field-keep','melody-field-refine','melody-field-back'])
        this.root.querySelector(`[data-key="${key}"]`)?.setAttribute('aria-disabled',String(Boolean(this.guide)||!readiness.ok));
      if(!readiness.ok&&!this.loadingSaveShown){
        const more=this.root.querySelector('.pf-melody-keep-more');if(more)more.open=true;
        this.loadingSaveShown=true;
      }
      if(help)help.textContent=!readiness.ok?readiness.message:pending?`${realized?'Keep chooses the last tune you heard. Next, Save here keeps it in this browser.':'Keep chooses your first tune. Next, Save here keeps it in this browser.'} ${nextHelp}`:'Keep chooses this tune. Next, Save here keeps it in this browser. Your first tune stays safe.';
    }
    const original=this.root.querySelector('[data-key="melody-field-original"]');if(original)original.textContent=this.comparisonPosition?'New melody':'Original';
    const button=this.root.querySelector('[data-key="melody-field-play"]');if(button)button.textContent=this.scheduler.isPlaying?'Stop':'Play';
    if(!this.scheduler.isPlaying)this.exploring=null;
    const explore=this.root.querySelector('[data-key="melody-field-explore"]');
    if(explore){explore.textContent=this.exploring?'Stay here':'Explore';explore.disabled=Boolean(this.guide)||this.soundMode||!this.scheduler.isPlaying;explore.setAttribute('aria-pressed',String(Boolean(this.exploring)));}
    const svg=this.root.querySelector('[data-mf-score]');if(!svg)return;
    const originCandidate=this._candidate({x:0,y:0},this.initialBandBalance,this.initialSoundPatch);
    const requestedCandidate=this.candidates.get(this.requestId)||current;
    const playing=Boolean(this.scheduler.isPlaying);
    svg.setAttribute('aria-label',`${playing?'The band playing now':this.palette?'The tune Keep will save':'Your tune preview'}. Tune above; chords, bass and beat below. Time goes left to right.`);
    const displayed=playing||this.palette?current:requestedCandidate;
    const hasPendingPreview=Boolean(playing||this.palette)&&requestedCandidate.id!==displayed.id;
    const showGhost=displayed.id!==originCandidate.id;
    const caption=this.root.querySelector('[data-mf-score-caption]');
    if(caption){
      const capText=hasPendingPreview?(this.palette?'Next choice is a preview. Keep saves the main tune.':'Next tune shown with your first tune.'):showGhost?'New tune shown over your first tune.':'Showing your first tune.';
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
