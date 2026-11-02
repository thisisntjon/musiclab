import {musicFieldTempoAllowed} from '../js/theory/music_field.js';
/**
 * Main Studio Controller (static/ui/app.js) — MusicLab Guided Song Studio
 * Connects Web Audio LookaheadScheduler, Standalone Client-Side Compiler + Optional REST API,
 * Genre-Neutral Default Starter + Heavy Bass & Glitch Showcase, Post-Placement Non-Color Shape Marks (● / ◇ / ▲),
 * Per-Note Authorship Provenance Ledger, Hum-to-Draft Pitch Tracker, Melody-First Harmonizer,
 * and keyboard and greyscale accessibility.
 */
import { LookaheadScheduler, recordHummedPhraseToDraftNotes } from "../js/audio/scheduler.js";
import { PHRASE_SHAPES, SHAPE_ACTIONS, transformPhraseEnding } from "../js/theory/phrase_transforms.js";
import { EAR_PROMPT, newEarTrial, endingKind, earFeedback } from "../js/theory/ear_check.js";
import { PlayFlow } from "./stages/play_flow.js";
import { icon } from "./icons.js";
import { NoiseSculptorUI, PATCH_META } from "./noise_sculptor.js";
import {
  renderHarmonySpine,
  renderHocketMatrix,
  renderDrumMatrix,
  renderMelodyMatrix,
} from "./grids.js";
import { renderNoteInspector } from "./inspector.js";
import { renderSongArranger } from "./arranger.js";
import {
  drawMacroXRayCanvas,
  renderDiagnosticCoachPanel,
  renderEarMissionPanel,
  triggerBlobDownload,
} from "./xray.js";
import {
  compileSongStandalone,
  computeProvenanceSummary,
  harmonizeMelodyPhraseJS,
  suggestHarmonyAlternatives,
  generateFalsificationProtocolJS,
  gradeFalsificationTrialJS,
  buildStandaloneSeed,
} from "./standalone_compiler.js";

class MusicLabStudioApp {
  static HUM_MESSAGES = {
    denied: "The mic is off. You can tap notes instead.",
    no_device: "No mic found. You can tap notes instead.",
    silent: "No hum heard. Try again, or tap a note.",
    error: "The mic did not work. You can tap notes instead.",
    cancelled: "Stopped. Hum again, or tap a note.",
  };

  constructor() {
    this.scheduler = new LookaheadScheduler();
    this.songDoc = null;
    this.compiledSong = null;
    this.diagnostics = null;
    this.provenanceSummary = null;
    this.selectedNoteId = null;
    this.activeBarFilter = "all";
    this.activeView = "all";
    this.activeSectionId = null;
    this.lastVisualStep = -1;
    this.activePresetId = "starter_neutral_100_cm";

    this.sessionLoadMs = Date.now();
    this.firstAudioLogged = false;
    this.tapTimestamps = [];
    this.tapSdMs = null;
    this.earAnswer = null;
    this.earTrial = null;
    this.savedIfThenPlan = localStorage.getItem("tonecanvas_if_then_plan") || "";
    this.savedSongsList = [];

    // Phase 4 & 5 Surface States
    this.abRawActive = false;
    this.abFocusMode = "all";
    this.droneEnabled = false;
    this.gravityFadeMode = "post_placement";
    this.ghostAddedNotes = [];
    this.activeEarMission = null;
    this.lastMissionGrade = null;

    // Phase 5: Hum Draft & Falsification Study State
    this.pendingHumDraftNotes = [];
    this.falsificationCondition = "treatment";
    this.falsificationProtocol = generateFalsificationProtocolJS("treatment", "P01");
    this.falsificationPreGrade = null;
    this.falsificationPostGrade = null;
    this.activeFalsificationBlock = null;

    this.whyTextEl = document.getElementById("why-text");
    this.playheadLabelEl = document.getElementById("playhead-step-label");
    this.inspectorDetailsEl = document.getElementById("inspector-details");
    this.spectrumCanvas = document.getElementById("spectrum-canvas");
    this.xrayCanvas = document.getElementById("xray-canvas");
    this.customPatchesRowEl = document.getElementById("custom-patches-row");
    this.customPatches = [];

    this.sculptor = new NoiseSculptorUI({
      onGestureChange: (newGesture, shouldAudition) => this.handleGestureChange(newGesture, shouldAudition),
      onPatchSelect: (patchId) => this.handlePatchSelect(patchId),
      onAudition: (patchId, gesture) => this.auditionPatch(patchId, gesture),
      onWhyUpdate: (msg) => this.setWhyBanner(msg),
    });

    this._bindTopControls();
    this._bindPhase4Surfaces();
    this._bindPhase5Surfaces();
    this._startVisualLoop();
    // A self-test run is not a person's session: it is never logged.
    if (!new URLSearchParams(window.location.search).has("selftest")) this._logSessionEvent("load", { ts_ms: this.sessionLoadMs });
    this.playFlow = new PlayFlow(this);
    this._startMusicDirector();
    window.addEventListener('pagehide', () => this._stopMusicDirector());
    window.addEventListener('pageshow', () => this._startMusicDirector());
    const params = new URLSearchParams(window.location.search);
    if (!params.has("studio")) {
      this.songDoc = buildStandaloneSeed("starter_neutral_100_cm");
      this.compiledSong = compileSongStandalone(this.songDoc, this._buildScaffoldOptions());
      this.scheduler.setCompiledSong(this.compiledSong);
      this.playFlow.mount();
      if (params.has("selftest")) import("./selftest.js").then((m) => m.runSelfTest(this));
    } else {
      this.loadInitialSong("starter_neutral_100_cm").then(() => {
        document.getElementById("advanced-studio-container")?.style.removeProperty("display");
        if (params.has("selftest")) import("./selftest.js").then((m) => m.runSelfTest(this));
      });
    }
  }

