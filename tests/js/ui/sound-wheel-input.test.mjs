// Sound wheel input and access (13 Nov 2026 review): the middle's radial hold, drags through the middle,
// the heard mark while the bank loads, key memory per group, native Tab stops, Own sound in the arrow cycle,
// view-change announcements, modifier keys, forced colours, Bigger mode and label room on small disks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as wheel from '../../../static/ui/melody_field_session.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';

const {MELODY_SOUNDS,MELODY_SOUND_FAMILIES,MelodyFieldSession,soundKeyMove,soundSector,SOUND_HUB_RADIUS,SOUND_HUB_MARGIN}=wheel;

const at=(deg,r=.7)=>[Math.sin(deg*Math.PI/180)*r,Math.cos(deg*Math.PI/180)*r];
const groupNames=MELODY_SOUND_FAMILIES.map(f=>f.name);
const soundKey=patch=>`melody-field-sound-${MELODY_SOUNDS.findIndex(s=>s.patch===patch)}`;

function session({melodySound=null,leadPatch='synth_lead',loading=null}={}) {
  const lead={id:'g1',role:'lead',step:0,duration_steps:4,velocity:.7,patch_id:leadPatch,provenance:'jam_generated',concrete:{midi_pitch:64}};
  const sourceDoc={id:'wheel',global_context:{bpm:100,bars:4,root_pc:0},notes:[lead],arrangement_mode:'loop'};
  const song={song_id:'wheel',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:[lead]};
  const queued=[];
  const scheduler={isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,loadingSession:loading,audition:null,
    getPartAuditionState(){return this.audition;},
    queueContinuousPartAudition(_view,{requestId}){queued.push(requestId);return {ok:true};}};
  const phraseContext={version:1,composerVersion:7,root:0,melodySound};
  const field=new MelodyFieldSession(song,{scheduler,captureOrigin:0,sourceDoc,phraseContext});
  field.palette={original:{notes:[lead]}};
  field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return {field,queued,scheduler};
}

/** Just enough DOM for bind(), paint() and the Sound wheel: the disk's buttons are parsed from the real markup. */
function mount(field,{size=230}={}) {
  const doc={activeElement:null};globalThis.document=doc;
  const element=attrs=>({attrs,disabled:false,
    get dataset(){const d={};for(const [k,v] of Object.entries(this.attrs))if(k.startsWith('data-'))d[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;return d;},
    getAttribute(k){return Object.hasOwn(this.attrs,k)?this.attrs[k]:null;},setAttribute(k,v){this.attrs[k]=String(v);},
    hasAttribute(k){return Object.hasOwn(this.attrs,k);},removeAttribute(k){delete this.attrs[k];},
    querySelector(sel){return sel==='[data-sound-now]'?this.now||null:null;},focus(){doc.activeElement=this;}});
  const parse=html=>[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([,a,inner])=>{
    const el=element(Object.fromEntries([...a.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])));
    const now=inner.match(/data-sound-now>([^<]*)</);if(now)el.now={textContent:now[1]};
    return el;});
  const listeners={},said=[];
  const disk={dataset:{soundView:field.soundView||''},attrs:{},els:[],
    classList:{contains:c=>c==='pf-sound-disk'},
    set innerHTML(h){this.els=parse(h);},
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},
    querySelectorAll(sel){const m=sel.match(/^\[([\w-]+)\]$/);return m?this.els.filter(e=>e.hasAttribute(m[1])):[];},
    querySelector(sel){
      let m=sel.match(/^\[data-key="([^"]+)"\]$/);if(m)return this.els.find(e=>e.attrs['data-key']===m[1])||null;
      m=sel.match(/^\[data-key\]\[([\w-]+)="([^"]*)"\]$/);if(m)return this.els.find(e=>e.hasAttribute('data-key')&&e.attrs[m[1]]===m[2])||null;
      return sel==='[data-key]'?this.els[0]||null:null;},
    contains(x){return x===this||this.els.includes(x);},
    addEventListener(t,f){(listeners[t]||=[]).push(f);},
    getBoundingClientRect(){return {left:0,top:0,width:size,height:size};},
    setPointerCapture(){},focus(){doc.activeElement=this;(listeners.focus||[]).forEach(f=>f());}};
  disk.innerHTML=field.html().match(/data-melody-disk[^>]*>([\s\S]*?)<p class="pf-sub" data-mf-status/)[1];
  const say={_t:'',get textContent(){return this._t;},set textContent(v){this._t=v;if(v)said.push(v);}};
  const status={textContent:''},prompt={dataset:{}};
  const parts={'[data-melody-disk]':disk,'[data-mf-sound-say]':say,'[data-mf-status]':status,'[data-mf-sound-prompt]':prompt};
  const root={querySelector:sel=>parts[sel]||null,querySelectorAll:()=>[]};
  field.bind(root);
  const fire=(type,extra={})=>{const e={type,button:0,pointerId:1,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra};(listeners[type]||[]).forEach(f=>f(e));return e;};
  const pointer=(type,[x,y])=>fire(type,{clientX:(x+1)*size/2,clientY:(1-y)*size/2});
  const key=(k,mods={})=>fire('keydown',{key:k,...mods});
  return {disk,say,said,status,doc,fire,pointer,key};
}

