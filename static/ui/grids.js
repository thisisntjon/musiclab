/**
 * Sequencer Grids: Harmony Spine, Monophonic Bass & Synth Trade-Off Matrix, Beat Drum Grid, and Melody Note Canvas
 */
import { PATCH_META } from "./noise_sculptor.js";

export const CHORD_OPTIONS = [
  { roman: "I", degree: 1, quality: "maj", label: "Home Anchor (Major)" },
  { roman: "V", degree: 5, quality: "maj", label: "Strong Pull Back Home" },
  { roman: "vi", degree: 6, quality: "min", label: "Warm Reflective Minor" },
  { roman: "IV", degree: 4, quality: "maj", label: "Open Uplifting Lift" },
  { roman: "ii", degree: 2, quality: "min", label: "Smooth Stepping Stone" },
  { roman: "i", degree: 1, quality: "min", label: "Minor Home Anchor" },
  { roman: "bVI", degree: 6, quality: "maj", label: "Wide Anthem Lift" },
  { roman: "bVII", degree: 7, quality: "maj", label: "Forward Driving Pickup" },
  { roman: "iv", degree: 4, quality: "min", label: "Deep Minor Shade" },
  { roman: "III", degree: 3, quality: "maj", label: "Bright Horizon Release" },
];

export const DRUM_ROWS = [
  { id: "kick", name: "Main Kick Beat", color: "#f43f5e" },
  { id: "snare", name: "Crisp Backbeat Snare", color: "#eab308" },
  { id: "clap", name: "Wide Handclap Layer", color: "#a855f7" },
  { id: "hat_closed", name: "Steady Hi-Hat Pulse", color: "#06b6d4" },
];

export const MELODY_ROWS = [
  { label: "High Home Note (+1 Oct)", qualia: "8va Home", ctIndex: 0, degOffset: 0, octOffset: 1 },
  { label: "Leading Step (Pulls Home)", qualia: "7↗1 Pull", ctIndex: 2, degOffset: 2, octOffset: 0 },
  { label: "Upper Color Step (Lift)", qualia: "6↘5 Lift", ctIndex: 2, degOffset: 1, octOffset: 0 },
  { label: "5th Chord Note (Open)", qualia: "5 Pillar", ctIndex: 2, degOffset: 0, octOffset: 0 },
  { label: "Middle Passing Step", qualia: "4↘3 Step", ctIndex: 1, degOffset: 1, octOffset: 0 },
  { label: "3rd Chord Note (Warmth)", qualia: "3 Color", ctIndex: 1, degOffset: 0, octOffset: 0 },
  { label: "Lower Stepping Note", qualia: "2↘1 Step", ctIndex: 0, degOffset: 1, octOffset: 0 },
  { label: "1st Chord Note (Home)", qualia: "1 Home", ctIndex: 0, degOffset: 0, octOffset: 0 },
];

function getVisibleStepRange(barFilter, totalSteps = 64) {
  if (barFilter === "all") {
    return { startStep: 0, endStep: totalSteps };
  }
  if (typeof barFilter === "string" && barFilter.startsWith("mobile_")) {
    const bank = Number(barFilter.replace("mobile_", "")) || 0;
    return { startStep: bank * 8, endStep: Math.min(totalSteps, (bank + 1) * 8) };
  }
  const b = Number(barFilter) || 0;
  return { startStep: b * 16, endStep: Math.min(totalSteps, (b + 1) * 16) };
}

function captureGridFocus(containerEl) {
  const active = document.activeElement;
  if (!active || !containerEl.contains(active) || !active.classList.contains("step-cell")) {
    return null;
  }
  const rowEl = active.closest(".matrix-row");
  if (!rowEl) return null;
  const allRows = Array.from(containerEl.querySelectorAll(".matrix-row"));
  const rIdx = allRows.indexOf(rowEl);
  const cellsInRow = Array.from(rowEl.querySelectorAll(".step-cell"));
  const cIdx = cellsInRow.indexOf(active);
  return { rIdx, cIdx };
}

