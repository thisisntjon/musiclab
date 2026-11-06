// Phase 13.6: one visual language. One colour, shape and name per element; colours survive colour-vision checks;
// the visualizer is grouped by part and lit only while that part sounds; motion is off under Calm and reduced motion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PART_TOKENS, MARK_TOKENS, TOKEN_VALUES, PART_ORDER, partOfRole, colourVisionCheck, visualBars } from "../../../static/js/theory/visual_tokens.js";

const CSS = readFileSync(fileURLToPath(new URL("../../../static/css/studio.css", import.meta.url)), "utf8");
const FLOW = readFileSync(fileURLToPath(new URL("../../../static/ui/stages/play_flow.js", import.meta.url)), "utf8");

test("every part has its own colour token, shape and name, and the CSS declares each token with the checked value", () => {
  const colours = PART_ORDER.map(p => PART_TOKENS[p].cssVar), shapes = PART_ORDER.map(p => PART_TOKENS[p].shape), labels = PART_ORDER.map(p => PART_TOKENS[p].label);
  for (const list of [colours, shapes, labels]) assert.equal(new Set(list).size, PART_ORDER.length);
  for (const [name, value] of Object.entries(TOKEN_VALUES)) assert.ok(CSS.includes(`${name}: ${value}`), `${name} declared as ${value}`);
  assert.equal(partOfRole("harmony"), "chords"); assert.equal(partOfRole("lead"), "tune"); assert.equal(partOfRole("vocal"), null);
  assert.ok(Object.values(MARK_TOKENS).every(m => m.label && m.shape));
});

test("the part colours stay apart under normal, protan and deutan vision, and read on black", () => {
  assert.deepEqual(colourVisionCheck(), []);
  assert.ok(colourVisionCheck({ ...TOKEN_VALUES, "--pf-part-tune": "#ffe600" }).length > 0, "the check does catch a clash");
});

test("the person's colour is a token, used by the sheet, the timeline and the pads rather than a raw value", () => {
  const raw = (CSS.match(/#ff2bd6/gi) || []).length;
  assert.equal(raw, 2, "the only raw magentas are the two token declarations (--pf-own and --pf-part-clap)");
  for (const where of [".pf-sheet-note.own", ".pf-tl-block.own", ".pf-tl-playhead line", ".pf-sheet-beat {"]) assert.match(CSS, new RegExp(where.replace(/[.{]/g, m => `\\${m}`) + "[^}]*var\\(--pf-own\\)"), `${where} uses the token`);
  assert.doesNotMatch(FLOW, /#ff2bd6/i, "the play flow carries no raw magenta");
});

test("the visualizer groups bars by part, lights only parts that sound, and never flashes", () => {
  const bins = new Uint8Array(512).fill(200), levels = [];
  const first = visualBars(bins, levels, new Set(["drums"]));
  assert.equal(first.length, 32);
  assert.deepEqual([...new Set(first.map(b => b.part))], ["bass", "drums", "chords", "tune"]);
  assert.ok(first.filter(b => b.lit).every(b => b.part === "drums") && first.some(b => b.lit));
  const second = visualBars(bins, levels, new Set(["drums"]));
  assert.ok(second.every((b, i) => b.level - first[i].level <= .2 * (200 / 255)), "levels rise gently (smoothed), so nothing flashes");
  const silent = visualBars(new Uint8Array(512), levels, new Set());
  assert.ok(silent.every(b => !b.lit));
  assert.match(FLOW, /data-spectrum-part="tune"/, "one path per part in the picture");
});

test("the levels unfold into each other, and Calm or reduced motion makes it instant", () => {
  assert.match(FLOW, /setAttribute\("data-enter", this\.enterMotion\)/);
  assert.match(CSS, /\[data-enter="song"\] \.pf-song-card \{ animation: pf-telescope/);
  assert.match(CSS, /prefers-reduced-motion: reduce\) \{ \[data-enter\] > \*[^}]*animation: none/);
  assert.match(CSS, /body\.pf-less-motion \[data-enter\] > \*[^}]*animation: none/);
});

test("the palette has one source: the token values are look.js's colours", async () => {
  const { PART_COLORS } = await import("../../../static/js/visual/look.js");
  assert.equal(TOKEN_VALUES["--pf-part-boom"], PART_COLORS.boom.toLowerCase());
  assert.equal(TOKEN_VALUES["--pf-own"], PART_COLORS.clap.toLowerCase());
});

test("What is this? names every element on the screen in plain words, with its colour and shape", async () => {
  const { describeElements } = await import("../../../static/js/theory/visual_tokens.js");
  const list = describeElements({ parts: ["drums", "tune"], marks: ["own", "beat", "bar"] });
  assert.deepEqual(list.map(e => e.id), ["drums", "tune", "own", "beat", "bar"]);
  for (const e of list) { assert.ok(e.says.length > 10 && e.cssVar && e.shape, e.id); assert.ok(e.says.split(/\s+/).length <= 16, `${e.id} is one short sentence`); }
});
