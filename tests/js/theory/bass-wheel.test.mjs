// Bass wheel v1 theory gates (development records, plan and attacks).
// Real Jam bands from the scene catalogue: 6 scenes x 12 roots x major/minor x base/answer/space, every one admitted
// or failed with its reason (no silent skips), then every line checked for range, key, time, one voice, joins,
// distinctness from the band's own bass, swing, stable ids, the band snapshot and the never-the-band rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../../static/js/theory/bass_wheel.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {buildMelodyPalette} from '../../../static/js/theory/melody_composer_v9.js';
import {melodyChoice} from '../../../static/js/theory/melody_composer_v9.js';
import {balancedEvents,SOFT_BAND_FACTOR} from '../../../static/js/theory/melody_balance.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';
import {jamScore,SCENES,VARIANTS} from './bass-wheel-fixtures.mjs';

const EPS=1e-6;
const mod=(a,n=12)=>((a%n)+n)%n;
const onset=n=>n.step+(n.performance?.version===1?n.performance.offset_steps||0:0);
const pitch=n=>n.concrete.midi_pitch;
const barOf=t=>Math.floor(t/16+EPS);
const MOVES=B.BASS_MOVES.filter(k=>k!==B.BASS_BAND);
const band=events=>events.filter(n=>n.role==='bass'&&n.generated_by==='musiclab_jam');

// Every admitted context in the matrix, built once (about 1.5 s).
const MATRIX=[];
for(const scene of SCENES)for(const minor of [false,true])for(let root=0;root<12;root++)for(const variant of VARIANTS) {
  const score=jamScore(scene,{root,minor,variant});
  MATRIX.push({scene,minor,root,variant,...score,admission:B.bassAdmission(score.context)});
}
const ADMITTED=MATRIX.filter(m=>m.admission.ok);
const label=m=>`${m.scene} ${m.variant} root ${m.root}${m.minor?'m':''}`;

// ---- Independent checks (each has a negative control below proving it can fail) ----
function rangeProblems(line){return line.filter(n=>pitch(n)<B.BASS_FLOOR||pitch(n)>B.BASS_CEILING).map(n=>`register ${pitch(n)}`);}
function halfBarProblems(line){return line.filter(n=>onset(n)+n.duration_steps>(Math.floor(onset(n)/8+EPS)+1)*8-.1+EPS).map(n=>`crosses ${n.id}`);}
function monoProblems(line){
  const s=[...line].sort((a,b)=>onset(a)-onset(b));
  return s.filter((n,i)=>onset(n)+n.duration_steps>(i+1<s.length?onset(s[i+1]):64+onset(s[0]))-.05+EPS).map(n=>`overlap ${n.id}`);
}
function keyProblems(ctx,line){
  const s=[...line].sort((a,b)=>onset(a)-onset(b));
  return s.filter(n=>{
    const bar=barOf(onset(n)),b=ctx.bars[bar],next=ctx.bars[(bar+1)%4];
    if(b.chordPcs.includes(mod(pitch(n))))return false;
    // Otherwise an in-scale approach: one or two semitones from the next bar's anchor.
    return !(ctx.scalePcs.includes(mod(pitch(n)))&&[1,2].includes(Math.abs(pitch(n)-next.anchor)));
  }).map(n=>`not a chord tone or approach ${n.id} ${pitch(n)}`);
}
function clashProblems(ctx,line,events){
  const lead=events.filter(n=>n.role==='lead').map(n=>({s:onset(n),e:onset(n)+n.duration_steps,p:pitch(n)}));
  const firsts=new Set([0,1,2,3].map(bar=>[...line].sort((a,b)=>onset(a)-onset(b)).find(n=>barOf(onset(n))===bar)?.id));
  return line.filter(n=>!firsts.has(n.id)&&pitch(n)!==ctx.bars[barOf(onset(n))].anchor&&lead.some(l=>l.s<=onset(n)+EPS&&l.e>onset(n)+EPS&&[1,6,11].includes(mod(l.p-pitch(n)))))
    .map(n=>`clash ${n.id}`);
}

test('admission: all 432 contexts of the six V9 scenes are admitted, inversions included, none skipped',()=>{
  const failed=MATRIX.filter(m=>!m.admission.ok).map(m=>`${label(m)}: ${m.admission.reason}`);
  assert.deepEqual(failed,[]);
  assert.equal(ADMITTED.length,6*12*2*3);
  // Reggae and Ska 'answer' put the V chord's third or fifth in the bass in bar 4: the band's own inversion bass
  // is that bar's anchor, so every line starts that bar where the band does.
  for(const m of ADMITTED.filter(m=>m.variant==='answer'&&['reggae-v1','ska-v1'].includes(m.scene))) {
    const {ctx}=m.admission,first=band(m.song.events).filter(n=>barOf(onset(n))===3).sort((a,b)=>onset(a)-onset(b))[0];
    assert.equal(mod(ctx.bars[3].anchor),mod(pitch(first)),label(m));
    assert.equal(ctx.bars[3].inversion,m.scene==='reggae-v1'?'third':'fifth',label(m));
  }
});

