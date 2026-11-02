/**
 * Pure geometry and SVG streamline generators for the Water-Flow Visual Music canvas.
 *
 * Zero DOM dependencies so all spline, tendril, cadence, harmonic-river, and
 * song-braid calculations are deterministic and unit-testable in Node.
 */

const fmt = (n) => Number(n || 0).toFixed(2);

/**
 * Convert an ordered array of `{ x, y }` points into a smooth cubic Bezier SVG path
 * using centripetal/cardinal Catmull-Rom tangents.
 *
 * @param {Array<{x: number, y: number}>} points
 * @param {{ tension?: number, bounceLift?: number, verticalOffset?: number }} [opts]
 * @returns {string} SVG path `d` attribute
 */
export function catmullRomToBezierPath(points, opts = {}) {
  if (!Array.isArray(points) || points.length === 0) return "";
  const tau = Number.isFinite(opts.tension) ? opts.tension : 0.5;
  const lift = Number.isFinite(opts.bounceLift) ? opts.bounceLift : 0;
  const dyOff = Number.isFinite(opts.verticalOffset) ? opts.verticalOffset : 0;
  const pts = points.map((p) => ({ x: Number(p.x) || 0, y: (Number(p.y) || 0) + dyOff }));
  if (pts.length === 1) {
    const p = pts[0];
    return `M ${fmt(p.x)} ${fmt(p.y)} L ${fmt(p.x + 0.01)} ${fmt(p.y)}`;
  }
  const ext = [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1];
    const p1 = ext[i];
    const p2 = ext[i + 1];
    const p3 = ext[i + 2];
    const c1x = p1.x + ((p2.x - p0.x) * tau) / 3;
    const c1y = p1.y + ((p2.y - p0.y) * tau) / 3 - lift;
    const c2x = p2.x - ((p3.x - p1.x) * tau) / 3;
    const c2y = p2.y - ((p3.y - p1.y) * tau) / 3 - lift;
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

/**
 * Build a swirling cubic Bezier guide tendril from the last placed note to a
 * suggested Ghost Spark (`.idea`) dot.
 *
 * @param {{x: number, y: number}} src
 * @param {{x: number, y: number}} dst
 * @param {string} [kind="step"] - "up" | "down" | "home" | "repeat" | "step"
 * @returns {string} SVG path `d` attribute
 */
export function buildSuggestionTendrilPath(src, dst, kind = "step") {
  if (!src || !dst) return "";
  const sx = Number(src.x) || 0;
  const sy = Number(src.y) || 0;
  const tx = Number(dst.x) || 0;
  const ty = Number(dst.y) || 0;
  const dx = tx - sx;
  const dy = ty - sy;
  let swirl = 0;
  if (kind === "up") swirl = -22;
  else if (kind === "down") swirl = 22;
  else if (kind === "home") swirl = dy >= 0 ? 18 : -18;
  else if (kind === "repeat") swirl = -14;
  else swirl = dy >= 0 ? 15 : -15;

  const c1x = sx + dx * 0.44;
  const c1y = sy + swirl;
  const c2x = sx + dx * 0.68;
  const c2y = ty - swirl * 0.42;
  return `M ${fmt(sx)} ${fmt(sy)} C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(tx)} ${fmt(ty)}`;
}

/**
 * Build a smooth quadratic spline path for the ephemeral swipe-through-water pointer wake.
 *
 * @param {Array<{x: number, y: number}>} points
 * @returns {string}
 */
export function buildPointerWakePath(points) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const pts = points.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${fmt(pts[i].x)} ${fmt(pts[i].y)}, ${fmt(midX)} ${fmt(midY)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

/**
 * Build the Stage 1 (Beat) water-wave SVG connecting active drum pads per lane
 * and across the groove.
 *
 * @param {{ kick?: Array, clap?: Array, hat?: Array }} beatGrid
 * @param {{ width?: number, height?: number, padCenters?: Map<string, {x: number, y: number}>, bpm?: number, lessMotion?: boolean }} [opts]
 * @returns {string} SVG markup string
 */
export function buildBeatStreamSvg(beatGrid, opts = {}) {
  const width = opts.width || 800;
  const height = opts.height || 192;
  const padCenters = opts.padCenters || null;
  const lanes = ["kick", "clap", "hat"];
  const laneStroke = {
    kick: "rgba(255, 138, 0, 0.55)",
    clap: "rgba(255, 43, 214, 0.55)",
    hat: "rgba(255, 230, 0, 0.55)",
  };
  const laneGlow = {
    kick: "rgba(255, 138, 0, 0.20)",
    clap: "rgba(255, 43, 214, 0.20)",
    hat: "rgba(255, 230, 0, 0.20)",
  };

  const centerFor = (laneIdx, laneId, step) => {
    const key = `pad:${laneId}:${step}`;
    if (padCenters && padCenters.has(key)) return padCenters.get(key);
    const padLeft = 118;
    const usableW = Math.max(200, width - padLeft - 16);
    const colW = usableW / 8;
    const rowH = height / 3;
    return {
      x: padLeft + (step + 0.5) * colW,
      y: (laneIdx + 0.5) * rowH,
    };
  };

  const paths = [];
  const allPulsePts = [];

  lanes.forEach((laneId, laneIdx) => {
    const row = beatGrid?.[laneId] || [];
    const pts = [];
    for (let s = 0; s < row.length; s++) {
      if (row[s]) {
        const pt = centerFor(laneIdx, laneId, s);
        pts.push(pt);
        allPulsePts.push({ ...pt, step: s, laneIdx });
      }
    }
    if (pts.length >= 2) {
      const d = catmullRomToBezierPath(pts, { tension: 0.45, bounceLift: laneId === "hat" ? 6 : 0 });
      paths.push(
        `<path class="pf-stream-glow" d="${d}" stroke="${laneGlow[laneId]}" stroke-width="8" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
        `<path class="pf-stream-lane pf-stream-${laneId}" d="${d}" stroke="${laneStroke[laneId]}" stroke-width="2.5" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
      );
    }
  });

  allPulsePts.sort((a, b) => a.step - b.step || a.laneIdx - b.laneIdx);
  if (allPulsePts.length >= 2) {
    const grooveD = catmullRomToBezierPath(allPulsePts, { tension: 0.55 });
    paths.push(
      `<path class="pf-stream-current" d="${grooveD}" stroke="rgba(125, 211, 252, 0.38)" stroke-width="1.75" stroke-dasharray="8 12" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    );
  }

  return `<svg class="pf-flow-svg pf-beat-flow-svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${paths.join("")}</svg>`;
}

/**
 * Build a Bar-4 cadence guide curve showing the directional pull of "Leave space" (`breathe`),
 * "Climb up" (`climb`), or "Answer home" (`fall`).
 *
 * @param {string|null} shapeId
 * @param {{ width: number, height: number, padLeft?: number, homeY?: number }} geom
 * @returns {string} SVG path `d` attribute
 */
export function buildEndingCadenceCurve(shapeId, geom) {
  if (!shapeId) return "";
  const w = geom.width || 800;
  const h = geom.height || 320;
  const x0 = geom.padLeft ?? 118;
  const x1 = w - 20;
  const midY = h * 0.52;
  const homeY = Number.isFinite(geom.homeY) ? geom.homeY : h * 0.62;

  if (shapeId === "climb") {
    const topY = Math.max(24, h * 0.16);
    return `M ${fmt(x0)} ${fmt(midY)} C ${fmt(x0 + (x1 - x0) * 0.45)} ${fmt(midY)}, ${fmt(x0 + (x1 - x0) * 0.72)} ${fmt(topY + 18)}, ${fmt(x1)} ${fmt(topY)}`;
  }
  if (shapeId === "fall") {
    return `M ${fmt(x0)} ${fmt(h * 0.34)} C ${fmt(x0 + (x1 - x0) * 0.42)} ${fmt(h * 0.38)}, ${fmt(x0 + (x1 - x0) * 0.7)} ${fmt(homeY)}, ${fmt(x1)} ${fmt(homeY)}`;
  }
  if (shapeId === "breathe") {
    const stopX = x0 + (x1 - x0) * 0.55;
    return `M ${fmt(x0)} ${fmt(midY)} Q ${fmt(x0 + (stopX - x0) * 0.5)} ${fmt(midY - 14)}, ${fmt(stopX)} ${fmt(midY)}`;
  }
  return "";
}

/**
 * Build the Stage 2 (Tune) water-flow SVG containing:
 * 1. Harmonic under-current swells (when a Feel is chosen)
 * 2. Bar-4 cadence guide curve & parallel ghost ending trace
 * 3. Sustained-note water bridges (`.held-tail`)
 * 4. Centripetal Catmull-Rom melodic contour spline (modulated by `decorator`)
 * 5. Swirling cubic Bezier guide tendrils from the last note to `.idea` Ghost Sparks
 *
 * @param {object} params
 * @returns {string} SVG markup string
 */
export function buildTuneStreamSvg(params = {}) {
  const activeCells = params.activeCells || [];
  const rows = params.rows || [];
  const cols = params.cols || [0, 1, 2, 3, 4, 5, 6, 7];
  const ideas = params.ideas || [];
  const lastTuneCol = params.lastTuneCol ?? null;
  const decorator = params.decorator || null;
  const tuneTab = params.tuneTab || "main";
  const endingShape = params.endingShape || null;
  const ghostCells = params.ghostCells || null;
  const feel = params.feel || null;
  const homeMidi = params.homeMidi ?? null;
  const padCenters = params.padCenters || null;
  const width = params.width || 800;
  const height = params.height || Math.max(220, rows.length * 54);
  const padLeft = params.padLeft ?? 118;

  const colCount = Math.max(1, cols.length);
  const rowCount = Math.max(1, rows.length);
  const usableW = Math.max(200, width - padLeft - 16);
  const colW = usableW / colCount;
  const rowH = height / rowCount;

  const centerFor = (col, midi) => {
    const key = `note:${col}:${midi}`;
    if (padCenters && padCenters.has(key)) return padCenters.get(key);
    const cIdx = cols.indexOf(col);
    const rIdx = rows.indexOf(midi);
    if (cIdx < 0 || rIdx < 0) return null;
    return {
      x: padLeft + (cIdx + 0.5) * colW,
      y: (rIdx + 0.5) * rowH,
    };
  };

  const parts = [];

  // 1. Ambient harmonic under-current waves when a Feel is active
  if (feel) {
    const waveY1 = height * 0.76;
    const waveY2 = height * 0.88;
    const xStart = padLeft;
    const xEnd = width - 16;
    const midX = (xStart + xEnd) / 2;
    const amp = feel === "driving" ? 18 : feel === "floating" ? 24 : 12;
    const color =
      feel === "driving"
        ? "rgba(56, 189, 248, 0.20)"
        : feel === "floating"
          ? "rgba(167, 139, 250, 0.22)"
          : "rgba(52, 211, 153, 0.20)";
    const d1 = `M ${fmt(xStart)} ${fmt(waveY1)} Q ${fmt((xStart + midX) / 2)} ${fmt(waveY1 - amp)}, ${fmt(midX)} ${fmt(waveY1)} T ${fmt(xEnd)} ${fmt(waveY1)}`;
    const d2 = `M ${fmt(xStart)} ${fmt(waveY2)} Q ${fmt((xStart + midX) / 2)} ${fmt(waveY2 + amp * 0.8)}, ${fmt(midX)} ${fmt(waveY2)} T ${fmt(xEnd)} ${fmt(waveY2)}`;
    parts.push(
      `<path class="pf-stream-under-wave" d="${d1}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
      `<path class="pf-stream-under-wave" d="${d2}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    );
  }

  // 2. Bar-4 Cadence Guide Curve & Parallel Ghost Ending Stream
  if (tuneTab === "ending" && endingShape) {
    const homeCenter = homeMidi !== null ? centerFor(cols[cols.length - 1], homeMidi) : null;
    const cadD = buildEndingCadenceCurve(endingShape, {
      width,
      height,
      padLeft,
      homeY: homeCenter ? homeCenter.y : height * 0.6,
    });
    if (cadD) {
      parts.push(
        `<path class="pf-stream-cadence" d="${cadD}" stroke="rgba(52, 211, 153, 0.28)" stroke-width="6" stroke-dasharray="10 8" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
      );
    }
  }

  if (tuneTab === "ending" && Array.isArray(ghostCells)) {
    const ghostPts = [];
    for (const col of cols) {
      const cell = ghostCells[col];
      if (cell && Number.isFinite(cell.midi)) {
        const pt = centerFor(col, cell.midi);
        if (pt) ghostPts.push(pt);
      }
    }
    if (ghostPts.length >= 2) {
      const ghostD = catmullRomToBezierPath(ghostPts, { tension: 0.5 });
      parts.push(
        `<path class="pf-stream-ghost" d="${ghostD}" stroke="rgba(148, 163, 184, 0.30)" stroke-width="2.5" stroke-dasharray="5 7" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
      );
    }
  }

  // 3. Collect placed melody points and sustained-note bridges on visible columns
  const placedPts = [];
  for (const col of cols) {
    const cell = activeCells[col];
    if (!cell || !Number.isFinite(cell.midi)) continue;
    const pt = centerFor(col, cell.midi);
    if (!pt) continue;
    placedPts.push({ ...pt, col, midi: cell.midi });

    const durCols = Math.max(1, Math.round(Number(cell.duration_steps || 2) / 2));
    if (durCols > 1) {
      const endCol = Math.min(cols[cols.length - 1], col + durCols - 1);
      const endPt = centerFor(endCol, cell.midi);
      if (endPt && endPt.x > pt.x) {
        parts.push(
          `<path class="pf-stream-sustain" d="M ${fmt(pt.x)} ${fmt(pt.y)} L ${fmt(endPt.x)} ${fmt(endPt.y)}" stroke="rgba(0, 229, 255, 0.42)" stroke-width="10" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
        );
      }
    }
  }

  // 4. Main Melodic Catmull-Rom Streamline
  if (placedPts.length >= 2) {
    const tension = decorator === "slide" ? 0.68 : 0.5;
    const bounceLift = decorator === "bounce" ? 16 : 0;
    const strokeW = decorator === "slide" ? "4.5" : "3";
    const mainD = catmullRomToBezierPath(placedPts, { tension, bounceLift });
    parts.push(
      `<path class="pf-stream-glow" d="${mainD}" stroke="rgba(0, 229, 255, 0.24)" stroke-width="10" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
      `<path class="pf-stream-melody" d="${mainD}" stroke="rgba(0, 229, 255, 0.82)" stroke-width="${strokeW}" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
      `<path class="pf-stream-current" d="${mainD}" stroke="rgba(200, 250, 255, 0.78)" stroke-width="1.8" stroke-dasharray="8 12" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    );
    if (decorator === "sparkle") {
      const shimmerD = catmullRomToBezierPath(placedPts, { tension: 0.55, verticalOffset: -7 });
      parts.push(
        `<path class="pf-stream-sparkle" d="${shimmerD}" stroke="rgba(110, 231, 183, 0.65)" stroke-width="1.6" stroke-dasharray="4 6" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
      );
    }
  }

  // 5. Swirling Guide Tendrils from the latest placed note to `.idea` Ghost Sparks
  if (ideas.length > 0 && placedPts.length > 0) {
    let srcPt = placedPts.find((p) => p.col === lastTuneCol) || null;
    if (!srcPt) {
      const firstIdeaCol = ideas[0].col;
      const before = placedPts.filter((p) => p.col < firstIdeaCol);
      srcPt = before.length > 0 ? before[before.length - 1] : placedPts[placedPts.length - 1];
    }
    if (srcPt) {
      for (const idea of ideas) {
        const dstPt = centerFor(idea.col, idea.midi);
        if (!dstPt) continue;
        const tendrilD = buildSuggestionTendrilPath(srcPt, dstPt, idea.kind || "step");
        parts.push(
          `<path class="pf-stream-tendril-glow" d="${tendrilD}" stroke="rgba(0, 229, 255, 0.10)" stroke-width="7" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
          `<path class="pf-stream-tendril" d="${tendrilD}" stroke="rgba(0, 229, 255, 0.5)" stroke-width="2.2" stroke-dasharray="6 7" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
        );
      }
    }
  }

  return `<svg class="pf-flow-svg pf-tune-flow-svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
}

/**
 * Build the Stage 3 ("3. What goes under it") 3-Layer Laminar Harmonic River SVG.
 * Visualizes:
 * - Surface layer (Gold): User's melody contour dots & spline
 * - Middle layer (Cyan/Violet): 4-bar chord swells shaped by Feel & Harmony Style
 * - Deep layer (Emerald): Bass current nodes (Kick-locked, Answer-my-tune gap hocket, or Long low notes)
 *
 * @param {object} doc
 * @param {{ main?: Array, ending?: Array }} tuneGrid
 * @returns {string} SVG markup string
 */
export function buildUnderneathRiverSvg(doc, tuneGrid = {}) {
  const width = 760;
  const height = 112;
  const u = doc?.underneath || { feel: null, chords: null, bass: null };
  const feel = u.feel || null;
  const bassStyle = u.bass || "lock";
  const hStyle = u.harmony_style || u.harmonyStyle || "hold";

  const mainCells = tuneGrid?.main || [];
  const endCells = tuneGrid?.ending || mainCells;
  const melodyPts = [];
  const occupiedCols = new Set();

  for (let bar = 0; bar < 4; bar++) {
    const src = bar === 3 ? endCells : mainCells;
    for (let c = 0; c < 8; c++) {
      const cell = src[c];
      if (cell && Number.isFinite(cell.midi)) {
        const globalCol = bar * 8 + c;
        occupiedCols.add(globalCol);
        const x = 24 + (globalCol / 31) * (width - 48);
        const normPitch = Math.max(0, Math.min(1, (cell.midi - 55) / 24));
        const y = 42 - normPitch * 26;
        melodyPts.push({ x, y });
      }
    }
  }

  const layers = [];

  // 1. Middle Harmonic Swell Layer
  if (feel) {
    const swellColor =
      feel === "driving"
        ? "rgba(56, 189, 248, 0.48)"
        : feel === "floating"
          ? "rgba(167, 139, 250, 0.50)"
          : "rgba(52, 211, 153, 0.46)";
    const chordPts = [];
    const steps = hStyle === "ripple" ? 16 : 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 20 + t * (width - 40);
      const amp = hStyle === "ripple" ? 10 : feel === "floating" ? 12 : 7;
      const y = 64 + Math.sin(t * Math.PI * (hStyle === "ripple" ? 8 : 4)) * amp;
      chordPts.push({ x, y });
    }
    const chordD = catmullRomToBezierPath(chordPts, { tension: 0.5 });
    layers.push(
      `<path class="pf-river-chord-glow" d="${chordD}" stroke="${swellColor}" stroke-width="12" opacity="0.28" fill="none" stroke-linecap="round"/>`,
      `<path class="pf-river-chord" d="${chordD}" stroke="${swellColor}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    );
    if (hStyle === "wide_echo") {
      const echoD = catmullRomToBezierPath(chordPts, { tension: 0.5, verticalOffset: 9 });
      layers.push(
        `<path class="pf-river-chord-echo" d="${echoD}" stroke="rgba(125, 211, 252, 0.42)" stroke-width="2" stroke-dasharray="6 6" fill="none" stroke-linecap="round"/>`
      );
    }
  } else {
    layers.push(
      `<path class="pf-river-calm" d="M 20 66 Q ${width / 2} 62, ${width - 20} 66" stroke="rgba(148, 163, 184, 0.22)" stroke-width="2" stroke-dasharray="6 8" fill="none"/>`
    );
  }

  // 2. Deep Bass Current Layer
  if (feel) {
    const bassDots = [];
    for (let g = 0; g < 16; g++) {
      const col32 = g * 2;
      const isGap = !occupiedCols.has(col32);
      const active =
        bassStyle === "drone"
          ? g % 4 === 0
          : bassStyle === "walk"
            ? isGap || g % 4 === 0
            : g % 2 === 0;
      if (active) {
        const x = 24 + (col32 / 31) * (width - 48);
        const y = bassStyle === "walk" && isGap ? 84 : 94;
        const r = bassStyle === "drone" ? 5 : 3.5;
        bassDots.push(
          `<circle class="pf-river-bass-dot" cx="${fmt(x)}" cy="${fmt(y)}" r="${r}" fill="rgba(242, 242, 242, 0.78)"/>`
        );
      }
    }
    layers.push(...bassDots);
  }

  // 3. Surface Melody Stream Layer
  if (melodyPts.length >= 2) {
    const melD = catmullRomToBezierPath(melodyPts, { tension: 0.5 });
    layers.push(
      `<path class="pf-river-melody" d="${melD}" stroke="rgba(0, 229, 255, 0.85)" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    );
  }
  for (const pt of melodyPts) {
    layers.push(
      `<circle class="pf-river-melody-dot" cx="${fmt(pt.x)}" cy="${fmt(pt.y)}" r="3.8" fill="#00e5ff"/>`
    );
  }

  return `<div class="pf-water-river" aria-hidden="true"><svg class="pf-under-river-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" focusable="false">${layers.join("")}</svg></div>`;
}

/**
 * Build the Stage 4 ("4. Build your song") Multi-Stream Braided River SVG across Song Cards.
 * Shows Beat (amber-coral), Tune (gold), and Under (cyan-emerald) currents flowing across parts,
 * pinching when a layer is switched off and swelling on `Big part`.
 *
 * @param {Array<{beat?: boolean, tune?: boolean, under?: boolean, big?: boolean, fx?: string|null}>} cards
 * @returns {string} SVG markup string
 */
export function buildSongBraidedRiverSvg(cards = []) {
  if (!Array.isArray(cards) || cards.length === 0) return "";
  const width = 760;
  const height = 84;
  const n = cards.length;
  const segW = (width - 40) / n;

  const streamDefs = [
    { key: "beat", baseY: 22, color: "rgba(255, 138, 0, 0.82)", glow: "rgba(255, 138, 0, 0.22)" },
    { key: "tune", baseY: 42, color: "rgba(0, 229, 255, 0.90)", glow: "rgba(0, 229, 255, 0.25)" },
    { key: "under", baseY: 62, color: "rgba(242, 242, 242, 0.82)", glow: "rgba(242, 242, 242, 0.22)" },
  ];

  const els = [];
  for (const s of streamDefs) {
    const pts = [];
    cards.forEach((card, idx) => {
      const xStart = 20 + idx * segW;
      const xMid = xStart + segW * 0.5;
      const xEnd = xStart + segW;
      const on = Boolean(card?.[s.key]);
      const big = Boolean(card?.big);
      const lift = on ? (big ? -5 : 0) : 6;
      pts.push({ x: xStart + 4, y: s.baseY + lift });
      pts.push({ x: xMid, y: s.baseY + (on ? (big ? -8 : -3) : 6) });
      pts.push({ x: xEnd - 4, y: s.baseY + lift });

      if (on) {
        els.push(
          `<circle cx="${fmt(xMid)}" cy="${fmt(s.baseY + (big ? -8 : -3))}" r="${big ? 5 : 3.6}" fill="${s.color}"/>`
        );
      }
    });
    const d = catmullRomToBezierPath(pts, { tension: 0.48 });
    const anyOn = cards.some((c) => Boolean(c?.[s.key]));
    els.push(
      `<path class="pf-song-stream-glow" d="${d}" stroke="${s.glow}" stroke-width="${anyOn ? 8 : 2}" fill="none" stroke-linecap="round"/>`,
      `<path class="pf-song-stream pf-song-stream-${s.key}" d="${d}" stroke="${s.color}" stroke-width="${anyOn ? 2.6 : 1.2}" stroke-dasharray="${anyOn ? "none" : "4 6"}" fill="none" stroke-linecap="round"/>`
    );
  }

  return `<div class="pf-water-river pf-song-river" aria-hidden="true"><svg class="pf-song-river-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" focusable="false">${els.join("")}</svg></div>`;
}
