// Bass wheel clarity, fresh-eyes review (14 Nov 2026). The owner: "I am unable to click the bass button and it does not
// feel clear". After the first fix a reviewer found:
// 1. A press from a style without the Bass wheel showed nothing on screen for about 5 s (the words went only to the
//    screen reader). The card now says where the band is going and that the wheel opens soon, carries aria-busy, and the
//    Jam's status line shows the moving words. A second press while it waits says it is on its way.
// 2. Long catalogue names ('Soul instrumental', 'Small-group swing') pushed the words over grade 2. The card and the line
//    use the short word the circle shows (House, Reggae / ska, Soul, Jazz), checked with the real words.
// 3. 'Undo goes back' took two presses after Back to jam. The move and the wheel's result are now one Jam Undo step.
// 4. The way back sat below the fold: the Bass wheel has Back to jam in its top row too, and focus returns to the
//    Feel the bass card.
// 5. A window blur during the wait cancelled the press after the band had moved, silently. It no longer cancels it; if
//    the wheel still cannot open, the Jam says the band moved and to press again.
// 6. Hear bass clearly reads 'Hear full band' while on, and the score fades the tune and chord lanes.
// 7. Ring words are at least 12 px on phones, Light and Big sit off the hub and disk edges, and the legend has a gap.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CIRCLE_GROUPS,CIRCLE_SCENES} from '../../../static/js/theory/music_circle.js';
import {BASS_WHEEL_SCENES} from '../../../static/js/theory/bass_wheel.js';
import {PlayFlow,BASS_CARD_WORDS,bassStyleFor,circleWord,CIRCLE_SHORT} from '../../../static/ui/stages/play_flow.js';
import {MelodyFieldSession,BASS_SPOTLIGHT} from '../../../static/ui/melody_field_session.js';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v9.js';
import {phraseContext as docPhraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {startJam} from '../../../static/js/theory/jam_session.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';
import {jamScore} from '../theory/bass-wheel-fixtures.mjs';

const grade2=texts=>[...new Set(texts)].map(t=>({t,r:checkPrompt(t)})).filter(x=>!x.r.ok).map(x=>`${x.t} -> ${JSON.stringify(x.r.problems)}`);

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
const card=html=>html.match(/<div class="pf-wheel-option"><button([^>]*)data-key="melody-field-enter-bass"([^>]*)>[^<]*<\/button><p class="pf-wheel-caption" id="pf-wheel-cap-bass">([^<]*)<\/p><\/div>/);
const press=(flow,key)=>flow._onClick({target:{closest:()=>({dataset:{key},focus(){}})}});
const fastPrepare=async function(){this.palette=buildMelodyPalette(this.phraseContext);this.candidates.clear();this.requestId=this._candidate(this.position).id;};

/** Press Feel the bass on startScene; at the first wait, during(flow) runs; the band lands at the second wait. */
async function trip(startScene,{during=()=>{},land=true}={}) {
  const t=playingFlow(startScene),target=bassStyleFor(startScene);
  const realPrepare=MelodyFieldSession.prototype.prepare,realSetTimeout=globalThis.setTimeout;
  MelodyFieldSession.prototype.prepare=fastPrepare;
  let waits=0,seen=null;
  globalThis.setTimeout=(cb,ms)=>{if(ms===100){waits++;if(waits===1)seen=during(t.flow);if(waits===2&&land)t.land(jamScore(target));}return realSetTimeout(cb,0);};
  try{await press(t.flow,'melody-field-enter-bass');}
  finally{MelodyFieldSession.prototype.prepare=realPrepare;globalThis.setTimeout=realSetTimeout;}
  return {...t,target,seen};
}

// ---- 1. Something visible happens at once ----
test('while the band is on its way, the card says where it goes and that the wheel opens soon, and is busy',async()=>{
  const {flow,said,seen}=await trip('delta-blues-v1',{during:flow=>{
    const html=flow._renderJam(),c=card(html);
    return {caption:c[3],attrs:c[1]+c[2],html,jamMessage:flow.jamMessage};
  }});
  const going=BASS_CARD_WORDS.going('Jazz');
  assert.equal(going,'Going to Jazz. The bass wheel opens soon.');
  assert.equal(seen.caption,going,'the caption under the card says it at once');
  assert.match(seen.attrs,/aria-busy="true"/,'the card is busy');
  assert.doesNotMatch(seen.attrs,/ disabled/,'and still a real button (a second press is answered)');
  assert.equal(seen.jamMessage,BASS_CARD_WORDS.moving('Jazz'));
  assert.ok(seen.html.includes(`<p role="status" class="pf-sub">${BASS_CARD_WORDS.moving('Jazz')}</p>`),'the Jam status line shows the moving words');
  // The wheel opened: no busy card, no stale line for when the child comes back.
  assert.ok(flow.melodyField,'the wheel opened');
  assert.equal(flow.jamMessage,'');
  assert.equal(flow.bassPreparing,false);
  assert.deepEqual(said,[BASS_CARD_WORDS.moving('Jazz')]);
});

test('the card is busy in place while it waits (the circle repaints it), and a second press says the bass is coming',async()=>{
  const {said,seen}=await trip('heavy-metal-v1',{during:flow=>{
    const el={disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];}},caption={textContent:''};
    const parts={'[data-key="melody-field-enter-bass"]':el,'#pf-wheel-cap-bass':caption};
    const root=flow.root;flow.root={querySelector:sel=>parts[sel]||null,querySelectorAll:()=>[]};
    flow._paintBassCard();
    const busy={caption:caption.textContent,busy:el.attrs['aria-busy']};
    flow._enterBassWheel();
    flow.root=root;
    return busy;
  }});
  assert.deepEqual(seen,{caption:BASS_CARD_WORDS.going('House'),busy:'true'});
  assert.deepEqual(said,[BASS_CARD_WORDS.moving('House'),BASS_CARD_WORDS.coming]);
});

