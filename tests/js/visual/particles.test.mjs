// Particles answer sound only, stay under the flash area, and fade rather than blink.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createField, burst, step, litArea, seededRandom, MAX_PARTICLES, LIT_AREA_CAP, FLASH_AREA_PX2, SPRITE_SCALE,
} from "../../../static/js/visual/particles.js";

test("an empty field stays empty: nothing moves unless a sound makes it", () => {
  const f = createField();
  for (let i = 0; i < 100; i++) step(f, 16);
  assert.equal(f.particles.length, 0);
  assert.equal(f.rings.length, 0);
});

test("a burst makes particles that all fade out within their life", () => {
  const f = createField();
  burst(f, { x: 100, y: 100, color: "#fff", ring: true }, seededRandom(3));
  assert.ok(f.particles.length > 0);
  assert.equal(f.rings.length, 1);
  for (let i = 0; i < 120; i++) step(f, 16);
  assert.equal(f.particles.length, 0);
  assert.equal(f.rings.length, 0);
});

test("brightness only ever falls after a burst (a fade, never a blink)", () => {
  const f = createField();
  burst(f, { x: 0, y: 0, color: "#fff" }, seededRandom(9));
  const p = f.particles[0];
  let last = p.alpha;
  for (let i = 0; i < 40 && f.particles.includes(p); i++) {
    step(f, 16);
    assert.ok(p.alpha <= last + 1e-9);
    last = p.alpha;
  }
});

test("a storm of notes stays under the count cap and a quarter of the flash area", () => {
  const f = createField();
  const rand = seededRandom(5);
  for (let i = 0; i < 400; i++) {
    burst(f, { x: rand() * 1000, y: rand() * 700, color: "#0ff", strength: 1, ring: true }, rand);
    if (i % 4 === 0) step(f, 16);
    assert.ok(f.particles.length <= MAX_PARTICLES);
    assert.ok(litArea(f) <= LIT_AREA_CAP + 1e-6);
  }
  assert.ok(LIT_AREA_CAP <= FLASH_AREA_PX2 / 4);
});

test("the same seed gives the same particles", () => {
  const a = createField();
  const b = createField();
  burst(a, { x: 5, y: 5, color: "#f0f" }, seededRandom(42));
  burst(b, { x: 5, y: 5, color: "#f0f" }, seededRandom(42));
  step(a, 30);
  step(b, 30);
  assert.deepEqual(a, b);
});

test("with reduced motion a note leaves one glow that fades in place and never moves", () => {
  const f = createField();
  burst(f, { x: 40, y: 50, color: "#0ff", still: true, ring: true }, seededRandom(2));
  assert.equal(f.particles.length, 1);
  assert.equal(f.rings.length, 0);
  const p = f.particles[0];
  for (let i = 0; i < 30; i++) step(f, 16);
  assert.equal(p.x, 40);
  assert.equal(p.y, 50);
  assert.ok(p.alpha < 0.9);
});

// The glow each particle really puts on screen: the canvas draws a sprite r * SPRITE_SCALE wide
// (static/js/visual/particle_canvas.js), so a pixel inside that disc can brighten while alpha >= 0.1.
function drawnArea(f) {
  let a = f.reservedPx2 || 0;
  for (const p of f.particles) if (p.alpha >= 0.1) a += Math.PI * ((p.r * SPRITE_SCALE) / 2) ** 2;
  for (const g of f.rings) if (g.alpha >= 0.1) a += 2 * Math.PI * g.radius * (g.width + 1);
  return a;
}

test("measured by what is drawn, not by the particle's core, the storm still stays under a quarter of the flash area", () => {
  const f = createField();
  f.reservedPx2 = Math.PI * 11 * 11; // the beat ball, 22 px glow
  const rand = seededRandom(11);
  for (let i = 0; i < 300; i++) {
    burst(f, { x: rand() * 1200, y: rand() * 800, color: "#ff8a00", strength: 1, ring: true }, rand);
    step(f, 8 + rand() * 40);
    assert.ok(drawnArea(f) <= LIT_AREA_CAP + 1e-6, `drawn ${drawnArea(f).toFixed(0)} px2 over cap`);
  }
});

test("the canvas draws particles at the same scale the cap counts", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync(new URL("../../../static/js/visual/particle_canvas.js", import.meta.url), "utf8"));
  assert.match(src, /p\.r \* SPRITE_SCALE/);
  assert.doesNotMatch(src, /p\.r \* \d/);
});
