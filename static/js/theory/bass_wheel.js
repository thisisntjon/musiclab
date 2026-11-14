/** Bass wheel v1: six ways of playing x three sizes of a generated bass line over the band's own chords.
 *
 * Pure, synchronous and deterministic. Nothing here starts audio, edits a song or reads the clock.
 * Every line is built from the generic cells in TEMPLATES (root, third, fifth, octave and in-scale
 * approach idioms) over the band's own chord plan, kick and snare; no existing song's bassline is
 * transcribed. v1 freezes at its first release: after that, any change to a cell, rule or level ships as a new version
 * and generator. (Before release, review fixes went into v1 itself: the subset rule for equal bars, Steady Light's
 * alternate cell, the rhythm rule at Full, the key each note is built for and snapshot timing from steps.)
 *
 * API (frozen for the UI stream)
 *  Moves are strings: BASS_BAND ('band', the hub: the band's own bass) or '<way>-<size>', e.g. 'funky-big'.
 *   BASS_WAYS, BASS_SIZES, BASS_MOVES (19 keys), bassMoveKey(way,size), parseBassMove(key), bassMoveName(key).
 *  Admission and context:
 *   bassAdmission(phraseContext, sourceEvents?, {saved?, bandBasis?, scale?}) -> {ok:true, ctx} | {ok:false, reason}
 *   bassContext(...same...) -> frozen ctx | null.
 *    phraseContext: the melody session's context (captureMelodyContext + composerVersion 9).
 *    sourceEvents: the session's pinned score (defaults to phraseContext.source.events).
 *    saved: the record a Keep stored (phraseContext.bassWheel or the doc's saved melody context). It is used
 *     only while the score still holds wheel notes; then it supplies the band's ORIGINAL bass, so the hub, the
 *     never-the-band rule, bar levels and pocket never come from a kept line.
 *    bandBasis: the session's unsoftened velocities by id (melody_balance), so a saved Softer band never lowers bar levels.
 *    Reasons when not admitted: no-context, scene, composer, form, time, harmony, no-band-bass, bar-empty, off-chord (the
 *    band's first bass note in a bar is not a chord tone), mixed-bass, band-bass-unknown (a kept line with no valid record).
 *    Every V9 context of the six scenes is admitted (tests/js/theory/bass-wheel.test.mjs); an inverted band bass (Reggae
 *    and Ska 'answer', bar 4) becomes that bar's anchor, so a line starts each bar where the band does.
 *   ctx.openingMove: the move the pinned score already plays: 'band', the kept line's move read from its note tags, or
 *    'kept' for an untagged kept line (no move reaches it; Original and Undo return to it).
 *   ctx.band: the band's own bass events, unsoftened (frozen). ctx.bars: per bar anchor, chord tones and level.
 *   ctx.lines[move]: the tune-free line, its cell, its match with the band and its level trim.
 *  Lines:
 *   bassWheelLine(ctx, move, events) -> bass events for that move over this candidate's tune (events are the
 *    candidate's full score; lead notes there decide the tune-clash and busy-tune passes). 'band' returns ctx.band.
 *   withBassLine(events, line) -> events with the band's and any wheel bass replaced by line; every other
 *    event is returned unchanged (same object), personal and edited bass stay.
 *   bassCandidateEvents(ctx, move, events) = withBassLine(events, bassWheelLine(ctx, move, events)).
 *   applyBassMove(ctx, move, events): the rule for the UI's _candidate. At ctx.openingMove it returns events untouched
 *    (a reopened save keeps its stored bass even when the tune moves); any other move gets its line. Every origin call
 *    site (heardMelodyCandidate's fallback, paint's current and origin candidates) must pass the opening move
 *    explicitly, never the requested one, so Keep before anything is heard saves the bass that was heard.
 *   bassBasis(ctx) -> {id: unsoftened velocity} for the band's bass and every line slot; bassLineBasis(line) for one
 *    line. Ids name template slots and never depend on the tune, so a basis is the same in every tune variant; merge
 *    bassBasis(ctx) into bandBasis before balancedEvents (and at Keep save only the heard ids) so Softer band softens
 *    wheel and band notes exactly once.
 *   bassMoveOf(events) -> the move the score's wheel notes carry ('band' when there are none, null if mixed).
 *   bassWheelRecord(ctx, move) -> {version:1, generator:'bass-wheel-v1', move, band}: store as context.bassWheel at Keep.
 *    band holds {version, sceneId, root, minor, swing, events}; its events' seconds are re-derived from their steps at
 *    the tempo of every later admission, so a Keep survives Faster and Slower.
 *  Key and feel (attack review, band hand): every line note carries bass_wheel.built_for {root, minor, swing}, the
 *   key, major or minor chords and played swing its line was built for. bassKeyOf(doc) reads what a doc's band plays
 *   by the compiler's rule (humanize off plays swing .5); bassKeyFits(builtFor, doc) says whether a kept line still fits.
 *   jam_session.js gives a kept line way to the band's own bass once it does not (the band hand's 'X is home' changes
 *   global_context without a direction change; a line kept over a swung band, by the doc's first Keep, gives way on the
 *   next call, when the band plays straight); with no wheel notes left the wheel admits the live band.
 *  Joins (attack fix 1):
 *   Simplest: send EVERY request (tune, sound, bass, Undo, Original) as queueContinuousPartAudition(view,
 *    {sectionId, requestId, joinSteps:4, bassSafe:'auto'}). The scheduler compares the request's generated bass with
 *    the score it has SCHEDULED (each queue call replaces the pending choice and its join, so comparing with the last
 *    request is wrong); a changed bass joins at the half bar, bass-safe: outgoing generated bass notes end .1 step
 *    before the join, and it never joins while one still sounds (Soul's own band bass crosses step 8 in every bar).
 *   bassJoinPlan(outgoingEvents, incomingEvents, {beatJoin}) -> {bassChanged, joinSteps, bassSafe, crossings}: the same
 *    decision as a pure function (for status text or callers outside the scheduler); outgoingEvents must be the
 *    scheduled score (getPartAuditionState().scheduledId).
 *  Wheel geometry and keys: bassSector(x, y, prev), bassKeyMove(move, key).
 *  Measures: bassOverlap(line, band) -> {shared, total, share, equalBars} (same onset and pitch class; a bar is equal
 *   when every line note there is a band note, so the band with notes taken out still counts), bassSameRhythm(line,
 *   band) (every attack is a band attack: what a phone speaker leaves of a bass), bassOnset(note).
 */
