/**
 * Particles that answer sound. Pure simulation: no DOM, no clock, no randomness of its own
 * (the caller passes a seeded random), so every rule here is testable in Node.
 *
 * Rules this file keeps:
 * - Particles are only ever made by a sound being heard or a press (`burst`); nothing drifts on its own.
 * - Lit area is capped (`LIT_AREA_CAP`) far under the WCAG 2.3.1 flash area, and particles fade
 *   rather than blink, so a burst cannot become a flash.
 * - The total count is capped (`MAX_PARTICLES`); the oldest go first.
 * - Motion is water-like: drag, a gentle rise, and a smooth swirl field, never a jolt.
 */

export const MAX_PARTICLES = 260;
// WCAG 2.3.1 counts a flash over a quarter of a 10-degree field, about 341 x 256 px at 1024 x 768
// (21,824 px^2 is a quarter of that). We keep everything lit together under a quarter of the quarter.
export const FLASH_AREA_PX2 = 21824;
export const LIT_AREA_CAP = FLASH_AREA_PX2 / 4;
export const LIFE_MS = 1100;
// The canvas draws each particle as a glow sprite SPRITE_SCALE * r wide; the lit-area count uses the same size.
export const SPRITE_SCALE = 5;
// A pixel counts as lit while its glow adds at least this much brightness (WCAG counts a 10% change).
const LIT_ALPHA = 0.1;
const DRAG_PER_S = 2.2;
const RISE_PX_S = 18;
const SWIRL_PX_S = 22;

/** A small deterministic random (mulberry32) so tests and replays match. */
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createField() {
  // reservedPx2: area held back for things drawn outside the field (the beat ball), so the cap covers them too.
  return { particles: [], rings: [], timeMs: 0, reservedPx2: 0 };
}

/** Area one particle lights right now: its whole drawn glow disc while it is bright enough to count. */
export function particleArea(p) {
  if (p.alpha < LIT_ALPHA) return 0;
  const rd = (p.r * SPRITE_SCALE) / 2;
  return Math.PI * rd * rd;
}

/** A ring's drawn band, one pixel wider than its stroke for antialiasing. */
export function ringArea(g) {
  return g.alpha < LIT_ALPHA ? 0 : 2 * Math.PI * g.radius * (g.width + 1);
}

export function litArea(field) {
  let sum = field.reservedPx2 || 0;
  for (const p of field.particles) sum += particleArea(p);
  for (const g of field.rings) sum += ringArea(g);
  return sum;
}

/**
 * Add the particles for one heard note at (x, y).
 * @param {object} field
 * @param {{x:number,y:number,color:string,strength?:number,ring?:boolean,count?:number}} spec
 * @param {() => number} rand
 */
export function burst(field, spec, rand) {
  const strength = Math.min(1, Math.max(0.2, Number(spec.strength ?? 0.8)));
  if (spec.still) {
    // Reduced motion: one soft glow that fades where the note is, with no movement (WCAG 2.3.3 counts a fade as not motion).
    field.particles.push({ x: spec.x, y: spec.y, vx: 0, vy: 0, r: 3 + 1.5 * strength, alpha: 0.9, age: 0, life: LIFE_MS, color: spec.color, seed: 0, still: true });
    enforceCaps(field);
    return;
  }
  const count = Math.max(1, Math.min(10, Math.round(spec.count ?? 4 + strength * 4)));
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const speed = 30 + rand() * 70 * strength;
    field.particles.push({
      x: spec.x,
      y: spec.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed * 0.6,
      r: 1.5 + rand() * 2 * strength,
      alpha: 0.9,
      age: 0,
      life: LIFE_MS * (0.7 + rand() * 0.5),
      color: spec.color,
      seed: rand() * 1000,
    });
  }
  if (spec.ring) {
    field.rings.push({ x: spec.x, y: spec.y, radius: 6, grow: 70 + 40 * strength, width: 1.5, alpha: 0.55, age: 0, life: 700, color: spec.color });
  }
  enforceCaps(field);
}

/** Oldest first out until both the count and the lit-area caps hold. */
export function enforceCaps(field) {
  if (field.particles.length > MAX_PARTICLES) field.particles.splice(0, field.particles.length - MAX_PARTICLES);
  while (field.rings.length > 6) field.rings.shift();
  let area = litArea(field);
  while (area > LIT_AREA_CAP && (field.particles.length || field.rings.length)) {
    const p = field.particles.shift();
    if (p) area -= particleArea(p);
    else {
      area -= ringArea(field.rings.shift());
    }
  }
}

/** A smooth, slow swirl like water around a stone (sum of sines; no noise library). */
export function swirl(x, y, tSec, seed = 0) {
  const a = Math.sin(y * 0.012 + tSec * 0.7 + seed) + Math.sin((x + y) * 0.007 - tSec * 0.4);
  const b = Math.cos(x * 0.011 - tSec * 0.6 + seed) + Math.cos((x - y) * 0.009 + tSec * 0.3);
  return { dx: a * 0.5, dy: b * 0.5 };
}

export function step(field, dtMs) {
  const dt = Math.min(64, Math.max(0, dtMs)) / 1000;
  field.timeMs += dt * 1000;
  const t = field.timeMs / 1000;
  const keep = [];
  for (const p of field.particles) {
    p.age += dt * 1000;
    if (p.age >= p.life) continue;
    if (p.still) {
      const k = p.age / p.life;
      p.alpha = 0.9 * (1 - k) * (1 - k);
      keep.push(p);
      continue;
    }
    const s = swirl(p.x, p.y, t, p.seed);
    const drag = Math.exp(-DRAG_PER_S * dt);
    p.vx = p.vx * drag + s.dx * SWIRL_PX_S * dt;
    p.vy = p.vy * drag + s.dy * SWIRL_PX_S * dt - RISE_PX_S * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // Ease out, never a step change: brightness falls smoothly to 0 over the life.
    const k = p.age / p.life;
    p.alpha = 0.9 * (1 - k) * (1 - k);
    keep.push(p);
  }
  field.particles = keep;
  const rings = [];
  for (const g of field.rings) {
    g.age += dt * 1000;
    if (g.age >= g.life) continue;
    const k = g.age / g.life;
    g.radius = 6 + g.grow * (1 - Math.exp(-4 * k));
    g.alpha = 0.55 * Math.exp(-3.5 * k);
    rings.push(g);
  }
  field.rings = rings;
  enforceCaps(field); // rings grow as they spread, so the lit-area cap is checked every frame, not only on a burst
  return field;
}
