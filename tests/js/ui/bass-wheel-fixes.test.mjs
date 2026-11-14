// Bass wheel slice 1 fixes (14 Nov 2026): the checks a review and the persist gate found missing.
// 1 the "band is softer" line hides when it is hidden; 2 a Softer band kept line keeps its level in the next wheel session
// opened from Jam; 3 Original and Undo say what they really change on the Bass wheel; 4 forced colours (CSS here, the
// browser check in a development tool); 5 a tap on the chosen way's label changes its size like a key;
// 6 a kept wheel bass that gives way on a band change is said in that action's message; 7 the bass path says bass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MelodyFieldSession,BASS_TUNE_CHANGED,BASS_SOUND_CHANGED,bassWayLabel} from '../../../static/ui/melody_field_session.js';
import {PlayFlow,savedBassWheel,melodyEntryContext,wheelEntryWords,BASS_GAVE_WAY} from '../../../static/ui/stages/play_flow.js';
import {compileReturnSong} from '../../../static/ui/returning_part.js';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v9.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {phraseContext as docPhraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {SOFT_BAND_FACTOR} from '../../../static/js/theory/melody_balance.js';
import {startJam,setJamDirection,jamDirectionDescription} from '../../../static/js/theory/jam_session.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';
import {BASS_WAYS,BASS_SIZES,BASS_BAND,BASS_WHEEL_GENERATOR,BASS_RING_EDGES} from '../../../static/js/theory/bass_wheel.js';
import {jamScore} from '../theory/bass-wheel-fixtures.mjs';

const onset=n=>n.step+(n.performance?.version===1?n.performance.offset_steps||0:0);
const bassOf=events=>events.filter(n=>n.role==='bass').sort((a,b)=>onset(a)-onset(b)||String(a.id).localeCompare(String(b.id)));
const wheelBass=notes=>(notes||[]).filter(n=>n.role==='bass'&&n.generated_by===BASS_WHEEL_GENERATOR);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;

const PALETTES=new Map();
function palette(context) {
  // The palette's own tune holds the whole source score, so a kept line or a softer band is a different palette.
  const key=JSON.stringify([context.sceneId,context.root,context.harmony,context.source.events.map(n=>[n.id,n.velocity])]);
  if(!PALETTES.has(key))PALETTES.set(key,buildMelodyPalette(context));
  return PALETTES.get(key);
}
function fakeScheduler() {
  return {queued:[],isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,loadingSession:null,audition:null,
    getPartAuditionState(){return this.audition;},setSpotlightRole(role){this.spotlightRole=role;},
    queueContinuousPartAudition(_view,opts){this.queued.push(opts);return {ok:true};}};
}
function bassSession(scene='soul-v1',{context=null,song=null,doc=null}={}) {
  const score=jamScore(scene);
  const phrase=context??score.context,source=song??score.song,scheduler=fakeScheduler();
  const field=new MelodyFieldSession(source,{scheduler,captureOrigin:0,root:0,scale:'major',sourceDoc:doc??score.doc,phraseContext:phrase});
  field.palette=palette(phrase);field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return {field,scheduler,score};
}
const hear=(field,scheduler)=>{scheduler.audition={sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId};field.realizedId=field.requestId;field.hasPlayed=true;};
function keepFlow(field,scheduler,doc,key='melody-field-keep') {
  const flow=Object.create(PlayFlow.prototype);flow.doc=structuredClone(doc);flow.melodyField=field;
  flow.app={scheduler,_announce(message){throw Error(message);}};
  for(const name of ['_pushUndo','_stopForScopeChange','_finishPartEdit','_reconcileRetainedPlaying','_compile'])flow[name]=()=>{};
  flow._go=stage=>{flow.stage=stage;};
  return flow._melodyFieldAction(key).then(()=>flow);
}
/** The Jam now playing a kept doc, captured as _enterMelodyField captures it. */
function jamCapture(kept) {
  const compiled=compileReturnSong(kept),stepSec=15/compiled.bpm;
  compiled.events=compiled.events.map(e=>({...e,duration_steps:e.duration_steps??e.duration_sec/stepSec}));
  return {compiled,captured:captureMelodyContext(compiled,{phraseContext:docPhraseContext(kept)})};
}
/** Just the parts paint() writes words into. */
function mountLight(field) {
  const node=()=>({textContent:'',hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;}});
  const parts={status:node(),keep:node(),help:node(),original:node(),softer:node()};
  const map={'[data-mf-status]':parts.status,'[data-key="melody-field-keep"]':parts.keep,'[data-mf-keep-help]':parts.help,'[data-key="melody-field-original"]':parts.original,'[data-mf-bass-softer]':parts.softer};
  field.root={querySelector:sel=>map[sel]||null,querySelectorAll:()=>[]};
  return parts;
}
const words=t=>t.trim().split(/\s+/).filter(Boolean).length;
const grade2=texts=>[...new Set(texts)].map(t=>({t,r:checkPrompt(t)})).filter(x=>!x.r.ok).map(x=>`${x.t} -> ${JSON.stringify(x.r.problems)}`);

