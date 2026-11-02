/**
 * A listening check that is really blind (Phase 8.0, decision 11).
 * Which ending comes to rest is random per trial and is never hinted before the answer.
 * The result is logged for learning measures (research R8) but no score is shown.
 */

export const EAR_PROMPT = "Listen to both endings. Which one sounds more finished, like it came home?";

/** @param {() => number} rand returns a number in [0, 1) */
export function newEarTrial(rand = Math.random) {
  return { id: `ear-${Date.now()}-${Math.floor(rand() * 1e6)}`, settled: rand() < 0.5 ? "A" : "B" };
}

/** Which kind of ending to play for a side: "settled" (comes home) or "open" (keeps moving). */
export function endingKind(trial, side) {
  return trial.settled === side ? "settled" : "open";
}

/** Plain feedback, shown only after the person answers. */
export function earFeedback(trial, picked) {
  if (picked === trial.settled) {
    return `Yes. Ending ${picked} comes to rest on the home note of your song.`;
  }
  return `Ending ${picked} keeps moving. Ending ${trial.settled} comes to rest on the home note. Want to hear them again?`;
}
