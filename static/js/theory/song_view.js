/**
 * Phase 10: From your 4-bar loop to a full song (`song_view.js`).
 * Pure and import-free so it runs in Node unit tests and in the browser.
 *
 * A card uses the shared 4-bar loop unless it owns a detached material snapshot.
 * It also holds layer switches and transforms:
 *   - beat (`role === "drums"`)
 *   - tune (`role === "lead"`)
 *   - under (`role === "harmony" || role === "bass" || role === "hocket"`)
 * Untransformed repeats retain note identity and pitch. Lift transforms the
 * selected source without replacing it. Detached parts retain editable notes.
 */

export const MAX_SONG_CARDS = 8;

export const CARD_LAYERS = [
  { id: "beat", label: "Beat", icon: "drum" },
  { id: "tune", label: "Tune", icon: "note" },
  { id: "under", label: "Under", icon: "cloud" },
];

/**
 * Proposal #3: 3-Button Punch-In Performance FX per Song Card.
 */
export const CARD_FX = [
  { id: "beat_drop", label: "Beat drop", icon: "bolt" },
  { id: "high_lift", label: "High lift", icon: "climb" },
  { id: "drum_roll", label: "Drum roll", icon: "drum" },
];

const VALID_FX = new Set(CARD_FX.map((f) => f.id));
const normalizedBars = (bars) => Number.isInteger(bars) && bars >= 1 && bars <= 4 ? bars : 4;

export function setSongCardBars(cards, index, bars) {
  const list = normalizeSongCards(cards);
  if (!Number.isInteger(index) || !list[index] || normalizedBars(bars) !== bars) return list;
  return list.map((card, i) => i === index ? { ...card, bars } : card);
}

export function songCardRanges(cards, loopSteps = 64, bpm = 100, stepsPerBar = 16) {
  let start = 0;
  const stepSec = 60 / bpm / 4;
  return normalizeSongCards(cards).map((card, index) => {
    const steps = Math.min(loopSteps, card.bars * stepsPerBar);
    const range = { index, bars: steps / stepsPerBar, start_step: start, end_step: start + steps,
      start_sec: Number((start * stepSec).toFixed(4)), end_sec: Number(((start + steps) * stepSec).toFixed(4)) };
    start += steps;
    return range;
  });
}

// Song identity, arrangement, history and global timing/key never belong to a part.
export const SONG_MATERIAL_FIELDS = [
  "notes", "drum_kit", "lead_patch_id", "underneath", "chord_progressions",
  "active_progression_id", "sound_seed", "beat_fill", "harmony_style", "stereo_jux",
  "harmony_patch_id", "auto_harmony_stabs", "pinned_chord_bars", "note_dial", "tune_grid_state", "band_id", "selected_instrument",
];
const clone = (value) => JSON.parse(JSON.stringify(value));

export function extractSongMaterial(doc) {
  const material = {};
  for (const field of SONG_MATERIAL_FIELDS) {
    if (doc?.[field] !== undefined) material[field] = clone(doc[field]);
  }
  return material;
}

/** Replace, rather than merge, musical fields so removed accompaniment stays removed. */
export function applySongMaterial(doc, material) {
  const out = clone(doc);
  for (const field of SONG_MATERIAL_FIELDS) delete out[field];
  return Object.assign(out, extractSongMaterial(material));
}

export function detachSongCard(cards, cardIdx, doc) {
  const list = normalizeSongCards(cards);
  if (!Number.isInteger(cardIdx) || !list[cardIdx] || list[cardIdx].material) return list;
  list[cardIdx].material = extractSongMaterial(doc);
  return list;
}

export function updateSongCardMaterial(cards, cardIdx, doc) {
  const list = normalizeSongCards(cards);
  if (!Number.isInteger(cardIdx) || !list[cardIdx]?.material) return list;
  list[cardIdx].material = extractSongMaterial(doc);
  return list;
}

export function defaultSongCards() {
  return [{ beat: true, tune: true, under: true, fx: null, big: false, tune_variant: null }];
}