test('a press on a bass-ready style shows a getting-ready caption while it waits for the band',async()=>{
  const {flow,seen}=await trip('house-v1',{during:flow=>card(flow._renderJam())[3]});
  // house-v1 needs no band change, so no 100 ms wait may happen; check the state directly too.
  if(seen!=null)assert.equal(seen,BASS_CARD_WORDS.waiting);
  const {flow:f}=jamFlow('house-v1');
  f.bassPreparing=true;
  const c=card(f._renderJam());
  assert.equal(c[3],BASS_CARD_WORDS.waiting);assert.match(c[1]+c[2],/aria-busy="true"/);
  f.bassPreparing=false;
  assert.doesNotMatch(card(f._renderJam())[1],/aria-busy/);
  assert.ok(flow.melodyField);
});

// ---- 2. Grade 2 with the real words ----
test('the card and the press line use the circle word, and read at grade 2 with the real words',()=>{
  assert.deepEqual(CIRCLE_SHORT.length,CIRCLE_GROUPS.length);
  for(const id of BASS_WHEEL_SCENES)assert.ok(CIRCLE_SHORT.includes(circleWord(id)),`${id}: a word the circle shows`);
  assert.equal(circleWord('swing-v1'),'Jazz');assert.equal(circleWord('house-v1'),'House');assert.equal(circleWord('soul-v1'),'Soul');
  assert.equal(circleWord('reggae-v1'),'Reggae / ska');
  const texts=[BASS_CARD_WORDS.ready,BASS_CARD_WORDS.kept,BASS_CARD_WORDS.off,BASS_CARD_WORDS.waiting,BASS_CARD_WORDS.coming,BASS_CARD_WORDS.missed];
  for(const id of BASS_WHEEL_SCENES) {
    const w=circleWord(id);
    texts.push(BASS_CARD_WORDS.move(w),BASS_CARD_WORDS.moving(w),BASS_CARD_WORDS.going(w));
  }
  assert.deepEqual(grade2(texts),[]);
  // Every style's caption on the Jam is one of those words.
  const {flow}=jamFlow('house-v1');
  for(const id of CIRCLE_SCENES) {
    flow.doc.jam_session.scene_id=id;
    const want=BASS_WHEEL_SCENES.includes(id)?BASS_CARD_WORDS.ready:`Bass wheel. Moves to ${circleWord(bassStyleFor(id))} to start.`;
    assert.equal(card(flow._renderJam())[3],want,id);
  }
  flow.doc.jam_session.scene_id='heavy-metal-v1';
  assert.equal(card(flow._renderJam())[3],'Bass wheel. Moves to House to start.');
});

