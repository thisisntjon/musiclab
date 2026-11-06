/**
 * Make it nicer (phase 13.8 addition, 2026-11-01): one tap moves the music to the nearest
 * version that is known to sound better, and says what it did. Nothing is invented; notes move
 * the smallest distance to the nearest chord tone, land on the grid when they were far off it,
 * stop overlapping, and the last note comes home. The arrangement gets the contrast and the
 * ending that songs are known to need. Running it twice changes nothing the second time.
 *
 * Only the person's own notes are touched (user_placed / hummed_confirmed); the band's are the band's.
 * Import-light so it runs in Node tests and the browser.
 */
import { normalizeSongCards, partMood, setPartMood, setEndingStyle, endingStyle } from "./song_view.js";

const OWN = new Set(["user_placed", "hummed_confirmed"]);
const clone = v => JSON.parse(JSON.stringify(v));
const pc = n => ((n % 12) + 12) % 12;

/** Chord tones per bar from the compiled band (harmony first, then bass), falling back to the key's triad. */
export function chordTonesByBar(events, { bars, stepsPerBar = 16, root = 0, minor = false } = {}) {
  const triad = [root, root + (minor ? 3 : 4), root + 7].map(pc);
  return Array.from({ length: bars }, (_, bar) => {
    const inBar = (events || []).filter(e => Math.floor((Number(e.step) || 0) / stepsPerBar) === bar && Number.isFinite(e.concrete?.midi_pitch ?? e.concrete?.midi));
    const pick = role => [...new Set(inBar.filter(e => e.role === role).map(e => pc(e.concrete.midi_pitch ?? e.concrete.midi)))];
    const harmony = pick("harmony");
    if (harmony.length >= 2) return harmony;
    const bass = pick("bass");
    if (bass.length) return [...new Set([...bass, ...triad])];
    return triad;
  });
}

function nearestTone(midi, tones) {
  let best = midi, dist = Infinity;
  for (let d = 0; d <= 6; d++) for (const cand of [midi - d, midi + d]) {
    if (tones.includes(pc(cand)) && d < dist) { best = cand; dist = d; break; }
  }
  return best;
}

/** The person's lead notes, moved the smallest distance to what sounds right. Returns the notes and a plain list of what changed. */
export function optimizeNotes(notes, { tonesByBar, stepsPerBar = 16, root = 0, minor = false } = {}) {
  const out = clone(notes || []);
  const own = out.filter(n => n.role === "lead" && OWN.has(n.provenance)).sort((a, b) => (a.step + (a.performance?.offset_steps || 0)) - (b.step + (b.performance?.offset_steps || 0)));
  const changes = { chord: 0, grid: 0, overlap: 0, home: false };
  const tones = bar => (tonesByBar && tonesByBar[bar]) || [root, root + (minor ? 3 : 4), root + 7].map(pc);
  for (const n of own) {
    const bar = Math.floor(n.step / stepsPerBar), midi = Number(n.concrete?.midi_pitch ?? 60);
    const fitted = nearestTone(midi, tones[bar] ? tones[bar] : tones(bar));
    if (fitted !== midi) { n.concrete = { ...n.concrete, midi_pitch: fitted, freq_hz: 440 * 2 ** ((fitted - 69) / 12) }; changes.chord++; }
    const offset = Number(n.performance?.offset_steps || 0);
    if (offset > .35 && offset < .65) { /* a deliberate push between steps: leave the feel alone */ }
    else if (offset >= .65) { n.step += 1; n.performance = { ...(n.performance || {}), version: 1, offset_steps: 0 }; changes.grid++; }
    else if (offset > 0 && offset <= .35) { n.performance = { ...(n.performance || {}), version: 1, offset_steps: 0 }; changes.grid++; }
  }
  // No note runs into the next one of yours.
  for (let i = 0; i < own.length - 1; i++) {
    const gap = own[i + 1].step - own[i].step;
    if (gap > 0 && Number(own[i].duration_steps || 1) > gap) { own[i].duration_steps = gap; changes.overlap++; }
  }
  // The last note comes home: root or fifth of its bar's chord, whichever is nearer.
  const last = own.at(-1);
  if (last) {
    const bar = Math.floor(last.step / stepsPerBar), t = tones[bar] ? tones[bar] : tones(bar);
    const homeTones = [t[0], t.length > 2 ? t[2] : t[0]].map(pc);
    const midi = Number(last.concrete.midi_pitch), home = nearestTone(midi, homeTones);
    if (home !== midi) { last.concrete = { ...last.concrete, midi_pitch: home, freq_hz: 440 * 2 ** ((home - 69) / 12) }; changes.home = true; }
  }
  return { notes: out, changes, changed: changes.chord + changes.grid + changes.overlap > 0 || changes.home };
}

/** The song's shape, moved to what songs are known to need: a calmer start, a real ending, a comfortable pace. */
export function optimizeArrangement(cards, bpm = 100) {
  let list = normalizeSongCards(cards), nextBpm = bpm;
  const changes = [];
  if (list.length >= 2 && partMood(list[0]) !== "calmer" && partMood(list[1]) !== "calmer") { list = setPartMood(list, 0, "calmer"); changes.push("a calmer start"); }
  if (list.length >= 2 && !endingStyle(list.at(-1))) { list = setEndingStyle(list, "roll"); changes.push("a real ending"); }
  for (let i = 1; i < list.length - 1; i++) if (JSON.stringify({ ...list[i], role_name: 0 }) === JSON.stringify({ ...list[i - 1], role_name: 0 })) { list = setPartMood(list, i, "bigger"); changes.push("a bigger second part"); break; }
  if (bpm < 72) { nextBpm = 72; changes.push("a steadier pace"); } else if (bpm > 132) { nextBpm = 132; changes.push("a calmer pace"); }
  return { cards: list, bpm: nextBpm, changes, changed: changes.length > 0 };
}

/** One plain sentence about what changed, or that nothing needed to. */
export function describeOptimisation({ notes, arrangement } = {}) {
  const bits = [];
  if (notes?.changes) {
    const c = notes.changes;
    if (c.chord) bits.push(`${c.chord} ${c.chord === 1 ? "note" : "notes"} moved to the chord`);
    if (c.grid) bits.push(`${c.grid} ${c.grid === 1 ? "note" : "notes"} put on the beat`);
    if (c.overlap) bits.push(`${c.overlap} ${c.overlap === 1 ? "note" : "notes"} made shorter`);
    if (c.home) bits.push("the last note comes home");
  }
  if (arrangement?.changes?.length) bits.push(...arrangement.changes);
  if (!bits.length) return "It is as near as I can get it. Undo is there if you want.";
  const text = bits.length === 1 ? bits[0] : bits.slice(0, -1).join(", ") + " and " + bits.at(-1);
  return text[0].toUpperCase() + text.slice(1) + ". Undo puts it back.";
}