// ---- 1. The "band is softer" line is not shown while it is hidden ----
const css=fs.readFileSync(new URL('../../../static/css/studio.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
/** Every rule at any depth: its selector list and its declarations. */
const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selectors:m[1].split(',').map(s=>s.trim()),body:m[2]}));
const shows=body=>{const d=body.match(/(?:^|[;\s])display\s*:\s*([^;]+)/);return Boolean(d)&&!/^none\b/.test(d[1].trim());};
/** Classes of elements the UI writes with a hidden attribute (always, or while a condition holds). */
function hideableClasses() {
  const files=['../../../static/ui/melody_field_session.js','../../../static/ui/stages/play_flow.js'];
  const out=new Set();
  for(const f of files) {
    const src=fs.readFileSync(new URL(f,import.meta.url),'utf8');
    for(const m of src.matchAll(/<([a-z]+)\b([^<>]*?)>/g)) {
      const attrs=m[2].replace(/aria-hidden="[^"]*"|visibility:\s*hidden/g,'');
      if(!/(?:^|[\s'"])hidden(?=[\s'">}]|$)/.test(attrs))continue;
      const cls=attrs.match(/class="([^"$]*)"/);if(cls)for(const c of cls[1].split(/\s+/).filter(Boolean))out.add(c);
    }
  }
  return out;
}

test('CSS: a hidden "band is softer" line, and every other hidden element the UI writes, computes display none',()=>{
  const hideable=hideableClasses();
  assert.ok(hideable.has('pf-sub'),'the Bass wheel softer line is a hidden .pf-sub');
  const missing=[];
  for(const cls of hideable) {
    const own=new RegExp(`\\.${cls}(?![-\\w])`);
    // A rule whose last compound names the class and sets a display beats the browser's [hidden] rule.
    const beats=rules.filter(r=>shows(r.body)&&r.selectors.some(s=>{const last=s.split(/[\s>+~]+/).at(-1);return own.test(last)&&!last.includes('[hidden]');}));
    if(!beats.length)continue;
    const guard=rules.some(r=>/display\s*:\s*none/.test(r.body)&&r.selectors.some(s=>new RegExp(`\\.${cls}\\[hidden\\]$`).test(s)));
    if(!guard)missing.push(`${cls}: ${beats.map(r=>r.selectors.join(',')).join(' | ')}`);
  }
  assert.deepEqual(missing,[],'each class with its own display rule has a [hidden] rule that wins');
  // The rule itself: an attribute selector on the class (more specific than .pf-sub), so it wins wherever it sits.
  assert.ok(rules.some(r=>r.selectors.includes('.pf-sub[hidden]')&&/display\s*:\s*none/.test(r.body)));
});

// ---- 2. A Softer band kept line, Back to jam, then Feel the bass from Jam ----
test('Softer band Keep, Back to jam, Feel the bass: the new session stays softer, so Band bass and every way play at the kept level',async()=>{
  const moves=['band','funky-full','funky-big','steady-full','deep-light'];
  const {field,scheduler,score}=bassSession('soul-v1');
  field.toggleBandBalance();field.setWheel('bass');field.selectBass('funky-full');hear(field,scheduler);
  // What each move plays over the softer band in this first session: the level any later session must keep.
  const levels=f=>Object.fromEntries(moves.map(move=>{const c=f._candidate({x:0,y:0},f.bandBalance,null,move);
    return [move,{bass:Object.fromEntries(bassOf(c.song.events).map(n=>[n.id,n.velocity])),drums:mean(c.song.events.filter(n=>n.role==='drums').map(n=>n.velocity))}];}));
  const want=levels(field);
  for(const [id,v] of Object.entries(want.band.bass))assert.ok(Math.abs(v-field.bandBasis[id]*SOFT_BAND_FACTOR)<1e-9,`${id}: the softer band bass`);
  const kept=(await keepFlow(field,scheduler,score.doc,'melody-field-back')).doc;
  assert.equal(kept.capture_notes.melody_field.context.bandBalance,1);
  assert.ok(wheelBass(kept.notes).length>0,'the Jam now plays the kept line');
  const {compiled,captured}=jamCapture(kept);
  // _enterMelodyField builds its context with melodyEntryContext: the record and the Softer band it was kept with.
  const context=melodyEntryContext(kept,captured,compiled.events);
  assert.equal(context.composerVersion,9);assert.equal(context.bassWheel.move,'funky-full');
  assert.equal(context.bandBalance,1,'the saved Softer band comes too');
  assert.ok(Object.keys(context.bandBasis).every(id=>compiled.events.some(e=>e.id===id)),'only levels of notes still in the score');
  const next=bassSession('soul-v1',{context,song:compiled,doc:kept}).field;
  assert.equal(next.bassReason,null);assert.equal(next.initialBassMove,'funky-full');
  assert.equal(next.bandBalance,true,'the session opens with the band still softer');
  const got=levels(next);
  for(const move of moves) {
    assert.deepEqual(Object.keys(got[move].bass).sort(),Object.keys(want[move].bass).sort(),`${move}: same notes`);
    // Within half a percent (the bug was 120%): compileReturnSong, the capture used here, reports the kept Jam's swing as
    // .5 (the doc says .52), so a way's offbeat sixteenths sit .02 step earlier and its level trim moves by under 0.1%.
    for(const [id,v] of Object.entries(want[move].bass))assert.ok(Math.abs(got[move].bass[id]/v-1)<.005,`${move} ${id}: ${got[move].bass[id]} plays at the kept level ${v}`);
    assert.ok(Math.abs(got[move].drums-want[move].drums)<1e-9,`${move}: the drums stay as soft`);
  }
  // Negative control: the context before this fix (the record alone) plays the band bass about 2.2 times louder.
  const before=bassSession('soul-v1',{context:{...captured,composerVersion:9,bassWheel:structuredClone(savedBassWheel(kept))},song:compiled,doc:kept}).field;
  assert.equal(before.bandBalance,false);
  const loud=levels(before).band.bass,ratio=mean(Object.values(loud))/mean(Object.values(want.band.bass));
  assert.ok(ratio>2,`without the saved Softer band the band bass jumps ${ratio.toFixed(2)}x`);
  // A band made again since (its levels are no longer the kept mix) carries nothing: the session never guesses.
  const remade=compiled.events.map(e=>e.role==='drums'&&e.provenance==='jam_generated'?{...e,velocity:Math.min(1,e.velocity/SOFT_BAND_FACTOR)}:e);
  const guarded=melodyEntryContext(kept,captured,remade);
  assert.equal(Object.hasOwn(guarded,'bandBalance'),false);assert.equal(Object.hasOwn(guarded,'bandBasis'),false);
  assert.equal(guarded.bassWheel.move,'funky-full');
  // No kept line: the context is exactly as before.
  const plain=jamScore('soul-v1');
  const fresh=melodyEntryContext(plain.doc,captureMelodyContext(plain.song,{phraseContext:docPhraseContext(plain.doc)}),plain.song.events);
  assert.deepEqual(Object.keys(fresh).filter(k=>['bassWheel','bandBalance','bandBasis'].includes(k)),[]);
  assert.equal(melodyEntryContext(plain.doc,null,plain.song.events),null);
});

test('a Keep at full band level carries its saved levels too; they match the Jam, so nothing changes level',async()=>{
  const {field,scheduler,score}=bassSession('house-v1');
  field.setWheel('bass');field.selectBass('walk-big');hear(field,scheduler);
  const kept=(await keepFlow(field,scheduler,score.doc,'melody-field-back')).doc;
  const {compiled,captured}=jamCapture(kept);
  const context=melodyEntryContext(kept,captured,compiled.events);
  assert.equal(context.bandBalance,0);
  const next=bassSession('house-v1',{context,song:compiled,doc:kept}).field;
  assert.equal(next.bandBalance,false);
  const opening=next._candidate(next.position);
  assert.deepEqual(bassOf(opening.song.events).map(n=>[n.id,n.velocity]),bassOf(compiled.events).map(n=>[n.id,n.velocity]),'the kept line plays as the Jam plays it');
});

// ---- 3. Original and Undo on the Bass wheel say what they change ----
test('Bass wheel Original after a tune move: the button reads Your changes and the status says the tune changed',()=>{
  const {field,scheduler}=bassSession('soul-v1');
  const parts=mountLight(field);
  field.request({x:0,y:.5});field.remember({x:0,y:0});hear(field,scheduler);
  field.setWheel('bass');field.paint();
  assert.equal(parts.original.textContent,'Original');
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.deepEqual(field.position,{x:0,y:0},'Original turns the whole session back, the tune too');
  assert.equal(parts.original.textContent,'Your changes','not New bass: the bass never changed');
  assert.ok(words(parts.original.textContent)<=3);
  assert.equal(parts.status.textContent,`Playing: Band bass. ${BASS_TUNE_CHANGED}`);
  // Back to the changes: the tune comes back, and the status says so again.
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.deepEqual(field.position,{x:0,y:.5});
  assert.equal(parts.original.textContent,'Original');
  assert.equal(parts.status.textContent,`Playing: Band bass. ${BASS_TUNE_CHANGED}`);
  // The next bass move is about the bass alone.
  field.selectBass('deep-full');hear(field,scheduler);field.paint();
  assert.equal(parts.status.textContent,'Playing: Deep bass. It is full. Long low notes.');
});

test('Bass wheel Original after a bass move alone still reads New bass, with no tune line',()=>{
  const {field,scheduler}=bassSession('soul-v1');
  const parts=mountLight(field);
  field.setWheel('bass');field.selectBass('funky-big');hear(field,scheduler);
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.equal(parts.original.textContent,'New bass');
  assert.equal(parts.status.textContent,'The band bass is back. Your tune stays.');
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.equal(parts.status.textContent,'Playing: Funky bass. It is big. Short notes with gaps.');
  // Tune and bass both moved: Your changes, and the tune is named.
  field.setWheel('tune');field.request({x:.7,y:.7});field.remember({x:0,y:0});field.setWheel('bass');hear(field,scheduler);
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.equal(parts.original.textContent,'Your changes');
  assert.match(parts.status.textContent,new RegExp(`${BASS_TUNE_CHANGED.replace('.','\\.')}$`));
});

test('Bass wheel Original after a sound move says the sound changed; the Tune wheel says New sound',()=>{
  const {field,scheduler}=bassSession('house-v1');
  const parts=mountLight(field);
  field.request({x:0,y:.5});field.remember({x:0,y:0});hear(field,scheduler);
  field.setWheel('sound');field.selectSound('sampled_marimba_v1');hear(field,scheduler);
  field.setWheel('bass');field.request({x:0,y:0});hear(field,scheduler);
  // Only the sound differs from the opening now.
  field.toggleOriginal();hear(field,scheduler);field.paint();
  assert.equal(field.soundPatch,null);
  assert.equal(parts.original.textContent,'Your changes');
  assert.equal(parts.status.textContent,`Playing: Band bass. ${BASS_SOUND_CHANGED}`);
  field.toggleOriginal();field.setWheel('tune');field.toggleOriginal();field.paint();
  assert.equal(parts.original.textContent,'New sound','the Tune wheel names the sound it brings back (audit S17)');
});

test('Undo on the Bass wheel says when it changed the tune; a bass Undo says nothing more',()=>{
  const {field,scheduler}=bassSession('reggae-v1');
  const parts=mountLight(field);
  field.setWheel('bass');field.selectBass('walk-full');hear(field,scheduler);
  field.setWheel('tune');field.request({x:0,y:.5});field.remember({x:0,y:0});hear(field,scheduler);
  field.setWheel('bass');
  field.undo();hear(field,scheduler);field.paint();
  assert.deepEqual(field.position,{x:0,y:0},'Undo walked back the tune move');
  assert.equal(parts.status.textContent,`Playing: Walk bass. It is full. Steps up and down. ${BASS_TUNE_CHANGED}`);
  field.undo();hear(field,scheduler);field.paint();
  assert.equal(field.bassMove,BASS_BAND);
  assert.equal(parts.status.textContent,'The band bass is back. Your tune stays.');
  // While stopped the line is said too.
  field.selectBass('chill-light');field.setWheel('tune');field.request({x:.7,y:.7});field.remember({x:0,y:0});field.setWheel('bass');
  scheduler.isPlaying=false;field.undo();field.paint();
  assert.equal(parts.status.textContent,`Stopped. Press Play to hear your next bass. ${BASS_TUNE_CHANGED}`);
});

test('the new words are grade 2 and short',()=>{
  assert.deepEqual(grade2([BASS_TUNE_CHANGED,BASS_SOUND_CHANGED,'Your changes',`Playing: Band bass. ${BASS_TUNE_CHANGED}`,`Playing: Funky bass. It is big. ${BASS_SOUND_CHANGED}`,
    `The band bass is back. Your tune stays. ${BASS_TUNE_CHANGED}`,`Stopped. Press Play to hear this bass. ${BASS_TUNE_CHANGED}`]),[]);
});

// ---- 5. A tap on the chosen way's label is a press of that button ----
/** Enough DOM for bind() on the Bass wheel, with each button's box from its place and a pill size. */
function mount(field,{size=296}={}) {
  const doc={activeElement:null};globalThis.document=doc;
  const element=(tag,attrs)=>({tag,attrs,disabled:false,
    getAttribute(k){return Object.hasOwn(this.attrs,k)?this.attrs[k]:null;},setAttribute(k,v){this.attrs[k]=String(v);},
    hasAttribute(k){return Object.hasOwn(this.attrs,k);},removeAttribute(k){delete this.attrs[k];},
    querySelector(sel){return sel==='[data-bass-size]'?this.size||null:null;},focus(){doc.activeElement=this;},
    getBoundingClientRect(){
      const place=(this.attrs.style||'').match(/left:([\d.]+)%;top:([\d.]+)%/);if(!place)return {left:0,top:0,right:0,bottom:0,width:0,height:0};
      const cx=Number(place[1])/100*size,cy=Number(place[2])/100*size,w=60,h=this.size?.textContent?36:22;
      return {left:cx-w/2,right:cx+w/2,top:cy-h/2,bottom:cy+h/2,width:w,height:h};
    }});
  const parse=html=>[...html.matchAll(/<(button|path|circle)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map(([,tag,a,inner])=>{
    const el=element(tag,Object.fromEntries([...a.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])));
    const sz=inner.match(/data-bass-size>([^<]*)</);if(sz)el.size={textContent:sz[1]};
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
  const map={'[data-melody-disk]':disk,'[data-mf-status]':node(),'[data-key="melody-field-keep"]':node(),'[data-mf-keep-help]':node(),'[data-mf-bass-softer]':node(),'[data-key="melody-field-original"]':node()};
  field.bind({querySelector:sel=>map[sel]||null,querySelectorAll:()=>[]});
  const fire=(type,extra={})=>{const e={type,button:0,pointerId:1,preventDefault(){},stopPropagation(){},...extra};(listeners[type]||[]).forEach(f=>f(e));return e;};
  const at=(type,[px,py])=>fire(type,{clientX:px,clientY:py});
  const el=k=>disk.els.find(e=>e.attrs['data-key']===k);
  const centre=k=>{const r=el(k).getBoundingClientRect();return [(r.left+r.right)/2,(r.top+r.bottom)/2];};
  const toPx=(deg,r)=>[(1+Math.sin(deg*Math.PI/180)*r)*size/2,(1-Math.cos(deg*Math.PI/180)*r)*size/2];
  return {disk,doc,at,el,centre,toPx};
}

test('a tap on the chosen way\'s label changes its size like Enter (Big to Light, Full to Big); one Undo entry',()=>{
  const {field}=bassSession('house-v1');field.setWheel('bass');
  const w=mount(field);
  field.chooseBass('funky-big');
  const funky='melody-field-bass-4',h=field.history.length;
  const c=w.centre(funky);
  w.at('pointerdown',c);
  assert.equal(field.bassMove,'funky-big','a press on the label waits for the tap to end');
  w.at('pointerup',c);
  assert.equal(field.bassMove,'funky-light','the same as pressBassWay(4): Big to Light');
  assert.equal(field.history.length,h+1,'one Undo entry for the tap');
  assert.equal(w.doc.activeElement,w.el(funky),'focus stays on the label');
  // A key press on the same button does the same, so pointer and keys agree.
  const keys=bassSession('house-v1').field;keys.setWheel('bass');keys.chooseBass('funky-big');keys.pressBassWay(4);
  assert.equal(keys.bassMove,'funky-light');
  // Light to Full, then Full to Big, by tapping the label each time (its box follows the size line).
  w.at('pointerdown',w.centre(funky));w.at('pointerup',w.centre(funky));assert.equal(field.bassMove,'funky-full');
  w.at('pointerdown',w.centre(funky));w.at('pointerup',w.centre(funky));assert.equal(field.bassMove,'funky-big');
  field.undo();assert.equal(field.bassMove,'funky-full','Undo walks the taps back one at a time');
  // Negative control: the label of a way that is not chosen still plays that way at Full (a press, as before).
  const deep=w.centre('melody-field-bass-0');
  w.at('pointerdown',deep);assert.equal(field.bassMove,'deep-full');w.at('pointerup',deep);
});

test('a drag that starts on the chosen label and leaves it is an ordinary drag; a cancelled tap does nothing',()=>{
  const {field}=bassSession('house-v1');field.setWheel('bass');
  const w=mount(field);
  field.chooseBass('steady-big');
  const steady=w.centre('melody-field-bass-1'),h=field.history.length;
  w.at('pointerdown',steady);
  // Out to the Big ring of Walk: the move follows the disk, as any drag does.
  w.at('pointermove',w.toPx(118,.9));
  assert.equal(field.bassMove,'walk-big');
  w.at('pointermove',w.toPx(118,.66));
  assert.equal(field.bassMove,'walk-full');
  w.at('pointerup',w.toPx(118,.66));
  assert.equal(field.bassMove,'walk-full','letting go off the label never changes the size again');
  assert.equal(field.history.length,h+1,'one Undo entry for the drag');
  // A small wobble that stays on the label is still a tap.
  field.chooseBass('steady-big');const h2=field.history.length;
  w.at('pointerdown',steady);w.at('pointermove',[steady[0]+3,steady[1]+2]);w.at('pointerup',[steady[0]+3,steady[1]+2]);
  assert.equal(field.bassMove,'steady-light');assert.equal(field.history.length,h2+1);
  // Cancelled (the browser took the pointer): nothing is pressed.
  const now=field.bassMove,h3=field.history.length,c=w.centre('melody-field-bass-1');
  w.at('pointerdown',c);w.at('pointercancel',c);
  assert.equal(field.bassMove,now);assert.equal(field.history.length,h3);
  // The middle stays a plain press: on the band bass it changes nothing, as Enter on it does.
  field.chooseBass(BASS_BAND);const h4=field.history.length;
  w.at('pointerdown',w.toPx(0,0));w.at('pointerup',w.toPx(0,0));
  assert.equal(field.bassMove,BASS_BAND);assert.equal(field.history.length,h4);
});

// ---- 6. A kept wheel bass that gives way on a band change is said in the same message ----
// The real app._announce from static/ui/app.js, so a test reads what the live region finally says: it clears, then
// writes after 50 ms, and a message said within those 50 ms replaces the one waiting (a notice in it is lost).
const APP_SOURCE=fs.readFileSync(new URL('../../../static/ui/app.js',import.meta.url),'utf8');
const ANNOUNCE_SOURCE=APP_SOURCE.match(/\n  (_announce\(text,[^\n]*\{\r?\n[\s\S]*?\n  \})\r?\n/)?.[1];
function appAnnouncer(region) {
  assert.ok(ANNOUNCE_SOURCE,'app.js still has _announce');
  return new Function('document',`return {${ANNOUNCE_SOURCE}};`)({getElementById:id=>id==='sr-announcer'?region:null});
}
function jamFlow() {
  const values=new Map();
  globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},scrollTo(){}};
  const flow=Object.create(PlayFlow.prototype);
  flow.root={querySelector:()=>null,querySelectorAll:()=>[]};
  const said=[],region={textContent:''},announcer=appAnnouncer(region);
  flow.app={scheduler:{isPlaying:false,stopGeneration:0,spotlightRole:null,audioCtx:{currentTime:0},setCompiledSong(){},setLoopRange(){},setRepeatPlayback(){},clearMuteLayers(){},
    setSpotlightRole(){},unlock:async()=>{},previewSound(){},stop(){},start(){},capturePerformance:()=>null,activeJamBacking:()=>null,
    queueContinuousPartAudition:()=>({ok:true}),getPartAuditionState:()=>null,masterBus:{piano:{},disposed:false}},
    playFlow:flow,
    // app.js: the play flow adds any notice that belongs to this action; said lists each spoken message.
    _announce(text,opts={}){this.lastAppend=Boolean(opts.append);return announcer._announce.call(this,text,opts);},
    onAnnounce(text){said.push({text,append:this.lastAppend});},_logSessionEvent(){}};
  flow.render=()=>{};flow._sparkAt=()=>{};flow.stage='start';flow.trail=[];flow.confirm={};flow._freshState();
  flow.stage='jam';
  return {flow,said,region};
}
const press=(flow,key)=>flow._onClick({target:{closest:()=>({dataset:{key},focus(){}})}});
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
/** Past the live region's 50 ms write. */
const settle=()=>new Promise(resolve=>setTimeout(resolve,80));
const count=(text,part)=>text.split(part).length-1;
async function keptJam(scene='soul-v1') {
  const {field,scheduler,score}=bassSession(scene);field.setWheel('bass');field.selectBass('walk-big');hear(field,scheduler);
  return (await keepFlow(field,scheduler,score.doc,'melody-field-back')).doc;
}

test('a band change that removes the kept wheel bass says so in that action\'s one message',async()=>{
  const kept=await keptJam();
  const {flow,said,region}=jamFlow();
  flow.doc=structuredClone(kept);flow._compile();
  assert.ok(wheelBass(flow.doc.notes).length>0);
  await press(flow,'jam-density:more');await tick();
  assert.equal(wheelBass(flow.doc.notes).length,0,'the band brings its own bass (jam_session.js)');
  assert.deepEqual(said,[{text:`${jamDirectionDescription(flow.doc)} ${BASS_GAVE_WAY}`,append:false}],'one announcement carries both');
  await settle();
  assert.equal(region.textContent,`${jamDirectionDescription(flow.doc)} ${BASS_GAVE_WAY}`,'and the live region reads it');
  // No kept wheel bass left: the next change says only its own words.
  said.length=0;await press(flow,'jam-density:less');await tick();
  assert.deepEqual(said,[{text:jamDirectionDescription(flow.doc),append:false}]);
  // Undo brings the kept line back without the notice.
  said.length=0;await press(flow,'undo');await tick();
  assert.ok(said.every(s=>!s.text.includes(BASS_GAVE_WAY)));
});

test('a band change that says nothing gets the notice alone, joined to any message still waiting; a change that keeps the bass says nothing',async()=>{
  const kept=await keptJam('reggae-v1');
  const {flow,said,region}=jamFlow();
  flow.doc=structuredClone(kept);flow._compile();
  // A music-field move announces nothing itself.
  flow._acceptJamDoc(setJamDirection(flow.doc,{scene_variant:'space'}));
  assert.deepEqual(said,[],'nothing yet: the action may still speak');
  await tick();
  assert.deepEqual(said,[{text:BASS_GAVE_WAY,append:true}],'then the notice, joined to a message still waiting to be written');
  await settle();assert.equal(region.textContent,BASS_GAVE_WAY);
  // Responsive keeps the kept line: no notice.
  const again=jamFlow();again.flow.doc=structuredClone(kept);again.flow._compile();
  await press(again.flow,'jam-responsive');await tick();
  assert.ok(wheelBass(again.flow.doc.notes).length>0);
  assert.ok(again.said.every(s=>!s.text.includes(BASS_GAVE_WAY)),JSON.stringify(again.said));
  // A Jam with no kept line: no notice.
  const plain=jamFlow();plain.flow._acceptJamDoc(startJam(plain.flow.doc,{kind:'pitched',patchId:'warm_keys'}));
  await press(plain.flow,'jam-density:more');await tick();
  assert.ok(plain.said.every(s=>!s.text.includes(BASS_GAVE_WAY)));
  assert.deepEqual(grade2([BASS_GAVE_WAY,`More rhythm. Band sound 2 of 5. Your notes stay. ${BASS_GAVE_WAY}`]),[]);
});

test('the band hand\'s offers over a kept wheel bass: the live region ends on the Undo message, with the notice once',async()=>{
  // _handKey says the receipt, then the Undo message within 50 ms: the notice must ride on the Undo message, the last.
  const offers=[[{kind:'density',value:2,heard:'You play a lot.',move:'More movement',through:3},'You played a lot. Band: more movement.'],
    [{kind:'density',value:0,heard:'You leave room.',move:'More space',through:3},'You held notes. Band: more space.'],
    [{kind:'root',value:7,heard:'You lean on G.',move:'Make G home',through:3},'You leaned on a note. Band: G is home.']];
  const kept=await keptJam();
  for(const [offer,receipt] of offers) {
    const {flow,said,region}=jamFlow();
    flow.doc=structuredClone(kept);flow._compile();
    assert.ok(wheelBass(flow.doc.notes).length>0);
    flow.bandHand=offer;flow._handKey('hand-take');
    assert.equal(wheelBass(flow.doc.notes).length,0,`${offer.move}: the band brings its own bass`);
    await settle();
    const undo=`${offer.move}: done at the next bar. Undo brings it back.`;
    assert.equal(region.textContent,`${undo} ${BASS_GAVE_WAY}`,offer.move);
    assert.equal(count(region.textContent,BASS_GAVE_WAY),1);
    assert.deepEqual(said.map(s=>s.text),[receipt,`${undo} ${BASS_GAVE_WAY}`],'spoken: the receipt, then the Undo message with the notice');
  }
  // Negative controls: the hand's swing offer after a Keep plays nothing new (the band stays straight), so the kept
  // line stays and nothing is added; with no kept line there is no notice either.
  const swing=jamFlow();swing.flow.doc=structuredClone(kept);swing.flow._compile();
  swing.flow.bandHand={kind:'swing',value:.62,heard:'You play off the beat.',move:'Swing the band',through:3};swing.flow._handKey('hand-take');
  assert.ok(wheelBass(swing.flow.doc.notes).length>0,'the kept line stays');
  await settle();assert.equal(swing.region.textContent,'Swing the band: done at the next bar. Undo brings it back.');
  const plain=jamFlow();plain.flow._acceptJamDoc(startJam(plain.flow.doc,{kind:'pitched',patchId:'warm_keys'}));await settle();
  plain.flow.bandHand=offers[0][0];plain.flow._handKey('hand-take');
  await settle();assert.equal(plain.region.textContent,'More movement: done at the next bar. Undo brings it back.');
  assert.ok(plain.said.every(s=>!s.text.includes(BASS_GAVE_WAY)));
});

// ---- 7. The bass path says bass, and child words ----
test('entry words name the card the child pressed and say bass on the bass path; all grade 2',()=>{
  const cards={tune:'Make my tune',sound:'Change the sound',bass:'Feel the bass'};
  const texts=[];
  for(const [wheel,card] of Object.entries(cards)) {
    const w=wheelEntryWords(wheel);
    assert.equal(w.card,card);
    assert.equal(w.changed,`Your band changed. Press ${card} again when it plays.`);
    texts.push(...['listen','here','stays','starting','changed'].map(k=>w[k]));
  }
  const bass=wheelEntryWords('bass');
  for(const k of ['listen','here','stays','starting','changed'])assert.doesNotMatch(bass[k],/tune|Make my/i,`${k}: ${bass[k]}`);
  assert.equal(wheelEntryWords('nope').card,'Make my tune');
  assert.deepEqual(grade2(texts),[]);
  // Way hints in child words: the app calls the drums the beat, never the kick.
  for(const w of BASS_WAYS)for(const size of [null,...BASS_SIZES.map(s=>s.id)])assert.doesNotMatch(bassWayLabel(w.id,size),/kick/i);
  assert.equal(bassWayLabel('steady'),'Steady bass. Plays with the beat.');
  // One source of words: every way button says its BASS_WAYS hint (bass_wheel.js), with no UI override.
  for(const w of BASS_WAYS)assert.equal(bassWayLabel(w.id),`${w.label} bass. ${w.hint}`);
  assert.deepEqual(grade2(BASS_WAYS.flatMap(w=>[null,...BASS_SIZES.map(s=>s.id)].map(size=>bassWayLabel(w.id,size)))),[]);
});

/** A Jam on a real band, playing, with a capture of its band notes, as _enterMelodyField reads it. */
function entryFlow({wheel='bass',capture='full'}={}) {
  const {flow,said}=jamFlow();
  const {doc,song,context}=jamScore('soul-v1');
  flow.doc=structuredClone(doc);flow.stage='jam';
  const backing={events:structuredClone(song.events.filter(e=>e.provenance==='jam_generated')),phraseContext:docPhraseContext(doc)};
  const cycle=song.total_steps*15/song.bpm;
  const full={source_song_id:doc.id,bpm:song.bpm,start:0,end:cycle,bars:4,steps_per_bar:16,
    events:song.events.filter(e=>e.role==='bass').slice(0,3).map((event,occurrence)=>({event,time:event.start_sec,duration:event.duration_sec,occurrence}))};
  Object.assign(flow.app.scheduler,{isPlaying:true,compiledSong:song,gridOriginTime:0,activeJamBacking:()=>backing,
    capturePerformance:()=>capture==='none'?null:capture==='partial'?{...full,end:undefined}:full});
  return {flow,said,wheel,context};
}
async function enter(setup,{bandLands=false}={}) {
  const real=MelodyFieldSession.prototype.prepare;
  MelodyFieldSession.prototype.prepare=async function(){if(bandLands)setup.flow.circleIntent={id:'house-v1'};};
  try{await setup.flow._enterMelodyField(setup.wheel==='tune'?{}:setup.wheel==='sound'?{sound:true}:{wheel:'bass'});}
  finally{MelodyFieldSession.prototype.prepare=real;}
  await tick();
  return setup.said.map(s=>s.text);
}

test('Feel the bass: the band-changed, empty and failed entries speak of the bass card and the bass',async()=>{
  assert.deepEqual(await enter(entryFlow({capture:'none'})),[wheelEntryWords('bass').listen]);
  assert.deepEqual(await enter(entryFlow({capture:'full'}),{bandLands:true}),['Your band changed. Press Feel the bass again when it plays.']);
  const failed=await enter(entryFlow({capture:'partial'}));
  assert.equal(failed.length,1);assert.match(failed[0],/^Your bass stays\. /);
  // The other cards keep their own names.
  assert.deepEqual(await enter(entryFlow({wheel:'tune',capture:'full'}),{bandLands:true}),['Your band changed. Press Make my tune again when it plays.']);
  assert.deepEqual(await enter(entryFlow({wheel:'sound',capture:'full'}),{bandLands:true}),['Your band changed. Press Change the sound again when it plays.']);
  assert.deepEqual(await enter(entryFlow({wheel:'tune',capture:'none'})),[wheelEntryWords('tune').listen]);
});

test('a picked band that is still starting says which wheel opens when it plays',async()=>{
  for(const wheel of ['tune','sound','bass']) {
    const {flow,said}=jamFlow();
    flow.doc={id:'starting',jam_session:{scene_id:'house-v1'}};
    let pending=true;flow._pickedBandPending=()=>pending;
    flow.app.scheduler.isPlaying=true;
    const realSetTimeout=globalThis.setTimeout;
    globalThis.setTimeout=(cb,ms)=>{if(ms===100)pending=false;return realSetTimeout(cb,0);};
    try{assert.equal(await flow._awaitPickedBand(wheel),true);}finally{globalThis.setTimeout=realSetTimeout;}
    assert.deepEqual(said.map(s=>s.text),[wheelEntryWords(wheel).starting]);
  }
});

// ---- 4. Forced colours (CSS; the browser measures it in a development tool) ----
test('CSS forced colours: the heard mark has its own Canvas chip, the hub uses no fixed colour on Highlight, unchosen way labels sit on Canvas',()=>{
  const all=fs.readFileSync(new URL('../../../static/css/studio.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  const blocks=[];let depth=0,start=0,prelude='';
  for(let i=0;i<all.length;i++){
    if(all[i]==='{'){if(depth===0){prelude=all.slice(start,i).trim();start=i+1;}depth++;}
    else if(all[i]==='}'){depth--;if(depth===0){blocks.push({prelude,body:all.slice(start,i)});start=i+1;}}
  }
  const forced=blocks.filter(b=>/^@media \(forced-colors: active\)/.test(b.prelude)&&/\.pf-bass-sector/.test(b.body));
  assert.equal(forced.length,1);
  const inner=[...forced[0].body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({sel:m[1].trim(),body:m[2]}));
  const rule=sel=>inner.filter(r=>r.sel.split(',').map(s=>s.trim()).includes(sel)).map(r=>r.body).join(';');
  const chip=rule('.pf-bass-sector[data-heard="true"]::after');
  assert.match(chip,/forced-color-adjust:\s*none/);assert.match(chip,/background:\s*Canvas/);assert.match(chip,/color:\s*CanvasText/);assert.match(chip,/border:\s*[^;]*CanvasText/);
  // The hub's heard mark had a fixed #05070c on Highlight: under forced colours it is the same chip.
  assert.match(rule('.pf-bass-hub[data-heard="true"][data-chosen="true"]::after'),/color:\s*CanvasText/);
  assert.match(rule('.pf-bass-way:not([data-chosen="true"])'),/background:\s*Canvas/);
  // The non-forced heard and chosen fills of the picture are restated with system colours (its own colours are kept).
  assert.match(rule('.pf-bass-hub-cell[data-heard="true"]'),/fill:\s*Canvas/);
  assert.match(rule('.pf-bass-hub-cell[data-chosen="true"]'),/fill:\s*Highlight/);
  assert.match(rule('.pf-bass-cell[data-heard="true"]'),/fill-opacity:\s*1/);
  // No fixed colour anywhere in the forced block.
  assert.doesNotMatch(forced[0].body,/#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.ok(BASS_RING_EDGES.length===2);
});
