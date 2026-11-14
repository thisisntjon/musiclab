// Bass wheel clarity (14 Nov 2026, owner: "I am unable to click the bass button and it does not feel clear").
// 1. Feel the bass is never disabled because of the band's style: on a style without the Bass wheel, one press moves the
//    band to the closest bass-ready style on the genre circle (as a pick on the circle would, one Jam Undo step) and
//    opens the Bass wheel when that band plays. Only a kept band of its own keeps the card off.
// 2. Inside the wheel: a legend and ring words for the sizes, every way's hint in words on screen, and a Hear bass clearly
//    toggle (bass and beat full, tune and chords softer) that ends on leaving the Bass wheel and never reaches a song.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CIRCLE_GROUPS,CIRCLE_SCENES,circlePosition,circleNearest} from '../../../static/js/theory/music_circle.js';
import {SCENE_CATALOGUE} from '../../../static/js/theory/scene_catalogue.js';
import {BASS_WHEEL_SCENES,BASS_WAYS,BASS_SIZES,BASS_MOVES,BASS_BAND,bassAdmission} from '../../../static/js/theory/bass_wheel.js';
import {PlayFlow,BASS_CARD_WORDS,bassStyleFor,wheelEntryWords,circleWord} from '../../../static/ui/stages/play_flow.js';
import {MelodyFieldSession,BASS_LEGEND,BASS_SPOTLIGHT,bassSay,bassWayHint,bassWayLabel} from '../../../static/ui/melody_field_session.js';
import {LookaheadScheduler,roleMatchesLayer} from '../../../static/js/audio/scheduler.js';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v9.js';
import {phraseContext as docPhraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';
import {jamScore} from '../theory/bass-wheel-fixtures.mjs';

// The card names a style by the word the circle shows for its group (bass-wheel-clarity-review.test.mjs).
const nameOf=id=>circleWord(id);
// A style name is read as one word, as the plain-language test reads every interpolated name.
const grade2=texts=>[...new Set(texts)].map(t=>({t,r:checkPrompt(t)})).filter(x=>!x.r.ok).map(x=>`${x.t} -> ${JSON.stringify(x.r.problems)}`);
const asWord=(text,name)=>text.split(name).join('it');

// ---- The closest bass-ready style ----
/** Where a scene sits round the circle, measured from its drawn place (not from the module's own sums). */
const turnOf=id=>{const p=circlePosition(id);return ((Math.atan2(p.y-.5,p.x-.5)/(2*Math.PI)+.25)%1+1)%1;};
const gapOf=(a,b)=>{const d=Math.abs(turnOf(a)-turnOf(b))%1;return Math.min(d,1-d);};

test('every one of the 78 styles maps to the nearest bass-ready style round the circle, the same way every time',()=>{
  assert.equal(CIRCLE_SCENES.length,78);
  const counts={};
  for(const id of CIRCLE_SCENES) {
    const to=bassStyleFor(id);
    assert.ok(BASS_WHEEL_SCENES.includes(to),`${id} -> ${to} is a bass-ready style`);
    assert.equal(bassStyleFor(id),to,`${id}: deterministic`);
    assert.equal(circleNearest(id,[...BASS_WHEEL_SCENES].reverse()),to,`${id}: the order of the list does not matter`);
    const best=Math.min(...BASS_WHEEL_SCENES.map(b=>gapOf(id,b)));
    assert.ok(gapOf(id,to)<=best+1e-9,`${id} -> ${to} is the nearest (${gapOf(id,to)} vs ${best})`);
    // A tie goes to the first of the tied styles in circle order.
    const tied=CIRCLE_SCENES.filter(b=>BASS_WHEEL_SCENES.includes(b)&&Math.abs(gapOf(id,b)-best)<1e-9);
    assert.equal(to,tied[0],`${id}: tie-break`);
    counts[to]=(counts[to]||0)+1;
  }
  for(const id of BASS_WHEEL_SCENES)assert.equal(bassStyleFor(id),id,'a bass-ready style stays where it is');
  assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),78);
  // Examples a person can check on the circle: Blues sits next to Jazz, Hip-hop next to Reggae, Metal wraps to House.
  assert.equal(bassStyleFor('delta-blues-v1'),'swing-v1');
  assert.equal(bassStyleFor('hip-hop-v1'),'reggae-v1');
  assert.equal(bassStyleFor('heavy-metal-v1'),'house-v1');
  assert.equal(bassStyleFor('deep-house-v1'),'house-v1');
  assert.equal(circleNearest('nope',BASS_WHEEL_SCENES),null);
  assert.equal(circleNearest('house-v1',[]),null);
  // A tie on an even circle goes to the first in circle order.
  const g=CIRCLE_GROUPS.find(x=>x.sceneIds.length===3).sceneIds;
  assert.equal(circleNearest(g[1],[g[2],g[0]]),g[0]);
});