test('soundSector: the middle holds a drag until .05 past its edge, and a sector holds until .05 inside it', () => {
  assert.equal(SOUND_HUB_MARGIN,.05);
  const rows=[
    // [view, x, y, prev, expected, why]
    [null,0,.299,null,'hub','a fresh press uses the plain .30 edge'],
    [null,0,.301,null,0,'a fresh press just outside is the group'],
    [null,0,.29,0,0,'a held group stays just inside the edge'],
    [null,0,.26,0,0,'... until .05 inside it'],
    [null,0,.249,0,'hub','.05 inside the edge, the middle takes over'],
    [null,0,.31,'hub','hub','a held middle stays just outside its edge'],
    [null,0,.349,'hub','hub','... until .05 past it'],
    [null,0,.351,'hub',0,'.05 past the edge, the group takes over'],
    ['Keys',...at(90,.27),1,1,'sound rings hold the same way'],
    ['Keys',...at(90,.24),1,'hub','and give way at .25'],
    ['World',...at(240,.34),'hub','hub','a press in the middle that drifts .04 out is still in the middle'],
    ['World',...at(240,.36),'hub',2,'a press in the middle that leaves it reaches the sound'],
    [null,0,.1,3,'hub','deep in the middle is always the middle'],
  ];
  for(const [view,x,y,prev,want,why] of rows)assert.equal(soundSector(view,x,y,prev),want,`${why} (${view},${x.toFixed(3)},${y.toFixed(3)},${prev})`);
  assert.equal(SOUND_HUB_RADIUS,.3);
});

test('a finger resting on the middle edge of the group ring no longer flips between a group and Own sound', () => {
  const {field,queued}=session();field.setSoundMode(true);
  const w=mount(field);
  w.pointer('pointerdown',at(0,.32));
  assert.equal(field.soundPatch,'sampled_piano_v1');
  for(let i=0;i<6;i++){w.pointer('pointermove',at(0,i%2?.31:.29));assert.equal(field.soundPatch,'sampled_piano_v1',`jitter ${i} keeps Piano`);}
  assert.equal(queued.length,1,'one audition for the whole press');
  w.pointer('pointerup',at(0,.3));
  assert.equal(field.soundView,'Keys','letting go on Keys shows its sounds');
  assert.equal(field.history.length,1);
});

test('a press in the middle of a sound ring that drifts just past its edge still shows all groups', () => {
  const {field}=session({melodySound:'sampled_steel_drums_v1'});field.setSoundMode(true);field.openSoundFamily('World');
  const w=mount(field);
  w.pointer('pointerdown',at(240,.28));
  w.pointer('pointermove',at(240,.31));
  w.pointer('pointerup',at(240,.29));
  assert.equal(field.soundView,null,'All groups');
  assert.equal(field.soundPatch,'sampled_steel_drums_v1','no sound chosen');
  assert.equal(field.history.length,0);
});

