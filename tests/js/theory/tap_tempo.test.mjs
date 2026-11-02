// F-CORE-2: tapping only suggests a speed, with no time window to hit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addTap, suggestSpeed, MIN_TAPS, MAX_GAP_MS } from "../../../static/js/theory/tap_tempo.js";

const tapsAt = (gapMs, n, start = 1000) => {
  let t = [];
  for (let i = 0; i < n; i++) t = addTap(t, start + i * gapMs);
  return t;
};

test("no suggestion until there are enough taps", () => {
  assert.equal(suggestSpeed(tapsAt(600, MIN_TAPS - 1)), null);
  assert.equal(suggestSpeed(tapsAt(600, MIN_TAPS)), 100);
});

test("steady taps give their speed, rounded to the slower/faster step", () => {
  assert.equal(suggestSpeed(tapsAt(500, 6)), 120);
  assert.equal(suggestSpeed(tapsAt(750, 6)), 80);
});

test("one uneven tap does not move the suggestion (median)", () => {
  let t = tapsAt(600, 5);
  t = addTap(t, t[t.length - 1] + 1100);
  assert.equal(suggestSpeed(t), 100);
});

test("a long pause starts over; nothing is ever too late", () => {
  let t = tapsAt(600, 3);
  t = addTap(t, t[t.length - 1] + MAX_GAP_MS + 1);
  assert.equal(t.length, 1);
  assert.equal(suggestSpeed(t), null);
});

test("very fast or very slow tapping folds into the allowed range", () => {
  assert.equal(suggestSpeed(tapsAt(200, 6)), 150); // 300 per minute -> 150
  assert.equal(suggestSpeed(tapsAt(1500, 6)), 80); // 40 per minute -> 80
  for (const gap of [90, 140, 333, 999, 1900]) {
    const s = suggestSpeed(tapsAt(gap, 6));
    assert.ok(s >= 60 && s <= 160, `gap ${gap} -> ${s}`);
  }
});
