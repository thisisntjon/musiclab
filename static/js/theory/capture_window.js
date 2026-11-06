/** What goes into a kept song, from everything a person played. 3 November: "keep a longer history so no
 * notes are lost." A song holds at most eight parts of four bars, and Beginning and Ending take two of them, so
 * twenty-four bars of real music fit. Up to that the kept music is exactly as it happened. Past that, four-bar
 * blocks in which the person played nothing drop out, so their notes keep the band that played under them. If they
 * really played more than twenty-four bars, the older blocks become `earlier`, another capture of the same shape,
 * which the caller saves as another song. A person's note is never clipped by a window and never dropped. */
export const MAX_SONG_BARS = 24;
const BLOCK_BARS = 4, MAX_BLOCKS = MAX_SONG_BARS / BLOCK_BARS;

/** A note the person played live in this take; not the band's answer, and not a note repeating from the loop. */
export const playedLive = item => item?.event?.provenance === 'user_placed' && /^(jam-live-|live-only-)/.test(String(item.event.source_note_id || item.event.id || ''));

const copy = (item, time, duration, carried) => ({ ...JSON.parse(JSON.stringify(item)), time, scheduled_time: item.time, scheduled_duration: item.duration, carried_in: carried, duration });

export function captureWindow({ events, start, end, bpm, stepsPerBar = 16, captureBars = 4 }) {
  const barSec = stepsPerBar * 15 / bpm;
  const barsToNow = Math.ceil((end - start) / barSec);
  const played = events.filter(item => playedLive(item) && item.time < end);
  const reach = played.length ? barsToNow - Math.floor((Math.min(...played.map(item => item.time)) - start) / barSec) : 0;
  const wanted = Math.ceil(reach / BLOCK_BARS) * BLOCK_BARS;
  if (wanted <= MAX_SONG_BARS) {
    const windowBars = Math.max(BLOCK_BARS, Math.min(MAX_SONG_BARS, Math.max(captureBars, wanted)));
    const from = start + Math.max(0, barsToNow - windowBars) * barSec;
    const kept = events.filter(item => item.time < end && item.time + item.duration > from)
      .map(item => copy(item, Math.max(from, item.time), Math.min(end, item.time + item.duration) - Math.max(from, item.time), item.time < from))
      .filter(item => item.duration > 0);
    return { start: from, windowBars, bars: Math.max(1, Math.min(windowBars, Math.ceil((end - from) / barSec))), events: kept };
  }
  // Blocks count back from the end of the take, so the moment of Keep is always block 0 and every block keeps the
  // same phase in the four-bar phrase. A block is needed if any of a person's notes sounds in it.
  const blockSec = BLOCK_BARS * barSec, finish = start + barsToNow * barSec;
  const blockAt = time => Math.max(0, Math.floor((finish - time - 1e-9) / blockSec));
  const needed = new Set([0]);
  for (const item of played) for (let b = blockAt(Math.min(end, item.time + item.duration)); b <= blockAt(item.time); b++) needed.add(b);
  const chosen = [...needed].sort((a, b) => a - b).slice(0, MAX_BLOCKS);
  const oldest = chosen.at(-1), boundary = finish - (oldest + 1) * blockSec;
  // Join neighbouring blocks into runs, each moved forward just far enough to close the gap after it.
  const runs = [];
  chosen.forEach((block, position) => {
    const shift = (block - position) * blockSec, last = runs.at(-1);
    if (last && last.shift === shift) last.from = finish - (block + 1) * blockSec;
    else runs.push({ from: finish - (block + 1) * blockSec, to: finish - block * blockSec, shift });
  });
  const kept = [];
  for (const { from, to, shift } of runs) for (const item of events) {
    if (item.time >= Math.min(end, to) || item.time + item.duration <= from) continue;
    if (playedLive(item) && item.time < from) continue; // Whole, in the block it began in; never cut here.
    const on = Math.max(from, item.time), off = Math.min(end, to, item.time + item.duration);
    if (off > on) kept.push(copy(item, on + shift, off - on, item.time < from));
  }
  kept.sort((a, b) => a.time - b.time);
  const bars = chosen.length * BLOCK_BARS;
  const result = { start: finish - bars * barSec, windowBars: bars, bars, events: kept, rests_left_out: oldest + 1 - chosen.length > 0 };
  const older = played.filter(item => item.time < boundary);
  if (older.length) {
    // The earlier song runs until its last note has finished, so a note across the join stays whole.
    const earlierEnd = Math.max(boundary, ...older.map(item => Math.min(end, item.time + item.duration)));
    const earlierEvents = events.filter(item => item.time < boundary);
    const earlier = captureWindow({ events: earlierEvents, start, end: earlierEnd, bpm, stepsPerBar });
    result.earlier = { version: 1, semantics: 'audio-clock attacks and clipped gates; not physical audibility', start: earlier.start, end: earlierEnd, bpm, ...(stepsPerBar === 12 ? { steps_per_bar: 12 } : {}), bars: earlier.bars, ...(earlier.bars > 4 ? { window_bars: earlier.windowBars } : {}), ...(earlier.rests_left_out ? { rests_left_out: true } : {}), ...(earlier.earlier ? { earlier: earlier.earlier } : {}), events: earlier.events };
  }
  return result;
}
