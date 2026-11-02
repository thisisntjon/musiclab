/**
 * Adjust (phase 13.6c): three concrete ideas for the song, dealt like a hand of cards when a
 * person arrives at a level. Each card is a real, reversible change to the song as it is now,
 * never a setting. The hand mixes kinds (feel, shape, sound) so the three always differ, and
 * every card can be heard in place before it is kept.
 *
 * Import-light so it runs in Node tests and the browser.
 */
import { normalizeSongCards, setPartMood, setEndingStyle, addSongCard, toggleCardTuneVariation, partMood, endingStyle, MAX_SONG_CARDS } from "./song_view.js";

const clone = value => JSON.parse(JSON.stringify(value));
const own = note => note.provenance === "user_placed" || note.provenance === "hummed_confirmed";
const leadNotes = doc => (doc.notes || []).filter(n => n.role === "lead");

const bpmCard = (id, title, hint, delta) => ({
  id, kind: "feel", title, hint,
  applicable: doc => { const bpm = doc.global_context?.bpm || 100; return delta < 0 ? bpm + delta >= 60 : bpm + delta <= 160; },
  apply: doc => { const next = clone(doc); next.global_context.bpm = Math.max(60, Math.min(160, (next.global_context.bpm || 100) + delta)); return next; },
  seek: () => 0,
});

const moodCard = (index, mood, title, hint) => ({
  id: `mood-${index}-${mood}`, kind: "shape", title, hint,
  applicable: doc => { const cards = normalizeSongCards(doc.song_cards); return cards.length > index + 1 && partMood(cards[index]) !== mood; },
  apply: doc => ({ ...clone(doc), song_cards: setPartMood(doc.song_cards, index, mood) }),
  seek: doc => partStart(doc, index),
});

const endingCard = (style, title, hint) => ({
  id: `ending-${style}`, kind: "shape", title, hint,
  applicable: doc => { const cards = normalizeSongCards(doc.song_cards); return cards.length > 1 && endingStyle(cards.at(-1)) !== style; },
  apply: doc => ({ ...clone(doc), song_cards: setEndingStyle(doc.song_cards, style) }),
  seek: doc => partStart(doc, normalizeSongCards(doc.song_cards).length - 1),
});

function partStart(doc, index) {
  const cards = normalizeSongCards(doc.song_cards), spb = doc.global_context?.steps_per_bar || 16;
  return cards.slice(0, index).reduce((sum, c) => sum + (c.bars || 4) * spb, 0);
}

export const CARDS = [
  bpmCard("slower", "Slower", "A calmer pace. Your notes stay.", -12),
  bpmCard("faster", "Faster", "More lift. Your notes stay.", 12),
  moodCard(0, "calmer", "Calm start", "The first part opens softly."),
  moodCard(1, "bigger", "Bigger middle", "The main part gets everything."),
  endingCard("roll", "Drum roll end", "The drums build into the last bar."),
  endingCard("big", "Big finish", "The whole band ends it."),
  endingCard("quiet", "Quiet end", "The drums and bass drop out at the end."),
  {
    id: "longer", kind: "shape", title: "One more part", hint: "Adds a part at the end, like the last one.",
    applicable: doc => normalizeSongCards(doc.song_cards).length < MAX_SONG_CARDS,
    apply: doc => ({ ...clone(doc), song_cards: addSongCard(doc.song_cards) }),
    seek: doc => partStart(doc, normalizeSongCards(doc.song_cards).length - 1),
  },
  {
    id: "lift", kind: "sound", title: "Lift the tune", hint: "The tune moves up in one part.",
    applicable: doc => normalizeSongCards(doc.song_cards).some((c, i) => i > 0 && c.tune_variant !== "lift"),
    apply: doc => { const cards = normalizeSongCards(doc.song_cards); const i = Math.max(1, cards.findIndex((c, j) => j > 0 && c.tune_variant !== "lift")); return { ...clone(doc), song_cards: toggleCardTuneVariation(doc.song_cards, i) }; },
    seek: doc => partStart(doc, Math.max(1, normalizeSongCards(doc.song_cards).findIndex((c, j) => j > 0 && c.tune_variant !== "lift"))),
  },
  {
    id: "octave-up", kind: "sound", title: "My notes higher", hint: "Your own notes move up an octave.",
    applicable: doc => leadNotes(doc).some(n => own(n) && Number(n.concrete?.midi_pitch) <= 84),
    apply: doc => { const next = clone(doc); for (const n of next.notes) if (n.role === "lead" && own(n) && Number(n.concrete?.midi_pitch) <= 84) { const midi = Number(n.concrete.midi_pitch) + 12; n.concrete = { ...n.concrete, midi_pitch: midi, freq_hz: 440 * 2 ** ((midi - 69) / 12) }; } return next; },
    seek: () => 0,
  },
  {
    id: "ring", kind: "sound", title: "Let notes ring", hint: "Your own notes last a little longer.",
    applicable: doc => leadNotes(doc).some(n => own(n) && Number(n.duration_steps || 1) < 8),
    apply: doc => { const next = clone(doc); for (const n of next.notes) if (n.role === "lead" && own(n) && Number(n.duration_steps || 1) < 8) n.duration_steps = Math.min(8, Number(n.duration_steps || 1) + 2); return next; },
    seek: () => 0,
  },
];

const LEVEL_CARDS = {
  play: ["slower", "faster", "octave-up", "ring"],
  shape: ["slower", "faster", "mood-0-calmer", "mood-1-bigger", "ending-roll", "ending-big", "ending-quiet", "longer", "lift"],
  detail: ["slower", "lift", "octave-up", "ring", "mood-1-bigger"],
  share: ["ending-big", "ending-roll", "longer", "lift", "slower"],
};

function seeded(seed) {
  let x = 0;
  for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

/** Deal up to three applicable cards of different kinds for a level. The same seed deals the same hand. */
export function dealCards(doc, level, { seed = "", shuffle = 0 } = {}) {
  const ids = LEVEL_CARDS[level] || LEVEL_CARDS.shape;
  const pool = ids.map(id => CARDS.find(c => c.id === id)).filter(c => c && c.applicable(doc));
  // "Other ideas" must really be other ideas: re-roll until the hand differs from the last one, when it can.
  const previous = shuffle > 0 ? dealCards(doc, level, { seed, shuffle: shuffle - 1 }).map(c => c.id).join() : null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const hand = dealOnce(pool, `${seed}:${level}:${shuffle}:${attempt}`);
    if (previous === null || pool.length <= 3 || hand.map(c => c.id).join() !== previous) return hand;
  }
  return dealOnce(pool, `${seed}:${level}:${shuffle}:last`);
}

function dealOnce(pool, seedText) {
  pool = [...pool];
  const rand = seeded(seedText);
  const hand = [];
  const byKind = ["feel", "shape", "sound"].map(kind => pool.filter(c => c.kind === kind)).filter(list => list.length);
  // First one of each kind, then fill from what is left.
  for (const list of byKind) if (hand.length < 3) hand.push(list.splice(Math.floor(rand() * list.length), 1)[0]);
  const rest = pool.filter(c => !hand.includes(c));
  while (hand.length < 3 && rest.length) hand.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  return hand;
}

export function applyCard(doc, id) {
  const card = CARDS.find(c => c.id === id);
  return card && card.applicable(doc) ? card.apply(doc) : null;
}

export function cardSeek(doc, id) {
  const card = CARDS.find(c => c.id === id);
  return card ? card.seek(doc) : 0;
}