test('dragging across the group ring through the middle holds the last sound', () => {
  const {field,queued}=session();field.setSoundMode(true);
  const w=mount(field);
  const picks=[];const select=field.selectSound.bind(field);field.selectSound=p=>{picks.push(p);return select(p);};
  const [x0,y0]=at(80,.7),[x1,y1]=at(240,.7);
  w.pointer('pointerdown',[x0,y0]);
  for(let i=1;i<=200;i++){const t=i/200;w.pointer('pointermove',[x0+(x1-x0)*t,y0+(y1-y0)*t]);}
  w.pointer('pointerup',[x1,y1]);
  assert.ok(!picks.includes(null),`no Own sound mid-drag: ${JSON.stringify(picks)}`);
  assert.ok(queued.every(id=>/:sound:/.test(id)),`no Own sound audition: ${JSON.stringify(queued)}`);
  assert.equal(field.soundPatch,'sampled_recorder_v1');assert.equal(field.soundView,'Wind');
  assert.equal(field.history.length,1,'one Undo entry for the gesture');
});

test('letting go in the middle of the group ring after a drag chooses Own sound, one Undo entry', () => {
  {
    const {field}=session({melodySound:'sampled_kalimba_v1'});field.setSoundMode(true);
    const w=mount(field);
    w.pointer('pointerdown',at(160,.7));
    assert.equal(field.soundPatch,'sampled_strings_v1');
    for(const r of [.6,.4,.3,.2,.1])w.pointer('pointermove',at(160,r));
    assert.equal(field.soundPatch,'sampled_strings_v1','the middle holds while the finger is down');
    w.pointer('pointerup',at(160,.1));
    assert.equal(field.soundPatch,null,'letting go there chooses Own sound');
    assert.equal(field.soundView,null,'the group ring stays');
    assert.equal(field.history.length,1);
    field.undo();
    assert.equal(field.soundPatch,'sampled_kalimba_v1','one Undo goes back to the sound before the gesture');
  }
  {
    const {field}=session();field.setSoundMode(true);
    const w=mount(field);
    w.pointer('pointerdown',at(0,.7));w.pointer('pointermove',at(0,.1));w.pointer('pointerup',at(0,.1));
    assert.equal(field.soundPatch,null);assert.equal(field.history.length,0,'Own sound to Own sound adds no Undo entry');
  }
  {
    const {field}=session();field.setSoundMode(true);
    const w=mount(field);
    w.pointer('pointerdown',at(80,.7));w.pointer('pointermove',at(80,.1));w.pointer('pointercancel',at(80,.1));
    assert.equal(field.soundPatch,'sampled_steel_drums_v1','a cancelled gesture chooses nothing in the middle');
  }
  {
    const {field}=session({melodySound:'sampled_kalimba_v1'});field.setSoundMode(true);
    const w=mount(field);
    w.pointer('pointerdown',[0,0]);
    assert.equal(field.soundPatch,null,'a press that starts in the middle still chooses Own sound at once');
    w.pointer('pointerup',[0,0]);
    assert.equal(field.history.length,1);
  }
});

function heardCase(state,{sound='sampled_kalimba_v1',leadPatch='synth_lead'}={}) {
  const {field,scheduler}=session({leadPatch,loading:state?{state}:null});field.setSoundMode(true);
  const w=mount(field);
  if(sound)field.selectSound(sound);
  scheduler.audition={sectionId:field.sectionId,realizedId:field.requestId,scheduledId:field.requestId};
  const seen=[];const paint=field._paintSoundWheel.bind(field);field._paintSoundWheel=h=>{seen.push(h);return paint(h);};
  field.paint();
  return {heard:seen.at(-1),status:w.status.textContent,marked:w.disk.els.filter(e=>e.hasAttribute('data-heard')).map(e=>e.attrs['data-key'])};
}