test('admission: every density of the six scenes is admitted',()=>{
  for(const scene of SCENES)for(const density of [0,2,3,4])for(const variant of VARIANTS) {
    const a=B.bassAdmission(jamScore(scene,{root:7,minor:density%2===1,variant,density}).context);
    assert.ok(a.ok,`${scene} ${variant} density ${density}: ${a.reason}`);
  }
});

test('admission: elsewhere the wheel says why it is not ready',()=>{
  const ok=jamScore('house-v1').context;
  assert.equal(B.bassAdmission(null).reason,'no-context');
  assert.equal(B.bassAdmission(jamScore('hip-hop-v1').context).reason,'scene');
  assert.equal(B.bassAdmission({...ok,composerVersion:5}).reason,'composer');
  assert.equal(B.bassAdmission({...ok,form:{id:'x',blockIndex:0}}).reason,'form');
  assert.equal(B.bassAdmission({...ok,totalSteps:48}).reason,'time');
  assert.equal(B.bassAdmission({...ok,harmony:{version:1,bars:[[0,4,7]]}}).reason,'harmony');
  const events=ok.source.events;
  assert.equal(B.bassAdmission(ok,events.filter(n=>n.role!=='bass')).reason,'no-band-bass');
  assert.equal(B.bassAdmission(ok,events.filter(n=>!(n.role==='bass'&&barOf(onset(n))===2))).reason,'bar-empty');
  // A repeat-keys answer can put the child's pitch class on the bar's first bass note.
  const off=events.map(n=>n.role==='bass'&&onset(n)===2?{...n,concrete:{...n.concrete,midi_pitch:pitch(n)+1}}:n);
  assert.equal(B.bassAdmission(ok,off).reason,'off-chord');
  const line=B.bassWheelLine(B.bassContext(ok),'walk-full',events);
  assert.equal(B.bassAdmission(ok,[...events,...line]).reason,'mixed-bass');
  assert.equal(B.bassAdmission(ok,B.withBassLine(events,line)).reason,'band-bass-unknown');
  assert.equal(B.bassContext(ok,B.withBassLine(events,line)),null);
});

test('every line: register 36-57, chord tones or in-scale approaches, one voice, no note reaching a half-bar line',()=>{
  const problems=[];
  for(const m of ADMITTED) {
    const {ctx}=m.admission;
    for(const key of MOVES) {
      const line=B.bassWheelLine(ctx,key,m.song.events);
      const p=[...rangeProblems(line),...keyProblems(ctx,line),...monoProblems(line),...halfBarProblems(line),...clashProblems(ctx,line,m.song.events)];
      if(p.length)problems.push(`${label(m)} ${key}: ${p.slice(0,3).join('; ')}`);
    }
  }
  assert.deepEqual(problems.slice(0,10),[]);
});

test('every line: bar anchors first, chord tones on beats one and three, levels from the band, fields of a generated bass',()=>{
  for(const m of ADMITTED) {
    const {ctx}=m.admission;
    for(const key of MOVES) {
      const line=B.bassWheelLine(ctx,key,m.song.events),{way,size}=B.parseBassMove(key);
      for(let bar=0;bar<4;bar++) {
        const notes=line.filter(n=>barOf(onset(n))===bar).sort((a,b)=>onset(a)-onset(b));
        assert.ok(notes.length,`${label(m)} ${key} bar ${bar} is empty`);
        assert.equal(pitch(notes[0]),ctx.bars[bar].anchor,`${label(m)} ${key} bar ${bar} starts on its anchor`);
        for(const n of notes.filter(n=>[0,8].some(b=>Math.abs(onset(n)-bar*16-b)<=1)&&ctx.kicks[bar].some(k=>Math.abs(onset(n)-bar*16-k)<EPS)||[0,8].includes(onset(n)-bar*16)))
          assert.ok(ctx.bars[bar].chordPcs.includes(mod(pitch(n))),`${label(m)} ${key} beat note ${n.id}`);
        for(const n of notes)assert.ok(n.velocity<=Math.min(.99,ctx.bars[bar].level*1.12)+EPS&&n.velocity>0,`${label(m)} ${key} velocity`);
      }
      for(const n of line) {
        assert.deepEqual([n.role,n.provenance,n.generated_by,n.pitch_lock_mode,n.patch_id,n.performance.version],
          ['bass','jam_generated',B.BASS_WHEEL_GENERATOR,'concrete','sampled_bass_v1',1]);
        assert.ok(Number.isInteger(n.step)&&n.performance.offset_steps>=0&&n.performance.offset_steps<1);
        assert.ok(Math.abs(n.duration_sec-n.duration_steps*15/ctx.bpm)<1e-9&&Math.abs(n.start_sec-onset(n)*15/ctx.bpm)<1e-9);
        assert.ok(Math.abs(n.concrete.freq_hz-440*2**((pitch(n)-69)/12))<1e-9);
        assert.deepEqual(n.bass_wheel,{version:1,way,size,cell:ctx.lines[key].cell,bar:barOf(onset(n)),slot:n.bass_wheel.slot,
          built_for:{root:m.root,minor:m.minor,swing:ctx.swing}});
        assert.match(n.id,new RegExp(`^bass-wheel-v1:${way}:${size}:[a-h]:${barOf(onset(n))}:`));
      }
      assert.equal(new Set(line.map(n=>n.id)).size,line.length);
    }
  }
});