function restoreGridFocus(containerEl, savedFocus) {
  if (!savedFocus) return;
  const allRows = Array.from(containerEl.querySelectorAll(".matrix-row"));
  const rowEl = allRows[savedFocus.rIdx];
  if (!rowEl) return;
  const cellsInRow = Array.from(rowEl.querySelectorAll(".step-cell"));
  const targetCell = cellsInRow[savedFocus.cIdx];
  if (!targetCell) return;
  for (const c of containerEl.querySelectorAll(".step-cell")) {
    c.tabIndex = -1;
  }
  targetCell.tabIndex = 0;
  targetCell.focus({ preventScroll: true });
}

function attachKeyboardGridNav(containerEl) {
  if (containerEl.dataset.kbWired === "1") return;
  containerEl.dataset.kbWired = "1";
  containerEl.addEventListener("keydown", (ev) => {
    const cell = ev.target.closest(".step-cell");
    if (!cell) return;
    const rowEl = cell.closest(".matrix-row");
    if (!rowEl) return;
    const allRows = Array.from(containerEl.querySelectorAll(".matrix-row"));
    const rIdx = allRows.indexOf(rowEl);
    const cellsInRow = Array.from(rowEl.querySelectorAll(".step-cell"));
    const cIdx = cellsInRow.indexOf(cell);

    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      cell.click();
      return;
    }
    let nextCell = null;
    if (ev.key === "ArrowRight" && cIdx + 1 < cellsInRow.length) {
      nextCell = cellsInRow[cIdx + 1];
    } else if (ev.key === "ArrowLeft" && cIdx - 1 >= 0) {
      nextCell = cellsInRow[cIdx - 1];
    } else if (ev.key === "ArrowDown" && rIdx + 1 < allRows.length) {
      const nextRowCells = allRows[rIdx + 1].querySelectorAll(".step-cell");
      nextCell = nextRowCells[Math.min(cIdx, nextRowCells.length - 1)];
    } else if (ev.key === "ArrowUp" && rIdx - 1 >= 0) {
      const prevRowCells = allRows[rIdx - 1].querySelectorAll(".step-cell");
      nextCell = prevRowCells[Math.min(cIdx, prevRowCells.length - 1)];
    }
    if (nextCell) {
      ev.preventDefault();
      cell.tabIndex = -1;
      nextCell.tabIndex = 0;
      nextCell.focus();
    }
  });
}

function shortBadgeForNote(note) {
  const pid = note.gesture?.preset_id || "";
  if (pid === "vowel_yoi") return "YOI";
  if (pid === "wah_bite") return "GRW";
  if (pid === "wobble_1_16" || pid === "wobble_1_8t") return "WOB";
  if (pid === "laser_drop") return "LSR";
  if (pid === "stutter_32") return "CHP";
  if (pid === "sub_dive") return "808";
  return "•";
}

export function renderHarmonySpine(containerEl, songDoc, compiledSong, { onChordChange, onWhyUpdate }) {
  containerEl.innerHTML = "";
  const progId = songDoc.active_progression_id || "prog-main";
  const prog = (songDoc.chord_progressions && songDoc.chord_progressions[progId]) || [];
  const voiced = compiledSong?.voiced_chords || [];

  for (let bar = 0; bar < 4; bar++) {
    const slot = prog[bar] || { bar, beats: 4, degree: 1, roman: "i", quality: "min" };
    const vc = voiced[bar] || {};
    const card = document.createElement("div");
    card.className = "chord-card";
    card.dataset.bar = String(bar);

    const names = (vc.voiced_names || ["C4", "E4", "G4"]).join(" · ");
    const motion = vc.avg_voice_motion_st !== undefined ? `Δ ${vc.avg_voice_motion_st} st` : "";
    const romanFn = vc.roman_function_label || `${slot.roman} · Home`;

    card.innerHTML = `
      <div class="chord-card-top">
        <span class="chord-bar-label">BAR ${bar + 1} · <strong>${romanFn}</strong></span>
        <span class="chord-voicing-badge">${names} ${motion ? `(${motion})` : ""}</span>
      </div>
      <select class="chord-select" aria-label="Bar ${bar + 1} Chord" data-bar="${bar}">
        ${CHORD_OPTIONS.map(
          (opt) =>
            `<option value="${opt.roman}" ${opt.roman === slot.roman ? "selected" : ""}>${opt.label}</option>`
        ).join("")}
      </select>
      <div style="font-size:10.5px; color:#94a3b8;">${vc.why_label || "Establishes bar harmonic gravity."}</div>
    `;

    const sel = card.querySelector(".chord-select");
    sel.addEventListener("change", () => {
      const picked = CHORD_OPTIONS.find((o) => o.roman === sel.value) || CHORD_OPTIONS[0];
      onChordChange(bar, picked);
    });
    card.addEventListener("mouseenter", () => {
      if (vc.why_label) onWhyUpdate(`Bar ${bar + 1} Harmony: ${vc.why_label}`);
    });
    containerEl.appendChild(card);
  }
}