import {bassInterval} from './underneath.js';

export const BASS_WHEEL_VERSION=1;
export const BASS_WHEEL_GENERATOR='musiclab_bass_wheel_v1';
export const BASS_WHEEL_RECORD='bass-wheel-v1';
const BAND_GENERATOR='musiclab_jam';
export const BASS_WHEEL_SCENES=Object.freeze(['house-v1','reggae-v1','soul-v1','ska-v1','rocksteady-v1','swing-v1']);
/** Finger bass loses its fundamental below C2, so lower notes would sound as their own octave. */
export const BASS_FLOOR=36;
export const BASS_CEILING=57;
export const BASS_BAND='band';
export const BASS_JOIN_STEPS=8;
/** At most this share of a line's notes may be the band's own bass notes (same onset and pitch class, so the band's
 * line an octave lower counts): at Full (audibly a different bass) and at Big. Light is sparse by design and only
 * has to differ from the band in three of four bars (a bar of band notes only, a strict subset included, is equal).
 * At Full a line also needs a rhythm of its own (bassSameRhythm). A cell that fails gives way to its alternate. */
export const BASS_FULL_OVERLAP_MAX=.4;
export const BASS_BIG_OVERLAP_MAX=.5;
const OVERLAP_MAX={light:Infinity,full:BASS_FULL_OVERLAP_MAX,big:BASS_BIG_OVERLAP_MAX};
export const BASS_WAYS=Object.freeze([
  {id:'deep',label:'Deep',hint:'Long low notes.'},
  {id:'steady',label:'Steady',hint:'Plays with the beat.'},
  {id:'walk',label:'Walk',hint:'Steps up and down.'},
  {id:'bounce',label:'Bounce',hint:'Jumps low and high.'},
  {id:'funky',label:'Funky',hint:'Short notes with gaps.'},
  {id:'chill',label:'Chill',hint:'Easy, with lots of space.'},
].map(Object.freeze));
export const BASS_SIZES=Object.freeze([{id:'light',label:'Light'},{id:'full',label:'Full'},{id:'big',label:'Big'}].map(Object.freeze));
const WAY_IDS=BASS_WAYS.map(w=>w.id),SIZE_IDS=BASS_SIZES.map(s=>s.id);
export const BASS_MOVES=Object.freeze([BASS_BAND,...WAY_IDS.flatMap(w=>SIZE_IDS.map(s=>`${w}-${s}`))]);

export const bassMoveKey=(way,size)=>WAY_IDS.includes(way)&&SIZE_IDS.includes(size)?`${way}-${size}`:null;
export function parseBassMove(key) {
  if(key===BASS_BAND)return Object.freeze({key,way:null,size:null});
  if(typeof key!=='string')return null;
  const [way,size,...rest]=key.split('-');
  return !rest.length&&bassMoveKey(way,size)?Object.freeze({key,way,size}):null;
}
/** 'Band bass', or the way's name with its size: 'Funky bass, big'. */
export function bassMoveName(key) {
  const m=parseBassMove(key);if(!m)return null;
  if(!m.way)return 'Band bass';
  return `${BASS_WAYS.find(w=>w.id===m.way).label} bass, ${m.size}`;
}

// ---- Wheel geometry (disk x,y from -1 to 1 with y up; 0 degrees at the top, clockwise) ----
export const BASS_HUB_RADIUS=.3;
export const BASS_RING_EDGES=Object.freeze([.55,.78]);
export const BASS_RING_HYSTERESIS=.03;
export const BASS_SECTOR_HYSTERESIS_DEG=4;
const ringOf=r=>r<BASS_RING_EDGES[0]?0:r<BASS_RING_EDGES[1]?1:2;
/** The move under a disk point: 'band' inside radius .30, otherwise '<way>-<size>' (six 60-degree sectors, Deep
 * at the top, then clockwise; Light to .55, Full to .78, Big beyond, including past the rim while dragging).
 * Outside the disk with no drag in progress it returns null. prev is the move a drag holds: its sector stays until
 * the angle is 4 degrees past an edge, and its ring until .03 past a ring edge (the hub edge holds the same way). */
export function bassSector(x,y,prev=null) {
  if(![x,y].every(Number.isFinite))return null;
  const r=Math.hypot(x,y),held=prev==null?null:parseBassMove(prev);
  const hubEdge=BASS_HUB_RADIUS+(held?.key===BASS_BAND?BASS_RING_HYSTERESIS:held?-BASS_RING_HYSTERESIS:0);
  if(r<hubEdge)return BASS_BAND;
  if(r>1&&!held)return null;
  const angle=(Math.atan2(x,y)*180/Math.PI+360)%360;
  let way=Math.round(angle/60)%6;
  if(held?.way) {
    const i=WAY_IDS.indexOf(held.way),off=Math.abs((((angle-i*60)%360)+540)%360-180);
    if(off<=30+BASS_SECTOR_HYSTERESIS_DEG)way=i;
  }
  let ring=ringOf(r);
  if(held?.size) {
    const i=SIZE_IDS.indexOf(held.size),lo=i===0?-Infinity:BASS_RING_EDGES[i-1]-BASS_RING_HYSTERESIS,hi=i===2?Infinity:BASS_RING_EDGES[i]+BASS_RING_HYSTERESIS;
    if(r>=lo&&r<hi)ring=i;
  }
  return `${WAY_IDS[way]}-${SIZE_IDS[ring]}`;
}

/** What one key does: Left/Right the previous/next way at the same size (from the hub, the first move lands on
 * Full); Up bigger, Down smaller, clamped at Light and Big (Up from the hub opens Deep at Light); Home the band
 * bass; Enter/Space cycles the size of the chosen way Full, Big, Light, Full (on the hub it picks Deep at Full).
 * Returns the next move key, or null for keys the wheel leaves alone. */
export function bassKeyMove(move,key) {
  const m=parseBassMove(move)||parseBassMove(BASS_BAND);
  if(key==='Home')return BASS_BAND;
  if(key==='ArrowLeft'||key==='ArrowRight') {
    const step=key==='ArrowRight'?1:-1;
    if(!m.way)return `${WAY_IDS[step>0?0:5]}-full`;
    return `${WAY_IDS[(WAY_IDS.indexOf(m.way)+step+6)%6]}-${m.size}`;
  }
  if(key==='ArrowUp'||key==='ArrowDown') {
    if(!m.way)return key==='ArrowUp'?'deep-light':BASS_BAND;
    const i=Math.max(0,Math.min(2,SIZE_IDS.indexOf(m.size)+(key==='ArrowUp'?1:-1)));
    return `${m.way}-${SIZE_IDS[i]}`;
  }
  if(key==='Enter'||key===' ') {
    if(!m.way)return 'deep-full';
    return `${m.way}-${{full:'big',big:'light',light:'full'}[m.size]}`;
  }
  return null;
}

