/** Phase 14.3: what a person plays during Listen leans where the band explores next.
 *
 * Busy, short playing leans the next pick toward scenes with more movement; sparse,
 * held playing leans toward scenes with more space. The lean reweights the compatible
 * candidates the route already allows. It never removes one, never invents an edge, and
 * never fires on fewer than a few notes, so a single tap keeps the tour a tour. Pitches
 * are validated but do not steer the lean: kept notes keep their pitches, so the band's key is not moved under them.
 */
export const BIAS_WINDOW_BARS = 8;
export const BIAS_MIN_NOTES = 3;
export const BIAS_DEAD_ZONE = .15;
const BUSY_NOTES_PER_BAR = 8;
const SCHEDULED_AHEAD_SEC = .1; // matches SCHEDULE_AHEAD_SEC in static/js/audio/scheduler.js

/** Density and hold of the person's own recent pitched notes, from the live performance take. */
export function performanceLean(take, now, { windowBars = BIAS_WINDOW_BARS, minNotes = BIAS_MIN_NOTES } = {}) {
  if (!take || !Array.isArray(take.events) || !Number.isFinite(now)) return null;
  const bpm = Number(take.bpm) || 100, stepsPerBar = Number(take.steps_per_bar) || 16;
  const beatSec = 60 / bpm, barSec = beatSec * stepsPerBar / 4;
  const since = now - windowBars * barSec;
  const own = take.events.filter(record => record && record.event
    && record.event.provenance === 'user_placed'
    && typeof record.event.source_note_id === 'string' && record.event.source_note_id.startsWith('jam-live-')
    && record.event.role !== 'drums'
    && (Number.isFinite(record.event.concrete?.midi_pitch)
      || (Number.isFinite(record.event.concrete?.freq_hz) && record.event.concrete.freq_hz > 0))
    && (record.released_at == null || (Number.isFinite(record.released_at) && record.released_at >= record.time))
    // A press is scheduled a hair ahead of the clock; the read counts it at once, so the meter
    // answers the press rather than the next tick. Nothing further ahead than the scheduler's lookahead counts.
    && Number.isFinite(record.time) && record.time >= since && record.time <= now + SCHEDULED_AHEAD_SEC);
  if (own.length < Math.max(1, minNotes)) return null;
  const first = Math.min(...own.map(record => record.time));
  const spanBars = Math.max(1, Math.min(windowBars, (now - first) / barSec));
  const notesPerBar = own.length / spanBars;
  const holds = own.map(record => Number.isFinite(record.released_at)
    ? Math.max(0, record.released_at - record.time) : Number(record.duration) || 0);
  const meanHoldSec = holds.reduce((a, b) => a + b, 0) / holds.length;
  const density = Math.min(1, notesPerBar / BUSY_NOTES_PER_BAR);
  const held = Math.min(1, meanHoldSec / beatSec);
  // Activity 0..1: 1 is many short notes, 0 is a few long ones. Lean is centred on 0.
  const activity = Math.max(0, Math.min(1, .6 * density + .4 * (1 - held)));
  const lean = (activity - .5) * 2;
  // The pitch class the person returns to most, for the meter's pad light (not used to steer).
  const counts = new Map();
  for (const record of own) {
    const midi = Number.isFinite(record.event.concrete?.midi_pitch) ? record.event.concrete.midi_pitch : 69 + 12 * Math.log2(record.event.concrete.freq_hz / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12; counts.set(pc, (counts.get(pc) || 0) + 1);
  }
  const [topPitchClass, topCount] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { notes: own.length, notesPerBar, meanHoldSec, activity, lean: Math.abs(lean) < BIAS_DEAD_ZONE ? 0 : lean,
    settled: own.length >= BIAS_MIN_NOTES, topPitchClass, topShare: topCount / own.length };
}

/** Phase 15.1: the same read with no minimum, for the heard meter. `settled` says whether it would steer. */
export function performanceRead(take, now, options = {}) {
  return performanceLean(take, now, { ...options, minNotes: 1 });
}

/** Plain words for the meter's accessible name. */
export function heardWords(read) {
  if (!read) return 'Band hears: nothing yet. Play a key.';
  if (!read.settled) return 'Band hears: a start. Play more.';
  if (read.lean > 0) return 'Band hears: you play a lot.';
  if (read.lean < 0) return 'Band hears: you leave room.';
  return 'Band hears: in between.';
}

/** Movement of a generated backing: notes per bar, so a candidate scene can be compared with the current one. */
export function backingActivity(notes, stepsPerBar = 16) {
  if (!Array.isArray(notes) || !notes.length) return 0;
  const lastStep = Math.max(...notes.map(note => (Number(note.step) || 0) + (Number(note.duration_steps) || 0)));
  const bars = Math.max(1, Math.ceil(lastStep / (stepsPerBar || 16)));
  return notes.length / bars;
}

/**
 * Multiplier per candidate index, from the lean and each candidate's activity relative to the
 * current scene. Candidates that move the way the lean points gain weight, the others lose some;
 * every multiplier stays inside [MIN, MAX], so no compatible direction is ever shut.
 */
export const BIAS_MIN = .4, BIAS_MAX = 2.5;
export function leanWeights(lean, currentActivity, activityOf) {
  const strength = Number(lean) || 0;
  if (!Number.isFinite(strength) || !strength || !Number.isFinite(currentActivity) || currentActivity <= 0) return () => 1;
  return index => {
    const activity = Number(activityOf(index));
    if (!Number.isFinite(activity)) return 1;
    const delta = Math.max(-1, Math.min(1, (activity - currentActivity) / currentActivity));
    return Math.max(BIAS_MIN, Math.min(BIAS_MAX, 1 + 1.5 * strength * delta));
  };
}

/** One short line for the person, or '' when nothing leans. */
export function leanWords(lean) {
  const strength = Number(lean) || 0;
  if (strength > 0) return 'You play a lot. The band moves more next.';
  if (strength < 0) return 'You hold your notes. The band makes room next.';
  return '';
}
