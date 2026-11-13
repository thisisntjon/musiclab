// Versioned experiment: stable phrase identity and fixed motif anchors across radial treatments.
import {PHRASES, VOCABULARY_VERSION} from './melody_phrase_library_v1.js';
import {melodyFieldPosition} from './melody_field.js';
import {GENRE_PROFILES} from './melody_composer_v5.js';
export const SUPPORTED_SCENES = new Set(['house-v1','reggae-v1','soul-v1']);

export const MELODY_FAMILIES = ['Bright hook', 'Smooth flow', 'Crisp bounce', 'Wide space'];
export const REGION_NAMES = [
  'Bright hook', 'Warm lift', 'Smooth flow', 'Long line',
  'Crisp bounce', 'Quick hop', 'Wide space', 'Deep air',
];
export const DEFAULT_COMPOSER_VERSION = 6;
export {VOCABULARY_VERSION};

const copy = x => structuredClone(x);
const q3 = x => Math.round(x * 1000) / 1000;

export function melodyChoice(position) {
  const p = melodyFieldPosition(position), r = Math.min(1, Math.hypot(p.x, p.y));
  if (r < 0.06) return {key: 'original', position: {x: 0, y: 0}, radius: 0, angle: 0, region: 0, label: 'Original'};
  const angle = ((Math.atan2(p.x, p.y) * 180 / Math.PI) + 360) % 360;
  const turn = Math.round(angle / 15) % 24;
  const ring = Math.max(1, Math.min(4, Math.round(r * 4)));
  const region = Math.round(turn / 3) % 8;
  return {key: `${turn}:${ring}`, position: p, radius: ring / 4, angle, region, label: `${REGION_NAMES[region]} ${ring}`};
}

// Helper to build 4-direction x 4-bar rhythmic cell banks: each bar is [[posInBar, gate, accent], ...].
const B = (hook, flow, bounce, space) => [hook, flow, bounce, space];

function profileFor(sceneId) {
  if(!SUPPORTED_SCENES.has(sceneId))throw new Error('This tune map is not ready for this band. Your tune stays.');
  return GENRE_PROFILES[sceneId];
}

function contourDistance(a, b) {
  const sample = p => Array.from({length: 8}, (_, i) => p.notes[Math.round(i * (p.notes.length - 1) / 7)][1] / Math.max(1, p.range));
  const ac = sample(a), bc = sample(b);
  const shape = ac.reduce((sum, v, i) => sum + Math.abs(v - bc[i]), 0) / 8;
  const endA = a.notes.at(-1)[1] - a.notes.at(-2)[1], endB = b.notes.at(-1)[1] - b.notes.at(-2)[1];
  return shape * 4 + Math.abs(endA - endB) / 8 + Math.abs(a.range - b.range) / 10 + Math.abs(a.notes.length - b.notes.length) / 14;
}

export function orderedContours(ctx, profile = null) {
  if (ctx.vocabularyVersion !== VOCABULARY_VERSION) {
    throw new Error('This phrase library needs its saved version. Your original stays.');
  }
  const prof = profile || profileFor(ctx.sceneId, ctx.form);
  const sorted = [...PHRASES].sort((a, b) => a.notes.length - b.notes.length || a.id.localeCompare(b.id));
  if (!sorted.length) throw new Error('No phrase fits these held notes and chords. Your groove stays.');
  const startIdx = ((prof.seed * 7) + ctx.root) % sorted.length;
  const rest = [...sorted.slice(startIdx), ...sorted.slice(0, startIdx)];
  const anchors = [rest.shift()];
  while (anchors.length < 8 && rest.length) {
    rest.sort((a, b) => Math.min(...anchors.map(x => contourDistance(b, x))) - Math.min(...anchors.map(x => contourDistance(a, x))) || a.id.localeCompare(b.id));
    anchors.push(rest.shift());
  }
  const ring = [anchors.shift()];
  while (anchors.length) {
    anchors.sort((a, b) => contourDistance(ring.at(-1), a) - contourDistance(ring.at(-1), b) || a.id.localeCompare(b.id));
    ring.push(anchors.shift());
  }
  // Each neighbourhood keeps one phrase at every radius.
  return ring.map(phrase => [phrase,phrase,phrase,phrase]);
}

function samplePhrasePitch(phrase, normPos) {
  const notes = phrase.notes;
  if (notes.length === 1) return notes[0][1];
  const firstStep = notes[0][0], span = Math.max(1, notes.at(-1)[0] - firstStep);
  const targetStep = firstStep + (normPos / 64) * span;
  let idx = 0;
  while (idx + 1 < notes.length && notes[idx + 1][0] <= targetStep) idx++;
  if (idx + 1 >= notes.length) return notes.at(-1)[1];
  const [s0, p0] = notes[idx], [s1, p1] = notes[idx + 1];
  const frac = s1 > s0 ? (targetStep - s0) / (s1 - s0) : 0;
  return p0 + (p1 - p0) * frac;
}