test('each style the card moves to really opens the Bass wheel over its own band',()=>{
  for(const id of new Set(CIRCLE_SCENES.map(bassStyleFor))) {
    const {context}=jamScore(id);
    const a=bassAdmission(context,context.source.events);
    assert.equal(a.ok,true,`${id}: ${a.reason}`);
  }
});

// ---- The Jam card ----
function baseFlow() {
  globalThis.window={localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},scrollTo(){}};
  const flow=Object.create(PlayFlow.prototype);
  flow.root={querySelector:()=>null,querySelectorAll:()=>[]};
  const said=[];
  flow.app={scheduler:{isPlaying:false,stopGeneration:0,spotlightRole:null,audioCtx:{currentTime:0},setCompiledSong(){},setLoopRange(){},setRepeatPlayback(){},clearMuteLayers(){},
    setSpotlightRole(r){this.spotlightRole=r||null;},unlock:async()=>{},previewSound(){},stop(){},start(){},capturePerformance:()=>null,activeJamBacking:()=>null,
    queueContinuousPartAudition:()=>({ok:true}),getPartAuditionState:()=>null,masterBus:{piano:{},disposed:false}},
    _announce(text){said.push(flow.takeNotice(text));},_logSessionEvent(){}};
  flow.render=()=>{};flow._sparkAt=()=>{};flow.stage='start';flow.trail=[];flow.confirm={};flow._freshState();
  flow.stage='jam';
  return {flow,said};
}
function jamFlow(scene) {
  const {flow,said}=baseFlow();
  flow._acceptJamDoc(startJam(flow.doc,{kind:'pitched',patchId:'warm_keys'}));
  Object.assign(flow.doc.jam_session,{showcase_version:1,exploration_map:'catalogue-circle-v2',scene_id:scene});
  flow._compile();
  return {flow,said};
}
const card=html=>html.match(/<div class="pf-wheel-option"><button[^>]*data-key="melody-field-enter-bass"[^>]*>[^<]*<\/button><p class="pf-wheel-caption" id="pf-wheel-cap-bass">([^<]*)<\/p><\/div>/);
const press=(flow,key)=>flow._onClick({target:{closest:()=>({dataset:{key},focus(){}})}});
function stripDetails(html){let s=html,prev='';while(s!==prev){prev=s;s=s.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi,m=>m.match(/<summary\b[^>]*>[\s\S]*?<\/summary>/i)?.[0]||'');}return s;}
const scanStops=html=>{const top=stripDetails(html);return (top.match(/<(button|summary|select|input|a)\b[^>]*>/gi)||[]).length+(top.match(/tabindex="0"/gi)||[]).length;};

test('Feel the bass is pressable on every one of the 78 styles, and its caption says what one press does',()=>{
  const {flow}=jamFlow('house-v1');
  for(const id of CIRCLE_SCENES) {
    flow.doc.jam_session.scene_id=id;
    const html=flow._renderJam(),c=card(html);
    assert.ok(c,`${id}: the card`);
    assert.doesNotMatch(c[0],/ disabled/,`${id}: never disabled because of the style`);
    const want=BASS_WHEEL_SCENES.includes(id)?'Bass wheel. Pick how the bass moves.':`Bass wheel. Moves to ${nameOf(bassStyleFor(id))} to start.`;
    assert.equal(c[1],want,id);
    assert.ok(scanStops(html)<=35,`${id}: scan stops ${scanStops(html)}`);
  }
  assert.equal(BASS_CARD_WORDS.ready,'Bass wheel. Pick how the bass moves.');
  assert.equal(BASS_CARD_WORDS.move('Jazz'),'Bass wheel. Moves to Jazz to start.');
  assert.equal(BASS_CARD_WORDS.moving('Jazz'),'Going to Jazz for the bass. Undo goes back.');
});

test('only a kept band of its own keeps the card off, and it says so',()=>{
  const {flow}=jamFlow('hip-hop-v1');
  flow.doc.jam_session.anchor_backing={version:1,notes:[]};
  const c=card(flow._renderJam());
  assert.match(c[0],/ disabled/);
  assert.equal(c[1],'Bass wheel. Not for a kept band.');
});

