// Bass wheel screen and input (14 Nov 2026, slice 1): the Feel the bass card, the Bass wheel tab and its disk.
// Native Tab stops, arrows and Home, the press cycle that reaches all 19 moves with two switches, pointer drags with
// hysteresis and one Undo entry, chosen and heard states without outlines or motion, plain words, scan stops,
// phones, Bigger mode and forced colours. Deferred items (Bass and beat, lane focus, attack pulse) are absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MelodyFieldSession,BASS_HUES,BASS_LABEL_RADIUS,BASS_PROMPT,BASS_PERSONAL,BASS_SOFTER,BASS_ERROR,BASS_KEEP_HELP,BASS_DISK_LABEL,BASS_TUNE_CHANGED,BASS_SOUND_CHANGED,bassSay,bassWayLabel} from '../../../static/ui/melody_field_session.js';
import {PlayFlow,BASS_GAVE_WAY,wheelEntryWords} from '../../../static/ui/stages/play_flow.js';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v9.js';
import {phraseContext as docPhraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {startJam} from '../../../static/js/theory/jam_session.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';
import {BASS_WAYS,BASS_SIZES,BASS_MOVES,BASS_BAND,BASS_HUB_RADIUS,BASS_RING_EDGES,bassSector} from '../../../static/js/theory/bass_wheel.js';
import {jamScore} from '../theory/bass-wheel-fixtures.mjs';

const WAY_KEYS=BASS_WAYS.map((_,i)=>`melody-field-bass-${i}`);
const PALETTES=new Map();
function session(scene='house-v1',{context=null,song=null,personal=false}={}) {
  const score=jamScore(scene);
  let source=song??score.song,phrase=context??score.context;
  if(personal) {
    const own={id:'own-bass',role:'bass',step:20,duration_steps:4,duration_sec:.6,start_sec:3,velocity:.7,patch_id:'sampled_bass_v1',provenance:'user_placed',concrete:{midi_pitch:43,freq_hz:98}};
    source={...source,events:[...source.events,own]};phrase={...phrase,source:{...phrase.source,events:[...phrase.source.events,own]}};
  }
  const scheduler={queued:[],isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,loadingSession:null,audition:null,
    getPartAuditionState(){return this.audition;},setSpotlightRole(r){this.spotlightRole=r;},
    queueContinuousPartAudition(_v,opts){this.queued.push(opts);return {ok:true};}};
  const field=new MelodyFieldSession(source,{scheduler,captureOrigin:0,sourceDoc:score.doc,phraseContext:phrase});
  if(!PALETTES.has(scene))PALETTES.set(scene,buildMelodyPalette(score.context));
  field.palette=personal?buildMelodyPalette(phrase):PALETTES.get(scene);
  field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return {field,scheduler,score};
}
const hear=(field,scheduler)=>{scheduler.audition={sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId};field.realizedId=field.requestId;};
const diskOf=html=>html.match(/<div class="pf-melody-disk pf-bass-disk"[\s\S]*?<p class="pf-sub" data-mf-status/)[0];

/** Just enough DOM for bind() and paint() on the Bass wheel: the disk's buttons and cells parsed from the real markup. */
function mount(field,{size=296}={}) {
  const doc={activeElement:null};globalThis.document=doc;
  const element=(tag,attrs)=>({tag,attrs,disabled:false,
    getAttribute(k){return Object.hasOwn(this.attrs,k)?this.attrs[k]:null;},setAttribute(k,v){this.attrs[k]=String(v);},
    hasAttribute(k){return Object.hasOwn(this.attrs,k);},removeAttribute(k){delete this.attrs[k];},
    querySelector(sel){return sel==='[data-bass-size]'?this.size||null:null;},focus(){doc.activeElement=this;}});
  const parse=html=>[...html.matchAll(/<(button|path|circle)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map(([,tag,a,inner])=>{
    const el=element(tag,Object.fromEntries([...a.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])));
    const size=inner.match(/data-bass-size>([^<]*)</);if(size)el.size={textContent:size[1]};
    return el;});
  const listeners={};
  const disk={els:[],attrs:{},classList:{contains:c=>c==='pf-bass-disk'},
    set innerHTML(h){this.els=parse(h);},
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},
    querySelectorAll(sel){const m=sel.match(/^\[([\w-]+)\]$/);return m?this.els.filter(e=>e.hasAttribute(m[1])):[];},
    querySelector(sel){
      const m=sel.match(/^\[data-key="([^"]+)"\]$/);if(m)return this.els.find(e=>e.attrs['data-key']===m[1])||null;
      return sel==='[data-key]'?this.els.find(e=>e.hasAttribute('data-key'))||null:null;},
    contains(x){return x===this||this.els.includes(x);},
    addEventListener(t,f){(listeners[t]||=[]).push(f);},
    getBoundingClientRect(){return {left:0,top:0,width:size,height:size};},
    setPointerCapture(){},focus(){doc.activeElement=this;(listeners.focus||[]).forEach(f=>f());}};
  disk.innerHTML=field.html().match(/data-bass-disk[^>]*>([\s\S]*?)<p class="pf-sub" data-mf-status/)[1];
  const node=()=>({textContent:'',hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;}});
  const parts={status:node(),keep:node(),help:node(),softer:node(),original:node()};
  const map={'[data-melody-disk]':disk,'[data-mf-status]':parts.status,'[data-key="melody-field-keep"]':parts.keep,'[data-mf-keep-help]':parts.help,
    '[data-mf-bass-softer]':parts.softer,'[data-key="melody-field-original"]':parts.original};
  field.bind({querySelector:sel=>map[sel]||null,querySelectorAll:()=>[]});
  const fire=(type,extra={})=>{const e={type,button:0,pointerId:1,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra};(listeners[type]||[]).forEach(f=>f(e));return e;};
  const pointer=(type,[x,y])=>fire(type,{clientX:(x+1)*size/2,clientY:(1-y)*size/2});
  const key=(k,mods={})=>fire('keydown',{key:k,...mods});
  const el=k=>disk.els.find(e=>e.attrs['data-key']===k);
  const cell=k=>disk.els.find(e=>e.attrs['data-bass-cell']===k);
  return {disk,doc,parts,pointer,key,el,cell,fire};
}
const at=(deg,r)=>[Math.sin(deg*Math.PI/180)*r,Math.cos(deg*Math.PI/180)*r];
const RING_MID={light:(BASS_HUB_RADIUS+BASS_RING_EDGES[0])/2,full:(BASS_RING_EDGES[0]+BASS_RING_EDGES[1])/2,big:(BASS_RING_EDGES[1]+1)/2};