// ---- Cells ----
// Each entry is [position in 16ths, token, gate in steps, accent]. Tokens: R the bar's bass anchor (its root, or the
// band's own inversion bass), 3 and 5 the next chord tones above it, 8 its octave, 7 the chord seventh (else the
// octave), A an in-scale approach (one or two semitones) to the next bar's anchor, G a ghost of the previous pitch,
// K a root on every kick of the bar. 'Tn' is the offbeat eighth of beat n. Accent 'kick' is 1 on a kick, else .8.
// Further cells for a size are alternates, used only when an earlier cell would sound too much like the band's
// own bass in this context (more than 40% shared notes at Full, equal bars in two of four, or at Full only the band's
// attack times). Steady Light's alternate adds an octave pickup on the offbeat of beat four, where a band that
// walks in quarters or plays only on the kick never is.
const EIGHTHS=[0,2,4,6,8,10,12,14];
const TEMPLATES=Object.freeze({
  deep:{
    light:[[[0,'R',7.5,1],[8,'R',7.5,.85]]],
    full:[[[0,'R',7.5,1],[8,'R',5.5,.9],[14,'A',1.6,.8]],
      [[0,'R',7.5,1],[8,'R',6.4,.9],[15,'A',.9,.8]],
      [[0,'R',5.5,1],[6,'5',1.8,.82],[8,'R',5.5,.9],[14,'A',1.6,.8]]],
    big:[[[0,'R',7.5,1.1],[8,'R',3.8,1],[12,'5',1.8,.85],[14,'A',1.8,.85]],
      [[0,'R',5.5,1.1],[6,'5',1.8,.85],[8,'R',3.8,1],[12,'5',1.8,.85],[14,'A',1.8,.85]]],
  },
  steady:{
    light:[[[null,'K',4,1]],[[null,'K',4,1],['T3','8',1.2,.8]]],
    full:[EIGHTHS.map(p=>[p,'R',1.7,'kick'])],
    big:[[...EIGHTHS.map(p=>[p,p===6?'5':p===14?'8':'R',p===14?1.6:1.7,'kick']),[15,'A',.9,.75],[null,'K',1.7,1]]],
  },
  walk:{
    light:[[[0,'R',7.2,1],[8,'5',7.2,.9]],[[0,'R',7.2,1],[8,'3',7.2,.9]]],
    full:[[[0,'R',3.6,1],[4,'3',3.6,.88],[8,'5',3.6,.92],[12,'A',3.6,.88]],
      [[0,'R',3.6,1],[4,'5',3.6,.88],[8,'8',3.6,.92],[12,'A',3.6,.88]],
      [[0,'R',3.6,1],[4,'8',3.6,.88],[8,'5',1.8,.92],['T2','3',1.6,.82],[12,'A',3.6,.88]],
      [[0,'R',1.8,1],['T0','3',1.6,.82],[4,'5',3.6,.88],[8,'8',1.8,.92],['T2','5',1.6,.82],[12,'A',3.6,.88]]],
    big:[[[0,'R',3.5,1.05],[4,'3',1.8,.88],['T1','5',1.8,.8],[8,'8',3.5,.95],[12,'5',1.8,.85],['T3','A',1.8,.85]],
      [[0,'R',1.8,1.05],['T0','3',1.6,.82],[4,'5',1.8,.88],['T1','8',1.6,.8],[8,'5',1.8,.95],['T2','3',1.6,.82],[12,'R',1.8,.85],['T3','A',1.6,.85]]],
  },
  bounce:{
    light:[[[0,'R',1.8,1],[4,'8',1.8,.85],[8,'R',1.8,1],[12,'8',1.8,.85]]],
    full:[[[0,'R',1.6,1],['T0','8',1.2,.8],[4,'R',1.6,.9],['T1','8',1.2,.8],[8,'R',1.6,1],['T2','8',1.2,.8],[12,'R',1.6,.9],['T3','8',1.2,.8]]],
    big:[[[0,'R',1.7,1.1],['T0','8',1.4,.85],[4,'R',1.7,.95],['T1','8',1.4,.85],[7,'R',.7,.7],[8,'R',1.7,1.05],['T2','8',1.4,.85],[12,'R',1.7,.95],['T3','8',1.2,.85],[15,'A',.8,.75]]],
  },
  funky:{
    light:[[[0,'R',1.5,1],[7,'8',.6,.85],[10,'R',1.2,.95]]],
    full:[[[0,'R',1.5,1],[2,'8',.6,.8],[6,'R',1,.9],[7,'7',.5,.75],[10,'R',1.2,.95],[13,'5',.6,.8],[14,'8',.5,.8]],
      [[0,'R',1.5,1],[2,'5',.6,.8],[6,'8',1,.9],[7,'R',.5,.75],[10,'R',1.2,.95],[13,'5',.6,.8],[15,'8',.5,.8]]],
    big:[[[0,'R',1.8,1.12],[2,'8',.7,.85],[5,'G',.25,.45],[6,'R',1.2,.95],[7,'7',.6,.8],[9,'G',.25,.45],[10,'R',1.4,1],[13,'5',.7,.85],[14,'8',.6,.85],[15,'A',.6,.8],[null,'K',1,1]]],
  },
  chill:{
    light:[[[8,'R',5,1],[14,'5',1.5,.8]]],
    full:[[[2,'R',2.5,.9],[6,'3',1.5,.85],[8,'R',3,1],[11,'5',1,.8],[14,'R',1.5,.85]]],
    big:[[[2,'R',3.5,.95],[6,'3',1.8,.9],[8,'R',3.5,1.08],[11,'5',1.2,.85],[12,'8',.9,.75],[14,'R',1.8,.9]]],
  },
});
/** Level match (frozen with v1). A line's velocity is the band's bar level x accent x one trim per line, chosen so
 * the line's loudness proxy sits LEVEL_TARGET_DB from the band's own bass: sum of velocity^LEVEL_EXP x (held time,
 * capped at LEVEL_HOLD_SEC because Finger bass decays, plus LEVEL_ATTACK_SEC for the attack). The exponent is measured
 * on the delivered Finger bass (+3 dB of velocity gives about +5.2 dB out); the proxy then matches the renders within
 * about 0.3 dB (development records). No note goes above BASS_ACCENT_MAX x
 * the band's bar level, so Big is busier and longer, not louder. The trim is computed on the tune-free line, so a
 * tune move never changes a note's level. */