test('the caption follows the circle as it moves, in place',()=>{
  const {flow}=jamFlow('house-v1');
  const el={disabled:false},caption={textContent:BASS_CARD_WORDS.ready},coverage={textContent:''};
  const parts={'[data-melody-entry-coverage]':coverage,'[data-key="melody-field-enter-bass"]':el,'#pf-wheel-cap-bass':caption};
  flow.root={querySelector:sel=>parts[sel]||null,querySelectorAll:()=>[]};
  // A drag that is still on its way counts: the caption names where the press would go from the dot's style.
  flow.circleIntent={id:'heavy-metal-v1',field:null,song:flow.doc.id,stop:0};
  flow._paintCircle();
  assert.equal(el.disabled,false);assert.equal(caption.textContent,`Bass wheel. Moves to ${nameOf('house-v1')} to start.`);
  flow.circleIntent={id:'delta-blues-v1',field:null,song:flow.doc.id,stop:0};
  flow._paintCircle();
  assert.equal(caption.textContent,`Bass wheel. Moves to ${nameOf('swing-v1')} to start.`);
  flow.circleIntent=null;
  flow._paintCircle();
  assert.equal(caption.textContent,BASS_CARD_WORDS.ready);
  flow.doc.jam_session.anchor_backing={version:1,notes:[]};
  flow._paintCircle();
  assert.equal(el.disabled,true);assert.equal(caption.textContent,BASS_CARD_WORDS.kept);
});

test('one press on a style without the Bass wheel moves the band as a circle pick would; Undo takes it back',async()=>{
  const {flow,said}=jamFlow('hip-hop-v1');
  const entered=[];flow._enterMelodyField=opts=>{entered.push(opts);return Promise.resolve();};
  const undo=flow.undoStack.length;
  await press(flow,'melody-field-enter-bass');
  assert.equal(flow.doc.jam_session.scene_id,'reggae-v1','the closest bass-ready style');
  // The scored Ska / Rocksteady / Reggae arc puts the ring on Reggae's own point, as a pick on the circle does.
  assert.deepEqual(flow.doc.jam_session.music_field,{version:5,x:1,y:.5});
  assert.equal(flow.circleIntent,null,'the pick is made, not left as a drag');
  assert.equal(flow.undoStack.length,undo+1,'one Jam Undo step');
  assert.deepEqual(said,[BASS_CARD_WORDS.moving(nameOf('reggae-v1'))]);
  assert.equal(entered.length,1);assert.equal(entered[0].wheel,'bass');assert.equal(entered[0].said,true,'the wheel does not say a second starting line');
  flow._undo();
  assert.equal(flow.doc.jam_session.scene_id,'hip-hop-v1','Undo goes back to the style before');
  assert.equal(flow.doc.jam_session.music_field,undefined);
  // On a bass-ready style the press opens the wheel as before: nothing moves and nothing extra is said.
  const ready=jamFlow('house-v1');ready.flow._enterMelodyField=opts=>{entered.push(opts);return Promise.resolve();};
  await press(ready.flow,'melody-field-enter-bass');
  assert.equal(ready.flow.doc.jam_session.scene_id,'house-v1');assert.deepEqual(ready.said,[]);
  assert.equal(entered.at(-1).wheel,'bass');assert.notEqual(entered.at(-1).said,true);
  // A kept band never moves (its card is off; a stray press is refused by the wheel itself, as before).
  const kept=jamFlow('hip-hop-v1');kept.flow.doc.jam_session.anchor_backing={version:1,notes:[]};
  kept.flow._enterMelodyField=opts=>{entered.push(opts);return Promise.resolve();};
  const undoKept=kept.flow.undoStack.length;
  await press(kept.flow,'melody-field-enter-bass');
  assert.equal(kept.flow.doc.jam_session.scene_id,'hip-hop-v1');assert.equal(kept.flow.undoStack.length,undoKept);assert.deepEqual(kept.said,[]);
});

