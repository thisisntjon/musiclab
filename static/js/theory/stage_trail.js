/**
 * Where "Back" goes. The play flow lets a person skip ahead ("Keep it" from the beat), so Back must return to
 * the stage they actually came from, never to a fixed "previous" stage they may not have seen.
 * The trail is the path of stages visited, without loops: going forward to a stage already on it cuts it there.
 */
export function goForward(trail, from, to) {
  if (to === "start") return [];
  if (from === to) return trail;
  const at = trail.indexOf(to);
  if (at >= 0) return trail.slice(0, at);
  return [...trail, from];
}

/** The stage Back returns to, and the trail after going there; null when there is nowhere to go back to. */
export function goBack(trail) {
  if (!trail.length) return null;
  return { to: trail[trail.length - 1], trail: trail.slice(0, -1) };
}
