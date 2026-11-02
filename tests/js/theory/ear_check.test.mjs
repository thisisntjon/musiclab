// Phase 8.0 AC12: the listening check is really blind.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EAR_PROMPT, newEarTrial, endingKind, earFeedback } from "../../../static/js/theory/ear_check.js";

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test("AC12: over 200 trials the settled ending is A between 40% and 60% of the time", () => {
  const rand = lcg(20261026);
  let a = 0;
  for (let i = 0; i < 200; i++) if (newEarTrial(rand).settled === "A") a += 1;
  assert.ok(a >= 80 && a <= 120, `A was settled ${a}/200 times`);
});

test("AC12: nothing shown before the answer names a side", () => {
  assert.doesNotMatch(EAR_PROMPT, /\b(A|B)\b/);
});

test("each side plays the right kind of ending and feedback follows the answer", () => {
  const trial = { id: "t", settled: "A" };
  assert.equal(endingKind(trial, "A"), "settled");
  assert.equal(endingKind(trial, "B"), "open");
  assert.match(earFeedback(trial, "A"), /^Yes/);
  assert.match(earFeedback(trial, "B"), /Ending A comes to rest/);
});