export const BASS_ACCENT_MAX=1.12;
const LEVEL_TARGET_DB=Object.freeze({light:-1,full:-.75,big:-.5});
const LEVEL_EXP=3.5,LEVEL_HOLD_SEC=.9,LEVEL_ATTACK_SEC=.08;

// ---- Helpers ----
const EPS=1e-6;
const mod=(a,n=12)=>((a%n)+n)%n;
const r6=x=>Math.round(x*1e6)/1e6;
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const copy=x=>structuredClone(x);
const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]};
const offsetOf=n=>n?.performance?.version===1&&Number.isFinite(n.performance.offset_steps)&&n.performance.offset_steps>=0
  &&n.performance.offset_steps<1?n.performance.offset_steps:0;
export const bassOnset=n=>Number(n.step)+offsetOf(n);
const pitchOf=n=>{const m=n?.concrete?.midi_pitch;if(Number.isFinite(m))return m;
  const f=n?.concrete?.freq_hz;return Number.isFinite(f)&&f>0?Math.round(69+12*Math.log2(f/440)):NaN;};
const durationOf=(n,bpm)=>Number.isFinite(n.duration_steps)?n.duration_steps:Number(n.duration_sec)/(15/bpm);
const isBandBass=n=>n?.role==='bass'&&n.provenance==='jam_generated'&&n.generated_by===BAND_GENERATOR&&!n.edited_from_generator;
const isWheelBass=n=>n?.role==='bass'&&n.provenance==='jam_generated'&&n.generated_by===BASS_WHEEL_GENERATOR&&!n.edited_from_generator;
const isPersonalBass=n=>n?.role==='bass'&&!isBandBass(n)&&!isWheelBass(n);
const icClash=(a,b)=>{const d=mod(a-b);return d===1||d===11||d===6;};
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[s.length>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
function validHarmony(h){
  return h?.version===1&&Array.isArray(h.bars)&&h.bars.length===4&&h.bars.every(bar=>Array.isArray(bar)&&bar.length>=3&&bar.length<=5
    &&new Set(bar).size===bar.length&&bar.every(n=>Number.isInteger(n)&&n>=0&&n<12));
}

/** Chord of one bar (pitch classes relative to the song root): its triad root, third and fifth, and seventh if any. */
function barChord(set) {
  for(const r of set) {
    const third=[3,4].find(i=>set.includes(mod(r+i)));
    if(third!=null&&set.includes(mod(r+7))) {
      const seventh=[10,11].find(i=>set.includes(mod(r+i)))??null;
      return {root:r,tones:[r,mod(r+third),mod(r+7)],seventh:seventh==null?null:mod(r+seventh)};
    }
  }
  return null;
}

// ---- Admission ----
const fail=reason=>({ok:false,reason});
/** A band bass event as the wheel keeps it: its steps decide, and its seconds always come from them at the admitted
 * tempo, rounded as the compiler rounds (so a live band stays byte for byte). A saved record holds seconds from the
 * tempo of its Keep; after Faster or Slower they would make Band bass overlap itself and cross the joins. */
function snapshotEvent(n,bpm,basis) {
  const e=copy(n),v=Number.isFinite(basis?.[n.id])?basis[n.id]:n.velocity,sec=15/bpm;
  e.velocity=v;e.duration_steps=durationOf(n,bpm);
  e.start_sec=Number((Number(n.step)*sec+offsetOf(n)*sec).toFixed(6));
  e.duration_sec=Number((e.duration_steps*sec).toFixed(6));
  if(!Number.isFinite(e.concrete?.freq_hz))e.concrete={...e.concrete,freq_hz:440*2**((pitchOf(n)-69)/12)};
  return e;
}
function validSnapshot(saved,pc,minor) {
  const band=saved?.band;
  // A band snapshot in another key, or over the other (major or minor) chords, cannot stand in for this band.
  return saved?.version===1&&saved.generator===BASS_WHEEL_RECORD&&band?.version===1&&band.sceneId===pc.sceneId&&band.root===pc.root
    &&(typeof band.minor!=='boolean'||band.minor===minor)
    &&Array.isArray(band.events)&&band.events.length>0&&band.events.every(n=>n?.role==='bass'&&Number.isInteger(n.step)&&n.step>=0&&n.step<64
      &&Number.isFinite(pitchOf(n))&&Number.isFinite(n.velocity)&&n.velocity>0&&n.velocity<=1&&Number.isFinite(n.duration_steps)&&n.duration_steps>0
      &&typeof n.id==='string');
}

/** Whether the bass wheel can play over this pinned score, and its frozen context. Never throws on bad input. */
export function bassAdmission(phraseContext,sourceEvents=phraseContext?.source?.events,{saved=phraseContext?.bassWheel??null,bandBasis=phraseContext?.bandBasis??null,scale=null}={}) {
  const pc=phraseContext;
  if(!pc||typeof pc!=='object')return fail('no-context');
  if(!BASS_WHEEL_SCENES.includes(pc.sceneId))return fail('scene');
  if(pc.composerVersion!==9)return fail('composer');
  if(pc.form||pc.mode)return fail('form');
  if((pc.stepsPerBar??16)!==16||(pc.totalSteps??64)!==64)return fail('time');
  if(!validHarmony(pc.harmony)||!Number.isInteger(pc.root)||pc.root<0||pc.root>11)return fail('harmony');
  const bpm=Number(pc.bpm);if(!Number.isFinite(bpm)||bpm<=0)return fail('time');
  if(!Array.isArray(sourceEvents))return fail('no-context');
  const minor=typeof scale==='string'?/minor|dorian|phrygian/.test(scale)
    :pc.harmony.bars[0].includes(3)&&!pc.harmony.bars[0].includes(4);
  const live=sourceEvents.filter(isBandBass),kept=sourceEvents.filter(isWheelBass);
  if(live.length&&kept.length)return fail('mixed-bass');
  let band;
  if(kept.length) {
    if(!validSnapshot(saved,pc,minor))return fail('band-bass-unknown');
    band=saved.band.events.map(n=>snapshotEvent(n,bpm,null));
  } else band=live.map(n=>snapshotEvent(n,bpm,bandBasis));
  if(!band.length)return fail('no-band-bass');
  if(band.some(n=>!Number.isFinite(bassOnset(n))||!Number.isFinite(pitchOf(n))||!Number.isFinite(n.duration_steps)||n.duration_steps<=0))return fail('no-band-bass');
  band.sort((a,b)=>bassOnset(a)-bassOnset(b)||String(a.id).localeCompare(String(b.id)));
  const scalePcs=SCALES[minor?'minor':'major'].map(p=>mod(p+pc.root));
  const bars=[];
  for(let bar=0;bar<4;bar++) {
    const chord=barChord(pc.harmony.bars[bar]);
    if(!chord)return fail('harmony');
    const notes=band.filter(n=>Math.floor(bassOnset(n)/16+EPS)===bar);
    if(!notes.length)return fail('bar-empty');
    // The band's first attack sets the bar's bass anchor: its root, or the band's own inversion bass.
    const anchorPc=mod(pitchOf(notes[0])-pc.root),at=chord.tones.indexOf(anchorPc);
    if(at<0&&anchorPc!==chord.seventh)return fail('off-chord');
    const stack=at<0?[anchorPc,...chord.tones]:[0,1,2].map(i=>chord.tones[(at+i)%3]);
    const anchor=BASS_FLOOR+mod(pc.root+anchorPc);
    const above=p=>anchor+mod(p-anchorPc);
    bars.push(freeze({anchor,anchorPc,inversion:anchorPc===chord.root?'root':at===1?'third':at===2?'fifth':'seventh',
      rootPc:chord.root,third:above(stack[1]),fifth:above(stack[2]),
      seventh:chord.seventh==null?null:above(chord.seventh),
      chordPcs:[...chord.tones,...(chord.seventh==null?[]:[chord.seventh])].map(p=>mod(p+pc.root)),
      level:Math.max(...notes.map(n=>n.velocity))}));
  }
  const drums=sourceEvents.filter(n=>n.role==='drums'&&n.provenance==='jam_generated'&&Number.isFinite(bassOnset(n)));
  const hits=patches=>[0,1,2,3].map(bar=>[...new Set(drums.filter(n=>patches.includes(n.patch_id)&&Math.floor(bassOnset(n)/16+EPS)===bar)
    .map(n=>r6(bassOnset(n)-bar*16)))].sort((a,b)=>a-b));
  const kicks=hits(['kick']),snares=hits(['snare','clap']);
  // Pocket: the band's own median offset at each sixteenth (drums and bass), where it plays there.
  const pocket=Array(16).fill(null),groove=[...drums,...band];
  for(let p=0;p<16;p++) {
    const at=groove.filter(n=>mod(Math.floor(bassOnset(n)+EPS),16)===p).map(n=>r6(bassOnset(n)-Math.floor(bassOnset(n)+EPS)));
    if(at.length)pocket[p]=median(at);
  }
  const triplet=groove.some(n=>{const f=mod(bassOnset(n),1);return Math.abs(f-1/3)<.02||Math.abs(f-2/3)<.02;});
  const patches=band.map(n=>n.patch_id).filter(Boolean),patch=patches.sort((a,b)=>patches.filter(x=>x===b).length-patches.filter(x=>x===a).length||a.localeCompare(b))[0]||'sampled_bass_v1';
  const personal=sourceEvents.filter(isPersonalBass).map(n=>bassInterval(n,{global_context:{swing:pc.swing??.5,bpm},scaffold_options:{}}));
  // A kept line's notes carry their move; an untagged or mixed kept line opens as 'kept', which no move reaches.
  const openingMove=kept.length?bassMoveOf(sourceEvents)??'kept':BASS_BAND;
  const ctx={version:BASS_WHEEL_VERSION,sceneId:pc.sceneId,root:pc.root,minor,bpm,swing:Number.isFinite(pc.swing)?pc.swing:.5,
    swingFeel:pc.sceneId==='swing-v1'||triplet,patch,bars,kicks,snares,pocket,scalePcs,personal,
    band:band.map(n=>copy(n)),openingMove,bandSource:kept.length?'saved':'live'};
  ctx.lines=Object.fromEntries(BASS_MOVES.filter(k=>k!==BASS_BAND).map(k=>[k,chooseLine(ctx,parseBassMove(k))]));
  return {ok:true,ctx:freeze(ctx)};
}
export function bassContext(...args){const a=bassAdmission(...args);return a.ok?a.ctx:null;}

// ---- Lines ----
/** Tune-free line of one cell: placed, kick-locked, pumped, swung and pitched. Stable for a context. */
function cellSlots(ctx,way,size,cellIndex) {
  const cell=TEMPLATES[way][size][cellIndex],out=[];
  for(let bar=0;bar<4;bar++) {
    const kicks=ctx.kicks[bar],snares=ctx.snares[bar],slots=[];
    cell.forEach(([pos,token,gate,accent],i)=>{
      if(token==='K') {
        kicks.forEach((k,j)=>{
          if(way==='funky'&&snares.some(s=>k>s-1.01&&k<s+.51))return;
          slots.push({slot:`k${j}`,at:k,token:'R',gate,accent,kick:true});
        });
        if(way==='steady'&&size==='light'&&!kicks.some(k=>k<1))slots.push({slot:'d',at:0,token:'R',gate,accent:1});
        return;
      }
      const at=typeof pos==='string'?Number(pos.slice(1))*4+2:pos;
      slots.push({slot:String(i),at,token,gate,accent,offbeat:typeof pos==='string'});
    });
    // Beats one and three sit exactly on a kick within one step: sample-tight with it.
    for(const s of slots)if(!s.kick&&(s.at===0||s.at===8)) {
      const near=kicks.filter(k=>Math.abs(k-s.at)<=1).sort((a,b)=>Math.abs(a-s.at)-Math.abs(b-s.at)||a-b)[0];
      if(near!=null){s.at=near;s.locked=true;}
    }
    // A kick root that falls on a template note is that note.
    const placed=[];
    for(const s of slots.sort((a,b)=>(a.kick?1:0)-(b.kick?1:0)||a.at-b.at))if(!placed.some(p=>Math.abs(p.at-s.at)<.5))placed.push(s);
    // Funky's pump: the step before a snare or clap stays empty, so the backbeat lands in a gap.
    if(way==='funky')for(const s of [...placed].sort((a,b)=>a.at-b.at)) {
      const before=at=>snares.some(sn=>sn-at>EPS&&sn-at<=1+EPS);
      if(!before(s.at))continue;
      const to=s.at-1;
      if(to>=0&&!before(to)&&!placed.some(p=>p!==s&&Math.abs(p.at-to)<.5))s.at=to;
      else placed.splice(placed.indexOf(s),1);
    }
    for(const s of placed) {
      s.accentValue=s.accent==='kick'?(kicks.some(k=>Math.abs(k-s.at)<.5)?1:.8):s.accent;
      // Feel: the band's pocket; in swing every offbeat eighth is a triplet late (performance offsets replace swing).
      const whole=Math.floor(s.at+EPS),frac=s.at-whole;
      let at=whole+frac;
      if(!s.locked&&!s.kick&&frac<EPS) {
        // Swing plays on a triplet grid: the offbeat eighth (and a sixteenth pickup before the beat) falls two
        // thirds into the beat's second half, a sixteenth after the beat on its middle triplet.
        if(ctx.swingFeel&&mod(whole,4)===2)at=whole+2/3;
        else if(ctx.swingFeel&&mod(whole,4)===3)at=whole-1/3;
        else if(ctx.swingFeel&&mod(whole,4)===1)at=whole+1/3;
        else if(ctx.pocket[whole]!=null)at=whole+ctx.pocket[whole];
        else if(whole%2===1)at=whole+Math.max(0,Math.min(.5,ctx.swing-.5));
      }
      s.onset=r6(bar*16+at);
    }
    placed.sort((a,b)=>a.onset-b.onset);
    // Two attacks closer than .45 of a step are one: an approach stays (it leads into the next bar), else the stronger.
    const rank=s=>(s.token==='A'?10:0)+s.accentValue;
    for(let i=1;i<placed.length;i++)if(placed[i].onset-placed[i-1].onset<.45){
      placed.splice(rank(placed[i])<rank(placed[i-1])?i:i-1,1);i--;
    }
    for(const s of placed)out.push({...s,bar});
  }
  // Pitches, in time order across the phrase (approaches need the next bar's anchor and the previous pitch).
  let prev=null;
  for(const s of out) {
    const b=ctx.bars[s.bar],next=ctx.bars[(s.bar+1)%4];
    const octave=b.anchor+12<=BASS_CEILING?b.anchor+12:b.fifth;
    let pitch;
    if(s.token==='R')pitch=b.anchor;
    else if(s.token==='3')pitch=b.third;
    else if(s.token==='5')pitch=b.fifth;
    else if(s.token==='8')pitch=octave;
    else if(s.token==='7')pitch=b.seventh==null?octave:b.seventh<=BASS_CEILING?b.seventh:b.seventh-12>=BASS_FLOOR?b.seventh-12:b.anchor;
    else if(s.token==='G')pitch=prev??b.anchor;
    else if(s.token==='A')pitch=approach(ctx,next.anchor,prev??b.anchor,s.onset);
    s.pitch=pitch;prev=pitch;
  }
  return out;
}
/** An in-scale tone one or two semitones from target, on the side the line comes from (never repeating the previous
 * pitch), inside 36-57, preferring a pitch class the band's own bass does not play at that moment. */
function approach(ctx,target,prev,onset) {
  const ok=p=>p>=BASS_FLOOR&&p<=BASS_CEILING&&ctx.scalePcs.includes(mod(p));
  const below=[target-1,target-2].find(ok),above=[target+1,target+2].find(ok);
  const sides=(prev>target?[above,below]:[below,above]).filter(p=>p!=null);
  const bandPcs=ctx.band.filter(n=>Math.abs(bassOnset(n)-onset)<.5).map(n=>mod(pitchOf(n)));
  const ranked=[...sides.filter(p=>p!==prev&&!bandPcs.includes(mod(p))),...sides.filter(p=>p!==prev),...sides];
  return ranked[0]??target;
}
// The same onset and the same pitch class: the band's walk an octave lower is still the band's walk.
const sameNote=(a,b)=>Math.abs(a.onset-b.onset)<.01&&mod(a.pitch)===mod(b.pitch);
/** Share of a line's notes the band's bass also plays (same onset and pitch class), and how many bars are equal: the
 * line plays in that bar and every note it plays there is one of the band's (the band with notes taken out is still
 * the band, so a strict subset counts). */
export function bassOverlap(line,band) {
  const L=line.map(n=>({onset:n.onset??bassOnset(n),pitch:n.pitch??pitchOf(n)})),B=band.map(n=>({onset:n.onset??bassOnset(n),pitch:n.pitch??pitchOf(n)}));
  const shared=L.filter(a=>B.some(b=>sameNote(a,b))).length;
  let equalBars=0;
  for(let bar=0;bar<4;bar++) {
    const l=L.filter(n=>Math.floor(n.onset/16+EPS)===bar),b=B.filter(n=>Math.floor(n.onset/16+EPS)===bar);
    if(l.length&&l.every(x=>b.some(y=>sameNote(x,y))))equalBars++;
  }
  return {shared,total:L.length,share:L.length?shared/L.length:0,equalBars};
}
/** Attacks closer than this (in steps) are one attack to the ear: about 38 ms at 100 BPM. */
const SAME_ATTACK=.25;
/** Whether every attack of a line is one of the band's attacks: the band's rhythm, whatever the pitches. Through a
 * phone speaker (the render's 300 Hz phone gate, attack fix 9) a bass keeps little of its pitch and mostly its
 * rhythm, so a Full line that only plays where the band plays sounds like the band there (Walk Full in Swing). */
export function bassSameRhythm(line,band) {
  const at=n=>n.onset??bassOnset(n),B=band.map(at);
  return line.length>0&&line.every(n=>B.some(b=>Math.abs(b-at(n))<SAME_ATTACK));
}
function chooseLine(ctx,{way,size}) {
  // The first cell that passes: shares little enough with the band, equals it in at most one bar and, at Full, has a
  // rhythm of its own. Failing that, the cell nearest to passing, the share and bar rules first.
  const cells=TEMPLATES[way][size];let best=null;
  const rank=m=>[m.equalBars<=1&&m.share<=OVERLAP_MAX[size]+EPS?0:1,m.share,m.equalBars,m.sameRhythm?1:0];
  const better=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];return false;};
  for(let c=0;c<cells.length;c++) {
    const slots=cellSlots(ctx,way,size,c),m=bassOverlap(slots,ctx.band);
    const sameRhythm=size==='full'&&bassSameRhythm(slots,ctx.band);
    const passes=m.equalBars<=1&&m.share<=OVERLAP_MAX[size]+EPS&&!sameRhythm;
    if(passes){best={cell:c,slots,match:m};break;}
    if(!best||better(rank({...m,sameRhythm}),best.rank))best={cell:c,slots,match:m,rank:rank({...m,sameRhythm})};
  }
  const cell='abcdefgh'[best.cell];
  // Level match on the tune-free line, with the gates it actually plays.
  const gates=heldGates(best.slots),sec=15/ctx.bpm;
  const proxy=notes=>notes.reduce((sum,[v,g])=>sum+v**LEVEL_EXP*(Math.min(g*sec,LEVEL_HOLD_SEC)+LEVEL_ATTACK_SEC),0);
  const raw=best.slots.map((s,i)=>[ctx.bars[s.bar].level*s.accentValue,gates[i]]);
  const bandProxy=proxy(ctx.band.map(n=>[n.velocity,n.duration_steps]))*10**(LEVEL_TARGET_DB[size]/10);
  const ceiling=BASS_ACCENT_MAX/Math.max(...best.slots.map(s=>s.accentValue));
  const trim=Math.min(ceiling,(bandProxy/Math.max(1e-12,proxy(raw)))**(1/LEVEL_EXP));
  return {way,size,cell,match:best.match,trim,slots:best.slots.map(s=>({id:`bass-wheel-v1:${way}:${size}:${cell}:${s.bar}:${s.slot}`,
    bar:s.bar,slot:s.slot,onset:s.onset,pitch:s.pitch,token:s.token,gate:s.gate,accent:s.accentValue,
    ghost:s.token==='G',velocity:r6(Math.min(.99,ctx.bars[s.bar].level*s.accentValue*trim))}))};
}
/** One voice (wrap included) and the join cap: each note ends .05 before the next and .1 before its half-bar line. */
function heldGates(notes) {
  return notes.map((n,i)=>{
    const next=i+1<notes.length?notes[i+1].onset:64+(notes[0]?.onset??0),line8=(Math.floor(n.onset/8+EPS)+1)*8;
    return r6(Math.max(.1,Math.min(n.gate,next-n.onset-.05,line8-.1-n.onset)));
  });
}

