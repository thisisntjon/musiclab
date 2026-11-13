import {
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
  SCORE_LEFT,
  SCORE_RIGHT,
  LANE_BOUNDS,
  buildLiveScoreModel,
  computeLiveScoreFrame,
} from "../js/theory/live_score_model.js";

function escAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function diamondPoints(cx, cy, rx, ry) {
  return `${cx.toFixed(1)},${(cy - ry).toFixed(1)} ${(cx + rx).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(cy + ry).toFixed(1)} ${(cx - rx).toFixed(1)},${cy.toFixed(1)}`;
}

function starPoints(cx, cy, outerR = 4.8, innerR = 2.1) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Detect Calm mode (`#btn-calm` / `pf-less-motion`), `prefers-reduced-motion`, or `forced-colors`. */
export function isCalmVisuals(explicitLessMotion = false) {
  if (explicitLessMotion) return true;
  const body = globalThis.document?.body;
  if (body?.classList?.contains?.("pf-less-motion") || body?.dataset?.calm === "true") {
    return true;
  }
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
  if (globalThis.matchMedia?.("(forced-colors: active)")?.matches) return true;
  return false;
}

/** Extract recent live personal (`user_placed`) notes from `scheduler.performanceTake` + `liveNotes`. */
export function extractLivePersonalEvents(
  scheduler,
  { totalSteps = 64, bpm = 100, originTime = null } = {}
) {
  if (!scheduler) return [];
  const stepSec = 15 / Math.max(30, Number(bpm) || 100);
  const out = [];
  const take = scheduler.performanceTake;
  if (take && Array.isArray(take.events) && Number.isFinite(take.start)) {
    const origin = Number.isFinite(originTime)
      ? originTime
      : Number.isFinite(scheduler.gridOriginTime)
        ? scheduler.gridOriginTime
        : take.start;
    const now = Number(scheduler.audioCtx?.currentTime ?? take.start);
    const windowSec = totalSteps * stepSec;
    const cutoff = now - windowSec;
    const recent = take.events.slice(-48);
    for (let i = 0; i < recent.length; i++) {
      const rec = recent[i];
      const ev = rec?.event;
      if (!ev || ev.provenance !== "user_placed") continue;
      if (!Number.isFinite(rec.time) || rec.time + (rec.duration || 0.25) < cutoff) continue;
      const rawStep = (rec.time - origin) / stepSec;
      const wrappedStep = ((rawStep % totalSteps) + totalSteps) % totalSteps;
      const baseStep = Math.floor(wrappedStep);
      const offsetSteps = wrappedStep - baseStep;
      const durSteps = Math.max(0.5, (Number(rec.duration) || 0.25) / stepSec);
      out.push({
        id: ev.id || `live-own-${rec.occurrence || i}`,
        role: ev.role || "lead",
        patch_id: ev.patch_id || "warm_keys",
        provenance: "user_placed",
        step: baseStep,
        duration_steps: durSteps,
        velocity: ev.velocity ?? 0.85,
        concrete: ev.concrete || { midi_pitch: 64 },
        performance: { version: 1, offset_steps: offsetSteps },
      });
    }
  }
  return out;
}