export function renderHocketMatrix(
  containerEl,
  songDoc,
  compiledSong,
  barFilter,
  selectedNoteId,
  { onToggleHocketCell, onSelectPatchRow, onWhyUpdate, ghostAddedNotes = [] }
) {
  const savedFocus = captureGridFocus(containerEl);
  containerEl.innerHTML = "";
  const { startStep, endStep } = getVisibleStepRange(barFilter, Math.min(64, compiledSong?.total_steps || 64));
  const stepCount = endStep - startStep;
  const hocketPatches = PATCH_META.filter((p) => p.id !== "supersaw_stab");

  const kickSteps = new Set(
    (songDoc.notes || [])
      .filter((n) => n.role === "drums" && (n.patch_id === "kick" || n.drum_lane === "kick"))
      .map((n) => Number(n.step))
  );

  const ghostSet = new Set(
    (ghostAddedNotes || [])
      .filter((n) => n.role === "hocket" || n.role === "bass")
      .map((n) => `${n.step}:${n.patch_id}`)
  );

  const noteByStepAndPatch = new Map();
  const compiledByStep = new Map();
  for (const n of songDoc.notes || []) {
    if (n.role === "hocket" || n.role === "bass") {
      noteByStepAndPatch.set(`${n.step}:${n.patch_id}`, n);
    }
  }
  for (const ev of compiledSong?.events || []) {
    if (ev.role === "hocket" || ev.role === "bass") {
      compiledByStep.set(`${ev.step}:${ev.patch_id}`, ev);
    }
  }

  for (const patch of hocketPatches) {
    const row = document.createElement("div");
    row.className = "matrix-row";

    const label = document.createElement("div");
    label.className = "row-label";
    label.style.borderLeftColor = patch.color;
    label.textContent = patch.name;
    label.title = `Click to select ${patch.name} in the Noise Sculptor`;
    label.addEventListener("click", () => onSelectPatchRow(patch.id));

    const stepsWrap = document.createElement("div");
    stepsWrap.className = "row-steps";
    stepsWrap.style.gridTemplateColumns = `repeat(${stepCount}, minmax(14px, 1fr))`;

    for (let s = startStep; s < endStep; s++) {
      const cell = document.createElement("div");
      cell.className = "step-cell";
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = s === startStep && patch === hocketPatches[0] ? 0 : -1;
      cell.setAttribute("aria-label", `${patch.name} Step ${s + 1}`);
      cell.dataset.step = String(s);
      if (s % 16 === 0) cell.classList.add("bar-start");
      else if (s % 4 === 0) cell.classList.add("beat-start");
      if (kickSteps.has(s) && (patch.id === "sub_drop_808" || patch.id === "wobble_bass")) {
        cell.classList.add("kick-pulse-col");
      }

      const key = `${s}:${patch.id}`;
      const rawNote = noteByStepAndPatch.get(key);
      const compEv = compiledByStep.get(key);

      if (rawNote) {
        cell.classList.add("active");
        cell.style.background = patch.color;
        cell.textContent = shortBadgeForNote(compEv || rawNote);
        if (selectedNoteId && rawNote.id === selectedNoteId) {
          cell.classList.add("selected-note");
        }
      } else if (ghostSet.has(key)) {
        cell.classList.add("ghost-added");
        cell.textContent = "+";
      }

      cell.addEventListener("mouseenter", () => {
        if (compEv?.why_label) {
          onWhyUpdate(`Step ${s + 1}: ${compEv.why_label}`);
        } else {
          onWhyUpdate(
            `Step ${s + 1} (${patch.name}): ${
              kickSteps.has(s)
                ? "Kick-Drum Downbeat Guide — locking 808 Sub or Wobble here anchors the low-end pocket."
                : "Off-beat Hocket slot — click to place a choked monster hit that answers the downbeat."
            }`
          );
        }
      });

      cell.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onToggleHocketCell(s, patch, rawNote);
      });

      stepsWrap.appendChild(cell);
    }

    row.appendChild(label);
    row.appendChild(stepsWrap);
    containerEl.appendChild(row);
  }
  attachKeyboardGridNav(containerEl);
  restoreGridFocus(containerEl, savedFocus);
}