export function normalizeSongCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return defaultSongCards();
  return cards.slice(0, MAX_SONG_CARDS).map((c) => {
    const out = {
      beat: c?.beat !== false,
      tune: c?.tune !== false,
      under: c?.under !== false,
      fx: VALID_FX.has(c?.fx) ? c.fx : null,
      big: Boolean(c?.big),
      tune_variant: c?.tune_variant === "lift" ? "lift" : null,
      bars: normalizedBars(c?.bars),
    };
    if(c?.capture_segment?.version===1&&typeof c.capture_segment.take_id==='string'&&c.capture_segment.take_id.length<=256
      &&Number.isInteger(c.capture_segment.start_step)&&c.capture_segment.start_step>=0
      &&Number.isInteger(c.capture_segment.end_step)&&c.capture_segment.end_step>c.capture_segment.start_step&&c.capture_segment.end_step<=256)
      out.capture_segment=clone(c.capture_segment);
    if (typeof c?.role_name === "string" && c.role_name) out.role_name = c.role_name;
    if (c?.material && typeof c.material === "object" && !Array.isArray(c.material)) {
      out.material = extractSongMaterial(c.material);
    }
    return out;
  });
}

/**
 * Proposal #6 ("The song reveal", 94/100):
 * Hear your phrase become a Beginning, Main part, and Ending.
 * Every part remains a standard editable card so the person chooses what enters, disappears, or returns.
 */
export function revealSongArc() {
  return [
    { role_name: "Beginning", beat: true, tune: true, under: false, fx: null, big: false },
    { role_name: "Main part", beat: true, tune: true, under: true, fx: null, big: true },
    { role_name: "Ending", beat: false, tune: true, under: true, fx: "beat_drop", big: false },
  ];
}

/**
 * Phase 13.4: a captured jam becomes a three-part song made of itself.
 * Beginning is the capture without bass and chords, Main is the capture made big,
 * Ending is the capture with a drum roll into its last bar. Length, name and any
 * captured segments are kept; nothing about the notes changes.
 */
export const PART_MOODS = [
  { id: "calmer", label: "Calmer" },
  { id: "same", label: "Same" },
  { id: "bigger", label: "Bigger" },
];
export const ENDING_STYLES = [
  { id: "quiet", label: "Quiet end", fx: "beat_drop" },
  { id: "roll", label: "Drum roll", fx: "drum_roll" },
  { id: "big", label: "Big finish", fx: "high_lift" },
];

export function songArcFromCapture(cards) {
  const list = normalizeSongCards(cards);
  const first = list[0], last = list[list.length - 1];
  const beginning = { ...clone(first), role_name: "Beginning", under: false, big: false, fx: null, tune_variant: null };
  const main = list.map((card, i) => ({ ...clone(card), role_name: list.length === 1 ? "Main part" : `Main part ${i + 1}`, big: true, fx: null }));
  const ending = { ...clone(last), role_name: "Ending", beat: true, under: true, big: false, fx: "drum_roll", tune_variant: null };
  return normalizeSongCards([beginning, ...main, ending]).slice(0, MAX_SONG_CARDS);
}

/** Calmer, Same or Bigger: one understandable change to a part's layers and size. */
export function setPartMood(cards, idx, mood) {
  const list = normalizeSongCards(cards);
  if (!list[idx] || !PART_MOODS.some(m => m.id === mood)) return list;
  const changes = mood === "calmer" ? { beat: true, tune: true, under: false, big: false }
    : mood === "bigger" ? { beat: true, tune: true, under: true, big: true }
    : { beat: true, tune: true, under: true, big: false };
  return list.map((card, i) => i === idx ? { ...card, ...changes } : card);
}

export function partMood(card) {
  if (!card) return "same";
  if (card.big && card.under) return "bigger";
  if (!card.under && !card.big) return "calmer";
  return card.beat && card.tune && card.under && !card.big ? "same" : null;
}

