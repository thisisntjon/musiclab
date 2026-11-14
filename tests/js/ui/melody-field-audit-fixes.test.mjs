// Open-release audit fixes on the melody wheels (14 Nov 2026):
// S9 the Tune wheel is a slider with a value, a role name and a pointer to its button alternative;
// S15 Back to jam leaves without keeping while full sounds fail or load, with Load sounds again beside the message;
// S17 a sound-only change is called a sound change, not a new tune; L12 each wheel has its own heading.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession,melodyKeepReadiness} from '../../../static/ui/melody_field_session.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v9.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';
import {jamScore} from '../theory/bass-wheel-fixtures.mjs';

const PALETTES=new Map();
function session(scene='house-v1') {
  const score=jamScore(scene);
  if(!PALETTES.has(scene))PALETTES.set(scene,buildMelodyPalette(score.context));
  const scheduler={queued:[],isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,loadingSession:null,audition:null,
    getPartAuditionState(){return this.audition;},setSpotlightRole(role){this.spotlightRole=role;},
    queueContinuousPartAudition(_view,opts){this.queued.push(opts);return {ok:true};}};
  const field=new MelodyFieldSession(score.song,{scheduler,captureOrigin:0,root:0,scale:'major',sourceDoc:score.doc,phraseContext:score.context});
  field.palette=PALETTES.get(scene);field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return {field,scheduler,score};
}
const hear=(field,scheduler)=>{scheduler.audition={sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId};field.realizedId=field.requestId;field.hasPlayed=true;};

/** The parts paint() writes into, with a score picture just able to take a drawing. */
function mount(field) {
  const node=()=>({textContent:'',hidden:false,attrs:{},style:{},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];}});
  const svg={...node(),innerHTML:'',firstChild:null,querySelector:()=>null,querySelectorAll:()=>[]};
  const parts={status:node(),keep:node(),refine:node(),back:node(),help:node(),original:node(),caption:node(),disk:node(),retry:node(),svg};
  const map={'[data-mf-status]':parts.status,'[data-key="melody-field-keep"]':parts.keep,'[data-key="melody-field-refine"]':parts.refine,
    '[data-key="melody-field-back"]':parts.back,'[data-mf-keep-help]':parts.help,'[data-key="melody-field-original"]':parts.original,
    '[data-mf-score-caption]':parts.caption,'[data-melody-disk]':parts.disk,'[data-mf-retry]':parts.retry,'[data-mf-score]':svg};
  field.root={querySelector:sel=>map[sel]||null,querySelectorAll:()=>[]};
  return parts;
}
function flowFor(field,scheduler,doc) {
  const flow=Object.create(PlayFlow.prototype);flow.doc=structuredClone(doc);flow.melodyField=field;flow.stage='jam';flow.said=[];
  flow.app={scheduler,_announce(message){flow.said.push(message);}};
  flow.calls=[];
  for(const name of ['_pushUndo','_stopForScopeChange','_finishPartEdit','_reconcileRetainedPlaying','_compile'])flow[name]=()=>{flow.calls.push(name);};
  flow._go=stage=>{flow.stage=stage;flow.calls.push('_go:'+stage);if(stage!=='jam')flow.melodyField=null;};
  flow.render=()=>{};
  return flow;
}
const attr=(html,name)=>html.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const tuneDisk=html=>html.match(/<div class="pf-melody-disk" data-melody-disk[^>]*>/)?.[0]||'';
const heading=html=>html.match(/<h1 class="pf-heading">([^<]*)<\/h1>/)[1];

