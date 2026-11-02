// The part palette: one source of truth, no saturated red, readable on the black page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PART_COLORS, PART_SHAPES, partOf, beatsPerBounce, contrast, isSaturatedRed } from "../../../static/js/visual/look.js";

const css = readFileSync(new URL("../../../static/css/studio.css", import.meta.url), "utf8");
const PAGE = "#05070d";

test("the CSS part tokens are the same colours as look.js", () => {
  for (const [part, hex] of Object.entries(PART_COLORS)) {
    const m = css.match(new RegExp(`--pf-part-${part}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `--pf-part-${part} missing from studio.css`);
    assert.equal(m[1].toLowerCase(), hex.toLowerCase(), part);
  }
});

test("no part colour is a WCAG 2.3.1 saturated red, and the check itself catches pure red", () => {
  assert.equal(isSaturatedRed("#FF0000"), true);
  for (const [part, hex] of Object.entries(PART_COLORS)) assert.equal(isSaturatedRed(hex), false, part);
});

test("every part colour stands out from the black page (at least 3:1, the non-text contrast rule)", () => {
  for (const [part, hex] of Object.entries(PART_COLORS)) assert.ok(contrast(hex, PAGE) >= 3, `${part} ${contrast(hex, PAGE).toFixed(2)}`);
});

test("every part has its own shape, so meaning never rests on colour alone", () => {
  const shapes = Object.values(PART_SHAPES);
  assert.equal(new Set(shapes).size, shapes.length);
  assert.deepEqual(Object.keys(PART_SHAPES).sort(), Object.keys(PART_COLORS).sort());
});

test("lanes map to parts, and the ball lands every beat up to 120 per minute", () => {
  assert.equal(partOf("kick"), "boom");
  assert.equal(partOf("hat"), "tick");
  assert.equal(partOf("lead"), "tune");
  assert.equal(beatsPerBounce(120), 1);
  assert.equal(beatsPerBounce(121), 2);
});