test('sizes: going out adds notes (Light < Full <= Big in every bar of the tune-free line)',()=>{
  for(const m of ADMITTED) {
    const {ctx}=m.admission;
    for(const w of B.BASS_WAYS) {
      const count=size=>[0,1,2,3].map(bar=>B.bassWheelLine(ctx,`${w.id}-${size}`,[]).filter(n=>barOf(onset(n))===bar).length);
      const [l,f,b]=['light','full','big'].map(count);
      for(let bar=0;bar<4;bar++)assert.ok(l[bar]<f[bar]&&f[bar]<=b[bar],`${label(m)} ${w.id} bar ${bar}: ${l[bar]}/${f[bar]}/${b[bar]}`);
    }
  }
});

test('Steady plays with every kick; Funky leaves the step before each snare or clap empty',()=>{
  for(const m of ADMITTED) {
    const {ctx}=m.admission;
    for(const size of ['light','big']) {
      const line=B.bassWheelLine(ctx,`steady-${size}`,[]);
      for(let bar=0;bar<4;bar++)for(const k of ctx.kicks[bar])
        assert.ok(line.some(n=>Math.abs(onset(n)-bar*16-k)<EPS),`${label(m)} steady-${size} kick ${bar}:${k}`);
    }
    for(const size of ['light','full','big'])for(const n of B.bassWheelLine(ctx,`funky-${size}`,m.song.events)) {
      const bar=barOf(onset(n)),at=onset(n)-bar*16;
      assert.ok(!ctx.snares[bar].some(s=>s-at>EPS&&s-at<=1+EPS),`${label(m)} funky-${size} ${n.id} sits before a backbeat`);
    }
  }
});

test('never the band: every move differs from the band bass in at least 3 of 4 bars; Full shares at most 40% of its notes, Big 50%',()=>{
  const worst={};
  for(const m of ADMITTED) {
    const {ctx}=m.admission,bandLine=band(m.song.events);
    for(const key of MOVES) {
      const line=B.bassWheelLine(ctx,key,m.song.events),o=B.bassOverlap(line,bandLine);
      assert.ok(o.equalBars<=1,`${label(m)} ${key}: ${o.equalBars} bars equal the band`);
      const size=B.parseBassMove(key).size;
      if(size==='full')assert.ok(o.share<=B.BASS_FULL_OVERLAP_MAX+EPS,`${label(m)} ${key}: shares ${o.share.toFixed(2)}`);
      if(size==='full')assert.equal(B.bassSameRhythm(line,bandLine),false,`${label(m)} ${key}: only the band's attacks`);
      if(size==='big')assert.ok(o.share<=B.BASS_BIG_OVERLAP_MAX+EPS,`${label(m)} ${key}: shares ${o.share.toFixed(2)}`);
      const k=`${m.scene} ${key}`;worst[k]=Math.max(worst[k]??0,o.share);
    }
  }
  // Walk at Full in the walking bands (Ska, Swing) was 65%/44% identical in review; it now takes another cell.
  assert.ok(worst['swing-v1 walk-full']<=.4&&worst['ska-v1 walk-full']<=.4);
});

test('the hub is the band bass byte for byte; withBassLine replaces only band and wheel bass',()=>{
  for(const m of ADMITTED.filter((_,i)=>i%7===0)) {
    const {ctx}=m.admission,events=m.song.events;
    assert.equal(JSON.stringify(B.bassWheelLine(ctx,B.BASS_BAND,events)),JSON.stringify(band(events)));
    const own={id:'own-bass',role:'bass',step:33,duration_steps:2,velocity:.6,patch_id:'sampled_bass_v1',provenance:'user_placed',concrete:{midi_pitch:41},performance:{version:1,offset_steps:.25}};
    const edited={...band(events)[0],id:'edited',edited_from_generator:true};
    const source=[...events,own,edited];
    for(const key of ['funky-big','deep-light',B.BASS_BAND]) {
      const line=B.bassWheelLine(ctx,key,source),out=B.withBassLine(source,line);
      const kept=source.filter(n=>!(n.role==='bass'&&n.provenance==='jam_generated'&&!n.edited_from_generator));
      assert.deepEqual(out.slice(0,kept.length),kept);
      assert.ok(kept.every((n,i)=>out[i]===n),'non-bass, personal and edited events are the same objects');
      assert.equal(out.length,kept.length+line.length);
    }
  }
});

test('personal and edited bass keep their time: no line note overlaps them',()=>{
  const {context,song}=jamScore('house-v1',{root:2});
  const own={id:'own-bass',role:'bass',step:20,duration_steps:6,velocity:.6,patch_id:'sampled_bass_v1',provenance:'user_placed',concrete:{midi_pitch:38}};
  const edited={...band(song.events).find(n=>onset(n)>=40),id:'edited-band',edited_from_generator:true};
  const events=[...song.events,own,edited];
  const ctx=B.bassContext({...context,source:{...context.source,events}},events);
  assert.ok(ctx);
  const spans=[[20,26],[onset(edited),onset(edited)+edited.duration_steps]];
  for(const key of [...MOVES,B.BASS_BAND])for(const n of B.bassWheelLine(ctx,key,events))
    assert.ok(spans.every(([s,e])=>onset(n)+n.duration_steps<=s+EPS||onset(n)>=e-EPS),`${key} ${n.id}`);
});