/** The last part ends the song: a quiet end, a drum roll, or a big finish. */
export function setEndingStyle(cards, styleId) {
  const list = normalizeSongCards(cards);
  const style = ENDING_STYLES.find(s => s.id === styleId);
  if (!style || !list.length) return list;
  const idx = list.length - 1;
  return list.map((card, i) => i === idx
    ? { ...card, fx: style.fx, beat: true, under: style.id === "big" ? true : card.under, big: style.id === "big" ? true : card.big }
    : card);
}

export function endingStyle(card) {
  return ENDING_STYLES.find(s => s.fx === card?.fx)?.id || null;
}

/**
 * Proposal #11 ("Perform your arrangement with a few buttons", 90/100):
 * Capture a sequence of performed card indices into an editable arrangement of up to MAX_SONG_CARDS.
 */
export function capturePerformedArrangement(cards, performedIndices = []) {
  const list = normalizeSongCards(cards);
  if (!Array.isArray(performedIndices) || performedIndices.length === 0) return list;
  const out = [];
  for (const idx of performedIndices.slice(0, MAX_SONG_CARDS)) {
    const c = list[idx];
    if (c) out.push(clone(c));
  }
  return out.length > 0 ? out : list;
}

export function addSongCard(cards) {
  const list = normalizeSongCards(cards);
  if (list.length >= MAX_SONG_CARDS) return list;
  const last = list[list.length - 1] || { beat: true, tune: true, under: true, fx: null, big: false };
  return [...list, { ...clone(last), fx: null, big: false }];
}

export function removeSongCard(cards, idx = -1) {
  const list = normalizeSongCards(cards);
  if (list.length <= 1) return list;
  const target = idx < 0 ? list.length - 1 : idx;
  return list.filter((_, i) => i !== target);
}

/** Move one part without changing its musical settings. */
export function moveSongCard(cards, fromIdx, toIdx) {
  const list = normalizeSongCards(cards);
  if (!Number.isInteger(fromIdx) || !Number.isInteger(toIdx) || fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length || fromIdx === toIdx) {
    return list;
  }
  const out = list.map((card) => ({ ...card }));
  const [moved] = out.splice(fromIdx, 1);
  out.splice(toIdx, 0, moved);
  return out;
}

export function toggleCardLayer(cards, cardIdx, layerId) {
  const list = normalizeSongCards(cards);
  if (cardIdx < 0 || cardIdx >= list.length) return list;
  if (!["beat", "tune", "under"].includes(layerId)) return list;
  return list.map((c, i) => (i === cardIdx ? { ...c, [layerId]: !c[layerId] } : c));
}

export function toggleCardFx(cards, cardIdx, fxId) {
  const list = normalizeSongCards(cards);
  if (cardIdx < 0 || cardIdx >= list.length) return list;
  if (!VALID_FX.has(fxId)) return list;
  return list.map((c, i) => (i === cardIdx ? { ...c, fx: c.fx === fxId ? null : fxId } : c));
}

export function toggleCardBig(cards, cardIdx) {
  const list = normalizeSongCards(cards);
  if (cardIdx < 0 || cardIdx >= list.length) return list;
  return list.map((c, i) => (i === cardIdx ? { ...c, big: !c.big } : c));
}

/** Toggle a card-local octave transform of the shared source tune. */
export function toggleCardTuneVariation(cards, cardIdx) {
  const list = normalizeSongCards(cards);
  if (cardIdx < 0 || cardIdx >= list.length) return list;
  return list.map((card, idx) => idx === cardIdx
    ? { ...card, tune_variant: card.tune_variant === "lift" ? null : "lift" }
    : card);
}

function layerOfEvent(ev) {
  if (ev.role === "drums") return "beat";
  if (ev.role === "lead") return "tune";
  return "under";
}

function firstLeadFreqAndMidi(srcEvents) {
  const leadEv = srcEvents.find((e) => e.role === "lead" && e.concrete?.freq_hz);
  if (leadEv) {
    return {
      freq_hz: Number(leadEv.concrete.freq_hz),
      midi: Number(leadEv.concrete.midi ?? leadEv.concrete.midi_pitch ?? 60),
    };
  }
  return { freq_hz: 261.63, midi: 60 };
}

