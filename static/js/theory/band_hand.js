/** Phase 14.3b: the band shows its hand.
 *
 * A player working by ear runs a loop: hear, name what is off, make one technical move, listen
 * again. After a person finishes a phrase during Listen, the band names one thing it heard and
 * offers one move. The person takes it or leaves it; Undo is one press either way. The reads are
 * the person's own released pitched notes only. One hand per phrase; nothing is applied on its own.
 */
import {NOTE_NAMES} from './harmony.js';

export const HAND_WINDOW_BARS = 4;
export const HAND_MIN_NOTES = 3;
export const HAND_SWING = .62;

const pcOf = record => {
  const midi = Number.isFinite(record.event?.concrete?.midi_pitch) ? record.event.concrete.midi_pitch
    : Number.isFinite(record.event?.concrete?.freq_hz) ? 69 + 12 * Math.log2(record.event.concrete.freq_hz / 440) : NaN;
  return Number.isFinite(midi) ? ((Math.round(midi) % 12) + 12) % 12 : null;
};

/** The person's own released pitched notes from the last window, oldest first. */
export function ownPhrase(take, now, { windowBars = HAND_WINDOW_BARS } = {}) {
  if (!take || !Array.isArray(take.events) || !Number.isFinite(now)) return [];
  const bpm = Number(take.bpm) || 100, stepsPerBar = Number(take.steps_per_bar) || 16;
  const barSec = (60 / bpm) * stepsPerBar / 4, since = now - windowBars * barSec;
  return take.events.filter(record => record && record.event
    && record.event.provenance === 'user_placed'
    && typeof record.event.source_note_id === 'string' && record.event.source_note_id.startsWith('jam-live-')
    && record.event.role !== 'drums'
    && Number.isFinite(record.time) && record.time >= since && record.time <= now
    && Number.isFinite(record.released_at) && record.released_at >= record.time && record.released_at <= now
    && pcOf(record) !== null).sort((a, b) => a.time - b.time);
}

/** True once the phrase has rested for a beat, so successive taps become one phrase first. */
export function phraseSettled(notes, now, bpm = 100) {
  if (!notes.length) return false;
  const lastRelease = Math.max(...notes.map(record => record.released_at));
  return now - lastRelease >= Math.max(.35, 60 / (Number(bpm) || 100));
}

/**
 * One read and one move, or null. Priority: a leaned-on note that is not home, playing between
 * the beats, a lot or a little, ending on home. `state` gives the band's current root, swing and
 * density so a move is only offered when it would change something.
 */
export function readHand(take, now, state = {}) {
  const notes = ownPhrase(take, now);
  if (notes.length < HAND_MIN_NOTES) return null;
  const bpm = Number(take.bpm) || 100, beatSec = 60 / bpm, stepsPerBar = Number(take.steps_per_bar) || 16;
  const barSec = beatSec * stepsPerBar / 4;
  const root = ((Number(state.root) || 0) % 12 + 12) % 12;
  const density = Number.isInteger(state.density) ? state.density : 1;
  const swing = Number(state.swing) || .5;
  const last = notes.at(-1).sequence ?? notes.at(-1).occurrence ?? null;

  // 1. A leaned-on note that is not home.
  const counts = new Map();
  for (const record of notes) counts.set(pcOf(record), (counts.get(pcOf(record)) || 0) + 1);
  const [topPc, topCount] = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (topPc !== root && topCount / notes.length >= .5) {
    return { kind: 'root', value: topPc, heard: `You lean on ${NOTE_NAMES[topPc]}.`, move: `Make ${NOTE_NAMES[topPc]} home`, through: last };
  }

  // 2. Between the beats.
  const start = Number(take.start) || 0;
  const offBeat = notes.filter(record => { const phase = ((record.time - start) / beatSec) % 1; return phase > .3 && phase < .7; }).length;
  if (offBeat / notes.length >= .6 && swing < HAND_SWING - .02) {
    return { kind: 'swing', value: HAND_SWING, heard: 'You play off the beat.', move: 'Swing the band', through: last };
  }

  // 3. A lot, or a little.
  const first = notes[0].time, span = Math.max(1, Math.min(HAND_WINDOW_BARS, (now - first) / barSec));
  const perBar = notes.length / span;
  const meanHold = notes.reduce((sum, record) => sum + Math.max(0, record.released_at - record.time), 0) / notes.length;
  if (perBar >= 6 && density < 4) return { kind: 'density', value: density + 1, heard: 'You play a lot.', move: 'More movement', through: last };
  if (perBar <= 1.5 && meanHold >= beatSec && density > 0) return { kind: 'density', value: density - 1, heard: 'You leave room.', move: 'More space', through: last };

  // 4. Ending on home.
  if (pcOf(notes.at(-1)) === root) return { kind: 'song', value: null, heard: 'You end on home.', move: 'Make my song', through: last };
  return null;
}
