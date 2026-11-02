/**
 * The one colour and shape table for the parts of a song (workflow/research/visual-wave/SYNTHESIS.md).
 * The five colours stay apart under all three kinds of colour blindness (checked by simulation), and every part
 * also has its own shape, so meaning never rests on colour alone. No saturated red. CSS mirrors these as --pf-part-*.
 */
export const PART_COLORS = Object.freeze({
  boom: "#FF8A00", // round: a soft, low drum
  clap: "#FF2BD6", // spiky star: a sharp sound
  tick: "#FFE600", // small diamond: a tiny bright sound
  tune: "#00E5FF", // round drop; higher notes are lighter
  under: "#F2F2F2", // wide soft band
});

export const PART_SHAPES = Object.freeze({ boom: "round", clap: "star", tick: "diamond", tune: "drop", under: "band" });

const LANE_TO_PART = { kick: "boom", clap: "clap", hat: "tick", tune: "tune", lead: "tune", under: "under" };

export function partOf(laneOrRole) {
  return LANE_TO_PART[laneOrRole] || "under";
}

/** The ball lands on every beat up to 120 per minute and every second beat above (bouncing-ball sync held to 120). */
export function beatsPerBounce(bpm) {
  return Number(bpm) > 120 ? 2 : 1;
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.3.1 "saturated red": red share of R+G+B at 0.8 or more. */
export function isSaturatedRed(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const sum = r + ((n >> 8) & 255) + (n & 255);
  return sum > 0 && r / sum >= 0.8;
}