function buildGenreSlots(ctx, prof, region, ring, variant) {
  const dirA = Math.floor(region / 2) % 4;
  const dirB = (dirA + 1) % 4;
  const oddRegion = region % 2 === 1;
  const swingNudge = Number.isFinite(ctx.swing) ? (ctx.swing - 0.5) * 0.35 : 0;
  const rawSlots = [];

  for (let bar = 0; bar < 4; bar++) {
    const dir = oddRegion && bar % 2 === 1 ? dirB : dirA;
    let cells = prof.bars[dir][bar].map(c => [...c]);
    const coreOnset = cells[0][0];

    // Radial phrase development: inner ring 1 breathes with concise staccato core cells; outer rings add idiomatic pickups & contrast lift.
    if (ring === 1) {
      if (cells.length > 2) {
        cells = cells.filter((_, idx) => idx === 0 || idx === cells.length - 1 || idx === Math.floor(cells.length / 2));
      }
      cells = cells.map(([p, g, a]) => [p, Math.max(0.35, q3(g * 0.84)), a]);
    } else if (ring >= 3 && bar === 2 && cells.length <= 8) {
      const lastPos = cells.at(-1)[0];
      if (lastPos <= 12.5) cells.push([q3(Math.min(14.5, lastPos + 2)), ring === 4 ? 1.15 : 0.85, 0.88]);
      else cells[0][1] = Math.max(0.32, q3(cells[0][1] * (ring === 4 ? 0.68 : 0.80)));
    }
    if (ring === 4 && bar === 1 && cells.length <= 8) {
      const firstPos = cells[0][0];
      if (firstPos >= 2) cells.unshift([q3(firstPos - 1), 0.72, 0.86]);
      else cells[cells.length - 1][1] = Math.max(0.32, q3(cells[cells.length - 1][1] * 0.72));
    }

    // Sub-sector articulation micro-variation (always shortening so bar/next-note clamps never erase the distinction).
    if (variant === -1 && bar === 1 && cells.length >= 1) {
      cells[0][1] = Math.max(0.32, q3(cells[0][1] * 0.78));
    } else if (variant === 1 && bar === 2 && cells.length >= 1) {
      cells[0][1] = Math.max(0.32, q3(cells[0][1] * 0.74));
    }

    for (let i = 0; i < cells.length; i++) {
      const [inBar, gate, accent] = cells[i];
      const isIntegerOddEighth = Number.isInteger(inBar) && inBar % 4 === 2;
      const isIntegerOddSixteenth = Number.isInteger(inBar) && inBar % 2 === 1;
      const pocketShift = isIntegerOddSixteenth
        ? prof.pocket + swingNudge
        : isIntegerOddEighth
          ? (prof.tripletEighth ? 0.667 : prof.pocket * 0.5)
          : 0;
      const pos = q3(Math.max(bar * 16, Math.min(bar * 16 + 15.65, bar * 16 + inBar + pocketShift)));
      rawSlots.push({pos, rawGate: inBar===coreOnset?Math.min(prof.bars[dir][bar][0][1], 1.96, ...prof.bars[dir][bar].slice(1).map(c=>c[0]-coreOnset-.04)):gate, accent, bar, core:inBar===coreOnset});
    }
  }

  rawSlots.sort((a, b) => a.pos - b.pos);
  const deduped = [];
  for (const s of rawSlots) {
    if (!deduped.length || s.pos - deduped.at(-1).pos >= 0.3) deduped.push(s);
  }

  return deduped.map((s, idx) => {
    const nextPos = idx + 1 < deduped.length ? deduped[idx + 1].pos - 0.04 : 64;
    const barEnd = (s.bar + 1) * 16;
    const nextBarTones = s.bar < 3 ? ctx.harmony.bars[s.bar + 1] : null;
    const curTones = ctx.harmony.bars[s.bar];
    const sharedNext = nextBarTones ? curTones.some(pc => nextBarTones.includes(pc)) : false;
    const limitPos = sharedNext ? Math.min(nextPos, 64) : Math.min(nextPos, barEnd);
    const gate = q3(Math.max(0.25, Math.min(s.rawGate, limitPos - s.pos)));
    const step = Math.floor(s.pos);
    const offset = q3(s.pos - step);
    return {pos: s.pos, step, offset, gate, core:s.core, accent: s.accent, bar: s.bar, landing: idx === deduped.length - 1};
  });
}