  _logSessionEvent(eventType, payload = {}) {
    const entry = {
      event: eventType,
      ts_ms: Date.now(),
      elapsed_ms: Date.now() - (this.sessionLoadMs || Date.now()),
      ...payload,
    };
    try {
      const existing = JSON.parse(localStorage.getItem("tonecanvas_session_log") || "[]");
      existing.push(entry);
      localStorage.setItem("tonecanvas_session_log", JSON.stringify(existing.slice(-200)));
    } catch (_e) {
      // ignore storage quota errors
    }
    // Without the server (static files) the first post fails and posting stops for the session, so a
    // static host's log isn't flooded; entries wait in this queue until the first post answers.
    const loc = typeof window !== "undefined" && window.location ? window.location : null;
    const host = loc ? loc.hostname : "";
    const pathname = loc ? loc.pathname || "" : "";
    if ((host !== "127.0.0.1" && host !== "localhost") || pathname.startsWith("/static/")) {
      this._serverLog = false;
      this._logQueue = null;
      return;
    }
    if (this._serverLog === false) return;
    if (this._serverLog === undefined) {
      if (this._logQueue) return void this._logQueue.push(entry);
      this._logQueue = [];
    }
    const post = (e) => fetch("/api/session-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) });
    const first = this._serverLog === undefined;
    post(entry)
      .then((res) => {
        if (!first) return;
        this._serverLog = res.ok;
        const queued = this._logQueue || [];
        this._logQueue = null;
        if (res.ok) queued.forEach((e) => post(e).catch(() => {}));
      })
      .catch(() => {
        if (first) {
          this._serverLog = false;
          this._logQueue = null;
        }
      });
  }

  /** Download names come from the piece's title only, never its id (ids can carry preset or artist names, 9b-7). */
  _downloadBaseName() {
    return (
      String(this.songDoc?.title || "my song")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || "my_song"
    );
  }

  _getLocalSavedSongs() {
    try {
      return JSON.parse(localStorage.getItem("tonecanvas_saved_songs") || "[]");
    } catch (_e) {
      return [];
    }
  }

  _saveSongToLocalStorage(songDoc) {
    if (!songDoc) return;
    try {
      const list = this._getLocalSavedSongs().filter((s) => s.id !== songDoc.id);
      list.unshift({
        id: songDoc.id || "my_song",
        title: songDoc.title || "My MusicLab Song",
        saved_at: new Date().toISOString(),
        song: JSON.parse(JSON.stringify(songDoc)),
      });
      localStorage.setItem("tonecanvas_saved_songs", JSON.stringify(list.slice(0, 20)));
      localStorage.setItem("tonecanvas_last_song", JSON.stringify(songDoc));
    } catch (_e) {
      // ignore
    }
  }

  setWhyBanner(htmlOrText) {
    this.whyTextEl.innerHTML = htmlOrText;
  }

  _buildScaffoldOptions() {
    if (!this.abRawActive) {
      return {
        voice_leading: "smooth",
        hocket_choke: true,
        humanize: true,
        pre_drop_silence: true,
        harmony_display_mode: this.gravityFadeMode || "post_placement",
      };
    }
    const focus = this.abFocusMode || "all";
    return {
      voice_leading: focus === "all" || focus === "voice_leading" ? "raw_block" : "smooth",
      hocket_choke: !(focus === "all" || focus === "hocket_choke"),
      humanize: !(focus === "all" || focus === "humanize"),
      pre_drop_silence: !(focus === "all" || focus === "pre_drop_silence"),
      harmony_display_mode: this.gravityFadeMode || "post_placement",
    };
  }

  async loadInitialSong(presetId = "starter_neutral_100_cm", reset = false) {
    this.activePresetId = presetId;
    const presetSel = document.getElementById("select-preset-mode");
    if (presetSel) presetSel.value = presetId;
    try {
      const qs = reset ? "?reset=1" : "";
      const [res, cpRes, earRes, listRes] = await Promise.all([
        fetch(`/api/songs/${presetId}${qs}`),
        fetch("/api/custom-patches"),
        fetch("/api/ear-mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate", difficulty: "starter" }),
        }),
        fetch("/api/songs"),
      ]);
      if (!res.ok) throw new Error("Static fallback");
      const data = await res.json();
      const cpData = await cpRes.json();
      const earData = await earRes.json();
      this.customPatches = cpData.custom_patches || [];
      this.songDoc = data.song;
      this.compiledSong = data.compiled;
      this.diagnostics = data.diagnostics;
      this.provenanceSummary = data.provenance || computeProvenanceSummary(this.songDoc, this.compiledSong);
      this.activeEarMission = earData.mission || null;
      if (listRes.ok) {
        const listData = await listRes.json();
        this.savedSongsList = listData.songs || [];
      }
    } catch (_err) {
      // 100% Standalone Static Web App / GitHub Pages fallback
      this.songDoc = buildStandaloneSeed("starter_neutral_100_cm");
      this.compiledSong = compileSongStandalone(this.songDoc, this._buildScaffoldOptions());
      this.provenanceSummary = computeProvenanceSummary(this.songDoc, this.compiledSong);
      this.diagnostics = { health_score: 100, issue_count: 0, issues: [] };
      this.savedSongsList = this._getLocalSavedSongs();
    }
    this.scheduler.setCompiledSong(this.compiledSong);
    this._syncTransportInputs();
    this.renderAll();
  }

  async compileAndRefresh(recordUndo = true) {
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song: this.songDoc,
          scaffold_options: this._buildScaffoldOptions(),
          record_undo: recordUndo,
        }),
      });
      if (!res.ok) throw new Error("Static fallback");
      const data = await res.json();
      this.compiledSong = data.compiled;
      this.diagnostics = data.diagnostics;
      this.provenanceSummary = data.provenance || computeProvenanceSummary(this.songDoc, this.compiledSong);
    } catch (_err) {
      this.compiledSong = compileSongStandalone(this.songDoc, this._buildScaffoldOptions());
      this.provenanceSummary = computeProvenanceSummary(this.songDoc, this.compiledSong);
    }
    this.scheduler.setCompiledSong(this.compiledSong);
    if (this.scheduler.masterBus && this.sculptor?.gesture?.ott_punch !== undefined) {
      this.scheduler.masterBus.setOTTPunch(this.sculptor.gesture.ott_punch);
    }
    if (this.droneEnabled) {
      const rootPc = Number(this.songDoc?.global_context?.root_pc ?? 0);
      this.scheduler.setReferenceDrone(true, 36 + rootPc);
    }
    this.renderAll();
  }

  _syncTransportInputs() {
    const ctx = this.songDoc?.global_context || {};
    document.getElementById("song-title-display").textContent =
      this.songDoc?.title || "MusicLab — Warm Keys & Clean Groove";
    document.getElementById("input-bpm").value = ctx.bpm || 100;
    const sw = Number(ctx.swing || 0.52);
    document.getElementById("input-swing").value = sw;
    document.getElementById("swing-val").textContent = sw >= 0.55 ? "Laid-Back" : sw <= 0.51 ? "Steady" : "Relaxed";
    document.getElementById("select-root").value = String(ctx.root_pc ?? 0);
    document.getElementById("select-scale").value = ctx.scale_type || "major";
    document.getElementById("toggle-auto-stabs").checked = this.songDoc?.auto_harmony_stabs !== false;
  }

  _bindPhase5Surfaces() {
    // Only reveal the research falsification harness when ?dev=1 is present in the URL
    const devFalsBtn = document.getElementById("tab-falsification-btn");
    if (devFalsBtn) {
      devFalsBtn.style.display = window.location.search.includes("dev=1") ? "inline-flex" : "none";
    }

    // 1. Preset Selector (Genre-Neutral Default vs. Heavy Bass & Glitch Showcase vs. 4-Mistake Demo)
    const presetSel = document.getElementById("select-preset-mode");
    if (presetSel) {
      presetSel.addEventListener("change", async (ev) => {
        const presetId = ev.target.value;
        await this.loadInitialSong(presetId, true);
        this.setWhyBanner(
          presetId === "starter_neutral_100_cm"
            ? "<strong>Loaded Starter Song:</strong> Warm keys, clean bass, plucked melody, and a steady drum pulse."
            : presetId === "heavy_bass_110"
            ? "<strong>Loaded Showcase Preset — Heavy Bass &amp; Glitch:</strong> Expressive bass growls, vowel filter, and tight low-end cut!"
            : "<strong>Loaded 4-Mistake Coach Demo:</strong> Listen to and fix 4 common timing and note clashes."
        );
      });
    }

    // 2. Per-note origin export: lists where each note came from. Principle 8: it records
    // origins only; it does not score, certify or grade authorship, and saving never depends on it.
    const provBtn = document.getElementById("btn-provenance-ledger");
    if (provBtn) {
      provBtn.addEventListener("click", () => {
        const prov = this.provenanceSummary || computeProvenanceSummary(this.songDoc, this.compiledSong);
        const receipt = {
          tool: "MusicLab (MIT open-source, runs on your computer)",
          exported_at_utc: new Date().toISOString(),
          about: "MusicLab does not generate audio with AI. This file lists where each note came from: notes you played or placed, notes you shaped, and supplied starter or band material.",
          note_origins: {
            counts: prov.counts,
            ledger: prov.ledger,
          },
          song: this.songDoc,
        };
        const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
        triggerBlobDownload(blob, `${this._downloadBaseName()}_song_notes.json`);
        this.setWhyBanner(
          `<strong>Saved your song notes:</strong> every note is listed with where it came from (your notes, notes you shaped, or supplied material).`
        );
      });
    }

    // 3. WCAG 2.2 Greyscale Non-Color Verification Mode
    const greyBtn = document.getElementById("btn-greyscale-mode");
    if (greyBtn) {
      greyBtn.addEventListener("click", () => {
        const active = document.body.classList.toggle("wcag-greyscale-mode");
        greyBtn.classList.toggle("drone-active", active);
        this.setWhyBanner(
          active
            ? "<strong>WCAG 2.2 Greyscale Verification ON:</strong> Notice how placed notes remain 100% distinguishable via non-color shape marks: <strong>&#9679; Filled Circle</strong> (Chord Anchor), <strong>&#9671; Hollow Diamond + Dashed Border</strong> (Scale Passing Tone), and <strong>&#9650; Triangle</strong> (Chromatic Clash)."
            : "WCAG 2.2 Greyscale filter turned off."
        );
      });
    }

    // 4. 3 Ghost Harmony Suggestions Drawer
    const harmOptBtn = document.getElementById("btn-harmony-options");
    const harmDrawer = document.getElementById("harmony-options-drawer");
    if (harmOptBtn && harmDrawer) {
      harmOptBtn.addEventListener("click", async () => {
        if (harmDrawer.style.display === "block") {
          harmDrawer.style.display = "none";
          return;
        }
        const rootPc = Number(this.songDoc?.global_context?.root_pc ?? 0);
        const scaleType = this.songDoc?.global_context?.scale_type || "major";
        let options = suggestHarmonyAlternatives(rootPc, scaleType);
        try {
          const res = await fetch("/api/harmony-options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root_pc: rootPc, scale_type: scaleType }),
          });
          if (res.ok) {
            const d = await res.json();
            if (d.options) options = d.options;
          }
        } catch (_e) {
          // Use standalone options
        }
        harmDrawer.style.display = "block";
        harmDrawer.innerHTML = `<div style="font-size:11.5px; color:#cbd5e1; margin-bottom:6px;"><strong>Choose 1 of 3 Voiced Harmony Progressions</strong> (C3–E5 smooth voice leading, user picks):</div>`;
        const row = document.createElement("div");
        row.className = "harmony-options-grid";
        for (const opt of options) {
          const card = document.createElement("div");
          card.className = "harmony-opt-card";
          const chordNames = (opt.voiced_chords || []).map((vc) => `${vc.chord_name} (${vc.roman})`).join(" &rarr; ");
          card.innerHTML = `
            <h4>${opt.title}</h4>
            <p>${opt.summary}</p>
            <div style="font-size:11px; color:#38bdf8; margin-bottom:6px;">${chordNames}</div>
            <button class="btn btn-sm btn-accent">Apply Progression</button>
          `;
          card.querySelector("button").addEventListener("click", () => {
            const progId = this.songDoc.active_progression_id || "prog-main";
            this.songDoc.chord_progressions[progId] = structuredClone(opt.progression);
            harmDrawer.style.display = "none";
            this.setWhyBanner(
              `<strong>Applied ${opt.title}:</strong> All relational bass, hocket, and melody anchors automatically re-voiced to match <code>${chordNames}</code>!`
            );
            this.compileAndRefresh();
          });
          row.appendChild(card);
        }
        harmDrawer.appendChild(row);
      });
    }

    // 5. Hum / Sing Idea -> Draft Notes Drawer
    const humBtn = document.getElementById("btn-hum-to-notes");
    const humDrawer = document.getElementById("hum-draft-drawer");
    if (humBtn && humDrawer) {
      humBtn.addEventListener("click", async () => {
        humDrawer.style.display = "block";
        const ctx = this.songDoc?.global_context || {};
        const result = await this._listenForHum(humDrawer);
        if (result.status !== "ok") return;
        const draftNotes = result.notes;
        this.pendingHumDraftNotes = draftNotes;
        const summaryPills = draftNotes
          .map((n) => `<span class="legend-pill tier-anchor">Step ${n.step + 1}: ${n.concrete?.note_name || "Note"} (${n.concrete?.freq_hz || ""} Hz)</span>`)
          .join(" ");
        humDrawer.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <div style="font-size:12px; font-weight:700; color:#f8fafc;">&#127908; Draft Notes Extracted (${draftNotes.length} notes quantized to ${ctx.scale_type || "major"} scale)</div>
              <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap;">${summaryPills}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button id="btn-confirm-hum-draft" class="btn btn-sm btn-accent">&#9989; Keep these notes</button>
              <button id="btn-discard-hum-draft" class="btn btn-sm btn-ghost">Discard</button>
            </div>
          </div>
        `;
        document.getElementById("btn-confirm-hum-draft")?.addEventListener("click", () => {
          const leadPatch = this.songDoc.genre_preset === "neutral_starter" ? "pluck_lead" : "supersaw_stab";
          const occupiedSteps = new Set(draftNotes.map((d) => Number(d.step)));
          this.songDoc.notes = (this.songDoc.notes || []).filter(
            (n) => !(n.role === "lead" && occupiedSteps.has(Number(n.step)))
          );
          for (const dn of draftNotes) {
            this.songDoc.notes.push({
              ...dn,
              patch_id: leadPatch,
              provenance: "hummed_confirmed",
            });
          }
          humDrawer.style.display = "none";
          this.setWhyBanner(
            `<strong>Confirmed ${draftNotes.length} Hummed Draft Notes!</strong> They're marked as yours.`
          );
          this.compileAndRefresh();
        });
        document.getElementById("btn-discard-hum-draft")?.addEventListener("click", () => {
          this.pendingHumDraftNotes = [];
          humDrawer.style.display = "none";
        });
      });
    }
  }

  _bindPhase4Surfaces() {
    // Surface A: Contrastive Before/After A/B Bypass ("Photoshop \ Key")
    const abBtn = document.getElementById("btn-ab-bypass");
    const abFocusSel = document.getElementById("select-ab-focus");
    const toggleAB = async () => {
      this.abRawActive = !this.abRawActive;
      abBtn.classList.toggle("raw-active", this.abRawActive);
      abBtn.innerHTML = this.abRawActive ? "&#9888; A/B: Raw Unscaffolded (A)" : "&#9878; A/B: Studio (B)";
      await this.compileAndRefresh(false);
      this.setWhyBanner(
        this.abRawActive
          ? "<strong>Contrastive A/B Bypass (RAW STATE A):</strong> Studio guardrails disabled! Hear how raw block chords jump >4.5 st, unchoked monster basses muddy 100–500 Hz, and robotic velocity flattens the groove."
          : "<strong>Contrastive A/B Bypass (STUDIO STATE B):</strong> Smooth C3–E5 voice leading (<= 2.5 st), Monophonic Hocket Choke, Metric Groove Humanization, and Pre-Drop Silence restored!"
      );
    };
    if (abBtn) abBtn.addEventListener("click", toggleAB);
    if (abFocusSel) {
      abFocusSel.addEventListener("change", (ev) => {
        this.abFocusMode = ev.target.value;
        if (this.abRawActive) this.compileAndRefresh(false);
      });
    }
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "\\" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        ev.preventDefault();
        toggleAB();
      }
    });

    // Surface B: Persistent Tonic Reference Drone
    const droneBtn = document.getElementById("btn-tonic-drone");
    if (droneBtn) {
      droneBtn.addEventListener("click", () => {
        this.droneEnabled = !this.droneEnabled;
        const rootPc = Number(this.songDoc?.global_context?.root_pc ?? 7);
        this.scheduler.setReferenceDrone(this.droneEnabled, 36 + rootPc);
        droneBtn.classList.toggle("drone-active", this.droneEnabled);
        droneBtn.innerHTML = this.droneEnabled ? "&#127925; Tonic Drone: ON" : "&#127925; Tonic Drone: Off";
        this.setWhyBanner(
          this.droneEnabled
            ? "<strong>Persistent Tonic Reference Drone Active (-18 dBFS):</strong> Holds the Home Root + 5th in your ear so you never lose tonal grounding while placing notes (prevents Deutsch retroactive pitch interference)."
            : "Tonic Reference Drone turned off."
        );
      });
    }

    // Surface B: White-Box Ghost Diff Previews on Transform Button Hover
    const bindDiffPreview = (btnId, actionName) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener("mouseenter", async () => {
        const res = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song: this.songDoc, action: "preview_diff", target_action: actionName }),
        });
        const data = await res.json();
        this.ghostAddedNotes = data.diff?.added_notes || [];
        this.renderAll();
      });
      btn.addEventListener("mouseleave", () => {
        if (this.ghostAddedNotes.length > 0) {
          this.ghostAddedNotes = [];
          this.renderAll();
        }
      });
    };
    bindDiffPreview("btn-kick-lock", "kick_lock");
    bindDiffPreview("btn-hocket-call-response", "hocket_call_response");
    bindDiffPreview("btn-lead-call-response", "lead_call_response");

    // Coaching Drawer Tabs (Surfaces C, D, E + Phase 5 Falsification Tab)
    for (const tab of document.querySelectorAll(".coach-tab")) {
      tab.addEventListener("click", () => {
        for (const t of document.querySelectorAll(".coach-tab")) t.classList.remove("active");
        tab.classList.add("active");
        const target = tab.dataset.coachTab;
        document.getElementById("coach-panel-diagnose").style.display = target === "diagnose" ? "block" : "none";
        document.getElementById("coach-panel-deconstruct").style.display = target === "deconstruct" ? "block" : "none";
        document.getElementById("coach-panel-ear-mission").style.display = target === "ear-mission" ? "block" : "none";
        const falsPanel = document.getElementById("coach-panel-falsification");
        if (falsPanel) falsPanel.style.display = target === "falsification" ? "block" : "none";
      });
    }

    // Surface C: Load 4-Mistake Demo & Fix All Issues
    const loadFlawedBtn = document.getElementById("btn-load-flawed-demo");
    if (loadFlawedBtn) {
      loadFlawedBtn.addEventListener("click", async () => {
        const res = await fetch("/api/songs/flawed_beginner_loop?reset=1");
        const data = await res.json();
        this.songDoc = data.song;
        this.compiledSong = data.compiled;
        this.diagnostics = data.diagnostics;
        this.scheduler.setCompiledSong(this.compiledSong);
        this._syncTransportInputs();
        this.setWhyBanner(
          "<strong>Loaded 4-Mistake Beginner Loop:</strong> Look at the <strong>Diagnostic Ear Coach</strong> below — it detected an Unresolved Downbeat Clash, a 100–500 Hz Mud Collision, a Weak Kick-Bass Pocket, and 4-Bar Monotony!"
        );
        this.renderAll();
      });
    }

    const fixAllBtn = document.getElementById("btn-fix-all-issues");
    if (fixAllBtn) {
      fixAllBtn.addEventListener("click", async () => {
        const res = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            song: this.songDoc,
            action: "apply_fix",
            fix: { fix_type: "fix_all" },
          }),
        });
        const data = await res.json();
        this.songDoc = data.song;
        this.compiledSong = data.compiled;
        this.diagnostics = data.diagnostics;
        this.scheduler.setCompiledSong(this.compiledSong);
        this.setWhyBanner(
          "<strong>All White-Box Fixes Applied!</strong> Clashing notes snapped to Tier 1 Chord Anchors, overlapping bass tails choked cleanly, Kick-Lock engaged, and 4-Bar Call &amp; Response projected!"
        );
        this.renderAll();
      });
    }

    // Surface D: Guided 4-Stage Layer Solo Deconstruction
    for (const stageBtn of document.querySelectorAll(".deconstruct-stage-btn")) {
      stageBtn.addEventListener("click", () => {
        for (const b of document.querySelectorAll(".deconstruct-stage-btn")) b.classList.remove("active");
        stageBtn.classList.add("active");
        const stage = Number(stageBtn.dataset.stage || 4);
        this._applyDeconstructionStage(stage);
      });
    }

    // Surface E: Progressive Gravity Fade Mode
    const gravFadeSel = document.getElementById("select-gravity-fade");
    if (gravFadeSel) {
      gravFadeSel.addEventListener("change", (ev) => {
        this.gravityFadeMode = ev.target.value;
        this.setWhyBanner(
          this.gravityFadeMode === "full"
            ? "<strong>Full Visual Gravity:</strong> Tier 1 Chord Anchors (Emerald) and Tier 2 Tension Tones (Amber) are fully illuminated."
            : this.gravityFadeMode === "ear_first"
            ? "<strong>Ear-First Dimmed Mode:</strong> Colors hide until you hover or place a note — training your ear to judge stability before checking the visual guide!"
            : "<strong>Blind Ear Mode:</strong> All color crutches hidden! Use the Tonic Reference Drone and your ear to find the Chord Anchors."
        );
        this.renderAll();
      });
    }
  }

  _applyDeconstructionStage(stage) {
    if (!this.compiledSong) return;
    const baseEvents = this.compiledSong.events || [];
    const allowedRoles =
      stage === 1
        ? new Set(["drums"])
        : stage === 2
        ? new Set(["drums", "harmony"])
        : stage === 3
        ? new Set(["drums", "harmony", "bass", "hocket"])
        : new Set(["drums", "harmony", "bass", "hocket", "lead"]);

    const filteredSong = {
      ...this.compiledSong,
      events: baseEvents.filter((e) => allowedRoles.has(e.role)),
    };
    this.scheduler.setCompiledSong(filteredSong);
    const descriptions = {
      1: "<strong>Layer 1 (Beat Only):</strong> Hear just the kick and snare establishing the main pulse.",
      2: "<strong>Layer 2 (+ Smooth Chords):</strong> Added connected chords gently making room for the beat.",
      3: "<strong>Layer 3 (+ Bass &amp; synth):</strong> Added the bass and synth voices answering in the gaps.",
      4: "<strong>Layer 4 (Full Band + Melody):</strong> All 4 parts playing together in complete clarity.",
    };
    this.setWhyBanner(descriptions[stage] || descriptions[4]);
  }

  _bindVolumeControl() {
    // Phase 8.0 decision 6: volume with a lock a carer can set (stored on this device only).
    const slider = document.getElementById("input-volume");
    const lockBtn = document.getElementById("btn-volume-lock");
    if (!slider || !lockBtn) return;
    const label = slider.labels?.[0];
    if (label) label.innerHTML = `${icon("speaker")}<span class="sr-only">Volume</span>`;
    const read = (k, d) => {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : v;
      } catch (_e) {
        return d;
      }
    };
    const write = (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (_e) {
        // storage unavailable: the setting lasts for this visit only
      }
    };
    const vol = Math.max(0, Math.min(100, Number(read("tonecanvas_volume", 80))));
    slider.value = String(vol);
    this.scheduler.setVolume(vol / 100);
    let unlockArmed = false;
    const applyLock = (locked) => {
      slider.disabled = locked;
      lockBtn.setAttribute("aria-pressed", locked ? "true" : "false");
      lockBtn.innerHTML = locked
        ? `${icon("lock")}<span class="sr-only"> Volume locked. Press twice to unlock</span>`
        : `${icon("unlock")}<span class="sr-only"> Lock volume</span>`;
      lockBtn.title = locked ? "Volume is locked (press twice to unlock)" : "Lock the volume";
    };
    applyLock(read("tonecanvas_volume_locked", "0") === "1");
    slider.addEventListener("input", () => {
      this.scheduler.setVolume(Number(slider.value) / 100);
      write("tonecanvas_volume", slider.value);
    });
    slider.addEventListener("change", () => this._announce(`Volume ${slider.value} percent.`));
    lockBtn.addEventListener("click", () => {
      const locked = lockBtn.getAttribute("aria-pressed") === "true";
      if (!locked) {
        applyLock(true);
        write("tonecanvas_volume_locked", "1");
        this._announce("Volume locked.");
      } else if (!unlockArmed) {
        unlockArmed = true;
        lockBtn.title = "Press again to unlock the volume";
        this._announce("Press again to unlock the volume.");
      } else {
        unlockArmed = false;
        applyLock(false);
        write("tonecanvas_volume_locked", "0");
        this._announce("Volume unlocked.");
      }
    });
    lockBtn.addEventListener("blur", () => {
      unlockArmed = false;
    });
  }

  _bindTopControls() {
    this._bindVolumeControl();
    const playBtn = document.getElementById("btn-play");
    const showStopped = () => {
      playBtn.classList.remove("playing");
      document.getElementById("play-icon").innerHTML = "&#9654;";
      document.getElementById("play-label").textContent = "Play Song";
      this.playFlow?.render();
    };
    this.scheduler.onPlaybackEnded = showStopped;
    const stopSound = () => {
      this.scheduler.stop();
      window.speechSynthesis?.cancel();
      this.droneEnabled = false;
      const droneButton = document.getElementById("btn-tonic-drone");
      if (droneButton) {
        droneButton.classList.remove("drone-active");
        droneButton.textContent = "Home Note Drone: Off";
      }
      showStopped();
      this._announce("Sound stopped.", { speak: false });
    };
    document.getElementById("btn-stop-sound").addEventListener("click", stopSound);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") stopSound();
    });
    const togglePlay = () => {
      if (this.scheduler.isPlaying) {
        this.scheduler.stop();
        showStopped();
      } else {
        this._logSessionEvent("start_tap", {});
        this.scheduler.start();
        if (!this.firstAudioLogged) {
          this.firstAudioLogged = true;
          this._logSessionEvent("first_playback_scheduled", {
            time_to_first_playback_scheduled_ms: Date.now() - (this.sessionLoadMs || Date.now()),
            measurement: "scheduler_start",
          });
        }
        playBtn.classList.add("playing");
        document.getElementById("play-icon").innerHTML = "&#9632;";
        document.getElementById("play-label").textContent = "Pause Song";
      }
    };
    playBtn.addEventListener("click", togglePlay);

    window.addEventListener("keydown", (ev) => {
      const activeEl = document.activeElement;
      const isInteractiveCellOrControl =
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(activeEl?.tagName) ||
        activeEl?.classList?.contains("step-cell");
      if (ev.code === "Space" && !isInteractiveCellOrControl) {
        ev.preventDefault();
        togglePlay();
      }
    });

    document.getElementById("input-bpm").addEventListener("change", (ev) => {
      const bpm=Math.max(70, Math.min(175, Number(ev.target.value) || 104));
      if(!musicFieldTempoAllowed(this.songDoc,bpm)) {
        ev.target.value=this.songDoc.global_context.bpm;
        this._announce('This field supports up to 160 BPM. Your pace is unchanged.');return;
      }
      this.songDoc.global_context.bpm = bpm;
      this.compileAndRefresh();
    });

    document.getElementById("input-swing").addEventListener("input", (ev) => {
      const val = Number(ev.target.value);
      document.getElementById("swing-val").textContent = val >= 0.55 ? "Laid-Back" : val <= 0.51 ? "Steady" : "Relaxed";
      this.songDoc.global_context.swing = val;
      this.compileAndRefresh(false);
    });

    document.getElementById("select-root").addEventListener("change", (ev) => {
      this.songDoc.global_context.root_pc = Number(ev.target.value);
      this.setWhyBanner(
        "Key Root updated! All relational bass, hocket, and melody anchors automatically transposed to stay locked in key."
      );
      this.compileAndRefresh();
    });

    document.getElementById("select-scale").addEventListener("change", (ev) => {
      this.songDoc.global_context.scale_type = ev.target.value;
      this.setWhyBanner(
        `Scale mode switched to <strong>${ev.target.value}</strong>! All scale-locked notes updated immediately.`
      );
      this.compileAndRefresh();
    });

    document.getElementById("toggle-auto-stabs").addEventListener("change", (ev) => {
      this.songDoc.auto_harmony_stabs = ev.target.checked;
      this.compileAndRefresh();
    });

    for (const tab of document.querySelectorAll(".step-tab")) {
      tab.addEventListener("click", () => {
        for (const t of document.querySelectorAll(".step-tab")) t.classList.remove("active");
        tab.classList.add("active");
        this.activeView = tab.dataset.view;
        this._updatePanelVisibility();
      });
    }

    for (const btn of document.querySelectorAll(".bar-btn")) {
      btn.addEventListener("click", () => {
        for (const b of document.querySelectorAll(".bar-btn")) b.classList.remove("active");
        btn.classList.add("active");
        this.activeBarFilter = btn.dataset.bar;
        this.renderAll();
      });
    }

    document.getElementById("btn-kick-lock").addEventListener("click", async () => {
      this.ghostAddedNotes = [];
      const res = await fetch("/api/hocket-transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song: this.songDoc, action: "kick_lock" }),
      });
      const data = await res.json();
      this.songDoc = data.song;
      this.compiledSong = data.compiled;
      this.diagnostics = data.diagnostics;
      this.scheduler.setCompiledSong(this.compiledSong);
      this.setWhyBanner(
        "<strong>Kick-Lock Applied:</strong> Downbeat 808 Sub &amp; Wobble anchors are now locked to your Kick drum steps while off-beat Growls and Lasers answer in the pocket!"
      );
      this.renderAll();
    });

    document.getElementById("btn-hocket-call-response").addEventListener("click", async () => {
      this.ghostAddedNotes = [];
      const res = await fetch("/api/hocket-transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song: this.songDoc, action: "hocket_call_response" }),
      });
      const data = await res.json();
      this.songDoc = data.song;
      this.compiledSong = data.compiled;
      this.diagnostics = data.diagnostics;
      this.scheduler.setCompiledSong(this.compiledSong);
      this.setWhyBanner(
        "<strong>4-Bar Hocket Call &amp; Response (A &rarr; A' &rarr; A &rarr; B) Built:</strong> Bar 1's monster motif now unfolds across all 4 bars with automatic patch rotation in Bar 2 and a 1/32 Vocal Chop turnaround in Bar 4!"
      );
      this.renderAll();
    });

    document.getElementById("btn-lead-call-response").addEventListener("click", async () => {
      this.ghostAddedNotes = [];
      const res = await fetch("/api/hocket-transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song: this.songDoc, action: "lead_call_response" }),
      });
      const data = await res.json();
      this.songDoc = data.song;
      this.compiledSong = data.compiled;
      this.diagnostics = data.diagnostics;
      this.scheduler.setCompiledSong(this.compiledSong);
      this.setWhyBanner(
        "<strong>Lead Hook Propagated (A &rarr; A' &rarr; A &rarr; B):</strong> Bar 1's melodic motif now adapts relationally to every bar's chord gravity with a Bar 4 resolution!"
      );
      this.renderAll();
    });

    const stepHistory = async (direction) => {
      try {
        const res = await fetch(direction === "undo" ? "/api/undo" : "/api/redo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song: this.songDoc }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.song) {
            this.songDoc = data.song;
            this.compiledSong = data.compiled;
            this.diagnostics = data.diagnostics;
            this.scheduler.setCompiledSong(this.compiledSong);
            this._syncTransportInputs();
            this.renderAll();
            this.setWhyBanner(direction === "undo" ? "Undid last change." : "Redid change.");
            return;
          }
        }
      } catch (_e) {
        // No server: use the local history below.
      }
      const from = direction === "undo" ? (this.localUndoStack = this.localUndoStack || []) : (this.localRedoStack = this.localRedoStack || []);
      const to = direction === "undo" ? (this.localRedoStack = this.localRedoStack || []) : this.localUndoStack;
      if (from.length === 0) {
        this.setWhyBanner(direction === "undo" ? "Nothing to undo yet." : "Nothing to redo.");
        return;
      }
      to.push(JSON.stringify(this.songDoc));
      this.songDoc = JSON.parse(from.pop());
      this._syncTransportInputs();
      await this.compileAndRefresh();
      this.setWhyBanner(direction === "undo" ? "Undid last change." : "Redid change.");
    };
    document.getElementById("btn-undo").addEventListener("click", () => stepHistory("undo"));
    document.getElementById("btn-redo").addEventListener("click", () => stepHistory("redo"));

    document.getElementById("btn-reset-seed").addEventListener("click", async () => {
      await this.loadInitialSong(this.activePresetId || "starter_neutral_100_cm", true);
      this.setWhyBanner(`Reloaded clean ${this.activePresetId || "starter_neutral_100_cm"} starter seed.`);
    });

    document.getElementById("btn-save").addEventListener("click", async () => {
      this._saveSongToLocalStorage(this.songDoc);
      this._logSessionEvent("song_saved", {
        song_id: this.songDoc?.id || "my_song",
        title: this.songDoc?.title || "My MusicLab Song",
      });
      try {
        const res = await fetch("/api/songs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song: this.songDoc }),
        });
        if (res.ok) {
          const sRes = await fetch("/api/songs");
          if (sRes.ok) {
            const sData = await sRes.json();
            this.savedSongsList = sData.songs || [];
          }
        }
      } catch (_e) {
        // saved in localStorage for static mode
      }
      this.setWhyBanner(
        `<strong>Saved "${this.songDoc?.title || "My MusicLab Song"}"!</strong> You can reopen and continue it anytime from <strong>Continue a Saved Song</strong>.`
      );
      this.renderAll();
    });

    document.getElementById("btn-export-wav").addEventListener("click", async () => {
      this.setWhyBanner("Preparing your finished stereo <code>.WAV</code> audio download...");
      const safeName = this._downloadBaseName();
      try {
        const blob = await this.scheduler.renderSongOfflineToWavBlob(this.compiledSong, null);
        triggerBlobDownload(blob, `${safeName}.wav`);
        this._logSessionEvent("wav_downloaded", { filename: `${safeName}.wav`, bars: this.compiledSong?.bars || 28 });
        this.setWhyBanner(
          `<strong>Downloaded <code>${safeName}.wav</code>!</strong> Your full ${this.compiledSong?.bars || 28}-bar song is saved to your device.`
        );
      } catch (_e) {
        try {
          const res = await fetch("/api/render-wav", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ song: this.songDoc }),
          });
          // The server keeps this copy in its own song folder, not on the person's device; say only what happened.
          this.setWhyBanner(res.ok ? `<strong>Made <code>${safeName}.wav</code> in the song folder.</strong>` : "<strong>Could not make the file.</strong>");
        } catch (_err2) {
          // ignore
        }
      }
    });

    document.getElementById("btn-dl-master-wav").addEventListener("click", async () => {
      this.setWhyBanner("Rendering Master Mix .WAV via browser OfflineAudioContext...");
      const blob = await this.scheduler.renderSongOfflineToWavBlob(this.compiledSong, null);
      triggerBlobDownload(blob, `${this._downloadBaseName()}_master.wav`);
      this.setWhyBanner("Downloaded Browser Master Mix <code>.wav</code>!");
    });

    document.getElementById("btn-dl-hocket-stem").addEventListener("click", async () => {
      this.setWhyBanner("Rendering Bass &amp; Synth Stem .WAV via browser OfflineAudioContext...");
      const blob = await this.scheduler.renderSongOfflineToWavBlob(this.compiledSong, "hocket_bass");
      triggerBlobDownload(blob, `${this._downloadBaseName()}_bass_stem.wav`);
      this.setWhyBanner("Downloaded Bass &amp; Synth Stem <code>.wav</code>!");
    });

    document.getElementById("btn-dl-drums-stem").addEventListener("click", async () => {
      this.setWhyBanner("Rendering Drums Stem .WAV via browser OfflineAudioContext...");
      const blob = await this.scheduler.renderSongOfflineToWavBlob(this.compiledSong, "drums");
      triggerBlobDownload(blob, `${this._downloadBaseName()}_drums_stem.wav`);
      this.setWhyBanner("Downloaded Drums Stem <code>.wav</code>!");
    });

    document.getElementById("btn-dl-patch-wav").addEventListener("click", async () => {
      const pId = this.sculptor.activePatchId;
      const meta = PATCH_META.find((p) => p.id === pId) || PATCH_META[0];
      const blob = await this.scheduler.renderPatchSampleOfflineToWavBlob(
        pId,
        meta.defaultHz || 55.0,
        this.sculptor.gesture,
        0.85
      );
      triggerBlobDownload(blob, `musiclab_${pId}_oneshot.wav`);
      this.setWhyBanner(`Downloaded sculpted <strong>${meta.name}</strong> one-shot sample (<code>musiclab_${pId}_oneshot.wav</code>)!`);
    });

    document.getElementById("btn-save-custom-patch").addEventListener("click", async () => {
      const pId = this.sculptor.activePatchId;
      const g = this.sculptor.gesture;
      const label = `${pId.split("_")[0].toUpperCase()} (${g.vowel_start || "O"}->${g.vowel_end || "I"})`;
      try {
        const res = await fetch("/api/custom-patches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: label,
            patch_id: pId,
            gesture: g,
          }),
        });
        if (!res.ok) throw new Error("Static fallback");
        const data = await res.json();
        this.customPatches = data.custom_patches || [];
      } catch (_e) {
        this.customPatches = [...(this.customPatches || []), { name: label, patch_id: pId, gesture: structuredClone(g) }];
      }
      this.setWhyBanner(`Saved custom sculpted noise <strong>${label}</strong> to your library!`);
      this.renderAll();
    });
  }

  _updatePanelVisibility() {
    const pArranger = document.getElementById("panel-arranger");
    const pGroove = document.getElementById("panel-groove");
    const pHarmony = document.getElementById("panel-harmony");
    const pHocket = document.getElementById("panel-hocket");
    const pMelody = document.getElementById("panel-melody");

    pArranger.style.display = this.activeView === "all" || this.activeView === "arranger" ? "block" : "none";
    pHarmony.style.display = "block";
    pGroove.style.display = this.activeView === "all" || this.activeView === "groove" ? "block" : "none";
    pHocket.style.display = this.activeView === "all" || this.activeView === "hocket" ? "block" : "none";
    pMelody.style.display = this.activeView === "all" || this.activeView === "melody" ? "block" : "none";
  }

  auditionPatch(patchId, gesture, customFreqHz = null) {
    const meta = PATCH_META.find((p) => p.id === patchId) || PATCH_META[0];
    const freq = customFreqHz || meta.defaultHz || 55.0;
    this.scheduler.auditionPatchNote(patchId, freq, gesture, 0.42);
  }

  handlePatchSelect(patchId) {
    if (!this.selectedNoteId) return;
    const note = (this.songDoc.notes || []).find((n) => n.id === this.selectedNoteId);
    if (note && (note.role === "hocket" || note.role === "bass")) {
      note.patch_id = patchId;
      this.compileAndRefresh();
    }
  }

  handleGestureChange(newGesture, shouldAudition) {
    const note = (this.songDoc?.notes || []).find((n) => n.id === this.selectedNoteId);
    if (note) {
      note.gesture = structuredClone(newGesture);
      this.compileAndRefresh(false);
      if (shouldAudition) {
        const compEv = (this.compiledSong?.events || []).find((e) => e.id === note.id);
        this.auditionPatch(note.patch_id, note.gesture, compEv?.concrete?.freq_hz);
      }
    } else if (shouldAudition) {
      this.auditionPatch(this.sculptor.activePatchId, newGesture);
    }
  }

  _renderFalsificationStudyPanel() {
    const container = document.getElementById("falsification-study-container");
    if (!container) return;
    if (!window.location.search.includes("dev=1")) {
      container.innerHTML = "";
      return;
    }

    const preRate = this.falsificationPreGrade?.strong_beat_chord_tone_rate_pct ?? null;
    const postRate = this.falsificationPostGrade?.strong_beat_chord_tone_rate_pct ?? null;
    const trapAcc = this.falsificationPostGrade?.height_trap_accuracy_pct ?? null;
    const delta = preRate !== null && postRate !== null ? Number((postRate - preRate).toFixed(1)) : null;
    const passesTransfer = delta !== null && delta >= 20.0 && (trapAcc ?? 0) >= 62.5;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">
        <div>
          <div style="font-size:12px; font-weight:700; color:#f8fafc;">
            &#129514; Developer Transfer Study Harness (New-Key Ear Check)
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">
            Tests whether listeners internalize note stability after marks fade in an untrained key.
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <label class="control-pill" style="padding:2px 8px; font-size:11px;">
            <span>Condition:</span>
            <select id="select-study-condition">
              <option value="treatment" ${this.falsificationCondition === "treatment" ? "selected" : ""}>Treatment (Post-Placement ● / ◇)</option>
              <option value="control" ${this.falsificationCondition === "control" ? "selected" : ""}>Control (Scale-Locked Plain Grid Only)</option>
            </select>
          </label>
          <button id="btn-study-load-pre" class="btn btn-sm btn-secondary">1. Load Pretest (C Maj, Marks Off)</button>
          <button id="btn-study-grade-pre" class="btn btn-sm btn-accent">Check Pretest</button>
          <button id="btn-study-load-post" class="btn btn-sm btn-secondary">2. Load Transfer Post-Test (F Maj, Marks Off)</button>
          <button id="btn-study-grade-post" class="btn btn-sm btn-accent">Check Post-Test</button>
          <button id="btn-study-export" class="btn btn-sm btn-ghost">&#11015; Export Study Receipt .JSON</button>
        </div>
      </div>
      <div style="margin-top:8px; font-size:11.5px; color:#e2e8f0; display:flex; gap:14px; flex-wrap:wrap;">
        <span><strong>Pretest (C Maj):</strong> ${preRate !== null ? `${preRate} pts settled-note rate` : "Not checked yet"}</span>
        <span><strong>Blind Transfer Post-Test (F Maj):</strong> ${postRate !== null ? `${postRate} pts settled-note rate` : "Not checked yet"}</span>
        <span><strong>Transfer Delta:</strong> ${
          delta !== null
            ? `<strong style="color:${passesTransfer ? "#34d399" : "#facc15"};">${delta >= 0 ? "+" : ""}${delta} pts</strong>`
            : "Complete Pre &amp; Post to compute"
        }</span>
      </div>
    `;

    document.getElementById("select-study-condition")?.addEventListener("change", (ev) => {
      this.falsificationCondition = ev.target.value;
      this.falsificationProtocol = generateFalsificationProtocolJS(this.falsificationCondition, "P01");
      this.gravityFadeMode = this.falsificationCondition === "control" ? "blind_ear" : "post_placement";
      const fadeSel = document.getElementById("select-gravity-fade");
      if (fadeSel) fadeSel.value = this.gravityFadeMode;
      this.setWhyBanner(
        this.falsificationCondition === "control"
          ? "<strong>Study Condition = CONTROL:</strong> Scale-locked plain grid only (post-placement ● / ◇ marks hidden)."
          : "<strong>Study Condition = TREATMENT:</strong> Post-placement ● / ◇ shape marks active during Build."
      );
      this.renderAll();
    });

    const loadTrialIntoSong = (block) => {
      this.activeFalsificationBlock = block;
      this.gravityFadeMode = "blind_ear";
      const fadeSel = document.getElementById("select-gravity-fade");
      if (fadeSel) fadeSel.value = "blind_ear";
      this.songDoc.global_context.root_pc = block.root_pc;
      this.songDoc.global_context.scale_type = block.scale_type;
      const progId = this.songDoc.active_progression_id || "prog-main";
      this.songDoc.chord_progressions[progId] = structuredClone(block.progression);
      // Clear lead notes on target steps so user places them by ear
      this.songDoc.notes = (this.songDoc.notes || []).filter((n) => n.role === "drums" || n.role === "bass");
      this._syncTransportInputs();
      this.compileAndRefresh();
    };

    document.getElementById("btn-study-load-pre")?.addEventListener("click", () => {
      loadTrialIntoSong(this.falsificationProtocol.pretest);
      this.setWhyBanner(
        "<strong>Loaded Pretest (Key of C Major, Marks OFF):</strong> Listen to the chords and place Lead notes on Beats 1 &amp; 3 of each bar (Steps 1, 9, 17, 25, 33, 41, 49, 57), then click <strong>Check Pretest</strong>."
      );
    });

    document.getElementById("btn-study-grade-pre")?.addEventListener("click", () => {
      this.falsificationPreGrade = gradeFalsificationTrialJS(this.falsificationProtocol.pretest, this.songDoc.notes);
      this.gravityFadeMode = this.falsificationCondition === "control" ? "blind_ear" : "post_placement";
      const fadeSel = document.getElementById("select-gravity-fade");
      if (fadeSel) fadeSel.value = this.gravityFadeMode;
      this.setWhyBanner(
        `<strong>Pretest Checked:</strong> Now build your 4-bar loop, then run the Blind Transfer Post-Test in F Major!`
      );
      this.renderAll();
    });

    document.getElementById("btn-study-load-post")?.addEventListener("click", () => {
      loadTrialIntoSong(this.falsificationProtocol.transfer_posttest);
      this.setWhyBanner(
        "<strong>Loaded Blind Transfer Post-Test (New Key: F Major, Marks OFF):</strong> Place Lead notes on Beats 1 &amp; 3 of each bar by ear, then click <strong>Check Post-Test</strong>."
      );
    });

    document.getElementById("btn-study-grade-post")?.addEventListener("click", () => {
      this.falsificationPostGrade = gradeFalsificationTrialJS(
        this.falsificationProtocol.transfer_posttest,
        this.songDoc.notes
      );
      if (this.falsificationPostGrade.should_fade_marks) {
        this.gravityFadeMode = "blind_ear";
        const fadeSel = document.getElementById("select-gravity-fade");
        if (fadeSel) fadeSel.value = "blind_ear";
      }
      this.setWhyBanner(`<strong>Blind Transfer Post-Test Checked!</strong>`);
      this.renderAll();
    });

    document.getElementById("btn-study-export")?.addEventListener("click", () => {
      const prov = this.provenanceSummary || computeProvenanceSummary(this.songDoc, this.compiledSong);
      const studyReceipt = {
        protocol_version: 1,
        exported_at_utc: new Date().toISOString(),
        condition: this.falsificationCondition,
        pretest_grade: this.falsificationPreGrade,
        transfer_posttest_grade: this.falsificationPostGrade,
        provenance_summary: prov,
      };
      const blob = new Blob([JSON.stringify(studyReceipt, null, 2)], { type: "application/json" });
      triggerBlobDownload(blob, `musiclab_study_${this.falsificationCondition}_receipt.json`);
    });
  }

  /** Listen until the person stops (button, Space or Enter) or goes quiet. Returns {status, notes}. */
  async _listenForHum(bannerEl = null) {
    const ctx = this.songDoc?.global_context || {};
    const wasPlaying = this.scheduler.isPlaying;
    const pausedForMic = wasPlaying && !this.humWithHeadphones;
    if (pausedForMic) document.getElementById("btn-play")?.click(); // don't record the speakers
    const controller = {};
    const stopBtn = document.createElement("button");
    stopBtn.className = bannerEl ? "pf-btn" : "btn btn-accent"; stopBtn.dataset.key = "stop-hum";
    stopBtn.id = "btn-stop-listening";
    stopBtn.innerHTML = bannerEl ? `${icon("stop")} Stop listening` : "&#9632; Stop listening";
    stopBtn.addEventListener("click", () => controller.stop && controller.stop());
    const onKey = (ev) => {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        if (controller.stop) controller.stop();
      }
    };
    const say = (html, spoken) => {
      this.setWhyBanner(html);
      if (bannerEl) bannerEl.innerHTML = html;
      this._announce(spoken);
    };
    say(
      bannerEl ? `<p class="pf-say">${icon("mic")} <strong>Listening.</strong> Hum a tune, then press <strong>Stop listening</strong>.</p>` : "<strong>&#127908; Listening&hellip;</strong> Hum your tune, then press <strong>Stop listening</strong> (or Space).",
      "Listening. Hum your tune, then press Space to stop."
    );
    (bannerEl || document.getElementById("why-text"))?.appendChild(stopBtn);
    stopBtn.focus();
    window.addEventListener("keydown", onKey, true);
    let result;
    try {
      result = await recordHummedPhraseToDraftNotes({
        bpm: Number(ctx.bpm || 100),
        rootPc: Number(ctx.root_pc ?? 0),
        scaleType: ctx.scale_type || "major",
        controller,
        onState: (s) => {
          if (s === "heard") this._announce("I can hear you.");
        },
      });
    } finally {
      window.removeEventListener("keydown", onKey, true);
      stopBtn.remove();
      // Recording completion never restarts music; Play remains an explicit action.
    }
    this._logSessionEvent("hum_listen", { status: result.status, note_count: result.notes.length });
    if (result.status !== "ok") {
      const msg = MusicLabStudioApp.HUM_MESSAGES[result.status] || MusicLabStudioApp.HUM_MESSAGES.error;
      say(`<strong>${msg}</strong>`, msg);
    }
    return result;
  }

  _announce(text, { speak = true } = {}) {
    const el = document.getElementById("sr-announcer");
    if (!el) return;
    if (speak) this.onAnnounce?.(text); // spoken prompts, when the comfort setup asks for them
    // Clear first so repeating the same message is still announced.
    el.textContent = "";
    setTimeout(() => {
      el.textContent = text;
    }, 50);
  }

  renderAll() {
    if (!this.songDoc || !this.compiledSong) return;


    // Update Provenance Badge (Zero-percentage plain-English ownership summary)
    this.provenanceSummary = computeProvenanceSummary(this.songDoc, this.compiledSong);
    const provLabelEl = document.getElementById("provenance-badge-label");
    if (provLabelEl && this.provenanceSummary) {
      provLabelEl.textContent =
        this.provenanceSummary.badge_label || "Starting point (make one change to make it yours)";
    }

    // Update Sound Check Badge & Diagnostic Count (Zero-percentage plain-English status)
    const issueCount = this.diagnostics?.issue_count ?? 0;
    const healthBadge = document.getElementById("health-score-badge");
    const diagCountEl = document.getElementById("diag-count-label");
    if (healthBadge) {
      healthBadge.textContent =
        issueCount === 0
          ? "Sound Check: All Clear"
          : `Sound Check: ${issueCount} ${issueCount === 1 ? "Place" : "Places"} to Check`;
      healthBadge.style.color = issueCount === 0 ? "#34d399" : "#facc15";
    }
    if (diagCountEl) diagCountEl.textContent = String(issueCount);

    this._renderFalsificationStudyPanel();

    renderDiagnosticCoachPanel(
      document.getElementById("diagnostic-issues-container"),
      this.diagnostics,
      {
        onAuditionIssueAB: (issue) => {
          const patch = issue.ab_preview_patch || {};
          if (patch.problem_midi && patch.resolved_midi) {
            const probFreq = 440.0 * Math.pow(2.0, (patch.problem_midi - 69.0) / 12.0);
            const resFreq = 440.0 * Math.pow(2.0, (patch.resolved_midi - 69.0) / 12.0);
            const barIdx = Number(issue.bar || 0) % 4;
            const chordFreqs = this.compiledSong?.voiced_chords?.[barIdx]?.voiced_freqs || [];
            this.scheduler.auditionNoteWithResolution(probFreq, chordFreqs, resFreq);
            this.setWhyBanner(
              `<strong>Auditioning Clash &rarr; Resolution (A/B):</strong> Playing the clashing note first, followed 360ms later by its Tier 1 Chord Anchor resolution over the active bar chord!`
            );
          } else {
            document.getElementById("btn-ab-bypass")?.click();
          }
        },
        onApplyFix: async (issue) => {
          const res = await fetch("/api/diagnose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              song: this.songDoc,
              action: "apply_fix",
              fix: issue.white_box_fix,
            }),
          });
          const data = await res.json();
          this.songDoc = data.song;
          this.compiledSong = data.compiled;
          this.diagnostics = data.diagnostics;
          this.scheduler.setCompiledSong(this.compiledSong);
          this.setWhyBanner(`<strong>Applied White-Box Fix:</strong> ${issue.problem_summary}`);
          this.renderAll();
        },
      }
    );

    renderEarMissionPanel(
      document.getElementById("ear-mission-container"),
      this.activeEarMission,
      this.lastMissionGrade,
      {
        onPlayMysteryPhrase: (mission) => {
          this.scheduler.auditionEarMission(mission);
          this.setWhyBanner(
            `<strong>Playing 2-Bar Call &amp; Response Target:</strong> Listen to how Bar 1 climbs up the triad and Bar 2 steps down to the Home Root on Steps 21 and 25!`
          );
        },
        onGradeMission: async (mission) => {
          const res = await fetch("/api/ear-mission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              song: this.songDoc,
              action: "grade",
              mission,
              user_notes: this.songDoc.notes,
            }),
          });
          const data = await res.json();
          this.lastMissionGrade = data.grade;
          this.setWhyBanner(`<strong>Ear Mission Result:</strong> ${data.grade?.feedback || ""}`);
          this.renderAll();
        },
        onNewMission: async () => {
          const res = await fetch("/api/ear-mission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              song: this.songDoc,
              action: "generate",
              difficulty: "starter",
            }),
          });
          const data = await res.json();
          this.activeEarMission = data.mission;
          this.lastMissionGrade = null;
          this.renderAll();
        },
      }
    );

    renderSongArranger(
      document.getElementById("song-arranger-container"),
      this.songDoc,
      this.compiledSong,
      this.activeSectionId,
      {
        onToggleArrangementMode: async (unfoldToSong) => {
          const res = await fetch("/api/arrange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              song: this.songDoc,
              action: unfoldToSong ? "unfold_song" : "return_loop",
            }),
          });
          const data = await res.json();
          this.songDoc = data.song;
          this.compiledSong = data.compiled;
          this.diagnostics = data.diagnostics;
          this.activeSectionId = null;
          this.scheduler.setLoopRange(0, null);
          this.scheduler.setCompiledSong(this.compiledSong);
          this.setWhyBanner(
            unfoldToSong
              ? "<strong>28-Bar Song Blueprint Unfolded!</strong> Your 4-bar core loop now drives a 7-section arrangement (Intro &rarr; Verse &rarr; Build &rarr; Drop 1 &rarr; Breakdown &rarr; Drop 2 &rarr; Outro) with automatic Snare Builds, Pre-Drop Fakeouts, and 808 Sub-Drops."
              : "Returned to <strong>4-Bar Core Loop Mode</strong> (64 steps)."
          );
          this.renderAll();
        },
        onUpdateSection: () => {
          this.compileAndRefresh();
        },
        onJumpToSection: (sec) => {
          if (!sec) {
            this.activeSectionId = null;
            this.scheduler.setLoopRange(0, null);
            this.setWhyBanner("Playing all 28 bars across the full Song Blueprint.");
          } else {
            this.activeSectionId = sec.id;
            const compSec = (this.compiledSong.sections || []).find((s) => s.id === sec.id);
            if (compSec) {
              this.scheduler.setLoopRange(compSec.start_step, compSec.end_step);
              this.scheduler.seekToStep(compSec.start_step);
              const energyLabel = sec.energy >= 0.85 ? "High Energy" : sec.energy >= 0.55 ? "Medium Lift" : "Gentle";
              this.setWhyBanner(
                `<strong>Looping ${sec.name}</strong> (Bars ${compSec.start_bar + 1}–${compSec.end_bar}, ${energyLabel}): ${sec.why_label || ""}`
              );
            }
          }
          this.renderAll();
        },
        onWhyUpdate: (msg) => this.setWhyBanner(msg),
      }
    );

    renderHarmonySpine(
      document.getElementById("chord-spine-grid"),
      this.songDoc,
      this.compiledSong,
      {
        onChordChange: (barIdx, picked) => {
          const progId = this.songDoc.active_progression_id || "prog-main";
          this.songDoc.chord_progressions[progId][barIdx] = {
            bar: barIdx,
            beats: 4,
            degree: picked.degree,
            roman: picked.roman,
            quality: picked.quality,
          };
          this.compileAndRefresh();
        },
        onWhyUpdate: (msg) => this.setWhyBanner(msg),
      }
    );

    renderHocketMatrix(
      document.getElementById("hocket-matrix-container"),
      this.songDoc,
      this.compiledSong,
      this.activeBarFilter,
      this.selectedNoteId,
      {
        ghostAddedNotes: this.ghostAddedNotes,
        onToggleHocketCell: (step, patch, existingNote) => {
          if (existingNote) {
            if (this.selectedNoteId === existingNote.id) {
              this.songDoc.notes = this.songDoc.notes.filter((n) => n.id !== existingNote.id);
              this.selectedNoteId = null;
              this.compileAndRefresh();
            } else {
              this.selectedNoteId = existingNote.id;
              this.sculptor.loadNoteContext(existingNote, `Step ${step + 1} • ${patch.name}`);
              const compEv = (this.compiledSong.events || []).find((e) => e.id === existingNote.id);
              this.auditionPatch(existingNote.patch_id, existingNote.gesture, compEv?.concrete?.freq_hz);
              this.renderAll();
            }
            return;
          }

          this.songDoc.notes = (this.songDoc.notes || []).filter(
            (n) => !((n.role === "hocket" || n.role === "bass") && Number(n.step) === step)
          );

          const newNote = {
            id: `hocket-${step}-${patch.id}-${Date.now() % 10000}`,
            step,
            duration_steps: 2,
            velocity: 0.92,
            role: patch.id === "sub_drop_808" ? "bass" : "hocket",
            patch_id: patch.id,
            pitch_lock_mode: "relational",
            provenance: "user_placed",
            relational: {
              anchor: "chord_tone",
              chord_tone_index: step % 4 === 0 ? 0 : 1,
              scale_degree_offset: 0,
              octave_offset: patch.id === "laser_screech" || patch.id === "vocal_chop" ? 1 : 0,
            },
            gesture: structuredClone(this.sculptor.gesture),
          };
          this.songDoc.notes.push(newNote);
          this.selectedNoteId = newNote.id;
          this.sculptor.loadNoteContext(newNote, `Step ${step + 1} • ${patch.name}`);
          this.auditionPatch(patch.id, newNote.gesture);
          this.compileAndRefresh();
        },
        onSelectPatchRow: (patchId) => {
          this.sculptor.activePatchId = patchId;
          this.sculptor.render();
          this.auditionPatch(patchId, this.sculptor.gesture);
        },
        onWhyUpdate: (msg) => this.setWhyBanner(msg),
      }
    );

    renderDrumMatrix(
      document.getElementById("drum-matrix-container"),
      this.songDoc,
      this.compiledSong,
      this.activeBarFilter,
      {
        onToggleDrumCell: (step, drumId, existing) => {
          if (existing) {
            this.songDoc.notes = this.songDoc.notes.filter((n) => n !== existing);
          } else {
            this.songDoc.notes.push({
              id: `drum-${drumId}-${step}`,
              step,
              duration_steps: 1,
              velocity: drumId === "kick" || drumId === "snare" ? 0.95 : 0.76,
              role: "drums",
              patch_id: drumId,
              provenance: "user_placed",
            });
          }
          this.compileAndRefresh();
        },
        onWhyUpdate: (msg) => this.setWhyBanner(msg),
      }
    );

    renderMelodyMatrix(
      document.getElementById("melody-matrix-container"),
      this.songDoc,
      this.compiledSong,
      this.activeBarFilter,
      this.selectedNoteId,
      {
        gravityFadeMode: this.gravityFadeMode,
        missionTargetSteps: this.activeEarMission?.target_steps || [],
        ghostAddedNotes: this.ghostAddedNotes,
        onToggleMelodyCell: async (step, mRow, existing) => {
          if (existing) {
            this.songDoc.notes = this.songDoc.notes.filter((n) => n.id !== existing.id);
            if (this.selectedNoteId === existing.id) this.selectedNoteId = null;
            await this.compileAndRefresh();
          } else {
            const leadPatch = this.songDoc.genre_preset === "neutral_starter" ? "pluck_lead" : "supersaw_stab";
            const newLead = {
              id: `lead-${step}-${Date.now() % 10000}`,
              step,
              duration_steps: 2,
              velocity: 0.85,
              role: "lead",
              patch_id: leadPatch,
              pitch_lock_mode: "relational",
              provenance: "user_placed",
              relational: {
                anchor: "chord_tone",
                chord_tone_index: mRow.ctIndex,
                scale_degree_offset: mRow.degOffset,
                octave_offset: mRow.octOffset,
              },
            };
            this.songDoc.notes.push(newLead);
            this.selectedNoteId = newLead.id;
            await this.compileAndRefresh();
            const compEv = (this.compiledSong?.events || []).find((e) => e.id === newLead.id);
            const barIdx = Math.floor(step / 16) % 4;
            const vc = this.compiledSong?.voiced_chords?.[barIdx];
            if (compEv && vc) {
              const noteFreq = compEv.concrete?.freq_hz || 440.0;
              const resPc = compEv.resolution_target_pc ?? vc.chord_root_pc ?? 7;
              const resFreq =
                mRow.degOffset !== 0 ? 440.0 * Math.pow(2.0, (60 + resPc - 69.0) / 12.0) : null;
              this.scheduler.auditionNoteWithResolution(noteFreq, vc.voiced_freqs || [], resFreq);
            }
          }
        },
        onWhyUpdate: (msg) => this.setWhyBanner(msg),
      }
    );

    const rawSelected = (this.songDoc.notes || []).find((n) => n.id === this.selectedNoteId) || null;
    const compSelected = (this.compiledSong.events || []).find((e) => e.id === this.selectedNoteId) || null;
    renderNoteInspector(this.inspectorDetailsEl, rawSelected, compSelected, {
      onTogglePitchLock: (note) => {
        if (note.pitch_lock_mode === "concrete") {
          note.pitch_lock_mode = "relational";
        } else {
          note.pitch_lock_mode = "concrete";
          note.concrete = compSelected?.concrete || { midi_pitch: 60 };
        }
        this.compileAndRefresh();
      },
      onDeleteNote: (note) => {
        this.songDoc.notes = this.songDoc.notes.filter((n) => n.id !== note.id);
        this.selectedNoteId = null;
        this.compileAndRefresh();
      },
    });

    if (this.customPatchesRowEl) {
      this.customPatchesRowEl.innerHTML = "";
      if (this.customPatches.length === 0) {
        this.customPatchesRowEl.innerHTML = `<span style="font-size:10.5px; color:#64748b;">Drag the 2D Monster Pad and click "+ Save Current Noise" to build your palette.</span>`;
      } else {
        for (const cp of this.customPatches) {
          const btn = document.createElement("button");
          btn.className = "gesture-badge-btn";
          btn.textContent = cp.name;
          btn.addEventListener("click", () => {
            this.sculptor.activePatchId = cp.patch_id;
            this.sculptor.gesture = structuredClone(cp.gesture);
            this.sculptor.render();
            this.handleGestureChange(this.sculptor.gesture, true);
            this.setWhyBanner(`Loaded custom sculpted noise: <strong>${cp.name}</strong>`);
          });
          this.customPatchesRowEl.appendChild(btn);
        }
      }
    }

    drawMacroXRayCanvas(this.xrayCanvas, this.compiledSong, Math.max(0, this.lastVisualStep));
  }

  _stopMusicDirector() {
    this.playFlow?.cancelFieldGesture();
    clearInterval(this.musicDirectorTimer);
    this.musicDirectorTimer = null;
  }

  _startMusicDirector() {
    if (this.musicDirectorTimer != null) return;
    this.musicDirectorTimer = setInterval(() => {
      try {
        this.playFlow?.advanceMusic();
      } catch (error) {
        this._stopMusicDirector();
        console.error('Music progression paused', error);
        this._announce('Automatic changes paused. Your music is safe. Stop is still available.');
      }
    }, 100);
  }

  _startVisualLoop() {
    const freqData = new Uint8Array(64);
    const tick = () => {
      const stepEvt = this.scheduler.drainVisualStep();
      const visualActive = this.scheduler.isPlaying || this.scheduler.isCelebratingPlayback?.();
      this.playFlow?.onTick(stepEvt, Boolean(visualActive));
      if (document.body.classList.contains("pf-mode")) {
        // Play mode hides the studio, so its playhead, x-ray and meter canvases are not redrawn.
        window.requestAnimationFrame(tick);
        return;
      }
      if (stepEvt && stepEvt.step !== this.lastVisualStep) {
        this.lastVisualStep = stepEvt.step;
        const localStep = stepEvt.step % 64;
        this.playheadLabelEl.textContent = `${stepEvt.step + 1} / ${this.compiledSong?.total_steps || 64}`;
        for (const el of document.querySelectorAll(".step-cell.playhead")) {
          el.classList.remove("playhead");
        }
        for (const el of document.querySelectorAll(`.step-cell[data-step="${localStep}"]`)) {
          el.classList.add("playhead");
        }
        const activeBar = Math.floor(localStep / 16);
        for (const card of document.querySelectorAll(".chord-card")) {
          card.classList.toggle("active-bar", Number(card.dataset.bar) === activeBar);
        }
        for (const secCard of document.querySelectorAll(".section-card")) {
          const sStart = Number(secCard.dataset.startStep || 0);
          const sEnd = Number(secCard.dataset.endStep || 64);
          secCard.classList.toggle("playing-section", stepEvt.step >= sStart && stepEvt.step < sEnd);
        }
        drawMacroXRayCanvas(this.xrayCanvas, this.compiledSong, stepEvt.step);
      }

      if (this.scheduler.masterBus?.analyser) {
        this.scheduler.masterBus.analyser.getByteFrequencyData(freqData);
        const ctx = this.spectrumCanvas.getContext("2d");
        const w = this.spectrumCanvas.width;
        const h = this.spectrumCanvas.height;
        ctx.clearRect(0, 0, w, h);
        const bars = 32;
        const bw = w / bars;
        for (let i = 0; i < bars; i++) {
          const val = freqData[i] / 255.0;
          const bh = Math.max(2, val * (h - 4));
          ctx.fillStyle = i < 6 ? "#f43f5e" : i < 18 ? "#a855f7" : "#06b6d4";
          ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        }
      }

      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.musicLabApp = new MusicLabStudioApp();
});
