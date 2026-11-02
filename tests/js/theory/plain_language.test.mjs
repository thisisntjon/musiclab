// Phase 9c-2 (T5): every kid-facing prompt in the play flow reads at grade 2 or below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { syllables, fkGrade, checkPrompt } from "../../../static/js/theory/plain_language.js";

const FLOW = fileURLToPath(new URL("../../../static/ui/stages/play_flow.js", import.meta.url));

/** Prose in the play flow: string and template literals that are sentences (a capital, a space, an end mark). */
function prosePrompts(src) {
  const out = new Set();
  const clean = (t) =>
    t
      .replace(/\$\{[^}]*\}/g, "it") // an interpolated name or number reads as one short word
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;|&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const keep = (t) => {
    if (/^[A-Z]/.test(t) && t.includes(" ") && /[.!?:)]$/.test(t)) out.add(t);
  };
  // Paragraphs written straight into the stage templates.
  for (const m of src.matchAll(/<p class="pf-say[^"]*">([^<`]*?)<\/p>/g)) keep(clean(m[1]));
  // Strings: announcements, messages, and the parts of templates that are sentences.
  for (const m of src.matchAll(/(["`])((?:\\.|(?!\1)[^\\])*?)\1/g)) keep(clean(m[2]));
  // Button labels and label tables: no end mark, but a person reads them too (any label of 2+ words).
  const label = (t) => {
    if (/^[A-Z]/.test(t) && t.includes(" ")) out.add(t);
  };
  for (const m of src.matchAll(/_(?:btn|choice)\([^,]+,\s*(["`])((?:\\.|(?!\1)[^\\])*?)\1/g)) label(clean(m[2]));
  for (const m of src.matchAll(/(?:label|[a-zA-Z]+):\s*"([A-Z][^"]*\s[^"]*)"/g)) label(clean(m[1]));
  return [...out];
}

test("syllable counter matches simple words", () => {
  assert.equal(syllables("tap"), 1);
  assert.equal(syllables("music"), 2);
  assert.equal(syllables("accompaniment"), 5);
  assert.equal(syllables("shape"), 1);
});

test("the formula reproduces the audit's worst sentence as far above grade 2", () => {
  // From the inclusion audit (iw4): this sentence scored 10.7 with the audit's own script.
  const g = fkGrade("Listen to your melody stay intact while you try three warm accompaniment worlds underneath it.");
  assert.ok(g > 8, `got ${g}`);
});

test("short labels are judged by word length, not the formula", () => {
  assert.ok(checkPrompt("Undone.").ok);
  assert.equal(checkPrompt("Accompaniment.").ok, false);
});

test("the extractor finds the play flow's prompts", () => {
  const prompts = prosePrompts(readFileSync(FLOW, "utf8"));
  assert.ok(prompts.length >= 20, `only ${prompts.length} prompts found`);
  assert.ok(prompts.some((p) => p.startsWith("Tap the pads")));
});

test("T5: every prompt in the play flow reads at grade 2 or below", () => {
  const failures = prosePrompts(readFileSync(FLOW, "utf8"))
    .map((p) => ({ p, r: checkPrompt(p) }))
    .filter((x) => !x.r.ok)
    .map((x) => `${x.p} -> ${JSON.stringify(x.r.problems)}`);
  assert.deepEqual(failures, []);
});

test("F-ACC-2: every button label in the play flow is 3 words or fewer", () => {
  const src = readFileSync(FLOW, "utf8");
  const overThree = [];
  for (const m of src.matchAll(/_(?:btn|choice)\([^,]+,\s*(["`])((?:\\.|(?!\1)[^\\])*?)\1/g)) {
    const raw = m[2]
      .replace(/<span class="pf-sub">[\s\S]*?<\/span>/g, "")
      .replace(/\$\{icon\([^)]*\)\}/g, "")
      .replace(/\$\{[^}]*\}/g, "one")
      .replace(/<[^>]+>/g, " ")
      .trim();
    const ws = raw.split(/\s+/).filter(Boolean);
    if (ws.length > 3) overThree.push(`${raw} (${ws.length} words)`);
  }
  assert.deepEqual(overThree, []);
});

// Phase 13.2: help text in single quotes and pf-sub paragraphs was skipped by the extractor above,
// and that is where most of the system words were.
function helpPrompts(src) {
  const out = new Set();
  const clean = (t) => t.replace(/\$\{[^}]*\}/g, "it").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
  const keep = (t) => { if (/^[A-Z]/.test(t) && t.includes(" ") && /[.!?:)]$/.test(t)) out.add(t); };
  for (const m of src.matchAll(/'((?:\.|[^'\\n])*?)'/g)) keep(clean(m[1]));
  for (const m of src.matchAll(/<p class="pf-sub[^"]*"[^>]*>([^<`]*?)<\/p>/g)) keep(clean(m[1]));
  return [...out];
}
const SYSTEM_WORDS = /\b(BPM|linked|source loop|capture|captured|performance|region|blend|density|phrase|snapshot|arrangements?|provenance)\b/i;

test("13.2: help text and single-quoted messages read at grade 2 or below, without system words", () => {
  const prompts = helpPrompts(readFileSync(FLOW, "utf8"));
  assert.ok(prompts.length >= 20, `only ${prompts.length} prompts found`);
  const failures = prompts.map((p) => ({ p, r: checkPrompt(p) }))
    .filter((x) => !x.r.ok || SYSTEM_WORDS.test(x.p))
    .map((x) => `${x.p} -> ${x.r.ok ? "system word" : JSON.stringify(x.r.problems)}`);
  assert.deepEqual(failures, []);
});
