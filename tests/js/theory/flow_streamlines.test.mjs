import test from "node:test";
import assert from "node:assert/strict";

import {
  catmullRomToBezierPath,
  buildSuggestionTendrilPath,
  buildPointerWakePath,
  buildBeatStreamSvg,
  buildEndingCadenceCurve,
  buildTuneStreamSvg,
  buildUnderneathRiverSvg,
  buildSongBraidedRiverSvg,
} from "../../../static/js/theory/flow_streamlines.js";

test("catmullRomToBezierPath generates smooth cubic Bezier segments through placed points", () => {
  assert.equal(catmullRomToBezierPath([]), "");
  const single = catmullRomToBezierPath([{ x: 10, y: 20 }]);
  assert.match(single, /^M 10\.00 20\.00 L 10\.01 20\.00$/);

  const curve = catmullRomToBezierPath([
    { x: 100, y: 200 },
    { x: 200, y: 150 },
    { x: 300, y: 180 },
  ]);
  assert.match(curve, /^M 100\.00 200\.00 C /);
  assert.ok(curve.includes("200.00 150.00"));
  assert.ok(curve.endsWith("300.00 180.00"));
});

test("buildSuggestionTendrilPath curves upward for up ideas and downward for down ideas", () => {
  const up = buildSuggestionTendrilPath({ x: 100, y: 120 }, { x: 180, y: 80 }, "up");
  const down = buildSuggestionTendrilPath({ x: 100, y: 120 }, { x: 180, y: 160 }, "down");
  assert.match(up, /^M 100\.00 120\.00 C 135\.20 98\.00/);
  assert.match(down, /^M 100\.00 120\.00 C 135\.20 142\.00/);
});

test("buildPointerWakePath produces a quadratic spline for swipe-through-water trails", () => {
  assert.equal(buildPointerWakePath([{ x: 10, y: 10 }]), "");
  const wake = buildPointerWakePath([
    { x: 10, y: 20 },
    { x: 40, y: 35 },
    { x: 80, y: 25 },
  ]);
  assert.match(wake, /^M 10\.00 20\.00 Q 40\.00 35\.00, 60\.00 30\.00 L 80\.00 25\.00$/);
});

test("buildBeatStreamSvg connects active drum pads across lanes and groove", () => {
  const beatGrid = {
    kick: ["user_placed", null, null, null, "user_placed", null, null, null],
    clap: [null, null, "user_placed", null, null, null, "user_placed", null],
    hat: ["seed_template", null, "seed_template", null, "seed_template", null, "seed_template", null],
  };
  const svg = buildBeatStreamSvg(beatGrid);
  assert.ok(svg.includes('class="pf-flow-svg pf-beat-flow-svg"'));
  assert.ok(svg.includes("pf-stream-kick"));
  assert.ok(svg.includes("pf-stream-clap"));
  assert.ok(svg.includes("pf-stream-hat"));
  assert.ok(svg.includes("pf-stream-current"));
});

test("buildTuneStreamSvg renders melodic spline, sustain bridge, swirling idea tendrils, and cadence curves", () => {
  const activeCells = Array(16).fill(null);
  activeCells[0] = { midi: 60, provenance: "user_placed", duration_steps: 4 };
  activeCells[2] = { midi: 64, provenance: "user_placed", duration_steps: 2 };
  activeCells[4] = { midi: 67, provenance: "user_placed", duration_steps: 2 };

  const ghostCells = Array(16).fill(null);
  ghostCells[0] = { midi: 60 };
  ghostCells[4] = { midi: 62 };

  const svg = buildTuneStreamSvg({
    activeCells,
    rows: [72, 69, 67, 64, 62, 60],
    cols: [0, 1, 2, 3, 4, 5, 6, 7],
    ideas: [
      { col: 5, midi: 69, kind: "up" },
      { col: 5, midi: 60, kind: "home" },
    ],
    lastTuneCol: 4,
    decorator: "sparkle",
    tuneTab: "ending",
    endingShape: "fall",
    ghostCells,
    feel: "warm",
    homeMidi: 60,
  });

  assert.ok(svg.includes("pf-stream-under-wave"));
  assert.ok(svg.includes("pf-stream-cadence"));
  assert.ok(svg.includes("pf-stream-ghost"));
  assert.ok(svg.includes("pf-stream-sustain"));
  assert.ok(svg.includes("pf-stream-melody"));
  assert.ok(svg.includes("pf-stream-sparkle"));
  assert.ok(svg.includes("pf-stream-tendril"));
  assert.ok(buildEndingCadenceCurve("climb", { width: 800, height: 300 }).startsWith("M "));
  assert.ok(buildEndingCadenceCurve("breathe", { width: 800, height: 300 }).startsWith("M "));
});

test("buildUnderneathRiverSvg and buildSongBraidedRiverSvg render multi-layer water visualizations", () => {
  const doc = {
    underneath: { feel: "floating", chords: 0, bass: "walk", harmonyStyle: "wide_echo" },
  };
  const tuneGrid = {
    main: [{ midi: 60 }, null, { midi: 64 }, null, { midi: 67 }, null, null, null],
    ending: [{ midi: 64 }, null, { midi: 60 }, null, null, null, null, null],
  };
  const underSvg = buildUnderneathRiverSvg(doc, tuneGrid);
  assert.ok(underSvg.includes("pf-under-river-svg"));
  assert.ok(underSvg.includes("pf-river-chord-echo"));
  assert.ok(underSvg.includes("pf-river-bass-dot"));
  assert.ok(underSvg.includes("pf-river-melody"));

  const songSvg = buildSongBraidedRiverSvg([
    { beat: true, tune: true, under: false, big: false },
    { beat: true, tune: true, under: true, big: true },
  ]);
  assert.ok(songSvg.includes("pf-song-river-svg"));
  assert.ok(songSvg.includes("pf-song-stream-beat"));
  assert.ok(songSvg.includes("pf-song-stream-tune"));
  assert.ok(songSvg.includes("pf-song-stream-under"));
});