export function renderDrumMatrix(containerEl, songDoc, compiledSong, barFilter, { onToggleDrumCell, onWhyUpdate }) {
  const savedFocus = captureGridFocus(containerEl);
  containerEl.innerHTML = "";
  const { startStep, endStep } = getVisibleStepRange(barFilter, Math.min(64, compiledSong?.total_steps || 64));
  const stepCount = endStep - startStep;

  const drumMap = new Map();
  for (const n of songDoc.notes || []) {
    if (n.role === "drums") {
      drumMap.set(`${n.step}:${n.patch_id}`, n);
    }
  }

  for (const dRow of DRUM_ROWS) {
    const row = document.createElement("div");
    row.className = "matrix-row";

    const label = document.createElement("div");
    label.className = "row-label";
    label.style.borderLeftColor = dRow.color;
    label.textContent = dRow.name;

    const stepsWrap = document.createElement("div");
    stepsWrap.className = "row-steps";
    stepsWrap.style.gridTemplateColumns = `repeat(${stepCount}, minmax(14px, 1fr))`;

    for (let s = startStep; s < endStep; s++) {
      const cell = document.createElement("div");
      cell.className = "step-cell";
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = s === startStep && dRow === DRUM_ROWS[0] ? 0 : -1;
      cell.setAttribute("aria-label", `${dRow.name} Step ${s + 1}`);
      cell.dataset.step = String(s);
      if (s % 16 === 0) cell.classList.add("bar-start");
      else if (s % 4 === 0) cell.classList.add("beat-start");

      const existing = drumMap.get(`${s}:${dRow.id}`);
      if (existing) {
        cell.classList.add("active");
        cell.style.background = dRow.color;
        cell.textContent = dRow.id === "kick" ? "K" : dRow.id === "snare" ? "S" : "•";
      }

      cell.addEventListener("mouseenter", () => {
        onWhyUpdate(
          `Step ${s + 1} (${dRow.name}): ${
            dRow.id === "kick" || dRow.id === "snare"
              ? "Main beat hit that gently makes room in the mix so the rhythm stays clear."
              : "Adds steady forward groove movement."
          }`
        );
      });

      cell.addEventListener("click", () => onToggleDrumCell(s, dRow.id, existing));
      stepsWrap.appendChild(cell);
    }

    row.appendChild(label);
    row.appendChild(stepsWrap);
    containerEl.appendChild(row);
  }
  attachKeyboardGridNav(containerEl);
  restoreGridFocus(containerEl, savedFocus);
}