/**
 * Turn compiled 4-bar sources into the full song's compiled object (10-1).
 * Callers compile detached material into compiledCards at the matching card index.
 * Leaves source events untouched; only explicitly transformed copies change pitch.
 */
export function songEvents(loopCompiled, cards, compiledCards = []) {
  const list = normalizeSongCards(cards);
  const loopSteps = Number(loopCompiled?.total_steps || 64);
  const bpm = Number(loopCompiled?.bpm || 100);
  const stepSec = 60.0 / bpm / 4.0;
  const stepsPerBar=loopCompiled?.steps_per_bar||16;
  const ranges = songCardRanges(list, loopSteps, bpm, stepsPerBar);
  const events = [];

  for (let c = 0; c < list.length; c++) {
    const card = list[c];
    const source = compiledCards[c] || loopCompiled;
    const srcEvents = Array.isArray(source?.events) ? source.events : [];
    const firstLead = firstLeadFreqAndMidi(srcEvents);
    const nextIsBig = c + 1 < list.length && Boolean(list[c + 1].big);
    const stepOffset = ranges[c].start_step;
    const secOffset = stepOffset * stepSec;
    const cardSteps = ranges[c].end_step - stepOffset;

    for (const ev of srcEvents) {
      const layer = layerOfEvent(ev);
      if (!card[layer]) continue;
      const localStep = Number(ev.step || 0);
      if (localStep < 0 || localStep >= cardSteps) continue;

      // Proposal #3: beat_drop mutes drums & bass in Bar 4 (steps 48..63)
      if (card.fx === "beat_drop" && localStep >= cardSteps - stepsPerBar) {
        if (ev.role === "drums" || ev.role === "bass" || ev.role === "hocket") {
          continue;
        }
      }

      // Proposal #11: pre-drop breath mutes backing layers in last 3 steps (61..63) before a Big card
      if (nextIsBig && localStep >= cardSteps - 3 && ev.role !== "lead") {
        continue;
      }

      const startSec = Number(ev.start_sec ?? localStep * stepSec) + secOffset;
      const performedDuration = ev.duration_steps;
      const keepFinalRelease = ev.performance?.version === 1 && !card.capture_segment && c === list.length - 1 && typeof performedDuration === "number"
        && Number.isFinite(performedDuration) && performedDuration > 0 && performedDuration <= 64;
      let availableSteps=cardSteps;
      if(ev.performance?.version===1&&Number.isInteger(ev.capture_occurrence)&&card.capture_segment&&!card.fx&&!card.big&&!card.tune_variant){
        let previous=card;
        for(let next=c+1;next<list.length;next++){
          const following=list[next],a=previous.capture_segment,b=following.capture_segment;
          if(!b||b.take_id!==a.take_id||b.start_step!==a.end_step||!following[layer]||following.fx||following.big||following.tune_variant
            ||a.end_step-a.start_step!==previous.bars*stepsPerBar||b.end_step-b.start_step!==following.bars*stepsPerBar)break;
          availableSteps+=following.bars*stepsPerBar;previous=following;
        }
      }
      let eventForCard = {
        ...ev,
        step: localStep + stepOffset,
        start_sec: Number(startSec.toFixed(4)),
        duration_sec: keepFinalRelease ? Number(ev.duration_sec || stepSec)
          : Math.min(Number(ev.duration_sec || stepSec), Math.max(0, availableSteps * stepSec - Number(ev.start_sec ?? localStep * stepSec))),
        card: c,
      };
      if (ev.role === "lead" && card.tune_variant === "lift") {
        const baseMidi = Number(ev.concrete?.midi ?? ev.concrete?.midi_pitch ?? 60);
        // Keep the interval an octave; clamping to an arbitrary ceiling changes pitch class.
        const midi = baseMidi <= 115 ? baseMidi + 12 : baseMidi;
        const ratio = Math.pow(2, (midi - baseMidi) / 12);
        const freq = Number((Number(ev.concrete?.freq_hz || 440 * Math.pow(2, (baseMidi - 69) / 12)) * ratio).toFixed(3));
        eventForCard = {
          ...eventForCard,
          id: `${ev.id}-variation-c${c}`,
          concrete: {
            ...(ev.concrete || {}),
            midi,
            ...(ev.concrete && Object.hasOwn(ev.concrete, "midi_pitch") ? { midi_pitch: midi } : {}),
            freq_hz: freq,
          },
          voiced_freqs: Array.isArray(ev.voiced_freqs)
            ? ev.voiced_freqs.map((value) => Number((Number(value) * ratio).toFixed(3)))
            : ev.voiced_freqs,
        };
      }
      events.push(eventForCard);

      // Proposal #3 (high_lift) & #11 (big card chorus shimmer): add octave-lifted companion without mutating lead event
      if (ev.role === "lead" && card.under && (card.fx === "high_lift" || card.big)) {
        const baseMidi = Number(ev.concrete?.midi ?? ev.concrete?.midi_pitch ?? 60);
        const liftMidi = baseMidi <= 115 ? baseMidi + 12 : baseMidi;
        const liftFreq = Number((440.0 * Math.pow(2.0, (liftMidi - 69.0) / 12.0)).toFixed(3));
        const liftSource = { ...eventForCard };
        // This is a new generated event, not another occurrence of the player.
        delete liftSource.source_note_id;
        delete liftSource.capture_occurrence;
        events.push({
          ...liftSource,
          id: `${ev.id}-lift-c${c}`,
          role: "harmony",
          provenance: "generator_default",
          generated_by: "song_card_lift",
          response_to: [ev.source_note_id || ev.id],
          patch_id: ev.patch_id || "pluck_lead",
          concrete: { midi: liftMidi, freq_hz: liftFreq },
          voiced_freqs: [liftFreq],
          velocity: Number((Number(ev.velocity || 0.8) * 0.45).toFixed(3)),
          step: localStep + stepOffset,
          start_sec: Number(startSec.toFixed(4)),
          card: c,
        });
      }
    }

    // Proposal #3: drum_roll adds a 16th-note snare build in steps 56..63
    if (card.fx === "drum_roll" && card.beat) {
      for (let s = cardSteps - 8; s < cardSteps; s++) {
        if (nextIsBig && s >= cardSteps - 3) continue;
        const globalStep = stepOffset + s;
        const startSec = Number((secOffset + s * stepSec).toFixed(4));
        const vel = Number((0.38 + ((s - (cardSteps - 8)) / 7.0) * 0.48).toFixed(3));
        events.push({
          id: `fx-roll-c${c}-s${s}`,
          role: "drums",
          patch_id: "snare",
          step: globalStep,
          bar: 4,
          start_sec: startSec,
          duration_sec: Number(stepSec.toFixed(4)),
          velocity: vel,
          provenance: "generator_default",
          concrete: { midi: 38, freq_hz: 200.0 },
          card: c,
        });
      }
    }

    // Proposal #13: Reverse-Cymbal Swell into the next Big card (steps 52..60 of Card c)
    if (nextIsBig && card.under) {
      const swellStartStep = cardSteps - 12;
      const swellDurSteps = 9;
      events.push({
        id: `fx-swell-c${c}`,
        role: "harmony",
        patch_id: "reverse_swell",
        step: stepOffset + swellStartStep,
        bar: 4,
        start_sec: Number((secOffset + swellStartStep * stepSec).toFixed(4)),
        duration_sec: Number((swellDurSteps * stepSec).toFixed(4)),
        velocity: 0.72,
        provenance: "generator_default",
        concrete: { midi: firstLead.midi, freq_hz: firstLead.freq_hz },
        card: c,
      });
    }
  }

  events.sort((a, b) => Number(a.start_sec || 0) - Number(b.start_sec || 0));

  return {
    ...loopCompiled,
    bpm,
    cards_count: list.length,
    loop_steps: loopSteps,
    total_steps: ranges.at(-1).end_step,
    total_duration_sec: ranges.at(-1).end_sec,
    sections: ranges,
    events,
  };
}
