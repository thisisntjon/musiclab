// Phase 9c-2 (T5): every kid-facing prompt in the play flow reads at grade 2 or below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { syllables, fkGrade, checkPrompt } from "../../../static/js/theory/plain_language.js";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";
import { startJam, setJamDirection } from "../../../static/js/theory/jam_session.js";
import { SCENE_CATALOGUE, SCENE_CATALOGUE_VERSION } from "../../../static/js/theory/scene_catalogue.js";
import { parseHtml } from "../ui/mini_dom.mjs";

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

/**
 * Button labels as written: any quote style, both sides of a `cond ? 'A' : 'B'` label, and both
 * sides of a `${cond ? 'A' : 'B'}` choice written inside a template label.
 */
function buttonLabels(src) {
  const out = [];
  const re = /_(?:btn|choice)\([^,]+,\s*(?:[^'"`,]*?\?\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1\s*:\s*(["'`])((?:\\.|(?!\3)[^\\])*?)\3|(["'`])((?:\\.|(?!\5)[^\\])*?)\5)/g;
  const choice = /\$\{[^{}?]*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\}/;
  const expand = (label) => {
    const m = label.match(choice);
    if (!m) return [label];
    return [...expand(label.replace(choice, m[1])), ...expand(label.replace(choice, m[2]))];
  };
  for (const m of src.matchAll(re)) for (const label of [m[2], m[4], m[6]]) if (label !== undefined) out.push(...expand(label));
  return out;
}

test("F-ACC-2: every button label and disclosure summary in the play flow is 3 words or fewer", () => {
  const src = readFileSync(FLOW, "utf8");
  const overThree = [];
  const count = (label, kind) => {
    const raw = label
      .replace(/<span class="pf-sub">[\s\S]*?<\/span>/g, "")
      .replace(/\$\{icon\([^)]*\)\}/g, "")
      .replace(/\$\{[^}]*\}/g, "one")
      .replace(/<[^>]+>/g, " ")
      .trim();
    const ws = raw.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)); // a lone dot or dash is not a word
    if (ws.length > 3) overThree.push(`${kind}: ${raw} (${ws.length} words)`);
  };
  for (const label of buttonLabels(src)) count(label, "button");
  for (const m of src.matchAll(/<summary[^>]*>((?:(?!<\/summary>)[\s\S])*?)<\/summary>/g)) count(m[1], "summary");
  assert.deepEqual(overThree, []);
});

test("F-ACC-2: the label reader sees single quotes and both sides of a choice (negative control)", () => {
  const sample = "this._btn('a','Four words in here','x');this._btn('b',on?'Play freely (no repeats)':'Use live keys','x');"
    + "this._btn(\"c\",\"Two words\");this._btn('d',`${fav?'Remove favorite':'Favorite selected style'}: ${name}`)";
  assert.deepEqual(buttonLabels(sample), ["Four words in here", "Play freely (no repeats)", "Use live keys", "Two words",
    "Remove favorite: ${name}", "Favorite selected style: ${name}"]);
});

// Phase 13.2: help text in single quotes and pf-sub paragraphs was skipped by the extractor above,
// and that is where most of the system words were.
function helpPrompts(src) {
  const out = new Set();
  const clean = (t) => t.replace(/\$\{[^}]*\}/g, "it").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
  const keep = (t) => { if (/^[A-Z]/.test(t) && t.includes(" ") && /[.!?:)]$/.test(t)) out.add(t); };
  // Open-release audit S8: the old class [^'\\n] also excluded the letter n, so most messages were never read.
  for (const m of src.matchAll(/'((?:\\.|[^'\\\n])*?)'/g)) keep(clean(m[1]));
  for (const m of src.matchAll(/<p class="pf-sub[^"]*"[^>]*>([^<`]*?)<\/p>/g)) keep(clean(m[1]));
  return [...out];
}
const SYSTEM_WORDS = /\b(BPM|linked|source loop|capture|captured|performance|region|blend|density|phrase|snapshot|arrangements?|provenance)\b/i;

// Messages that were already above grade 2 when the extractor was fixed. New or changed text must pass;
// rewriting one of these simply drops it from the list.
const KNOWN_DEBT = new Set(JSON.parse(readFileSync(new URL("../fixtures/grade2-known-debt.json", import.meta.url), "utf8")).strings);