/** Render inner SVG markup for a `buildLiveScoreModel` result. */
export function renderLiveScoreInnerSvg(
  model,
  { includeMfAttrs = false, showLaneLabels = true } = {}
) {
  const laneDividers = [LANE_BOUNDS.chords.top - 3, LANE_BOUNDS.bass.top - 3, LANE_BOUNDS.drums.top - 3]
    .map(
      (y) =>
        `<line class="pf-vis-lane-line" x1="${SCORE_LEFT}" x2="${SCORE_RIGHT}" y1="${y}" y2="${y}" />`
    )
    .join("");

  const labels = showLaneLabels
    ? Object.values(LANE_BOUNDS)
        .filter((b) => b.label)
        .map(
          (b) =>
            `<text class="pf-vis-lane-label" x="${SCORE_LEFT - 6}" y="${b.labelY + 3}" text-anchor="end">${b.label}</text>`
        )
        .join("")
    : "";

  const barLines = model.bars
    .map(
      (b) =>
        `<line class="pf-vis-barline" x1="${b.x}" x2="${b.x}" y1="${LANE_BOUNDS.tune.top - 2}" y2="${LANE_BOUNDS.drums.bottom + 2}" />`
    )
    .join("");

  const beatMarks = model.beats
    .map(
      (bt) =>
        `<circle class="pf-vis-beat-tick${bt.landing ? " landing" : ""}" cx="${bt.x}" cy="16" r="${bt.landing ? 2.1 : 1.2}" />`
    )
    .join("");

  const renderBackingNote = (n) => {
    const mfAttr = includeMfAttrs && !n.isLiveOverlay ? ` data-mf-note="${n.index}"` : "";
    const common = `data-vis-note="${escAttr(n.id)}"${mfAttr} data-vis-part="${n.part}"`;
    const cls = `pf-vis-note pf-part-${n.part}${n.own ? " own" : ""}`;
    if (n.part === "drums") {
      const cx = n.x + 3.5;
      const cy = n.centerY;
      if (n.drumKind === "boom") {
        return `<circle class="${cls} pf-drum-boom" ${common} cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.1" />`;
      }
      if (n.drumKind === "clap") {
        return `<polygon class="${cls} pf-drum-clap" ${common} points="${starPoints(cx, cy, 4.9, 2.2)}" />`;
      }
      return `<polygon class="${cls} pf-drum-tick" ${common} points="${diamondPoints(cx, cy, 3.8, 3.8)}" />`;
    }
    const rx = n.part === "bass" ? 3.8 : 3;
    return `<rect class="${cls}" ${common} x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${rx}" />`;
  };

  const backingMarkup = `<g class="pf-vis-backing" data-vis-backing data-vis-backing-dim="${model.backingDimState}" style="opacity:${model.backingOpacity}">${model.backingNotes.map(renderBackingNote).join("")}</g>`;

  const ghostMarkup = model.ghostNotes.length
    ? `<g class="pf-vis-ghost-layer" data-vis-ghost="original">${
        model.ghostContourPoints
          ? `<polyline class="pf-vis-ghost-contour" data-vis-ghost-contour fill="none" points="${model.ghostContourPoints}" />`
          : ""
      }${model.ghostNotes
        .map(
          (g) =>
            `<rect class="pf-vis-ghost-note" data-vis-ghost-note x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="3.5" />`
        )
        .join("")}</g>`
    : "";

  const previewMarkup = model.previewNotes.length
    ? `<g class="pf-vis-preview-layer" data-vis-preview="requested">${
        model.previewContourPoints
          ? `<polyline class="pf-vis-preview-contour" data-vis-preview-contour fill="none" points="${model.previewContourPoints}" />`
          : ""
      }${model.previewNotes
        .map(
          (p) =>
            `<rect class="pf-vis-preview-note" data-vis-preview-note x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="3.5" />`
        )
        .join("")}</g>`
    : "";

  const contourMarkup = model.contourPoints
    ? `<polyline class="pf-vis-contour" data-vis-contour fill="none" points="${model.contourPoints}" />`
    : "";

  const leadMarkup = model.leadNotes
    .map((n) => {
      const mfAttr = includeMfAttrs && !n.isLiveOverlay ? ` data-mf-note="${n.index}"` : "";
      const diffCls = n.diff && n.diff !== "same" ? ` pf-vis-diff-${n.diff}` : "";
      return `<rect class="pf-vis-note pf-part-tune${n.own ? " own" : ""}${diffCls}" data-vis-note="${escAttr(n.id)}"${mfAttr} data-vis-part="tune" data-vis-diff="${n.diff || "same"}" x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="4" />`;
    })
    .join("");

  const mfHeadAttr = includeMfAttrs ? " data-mf-playhead" : "";
  return `${barLines}${laneDividers}${labels}${beatMarks}${backingMarkup}<g class="pf-vis-lead-layer" data-vis-lead>${ghostMarkup}${previewMarkup}${contourMarkup}${leadMarkup}</g><line class="pf-vis-playhead" data-vis-playhead${mfHeadAttr} x1="${SCORE_LEFT}" x2="${SCORE_LEFT}" y1="${LANE_BOUNDS.tune.top - 4}" y2="${LANE_BOUNDS.drums.bottom + 4}" style="visibility:hidden" /><circle class="pf-vis-ball" data-vis-ball cx="${SCORE_LEFT}" cy="16" r="5" style="visibility:hidden" /><circle class="pf-vis-calm-beat" data-vis-calm-beat cx="${SCORE_LEFT}" cy="16" r="4" style="visibility:hidden" />`;
}

