/**
 * Macro-Arrangement, C3-E5 Voice-Leading Bridges, Hocket Call-and-Response X-Ray,
 * Diagnostic Ear Coach, and Ear-to-Grid Mission Renderer (Phases 3 & 4)
 */
import { PATCH_META } from "./noise_sculptor.js";

const PATCH_COLOR_MAP = Object.fromEntries(PATCH_META.map((p) => [p.id, p.color]));

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}

export function drawMacroXRayCanvas(canvasEl, compiledSong, currentStep = 0) {
  if (!canvasEl || !compiledSong) return;
  const ctx = canvasEl.getContext("2d");
  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.clearRect(0, 0, w, h);

  const totalSteps = Math.max(64, Number(compiledSong.total_steps || 64));
  const sections = compiledSong.sections || [];
  const lane1H = Math.floor(h * 0.34);
  const lane2Top = lane1H + 4;
  const lane2H = Math.floor(h * 0.28);
  const lane3Top = lane2Top + lane2H + 4;
  const lane3H = h - lane3Top - 3;

  // 1. Lane 1: Section Energy Silhouette & Pre-Drop Silence Markers
  ctx.fillStyle = "#0b0f18";
  ctx.fillRect(0, 0, w, lane1H);

  for (const sec of sections) {
    const x0 = (sec.start_step / totalSteps) * w;
    const x1 = (sec.end_step / totalSteps) * w;
    const sw = Math.max(2, x1 - x0);
    const energy = Number(sec.energy ?? 1.0);
    const barH = Math.max(5, energy * (lane1H - 10));

    const grad = ctx.createLinearGradient(x0, lane1H - barH, x0, lane1H);
    if (sec.type === "drop") {
      grad.addColorStop(0, "rgba(244, 63, 94, 0.72)");
      grad.addColorStop(1, "rgba(244, 63, 94, 0.12)");
    } else if (sec.type === "build") {
      grad.addColorStop(0, "rgba(234, 179, 8, 0.65)");
      grad.addColorStop(1, "rgba(234, 179, 8, 0.12)");
    } else {
      grad.addColorStop(0, "rgba(6, 182, 212, 0.55)");
      grad.addColorStop(1, "rgba(6, 182, 212, 0.10)");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x0 + 1, lane1H - barH, sw - 2, barH);

    if (sec.transition === "pre_drop_silence") {
      const silX = ((sec.end_step - 4) / totalSteps) * w;
      ctx.fillStyle = "rgba(250, 204, 21, 0.85)";
      ctx.fillRect(silX, 2, Math.max(3, x1 - silX), lane1H - 4);
    }

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "9.5px system-ui, sans-serif";
    ctx.fillText(sec.name.split("—")[0].trim(), x0 + 4, 11);
  }

  // 2. Lane 2: C3–E5 Minimal-Motion Voice-Leading Bridges across the 4 Bars
  ctx.fillStyle = "#080c15";
  ctx.fillRect(0, lane2Top, w, lane2H);
  const voicedChords = compiledSong.voiced_chords || [];
  const voiceColors = ["#34d399", "#38bdf8", "#a855f7"];

  for (let vIdx = 0; vIdx < 3; vIdx++) {
    ctx.strokeStyle = voiceColors[vIdx % voiceColors.length];
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let b = 0; b < voicedChords.length; b++) {
      const vc = voicedChords[b];
      const midi = Number(vc.voiced_midi?.[vIdx] ?? 60);
      const norm = Math.max(0, Math.min(1, (midi - 48) / 28));
      const y = lane2Top + lane2H - 5 - norm * (lane2H - 10);
      const xStart = (b / Math.max(1, voicedChords.length)) * w + 6;
      const xEnd = ((b + 1) / Math.max(1, voicedChords.length)) * w - 6;
      if (b === 0) {
        ctx.moveTo(xStart, y);
      } else {
        ctx.lineTo(xStart, y);
      }
      ctx.lineTo(xEnd, y);
    }
    ctx.stroke();
  }

  // 3. Lane 3: 4-Bar Hocket Call-and-Response Conversational Arcs
  ctx.fillStyle = "#090c14";
  ctx.fillRect(0, lane3Top, w, lane3H);

  const cycleStart = Math.floor(currentStep / 64) * 64;
  const hocketEvents = (compiledSong.events || [])
    .filter(
      (e) =>
        (e.role === "hocket" || e.role === "bass") &&
        e.step >= cycleStart &&
        e.step < cycleStart + 64
    )
    .sort((a, b) => a.step - b.step);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
  ctx.lineWidth = 1;
  for (let b = 1; b < 4; b++) {
    const bx = (b / 4) * w;
    ctx.beginPath();
    ctx.moveTo(bx, lane2Top);
    ctx.lineTo(bx, lane3Top + lane3H);
    ctx.stroke();
  }

  let prevPt = null;
  for (const ev of hocketEvents) {
    const relStep = ev.step % 64;
    const cx = ((relStep + 0.5) / 64) * w;
    const midi = Number(ev.concrete?.midi_pitch || 36);
    const normPitch = Math.max(0, Math.min(1, (midi - 24) / 60));
    const cy = lane3Top + lane3H - 6 - normPitch * (lane3H - 12);
    const color = PATCH_COLOR_MAP[ev.patch_id] || "#38bdf8";

    if (prevPt) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(prevPt.x, prevPt.y);
      const midX = (prevPt.x + cx) * 0.5;
      const arcY = Math.min(prevPt.y, cy) - 8;
      ctx.quadraticCurveTo(midX, arcY, cx, cy);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();

    prevPt = { x: cx, y: cy };
  }

  // Live Playhead Cursors
  const playXTop = (currentStep / totalSteps) * w;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(playXTop, 0);
  ctx.lineTo(playXTop, lane1H);
  ctx.stroke();

  const playXBot = ((currentStep % 64) / 64) * w;
  ctx.strokeStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(playXBot, lane2Top);
  ctx.lineTo(playXBot, lane3Top + lane3H);
  ctx.stroke();
}