test('on the six-style slider the press goes back to the circle on the closest style, in one Undo step',async()=>{
  const {flow,said}=jamFlow('house-v1');
  flow._acceptJamDoc(setJamDirection(flow.doc,{music_field:{version:4,x:.9,y:.5}}));
  assert.equal(flow.doc.jam_session.exploration_map,undefined);
  const from=flow.doc.jam_session.scene_id,c=card(flow._renderJam());
  assert.doesNotMatch(c[0],/ disabled/);
  assert.equal(c[1],`Bass wheel. Moves to ${nameOf(bassStyleFor(from))} to start.`);
  flow._enterMelodyField=()=>Promise.resolve();
  const undo=flow.undoStack.length;
  await press(flow,'melody-field-enter-bass');
  assert.equal(flow.doc.jam_session.exploration_map,'catalogue-circle-v2');
  assert.equal(flow.doc.jam_session.scene_id,bassStyleFor(from));
  assert.equal(flow.undoStack.length,undo+1);
  assert.deepEqual(said,[BASS_CARD_WORDS.moving(nameOf(bassStyleFor(from)))]);
  flow._undo();
  assert.equal(flow.doc.jam_session.music_field.version,4,'Undo brings the slider back');
});

/** A playing Jam on a real band, captured as _enterMelodyField reads it; land(doc) brings in the band of that doc. */
function playingFlow(startScene) {
  const {flow,said}=baseFlow();
  const start=jamScore(startScene);
  flow.doc=structuredClone(start.doc);flow.doc.jam_session.exploration_map='catalogue-circle-v2';flow.stage='jam';
  const band=(doc,song)=>({song,backing:{events:structuredClone(song.events.filter(e=>e.provenance==='jam_generated')),phraseContext:docPhraseContext(doc)},
    capture:{source_song_id:doc.id,bpm:song.bpm,start:0,end:song.total_steps*15/song.bpm,bars:4,steps_per_bar:16,
      events:song.events.filter(e=>e.role==='bass').slice(0,3).map((event,occurrence)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence}))}});
  let now=band(start.doc,start.song);
  const s=flow.app.scheduler;
  Object.defineProperty(s,'compiledSong',{get:()=>now.song,configurable:true});
  Object.assign(s,{isPlaying:true,gridOriginTime:0,activeJamBacking:()=>now.backing,capturePerformance:()=>now.capture});
  return {flow,said,land:score=>{now=band(score.doc,score.song);}};
}

test('from Blues, one press moves to Small-group swing and the Bass wheel opens once that band plays',async()=>{
  const {flow,said,land}=playingFlow('delta-blues-v1');
  assert.equal(card(flow._renderJam())[1],`Bass wheel. Moves to ${nameOf('swing-v1')} to start.`);
  const realPrepare=MelodyFieldSession.prototype.prepare,realSetTimeout=globalThis.setTimeout;
  MelodyFieldSession.prototype.prepare=async function(){this.palette=buildMelodyPalette(this.phraseContext);this.candidates.clear();this.requestId=this._candidate(this.position).id;};
  let waits=0;
  // The band joins at its boundary: until then the wheel waits, then it opens over the new band.
  globalThis.setTimeout=(cb,ms)=>{if(ms===100&&++waits===2)land(jamScore('swing-v1'));return realSetTimeout(cb,0);};
  try {
    const opened=press(flow,'melody-field-enter-bass');
    assert.equal(flow.doc.jam_session.scene_id,'swing-v1','the band moves on the press');
    assert.equal(flow._pickedBandPending(),true,'the old band still plays');
    assert.equal(card(flow._renderJam())[1],BASS_CARD_WORDS.going(nameOf('swing-v1')),'the card says where the band is going while it waits');
    await opened;
  } finally {MelodyFieldSession.prototype.prepare=realPrepare;globalThis.setTimeout=realSetTimeout;}
  assert.ok(waits>=2,'it waited for the band');
  assert.ok(flow.melodyField,'the wheel opened');
  assert.equal(flow.melodyField.wheel,'bass');
  assert.equal(flow.melodyField.bassCtx.sceneId,'swing-v1','over the new band');
  assert.deepEqual(said,[BASS_CARD_WORDS.moving(nameOf('swing-v1'))]);
  assert.ok(!said.includes(wheelEntryWords('bass').starting));
});

