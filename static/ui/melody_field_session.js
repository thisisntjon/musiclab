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

let sequence=0;
export const MELODY_JOIN_STEPS=4;
const copy=value=>structuredClone(value);

/** The last heard score survives Stop and the brief restart scheduling gap. */
export function heardMelodyCandidate(field,scheduler=field.scheduler) {
  const state=scheduler.getPartAuditionState?.()||scheduler.lastPartAuditionState;
  if(state?.sectionId===field.sectionId&&state?.realizedId)field.realizedId=state.realizedId;
  return field.realizedId?field.candidates.get(field.realizedId):field._candidate({x:0,y:0},field.initialBandBalance);
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
      if(this.request({...p,bandBalance:this.comparisonBandBalance},{comparison:true}))this.comparisonPosition=null;
    } else {
      const p={...this.position},balance=this.bandBalance;
      if(this.request({x:0,y:0,bandBalance:this.initialBandBalance},{comparison:true})){this.comparisonPosition=p;this.comparisonBandBalance=balance;}
    }
    this.paint();
  }

  melodyLabel(position) {
    const choice=this.palette?this.chooseMelody(position):melodyFieldRegion(position,3);
    const development=this.palette?.[choice.key]?.development;
    return development?.applied===false?'Theme kept. This change does not fit.':choice.label;
  }

  _candidate(position,balance=this.bandBalance) {
    const p=melodyFieldPosition(position),choice=this.palette?this.chooseMelody(p):null,id=`${this.sectionId}:${choice?choice.key:`${p.x}:${p.y}`}${balance?':soft':''}`;
    if(!this.candidates.has(id)) {
      const variant=this.palette?this.palette[choice.key]:melodyFieldVariant(this.field,p);
      this.candidates.set(id,{id,position:variant.choice?.position||p,song:{...this.source,events:balancedEvents(variant.notes,this.bandBasis,balance)},bandBalance:balance,changed:variant.changed});
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

  request(position,{automatic=false,comparison=false}={}) {
    if(!comparison)this.comparisonPosition=null;
    if(!automatic)this.exploring=null;
    const balance=position.bandBalance??this.bandBalance;
    const candidate=this._candidate(position,balance);
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
    this.position=melodyFieldPosition(position);this.bandBalance=balance;
    this.requestId=candidate.id;
    this.paint();return true;
  }

  remember(position) {
    if(JSON.stringify(position)!==JSON.stringify(this.position)) {
      this.history.push({...copy(position),bandBalance:this.bandBalance});this.history=this.history.slice(-32);
    }
  }

  toggleBandBalance(){
    const before={...this.position,bandBalance:this.bandBalance};
    if(this.request({...this.position,bandBalance:!this.bandBalance})){this.history.push(before);this.history=this.history.slice(-32);}
  }

  undo() {const p=this.history.at(-1);if(p&&this.request(p))this.history.pop();}

  toggleExploration() {
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

  html() {
    const families=this.palette?this.melodyFamilies:MELODY_FIELD_V3_REGIONS;
    return `<section class="pf-stage pf-melody-field" data-melody-mode="${this.palette?'phrase-composer':'note-variation'}" data-composer-version="${this.composerVersion}"><h1 class="pf-heading">${this.palette?'Make your tune':'Try note changes'}</h1>
      <p>${this.composerVersion>=7?'Turn to try ideas. Move out to shape one. Band notes stay.':this.composerVersion>=6?'Move out to shape this idea. Move round to try more.' :this.palette?'Try a new phrase with this band. Your first tune stays.':'This map changes notes in your tune. It does not build a new melody.'}</p>
      ${this.palette&&this.composerVersion===2?'<p class="pf-sub">New melody preview. Move out for more change.</p>':''}
      ${this.palette?'':this.canUpgrade?'<p class="pf-sub" data-mf-coverage>Your saved take is open as it was. Try new tunes when ready.</p><div class="pf-row"><button class="pf-btn" data-key="melody-field-upgrade">Try new tunes</button></div>':'<p class="pf-sub" data-mf-coverage>New melody choices are not ready for this groove. Your groove stays. Use Back to groove to keep playing.</p>'}
      <div class="pf-row"><button class="pf-btn pf-play" data-key="melody-field-play">${this.scheduler.isPlaying?'Stop':'Play'}</button>
      <button class="pf-btn" data-key="melody-field-original">Original</button><button class="pf-btn" data-key="melody-field-undo">Undo move</button>
      <button class="pf-btn" data-key="melody-field-explore">Explore</button>
      ${this.palette?`<button class="pf-btn" data-key="melody-field-balance" aria-pressed="${this.bandBalance}">${this.bandBalance?"Restore band":"Softer band"}</button>`:''}<button class="pf-btn" data-key="melody-field-focus" aria-pressed="${this.scheduler.spotlightRole==='tune'}">Hear tune clearly</button></div>
      <div class="pf-mf-main"><div class="pf-mf-wheel"><div class="pf-melody-disk" data-melody-disk tabindex="0" role="group" aria-label="${this.composerVersion>=7?'Tune choices. Band notes stay':this.palette?'Whole melody choices':'Note changes'}. ${"Move between "+families.join(", ")+"."} Centre is your original.">
        ${families.map((name,i)=>`<span class="pf-mf-label pf-mf-region" style="left:${50+Math.sin(i*Math.PI*2/families.length)*36}%;top:${50-Math.cos(i*Math.PI*2/families.length)*36}%">${name}</span>`).join('')}
        <span class="pf-mf-centre">Your tune</span><span class="pf-mf-request" data-mf-request></span><span class="pf-mf-reached" data-mf-reached></span>
      </div><p class="pf-sub" data-mf-status role="status" aria-live="polite"></p></div>
      <div class="pf-mf-band"><div class="pf-live-score-head"><span class="pf-live-score-caption" data-mf-score-caption>Showing your first tune.</span></div><svg class="pf-mf-score pf-live-score" data-mf-score viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" role="img" aria-label="The band playing now. Tune above; chords, bass and beat below. Time goes left to right."></svg></div></div>
      <div class="pf-row"><button class="pf-btn pf-next" data-key="melody-field-keep">${this.palette?"Keep this melody":"Keep this take"}</button>
      <button class="pf-btn" data-key="melody-field-refine">Refine notes</button>
      <button class="pf-btn" data-key="melody-field-back">${this.palette?"Back to jam":"Back to groove"}</button></div>
      <p class="pf-sub" data-mf-keep-help>${this.palette?'Keep saves this tune. Your first tune stays safe.':'Keep this take saves your live play up to now. Your first tune stays safe.'}</p>
      <p class="pf-sub" data-mf-focus-help>${this.palette?'Softer band stays when you save. Hear tune clearly is just for now.':'Hear with less band. Your saved mix stays.'}</p>
      <details><summary data-key="melody-field-controls">Move with buttons</summary><div class="pf-row">
      <button class="pf-btn" data-key="melody-field-left">Left</button><button class="pf-btn" data-key="melody-field-right">Right</button>
      <button class="pf-btn" data-key="melody-field-up">Up</button><button class="pf-btn" data-key="melody-field-down">Down</button></div>
      <label>Across <input data-mf-axis="x" type="range" min="-100" max="100" value="${this.position.x*100}" aria-label="Across the melody map"></label>
      <label>Up or down <input data-mf-axis="y" type="range" min="-100" max="100" value="${this.position.y*100}" aria-label="Up or down the melody map"></label></details>
      ${this.palette?`<details class="pf-melody-keep-more" ${this.moreOpen?'open':''}><summary data-key="melody-keep-more">More ways</summary><div class="pf-row"><button class="pf-btn" data-key="melody-field-take">Save played take</button></div>${this.composerVersion===9?'<p class="pf-sub">Move round for new ideas. Move out: Light has fewer notes. Theme is the full idea. Breathe adds a gap near the end. Return brings the first rhythm back.</p>':''}<p class="pf-sub">Save played take keeps your live play too.</p></details>`:''}</section>`;
  }

  bind(root) {
    this.root=root;
    const disk=root.querySelector('[data-melody-disk]');if(!disk)return;
    const move=e=>{
      const r=disk.getBoundingClientRect();
      this.request({x:2*(e.clientX-r.left)/r.width-1,y:1-2*(e.clientY-r.top)/r.height});
    };
    let pointer=null,origin=null;
    disk.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;e.preventDefault();disk.focus({preventScroll:true});pointer=e.pointerId;origin=copy(this.position);this.dragging=true;
      disk.setPointerCapture(e.pointerId);move(e);
    });
    disk.addEventListener('pointermove',e=>{if(e.pointerId===pointer)move(e);});
    const end=e=>{if(e.pointerId===pointer){this.remember(origin);pointer=null;this.dragging=false;this.onGestureEnd?.();}};
    disk.addEventListener('pointerup',end);disk.addEventListener('pointercancel',end);disk.addEventListener('lostpointercapture',end);
    disk.addEventListener('keydown',e=>{
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

  nudge(x,y) {const before=copy(this.position);this.request({x:before.x+x,y:before.y+y});this.remember(before);}

  paint() {
    if(!this.root)return;
    const state=this.scheduler.getPartAuditionState?.()||this.scheduler.lastPartAuditionState;
    const heard=heardMelodyCandidate(this);
    const realized=this.candidates.get(this.realizedId),current=heard||this._candidate({x:0,y:0},this.initialBandBalance);
    const place=(selector,p)=>{
      const el=this.root.querySelector(selector);if(el){el.style.left=`${(p.x+1)*50}%`;el.style.top=`${(1-p.y)*50}%`;}
    };
    place('[data-mf-request]',this.position);place('[data-mf-reached]',current.position);
    // A marker sitting on a region name hides it; the centre text already names the choice, so let that name fade.
    const regions=this.root.querySelectorAll('.pf-mf-region');
    regions.forEach((el,i)=>{const a=i*Math.PI*2/regions.length,lx=Math.sin(a)*.72,ly=Math.cos(a)*.72;
      el.dataset.near=String([this.position,current.position].some(q=>Math.hypot(q.x-lx,(q.y-ly)*2.2)<.42));});
    this.root.querySelectorAll('[data-mf-axis]').forEach(input=>{input.value=String(this.position[input.dataset.mfAxis]*100);input.setAttribute('aria-valuetext',this.melodyLabel(this.position));});
    const title=this.root.querySelector('.pf-mf-centre');if(title)title.textContent=this.melodyLabel(this.position);
    const status=this.root.querySelector('[data-mf-status]');
    const mix=this.root.querySelector('[data-key="melody-field-balance"]');
    if(mix){mix.textContent=this.bandBalance?'Restore band':'Softer band';mix.setAttribute('aria-pressed',String(this.bandBalance));}
    const focus=this.root.querySelector('[data-key="melody-field-focus"]');
    if(focus){const on=this.scheduler.spotlightRole==='tune';focus.setAttribute('aria-pressed',String(on));focus.textContent=on?'Hear full band':'Hear tune clearly';}
    const label=(p,soft=false)=>this.melodyLabel(p)+(soft?' with softer band':'');
    const pending=current.id!==this.requestId;
    const text=this.requestError||(!this.scheduler.isPlaying?(pending?'Stopped. Press Play to hear your next tune.':'Stopped. Press Play to hear this tune.'):
      !realized?(state?.scheduledId==null?`Next: ${label(this.position,this.bandBalance)}. Your tune will join soon.`:`Starting: ${label(this.position,this.bandBalance)}.`):
      pending?`Playing: ${label(current.position,current.bandBalance)}. Next: ${label(this.position,this.bandBalance)}.`:
      `Playing: ${label(current.position,current.bandBalance)}.`);
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
        this.root.querySelector(`[data-key="${key}"]`)?.setAttribute('aria-disabled',String(!readiness.ok));
      if(!readiness.ok&&!this.loadingSaveShown){
        const more=this.root.querySelector('.pf-melody-keep-more');if(more)more.open=true;
        this.loadingSaveShown=true;
      }
      if(help)help.textContent=!readiness.ok?readiness.message:pending?`${realized?'Keep saves the last tune you heard.':'Keep saves your first tune.'} ${nextHelp}`:'Keep saves this tune. Your first tune stays safe.';
    }
    const original=this.root.querySelector('[data-key="melody-field-original"]');if(original)original.textContent=this.comparisonPosition?'New melody':'Original';
    const button=this.root.querySelector('[data-key="melody-field-play"]');if(button)button.textContent=this.scheduler.isPlaying?'Stop':'Play';
    if(!this.scheduler.isPlaying)this.exploring=null;
    const explore=this.root.querySelector('[data-key="melody-field-explore"]');
    if(explore){explore.textContent=this.exploring?'Stay here':'Explore';explore.disabled=!this.scheduler.isPlaying;explore.setAttribute('aria-pressed',String(Boolean(this.exploring)));}
    const svg=this.root.querySelector('[data-mf-score]');if(!svg)return;
    const originCandidate=this._candidate({x:0,y:0},this.initialBandBalance);
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
