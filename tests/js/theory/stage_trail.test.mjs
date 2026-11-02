// Back returns to where the person came from, even after skipping ahead (owner report: "the wizard did not go in order").
import { test } from "node:test";
import assert from "node:assert/strict";
import { goForward, goBack } from "../../../static/js/theory/stage_trail.js";

function walk(path) {
  let trail = [];
  for (let i = 1; i < path.length; i++) trail = goForward(trail, path[i - 1], path[i]);
  return trail;
}

test("the reported path: beat, Keep it, then Back returns to the beat, not underneath", () => {
  const trail = walk(["start", "beat", "keep"]);
  assert.equal(goBack(trail).to, "beat");
});

test("the full path backs up through every stage in reverse", () => {
  let trail = walk(["start", "beat", "tune", "under", "keep"]);
  const seen = [];
  for (let b = goBack(trail); b; b = goBack(trail)) {
    seen.push(b.to);
    trail = b.trail;
  }
  assert.deepEqual(seen, ["under", "tune", "beat", "start"]);
});

test("the hum door goes straight to the tune, so Back goes to the start", () => {
  assert.equal(goBack(walk(["start", "tune"])).to, "start");
});

test("going forward to a stage already on the trail cuts the loop", () => {
  // beat -> keep -> (back) beat -> tune -> keep: Back from keep is the tune
  let trail = walk(["start", "beat", "keep"]);
  trail = goBack(trail).trail; // Back to the beat
  trail = goForward(trail, "beat", "tune");
  trail = goForward(trail, "tune", "keep");
  assert.equal(goBack(trail).to, "tune");
  assert.ok(new Set(trail).size === trail.length, "no stage twice");
});

test("the start screen has nowhere to go back to", () => {
  assert.equal(goBack(walk(["beat", "start"])), null);
});
