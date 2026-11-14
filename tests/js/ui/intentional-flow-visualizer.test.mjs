import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { MelodyFieldSession, MELODY_SOUNDS, MELODY_SOUND_FAMILIES } from "../../../static/ui/melody_field_session.js";
import { startJam, setJamDirection } from "../../../static/js/theory/jam_session.js";
import { buildLiveScoreModel, computeLiveScoreFrame } from "../../../static/js/theory/live_score_model.js";
import { syncLiveScoreSvg, renderLiveScoreInnerSvg } from "../../../static/ui/live_score_visualizer.js";
import { buildMelodyPalette, VOCABULARY_VERSION } from "../../../static/js/theory/melody_composer_v5.js";
import { sceneHarmonyFor } from "../../../static/js/theory/phrase_harmony.js";

function storage() {
  const values = new Map(), session = new Map();
  return {
    localStorage: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    },
    sessionStorage: {
      getItem: (k) => session.get(k) ?? null,
      setItem: (k, v) => session.set(k, v),
      removeItem: (k) => session.delete(k),
    },
    scrollTo() {},
  };
}

function setupFlow(win = storage()) {
  globalThis.window = win;
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = {
    scheduler: {
      isPlaying: false,
      stopGeneration: 0,
      spotlightRole: null,
      audioCtx: { currentTime: 0 },
      setCompiledSong() {},
      setLoopRange() {},
      setRepeatPlayback() {},
      clearMuteLayers() {},
      setSpotlightRole(role) {
        this.spotlightRole = role;
      },
      unlock: async () => {},
      previewSound() {},
      stop() {
        this.isPlaying = false;
      },
      start() {
        this.isPlaying = true;
      },
      capturePerformance: () => null,
      activeJamBacking: () => null,
      queueContinuousPartAudition: () => ({ ok: true }),
      getPartAuditionState: () => null,
      masterBus: { piano: {}, disposed: false },
    },
    _announce() {},
    _logSessionEvent() {},
  };
  flow.render = () => {};
  flow._sparkAt = () => {};
  flow.stage = "start";
  flow.trail = [];
  flow.confirm = {};
  flow._freshState();
  return flow;
}

function stripDetails(html) {
  let s = html;
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, (m) => {
      const sum = m.match(/<summary\b[^>]*>[\s\S]*?<\/summary>/i)?.[0] || "";
      return sum;
    });
  }
  return s;
}

function visibleButtonLabels(html) {
  const top = stripDetails(html);
  const out = [];
  for (const m of top.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attrs = m[1] || "";
    if (/\bhidden\b/i.test(attrs)) continue;
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

function countTopScanStops(html) {
  const top = stripDetails(html);
  const matches = top.match(/<(button|summary|select|input|a)\b[^>]*>/gi) || [];
  const roleStops = top.match(/tabindex="0"/gi) || [];
  return matches.length + roleStops.length;
}

test("Button discipline & calm scan budget hold across Start, Jam, Melody, Refine, and Keep", () => {
  const flow = setupFlow();

  // 1. Start screen
  const startHtml = flow._renderStart();
  for (const label of visibleButtonLabels(startHtml)) {
    assert.ok(label.split(/\s+/).length <= 3, `Start button <= 3 words: "${label}"`);
  }
  assert.ok(countTopScanStops(startHtml) <= 35, "Start scan stops <= 35");

  // 2. Circle Jam screen
  flow.stage = "jam";
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "warm_keys" }));
  flow.doc.jam_session.showcase_version = 1;
  flow.doc.jam_session.exploration_map = "catalogue-circle-v2";
  flow.doc.jam_session.scene_id = "house-v1";
  flow._compile();
  const circleJamHtml = flow._renderJam();
  for (const label of visibleButtonLabels(circleJamHtml)) {
    assert.ok(label.split(/\s+/).length <= 3, `Circle Jam button <= 3 words: "${label}"`);
  }
  assert.ok(countTopScanStops(circleJamHtml) <= 35, `Circle Jam scan stops <= 35 (got ${countTopScanStops(circleJamHtml)})`);
  assert.match(circleJamHtml, /data-live-score/, "Circle Jam renders shared causal live score strip");
  assert.match(circleJamHtml, /data-key="melody-field-enter"/, "Circle Jam exposes Make my tune as equal pillar");
  assert.match(circleJamHtml, /Go deeper/, "Circle Jam folds secondary sound tweaks behind Go deeper");

  // 3. Honeycomb Jam screen
  delete flow.doc.jam_session.exploration_map;
  const hexJamHtml = flow._renderJam();
  for (const label of visibleButtonLabels(hexJamHtml)) {
    assert.ok(label.split(/\s+/).length <= 3, `Honeycomb Jam button <= 3 words: "${label}"`);
  }
  assert.ok(countTopScanStops(hexJamHtml) <= 35, "Honeycomb Jam scan stops <= 35");
  assert.match(hexJamHtml, /data-live-score/, "Honeycomb Jam renders shared causal live score strip");

  // 4. Classic Jam screen
  delete flow.doc.jam_session.showcase_version;
  const classicJamHtml = flow._renderJam();
  for (const label of visibleButtonLabels(classicJamHtml)) {
    assert.ok(label.split(/\s+/).length <= 3, `Classic Jam button <= 3 words: "${label}"`);
  }
  assert.ok(countTopScanStops(classicJamHtml) <= 35, "Classic Jam scan stops <= 35");
  assert.match(classicJamHtml, /data-live-score/, "Classic Jam renders shared causal live score strip");

  // 5. Keep screen (+ persisted Softer band mix truth on Refine / Keep)
  flow.stage = "keep";
  assert.equal(flow._liveScoreData().model.backingDimState, "full", "Unattenuated Keep score shows full backing opacity");
  flow.doc.capture_notes = { melody_field: { context: { bandBalance: 1 } } };
  assert.equal(flow._liveScoreData().model.backingDimState, "soft", "Committed Softer band persists soft backing dimming onto Keep");
  flow.stage = "tune";
  assert.equal(flow._liveScoreData().model.backingDimState, "soft", "Committed Softer band persists soft backing dimming onto Refine");
  flow.stage = "keep";
  const keepHtml = flow._renderKeep();
  for (const label of visibleButtonLabels(keepHtml)) {
    assert.ok(label.split(/\s+/).length <= 3, `Keep button <= 3 words: "${label}"`);
  }
  assert.ok(countTopScanStops(keepHtml) <= 35, "Keep scan stops <= 35");
  assert.match(keepHtml, /data-live-score/, "Keep screen renders shared causal live score strip");
});

