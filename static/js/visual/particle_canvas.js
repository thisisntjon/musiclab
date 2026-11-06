/**
 * Draws the particle field on one canvas behind the page (aria-hidden, no pointer events).
 * Glow comes from pre-rendered sprites added together ("lighter"), not shadowBlur, which
 * measured about twice as slow (workflow/research/visual-wave/w4-prior-art-rendering.md).
 * Off when the person asks for less motion, in forced-colours mode, or when it cannot draw.
 */
import { createField, burst, step, seededRandom, enforceCaps, SPRITE_SCALE } from "./particles.js";

const SPRITE_PX = 32;
const BALL_PX = 22;
// The ball is drawn outside the field, so its whole glow is held back from the lit-area cap.
const BALL_AREA_PX2 = Math.PI * (BALL_PX / 2) ** 2;

function makeSprite(color) {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE_PX;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(SPRITE_PX / 2, SPRITE_PX / 2, 0, SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.18, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  return c;
}

export function createParticleCanvas({ isQuiet = () => false, forceMotion = () => false } = {}) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.className = "pf-particles";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const field = createField();
  const rand = seededRandom(Date.now() & 0xffff);
  const sprites = new Map();
  let dpr = 1;
  let last = 0;
  let slowFrames = 0;
  let goodFrames = 0;
  let budget = 1;
  let running = false;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const forced = window.matchMedia?.("(forced-colors: active)");
  // Calm or High Contrast: nothing drawn. Reduced motion: glows fade in place and nothing travels.
  const off = () => isQuiet() || Boolean(forced?.matches);
  const still = () => Boolean(reduced?.matches) && !forceMotion();

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  function sprite(color) {
    if (!sprites.has(color)) sprites.set(color, makeSprite(color));
    return sprites.get(color);
  }

  // The beat ball: lands at x0 when the beat is heard and arcs like a thrown ball to x1 by the next beat.
  let ballArc = null;
  function drawBall(now) {
    if (!ballArc) return;
    const k = (now - ballArc.start) / ballArc.periodMs;
    if (still()) {
      // No travel: the landing spot glows and fades over the beat.
      if (k > 1) {
        ballArc = null;
        return;
      }
      ctx.globalAlpha = 0.9 * (1 - k);
      ctx.drawImage(sprite("#F2F2F2"), ballArc.x0 - BALL_PX / 2, ballArc.y - BALL_PX / 2, BALL_PX, BALL_PX);
      return;
    }
    if (k > 1.25) {
      ballArc = null; // no new beat came: the music stopped, so the ball rests
      return;
    }
    const t = Math.min(1, k);
    const x = ballArc.x0 + (ballArc.x1 - ballArc.x0) * t;
    const y = ballArc.y - ballArc.height * 4 * t * (1 - t);
    const size = BALL_PX;
    ctx.globalAlpha = k > 1 ? Math.max(0, 1 - (k - 1) * 4) : 0.95;
    ctx.drawImage(sprite("#F2F2F2"), x - size / 2, y - size / 2, size, size);
  }

  function frame(now) {
    const dt = last ? now - last : 16;
    last = now;
    // Halve the work when frames run slow, so drawing never competes with the music; win it back after 2 s of good frames.
    if (dt > 20) {
      slowFrames++;
      goodFrames = 0;
    } else {
      slowFrames = Math.max(0, slowFrames - 1);
      goodFrames++;
    }
    if (slowFrames > 20) {
      budget = Math.max(0.25, budget / 2);
      slowFrames = 0;
    } else if (goodFrames > 120 && budget < 1) {
      budget = Math.min(1, budget * 2);
      goodFrames = 0;
    }
    if (off()) {
      // Drawing switched off mid-flight (Calm or High Contrast): drop everything so the loop can sleep.
      field.particles.length = 0;
      field.rings.length = 0;
      ballArc = null;
    }
    field.reservedPx2 = ballArc ? BALL_AREA_PX2 : 0;
    step(field, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!off()) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      for (const g of field.rings) {
        ctx.globalAlpha = g.alpha;
        ctx.strokeStyle = g.color;
        ctx.lineWidth = g.width;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of field.particles) {
        const size = p.r * SPRITE_SCALE;
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(sprite(p.color), p.x - size / 2, p.y - size / 2, size, size);
      }
      drawBall(now);
      ctx.globalAlpha = 1;
    }
    // Sleep when there is nothing left to draw: an idle page runs no frame loop at all.
    if (field.particles.length || field.rings.length || ballArc) requestAnimationFrame(frame);
    else {
      running = false;
      last = 0;
    }
  }
  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  return {
    canvas,
    field,
    /** One heard note at a page position (client pixels). */
    emit(x, y, color, { strength = 0.8, ring = false } = {}) {
      if (off()) return;
      const count = Math.max(1, Math.round((4 + strength * 4) * budget));
      burst(field, { x, y, color, strength, ring: ring && !still(), count, still: still() }, rand);
      wake();
    },
    /** A beat was just heard: land the ball at x0 and send it toward x1 over one bounce period. */
    ball({ x0, x1, y, periodMs }) {
      if (off()) return;
      ballArc = { x0, x1, y, periodMs: Math.max(150, periodMs), height: 26, start: performance.now() };
      field.reservedPx2 = BALL_AREA_PX2;
      enforceCaps(field);
      wake();
    },
    clear() {
      field.particles.length = 0;
      field.rings.length = 0;
      ballArc = null;
      field.reservedPx2 = 0;
    },
    get running() {
      return running;
    },
  };
}