const leadNotes=(events,bpm)=>(events||[]).filter(n=>n?.role==='lead'&&Number.isFinite(pitchOf(n))&&Number.isFinite(bassOnset(n)))
  .map(n=>({start:bassOnset(n),end:bassOnset(n)+Math.max(.001,durationOf(n,bpm)||0),pitch:pitchOf(n)}));
const overlaps=(a0,a1,b0,b1)=>a0<b1-EPS&&b0<a1-EPS;

/** The bass for one move over this candidate's score. */
export function bassWheelLine(ctx,move,events=[]) {
  const m=parseBassMove(move);
  if(!ctx||!m)throw new Error('Unknown bass move.');
  if(!m.way)return ctx.band.filter(n=>!ctx.personal.some(([s,e])=>overlaps(bassOnset(n),bassOnset(n)+n.duration_steps,s,e))).map(copy);
  const line=ctx.lines[m.key],tune=leadNotes(events,ctx.bpm),sounding=t=>tune.filter(n=>n.start<=t+EPS&&n.end>t+EPS).map(n=>n.pitch);
  const attacks=Array(8).fill(0);for(const n of tune)if(n.start>=0&&n.start<64)attacks[Math.floor(n.start/8+EPS)]++;
  const firsts=new Set([0,1,2,3].map(bar=>line.slots.find(s=>s.bar===bar)?.id).filter(Boolean));
  let notes=[];let prev=null;
  for(const s of line.slots) {
    const b=ctx.bars[s.bar],n={...s};
    if(n.ghost&&prev!=null)n.pitch=prev;
    // 1. Tune clash: a non-root note a semitone or tritone from a sounding tune note moves to the root, then the
    // fifth, then the third (the first of them the band's own bass does not play at that moment); a weak note with
    // no way out drops, a strong one takes the root.
    const now=sounding(n.onset),clashes=p=>now.some(q=>icClash(p,q));
    if(!firsts.has(n.id)&&n.token!=='R'&&clashes(n.pitch)) {
      const free=[b.anchor,b.fifth,b.third].filter(p=>!clashes(p));
      const bandHere=ctx.band.filter(x=>Math.abs(bassOnset(x)-n.onset)<.01).map(x=>mod(pitchOf(x)));
      if(free.length)n.pitch=free.find(p=>!bandHere.includes(mod(p)))??free[0];
      else if(n.accent<.6)continue;
      else n.pitch=b.anchor;
    }
    // 2. A busy tune: Full and Big drop ghosts and short offbeat notes in that half bar.
    const pos=n.onset-s.bar*16,onBeat=Math.abs(pos-Math.round(pos/4)*4)<.05;
    if(line.size!=='light'&&attacks[Math.floor(n.onset/8+EPS)]>=4&&(n.ghost||(n.gate<=.75&&!onBeat&&n.token!=='A')))continue;
    notes.push(n);prev=n.pitch;
  }
  // 3. Personal and edited bass keep their time; the new line goes round them.
  notes=notes.filter(n=>!ctx.personal.some(([s,e])=>overlaps(n.onset,n.onset+n.gate,s,e)));
  // 4. One voice (wrap included), 5. no note reaches the next half-bar line (bass moves join there).
  notes.sort((a,b)=>a.onset-b.onset);
  const gates=heldGates(notes);
  return notes.map((n,i)=>{
    const gate=gates[i],step=Math.floor(n.onset+EPS),offset=r6(Math.max(0,n.onset-step));
    return {id:n.id,role:'bass',patch_id:ctx.patch,step,duration_steps:gate,velocity:n.velocity,
      concrete:{midi_pitch:n.pitch,freq_hz:440*2**((n.pitch-69)/12)},pitch_lock_mode:'concrete',
      performance:{version:1,offset_steps:offset},start_sec:n.onset*15/ctx.bpm,duration_sec:gate*15/ctx.bpm,
      provenance:'jam_generated',generated_by:BASS_WHEEL_GENERATOR,
      bass_wheel:{version:BASS_WHEEL_VERSION,way:line.way,size:line.size,cell:line.cell,bar:n.bar,slot:n.slot,
        built_for:{root:ctx.root,minor:ctx.minor,swing:ctx.swing}}};
  });
}