test('Undo while the new band is on its way takes the move back and the wheel does not open',async()=>{
  const {flow,said}=playingFlow('delta-blues-v1');
  const realPrepare=MelodyFieldSession.prototype.prepare,realSetTimeout=globalThis.setTimeout;
  MelodyFieldSession.prototype.prepare=async function(){this.palette=buildMelodyPalette(this.phraseContext);this.candidates.clear();this.requestId=this._candidate(this.position).id;};
  let waits=0;
  globalThis.setTimeout=(cb,ms)=>{if(ms===100&&++waits===1)flow._undo();return realSetTimeout(cb,0);};
  try{await press(flow,'melody-field-enter-bass');}
  finally{MelodyFieldSession.prototype.prepare=realPrepare;globalThis.setTimeout=realSetTimeout;}
  assert.equal(flow.doc.jam_session.scene_id,'delta-blues-v1','Undo went back to Blues');
  assert.ok(!flow.melodyField,'no wheel over the old band');
  assert.deepEqual(said,[BASS_CARD_WORDS.moving(nameOf('swing-v1')),'Undone.'],'and no not-ready line after Undo');
});

test('every card caption and press line reads at grade 2',()=>{
  const texts=[BASS_CARD_WORDS.ready,BASS_CARD_WORDS.kept,BASS_CARD_WORDS.off];
  for(const id of BASS_WHEEL_SCENES) {
    const n=nameOf(id);
    texts.push(asWord(BASS_CARD_WORDS.move(n),n),asWord(BASS_CARD_WORDS.moving(n),n));
    assert.ok(BASS_CARD_WORDS.move(n).includes(n)&&BASS_CARD_WORDS.moving(n).includes(n),'the style is named as the app names it');
  }
  assert.deepEqual(grade2(texts),[]);
});

// ---- Inside the Bass wheel ----
const PALETTES=new Map();
function session(scene='house-v1') {
  const score=jamScore(scene);
  const scheduler={queued:[],isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,loadingSession:null,audition:null,
    getPartAuditionState(){return this.audition;},setSpotlightRole(r){this.spotlightRole=r||null;},
    queueContinuousPartAudition(_v,opts){this.queued.push(opts);return {ok:true};}};
  const field=new MelodyFieldSession(score.song,{scheduler,captureOrigin:0,sourceDoc:score.doc,phraseContext:score.context});
  if(!PALETTES.has(scene))PALETTES.set(scene,buildMelodyPalette(score.context));
  field.palette=PALETTES.get(scene);
  field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return {field,scheduler,score};
}
const hear=(field,scheduler)=>{scheduler.audition={sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId};field.realizedId=field.requestId;};

/** Enough DOM for paint(): the status, the legend line and its two parts, the focus toggle and the disk's way buttons. */
function mount(field) {
  const node=(attrs={})=>({textContent:'',hidden:false,attrs,setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},
    hasAttribute(k){return Object.hasOwn(this.attrs,k);},removeAttribute(k){delete this.attrs[k];}});
  const ways=BASS_WAYS.map((w,i)=>({...node({'data-key':`melody-field-bass-${i}`,'data-bass-way':w.id}),querySelector:()=>null}));
  const disk={classList:{contains:c=>c==='pf-bass-disk'},querySelectorAll:sel=>sel==='[data-bass-way]'||sel==='[data-key]'?ways:[],querySelector:()=>null,
    addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:300,height:300}),setPointerCapture(){},contains:()=>false};
  const parts={status:node(),legend:node(),peek:node({'aria-hidden':'true'}),focus:Object.assign(node({'aria-pressed':'false'}),{textContent:'Hear bass clearly'})};
  const map={'[data-melody-disk]':disk,'[data-mf-status]':parts.status,'[data-bass-legend-text]':parts.legend,'[data-bass-peek]':parts.peek,'[data-key="melody-field-bass-focus"]':parts.focus};
  field.root={querySelector:sel=>map[sel]||null,querySelectorAll:()=>[]};
  return {parts,ways};
}