test('the heard mark names no sampled sound while the bank loads or failed; the status says so', () => {
  const loading=heardCase('loading');
  assert.equal(loading.heard,undefined,'nothing is marked heard');
  assert.deepEqual(loading.marked,[]);
  assert.doesNotMatch(loading.status,/Kalimba/);
  assert.match(loading.status,/^Playing: .*\. Full sounds are on the way\.$/);
  const failed=heardCase('failed');
  assert.equal(failed.heard,undefined);
  assert.match(failed.status,/Full sounds did not load\.$/);
  for(const state of ['live',null]){
    const live=heardCase(state);
    assert.equal(live.heard,'sampled_kalimba_v1',`bank ${state||'already live'}: the chosen sound is heard`);
    assert.match(live.status,/^Playing: .* \/ Kalimba\.$/);
    assert.ok(live.marked.includes('melody-field-family-2'),'its group carries the playing mark');
  }
  // A tune whose own lead is sampled is on the stand-in too while loading.
  assert.equal(heardCase('loading',{sound:null,leadPatch:'sampled_piano_v1'}).heard,undefined);
  // A native own lead plays as itself while loading: Own sound is heard.
  assert.equal(heardCase('loading',{sound:null}).heard,null);
});

test('arrow keys on the group ring come back to the sound last chosen in each group', () => {
  assert.equal(soundKeyMove(null,'sampled_steel_drums_v1','ArrowLeft',{Bells:'sampled_marimba_v1'}).patch,'sampled_marimba_v1');
  assert.equal(soundKeyMove(null,'sampled_steel_drums_v1','ArrowLeft',{Bells:'sampled_piano_v1'}).patch,'sampled_music_box_v1','a remembered sound from another group is ignored');
  assert.equal(soundKeyMove(null,'sampled_steel_drums_v1','ArrowLeft').patch,'sampled_music_box_v1','no memory: the first sound');
  const {field}=session({melodySound:'sampled_marimba_v1'});field.setSoundMode(true);
  const w=mount(field);
  w.key('ArrowRight');assert.equal(field.soundPatch,'sampled_steel_drums_v1');
  w.key('ArrowLeft');assert.equal(field.soundPatch,'sampled_marimba_v1','back to Marimba, as a drag would');
  // Harp chosen inside Strings, back to all groups, over to Voices and back again.
  field.openSoundFamily('Strings');field.applySoundMove(soundKeyMove(field.soundView,field.soundPatch,'ArrowRight'));
  assert.equal(field.soundPatch,'sampled_harp_v1');
  w.key('Backspace');w.key('ArrowRight');assert.equal(field.soundPatch,'sampled_ooh_v1');
  w.key('ArrowLeft');assert.equal(field.soundPatch,'sampled_harp_v1');
  // A full lap of Rights comes back to the remembered sound too.
  for(let i=0;i<10;i++)w.key('ArrowRight');
  assert.equal(field.soundPatch,'sampled_harp_v1');
});