/** Render a standalone `<div class="pf-live-score-wrap">...<svg data-live-score>...` block. */
export function liveScoreStripHtml(model, { caption = "", legend = "" } = {}) {
  const inner = renderLiveScoreInnerSvg(model, { includeMfAttrs: false, showLaneLabels: true });
  const capHtml = caption
    ? `<div class="pf-live-score-head"><span class="pf-live-score-caption" data-live-score-caption>${escAttr(caption)}</span>${legend ? `<span class="pf-live-score-legend">${escAttr(legend)}</span>` : ""}</div>`
    : "";
  return `<div class="pf-live-score-wrap" data-live-score-wrap>${capHtml}<svg class="pf-live-score" data-live-score data-vis-signature="${escAttr(model.signature)}" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" aria-hidden="true" focusable="false">${inner}</svg></div>`;
}

const frameStateMap = new WeakMap();

function getSvgRuntimeState(svg) {
  let st = frameStateMap.get(svg);
  if (!st) {
    st = {
      lastPaintMs: 0,
      smoothedDtMs: 16.7,
      overBudgetStreak: 0,
      throttled: false,
      lastSoundingKey: "",
    };
    frameStateMap.set(svg, st);
  }
  return st;
}

/**
 * Diff-sync an `<svg>` element (`[data-live-score]` or `[data-mf-score]`) on animation tick.
 * Auto-throttles frame rate when main-thread frame `dt > 24 ms` so Web Audio never jitters.
 */
export function syncLiveScoreSvg(
  svg,
  {
    model,
    frame,
    soundingIds = new Set(),
    includeMfAttrs = false,
    showLaneLabels = true,
    nowMs = typeof performance !== "undefined" ? performance.now() : Date.now(),
  } = {}
) {
  if (!svg || !model) return;
  const st = getSvgRuntimeState(svg);

  // Frame-time budget monitor: protect Web Audio 25 ms lookahead timer.
  if (st.lastPaintMs > 0 && frame?.playheadVisible) {
    const dt = nowMs - st.lastPaintMs;
    if (dt > 4 && dt < 250) {
      st.smoothedDtMs = st.smoothedDtMs * 0.75 + dt * 0.25;
      if (st.smoothedDtMs > 24) {
        st.overBudgetStreak += 1;
        if (st.overBudgetStreak >= 4) st.throttled = true;
      } else if (st.smoothedDtMs < 17) {
        st.overBudgetStreak = 0;
        st.throttled = false;
      }
    }
    if (st.throttled && dt < 33) {
      return;
    }
  }
  st.lastPaintMs = nowMs;

  if (svg.dataset?.visSignature !== model.signature || !svg.firstChild) {
    if (svg.dataset) svg.dataset.visSignature = model.signature;
    else svg.setAttribute?.("data-vis-signature", model.signature);
    svg.innerHTML = renderLiveScoreInnerSvg(model, { includeMfAttrs, showLaneLabels });
    st.lastSoundingKey = "__rebuild__";
  }

  const backingGroup = svg.querySelector?.("[data-vis-backing]");
  if (backingGroup) {
    backingGroup.style.opacity = String(model.backingOpacity);
    if (backingGroup.dataset) backingGroup.dataset.visBackingDim = model.backingDimState;
  }

  const effectiveSounding = frame?.playheadVisible ? soundingIds : new Set();
  const soundingKey = [...effectiveSounding].sort().join("|");
  if (soundingKey !== st.lastSoundingKey) {
    st.lastSoundingKey = soundingKey;
    const noteEls = svg.querySelectorAll?.("[data-vis-note]") || [];
    for (const el of noteEls) {
      const noteId = el.getAttribute("data-vis-note");
      el.classList.toggle("playing", effectiveSounding.has(noteId));
    }
  }

  const head = svg.querySelector?.("[data-vis-playhead], [data-mf-playhead]");
  if (head) {
    if (frame?.playheadVisible) {
      head.setAttribute("x1", String(frame.playheadX));
      head.setAttribute("x2", String(frame.playheadX));
      head.style.visibility = "visible";
    } else {
      head.style.visibility = "hidden";
    }
  }

  const ball = svg.querySelector?.("[data-vis-ball]");
  if (ball) {
    if (frame?.ballVisible) {
      ball.setAttribute("cx", String(frame.ballX));
      ball.setAttribute("cy", String(frame.ballY));
      ball.style.visibility = "visible";
    } else {
      ball.style.visibility = "hidden";
    }
  }

  const calmBeat = svg.querySelector?.("[data-vis-calm-beat]");
  if (calmBeat) {
    if (frame?.calmBeatVisible) {
      calmBeat.setAttribute("cx", String(frame.calmBeatX));
      calmBeat.style.visibility = "visible";
    } else {
      calmBeat.style.visibility = "hidden";
    }
  }
}

export { buildLiveScoreModel, computeLiveScoreFrame };
