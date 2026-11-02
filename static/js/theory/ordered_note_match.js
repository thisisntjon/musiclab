/** Minimum-cost order-preserving onset matching, O(left.length * right.length).
 * Equal computed costs choose the earliest large-side indices. Floating-point
 * summation can distinguish mathematically tied decimal costs differently from
 * the former exhaustive enumerator; supported score outputs are parity-tested.
 * Caller supplies onset-sorted notes; neither input nor note identities change.
 */
export function matchRemaining(left, right) {
  if (!left.length) return right.map(note => [undefined, note]);
  if (!right.length) return left.map(note => [note, undefined]);
  const swap = left.length > right.length;
  const small = swap ? right : left, large = swap ? left : right;
  const m = small.length, n = large.length;
  const onset = note => note.step + (note.performance?.offset_steps || 0);
  const cost = Array.from({ length: m + 1 }, () => new Float64Array(n + 1).fill(Infinity));
  cost[m].fill(0);
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - (m - i); j >= 0; j--) {
      const take = Math.abs(onset(small[i]) - onset(large[j])) + cost[i + 1][j + 1];
      cost[i][j] = Math.min(take, cost[i][j + 1]);
    }
  }
  const matches = new Map();
  for (let i = 0, j = 0; i < m && j < n; j++) {
    const take = Math.abs(onset(small[i]) - onset(large[j])) + cost[i + 1][j + 1];
    if (take <= cost[i][j + 1]) matches.set(j, small[i++]);
  }
  return large.map((note, i) => swap ? [note, matches.get(i)] : [matches.get(i), note]);
}