test("Melody wheel session renders Original ghost, beat-handoff preview, backing dimming, and <= 3-word buttons", () => {
  const flow = setupFlow();
  flow.stage = "jam";
  flow._acceptJamDoc(startJam(flow.doc, { kind: "pitched", patchId: "sampled_piano_v1" }));
  flow.doc = setJamDirection(flow.doc, { scene_id: "house-v1" });
  // Ensure at least one user_placed lead note + jam_generated backing
  const personalNote = {
    id: "user-own-1",
    role: "lead",
    patch_id: "sampled_piano_v1",
    step: 0,
    duration_steps: 4,
    velocity: 0.85,
    provenance: "user_placed",
    concrete: { midi_pitch: 64, freq_hz: 329.63 },
  };
  const song = {
    ...flow.app.compiledSong,
    song_id: "mf-vis-song",
    bpm: 124,
    total_steps: 64,
    steps_per_bar: 16,
    events: [...(flow.app.compiledSong?.events || []).filter((e) => e.role !== "lead"), personalNote],
  };
  const phraseCtx = {
    root: 0,
    minor: false,
    sceneId: "house-v1",
    harmony: sceneHarmonyFor("house-v1", false),
    vocabularyVersion: VOCABULARY_VERSION,
    composerVersion: 5,
    bpm: 124,
    patch: "sampled_piano_v1",
    register: [52, 76],
    centre: 64,
    lead: [personalNote],
    source: song,
  };

  let auditionState = { sectionId: null, realizedId: null, scheduledId: null };
  const scheduler = {
    isPlaying: true,
    spotlightRole: null,
    gridOriginTime: 0,
    audioCtx: { currentTime: 0.5, baseLatency: 0 },
    lastVisualClock: { time: 0.5 },
    visualNotes: [{ time: 0, end: 1.0, event: { id: "user-own-1" } }],
    queueContinuousPartAudition(view, opts) {
      assert.equal(opts.joinSteps, 4, "Melody handoff is on beats, not a promised full bar");
      auditionState = { sectionId: opts.sectionId, realizedId: auditionState.realizedId, scheduledId: opts.requestId };
      return { ok: true };
    },
    getPartAuditionState() {
      return auditionState;
    },
  };

  const session = new MelodyFieldSession(song, {
    scheduler,
    captureOrigin: 0,
    root: 0,
    scale: "major",
    sourceDoc: flow.doc,
    phraseContext: phraseCtx,
  });
  session.palette = buildMelodyPalette(phraseCtx);
  session.candidates.clear();
  const originCand = session._candidate({ x: 0, y: 0 });
  session.requestId = originCand.id;
  session.realizedId = originCand.id;
  auditionState = { sectionId: session.sectionId, realizedId: originCand.id, scheduledId: originCand.id };

  const html = session.html();
  for (const label of visibleButtonLabels(html)) {
    assert.ok(label.split(/\s+/).length <= 3, `Melody wheel button <= 3 words: "${label}"`);
  }
  assert.ok(countTopScanStops(html) <= 35, `Melody wheel scan stops <= 35 (got ${countTopScanStops(html)})`);
  assert.match(html, /Back to jam/, "Melody return button uses 3-word Back to jam label");
  assert.match(html, /Refine notes/, "Melody wheel offers direct Refine notes bridge");

  // Sound wheel: the group ring (with each possible chosen sound's second line) and every group's sound ring.
  session.setSoundMode(true);
  const soundStops = [];
  for (const sound of MELODY_SOUNDS) {
    session.soundPatch = sound.patch;
    const ringHtml = session.html();
    for (const label of visibleButtonLabels(ringHtml)) {
      assert.ok(label.split(/\s+/).length <= 3, `Sound wheel group ring button <= 3 words: "${label}"`);
    }
    soundStops.push(countTopScanStops(ringHtml));
    assert.ok(countTopScanStops(ringHtml) <= 35, `Sound wheel group ring scan stops <= 35 (got ${countTopScanStops(ringHtml)})`);
  }
  for (const family of MELODY_SOUND_FAMILIES) {
    session.soundView = family.name;
    session.soundPatch = MELODY_SOUNDS.find((s) => s.family === family.name).patch;
    const ringHtml = session.html();
    for (const label of visibleButtonLabels(ringHtml)) {
      assert.ok(label.split(/\s+/).length <= 3, `${family.name} sound ring button <= 3 words: "${label}"`);
    }
    soundStops.push(countTopScanStops(ringHtml));
    assert.ok(countTopScanStops(ringHtml) <= 35, `${family.name} sound ring scan stops <= 35 (got ${countTopScanStops(ringHtml)})`);
  }
  assert.ok(Math.max(...soundStops) <= 35);
  session.setSoundMode(false);
  session.soundPatch = null;

  // Create minimal DOM mock for session.paint()
  const makeFakeSvg = () => {
    const el = {
      dataset: {},
      innerHTML: "",
      firstChild: null,
      setAttribute(k, v) {
        if (k === "data-vis-signature") this.dataset.visSignature = v;
      },
      querySelector(sel) {
        if (sel.includes("data-vis-backing")) return this._backing;
        if (sel.includes("data-vis-playhead")) return this._head;
        if (sel.includes("data-vis-ball")) return this._ball;
        if (sel.includes("data-vis-calm-beat")) return this._calm;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      _backing: { style: {}, dataset: {} },
      _head: { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
      _ball: { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
      _calm: { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
    };
    Object.defineProperty(el, "firstChild", {
      get() {
        return this.innerHTML ? {} : null;
      },
    });
    return el;
  };

  const fakeSvg = makeFakeSvg();
  const fakeCaption = { textContent: "" };
  session.root = {
    querySelector(sel) {
      if (sel === "[data-mf-score]") return fakeSvg;
      if (sel === "[data-mf-score-caption]") return fakeCaption;
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  // At Origin: user_placed note renders with .own class and no ghost
  session.paint();
  assert.match(fakeSvg.innerHTML, /pf-part-tune own/, "Personal user_placed note carries .own bright-edge class");
  assert.doesNotMatch(fakeSvg.innerHTML, /data-vis-ghost="original"/, "Origin does not duplicate ghost over itself");
  assert.equal(fakeSvg._head.style.visibility, "visible", "Playhead visible while playing");

  // Request new wheel region before beat handoff -> pending preview appears!
  session.request({ x: 0.2, y: 0.85 });
  assert.match(fakeSvg.innerHTML, /data-vis-preview="requested"/, "Pending wheel move renders the next tune preview");
  assert.equal(fakeCaption.textContent, "Next choice is a preview. Keep saves the main tune.");

  // Realize the new candidate at the scheduled beat -> Original ghost appears!
  auditionState.realizedId = session.requestId;
  session.paint();
  assert.match(fakeSvg.innerHTML, /data-vis-ghost="original"/, "Realized wheel candidate renders Original ghost");
  assert.equal(fakeCaption.textContent, "New tune shown over your first tune.");

  // Toggle Softer band -> backing opacity dims
  session.toggleBandBalance();
  auditionState.realizedId = session.requestId;
  session.paint();
  assert.equal(fakeSvg._backing.dataset.visBackingDim, "soft", "Softer band dims backing layer");
  assert.ok(Number(fakeSvg._backing.style.opacity) < 0.7, "Backing opacity reduced below 0.7");

  // Original toggle safely returns to starting tune and remembers explored spot
  session.toggleOriginal();
  auditionState.realizedId = session.requestId;
  session.paint();
  assert.doesNotMatch(fakeSvg.innerHTML, /data-vis-ghost="original"/, "Returning to Original shows pure first tune");
  session.toggleOriginal();
  assert.ok(Math.hypot(session.position.x, session.position.y) > 0.4, "Second Original press restores explored wheel spot");
});

test("syncLiveScoreSvg enforces Calm stepped mode, idle stillness, and >24ms frame-budget auto-throttling", () => {
  const model = buildLiveScoreModel({
    events: [
      { id: "n1", role: "lead", step: 0, duration_steps: 4, provenance: "user_placed", concrete: { midi_pitch: 64 } },
      { id: "b1", role: "bass", step: 0, duration_steps: 4, provenance: "jam_generated", concrete: { midi_pitch: 40 } },
    ],
    bpm: 120,
  });

  const inner = renderLiveScoreInnerSvg(model, { includeMfAttrs: true });
  assert.match(inner, /data-mf-note=/, "Melody score notes carry data-mf-note");
  assert.match(inner, /data-mf-playhead/, "Melody playhead carries data-mf-playhead");

  const makeSvg = () => {
    const state = { html: "", sig: "" };
    const head = { style: { visibility: "hidden" }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const ball = { style: { visibility: "hidden" }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const calm = { style: { visibility: "hidden" }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    return {
      dataset: {},
      get innerHTML() { return state.html; },
      set innerHTML(v) { state.html = v; },
      get firstChild() { return state.html ? {} : null; },
      querySelector(sel) {
        if (sel.includes("data-vis-playhead")) return head;
        if (sel.includes("data-vis-ball")) return ball;
        if (sel.includes("data-vis-calm-beat")) return calm;
        return null;
      },
      querySelectorAll() { return []; },
      _head: head,
      _ball: ball,
      _calm: calm,
    };
  };

  // 1. Stopped/Idle: playhead, ball, and calm beat all hidden
  const svg = makeSvg();
  const idleFrame = computeLiveScoreFrame({ isPlaying: false, positionSteps: 12, bpm: 120, quiet: false });
  syncLiveScoreSvg(svg, { model, frame: idleFrame, nowMs: 100 });
  assert.equal(svg._head.style.visibility, "hidden");
  assert.equal(svg._ball.style.visibility, "hidden");
  assert.equal(svg._calm.style.visibility, "hidden");

  // 2. Calm mode while playing: ball hidden, calm beat visible, playhead stepped
  const calmFrame = computeLiveScoreFrame({ isPlaying: true, positionSteps: 6.7, bpm: 120, quiet: true });
  syncLiveScoreSvg(svg, { model, frame: calmFrame, nowMs: 116 });
  assert.equal(svg._head.style.visibility, "visible");
  assert.equal(svg._ball.style.visibility, "hidden", "Bouncing ball hidden in Calm mode");
  assert.equal(svg._calm.style.visibility, "visible", "Calm beat marker visible in Calm mode");

  // 3. Over-budget frame sequence (>24ms) triggers 30fps auto-throttling
  let t = 200;
  for (let i = 0; i < 5; i++) {
    t += 35; // 35ms >= 33ms so every frame paints while smoothedDtMs rises > 24ms
    const f = computeLiveScoreFrame({ isPlaying: true, positionSteps: i * 4, bpm: 120, quiet: false });
    syncLiveScoreSvg(svg, { model, frame: f, nowMs: t });
  }
  const beforeX = svg._head.attrs.x1;
  // Next call only 16ms after last paint (t) should be skipped due to throttling (< 33ms)
  const skippedFrame = computeLiveScoreFrame({ isPlaying: true, positionSteps: 32, bpm: 120, quiet: false });
  syncLiveScoreSvg(svg, { model, frame: skippedFrame, nowMs: t + 16 });
  assert.equal(svg._head.attrs.x1, beforeX, "Throttled visualizer skips sub-33ms paint to protect Web Audio");
  // At +34ms after last paint it paints cleanly
  syncLiveScoreSvg(svg, { model, frame: skippedFrame, nowMs: t + 34 });
  assert.notEqual(svg._head.attrs.x1, beforeX, "Throttled visualizer paints at 30fps cadence");
});