test('swing swings the bass: offbeat eighths sit two thirds into the beat half, never straight; other scenes stay straight',()=>{
  for(const m of ADMITTED.filter(m=>m.scene==='swing-v1'||m.scene==='house-v1')) {
    const {ctx}=m.admission;
    for(const key of ['steady-full','bounce-full','walk-big','chill-full']) {
      const line=B.bassWheelLine(ctx,key,m.song.events),at=n=>mod(onset(n),4);
      const swung=line.filter(n=>Math.abs(at(n)-8/3)<1e-4),straight=line.filter(n=>Math.abs(at(n)-2)<1e-4);
      if(m.scene==='swing-v1'){assert.equal(straight.length,0,`${label(m)} ${key}`);assert.ok(swung.length>0,`${label(m)} ${key}`);}
      else {assert.equal(swung.length,0);assert.ok(straight.length>0);}
    }
  }
  // The swing is written into the notes (performance offsets replace song swing in the scheduler).
  const swing=ADMITTED.find(m=>m.scene==='swing-v1').admission.ctx;
  assert.ok(B.bassWheelLine(swing,'bounce-full',[]).filter(n=>mod(n.step,4)===2).every(n=>Math.abs(n.performance.offset_steps-2/3)<1e-6));
});

test('determinism and frozen contexts: the same score gives the same lines, from a JSON copy too',()=>{
  for(const m of ADMITTED.filter((_,i)=>i%11===0)) {
    const a=m.admission.ctx,b=B.bassContext(JSON.parse(JSON.stringify(m.context)));
    assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.band)&&Object.isFrozen(a.lines));
    for(const key of MOVES)assert.deepEqual(B.bassWheelLine(b,key,m.song.events),B.bassWheelLine(a,key,m.song.events));
  }
});

// Real V9 tunes: Original plus four ring positions, in C major and A minor.
const POSITIONS=[{x:0,y:0},{x:0,y:.5},{x:.7,y:.7},{x:-.75,y:0},{x:0,y:-1}];
const TUNES=[];
for(const scene of SCENES)for(const [root,minor] of [[0,false],[9,true]]) {
  const m=jamScore(scene,{root,minor}),plans=buildMelodyPalette(m.context),ctx=B.bassContext(m.context);
  TUNES.push({scene,root,minor,ctx,m,variants:POSITIONS.map(p=>plans[melodyChoice(p).key].notes)});
}

test('ids name template slots: stable across tune variants, same timing and level for the same id',()=>{
  for(const t of TUNES)for(const key of MOVES) {
    const free=new Map(B.bassWheelLine(t.ctx,key,[]).map(n=>[n.id,n]));
    for(const events of t.variants) {
      const line=B.bassWheelLine(t.ctx,key,events);
      for(const n of line) {
        const f=free.get(n.id);
        assert.ok(f,`${t.scene} ${key} ${n.id} is a template slot`);
        assert.deepEqual([n.step,n.performance,n.velocity,n.bass_wheel],[f.step,f.performance,f.velocity,f.bass_wheel]);
      }
      assert.deepEqual(B.bassLineBasis(line),Object.fromEntries(line.map(n=>[n.id,free.get(n.id).velocity])));
    }
  }
});

test('over real V9 tunes: no clash with the tune, busy tunes thin Full and Big, Full stays under 40% band notes per scene',()=>{
  const shares={};
  for(const t of TUNES)for(const events of t.variants) {
    const tune=events.filter(n=>n.role==='lead'),busy=[0,1,2,3,4,5,6,7].filter(h=>tune.filter(n=>Math.floor(onset(n)/8+EPS)===h).length>=4);
    for(const key of MOVES) {
      const line=B.bassWheelLine(t.ctx,key,events);
      assert.deepEqual(clashProblems(t.ctx,line,events),[],`${t.scene} ${key}`);
      if(!key.endsWith('light'))for(const n of line.filter(n=>busy.includes(Math.floor(onset(n)/8+EPS)))) {
        const at=onset(n)-barOf(onset(n))*16,onBeat=Math.abs(at-Math.round(at/4)*4)<.05;
        const slot=t.ctx.lines[key].slots.find(s=>s.id===n.id);
        assert.ok(!slot.ghost&&!(slot.gate<=.75&&!onBeat&&slot.token!=='A'),`${t.scene} ${key} ${n.id} in a busy half bar`);
      }
      if(key.endsWith('full')){const o=B.bassOverlap(line,band(t.m.song.events)),k=`${t.scene} ${key}`;(shares[k]??=[0,0]);shares[k][0]+=o.shared;shares[k][1]+=o.total;}
    }
  }
  for(const [k,[s,n]] of Object.entries(shares))assert.ok(s/n<=.4,`${k}: ${(s/n).toFixed(2)}`);
});

