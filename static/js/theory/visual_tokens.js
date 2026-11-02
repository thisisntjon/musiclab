/**
 * One visual language (phase 13.6). Every musical element has one colour, one shape and one
 * name, the same on every screen, so seeing it again and again teaches what it is.
 * Colour never carries meaning alone: each element also has a shape and a name.
 * The colour values live in CSS custom properties; this module names them and checks them.
 */
import { PART_COLORS, PART_SHAPES } from "../visual/look.js";

export const PART_TOKENS = Object.freeze({
  drums:  { label: "Beat",   cssVar: "--pf-part-tick",  look: "tick",  shape: PART_SHAPES.tick,  says: "the drums", roles: ["drums"] },
  bass:   { label: "Bass",   cssVar: "--pf-part-boom",  look: "boom",  shape: PART_SHAPES.boom,  says: "the low notes", roles: ["bass"] },
  chords: { label: "Chords", cssVar: "--pf-part-under", look: "under", shape: PART_SHAPES.under, says: "the notes that go under the tune", roles: ["harmony", "hocket"] },
  tune:   { label: "Tune",   cssVar: "--pf-part-tune",  look: "tune",  shape: PART_SHAPES.tune,  says: "the tune", roles: ["lead"] },
});
export const MARK_TOKENS = Object.freeze({
  own:    { label: "Your notes",       cssVar: "--pf-own",  shape: "bright edge", says: "notes you played. They keep a bright edge everywhere." },
  answer: { label: "The band answers", cssVar: "--pf-own",  shape: "trail",       says: "the band playing your note back." },
  beat:   { label: "The beat",         cssVar: "--pf-own",  shape: "ball",        says: "a ball that lands on each beat and rises between." },
  bar:    { label: "A bar",            cssVar: "--pf-rule", shape: "thin line",   says: "four beats. The song is made of bars." },
});
/** The values the CSS must declare, taken from the one palette in look.js so there is a single source. */
export const TOKEN_VALUES = Object.freeze({
  "--pf-part-tick": PART_COLORS.tick.toLowerCase(), "--pf-part-boom": PART_COLORS.boom.toLowerCase(), "--pf-part-under": PART_COLORS.under.toLowerCase(),
  "--pf-part-tune": PART_COLORS.tune.toLowerCase(), "--pf-own": PART_COLORS.clap.toLowerCase(),
});

/** What is on this screen, in words: the parts that sound, the marks that appear, in one plain sentence each. */
export function describeElements({ parts = [], marks = [] } = {}) {
  const out = [];
  for (const id of PART_ORDER) if (parts.includes(id)) out.push({ id, kind: "part", label: PART_TOKENS[id].label, shape: PART_TOKENS[id].shape, cssVar: PART_TOKENS[id].cssVar, says: `${PART_TOKENS[id].label}: ${PART_TOKENS[id].says}.` });
  for (const id of Object.keys(MARK_TOKENS)) if (marks.includes(id)) out.push({ id, kind: "mark", label: MARK_TOKENS[id].label, shape: MARK_TOKENS[id].shape, cssVar: MARK_TOKENS[id].cssVar, says: `${MARK_TOKENS[id].label}: ${MARK_TOKENS[id].says}` });
  return out;
}

export const PART_ORDER = ["drums", "bass", "chords", "tune"];

export function partOfRole(role) {
  return PART_ORDER.find(p => PART_TOKENS[p].roles.includes(role)) || null;
}

/* ---- colour vision check: a rough but honest pairwise test on a black background ---- */
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
/** Simulate the two common red-green deficiencies (Brettel-style linear approximation) before comparing. */
function simulate(kind, [r, g, b]) {
  if (kind === "protan") return [.567 * r + .433 * g, .558 * r + .442 * g, .242 * g + .758 * b];
  if (kind === "deutan") return [.625 * r + .375 * g, .7 * r + .3 * g, .3 * g + .7 * b];
  return [r, g, b];
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Every pair of part colours must stay apart under normal, protan and deutan vision
 * (RGB distance over 60 of 441), and every colour must read on black (luminance over .25).
 */
export function colourVisionCheck(values = TOKEN_VALUES, names = PART_ORDER.map(p => PART_TOKENS[p].cssVar)) {
  const failures = [];
  for (const name of names) if (lum(rgb(values[name])) < .25) failures.push(`${name} is too dark on black`);
  for (const kind of ["normal", "protan", "deutan"]) for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const d = distance(simulate(kind, rgb(values[names[i]])), simulate(kind, rgb(values[names[j]])));
    if (d < 60) failures.push(`${names[i]} and ${names[j]} are too close under ${kind} vision (${d.toFixed(0)})`);
  }
  return failures;
}

/* ---- the visualizer: bars grouped by part, drawn from the real audio ---- */
/**
 * 32 spectrum bins become four groups of eight, low to high: bass, beat, chords, tune.
 * A group is lit only while that part is actually sounding, so the picture says what plays.
 * Levels are smoothed so nothing flashes.
 */
export function visualBars(bins, levels, soundingParts = new Set()) {
  const order = ["bass", "drums", "chords", "tune"], out = [];
  for (let i = 0; i < 32; i++) {
    const level = bins.length ? bins[Math.floor(1 + Math.pow(i / 31, 2) * (bins.length / 2 - 2))] / 255 : 0;
    levels[i] = (levels[i] || 0) * .8 + level * .2;
    const part = order[Math.floor(i / 8)];
    out.push({ i, part, level: levels[i], lit: soundingParts.has(part) });
  }
  return out;
}