// ---- 3. One Undo ----
test('after a trip, Back to jam and one Undo bring back the starting style',async()=>{
  const {flow}=await trip('delta-blues-v1');
  const field=flow.melodyField;
  assert.ok(field);assert.equal(flow.doc.jam_session.scene_id,'swing-v1');
  const s=flow.app.scheduler;
  s.getPartAuditionState=()=>({sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId});
  field.hasPlayed=true;
  const depth=flow.undoStack.length;
  await flow._melodyFieldAction('melody-field-back');
  assert.equal(flow.stage,'jam');assert.ok(!flow.melodyField);
  assert.equal(flow.undoStack.length,depth,'the move\'s own step already holds the Jam before the trip');
  flow._undo();
  assert.equal(flow.doc.jam_session.scene_id,'delta-blues-v1','one Undo goes back to the starting style');
  // Without a trip, Back to jam is its own Undo step, as before.
  const ready=await trip('house-v1');
  const f2=ready.flow.melodyField;
  ready.flow.app.scheduler.getPartAuditionState=()=>({sectionId:f2.sectionId,realizedId:f2.requestId,scheduledId:f2.requestId});
  f2.hasPlayed=true;
  const d2=ready.flow.undoStack.length;
  await ready.flow._melodyFieldAction('melody-field-back');
  assert.equal(ready.flow.undoStack.length,d2+1);
});

// ---- 4. The way back ----
test('the Bass wheel has Back to jam in its top row, and leaving puts focus on Feel the bass',async()=>{
  const {flow}=await trip('delta-blues-v1');
  const field=flow.melodyField;
  const html=field.html();
  const toolbar=html.match(/<div class="pf-row"><button class="pf-btn pf-play" data-key="melody-field-play">[\s\S]*?<\/div>/)[0];
  assert.match(toolbar,/<button class="pf-btn" data-key="melody-field-back-top">Back to jam<\/button>/);
  field.setWheel('tune');
  assert.doesNotMatch(field.html(),/melody-field-back-top/,'only the Bass wheel, whose way back sits below the score');
  field.setWheel('bass');
  const s=flow.app.scheduler;
  s.getPartAuditionState=()=>({sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId});
  field.hasPlayed=true;
  let focused=null;
  const cardEl={focus(){focused='card';}};
  flow.root={querySelector:sel=>sel==='[data-key="melody-field-enter-bass"]'?cardEl:null,querySelectorAll:()=>[]};
  await press(flow,'melody-field-back-top');
  assert.equal(flow.stage,'jam');assert.ok(!flow.melodyField);
  assert.equal(focused,'card','keyboard and switch users carry on from the card they pressed');
});

// ---- 5. A blur during the wait ----
test('a window blur while the band is on its way does not cancel the press',async()=>{
  const {flow,said}=await trip('delta-blues-v1',{during:flow=>{flow.liveHolds=new Map();flow._releaseAllLive();}});
  assert.ok(flow.melodyField,'the wheel still opens');
  assert.deepEqual(said,[BASS_CARD_WORDS.moving('Jazz')]);
});

test('if the wheel cannot open after the band moved, the Jam says so on screen',async()=>{
  // The band never lands: the wait runs out and the wheel does not open.
  const realSetTimeout=globalThis.setTimeout;
  const t=playingFlow('delta-blues-v1');
  globalThis.setTimeout=(cb)=>realSetTimeout(cb,0);
  try{await press(t.flow,'melody-field-enter-bass');}finally{globalThis.setTimeout=realSetTimeout;}
  assert.ok(!t.flow.melodyField);
  assert.equal(t.flow.doc.jam_session.scene_id,'swing-v1');
  assert.equal(t.flow.jamMessage,BASS_CARD_WORDS.missed);
  assert.equal(t.flow.bassPreparing,false);
  assert.equal(card(t.flow._renderJam())[3],BASS_CARD_WORDS.ready,'the card is ready again');
  // An Undo while waiting leaves no line behind (Undo said its own word).
  const u=await trip('delta-blues-v1',{during:flow=>flow._undo(),land:false});
  assert.equal(u.flow.doc.jam_session.scene_id,'delta-blues-v1');assert.equal(u.flow.jamMessage,'');
});