test('the candidate pipeline: the band bass under Softer band and a wheel line softened exactly once',()=>{
  const t=TUNES[0],events=t.variants[2],line=B.bassWheelLine(t.ctx,'funky-full',events);
  const candidate=B.withBassLine(events,line),basis={...Object.fromEntries(band(events).map(n=>[n.id,n.velocity])),...B.bassLineBasis(line)};
  const soft=balancedEvents(candidate,basis,true);
  for(const n of line)assert.ok(Math.abs(soft.find(e=>e.id===n.id).velocity-n.velocity*SOFT_BAND_FACTOR)<1e-12);
  // Twice through the pipeline is still once softened (basis velocities are unsoftened).
  const again=balancedEvents(soft,basis,true);
  assert.deepEqual(again.map(n=>n.velocity),soft.map(n=>n.velocity));
});

// ---- Keep and reopen: the band's ORIGINAL bass travels in the saved context (attack fix 2) ----
function keepAndReopen(m,move,{soft=false,events=m.song.events,saved=null}={}) {
  const ctx=B.bassContext(m.context,events,{saved}),line=B.bassWheelLine(ctx,move,events);
  let heard=B.withBassLine(events,line);
  const basis={...Object.fromEntries(band(m.song.events).map(n=>[n.id,n.velocity])),...B.bassLineBasis(line)};
  if(soft)heard=balancedEvents(heard,basis,true);
  const record=B.bassWheelRecord(ctx,move);
  const context={...m.context,source:undefined,bassWheel:record,...(soft?{bandBalance:1,bandBasis:basis}:{})};
  const doc=selectedMelody(m.doc,{...m.song,events:heard},{context,choice:{position:{x:0,y:0},requestId:'keep'}});
  // The reopened session's source: the saved notes as a compiled score.
  const stepSec=15/m.song.bpm;
  const source=doc.notes.map(n=>({...n,start_sec:onset(n)*stepSec,duration_sec:n.duration_steps*stepSec}));
  const kept=doc.capture_notes.melody_field.context;
  return {doc,source,saved:kept,reopened:B.bassAdmission({...kept,source:{events:source}},source,{saved:kept.bassWheel,bandBasis:kept.bandBasis}),ctx,line};
}

test('after Keep and reopen the hub, never-the-band, bar levels and pocket use the band original bass',()=>{
  for(const m of ADMITTED.filter((_,i)=>i%9===0)) {
    const {ctx,reopened,source,line}=keepAndReopen(m,'deep-big');
    assert.ok(reopened.ok,`${label(m)}: ${reopened.reason}`);
    const r=reopened.ctx;
    assert.equal(r.openingMove,'deep-big');assert.equal(r.bandSource,'saved');
    const bandMusic=n=>[n.id,onset(n),n.duration_steps,pitch(n),n.velocity,n.patch_id];
    assert.deepEqual(r.band.map(bandMusic),ctx.band.map(bandMusic));
    assert.deepEqual(B.bassWheelLine(r,B.BASS_BAND,source).map(bandMusic),band(m.song.events).map(bandMusic),'the hub plays the band, not the kept line');
    assert.deepEqual(r.bars.map(b=>b.level),ctx.bars.map(b=>b.level));
    assert.deepEqual(r.pocket,ctx.pocket);
    for(const key of MOVES)assert.equal(r.lines[key].cell,ctx.lines[key].cell,`${label(m)} ${key}`);
    // Picking the kept move again over the same tune reproduces the kept line.
    const again=B.bassWheelLine(r,'deep-big',source);
    assert.deepEqual(again.map(bandMusic),line.map(bandMusic));
  }
});

test('five Keep and reopen cycles of Big keep the level flat; a saved Softer band reopens at the band level',()=>{
  const m=ADMITTED.find(a=>a.scene==='soul-v1');
  let events=m.song.events,saved=null;const first=B.bassWheelLine(B.bassContext(m.context),'deep-big',m.song.events);
  for(let i=0;i<5;i++) {
    const out=keepAndReopen(m,'deep-big',{events,saved});
    assert.ok(out.reopened.ok,out.reopened.reason);
    events=out.source;saved=out.saved.bassWheel;
    const line=B.bassWheelLine(out.reopened.ctx,'deep-big',events);
    assert.deepEqual(line.map(n=>n.velocity),first.map(n=>n.velocity),`cycle ${i}`);
  }
  const soft=keepAndReopen(m,'funky-full',{soft:true});
  assert.ok(soft.reopened.ok,soft.reopened.reason);
  assert.deepEqual(soft.reopened.ctx.bars.map(b=>b.level),soft.ctx.bars.map(b=>b.level),'bar levels unsoftened');
  assert.deepEqual(B.bassWheelLine(soft.reopened.ctx,'chill-big',soft.source).map(n=>n.velocity),
    B.bassWheelLine(soft.ctx,'chill-big',soft.source).map(n=>n.velocity));
});

