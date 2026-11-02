/**
 * Two-switch scanning (Phase 9a, F-ACC-3): Space moves to the next item, Enter chooses it.
 * Untimed: nothing moves on its own. Pure, so the order and wrap-around are unit-tested.
 */
export function createScan() {
  return { index: -1 };
}

/** Move to the next item (wrapping); returns its index, or -1 when there are no items. */
export function scanNext(scan, itemCount) {
  if (itemCount <= 0) {
    scan.index = -1;
    return -1;
  }
  scan.index = scan.index < 0 || scan.index >= itemCount - 1 ? 0 : scan.index + 1;
  return scan.index;
}

/** Keep the highlight on the same item after the screen redraws, if it still exists. */
export function scanResync(scan, itemCount, currentIndex) {
  scan.index = currentIndex >= 0 && currentIndex < itemCount ? currentIndex : -1;
  return scan.index;
}