/** Replace the band's and any wheel bass with line. Personal, edited and every non-bass event stay as they are. */
export function withBassLine(events,line) {
  return [...events.filter(n=>!isBandBass(n)&&!isWheelBass(n)),...line.map(copy)];
}
export const bassCandidateEvents=(ctx,move,events)=>withBassLine(events,bassWheelLine(ctx,move,events));
/** The score a candidate plays for a bass move: untouched at the opening move (the band's bass, or a reopened save's
 * stored line, even when the tune has moved), otherwise with that move's line. */
export function applyBassMove(ctx,move,events) {
  if(!ctx||move===ctx.openingMove)return events;
  return bassCandidateEvents(ctx,move,events);
}
export const bassLineBasis=line=>Object.fromEntries(line.map(n=>[n.id,n.velocity]));
/** Unsoftened velocities for every id the wheel can play in this context: the band's own bass and every template slot
 * of every line. They never depend on the tune; merge them into the session's bandBasis so Softer band softens each
 * wheel or band note exactly once (at Keep, save only the heard ids). */
export function bassBasis(ctx) {
  return Object.fromEntries([...ctx.band.map(n=>[n.id,n.velocity]),
    ...Object.values(ctx.lines).flatMap(l=>l.slots.map(s=>[s.id,s.velocity]))]);
}
/** The move the score's wheel notes carry: 'band' with none, null when they disagree or are untagged. */
export function bassMoveOf(events) {
  const tags=(events||[]).filter(isWheelBass).map(n=>n.bass_wheel);
  if(!tags.length)return BASS_BAND;
  const keys=new Set(tags.map(t=>t?.version===1?bassMoveKey(t.way,t.size):null));
  return keys.size===1&&!keys.has(null)?[...keys][0]:null;
}
/** What Keep stores as context.bassWheel: the heard move and the band's ORIGINAL bass (unsoftened). */
export function bassWheelRecord(ctx,move) {
  if(!ctx||!parseBassMove(move))throw new Error('Unknown bass move.');
  return {version:1,generator:BASS_WHEEL_RECORD,move,band:{version:1,sceneId:ctx.sceneId,root:ctx.root,minor:ctx.minor,swing:ctx.swing,events:ctx.band.map(copy)}};
}