test('the Bass wheel shows a legend and ring words for Light, Full and Big, in the picture and not as stops',()=>{
  const {field}=session('house-v1');field.setWheel('bass');
  const html=field.html();
  assert.equal(BASS_LEGEND,'Near the middle: light. At the edge: big.');
  const line=html.match(/<p class="pf-sub pf-bass-legend" data-mf-bass-legend><span data-bass-legend-text>([^<]*)<\/span><span data-bass-peek aria-hidden="true" hidden><\/span><\/p>/);
  assert.ok(line,'one legend line under the disk, with room for a way\'s hint');
  assert.equal(line[1],BASS_LEGEND);
  assert.ok(html.indexOf('data-mf-bass-legend')>html.indexOf('data-bass-disk')&&html.indexOf('data-mf-bass-legend')<html.indexOf('data-mf-status'),'under the disk, above the status');
  const disk=html.match(/<div class="pf-melody-disk pf-bass-disk"[\s\S]*?<\/div><p class="pf-sub pf-bass-legend"/)[0];
  const words=[...disk.matchAll(/<span class="pf-bass-ring-word" data-ring-word="([a-z]+)" aria-hidden="true" style="left:([\d.]+)%;top:50%">([A-Za-z]+)<\/span>/g)];
  assert.deepEqual(words.map(m=>[m[1],m[3]]),BASS_SIZES.map(s=>[s.id,s.label]),'Light, Full and Big from the middle out');
  const lefts=words.map(m=>Number(m[2]));
  assert.ok(lefts.every((x,i)=>i===0||x>lefts[i-1]),'they go out from the middle');
  assert.ok(lefts.every(x=>x>50&&x<100),'on the spoke to the right, between Steady and Walk');
  assert.doesNotMatch(disk.match(/<span class="pf-bass-ring-word"[\s\S]*?<\/span>/g).join(''),/tabindex|data-key/);
  // Not in the Tune or Sound wheel.
  field.setWheel('tune');assert.doesNotMatch(field.html(),/pf-bass-legend|pf-bass-ring-word|melody-field-bass-focus/);
  field.setWheel('sound');assert.doesNotMatch(field.html(),/pf-bass-legend|pf-bass-ring-word|melody-field-bass-focus/);
});

test('the status names the way, its size and what it does; a way that is not playing shows its hint before it plays',()=>{
  const {field,scheduler}=session('house-v1');field.setWheel('bass');
  const {parts}=mount(field);
  hear(field,scheduler);field.paint();
  assert.equal(parts.status.textContent,'Playing: Band bass.');
  // Way and size in two short sentences: 'Funky bass, big' in one reads above grade 2.
  assert.equal(bassSay('funky-big'),'Funky bass. It is big');
  field.selectBass('funky-big');field.paint();
  assert.equal(parts.status.textContent,`Playing: Band bass. Next: Funky bass. It is big. ${bassWayHint('funky')}`);
  hear(field,scheduler);field.paint();
  assert.equal(parts.status.textContent,`Playing: Funky bass. It is big. ${bassWayHint('funky')}`);
  assert.equal(parts.status.textContent,'Playing: Funky bass. It is big. Short notes with gaps.');
  // Focus or the pointer on another way shows what that way does, on screen, before it plays.
  assert.equal(parts.peek.hidden,true);assert.equal(parts.legend.hidden,false);
  field.peekBass('chill');
  assert.equal(parts.peek.hidden,false);assert.equal(parts.legend.hidden,true);
  assert.equal(parts.peek.textContent,bassWayLabel('chill'));
  assert.equal(parts.peek.getAttribute('aria-hidden'),'true','screen readers already hear it in the button\'s name');
  assert.equal(parts.status.textContent,`Playing: Funky bass. It is big. ${bassWayHint('funky')}`,'the live status does not change on focus');
  field.peekBass('funky');
  assert.equal(parts.peek.hidden,true,'the chosen way\'s hint is already in the status');assert.equal(parts.legend.hidden,false);
  field.peekBass('walk');field.peekBass(null);
  assert.equal(parts.peek.hidden,true);assert.equal(parts.legend.textContent===''||parts.legend.hidden===false,true);
  field.peekBass('bogus');assert.equal(parts.peek.hidden,true);
});

test('six way hints and every status line read at grade 2',()=>{
  const hints=BASS_WAYS.map(w=>bassWayHint(w.id));
  assert.equal(new Set(hints).size,6,'six different hints');
  assert.equal(bassWayHint('steady'),'Plays with the beat.');
  for(const h of hints)assert.ok(h.split(/\s+/).length<=5&&/\.$/.test(h),`${h}: short, one sentence`);
  for(const w of BASS_WAYS)assert.ok(bassWayLabel(w.id).endsWith(bassWayHint(w.id)),'the spoken name and the shown hint are the same words');
  const texts=[BASS_LEGEND,'Hear bass clearly',...hints];
  for(const move of [...BASS_MOVES,'kept']) {
    const hint=BASS_MOVES.includes(move)&&move!==BASS_BAND?` ${bassWayHint(move.split('-')[0])}`:'';
    texts.push(`Playing: ${bassSay(move)}.${hint}`,`Starting: ${bassSay(move)}.${hint}`,`Playing: ${bassSay(move)}.${hint} Your next change joins soon.`);
    for(const next of BASS_MOVES)texts.push(`Playing: ${bassSay(move)}. Next: ${bassSay(next)}.${next===BASS_BAND?'':` ${bassWayHint(next.split('-')[0])}`}`);
  }
  for(const w of BASS_WAYS)texts.push(bassWayLabel(w.id));
  assert.deepEqual(grade2(texts),[]);
});