test('a tempo change after Keep (100 to 150 BPM): Band bass is timed at the new tempo and never overlaps itself',()=>{
  const m=ADMITTED.find(a=>a.scene==='soul-v1'&&a.variant==='base'&&a.root===0&&!a.minor);
  assert.equal(m.song.bpm,100);
  const {doc,saved}=keepAndReopen(m,'funky-full');
  const reopen=bpm=>{
    const sec=15/bpm,source=doc.notes.map(n=>({...n,start_sec:onset(n)*sec,duration_sec:n.duration_steps*sec}));
    const a=B.bassAdmission({...saved,bpm,source:{events:source}},source,{saved:saved.bassWheel});
    assert.ok(a.ok,a.reason);assert.equal(a.ctx.bpm,bpm);
    return B.bassWheelLine(a.ctx,B.BASS_BAND,source);
  };
  const live=jamScore('soul-v1',{bpm:150});
  assert.equal(live.song.bpm,150);
  const timing=n=>[n.id,n.start_sec,n.duration_sec,n.duration_steps];
  for(const bpm of [150,100,80]) {
    const hub=reopen(bpm),sec=15/bpm;
    for(const n of hub) {
      assert.ok(Math.abs(n.duration_sec-n.duration_steps*sec)<1e-6,`${bpm} BPM ${n.id}: ${n.duration_sec} s for ${n.duration_steps} steps`);
      assert.ok(Math.abs(n.start_sec-onset(n)*sec)<1e-6,`${bpm} BPM ${n.id} start`);
    }
    // One voice in seconds too: no hub note still sounds when the next bass note starts (loop wrap included).
    const s=[...hub].sort((a,b)=>a.start_sec-b.start_sec);
    s.forEach((n,i)=>assert.ok(n.start_sec+n.duration_sec<=(i+1<s.length?s[i+1].start_sec:64*sec+s[0].start_sec)+1e-6,`${bpm} BPM ${n.id} overlaps the next note`));
    if(bpm===150)assert.deepEqual(hub.map(timing),band(live.song.events).map(timing),'the hub at 150 is the band at 150');
  }
});

test('a stored line opens untouched: its move is read from its notes; a stale record never replaces the live band',()=>{
  const m=ADMITTED.find(a=>a.scene==='reggae-v1'&&a.variant==='answer');
  const {source,saved}=keepAndReopen(m,'walk-big');
  assert.equal(B.bassMoveOf(source),'walk-big');
  assert.equal(B.bassMoveOf(m.song.events),B.BASS_BAND);
  assert.equal(B.bassMoveOf([...source,{...source.find(n=>n.generated_by===B.BASS_WHEEL_GENERATOR),id:'x',bass_wheel:{version:1,way:'deep',size:'big'}}]),null);
  // After a Jam direction change the band's own bass is back: an old record is ignored.
  const live=B.bassAdmission({...m.context,bassWheel:saved},m.song.events,{saved:saved.bassWheel});
  assert.equal(live.ctx.bandSource,'live');assert.equal(live.ctx.openingMove,B.BASS_BAND);
  // A record from another band cannot stand in for this one.
  const other=jamScore('house-v1',{root:m.root,minor:m.minor});
  assert.equal(B.bassAdmission({...other.context,bassWheel:saved.bassWheel},source).reason,'band-bass-unknown');
  const record=saved.bassWheel;
  assert.deepEqual(Object.keys(record),['version','generator','move','band']);
  assert.deepEqual([record.version,record.generator,record.move,record.band.sceneId],[1,'bass-wheel-v1','walk-big','reggae-v1']);
});

test('a Keep before anything is heard saves the opening bass: the opening move needs no line',()=>{
  // The UI's origin candidates pass the opening move explicitly; at the opening move the score is untouched.
  const m=ADMITTED.find(a=>a.scene==='house-v1');
  const ctx=m.admission.ctx;
  assert.equal(ctx.openingMove,B.BASS_BAND);
  assert.equal(B.applyBassMove(ctx,ctx.openingMove,m.song.events),m.song.events);
  assert.deepEqual(B.bassCandidateEvents(ctx,ctx.openingMove,m.song.events).filter(n=>n.role==='bass'),band(m.song.events));
  const {source,reopened}=keepAndReopen(m,'chill-light');
  assert.equal(reopened.ctx.openingMove,'chill-light');
  assert.equal(B.bassMoveOf(source),reopened.ctx.openingMove);
  // A heard candidate that is not the opening move gets its line.
  assert.ok(B.applyBassMove(ctx,'walk-big',m.song.events).some(n=>n.generated_by===B.BASS_WHEEL_GENERATOR));
});

test('a tune move on a reopened save keeps the stored bass until the bass itself moves',()=>{
  const t=TUNES.find(t=>t.scene==='soul-v1'&&!t.minor);
  const m={...t.m};
  const {source,saved,reopened}=keepAndReopen(m,'funky-big',{events:t.variants[1]});
  const r=reopened.ctx,stored=source.filter(n=>n.role==='bass');
  // The reopened palette keeps every non-lead note of its source: a tune move swaps only the lead notes.
  const moved=[...source.filter(n=>n.role!=='lead'),...t.variants[3].filter(n=>n.role==='lead')];
  assert.deepEqual(B.applyBassMove(r,r.openingMove,moved).filter(n=>n.role==='bass'),stored);
  // Moving the bass regenerates over the new tune, and the hub is the band's original bass.
  assert.notDeepEqual(B.applyBassMove(r,'deep-full',moved).filter(n=>n.role==='bass'),stored);
  assert.deepEqual(B.applyBassMove(r,B.BASS_BAND,moved).filter(n=>n.role==='bass').map(n=>n.id),band(t.m.song.events).map(n=>n.id));
  assert.equal(saved.bassWheel.move,'funky-big');
});

