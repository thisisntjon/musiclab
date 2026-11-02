/**
 * #5 Synplant-inspired 3-Branch Genetic Sound Seed Breeder (Safe-Manifold Timbre Evolution).
 * Replaces intimidating synthesizer knobs with 3 one-click evolutionary branches (`Brighter`, `Warmer`, `Wider`)
 * strictly clamped inside the safe sweet-spot manifold `[0.15, 0.95]` so patches never clip, alias, or go silent.
 */

export const SEED_BRANCHES = [
  { id: "brighter", label: "Brighter", icon: "sun" },
  { id: "warmer", label: "Warmer", icon: "feather" },
  { id: "wider", label: "Wider", icon: "cloud" },
];

const clampSafe = (v) => Number(Math.max(0.15, Math.min(0.95, Number(v) || 0.5)).toFixed(3));

export function defaultSoundSeed() {
  return {
    id: "seed-0",
    branch: null,
    brightness: 0.5,
    warmth: 0.5,
    width: 0.5,
    generation: 0,
  };
}

/** Generate the 3 child sound seeds (`brighter`, `warmer`, `wider`) from `parentSeed`. */
export function breedSoundSeeds(parentSeed = null) {
  const p = parentSeed && typeof parentSeed === "object" ? parentSeed : defaultSoundSeed();
  const gen = Math.trunc(Number(p.generation || 0)) + 1;
  const b = Number(p.brightness ?? 0.5);
  const w = Number(p.warmth ?? 0.5);
  const d = Number(p.width ?? 0.5);
  return {
    brighter: {
      id: `seed-${gen}-brighter`,
      branch: "brighter",
      brightness: clampSafe(b + 0.22),
      warmth: clampSafe(w - 0.08),
      width: clampSafe(d + 0.05),
      generation: gen,
    },
    warmer: {
      id: `seed-${gen}-warmer`,
      branch: "warmer",
      brightness: clampSafe(b - 0.14),
      warmth: clampSafe(w + 0.22),
      width: clampSafe(d + 0.04),
      generation: gen,
    },
    wider: {
      id: `seed-${gen}-wider`,
      branch: "wider",
      brightness: clampSafe(b + 0.05),
      warmth: clampSafe(w + 0.05),
      width: clampSafe(d + 0.25),
      generation: gen,
    },
  };
}

/** Pick and plant one of the 3 branches (`"brighter" | "warmer" | "wider"`). */
export function applySoundBranch(parentSeed, branchId) {
  const children = breedSoundSeeds(parentSeed);
  return children[branchId] || children.brighter;
}
