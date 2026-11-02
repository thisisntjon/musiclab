/**
 * Plain-language check for T5 (9c-2): every kid-facing prompt reads at grade 2 or below.
 * Flesch-Kincaid grade = 0.39 × (words / sentences) + 11.8 × (syllables / words) − 15.59, the formula the
 * inclusion audit used (workflow/research/inclusion-wave/iw4-app-inclusion-audit.md, section 1). The syllable
 * counter is a heuristic, good to about ±1 grade, so the bar is checked per prompt rather than averaged away.
 */
export const MAX_GRADE = 2;

export function syllables(word) {
  let w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function words(text) {
  return String(text)
    .replace(/[0-9]+(?:[–-][0-9]+)?/g, "one") // numbers are read as a short word
    .split(/[^A-Za-z']+/)
    .filter(Boolean);
}

export function sentences(text) {
  return String(text)
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

export function fkGrade(text) {
  const ws = words(text);
  if (ws.length === 0) return 0;
  const ss = Math.max(1, sentences(text).length);
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (ws.length / ss) + 11.8 * (syl / ws.length) - 15.59;
}

/** Grade of the hardest sentence in a prompt (one long sentence must not hide behind short ones). */
export function hardestSentenceGrade(text) {
  return Math.max(0, ...sentences(text).map(fkGrade));
}

/** Below this many words a sentence is a label, and the formula says nothing useful ("Undone." scores 8.4). */
export const MIN_WORDS_FOR_GRADE = 4;
export const MAX_SYLLABLES_IN_SHORT = 3;

/**
 * T5 rule for one prompt: each sentence of 4 or more words reads at grade 2 or below; a shorter sentence
 * uses no word longer than 3 syllables.
 */
export function checkPrompt(text) {
  const problems = [];
  for (const s of sentences(text)) {
    const ws = words(s);
    if (ws.length >= MIN_WORDS_FOR_GRADE) {
      const g = fkGrade(s);
      if (g > MAX_GRADE) problems.push({ sentence: s, grade: Math.round(g * 10) / 10 });
    } else {
      const long = ws.filter((w) => syllables(w) > MAX_SYLLABLES_IN_SHORT);
      if (long.length) problems.push({ sentence: s, long_words: long });
    }
  }
  return { ok: problems.length === 0, problems };
}