test('Own sound sits in the group ring arrow cycle, between Synths and Keys', () => {
  const hub={view:null,patch:null,focus:'melody-field-sound-0'};
  assert.deepEqual(soundKeyMove(null,'sampled_piano_v1','ArrowLeft'),hub);
  assert.deepEqual(soundKeyMove(null,'sampled_organ_v1','ArrowUp'),hub);
  assert.deepEqual(soundKeyMove(null,'sampled_synth_brass_v1','ArrowRight'),hub);
  assert.deepEqual(soundKeyMove(null,'sampled_square_lead_v1','ArrowDown'),hub);
  assert.equal(soundKeyMove(null,null,'ArrowRight').patch,'sampled_piano_v1');
  assert.equal(soundKeyMove(null,null,'ArrowLeft').patch,'sampled_square_lead_v1');
  // Every state reachable with arrows and Backspace from Harp includes Own sound (no Home key needed).
  const seen=new Set(),queue=[[null,'sampled_harp_v1']];
  while(queue.length){const [view,patch]=queue.shift(),id=`${view}|${patch}`;if(seen.has(id))continue;seen.add(id);
    for(const k of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Backspace']){const m=soundKeyMove(view,patch,k);if(m)queue.push([m.view,m.patch===undefined?patch:m.patch]);}}
  assert.ok([...seen].some(s=>s.endsWith('|null')),'Own sound is reachable by arrows');
});

test('every hub, group and sound button is a native Tab stop; the disk itself is not', () => {
  const {field}=session({melodySound:'sampled_kalimba_v1'});field.setSoundMode(true);
  const disk=h=>h.match(/<div class="pf-melody-disk pf-sound-disk"[\s\S]*?<p class="pf-sub" data-mf-status/)[0];
  for(const view of [null,...groupNames]){
    field.soundView=view;
    const d=disk(field.html());
    assert.match(d,/^<div class="pf-melody-disk pf-sound-disk" data-melody-disk data-sound-view="[^"]*" tabindex="-1"/);
    assert.equal((d.match(/tabindex=/g)||[]).length,1,`${view||'groups'}: only the disk names a tabindex`);
  }
  field.soundView=null;
  const w=mount(field);
  w.key('ArrowRight');field.openSoundFamily('Guitars');w.key('ArrowRight');w.key('Backspace');
  assert.ok(w.disk.els.every(e=>!e.hasAttribute('tabindex')),'painting never takes a button out of the Tab order');
  assert.equal(field.focusSoundChoice('melody-field-nope'),true,'focus falls back to the chosen button');
  assert.equal(w.doc.activeElement.attrs['data-chosen'],'true');
});

test('keys with Alt, Ctrl or Meta held are left to the browser', () => {
  const {field}=session();field.setSoundMode(true);
  const w=mount(field);
  for(const mods of [{altKey:true},{ctrlKey:true},{metaKey:true}])for(const k of ['ArrowLeft','ArrowRight','Home','ArrowDown']){
    const e=w.key(k,mods);
    assert.equal(e.defaultPrevented,false,`${k} with ${Object.keys(mods)[0]} is not taken`);
    assert.equal(field.soundPatch,null);assert.equal(field.history.length,0);
  }
  w.key('ArrowRight');assert.equal(field.soundPatch,'sampled_piano_v1','plain keys still work');
  w.key('ArrowRight',{shiftKey:true});assert.equal(field.soundPatch,'sampled_music_box_v1','Shift is not a reason to ignore a key');
  // The Tune wheel leaves modified keys alone too.
  const tune=session().field;const t=mount(tune);
  t.key('ArrowRight',{altKey:true});assert.deepEqual(tune.position,{x:0,y:0});
});

test('a screen reader hears each view change and every wheel button names what it does', () => {
  const {field}=session({melodySound:'sampled_kalimba_v1'});field.setSoundMode(true);
  const html=field.html();
  assert.match(html,/<p class="sr-only" data-mf-sound-say aria-live="polite" aria-atomic="true"><\/p>/,'a polite live region for view changes');
  const w=mount(field);
  field.openSoundFamily('Keys');assert.equal(w.say.textContent,'Keys sounds.');
  w.key('Backspace');assert.equal(w.say.textContent,'All groups.');
  field.openSoundFamily('World');assert.equal(w.say.textContent,'World sounds.');
  w.key('ArrowDown');assert.equal(w.say.textContent,'Guitars sounds.');
  w.key('Home');assert.equal(w.say.textContent,'All groups.');
  for(const text of w.said)assert.ok(checkPrompt(text).ok,text);
  // Groups open a ring: not toggles, and their names say so (with the chosen sound when it is in the group).
  field.selectSound('sampled_kalimba_v1');field.paint();
  const groups=w.disk.els.filter(e=>e.hasAttribute('data-sound-family'));
  assert.equal(groups.length,9);
  for(const g of groups)assert.equal(g.hasAttribute('aria-pressed'),false,`${g.attrs['data-key']} is not a toggle`);
  assert.equal(groups[2].attrs['aria-label'],'World Kalimba, World sounds');
  assert.equal(groups[0].attrs['aria-label'],'Keys sounds');
  w.key('ArrowLeft');
  assert.equal(groups[2].attrs['aria-label'],'World sounds','the name follows the chosen sound');
  assert.equal(groups[1].attrs['aria-label'],'Bells Music box, Bells sounds');
  const markup=field.html();
  assert.match(markup,/data-key="melody-field-family-1"[^>]*aria-label="Bells Music box, Bells sounds"/);
  assert.doesNotMatch(markup,/data-sound-family="\d+"[^>]*aria-pressed/);
  // The disk's words lead with what works in browse mode too (press), then the keys.
  const label=h=>h.match(/data-melody-disk[^>]*aria-label="([^"]*)"/)[1];
  for(const view of [null,...groupNames]){
    field.soundView=view;const text=label(field.html());
    assert.match(text,view?new RegExp(`^${view} sounds\\. Press a sound to pick it\\.`):/^Sound groups\. Press a group to see its sounds\./);
    assert.ok(checkPrompt(text).ok,`${text} -> ${JSON.stringify(checkPrompt(text).problems)}`);
  }
});

const css=fs.readFileSync(new URL('../../../static/css/studio.css',import.meta.url),'utf8');
/** Top-level blocks of the sheet with their at-rule prelude ('' for plain rules), in source order. */
function blocks(text) {
  const out=[];let depth=0,start=0,prelude='';
  for(let i=0;i<text.length;i++){
    if(text[i]==='{'){if(depth===0){prelude=text.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim();start=i+1;}depth++;}
    else if(text[i]==='}'){depth--;if(depth===0){out.push({prelude,body:text.slice(start,i),at:start});start=i+1;}}
  }
  return out;
}

test('forced colours: keyboard focus on any Sound wheel button, chosen or not, draws a CanvasText ring', () => {
  const all=blocks(css);
  const base=all.find(b=>b.prelude==='.pf-sound-sector:focus-visible');
  assert.ok(base,'the normal focus ring rule');
  const forced=all.filter(b=>/^@media \(forced-colors: active\)/.test(b.prelude)&&/\.pf-sound-sector/.test(b.body));
  assert.equal(forced.length,1);
  assert.ok(forced[0].at>base.at,'the forced-colours block comes later, so it wins at equal specificity');
  assert.match(forced[0].body,/\.pf-sound-sector:focus-visible\s*\{[^}]*outline-color:\s*CanvasText/,'a system colour, even where forcing is turned off for the chosen pill');
});

test('Bigger mode keeps the Sound wheel at its normal size on phones and enlarges its labels where there is room', () => {
  const all=blocks(css);
  const normal=all.find(b=>b.prelude.startsWith('.pf-melody-disk')&&b.prelude==='.pf-melody-disk').body.match(/width:\s*([^;]+);/)[1].trim();
  const phoneBigger=all.filter(b=>b.prelude==='@media (max-width: 480px)'&&/body\.pf-bigger \.pf-melody-disk\.pf-sound-disk/.test(b.body));
  assert.equal(phoneBigger.length,1);
  assert.equal(phoneBigger[0].body.match(/body\.pf-bigger \.pf-melody-disk\.pf-sound-disk\s*\{\s*width:\s*([^;]+);/)[1].trim(),normal,'the same width as without Bigger');
  const label=all.filter(b=>/^@container/.test(b.prelude)&&/body\.pf-bigger \.pf-sound-sector\s*\{[^}]*font-size/.test(b.body));
  const phoneRule=label.find(b=>{const min=Number(b.prelude.match(/min-width:\s*(\d+)px/)?.[1]??0),max=Number(b.prelude.match(/max-width:\s*(\d+)px/)?.[1]??Infinity);return min<=294&&max>=294;});
  assert.ok(phoneRule,'a Bigger label rule covers the 296 px phone disk (its container is 294 px)');
  assert.ok(parseFloat(phoneRule.body.match(/font-size:\s*([\d.]+)rem/)[1])>.78,'bigger than the .78rem phone labels');
});

test('sound-ring labels sit in the middle of the band and narrow to one word per line on small disks', () => {
  const {field}=session();field.setSoundMode(true);
  for(const view of groupNames){
    field.soundView=view;
    for(const m of field.html().matchAll(/class="pf-sound-sector pf-sound-choice"[^>]*style="left:([\d.]+)%;top:([\d.]+)%/g)){
      const r=Math.hypot(Number(m[1])-50,Number(m[2])-50);
      assert.ok(Math.abs(r-32.5)<.01,`${view}: label radius ${r.toFixed(2)}% of the disk`);
    }
  }
  const all=blocks(css);
  assert.ok(all.some(b=>/^@container \(max-width: 399px\)$/.test(b.prelude)&&/\.pf-sound-choice\s*\{[^}]*width:\s*min-content/.test(b.body)),'one word per line below a 400 px disk');
});