test('Hear bass clearly: a pressed toggle in the bass toolbar; bass and beat stay full, tune and chords go softer',()=>{
  const {field,scheduler}=session('soul-v1');field.setWheel('bass');
  assert.equal(BASS_SPOTLIGHT,'bass-beat');
  let html=field.html();
  const toolbar=html.match(/<div class="pf-row"><button class="pf-btn pf-play" data-key="melody-field-play">[\s\S]*?<\/div>/)[0];
  assert.match(toolbar,/<button class="pf-btn" data-key="melody-field-bass-focus" aria-pressed="false">Hear bass clearly<\/button>/);
  const {parts}=mount(field);
  assert.equal(field.toggleBassFocus(),true);
  assert.equal(scheduler.spotlightRole,BASS_SPOTLIGHT);
  assert.equal(parts.focus.getAttribute('aria-pressed'),'true');assert.equal(parts.focus.textContent,'Hear full band','while on it names how to turn it off, as the Tune wheel\'s twin does');
  assert.match(field.html(),/data-key="melody-field-bass-focus" aria-pressed="true">Hear full band</);
  field.toggleBassFocus();
  assert.equal(scheduler.spotlightRole,null);assert.equal(parts.focus.getAttribute('aria-pressed'),'false');
  // What the scheduler dims: every role but bass and drums.
  for(const [role,full] of [['bass',true],['drums',true],['lead',false],['harmony',false],['hocket',false],['fx',false]])
    assert.equal(roleMatchesLayer(role,BASS_SPOTLIGHT),full,role);
  // Not on the Tune wheel; and on the Tune wheel Hear tune clearly is untouched by it.
  field.setWheel('tune');assert.equal(field.toggleBassFocus(),false);assert.equal(scheduler.spotlightRole,null);
});

test('Hear bass clearly ends on leaving the Bass tab or the wheel, and never reaches the saved song',async()=>{
  for(const wheel of ['tune','sound']) {
    const {field,scheduler}=session('house-v1');field.setWheel('bass');field.toggleBassFocus();
    assert.equal(scheduler.spotlightRole,BASS_SPOTLIGHT);
    field.setWheel(wheel);
    assert.equal(scheduler.spotlightRole,null,`the ${wheel} tab ends it`);
  }
  // Hear tune clearly on the Tune wheel is left alone by the Sound tab, as before.
  {const {field,scheduler}=session('house-v1');scheduler.spotlightRole='tune';field.setWheel('sound');assert.equal(scheduler.spotlightRole,'tune');}
  // The play flow's button and leaving the wheel.
  const {flow}=baseFlow();
  const {field,scheduler}=session('house-v1');field.setWheel('bass');
  flow.app.scheduler=Object.assign(scheduler,{clearMuteLayers(){},setLoopRange(){},setRepeatPlayback(){},setCompiledSong(){},stop(){}});
  flow.melodyField=field;flow.doc=structuredClone(jamScore('house-v1').doc);flow.stage='jam';
  await flow._melodyFieldAction('melody-field-bass-focus');
  assert.equal(scheduler.spotlightRole,BASS_SPOTLIGHT);
  await flow._melodyFieldAction('melody-field-bass-focus');
  assert.equal(scheduler.spotlightRole,null);
  await flow._melodyFieldAction('melody-field-bass-focus');
  flow._go('jam');
  assert.equal(scheduler.spotlightRole,null,'Back to jam ends it');
  // The candidate Keep saves is the same with the spotlight on or off: it is only a way of listening.
  const a=session('house-v1'),b=session('house-v1');
  for(const s of [a,b]){s.field.setWheel('bass');s.field.selectBass('walk-big');hear(s.field,s.scheduler);}
  b.field.toggleBassFocus();
  assert.deepEqual(b.field.bassSave(b.field.candidates.get(b.field.realizedId)),a.field.bassSave(a.field.candidates.get(a.field.realizedId)));
  assert.deepEqual(b.field.candidates.get(b.field.realizedId).song.events,a.field.candidates.get(a.field.realizedId).song.events);
});

