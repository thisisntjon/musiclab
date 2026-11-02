/**
 * Play-flow self-test, run by opening the app with ?selftest=1 (with the server or as static files).
 * It drives catalogue → jam → beat → tune → underneath → song → keep using Space and Enter (two-switch scanning),
 * checks that the loop never starts without Play (9a-11), and measures pad sizes and sideways scroll (9a-5).
 * Phase 9b adds: a kit picked by ear, the ending tab with a shape, a feel underneath, and a render of each
 * kit's clap and snare in this browser's own audio engine (9b-3: centroids at least 300 Hz apart).
 * Phase 9c + 10 adds: whole-page audit (`auditRoot(document.body)`) on every stage including `song` and `all_at_once`,
 * measured scan stops, in-flow hum status/retry check, and multi-card song verification.
 * Historical fixed choice/scan budgets are diagnostics, not evidence-based access gates.
 */
import { madeByYou } from "../js/theory/session_rules.js";
import { DRUM_KITS, triggerDrumVoice } from "../js/audio/voices.js";
import { auditRoot } from "./page_audit.js";
import { COMFORT_KEY, loadComfort } from "../js/theory/comfort.js";
import { createSpeaker } from "../js/audio/speech.js";
import { clearWorkingSong, deletePiece, savePiece, SLOT_COUNT } from "../js/theory/save_store.js";
import { FEELS, applyUnderneath, clearUnderneath, chordOptions } from "../js/theory/underneath.js";
import { compileSongStandalone } from "./standalone_compiler.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let onPress = () => {};
async function press(key) {
  onPress();
  const target = document.activeElement || document.body;
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  await wait(40);
}

function geometry(root) {
  const pads = [...root.querySelectorAll(".pf-pad")].map((p) => p.getBoundingClientRect());
  return {
    viewport: [window.innerWidth, window.innerHeight],
    pads: pads.length,
    min_pad_px: pads.length ? Math.round(Math.min(...pads.map((r) => Math.min(r.width, r.height)))) : null,
    sideways_scroll: document.documentElement.scrollWidth > window.innerWidth,
  };
}

/** Render one drum hit offline in the browser engine and return its spectral centroid (Hz). */
async function hitCentroid(patchId, kit) {
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, 8192, sr);
  triggerDrumVoice(ctx, ctx.destination, patchId, 0, 0.2, 0.9, kit);
  const buf = await ctx.startRendering();
  const x = Array.from(buf.getChannelData(0));
  const n = x.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = x[i];
  // iterative radix-2 FFT
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j], re[i], im[j], im[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  let num = 0;
  let den = 0;
  for (let k = 0; k < n / 2; k++) {
    const m = Math.hypot(re[k], im[k]);
    num += m * ((k * sr) / n);
    den += m;
  }
  return den ? num / den : 0;
}

/** Diagnostics use isolated storage and never consume a person's save slots or draft. */
export async function runSelfTest(app) {
  const storageKeys = ["musiclab.saves.v1", "musiclab.working.v1", COMFORT_KEY];
  const stored = new Map(storageKeys.map(key => [key, localStorage.getItem(key)]));
  const flow = app.playFlow;
  const original = {
    log: app._logSessionEvent, preview: app.scheduler.previewSound, bar: app.scheduler.previewBar,
    listen: app._listenForHum, speaker: flow.speaker, comfort: flow.comfort,
    doc: flow.doc ? JSON.parse(JSON.stringify(flow._canonicalDoc())) : null, stage: flow.stage,
  };
  for (const key of storageKeys) localStorage.removeItem(key);
  flow.comfort = loadComfort(localStorage);
  flow._applyComfort();
  try {
    return await runIsolatedSelfTest(app);
  } finally {
    app.scheduler.stop();
    app._logSessionEvent = original.log;
    app.scheduler.previewSound = original.preview;
    app.scheduler.previewBar = original.bar;
    app._listenForHum = original.listen;
    flow.speaker = original.speaker;
    flow.comfort = original.comfort;
    flow._applyComfort();
    if (original.doc) flow._loadDocIntoFlow(original.doc, { stage: original.stage });
    else {
      flow.doc = null;
      flow._go("start");
    }
    for (const [key, value] of stored) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    // Repaint saved-song choices after putting the person's storage back.
    flow.render();
  }
}