function maxRunShare(pitches) {
  let run = 1, best = 1;
  for (let i = 1; i < pitches.length; i++) {
    run = pitches[i] === pitches[i - 1] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best / pitches.length;
}

function fitContourBeam(ctx, prof, phrase, slots, ring, variant, anchors = new Map()) {
  const [lo, hi] = prof.reg || ctx.register;
  const centre = Math.max(lo + 4, Math.min(hi - 4, prof.reg ? Math.round((lo + hi) / 2) : ctx.centre));
  const baseTarget = centre;
  const rawContour = slots.map(s => samplePhrasePitch(phrase, s.pos));
  const c0 = rawContour[0];
  const scale = 1;
  const insp = ctx.inspiration?.contour;

  let beam = [{cost: 0, pitches: [], run: 0}];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const lastBar = Math.min(3, Math.floor((s.pos + s.gate - 1e-6) / 16));
    let pcs = ctx.harmony.bars[s.bar].map(pc => (pc + ctx.root) % 12);
    for (let b = s.bar + 1; b <= lastBar; b++) {
      const nextPcs = ctx.harmony.bars[b].map(pc => (pc + ctx.root) % 12);
      const inter = pcs.filter(pc => nextPcs.includes(pc));
      pcs = inter;
    }
    const landingPc = (ctx.harmony.ending + ctx.root) % 12;
    if (s.landing && ring >= 2 && pcs.includes(landingPc)) pcs = [landingPc];

    let options = [];
    for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) options.push(m);
    if (!options.length) {
      for (let m = Math.max(36, lo - 12); m <= Math.min(96, hi + 12); m++) if (pcs.includes(m % 12)) options.push(m);
    }
    if(s.core && anchors.has(s.pos))options=options.filter(m=>m===anchors.get(s.pos));
    if (!options.length) return null;

    const lift = s.bar === 2 && ring >= 3 ? 2 : 0;
    const inspShift = insp ? insp[i % insp.length] * 0.35 : 0;
    const target = baseTarget + (rawContour[i] - c0) * scale + lift + inspShift;
    const desiredMove = i ? (rawContour[i] - rawContour[i - 1]) * scale : 0;
    const sourceSign = Math.abs(desiredMove) >= 0.45 ? Math.sign(desiredMove) : 0;

    const grown = [];
    for (const state of beam) {
      const prev = state.pitches.at(-1);
      for (const m of options) {
        const move = i ? m - prev : 0;
        const run = i && m === prev ? state.run + 1 : 1;
        const cost = state.cost
          + Math.abs(m - target) * 0.55
          + (i ? Math.abs(move - desiredMove) * 1.15 : 0)
          + (sourceSign && move && Math.sign(move) !== sourceSign ? 14 : 0)
          + (sourceSign && move === 0 ? 5.5 : 0)
          + (run >= 2 ? (run - 1) * 9 : 0)
          + Math.max(0, Math.abs(move) - 9) * 2.8;
        grown.push({cost, pitches: [...state.pitches, m], run});
      }
    }
    beam = grown.sort((a, b) => a.cost - b.cost || a.pitches.at(-1) - b.pitches.at(-1)).slice(0, 32);
    if (!beam.length) return null;
  }

  const limit = slots.length >= 4 ? 0.5 : 1;
  const clean = beam.filter(s => maxRunShare(s.pitches) < limit);
  const pool = clean.length ? clean : beam;
  const seen = new Set();
  const distinct = pool.filter(s => {
    const k = s.pitches.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const pickIdx = variant === 0 ? 0 : variant === -1 ? Math.min(1, distinct.length - 1) : Math.min(2, distinct.length - 1);
  return {pitches: distinct[pickIdx].pitches, sourcePitches: rawContour.map(x => Math.round(x))};
}

function anchorCandidate(ctx, position, groups = null, profile = null) {
  const choice = melodyChoice(position);
  if (choice.key === 'original') return {choice, notes: copy(ctx.source.events), description: 'Your starting tune'};
  const [turn, ring] = choice.key.split(':').map(Number);
  const region = Math.round(turn / 3) % 8;
  const variant = ((turn - region * 3 + 25) % 24) - 1;
  const prof = profile || profileFor(ctx.sceneId, ctx.form);
  const families = groups || orderedContours(ctx, profile);
  const group = families[region % families.length];
  const phrase = group[Math.min(ring - 1, group.length - 1)];

  const slots = buildGenreSlots(ctx, prof, region, ring, variant);
  const referenceSlots = buildGenreSlots(ctx, prof, region, 2, 0);
  const reference = fitContourBeam(ctx, prof, phrase, referenceSlots, 2, 0);
  if(!reference)throw new Error('This phrase does not fit. Your groove stays.');
  const anchors = new Map(referenceSlots.flatMap((s,i)=>s.core?[[s.pos,reference.pitches[i]]]:[]));
  const fitted = fitContourBeam(ctx, prof, phrase, slots, ring, variant, anchors);
  if (!fitted) throw new Error('This phrase does not fit. Your groove stays.');

  const sec = 15 / ctx.bpm;
  const barArc = [0.96, 0.92, 1.05, 1.0];
  const generated = slots.map((s, i) => {
    const pitch = fitted.pitches[i];
    const vel = Math.max(0.18, Math.min(0.85, +(prof.level * s.accent * barArc[s.bar]).toFixed(4)));
    return {
      id: `phrase-v6-${choice.key}-${ctx.sceneId}-${i}`,
      role: 'lead',
      patch_id: ctx.patch,
      step: s.step,
      duration_steps: s.gate,
      start_sec: (s.step + s.offset) * sec,
      duration_sec: s.gate * sec,
      performance: {version: 1, offset_steps: s.offset},
      velocity: vel,
      concrete: {midi_pitch: pitch, freq_hz: 440 * 2 ** ((pitch - 69) / 12)},
      pitch_lock_mode: 'concrete',
      provenance: 'jam_generated',
      generated_by: 'musiclab_phrase_composer_v6',
      derivation: {
        version: 6,
        scene: ctx.sceneId,
        family: prof.family,
        vocabularyVersion: VOCABULARY_VERSION,
        phrase_id: phrase.id,
        motif_anchor: Boolean(s.core),
        source: phrase.source,
        source_sha256: phrase.source_sha256,
        boundary: phrase.boundary,
        source_pitch: fitted.sourcePitches[i],
      },
    };
  });

  return {
    choice,
    notes: [...copy(ctx.source.events.filter(n => n.role !== 'lead')), ...generated],
    description: `${choice.label}: a ${prof.family} phrase fitted to this band`,
    phraseId: phrase.id,
  };
}

// Neighbouring regions hand over complete bars, never interpolate attack times.
// The two intermediate cells retain three/one bars of the previous idea.
export function planMelodyCandidate(ctx, position, groups = null, profile = null) {
  const choice=melodyChoice(position);
  if(choice.key==='original')return {choice,notes:copy(ctx.source.events),description:'Your starting tune'};
  const [turn,ring]=choice.key.split(':').map(Number),region=Math.floor(turn/3),phase=turn%3;
  const families=groups||orderedContours(ctx, profile);
  const at=r=>{const angle=(r%8)*Math.PI/4;return anchorCandidate(ctx,{x:Math.sin(angle)*ring/4,y:Math.cos(angle)*ring/4},families,profile);};
  const left=at(region);
  if(!phase)return {...left,choice};
  const right=at(region+1),cut=phase===1?48:16;
  const lead=[...left.notes.filter(n=>n.role==='lead'&&n.step<cut),...right.notes.filter(n=>n.role==='lead'&&n.step>=cut)]
    .map((n,i)=>{
      const onset=n.step+(n.performance?.offset_steps||0);
      const duration=n.step<cut?Math.min(n.duration_steps,cut-onset):n.duration_steps;
      return {...n,id:`phrase-v6-${choice.key}-${ctx.sceneId}-${i}`,duration_steps:duration,duration_sec:duration*15/ctx.bpm,
        derivation:{...n.derivation,bridge:{from:left.phraseId,to:right.phraseId,cutStep:cut}}};
    });
  return {choice,phraseId:`${left.phraseId}->${right.phraseId}`,notes:[...copy(ctx.source.events.filter(n=>n.role!=='lead')),...lead],
    description:'Two related ideas hand over a bar at a time'};
}

export function buildMelodyPalette(ctx) {
  return buildPaletteWithProfile(ctx, profileFor(ctx.sceneId));
}

// Explicit profile injection for later versioned composers. Legacy admission stays fixed.
export function buildPaletteWithProfile(ctx, profile) {
  const groups = orderedContours(ctx, profile);
  const plans = {original: planMelodyCandidate(ctx, {x: 0, y: 0}, groups, profile)};
  for (let t = 0; t < 24; t++) {
    for (let r = 1; r <= 4; r++) {
      const a = t * Math.PI / 12;
      const plan = planMelodyCandidate(ctx, {x: Math.sin(a) * r / 4, y: Math.cos(a) * r / 4}, groups, profile);
      plans[plan.choice.key] = plan;
    }
  }
  return plans;
}