test('bassBasis covers every id the wheel can play, unsoftened and tune-independent',()=>{
  const t=TUNES[3],basis=B.bassBasis(t.ctx);
  for(const n of band(t.m.song.events))assert.equal(basis[n.id],n.velocity);
  for(const events of t.variants)for(const key of MOVES)for(const n of B.bassWheelLine(t.ctx,key,events))assert.equal(basis[n.id],n.velocity);
  assert.equal(Object.keys(basis).length,band(t.m.song.events).length+MOVES.reduce((s,k)=>s+t.ctx.lines[k].slots.length,0));
});

// ---- Wheel geometry and keys ----
test('bassSector: hub, six ways clockwise from the top, three sizes outward, hysteresis while dragging',()=>{
  const at=(deg,r)=>[Math.sin(deg*Math.PI/180)*r,Math.cos(deg*Math.PI/180)*r];
  assert.equal(B.bassSector(0,0),'band');assert.equal(B.bassSector(...at(90,.29)),'band');
  assert.equal(B.bassSector(...at(0,.4)),'deep-light');assert.equal(B.bassSector(...at(60,.6)),'steady-full');
  assert.equal(B.bassSector(...at(120,.9)),'walk-big');assert.equal(B.bassSector(...at(180,.5)),'bounce-light');
  assert.equal(B.bassSector(...at(240,.7)),'funky-full');assert.equal(B.bassSector(...at(300,.95)),'chill-big');
  assert.equal(B.bassSector(...at(30,1.2)),null,'outside the disk');
  assert.equal(B.bassSector(...at(30,1.2),'steady-big'),'steady-big','a drag past the rim keeps turning');
  assert.equal(B.bassSector(...at(33,.6),'deep-full'),'deep-full','4 degrees past the edge still holds');
  assert.equal(B.bassSector(...at(35,.6),'deep-full'),'steady-full');
  assert.equal(B.bassSector(...at(0,.57),'deep-light'),'deep-light','.03 past the ring edge still holds');
  assert.equal(B.bassSector(...at(0,.59),'deep-light'),'deep-full');
  assert.equal(B.bassSector(...at(0,.32),'band'),'band');assert.equal(B.bassSector(...at(0,.28),'deep-light'),'deep-light');
});

test('bassKeyMove: arrows, Home and an Enter cycle reach all 19 moves',()=>{
  assert.equal(B.bassKeyMove('band','ArrowRight'),'deep-full');assert.equal(B.bassKeyMove('band','ArrowLeft'),'chill-full');
  assert.equal(B.bassKeyMove('funky-big','ArrowRight'),'chill-big');assert.equal(B.bassKeyMove('deep-light','ArrowLeft'),'chill-light');
  assert.equal(B.bassKeyMove('walk-light','ArrowUp'),'walk-full');assert.equal(B.bassKeyMove('walk-big','ArrowUp'),'walk-big');
  assert.equal(B.bassKeyMove('walk-light','ArrowDown'),'walk-light');assert.equal(B.bassKeyMove('walk-big','Home'),'band');
  assert.equal(B.bassKeyMove('walk-full','Enter'),'walk-big');assert.equal(B.bassKeyMove('walk-big',' '),'walk-light');
  assert.equal(B.bassKeyMove('walk-light','Enter'),'walk-full');assert.equal(B.bassKeyMove('walk-full','x'),null);
  // Two switches: one steps (Right), one picks (Enter). Every move is reachable.
  const seen=new Set(['band']);let frontier=['band'];
  while(frontier.length){frontier=frontier.flatMap(m=>['ArrowRight','Enter','Home'].map(k=>B.bassKeyMove(m,k))).filter(m=>!seen.has(m));frontier.forEach(m=>seen.add(m));}
  assert.equal(seen.size,19);assert.deepEqual([...seen].sort(),[...B.BASS_MOVES].sort());
  assert.equal(B.bassMoveName('funky-big'),'Funky bass, big');assert.equal(B.bassMoveName('band'),'Band bass');
  assert.equal(B.parseBassMove('funky-huge'),null);assert.equal(B.bassMoveKey('deep','full'),'deep-full');
});

test('the wheel words are plain: names of three words or fewer, hints at grade 2',()=>{
  for(const w of B.BASS_WAYS){assert.deepEqual(checkPrompt(w.hint).problems,[],w.hint);assert.ok(w.label.split(/\s+/).length<=3);}
  // Child words: the app calls the drums the beat, never the kick.
  for(const w of B.BASS_WAYS)assert.doesNotMatch(w.hint,/kick/i,w.hint);
  assert.equal(B.BASS_WAYS.find(w=>w.id==='steady').hint,'Plays with the beat.');
  for(const key of B.BASS_MOVES){const name=B.bassMoveName(key);assert.deepEqual(checkPrompt(name).problems,[],name);assert.ok(name.split(/\s+/).length<=3,name);}
  for(const s of B.BASS_SIZES)assert.ok(s.label.split(/\s+/).length<=3);
});