async function runIsolatedSelfTest(app) {
  const flow = app.playFlow;
  // A test is not a person: nothing it does goes into the local session log (the outcome measures).
  const realLog = app._logSessionEvent;
  app._logSessionEvent = () => {};
  const root = document.getElementById("play-flow");
  const out = {
    started_at: new Date().toISOString(),
    server: null,
    presses: 0,
    steps: [],
    geometry: {},
    scan_stops: {},
    loop_started_without_play: false,
  };
  try {
    const loc = typeof window !== "undefined" && window.location ? window.location : null;
    const isLocalStudio = loc && (loc.hostname === "127.0.0.1" || loc.hostname === "localhost") && !String(loc.pathname || "").startsWith("/static/");
    const res = isLocalStudio ? await fetch("/api/patches") : { ok: false };
    out.server = Boolean(res.ok);
  } catch (_e) {
    out.server = false;
  }
  const watchLoop = () => {
    if (app.scheduler.isPlaying) out.loop_started_without_play = true;
  };
  // Count previews per press: a press may give at most one short sound (9a-11).
  const origPreview = app.scheduler.previewSound.bind(app.scheduler);
  const origBar = app.scheduler.previewBar.bind(app.scheduler);
  let previewsThisPress = 0;
  out.max_previews_per_press = 0;
  const count = () => {
    previewsThisPress += 1;
    out.max_previews_per_press = Math.max(out.max_previews_per_press, previewsThisPress);
  };
  app.scheduler.previewSound = (...args) => (count(), origPreview(...args));
  app.scheduler.previewBar = (...args) => (count(), origBar(...args)); // a bar audition is the press's one preview
  async function scanTo(match, label) {
    const cycle = flow._scanItems().length + 1;
    for (let i = 0; i < cycle; i++) {
      await press(" ");
      out.presses += 1;
      watchLoop();
      if (match(document.activeElement?.dataset?.key || "")) {
        await press("Enter");
        out.presses += 1;
        await wait(80);
        watchLoop();
        out.steps.push({ step: label, ok: true, stage_after: flow.stage });
        return true;
      }
    }
    out.steps.push({ step: label, ok: false, stage_after: flow.stage });
    return false;
  }

  onPress = () => {
    previewsThisPress = 0;
  };
  if (flow.stage !== "start") flow._go("start");
  await wait(200);
  out.audit = {};
  const audit = (name) => {
    out.audit[name] = auditRoot(document.body);
    out.scan_stops[name] = flow._scanItems().length;
  };
  audit("start");
  await scanTo((k) => k === "instrument-group:drums", "open drum sounds");
  await scanTo((k) => k === "start-instrument:soft", "choose soft drums");
  audit("jam");
  const beforeJam = JSON.stringify(flow.doc.notes);
  await scanTo((k) => k === "jam-pad:0", "add a jam hit");
  const ownJam = JSON.stringify(flow.doc.notes.filter(note => note.provenance === "user_placed"));
  await scanTo((k) => k === "jam-density:more", "change the band activity");
  out.jam = {
    contribution_added: JSON.stringify(flow.doc.notes) !== beforeJam && ownJam !== "[]",
    own_notes_preserved: JSON.stringify(flow.doc.notes.filter(note => note.provenance === "user_placed")) === ownJam,
    remained_stopped: !app.scheduler.isPlaying,
  };
  await scanTo((k) => k === "jam-edit", "edit the jam notes");
  out.geometry.beat = geometry(root);
  audit("beat");
  await scanTo((k) => k === "pad:clap:2", "paint a clap");
  await scanTo((k) => k === "kit:tiny", "pick a kit by ear");
  // Tap for speed: Enter on the tap button a few more times; it only suggests, then "Use" picks it.
  await scanTo((k) => k === "tap", "tap the speed");
  for (let i = 0; i < 4; i++) {
    await wait(400); // Tap tempo measures actual timing; scan navigation need not be slow.
    await press("Enter");
    out.presses += 1;
  }
  out.tap_suggestion = root.querySelector('[data-key^="use-speed:"]')?.dataset.key || null;
  await scanTo((k) => k.startsWith("use-speed:"), "use the tapped speed");
  out.speed_after_taps = Number(flow.doc.global_context.bpm);
  await scanTo((k) => k === "to-tune", "go to the tune");
  out.geometry.tune = geometry(root);
  audit("tune");
  await scanTo((k) => k.startsWith("note:0:"), "place a note");
  // The hum choices, shown as they are after a hum (no microphone in a self-test).
  flow.humPreview = { main: [], ending: [], dropped: 0 };
  flow.render();
  audit("tune_hum_ready");
  flow.humPreview = null;
  flow.render();
  out.ideas_after_note = root.querySelectorAll(".pf-note.idea").length;
  await scanTo((k) => k === "tab:ending", "open the ending");
  audit("tune_ending");
  await scanTo((k) => k === "shape:climb", "shape the ending");
  await scanTo((k) => k === "to-under", "go underneath");
  audit("under");
  await scanTo((k) => k === "feel:warm", "pick a feel");
  flow.detailsOpen = true;
  flow.render();
  audit("under_details");
  flow.detailsOpen = false;
  flow.render();
  await scanTo((k) => k === "to-song", "go to song stage");
  audit("song");
  await scanTo((k) => k === "add-card", "make it longer");
  await scanTo((k) => k === "card-layer:0:under", "mute under on part 1");
  await scanTo((k) => k === "keep", "go to keep");
  audit("keep");
  await scanTo((k) => k === "name:Sunny Loop", "pick a name");
  await scanTo((k) => k === "save", "save");

  // The loop must start from Play (the other half of 9a-11); then stop it again.
  const loopBeforePlay = out.loop_started_without_play;
  await scanTo((k) => k === "play", "press Play");
  out.play_started_loop = app.scheduler.isPlaying;
  out.loop_started_without_play = loopBeforePlay;
  if (app.scheduler.isPlaying) document.getElementById("btn-play")?.click();
  const reachedKeep = flow.stage === "keep";

  // 9c-0: play on the beat stage and watch the pads. A ring must move; a lit pad must always be a pad that is on.
  flow._go("beat");
  await wait(150);
  await scanTo((k) => k === "play", "play on the beat stage");
  // A hidden page gets no animation frames; then the test calls the same tick the frame loop calls.
  let frames = 0;
  const countFrame = () => (frames += 1);
  window.requestAnimationFrame(countFrame);
  await wait(300);
  const driveTick = frames === 0;
  const rings = new Set();
  const laneOf = { kick: "kick", clap: "clap", snare: "snare", hat_closed: "hat", hat_open: "hat_open", perc: "perc" };
  let litSeen = 0;
  let litNotHeard = 0;
  let heardNotLit = 0;
  for (let i = 0; i < 60; i++) {
    await wait(50);
    if (driveTick) flow.onTick(app.scheduler.drainVisualStep(), app.scheduler.isPlaying);
    for (const el of root.querySelectorAll(".pf-ring")) rings.add(el.dataset.step);
    const ph = flow.playhead;
    if (!ph) continue;
    const eighthStep = ph.step - (ph.local % 2);
    const heard = new Set(
      (app.compiledSong?.events || []).filter((e) => e.role === "drums" && e.step === eighthStep).map((e) => laneOf[e.patch_id])
    );
    const col = String(Math.floor(ph.local / 2));
    const lit = [...root.querySelectorAll(".pf-lit")];
    litSeen += lit.length;
    for (const el of lit) if (!heard.has(el.dataset.lane) || el.dataset.step !== col) litNotHeard += 1;
    for (const lane of heard) {
      const pad = root.querySelector(`.pf-pad.on[data-lane="${lane}"][data-step="${col}"]`);
      if (pad && !pad.classList.contains("pf-lit")) heardNotLit += 1;
    }
  }
  const barText = root.querySelector(".pf-bar-text")?.textContent || "";
  if (app.scheduler.isPlaying) document.getElementById("btn-play")?.click();
  await wait(150);
  if (driveTick) flow.onTick(null, app.scheduler.isPlaying);
  out.playhead = {
    driven_by: driveTick ? "test (page had no animation frames)" : "animation frames",
    ring_columns_seen: rings.size,
    lit_seen: litSeen,
    lit_but_not_heard: litNotHeard,
    heard_on_a_pad_but_not_lit: heardNotLit,
    bar_text_while_playing: barText,
    cleared_after_stop: root.querySelectorAll(".pf-ring, .pf-lit").length === 0,
  };
  out.loop_started_without_play = loopBeforePlay;

  // T4 with every spot full: the start screen's saved songs and the keep screen's swap list (3 shown at a time).
  const ownSaves = localStorage.getItem("musiclab.saves.v1");
  for (let i = 0; i < SLOT_COUNT; i++) {
    const d = JSON.parse(JSON.stringify(flow.doc));
    d.id = `selftest-full-${i}`;
    d.title = `Test ${i + 1}`;
    savePiece(localStorage, d);
  }
  flow._go("start");
  audit("start_with_saves");
  out.saves_listed_at_once = root.querySelectorAll('[data-key^="continue:"]').length;
  flow._go("keep");
  flow.slotsFull = true;
  flow.render();
  audit("keep_spots_full");
  out.swaps_listed_at_once = root.querySelectorAll('[data-key^="replace:"]').length;
  flow.slotsFull = false;
  if (ownSaves === null) localStorage.removeItem("musiclab.saves.v1");
  else localStorage.setItem("musiclab.saves.v1", ownSaves);

  // The "Hum an idea" door: it opens the tune with "Hum it" ready, never starts the mic by itself, and shows status inside #play-flow.
  const mainDoc = flow.doc;
  const realListen = app._listenForHum;
  let micStarts = 0;
  let bannerInFlow = false;
  app._listenForHum = async (bannerEl) => {
    micStarts += 1;
    bannerInFlow = Boolean(bannerEl && root.contains(bannerEl));
    return { status: "no_device", notes: [] };
  };
  flow._go("start");
  await scanTo((k) => k === "hum-door", "open the hum door");
  const focusedBeforeHum = document.activeElement?.dataset?.key || null;
  const micBeforeHum = micStarts;
  await flow._hum();
  const retryShownInFlow = Boolean(root.querySelector("#pf-hum-status .pf-msg")) && root.querySelector('[data-key="hum"]')?.textContent?.includes("Try again");
  out.hum_door = {
    stage: flow.stage,
    focused: focusedBeforeHum,
    mic_started: micBeforeHum,
    banner_in_flow: bannerInFlow,
    retry_shown_in_flow: Boolean(retryShownInFlow),
  };
  app._listenForHum = realListen;

  // Back goes where the person came from: make a song, skip ahead with Keep it, then Back must return to the beat.
  flow._go("start");
  await scanTo((k) => k === "instrument-group:drums", "open drum sounds again");
  await scanTo((k) => k === "start-instrument:soft", "make another song");
  await scanTo((k) => k === "jam-edit", "skip jam exploration");
  await scanTo((k) => k === "keep", "skip ahead with Keep it");
  const backLabel = root.querySelector('[data-key="back"]')?.textContent?.trim() || "";
  await scanTo((k) => k === "back", "press Back");
  out.back_after_skip = { label: backLabel, stage_after: flow.stage };
  flow._loadDocIntoFlow(mainDoc, { stage: "keep" });

  // 9c-5: each comfort switch, set by scanning, changes the page. The person's own settings are put back after.
  const ownComfort = localStorage.getItem(COMFORT_KEY);
  const realSpeaker = flow.speaker;
  const said = [];
  const voices = [
    { name: "Cloud", lang: "en-US", localService: false },
    { name: "On this computer", lang: "en-US", localService: true },
  ];
  flow.speaker = createSpeaker({ getVoices: () => voices, speak: (u) => said.push(u), cancel() {} }, class {
    constructor(text) {
      this.text = text;
    }
  });
  // Start from the default settings, so a person's saved choices (Calm already on, say) can't flip the switches below.
  localStorage.removeItem(COMFORT_KEY);
  flow.comfort = loadComfort(localStorage);
  flow._applyComfort();
  flow._go("start");
  await scanTo((k) => k === "settings", "open settings");
  audit("start_settings");
  await scanTo((k) => k === "comfort:speak", "turn on speaking");
  await scanTo((k) => k === "comfort:bigger", "bigger buttons");
  await scanTo((k) => k === "comfort:lessMotion", "less moving");
  await scanTo((k) => k === "comfort:quietPresses", "sound only on Play");
  const vol = document.getElementById("input-volume");
  const volBefore = Number(vol?.value);
  await scanTo((k) => k === "music:down", "music softer, by scanning");
  const volAfter = Number(vol?.value);
  if (vol && !vol.disabled) {
    vol.value = String(volBefore);
    vol.dispatchEvent(new Event("input", { bubbles: true }));
  }
  flow._go("beat");
  await wait(150);
  const bigPad = Math.min(...[...root.querySelectorAll(".pf-pad")].map((p) => p.getBoundingClientRect().width));
  const probe = document.createElement("div");
  probe.innerHTML = '<span class="pf-bar now"><span class="pf-bar-fill"></span></span>';
  root.appendChild(probe);
  const lineHidden = getComputedStyle(probe.querySelector(".pf-bar-fill")).display === "none";
  probe.remove();
  const actx = app.scheduler.ensureContext();
  let sources = 0;
  const mkOsc = actx.createOscillator.bind(actx);
  const mkBuf = actx.createBufferSource.bind(actx);
  actx.createOscillator = (...a) => ((sources += 1), mkOsc(...a));
  actx.createBufferSource = (...a) => ((sources += 1), mkBuf(...a));
  await scanTo((k) => k === "pad:hat:1", "press a pad with sound only on Play");
  await wait(100);
  actx.createOscillator = mkOsc;
  actx.createBufferSource = mkBuf;
  out.comfort = {
    spoke: said.length,
    spoke_only_local_voices: said.length > 0 && said.every((u) => u.voice?.localService === true),
    stored: JSON.parse(localStorage.getItem(COMFORT_KEY) || "{}"),
    bigger_pad_px: Math.round(bigPad),
    less_motion_hides_line: lineHidden,
    sound_sources_from_a_press_when_quiet: sources,
    music_volume_by_scanning: { before: volBefore, after: volAfter, locked: Boolean(vol?.disabled) },
  };
  if (ownComfort === null) localStorage.removeItem(COMFORT_KEY);
  else localStorage.setItem(COMFORT_KEY, ownComfort);
  flow.comfort = loadComfort(localStorage);
  flow.speaker = realSpeaker;
  flow.comfortOpen = false;
  flow._applyComfort();
  out.comfort.restored = JSON.stringify(flow.comfort) === JSON.stringify(loadComfort(localStorage));
  if (!flow.comfort.quietPresses) {
    flow._go("beat");
    await wait(150);
    sources = 0;
    actx.createOscillator = (...a) => ((sources += 1), mkOsc(...a));
    actx.createBufferSource = (...a) => ((sources += 1), mkBuf(...a));
    // Press a pad that is off, so the press turns it on and makes its sound (turning a pad off is silent).
    const offPad = flow.root.querySelector('.pf-pad[data-lane]:not(.on)')?.dataset.key || "pad:hat:1";
    await scanTo((k) => k === offPad, "press a pad with sound on");
    await wait(100);
    actx.createOscillator = mkOsc;
    actx.createBufferSource = mkBuf;
    out.comfort.control_sound_sources_with_sound_on = sources;
  }
  flow._go("keep");
  app.scheduler.previewSound = origPreview;
  app.scheduler.previewBar = origBar;

  // 9b-3 in the browser engine: each kit's clap and snare rendered offline.
  out.kits = {};
  for (const kit of Object.keys(DRUM_KITS)) {
    const clap = await hitCentroid("clap", kit);
    const snare = await hitCentroid("snare", kit);
    out.kits[kit] = { clap_hz: Math.round(clap), snare_hz: Math.round(snare), gap_hz: Math.round(Math.abs(clap - snare)) };
  }
  const kitsOk = Object.values(out.kits).every((k) => k.gap_hz >= 300);

  // T2 for the play flow's sounds: every kit with every feel (and the fastest speed), rendered by the same
  // browser engine and master bus the download uses. The ceiling is -3 dBFS.
  out.peaks = [];
  const piece = JSON.parse(JSON.stringify(flow.doc));
  for (const kit of Object.keys(DRUM_KITS)) {
    for (const feel of [...FEELS.map((f) => f.id), "none"]) {
      for (const bpm of feel === "driving" ? [piece.global_context.bpm, 160] : [piece.global_context.bpm]) {
        let d = JSON.parse(JSON.stringify(piece));
        d.drum_kit = kit;
        d.global_context.bpm = bpm;
        const f = FEELS.find((x) => x.id === feel);
        d = f ? applyUnderneath(d, { feel: f.id, chords: f.chords, bass: f.bass }, chordOptions(d)) : clearUnderneath(d);
        const buf = await app.scheduler.renderSongOfflineToBuffer(compileSongStandalone(d, null));
        let peak = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          const data = buf.getChannelData(ch);
          for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        }
        out.peaks.push({ kit, feel, bpm, peak_dbfs: Math.round(20 * Math.log10(Math.max(peak, 1e-9)) * 100) / 100 });
      }
    }
  }
  const peaksOk = out.peaks.length >= 12 && out.peaks.every((p) => p.peak_dbfs <= -3.0 && p.peak_dbfs > -60);

  const saved = JSON.parse(localStorage.getItem("musiclab.saves.v1") || "[]");
  const maxStops = Math.max(0, ...Object.values(out.scan_stops));
  out.max_scan_stops = maxStops;
  out.result = {
    reached_keep: reachedKeep,
    acts_count: flow.doc?.play_session?.acts_count || 0,
    made_by_you: madeByYou(flow.doc),
    lead_notes: (flow.doc?.notes || []).filter((n) => n.role === "lead").length,
    drum_kit: flow.doc?.drum_kit || null,
    feel: flow.doc?.underneath?.feel || null,
    chords_on: flow.doc?.auto_harmony_stabs === true,
    ending_shaped: (flow.doc?.notes || []).some((n) => n.role === "lead" && n.step >= 48 && (n.shaped_by || []).includes("climb")),
    bars_1_to_3_unshaped: (flow.doc?.notes || []).filter((n) => n.role === "lead" && n.step < 48).every((n) => !n.shaped_by),
    song_cards: (flow.doc?.song_cards || []).length,
    song_total_steps: app.compiledSong?.total_steps || 0,
    saved: saved.some((s) => s.id === flow.doc?.id && s.title === "Sunny Loop" && (s.song?.song_cards || []).length === 2),
  };
  if (out.result.saved) out.result.test_piece_removed = deletePiece(localStorage, flow.doc.id)?.ok !== false;
  clearWorkingSong(localStorage);
  const c = out.comfort;
  const comfortOk =
    c.spoke_only_local_voices &&
    c.stored.speak === true && c.stored.bigger === true && c.stored.lessMotion === true && c.stored.quietPresses === true &&
    c.bigger_pad_px >= 56 &&
    c.less_motion_hides_line &&
    c.sound_sources_from_a_press_when_quiet === 0 &&
    (c.music_volume_by_scanning.locked || c.music_volume_by_scanning.after === c.music_volume_by_scanning.before - 10) &&
    c.restored &&
    (c.control_sound_sources_with_sound_on === undefined || c.control_sound_sources_with_sound_on > 0);
  const extrasOk =
    Boolean(out.tap_suggestion) &&
    out.speed_after_taps === Number(out.tap_suggestion.split(":")[1]) &&
    out.hum_door.stage === "tune" &&
    out.hum_door.focused === "hum" &&
    out.hum_door.mic_started === 0 &&
    out.hum_door.banner_in_flow === true &&
    out.hum_door.retry_shown_in_flow === true &&
    out.back_after_skip.stage_after === "beat" &&
    out.back_after_skip.label === "Back to beat" &&
    out.result.song_cards === 2 &&
    out.result.song_total_steps === 128 &&
    out.jam.contribution_added && out.jam.own_notes_preserved && out.jam.remained_stopped;
  // T7: nothing this page loaded or sent came from or went to another machine.
  out.offsite_requests = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => new URL(u, location.href).origin !== location.origin);
  // More than three sound groups or four playable jam pads is not an access
  // failure by itself. Retain the old metric visibly without hiding real issues.
  out.legacy_budget_exceptions = {
    choices: Object.entries(out.audit).filter(([, a]) => a.max_options_per_choice > 3).map(([stage, a]) => ({ stage, max_options: a.max_options_per_choice })),
    scan_stops: Object.entries(out.scan_stops).filter(([, stops]) => stops > 38).map(([stage, stops]) => ({ stage, stops })),
  };
  const auditOk = Object.values(out.audit).every((a) =>
    a.banned_words.length === 0 && a.emoji.length === 0 && a.small_targets.length === 0
    && a.low_contrast.length === 0 && a.long_labels.length === 0);
  out.functional_page_audit_pass = auditOk;
  const playheadOk =
    out.playhead.ring_columns_seen >= 3 &&
    out.playhead.lit_seen > 0 &&
    out.playhead.lit_but_not_heard === 0 &&
    out.playhead.heard_on_a_pad_but_not_lit === 0 &&
    /^Bar [1-4] of 4/.test(out.playhead.bar_text_while_playing) &&
    out.playhead.cleared_after_stop;
  const geomOk = ["beat", "tune"].every((k) => out.geometry[k] && out.geometry[k].min_pad_px >= 44 && !out.geometry[k].sideways_scroll);
  out.pass =
    out.steps.every((s) => s.ok) &&
    out.result.reached_keep &&
    out.result.made_by_you &&
    out.result.saved &&
    !out.loop_started_without_play &&
    out.play_started_loop === true &&
    out.max_previews_per_press <= 1 &&
    out.result.drum_kit === "tiny" &&
    out.result.feel === "warm" &&
    out.result.chords_on &&
    out.result.ending_shaped &&
    out.result.bars_1_to_3_unshaped &&
    kitsOk &&
    peaksOk &&
    geomOk &&
    auditOk &&
    playheadOk &&
    comfortOk &&
    extrasOk &&
    out.saves_listed_at_once === 3 &&
    out.swaps_listed_at_once === 3 &&
    out.offsite_requests.length === 0;
  app._logSessionEvent = realLog;
  window.__selftest = out;
  let pre = document.getElementById("selftest-results");
  if (!pre) {
    pre = document.createElement("pre");
    pre.id = "selftest-results";
    pre.style.cssText = "white-space:pre-wrap;font-size:12px;padding:12px;background:#0f172a;color:#e2e8f0;";
    document.body.appendChild(pre);
  }
  pre.textContent = JSON.stringify(out, null, 2);
  return out;
}