// ---- Markup, words and scan stops ----
const words=t=>t.trim().split(/\s+/).filter(Boolean).length;
function stripDetails(html){let s=html,prev='';while(s!==prev){prev=s;s=s.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi,m=>m.match(/<summary\b[^>]*>[\s\S]*?<\/summary>/i)?.[0]||'');}return s;}
const scanStops=html=>{const top=stripDetails(html);return (top.match(/<(button|summary|select|input|a)\b[^>]*>/gi)||[]).length+(top.match(/tabindex="0"/gi)||[]).length;};
const buttonLabels=html=>[...stripDetails(html).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].map(m=>m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);

test('Bass wheel markup: fewer buttons than the Tune wheel, three tabs, a hub and six ways that are each a Tab stop',()=>{
  const {field}=session('house-v1');field.setWheel('bass');
  const html=field.html();
  assert.match(html,/<h1 class="pf-heading">Feel the bass<\/h1>/);
  assert.ok(html.includes(`<p>${BASS_PROMPT}</p>`));
  // Toolbar: Play, Original, Undo move and Hear bass clearly only.
  for(const gone of ['melody-field-explore','melody-field-balance','melody-field-focus','melody-field-refine','melody-field-controls','melody-field-guide','melody-field-left'])
    assert.doesNotMatch(html,new RegExp(`data-key="${gone}"`),`${gone} is hidden on the Bass wheel`);
  assert.doesNotMatch(html,/data-mf-axis|data-mf-focus-help|Hear tune clearly/);
  for(const kept of ['melody-field-play','melody-field-original','melody-field-undo','melody-field-bass-focus','melody-field-keep','melody-field-back','melody-field-take','melody-keep-more'])
    assert.match(html,new RegExp(`data-key="${kept}"`));
  // Deferred in slice 1: no bass sound ring, no attack pulse. (Hear bass clearly came on 14 Nov: bass-wheel-clarity.test.mjs.)
  assert.doesNotMatch(html,/Bass and beat|groove|pf-bass-pulse|--bass-hit/);
  const tabs=[...html.matchAll(/class="pf-btn pf-wheel-tab" data-key="([^"]+)" aria-pressed="(true|false)">([^<]+)</g)].map(m=>[m[1],m[2],m[3]]);
  assert.deepEqual(tabs,[['melody-field-tune-mode','false','Tune wheel'],['melody-field-sound-mode','false','Sound wheel'],['melody-field-bass-mode','true','Bass wheel']]);
  const disk=diskOf(html);
  assert.match(disk,/^<div class="pf-melody-disk pf-bass-disk" data-melody-disk data-bass-disk tabindex="-1" role="group" aria-label="/);
  assert.equal((disk.match(/tabindex=/g)||[]).length,1,'only the disk names a tabindex: every button is a native Tab stop');
  assert.doesNotMatch(disk,/"[a-z-]+="/,'every attribute is separated by a space');
  const keys=[...disk.matchAll(/data-key="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(keys,['melody-field-bass-hub',...WAY_KEYS],'the middle first, then the ways clockwise from the top (also the Tab order)');
  assert.deepEqual([...disk.matchAll(/data-bass-way="([^"]+)"/g)].map(m=>m[1]),['deep','steady','walk','bounce','funky','chill']);
  assert.match(disk,/<svg class="pf-bass-art" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">/);
  assert.equal((disk.match(/<path class="pf-bass-cell"/g)||[]).length,18,'six ways x three sizes');
  assert.match(disk,/data-key="melody-field-bass-hub" data-bass-move="band" aria-pressed="true" data-chosen="true">Band bass<\/button>/);
  // Way labels sit in the middle of the Full ring, on their sector centres.
  for(const m of disk.matchAll(/class="pf-bass-sector pf-bass-way"[^>]*style="left:([\d.]+)%;top:([\d.]+)%/g))
    assert.ok(Math.abs(Math.hypot(Number(m[1])-50,Number(m[2])-50)-BASS_LABEL_RADIUS)<.01);
  assert.ok(Math.abs(BASS_LABEL_RADIUS-33.25)<1e-9);
  for(const w of BASS_WAYS)assert.ok(w.label.length<=6,`${w.label}: rim labels are 6 characters or fewer`);
  assert.match(html,/data-key="melody-field-keep">Keep this bass<\/button>/);
  assert.match(html,/<p class="pf-sub" data-mf-status role="status" aria-live="polite"><\/p>/,'a polite live region says each move');
  // More ways keeps only Save played take.
  const more=html.match(/<details class="pf-melody-keep-more"[\s\S]*?<\/details>/)[0];
  assert.deepEqual([...more.matchAll(/data-key="(melody-field-[a-z-]+)"/g)].map(m=>m[1]),['melody-field-take']);
  assert.equal(Object.keys(BASS_HUES).join(),'deep,steady,walk,bounce,funky,chill');
});

test('Bass wheel labels are 3 words or fewer and scan stops stay within 35 in every state',()=>{
  const {field,scheduler}=session('soul-v1');field.setWheel('bass');
  const stops=[];
  for(const move of BASS_MOVES) {
    field.bassMove=move;
    for(const playing of [true,false]) {
      scheduler.isPlaying=playing;
      const html=field.html();
      for(const label of buttonLabels(html))assert.ok(words(label)<=3,`"${label}" is 3 words or fewer`);
      stops.push(scanStops(html));
    }
  }
  assert.ok(Math.max(...stops)<=35,`scan stops ${Math.max(...stops)}`);
  assert.ok(Math.max(...stops)<=20,'fewer stops than the Tune wheel');
});

test('every Bass wheel word reads at grade 2',()=>{
  const texts=[BASS_PROMPT,BASS_PERSONAL,BASS_SOFTER,BASS_ERROR,BASS_KEEP_HELP,BASS_DISK_LABEL,'Band bass','Feel the bass','Keep this bass','New bass',
    'Bass wheel. Pick how the bass moves.','Bass wheel. Not ready for this band.','The bass wheel is not ready for this band. Your groove stays.',
    'Keep saves the last bass you heard. Next, Save here keeps it in this browser. Wait for this choice to play.',
    'Keep saves the bass you started with. Next, Save here keeps it in this browser. Play this choice first to keep it.',
    'Your next bass joins soon. This shows what plays now.','Find the bass below the chords.',
    'The band bass is back. Your tune stays.','Stopped. Press Play to hear this bass.','Stopped. Press Play to hear your next bass.',
    // Fixes: Original's other name, the tune line after Original or Undo, the bass entry words and the give-way notice.
    'Your changes',BASS_TUNE_CHANGED,BASS_SOUND_CHANGED,BASS_GAVE_WAY,...['listen','here','stays','starting','changed'].map(k=>wheelEntryWords('bass')[k])];
  for(const move of [...BASS_MOVES,'kept']) {
    texts.push(`Playing: ${bassSay(move)}.`,`Next: ${bassSay(move)}. Your bass will join soon.`,`Starting: ${bassSay(move)}.`,`Playing: ${bassSay(move)}. Your next change joins soon.`);
    for(const next of BASS_MOVES)texts.push(`Playing: ${bassSay(move)}. Next: ${bassSay(next)}.`);
  }
  for(const w of BASS_WAYS)for(const size of [null,...BASS_SIZES.map(s=>s.id)])texts.push(bassWayLabel(w.id,size));
  const bad=[...new Set(texts)].map(t=>({t,r:checkPrompt(t)})).filter(x=>!x.r.ok).map(x=>`${x.t} -> ${JSON.stringify(x.r.problems)}`);
  assert.deepEqual(bad,[]);
  assert.equal(bassSay('funky-big'),'Funky bass. It is big');assert.equal(bassSay(BASS_BAND),'Band bass');assert.equal(bassSay('kept'),'Your kept bass');
  // A way's spoken name starts with its visible words (label in name).
  assert.equal(bassWayLabel('funky'),'Funky bass. Short notes with gaps.');
  assert.equal(bassWayLabel('funky','big'),'Funky Big. Short notes with gaps. Press again for a new size.');
});

test('personal bass notes and a Softer band from the Tune wheel are said on the Bass wheel',()=>{
  const own=session('house-v1',{personal:true}).field;own.setWheel('bass');
  assert.ok(own.bassCtx.personal.length>0);
  assert.match(own.html(),new RegExp(`<p class="pf-sub" data-mf-bass-personal>${BASS_PERSONAL}</p>`));
  // The line goes round the personal note.
  own.selectBass('steady-full');
  const line=own._candidate(own.position).song.events.filter(n=>n.role==='bass'&&n.generated_by==='musiclab_bass_wheel_v1');
  assert.ok(line.every(n=>n.step+n.performance.offset_steps+n.duration_steps<=20+1e-6||n.step+n.performance.offset_steps>=24-1e-6));
  const {field}=session('house-v1');field.setWheel('bass');
  assert.doesNotMatch(field.html(),/data-mf-bass-personal/);
  assert.match(field.html(),/data-mf-bass-softer hidden>/);
  field.toggleBandBalance();
  assert.match(field.html(),new RegExp(`data-mf-bass-softer>${BASS_SOFTER}<`));
});

// ---- Keys and switches ----
test('arrows and Home move the bass through the disk; Enter and Space are left to the focused button and the scan',()=>{
  const {field}=session('house-v1');field.setWheel('bass');
  const w=mount(field);
  w.disk.focus();assert.equal(w.doc.activeElement,w.el('melody-field-bass-hub'),'entering the disk lands on the chosen button');
  w.key('ArrowRight');assert.equal(field.bassMove,'deep-full','from the middle the first move lands on Full');
  assert.equal(w.doc.activeElement,w.el('melody-field-bass-0'),'focus follows the chosen way');
  w.key('ArrowRight');assert.equal(field.bassMove,'steady-full');
  w.key('ArrowUp');assert.equal(field.bassMove,'steady-big');
  w.key('ArrowUp');assert.equal(field.bassMove,'steady-big','clamped at Big');
  w.key('ArrowDown');w.key('ArrowDown');assert.equal(field.bassMove,'steady-light');
  w.key('ArrowLeft');w.key('ArrowLeft');assert.equal(field.bassMove,'chill-light','Left wraps round, keeping the size');
  assert.equal(field.history.length,7,'one Undo entry per key press that changes the bass');
  for(const k of ['Enter',' ','Escape','Tab','a']) {
    const e=w.key(k);assert.equal(e.defaultPrevented,false,`${k} is not the disk's`);
  }
  assert.equal(field.bassMove,'chill-light');
  for(const mods of [{altKey:true},{ctrlKey:true},{metaKey:true}]){const e=w.key('Home',mods);assert.equal(e.defaultPrevented,false);}
  assert.equal(field.bassMove,'chill-light','modified keys stay the browser\'s');
  w.key('Home');assert.equal(field.bassMove,BASS_BAND);assert.equal(w.doc.activeElement,w.el('melody-field-bass-hub'));
});

test('pressing the buttons alone (two switches) reaches all 19 moves; a new way plays Full, the chosen way changes size',()=>{
  const {field}=session('house-v1');field.setWheel('bass');
  const w=mount(field);
  const reached=new Set([field.bassMove]);
  for(let i=0;i<6;i++){
    field.pressBassWay(i);assert.equal(field.bassMove,`${BASS_WAYS[i].id}-full`);reached.add(field.bassMove);
    assert.equal(w.doc.activeElement,w.el(`melody-field-bass-${i}`));
    field.pressBassWay(i);assert.equal(field.bassMove,`${BASS_WAYS[i].id}-big`);reached.add(field.bassMove);
    field.pressBassWay(i);assert.equal(field.bassMove,`${BASS_WAYS[i].id}-light`);reached.add(field.bassMove);
    field.pressBassWay(i);assert.equal(field.bassMove,`${BASS_WAYS[i].id}-full`,'and back to Full');
  }
  field.chooseBass(BASS_BAND);reached.add(field.bassMove);
  assert.deepEqual([...reached].sort(),[...BASS_MOVES].sort());
  assert.equal(field.pressBassWay(9),false);
});

test('the play flow routes the Bass wheel buttons and tabs',async()=>{
  const {field}=session('house-v1');
  const flow=Object.create(PlayFlow.prototype);flow.melodyField=field;flow.app={scheduler:field.scheduler,_announce(){}};
  let renders=0;flow.render=()=>{renders++;};
  const focused=[];flow.root={querySelector:sel=>({focus:()=>focused.push(sel)})};
  await flow._melodyFieldAction('melody-field-bass-mode');
  assert.equal(field.wheel,'bass');assert.equal(renders,1);assert.deepEqual(focused,['[data-melody-disk]']);
  field.root={querySelector:()=>null,querySelectorAll:()=>[]};
  await flow._melodyFieldAction('melody-field-bass-4');assert.equal(field.bassMove,'funky-full');
  await flow._melodyFieldAction('melody-field-bass-4');assert.equal(field.bassMove,'funky-big');
  await flow._melodyFieldAction('melody-field-bass-hub');assert.equal(field.bassMove,BASS_BAND);
  await flow._melodyFieldAction('melody-field-bass-mode');assert.equal(renders,1,'the tab already shown changes nothing');
  await flow._melodyFieldAction('melody-field-sound-mode');assert.equal(field.wheel,'sound');
  await flow._melodyFieldAction('melody-field-tune-mode');assert.equal(field.wheel,'tune');assert.equal(renders,3);
  // Without a ready bass, the tab key leaves the wheel where it was.
  field.palette=null;await flow._melodyFieldAction('melody-field-bass-mode');assert.equal(field.wheel,'tune');assert.equal(renders,3);
});

// ---- Pointer ----
test('the disk owns the pointer: each cell picks its move, the middle the band bass, outside nothing',()=>{
  const {field}=session('house-v1');field.setWheel('bass');
  const w=mount(field);
  BASS_WAYS.forEach((way,i)=>BASS_SIZES.forEach(size=>{
    w.pointer('pointerdown',at(i*60,RING_MID[size.id]));
    assert.equal(field.bassMove,`${way.id}-${size.id}`);
    w.pointer('pointerup',at(i*60,RING_MID[size.id]));
  }));
  w.pointer('pointerdown',[0,0]);assert.equal(field.bassMove,BASS_BAND);w.pointer('pointerup',[0,0]);
  const before=field.history.length;
  w.pointer('pointerdown',[0,1.3]);w.pointer('pointerup',[0,1.3]);
  assert.equal(field.history.length,before,'a press outside the disk does nothing');
  assert.equal(w.doc.activeElement,w.el('melody-field-bass-hub'),'focus lands on the chosen button after a gesture');
});

test('a drag holds its way and size across edges (hysteresis) and adds one Undo entry when it ends',()=>{
  const {field,scheduler}=session('house-v1');field.setWheel('bass');
  const w=mount(field);
  const picks=[];const select=field.selectBass.bind(field);field.selectBass=m=>{picks.push(m);return select(m);};
  // Press Steady (60) on Full, wobble across its edge with Walk (90) and across the Full/Big ring edge.
  w.pointer('pointerdown',at(60,.66));
  for(const [deg,r] of [[88,.66],[93,.66],[89,.66],[60,.8],[60,.77],[60,.79]])w.pointer('pointermove',at(deg,r));
  assert.deepEqual(picks,['steady-full'],`edge jitter never flips the move: ${JSON.stringify(picks)}`);
  // Clearly past the edges: the move follows.
  w.pointer('pointermove',at(95,.66));w.pointer('pointermove',at(95,.82));
  assert.equal(field.bassMove,'walk-big');
  // Past the rim while dragging is still Big.
  w.pointer('pointermove',at(180,1.4));assert.equal(field.bassMove,'bounce-big');
  w.pointer('pointerup',at(180,1.4));
  assert.equal(field.history.length,1,'one Undo entry for the gesture');
  assert.ok(scheduler.queued.length>=3);
  field.undo();assert.equal(field.bassMove,BASS_BAND,'one Undo goes back to the bass before the drag');
  // A drag that comes back where it started adds nothing.
  w.pointer('pointerdown',at(0,.66));w.pointer('pointermove',at(60,.66));w.pointer('pointermove',at(0,.66));
  const n=field.history.length;w.pointer('pointerup',at(0,.66));
  assert.equal(field.history.length,n+1);
  w.pointer('pointerdown',at(0,.66));w.pointer('pointermove',at(60,.66));w.pointer('pointermove',at(0,.66));w.pointer('pointercancel',at(0,.66));
  assert.equal(field.history.length,n+1,'deep-full to deep-full adds no entry');
  // bassSector's own hold, the geometry the drag uses.
  assert.equal(bassSector(...at(93,.66)),'walk-full');assert.equal(bassSector(...at(93,.66),'steady-full'),'steady-full');
  assert.equal(bassSector(...at(60,.57),'steady-light'),'steady-light');assert.equal(bassSector(...at(60,.59),'steady-light'),'steady-full');
});

// ---- Painted states ----
test('chosen and heard states sit on the labels and cells; the heard mark is never an outline and nothing pulses',()=>{
  const {field,scheduler}=session('swing-v1');field.setWheel('bass');
  const w=mount(field);
  field.selectBass('walk-big');hear(field,scheduler);field.paint();
  const walk=w.el('melody-field-bass-2');
  assert.equal(walk.attrs['aria-pressed'],'true');assert.equal(walk.attrs['data-chosen'],'true');assert.equal(walk.attrs['data-heard'],'true');
  assert.equal(walk.size.textContent,'Big','the size shows inside the chosen label');
  assert.equal(walk.attrs['aria-label'],bassWayLabel('walk','big'));
  assert.equal(w.cell('walk-big').attrs['data-chosen'],'true');assert.equal(w.cell('walk-big').attrs['data-heard'],'true');
  assert.equal(w.el('melody-field-bass-hub').attrs['aria-pressed'],'false');
  // A newer request waits: chosen moves, heard stays.
  field.selectBass('funky-light');
  const funky=w.el('melody-field-bass-4');
  assert.equal(funky.attrs['data-chosen'],'true');assert.equal(funky.hasAttribute('data-heard'),false);assert.equal(funky.size.textContent,'Light');
  assert.equal(walk.hasAttribute('data-chosen'),false);assert.equal(walk.attrs['data-heard'],'true');assert.equal(walk.size.textContent,'');
  assert.equal(walk.attrs['aria-label'],bassWayLabel('walk'));
  assert.equal(w.cell('walk-big').attrs['data-heard'],'true');assert.equal(w.cell('funky-light').attrs['data-chosen'],'true');
  assert.equal(w.disk.els.filter(e=>e.hasAttribute('data-chosen')).length,2,'one chosen label and one chosen cell');
  // Stopped: nothing is marked heard.
  scheduler.isPlaying=false;field.paint();
  assert.equal(w.disk.els.filter(e=>e.hasAttribute('data-heard')).length,0);
  // While Show me runs elsewhere the disk is disabled; painting never removes a Tab stop.
  field.guide={};field.paint();assert.ok(w.disk.els.filter(e=>e.tag==='button').every(e=>e.disabled));
  field.guide=null;field.paint();assert.ok(w.disk.els.filter(e=>e.tag==='button').every(e=>!e.disabled&&!e.hasAttribute('tabindex')));
  // The softer line follows Softer band.
  scheduler.isPlaying=true;field.toggleBandBalance();field.paint();assert.equal(w.parts.softer.hidden,false);
  field.toggleBandBalance();field.paint();assert.equal(w.parts.softer.hidden,true);
});

// ---- CSS: phones, Bigger mode, reduced motion, forced colours ----
const css=fs.readFileSync(new URL('../../../static/css/studio.css',import.meta.url),'utf8');
function blocks(text){
  const out=[];let depth=0,start=0,prelude='';
  for(let i=0;i<text.length;i++){
    if(text[i]==='{'){if(depth===0){prelude=text.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim();start=i+1;}depth++;}
    else if(text[i]==='}'){depth--;if(depth===0){out.push({prelude,body:text.slice(start,i),at:start});start=i+1;}}
  }
  return out;
}
test('CSS: the disk takes pointer input, its states are fills and marks, and nothing on it moves',()=>{
  const all=blocks(css);
  const rule=sel=>all.find(b=>b.prelude===sel)?.body;
  assert.match(rule('.pf-bass-sector'),/pointer-events:\s*none/,'buttons on the disk take no pointer events');
  assert.match(rule('.pf-bass-art'),/pointer-events:\s*none/);
  assert.match(rule('.pf-bass-sector:focus-visible'),/outline:\s*3px solid/);
  const heard=rule('.pf-bass-sector[data-heard="true"]::after');
  assert.match(heard,/content:\s*"\\266A"/,'heard is a small playing mark');
  assert.doesNotMatch(heard,/outline|border/);
  assert.doesNotMatch(rule('.pf-bass-cell[data-heard="true"]'),/outline|stroke/,'a heard cell is a lighter fill, not a ring');
  const bassRules=all.filter(b=>/pf-bass|pf-wheel-card-bass/.test(b.prelude+b.body));
  for(const b of bassRules){
    const body=b.body.replace(/\.pf-btn\.pf-wheel-card-bass:disabled::after\s*\{[^}]*\}/g,'');
    if(/pf-wheel-card-bass::after/.test(b.prelude))continue; // the card's invite ring: delayed, off under reduced motion
    assert.doesNotMatch(body,/animation(?!:\s*none)|transition(?!:\s*none)/,`${b.prelude}: no motion on the Bass wheel`);
  }
  assert.match(rule('.pf-wheel-card-bass::after'),/animation-delay:\s*2\.1s/);
  // The invite ring stops under reduced motion and Calm (the shared card rules), and on a disabled card.
  assert.ok(all.some(b=>b.prelude==='@media (prefers-reduced-motion: reduce)'&&/\.pf-wheel-card::after\s*\{[^}]*animation:\s*none/.test(b.body)));
  assert.ok(all.some(b=>b.prelude==='body.pf-less-motion .pf-wheel-card::after'&&/animation:\s*none/.test(b.body)));
  assert.match(rule('.pf-btn.pf-wheel-card-bass:disabled::after'),/animation:\s*none/);
});

test('CSS: phones put the three tabs on one row, Bigger keeps the disk size, forced colours draw system colours',()=>{
  const all=blocks(css);
  assert.ok(all.some(b=>b.prelude==='@media (max-width: 480px)'&&/\.pf-wheel-tabs\s*\{[^}]*flex-wrap:\s*nowrap/.test(b.body)&&/\.pf-btn\.pf-wheel-tab\s*\{[^}]*flex:\s*1 1 0/.test(b.body)));
  const normal=all.find(b=>b.prelude==='.pf-melody-disk').body.match(/width:\s*([^;]+);/)[1].trim();
  const bigger=all.find(b=>b.prelude==='@media (max-width: 480px)'&&/body\.pf-bigger \.pf-melody-disk\.pf-bass-disk/.test(b.body));
  assert.equal(bigger.body.match(/body\.pf-bigger \.pf-melody-disk\.pf-bass-disk\s*\{\s*width:\s*([^;]+);/)[1].trim(),normal);
  const forced=all.filter(b=>/^@media \(forced-colors: active\)/.test(b.prelude)&&/\.pf-bass-sector/.test(b.body));
  assert.equal(forced.length,1);
  assert.ok(forced[0].at>all.find(b=>b.prelude==='.pf-bass-sector:focus-visible').at,'the forced-colours block comes later');
  assert.match(forced[0].body,/\.pf-bass-sector:focus-visible\s*\{[^}]*outline-color:\s*CanvasText/);
  assert.match(forced[0].body,/\.pf-bass-sector\[data-chosen="true"\]\s*\{[^}]*Highlight/);
  assert.match(forced[0].body,/\.pf-bass-cell\[data-chosen="true"\]\s*\{[^}]*fill:\s*Highlight/);
  assert.match(forced[0].body,/\.pf-bass-cell, \.pf-bass-hub-cell\s*\{[^}]*stroke:\s*CanvasText/);
});

// ---- The Jam screen card ----
function jamFlow(scene) {
  const win={localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},scrollTo(){}};
  globalThis.window=win;
  const flow=Object.create(PlayFlow.prototype);
  flow.root={querySelector:()=>null,querySelectorAll:()=>[]};
  flow.app={scheduler:{isPlaying:false,stopGeneration:0,spotlightRole:null,audioCtx:{currentTime:0},setCompiledSong(){},setLoopRange(){},setRepeatPlayback(){},clearMuteLayers(){},
    setSpotlightRole(){},unlock:async()=>{},previewSound(){},stop(){},start(){},capturePerformance:()=>null,activeJamBacking:()=>null,
    queueContinuousPartAudition:()=>({ok:true}),getPartAuditionState:()=>null,masterBus:{piano:{},disposed:false}},_announce(){},_logSessionEvent(){}};
  flow.render=()=>{};flow._sparkAt=()=>{};flow.stage='start';flow.trail=[];flow.confirm={};flow._freshState();
  flow.stage='jam';
  flow._acceptJamDoc(startJam(flow.doc,{kind:'pitched',patchId:'warm_keys'}));
  Object.assign(flow.doc.jam_session,{showcase_version:1,exploration_map:'catalogue-circle-v2',scene_id:scene});
  flow._compile();
  return flow;
}
const card=html=>html.match(/<div class="pf-wheel-option"><button[^>]*data-key="melody-field-enter-bass"[^>]*>[^<]*<\/button><p class="pf-wheel-caption" id="pf-wheel-cap-bass">([^<]*)<\/p><\/div>/);

test('Feel the bass is the third Jam wheel card; it stays in place, and on a style without the Bass wheel it says where one press moves',()=>{
  const flow=jamFlow('house-v1');
  const html=flow._renderJam();
  const cards=[...html.matchAll(/data-key="(melody-field-enter[a-z-]*)"/g)].map(m=>m[1]);
  assert.deepEqual(cards.slice(0,3),['melody-field-enter','melody-field-enter-sound','melody-field-enter-bass']);
  const on=card(html);assert.ok(on,'the card and its caption');
  assert.doesNotMatch(on[0],/disabled/);assert.equal(on[1],'Bass wheel. Pick how the bass moves.');
  assert.match(on[0],/class="pf-btn pf-wheel-card pf-wheel-card-bass"/);assert.match(on[0],/aria-describedby="pf-wheel-cap-bass"/);
  assert.match(on[0],/>Feel the bass<\/button>/);
  assert.ok(scanStops(html)<=35,`Circle Jam scan stops ${scanStops(html)}`);
  for(const label of buttonLabels(html))assert.ok(words(label)<=3,label);
  // Never off because of the style (14 Nov clarity): Hip-hop's press moves the band to Reggae, its nearest bass style.
  flow.doc.jam_session.scene_id='hip-hop-v1';
  const move=card(flow._renderJam());
  assert.doesNotMatch(move[0],/ disabled/);assert.equal(move[1],'Bass wheel. Moves to Reggae / ska to start.');
});

test('while the band plays, the card asks the bass wheel itself, with the saved band bass for a kept line',()=>{
  const flow=jamFlow('soul-v1');
  const {doc,song}=jamScore('soul-v1');
  let time=1;
  Object.assign(flow.app.scheduler,{isPlaying:true,compiledSong:song,
    activeJamBacking:()=>({time,source_song_id:song.song_id,events:structuredClone(song.events.filter(e=>e.provenance==='jam_generated')),phraseContext:docPhraseContext(doc)})});
  assert.equal(flow._bassEntryReady(),true);
  assert.equal(flow._bassEntryReady(),true,'the cached answer');
  // A band answering the child's notes in the bass (no band bass on the chords) is not ready.
  time=2;
  flow.app.scheduler.activeJamBacking=()=>({time,source_song_id:song.song_id,events:structuredClone(song.events.filter(e=>e.provenance==='jam_generated'&&e.role!=='bass')),phraseContext:docPhraseContext(doc)});
  assert.equal(flow._bassEntryReady(),false);
  assert.match(card(flow._renderJam())[0],/ disabled/);
  // The card follows the band in place as the clock reaches it, without a new render.
  const el={disabled:false},caption={textContent:'Bass wheel. Pick how the bass moves.'},coverage={textContent:''};
  const parts={'[data-melody-entry-coverage]':coverage,'[data-key="melody-field-enter-bass"]':el,'#pf-wheel-cap-bass':caption};
  flow.root={querySelector:sel=>parts[sel]||null,querySelectorAll:()=>[]};
  flow._paintCircle();
  assert.equal(el.disabled,true);assert.equal(caption.textContent,'Bass wheel. Not ready for this band.');
  time=3;
  flow.app.scheduler.activeJamBacking=()=>({time,source_song_id:song.song_id,events:structuredClone(song.events.filter(e=>e.provenance==='jam_generated')),phraseContext:docPhraseContext(doc)});
  flow._paintCircle();
  assert.equal(el.disabled,false);assert.equal(caption.textContent,'Bass wheel. Pick how the bass moves.');
});


test('unavailable Bass stays discoverable from Sound without changing music or switching to Tune',async()=>{
  const {field,scheduler}=session('house-v1');field.setWheel('sound');
  field.bassCtx=null;field.bassReason='scene';
  const html=field.html();
  assert.match(html,/data-key="melody-field-bass-mode" aria-pressed="false" aria-disabled="true" aria-describedby="mf-bass-availability"/);
  assert.match(html,/id="mf-bass-availability">For bass changes, try House, Reggae, Soul, Ska, Rocksteady or Swing in Jam\./);
  const before=JSON.stringify({song:field.source,doc:field.sourceDoc,position:field.position,history:field.history,sound:field.soundPatch,request:field.requestId});
  assert.equal(field.setWheel('bass'),false);assert.equal(field.wheel,'sound');
  const words=[];const flow=Object.create(PlayFlow.prototype);flow.melodyField=field;
  flow.app={scheduler,_announce:s=>words.push(s)};flow.render=()=>assert.fail('no redraw');flow.root={querySelector:()=>assert.fail('no focus jump')};
  await flow._melodyFieldAction('melody-field-bass-mode');
  assert.equal(field.wheel,'sound');assert.deepEqual(words,[field.bassAvailabilityText]);
  assert.equal(JSON.stringify({song:field.source,doc:field.sourceDoc,position:field.position,history:field.history,sound:field.soundPatch,request:field.requestId}),before);
  assert.equal(scheduler.queued.length,0,'no musical request or hidden band change');
  field.bassReason='mixed-bass';assert.match(field.html(),/Bass is not ready for this band. Your tune and sound stay./);
});