// ---- Light is never the band's own bass with notes taken out ----
// A bar is equal to the band's when the line plays there and every note it plays is one of the band's notes (same
// onset and pitch class): a strict subset counts. Dragging out from the hub crosses Light first.
test('Light ways bring their own notes: never only band notes, at most one subset-equal bar, in all six scenes and densities',()=>{
  const allBand=[],equal=[],rhythm=[];let checked=0;
  for(const scene of SCENES)for(const density of [0,1,2,3,4])for(const minor of [false,true])for(const root of [0,3,7,10])for(const variant of VARIANTS) {
    const m=density===1?MATRIX.find(x=>x.scene===scene&&x.minor===minor&&x.root===root&&x.variant===variant):jamScore(scene,{root,minor,variant,density});
    const a=density===1?m.admission:B.bassAdmission(m.context);
    assert.ok(a.ok,`${scene} density ${density}: ${a.reason}`);
    const bandLine=band(m.song.events);
    for(const w of B.BASS_WAYS) {
      const key=`${w.id}-light`,line=B.bassWheelLine(a.ctx,key,m.song.events),o=B.bassOverlap(line,bandLine);checked++;
      const where=`${scene} d${density} ${variant} root ${root}${minor?'m':''} ${key}`;
      if(o.share>=1-EPS)allBand.push(where);
      if(o.equalBars>1)equal.push(`${where}: ${o.equalBars}`);
      // And through a phone: every Full line has attacks of its own (Walk Full in Swing once walked the band's quarters).
      if(B.bassSameRhythm(B.bassWheelLine(a.ctx,`${w.id}-full`,m.song.events),bandLine))rhythm.push(`${where} full`);
    }
  }
  assert.equal(checked,6*5*2*4*3*6);
  assert.deepEqual(allBand.slice(0,8),[],`${allBand.length} Light lines are only band notes`);
  assert.deepEqual(equal.slice(0,8),[],`${equal.length} Light lines equal the band in two bars or more`);
  assert.deepEqual(rhythm.slice(0,8),[],`${rhythm.length} Full lines play only the band's attacks`);
});

test('negative control: a line made of the band notes with some taken out counts every bar as equal',()=>{
  const m=ADMITTED.find(a=>a.scene==='swing-v1'),bandLine=band(m.song.events);
  const subset=bandLine.filter(n=>mod(onset(n),8)<EPS);
  assert.ok(subset.length<bandLine.length&&subset.length>=4);
  const o=B.bassOverlap(subset,bandLine);
  assert.equal(o.share,1);assert.equal(o.equalBars,4,'a strict subset is the band in every bar');
  assert.equal(B.bassOverlap([],bandLine).equalBars,0,'an empty bar is not the band');
  // The rhythm rule: the band's attacks with other pitches are the band's rhythm; one attack an eighth away is not.
  const repitched=bandLine.map(n=>({...n,concrete:{...n.concrete,midi_pitch:n.concrete.midi_pitch+7}}));
  assert.equal(B.bassSameRhythm(repitched,bandLine),true);assert.equal(B.bassSameRhythm(subset,bandLine),true);
  assert.equal(B.bassSameRhythm([...repitched,{...repitched[0],id:'x',step:repitched[0].step+2}],bandLine),false);
  assert.equal(B.bassSameRhythm([],bandLine),false);
});

// ---- Negative controls: each check above can fail ----
test('negative controls: a crossing note, a pitch at 35, a semitone clash and a copy of the band all fail their gates',()=>{
  const t=TUNES.find(t=>t.scene==='swing-v1'),line=B.bassWheelLine(t.ctx,'deep-full',[]);
  const crossing=line.map((n,i)=>i===0?{...n,duration_steps:8.5}:n);
  assert.ok(halfBarProblems(crossing).length>0);
  assert.ok(rangeProblems(line.map((n,i)=>i===1?{...n,concrete:{...n.concrete,midi_pitch:35}}:n)).length>0);
  const target=line.find(n=>pitch(n)!==t.ctx.bars[barOf(onset(n))].anchor);
  const held={id:'held',role:'lead',step:target.step,duration_steps:4,performance:{version:1,offset_steps:0},concrete:{midi_pitch:pitch(target)+13}};
  assert.ok(clashProblems(t.ctx,line,[held]).length>0);
  assert.ok(monoProblems([line[0],{...line[1],step:line[0].step,id:'twin'}]).length>0);
  const copy=band(t.m.song.events),o=B.bassOverlap(copy,copy);
  assert.equal(o.equalBars,4);assert.equal(o.share,1);
  // And the generator itself removes such a clash.
  const fixed=B.bassWheelLine(t.ctx,'deep-full',[held]);
  assert.deepEqual(clashProblems(t.ctx,fixed,[held]),[]);
});

test('lines are fast: building a context under 30 ms and a line under 2 ms on average',()=>{
  const m=ADMITTED[5];let t0=performance.now();
  for(let i=0;i<20;i++)B.bassContext(m.context);
  const ctxMs=(performance.now()-t0)/20;
  const ctx=m.admission.ctx;t0=performance.now();
  for(let i=0;i<10;i++)for(const key of MOVES)B.bassWheelLine(ctx,key,m.song.events);
  const lineMs=(performance.now()-t0)/(10*MOVES.length);
  assert.ok(ctxMs<30,`context ${ctxMs.toFixed(2)} ms`);assert.ok(lineMs<2,`line ${lineMs.toFixed(3)} ms`);
});
