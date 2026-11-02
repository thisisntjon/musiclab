/**
 * Rendered-page check for T4 (9c-1) and the icon rule (9c-9). It reads the play flow as it is on screen:
 * - banned words: theory, measurement and artist words a "not musical" person should never have to read;
 * - options per choice: inside each role="group", the elements marked data-option (an option such as a saved
 *   piece may carry its own delete button), or else the buttons (the pad grids are instruments, not choices);
 * - targets: every button and field at least 44 × 44 px (a checkbox counts its whole label);
 * - contrast: every piece of visible text at least 4.5:1 against the colour actually behind it;
 * - emoji: none in the play flow (icons are drawn SVG).
 */
export const BANNED_WORDS = [
  "bpm", "hz", "khz", "db", "dbfs", "midi", "dorian", "lydian", "mixolydian", "phrygian", "aeolian", "locrian",
  "ionian", "pentatonic", "chromatic", "tonic", "cadence", "syncopation", "quantize", "velocity", "sidechain",
  "hocket", "voicing", "arpeggio", "semitone", "skrillex", "bangarang", "timbaland", "hooktheory",
];
const BANNED_PHRASES = ["max martin", "rick rubin", "quincy jones"];
const MIN_TARGET_PX = 44;
const MIN_CONTRAST = 4.5;
const MAX_LABEL_WORDS = 3;
const EMOJI = /\p{Extended_Pictographic}/u;

function parseColor(str) {
  const m = String(str).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Blend a translucent colour over an opaque one. */
function over(top, under) {
  const a = top.a;
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
}

/** The colour behind an element: its own and its ancestors' backgrounds, stacked. */
function backgroundOf(el) {
  const layers = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const c = parseColor(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 1) break;
    }
  }
  let bg = { r: 255, g: 255, b: 255, a: 1 }; // the page default if nothing is opaque
  for (let i = layers.length - 1; i >= 0; i--) bg = layers[i].a >= 1 ? layers[i] : over(layers[i], bg);
  return bg;
}

function visible(el) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest(".sr-only");
}

export function bannedIn(text) {
  const words = String(text).toLowerCase();
  const hits = [];
  for (const w of BANNED_WORDS) if (new RegExp(`\\b${w}\\b`).test(words)) hits.push(w);
  for (const p of BANNED_PHRASES) if (words.includes(p)) hits.push(p);
  if (/\d\s?%/.test(words)) hits.push("percent");
  return hits;
}

export function auditRoot(root) {
  const text = root.innerText || root.textContent || "";
  const labels = [...root.querySelectorAll("[aria-label]")].filter(visible).map((e) => e.getAttribute("aria-label")).join(" ");
  const out = {
    banned_words: bannedIn(`${text} ${labels}`),
    emoji: [...text].filter((ch) => EMOJI.test(ch)),
    choices: [],
    max_options_per_choice: 0,
    small_targets: [],
    low_contrast: [],
    long_labels: [],
  };
  for (const g of root.querySelectorAll('[role="group"]')) {
    if (g.classList.contains("pf-grid") || !visible(g)) continue;
    const marked = [...g.querySelectorAll("[data-option]")].filter(visible);
    const n = marked.length || [...g.querySelectorAll("button")].filter(visible).length;
    out.choices.push({ label: g.getAttribute("aria-label") || "", options: n });
    out.max_options_per_choice = Math.max(out.max_options_per_choice, n);
  }
  for (const el of root.querySelectorAll("button, input, select, textarea")) {
    const target = el.matches('input[type="checkbox"], input[type="radio"]') ? el.closest("label") || el : el;
    if (!visible(target)) continue;
    const r = target.getBoundingClientRect();
    if (Math.round(r.width) < MIN_TARGET_PX || Math.round(r.height) < MIN_TARGET_PX) {
      out.small_targets.push({ key: el.dataset.key || el.id || el.tagName, w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  // Play, don't read: a button's words are 3 or fewer. Buttons that carry the person's own song title are skipped.
  for (const el of root.querySelectorAll("button:not(.pf-pad)")) {
    if (!visible(el) || /^(continue|replace|resume-working|delete):?/.test(el.dataset.key || "")) continue;
    // A card may add one hint line (.pf-sub) under its label; label and hint are each held to 3 words.
    const hintEls = [...el.querySelectorAll(".pf-sub")];
    const hints = hintEls.map((h) => h.innerText || h.textContent || "");
    let label = el.innerText || el.textContent || "";
    for (const h of hints) label = label.replace(h, " ");
    for (const part of [label, ...hints]) {
      const words = part.trim().split(/\s+/).filter(Boolean);
      if (words.length > MAX_LABEL_WORDS) out.long_labels.push(words.join(" "));
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!t.textContent.trim() || !el || seen.has(el) || !visible(el)) continue;
    seen.add(el);
    const fg = parseColor(getComputedStyle(el).color);
    if (!fg) continue;
    const bg = backgroundOf(el);
    const ratio = contrastRatio(fg.a < 1 ? over(fg, bg) : fg, bg);
    if (ratio < MIN_CONTRAST) out.low_contrast.push({ text: t.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100 });
  }
  out.ok =
    out.banned_words.length === 0 &&
    out.emoji.length === 0 &&
    out.max_options_per_choice <= 3 &&
    out.small_targets.length === 0 &&
    out.low_contrast.length === 0 &&
    out.long_labels.length === 0;
  return out;
}