export function renderDiagnosticCoachPanel(
  containerEl,
  diagnostics,
  { onAuditionIssueAB, onApplyFix }
) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  const issues = diagnostics?.issues || [];
  if (issues.length === 0) {
    const okCard = document.createElement("div");
    okCard.className = "diagnostic-card healthy-card";
    okCard.innerHTML = `
      <div>
        <strong>&#10004; ${diagnostics?.summary_label || "All Notes & Chords Sound Clear Together"}</strong>
        <div style="font-size:10.5px; color:#94a3b8; margin-top:2px;">
          Want to see how the Diagnostic Ear Coach rescues a broken loop? Click <strong>"&#9888; Load 4-Mistake Demo"</strong> above!
        </div>
      </div>
    `;
    containerEl.appendChild(okCard);
    return;
  }

  for (const issue of issues) {
    const card = document.createElement("div");
    card.className = `diagnostic-card ${issue.severity === "high" ? "sev-high" : ""}`;
    card.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:700; color:#f8fafc;">${issue.problem_summary}</div>
        <div style="font-size:10.5px; color:#94a3b8; margin-top:2px;">${issue.why_explanation}</div>
      </div>
      <div style="display:flex; gap:5px; flex-shrink:0;">
        <button class="btn btn-sm btn-secondary btn-hear-issue">&#128266; Hear Problem vs. Fix (A/B)</button>
        <button class="btn btn-sm btn-accent btn-apply-fix">&#10024; Apply White-Box Fix</button>
      </div>
    `;
    card.querySelector(".btn-hear-issue").addEventListener("click", () => onAuditionIssueAB(issue));
    card.querySelector(".btn-apply-fix").addEventListener("click", () => onApplyFix(issue));
    containerEl.appendChild(card);
  }
}

export function renderEarMissionPanel(
  containerEl,
  mission,
  lastGrade,
  { onPlayMysteryPhrase, onGradeMission, onNewMission }
) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  if (!mission) {
    containerEl.innerHTML = `<span>Loading 20-Second Ear-to-Grid Call &amp; Response Mission...</span>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.justifyContent = "space-between";
  wrap.style.alignItems = "center";
  wrap.style.width = "100%";
  wrap.style.gap = "10px";

  const gradeHtml = lastGrade
    ? `<div style="margin-top:4px; font-weight:700; color:${lastGrade.passed ? "#34d399" : "#facc15"};">${lastGrade.feedback}</div>`
    : "";

  wrap.innerHTML = `
    <div style="flex:1;">
      <div style="font-weight:700; color:#e2e8f0;">&#127919; ${mission.title}</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${mission.instructions}</div>
      ${gradeHtml}
    </div>
    <div style="display:flex; gap:6px; flex-shrink:0;">
      <button class="btn btn-sm btn-primary btn-play-mission">&#128266; Play Call &amp; Target</button>
      <button class="btn btn-sm btn-accent btn-grade-mission">&#10004; Check My Grid Notes</button>
      <button class="btn btn-sm btn-ghost btn-new-mission">&#8635; New Mission</button>
    </div>
  `;

  wrap.querySelector(".btn-play-mission").addEventListener("click", () => onPlayMysteryPhrase(mission));
  wrap.querySelector(".btn-grade-mission").addEventListener("click", () => onGradeMission(mission));
  wrap.querySelector(".btn-new-mission").addEventListener("click", () => onNewMission());
  containerEl.appendChild(wrap);
}