// ---- 6. Hear bass clearly shows it is on, and how to turn it off ----
test('Hear bass clearly reads Hear full band while on, and the score fades the tune and chords',()=>{
  const score=jamScore('house-v1');
  const scheduler={queued:[],isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,loadingSession:null,audition:null,
    getPartAuditionState(){return this.audition;},setSpotlightRole(r){this.spotlightRole=r||null;},queueContinuousPartAudition(_v,o){this.queued.push(o);return {ok:true};}};
  const field=new MelodyFieldSession(score.song,{scheduler,captureOrigin:0,sourceDoc:score.doc,phraseContext:score.context});
  field.palette=buildMelodyPalette(score.context);field.candidates.clear();field.requestId=field._candidate(field.position).id;
  field.setWheel('bass');
  const node=(attrs={})=>({textContent:'',hidden:false,attrs,setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},hasAttribute(k){return Object.hasOwn(this.attrs,k);}});
  const focus=Object.assign(node({'aria-pressed':'false'}),{textContent:'Hear bass clearly'}),svg=node();
  const map={'[data-key="melody-field-bass-focus"]':focus,'[data-mf-score]':svg,'[data-mf-status]':node(),'[data-bass-legend-text]':node(),'[data-bass-peek]':node()};
  field.root={querySelector:sel=>map[sel]||null,querySelectorAll:()=>[]};
  field.toggleBassFocus();
  assert.equal(scheduler.spotlightRole,BASS_SPOTLIGHT);
  assert.equal(focus.textContent,'Hear full band');assert.equal(focus.getAttribute('aria-pressed'),'true');
  assert.equal(svg.getAttribute('data-spotlight'),'bass');
  assert.match(field.html(),/data-key="melody-field-bass-focus" aria-pressed="true">Hear full band</);
  field.toggleBassFocus();
  assert.equal(focus.textContent,'Hear bass clearly');assert.equal(svg.getAttribute('data-spotlight'),null);
});

// ---- 7. Layout ----
function cssBlocks() {
  const all=fs.readFileSync(new URL('../../../static/css/studio.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  const blocks=[];let depth=0,start=0,prelude='';
  for(let i=0;i<all.length;i++){
    if(all[i]==='{'){if(depth===0){prelude=all.slice(start,i).trim();start=i+1;}depth++;}
    else if(all[i]==='}'){depth--;if(depth===0){blocks.push({prelude,body:all.slice(start,i)});start=i+1;}}
  }
  return blocks;
}
test('CSS: ring words at least 12 px, a gap under the legend, faded lanes with a forced-colours form',()=>{
  const blocks=cssBlocks(),top=sel=>blocks.filter(b=>b.prelude===sel).map(b=>b.body).join(';');
  const size=Number(top('.pf-bass-ring-word').match(/font-size:\s*([\d.]+)rem/)[1]);
  assert.ok(size*16>=12,`ring words ${size*16}px`);
  const margin=top('.pf-bass-legend').match(/margin:\s*([^;]+)/)[1].trim().split(/\s+/);
  assert.ok(parseFloat(margin[2])>=.4,'a gap before the status line');
  const fade=blocks.filter(b=>b.prelude.includes('[data-spotlight="bass"]'));
  assert.ok(fade.some(b=>b.prelude.includes('[data-vis-lead]')&&/opacity/.test(b.body)),'the tune lane fades');
  assert.ok(fade.some(b=>b.prelude.includes('pf-part-chords')&&/opacity/.test(b.body)),'the chord lane fades');
  const forced=blocks.filter(b=>/^@media \(forced-colors: active\)/.test(b.prelude)&&b.body.includes('[data-spotlight="bass"]'));
  assert.equal(forced.length,1);assert.match(forced[0].body,/fill:\s*none/);
});

test('ring words sit off the hub edge and inside the disk edge',async()=>{
  const field=(await trip('house-v1')).flow.melodyField;
  const lefts=[...field.html().matchAll(/data-ring-word="([a-z]+)" aria-hidden="true" style="left:([\d.]+)%/g)].map(m=>Number(m[2]));
  assert.ok(lefts[0]>=50+.44*50,`Light at ${lefts[0]}`);
  assert.ok(lefts[2]<=50+.87*50,`Big at ${lefts[2]}`);
});