// ---- Key and feel ----
/** A swing change smaller than this is not a new feel: under 5 ms at 100 BPM (and a line built over a band playing
 * the default .52 still fits after a Keep, which plays .5). */
export const BASS_SWING_TOLERANCE=.03;
/** The key and feel a doc's band plays in ({global_context, scaffold_options}): the root pitch class, major or minor
 * (scene_catalogue.js: minor, dorian or phrygian are minor; the band's chords follow nothing else of the scale) and
 * the PLAYED swing, by the compiler's rule (standalone_compiler.js, underneath.js bassInterval): .5 while
 * scaffold_options.humanize is false, otherwise global_context.swing (.52 by default) kept between .5 and .68.
 * Every Keep turns humanize off (selected_melody.js), so after it the band plays straight whatever swing says. */
export function bassKeyOf(doc) {
  const gc=doc?.global_context||{};
  return {root:mod(Number(gc.root_pc??0)||0),minor:/minor|dorian|phrygian/.test(gc.scale_type||''),
    swing:doc?.scaffold_options?.humanize===false?.5:Math.max(.5,Math.min(.68,Number(gc.swing||.52)))};
}
/** Whether a line built for builtFor ({root, minor, swing}: a wheel note's bass_wheel.built_for, or a saved record's
 * band; its swing is the swing the band played, ctx.swing) still fits what a doc's band plays now. A kept line's notes
 * are concrete pitches and offsets, so once the key, the major or minor chords or the played swing it was built for
 * change (the band hand's 'X is home', the studio's scale, a band that plays straight after a Keep made over a swung
 * one), it no longer fits and gives way to the band's own bass (jam_session.js), so bass and band keep one feel.
 * A swing number the band does not play (humanize off) changes nothing. With nothing recorded it fits. */
