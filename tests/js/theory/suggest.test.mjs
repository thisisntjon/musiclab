// Phase 9b-4: ideas appear only after pointer-up, only on empty steps, at most 2, and each one can be heard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestNext, createSuggester, suggesterDown, suggesterUp, suggesterKey } from "../../../static/js/theory/suggest.js";
import { tuneRows } from "../../../static/js/theory/tune_model.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test("9b-4: over 500 random tunes, ideas are at most 2, only on empty columns, never clashing, and repeatable", () => {
  const r = rng(7);
  for (let k = 0; k < 500; k++) {
    const rootPc = Math.floor(r() * 12);
    const rows = tuneRows(rootPc, r() < 0.5 ? "major" : "natural_minor", [], ["lock", "guide", "free"][Math.floor(r() * 3)]);
    const cells = Array(16).fill(null).map(() => (r() < 0.35 ? rows[Math.floor(r() * rows.length)] : null));
    const justCol = Math.floor(r() * 16);
    cells[justCol] = rows[Math.floor(r() * rows.length)];
    const chordPcsList = [[rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]];
    const input = { cells, justCol, rows, rootPc, chordPcsList };
    const ideas = suggestNext(input);
    assert.ok(ideas.length <= 2);
    for (const idea of ideas) {
      assert.equal(cells[idea.col], null, "an idea is never on a filled column");
      assert.ok(rows.includes(idea.midi), "an idea is a note on the grid, so moving to it can play it");
      assert.ok(!chordPcsList[0].some((c) => (((idea.midi - c) % 12) + 12) % 12 === 1), "never a semitone above a chord tone");
    }
    assert.deepEqual(suggestNext(input), ideas, "same input, same ideas");
  }
});

test("9b-4: no ideas while a press is still down (during a drag); they arrive on pointer-up", () => {
  const rows = tuneRows(0, "major");
  const cells = Array(16).fill(null);
  cells[0] = 60;
  const input = { cells, justCol: 0, rows, rootPc: 0 };
  const s = createSuggester();
  assert.deepEqual(suggesterDown(s), []);
  assert.deepEqual(s.list, [], "nothing shows while the finger is down");
  const shown = suggesterUp(s, input);
  assert.ok(shown.length >= 1 && shown.length <= 2);
  assert.deepEqual(suggesterUp(s, input), shown, "a stray pointer-up with no press changes nothing");
  suggesterDown(s); // a new press clears them at once
  assert.deepEqual(s.list, []);
  assert.ok(suggesterKey(createSuggester(), input).length >= 1, "a key press is a whole press");
});

test("9b-4: removing a note gives no ideas", () => {
  const rows = tuneRows(0, "major");
  assert.deepEqual(suggestNext({ cells: Array(16).fill(null), justCol: 3, rows, rootPc: 0 }), []);
});
