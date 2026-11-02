/**
 * Subtractive Song Arranger & Build-to-Drop Blueprint UI (Phase 2)
 */

const ROLE_OPTIONS = [
  { id: "drums", label: "Drums" },
  { id: "harmony", label: "Chords" },
  { id: "bass", label: "808 Sub" },
  { id: "hocket", label: "Hocket" },
  { id: "lead", label: "Hook" },
];

const TRANSITION_OPTIONS = [
  { id: "riser_sweep", label: "Laser Riser Sweep" },
  { id: "turnaround_fill", label: "Bar-4 Snare Turnaround" },
  { id: "pre_drop_silence", label: "Snare Build + Fakeout Silence" },
  { id: "sub_drop_impact", label: "808 Sub-Drop + Clap Impact" },
  { id: "outro_resolve", label: "Outro Resolve" },
  { id: "none", label: "Clean Cut" },
];

export function renderSongArranger(
  containerEl,
  songDoc,
  compiledSong,
  activeSectionId,
  {
    onToggleArrangementMode,
    onUpdateSection,
    onJumpToSection,
    onWhyUpdate,
  }
) {
  containerEl.innerHTML = "";
  const isSongMode = songDoc.arrangement_mode === "song";
  const sections = songDoc.sections || [];
  const compiledSecs = compiledSong?.sections || [];
  const compById = new Map(compiledSecs.map((s) => [s.id, s]));

  // Header control bar inside arranger
  const topBar = document.createElement("div");
  topBar.className = "arranger-top-bar";
  topBar.innerHTML = `
    <div class="arranger-status">
      <span class="badge-mode ${isSongMode ? "mode-song" : "mode-loop"}">
        ${isSongMode ? `FULL SONG MODE (${compiledSong?.bars || 28} BARS / ${compiledSong?.total_steps || 448} STEPS)` : "4-BAR CORE LOOP MODE (64 STEPS)"}
      </span>
      <span class="panel-subtitle">
        Every section derives live from your 4-bar Core Loop and Master Harmony Spine — no "Make Unique" clone sprawl.
      </span>
    </div>
    <div class="arranger-actions">
      <button id="btn-toggle-song-mode" class="btn btn-sm ${isSongMode ? "btn-secondary" : "btn-accent"}">
        ${isSongMode ? "Return to 4-Bar Loop Focus" : "&#128640; Unfold 4-Bar Loop into 28-Bar Song"}
      </button>
      ${
        isSongMode && activeSectionId
          ? `<button id="btn-play-all-sections" class="btn btn-sm btn-primary">Play All 28 Bars</button>`
          : ""
      }
    </div>
  `;

  topBar.querySelector("#btn-toggle-song-mode").addEventListener("click", () => {
    onToggleArrangementMode(!isSongMode);
  });
  const playAllBtn = topBar.querySelector("#btn-play-all-sections");
  if (playAllBtn) {
    playAllBtn.addEventListener("click", () => onJumpToSection(null));
  }
  containerEl.appendChild(topBar);

  // 7-Section Timeline Grid
  const grid = document.createElement("div");
  grid.className = "arranger-timeline-grid";

  sections.forEach((sec, idx) => {
    const compSec = compById.get(sec.id) || {};
    const card = document.createElement("div");
    card.className = `section-card type-${sec.type || "drop"} ${activeSectionId === sec.id ? "focused-section" : ""}`;
    card.dataset.sectionId = sec.id;
    card.dataset.startStep = String(compSec.start_step ?? idx * 64);
    card.dataset.endStep = String(compSec.end_step ?? (idx + 1) * 64);

    const energyVal = Number(sec.energy ?? 1.0);
    const energyWidth = Math.round(energyVal * 100);
    const energyLabel = energyVal >= 0.85 ? "Full Chorus" : energyVal >= 0.55 ? "Building" : "Gentle Space";
    const activeRoles = new Set(sec.active_roles || []);
    const evCount = compSec.active_event_count ?? "—";
    const startBar = (compSec.start_bar ?? idx * 4) + 1;
    const endBar = compSec.end_bar ?? (idx + 1) * 4;

    card.innerHTML = `
      <div class="section-card-header">
        <div>
          <div class="section-bar-range">BARS ${startBar}–${endBar} &bull; ${evCount} EVENTS</div>
          <div class="section-title">${sec.name}</div>
        </div>
        <button class="btn btn-sm btn-ghost btn-loop-sec" title="Loop/Audition this section">
          ${activeSectionId === sec.id ? "&#128257; Looping" : "&#9654; Focus"}
        </button>
      </div>

      <div class="energy-bar-track" title="Section Energy (${energyLabel})">
        <div class="energy-bar-fill" style="width:${energyWidth}%;"></div>
      </div>

      <div class="section-control-row">
        <label>Intensity: <strong>${energyLabel}</strong></label>
        <input type="range" class="sec-energy-slider" min="0.15" max="1.00" step="0.01" value="${sec.energy ?? 1.0}" />
      </div>

      <div class="section-roles-row">
        ${ROLE_OPTIONS.map(
          (r) =>
            `<button class="role-chip ${activeRoles.has(r.id) ? "active" : ""}" data-role="${r.id}">${r.label}</button>`
        ).join("")}
      </div>

      <div class="section-control-row">
        <label>Boundary Transition</label>
        <select class="sec-transition-select">
          ${TRANSITION_OPTIONS.map(
            (t) =>
              `<option value="${t.id}" ${t.id === sec.transition ? "selected" : ""}>${t.label}</option>`
          ).join("")}
        </select>
      </div>
    `;

    card.addEventListener("mouseenter", () => {
      if (sec.why_label) {
        onWhyUpdate(`<strong>${sec.name}:</strong> ${sec.why_label}`);
      }
    });

    card.querySelector(".btn-loop-sec").addEventListener("click", () => {
      onJumpToSection(activeSectionId === sec.id ? null : sec);
    });

    const energySlider = card.querySelector(".sec-energy-slider");
    energySlider.addEventListener("change", (ev) => {
      sec.energy = Number(ev.target.value);
      onUpdateSection(sec);
    });

    for (const chip of card.querySelectorAll(".role-chip")) {
      chip.addEventListener("click", () => {
        const rId = chip.dataset.role;
        const set = new Set(sec.active_roles || []);
        if (set.has(rId) && set.size > 1) set.delete(rId);
        else set.add(rId);
        sec.active_roles = Array.from(set);
        onUpdateSection(sec);
      });
    }

    const transSel = card.querySelector(".sec-transition-select");
    transSel.addEventListener("change", (ev) => {
      sec.transition = ev.target.value;
      onUpdateSection(sec);
    });

    grid.appendChild(card);
  });

  containerEl.appendChild(grid);
}