export function renderMelodyMatrix(
  containerEl,
  songDoc,
  compiledSong,
  barFilter,
  selectedNoteId,
  {
    onToggleMelodyCell,
    onWhyUpdate,
    gravityFadeMode = "post_placement",
    missionTargetSteps = [],
    ghostAddedNotes = [],
    heightTrapSteps = [],
  }
) {
  const savedFocus = captureGridFocus(containerEl);
  containerEl.innerHTML = "";
  containerEl.className = `matrix-container gravity-fade-${gravityFadeMode}`;
  containerEl.setAttribute("role", "grid");
  const { startStep, endStep } = getVisibleStepRange(barFilter, Math.min(64, compiledSong?.total_steps || 64));
  const stepCount = endStep - startStep;
  const targetStepsSet = new Set(missionTargetSteps || []);
  const trapStepsSet = new Set(heightTrapSteps || []);

  const ghostLeadSet = new Set(
    (ghostAddedNotes || [])
      .filter((n) => n.role === "lead")
      .map((n) => {
        const rel = n.relational || {};
        return `${n.step}:${rel.chord_tone_index ?? 0}:${rel.scale_degree_offset ?? 0}:${rel.octave_offset ?? 0}`;
      })
  );

  const leadMap = new Map();
  for (const n of songDoc.notes || []) {
    if (n.role === "lead") {
      const rel = n.relational || {};
      const rKey = `${n.step}:${rel.chord_tone_index ?? 0}:${rel.scale_degree_offset ?? 0}:${rel.octave_offset ?? 0}`;
      leadMap.set(rKey, n);
    }
  }

  for (const mRow of MELODY_ROWS) {
    const row = document.createElement("div");
    row.className = "matrix-row";
    const isAnchor = mRow.degOffset === 0;

    const label = document.createElement("div");
    label.className = "row-label";
    label.style.borderLeftColor = isAnchor ? "#10b981" : "#eab308";
    label.textContent = mRow.label;

    const stepsWrap = document.createElement("div");
    stepsWrap.className = "row-steps";
    stepsWrap.style.gridTemplateColumns = `repeat(${stepCount}, minmax(14px, 1fr))`;

    for (let s = startStep; s < endStep; s++) {
      const cell = document.createElement("div");
      const showPreGlow = gravityFadeMode === "full";
      const showMarksAfterPlacement = gravityFadeMode === "post_placement" || gravityFadeMode === "full" || gravityFadeMode === "dimmed";
      cell.className = `step-cell ${showPreGlow ? (isAnchor ? "gravity-anchor" : "gravity-tension") : "post-placement-cell"}`;
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = s === startStep && mRow === MELODY_ROWS[0] ? 0 : -1;
      cell.dataset.step = String(s);
      if (s % 16 === 0) cell.classList.add("bar-start");
      else if (s % 4 === 0) cell.classList.add("beat-start");
      if (targetStepsSet.has(s)) cell.classList.add("mission-target-col");
      if (trapStepsSet.has(s)) cell.classList.add("height-trap-col");

      const rKey = `${s}:${mRow.ctIndex}:${mRow.degOffset}:${mRow.octOffset}`;
      const existing = leadMap.get(rKey);
      if (existing) {
        cell.classList.add("active");
        if (showMarksAfterPlacement) {
          cell.classList.add(isAnchor ? "placed-mark-anchor" : "placed-mark-tension");
          const shapeMark = isAnchor ? "●" : "◇";
          cell.textContent = `${shapeMark} ${mRow.qualia.split(" ")[0]}`;
        } else {
          // Blind / Faded-off / Control condition: neutral marker with zero chord-tone hint
          cell.classList.add("placed-mark-blind");
          cell.textContent = "■";
        }
        cell.setAttribute(
          "aria-label",
          `${mRow.label} Step ${s + 1} Active ${showMarksAfterPlacement ? (isAnchor ? "Chord Anchor ●" : "Passing Tone ◇") : ""}`
        );
        if (selectedNoteId && existing.id === selectedNoteId) {
          cell.classList.add("selected-note");
        }
      } else if (ghostLeadSet.has(rKey)) {
        cell.classList.add("ghost-added");
        cell.textContent = "+";
        cell.setAttribute("aria-label", `${mRow.label} Step ${s + 1} Ghost Suggestion`);
      } else {
        cell.setAttribute("aria-label", `${mRow.label} Step ${s + 1} Empty`);
      }

      cell.addEventListener("mouseenter", () => {
        const barIdx = Math.floor(s / 16) % 4;
        const vc = compiledSong?.voiced_chords?.[barIdx];
        const chordName = vc ? `${vc.chord_name} (${vc.roman})` : "active chord";
        if (isAnchor) {
          onWhyUpdate(
            `Step ${s + 1} (${mRow.label} • ${mRow.qualia}): Tier 1 Chord Anchor of ${chordName} — feels grounded and resolved on any beat.`
          );
        } else {
          onWhyUpdate(
            `Step ${s + 1} (${mRow.label} • ${mRow.qualia}): Tier 2 Tension / Motion tone over ${chordName} — creates forward pull that resolves into the nearest green Chord Anchor.`
          );
        }
      });

      cell.addEventListener("click", () => onToggleMelodyCell(s, mRow, existing));
      stepsWrap.appendChild(cell);
    }

    row.appendChild(label);
    row.appendChild(stepsWrap);
    containerEl.appendChild(row);
  }
  attachKeyboardGridNav(containerEl);
  restoreGridFocus(containerEl, savedFocus);
}