// ---- The scheduler: what is heard, and what a take keeps ----
function fakeParam(){return {value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}};}
function fakeNode(name){const node={name,connect(d){return d;},disconnect(){},start(){},stop(){}};return new Proxy(node,{get(t,k){if(!(k in t)&&typeof k==='string')t[k]=fakeParam();return t[k];}});}
function fakeContext(){const ctx={currentTime:0,sampleRate:1000,state:'running',destination:fakeNode('speaker'),createBuffer:(_c,l)=>({getChannelData:()=>new Float32Array(l)})};
  for(const k of ['Gain','Oscillator','BiquadFilter','WaveShaper','Convolver','DynamicsCompressor','Analyser','BufferSource','StereoPanner'])ctx[`create${k}`]=()=>fakeNode(k);return ctx;}

function playSteps(role) {
  globalThis.window=globalThis.window||{};globalThis.window.setInterval=()=>1;globalThis.window.clearInterval=()=>{};
  const song={bpm:100,swing:.5,total_steps:16,total_duration_sec:2.4,steps_per_bar:16,
    events:Array.from({length:16},(_,step)=>['drums','bass','harmony','lead'].map(r=>({id:`n-${r}-${step}`,step,role:r,patch_id:r==='drums'?'kick':r==='bass'?'clean_bass':r==='harmony'?'warm_keys':'pluck_lead',
      duration_sec:.1,velocity:.6,provenance:'user_placed',concrete:{midi_pitch:60,freq_hz:261.6}}))).flat()};
  const s=new LookaheadScheduler();s.audioCtx=fakeContext();s.ensureContext();s.setCompiledSong(song);
  s.setSpotlightRole(role);s.start();
  const heard=[];
  for(let i=0;i<6;i++){s.audioCtx.currentTime=s.nextStepAudioTime-.05;s._lookaheadTick();heard.push(...(s.visualQueue.at(-1)?.events||[]));}
  const kept=s.performanceTake.events.map(r=>r.event);s.stop();
  return {heard,kept,level:(list,r)=>[...new Set(list.filter(e=>e.role===r).map(e=>e.velocity))]};
}

test('scheduler: Hear bass clearly softens tune and chords as heard, but a take keeps every note at its own level',()=>{
  const {heard,kept,level}=playSteps(BASS_SPOTLIGHT);
  assert.ok(heard.length>0);
  assert.deepEqual(level(heard,'bass'),[.6]);assert.deepEqual(level(heard,'drums'),[.6]);
  assert.ok(level(heard,'lead').every(v=>v<.6)&&level(heard,'harmony').every(v=>v<.6),'tune and chords are softer while it is on');
  assert.ok(kept.length>0);
  assert.ok(kept.every(e=>e.velocity===.6),'a take keeps the notes as written, never the listening aid');
  // Hear tune clearly keeps its own rule: its take records what was heard (jam_answer.test.mjs, Focus attenuation).
  const tune=playSteps('tune');
  assert.ok(tune.level(tune.kept,'bass').every(v=>v<.6));
});

// ---- Layout rules: CSS ----
function cssBlocks() {
  const all=fs.readFileSync(new URL('../../../static/css/studio.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  const blocks=[];let depth=0,start=0,prelude='';
  for(let i=0;i<all.length;i++){
    if(all[i]==='{'){if(depth===0){prelude=all.slice(start,i).trim();start=i+1;}depth++;}
    else if(all[i]==='}'){depth--;if(depth===0){blocks.push({prelude,body:all.slice(start,i)});start=i+1;}}
  }
  return blocks;
}

test('CSS: the legend line keeps its room, the ring words are faint and never take pointer input, forced colours restate them',()=>{
  const blocks=cssBlocks();
  const top=sel=>blocks.filter(b=>b.prelude===sel).map(b=>b.body).join(';');
  assert.match(top('.pf-bass-legend'),/min-height:\s*2\.6em/);
  assert.match(top('.pf-bass-legend'),/text-align:\s*center/);
  const word=top('.pf-bass-ring-word');
  assert.match(word,/pointer-events:\s*none/);assert.match(word,/position:\s*absolute/);
  const forced=blocks.filter(b=>/^@media \(forced-colors: active\)/.test(b.prelude)&&/\.pf-bass-sector/.test(b.body));
  assert.equal(forced.length,1,'one forced-colours block for the Bass wheel');
  assert.match(forced[0].body,/\.pf-bass-ring-word\s*\{[^}]*color:\s*CanvasText/);
  assert.doesNotMatch(forced[0].body,/#[0-9a-f]{3,8}\b|rgba?\(/i);
});