test("13.2: help text and single-quoted messages read at grade 2 or below, without system words", () => {
  const prompts = helpPrompts(readFileSync(FLOW, "utf8"));
  assert.ok(prompts.length >= 100, `only ${prompts.length} prompts found`);
  const failures = prompts.map((p) => ({ p, r: checkPrompt(p) }))
    .filter((x) => (!x.r.ok || SYSTEM_WORDS.test(x.p)) && !KNOWN_DEBT.has(x.p))
    .map((x) => `${x.p} -> ${x.r.ok ? "system word" : JSON.stringify(x.r.problems)}`);
  assert.deepEqual(failures, []);
});

test("13.2: the extractor reads single-quoted messages that contain the letter n (negative control)", () => {
  const found = helpPrompts("x = 'Notes follow the active harmony.'; y = 'Ten nine.';");
  assert.deepEqual(found, ["Notes follow the active harmony.", "Ten nine."]);
  assert.equal(checkPrompt(found[0]).ok, false, "the old main-path line is caught now");
});

// Open-release audit S8: the extractors above read the source, so they miss text inside ternaries,
// templates and catalogue names. The main jam screen is checked as a person sees it instead: rendered,
// with Help open, plus the status and key lines in each state. Style names are names, not prompts.
function jamScreen() {
  const values = new Map();
  const store = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  globalThis.window = { localStorage: store, sessionStorage: store, scrollX: 0, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: false }) };
  globalThis.document = { body: { classList: { toggle() {}, add() {}, contains: () => false } }, activeElement: null, getElementById: () => null };
  const scheduler = { isPlaying: false, stopGeneration: 0, audioCtx: { currentTime: 0 }, liveNotes: new Map(), masterBus: { piano: {}, disposed: false },
    setCompiledSong() {}, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {}, setSpotlightRole() {}, stop() {}, start() {}, activeJamBacking: () => null, capturePerformance: () => null };
  const flow = new PlayFlow({ scheduler, _announce() {}, _logSessionEvent() {} });
  flow._freshState();
  flow.stage = "jam";
  flow.doc = setJamDirection(startJam(newPlayDoc({ now: 1, rand: () => .5 }), { patchId: "sampled_piano_v1" }), { showcase_version: 1, scene_catalogue: SCENE_CATALOGUE_VERSION, scene_id: "ska-v1" });
  flow.doc.jam_session.exploration_map = "catalogue-circle-v2";
  Object.assign(flow.doc.jam_session, { live_keys: true, dynamic_keys: true, follow_band_sound: true, auto_answer: true });
  return flow;
}

test("S8: the main jam screen as rendered, with Help open, reads at grade 2", () => {
  const flow = jamScreen();
  const names = new Set(SCENE_CATALOGUE.map(s => s.name));
  const lines = [];
  for (const notes of [false, true]) {
    flow.padNoteNames = notes;
    flow.comfortOpen = true;
    const dom = parseHtml(flow._renderListeningJam() + flow._helpPanelHtml());
    for (const el of dom.querySelectorAll("p, label, summary, h1, h2")) lines.push(el.textContent.replace(/\s+/g, " ").trim());
  }
  lines.push(flow._keySoundText());
  flow.doc.jam_session.dynamic_keys = false;
  lines.push(flow._keySoundText());
  const scheduler = flow.app.scheduler;
  lines.push(flow._currentDirectionText());
  Object.assign(scheduler, { isPlaying: true, activeJamBacking: () => ({ phraseContext: { sceneId: "ska-v1" } }) });
  lines.push(flow._currentDirectionText());
  flow.circleIntent = { id: "reggae-v1", field: null };
  lines.push(flow._currentDirectionText());
  // Style and sound names are names: "Your next keys: Sampled piano." reads as "Your next keys: it."
  const named = text => [...names].reduce((t, n) => t.split(n).join("it"), text).replace(/^Your next keys: [^.]*\./, "Your next keys: it.");
  const failures = lines.filter(Boolean).map(named)
    .map(p => ({ p, r: checkPrompt(p) })).filter(x => !x.r.ok).map(x => `${x.p} -> ${JSON.stringify(x.r.problems)}`);
  assert.deepEqual([...new Set(failures)], []);
});