// ---- S9 ----
test('S9: the Tune wheel is a slider that names the tune choice and points at Move with buttons',()=>{
  const {field,scheduler}=session();
  const html=field.html(),disk=tuneDisk(html);
  assert.equal(attr(disk,'role'),'slider');
  assert.equal(attr(disk,'tabindex'),'0');
  assert.equal(attr(disk,'aria-roledescription'),'tune wheel');
  assert.equal(attr(disk,'aria-valuetext'),field.melodyLabel(field.position));
  for(const k of ['aria-valuemin','aria-valuemax','aria-valuenow'])assert.ok(attr(disk,k)!=null,`${k} is set`);
  const ids=attr(disk,'aria-describedby').split(/\s+/);
  const described=ids.map(id=>html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1]).join(' ');
  assert.match(described,/Move with buttons/);
  assert.match(described,/arrow keys/i);
  assert.ok(checkPrompt(described).ok,JSON.stringify(checkPrompt(described).problems));
  // The value follows the wheel.
  const parts=mount(field);
  field.request({x:0,y:.6});hear(field,scheduler);field.paint();
  assert.equal(parts.disk.attrs['aria-valuetext'],field.melodyLabel(field.position));
  assert.notEqual(parts.disk.attrs['aria-valuetext'],field.melodyLabel({x:0,y:0}));
  assert.equal(parts.disk.attrs['aria-valuenow'],String(Math.round(Math.hypot(field.position.x,field.position.y)*100)));
});

test('S9: the Sound and Bass wheel disks keep their group of buttons',()=>{
  const {field}=session();
  field.setWheel('sound');assert.match(field.html(),/data-melody-disk data-sound-view="" tabindex="-1" role="group"/);
  field.setWheel('bass');assert.match(field.html(),/data-bass-disk tabindex="-1" role="group"/);
});

// ---- S15 ----
function failedSounds() {
  const {field,scheduler,score}=session();
  field.request({x:0,y:.6});hear(field,scheduler);
  scheduler.loadingSession={state:'failed',retry(){scheduler.retried=(scheduler.retried||0)+1;}};
  assert.equal(melodyKeepReadiness(field).ok,false,'the sampled band is not ready');
  return {field,scheduler,score};
}

test('S15: while full sounds fail, Back to jam leaves the wheel without keeping the tune',async()=>{
  const {field,scheduler,score}=failedSounds();
  const flow=flowFor(field,scheduler,score.doc);
  await flow._melodyFieldAction('melody-field-back');
  assert.ok(flow.melodyField===null,'the wheel is closed');
  assert.equal(flow.stage,'jam');
  assert.ok(JSON.stringify(flow.doc)===JSON.stringify(score.doc),'nothing new is kept');
  assert.ok(!flow.calls.includes('_compile'),'the jam is not rebuilt from a new tune');
  assert.ok(flow.calls.includes('_stopForScopeChange'),'the audition stops');
});

test('S15: while full sounds are still loading, Back to jam still leaves; Keep and Refine still wait',async()=>{
  for(const key of ['melody-field-back','melody-field-back-top']) {
    const {field,scheduler,score}=session();
    field.request({x:0,y:.6});hear(field,scheduler);scheduler.loadingSession={state:'loading'};
    const flow=flowFor(field,scheduler,score.doc);
    await flow._melodyFieldAction(key);
    assert.ok(flow.melodyField===null,key);assert.ok(JSON.stringify(flow.doc)===JSON.stringify(score.doc),'nothing new is kept');
  }
  for(const key of ['melody-field-keep','melody-field-refine']) {
    const {field,scheduler,score}=failedSounds();
    const flow=flowFor(field,scheduler,score.doc);
    await flow._melodyFieldAction(key);
    assert.ok(flow.melodyField===field,`${key} stays on the wheel`);
    assert.ok(JSON.stringify(flow.doc)===JSON.stringify(score.doc),'nothing new is kept');
    assert.match(flow.said.at(-1),/Full sounds did not load/);
  }
});

