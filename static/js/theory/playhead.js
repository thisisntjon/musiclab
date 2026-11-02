/**
 * Playhead and lit pads. Pure: turns the step that is sounding now into what the play flow shows.
 *
 * What lights comes from the compiled events for that step, so a pad lights only when its note
 * has been submitted to the audio engine. Physical audibility is not measured. Flash safety (WCAG 2.3.1): the moving playhead is a thin ring, never a fill
 * change, and at most 3 pads change brightness at once: 6,912 px² at 48 px, 12,288 px² with Bigger buttons
 * (64 px), both under the 21,824 px² general-flash area (25% of a 341 × 256 px field).
 */
import { LANES, BEAT_STEPS } from "./beat_model.js";

export const STEPS_PER_BAR = 16;
const PATCH_TO_LANE = { kick: "kick", clap: "clap", snare: "snare", hat_closed: "hat", hat_open: "hat_open", perc: "perc" };
const STEPS_PER_BEAT_PAD = STEPS_PER_BAR / BEAT_STEPS; // 2: one beat pad is an eighth note

/** Move the playhead to `stepEvt` ({step, events}). `prev` is the last result, or null. */
export function advancePlayhead(prev, stepEvt, totalSteps = 64, cycle = 16) {
  const STEPS_PER_BAR=cycle;
  const step = Number(stepEvt.step);
  const local = step % STEPS_PER_BAR;
  // A held tune note stays lit until its length runs out or the next tune note starts.
  let lead = prev?.lead || null;
  if (lead && !(step > lead.step && step < lead.step + lead.length)) lead = null;
  // Beat pads are eighths: hits on the eighth stay lit through the sixteenth after it.
  let hits = local % STEPS_PER_BEAT_PAD === 0 ? [] : prev?.hits || [];
  for (const e of stepEvt.events || []) {
    if (e.role === "lead" && Number.isFinite(e.concrete?.midi_pitch)) {
      lead = { step, length: Math.max(1, Number(e.duration_steps || 1)), midi: e.concrete.midi_pitch };
    } else if (e.role === "drums" && local % STEPS_PER_BEAT_PAD === 0) {
      const lane = PATCH_TO_LANE[e.patch_id];
      if (lane && !hits.includes(lane)) hits = [...hits, lane];
    }
  }
  return {
    step,
    cycle,
    leads: stepEvt.sounding ? stepEvt.sounding.filter(e => e.role === "lead" && Number.isFinite(e.concrete?.midi_pitch)).map(e => ({ step: e.step, midi: e.concrete.midi_pitch })) : (lead ? [lead] : []),
    bar: Math.floor(step / STEPS_PER_BAR),
    bars: Math.max(1, Math.ceil(totalSteps / STEPS_PER_BAR)),
    local,
    hits: stepEvt.sounding ? [...new Set(stepEvt.sounding.filter(e => e.role === "drums").map(e => PATCH_TO_LANE[e.patch_id]).filter(Boolean))] : hits,
    lead,
  };
}

/**
 * What to mark on the current screen.
 * Returns { ring: [selector...], lit: [selector...] } for the stage's pads; both empty when the
 * sounding bar is not the one on screen (the ending tab shows bar 4; "My tune" shows bars 1-3).
 */
export function playheadMarks(state, { stage, tab = "main", page = 0, pageSize = 8, endingBar = 3 } = {}) {
  const none = { ring: [], lit: [] };
  if (!state) return none;
  if (stage === "beat") {
    const col = Math.floor(state.local / STEPS_PER_BEAT_PAD);
    return {
      ring: LANES.map((l) => `.pf-pad[data-lane="${l.id}"][data-step="${col}"]`),
      lit: state.hits.slice(0, 3).map((lane) => `.pf-pad.on[data-lane="${lane}"][data-step="${col}"]`),
    };
  }
  if (stage === "tune") {
    const barInLoop = state.bar % 4;
    const onScreen = tab === "ending" ? barInLoop === endingBar : barInLoop < endingBar;
    if (!onScreen) return none;
    const first = page * pageSize;
    const col = state.local;
    const ring = col >= first && col < first + pageSize ? [`.pf-note[data-col="${col}"]`] : [];
    const lit = [];
    for (const active of (state.leads || (state.lead ? [state.lead] : [])).slice(0,3)) {
      const leadCol = active.step % (state.cycle || STEPS_PER_BAR);
      if (leadCol >= first && leadCol < first + pageSize) lit.push(`.pf-note.on[data-col="${leadCol}"][data-midi="${active.midi}"]`);
    }
    return { ring, lit };
  }
  return none;
}