export function bassKeyFits(builtFor,doc) {
  if(!builtFor||typeof builtFor!=='object'||!Number.isInteger(builtFor.root))return true;
  const now=bassKeyOf(doc);
  return builtFor.root===now.root&&(typeof builtFor.minor!=='boolean'||builtFor.minor===now.minor)
    &&(!Number.isFinite(builtFor.swing)||Math.abs(builtFor.swing-now.swing)<=BASS_SWING_TOLERANCE+EPS);
}

// ---- Joins ----
const bassSignature=events=>JSON.stringify((events||[]).filter(n=>n?.role==='bass').map(n=>[n.id,r6(bassOnset(n)),r6(Number(n.duration_steps??n.duration_sec)),pitchOf(n),n.patch_id])
  .sort((a,b)=>a[1]-b[1]||String(a[0]).localeCompare(String(b[0]))));
/** How a part-audition request should join. Compare with the SCHEDULED score, not the last requested one. */
export function bassJoinPlan(outgoingEvents,incomingEvents,{beatJoin=4,totalSteps=64}={}) {
  if(!Array.isArray(outgoingEvents))return {bassChanged:null,joinSteps:beatJoin,bassSafe:false,crossings:[]};
  if(bassSignature(outgoingEvents)===bassSignature(incomingEvents))return {bassChanged:false,joinSteps:beatJoin,bassSafe:false,crossings:[]};
  const incoming=new Set((incomingEvents||[]).filter(n=>n?.role==='bass').map(n=>JSON.stringify([n.id,r6(bassOnset(n)),pitchOf(n)])));
  const crossings=[];
  for(const n of outgoingEvents) {
    if(!(isBandBass(n)||isWheelBass(n))||incoming.has(JSON.stringify([n.id,r6(bassOnset(n)),pitchOf(n)])))continue;
    const s=bassOnset(n),e=s+Number(n.duration_steps??0);
    for(let line=Math.floor(s/8)*8+8;line<e-.1-EPS;line+=8)crossings.push({id:n.id,step:mod(line,totalSteps)});
  }
  return {bassChanged:true,joinSteps:BASS_JOIN_STEPS,bassSafe:true,crossings};
}