test('S15: only Keep and Refine look blocked; Load sounds again sits by the message when sounds failed',()=>{
  const {field,scheduler}=failedSounds();
  const html=field.html();
  const retry=html.match(/<button[^>]*data-key="sounds-retry"[^>]*>([^<]*)<\/button>/);
  assert.ok(retry,'the wheel has its own retry button');
  assert.equal(retry[1],'Load sounds again');
  assert.ok(html.indexOf('data-mf-keep-help')<html.indexOf('data-key="sounds-retry"')&&html.indexOf('data-key="sounds-retry"')-html.indexOf('data-mf-keep-help')<400,'it sits next to the message');
  const parts=mount(field);parts.retry.hidden=true;field.paint();
  assert.equal(parts.keep.attrs['aria-disabled'],'true');
  assert.equal(parts.refine.attrs['aria-disabled'],'true');
  assert.equal(parts.back.attrs['aria-disabled'],'false');
  assert.match(parts.help.textContent,/Full sounds did not load/);
  assert.equal(parts.retry.hidden,false);assert.match(parts.retry.innerHTML,/data-key="sounds-retry">Load sounds again</);
  assert.ok(checkPrompt(parts.help.textContent).ok);
  // Still loading: no retry. Ready: no retry.
  scheduler.loadingSession={state:'loading'};field.paint();assert.equal(parts.retry.hidden,true);assert.equal(parts.retry.innerHTML,'','no hidden scan stop');
  assert.doesNotMatch(field.html(),/data-key="sounds-retry"/,'no button in the markup unless sounds failed');
  scheduler.loadingSession=null;field.paint();assert.equal(parts.retry.hidden,true);
  assert.equal(parts.back.attrs['aria-disabled'],'false');
});

// ---- S17 ----
test('S17: a new sound alone is called a sound change; Original names the first sound',()=>{
  const {field,scheduler}=session();
  const parts=mount(field);
  field.setWheel('sound');field.selectSound('sampled_marimba_v1');hear(field,scheduler);field.paint();
  assert.equal(parts.caption.textContent,'Same tune, new sound.');
  assert.equal(parts.original.textContent,'First sound');
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.equal(field.soundPatch,field.initialSoundPatch);
  assert.equal(parts.original.textContent,'New sound','the button brings back the sound, not a melody');
  assert.equal(parts.caption.textContent,'Showing your first tune.');
  field.setWheel('tune');field.paint();
  assert.equal(parts.original.textContent,'New sound','same words on the Tune wheel tab');
  for(const t of ['Same tune, new sound.'])assert.ok(checkPrompt(t).ok);
});

test('S17: a new tune keeps its words, with or without a new sound',()=>{
  const {field,scheduler}=session();
  const parts=mount(field);
  field.request({x:0,y:.6});field.remember({x:0,y:0});hear(field,scheduler);field.paint();
  assert.equal(parts.caption.textContent,'New tune shown over your first tune.');
  assert.equal(parts.original.textContent,'Original');
  field.setWheel('sound');field.selectSound('sampled_marimba_v1');hear(field,scheduler);field.paint();
  assert.equal(parts.caption.textContent,'New tune shown over your first tune.');
  assert.equal(parts.original.textContent,'Original');
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.equal(parts.original.textContent,'New melody');
});

// ---- L12 ----
test('L12: each wheel has its own heading and first line',()=>{
  const {field}=session();
  const tune=field.html();
  assert.equal(heading(tune),'Make your tune');
  field.setWheel('sound');const sound=field.html();
  assert.equal(heading(sound),'Pick a sound');
  const soundLine=sound.match(/<\/h1>\s*<p>([^<]*)<\/p>/)[1];
  assert.doesNotMatch(soundLine,/ideas|shape/i,'the Tune wheel line is not shown');
  assert.ok(checkPrompt(soundLine).ok,JSON.stringify(checkPrompt(soundLine).problems));
  field.setWheel('bass');assert.equal(heading(field.html()),'Feel the bass');
  assert.equal(new Set([heading(tune),heading(sound),'Feel the bass']).size,3);
});

test('S15, L12: with sounds failed, every wheel keeps buttons of 3 words or fewer and 35 scan stops or fewer',()=>{
  const {field}=failedSounds();
  const top=html=>html.replace(/<details[\s\S]*?<\/details>/g,'');
  const stops=html=>(top(html).match(/<(button|summary|select|input|a)\b[^>]*>/gi)||[]).length+(top(html).match(/tabindex="0"/gi)||[]).length;
  for(const wheel of ['tune','sound','bass']) {
    field.setWheel(wheel);const html=field.html();
    for(const [,label] of top(html).matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)){const t=label.replace(/<[^>]+>/g,' ').trim();if(t)assert.ok(t.split(/\s+/).length<=3,`${wheel}: "${t}"`);}
    assert.ok(stops(html)<=35,`${wheel}: ${stops(html)} scan stops`);
  }
});
