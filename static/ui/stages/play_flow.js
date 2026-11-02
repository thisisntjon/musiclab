import { needsExactTuneEditor } from "../../js/theory/tune_model.js";
import {LIVE_VOICE_LIMIT} from '../../js/audio/scheduler.js';
import {CIRCLE_GROUPS,CIRCLE_SCENES,circleSceneAt,circlePosition,circleStep,circleFamilyStep,circleChoiceAt,circleFieldForScene,circleFieldPosition} from '../../js/theory/music_circle.js';
import {musicFieldDescription,FIELD_REGIONS,CONNECTED_FIELD_REGIONS,musicFieldTempoAllowed,sceneTempoAllowed,ROOTS_FIELD_MAX_BPM} from '../../js/theory/music_field.js';
import {createJamFormBuilder} from '../../js/theory/jam_form_program.js';
import {formBlockCount} from '../../js/theory/form_scenes.js';
import {phraseContext} from '../../js/theory/phrase_harmony.js';
import {dynamicJamPads,personalPerformance,melodyPads} from '../../js/theory/dynamic_keys.js';
import {CHORD_VOICE_SCENES} from '../../js/theory/style_traits.js';
import { scoreFromEvents, toMusicXML, fromMusicXML, renderSheetSvg, eventsFromTake } from '../../js/theory/score_sheet.js';
import { dealCards, applyCard, cardSeek } from '../../js/theory/adjust_cards.js';
import { visualBars, partOfRole, describeElements } from '../../js/theory/visual_tokens.js';
import {planMelodicPhrase,restoreMelodicPhrase,playedResponseSources,anchorPhraseToPlaying,fitToBarChord} from '../../js/theory/melodic_evolution.js';
import {loadStyleFavorites,saveStyleFavorites} from '../../js/theory/style_favorites.js';
import {stepsPerBar} from '../../js/theory/musical_time.js';
import {anchorBand} from '../../js/theory/band_anchor.js';
import { isSampledPatch } from '../../js/audio/sampled_piano.js';
/**
 * Play-first flow (Phase 9a + 9b + 9c + 10):
 *   Start -> 1. Beat -> 2. Tune -> 3. Underneath -> 4. Song -> Keep it (plus All-at-Once view).
 * Sound only answers a press; only Play starts the loop (9a-11).
 */
import { BARS, newPlayDoc, recordAct, recordReveal, madeByYou } from "../../js/theory/session_rules.js";
import { editLeadEvent } from "../../js/theory/event_tune.js";
import {
  LANES,
  BEAT_STEPS,
  beatGridFromNotes,
  notesFromBeatGrid,
  toggleBeatCell,
  startPaint,
  applyPaint,
  emptyBeatGrid,
  rollGrooveDice,
} from "../../js/theory/beat_model.js";
import {
  TUNE_STEPS,
  LEAD_SOUNDS,
  DEJA_VU_CARDS,
  NOTE_DECORATOR_CARDS,
  tuneRows,
  clashingRows,
  tuneRowLabel,
  classifyTuneNoteMark,
  tuneGridFromNotes,
  tuneGridForBars,
  retimbreTuneGrid,
  hydrateTuneGridSources,
  notesFromTuneGrid,
  toggleTuneCell,
  toggleEndingCell,
  startTunePaint,
  applyTunePaint,
  cellIsInsideSustain,
  activeEndingShape,
  shapeEnding,
  switchEndingVersion,
  applyDejaVu,
  activeDecorator,
  decorateTuneNote,
  endingIsOwn,
  tuneGridFromHum,
  hasOwnTuneNotes,
  mergeHumIntoTune,
} from "../../js/theory/tune_model.js";
import { createScan, scanNext, scanResync } from "../../js/theory/scan_model.js";
import {
  SLOT_COUNT,
  listSaves,
  savePiece,
  loadPiece,
  replacePiece,
  deletePiece,
  confirmPress,
  summarizeCartridge,
  listPhraseShelf,
  savePhraseToShelf,
  applyPhraseFromShelf,
  stashWorkingSong,
  loadWorkingSong,
  listWorkingSongs,
  workingDiffersFromSave,
  exportProjectJson,
  parseProjectJson,
  MAX_PROJECT_BYTES,
} from "../../js/theory/save_store.js";
import { nextTap } from "../../js/theory/tap_tempo.js";
import { createSuggester, suggesterDown, suggesterUp, suggesterKey } from "../../js/theory/suggest.js";
import {
  FEELS,
  BASS_STYLES,
  HARMONY_STYLES,
  chordOptions,
  applyUnderneath,
  clearUnderneath,
  toggleBarPin,
} from "../../js/theory/underneath.js";
import {
  SEED_BRANCHES,
  defaultSoundSeed,
  applySoundBranch,
} from "../../js/theory/sound_breeder.js";
import {
  CARD_LAYERS,
  CARD_FX,
  MAX_SONG_CARDS,
  defaultSongCards,
  normalizeSongCards,
  addSongCard,
  removeSongCard,
  moveSongCard,
  setSongCardBars,
  songCardRanges,
  toggleCardLayer,
  toggleCardFx,
  toggleCardBig,
  toggleCardTuneVariation,
  revealSongArc,
  songArcFromCapture, setPartMood, partMood, setEndingStyle, endingStyle, PART_MOODS, ENDING_STYLES,
  songEvents,
  extractSongMaterial,
  applySongMaterial,
  detachSongCard,
  updateSongCardMaterial,
} from "../../js/theory/song_view.js";
import { loadComfort, saveComfort, toggleComfort, stepVoice, comfortClasses } from "../../js/theory/comfort.js";
import { advancePlayhead, playheadMarks } from "../../js/theory/playhead.js";
import {
  buildPointerWakePath,
  buildBeatStreamSvg,
  buildTuneStreamSvg,
  buildUnderneathRiverSvg,
  buildSongBraidedRiverSvg,
} from "../../js/theory/flow_streamlines.js";
import { createParticleCanvas } from "../../js/visual/particle_canvas.js";
import { PART_COLORS, partOf, beatsPerBounce } from "../../js/visual/look.js";
import { goForward, goBack } from "../../js/theory/stage_trail.js";
import { createSpeaker } from "../../js/audio/speech.js";
import { icon } from "../icons.js";
import { compileSongStandalone } from "../standalone_compiler.js";
import { triggerBlobDownload } from "../xray.js";
import { startJam, setJamDirection, contributeJam, jamPads, jamDirectionDescription, jamDirectionKey } from "../../js/theory/jam_session.js";
import { STYLE_PROFILES, spectrumDescription } from '../../js/theory/style_blend.js';
import {CONTRAST_PROFILES} from '../../js/theory/listening_showcase.js';
import {EXPLORATION_DWELL_SECONDS,nextExplorationStyle,nextUnvisitedStyle} from '../../js/theory/exploration_route.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION,hasSceneCatalogue,compatibleSceneIndices} from '../../js/theory/scene_catalogue.js';
import { SCENE_VARIANTS, sceneDescription } from '../../js/theory/style_scenes.js';
import { quieterBandComparison } from '../../js/theory/part_comparison.js';
import { materializePerformance } from "../../js/theory/performance_capture.js";
import { INSTRUMENT_GROUPS, getInstrument, instrumentPage } from "../../js/theory/instrument_catalogue.js";

const KITS = [
  { id: "soft", label: "Soft", icon: "feather", patch: "kick" },
  { id: "punchy", label: "Punchy", icon: "bolt", patch: "clap" },
  { id: "tiny", label: "Tiny", icon: "bell", patch: "hat_closed" },
];
const START_PITCHED = [
  { id: "pluck_lead", label: "Plucked synth", icon: "synth" },
  { id: "warm_keys", label: "Soft keys", icon: "keys" },
  { id: "supersaw_stab", label: "Bright synth", icon: "synth" },
];
const BANDS = [
  { id: "soft_band", label: "Soft band", icon: "feather", kit: "soft", lead: "warm_keys", feel: "warm" },
  { id: "bright_band", label: "Bright band", icon: "sun", kit: "punchy", lead: "pluck_lead", feel: "floating" },
  { id: "deep_band", label: "Deep band", icon: "rocket", kit: "punchy", lead: "supersaw_stab", feel: "driving" },
];
const KIT_ICONS = { soft: "feather", punchy: "bolt", tiny: "bell" };
const LANE_ICONS = { kick: "drum", clap: "clap", hat: "bell", snare: "drum", hat_open: "bell", perc: "drum" };
const FEEL_ICONS = { warm: "sun", floating: "cloud", driving: "rocket" };
const DIAL_OPTIONS = [
  { id: "lock", label: "Five safe notes", hint: "All fit together", icon: "lock" },
  { id: "guide", label: "Show more notes", hint: "Marks edge notes", icon: "sparkle" },
  { id: "free", label: "All twelve notes", hint: "Any note goes", icon: "unlock" },
];
const COMFORT_SWITCH_CARDS = [
  { key: "speak", label: "Read out loud" },
  { key: "lessMotion", label: "Calm" },
  { key: "movingLights", label: "Moving lights" },
  { key: "bigger", label: "Bigger buttons" },
  { key: "quietPresses", label: "Sound on Play" },
];
// The play flow offers 3 ending shapes (T4: at most 3 options per choice): leave space, climb, or answer home.
const SHAPES = [
  { id: "breathe", label: "Leave space", icon: "feather" },
  { id: "climb", label: "Climb up", icon: "climb" },
  { id: "fall", label: "Answer home", icon: "home" },
];
const SAVES_PER_PAGE = 3; // T4: at most 3 saved songs or swap spots shown in one choice group
const NAME_IDEAS = ["Sunny Loop", "Night Bounce", "Bright Step"];
const STAGE_NAMES = {
  start: "start",
  beat: "beat",
  tune: "tune",
  under: "under",
  song: "song",
  keep: "keep",
};
const HUM_STATUS_MESSAGES = {
  denied: "The mic is off. You can tap notes instead.",
  no_device: "No mic found. You can tap notes instead.",
  silent: "No hum heard. Try again, or tap a note.",
  error: "The mic did not work. You can tap notes instead.",
  cancelled: "Stopped. Hum again, or tap a note.",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export class PlayFlow {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById("play-flow");
    this.stage = "start";
    this.doc = null;
    this.beatGrid = emptyBeatGrid();
    this.tuneGrid = { main: Array(TUNE_STEPS).fill(null), ending: Array(TUNE_STEPS).fill(null) };
    this.tuneTab = "main"; // repeated main phrase or the selected part's last bar
    this.liveHolds = new Map(); // "key:a" / "pointer:1" -> scheduler live note id, until released
    this.jamPointer = null; // the pointer press that already sounded a jam pad
    this.tunePage = 0;
    this.detailsOpen = true;
    this.songMoreOpen = true;
    this.aboutOpen = false;
    this.comfortOpen = false;
    this.allAtOnce = false;
    this.comfort = loadComfort(window.localStorage);
    this.styleFavorites=loadStyleFavorites(()=>window.localStorage,SCENE_CATALOGUE.map(s=>s.id));
    this.speaker = createSpeaker();
    this.suggester = createSuggester();
    this.lastTuneCol = null;
    this.trail = [];
    this.undoStack = [];
    this.scan = createScan();
    this.paint = null;
    this.tunePaint = null;
    this.taps = [];
    this.tapBpm = null;
    this.diceSeed = 0;
    this.humPreview = null;
    this.humListening = false;
    this.humMessage = "";
    this.beforeHum = null;
    this.saveMessage = "";
    this.slotsFull = false;
    this.savePage = 0;
    this.swapPage = 0;
    this.activeSongCard = 0;
    this.editingCard = null;
    this.sharedMaterial = null;
    this.confirm = { armed: null };
    this.playhead = null;
    this.instrumentGroup = "keys";
    this.instrumentPage = 0;
    this.instrumentPickerOpen = false;
    this.jamStep = 0;
    this.pendingPerformance = null;
    try {
      const pending = window.sessionStorage.getItem("musiclab.pending-performance.v1");
      if (pending) {
        const parsed = parseProjectJson(pending);
        if (parsed.ok && parsed.song?.captured_performance) this.pendingPerformance = parsed.song;
      }
    } catch (_) { /* Downloaded editable files remain available when session storage is disabled. */ }
  }

  mount() {
    if (!this.root) return;
    document.body.classList.add("pf-mode");
    this.root.hidden = false;
    this.root.removeAttribute("hidden");
    this.root.style.display = "block";
    // Comfort: route announcements to local speech when enabled, and mute tap previews when asked.
    this.app.onAnnounce = (text) => {
      this.speaker.speak(text);
    };
    this.fx = createParticleCanvas({
      isQuiet: () => Boolean(this.comfort.lessMotion || this.stage==='start' || this.doc?.jam_session?.showcase_version===1),
      forceMotion: () => Boolean(this.comfort.movingLights),
    });
    this._mountCalmButton();
    this._applyComfort();
    this._styleVolumeLock();
    this.root.addEventListener("click", (e) => this._onClick(e));
    this.root.addEventListener('pointerdown', e => {
      const timeline=e.target.closest?.('[data-timeline]');
      if(timeline&&e.button===0){e.preventDefault();return this._beginScrub(e,timeline);}
      const picture=e.target.closest?.('[data-phrase-picture]');
      if(picture&&e.button===0&&this.stage==='tune'&&this.tuneGrid.eventEditor){e.preventDefault();return this._beginNoteDrag(e,picture);}
      const field=e.target.closest('[data-music-field], [data-music-circle]');
      if(!field||e.button!==0)return;
      e.preventDefault();field.focus({preventScroll:true});field.setPointerCapture(e.pointerId);
      this.fieldPointer=e.pointerId;this.fieldGesture=false;this._pointMusicField(e,field);
    });
    this.root.addEventListener('pointermove', e => {
      if(this.scrub?.pointerId===e.pointerId)return this._scrubTo(e);
      if(this.noteDrag?.pointerId===e.pointerId)return this._moveNoteDrag(e);
      if(this.fieldPointer===e.pointerId)this._pointMusicField(e,e.target.closest('[data-music-field], [data-music-circle]'));
    });
    this.root.addEventListener('pointerup', e => {
      if(this.scrub?.pointerId===e.pointerId)return this._endScrub();
      if(this.noteDrag?.pointerId===e.pointerId)return this._endNoteDrag();
      if(this.fieldPointer!==e.pointerId)return;
      this._flushMusicField();this.fieldPointer=null;this.fieldGesture=false;
    });
    this.root.addEventListener('pointercancel', () => { this._endScrub(); if (this.noteDrag) this._endNoteDrag({ cancelled: true }); this.cancelFieldGesture(); });
    this.root.addEventListener('input', e => {
      if(e.target.matches('[data-circle-blend]')){const x=Number(e.target.value);this._requestCircle(['ska-v1','rocksteady-v1','reggae-v1'][Math.round(x*2)],true,{version:5,x,y:.5});return;}
      const axis=e.target.dataset?.fieldAxis;if(!axis)return;
      this._requestMusicField({...this._requestedField(),[axis]:Number(e.target.value)},true);
    });
    this.root.addEventListener('keydown', e => {
      if(e.target.matches('[data-music-circle]')) {
        const id=this.circleIntent?.id||this.doc.jam_session.scene_id;
        const next=e.key==='ArrowRight'?circleStep(id,1):e.key==='ArrowLeft'?circleStep(id,-1):e.key==='ArrowDown'?circleFamilyStep(id,1):e.key==='ArrowUp'?circleFamilyStep(id,-1):null;
        if(next){e.preventDefault();this._requestCircle(next,false);}return;
      }
      if(!e.target.matches('[data-music-field]'))return;
      const deltas={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,.025],ArrowDown:[0,-.025]};
      if(!deltas[e.key])return;e.preventDefault();
      const [dx,dy]=deltas[e.key],f=this._requestedField();
      this._requestMusicField({x:f.x+dx,y:f.y+dy},false);
    });
    this.root.addEventListener("change", (e) => {
      if(e.target?.id==='pf-circle-picker'){this._requestCircle(e.target.value,false);this._flushMusicField();return;}
      if(e.target.matches('[data-circle-blend]')){this._flushMusicField();this.fieldGesture=false;return;}
      if(e.target.dataset?.fieldAxis){this._flushMusicField();this.fieldGesture=false;return;}
      if(e.target?.id==='pf-scene-picker'&&this.stage==='jam'){
        this._selectJamProfile(this._jamProfiles().findIndex(profile=>profile.id===e.target.value));
        this.root.querySelector('#pf-scene-picker')?.focus();
      }
      if (e.target?.id === "pf-style-blend") {
        this.styleGestureOpen = false;
        this.render();
        this.app._announce("Band feel set. Your notes stay.");
      }
      if (e.target?.id === "pf-import-file" && e.target.files?.[0]) {
        this._importProjectFile(e.target.files[0]);
        e.target.value = "";
      }
    });
    this.root.addEventListener("input", (e) => {
      if (e.target?.id === "pf-title" && this.doc) this.doc.title = e.target.value;
      if (e.target?.id === "pf-style-blend" && this.stage === "jam") {
        this.exploreTour = null;
        if (!this.styleGestureOpen) { this._pushUndo(); this.styleGestureOpen = true; }
        const spectrum = Number.isFinite(this.doc.jam_session?.style_spectrum);
        this._acceptJamDoc(setJamDirection(this.doc, { [spectrum ? 'style_spectrum' : 'style_blend']: Number(e.target.value) / 100 }));
        const label = this.root.querySelector('#pf-style-value');
      if (label) label.textContent = `${this.app.scheduler?.isPlaying ? 'Requested: ' : ''}${spectrum ? this._spectrumDescription(Number(e.target.value)/100) : `${e.target.value}% dance`}`;
      }
    });
    this.root.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.root.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", (e) => { this._releaseJamPointer(e); this._onPointerUp(); });
    window.addEventListener("pointercancel", (e) => { this._releaseJamPointer(e); this._onPointerUp(); });
    window.addEventListener("keydown", (e) => this._onKey(e), true);
    window.addEventListener("keyup", (e) => this._releaseLive(`key:${e.key?.toLowerCase()}`), true);
    // Losing focus or hiding the page must never leave a held note sounding.
    window.addEventListener("blur", () => this._releaseAllLive());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._releaseAllLive(); });
    this.render();
  }

  _applyComfort() {
    for (const [cls, on] of Object.entries(comfortClasses(this.comfort))) {
      document.body.classList.toggle(cls, Boolean(on));
    }
    this.app.scheduler.previewsMuted = Boolean(this.comfort.quietPresses);
    this.speaker.configure({ on: Boolean(this.comfort.speak), volume: this.comfort.voiceVolume });
    const calm = document.getElementById("btn-calm");
    if (calm) calm.setAttribute("aria-pressed", String(Boolean(this.comfort.lessMotion)));
    if (this.comfort.lessMotion) this.fx?.clear();
  }

  /** Calm is one press away, in the header beside the volume: it stills every particle, ball and moving line. */
  _mountCalmButton() {
    const lock = document.getElementById("btn-volume-lock");
    if (!lock || document.getElementById("btn-calm")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-calm";
    btn.className = "pf-btn pf-small pf-calm-btn";
    btn.title = "Calm: no moving lights";
    btn.innerHTML = `${icon("feather")} Calm`;
    btn.addEventListener("click", () => this._toggleComfort("lessMotion"));
    lock.insertAdjacentElement("beforebegin", btn);
  }

  /** Replace the emoji in the header volume and lock controls with drawn icons when in play mode. */
  _styleVolumeLock() {
    const label = document.querySelector('.volume-control label[for="input-volume"]');
    if (label) {
      label.innerHTML = icon("speaker");
      label.setAttribute("aria-label", "Music volume");
    }
    const lockBtn = document.getElementById("btn-volume-lock");
    if (!lockBtn) return;
    const sync = () => {
      const locked = lockBtn.getAttribute("aria-pressed") === "true";
      lockBtn.innerHTML = `${icon(locked ? "lock" : "unlock")} ${locked ? "Unlock volume" : "Lock volume"}`;
    };
    sync();
    new MutationObserver(sync).observe(lockBtn, { attributes: true, attributeFilter: ["aria-pressed", "title"] });
  }

  _pushUndo() {
    if (!this.doc) return;
    if (this.cardPreview && !this.cardPreviewApplying) this._cancelCardPreview();
    this.undoStack.push({
      doc: JSON.parse(JSON.stringify(this.doc)),
      beat: JSON.parse(JSON.stringify(this.beatGrid)),
      tune: JSON.parse(JSON.stringify(this.tuneGrid)),
      editingCard: this.editingCard,
      sharedMaterial: this.sharedMaterial ? JSON.parse(JSON.stringify(this.sharedMaterial)) : null,
    });
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  _undo() {
    this.keptBandNoChange=null;
    const prev = this.undoStack.pop();
    if (!prev) return this.app._announce("Nothing to undo.");
    if(this.stage==='jam'&&this.app.scheduler.activeJamLead) {
      this._stopForScopeChange();
      this.app.scheduler.lastStoppedJamLead=null;
    }
    const previousScope = this.editingCard;
    this.doc = prev.doc;
    this.beatGrid = prev.beat;
    this.tuneGrid = prev.tune;
    this.editingCard = prev.editingCard ?? null;
    this.sharedMaterial = prev.sharedMaterial || null;
    if (previousScope !== this.editingCard) this._stopForScopeChange();
    this._compile();
    if (this.editingCard != null && ["song", "keep", "start"].includes(this.stage)) this._go("tune");
    else if (previousScope != null && this.editingCard == null) this._go("song");
    this.app._announce("Undone.");
    this.render();
  }

  _compile() {
    if (!this.doc) return;
    this.app.scheduler.onAudioError = message => {
      // Sounds that are not loaded yet are fetched, not reported as a failure.
      if (/^Load sounds/.test(message)) return this._loadSoundsQuietly();
      this.jamMessage = message; this.app._announce(message); this.render();
    };
    this.doc.song_cards = normalizeSongCards(this.doc.song_cards);
    this.tuneGrid.eventEditor = stepsPerBar(this.doc)===12 || needsExactTuneEditor(this.doc.notes, this._partBars());
    this.tuneGrid = tuneGridForBars(this.tuneGrid, this.doc.notes, this._partBars());
    if (this._partBars() === 1) this.tuneTab = "ending";
    this.tuneGrid = hydrateTuneGridSources(this.tuneGrid, this.doc.notes);
    this.doc.tune_grid_state = JSON.parse(JSON.stringify(this.tuneGrid));
    const canonical = this._canonicalDoc();
    this.app.songDoc = canonical;
    const loopDoc = { ...canonical, arrangement_mode: "loop" };
    const loop = compileSongStandalone(loopDoc, null);
    const parts = canonical.song_cards.map((card) => card.material
      ? compileSongStandalone(applySongMaterial(loopDoc, card.material), null) : loop);
    this.app.compiledSong = songEvents(loop, canonical.song_cards, parts);
    this.app.scheduler.setCompiledSong(this.app.compiledSong, { quantizeJamBacking: this.stage === "jam",
      coalesceJamTransitions:true, jamStyleBlend: this.doc.jam_session?.style_blend ?? null, jamStyleKey:jamDirectionKey(this.doc),phraseContext:phraseContext(this.doc),initialJamLead:this._savedMelodicLead(),jamFormProgram:this._jamFormProgram() });
    if (madeByYou(canonical)) {
      this._stashDraft(canonical);
    }
  }

  _stashDraft(song) {
    const ok = stashWorkingSong(window.localStorage, song);
    this.draftSaveFailed = !ok;
    if (ok) this.lastDraftSnapshot = JSON.stringify(song);
    return ok;
  }

  _retainBeforeSwitch() {
    if (!this.doc || !madeByYou(this._canonicalDoc())) return true;
    // Do not write an unchanged in-memory copy over a newer recovered draft.
    if (!this.draftSaveFailed && this.lastDraftSnapshot === JSON.stringify(this._canonicalDoc())) return true;
    if (this._stashDraft(this._canonicalDoc())) return true;
    this.app._announce("Your new edits are not saved. Keep this page open. Use Download project. Keep that file.");
    this.render();
    return false;
  }

  _partBars() {
    const cards = normalizeSongCards(this.doc.song_cards);
    if (this.editingCard != null) return cards[this.editingCard]?.bars || BARS;
    // A captured one-part idea has its own length; don't show unused source bars
    // or send its editor to an unrelated fourth-bar ending.
    return (this.doc.jam_start || this.doc.captured_performance) && cards.length === 1 ? cards[0].bars : BARS;
  }

  _capturedDevelopmentStage(doc = this.doc) {
    const instrument = getInstrument(doc?.selected_instrument || doc?.lead_patch_id);
    return doc?.jam_session?.kind === "drums" || instrument?.kind === "drums" ? "beat" : "tune";
  }

  _savedDevelopmentStage(doc, { working = false } = {}) {
    // Older captures were sent straight to Song. Migrate only an untouched
    // capture with positive evidence; never mistake a finished arrangement for
    // a fresh idea just because it predates the development marker.
    const original = doc?.jam_start;
    const acts = doc?.play_session?.acts || [];
    const material = extractSongMaterial(doc);
    const capturedMaterial = original ? extractSongMaterial(original.material) : {};
    // This is a derived editor cache, regenerated on load, not musical content.
    delete material.tune_grid_state;
    delete capturedMaterial.tune_grid_state;
    if (!doc?.capture_development_started && doc?.last_stage === "song"
      && acts.at(-1)?.kind === "keep_direction" && original
      && JSON.stringify(material) === JSON.stringify(capturedMaterial)
      && JSON.stringify(doc.global_context) === JSON.stringify(original.global_context)
      && JSON.stringify(normalizeSongCards(doc.song_cards)) === JSON.stringify(normalizeSongCards(original.song_cards))) {
      return this._capturedDevelopmentStage(doc);
    }
    if ((doc?.jam_start || doc?.captured_performance) && ["jam", "beat", "tune", "under", "song", "keep"].includes(doc.last_stage)) return doc.last_stage;
    if (working) return ["jam", "beat", "tune", "under", "song", "keep"].includes(doc?.last_stage) ? doc.last_stage : "beat";
    return "keep";
  }

  _resetCapturedView() {
    this.activeSongCard = 0;
    this.tunePage = 0;
    this.tuneGrid = tuneGridForBars(this.tuneGrid, this.doc.notes, this._partBars());
    this.tuneTab = this._partBars() === 1 ? "ending" : "main";
  }

  _writeTuneNotes(patchId = this.doc.lead_patch_id || "pluck_lead", endingOnly = this.tuneTab === "ending") {
    if (this.tuneGrid.eventEditor) {
      this.tuneGrid = { ...tuneGridFromNotes(this.doc.notes, this._partBars()), eventEditor: true };
      this.app._announce("Edit these notes one at a time.");
      return;
    }
    this.doc.notes = notesFromTuneGrid(this.tuneGrid, this.doc.notes, patchId, { endingOnly });
  }

  // Editors work on selected material; every persistence/output path uses this
  // canonical song so part edits cannot overwrite the shared source phrase.
  _canonicalDoc() {
    this._retainMelodicState();
    if (this.editingCard == null || !this.sharedMaterial) return this.doc;
    this.doc.tune_grid_state = JSON.parse(JSON.stringify(this.tuneGrid));
    this.doc.song_cards = updateSongCardMaterial(this.doc.song_cards, this.editingCard, this.doc);
    const canonical = applySongMaterial(this.doc, this.sharedMaterial);
    canonical.last_stage = "song";
    return canonical;
  }

  _finishPartEdit() {
    if (this.editingCard == null) return;
    this._stopForScopeChange();
    this.doc = this._canonicalDoc();
    this.editingCard = null;
    this.sharedMaterial = null;
    this.beatGrid = beatGridFromNotes(this.doc.notes,stepsPerBar(this.doc));
    this.tuneGrid = this.doc.tune_grid_state
      ? JSON.parse(JSON.stringify(this.doc.tune_grid_state)) : tuneGridFromNotes(this.doc.notes);
    this.beforeHum = null;
    this.humPreview = null;
    this._compile();
  }

  _editPart(index, stage = "tune") {
    if (!Number.isInteger(index) || !this.doc.song_cards?.[index]) return;
    const wasPlaying = Boolean(this.app.scheduler?.isPlaying);
    this._stopForScopeChange();
    this._finishPartEdit();
    this._pushUndo();
    this.doc.tune_grid_state = JSON.parse(JSON.stringify(this.tuneGrid));
    this.doc.song_cards = detachSongCard(this.doc.song_cards, index, this.doc);
    this.sharedMaterial = extractSongMaterial(this.doc);
    this.editingCard = index;
    this.activeSongCard = index;
    this.doc = applySongMaterial(this.doc, this.doc.song_cards[index].material);
    this.beatGrid = beatGridFromNotes(this.doc.notes,stepsPerBar(this.doc));
    this.tuneGrid = this.doc.tune_grid_state
      ? JSON.parse(JSON.stringify(this.doc.tune_grid_state)) : tuneGridFromNotes(this.doc.notes);
    this.tuneGrid = tuneGridForBars(this.tuneGrid, this.doc.notes, this._partBars());
    this.beforeHum = null;
    this.humPreview = null;
    this.tuneTab = this._partBars() === 1 ? "ending" : "main";
    this._compile();
    this._go(stage);
    if (wasPlaying) {
      const range = songCardRanges(this.doc.song_cards, 4 * stepsPerBar(this.doc), this.doc.global_context.bpm, stepsPerBar(this.doc))[index];
      this._keepMusicGoing(this._intentToken(), range ? [range.start_step, range.end_step] : null);
    }
    this.app._announce(`Edit part ${index + 1}. Other parts stay the same.`);
  }

  /** Deferred work (a press waiting for sounds, an answer waiting for release) runs only if nothing cancelled it. */
  _intentToken() {
    return { input: this.inputGeneration || 0, stop: this.app.scheduler?.stopGeneration || 0, song: this.doc?.id, stage: this.stage };
  }

  _intentValid(token) {
    return token.input === (this.inputGeneration || 0) && token.stop === (this.app.scheduler?.stopGeneration || 0)
      && token.song === this.doc?.id && token.stage === this.stage;
  }

  _cancelDeferredInput() {
    this.inputGeneration = (this.inputGeneration || 0) + 1;
    this.answerOnRelease = false;
    clearTimeout(this.answerTimer);
    this.pendingPad = null;
  }

  _stopForScopeChange() {
    this._cancelDeferredInput();
    this.cancelFieldGesture();
    this._retainMelodicState();
    this.exploreTour = null;
    if (!this.app.scheduler) return;
    this.app.scheduler.stop?.();
    this.app.scheduler.onPlaybackEnded?.();
  }

  /** Keep the current musical state, not a newly generated approximation of it. */
  _captureDirection() {
    const fromJam = this.stage === "jam";
    let fullCapture = fromJam ? (this.app.scheduler?.capturePerformance?.()
      || this.app.scheduler?.lastStoppedPerformance) : null;
    // Keep never refuses. Without usable playing from this song, keep the band loop
    // itself; another song's history is never taken.
    if(fromJam&&fullCapture&&fullCapture.source_song_id!==this.doc.id)fullCapture=null;
    const personalOnly=fromJam&&this.doc.jam_session?.personal_only===true;
    let capture=personalOnly?personalPerformance(fullCapture,{includeRepeats:this.doc.jam_session?.repeat_keys===true}):fullCapture;
    // "Only my playing" means exactly that: with nothing played, keep nothing rather than the band.
    if(personalOnly&&!capture?.events?.length)return this.app._announce('Play a few keys. Only your playing becomes this song.');
    if(capture&&!capture.events.length)capture=null;
    const muted = new Set(this.app.scheduler?.mutedLayers || []);
    const focused = Boolean(this.app.scheduler?.spotlightRole);
    const wasPlaying = fromJam && Boolean(this.app.scheduler?.isPlaying);
    this._pushUndo();
    this._stopForScopeChange();
    this._finishPartEdit();
    if (capture) {
      this.doc = materializePerformance(this._canonicalDoc(), capture);
      if(personalOnly&&fullCapture)this.doc.listening_reference={version:1,label:'Full listening reference, excluded from song playback and export',performance:fullCapture};
      this.beatGrid = beatGridFromNotes(this.doc.notes,stepsPerBar(this.doc));
      this.tuneGrid = tuneGridFromNotes(this.doc.notes);
    }
    this.doc.song_cards = normalizeSongCards(this.doc.song_cards).map((card) => {
      const kept = { ...card };
      for (const { id } of CARD_LAYERS) if (!capture && muted.has(id)) kept[id] = false;
      return kept;
    });
    // Preserve the first chosen direction independently of later edits. Notes
    // retain their original provenance; choosing a mix does not author its notes.
    if (!this.doc.jam_start) {
      this.doc.jam_start = JSON.parse(JSON.stringify({
        global_context: this.doc.global_context,
        material: extractSongMaterial(this.doc),
        song_cards: this.doc.song_cards,
        jam_session: this.doc.jam_session,
      }));
    }
    recordAct(this.doc, "keep_direction", { muted_layers: [...muted] });
    this._noteChoice("direction", "kept");
    if (fromJam) {
      this.doc.capture_development_started = true;
      // The kept music becomes a three-part song made of itself: a lighter start,
      // the full idea, and an ending with a roll into its last bar.
      this.doc.song_cards = songArcFromCapture(this.doc.song_cards);
      this.activeSongCard = 1;
      this._resetCapturedView();
    }
    this._compile();
    // Top-down: the kept music becomes the whole song first; detail comes later.
    this._go("song");
    if (wasPlaying) this._keepMusicGoing();
    this.app._announce(capture ? (this.draftSaveFailed ? "This is your song now. It is not saved yet." : "This is your song now. It is saved. Shape it here.")
      : focused
      ? "Kept this mix. Focus is off so kept parts play at full sound. Press Play to hear them."
      : "Kept this mix. Your notes stay the same. Shape your part, then build your song.");
  }

  /** Moving deeper into the same song never drops the music: resume it looping. */
  async _keepMusicGoing(token = this._intentToken(), loop = null) {
    const scheduler = this.app.scheduler;
    if (!scheduler || scheduler.isPlaying || !this._intentValid(token)) return false;
    // Stopping releases the sampled sounds; get them back quietly instead of asking.
    if (this.app.compiledSong?.events?.some(e => isSampledPatch(e.patch_id))
      && (!scheduler.masterBus?.piano || scheduler.masterBus.disposed)) {
      try { await scheduler.preparePiano(); }
      catch { this.pianoMessage = "The sounds did not load. Press Play to try again."; this.render(); return false; }
      // Stop, a new song or another screen while loading wins over this start.
      if (!this._intentValid(token) || scheduler.isPlaying) return false;
    }
    scheduler.setLoopRange?.(loop ? loop[0] : 0, loop ? loop[1] : null);
    scheduler.setRepeatPlayback?.(true);
    if (typeof document !== "undefined") document.getElementById?.("btn-play")?.click();
    this.render();
    return true;
  }

  /** One route from finding music to sharing it. Each level adds detail to the same song. */
  _journeyLevel() {
    if (this.stage === "jam") return this.jamPlayed || this.doc?.notes?.some(n => n.provenance === "user_placed") ? "play" : "find";
    return { song: "shape", keep: "share", beat: "detail", tune: "detail", under: "detail" }[this.stage] || null;
  }

  _journeyHtml() {
    const current = this._journeyLevel(), inJam = this.stage === "jam", hasJam = Boolean(this.doc?.jam_session);
    const levels = [["find", "Find", hasJam], ["play", "Play", hasJam], ["shape", "Shape", true],
      ["beat", "1. Beat", !inJam], ["tune", "2. Tune", !inJam], ["under", "3. Backing", !inJam],
      ["detail", "Detail", !inJam], ["share", "Share", !inJam]];
    const steps = levels.map(([id, label, reachable]) => {
      const here = id === current, attrs = here ? 'aria-current="step"' : reachable ? "" : "disabled";
      const title = id === "shape" && inJam ? ' title="Make what is playing into your song"' : "";
      return `<li>${this._btn(`journey:${id}`, label, "pf-btn pf-small pf-journey-step", `${attrs}${title}`)}</li>`;
    }).join("");
    const adjust = current && current !== "find" ? this._btn("adjust-open", "Adjust", "pf-btn pf-small pf-adjust-btn", `aria-expanded="${Boolean(this.adjustOpen)}"`) : "";
    const what = this._btn("legend-open", "What is this?", "pf-btn pf-small pf-legend-btn", `aria-expanded="${Boolean(this.legendOpen)}"`);
    return `<nav class="pf-journey" aria-label="Your song's journey"><ol>${steps}</ol>${adjust}${what}</nav>`;
  }

  _refreshJourney() {
    const nav = this.root?.querySelector?.(".pf-journey");
    if (nav) nav.outerHTML = this._journeyHtml();
  }

  _journey(level) {
    if (level === this._journeyLevel()) return;
    if (level === "find" || level === "play") {
      if (this.stage === "jam" || !this.doc.jam_session) return;
      this._stopForScopeChange();
      return this._go("jam");
    }
    if (level === "shape") return this.stage === "jam" ? this._captureDirection() : this._go("song");
    if (this.stage === "jam") return;
    if (level === "beat" || level === "tune" || level === "under") return this._go(level);
    if (level === "detail") return this._go(this._capturedDevelopmentStage());
    if (level === "share") return this._go("keep");
  }

  _songOverviewHtml() {
    const cards = normalizeSongCards(this.doc.song_cards);
    const parts = cards.map((card, index) => this._btn(`edit-card:${index}`,
      `Part ${index + 1}`, "pf-btn pf-small",
      `aria-label="Edit part ${index + 1}, ${card.bars || 4} bars, ${card.material ? "separate notes" : "linked repeat"}"${this.editingCard === index ? ' aria-current="true"' : ""}`)).join("");
    const scope = this.editingCard == null ? "These edits change all linked parts." : `Editing part ${this.editingCard + 1}.`;
    if(this.stage==='tune'&&this.tuneGrid.eventEditor)return `<nav class="pf-row pf-phrase-overview" aria-label="Song overview"><strong>Your song</strong>${parts}${this._btn('to-song','Whole song','pf-btn pf-small')}</nav>`;
    return `<nav class="pf-details" aria-label="Song overview">
      <strong>Your song</strong><div class="pf-row">${parts}${this._btn("to-song", "Whole song", "pf-btn pf-small")}</div>
      <p class="pf-sub">${scope}</p>
      <div class="pf-row">${this._btn("change-sound", "Change sound", "pf-btn pf-small", `aria-expanded="${Boolean(this.instrumentPickerOpen)}"`)}</div>
      ${this.instrumentPickerOpen ? this._instrumentPickerHtml({ changing: true }) : ""}
    </nav>`;
  }

  /** Preview only after a control explicitly labelled Preview/Hear is pressed. */
  _previewBar(doc, bar = 0, barsCount = 1, opts = {}) {
    const compiled = compileSongStandalone(doc, null);
    if (!this.app.scheduler.previewBar(compiled, bar, barsCount, opts)) {
      this._compile();
    }
  }

  _go(stage, { back = false } = {}) {
    if(this.partComparison) {
      this.comparisonGeneration=(this.comparisonGeneration||0)+1;
      this._stopForScopeChange();this.partComparison=null;
    }
    if (stage !== 'jam') this.exploreTour = null;
    this.styleGestureOpen = false;
    if (["start", "song", "keep"].includes(stage)) this._finishPartEdit();
    if (!back) this.trail = goForward(this.trail, this.stage, stage);
    // The arriving level unfolds; later re-renders inside the same moment must not restart or lose it.
    if (stage !== this.stage) { this.enterMotion = stage; this.enterUntil = (typeof performance !== "undefined" ? performance.now() : 0) + 700; }
    this.stage = stage;
    // Compilation can happen before navigation (notably a fresh instrument).
    // Initialize the jam baseline on entry, and retire its plan on scope exit.
    if (this.app.compiledSong) this.app.scheduler.setCompiledSong(this.app.compiledSong, {
      quantizeJamBacking: stage === "jam", coalesceJamTransitions:true, jamStyleBlend: this.doc?.jam_session?.style_blend ?? null, jamStyleKey:jamDirectionKey(this.doc),phraseContext:phraseContext(this.doc),
      initialJamLead:this._savedMelodicLead(),jamFormProgram:this._jamFormProgram(),
    });
    if (this.doc && stage !== "start") {
      this.doc.last_stage = stage;
      const canonical = this._canonicalDoc();
      if (madeByYou(canonical)) this._stashDraft(canonical);
    }
    this.allAtOnce = false;
    // Mutes and Focus live only in the "All at once" deck: nothing stays silent or quiet unseen.
    this.app.scheduler?.clearMuteLayers();
    this.app.scheduler?.setSpotlightRole(null);
    this.detailsOpen = true;
    this.songMoreOpen = true;
    this.aboutOpen = false;
    this.comfortOpen = false;
    this.slotsFull = false;
    this.swapPage = 0;
    this.confirm.armed = null;
    if (stage !== "song") {
      this.app.scheduler.setLoopRange(0, null);
      this.app.scheduler.setRepeatPlayback(true);
    }
    this._dealOnArrival();
    this.scan = createScan();
    this.render();
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo(0, 0);
    const heading = this.root.querySelector(".pf-heading");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  _back() {
    const step = goBack(this.trail);
    if (!step) return;
    this.trail = step.trail;
    this._go(step.to, { back: true });
    this.app._announce(`Back at ${STAGE_NAMES[step.to] || step.to}.`);
  }

  _backBtn() {
    const step = goBack(this.trail);
    if (!step) return "";
    const label = step.to === "start" ? `${icon("back")} Start over` : `${icon("back")} Back to ${STAGE_NAMES[step.to] || step.to}`;
    return this._btn("back", label, "pf-btn pf-small");
  }

  /** Remember a choice picked by ear so "made by you" counts it (and clearing it forgets it). */
  _noteChoice(key, val) {
    const s = this.doc.play_session || (this.doc.play_session = { acts_count: 0, acts: [] });
    const c = s.choices || (s.choices = {});
    if (val) c[key] = val;
    else delete c[key];
  }

  _pageSize() {
    return window.matchMedia?.("(max-width: 600px)").matches ? 4 : 8;
  }

  _progressiveState() {
    const hasBeat = madeByYou(this.doc);
    const hasTune = [...this.tuneGrid.main, ...this.tuneGrid.ending].some(Boolean) || Boolean(this.humPreview) || this.tuneTab === "ending";
    const hasFeel = Boolean(this.doc?.underneath?.feel) || this.detailsOpen;
    const cards = normalizeSongCards(this.doc?.song_cards);
    const hasMultiSong =
      cards.length > 1 || cards.some((c) => !c.beat || !c.tune || !c.under || c.big || c.fx);
    return { hasBeat, hasTune, hasFeel, hasMultiSong };
  }

  _syncWaterFlowDom() {
    if (!this.root || typeof this.root.querySelectorAll !== "function") return;
    for (const gridEl of this.root.querySelectorAll(".pf-grid[data-water-grid]")) {
      const rect = gridEl.getBoundingClientRect?.();
      if (!rect || rect.width < 40 || rect.height < 40) continue;
      const centers = new Map();
      for (const pad of gridEl.querySelectorAll(".pf-pad[data-key]")) {
        const pr = pad.getBoundingClientRect?.();
        if (!pr || pr.width === 0) continue;
        centers.set(pad.dataset.key, {
          x: pr.left - rect.left + pr.width / 2,
          y: pr.top - rect.top + pr.height / 2,
        });
      }
      if (centers.size === 0) continue;
      const svgEl = gridEl.querySelector(".pf-flow-svg");
      if (!svgEl) continue;
      const kind = gridEl.dataset.waterGrid;
      if (kind === "beat") {
        const bpm = Math.round(Number(this.doc?.global_context?.bpm || 100));
        svgEl.outerHTML = buildBeatStreamSvg(this.beatGrid, {
          width: rect.width,
          height: rect.height,
          padCenters: centers,
          bpm,
        });
      } else if (kind === "tune") {
        const rootPc = Number(this.doc?.global_context?.root_pc || 0);
        const scaleType = this.doc?.global_context?.scale_type || "major";
        const dial = this.doc?.note_dial || "lock";
        const activeCells = this.tuneTab === "ending" ? this.tuneGrid.ending : this.tuneGrid.main;
        const extraMidis = [...this.tuneGrid.main, ...this.tuneGrid.ending].filter(Boolean).map((c) => c.midi);
        const rows = tuneRows(rootPc, scaleType, extraMidis, dial).slice().sort((a, b) => b - a);
        const home = 60 + ((rootPc % 12) + 12) % 12;
        const size = this._pageSize();
        const pages = Math.ceil(TUNE_STEPS / size);
        const page = this.tunePage % pages;
        const first = page * size;
        const cols = Array.from({ length: size }, (_, i) => first + i);
        const activeShape = activeEndingShape(this.tuneGrid);
        const hasParallel = Boolean(this.tuneGrid.baseEnding || this.tuneGrid.exploredEnding);
        const curVer = this.tuneGrid.endingVersion || (activeShape ? "explored" : "original");
        const ghostCells =
          this.tuneTab === "ending" && hasParallel
            ? curVer === "explored"
              ? this.tuneGrid.baseEnding
              : this.tuneGrid.exploredEnding
            : null;
        svgEl.outerHTML = buildTuneStreamSvg({
          activeCells,
          rows,
          cols,
          ideas: this.suggester.list || [],
          lastTuneCol: this.lastTuneCol,
          decorator: activeDecorator(this.tuneGrid, this.tuneTab),
          tuneTab: this.tuneTab,
          endingShape: activeShape,
          ghostCells,
          feel: this.doc?.underneath?.feel || null,
          homeMidi: home,
          padCenters: centers,
          width: rect.width,
          height: rect.height,
        });
      }
    }
  }

  render() {
    if (!this.root) return;
    this.eventTimingOpen=this.root.querySelector('.pf-event-timing')?.open??this.eventTimingOpen;
    this.demoToolsOpen=this.root.querySelector('.pf-demo-tools:not(.pf-song-more)')?.open??this.demoToolsOpen;
    this.songMoreOpen=this.root.querySelector('.pf-song-more')?.open??this.songMoreOpen;
    this.sheetOpen=this.root.querySelector('.pf-sheet-box')?.open??this.sheetOpen;
    this.shareMoreOpen=this.root.querySelector('.pf-share-more')?.open??this.shareMoreOpen;
    this.nameIdeasOpen=this.root.querySelector('.pf-name-ideas')?.open??this.nameIdeasOpen;
    this.participationOpen=this.root.querySelector('.pf-participation')?.open??this.participationOpen;
    this.startOptionsOpen=this.root.querySelector('.pf-other-ways')?.open??this.startOptionsOpen;
    this.startCycleOpen=this.root.querySelector('.pf-cycle-choice')?.open??this.startCycleOpen;
    document.body.classList.toggle('pf-listening',this.stage==='start'||(this.stage==='jam'&&this.doc?.jam_session?.showcase_version===1));
    const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const focusKey = document.activeElement?.dataset?.key;
    if (this.allAtOnce && this.doc && this.stage !== "start" && this.editingCard == null) {
      this.root.innerHTML = this._renderAllAtOnce();
    } else if (this.stage === "start") {
      this.root.innerHTML = this._renderStart();
    } else if (this.stage === "jam") {
      this.root.innerHTML = this._renderJam();
    } else if (this.stage === "beat") {
      this.root.innerHTML = this._renderBeat();
    } else if (this.stage === "tune") {
      this.root.innerHTML = this._renderTune();
    } else if (this.stage === "under") {
      this.root.innerHTML = this._renderUnder();
    } else if (this.stage === "song") {
      this.root.innerHTML = this._renderSong();
    } else if (this.stage === "keep") {
      this.root.innerHTML = this._renderKeep();
    }
    if (this.enterMotion && this.root.firstElementChild) {
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      if (now <= (this.enterUntil || 0)) this.root.firstElementChild.setAttribute("data-enter", this.enterMotion);
      else this.enterMotion = null;
    }
    if (this.stage !== "start" && this.doc && this.legendOpen) this.root.insertAdjacentHTML("afterbegin", this._legendHtml());
    if (this.stage !== "start" && this.doc && this.adjustOpen) this.root.insertAdjacentHTML("afterbegin", this._adjustHtml());
    if (this.stage !== "start" && this.doc) this.root.insertAdjacentHTML("afterbegin", this._journeyHtml());
    if(this.stage!=='start'&&!(this.stage==='jam'&&(this.doc?.jam_session?.music_field||this.doc?.jam_session?.exploration_map)))this.root.insertAdjacentHTML('beforeend',`<section aria-label="Help and access"><div class="pf-row">
      ${this._btn('settings',this.comfortOpen?'Close help and settings':'Help and settings','pf-btn pf-small',`aria-expanded="${Boolean(this.comfortOpen)}"`)}
      ${this._btn('speak-screen','Read this','pf-btn pf-small')}</div>${this.comfortOpen?this._renderComfort():''}</section>`);
    if(this.partComparison && this.stage==='song')this.root.insertAdjacentHTML('afterbegin',this._comparisonHtml());
    if (this.pianoMessage) this.root.insertAdjacentHTML('afterbegin', `<p role="status">${esc(this.pianoMessage)}</p>`);
    if (this.deleteMessage) this.root.insertAdjacentHTML('afterbegin', `<p role="status">${esc(this.deleteMessage)}</p>`);
    if (this.stage !== 'start' && (isSampledPatch(this.doc?.lead_patch_id) || this.app.compiledSong?.events?.some(n => isSampledPatch(n.patch_id)))
      && (!this.app.scheduler?.masterBus?.piano || this.app.scheduler.masterBus.disposed))
      this._loadSoundsQuietly();
    if (this.draftSaveFailed) this.root.insertAdjacentHTML("afterbegin",
      '<p role="alert">Your new edits are not saved. Keep this page open. Use Download project. Keep that file.</p>'
      + this._btn('dl-project', 'Download project', 'pf-btn'));
    if (this.editingCard != null && !(this.stage === "tune" && this.tuneGrid.eventEditor)) {
      const partBars = normalizeSongCards(this.doc.song_cards)[this.editingCard]?.bars || 4;
        const barUnit = partBars === 1 ? "bar" : "bars";
        const lengthNote = partBars < 4
          ? `<span>Play length: ${partBars} ${barUnit}. Later notes stay safe. Make this part longer to hear them.</span>`
          : "";
      this.root.insertAdjacentHTML("afterbegin", `<div class="pf-row" role="region" aria-label="Edit scope">
          <strong>Editing part ${this.editingCard + 1}.</strong>
        <span>Notes and sounds change here only. Speed sets the whole song.</span>
          ${lengthNote}
        ${this._btn("edit-scope:beat", "Edit beat", "pf-btn pf-small")}
        ${this._btn("edit-scope:tune", "Edit tune", "pf-btn pf-small")}
        ${this._btn("edit-scope:under", "Edit backing", "pf-btn pf-small")}
        ${this._btn("to-song", "Back to song", "pf-btn pf-small")}
      </div>`);
    }
    if (this.doc && ["beat", "tune", "under"].includes(this.stage) && !this.allAtOnce) {
      this.root.insertAdjacentHTML("afterbegin", this._songOverviewHtml());
    }
    this._syncWaterFlowDom();
    if (focusKey) {
      let el = this.root.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      if (!el || el.disabled || el.offsetParent === null) {
        el = focusKey.startsWith("instrument-page:")
          ? this.root.querySelector('[data-key^="start-instrument:"], [data-key^="change-instrument:"]')
          : this.root.querySelector(".pf-heading");
        if (el?.classList.contains("pf-heading")) el.tabIndex = -1;
      }
      if (el) {
        el.focus({ preventScroll: true });
        const items = this._scanItems();
        scanResync(this.scan, items.length, items.indexOf(el));
      }
    }
    this._paintPlayhead();
    this._paintJamPads();
    this._paintJamAnswer();
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo(scrollX, scrollY);
    }
  }

  /**
   * Called from the app's animation frame with the latest heard step (or null between steps).
   * Updates only CSS classes on the current screen, never rebuilding the DOM.
   */
  onTick(stepEvt, isPlaying) {
    if (stepEvt?.sounding) this.soundingParts = new Set(stepEvt.sounding.map(e => partOfRole(e.role)).filter(Boolean));
    else if (!isPlaying) this.soundingParts = new Set();
    this._showBandAnswers(stepEvt);
    this._paintSheet();
    this._paintTimeline();
    this._paintListeningVisual(isPlaying);
    const eventTransport=this.root?.querySelector('[data-event-transport]');
    if(eventTransport){
      const label=isPlaying?'Stop playback':this.editingCard==null?'Play music':`Play part ${this.editingCard+1}`;
      if(eventTransport.textContent!==label)eventTransport.textContent=label;
    }
    this._paintJamPads();
    this._paintJamAnswer();
    const soundLabel=this.root?.querySelector('#pf-key-sound');
    if(soundLabel&&this.doc.jam_session){
      const pad=this._liveJamPads()[0];const name=getInstrument(pad.patchId)?.label||pad.patchId;
      const label=`Your next keys: ${name}. ${this.doc.jam_session.dynamic_keys?'Notes follow the active harmony.':'Fixed notes.'}`;
      if(soundLabel.textContent!==label)soundLabel.textContent=label;
    }
    const direction=this.root?.querySelector('#pf-current-direction');
    if(direction&&this.doc?.jam_session&&!this.doc.jam_session.music_field) {
      const scheduler=this.app.scheduler, now=scheduler.audioCtx?.currentTime||0;
      const pending=scheduler.pendingJamBacking!==null||scheduler.lastJamBackingCommit?.audioTime>now;
      const name=this.doc.jam_session.anchor_backing?'Frozen phrase':this._spectrumDescription(this.doc.jam_session.style_spectrum||0);
      const text=!scheduler.isPlaying?'Stopped':pending?`Next direction: ${name}`:`Playing: ${name}`;
      if(direction.textContent!==text)direction.textContent=text;
    }
    document.body.classList.toggle("pf-playing", Boolean(isPlaying));
    if (!isPlaying) {
      if (this.exploreTour) this.exploreTour.settledAt = null;
      if (this.playhead) {
        this.playhead = null;
        this._paintPlayhead();
      }
      return;
    }
    if (!stepEvt) return;
    const total = this.app.compiledSong?.total_steps || 64;
    let landed = false;
    const bpm = Number(this.app.compiledSong?.bpm || this.doc?.global_context?.bpm || 100);
    for (const s of stepEvt.passed || [stepEvt]) {
      this.playhead = advancePlayhead(this.playhead, s, total, stepsPerBar(this.doc));
      if (s.step % (4 * beatsPerBounce(bpm)) === 0) landed = true;
    }
    if (stepEvt.sounding) this.playhead = advancePlayhead(this.playhead, stepEvt, total, stepsPerBar(this.doc));
    this._paintPlayhead();
    if (landed) this._landBall(bpm);
  }

  /**
   * The beat ball lands on the beat being heard and arcs to the next one (a bouncing ball, not a flash:
   * workflow/research/visual-wave/w3-motion-sync-safety.md). It lands every second beat above 120 per minute.
   */
  _landBall(bpm) {
    if (!this.fx) return;
    const grid = this.root?.querySelector(".pf-grid[data-water-grid]");
    const lane = grid?.querySelector(".pf-lane .pf-pads");
    if (!grid || !lane) return;
    const pads = [...lane.children];
    const now = pads.findIndex((el) => el.classList.contains("pf-ring"));
    if (now < 0) return;
    const colsPerBeat = grid.dataset.waterGrid === "beat" ? 2 : 4;
    const next = (now + colsPerBeat * beatsPerBounce(bpm)) % pads.length;
    const a = pads[now].getBoundingClientRect();
    const b = pads[next].getBoundingClientRect();
    // Lands 37 px into the grid's 50 px top lane; the arc (26 px) and the 22 px glow stay inside the lane.
    const landY = grid.getBoundingClientRect().top + 37;
    this.fx.ball({ x0: a.left + a.width / 2, x1: b.left + b.width / 2, y: landY, periodMs: (60000 / bpm) * beatsPerBounce(bpm) });
  }

  _paintPlayhead() {
    if (!this.root) return;
    for (const el of this.root.querySelectorAll(".pf-ring, .pf-lit, .pf-bar.now, .pf-song-card.now")) {
      el.classList.remove("pf-ring", "pf-lit", "now");
    }
    const cursor=this.root.querySelector('.pf-phrase-cursor');
    if(cursor){
      const ranges=songCardRanges(this.doc.song_cards,4*stepsPerBar(this.doc),this.doc.global_context.bpm,stepsPerBar(this.doc));
      const start=ranges[this.editingCard]?.start_step||0;
      const step=this.playhead?this.playhead.step-start:null;
      cursor.hidden=step==null||Math.floor(step/stepsPerBar(this.doc))!==this.eventTuneBar;
      const status=this.root.querySelector('#pf-phrase-status');
      const message=step==null?'Stopped. Press Play to hear your music.':`Playing bar ${Math.floor(step/stepsPerBar(this.doc))+1}. Viewing bar ${this.eventTuneBar+1}.`;
      if(status&&status.textContent!==message)status.textContent=message;
      if(!cursor.hidden)cursor.style.left=`${(step%stepsPerBar(this.doc))/stepsPerBar(this.doc)*100}%`;
    }
    const textEls = this.root.querySelectorAll(".pf-bar-text");
    if (!this.playhead) {
      this._litBefore = null;
      for (const textEl of textEls) textEl.textContent = this._barRestText();
      return;
    }
    const stages = this.allAtOnce ? ["beat", "tune"] : [this.stage];
    for (const st of stages) {
      const range = songCardRanges(this.doc?.song_cards,4*stepsPerBar(this.doc),this.doc?.global_context?.bpm||100,stepsPerBar(this.doc)).find((part) => this.playhead.step >= part.start_step && this.playhead.step < part.end_step);
      const localHead = range ? { ...this.playhead, bar: Math.floor((this.playhead.step - range.start_step) / stepsPerBar(this.doc)) } : this.playhead;
      const marks = playheadMarks(localHead, {
        endingBar: this._partBars() - 1,
        stage: st,
        tab: this.tuneTab,
        page: this.tunePage % Math.ceil(TUNE_STEPS / this._pageSize()),
        pageSize: this._pageSize(),
      });
      for (const sel of marks.ring) for (const el of this.root.querySelectorAll(sel)) el.classList.add("pf-ring");
      for (const sel of marks.lit) for (const el of this.root.querySelectorAll(sel)) el.classList.add("pf-lit");
    }
    // A pad that has just started sounding gives off a small burst in its part's colour (caused by the sound, never idle).
    const litNow = new Set(this.root.querySelectorAll(".pf-pad.pf-lit"));
    for (const el of litNow) if (!this._litBefore?.has(el)) this._sparkAt(el);
    this._litBefore = litNow;
    const ranges = songCardRanges(this.doc?.song_cards,4*stepsPerBar(this.doc),this.doc?.global_context?.bpm||100,stepsPerBar(this.doc));
    const currentRange = ranges.find((part) => this.playhead.step >= part.start_step && this.playhead.step < part.end_step);
    const barInLoop = currentRange ? Math.floor((this.playhead.step - currentRange.start_step) / stepsPerBar(this.doc)) : this.playhead.bar % BARS;
    for (const barEl of this.root.querySelectorAll(`.pf-bar[data-bar="${barInLoop}"]`)) {
      barEl.classList.add("now");
      const fill = barEl.querySelector(".pf-bar-fill");
      if (fill) fill.style.transform = `scaleX(${((this.playhead.local + 1) / stepsPerBar(this.doc)).toFixed(3)})`;
    }
    const cardIdx = currentRange?.index ?? 0;
    const cardEl = this.root.querySelector(`.pf-song-card[data-card="${cardIdx}"]`);
    if (cardEl) cardEl.classList.add("now");
    const cardsCount = (this.doc?.song_cards || []).length;
    const barMsg =
      (this.stage === "song" || this.allAtOnce) && cardsCount > 1
        ? `Part ${cardIdx + 1} of ${cardsCount}, bar ${barInLoop + 1} of ${currentRange?.bars || BARS}`
        : `Bar ${barInLoop + 1} of ${this._partBars()}${
            this.stage === "tune" ? (this._partBars() > 1 && barInLoop === this._partBars() - 1 ? " (ending)" : " (your tune)") : ""
          }`;
    const offPage = this.stage === "tune" && !this.tuneGrid.eventEditor
      ? ((this.tuneTab === "ending") !== (barInLoop === this._partBars()-1)
        ? " - playing the other tab."
        : Math.floor(this.playhead.local / this._pageSize()) !== this.tunePage % Math.ceil(TUNE_STEPS / this._pageSize())
          ? ` - playing steps ${Math.floor(this.playhead.local / this._pageSize())*this._pageSize()+1}-${(Math.floor(this.playhead.local / this._pageSize())+1)*this._pageSize()}.` : "") : "";
    for (const textEl of textEls) textEl.textContent = barMsg + offPage;
  }

  _sparkAt(el, strength = 0.8) {
    if (!this.fx || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    const part = partOf(el.dataset.lane || (el.classList.contains("pf-note") ? "tune" : "under"));
    this.fx.emit(r.left + r.width / 2, r.top + r.height / 2, PART_COLORS[part], { strength, ring: part === "boom" });
  }

  /** The key to the picture: each part has its own colour and shape, and higher notes sit higher. */
  _legendHtml() {
    const parts = [
      ["boom", "Boom"],
      ["clap", "Clap"],
      ["tick", "Tick"],
      ["tune", "Tune"],
      ["under", "Under"],
    ];
    const items = parts
      .map(([id, word]) => `<li class="pf-legend-item" data-part="${id}"><span class="pf-legend-shape" aria-hidden="true"></span>${word}</li>`)
      .join("");
    return `<ul class="pf-legend" aria-label="What the shapes mean">${items}<li class="pf-legend-item pf-legend-up">${icon("climb")} Higher notes sit higher</li></ul>`;
  }

  /** Where you are: the four parts in order, the current one lit (a "what comes next" strip, not buttons). */
  _barRestText() {
    const cardsCount = (this.doc?.song_cards || []).length;
    if (this.stage === "song" || (this.stage === "keep" && cardsCount > 1)) {
      const bars = songCardRanges(this.doc?.song_cards,4*stepsPerBar(this.doc),this.doc?.global_context?.bpm||100,stepsPerBar(this.doc)).reduce((sum, part) => sum + part.bars, 0);
      return `${cardsCount} ${cardsCount === 1 ? "part" : "parts"} (${bars} bars)`;
    }
    if (this.stage === "tune") {
      const bars = this._partBars();
      if (bars === 1) return "Your tune: 1 bar";
      return this.tuneTab === "ending" ? `Bar ${bars}: the end` : `Bars 1–${bars - 1}: your tune`;
    }
    return `${this._partBars()} bars`;
  }

  /** Bar cells show the selected part's length and which bars the open tab edits. */
  _barsHtml() {
    const bars = this._partBars();
    const cells = Array.from({ length: bars }, (_, index) => index)
      .map((b) => {
        const editing = this.stage === "tune" && (this.tuneTab === "ending" ? b === bars - 1 : b < bars - 1);
        const label = bars > 1 && b === bars - 1 && this.stage === "tune" ? `${bars} ${icon("flag")}` : `${b + 1}`;
        return `<span class="pf-bar${editing ? " editing" : ""}" data-bar="${b}">${label}<span class="pf-bar-fill"></span></span>`;
      })
      .join("");
    return `<div class="pf-bars" aria-label="Bars"><div class="pf-bar-row" aria-hidden="true">${cells}</div><span class="pf-bar-text">${this._barRestText()}</span></div>`;
  }

  _btn(key, label, cls = "pf-btn", extra = "") {
    return `<button type="button" class="${cls}" data-key="${esc(key)}" ${extra}>${label}</button>`;
  }

  _choice(key, label, on, cls = "pf-btn") {
    return `<button type="button" class="${cls}${on ? " on" : ""}" data-key="${esc(key)}" aria-pressed="${on}">${label}</button>`;
  }

  /** Show at most 3 saved songs at a time so the list stays within T4 (<= 3 options per choice). */
  _savesShown(saves, pageField) {
    if (saves.length <= SAVES_PER_PAGE) return { shown: saves, moreBtn: "" };
    const pages = Math.ceil(saves.length / SAVES_PER_PAGE);
    const page = this[pageField] % pages;
    const shown = saves.slice(page * SAVES_PER_PAGE, (page + 1) * SAVES_PER_PAGE);
    const key = pageField === "savePage" ? "more-saves" : "more-swaps";
    const label = pageField === "savePage" ? "More saved songs" : "Other saved songs";
    return { shown, moreBtn: this._btn(key, `${icon("next")} ${label}`, "pf-btn pf-small") };
  }

  _renderStart() {
    const saves = listSaves(window.localStorage);
    const working = loadWorkingSong(window.localStorage);
    const drafts = listWorkingSongs(window.localStorage).filter(song => madeByYou(song) && workingDiffersFromSave(window.localStorage, song));
    const draftPages = Math.max(1, Math.ceil(drafts.length / SAVES_PER_PAGE));
    const draftPage = (this.draftPage || 0) % draftPages;
    const shownDrafts = drafts.slice(draftPage * SAVES_PER_PAGE, (draftPage + 1) * SAVES_PER_PAGE);
    const draftButtons = shownDrafts.map(song => this._btn(song.id === working?.id ? 'resume-working' : `resume-working:${song.id}`,
      `${icon("play")} Continue ${esc(song.title || "your song")}`, "pf-btn pf-big pf-play")).join('');
    const workingCard = drafts.length
      ? `<div class="pf-saves pf-working-card">
          <p class="pf-say">Your unfinished songs:</p>
          <div class="pf-row">
            ${draftButtons}
          </div>
          ${draftPages > 1 ? this._btn('more-drafts', 'More unfinished songs', 'pf-btn pf-small') : ''}
        </div>`
      : "";
    const { shown, moreBtn } = this._savesShown(saves, "savePage");
    const savedRows = shown
      .map((s) => {
        const armed = this.confirm.armed === `delete:${s.id}`;
        const delLabel = armed ? "Sure? Delete" : `${icon("trash")} Throw it out`;
        const delAria = armed ? `Sure? Delete ${s.title}` : `Throw it out: ${s.title}`;
        const del = this._btn(`delete:${s.id}`, delLabel, `pf-btn pf-small${armed ? " pf-armed" : ""}`, `aria-label="${esc(delAria)}"`);
        const cart = s.cartridge || summarizeCartridge(s.song);
        const kitIcon = icon(KIT_ICONS[cart?.kit] || "bolt");
        const feelIcon = cart?.feel && FEEL_ICONS[cart.feel] ? icon(FEEL_ICONS[cart.feel]) : icon("note");
        const cover = `<span class="pf-cover" aria-hidden="true">${kitIcon}${feelIcon}</span>`;
        return `<div class="pf-slot pf-shelf-card" data-option>${this._btn(`continue:${s.id}`, `${cover} ${icon("play")} ${esc(s.title)}`, "pf-btn pf-card")} ${del}</div>`;
      })
      .join("");
    const resume = saves.length
      ? `<div class="pf-saves"><p class="pf-say">Your songs:</p><div class="pf-slots" role="group" aria-label="Your saved songs">${savedRows}</div>${moreBtn ? `<div class="pf-row">${moreBtn}</div>` : ""}</div>`
      : "";
    const comfortBtn = this._btn(
      "settings",
      this.comfortOpen ? `${icon("gear")} Close settings` : `${icon("gear")} Settings`,
      "pf-btn pf-small",
      `aria-expanded="${this.comfortOpen}"`
    );
    const pendingNote = this.pendingImportMessage ? `<p role="status">${esc(this.pendingImportMessage)}</p>` : "";
    const pendingJam = this.pendingPerformance
      ? `<div class="pf-saves"><p class="pf-say">Your jam is here.</p>${this._btn("continue-performance", "Develop this jam", "pf-btn pf-next")}${pendingNote}</div>` : "";
    return `
      <div class="pf-stage pf-start">
        <h1 class="pf-heading">Find your groove</h1>
        ${this._listeningVisualHtml()}
        <p class="pf-say">Music that changes. A band you can join.</p>
        <div class="pf-row">${this._btn("listen-circle", "Listen and explore", "pf-btn pf-next",this.pianoLoading?'disabled':'')}</div>
        <p class="pf-sub">Press Listen. Then tap a pad or play A S D F to join in.</p>
        <details class="pf-demo-tools" ${this.demoToolsOpen?'open':''}><summary data-key="demo-tools">More</summary>
        ${pendingJam}
        ${workingCard}
        <details class="pf-other-ways" ${this.startOptionsOpen?'open':''}><summary data-key="start-options">Other ways to begin</summary>${this._btn("listen-explore","Hear the band","pf-btn pf-small")}
        <details class="pf-cycle-choice" ${this.startCycleOpen?'open':''}><summary data-key="cycle-options">Beat cycle for a new song</summary><p>Four beats or three beats in each bar. This choice starts a new song.</p>
        <div class="pf-row">${this._btn('new-cycle:16','Four beats','pf-btn pf-small',`aria-pressed="${this.newCycle!==12}"`)}${this._btn('new-cycle:12','Three beats','pf-btn pf-small',`aria-pressed="${this.newCycle===12}"`)}</div></details>
        ${this._legendHtml()}
        ${this._instrumentPickerHtml()}
        <div class="pf-row">${this._btn("hum-door", `${icon("mic")} Hum an idea`, "pf-btn pf-small")}</div>
        </details>
        ${resume}
        <div class="pf-row pf-drawer">
          ${comfortBtn}
          ${this._btn("open-project", `${icon("save")} Open file`, "pf-btn pf-small")}
          ${this._btn("speak-screen", `${icon("speaker")} Read this`, "pf-btn pf-small")}
        </div>
        <input id="pf-import-file" type="file" accept=".json,.musicxml,.xml,application/json,application/vnd.recordare.musicxml+xml,text/xml" style="display:none" aria-hidden="true" tabindex="-1" />
        ${this.comfortOpen ? this._renderComfort() : ""}
        </details>
      </div>`;
  }

  _instrumentPickerHtml({ changing = false } = {}) {
    const group = this.instrumentGroup || "keys";
    const page = instrumentPage(group, this.instrumentPage || 0);
    const groups = INSTRUMENT_GROUPS.map(item => this._choice(`instrument-group:${item.id}`, esc(item.label), item.id === group, "pf-btn pf-small")).join("");
    const cards = page.items.map(item => `<div class="pf-instrument-card">
      <img class="pf-instrument-image" src="${esc(item.image)}" alt="" width="160" height="110" />
      <strong>${esc(item.label)}</strong><p class="pf-sub">${esc(item.description)}</p>
      <div class="pf-row">${this._btn(`${changing ? "change-instrument" : "start-instrument"}:${item.id}`, changing ? "Use this sound" : "Choose", "pf-btn", `aria-label="${changing ? "Use" : "Choose"} ${esc(item.label)}"`)}
      ${this._btn(`preview-instrument:${item.id}`, "Preview", "pf-btn pf-small", `aria-label="Preview ${esc(item.label)}"`)}</div>
    </div>`).join("");
    return `<section aria-label="All sounds"><div class="pf-row" role="group" aria-label="Sound groups">${groups}</div>
      <div class="pf-instrument-grid">${cards}</div>
      <div class="pf-row">${this._btn("instrument-page:previous", "Previous sounds", "pf-btn pf-small", page.page === 0 ? "disabled" : "")}
      <span>${page.page + 1} of ${page.pages}</span>${this._btn("instrument-page:next", "More sounds", "pf-btn pf-small", page.page + 1 === page.pages ? "disabled" : "")}</div></section>`;
  }

  _listeningVisualHtml() {
    return '<svg class="pf-listening-visual" viewBox="0 0 640 220" aria-hidden="true" focusable="false"><path data-spectrum fill="none"/><path data-spectrum-dim="bass" class="pf-vis-dim pf-part-bass" fill="none" stroke-width="2"/><path data-spectrum-dim="drums" class="pf-vis-dim pf-part-drums" fill="none" stroke-width="2"/><path data-spectrum-dim="chords" class="pf-vis-dim pf-part-chords" fill="none" stroke-width="2"/><path data-spectrum-dim="tune" class="pf-vis-dim pf-part-tune" fill="none" stroke-width="2"/><path data-spectrum-part="bass" class="pf-vis-lit pf-part-bass" fill="none" stroke-width="3"/><path data-spectrum-part="drums" class="pf-vis-lit pf-part-drums" fill="none" stroke-width="3"/><path data-spectrum-part="chords" class="pf-vis-lit pf-part-chords" fill="none" stroke-width="3"/><path data-spectrum-part="tune" class="pf-vis-lit pf-part-tune" fill="none" stroke-width="3"/><path data-wave d="M 24 110 L 616 110" fill="none" stroke="currentColor" stroke-width="2" /></svg>';
  }

  _jamProfiles() {return hasSceneCatalogue(this.doc?.jam_session)?SCENE_CATALOGUE:this.doc?.jam_session?.showcase_arrangement==='contrast-v1'?CONTRAST_PROFILES:STYLE_PROFILES;}
  _spectrumDescription(position) {return spectrumDescription(position,this._jamProfiles());}
  _sceneChoicesHtml(spectrum,position){
    const profiles=this._jamProfiles();
    if(profiles.length<=8)return `<div class="pf-row" role="group" aria-label="Choose a musical style">${profiles.map((profile,index)=>this._choice(`jam-profile:${index}`,esc(profile.name),spectrum&&position===index,'pf-btn pf-small')).join('')}</div>`;
    const options=(items,start)=>items.map((profile,i)=>`<option value="${esc(profile.id)}" ${position===start+i?'selected':''}>${this.styleFavorites?.includes(profile.id)?'? ':''}${esc(profile.name)}</option>`).join('');
    return `<label for="pf-scene-picker">Choose a musical direction</label><select id="pf-scene-picker"><optgroup label="Original band">${options(profiles.slice(0,4),0)}</optgroup><optgroup label="More directions">${options(profiles.slice(4),4)}</optgroup></select>`;
  }
  _selectJamProfile(index){
    if(this.stage!=='jam'||!Number.isInteger(index)||index<0||index>=this._jamProfiles().length)return;
    const slow=!sceneTempoAllowed(this._jamProfiles()[index].id,this.doc.global_context.bpm);
    this.exploreTour=null;
    this._pushUndo();if(slow)this._fitTempo();this._acceptJamDoc(setJamDirection(this.doc,{style_spectrum:index}));
    this.app._announce(`${this.app.scheduler.isPlaying?'Requested: ':''}${this._jamProfiles()[index].name}. Your notes stay.`);
    this.render();
  }

  _paintListeningVisual(playing) {
    const visual=this.root?.querySelector('.pf-listening-visual');
    if(!visual)return;
    const path=visual.querySelector('[data-wave]'),spectrum=visual.querySelector('[data-spectrum]');
    const quiet=this.comfort.lessMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches||window.matchMedia('(forced-colors: active)').matches;
    const analyser=this.app.scheduler?.masterBus?.analyser,mode=this._visualMode();
    const clearParts=()=>{for(const p of visual.querySelectorAll('[data-spectrum-part],[data-spectrum-dim]'))p.setAttribute('d','');};
    if(!playing||quiet||!analyser||document.hidden||mode==='off') {
      path.setAttribute('d',mode==='off'?'':'M 24 110 L 616 110');spectrum.setAttribute('d','');clearParts();return;
    }
    const now=performance.now();
    if(now-(this.visualPaintTime||0)<50)return;
    this.visualPaintTime=now;
    if(this.visualBins?.length!==analyser.frequencyBinCount)this.visualBins=new Uint8Array(analyser.frequencyBinCount);
    if(this.visualWave?.length!==analyser.fftSize)this.visualWave=new Uint8Array(analyser.fftSize);
    analyser.getByteFrequencyData(this.visualBins);
    analyser.getByteTimeDomainData(this.visualWave);
    this.visualLevels ||= Array(32).fill(0);
    const groups={bass:'',drums:'',chords:'',tune:''},dim={bass:'',drums:'',chords:'',tune:''};
    for(const bar of visualBars(this.visualBins,this.visualLevels,this.soundingParts||new Set())) {
      const x=24+bar.i*592/31,h=bar.level*86;
      (bar.lit?groups:dim)[bar.part]+=`M ${x} ${110-h} L ${x} ${110+h} `;
    }
    let wave='';
    for(let i=0;i<128;i++) {
      const sample=(this.visualWave[Math.floor(i*(this.visualWave.length-1)/127)]-128)/128;
      wave+=`${i?' L':'M'} ${24+i*592/127} ${110-sample*90}`;
    }
    spectrum.setAttribute('d','');
    for(const part of Object.keys(groups)) {
      const lit=visual.querySelector(`[data-spectrum-part="${part}"]`),soft=visual.querySelector(`[data-spectrum-dim="${part}"]`);
      if(lit)lit.setAttribute('d',mode==='bars'?groups[part]:'');
      if(soft)soft.setAttribute('d',mode==='bars'?dim[part]:'');
    }
    path.setAttribute('d',wave);
  }

  _liveJamPads() {
    const context = this.doc.jam_session?.dynamic_keys ? this.app.scheduler.activeJamContext?.() : null;
    if (this.doc.jam_session?.live_keys) return melodyPads(this.doc, context, { octaveShift: this.padOctave || 0 });
    return this.doc.jam_session?.dynamic_keys ? dynamicJamPads(this.doc, context) : jamPads(this.doc);
  }

  _shiftPadOctave(delta) {
    const next = Math.max(-1, Math.min(1, (this.padOctave || 0) + delta));
    if (next === (this.padOctave || 0)) return;
    this.padOctave = next;
    this.app._announce(next > 0 ? "Keys are higher now." : next < 0 ? "Keys are lower now." : "Keys are back in the middle.");
    this.render();
  }

  _jamParticipationHtml({steering = ''} = {}) {
    const jam=this.doc.jam_session,scene=this._jamProfiles()[Math.round(jam.style_spectrum||0)];
    const favorite=this.styleFavorites?.includes(scene?.id);
    return `<details class="pf-participation" ${this.participationOpen?'open':''}><summary data-key="participation-options">More ways to play</summary>${steering}
      <div class="pf-row">${this._btn('jam-live-keys',jam.live_keys?'Play freely (no repeats)':'Use live keys (no repeats)','pf-btn pf-small',`aria-pressed="${Boolean(jam.live_keys)}"`)}
      ${this._btn('jam-responsive',jam.live_keys?'Band makes room':'Band responds','pf-btn pf-small',`aria-pressed="${jam.responsive===true}"`)}
      ${this._btn('jam-repeat-keys','Repeat my new notes','pf-btn pf-small',`aria-pressed="${!jam.live_keys}"`)}
      ${this._btn('jam-dynamic-keys','Keys follow the music','pf-btn pf-small',`aria-pressed="${jam.kind!=='drums'&&Boolean(jam.dynamic_keys)}" ${jam.kind==='drums'?'disabled':''}`)}
      ${this._btn('jam-follow-sound','Sound follows the band','pf-btn pf-small',`aria-pressed="${jam.kind!=='drums'&&Boolean(jam.dynamic_keys)&&jam.follow_band_sound!==false}" ${jam.kind==='drums'?'disabled':''}`)}
      ${this._btn('change-sound','Choose my instrument','pf-btn pf-small',`aria-expanded="${Boolean(this.instrumentPickerOpen)}"`)}</div>
      ${this.instrumentPickerOpen&&!this.showcaseControls&&jam.showcase_version===1?this._instrumentPickerHtml({changing:true}):''}
      <div class="pf-row">${this._btn('jam-keep-band','Build with this band','pf-btn pf-small',`aria-pressed="${!jam.personal_only}"`)}
      ${this._btn('jam-keep-personal','Start from my playing','pf-btn pf-small',`aria-pressed="${Boolean(jam.personal_only)}"`)}</div>
      <p class="pf-sub">${jam.personal_only?'Keep saves only your live playing into a new editable part. The band stays a separate reference.':'Keep saves the band and your playing together.'} ${jam.live_keys?'New notes play once.':'New notes repeat with the band.'} Keep saves the latest musical passage. ${jam.kind==='drums'?'Drum pads keep your selected kit.':''}</p>
      ${scene&&!jam.music_field?this._btn('jam-favorite',`${favorite?'Remove favorite':'Favorite selected style'}: ${esc(scene.name)}`,'pf-btn pf-small',`aria-pressed="${Boolean(favorite)}"`):''}
      ${jam.live_keys?'<p class="pf-sub">It plays your last notes back. Tap it once more to stop. Stop ends all sound. Band makes room: the band waits while you hold a note.</p>':''}
      <p class="pf-sub">Your stars stay on this device. The band plays them more.</p>${!jam.anchor_backing?this._btn('freeze-phrase','Freeze this phrase','pf-btn pf-small',this.app.scheduler?.isPlaying?'':'disabled'):''}</details>`;
  }

  _requestedField() { return this.fieldIntent?.field || this.doc.jam_session?.music_field || {version:1,x:.5,y:.5}; }

  cancelFieldGesture() { this.circleIntent=null;this.fieldIntent=null;this.fieldPointer=null;this.fieldGesture=false; }

  _pointMusicField(event,element) {
    if(!element)return;
    const rect=element.getBoundingClientRect();
    if(element.matches('[data-music-circle]')){const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;if(this.doc.jam_session.exploration_map==='catalogue-circle-v2'){const choice=circleChoiceAt(x,y);if(choice)this._requestCircle(choice.id,true,choice.field);}else{const id=circleSceneAt(x,y);if(id)this._requestCircle(id,true);}return;}
    this._requestMusicField({x:(event.clientX-rect.left)/rect.width,y:1-(event.clientY-rect.top)/rect.height},true);
  }

  _requestMusicField(position,gesture) {
    if(this.stage!=='jam'||!this.doc.jam_session?.music_field)return;
    const field={version:this.doc.jam_session.music_field.version,x:Math.round(Math.max(0,Math.min(1,position.x))*1000)/1000,
      y:Math.round(Math.max(0,Math.min(1,position.y))*1000)/1000};
    if(!Number.isFinite(field.x)||!Number.isFinite(field.y))return;
    if(!gesture||!this.fieldGesture)this._pushUndo();
    this.fieldGesture=gesture;this.exploreTour=null;
    this.fieldIntent={field,song:this.doc.id,stop:this.app.scheduler.stopGeneration};
    this._paintMusicField();
  }

  _flushMusicField() {
    if(this.circleIntent){
      const intent=this.circleIntent;this.circleIntent=null;
      if(this.stage!=='jam'||intent.song!==this.doc.id||intent.stop!==this.app.scheduler.stopGeneration||!this.doc.jam_session?.exploration_map){this.cancelFieldGesture();return;}
      if(intent.id!==this.doc.jam_session.scene_id||JSON.stringify(intent.field||null)!==JSON.stringify(this.doc.jam_session.music_field||null))this._acceptJamDoc(setJamDirection(this.doc,intent.field?{music_field:intent.field}:{scene_id:intent.id}));
    }
    const intent=this.fieldIntent;if(!intent)return;
    if(this.stage!=='jam'||intent.song!==this.doc.id||intent.stop!==this.app.scheduler.stopGeneration||!this.doc.jam_session?.music_field){this.cancelFieldGesture();return;}
    this.fieldIntent=null;
    if(JSON.stringify(intent.field)!==JSON.stringify(this.doc.jam_session.music_field))
      this._acceptJamDoc(setJamDirection(this.doc,{music_field:intent.field}));
  }

  _paintMusicField() {
    if(this.doc?.jam_session?.exploration_map){this._paintCircle();return;}
    if(!this.doc?.jam_session?.music_field)return;
    const field=this.root?.querySelector('[data-music-field]');if(!field)return;
    const requested=this._requestedField();
    const realized=this.app.scheduler.isPlaying?this.app.scheduler.activeJamBacking?.()?.phraseContext?.musicField:null;
    for(const [name,point] of [['requested',requested],['realized',realized?.version===requested.version?realized:null]]){
      const marker=field.querySelector(`[data-field-${name}]`);if(!marker)continue;
      marker.hidden=!point;
      if(point){marker.style.left=`${point.x*100}%`;marker.style.top=`${(1-point.y)*100}%`;}
    }
    for(const input of this.root.querySelectorAll('[data-field-axis]'))input.value=requested[input.dataset.fieldAxis];
    const label=this.root.querySelector('#pf-current-direction');
    if(label){const describe=f=>`${musicFieldDescription(f)}, ${Math.round(f.y*100)}% ringing`;
      const text=!this.app.scheduler.isPlaying?`Ready: ${describe(requested)}. Press Play.`:
        !realized?'Entering the field at a musical boundary.':
        requested.version===realized.version&&requested.x===realized.x&&requested.y===realized.y?`Playing: ${describe(realized)}.`:
        `Moving toward ${describe(requested)}. Playing: ${describe(realized)}.`;
      if(label.textContent!==text)label.textContent=text;
    }
  }

  _requestCircle(id,gesture,field) {
    if(this.stage!=='jam'||!this.doc.jam_session?.exploration_map||!CIRCLE_SCENES.includes(id))return;
    if(!gesture||!this.fieldGesture)this._pushUndo();
    this.fieldGesture=gesture;this.exploreTour=null;
    field=this.doc.jam_session.exploration_map==='catalogue-circle-v2'?(field===undefined?circleFieldForScene(id):field):null;
    this.circleIntent={id,field,song:this.doc.id,stop:this.app.scheduler.stopGeneration};this._paintCircle();
  }

  _paintCircle() {
    const circle=this.root?.querySelector('[data-music-circle]');if(!circle)return;
    const id=this.circleIntent?.id||this.doc.jam_session.scene_id,scheduler=this.app.scheduler;
    const context=scheduler.activeJamBacking?.()?.phraseContext,reached=context?.sceneId;
    const requestedField=this.circleIntent?this.circleIntent.field:this.doc.jam_session.music_field;
    const reachedField=context?.musicField?.version===5?context.musicField:null;
    const changing=scheduler.jamBridgeStage!=null||scheduler.pendingJamBacking!=null||scheduler.lastJamBackingCommit?.audioTime>scheduler.audioCtx?.currentTime;
    const name=value=>SCENE_CATALOGUE.find(s=>s.id===value)?.name||'music';
    for(const [kind,scene]of[['requested',id],['realized',scheduler.isPlaying&&(!changing||(reachedField&&scheduler.jamBridgeStage==null))?reached:null]]){
      const mark=circle.querySelector(`[data-circle-${kind}]`),field=kind==='requested'?requestedField:reachedField,point=scene?(circleFieldPosition(field)||circlePosition(scene)):null;
      if(mark){mark.hidden=!point;if(point){mark.style.left=`${point.x*100}%`;mark.style.top=`${point.y*100}%`;}}
    }
    const describe=(scene,field)=>field?.version===5?musicFieldDescription(field):name(scene);
    const title=circle.querySelector('[data-circle-title]');if(title)title.textContent=describe(id,requestedField);
    const blend=this.root.querySelector('[data-circle-blend]');if(blend&&document.activeElement!==blend)blend.value=requestedField?.version===5?requestedField.x:.5;
    const label=this.root.querySelector('#pf-current-direction');
    if(label){const mode=requestedField?.version===5?'Scored blend':'Boundary change';const text=!scheduler.isPlaying?`Ready: ${describe(id,requestedField)}.`:changing||id!==reached||JSON.stringify(requestedField||null)!==JSON.stringify(reachedField||null)?`${mode}: moving toward ${describe(id,requestedField)}.`:`Playing: ${describe(reached,reachedField)}.`;if(label.textContent!==text)label.textContent=text;}
    const picker=this.root.querySelector('#pf-circle-picker');if(picker&&document.activeElement!==picker)picker.value=id;
  }

  _musicCircleHtml() {
    const short=['Originals','Roots','Blues','Jazz','Soul','Reggae / ska','Hip-hop','House','Breaks','Rock'];
    const labels=CIRCLE_GROUPS.map((group,i)=>{const angle=((i+.5)/CIRCLE_GROUPS.length-.25)*2*Math.PI;return `<span class="pf-circle-family" style="left:${50+34*Math.cos(angle)}%;top:${50+34*Math.sin(angle)}%" title="${esc(group.label)}">${esc(short[i]||group.label)}</span>`;}).join('');
    const ticks=CIRCLE_SCENES.map(id=>{const p=circlePosition(id);return `<span class="pf-circle-tick" style="left:${p.x*100}%;top:${p.y*100}%"></span>`;}).join('');
    const blendControls=this.doc.jam_session.exploration_map==='catalogue-circle-v2'?`<label for="pf-circle-blend">Blend Ska, Rocksteady and Reggae</label><input id="pf-circle-blend" data-circle-blend type="range" min="0" max="1" step="0.025" value=".5" /><div class="pf-row">${this._btn('circle-blend:less','Toward Ska','pf-btn pf-small')}${this._btn('circle-blend:more','Toward Reggae','pf-btn pf-small')}</div>`:'';
    return `<section aria-label="Circular music explorer"><p class="pf-sub">Drag the dot round. Or use the arrow keys.</p>
      <div class="pf-music-circle" data-music-circle tabindex="0" role="group" aria-label="Circular music explorer. Left and right choose a style; up and down choose a family.">
        ${this._listeningVisualHtml()}<div aria-hidden="true">${ticks}${labels}</div><strong data-circle-title class="pf-circle-title"></strong>
        <span data-circle-requested class="pf-field-requested"></span><span data-circle-realized class="pf-field-realized" hidden></span>
      </div><p class="pf-sub">${CIRCLE_SCENES.length} styles. Ring: your pick. Dot: what plays.</p>
      <details><summary data-key="circle-options">Choose without dragging</summary>
        <div class="pf-row">${this._btn('circle-previous','Previous style','pf-btn pf-small')}${this._btn('circle-next','Next style','pf-btn pf-small')}${this._btn('circle-family','Next family','pf-btn pf-small')}</div>
        ${blendControls}
        <label for="pf-circle-picker">Musical direction</label><select id="pf-circle-picker">${CIRCLE_GROUPS.map(g=>`<optgroup label="${esc(g.label)}">${g.sceneIds.map(id=>`<option value="${id}" ${id===this.doc.jam_session.scene_id?'selected':''}>${esc(SCENE_CATALOGUE.find(s=>s.id===id).name)}</option>`).join('')}</optgroup>`).join('')}</select>
        <p class="pf-sub">${this.doc.jam_session.exploration_map==='catalogue-circle-v2'?'Ska, Rocksteady and Reggae share a scored blend. Other regions use boundary changes. ':''}These are original interpretations, supported up to 160 BPM. The band changes at musical boundaries; the circle is a way to browse, not a claim that every neighboring style blends continuously. More styles and connections are still being built.</p>
      </details></section>`;
  }

  _musicFieldHtml() {
    const connected=this.doc.jam_session.music_field.version===4;
    const roots=this.doc.jam_session.music_field.version===3;
    const expanded=connected||this.doc.jam_session.music_field.version===2;
    const left=connected?'Reggae':roots?'Rocksteady':'Offbeat',right=roots?'Reggae':expanded?'Dance':'Steady';
    const regionLabels=expanded?'<div class="pf-field-regions" aria-label="Rhythmic regions">'+(connected?CONNECTED_FIELD_REGIONS:FIELD_REGIONS).map((name,i)=>'<span aria-label="'+esc(name)+'">'+esc(connected?['Reggae','Rocksteady','Offbeat','Pop','Funk','Dance'][i]:name)+'</span>').join('')+'</div>':'';
    return `<section aria-label="Continuous musical field">
      <p class="pf-sub">Move left or right to explore. Move up to let ${roots?'chords':'notes'} ring longer. Drag or use arrow keys.</p>
      <div class="pf-music-field" data-music-field tabindex="0" role="group" aria-label="Musical field. Arrow left and right change rhythm. Arrow up and down change note length.">
        ${this._listeningVisualHtml()}
        <span class="pf-field-corner">${left} / ringing</span><span class="pf-field-corner pf-field-right">${right} / ringing</span>
        <span class="pf-field-corner pf-field-bottom">${left} / short</span><span class="pf-field-corner pf-field-right pf-field-bottom">${right} / short</span>
        <span data-field-realized class="pf-field-realized" hidden></span><span data-field-requested class="pf-field-requested"></span>
      </div>${regionLabels}<p class="pf-sub">Ring: where you are going. Dot: what plays now.</p>
      <details class="pf-field-adjust"><summary data-key="field-options">Adjust without dragging</summary>
        <div class="pf-row">${this._btn('field-nudge:x:less',`Toward ${left}`,'pf-btn pf-small')}${this._btn('field-nudge:x:more',`Toward ${right}`,'pf-btn pf-small')}${this._btn('field-nudge:y:less',roots?'Shorter chords':'Shorter notes','pf-btn pf-small')}${this._btn('field-nudge:y:more',roots?'Longer chords':'Longer notes','pf-btn pf-small')}</div>
        <label>${connected?'Reggae through Rocksteady, offbeat, pop and funk to dance':roots?'Rocksteady to Reggae':expanded?'Offbeat through pop and funk to dance':'Offbeat to steady pulse'} <input type="range" min="0" max="1" step=".025" data-field-axis="x" value="${this._requestedField().x}"></label>
        <label>${roots?'Short to ringing chords':'Short to ringing'} <input type="range" min="0" max="1" step=".025" data-field-axis="y" value="${this._requestedField().y}"></label>
      ${!connected?`<div class="pf-row">${this._btn('field-connected','Explore connected spectrum','pf-btn pf-small')}</div>`:''}
      ${connected?'<p class="pf-sub">Six styles in a row. Slide to move from one to the next. Fast songs slow down to fit.</p>':''}
      ${!roots&&!connected?'<p class="pf-sub">Slide from one to the next. Fast songs slow down to fit.</p>':''}
      ${roots?'<p class="pf-sub">Fast songs slow down to fit. The band plays keys, bass and short replies.</p>':''}
      </details></section>`;
  }

  _honeycombHtml() {
    if (!hasSceneCatalogue(this.doc.jam_session)) return this._listeningVisualHtml();
    const current = Math.round(this.doc.jam_session.style_spectrum || 0);
    const scene = SCENE_CATALOGUE[current];
    const neighbors = compatibleSceneIndices(current);
    const pages = Math.max(1, Math.ceil(neighbors.length / 6));
    const page = (this.honeycombPage || 0) % pages;
    const buttons = neighbors.slice(page * 6, page * 6 + 6).map((index, slot) =>
      this._btn(`honey-style:${index}`, esc(SCENE_CATALOGUE[index].name),
        `pf-btn pf-hex pf-hex-${slot}`, `aria-label="Explore ${esc(SCENE_CATALOGUE[index].name)}"`)).join('');
    return `<section class="pf-groove-map" aria-label="Explore connected music">
      <div class="pf-honeycomb">
        <div class="pf-hex-center"><span class="pf-sub">Selected direction</span><strong>${esc(scene.name)}</strong>${this._listeningVisualHtml()}</div>
        ${buttons}
      </div>
      <p class="pf-sub">Pick a sound near this one. The band moves to it soon.</p>
      ${pages > 1 ? this._btn('honey-page', `More nearby (${page + 1}/${pages})`, 'pf-btn pf-small') : ''}
      <details class="pf-all-directions"><summary>All ${SCENE_CATALOGUE.length} directions</summary>${this._sceneChoicesHtml(true,current)}</details>
    </section>`;
  }

  _renderListeningJam() {
    const jam=this.doc.jam_session,playing=Boolean(this.app.scheduler?.isPlaying);
    const livePads=this._liveJamPads();
    const pads=livePads.map((pad,index)=>{const waiting=this.pendingPad?.pad===index;
      return this._btn(`jam-pad:${index}`,`<kbd>${pad.key.toUpperCase()}</kbd> ${esc(pad.label)}`,`pf-btn pf-jam-pad${pad.home?' pf-pad-home':''}${waiting?' pf-pad-waiting':''}`,`aria-label="${pad.key.toUpperCase()}: ${esc(pad.label)}${pad.home?', a home note':''}"${waiting?' aria-busy="true"':''}`);}).join('')
      +(livePads.length>4?`<div class="pf-row pf-octave" role="group" aria-label="Key height">${this._btn('pad-octave:-1','Lower keys','pf-btn pf-small',(this.padOctave||0)<=-1?'disabled':'')}${this._btn('pad-octave:1','Higher keys','pf-btn pf-small',(this.padOctave||0)>=1?'disabled':'')}</div>`:'');
    if(jam.music_field||jam.exploration_map)return `<div class="pf-stage pf-listening-stage pf-demo-stage">
      <h1 class="pf-heading">Find your groove</h1>
      ${jam.exploration_map?this._musicCircleHtml():this._musicFieldHtml()}
      <p class="pf-sub" id="pf-current-direction" aria-live="polite"></p>
      <div class="pf-row">${[this._btn('play',playing?'Stop':'Listen','pf-btn pf-play'),this._btn('capture-direction','Make my song','pf-btn pf-next'),this._btn('undo','Undo','pf-btn pf-small')].join('')}</div>
      <div class="pf-jam-pads" role="group" aria-label="Play with the band">${pads}</div>
      <p class="pf-sub">Touch a pad. ${jam.live_keys?'Or play A to K. Bright pads always fit. Hold to let your note ring.':'Or play A S D F. Your notes repeat with the band.'}</p>
      <p class="pf-sub" id="pf-answer-heard" aria-live="polite"></p>
      <p class="pf-sub" id="pf-key-sound"></p>
      ${this.jamMessage?`<p role="status" class="pf-sub">${esc(this.jamMessage)}</p>`:''}
      ${this._sheetBoxHtml()}
      <details class="pf-demo-tools" ${this.demoToolsOpen?'open':''}><summary data-key="demo-tools">More</summary>
        ${jam.live_keys?`<div class="pf-row">${this._btn('jam-answer','Answer this','pf-btn pf-small')}${this._btn('jam-auto-answer','Band answers me','pf-btn pf-small',`aria-pressed="${jam.auto_answer===true}"`)}</div>
        <p id="pf-answer-status" class="pf-sub" role="status">${jam.auto_answer===true?'Play, then pause. The band plays your notes back.':'Play and let go. Answer this plays your last notes back.'}</p>`:''}
        ${jam.exploration_map?this._btn('enter-field','Six-region continuous blend (up to 160 BPM)','pf-btn pf-small'):this._btn('enter-circle','Playable circle (up to 160 BPM)','pf-btn pf-small')}
        ${this._jamParticipationHtml()}
        <div class="pf-row">${this._btn('settings',this.comfortOpen?'Close help and settings':'Help and settings','pf-btn pf-small',`aria-expanded="${Boolean(this.comfortOpen)}"`)}${this._btn('speak-screen','Read this','pf-btn pf-small')}${this._backBtn()}</div>
        ${this.comfortOpen?this._renderComfort():''}
      </details>
    </div>`;
    return `<div class="pf-stage pf-listening-stage"><h1 class="pf-heading">Find your groove</h1>
      ${jam.music_field?this._musicFieldHtml():this._honeycombHtml()}
      <p class="pf-sub" id="pf-current-direction" aria-live="polite"></p>
      <p class="pf-say">${jam.anchor_backing?'This phrase is frozen. Explore when you are ready.':this.exploreTour?'The band explores. You steer.':'Staying with this style. The tune keeps moving.'}</p>
      <div class="pf-row">${this._btn('play',playing?'Stop':'Play','pf-btn pf-play')}
      ${!jam.music_field?this._btn('stay-style',this.exploreTour?'Stay here':'Explore','pf-btn',`aria-pressed="${Boolean(this.exploreTour)}" ${playing?'':'disabled'}`):this._btn('leave-field','Connected styles','pf-btn')}
      ${!jam.music_field?this._btn('change-style','Change style','pf-btn',playing?'':'disabled'):''}
      ${this._btn('capture-direction','Make my song','pf-btn pf-next')}</div>
      <div class="pf-jam-pads" role="group" aria-label="Play with the band">${pads}</div>
      <p class="pf-sub">Tap a pad or play A S D F. ${jam.live_keys?'Hold to let a note ring.':'Your notes repeat with the band.'} Make my song keeps it all.</p>
      <p class="pf-sub" id="pf-key-sound"></p>
      ${this._sheetBoxHtml()}
      ${jam.live_keys?`<div class="pf-row">${this._btn('jam-answer','Answer this','pf-btn pf-small',playing?'':'disabled')}${this._btn('jam-auto-answer','Band answers me','pf-btn pf-small',`aria-pressed="${jam.auto_answer===true}"`)}</div>
      <p id="pf-answer-status" class="pf-sub" role="status">${jam.auto_answer===true?'Play, then pause. The band plays your notes back.':'Play and let go. Answer this plays your last notes back.'}</p>`:''}
      ${this._jamParticipationHtml({steering:jam.music_field?'':jam.anchor_backing?this._keptBandControlsHtml():`<div class="pf-row" role="group" aria-label="Steer the band">${this._btn('jam-density:less','More space','pf-btn pf-small',jam.density===0?'disabled':'')}
      ${this._btn('jam-density:more','More movement','pf-btn pf-small',jam.density===4?'disabled':'')}</div>`})}
      ${this.jamMessage?`<p role="status" class="pf-sub">${esc(this.jamMessage)}</p>`:''}
      <div class="pf-row">${!jam.music_field?this._btn('enter-field','Explore musical field (up to 160 BPM)','pf-btn pf-small'):''}${!jam.music_field?this._btn('showcase-controls','Open full controls','pf-btn pf-small'):''}${this._btn('undo','Undo','pf-btn pf-small')}${this._backBtn()}</div>
    </div>`;
  }

  _keptBandStatus() {
    const s=this.app.scheduler;
    if(this.keptBandNoChange)return this.keptBandNoChange;
    if(!s.isPlaying)return 'Ready for Play.';
    return s.pendingJamBacking!=null||s.lastJamBackingCommit?.audioTime>s.audioCtx.currentTime
      ?'Changing at the next available bar.':'Your adjustment is playing.';
  }

  _keptBandControlsHtml() {
    const jam=this.doc.jam_session;
    if(!jam?.anchor_backing)return '';
    const values=jam.anchor_traits||{drums:2,chords:2};
    const hasDrums=jam.anchor_backing.notes.some(n=>n.role==='drums'&&n.velocity>0);
    const hasChords=jam.anchor_backing.notes.some(n=>n.role==='harmony'&&n.duration_steps>0);
    return `<section aria-label="Adjust the band you kept"><p class="pf-sub">You are changing the band you kept. Your notes stay.</p>
      <div class="pf-row" role="group" aria-label="Drum strength">
      ${this._btn('kept-drums:less','Gentler drums','pf-btn pf-small',!hasDrums||values.drums===0?'disabled':'')}
      ${this._btn('kept-drums:more','Stronger drums','pf-btn pf-small',!hasDrums||values.drums===4?'disabled':'')}</div>
      ${hasDrums?'':'<p class="pf-sub">This band has no drums.</p>'}
      <div class="pf-row" role="group" aria-label="Chord note length">
      ${this._btn('kept-chords:less','Shorter chords','pf-btn pf-small',!hasChords||values.chords===0?'disabled':'')}
      ${this._btn('kept-chords:more','Longer chords','pf-btn pf-small',!hasChords||values.chords===4?'disabled':'')}</div>
      ${hasChords?'':'<p class="pf-sub">This band has no chords.</p>'}
      <p class="pf-sub" role="status" data-kept-band-status>${this._keptBandStatus()}</p></section>`;
  }

  _sharedStyleControlsHtml() {
    const jam=this.doc.jam_session;
    if(!hasSceneCatalogue(jam))return '';
    const values=jam.style_traits||{drums:2,chords:2},frozen=Boolean(jam.anchor_backing);
    const available=role=>this.doc.notes.some(n=>n.provenance==='jam_generated'&&n.role===role);
    return `<section aria-label="Settings across styles"><h2>Band feel</h2>
      <p class="pf-sub">Your choice stays on as the band moves. Each style has its own sound.</p>
      ${frozen?`<p class="pf-sub">Stay holds this band. Use its levels as you roam. This band will not change.</p>${this._btn('shared-from-kept','Carry these levels','pf-btn pf-small')}`:''}
      <div class="pf-row" role="group" aria-label="Drum strength across styles">
      ${this._btn('shared-drums:less','Gentler across styles','pf-btn pf-small',frozen||!available('drums')||values.drums===0?'disabled':'')}
      ${this._btn('shared-drums:more','Stronger across styles','pf-btn pf-small',frozen||!available('drums')||values.drums===4?'disabled':'')}</div>
      ${!frozen&&!available('drums')?'<p class="pf-sub">This style has no drums. Your drum picks come back later.</p>':''}
      <div class="pf-row" role="group" aria-label="Chord length across styles">
      ${this._btn('shared-chords:less','Shorter across styles','pf-btn pf-small',frozen||!available('harmony')||values.chords===0?'disabled':'')}
      ${this._btn('shared-chords:more','Longer across styles','pf-btn pf-small',frozen||!available('harmony')||values.chords===4?'disabled':'')}</div>
      ${!frozen&&!available('harmony')?'<p class="pf-sub">This style has no chords. Your chord picks come back later.</p>':''}
      ${this._btn('shared-reset','Reset shared settings','pf-btn pf-small',frozen?'disabled':'')}
      ${this._btn('shared-banjo','Banjo chords','pf-btn pf-small',`aria-pressed="${jam.band_chord_patch==='sampled_banjo_v1'}" ${frozen||!CHORD_VOICE_SCENES.includes(jam.scene_id)?'disabled':''}`)}
      <p class="pf-sub">Banjo chords play here. The rest use their own sound.</p></section>`;
  }

  _renderJam() {
    if(this.doc.jam_session?.showcase_version===1&&!this.showcaseControls)return this._renderListeningJam();
    const jam = this.doc.jam_session;
    const spectrum = Number.isFinite(jam?.style_spectrum);
    const position = spectrum ? jam.style_spectrum : jam?.style_blend ?? 0;
    const selected = getInstrument(this.doc.selected_instrument) || getInstrument(this.doc.lead_patch_id) || getInstrument("warm_keys");
    const playing = Boolean(this.app.scheduler?.isPlaying);
    const pads = this._liveJamPads().map((pad, index) => this._btn(`jam-pad:${index}`, `<kbd>${pad.key.toUpperCase()}</kbd> ${esc(pad.label)}`, "pf-btn pf-jam-pad", `aria-label="${pad.key.toUpperCase()}: add ${esc(pad.label)}"`)).join("");
    return `<div class="pf-stage pf-jam">${jam?.showcase_version===1?this._btn('showcase-controls','Back to listening','pf-btn pf-small'):''}<h1 class="pf-heading">Join the band</h1>${this._jamParticipationHtml()}
      <p class="pf-say">Press Play, then add your sound. No wrong turns. Undo is here.</p>
      <div class="pf-jam-instrument"><img src="${esc(selected.image)}" alt="" width="120" height="85" /><strong>${esc(selected.label)}</strong>
      ${this._btn("change-sound", "Change sound", "pf-btn pf-small", `aria-expanded="${Boolean(this.instrumentPickerOpen)}"`)}</div>
      ${this.instrumentPickerOpen ? this._instrumentPickerHtml({ changing: true }) : ""}
      <div class="pf-row">${this._btn("play", playing ? "Stop band" : "Play band", "pf-btn pf-play")}${this._btn("undo", "Undo", "pf-btn pf-small")}</div>
      <div class="pf-row">${this._btn("explore-tour", this.exploreTour ? "Stay in this direction" : "Explore automatically", "pf-btn", `aria-pressed="${Boolean(this.exploreTour)}" ${playing ? '' : 'disabled'}`)}</div>
      <div class="pf-row">${this._btn('explore-near','Explore nearby','pf-btn pf-small',playing?'':'disabled')}${this._btn('explore-wide','Explore wider','pf-btn pf-small',playing?'':'disabled')}</div>
      <p class="pf-sub">${this.doc.jam_session?.anchor_backing ? 'Nearby varies the band active when you pressed. It returns at the next bar; notes already queued can still play. Style, tone and density controls leave this snapshot.' : 'Nearby varies the active band. Wider visits other connected styles.'}</p>
      <p class="pf-sub" id="pf-explore-status">${this.exploreTour ? 'Exploring connected styles. Each direction has time to settle before the next. Stay here to shape it, or keep playing along.' : 'Choose a direction yourself, or let the band explore. You can join in at any time.'}</p>
      ${this._keptBandControlsHtml()}
      ${this._sharedStyleControlsHtml()}
      <div class="pf-jam-pads" role="group" aria-label="Play and keep notes">${pads}</div>
      <p class="pf-sub">Tap a pad or press A, S, D, F. Each press adds to the beat. You can play with the band stopped too.</p>
      <div class="pf-row">${this._btn("jam-responsive", jam?.live_keys?"Make room for my playing":"Band responds", "pf-btn pf-small", `aria-pressed="${jam?.responsive === true}"`)}</div>
      <p class="pf-sub">${jam?.live_keys ? "Make room omits new generated lead attacks while you hold notes and leaves space in a later phrase. Already sounding notes may finish. Turn it off for uninterrupted lead phrases. Your notes keep their sound and timing; Keep saves the actual performance." : jam?.responsive === true ? "The bass echoes your notes in the gaps. Turn this off to keep a steady backing. Responses are editable MusicLab notes." : "The backing stays steady as you add notes."} Band changes join at the next available bar. While playing, Keep saves the latest passage through your press, including this unfinished bar. ${jam?.live_keys?'After Stop, Keep retains the last performance from this song.':'With the band stopped, it keeps the editable loop.'}</p>
      <div class="pf-jam-directions">
        <div role="group" aria-label="Blend musical styles"><h2>Find your groove</h2>
        ${this._sceneChoicesHtml(spectrum,position)}
        <label for="pf-style-blend">${spectrum?'Explore connected styles':'Laid back to dance (saved blend)'}</label>
        <input id="pf-style-blend" data-key="jam-style-blend" type="range" min="0" max="${spectrum?(this._jamProfiles().length-1)*100:100}" step="${hasSceneCatalogue(jam)?100:5}" value="${Math.round(position * 100)}" aria-describedby="pf-style-value" />
        <span id="pf-style-value">${playing ? 'Requested: ' : ''}${spectrum?this._spectrumDescription(position):`${Math.round(position*100)}% dance`}</span>
        <p class="pf-sub">${this._jamProfiles().length} original, genre-inspired directions at your current key and pace. Your notes stay. The beat joins at a bar; the rest follows one bar later.</p>
        <div class="pf-row" role="group" aria-label="Phrase variation">${SCENE_VARIANTS.map(item=>this._choice(`jam-phrase:${item.id}`,esc(item.name),(jam?.scene_variant||'base')===item.id,'pf-btn pf-small')).join('')}</div>
        <p class="pf-sub">${esc(sceneDescription(jam?.scene_variant||'base'))}: a musical phrase. Changes join the running musical cycle.</p>
        <div class="pf-row">${this._btn("jam-style:less", hasSceneCatalogue(jam)?"Previous direction":"More laid back", "pf-btn", position === 0 ? "disabled" : "")}${this._btn("jam-style:more", hasSceneCatalogue(jam)?"Next direction":"More dance", "pf-btn", position === (spectrum?this._jamProfiles().length-1:1) ? "disabled" : "")}</div></div>
        <div role="group" aria-label="Band activity"><h2>Space to move</h2><p>Band beat: ${(jam?.density ?? 1) + 1} of 5</p><div class="pf-row">
        ${this._btn("jam-density:less", "Less busy", "pf-btn", (jam?.density ?? 1) === 0 ? "disabled" : "")}${this._btn("jam-density:more", "More busy", "pf-btn", jam?.density === 4 ? "disabled" : "")}</div></div>
        <div role="group" aria-label="Band tone"><h2>Find your sound</h2><p>Band sound: ${(jam?.color ?? 1) + 1} of 5</p><div class="pf-row">
        ${this._btn("jam-color:less", jam?.showcase_version===1?"Previous band sound":"Warmer", "pf-btn", (jam?.color ?? 1) === 0 ? "disabled" : "")}${this._btn("jam-color:more", jam?.showcase_version===1?"Next band sound":"Brighter", "pf-btn", jam?.color === 4 ? "disabled" : "")}</div></div>
      </div>
      <p class="pf-say">${esc(jamDirectionDescription(this.doc))}</p>
      ${this.jamMessage && this.jamMessage !== jamDirectionDescription(this.doc) ? `<p class="pf-say pf-msg" role="status">${esc(this.jamMessage)}</p>` : ""}
      <div class="pf-row">${this._btn("capture-direction", "Make my song", "pf-btn pf-next")}${this._btn("jam-edit", "Edit my notes", "pf-btn")}</div>
      <p class="pf-sub">Keep this sound. Then make parts and pick an end. The band starts the notes.</p>
      <div class="pf-row">${this._backBtn()}</div>
    </div>`;
  }

  /** Comfort setup (9c-5): 2 groups of 2 switches so each group stays within T4 (<= 3 options). */
  _renderComfort() {
    const group = (opts, label) => {
      const btns = opts.map((o) => this._choice(`comfort:${o.key}`, o.label, Boolean(this.comfort[o.key]))).join("");
      return `<div class="pf-row" role="group" aria-label="${label}">${btns}</div>`;
    };
    const voiceLevel = Math.round((this.comfort.voiceVolume || 0.8) * 5);
    const voiceRow = this.comfort.speak
      ? `<div class="pf-row" role="group" aria-label="Voice volume">
          ${this._btn("voice:down", "Voice softer")}
          <span class="pf-speed" aria-live="polite">${voiceLevel}</span>
          ${this._btn("voice:up", "Voice louder")}
        </div>`
      : "";
    const vol = document.getElementById("input-volume");
    const locked = Boolean(vol?.disabled);
    const level = Math.round(Number(vol?.value ?? 80) / 10);
    const volRow = locked
      ? `<p class="pf-say">Music is locked.</p>`
      : `<div class="pf-row" role="group" aria-label="Music volume">
          ${this._btn("music:down", "Music softer")}
          <span class="pf-speed" aria-live="polite">${level}</span>
          ${this._btn("music:up", "Music louder")}
        </div>`;
    return `
      <div class="pf-details">
        <p class="pf-say">Make this screen fit you. These stay set here.</p>
        ${group(COMFORT_SWITCH_CARDS.slice(0, 3), "Reading and movement")}
        ${group(COMFORT_SWITCH_CARDS.slice(3, 5), "Size and sound")}
        ${voiceRow}
        ${volRow}
      </div>`;
  }

  _renderBeat({ embedded = false } = {}) {
    const bpm = Math.round(Number(this.doc.global_context.bpm || 100));
    const fresh = !madeByYou(this.doc);
    const selectedPatch = getInstrument(this.doc.selected_instrument)?.patchId;
    const visibleLanes = LANES.filter(lane => ["kick", "clap", "hat"].includes(lane.id)
      || lane.patch === selectedPatch || this.doc.notes.some(note => note.role === "drums" && note.patch_id === lane.patch));
    const rows = visibleLanes.map((lane, lIdx) => {
      const cells = (this.beatGrid[lane.id] || Array(BEAT_STEPS).fill(null)).slice(0,stepsPerBar(this.doc)/2)
        .map((prov, s) => {
          const on = Boolean(prov);
          const mine = prov === "user_placed";
          const startHere = fresh && lIdx === 1 && s === 2;
          const beatMark = s % 2 === 0 ? " beat" : "";
          const label = `${lane.label} step ${s + 1}${on ? (mine ? ", yours" : ", starter") : ""}`;
          const padTip = mine
            ? "Your drum hit (tap to clear)"
            : on
              ? "Starter beat (tap to keep as yours)"
              : "Tap to add a drum hit";
          const inner = on ? icon(LANE_ICONS[lane.id]) : "";
          return `<button type="button" class="pf-pad${on ? " on" : ""}${mine ? " mine" : ""}${startHere ? " start-here" : ""}${beatMark}"
            data-key="pad:${lane.id}:${s}" data-lane="${lane.id}" data-step="${s}"${mine ? ' data-pinned="true"' : ""}
            title="${padTip}" aria-pressed="${on}" aria-label="${label}">${inner}</button>`;
        })
        .join("");
      return `<div class="pf-lane"><span class="pf-lane-label">${icon(LANE_ICONS[lane.id])} ${lane.label}</span><div class="pf-pads">${cells}</div></div>`;
    }).join("");
    const playing = Boolean(this.app.scheduler?.isPlaying);
    const kit = this.doc.drum_kit || "punchy";
    const kitBtns = KITS.map((k) => this._choice(`kit:${k.id}`, `${icon(k.icon)} ${k.label}`, kit === k.id)).join("");
    const tapConfirm =
      this.tapBpm !== null
        ? this._btn(`use-speed:${this.tapBpm}`, `${icon("check")} Use ${this.tapBpm}`, "pf-btn pf-next")
        : "";
    const clearArmed = this.confirm.armed === "clear-beat";
    const bandBtns = BANDS.map((b) =>
      this._choice(`band:${b.id}`, `${icon(b.icon)} ${b.label}`, this.doc.band_id === b.id)
    ).join("");
    const details =
      !embedded && this.detailsOpen
        ? `<div class="pf-details">
            <div class="pf-row" role="group" aria-label="Pick your band">${bandBtns}</div>
            <div class="pf-row" role="group" aria-label="Change speed">
              ${this._btn("slower", `${icon("slow")} Slower`)}
              <span class="pf-speed" aria-live="polite">${bpm}</span>
              ${this._btn("faster", `Faster ${icon("fast")}`)}
            </div>
            <div class="pf-row">
              ${this._choice("beat-fill", `${icon("flag")} Bar 4 fill`, Boolean(this.doc.beat_fill), "pf-btn pf-small")}
              ${this._btn("clear-beat", clearArmed ? "Sure? Clear it" : `${icon("trash")} Clear the beat`, `pf-btn pf-small${clearArmed ? " pf-armed" : ""}`)}
            </div>
          </div>`
        : "";
    const { hasBeat } = this._progressiveState();
    const showBeatChoices = hasBeat || embedded;
    const beatFlowSvg = buildBeatStreamSvg(this.beatGrid, { bpm });
    const kitRow = showBeatChoices
      ? `<div class="pf-row pf-unfold" role="group" aria-label="Drum sound">${kitBtns}</div>`
      : "";
    const speedRow = showBeatChoices
      ? `<div class="pf-row pf-unfold" aria-label="Speed">
          <span class="pf-speed" aria-live="polite">${bpm}</span>
          ${this._btn("tap", `${icon("drum")} Tap speed`)}
          ${tapConfirm}
        </div>`
      : "";
    const footer = embedded
      ? ""
      : `<div class="pf-row">
          ${this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play")}
          ${showBeatChoices ? this._btn("undo", `${icon("undo")} Undo`) : ""}
          ${this._btn("to-tune", `Make a tune ${icon("next")}`, "pf-btn pf-next")}
          ${this._backBtn()}
        </div>
        <div class="pf-row pf-drawer">
          ${showBeatChoices ? this._btn("roll-beat", `${icon("sparkle")} Try a beat`, "pf-btn pf-small") : ""}
          ${showBeatChoices ? this._btn("toggle-details", this.detailsOpen ? "Hide details" : `${icon("sliders")} Details`, "pf-btn pf-small") : ""}
          ${showBeatChoices ? this._btn("toggle-all-view", `${icon("grid")} All at once`, "pf-btn pf-small") : ""}
          ${this._btn("keep", `${icon("save")} Skip to end`, "pf-btn pf-small")}
        </div>
        ${details}`;
    return `
      <div class="pf-stage pf-beat">
        <div class="pf-head-row"><h1 class="pf-heading">${this.doc.jam_start || this.doc.captured_performance ? "Shape your beat" : "1. Play with the beat"}</h1>${this._barsHtml()}</div>
        <p class="pf-say">Tap the pads to add or clear drums. Tap a dashed pad to make it yours.</p>
        ${kitRow}
        <div class="pf-grid" data-water-grid="beat" role="group" aria-label="Beat pads">${beatFlowSvg}${rows}</div>
        ${speedRow}
        ${footer}
      </div>`;
  }

  _chordPcsList() {
    const prog = this.doc?.chord_progressions?.[this.doc?.active_progression_id || "prog-main"] || [];
    return prog.map((c) => c.pcs || c.chord_pcs || []).filter((a) => Array.isArray(a) && a.length > 0);
  }

  _suggesterInput(justCol) {
    if (justCol === null || justCol === undefined) return null;
    const rootPc = Number(this.doc.global_context.root_pc || 0);
    const scaleType = this.doc.global_context.scale_type || "major";
    const dial = this.doc.note_dial || "lock";
    const activeCells = this.tuneTab === "ending" ? this.tuneGrid.ending : this.tuneGrid.main;
    const extraMidis = [...this.tuneGrid.main, ...this.tuneGrid.ending].filter(Boolean).map((c) => c.midi);
    const rows = tuneRows(rootPc, scaleType, extraMidis, dial); // low to high
    return {
      cells: activeCells.map((c) => (c ? c.midi : null)),
      justCol,
      rows,
      rootPc,
      chordPcsList: this._chordPcsList(),
    };
  }

  _renderTune({ embedded = false } = {}) {
    if (this.tuneGrid.eventEditor) return this._renderEventTune();
    const rootPc = Number(this.doc.global_context.root_pc || 0);
    const scaleType = this.doc.global_context.scale_type || "major";
    const dial = this.doc.note_dial || "lock";
    const activeCells = this.tuneTab === "ending" ? this.tuneGrid.ending : this.tuneGrid.main;
    const extraMidis = [...this.tuneGrid.main, ...this.tuneGrid.ending].filter(Boolean).map((c) => c.midi);
    const rowsLowToHigh = tuneRows(rootPc, scaleType, extraMidis, dial);
    const rows = rowsLowToHigh.slice().sort((a, b) => b - a);
    const home = 60 + ((rootPc % 12) + 12) % 12;

    const size = this._pageSize();
    const pages = Math.ceil(TUNE_STEPS / size);
    const page = this.tunePage % pages;
    const first = page * size;
    const cols = Array.from({ length: size }, (_, i) => first + i);

    const ideas = this.suggester.list || [];
    const ideaMap = new Map(ideas.map((s) => [`${s.col}:${s.midi}`, s]));
    const clashSet = dial === "guide" ? new Set(clashingRows(rowsLowToHigh, this._chordPcsList())) : new Set();

    const gridHtml = rows
      .map((midi, rowIdx) => {
        // Pitch is height, and higher notes are also lighter (visual-wave SYNTHESIS: the encoding we build).
        const height = rows.length > 1 ? 1 - rowIdx / (rows.length - 1) : 0.5;
        const pads = cols
          .map((col) => {
            const cell = activeCells[col];
            const on = Boolean(cell && cell.midi === midi);
            const heldTail = !on && cellIsInsideSustain(activeCells, col, midi);
            const idea = !on && ideaMap.get(`${col}:${midi}`);
            const mark = on && dial !== "lock" ? classifyTuneNoteMark(midi, rootPc, scaleType) : null;
            const innerIcon = mark
              ? icon(mark.icon)
              : heldTail
                ? icon("hold")
                : idea
                  ? icon(idea.kind === "up" ? "climb" : idea.kind === "down" ? "fall" : idea.kind === "home" ? "home" : "hold")
                  : "";
            const clash = !on && clashSet.has(midi);
            const beatMark = col % 4 === 0 ? " beat" : "";
            const markWord = mark ? `, ${mark.word}` : "";
            // A note the app moved or changed (Déjà Vu, an ending shape) is shown as the app's, not yours.
            const moved = on && (cell.shaped_by || []).some((t) => !String(t).startsWith("decorator:"));
            const label = `Step ${col + 1}, ${midi === home ? "home note" : `note ${midi}`}${
              on ? `, on${markWord}${moved ? ", changed by the app" : ""}` : heldTail ? ", held" : idea ? `, idea (${idea.kind})` : clash ? ", outside chord" : ""
            }`;
            const tip = on
              ? moved
                ? "The app changed this note (Undo brings yours back)"
                : "Your note (tap to clear)"
              : heldTail
                ? "Held note tail"
                : idea
                  ? "Next note idea (tap to add)"
                  : "Tap to add a note";
            return `<button type="button" class="pf-pad pf-note${on ? (moved ? " on moved" : " on mine") : ""}${heldTail ? " held-tail" : ""}${idea ? " idea" : ""}${clash ? " clash" : ""}${beatMark}"
              data-key="note:${col}:${midi}" data-col="${col}" data-midi="${midi}" style="--pf-h:${height.toFixed(2)}"${mark ? ` data-mark="${mark.tier}"` : ""}
              title="${tip}" aria-pressed="${on}" aria-label="${label}">${innerIcon}</button>`;
          })
          .join("");
        const rLabel = tuneRowLabel(midi, rows, home);
        return `<div class="pf-lane"><span class="pf-lane-label">${midi === home ? `${icon("home")} Home` : esc(rLabel)}</span><div class="pf-pads">${pads}</div></div>`;
      })
      .join("");

    const pageBar =
      pages > 1
        ? `<div class="pf-row">
            <span class="pf-say">Steps ${first + 1}–${first + size} of ${TUNE_STEPS}</span>
            ${this._btn("page", `${icon("next")} Next steps`, "pf-btn pf-small")}
          </div>`
        : "";

    const { hasTune } = this._progressiveState();
    const showTuneChoices = hasTune || embedded;
    const partBars = this._partBars();
    const endingLabel = partBars === 1 ? "My tune" : "Explore ending";
    const endingPrompt = partBars === 1 ? "This is your tune. Shape it or tap notes." : `Bar ${partBars} is the end. Shape it or tap notes. Other bars stay as they are.`;

    const tabs = showTuneChoices
      ? `<div class="pf-row pf-tabs pf-unfold" role="group" aria-label="Part of the tune">
          ${partBars > 1 ? this._choice("tab:main", `${icon("note")} My tune`, this.tuneTab === "main") : ""}
          ${this._choice("tab:ending", `${icon(partBars === 1 ? "note" : "flag")} ${endingLabel}`, this.tuneTab === "ending")}
        </div>`
      : "";

    const activeShape = activeEndingShape(this.tuneGrid);
    const hasParallel = Boolean(this.tuneGrid.baseEnding || this.tuneGrid.exploredEnding);
    const curVer = this.tuneGrid.endingVersion || (activeShape ? "explored" : "original");
    const ghostCells =
      this.tuneTab === "ending" && hasParallel
        ? curVer === "explored"
          ? this.tuneGrid.baseEnding
          : this.tuneGrid.exploredEnding
        : null;
    const versionRow =
      this.tuneTab === "ending" && hasParallel
        ? `<div class="pf-row" role="group" aria-label="Ending version">
            ${this._choice("version:original", `${icon("undo")} My ending`, curVer === "original", "pf-btn pf-small")}
            ${this._choice("version:explored", `${icon("sparkle")} New ending`, curVer === "explored", "pf-btn pf-small")}
          </div>`
        : "";
    const tuneToShape = this.tuneGrid.main.some(Boolean) || this.tuneGrid.ending.some(Boolean);
    const endingBar =
      this.tuneTab === "ending" && tuneToShape
        ? `<div class="pf-row" role="group" aria-label="Shape the ending">
            ${SHAPES.map((s) => this._choice(`shape:${s.id}`, `${icon(s.icon)} ${s.label}`, activeShape === s.id)).join("")}
          </div>
          ${versionRow}`
        : "";

    const playing = Boolean(this.app.scheduler?.isPlaying);
    const dialBtns = DIAL_OPTIONS.map((m) =>
      this._choice(`dial:${m.id}`, `${icon(m.icon)} ${m.label}<span class="pf-sub">${m.hint}</span>`, dial === m.id, "pf-btn pf-card")
    ).join("");
    const leadId = this.doc.lead_patch_id || "pluck_lead";
    const soundBtns = LEAD_SOUNDS.map((s) =>
      this._choice(`sound:${s.id}`, `${icon(s.icon)} ${s.label}`, leadId === s.id)
    ).join("");
    const activeDeco = activeDecorator(this.tuneGrid, this.tuneTab);
    const tuneFlowSvg = buildTuneStreamSvg({
      activeCells,
      rows,
      cols,
      ideas,
      lastTuneCol: this.lastTuneCol,
      decorator: activeDeco,
      tuneTab: this.tuneTab,
      endingShape: activeShape,
      ghostCells,
      feel: this.doc?.underneath?.feel || null,
      homeMidi: home,
    });
    const dejaBtns = DEJA_VU_CARDS.map((d) =>
      this._choice(`deja:${d.id}`, `${icon(d.icon)} ${d.label}`, this.tuneGrid.lastDejaVu === d.id)
    ).join("");
    const decoBtns = NOTE_DECORATOR_CARDS.map((d) =>
      this._choice(`deco:${d.id}`, `${icon(d.icon)} ${d.label}`, activeDeco === d.id)
    ).join("");
    const shelf = typeof window !== "undefined" ? listPhraseShelf(window.localStorage).slice(0, 2) : [];
    const shelfBtns = shelf
      .map((p, i) => this._btn(`use-phrase:${p.id}`, `${icon("note")} Phrase ${i + 1}`, "pf-btn pf-small"))
      .join("");
    const details =
      !embedded && this.detailsOpen
        ? `<div class="pf-details">
            <div class="pf-row" role="group" aria-label="Tune sound">${soundBtns}</div>
            <div class="pf-row" role="group" aria-label="Mix your tune">${dejaBtns}</div>
            <div class="pf-row" role="group" aria-label="Note style">${decoBtns}</div>
            <div class="pf-row" role="group" aria-label="Note choice">${dialBtns}</div>
            <div class="pf-row" role="group" aria-label="Phrase shelf">
              ${this._btn("save-phrase", `${icon("save")} Save phrase`, "pf-btn pf-small")}
              ${shelfBtns}
            </div>
            <label class="pf-check"><input type="checkbox" data-key="headphones" ${this.app.humWithHeadphones ? "checked" : ""}/> Headphones on</label>
          </div>`
        : "";
    const footer = embedded
      ? `${this._renderHumRow()}`
      : `<div class="pf-row">
          ${this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play")}
          ${showTuneChoices ? this._btn("undo", `${icon("undo")} Undo`) : ""}
          ${this._btn("to-under", `Under the tune ${icon("next")}`, "pf-btn pf-next")}
          ${this._backBtn()}
        </div>
        ${this._renderHumRow()}
        <div class="pf-row pf-drawer">
          ${showTuneChoices ? this._btn("toggle-details", `${icon("gear")} ${this.detailsOpen ? "Close details" : "Details"}`, "pf-btn pf-small", `aria-expanded="${this.detailsOpen}"`) : ""}
          ${showTuneChoices ? this._btn("toggle-all-view", `${icon("grid")} All at once`, "pf-btn pf-small") : ""}
          ${this._btn("keep", `${icon("save")} Skip to end`, "pf-btn pf-small")}
        </div>
        ${details}`;
    const feedbackLine = this.tuneFeedback ? `<p class="pf-say pf-msg" aria-live="polite">${esc(this.tuneFeedback)}</p>` : "";
    return `
      <div class="pf-stage pf-tune">
        ${this._timelineHtml()}
        <div class="pf-head-row"><h1 class="pf-heading">${this.doc.jam_start || this.doc.captured_performance ? "Shape your tune" : "2. Add a tune"}</h1>${this._barsHtml()}</div>
        <p class="pf-say">${
          this.tuneTab === "ending"
            ? endingPrompt
            : `Tap a box to play a note. These notes repeat in bars 1–${partBars - 1}. Dotted rings are ideas you can tap.`
        }</p>
        ${tabs}
        ${endingBar}
        ${feedbackLine}
        <div class="pf-grid" data-water-grid="tune" role="group" aria-label="Tune notes">${tuneFlowSvg}${gridHtml}</div>
        ${pageBar}
        ${footer}
      </div>`;
  }

  _renderEventTune() {
    const bars = this._partBars();
    this.eventTuneBar = Math.max(0, Math.min(bars - 1, this.eventTuneBar || 0));
    const notes = this.doc.notes.filter(n => n.role === "lead" && Math.floor(n.step / stepsPerBar(this.doc)) === this.eventTuneBar)
      .slice().sort((a,b) => (a.step + (a.performance?.offset_steps || 0)) - (b.step + (b.performance?.offset_steps || 0)));
    const selected = notes.find(n => n.id === this.eventTuneId) || notes[0];
    this.eventTuneId = selected?.id;
    const pitch=n=>Number(n.concrete?.midi_pitch??n.concrete?.midi??60);
    const low=Math.min(48,...notes.map(pitch)),high=Math.max(72,...notes.map(pitch));
    const selectedIndex=notes.indexOf(selected),stepCount=stepsPerBar(this.doc);
    const list=notes.map((n,i)=>{
      const position=(n.step%stepCount+(n.performance?.offset_steps||0))/stepCount;
      const width=Math.min(1-position,Number(n.duration_steps||1)/stepCount)*100;
      const top=12+(high-pitch(n))/(high-low)*140;
      return this._btn(`event-select:${encodeURIComponent(n.id)}`,`${i+1}`,'pf-btn pf-phrase-note',
        `style="left:calc(${position*100}% - ${position*44}px);top:${top}px;width:${width}%" data-phrase-note="${esc(n.id)}" aria-pressed="${n.id===selected?.id}" aria-label="Note ${i+1}, beat ${(position*stepCount/4+1).toFixed(2)}. Drag it, or use the arrow keys, to change it."`);
    }).join('');
    this.phraseRange={low,high,stepCount,bar:this.eventTuneBar};
    const overlap=notes.some((n,i)=>notes.slice(i+1).some(m=>Math.abs(pitch(n)-pitch(m))<6&&Math.abs(n.step+(n.performance?.offset_steps||0)-m.step-(m.performance?.offset_steps||0))/stepCount<.15));
    const playing=Boolean(this.app.scheduler?.isPlaying);
    const scope=this.editingCard==null?'Your tune':`Part ${this.editingCard+1}`;
    const transportLabel=playing?'Stop playback':this.editingCard==null?'Play music':`Play part ${this.editingCard+1}`;
    return `<div class="pf-stage pf-tune pf-event-tune">
      <div class="pf-head-row"><div><h1 class="pf-heading">Shape your tune</h1><p class="pf-sub">${scope}. ${this.editingCard==null?'Edits affect linked parts.':'Edits stay in this part.'}</p></div>
      ${this._btn('play',transportLabel,'pf-btn pf-play pf-big','data-event-transport')}</div>
      <p class="pf-say">Drag a note up or down to change it. Drag it left or right to move it. Press an empty spot to add one.</p>
      ${this._timelineHtml()}
      <div class="pf-row" role="group" aria-label="Choose a bar">${Array.from({length:bars},(_,b)=>this._choice(`event-bar:${b}`,`Bar ${b+1}`,b===this.eventTuneBar)).join('')}</div>
      <div class="pf-phrase-caption"><span>Higher notes</span><span>Time moves left to right</span></div>
      <p id="pf-phrase-status" class="pf-sub" role="status">${playing?"Playing this part.":"Stopped. Press Play to hear your music."}</p>
      <div class="pf-phrase-picture" data-phrase-picture style="--phrase-beat-width:${400/stepCount}%" role="group" aria-label="Bar ${this.eventTuneBar+1}: notes by pitch and time">
        ${list||'<p class="pf-phrase-empty">This bar has room for a tune. Add a note to begin.</p>'}
        <span class="pf-phrase-cursor" aria-hidden="true" hidden></span>
      </div>
      <div class="pf-phrase-beats" aria-hidden="true">${Array.from({length:stepCount/4},(_,i)=>`<span>Beat ${i+1}</span>`).join('')}</div>
      ${overlap?`<div class="pf-row" role="group" aria-label="Choose overlapping notes"><span>Overlapping notes:</span>${notes.map((n,i)=>this._btn(`event-pick:${encodeURIComponent(n.id)}`,`Note ${i+1}`,'pf-btn pf-small',`aria-pressed="${n.id===selected?.id}"`)).join('')}</div>`:''}
      ${selected?`<section class="pf-details" aria-label="Selected note"><strong>Note ${selectedIndex+1} selected</strong>
        <p class="pf-sub">Hear it alone. Undo puts it back.</p>
        <div class="pf-row">${this._btn('event-edit:hear','Hear this note')}${this._btn('undo','Undo change')}${this._btn('event-edit:remove','Remove this note','pf-btn pf-small')}</div>
        <details class="pf-event-timing" ${this.eventTimingOpen?'open':''}><summary data-key="event-timing">Change it with buttons</summary>
          <p class="pf-sub">Use these to move the note, or to make it ring more or less.</p>
          <div class="pf-row">${[['up','Higher pitch'],['down','Lower pitch'],['earlier','Earlier'],['later','Later'],['shorter','Shorter'],['longer','Longer']].map(([k,l])=>this._btn(`event-edit:${k}`,l)).join('')}</div>
        </details></section>`:''}
      <div class="pf-row">${this._btn('event-add','+ Add a note')}${!selected?this._btn('undo','Undo change'):''}${this._btn('change-sound','Change instrument','pf-btn pf-small',`aria-expanded="${Boolean(this.instrumentPickerOpen)}"`)}</div>
      ${this.instrumentPickerOpen?this._instrumentPickerHtml({changing:true}):''}
      <div class="pf-row">${this._btn('to-song','Back to whole song','pf-btn pf-next')}${this._btn('to-under','Edit backing')}${this.editingCard==null?this._backBtn():''}${this._btn('keep','Save / export')}</div></div>`;
  }

  /* ---- Drag a note: pitch snaps to the key, time to the grid, and you hear it as it moves. ---- */
  _keyPitches() {
    const g = this.doc.global_context || {}, root = ((Number(g.root_pc) || 0) % 12 + 12) % 12;
    const scale = /minor|dorian|phrygian|aeolian/.test(g.scale_type || "") ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    return new Set(scale.map(i => (root + i) % 12));
  }

  _snapPitch(midi) {
    const inKey = this._keyPitches(), target = Math.round(midi);
    for (let d = 0; d < 12; d++) {
      if (inKey.has(((target - d) % 12 + 12) % 12)) return Math.max(36, Math.min(96, target - d));
      if (inKey.has(((target + d) % 12 + 12) % 12)) return Math.max(36, Math.min(96, target + d));
    }
    return target;
  }

  /** The picture that is on screen now; a re-render replaces the element, so never trust a stored one. */
  _livePicture(fallback = null) {
    const live = this.root?.querySelector?.("[data-phrase-picture]");
    return live || fallback;
  }

  _pictureGeometry(e, picture) {
    const surface = this._livePicture(picture), rect = surface.getBoundingClientRect(), { low, high, stepCount, bar } = this.phraseRange;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left)), y = e.clientY - rect.top;
    const local = Math.max(0, Math.min(stepCount - 1, Math.round((x / Math.max(1, rect.width - 44)) * stepCount)));
    const pitch = this._snapPitch(high - ((y - 12 - 22) / 140) * (high - low));
    return { rect, local, step: bar * stepCount + local, pitch, stepCount };
  }

  _beginNoteDrag(e, picture) {
    const button = e.target.closest?.("[data-phrase-note]");
    const { rect, local, step, pitch } = this._pictureGeometry(e, picture);
    let note = button ? this.doc.notes.find(n => n.id === button.dataset.phraseNote && n.role === "lead") : null;
    this._pushUndo();
    const undoDepth = this.undoStack.length;
    let added = false;
    if (!note) {
      // A press on an empty spot puts a note there, then the same drag can move it.
      let index = 1; while (this.doc.notes.some(n => n.id === `event-note-${index}`)) index++;
      note = { id: `event-note-${index}`, step, duration_steps: 2, velocity: .8, role: "lead", patch_id: this.doc.lead_patch_id || "warm_keys",
        provenance: "user_placed", pitch_lock_mode: "concrete", concrete: { midi_pitch: pitch, freq_hz: 440 * 2 ** ((pitch - 69) / 12) }, performance: { version: 1, offset_steps: 0 } };
      this.doc.notes.push(note);
      added = true;
    }
    this.eventTuneId = note.id;
    const noteRect = button?.getBoundingClientRect();
    const resize = Boolean(button) && noteRect && e.clientX > noteRect.right - 14;
    try { picture.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointers have no capture */ }
    this.noteDrag = { pointerId: e.pointerId, picture, id: note.id, mode: resize ? "resize" : "move", undoDepth, changed: added,
      grabStep: local, startStep: note.step, startPitch: Number(note.concrete?.midi_pitch ?? 60), startDur: Number(note.duration_steps) || 1, lastPreview: 0 };
    if (added) {
      // A new note needs its button on screen; re-render once, then hold the fresh picture.
      this._applyNoteDrag(note, { step, pitch, duration: 2 }, { sound: true });
      this.render();
      const fresh = this._livePicture(picture);
      this.noteDrag.picture = fresh;
      try { fresh.setPointerCapture?.(e.pointerId); } catch { /* the pointer may already be up */ }
    } else {
      // Selecting an existing note must not re-render mid-gesture: mark it in place.
      this._hearNote(note);
      for (const b of this.root.querySelectorAll?.("[data-phrase-note]") || []) b.setAttribute("aria-pressed", String(b.dataset.phraseNote === note.id));
    }
    this.root.querySelector?.(`[data-phrase-note="${CSS.escape(note.id)}"]`)?.focus?.({ preventScroll: true });
  }

  _moveNoteDrag(e) {
    const drag = this.noteDrag, note = this.doc.notes.find(n => n.id === drag.id);
    if (!note) return;
    const { local, pitch, stepCount } = this._pictureGeometry(e, drag.picture);
    const bar = this.phraseRange.bar * stepCount, maxStep = this._partBars() * stepCount;
    if (drag.mode === "resize") {
      const duration = Math.max(1, Math.min(maxStep - note.step, local + 1 - (note.step - bar)));
      if (duration !== note.duration_steps) this._applyNoteDrag(note, { duration });
      return;
    }
    const step = Math.max(bar, Math.min(bar + stepCount - 1, drag.startStep + (local - drag.grabStep)));
    const pitchChanged = pitch !== Number(note.concrete?.midi_pitch), stepChanged = step !== note.step;
    if (!pitchChanged && !stepChanged) return;
    // Only an intended move in time touches timing; a pitch-only drag leaves the note's feel alone.
    this._applyNoteDrag(note, { ...(stepChanged ? { step } : {}), ...(pitchChanged ? { pitch } : {}) }, { sound: pitchChanged });
  }

  _applyNoteDrag(note, { step, pitch, duration }, { sound = false } = {}) {
    if (step !== undefined) { note.step = step; note.performance = { ...(note.performance || {}), version: 1, offset_steps: 0 }; }
    if (pitch !== undefined) note.concrete = { ...note.concrete, midi_pitch: pitch, freq_hz: 440 * 2 ** ((pitch - 69) / 12) };
    if (duration !== undefined) note.duration_steps = duration;
    this.noteDrag.changed = true;
    this._compile();
    if (sound) this._hearNote(note, true);
    this._placeNoteButton(note);
  }

  _hearNote(note, throttled = false) {
    const scheduler = this.app.scheduler, now = typeof performance !== "undefined" ? performance.now() : 0;
    if (throttled && this.noteDrag && now - this.noteDrag.lastPreview < 70) return;
    if (this.noteDrag) this.noteDrag.lastPreview = now;
    if (isSampledPatch(note.patch_id) && (!scheduler.masterBus?.piano || scheduler.masterBus.disposed)) return;
    try { scheduler.previewSound({ patchId: note.patch_id, role: "lead", midi: note.concrete?.midi_pitch, durationSec: .25 }); } catch { /* a silent drag still moves the note */ }
  }

  _placeNoteButton(note) {
    const button = this.root.querySelector?.(`[data-phrase-note="${CSS.escape(note.id)}"]`);
    if (!button || !this.phraseRange) return;
    const { low, high, stepCount } = this.phraseRange, position = (note.step % stepCount) / stepCount;
    button.style.left = `calc(${position * 100}% - ${position * 44}px)`;
    button.style.top = `${12 + (high - Number(note.concrete?.midi_pitch ?? 60)) / (high - low) * 140}px`;
    button.style.width = `${Math.min(1 - position, Number(note.duration_steps || 1) / stepCount) * 100}%`;
  }

  _endNoteDrag({ cancelled = false } = {}) {
    const drag = this.noteDrag;
    if (!drag) return;
    this.noteDrag = null;
    try { this._livePicture(drag.picture)?.releasePointerCapture?.(drag.pointerId); } catch { /* already released */ }
    if (cancelled && drag.changed) return this._undo();            // restores the note and the grids through the real path
    if (!drag.changed) {
      if (this.undoStack.length === drag.undoDepth) this.undoStack.pop();
      return this.render();
    }
    this.tuneGrid = { ...tuneGridFromNotes(this.doc.notes, this._partBars()), eventEditor: true };
    recordAct(this.doc, "tune_event_drag", { mode: drag.mode });
    this._compile();
    this.render();
    this.app._announce(drag.mode === "resize" ? "Note length changed." : "Note moved.");
  }

  async _editEvent(action) {
    const note = this.doc.notes.find(n => n.id === this.eventTuneId && n.role === "lead");
    if (action === "hear") {
      if(!note)return;
      const scheduler=this.app.scheduler,docId=this.doc.id,stage=this.stage,snapshot=JSON.stringify(note);
      if(isSampledPatch(note.patch_id)&&(!scheduler.masterBus?.piano||scheduler.masterBus.disposed)) {
        const loading=this._loadPiano(),generation=scheduler.stopGeneration;
        if(!await loading)return;
        if(scheduler.stopGeneration!==generation||this.doc.id!==docId||this.stage!==stage
          ||this.eventTuneId!==note.id||JSON.stringify(this.doc.notes.find(n=>n.id===note.id))!==snapshot) {
          this.pianoMessage='';this.render();this.app._announce('No note was played.');return;
        }
        this.pianoMessage='';this.render();
      }
      scheduler.previewSound({patchId:note.patch_id,role:"lead",midi:note.concrete?.midi_pitch??note.concrete?.midi,
        durationSec:Math.min(4,Math.max(.05,Number(note.duration_steps||1)*15/(this.doc.global_context.bpm||100)))});
      return;
    }
    if (action !== "add" && !note) return;
    if (action !== "add" && this.doc.notes.filter(n=>n.id===this.eventTuneId && n.role==="lead").length !== 1) {
      return this.app._announce("This note has a shared name. Your notes are safe.");
    }
    this._pushUndo();
    if (action === "add") {
      let index=1; while(this.doc.notes.some(n=>n.id===`event-note-${index}`)) index++;
      const id=`event-note-${index}`;
      this.doc.notes.push({id,step:(this.eventTuneBar||0)*stepsPerBar(this.doc),duration_steps:2,velocity:.8,role:"lead",
        patch_id:this.doc.lead_patch_id||"warm_keys",provenance:"user_placed",pitch_lock_mode:"concrete",
        concrete:{midi_pitch:60},performance:{version:1,offset_steps:0}});
      this.eventTuneId=id;
    } else {
      this.doc.notes=editLeadEvent(this.doc.notes,this.eventTuneId,action,{totalSteps:this._partBars()*stepsPerBar(this.doc)});
      const edited=this.doc.notes.find(n=>n.id===this.eventTuneId);
      if(edited) this.eventTuneBar=Math.floor(edited.step/stepsPerBar(this.doc));
    }
    this.tuneGrid={...tuneGridFromNotes(this.doc.notes,this._partBars()),eventEditor:true};
    recordAct(this.doc,"tune_event_edit",{action});
    this._compile();this.render();
    this.app._announce(action==="remove"?"One note removed. Undo can bring it back.":"Note changed.");
    if(action==="remove") this.root.querySelector('[data-key^="event-select:"]')?.focus();
  }

  _renderHumRow() {
    const statusBox = `<div id="pf-hum-status">${this.humMessage ? `<p class="pf-say pf-msg">${esc(this.humMessage)}</p>` : ""}</div>`;
    if (this.humPreview) {
      const hasOwn = hasOwnTuneNotes(this.tuneGrid);
      const dropMsg = this.humPreview.dropped > 0 ? ` (${this.humPreview.dropped} fast notes could not fit.)` : "";
      const choices = hasOwn
        ? `${this._btn("hum-hear", `${icon("play")} Hear it`)}
           ${this._btn("hum-add", `${icon("plus")} Add to tune`, "pf-btn pf-next")}
           ${this._btn("hum-replace", `${icon("swap")} Replace my tune`)}`
        : `${this._btn("hum-hear", `${icon("play")} Hear it`)}
           ${this._btn("hum-replace", `${icon("check")} Use my hum`, "pf-btn pf-next")}
           ${this._btn("hum", `${icon("retry")} Try again`)}`;
      return `${statusBox}<div class="pf-hum">
        <p class="pf-say">Heard your hum.${dropMsg}</p>
        <div class="pf-row" role="group" aria-label="Hummed tune">${choices}</div>
      </div>`;
    }
    const restore = this.beforeHum ? this._btn("restore-before-hum", `${icon("undo")} Keep my notes`) : "";
    const humLabel = this.humMessage ? `${icon("retry")} Try again` : `${icon("mic")} Hum it`;
    return `${statusBox}<div class="pf-row pf-drawer">${this._btn("hum", humLabel)} ${restore}</div>`;
  }

  _renderUnder({ embedded = false } = {}) {
    const u = this.doc.underneath || { feel: null, chords: null, bass: null };
    const { hasFeel } = this._progressiveState();
    const showUnderChoices = hasFeel || embedded;
    const riverSvg = buildUnderneathRiverSvg(this.doc, this.tuneGrid);
    const options = chordOptions(this.doc);
    const feelBtns = FEELS.map((f) =>
      this._choice(
        `feel:${f.id}`,
        `${icon(FEEL_ICONS[f.id])} ${f.label}<span class="pf-sub">${f.hint}</span>`,
        u.feel === f.id,
        "pf-btn pf-card"
      )
    ).join("");

    const chordBtns = options
      .map((o, idx) =>
        this._choice(
          `chords:${idx}`,
          `${icon("play")} Set ${idx + 1}`,
          u.chords === idx,
          "pf-btn pf-card"
        )
      )
      .join("");
    const bassBtns = BASS_STYLES.map((b) =>
      this._choice(`bass:${b.id}`, `${b.label}<span class="pf-sub">${b.hint}</span>`, u.bass === b.id, "pf-btn pf-card")
    ).join("");
    const pinnedObj = this.doc.pinned_chord_bars || {};
    const pinBtns = [0, 1, 3]
      .map((bIdx) =>
        this._choice(`pin-bar:${bIdx}`, `${icon("lock")} Lock bar ${bIdx + 1}`, Boolean(pinnedObj[bIdx]), "pf-btn pf-small")
      )
      .join("");
    const hstyleBtns = HARMONY_STYLES.map((h) =>
      this._choice(
        `hstyle:${h.id}`,
        `${icon(h.icon)} ${h.label}`,
        (u.harmony_style || u.harmonyStyle || "hold") === h.id,
        "pf-btn pf-small"
      )
    ).join("");
    // Each press nudges the sound further, so these are plain buttons, not on/off choices.
    const breedBtns = SEED_BRANCHES.map((b) => this._btn(`breed:${b.id}`, `${icon(b.icon)} ${b.label}`, "pf-btn pf-small")).join("");
    const details =
      !embedded && this.detailsOpen
        ? `<div class="pf-details">
            <p class="pf-say">Chords</p>
            <div class="pf-row" role="group" aria-label="Chords">${chordBtns}</div>
            <div class="pf-row" role="group" aria-label="Lock bars">${pinBtns}</div>
            <p class="pf-say">Bass</p>
            <div class="pf-row" role="group" aria-label="Bass">${bassBtns}</div>
            <p class="pf-say">Chord style</p>
            <div class="pf-row" role="group" aria-label="Chord style">${hstyleBtns}</div>
            <p class="pf-say">Grow sound</p>
            <div class="pf-row" role="group" aria-label="Grow sound">${breedBtns}</div>
          </div>`
        : "";

    const playing = Boolean(this.app.scheduler?.isPlaying);
    const footer = embedded
      ? ""
      : `<div class="pf-row">
          ${this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play")}
          ${showUnderChoices ? this._btn("undo", `${icon("undo")} Undo`) : ""}
          ${this._btn("to-song", `Shape your song ${icon("next")}`, "pf-btn pf-next")}
          ${this._backBtn()}
        </div>
        <div class="pf-row pf-drawer">
          ${showUnderChoices ? this._btn("toggle-details", `${icon("gear")} ${this.detailsOpen ? "Close details" : "Details"}`, "pf-btn pf-small", `aria-expanded="${this.detailsOpen}"`) : ""}
          ${showUnderChoices ? this._btn("toggle-all-view", `${icon("grid")} All at once`, "pf-btn pf-small") : ""}
          ${this._btn("keep", `${icon("save")} Skip to end`, "pf-btn pf-small")}
        </div>
        ${details}`;
    return `
      <div class="pf-stage pf-under">
        <div class="pf-head-row"><h1 class="pf-heading">3. What goes under it</h1>${this._barsHtml()}</div>
        <p class="pf-say">Pick a feel for chords and bass under your tune. Press that feel one more time for just beat and tune.</p>
        ${riverSvg}
        <div class="pf-row" role="group" aria-label="Feel">${feelBtns}</div>
        ${footer}
      </div>`;
  }

  _renderSong({ embedded = false } = {}) {
    const cards = normalizeSongCards(this.doc.song_cards);
    const songRiverSvg = buildSongBraidedRiverSvg(cards);
    const playing = Boolean(this.app.scheduler?.isPlaying);
    const activeIdx = Math.min(cards.length - 1, Math.max(0, this.activeSongCard || 0));
    const activeCard = cards[activeIdx] || cards[0];
    const lastIdx = cards.length - 1;
    // Each part is a tile with three plain choices. The last part ends the song.
    const tiles = cards.map((card, idx) => {
      const isEnding = idx === lastIdx && cards.length > 1;
      const choices = isEnding
        ? ENDING_STYLES.map(st => this._choice(`ending-style:${st.id}`, st.label, endingStyle(card) === st.id, "pf-btn pf-small"))
        : PART_MOODS.map(m => this._choice(`part-mood:${idx}:${m.id}`, m.label, partMood(card) === m.id, "pf-btn pf-small"));
      const name = isEnding ? "Ending" : card.role_name && !/^Ending$/.test(card.role_name) ? esc(card.role_name) : `Part ${idx + 1}`;
      return `<div class="pf-song-card${card.big ? " pf-card-big" : ""}${idx === activeIdx ? " now" : ""}" data-card="${idx}">
          <p class="pf-song-card-title">${name} <span class="pf-sub">${card.bars} ${card.bars === 1 ? "bar" : "bars"}</span></p>
          <div class="pf-row" role="group" aria-label="${isEnding ? "How the song ends" : `Part ${idx + 1}`}">${choices.join("")}</div>
          <div class="pf-row">${this._btn(`play-card:${idx}`, `${icon("play")} Hear it`, "pf-btn pf-small", `aria-label="Hear part ${idx + 1}"`)}${this._btn(`edit-card:${idx}`, "Open", "pf-btn pf-small", `aria-label="Open part ${idx + 1} to change its notes"`)}</div>
        </div>`;
    }).join("");
    const addBtn = cards.length < MAX_SONG_CARDS ? this._btn("add-card", `${icon("plus")} Make it longer`, "pf-btn") : "";
    const footer = embedded ? "" : `<div class="pf-row">
          ${this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play")}
          ${addBtn}
          ${this._btn("keep", `${icon("save")} Save`, "pf-btn pf-next")}
          ${this._btn("undo", `${icon("undo")} Undo`)}
          ${this._backBtn()}
        </div>`;
    // Everything else stays available, behind More.
    const layerSwitches = CARD_LAYERS.map(l => this._choice(`card-layer:${activeIdx}:${l.id}`, `${icon(l.icon)} ${l.label}`, Boolean(activeCard[l.id]))).join("");
    const fxBtns = CARD_FX.map(f => this._choice(`card-fx:${activeIdx}:${f.id}`, `${icon(f.icon)} ${f.label}`, activeCard?.fx === f.id, "pf-btn pf-small")).join("");
    const more = embedded ? "" : `<details class="pf-demo-tools pf-song-more" ${this.songMoreOpen !== false ? "open" : ""}><summary data-key="song-more">More</summary>
        <div class="pf-row" role="group" aria-label="Studio steps">${this._btn("edit-scope:beat", "Edit beat", "pf-btn pf-small")}${this._btn("edit-scope:tune", "Edit tune", "pf-btn pf-small")}${this._btn("edit-scope:under", "Edit backing", "pf-btn pf-small")}</div>
        <p class="pf-sub">These change the part you touched last: part ${activeIdx + 1}.</p>
        <div class="pf-row" role="group" aria-label="Part ${activeIdx + 1} length">
          ${this._btn(`card-bars:${activeIdx}:${activeCard.bars - 1}`, "Shorter", "pf-btn pf-small", activeCard.bars <= 1 ? "disabled" : "")}
          <span>${activeCard.bars} ${activeCard.bars === 1 ? "bar" : "bars"}</span>
          ${this._btn(`card-bars:${activeIdx}:${activeCard.bars + 1}`, "Longer", "pf-btn pf-small", activeCard.bars >= 4 ? "disabled" : "")}
        </div>
        <div class="pf-row" role="group" aria-label="Part ${activeIdx + 1} layers">${layerSwitches}</div>
        <div class="pf-row" role="group" aria-label="Part ${activeIdx + 1} extras">${fxBtns}${this._choice(`card-variation:${activeIdx}`, `${icon("climb")} Lift tune`, activeCard.tune_variant === "lift", "pf-btn pf-small")}</div>
        <div class="pf-row">
          ${activeIdx > 0 ? this._btn(`move-card:${activeIdx}:earlier`, `${icon("back")} Earlier`, "pf-btn pf-small") : ""}
          ${activeIdx < lastIdx ? this._btn(`move-card:${activeIdx}:later`, `Later ${icon("next")}`, "pf-btn pf-small") : ""}
          ${cards.length > 1 ? this._btn(`remove-card:${activeIdx}`, `${icon("trash")} Remove`, "pf-btn pf-small") : ""}
          ${this._btn(`compare-part:${activeIdx}`, "Softer band", "pf-btn pf-small")}
        </div>
        <div class="pf-row">${this._btn("edit-shared", "Edit shared tune", "pf-btn pf-small")}${this._btn("toggle-all-view", `${icon("grid")} All at once`, "pf-btn pf-small")}</div>
        ${this.doc.jam_session ? `<div class="pf-row">${this._btn("jam-open", "Back to jam", "pf-btn pf-small")}</div><p class="pf-sub">The jam changes parts that copy it. Parts you changed stay safe.</p>` : ""}
        ${this.doc.capture_source ? `<div class="pf-row">${this._btn("restore-capture-source", "Restore source loop", "pf-btn pf-small")}</div><p class="pf-sub">Go back to the loop from the start. Undo brings this back.</p>` : ""}
        ${this.doc.jam_start ? `<div class="pf-row">${this._btn("restore-jam", "Restore first jam", "pf-btn pf-small")}</div><p class="pf-sub">Restore the first jam and its parts. Undo brings this song back.</p>` : ""}
      </details>`;
    return `
      <div class="pf-stage pf-song">
        <div class="pf-head-row"><h1 class="pf-heading">Shape your song</h1>${this._barsHtml()}</div>
        <p class="pf-say">Tap a part. Make it calm or big. The last part ends the song.</p>
        ${songRiverSvg}
        <div class="pf-song-cards">${tiles}</div>
        ${embedded ? "" : `<div class="pf-vis-strip"><svg class="pf-listening-visual" viewBox="0 0 640 220" aria-hidden="true" focusable="false"><path data-spectrum fill="none"/><path data-spectrum-dim="bass" class="pf-vis-dim pf-part-bass" fill="none" stroke-width="2"/><path data-spectrum-dim="drums" class="pf-vis-dim pf-part-drums" fill="none" stroke-width="2"/><path data-spectrum-dim="chords" class="pf-vis-dim pf-part-chords" fill="none" stroke-width="2"/><path data-spectrum-dim="tune" class="pf-vis-dim pf-part-tune" fill="none" stroke-width="2"/><path data-spectrum-part="bass" class="pf-vis-lit pf-part-bass" fill="none" stroke-width="3"/><path data-spectrum-part="drums" class="pf-vis-lit pf-part-drums" fill="none" stroke-width="3"/><path data-spectrum-part="chords" class="pf-vis-lit pf-part-chords" fill="none" stroke-width="3"/><path data-spectrum-part="tune" class="pf-vis-lit pf-part-tune" fill="none" stroke-width="3"/><path data-wave d="M 24 110 L 616 110" fill="none" stroke="currentColor" stroke-width="2" /></svg></div>`}
        ${embedded ? "" : this._timelineHtml()}
        ${footer}
        ${embedded ? "" : this._sheetBoxHtml()}
        ${more}
      </div>`;
  }

  /* ---- "What is this?": every element on the screen, named in words, with its colour and shape. ---- */
  _legendElements() {
    const song = this.app.compiledSong, roles = new Set((song?.events || []).map(e => e.role));
    const parts = ["drums", "bass", "chords", "tune"].filter(p => [...roles].some(r => partOfRole(r) === p));
    const own = (this.doc?.notes || []).some(n => n.provenance === "user_placed" || n.provenance === "hummed_confirmed")
      || (song?.events || []).some(e => e.provenance === "user_placed");
    const marks = ["beat", "bar", ...(own ? ["own"] : []), ...(this.stage === "jam" && this.doc?.jam_session?.live_keys ? ["answer"] : [])];
    return describeElements({ parts, marks });
  }

  _legendHtml() {
    const rows = this._legendElements().map(e => `<li class="pf-legend-row"><span class="pf-swatch pf-swatch-${e.shape.replace(/\s+/g, "-")}" style="--swatch: var(${e.cssVar})" aria-hidden="true"></span><span>${esc(e.says)}</span></li>`).join("");
    const mode = this._visualMode();
    const modes = [["bars", "Bars"], ["scope", "Line"], ["off", "Off"]].map(([id, label]) => this._choice(`visual-mode:${id}`, label, mode === id, "pf-btn pf-small")).join("");
    return `<section class="pf-legend" aria-label="What is on this screen"><div class="pf-row pf-legend-head"><strong>What is this?</strong><span class="pf-sub">The same colours and shapes mean the same things on every screen.</span></div>
      <ul class="pf-legend-list">${rows}</ul>
      <div class="pf-row" role="group" aria-label="The moving picture"><span class="pf-sub">Moving picture:</span>${modes}</div></section>`;
  }

  _visualMode() {
    if (this.visualMode) return this.visualMode;
    try { this.visualMode = ["bars", "scope", "off"].includes(window.localStorage.getItem("musiclab.visual-mode")) ? window.localStorage.getItem("musiclab.visual-mode") : "bars"; }
    catch { this.visualMode = "bars"; }
    return this.visualMode;
  }

  _setVisualMode(mode) {
    if (!["bars", "scope", "off"].includes(mode)) return;
    this.visualMode = mode;
    try { window.localStorage.setItem("musiclab.visual-mode", mode); } catch { /* a private window forgets; that is fine */ }
    this.app._announce(mode === "off" ? "The picture is off now." : mode === "scope" ? "The picture is a line now." : "The picture is bars now.");
  }

  /* ---- Adjust: three ideas dealt on arrival. Tap one to hear it in place, tap again to keep it. ---- */
  _journeyLevelForCards() {
    const level = this._journeyLevel();
    return ["play", "shape", "detail", "share"].includes(level) ? level : null;
  }

  _dealOnArrival() {
    const level = this._journeyLevelForCards();
    if (!level || level === "play" || !this.doc?.song_cards) return;
    this.adjustSeen = this.adjustSeen || {};
    const key = `${this.doc.id}:${level}`;
    if (this.adjustSeen[key]) return;
    this.adjustSeen[key] = true;
    this.adjustShuffle = 0;
    this._openAdjust();
  }

  _openAdjust() {
    const level = this._journeyLevelForCards() || "shape";
    this.adjustLevel = level;
    this.adjustHand = dealCards(this._canonicalDoc(), level, { seed: this.doc.id, shuffle: this.adjustShuffle || 0 });
    this.adjustOpen = this.adjustHand.length > 0;
  }

  _closeAdjust() {
    this._cancelCardPreview();
    this.adjustOpen = false;
    this.render();
  }

  _adjustHtml() {
    const hand = this.adjustHand || [], previewing = this.cardPreview?.id;
    const cards = hand.map(card => this._btn(`adjust-card:${card.id}`, `<strong>${esc(card.title)}</strong><span class="pf-sub">${esc(card.hint)}</span>${card.id === previewing ? '<span class="pf-sub pf-card-state">Playing it. Tap again to keep.</span>' : ""}`,
      `pf-btn pf-card pf-adjust-card${card.id === previewing ? " pf-adjust-previewing" : ""}`, `aria-pressed="${card.id === previewing}"`)).join("");
    return `<section class="pf-adjust" aria-label="Adjust"><div class="pf-row pf-adjust-head"><strong>Three ideas</strong><span class="pf-sub">Tap one to hear it. Tap again to keep it.</span></div>
      <div class="pf-row pf-adjust-hand" role="group" aria-label="Ideas for your song">${cards}</div>
      <div class="pf-row">${this._btn("adjust-keep-as-is", "Keep as is", "pf-btn pf-small")}${this._btn("adjust-shuffle", "Other ideas", "pf-btn pf-small")}</div></section>`;
  }

  async _tapCard(id) {
    if (this.cardPreview?.id === id) return this._keepCard();
    this._cancelCardPreview();
    const NOTE_CARDS = new Set(["octave-up", "ring"]);
    // Where to listen is decided before the change, on the song as it is (Lift used to seek the next part).
    const canonicalBefore = this._canonicalDoc();
    const scoped = this.editingCard != null && this.sharedMaterial;
    let seek = cardSeek(canonicalBefore, id);
    if (scoped) {
      // Inside a part, listen inside that part; never jump out of it to preview.
      const range = songCardRanges(canonicalBefore.song_cards, 4 * stepsPerBar(this.doc), canonicalBefore.global_context?.bpm || 100, stepsPerBar(this.doc))[this.editingCard];
      if (range && (seek < range.start_step || seek >= range.end_step)) seek = range.start_step;
    }
    // A note card inside a part changes that part's own notes; everything else changes the whole song.
    const next = scoped && NOTE_CARDS.has(id) ? applyCard(this.doc, id) : applyCard(canonicalBefore, id);
    if (!next) { this.app._announce("That idea does not fit now."); return this.render(); }
    const baseline = JSON.parse(JSON.stringify(canonicalBefore));
    this.cardPreviewApplying = true;
    this._pushUndo();
    this.cardPreviewApplying = false;
    this.cardPreview = { id, undoDepth: this.undoStack.length, baseline };
    this._applyAdjustedDoc(next, { scoped, noteCard: NOTE_CARDS.has(id) });
    // Trying an idea is not keeping it: the recovered draft stays the song from before the preview.
    this._stashDraft(baseline);
    const card = (this.adjustHand || []).find(c => c.id === id);
    this.app._announce(`${card?.title || "Idea"}. Playing it. Tap again to keep it.`);
    this.render();
    await this._seekTo(seek);
  }

  _applyAdjustedDoc(next, { scoped = false, noteCard = false } = {}) {
    if (scoped && !noteCard) {
      // Inside a part: take the song-level changes, leave this part's notes (the projection) exactly as they are.
      this.doc = { ...this.doc, global_context: next.global_context, song_cards: next.song_cards, title: next.title ?? this.doc.title };
    } else if (scoped && noteCard) {
      this.doc = { ...this.doc, notes: next.notes };
    } else {
      this.doc = { ...this.doc, ...next };
    }
    this.tuneGrid = this.tuneGrid?.eventEditor ? { ...tuneGridFromNotes(this.doc.notes, this._partBars()), eventEditor: true } : tuneGridForBars(this.tuneGrid, this.doc.notes, this._partBars());
    this._compile();
  }

  _cancelCardPreview() {
    const preview = this.cardPreview;
    if (!preview) return;
    this.cardPreview = null;
    if (this.undoStack.length === preview.undoDepth) return this._undo();
    // Something else was edited meanwhile. Restore only what the idea changed, and keep the later edit.
    const base = preview.baseline, fields = ["global_context", "song_cards"];
    const scoped = this.editingCard != null && this.sharedMaterial;
    for (const f of fields) this.doc[f] = JSON.parse(JSON.stringify(base[f]));
    if (!scoped) this.doc.notes = JSON.parse(JSON.stringify(base.notes));
    this.tuneGrid = this.tuneGrid?.eventEditor ? { ...tuneGridFromNotes(this.doc.notes, this._partBars()), eventEditor: true } : tuneGridForBars(this.tuneGrid, this.doc.notes, this._partBars());
    this._compile();
    this.app._announce("Idea not kept.");
  }

  _keepCard() {
    const preview = this.cardPreview;
    if (!preview) return;
    this.cardPreview = null;
    const card = (this.adjustHand || []).find(c => c.id === preview.id);
    recordAct(this.doc, "adjust_card", { card: preview.id, level: this.adjustLevel });
    this.adjustOpen = false;
    this._compile();   // now it is kept, the recovered draft may hold it
    this.app._announce(`Kept: ${card?.title || "your idea"}. Undo brings the old song back.`);
    this.render();
  }

  /* ---- The timeline: the whole song as blocks on one time axis. Drag anywhere to play from there. ---- */
  _timelineModel() {
    const song = this.app.compiledSong;
    if (!song?.events) return null;
    const spb = stepsPerBar(this.doc), total = Number(song.total_steps) || 64;
    const ranges = songCardRanges(this.doc.song_cards, 4 * spb, song.bpm || 100, spb);
    const lanes = [["drums", "Beat", e => e.role === "drums"], ["bass", "Bass", e => e.role === "bass"], ["chords", "Chords", e => e.role === "harmony" || e.role === "hocket"], ["tune", "Tune", e => e.role === "lead"]];
    const blocks = [];
    for (const [id, , test] of lanes) for (const e of song.events) {
      if (!test(e) || (e.velocity ?? 1) <= 0) continue;
      blocks.push({ lane: id, step: Number(e.step) || 0, length: Math.max(.5, Number(e.duration_steps) || 1), own: e.provenance === "user_placed" || e.provenance === "hummed_confirmed", id: e.id });
    }
    return { total, spb, ranges, lanes: lanes.map(([id, label]) => ({ id, label })), blocks,
      parts: ranges.map((r, i) => ({ ...r, name: this.doc.song_cards[i]?.role_name || `Part ${i + 1}` })) };
  }

  _timelineHtml() {
    const m = this._timelineModel();
    if (!m) return "";
    const PX = 6, LANE = 14, HEAD = 16, LEFT = 46, W = LEFT + m.total * PX + 8, H = HEAD + m.lanes.length * LANE + 10;
    const x = step => LEFT + step * PX;
    const step = this.app.scheduler?.isPlaying && this.playhead ? this.playhead.step : (this.timelineStep ?? 0);
    const partsSvg = m.parts.map(p => `<g class="pf-tl-part"><line x1="${x(p.start_step)}" x2="${x(p.start_step)}" y1="0" y2="${H}" class="pf-tl-partline"/><text x="${x(p.start_step) + 4}" y="11" class="pf-tl-partname">${esc(p.name)}</text></g>`).join("");
    const bars = Array.from({ length: Math.ceil(m.total / m.spb) }, (_, b) => `<line x1="${x(b * m.spb)}" x2="${x(b * m.spb)}" y1="${HEAD}" y2="${H - 10}" class="pf-tl-bar"/>`).join("");
    const lanesSvg = m.lanes.map((l, i) => `<text x="4" y="${HEAD + i * LANE + 10}" class="pf-tl-lane pf-part-${l.id}">${l.label}</text>`).join("");
    const blocks = m.blocks.map(b => `<rect x="${x(b.step)}" y="${HEAD + m.lanes.findIndex(l => l.id === b.lane) * LANE + 2}" width="${Math.max(3, b.length * PX - 1)}" height="${LANE - 4}" rx="2" class="pf-tl-block pf-part-${b.lane}${b.own ? " own" : ""}" data-id="${esc(b.id)}"/>`).join("");
    const px = x(Math.max(0, Math.min(m.total, step)));
    return `<div class="pf-timeline-wrap"><p class="pf-sub pf-tl-help">Drag along the timeline to play from anywhere. <span data-tl-label>${this._timelineLabel(step, m)}</span></p>
      <svg class="pf-timeline" data-timeline viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="slider" tabindex="0" aria-label="Where the song is playing" aria-valuemin="1" aria-valuemax="${Math.ceil(m.total / m.spb)}" aria-valuenow="${Math.floor(step / m.spb) + 1}" aria-valuetext="${esc(this._timelineLabel(step, m))}">
        ${lanesSvg}${partsSvg}${bars}${blocks}
        <g class="pf-tl-playhead" transform="translate(${px} 0)"><line x1="0" x2="0" y1="0" y2="${H}"/><path d="M-6 0 L6 0 L0 8 Z"/></g>
      </svg></div>`;
  }

  _timelineLabel(step, m = this._timelineModel()) {
    if (!m) return "";
    const part = m.parts.find(p => step >= p.start_step && step < p.end_step) || m.parts.at(-1);
    const bar = Math.floor((step - (part?.start_step || 0)) / m.spb) + 1;
    return `${part?.name || "Song"}, bar ${Math.max(1, bar)}.`;
  }

  _paintTimeline() {
    const svg = this.root?.querySelector?.("[data-timeline]");
    if (!svg) return;
    const m = this._timelineModel();
    if (!m) return;
    const step = this.app.scheduler?.isPlaying && this.playhead ? this.playhead.step : (this.timelineStep ?? 0);
    if (step === this.timelinePainted) return;
    this.timelinePainted = step;
    svg.querySelector(".pf-tl-playhead")?.setAttribute("transform", `translate(${46 + Math.max(0, Math.min(m.total, step)) * 6} 0)`);
    svg.setAttribute("aria-valuenow", String(Math.floor(step / m.spb) + 1));
    const label = this._timelineLabel(step, m);
    svg.setAttribute("aria-valuetext", label);
    const text = this.root.querySelector("[data-tl-label]");
    if (text && text.textContent !== label) text.textContent = label;
  }

  _timelineStepAt(e, svg) {
    const m = this._timelineModel();
    if (!m) return 0;
    const rect = svg.getBoundingClientRect(), W = 46 + m.total * 6 + 8;
    const vx = (e.clientX - rect.left) / Math.max(1, rect.width) * W;
    return Math.max(0, Math.min(m.total - 1, Math.floor((vx - 46) / 6)));
  }

  _beginScrub(e, svg) {
    try { svg.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointers */ }
    this.scrub = { pointerId: e.pointerId, svg, last: null };
    this._scrubTo(e);
  }

  _scrubTo(e) {
    const svg = this.root?.querySelector?.("[data-timeline]") || this.scrub?.svg;
    if (!svg) return;
    const step = this._timelineStepAt(e, svg);
    if (this.scrub && this.scrub.last === step) return;
    if (this.scrub) this.scrub.last = step;
    return this._seekTo(step);
  }

  _endScrub() {
    const scrub = this.scrub;
    this.scrub = null;
    try { scrub?.svg?.releasePointerCapture?.(scrub.pointerId); } catch { /* already released */ }
  }

  /** Play from a step of the whole song. On Detail this may mean opening the part that step is in. */
  async _seekTo(step) {
    const scheduler = this.app.scheduler, m = this._timelineModel();
    if (!m) return;
    this.timelineStep = step;
    const partIndex = m.parts.findIndex(p => step >= p.start_step && step < p.end_step);
    if (this.stage === "tune" && this.editingCard != null && partIndex >= 0 && partIndex !== this.editingCard) {
      this._editPart(partIndex);
      this.eventTuneBar = Math.floor((step - m.parts[partIndex].start_step) / m.spb);
      this.render();
    } else if (this.stage === "tune" && partIndex >= 0) {
      const bar = Math.floor((step - m.parts[partIndex].start_step) / m.spb);
      if (bar !== this.eventTuneBar) { this.eventTuneBar = bar; this.render(); }
    }
    if (!scheduler.isPlaying) {
      const range = this.stage === "tune" && this.editingCard != null ? m.parts[this.editingCard] : null;
      await this._keepMusicGoing(this._intentToken(), range ? [range.start_step, range.end_step] : null);
    }
    scheduler.seekToStep?.(step);
    // A real playhead object: the painter reads its hits and lead, not just the step.
    this.playhead = advancePlayhead(null, { step, events: [] }, this.app.compiledSong?.total_steps || 64, stepsPerBar(this.doc));
    this._paintTimeline();
  }

  /** The same music as real notation. One staff per part that sounds; your notes are outlined; a line follows the music. */
  _sheetScore() {
    const song = this.app.compiledSong, g = this.doc?.global_context || {};
    if (!song?.events) return null;
    return scoreFromEvents(song.events, { title: this.doc.title || "My song", bpm: song.bpm || g.bpm || 100, rootPc: g.root_pc || 0,
      scaleType: g.scale_type || "major", stepsPerBar: stepsPerBar(this.doc), totalSteps: song.total_steps });
  }

  /** While you play, the page writes itself from what has actually sounded: the last eight bars. */
  _liveSheet() {
    const scheduler = this.app.scheduler, take = scheduler?.performanceTake, g = this.doc?.global_context || {};
    if (!take || !scheduler.isPlaying) return null;
    const now = scheduler.audioCtx?.currentTime ?? 0, spb = take.steps_per_bar || 16;
    const { events, step } = eventsFromTake(take, { until: now });
    const window = 8 * spb, from = Math.max(0, Math.floor(step / spb) * spb - (window - spb));
    const shown = events.filter(e => e.step >= from).map(e => ({ ...e, step: e.step - from }));
    const score = scoreFromEvents(shown, { title: this.doc.title || "Playing now", bpm: take.bpm, rootPc: g.root_pc || 0,
      scaleType: g.scale_type || "major", stepsPerBar: spb, totalSteps: Math.max(spb, Math.ceil((step - from + 1) / spb) * spb) });
    return { score, step: step - from };
  }

  _sheetSvg() {
    if (this.stage === "jam") {
      const live = this._liveSheet();
      return live ? renderSheetSvg(live.score, { playheadStep: live.step }) : "";
    }
    const score = this._sheetScore();
    if (!score) return "";
    const step = this.app.scheduler?.isPlaying && this.playhead ? this.playhead.step : null;
    return renderSheetSvg(score, { playheadStep: step });
  }

  _sheetBoxHtml() {
    if (this.sheetOpen === undefined) this.sheetOpen = typeof window !== "undefined" && (window.innerWidth || 0) >= 900;
    const live = this.stage === "jam";
    return `<details class="pf-sheet-box" ${this.sheetOpen ? "open" : ""}><summary data-key="sheet-toggle">${icon("note")} Sheet music</summary>
      <p class="pf-sub">${live ? "The page writes itself as the band plays. The ball is the beat. Your notes have a bright edge." : "The same song, written down. Your notes have a bright edge. The line shows what plays."}</p>
      <div class="pf-sheet-wrap" data-sheet>${this.sheetOpen ? this._sheetSvg() : ""}</div>
      ${live ? "" : `<div class="pf-row">${this._btn("dl-sheet", `${icon("download")} Download sheet`, "pf-btn pf-small")}</div>`}
    </details>`;
  }

  _paintSheet() {
    if (!this.sheetOpen) return;
    const wrap = this.root?.querySelector?.("[data-sheet]");
    if (!wrap) return;
    const scheduler = this.app.scheduler;
    // Redraw on every 16th while playing (the ball moves within the beat); otherwise only when the song changes.
    const key = scheduler?.isPlaying ? Math.floor((scheduler.audioCtx?.currentTime ?? 0) * 12) : `still:${this.app.compiledSong?.events?.length}`;
    if (key === this.sheetStep && wrap.firstChild) return;
    this.sheetStep = key;
    wrap.innerHTML = this._sheetSvg();
  }

  _downloadSheet() {
    this._readTitle();
    this._compile();
    const score = this._sheetScore();
    if (!score) return;
    const safe = (this.doc.title || "my_song").replace(/[^a-z0-9_-]+/gi, "_").toLowerCase() || "my_song";
    triggerBlobDownload(new Blob([toMusicXML(score)], { type: "application/vnd.recordare.musicxml+xml" }), `${safe}.musicxml`);
    this.saveMessage = `Downloaded "${this.doc.title}.musicxml". You can open it here. Music apps can too.`;
    this.app._announce(this.saveMessage);
    this.render();
  }

  /** A sheet (ours or from a notation program) becomes a song: four bars per part, the rest as further parts. */
  _openSheet(sheet) {
    const spb = sheet.steps_per_bar || 16, perPart = 4 * spb;
    const doc = newPlayDoc();
    doc.title = sheet.title || "Opened sheet";
    doc.global_context = { ...doc.global_context, bpm: sheet.bpm || 100, root_pc: sheet.root_pc || 0, scale_type: sheet.scale_type || "major", steps_per_bar: spb };
    const all = sheet.notes.map(n => ({ ...n }));
    const parts = Math.max(1, Math.ceil(Math.max(1, ...all.map(n => n.step + 1)) / perPart));
    doc.song_cards = [];
    for (let p = 0; p < parts; p++) {
      const notes = all.filter(n => n.step >= p * perPart && n.step < (p + 1) * perPart).map(n => ({ ...n, step: n.step - p * perPart }));
      const card = { bars: Math.min(4, Math.max(1, Math.ceil((Math.max(0, ...notes.map(n => n.step + 1)) || spb) / spb))), role_name: parts === 1 ? "My sheet" : `Sheet part ${p + 1}`, beat: true, tune: true, under: true, fx: null, big: false };
      if (p === 0) doc.notes = notes; else card.material = extractSongMaterial({ ...doc, notes });
      doc.song_cards.push(card);
    }
    doc.auto_harmony_stabs = false;
    doc.scaffold_options = { ...doc.scaffold_options, humanize: false, hocket_choke: false, pre_drop_silence: false };
    doc.sheet_source = { version: 1, opened_at: new Date().toISOString() };
    return doc;
  }

  _renderAllAtOnce() {
    const playing = Boolean(this.app.scheduler?.isPlaying);
    const playBtn = this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play");
    const undoBtn = this._btn("undo", `${icon("undo")} Undo`);
    const keepBtn = this._btn("keep", `${icon("save")} Save`, "pf-btn pf-next");
    const stepBtn = this._btn("toggle-all-view", `${icon("back")} Step by step`, "pf-btn pf-small");
    const spotRole = this.app.scheduler?.spotlightRole || null;
    const muted = this.app.scheduler?.mutedLayers || new Set();
    const spotBtns = CARD_LAYERS.map((l) =>
      this._choice(`spot:${l.id}`, `${icon(l.icon)} Focus ${l.label.toLowerCase()}`, spotRole === l.id, "pf-btn pf-small")
    ).join("");
    const muteBtns = CARD_LAYERS.map((l) =>
      this._choice(`jam-mute:${l.id}`, `${icon(l.icon)} ${l.label} on`, !muted.has(l.id), "pf-btn pf-small")
    ).join("");
    return `
      <div class="pf-stage pf-all">
        <div class="pf-head-row">
          <h1 class="pf-heading">All at once</h1>
          <div class="pf-row">${playBtn} ${undoBtn} ${keepBtn} ${stepBtn}${this._btn("capture-direction", "Make my song", "pf-btn pf-next")}</div>
        </div>
        <p class="pf-sub">“Keep it” saves this loop; “Make a song” builds a whole song from it. Focus is just for listening; it is not kept.</p>
        <div class="pf-row" role="group" aria-label="Focus one part">${spotBtns}</div>
        <div class="pf-row" role="group" aria-label="Play parts">${muteBtns}</div>
        <div class="pf-all-grid">
          <div class="pf-panel">${this._renderBeat({ embedded: true })}</div>
          <div class="pf-panel">${this._renderTune({ embedded: true })}</div>
          <div class="pf-panel">${this._renderUnder({ embedded: true })}</div>
          <div class="pf-panel">${this._renderSong({ embedded: true })}</div>
        </div>
      </div>`;
  }

  _pieceAbout() {
    const lead = (this.doc.notes || []).filter((n) => n.role === "lead" && n.step < stepsPerBar(this.doc));
    const lastCard = normalizeSongCards(this.doc.song_cards).at(-1);
    const ending = `Last part: ${lastCard.bars || BARS} bars.`;
    const feel = FEELS.find((f) => f.id === this.doc.underneath?.feel)?.label || "Just beat and tune";
    const kit = KITS.find((k) => k.id === (this.doc.drum_kit || "punchy"))?.label || "Punchy";
    const cards = normalizeSongCards(this.doc.song_cards).length;
    const stemBtns = CARD_LAYERS.map((l) =>
      this._btn(`dl-stem:${l.id}`, `${icon("download")} Get ${l.label.toLowerCase()} file`, "pf-btn pf-small")
    ).join("");
    return `<div class="pf-details">
      <p class="pf-say">Drum sound: ${kit}. Speed: ${Math.round(this.doc.global_context.bpm || 100)}. Notes in a bar: ${lead.length}. ${ending} Under it: ${feel}. Parts: ${cards}.</p>
      <div class="pf-row" role="group" aria-label="Part files">${stemBtns}</div>
      <div class="pf-row" role="group" aria-label="Keep forever">
        ${this._btn("dl-project", `${icon("save")} Save song file`, "pf-btn pf-small")}
        ${this._btn("open-project", `${icon("plus")} Open a file`, "pf-btn pf-small")}
      </div>
    </div>`;
  }

  _renderKeep() {
    const mine = madeByYou(this.doc);
    const title = this.doc.title || "";
    const playing = Boolean(this.app.scheduler?.isPlaying);
    const names = NAME_IDEAS.map((n) => this._choice(`name:${n}`, `${icon("star")} ${n}`, title === n)).join("");
    const swapList = this.slotsFull
      ? (() => {
          const saves = listSaves(window.localStorage);
          const { shown, moreBtn } = this._savesShown(saves, "swapPage");
          const rows = shown
            .map((s) => {
              const armed = this.confirm.armed === `replace:${s.id}`;
              return this._btn(
                `replace:${s.id}`,
                armed ? `Sure? Replace` : `${icon("swap")} Use this spot`,
                `pf-btn${armed ? " pf-armed" : ""}`,
                `aria-label="${esc(armed ? `Sure? Replace ${s.title}` : `Use ${s.title}`)}: ${esc(s.title)}"`
              );
            })
            .join("");
          const moreRow = moreBtn ? `<div class="pf-row">${moreBtn}</div>` : "";
          const oldest = [...saves].sort((a, b) => String(a.saved_at).localeCompare(String(b.saved_at)))[0];
          const oldestArmed = oldest && this.confirm.armed === `replace:${oldest.id}`;
          return `<div class="pf-saves">
            <p class="pf-say">All ${SLOT_COUNT} spots are full. Download this song, or swap out an old one.</p>
            <div class="pf-row">${this._btn("download", `${icon("download")} Download audio`, "pf-btn")}${oldest ? this._btn(`replace:${oldest.id}`, oldestArmed ? "Sure? Swap oldest" : `${icon("swap")} Swap oldest`, `pf-btn pf-next${oldestArmed ? " pf-armed" : ""}`, `aria-label="${esc(oldestArmed ? `Sure? Replace ${oldest.title}` : `Swap out the oldest song, ${oldest.title}`)}"`) : ""}</div>
            <p class="pf-sub">Or pick one to swap (press two times):</p>
            <div class="pf-row" role="group" aria-label="Replace a saved song">${rows}</div>
            ${moreRow}
          </div>`;
        })()
      : "";
    return `
      <div class="pf-stage pf-keep">
        <div class="pf-head-row"><h1 class="pf-heading">Share your song</h1>${this._barsHtml()}</div>
        <p class="pf-say">${
          mine
            ? "It is saved here as you go. Pick a name, then save it to your list or download it."
            : "You can keep this starting point now and add your own notes later."
        }</p>
        <div class="pf-row pf-name-row">
          <label class="pf-say" for="pf-title">Name:</label>
          <input id="pf-title" type="text" value="${esc(title)}" placeholder="My song" />
          <details class="pf-name-ideas" ${this.nameIdeasOpen ? "open" : ""}><summary data-key="name-ideas">Name ideas</summary><div class="pf-row" role="group" aria-label="Pick a name">${names}</div></details>
        </div>
        <div class="pf-row">
          ${this._btn("save", `${icon("save")} Save`, "pf-btn pf-big")}
          ${this._btn("download", `${icon("download")} Download audio`, "pf-btn pf-big")}
          ${this._btn("dl-sheet", `${icon("note")} Download sheet`, "pf-btn pf-big")}
          ${this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play")}
          ${this._backBtn()}
        </div>
        ${swapList}
        ${this.saveMessage ? `<p class="pf-say pf-msg" aria-live="polite">${esc(this.saveMessage)}</p>` : ""}
        <details class="pf-demo-tools pf-share-more" ${this.shareMoreOpen ? "open" : ""}><summary data-key="share-more">More</summary>
          <div class="pf-row">
            ${this._btn("toggle-about", `${icon("sparkle")} ${this.aboutOpen ? "Close about this" : "More about this"}`, "pf-btn pf-small", `aria-expanded="${this.aboutOpen}"`)}
            ${this._btn("toggle-all-view", `${icon("grid")} All at once`, "pf-btn pf-small")}
          </div>
          ${this.aboutOpen ? this._pieceAbout() : ""}
        </details>
        <input id="pf-import-file" type="file" accept=".json,.musicxml,.xml,application/json,application/vnd.recordare.musicxml+xml,text/xml" style="display:none" aria-hidden="true" tabindex="-1" />
      </div>`;
  }

  // ---- Actions ----

  _freshState({ audioStopped = false } = {}) {
    if (!audioStopped) this._stopForScopeChange();
    this.editingCard = null;
    this.sharedMaterial = null;
    this.jamPlayed = false;
    this.doc = newPlayDoc();
    this.doc.song_cards = defaultSongCards();
    this.beatGrid = beatGridFromNotes(this.doc.notes,stepsPerBar(this.doc));
    this.tuneGrid = tuneGridFromNotes(this.doc.notes);
    this.tuneTab = "main";
    this.tunePage = 0;
    this.allAtOnce = false;
    this.app.scheduler?.clearMuteLayers();
    this.app.scheduler?.setSpotlightRole(null);
    this.suggester = createSuggester();
    this.lastTuneCol = null;
    this.undoStack = [];
    this.taps = [];
    this.tapBpm = null;
    this.diceSeed = 0;
    this.humPreview = null;
    this.humMessage = "";
    this.beforeHum = null;
    this.saveMessage = "";
    this.slotsFull = false;
    this.jamStep = 0;
    this.jamMessage = "";
    this.instrumentPickerOpen = false;
    this._compile();
  }

  _newPiece() {
    return this._startWithInstrument("drums", "soft");
  }

  _startWithInstrument(kind, instrumentId) {
    return this._startInstrument(instrumentId);
  }

  /** Sampled sounds are fetched in the background whenever the song needs them. */
  _loadSoundsQuietly() {
    const scheduler = this.app.scheduler;
    if (this.quietLoad || !scheduler?.preparePiano) return;
    this.quietLoad = Promise.resolve().then(() => scheduler.preparePiano())
      .catch(() => { this.pianoMessage = "The sounds did not load. Press Play to try again."; this.render(); })
      .finally(() => { this.quietLoad = null; });
  }

  async _loadPiano() {
    if (this.pianoLoading) return false;
    const generation = this.pianoLoadGeneration = (this.pianoLoadGeneration || 0) + 1;
    this._stopForScopeChange();
    this.pianoLoading = true;
    this.pianoMessage = 'Loading local instrument sounds. No music will start.';
    this.app._announce(this.pianoMessage); this.render();
    try {
      await this.app.scheduler.preparePiano();
      if (generation !== this.pianoLoadGeneration) return false;
      this.pianoMessage = 'Sounds ready. Play when you are ready.';
      return true;
    } catch (error) {
      if (generation !== this.pianoLoadGeneration) return false;
      this.pianoMessage = `${error.message} Your notes are preserved.`;
      return false;
    } finally {
      if (generation === this.pianoLoadGeneration) {
        this.pianoLoading = false; this.app._announce(this.pianoMessage); this.render();
      }
    }
  }

  async _startInstrument(instrumentId) {
    const instrument = getInstrument(instrumentId);
    if (!instrument) return;
    if (!this._retainBeforeSwitch()) return;
    if (isSampledPatch(instrumentId) && !await this._loadPiano()) return;
    this._freshState({audioStopped:isSampledPatch(instrumentId)});
    if(this.newCycle===12) {
      this.doc.global_context.steps_per_bar=12;
      for(const progression of Object.values(this.doc.chord_progressions||{}))
        for(const chord of progression)chord.beats=3;
    }
    this.doc.selected_instrument = instrument.id;
    this._acceptJamDoc(setJamDirection(startJam(this.doc, { kind: instrument.kind, patchId: instrument.patchId, kit: instrument.kitId }),{style_spectrum:0}));
    this._go("jam");
    this.app._announce(`${instrument.label} chosen. Press Play to hear the band.`);
    return true;
  }

  // The first tour uses only authored compatible profiles. It is not a global
  // genre generator. Wait for queued transitions to play, then dwell 20 seconds.
  _nextExplorationDirection(current) {
    if(!hasSceneCatalogue(this.doc.jam_session))return nextExplorationStyle(current,[],this.explorationRandom||Math.random);
    this.explorationVisited=[...new Set([...(this.explorationVisited||[]),current])];
    if(this.explorationVisited.length>=SCENE_CATALOGUE.length)this.explorationVisited=[current];
    return nextUnvisitedStyle(current,this.explorationVisited,index=>compatibleSceneIndices(index).filter(i=>sceneTempoAllowed(SCENE_CATALOGUE[i].id,this.doc.global_context.bpm)),this.explorationRandom||Math.random,
      (this.styleFavorites||[]).map(id=>SCENE_CATALOGUE.findIndex(scene=>scene.id===id)));
  }

  // Musical decisions must not depend on animation frames being painted.
  advanceMusic() {
    this._flushMusicField();
    this._paintMusicField();
    if (!this.app.scheduler.isPlaying) {
      if (this.exploreTour) this.exploreTour.settledAt = null;
      return;
    }
    if (this.stage === 'jam') this._advanceExploreTour();
  }

  _advanceExploreTour() {
    const tour = this.exploreTour, scheduler = this.app.scheduler;
    const status=this.root?.querySelector?.('[data-kept-band-status]');
    if(status&&status.textContent!==this._keptBandStatus())status.textContent=this._keptBandStatus();
    this._queueMelodicEvolution();
    if (!tour || this.stage !== 'jam' || !scheduler.isPlaying) return;
    const now = scheduler.audioCtx.currentTime;
    if (tour.settledAt == null) {
      // Player replies also queue backing updates. They must not keep restarting
      // the dwell clock while someone plays; only a style bridge gates entry.
      if (scheduler.jamBridgeStage != null || scheduler.lastJamBackingCommit?.audioTime > now) return;
      tour.settledAt = now;
    }
    const wandering= tour.mode==='wide'&&this.doc.jam_session?.showcase_version===1;
    const phrase = wandering?EXPLORATION_DWELL_SECONDS:(4*stepsPerBar(this.doc)) * 15 / (Number(this.doc.global_context?.bpm) || 100);
    if (now - tour.settledAt < phrase) return;
    const current = Math.round(this.doc.jam_session?.style_spectrum || 0);
    if(wandering) {
      const next=this._nextExplorationDirection(current);
      tour.recent=[...(tour.recent||[]),current].slice(-2);
      this._acceptJamDoc(setJamDirection(this.doc,{style_spectrum:next,scene_variant:'base'}));
      tour.settledAt=null;
      return this.render();
    }
    if(tour.mode==='near') {
      const index=SCENE_VARIANTS.findIndex(item=>item.id===(this.doc.jam_session.scene_variant||'base'));
      this._acceptJamDoc(setJamDirection(this.doc,{...(this.doc.jam_session.anchor_backing?{}:{style_spectrum:tour.anchor}),
        scene_variant:SCENE_VARIANTS[(index+1)%SCENE_VARIANTS.length].id}));
      tour.settledAt=null;
      return this.render();
    }
    if(tour.mode==='wide' && (this.doc.jam_session.scene_variant||'base')==='base') {
      tour.variantCursor=(tour.variantCursor||0)+1;
      this._acceptJamDoc(setJamDirection(this.doc,{style_spectrum:current,
        scene_variant:tour.variantCursor%2 ? 'answer':'space'}));
      tour.settledAt=null;
      return this.render();
    }
    if (current >= STYLE_PROFILES.length - 1) tour.direction = -1;
    if (current <= 0) tour.direction = 1;
    this._acceptJamDoc(setJamDirection(this.doc, {style_spectrum: current + tour.direction,scene_variant:'base'}));
    tour.settledAt = null;
    this.render();
  }

  _queueMelodicEvolution() {
    const scheduler=this.app.scheduler,jam=this.doc?.jam_session;
    this._retainMelodicState();
    if(this.stage!=='jam'||jam?.showcase_version!==1||jam.anchor_backing||formBlockCount(jam.scene_id)
      ||!scheduler.isPlaying||!scheduler._supportsJamPhrase?.()) {
      if(scheduler.pendingJamLead)scheduler.pendingJamLead=null;
      return;
    }
    if(scheduler.pendingJamBacking!==null||scheduler.jamBridgeStage!==null
      ||scheduler.lastJamBackingCommit?.audioTime>scheduler.audioCtx.currentTime)return;
    // An answer to the person's playing is waiting for its bar line; development must not replace it.
    if(scheduler.pendingJamLead?.commitStep!==undefined)return;
    // A lookahead commit is still future music. Wait until its opening has
    // actually reached the audio clock before using history to plan another.
    if(scheduler.lastJamLeadCommit?.audioTime>scheduler.audioCtx.currentTime)return;
    const bpm=this.doc.global_context.bpm||100;
    const spacing=Math.max(1,Math.ceil(6/(64*15/bpm)));
    const next=scheduler.jamPhraseOrdinal+(scheduler.currentStep===0?0:1);
    const target=Math.max(spacing,Math.ceil(next/spacing)*spacing);
    const roomFor=jam.live_keys&&jam.responsive===true
      ?playedResponseSources(scheduler.performanceTake?.events,scheduler.audioCtx.currentTime,64*15/bpm):[];
    if((scheduler.lastJamLeadCommit?.phraseOrdinal??-1)>=target)return;
    if(scheduler.pendingJamLead?.phraseOrdinal===target
      &&JSON.stringify(scheduler.pendingJamLead.descriptor?.roomFor||[])===JSON.stringify(roomFor))return;
    const seed=jam.melodic_evolution?.seed??[...(this.doc.id||'')].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
    const previousPatch=scheduler.activeJamLead?.events[0]?.patch_id
      ||scheduler.committedJamBacking?.find(e=>e.role==='lead')?.patch_id;
    const snapshot=scheduler.activeJamBacking?.();
    const context=snapshot?.phraseContext;
    const realized=snapshot?.leadPlan?.descriptor||scheduler.retiredJamLeadDescriptor;
    const recentOpenings=realized?.version>=2?
      [...realized.recentOpenings,...(realized.roomFor?.length?[]:[realized.openingId])].slice(-4):[];
    const phrase=planMelodicPhrase({version:context?.harmony?3:2,harmony:context?.harmony,recentOpenings,roomFor,phraseOrdinal:(scheduler.jamEvolutionOrigin||0)+target/spacing,sceneId:context?.sceneId||jam.scene_id||'contrast-1',
      root:context?.root??(this.doc.global_context.root_pc||0),minor:context?.minor??/minor|dorian|phrygian/.test(this.doc.global_context.scale_type||''),
      bpm,seed,previousPatch});
    const planVersion=Math.max(scheduler.activeJamLead?.planVersion||0,scheduler.pendingJamLead?.planVersion||0)+1;
    scheduler.queueJamLead({...phrase,planVersion,phraseOrdinal:target});
  }

  _rememberAnswerPad(sourceNoteId, pad) {
    this.answerPads = this.answerPads || new Map();
    this.answerPads.set(sourceNoteId, pad);
    while (this.answerPads.size > 16) this.answerPads.delete(this.answerPads.keys().next().value);
  }

  /** When the band plays a note that answers yours, your pad lights with it and it is said in words. */
  _showBandAnswers(stepEvt) {
    for (const passed of stepEvt?.passed || []) for (const event of passed.events || []) {
      const source = event.evolution?.answered?.source_note_id, pad = this.answerPads?.get(source);
      if (pad === undefined) continue;
      this.answerPads.delete(source);
      this.padFlashes = this.padFlashes || new Map();
      this.padFlashes.set(pad, performance.now() + 450);
      this.answerHeard = { text: "The band picked up your note.", until: performance.now() + 3000 };
      const status = this.root?.querySelector?.('#pf-answer-heard');
      if (status && status.textContent !== this.answerHeard.text) status.textContent = this.answerHeard.text;
    }
    if (this.answerHeard && this.answerHeard.until <= performance.now()) {
      this.answerHeard = null;
      const status = this.root?.querySelector?.('#pf-answer-heard');
      if (status) status.textContent = "";
    }
  }

  /** The band's next bar opens on the note just played, fitted to that bar's chord. */
  _answerNextBar(midi, sourceNoteId) {
    const scheduler = this.app.scheduler, jam = this.doc?.jam_session;
    if (this.stage !== 'jam' || jam?.showcase_version !== 1 || jam.anchor_backing || !scheduler.isPlaying
      || !scheduler._supportsJamPhrase?.() || !Number.isFinite(midi)) return false;
    if (scheduler.activeJamForm) {
      // Fixed-form styles keep their melody; the answer is played over it.
      const after = Math.floor(scheduler.currentStep / 16) + 1, bar = after % 4;
      const context = scheduler.activeJamBacking?.()?.phraseContext;
      const pitch = fitToBarChord(midi, {bar, harmony: context?.harmony,
        root: context?.root ?? (this.doc.global_context.root_pc || 0), minor: context?.minor ?? false});
      const patchId = scheduler.committedJamBacking?.find(e => e.role === 'lead')?.patch_id || this._liveJamPads()[0]?.patchId;
      return scheduler.answerNextBar?.({step: bar * 16, phraseOrdinal: scheduler.jamPhraseOrdinal + (after >= 4 ? 1 : 0),
        pitch, midi, sourceNoteId, patchId}) || false;
    }
    const base = scheduler.activeJamLead?.events
      || scheduler.committedJamBacking?.filter(e => e.role === 'lead' && e.provenance === 'jam_generated');
    if (!base?.length) return false;
    const after = Math.floor(scheduler.currentStep / 16) + 1, bar = after % 4;
    const context = scheduler.activeJamBacking?.()?.phraseContext;
    const events = anchorPhraseToPlaying(base, {bar, midi, sourceNoteId, harmony: context?.harmony,
      root: context?.root ?? (this.doc.global_context.root_pc || 0), minor: context?.minor ?? false, bpm: this.doc.global_context.bpm || 100});
    if (!events) return false;
    const planVersion = Math.max(scheduler.activeJamLead?.planVersion || 0, scheduler.pendingJamLead?.planVersion || 0) + 1;
    return scheduler.queueJamLead({events, planVersion, phraseOrdinal: scheduler.jamPhraseOrdinal + (after >= 4 ? 1 : 0),
      commitStep: bar * 16, descriptor: scheduler.activeJamLead?.descriptor || null});
  }

  _retainMelodicState() {
    if(this.stage!=='jam'||!this.doc?.jam_session||this.doc.captured_performance)return;
    const scheduler=this.app.scheduler;
    const snapshot=scheduler.isPlaying?scheduler.activeJamBacking?.():scheduler.lastStoppedJamLead;
    const cursor=scheduler.isPlaying?snapshot?.phraseContext?.form:snapshot?.formCursor;
    if(snapshot?.source_song_id===this.doc.id&&cursor?.id===this.doc.jam_session.scene_id)
      this.doc.jam_session.form_cursor=JSON.parse(JSON.stringify(cursor));
    const plan=scheduler.isPlaying?snapshot?.leadPlan:snapshot?.plan;
    if(snapshot?.source_song_id===this.doc.id&&plan?.descriptor)
      this.doc.jam_session.melodic_evolution=JSON.parse(JSON.stringify(plan.descriptor));
  }

  _jamFormProgram() {
    if(this.stage!=='jam')return null;
    this.buildJamForm ||= createJamFormBuilder();
    return this.buildJamForm(this.doc);
  }

  _savedMelodicLead() {
    if(formBlockCount(this.doc?.jam_session?.scene_id))return null;
    if(this.stage!=='jam'||this.doc?.captured_performance||this.doc?.jam_session?.anchor_backing)return null;
    let phrase=restoreMelodicPhrase(this.doc?.jam_session?.melodic_evolution);
    if(phrase) {
      // Resume the selected phrase, but honor intentional tempo/key edits.
      // Scene handoffs retain their last realized lead until the next phrase.
      const context=this.doc.global_context;
      const currentHarmony=phraseContext({...this.doc,jam_session:{...this.doc.jam_session,scene_id:phrase.descriptor.sceneId}})?.harmony;
      const modeChanged=phrase.descriptor.minor!==/minor|dorian|phrygian/.test(context.scale_type||'');
      phrase=restoreMelodicPhrase({...phrase.descriptor,...(phrase.descriptor.version===3&&modeChanged&&currentHarmony?{harmony:currentHarmony}:{}),bpm:context.bpm||100,root:context.root_pc||0,
        minor:/minor|dorian|phrygian/.test(context.scale_type||'')});
    }
    return phrase?{...phrase,planVersion:1,phraseOrdinal:0,notBeforeAudioTime:0}:null;
  }

  _comparisonHtml() {
    const c=this.partComparison;
    return `<section class="pf-stage" aria-label="Optional listening comparison"><h2>Compare part ${c.index+1}</h2>
      <p class="pf-say">${c.changed ? `${c.changed} band notes are quieter. Your played notes stay the same. Nothing changes until you choose Keep.` : 'No band notes can change here. Both versions stay the same.'}</p>
      ${c.changed ? '<p class="pf-say">Hear how a softer band leaves your tune more space. You can keep either one.</p>' : ''}
      <div class="pf-row">${this._btn('compare-original','Play original','pf-btn')}${this._btn('compare-alternative',c.changed?'Play quieter band':'Play preview','pf-btn')}
      ${this._btn('compare-stop','Stop comparison','pf-btn')}${this._btn('compare-keep','Keep this change','pf-btn',c.changed?'':'disabled')}
      ${this._btn('compare-close','Keep original / Close','pf-btn')}</div></section>`;
  }

  _anchorActiveBand(retryKey=null) {
    const snapshot=this.app.scheduler.activeJamBacking?.();
    const next=anchorBand(this.doc,snapshot);
    // Nothing to hold yet: start the band, then do what was asked once it plays.
    if(!next) {if(retryKey&&!this.anchorRetry)this._startThenRetry(retryKey);return false;}
    if(snapshot.phraseContext?.musicField?.version===5){next.jam_session.scene_id=snapshot.phraseContext.sceneId;next.jam_session.style_spectrum=SCENE_CATALOGUE.findIndex(s=>s.id===snapshot.phraseContext.sceneId);}
    delete next.jam_session.music_field;
    this.keptBandNoChange=null;
    this.app.scheduler.freezeJamLead?.();
    this._pushUndo();this._acceptJamDoc(setJamDirection(next));
    return true;
  }

  async _startThenRetry(key) {
    this.anchorRetry = true;
    const token = this._intentToken();
    try {
      if (!this.app.scheduler.isPlaying && !(await this._keepMusicGoing(token))) return;
      await new Promise(resolve => setTimeout(resolve, 120));
      if (this._intentValid(token) && this.app.scheduler.isPlaying && this.app.scheduler.activeJamBacking?.())
        await this._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
    } finally { this.anchorRetry = false; }
  }

  async _playComparison(alternative) {
    const comparison=this.partComparison;
    if(!comparison || JSON.stringify(this._canonicalDoc())!==JSON.stringify(comparison.before))return;
    const token=this.comparisonGeneration=(this.comparisonGeneration||0)+1;
    this._stopForScopeChange();
    const doc=alternative?comparison.after:comparison.before;
    const stopGeneration=this.app.scheduler.stopGeneration;
    const card=normalizeSongCards(doc.song_cards)[comparison.index];
    const local=card.material?applySongMaterial(doc,card.material):doc;
    const loop=compileSongStandalone({...local,arrangement_mode:'loop'});
    const compiled=songEvents(loop,[{...card,material:undefined}]);
    try {
      if(compiled.events.some(e=>isSampledPatch(e.patch_id)))await this.app.scheduler.preparePiano();
      if(token!==this.comparisonGeneration || this.partComparison!==comparison
        || stopGeneration!==this.app.scheduler.stopGeneration || this.stage!=='song'
        || JSON.stringify(this._canonicalDoc())!==JSON.stringify(comparison.before))return;
      this.app.scheduler.playComparisonOnce(compiled);
      this.app._announce(alternative&&comparison.changed?'Playing the quieter band example.':'Playing the original part.');
    } catch(error) {this.app._announce(`Comparison could not play: ${error.message}`);}
  }

  _acceptJamDoc(doc) {
    this.doc = doc;
    this.beatGrid = beatGridFromNotes(doc.notes,stepsPerBar(doc));
    this.tuneGrid = { ...this.tuneGrid, ...tuneGridFromNotes(doc.notes) };
    this._compile();
  }

  /** A style with a speed limit slows the song to fit instead of refusing. Undo restores the speed. */
  _fitTempo(limit = ROOTS_FIELD_MAX_BPM) {
    if (!(this.doc.global_context.bpm > limit)) return false;
    this.doc.global_context.bpm = limit;
    this.app._announce("Slowed down to fit this style. Undo brings your speed back.");
    return true;
  }

  /** A press while stopped, or before sampled sounds are ready, gets them going and then plays. */
  async _readyThenPlay(pad, holdSource = null) {
    if (this.pendingPad) return;
    const scheduler = this.app.scheduler, live = Boolean(this.doc.jam_session?.live_keys);
    const sound = this._liveJamPads()[pad], token = this._intentToken();
    const pending = this.pendingPad = { pad, holdSource, released: false };
    // A press that has to wait shows that it was heard, straight away.
    this.jamMessage = "Getting the sound ready…";
    this.render();
    try {
      if (isSampledPatch(sound.patchId) && (!scheduler.masterBus?.piano || scheduler.masterBus.disposed)) await scheduler.preparePiano();
      if (!this._intentValid(token) || this.pendingPad !== pending) return;
      if (live && !scheduler.isPlaying && !(await this._keepMusicGoing(token))) return;
    } catch { return this._soundsNotReady(); }
    finally {
      if (this.pendingPad === pending) this.pendingPad = null;
      if (this.jamMessage === "Getting the sound ready…") this.jamMessage = "";
      this.render();
    }
    if (!this._intentValid(token)) return;
    // A key still held keeps ringing; one released while waiting plays once.
    this._playJamPad(pad, pending.released ? null : holdSource, true);
  }

  _heldFull() {
    this.jamMessage = "Eight notes are held. This one plays short. Let one go to hold more.";
    this.render();
  }

  _soundsNotReady() {
    this.jamMessage = "The sounds did not load. Press again to try. Your notes are safe.";
    this.render();
  }

  /**
   * `holdSource` ("key:a", "pointer:1") marks a press that sounds until that key or pointer is released.
   * Without it (Enter, switch or screen-reader activation) the pad plays one short note.
   */
  _playJamPad(pad, holdSource = null, retried = false) {
    if (this.stage !== "jam" || !Number.isInteger(pad) || pad < 0 || pad >= this._liveJamPads().length) return;
    if (!this.jamPlayed) { this.jamPlayed = true; this._refreshJourney(); }
    if(this.doc.jam_session?.live_keys) {
      const sound=this._liveJamPads()[pad],scheduler=this.app.scheduler;
      scheduler.makeRoomForLive=this.doc.jam_session.responsive===true;
      if(!scheduler.isPlaying||(isSampledPatch(sound.patchId)&&(!scheduler.masterBus?.piano||scheduler.masterBus.disposed)))
        return retried?this._soundsNotReady():this._readyThenPlay(pad,holdSource);
      if(holdSource)this._releaseLive(holdSource);
      // Past the held-note limit a press still sounds, as a short note; earlier holds keep ringing.
      if(holdSource&&sound.role!=='drums'&&sound.patchId!=='reverse_swell'&&scheduler.liveNotes?.size>=LIVE_VOICE_LIMIT){holdSource=null;this._heldFull();}
      this.holdSequence=(this.holdSequence||0)+1;
      const sourceNoteId=`jam-live-${this.doc.id}-${this.holdSequence}-${performance.now()}`;
      try {
        if(holdSource){const id=scheduler.noteOn({...sound,sourceNoteId});if(id!=null){this.liveHolds.set(holdSource,id);this._markJamPad(pad,holdSource,id);}}
        else {scheduler.previewSound({...sound,sourceNoteId,durationSec:.25});if(!scheduler.previewsMuted)this._markJamPad(pad);}
        if(!scheduler.previewsMuted){scheduler.addPlayEnergy?.();if(sound.role!=='drums'&&this._answerNextBar(sound.midi,sourceNoteId))this._rememberAnswerPad(sourceNoteId,pad);}
      }catch(error){this.jamMessage=`Could not play: ${error.message}`;this.app._announce(this.jamMessage);this.render();}
      return;
    }
    const performedSound=this._liveJamPads()[pad];
    if (isSampledPatch(performedSound.patchId) && (!this.app.scheduler.masterBus?.piano || this.app.scheduler.masterBus.disposed))
      return retried ? this._soundsNotReady() : this._readyThenPlay(pad, holdSource);
    if (holdSource) this._releaseLive(holdSource);
    if (holdSource && performedSound.role !== 'drums' && performedSound.patchId !== 'reverse_swell' && this.app.scheduler.liveNotes?.size >= LIVE_VOICE_LIMIT) { holdSource = null; this._heldFull(); }
    this._pushUndo();
    const step = this.app.scheduler?.isPlaying && this.playhead ? this.playhead.step % stepsPerBar(this.doc) : this.jamStep || 0;
    const next = contributeJam(this.doc, { pad, step, sound: performedSound });
    const contribution = next.jam_session.last_contribution;
    const sound = contribution?.patchId ? contribution : performedSound;
    const recordHold = contribution?.added && holdSource && sound.role !== "drums" && sound.patchId !== "reverse_swell";
    this.holdSequence = (this.holdSequence || 0) + 1;
    const holdId = recordHold ? `${next.id}:${this.holdSequence}:${performance.now()}` : null;
    const bpm = Number(next.global_context?.bpm) || 100;
    if (recordHold) {
      for (const note of next.notes) {
        if (note.id === `jam-user-${sound.patchId}-${note.step}` && note.step % stepsPerBar(this.doc) === contribution.step) {
          note.performance = { version: 1, offset_steps: 0, hold_id: holdId };
        }
      }
    }
    if (contribution?.added) {
      recordAct(next, "jam_note", { pad, step: contribution.step });
      this.jamStep = (contribution.step + 4) % stepsPerBar(this.doc);
      this.jamMessage = "Your note is in. It will play with the band.";
    } else {
      this.undoStack.pop();
      this.jamMessage = "Played once. Your loop has no room left.";
    }
    const sourceNoteId = contribution?.added ? `jam-user-${sound.patchId}-${contribution.step}` : `live-only-${this.holdSequence}`;
    try {
    if (holdSource && this.app.scheduler.noteOn) {
      const id = this.app.scheduler.noteOn({ ...sound, sourceNoteId, onRelease: recordHold
        ? seconds => this._finishJamHold(next.id, holdId, seconds * bpm / 15) : null });
      if (id != null) this.liveHolds.set(holdSource, id);
    } else {
      this.app.scheduler.previewSound({ ...sound, sourceNoteId, durationSec: .25 });
    }
    } catch (error) {
      this.jamMessage = `Your note stays editable, but could not sound: ${error.message}`;
    }
    // Dispatch the live attack before compilation and synchronous draft storage.
    // Retain the edit even if audio fails; only the scheduler records successful attacks.
    this._acceptJamDoc(next);
    this.app._announce(this.jamMessage);
    this.render();
    const button = this.root.querySelector(`[data-key="jam-pad:${pad}"]`);
    if (button) this._sparkAt(button);
  }

  _paintJamAnswer() {
    const scheduler=this.app.scheduler, jam=this.doc?.jam_session;
    scheduler.makeRoomForLive=this.stage==='jam'&&jam?.live_keys&&jam.responsive===true;
    scheduler.setAutomaticAnswers?.(this.stage==='jam'&&jam?.live_keys&&jam.auto_answer===true);
    const button=this.root?.querySelector('[data-key="jam-answer"]');
    if(!button)return;
    const readiness=scheduler.jamAnswerReadiness();
    button.disabled=!scheduler.isPlaying;
    button.setAttribute('aria-disabled',String(!['ready','active'].includes(readiness.state)));
    const label=readiness.label;
    if(button.textContent!==label)button.textContent=label;
    const status=this.root.querySelector('#pf-answer-status');
    const message=jam?.auto_answer===true&&readiness.state==='ready'&&!scheduler.jamAnswer
      ?'Play, then pause. The band plays your notes back.'
      :scheduler.jamAnswerStatus?.()||'Play and let go. Answer this plays your last notes back.';
    if(status&&status.textContent!==message)status.textContent=message;
  }

  _markJamPad(pad, source = null, id = null) {
    this.livePadSources ||= new Map();
    this.padFlashes ||= new Map();
    if (source && this.app.scheduler.liveNotes?.has(id)) this.livePadSources.set(source, {pad,id});
    this.padFlashes.set(pad, performance.now() + 160);
    this._paintJamPads();
  }

  _paintJamPads() {
    const scheduler=this.app.scheduler, active=new Set(), now=performance.now();
    for(const [source,entry] of this.livePadSources||[]) {
      if(scheduler.liveNotes?.has(entry.id))active.add(entry.pad);
      else this.livePadSources.delete(source);
    }
    for(const [pad,until] of this.padFlashes||[]) {
      if(until>now&&scheduler.isPlaying)active.add(pad);
      else this.padFlashes.delete(pad);
    }
    for(const button of this.root?.querySelectorAll?.('[data-key^="jam-pad:"]')||[]) {
      const down=active.has(Number(button.dataset.key.split(':')[1]));
      button.classList.toggle('pf-pad-sounding',down);
    }
  }

  _releaseLive(source) {
    if (this.pendingPad?.holdSource === source) this.pendingPad.released = true;
    const id = this.liveHolds.get(source);
    if (id === undefined) return;
    this.liveHolds.delete(source);
    this.livePadSources?.delete(source);
    this.app.scheduler?.noteOff?.(id);
    this._paintJamPads();
    if (this.answerOnRelease && !this.liveHolds.size) {
      this.answerOnRelease = false;
      const token = this._intentToken();
      clearTimeout(this.answerTimer);
      this.answerTimer = setTimeout(() => {
        if (this._intentValid(token)) { this.app.scheduler.requestJamAnswer?.(); this._paintJamAnswer?.(); }
      }, 60);
    }
  }

  _finishJamHold(docId, holdId, duration) {
    const update = doc => {
      if (doc?.id !== docId) return null;
      const matches = doc.notes.filter(note => note.performance?.hold_id === holdId);
      if (!matches.length) return null; // Undo/removal must never resurrect a note.
      for (const note of matches) note.duration_steps = duration;
      return setJamDirection(doc);
    };
    // A later press may have snapshotted this still-held note. Completing its
    // recording also completes those snapshots, without adding an undo action.
    for (const snapshot of this.undoStack) {
      const doc = update(snapshot.doc);
      if (doc) { snapshot.doc = doc; snapshot.tune = { ...snapshot.tune, ...tuneGridFromNotes(doc.notes) }; }
    }
    const doc = update(this.doc);
    if (doc) this._acceptJamDoc(doc);
  }

  _releaseAllLive() {
    // Focus loss cancels waiting work before the releases below could trigger any of it.
    this._cancelDeferredInput();
    for (const source of [...this.liveHolds.keys()]) this._releaseLive(source);
    this.app.scheduler?.cancelJamAnswer?.();
  }

  _releaseJamPointer(ev) {
    if (this.jamPointer && this.jamPointer.pointerId === ev.pointerId) this.jamPointer.upAt = performance.now();
    const pressed = this.jamPointers?.get(ev.pointerId);
    if (pressed) pressed.upAt = performance.now();
    this._releaseLive(`pointer:${ev.pointerId}`);
  }

  async _changeInstrument(id) {
    const instrument = getInstrument(id);
    if (!instrument || !this.doc) return;
    if(this.stage==='jam'&&this.doc.jam_session?.live_keys){
      const scheduler=this.app.scheduler,docId=this.doc.id,generation=scheduler.stopGeneration;
      try {if(isSampledPatch(instrument.patchId))await scheduler.preparePiano();}
      catch(error){this.app._announce(`Could not load instrument: ${error.message}`);return;}
      if(this.stage!=='jam'||this.doc.id!==docId||scheduler.stopGeneration!==generation)return;
      this._pushUndo();
      Object.assign(this.doc.jam_session,{patchId:instrument.patchId,kind:instrument.kind,kit:instrument.kitId,follow_band_sound:false});
      this.doc.selected_instrument=id;this.instrumentPickerOpen=false;
      this.render();this.app._announce('New presses use this sound. Held and recorded notes stay unchanged.');return;
    }
    if (isSampledPatch(id) && !await this._loadPiano()) return;
    this._pushUndo();
    if (!isSampledPatch(id)) this._stopForScopeChange();
    this.doc.selected_instrument = id;
    if (instrument.kind === "drums") this.doc.drum_kit = instrument.kitId;
    else {
      this.doc.lead_patch_id = instrument.patchId;
      this.doc.notes = this.doc.notes.map(note => note.role === "lead" ? { ...note, patch_id: instrument.patchId } : note);
      this.tuneGrid = retimbreTuneGrid(this.tuneGrid, instrument.patchId);
    }
    if (this.doc.jam_session && this.editingCard == null) {
      this.doc.jam_session = { ...this.doc.jam_session, kind: instrument.kind, patchId: instrument.patchId, kit: instrument.kitId || this.doc.drum_kit };
    }
    recordAct(this.doc, "instrument", { id });
    this._noteChoice("instrument", id);
    this.instrumentPickerOpen = false;
    this._compile();
    this.render();
    this.app._announce(instrument.kind === "drums"
      ? (["soft", "punchy", "tiny"].includes(id) ? "Drum kit set. Your notes stay." : "New taps use this drum. Your other hits stay.")
      : "Tune sound set. Your notes stay.");
  }

  /** Second door on the start screen: go straight to the tune with the starter pulse under it, and focus "Hum it". */
  _startFromHum() {
    if (!this._retainBeforeSwitch()) return;
    this._freshState();
    this._go("tune");
    this.app._announce("Tune. Press Hum it when you are ready.");
    this.root.querySelector('[data-key="hum"]')?.focus();
  }

  /** Read the current screen's heading and instruction aloud using a local voice on this computer. */
  _speakScreen() {
    const text = [...this.root.querySelectorAll(".pf-heading, .pf-say")]
      .map((el) => el.textContent.trim())
      .filter(Boolean)
      .join(" ");
    const ok = this.speaker.speak(text, { force: true });
    if (!ok) this.app._announce("No voice is set up here.");
  }

  _toggleComfort(key) {
    this.comfort = toggleComfort(this.comfort, key);
    // Calm and Moving lights ask for opposite things, so turning one on turns the other off.
    if (key === "lessMotion" && this.comfort.lessMotion) this.comfort.movingLights = false;
    if (key === "movingLights" && this.comfort.movingLights) this.comfort.lessMotion = false;
    saveComfort(window.localStorage, this.comfort);
    this._applyComfort();
    if (key === "speak" && this.comfort.speak) this._speakScreen();
    this.render();
  }

  _stepVoiceVolume(dir) {
    this.comfort = stepVoice(this.comfort, dir);
    saveComfort(window.localStorage, this.comfort);
    this._applyComfort();
    this.speaker.speak("Voice level.");
    this.render();
  }

  /** Step the music volume by 10% from inside the scan loop; respects the adult volume lock. */
  _stepMusicVolume(delta) {
    const slider = document.getElementById("input-volume");
    if (!slider || slider.disabled) return this.app._announce("Music is locked.");
    const next = Math.max(0, Math.min(100, Number(slider.value || 80) + delta));
    slider.value = String(next);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    this.app._announce(`Volume ${Math.round(next / 10)}.`);
    this.render();
  }

  async _onClick(ev) {
    // Disarm any 2-press confirmation when the person presses something else.
    const t = ev.target.closest("[data-key]");
    if (!t) return;
    t.focus?.({ preventScroll: true });
    const key = t.dataset.key;
    this.deleteMessage = null;
    if(!key.startsWith('circle-blend:')&&!key.startsWith('field-nudge:')&&!['circle-next','circle-previous','circle-family'].includes(key))this.cancelFieldGesture();
    if(['field-options','demo-tools','participation-options','start-options','cycle-options','circle-options'].includes(key))return;
    if(key.startsWith('circle-blend:')&&this.stage==='jam'&&this.doc.jam_session.exploration_map==='catalogue-circle-v2'){const current=(this.circleIntent?this.circleIntent.field:this.doc.jam_session.music_field)?.x??.5;const x=Math.round(Math.max(0,Math.min(1,current+(key.endsWith('more')?.025:-.025)))*1000)/1000;this._requestCircle(['ska-v1','rocksteady-v1','reggae-v1'][Math.round(x*2)],false,{version:5,x,y:.5});return;}
    if(['circle-next','circle-previous','circle-family'].includes(key)) {
      const id=this.circleIntent?.id||this.doc.jam_session.scene_id;
      this._requestCircle(key==='circle-family'?circleFamilyStep(id,1):circleStep(id,key==='circle-next'?1:-1),false);return;
    }
    if(key==='enter-circle'&&this.stage==='jam') {
      this._pushUndo();this._fitTempo();this.exploreTour=null;
      const next=setJamDirection(this.doc,{music_field:null});next.jam_session.exploration_map='catalogue-circle-v2';const field=circleFieldForScene(next.jam_session.scene_id);this._acceptJamDoc(field?setJamDirection(next,{music_field:field}):next);
      this.render();this._paintCircle();this.root.querySelector('[data-music-circle]')?.focus();return;
    }
    if(key==='field-reggae'||key==='field-four'||key==='field-connected') {
      this.cancelFieldGesture();this._pushUndo();if(key==='field-reggae'||key==='field-connected')this._fitTempo();
      const previous=this.doc.jam_session?.music_field;
      const mapped=key==='field-connected'&&previous?.version===2?{x:.4+.6*previous.x,y:previous.y}
        :key==='field-connected'&&previous?.version===3?{x:.2*(1-previous.x),y:previous.y}:{x:.5,y:.5};
      this._acceptJamDoc(setJamDirection(this.doc,{music_field:{version:key==='field-connected'?4:key==='field-reggae'?3:2,...mapped}}));
      this.render();this.root.querySelector('[data-music-field]')?.focus();return;
    }
    if(key.startsWith('field-nudge:')){
      const [,axis,direction]=key.split(':');
      if(!['x','y'].includes(axis)||!['less','more'].includes(direction))return;
      const current=this._requestedField();
      this._requestMusicField({...current,[axis]:current[axis]+(direction==='more'?.05:-.05)},false);return;
    }
    if(key==='leave-field'&&this.stage==='jam') {
      this._pushUndo();this._acceptJamDoc(setJamDirection(this.doc,{music_field:null}));this.render();
      this.root.querySelector('[data-key="play"]')?.focus();return;
    }
    if(key==='enter-field'&&this.stage==='jam') {
      this._pushUndo();this._fitTempo();this.exploreTour=null;
      this._acceptJamDoc(setJamDirection(this.doc,{music_field:{version:4,x:.5,y:.5}}));
      this.render();this._paintMusicField();this.root.querySelector('[data-music-field]')?.focus();return;
    }
    if(key.startsWith('new-cycle:') && this.stage==='start') {
      this.newCycle=key==='new-cycle:12'?12:16;return this.render();
    }
    if(key.startsWith('compare-part:') && this.stage==='song') {
      const index=Number(key.slice('compare-part:'.length));
      if(!Number.isInteger(index)||!normalizeSongCards(this.doc.song_cards)[index])return;
      this._stopForScopeChange();
      this.comparisonGeneration=(this.comparisonGeneration||0)+1;
      this.partComparison=quieterBandComparison(this._canonicalDoc(),index);
      this.render();this.root.querySelector('[data-key="compare-original"]')?.focus();return;
    }
    if(key==='compare-original'||key==='compare-alternative')return this._playComparison(key==='compare-alternative');
    if(key==='compare-stop'){this.comparisonGeneration=(this.comparisonGeneration||0)+1;this._stopForScopeChange();return;}
    if(key==='compare-keep' || key==='compare-close') {
      const comparison=this.partComparison;
      this.comparisonGeneration=(this.comparisonGeneration||0)+1;this._stopForScopeChange();
      if(key==='compare-keep' && comparison?.changed && JSON.stringify(this._canonicalDoc())===JSON.stringify(comparison.before)) {
        this._pushUndo();this.doc=comparison.after;this._compile();
        this.app._announce(`The band is softer in part ${comparison.index+1}. Use Undo to bring it back.`);
      }
      this.partComparison=null;return this.render();
    }
    if(this.partComparison && !/^(settings$|speak-screen$|comfort:|voice:)/.test(key)) {
      this.comparisonGeneration=(this.comparisonGeneration||0)+1;this._stopForScopeChange();this.partComparison=null;
    }
    if (key === 'honey-page' && this.stage === 'jam') {
      this.honeycombPage = (this.honeycombPage || 0) + 1;
      this.render();
      this.root.querySelector('[data-key="honey-page"]')?.focus();
      return;
    }
    if (key.startsWith('honey-style:') && this.stage === 'jam') {
      const index = Number(key.slice('honey-style:'.length));
      const current = Math.round(this.doc.jam_session?.style_spectrum || 0);
      if (!hasSceneCatalogue(this.doc.jam_session) || !compatibleSceneIndices(current).includes(index)) return;
      const scheduler = this.app.scheduler;
      this.honeycombPage = 0;
      this._selectJamProfile(index);
      this.root.querySelector(scheduler.isPlaying ? '[data-key="stay-style"]' : '[data-key="play"]')?.focus();
      return;
    }
    if(key==='change-style'&&this.stage==='jam') {
      const scheduler=this.app.scheduler;
      if(!scheduler.isPlaying)return;
      // Repeated requests advance from the latest requested direction. The
      // scheduler retains a single destination and commits at musical boundaries.
      const current=Math.max(0,Math.round(this.doc.jam_session.style_spectrum||0));
      const next=this._nextExplorationDirection(current);
      this._pushUndo();
      this._acceptJamDoc(setJamDirection(this.doc,{style_spectrum:next,scene_variant:'base'}));
      if(this.exploreTour)this.exploreTour.settledAt=null;
      this.app._announce('Changing style at the next musical boundary. Your notes stay.');
      this.render();this.root.querySelector('[data-key="change-style"]')?.focus();return;
    }
    if ((key==='explore-near'||key==='explore-wide') && this.stage==='jam') {
      if(!this.app.scheduler.isPlaying)return;
      if(key==='explore-near' && !Number.isFinite(this.doc.jam_session?.style_spectrum))
        return this.app._announce('Choose a connected style first. Your saved blend stays unchanged.');
      if(key==='explore-near' && !this._anchorActiveBand(key))return;
      if(key==='explore-wide' && this.doc.jam_session.anchor_backing)
        this._acceptJamDoc(setJamDirection(this.doc,{style_spectrum:this.doc.jam_session.style_spectrum}));
      this.exploreTour={mode:key==='explore-near'?'near':'wide',
        anchor:this.doc.jam_session?.style_spectrum||0,direction:1,settledAt:null};
      if(key==='explore-wide'&&this.doc.jam_session?.showcase_version===1)
        this.exploreTour.settledAt=this.app.scheduler.audioCtx.currentTime-EXPLORATION_DWELL_SECONDS;
      return this.render();
    }
    if(key.startsWith('jam-phrase:') && this.stage==='jam') {
      const variant=key.slice('jam-phrase:'.length);
      if(!SCENE_VARIANTS.some(item=>item.id===variant))return;
      if(!Number.isFinite(this.doc.jam_session?.style_spectrum))
        return this.app._announce('Choose a connected style first. Your saved blend stays unchanged.');
      this.exploreTour=null;this._pushUndo();
      this._acceptJamDoc(setJamDirection(this.doc,{scene_variant:variant}));
      this.app._announce(`${sceneDescription(variant)} selected. Your notes stay.`);
      return this.render();
    }
    if (key === 'listen-explore' || key === 'listen-field' || key === 'listen-circle') {
      if(key==='listen-circle')this.newCycle=16;
      this.explorationVisited=[];
      this.showcaseControls=false;
      if (!await this._startInstrument('sampled_piano_v1')) return;
      if(stepsPerBar(this.doc)===16)
        this._acceptJamDoc(setJamDirection(this.doc,{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:SCENE_CATALOGUE[Math.min(SCENE_CATALOGUE.length-1,Math.floor((this.explorationRandom||Math.random)()*SCENE_CATALOGUE.length))].id,scene_mix:SCENE_MIX_VERSION}));
      if(key==='listen-field'&&stepsPerBar(this.doc)===16)this._acceptJamDoc(setJamDirection(this.doc,{music_field:{version:4,x:.5,y:.5}}));
      if(key==='listen-circle')this.doc.jam_session.exploration_map='catalogue-circle-v2';
      Object.assign(this.doc.jam_session,{live_keys:true,dynamic_keys:true,follow_band_sound:true,personal_only:false,auto_answer:true});
      if(key==='listen-circle'){const field=circleFieldForScene(this.doc.jam_session.scene_id);this._acceptJamDoc(field?setJamDirection(this.doc,{music_field:field}):this.doc);}
      this.exploreTour = key!=='listen-explore'?null:{mode:'wide',direction:1, settledAt:null};
      this.app.scheduler.setRepeatPlayback(true);
      this.app.scheduler.start();
      if(this.app.scheduler.isPlaying)this.pianoMessage='';
      return this.render();
    }
    if(this.stage==='jam'&&['jam-repeat-keys','jam-live-keys','jam-dynamic-keys','jam-follow-sound','jam-keep-band','jam-keep-personal','jam-favorite'].includes(key)) {
      const jam=this.doc.jam_session;
      if(key==='jam-favorite'){
        const id=this._jamProfiles()[Math.round(jam.style_spectrum||0)]?.id;
        if(!SCENE_CATALOGUE.some(s=>s.id===id))return;
        this.styleFavorites=this.styleFavorites.includes(id)?this.styleFavorites.filter(x=>x!==id):[...this.styleFavorites,id];
        const saved=saveStyleFavorites(()=>window.localStorage,this.styleFavorites);
        this.app._announce(saved?'Style favorites updated.':'Favorite kept for this visit; browser storage is unavailable.');
      }else{
        this._pushUndo();
        if(key==='jam-live-keys')jam.live_keys=true;
        if(key==='jam-repeat-keys'){jam.repeat_keys=true;jam.live_keys=false;this.app._announce('New notes repeat with the band. Existing notes stay until you undo or edit them.');}
        if(key==='jam-dynamic-keys'){jam.dynamic_keys=!jam.dynamic_keys;}
        if(key==='jam-follow-sound'){jam.follow_band_sound=!(Boolean(jam.dynamic_keys)&&jam.follow_band_sound!==false);jam.dynamic_keys=true;}
        if(key==='jam-keep-band')jam.personal_only=false;
        if(key==='jam-keep-personal'){jam.personal_only=true;jam.live_keys=true;}
      }
      this.render();this.root.querySelector(`[data-key="${key}"]`)?.focus();return;
    }
    if(key==='showcase-controls') {this.showcaseControls=!this.showcaseControls;this.render();this.root.querySelector('[data-key="showcase-controls"]')?.focus();return;}
    const sharedChange=/^shared-(drums|chords):(less|more)$/.exec(key);
    if(this.stage==='jam'&&hasSceneCatalogue(this.doc.jam_session)&&(sharedChange||['shared-reset','shared-from-kept','shared-banjo'].includes(key))) {
      const jam=this.doc.jam_session;
      if(jam.anchor_backing&&key!=='shared-from-kept')return;
      let changes={};
      if(sharedChange) {
        const [,part,direction]=sharedChange,value=jam.style_traits?.[part]??2;
        changes[`style_${part}`]=Math.max(0,Math.min(4,value+(direction==='more'?1:-1)));
      } else if(key==='shared-reset')changes={style_drums:2,style_chords:2,band_chord_patch:null};
      else if(key==='shared-from-kept') {
        if(!jam.anchor_backing)return;
        changes={style_drums:jam.anchor_traits?.drums??2,style_chords:jam.anchor_traits?.chords??2};
      } else {
        if(!CHORD_VOICE_SCENES.includes(jam.scene_id))return;
        if(!this.app.scheduler.masterBus?.piano) {
          const targetDoc=this.doc;
          try {await this.app.scheduler.preparePiano();}catch(error){this.app._announce(error.message);return;}
          if(this.doc!==targetDoc||this.stage!=='jam')return;
        }
        changes={band_chord_patch:jam.band_chord_patch?null:'sampled_banjo_v1'};
      }
      const next=setJamDirection(this.doc,changes),changed=JSON.stringify(next.notes)!==JSON.stringify(this.doc.notes);
      this._pushUndo();this._acceptJamDoc(next);this.render();
      const button=this.root.querySelector(`[data-key="${key}"]`);
      (button&&!button.disabled?button:this.root.querySelector('[data-key="shared-reset"]'))?.focus();
      this.app._announce(key==='shared-from-kept'?'Levels saved for other styles. This kept band is unchanged.':changed?'Shared settings updated. Changes join at a musical boundary.':'Settings saved. No note change in this band.');return;
    }
    const keptChange=/^kept-(drums|chords):(less|more)$/.exec(key);
    if(keptChange&&this.stage==='jam'&&this.doc.jam_session?.anchor_backing) {
      const [,part,direction]=keptChange,value=this.doc.jam_session.anchor_traits?.[part]??2;
      const next=setJamDirection(this.doc,{[`anchor_${part}`]:Math.max(0,Math.min(4,value+(direction==='more'?1:-1)))});
      this.keptBandNoChange=JSON.stringify(next.notes)===JSON.stringify(this.doc.notes)?'No note change at this limit.':null;
      this.exploreTour=null;this._pushUndo();
      this._acceptJamDoc(next);
      this.render();
      const button=this.root.querySelector(`[data-key="${key}"]`);
      (button&&!button.disabled?button:this.root.querySelector(`[data-key="kept-${part}:${direction==='more'?'less':'more'}"]`))?.focus();
      this.app._announce(this._keptBandStatus());return;
    }
    if (key === 'stay-style' && this.stage === 'jam') {
      if (this.exploreTour) {
        this.exploreTour = null;
        const s = this.app.scheduler;
        const pending = s.pendingJamBacking != null || s.jamBridgeStage != null
          || s.lastJamBackingCommit?.audioTime > s.audioCtx.currentTime;
        this.app._announce(pending
          ? 'Finishing this change, then staying with that style. The tune keeps developing.'
          : 'Staying with this style. The tune keeps developing.');
      } else {
        if (this.doc.jam_session.anchor_backing) {
          this._pushUndo();
          this._acceptJamDoc(setJamDirection(this.doc, {style_spectrum:this.doc.jam_session.style_spectrum||0}));
        }
        this.exploreTour = {mode:'wide',direction:1,settledAt:null};
        this.app._announce('Exploring connected styles.');
      }
      return this.render();
    }
    if (key === 'freeze-phrase' && this.stage === 'jam') {
      if (this._anchorActiveBand('freeze-phrase')) {
        this.exploreTour = null;
        this.app._announce('This phrase is frozen. Explore lets the band develop again.');
        this.render();
      }
      return;
    }
    if (key === 'explore-tour' && this.stage === 'jam') {
      if (this.exploreTour) {if(!this._anchorActiveBand('explore-tour'))return;this.exploreTour = null;}
      else {
        this.exploreTour = {mode:'wide',direction:1, settledAt:null};
        if (!this.app.scheduler.isPlaying) {
          this.app._announce('Exploration ready. Press Play to start.');
        }
      }
      return this.render();
    }
    const steerWhileWandering=this.doc?.jam_session?.showcase_version===1&&(/^(jam-density:|jam-color:|jam-responsive$)/.test(key)||(key==='change-sound'&&this.doc.jam_session.live_keys));
    if (!steerWhileWandering&&/^(jam-profile:|jam-style:|jam-density:|jam-color:|jam-responsive$|undo$|capture-direction$|change-sound$)/.test(key)) this.exploreTour = null;
    if (this.pianoLoading) {
      this.pianoLoadGeneration = (this.pianoLoadGeneration || 0) + 1;
      this.pianoLoading = false;
      this.pianoMessage = 'Sound loading cancelled. Your notes are preserved.';
      this.app.scheduler.stop();
      this.app._announce(this.pianoMessage);
    }
    if(key.startsWith("event-pick:")){this.eventTuneId=decodeURIComponent(key.slice(11));return this.render();}
    if (key.startsWith("event-select:")) { this.eventTuneId=decodeURIComponent(key.slice(13)); return this.render(); }
    if (key.startsWith("event-bar:")) { this.eventTuneBar=Number(key.slice(10)); return this.render(); }
    if (key === "event-add") return this._editEvent("add");
    if (key.startsWith("event-edit:")) return this._editEvent(key.slice(11));
    if (this.tuneGrid?.eventEditor && /^(note:|shape:|deja:|deco:|version:)/.test(key)) {
      return this.app._announce("Edit these notes one at a time.");
    }
    // Keyboard/assistive activation has detail 0 and must never be swallowed
    // by a concurrent or cancelled pointer press. Track touches independently.
    if (key.startsWith("jam-pad:") && ev.detail !== 0) {
      const pressed = this.jamPointers?.get(ev.pointerId) || (ev.pointerId === undefined ? this.jamPointer : null);
      this.jamPointers?.delete(ev.pointerId);
      if (pressed === this.jamPointer) this.jamPointer = null;
      if (pressed && (pressed.upAt === null || performance.now() - pressed.upAt < 400)) return; // already sounded on press
    }
    if (this.confirm.armed && this.confirm.armed !== key) {
      this.confirm.armed = null;
    }

    try { await this.app.scheduler.unlock(); }
    catch (error) { this.app._announce(error.message); return; }

    if (key.startsWith("instrument-group:")) {
      const group = key.slice("instrument-group:".length);
      if (!INSTRUMENT_GROUPS.some(item => item.id === group)) return;
      this.instrumentGroup = group;
      this.instrumentPage = 0;
      return this.render();
    }
    if (key.startsWith("instrument-page:")) {
      const page = instrumentPage(this.instrumentGroup || "keys", this.instrumentPage || 0);
      this.instrumentPage = Math.max(0, Math.min(page.pages - 1, page.page + (key.endsWith("next") ? 1 : -1)));
      return this.render();
    }
    if (key.startsWith("preview-instrument:")) {
      const instrument = getInstrument(key.slice("preview-instrument:".length));
      if (isSampledPatch(instrument?.id) && !await this._loadPiano()) return;
      if (instrument) this.app.scheduler.previewSound({ patchId: instrument.patchId, role: instrument.kind === "drums" ? "drums" : "lead", kit: instrument.kitId, midi: instrument.previewMidi, durationSec: instrument.previewDuration });
      return;
    }
    if (key.startsWith("start-instrument:")) return this._startInstrument(key.slice("start-instrument:".length));
    if (key === 'load-piano') return this._loadPiano();
    if (key.startsWith("change-instrument:")) return this._changeInstrument(key.slice("change-instrument:".length));
    if (key === "change-sound") {
      this.instrumentPickerOpen = !this.instrumentPickerOpen;
      return this.render();
    }
    if (key === "continue-performance" && this.pendingPerformance) {
      let song = JSON.parse(JSON.stringify(this.pendingPerformance));
      // The legacy readers intentionally return an empty result on storage
      // errors. Establish access first so denial cannot look like no draft.
      try {
        const probe = `musiclab.import-check.${song.id}`;
        const storage = window.localStorage;
        storage.getItem(probe);
        storage.setItem(probe, "1");
        storage.removeItem(probe);
      } catch (_) {
        this.pendingImportMessage = "We cannot save here. Your jam will wait here. You can still keep a file from the jam screen.";
        this.app._announce(this.pendingImportMessage);
        this.render();
        return;
      }
      if (!this._retainBeforeSwitch()) return;
      const previous = loadWorkingSong(window.localStorage, song.id);
      // A retained recovery copy can be older than a subsequently edited draft.
      // Resume that draft rather than replaying the incoming snapshot over it.
      const resuming = previous?.id === song.id;
      if (resuming) song = previous;
      const savedStage = ["beat", "tune", "under", "song", "keep"].includes(song.last_stage) ? song.last_stage : this._capturedDevelopmentStage(song);
      if (!this._loadDocIntoFlow(song, { stage: resuming ? savedStage : this._capturedDevelopmentStage(song) })) return;
      // Large writes can still fail after a tiny probe succeeds. Keep the
      // incoming session copy unless the complete working song was retained.
      if (stashWorkingSong(window.localStorage, this._canonicalDoc())
        && JSON.stringify(loadWorkingSong(window.localStorage)) === JSON.stringify(this._canonicalDoc())) {
        this.pendingPerformance = null;
        try { window.sessionStorage.removeItem("musiclab.pending-performance.v1"); } catch (_) {}
      }
      return;
    }
    if (key.startsWith("jam-pad:")) return this._playJamPad(Number(key.slice("jam-pad:".length)));
    if (key === 'jam-auto-answer' && this.stage === 'jam' && this.doc.jam_session?.live_keys) {
      this._pushUndo();
      this.doc.jam_session.auto_answer = this.doc.jam_session.auto_answer !== true;
      this.app.scheduler.setAutomaticAnswers(this.doc.jam_session.auto_answer);
      this._stashDraft(this._canonicalDoc());
      this.render();this.root.querySelector('[data-key="jam-auto-answer"]')?.focus();
      return this.app._announce(this.doc.jam_session.auto_answer
        ? 'Band answers on. Play, release, then pause for a beat.' : 'Automatic answers off. Your notes stay.');
    }
    if (key === 'jam-answer' && this.stage==='jam' && this.doc.jam_session?.live_keys) {
      const scheduler=this.app.scheduler,plan=scheduler.jamAnswer;
      // An answer asked for too early is kept, not refused.
      if(!scheduler.isPlaying){await this._keepMusicGoing();return this.app._announce('The band is playing. Play a few notes, and it answers when you pause.');}
      if(scheduler.liveNotes?.size){this.answerOnRelease=true;return this.app._announce('The band answers when you let go.');}
      if(plan&&!plan.cancelled&&scheduler.audioCtx.currentTime<plan.end)scheduler.cancelJamAnswer();
      else scheduler.requestJamAnswer();
      this._paintJamAnswer();
      return this.app._announce(scheduler.jamAnswerStatus());
    }
    if (key === "jam-responsive") {
      this._pushUndo();
      this._acceptJamDoc(setJamDirection(this.doc, { responsive: this.doc.jam_session?.responsive !== true }));
      this.jamMessage = this.doc.jam_session.responsive ? "Band responses on. Your notes stay." : "Steady backing. Your notes stay.";
      this.render();
      return this.app._announce(this.jamMessage);
    }
    if (key.startsWith('jam-profile:') && this.stage === 'jam') {
      return this._selectJamProfile(Number(key.slice('jam-profile:'.length)));
    }
    if (key.startsWith("jam-style:") && this.stage === "jam") {
      this._pushUndo();
      const spectrum=Number.isFinite(this.doc.jam_session.style_spectrum);
      const field=spectrum?'style_spectrum':'style_blend';
      const increment=hasSceneCatalogue(this.doc.jam_session)?1:.25;
      const value = Math.max(0, Math.min(spectrum?this._jamProfiles().length-1:1, (this.doc.jam_session[field] ?? 0) + (key.endsWith('more') ? increment : -increment)));
      this._acceptJamDoc(setJamDirection(this.doc, { [field]: value }));
      this.render();
      return this.app._announce("Band feel set. Your notes stay.");
    }
    if (key.startsWith("jam-density:") || key.startsWith("jam-color:")) {
      const property = key.startsWith("jam-density:") ? "density" : "color";
      const value = Math.max(0, Math.min(4, (this.doc.jam_session?.[property] ?? 1) + (key.endsWith("more") ? 1 : -1)));
      this._pushUndo();
      const next = setJamDirection(this.doc, { [property]: value });
      recordAct(next, "jam_direction", { [property]: value });
      this.doc = next;
      this._noteChoice("jam_direction", `${property}:${value}`);
      this._acceptJamDoc(next);
      this.jamMessage = jamDirectionDescription(this.doc);
      this.render();
      return this.app._announce(this.jamMessage);
    }
    if (key === "jam-edit") {
      this._stopForScopeChange();
      return this._go(this.doc.jam_session?.kind === "drums" ? "beat" : "tune");
    }
    if (key === "jam-open" && this.doc.jam_session) {
      this._stopForScopeChange();
      return this._go("jam");
    }
    if (key === "restore-capture-source" && this.doc.capture_source) {
      this._pushUndo();
      this._stopForScopeChange();
      this.editingCard = null;
      this.sharedMaterial = null;
      this._acceptJamDoc(JSON.parse(JSON.stringify(this.doc.capture_source)));
      this._go("song");
      return this.app._announce("Your loop is back. Undo brings this take back.");
    }
    if (key === "restore-jam" && this.doc.jam_start) {
      this._pushUndo();
      this._stopForScopeChange();
      const original = JSON.parse(JSON.stringify(this.doc.jam_start));
      this.doc = applySongMaterial(this.doc, original.material);
      this.doc.global_context = original.global_context;
      this.doc.song_cards = normalizeSongCards(original.song_cards);
      this.doc.jam_session = original.jam_session;
      this.beatGrid = beatGridFromNotes(this.doc.notes,stepsPerBar(this.doc));
      this.tuneGrid = this.doc.tune_grid_state || tuneGridFromNotes(this.doc.notes);
      this._compile();
      this.render();
      return this.app._announce("First jam is back. Undo brings your song back.");
    }

    if (key.startsWith("preview-drum:")) {
      const kitId = key.slice("preview-drum:".length);
      const kit = KITS.find((item) => item.id === kitId);
      if (kit) this.app.scheduler.previewSound({ patchId: kit.patch, role: "drums", kit: kit.id });
      return;
    }
    if (key.startsWith("preview-pitched:")) {
      const patchId = key.slice("preview-pitched:".length);
      if (START_PITCHED.some((item) => item.id === patchId)) {
        this.app.scheduler.previewSound({ patchId, role: "lead", midi: 60, durationSec: 0.55 });
      }
      return;
    }
    if (key.startsWith("start-drum:")) return this._startWithInstrument("drums", key.slice("start-drum:".length));
    if (key.startsWith("start-pitched:")) return this._startWithInstrument("pitched", key.slice("start-pitched:".length));
    if (key === "hum-door") return this._startFromHum();
    if (key === "resume-working") return this._resumeWorking();
    if (key.startsWith('resume-working:')) return this._resumeWorking(key.slice('resume-working:'.length));
    if (key === 'more-drafts') { this.draftPage = (this.draftPage || 0) + 1; return this.render(); }
    if (key === "open-project") {
      this.root.querySelector("#pf-import-file")?.click();
      return;
    }
    if (key === "dl-project") return this._downloadProject();
    if (key === "settings") {
      this.comfortOpen = !this.comfortOpen;
      return this.render();
    }
    if (key === "speak-screen") return this._speakScreen();
    if (key.startsWith("comfort:")) return this._toggleComfort(key.slice("comfort:".length));
    if (key === "voice:down") return this._stepVoiceVolume(-1);
    if (key === "voice:up") return this._stepVoiceVolume(1);
    if (key === "music:down") return this._stepMusicVolume(-10);
    if (key === "music:up") return this._stepMusicVolume(10);
    if (key === "more-saves") {
      this.savePage += 1;
      return this.render();
    }
    if (key === "more-swaps") {
      this.swapPage += 1;
      return this.render();
    }
    if (key === "back") {
      return this._back();
    }
    if (key.startsWith("edit-card:")) return this._editPart(Number(key.slice("edit-card:".length)));
    if (key.startsWith("edit-scope:")) return this._go(key.slice("edit-scope:".length));
    if (key === "edit-shared") {
      this._finishPartEdit();
      this._go("tune");
      return this.app._announce("Edit the shared tune. Linked parts follow these notes.");
    }
    if (key === "to-tune") {
      return this._go("tune");
    }
    if (key === "to-under") {
      return this._go("under");
    }
    if (key.startsWith("journey:")) return this._journey(key.slice("journey:".length));
    if (key === "to-song") {
      return this._go("song");
    }
    if (key === "capture-direction") return this._captureDirection();
    if (key === "keep") {
      return this._go("keep");
    }
    if (key === "undo") return this._undo();
    if (key === "toggle-all-view") {
      if (this.editingCard != null) { this._finishPartEdit(); this.allAtOnce = false; }
      this.allAtOnce = !this.allAtOnce;
      // Mutes and Focus belong to the "All at once" deck: leaving it brings every layer back at full level.
      if (!this.allAtOnce) {
        this.app.scheduler?.clearMuteLayers();
        this.app.scheduler?.setSpotlightRole(null);
      }
      return this.render();
    }
    if (key === "play") {
      const resumeTour = this.exploreTour;
      const resumeSong = this.doc.id;
      const resumeStage = this.stage;
      if (!this.app.scheduler.isPlaying && (isSampledPatch(this.doc.lead_patch_id) || this.app.compiledSong.events?.some(e => isSampledPatch(e.patch_id)))
        && (!this.app.scheduler.masterBus?.piano || this.app.scheduler.masterBus.disposed)) {
        const loadGeneration = (this.pianoLoadGeneration || 0) + 1;
        const ready = await this._loadPiano();
        if (this.stage !== resumeStage || this.doc.id !== resumeSong
          || this.pianoLoadGeneration !== loadGeneration) return;
        this.exploreTour = resumeTour;
        if (!ready) return;
      }
      if (this.exploreTour) this.exploreTour.settledAt = null;
      const range = songCardRanges(this.doc.song_cards,4*stepsPerBar(this.doc),this.doc.global_context.bpm,stepsPerBar(this.doc))[this.editingCard];
      this.app.scheduler.setLoopRange(range?.start_step ?? 0, range?.end_step ?? null);
      this.app.scheduler.setRepeatPlayback(!["song", "keep"].includes(this.stage));
      document.getElementById("btn-play")?.click();
      if (this.app.scheduler.isPlaying) this.pianoMessage = '';
      return this.render();
    }
    if (key.startsWith("play-card:")) {
      if (this.app.compiledSong.events?.some(e => isSampledPatch(e.patch_id))
        && (!this.app.scheduler.masterBus?.piano || this.app.scheduler.masterBus.disposed) && !await this._loadPiano()) return;
      const idx = Number(key.slice("play-card:".length));
      const range = songCardRanges(this.doc.song_cards,4*stepsPerBar(this.doc),this.doc.global_context.bpm,stepsPerBar(this.doc))[idx];
      if (!range) return;
      this.activeSongCard = idx;
      this.app.scheduler.setLoopRange(range.start_step, range.end_step);
      this.app.scheduler.setRepeatPlayback(true);
      if (!this.app.scheduler.isPlaying) document.getElementById("btn-play")?.click();
      else this.app.scheduler.seekToStep(range.start_step);
      return this.render();
    }
    if (key.startsWith("card-bars:")) {
      const [, indexText, barsText] = key.split(":");
      const index = Number(indexText), bars = Number(barsText);
      if (!Number.isInteger(index) || !this.doc.song_cards[index] || !Number.isInteger(bars) || bars < 1 || bars > 4) return;
      this._pushUndo();
      this._stopForScopeChange();
      this.doc.song_cards = setSongCardBars(this.doc.song_cards, index, bars);
      this.activeSongCard = index;
      recordAct(this.doc, "song_length", { card: index, bars });
      this._noteChoice("song_length", `${index}:${bars}`);
      this._compile();
      this.app._announce(`Part ${index + 1}: ${bars} bars. Later notes stay safe.`);
      return this.render();
    }
    if (key === "add-card") {
      this._pushUndo();
      this.doc.song_cards = addSongCard(this.doc.song_cards);
      this.activeSongCard = this.doc.song_cards.length - 1;
      recordAct(this.doc, "song_card", { action: "add", count: this.doc.song_cards.length });
      this._noteChoice("song_cards", `cards:${this.doc.song_cards.length}`);
      this._compile();
      return this.render();
    }
    if (key === "reveal-song") {
      this._pushUndo();
      this.doc.song_cards = revealSongArc();
      this.activeSongCard = 1;
      recordReveal(this.doc, "reveal_song");
      this._compile();
      this.app._announce("Built three song parts.");
      return this.render();
    }
    if (key === "drop-card") {
      this._pushUndo();
      this.doc.song_cards = removeSongCard(this.doc.song_cards);
      this.activeSongCard = Math.min(this.activeSongCard || 0, this.doc.song_cards.length - 1);
      recordAct(this.doc, "song_card", { action: "drop", count: this.doc.song_cards.length });
      this._compile();
      return this.render();
    }
    if (key.startsWith("remove-card:")) {
      const idx = Number(key.slice("remove-card:".length));
      this._pushUndo();
      this.doc.song_cards = removeSongCard(this.doc.song_cards, idx);
      this.activeSongCard = Math.min(idx, this.doc.song_cards.length - 1);
      recordAct(this.doc, "song_card", { action: "remove", card: idx, count: this.doc.song_cards.length });
      this._compile();
      this.app._announce(`Removed part ${idx + 1}. Undo can bring it back.`);
      return this.render();
    }
    if (key.startsWith("move-card:")) {
      const [, rawIdx, direction] = key.split(":");
      const idx = Number(rawIdx);
      const target = direction === "earlier" ? idx - 1 : idx + 1;
      this._pushUndo();
      this.doc.song_cards = moveSongCard(this.doc.song_cards, idx, target);
      this.activeSongCard = Math.max(0, Math.min(this.doc.song_cards.length - 1, target));
      recordAct(this.doc, "song_card", { action: "move", from: idx, to: target });
      this._compile();
      this.app._announce(`Moved part ${idx + 1} ${direction}.`);
      return this.render();
    }
    if (key.startsWith("card-layer:")) {
      const [, cIdx, layerId] = key.split(":");
      this._pushUndo();
      this.activeSongCard = Number(cIdx);
      this.doc.song_cards = toggleCardLayer(this.doc.song_cards, Number(cIdx), layerId);
      recordAct(this.doc, "song_layer", { card: Number(cIdx), layer: layerId });
      this._noteChoice("song_layer", `${cIdx}:${layerId}`);
      this._compile();
      return this.render();
    }
    if (key.startsWith("card-big:")) {
      const cIdx = Number(key.slice("card-big:".length));
      this._pushUndo();
      this.activeSongCard = cIdx;
      this.doc.song_cards = toggleCardBig(this.doc.song_cards, cIdx);
      recordAct(this.doc, "song_big", { card: cIdx });
      this._noteChoice("song_big", `big:${cIdx}`);
      this._compile();
      return this.render();
    }
    if (key.startsWith("card-variation:")) {
      const idx = Number(key.slice("card-variation:".length));
      this._pushUndo();
      this.activeSongCard = idx;
      this.doc.song_cards = toggleCardTuneVariation(this.doc.song_cards, idx);
      recordAct(this.doc, "song_variation", { card: idx, kind: this.doc.song_cards[idx]?.tune_variant || "linked" });
      this._compile();
      this.app._announce(this.doc.song_cards[idx]?.tune_variant ? `Part ${idx + 1} tune is lifted.` : `Part ${idx + 1} has the same tune.`);
      return this.render();
    }
    if (key.startsWith("pad-octave:")) return this._shiftPadOctave(Number(key.slice("pad-octave:".length)));
    if (key === "legend-open") { this.legendOpen = !this.legendOpen; if (this.legendOpen) this.app._announce(this._legendElements().map(e => e.says).join(" ")); return this.render(); }
    if (key.startsWith("visual-mode:")) { this._setVisualMode(key.slice("visual-mode:".length)); return this.render(); }
    if (key === "adjust-open") { if (this.adjustOpen) return this._closeAdjust(); this.adjustShuffle = (this.adjustShuffle || 0); this._openAdjust(); return this.render(); }
    if (key === "adjust-shuffle") { this._cancelCardPreview(); this.adjustShuffle = (this.adjustShuffle || 0) + 1; this._openAdjust(); return this.render(); }
    if (key === "adjust-keep-as-is") return this._closeAdjust();
    if (key.startsWith("adjust-card:")) return this._tapCard(key.slice("adjust-card:".length));
    if (key.startsWith("part-mood:")) {
      const [, cIdx, mood] = key.split(":");
      const idx = Number(cIdx);
      if (!this.doc.song_cards?.[idx]) return;
      this._pushUndo();
      this.activeSongCard = idx;
      this.doc.song_cards = setPartMood(this.doc.song_cards, idx, mood);
      recordAct(this.doc, "part_mood", { card: idx, mood });
      this._compile();
      this.app._announce(`Part ${idx + 1} is ${mood === "same" ? "the same" : mood}.`);
      return this.render();
    }
    if (key.startsWith("ending-style:")) {
      const styleId = key.slice("ending-style:".length);
      this._pushUndo();
      this.activeSongCard = this.doc.song_cards.length - 1;
      this.doc.song_cards = setEndingStyle(this.doc.song_cards, styleId);
      recordAct(this.doc, "ending_style", { style: styleId });
      this._compile();
      this.app._announce(`The song ends with a ${ENDING_STYLES.find(s => s.id === styleId)?.label.toLowerCase() || "new end"}.`);
      return this.render();
    }
    if (key.startsWith("card-fx:")) {
      const [, cIdx, fxId] = key.split(":");
      this._pushUndo();
      this.activeSongCard = Number(cIdx);
      this.doc.song_cards = toggleCardFx(this.doc.song_cards, Number(cIdx), fxId);
      recordAct(this.doc, "song_fx", { card: Number(cIdx), fx: fxId });
      this._noteChoice("song_fx", `${cIdx}:${fxId}`);
      this._compile();
      return this.render();
    }
    if (key.startsWith("spot:")) {
      const layerId = key.slice("spot:".length);
      const cur = this.app.scheduler?.spotlightRole || null;
      this.app.scheduler?.setSpotlightRole(cur === layerId ? null : layerId);
      return this.render();
    }
    if (key.startsWith("jam-mute:")) {
      const layerId = key.slice("jam-mute:".length);
      this.app.scheduler?.toggleMuteLayer(layerId);
      return this.render();
    }
    if (key === "slower" || key === "faster") {
      this._pushUndo();
      const cur = Number(this.doc.global_context.bpm || 100);
      const ceiling = musicFieldTempoAllowed(this.doc,400) ? 400 : 160;
      const next = Math.max(20, Math.min(ceiling, cur + (key === "faster" ? 5 : -5)));
      this.doc.global_context.bpm = next;
      this.tapBpm = null;
      recordAct(this.doc, "tempo", { bpm: next });
      this._compile();
      return this.render();
    }
    if (key === "tap") {
      const r = nextTap(this.taps, performance.now());
      this.taps = r.taps;
      this.tapBpm = r.bpm;
      this.app.scheduler.previewSound({ patchId: "clap", role: "drums", kit: this.doc.drum_kit });
      if (r.bpm) this.app._announce(`Speed ${r.bpm}. Press Use ${r.bpm} to set it.`);
      return this.render();
    }
    if (key.startsWith("use-speed:")) {
      let bpm = Number(key.split(":")[1]);
      if (!musicFieldTempoAllowed(this.doc, bpm)) { bpm = ROOTS_FIELD_MAX_BPM; this.app._announce("Top speed for this style."); }
      this._pushUndo();
      this.doc.global_context.bpm = bpm;
      this.tapBpm = null;
      this.taps = [];
      recordAct(this.doc, "tempo", { bpm, by: "tap" });
      this._compile();
      this.app._announce(`Speed set to ${bpm}.`);
      return this.render();
    }
    if (key.startsWith("band:")) {
      const bandId = key.slice("band:".length);
      const b = BANDS.find((x) => x.id === bandId);
      if (!b) return;
      this._pushUndo();
      this.doc.band_id = b.id;
      this.doc.drum_kit = b.kit;
      this.doc.lead_patch_id = b.lead;
      if (this.doc.jam_session && this.editingCard == null) {
        this.doc.jam_session.kit = b.kit;
        if (this.doc.jam_session.kind === "pitched") {
          this.doc.jam_session.patchId = b.lead;
          this.doc.selected_instrument = b.lead;
        }
      }
      this.doc.notes = this.doc.notes.map(note => note.role === "lead" ? { ...note, patch_id: b.lead } : note);
      this.tuneGrid = retimbreTuneGrid(this.tuneGrid, b.lead);
      const f = FEELS.find((x) => x.id === b.feel);
      if (f) {
        const opts = chordOptions(this.doc);
        this.doc = applyUnderneath(
          this.doc,
          { feel: f.id, chords: f.chords, bass: f.bass, harmonyStyle: "hold", pinnedBars: [] },
          opts
        );
      }
      recordAct(this.doc, "band", { band: b.id });
      this._noteChoice("band", b.id);
      this._compile();
      return this.render();
    }
    if (key.startsWith("kit:")) {
      const kitId = key.slice(4);
      const k = KITS.find((x) => x.id === kitId);
      if (!k) return;
      this._pushUndo();
      this.doc.drum_kit = k.id;
      if (this.doc.jam_session && this.editingCard == null) this.doc.jam_session.kit = k.id;
      recordAct(this.doc, "kit", { kit: k.id });
      this._noteChoice("kit", k.id);
      this._compile();
      return this.render();
    }
    if (key === "roll-beat") {
      this._pushUndo();
      const rolled = rollGrooveDice(this.beatGrid, { seed: this.diceSeed++, stepsPerBar:stepsPerBar(this.doc) });
      this.beatGrid = rolled.grid;
      this.doc.notes = notesFromBeatGrid(this.beatGrid, this.doc.notes, { stepsPerBar:stepsPerBar(this.doc), bar4Fill: Boolean(this.doc.beat_fill), protectOwn: true });
      recordReveal(this.doc, "roll_beat", { crate: rolled.crateId });
      this._compile();
      this.app._announce("New beat rolled. Your pads stay locked.");
      return this.render();
    }
    if (key === "beat-fill") {
      this._pushUndo();
      this.doc.beat_fill = !this.doc.beat_fill;
      this.doc.notes = notesFromBeatGrid(this.beatGrid, this.doc.notes, { stepsPerBar:stepsPerBar(this.doc), bar4Fill: Boolean(this.doc.beat_fill) });
      recordAct(this.doc, "beat_fill", { on: this.doc.beat_fill });
      this._noteChoice("beat_fill", this.doc.beat_fill ? "bar4" : null);
      this._compile();
      return this.render();
    }
    if (key === "clear-beat") {
      if (!confirmPress(this.confirm, "clear-beat")) {
        this.app._announce("Press again to clear.");
        return this.render();
      }
      this._pushUndo();
      this.beatGrid = emptyBeatGrid();
      this.doc.beat_fill = false;
      this.doc.notes = this.doc.notes.filter(note => note.role !== "drums");
      recordAct(this.doc, "clear_beat");
      this._compile();
      this.app._announce("Beat cleared. Press Undo to bring it back.");
      return this.render();
    }
    if (key === "tab:main" || key === "tab:ending") {
      this.tuneTab = key === "tab:ending" || this._partBars() === 1 ? "ending" : "main";
      this.suggester = createSuggester();
      return this.render();
    }
    if (key === "page") {
      this.tunePage += 1;
      return this.render();
    }
    if (key.startsWith("shape:")) return this._shape(key.slice("shape:".length));
    if (key.startsWith("version:")) {
      const ver = key.slice("version:".length);
      this._pushUndo();
      this.tuneGrid = switchEndingVersion(this.tuneGrid, ver);
      this._writeTuneNotes(undefined, true);
      this.tuneFeedback = ver === "original" ? "Your first ending is back." : "New ending is set.";
      recordAct(this.doc, "ending_version", { version: ver });
      this._compile();
      this.app._announce(this.tuneFeedback);
      return this.render();
    }
    if (key === "save-phrase") {
      const res = savePhraseToShelf(window.localStorage, this.doc);
      this.app._announce(res.ok ? `Saved "${res.entry.title}" to your shelf.` : "Tap a box to save a tune.");
      return this.render();
    }
    if (key.startsWith("use-phrase:")) {
      const pid = key.slice("use-phrase:".length);
      const hit = listPhraseShelf(window.localStorage).find((p) => p.id === pid);
      if (!hit) return;
      this._pushUndo();
      this.doc = applyPhraseFromShelf(this.doc, hit);
      this.tuneGrid = tuneGridFromNotes(this.doc.notes, this._partBars());
      recordAct(this.doc, "use_phrase", { id: pid });
      this._noteChoice("phrase_shelf", pid);
      this._compile();
      return this.render();
    }
    if (key.startsWith("deja:")) {
      const mode = key.slice("deja:".length);
      if (!this.tuneGrid.main.some(Boolean) && !this.tuneGrid.ending.some(Boolean)) {
        return this.app._announce("Tap a box to add a note.");
      }
      this._pushUndo();
      this.tuneGrid = applyDejaVu(this.tuneGrid, mode, this.diceSeed++, this.tuneTab);
      this.tuneGrid.lastDejaVu = mode;
      this._writeTuneNotes();
      recordReveal(this.doc, "deja_vu", { mode });
      this._compile();
      return this.render();
    }
    if (key.startsWith("deco:")) {
      const deco = key.slice("deco:".length);
      this._pushUndo();
      this.tuneGrid = decorateTuneNote(this.tuneGrid, deco, this.tuneTab);
      this._writeTuneNotes();
      recordAct(this.doc, "note_style", { style: deco });
      this._noteChoice("note_style", activeDecorator(this.tuneGrid, this.tuneTab));
      this._compile();
      return this.render();
    }
    if (key.startsWith("dial:")) {
      this.doc.note_dial = key.slice(5);
      return this.render();
    }
    if (key.startsWith("sound:")) {
      return this._changeInstrument(key.slice("sound:".length));
    }
    if (key === "toggle-details") {
      this.detailsOpen = !this.detailsOpen;
      return this.render();
    }
    if (key === "toggle-about") {
      this.aboutOpen = !this.aboutOpen;
      return this.render();
    }
    if (key === "headphones") {
      this.app.humWithHeadphones = Boolean(t.checked);
      return;
    }
    if (key === "hum") return this._hum();
    if (key === "hum-hear") return this._hearHum();
    if (key === "hum-add") return this._applyHum("add");
    if (key === "hum-replace") return this._applyHum("replace");
    if (key === "restore-before-hum") return this._restoreBeforeHum();
    if (key.startsWith("feel:")) return this._pickFeel(key.slice(5));
    if (key.startsWith("chords:")) return this._swapUnder({ chords: Number(key.slice(7)) });
    if (key.startsWith("bass:")) return this._swapUnder({ bass: key.slice(5) });
    if (key.startsWith("pin-bar:")) {
      const barIdx = Number(key.slice("pin-bar:".length));
      this._pushUndo();
      this.doc = toggleBarPin(this.doc, barIdx);
      recordAct(this.doc, "pin_bar", { bar: barIdx });
      return this.render();
    }
    if (key.startsWith("hstyle:")) return this._swapUnder({ harmonyStyle: key.slice("hstyle:".length) });
    if (key.startsWith("breed:")) {
      const branch = key.slice("breed:".length);
      this._pushUndo();
      this.doc.sound_seed = applySoundBranch(this.doc.sound_seed || defaultSoundSeed(), branch);
      recordReveal(this.doc, "sound_breed", { branch });
      this._compile();
      return this.render();
    }
    if (key.startsWith("name:")) {
      this.doc.title = key.slice(5);
      return this.render();
    }
    if (key === "save") return this._save();
    if (key.startsWith("replace:")) return this._replace(key.slice("replace:".length));
    if (key.startsWith("delete:")) return this._delete(key.slice("delete:".length));
    if (key === "download") return this._download();
    if (key === "dl-sheet") return this._downloadSheet();
    if (key === "sheet-toggle") { this.sheetOpen = !this.sheetOpen; this.sheetStep = undefined; return; }
    if (key.startsWith("dl-stem:")) return this._downloadStem(key.slice("dl-stem:".length));
    if (key.startsWith("continue:")) return this._continue(key.slice("continue:".length));

    // Keyboard Enter on a pad (pointerdown didn't fire).
    if (key.startsWith("pad:") && ev.detail === 0) {
      const [, lane, s] = key.split(":");
      this._tapPad(lane, Number(s));
    }
    if (key.startsWith("note:") && ev.detail === 0) {
      const [, col, midi] = key.split(":");
      this._tapNote(Number(col), Number(midi));
    }
  }

  _tapPad(lane, step) {
    this._pushUndo();
    const on = toggleBeatCell(this.beatGrid, lane, step);
    this.doc.notes = notesFromBeatGrid(this.beatGrid, this.doc.notes, { stepsPerBar:stepsPerBar(this.doc), bar4Fill: Boolean(this.doc?.beat_fill) });
    recordAct(this.doc, "beat_pad", { lane, step, on });
    this._compile();
    const patch = LANES.find((l) => l.id === lane)?.patch || "kick";
    if (on) this.app.scheduler.previewSound({ patchId: patch, role: "drums", kit: this.doc.drum_kit });
    this.render();
    if (on) this._sparkAt(this.root.querySelector(`[data-key="pad:${lane}:${step}"]`));
  }

  _tapNote(col, midi) {
    if (this.tuneGrid.eventEditor) return this.app._announce("Edit these notes one at a time.");
    this._pushUndo();
    const placed =
      this.tuneTab === "ending"
        ? toggleEndingCell(this.tuneGrid, col, midi)
        : toggleTuneCell(this.tuneGrid, col, midi, { endingFollowsMain: !endingIsOwn(this.tuneGrid) });
    const leadPatch = this.doc.lead_patch_id || "pluck_lead";
    this._writeTuneNotes(leadPatch);
    recordAct(this.doc, "tune_note", { col, midi, on: Boolean(placed), tab: this.tuneTab });
    this.lastTuneCol = placed ? col : null;
    suggesterKey(this.suggester, placed ? this._suggesterInput(col) : null);
    this._compile();
    if (placed) this.app.scheduler.previewSound({ patchId: leadPatch, role: "lead", midi, durationSec: 0.35 });
    this.render();
    if (placed) this._sparkAt(this.root.querySelector(`[data-key="note:${col}:${midi}"]`));
  }

  _shape(shapeId) {
    if (this.tuneGrid.eventEditor) return this.app._announce("Edit these notes one at a time.");
    if (!this.tuneGrid.main.some(Boolean) && !this.tuneGrid.ending.some(Boolean)) {
      return;
    }
    this._pushUndo();
    const rootPc = Number(this.doc.global_context.root_pc || 0);
    const scaleType = this.doc.global_context.scale_type || "major";
    this.tuneGrid = shapeEnding(this.tuneGrid, shapeId, rootPc, scaleType);
    this._writeTuneNotes(undefined, true);
    const active = activeEndingShape(this.tuneGrid);
    if (active) recordReveal(this.doc, "shape_ending", { shape: shapeId });
    recordAct(this.doc, "shape_ending", { shape: shapeId, active });
    this._compile();
    const shapeMsg = !active
      ? "Ending is back to how it was."
      : shapeId === "breathe"
        ? "Left space at the end."
        : shapeId === "climb"
          ? "Last note steps up."
          : "Last note comes home.";
    this.tuneFeedback = shapeMsg;
    this.app._announce(shapeMsg);
    this.render();
  }

  _pickFeel(feelId) {
    this._pushUndo();
    const cur = this.doc.underneath?.feel;
    const pinnedBars = this.doc.underneath?.pinnedBars || [];
    const harmonyStyle = this.doc.underneath?.harmonyStyle || "hold";
    // Pressing the active feel turns chords and bass off again ("just my beat and tune"), keeping the choice row at 3.
    if (cur === feelId) {
      this.doc = clearUnderneath(this.doc);
      recordAct(this.doc, "feel", { feel: "none" });
      this._noteChoice("feel", null);
      this._compile();
      return this.render();
    }
    const f = FEELS.find((x) => x.id === feelId);
    if (!f) return;
    const opts = chordOptions(this.doc);
    this.doc = applyUnderneath(
      this.doc,
      { feel: f.id, chords: f.chords, bass: f.bass, harmonyStyle, pinnedBars },
      opts
    );
    recordAct(this.doc, "feel", { feel: f.id });
    this._noteChoice("feel", f.id);
    this._compile();
    this.render();
  }

  _swapUnder(patch) {
    this._pushUndo();
    const u = this.doc.underneath || { feel: "warm", chords: 0, bass: "bass_warm_sustained", harmonyStyle: "hold", pinnedBars: [] };
    const next = {
      feel: u.feel || "warm",
      chords: patch.chords !== undefined ? patch.chords : (u.chords ?? 0),
      bass: patch.bass || u.bass || "bass_warm_sustained",
      harmonyStyle: patch.harmonyStyle || u.harmonyStyle || "hold",
      pinnedBars: patch.pinnedBars !== undefined ? patch.pinnedBars : (u.pinnedBars || []),
    };
    const opts = chordOptions(this.doc);
    this.doc = applyUnderneath(this.doc, next, opts);
    recordAct(this.doc, "underneath_detail", patch);
    this._noteChoice("feel", next.feel);
    this._compile();
    this.render();
  }

  async _hum() {
    this.humPreview = null;
    this.humMessage = "";
    this.render();
    const bannerEl = this.root.querySelector("#pf-hum-status");
    const res = await this.app._listenForHum(bannerEl);
    if (res.status !== "ok" || !res.notes?.length) {
      this.humMessage = HUM_STATUS_MESSAGES[res.status] || HUM_STATUS_MESSAGES.error;
      this.render();
      this.root.querySelector('[data-key="hum"]')?.focus();
      return;
    }
    this.humPreview = tuneGridFromHum(res.notes);
    this.humMessage = "Your hum is ready. Press Hear it to listen, or add it to your tune.";
    this.render();
  }

  _hearHum() {
    if (!this.humPreview) return;
    const tempDoc = JSON.parse(JSON.stringify(this.doc));
    tempDoc.notes = notesFromTuneGrid(this.humPreview, tempDoc.notes, this.doc.lead_patch_id || "pluck_lead");
    this._previewBar(tempDoc, 0, 1);
  }

  _applyHum(mode) {
    if (!this.humPreview) return;
    this._pushUndo();
    if (hasOwnTuneNotes(this.tuneGrid)) {
      this.beforeHum = JSON.parse(JSON.stringify(this.tuneGrid));
    }
    if (mode === "add") {
      const { grid, blocked } = mergeHumIntoTune(this.tuneGrid, this.humPreview);
      this.tuneGrid = grid;
      if (blocked > 0) this.app._announce(`Added your hum. ${blocked} notes kept your tapped notes.`);
      else this.app._announce("Added your hum into the free steps.");
    } else {
      this.tuneGrid = { ...this.tuneGrid, main: this.humPreview.main, ending: this.humPreview.ending };
      this.app._announce("Your hum is on the pads.");
    }
    this.humPreview = null;
    this.humMessage = "";
    this._writeTuneNotes();
    recordAct(this.doc, "hum", { mode });
    this._compile();
    this.render();
  }

  _restoreBeforeHum() {
    if (!this.beforeHum) return;
    this._pushUndo();
    this.tuneGrid = this.beforeHum;
    this.beforeHum = null;
    this._writeTuneNotes();
    this._compile();
    this.app._announce("Your earlier notes are back.");
    this.render();
  }

  _readTitle() {
    const input = this.root.querySelector("#pf-title");
    if (input && input.value.trim()) this.doc.title = input.value.trim();
    if (!this.doc.title) this.doc.title = "My song";
  }

  _save() {
    if (this.cardPreview) this._keepCard();
    this._readTitle();
    const res = savePiece(window.localStorage, this._canonicalDoc());
    if (res.ok) {
      this.slotsFull = false;
      this.saveMessage = `Saved "${res.entry.title}". It is on the start screen next time.`;
      this.app._logSessionEvent("play_flow_save", { id: this.doc.id, title: res.entry.title });
      this._compile();
    } else if (res.reason === "slots_full") {
      this.slotsFull = true;
      this.saveMessage = "";
    } else if(res.reason === "unreadable") {
      this.saveMessage = "Saved songs could not be read. Nothing was replaced. You can still download your song.";
    } else {
      this.saveMessage = "Could not save here. You can still download your song.";
    }
    this.app._announce(this.saveMessage || "All 6 spots are full.");
    this.render();
  }

  _replace(oldId) {
    if (!confirmPress(this.confirm, `replace:${oldId}`)) {
      this.app._announce("Press one more time to swap.");
      return this.render();
    }
    this._readTitle();
    const res = replacePiece(window.localStorage, oldId, this._canonicalDoc());
    this.slotsFull = false;
    this.saveMessage = res.ok ? `Saved "${res.entry.title}".` : res.reason === "unreadable" ? "Saved songs could not be read. Nothing was replaced." : "Could not save in that spot.";
    if (res.ok) {
      this._compile();
    }
    this.app._announce(this.saveMessage);
    this.render();
  }

  _delete(id) {
    if (!confirmPress(this.confirm, `delete:${id}`)) {
      this.app._announce("Press one more time to throw it out.");
      return this.render();
    }
    const result = deletePiece(window.localStorage, id);
    this.deleteMessage = result.ok ? "Removed." : result.reason === "missing" ? "That saved song could not be found." : "Could not remove this song. Nothing was removed.";
    this.app._announce(this.deleteMessage);
    this.render();
  }

  async _download() {
    try {
      this._readTitle();
      this._compile();
      const blob = await this.app.scheduler.renderSongOfflineToWavBlob(this.app.compiledSong);
      const safe = this.doc.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase() || "my_song";
      triggerBlobDownload(blob, `${safe}.wav`);
      this.saveMessage = `Downloaded "${this.doc.title}.wav".`;
      this.app._logSessionEvent("play_flow_download", { id: this.doc.id, title: this.doc.title });
      this.app._announce(this.saveMessage);
      this.render();
    } catch (_error) {
      this.saveMessage = "Could not make the sound file. Your song is still here. Try once more. Or use Save song file.";
      this.app._announce(this.saveMessage);
      this.render();
    }
  }

  async _downloadStem(stemRole) {
    try {
      this._readTitle();
      this._compile();
      const blob = await this.app.scheduler.renderSongOfflineToWavBlob(this.app.compiledSong, stemRole);
      const safe = this.doc.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase() || "my_song";
      triggerBlobDownload(blob, `${safe}_${stemRole}.wav`);
      this.saveMessage = `Downloaded "${safe}_${stemRole}.wav".`;
      this.app._announce(this.saveMessage);
      this.render();
    } catch (_error) {
      this.saveMessage = "Could not make the sound file. Your song is still here. Try once more. Or use Save song file.";
      this.app._announce(this.saveMessage);
      this.render();
    }
  }

  _continue(id) {
    if (!this._retainBeforeSwitch()) return;
    const working = loadWorkingSong(window.localStorage, id);
    if (working?.id === id && workingDiffersFromSave(window.localStorage, working)) {
      this._loadDocIntoFlow(working, { stage: this._savedDevelopmentStage(working, { working: true }) });
      this.app._announce("Here are your new edits. Your saved song is safe.");
      return;
    }
    const loaded = loadPiece(window.localStorage, id);
    if (!loaded) return;
    this._loadDocIntoFlow(loaded, { stage: "song" });
    this.app._announce(`${loaded.title || "Your song"} is open. Press Play to hear it.`);
  }

  _resumeWorking(id = null) {
    if (!this._retainBeforeSwitch()) return;
    const loaded = loadWorkingSong(window.localStorage, id);
    if (!loaded) return;
    this._loadDocIntoFlow(loaded, { stage: this._savedDevelopmentStage(loaded, { working: true }) });
  }

  _loadDocIntoFlow(loaded, { stage = "keep" } = {}) {
    if (!this._retainBeforeSwitch()) return false;
    this._stopForScopeChange();
    this.jamPlayed = false;
    this.editingCard = null;
    this.sharedMaterial = null;
    this.doc = loaded;
    if ((this.doc.jam_start || this.doc.captured_performance) && ["beat", "tune", "under"].includes(stage)) this.doc.capture_development_started = true;
    this.doc.song_cards = normalizeSongCards(this.doc.song_cards);
    this.beatGrid = beatGridFromNotes(this.doc.notes,stepsPerBar(this.doc));
    this.tuneGrid = this.doc.tune_grid_state
      ? JSON.parse(JSON.stringify(this.doc.tune_grid_state)) : tuneGridFromNotes(this.doc.notes);
    this._resetCapturedView();
    this.undoStack = [];
    this.saveMessage = "";
    this._compile();
    // Reopening is a real entry from Start, not evidence that every wizard
    // stage was visited. In particular an imported performance has no jam UI.
    this.trail = ["start"];
    this._go(stage, { back: true });
    return true;
  }

  _downloadProject() {
    this._readTitle();
    this._compile();
    const jsonText = exportProjectJson(this._canonicalDoc());
    const blob = new Blob([jsonText], { type: "application/json" });
    const safe = this.doc.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase() || "my_song";
    triggerBlobDownload(blob, `${safe}.json`);
    this.saveMessage = `Saved "${this.doc.title}".`;
    this.app._announce(this.saveMessage);
    this.render();
  }

  async _importProjectFile(file) {
    try {
      if (file.size > MAX_PROJECT_BYTES) {
        this.saveMessage = 'This project is too large to open (5 MiB limit). Your current song is unchanged.';
        this.app._announce(this.saveMessage);
        return this.render();
      }
      const text = await file.text();
      if (/^\s*(<\?xml|<score-partwise|<!DOCTYPE score)/i.test(text)) {
        const sheet = fromMusicXML(text);
        if (!sheet.ok || !sheet.notes.length) {
          this.saveMessage = "This sheet could not be read. Your song is safe.";
          this.app._announce(this.saveMessage);
          return this.render();
        }
        if (!this._loadDocIntoFlow(this._openSheet(sheet), { stage: "song" })) return;
        this.saveMessage = `Opened the sheet "${this.doc.title}".`;
        this.app._announce(this.saveMessage);
        return this.render();
      }
      const parsed = parseProjectJson(text);
      if (!parsed.ok || !parsed.song) {
        this.saveMessage = 'This project could not be opened. It may contain unsupported or invalid music data. Your current song is unchanged.';
        this.app._announce(this.saveMessage);
        return this.render();
      }
      if (!this._loadDocIntoFlow(parsed.song, { stage: this._savedDevelopmentStage(parsed.song) })) return;
      if (this.draftSaveFailed) return this.render();
      this.saveMessage = `Opened "${this.doc.title}".`;
      this.app._announce(this.saveMessage);
      this.render();
    } catch (_e) {
      this.saveMessage = "Bad file.";
      this.app._announce(this.saveMessage);
      this.render();
    }
  }

  // ---- Two-switch scanning (Space = next, Enter = choose) ----
  // Focus stays silent. Enter acts on the visibly focused control.

  _scanItems() {
    const prefix = [document.getElementById("btn-calm"), document.getElementById("btn-stop-sound"),
      this.root.querySelector('[data-key="back"]')].filter(Boolean);
    return [...new Set([...prefix, ...this.root.querySelectorAll("[data-key]")])].filter((el) => {
      if (el.disabled || el.offsetParent === null) return false;
      // Chrome can report an offsetParent for descendants of closed details.
      // Only that disclosure's own summary belongs in the visible scan route.
      for(let parent=el.parentElement;parent;parent=parent.parentElement) {
        if(parent.tagName==='DETAILS'&&!parent.open&&!parent.querySelector(':scope > summary')?.contains(el))return false;
      }
      // The style slider has equivalent +/- buttons; keep native Tab/arrows,
      // but do not trap a two-switch user on a range that consumes Space.
      if (el.tagName === "INPUT" && el.type === "range") return false;
      if (this.allAtOnce && (el.classList.contains("pf-pad") || el.classList.contains("pf-note")) && !el.classList.contains("on")) {
        return false;
      }
      // Scan-stop budget (<= 36 stops): when Beat Details or All-at-Once is open, skip empty off-beat drum pads.
      if ((this.detailsOpen || this.allAtOnce) && el.classList.contains("pf-pad") && !el.classList.contains("on")) {
        const s = Number(el.dataset.step || 0);
        if (s % 2 === 1) return false;
      }
      // Scan-stop budget (<= 35 stops on Tune): skip empty off-beat sixteenth-note cells during linear Space scan
      // while keeping every beat column, placed note, and idea cell in the scan order.
      if (el.classList.contains("pf-note") && !el.classList.contains("on") && !el.classList.contains("idea")) {
        const col = Number(el.dataset.col || 0);
        if (col % 2 === 1) return false;
        if ((this.detailsOpen || (this.doc?.note_dial && this.doc.note_dial !== "lock")) && col % 4 !== 0) return false;
      }
      return true;
    });
  }

  _onKey(ev) {
    if (!this.root || this.root.style.display === "none") return;
    if (document.getElementById("btn-stop-listening")) return; // mic is listening; its own handler takes Space/Enter
    const active = document.activeElement;
    if(ev.key==='Enter'&&(active?.matches?.('[data-music-field]')||active?.matches?.('[data-music-circle]'))) {
      ev.preventDefault();ev.stopImmediatePropagation();return;
    }
    if (active && ((active.tagName === "INPUT" && active.type !== "range") || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) return;
    if (active?.tagName === "BUTTON" && !this.root.contains(active)
        && !["btn-calm", "btn-stop-sound"].includes(active.id)) return;
    if (ev.target?.hasAttribute?.("data-timeline") && /^(ArrowLeft|ArrowRight|Home|End)$/.test(ev.key)) {
      ev.preventDefault();
      const m = this._timelineModel(); if (!m) return;
      const at = this.app.scheduler?.isPlaying && this.playhead ? this.playhead.step : (this.timelineStep ?? 0);
      const next = ev.key === "Home" ? 0 : ev.key === "End" ? m.total - m.spb : Math.max(0, Math.min(m.total - 1, Math.floor(at / m.spb) * m.spb + (ev.key === "ArrowRight" ? m.spb : -m.spb)));
      return this._seekTo(next);
    }
    if (this.stage === "tune" && this.tuneGrid.eventEditor && ev.target?.dataset?.phraseNote && /^Arrow(Up|Down|Left|Right)$/.test(ev.key)) {
      ev.preventDefault();
      this.eventTuneId = ev.target.dataset.phraseNote;
      const action = ev.key === "ArrowUp" ? "up" : ev.key === "ArrowDown" ? "down" : ev.shiftKey ? (ev.key === "ArrowRight" ? "longer" : "shorter") : (ev.key === "ArrowRight" ? "later" : "earlier");
      return this._editEvent(action).then(() => this.root.querySelector(`[data-phrase-note="${CSS.escape(this.eventTuneId)}"]`)?.focus());
    }
    if (this.stage === "jam" && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.repeat && ["z", "x"].includes(ev.key.toLowerCase())
      && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      ev.preventDefault();
      return this._shiftPadOctave(ev.key.toLowerCase() === "z" ? -1 : 1);
    }
    if (this.stage === "jam" && !ev.ctrlKey && !ev.altKey && !ev.metaKey && this._liveJamPads().some(p => p.key === ev.key.toLowerCase())) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!ev.repeat) this._playJamPad(this._liveJamPads().findIndex(p => p.key === ev.key.toLowerCase()), `key:${ev.key.toLowerCase()}`);
      return;
    }
    if (active?.tagName === "INPUT" && active.type === "range") return; // native slider navigation
    if (ev.key === " ") {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const items = this._scanItems();
      if (items.includes(active)) scanResync(this.scan, items.length, items.indexOf(active));
      const idx = scanNext(this.scan, items.length);
      if (idx >= 0 && items[idx]) {
        items[idx].focus();
      }
    } else if (ev.key === "Enter") {
      const items = this._scanItems();
      // Native Tab can focus notes intentionally omitted from the shorter scan.
      const el = (active?.dataset?.key && this.root.contains(active)) || items.includes(active)
        ? active : items[this.scan.index];
      if (!el) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (el.tagName === "INPUT" && el.type === "text") return;
      el.click();
    }
  }


  // ---- Swipe-to-paint on the beat and tune pads (9a-4 + Tune drag paint) ----

  _padFromEvent(ev) {
    const el = document.elementFromPoint?.(ev.clientX, ev.clientY) || ev.target;
    return el?.closest?.(".pf-pad[data-lane][data-step]") || null;
  }

  _noteFromEvent(ev) {
    const el = document.elementFromPoint?.(ev.clientX, ev.clientY) || ev.target;
    return el?.closest?.(".pf-note[data-col][data-midi]") || null;
  }

  _onPointerDown(ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    // Jam pads sound on press, not on release; the click that follows is then ignored (_onClick).
    const jamPad = this.stage === "jam" ? ev.target?.closest?.('[data-key^="jam-pad:"]') : null;
    if (jamPad) {
      ev.preventDefault();
      jamPad.focus({ preventScroll: true });
      this.app.scheduler.unlock();
      this.jamPointer = { pointerId: ev.pointerId, upAt: null };
      this.jamPointers ||= new Map();
      if (this.jamPointers.size >= 16) this.jamPointers.delete(this.jamPointers.keys().next().value);
      this.jamPointers.set(ev.pointerId, this.jamPointer);
      this._playJamPad(Number(jamPad.dataset.key.slice("jam-pad:".length)), `pointer:${ev.pointerId}`);
      return;
    }
    const pad = this._padFromEvent(ev);
    if (pad) {
      ev.preventDefault();
      pad.focus({ preventScroll: true });
      this.app.scheduler.unlock();
      const lane = pad.dataset.lane;
      const step = Number(pad.dataset.step);
      this._pushUndo();
      this.paint = startPaint(this.beatGrid, lane, step);
      this._afterBeatPaint(lane, step);
      return;
    }
    const note = this._noteFromEvent(ev);
    if (note) {
      ev.preventDefault();
      note.focus({ preventScroll: true });
      this.app.scheduler.unlock();
      const col = Number(note.dataset.col);
      const midi = Number(note.dataset.midi);
      const wasIdea = note.classList.contains("idea");
      this._pushUndo();
      suggesterDown(this.suggester);
      this.tunePaint = startTunePaint(this.tuneGrid, this.tuneTab, col, midi, {
        endingFollowsMain: !endingIsOwn(this.tuneGrid),
      });
      this.lastTuneCol = this.tunePaint.filling ? col : null;
      if (wasIdea && this.tunePaint.filling) {
        this.tuneFeedback = "Added that note idea.";
      }
      this._afterTunePaint(col, midi);
    }
  }

  _updatePointerWake(ev) {
    if (this.comfort?.lessMotion || !this.root) return;
    const gridEl = ev.target?.closest?.(".pf-grid[data-water-grid]") || this.root.querySelector?.(".pf-grid[data-water-grid]");
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect?.();
    if (!rect || rect.width === 0) return;
    const pt = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    if (!this.pointerTrail) this.pointerTrail = [];
    this.pointerTrail.push(pt);
    if (this.pointerTrail.length > 8) this.pointerTrail.shift();
    if (this.pointerTrail.length < 2) return;
    const d = buildPointerWakePath(this.pointerTrail);
    let wakeSvg = gridEl.querySelector(".pf-wake-svg");
    if (!wakeSvg) {
      gridEl.insertAdjacentHTML(
        "afterbegin",
        `<svg class="pf-wake-svg" viewBox="0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="pf-wake-path" d="${d}" stroke="rgba(125, 211, 252, 0.55)" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`
      );
    } else {
      const pathEl = wakeSvg.querySelector(".pf-wake-path");
      if (pathEl) pathEl.setAttribute("d", d);
    }
  }

  _onPointerMove(ev) {
    if (ev.buttons !== undefined && (ev.buttons & 1) === 0) {
      if (this.paint || this.tunePaint) this._onPointerUp();
      return;
    }
    if (this.paint) {
      this._updatePointerWake(ev);
      const pad = this._padFromEvent(ev);
      if (!pad) return;
      const lane = pad.dataset.lane;
      const step = Number(pad.dataset.step);
      if (applyPaint(this.beatGrid, this.paint, lane, step)) {
        this._afterBeatPaint(lane, step);
      }
      return;
    }
    if (this.tunePaint) {
      this._updatePointerWake(ev);
      const note = this._noteFromEvent(ev);
      if (!note) return;
      const col = Number(note.dataset.col);
      const midi = Number(note.dataset.midi);
      if (applyTunePaint(this.tuneGrid, this.tunePaint, col, midi)) {
        this.lastTuneCol = this.tunePaint.filling ? col : null;
        this._afterTunePaint(col, midi);
      }
    }
  }

  _onPointerUp() {
    this.pointerTrail = [];
    for (const w of this.root?.querySelectorAll?.(".pf-wake-svg") || []) w.remove();
    this.paint = null;
    if (this.tunePaint) {
      const col = this.lastTuneCol;
      const startCol = this.tunePaint.startCol;
      const row = this.tuneTab === "ending" ? this.tuneGrid.ending : this.tuneGrid.main;
      const heldCell = startCol !== undefined ? row?.[startCol] : null;
      if (heldCell && Number(heldCell.duration_steps || 2) > 2) {
        this.tuneFeedback = "This note now lasts longer.";
        this.app._announce(this.tuneFeedback);
      }
      this.tunePaint = null;
      suggesterUp(this.suggester, col !== null ? this._suggesterInput(col) : null);
      this.render();
    }
  }

  _afterBeatPaint(lane, step) {
    this.doc.notes = notesFromBeatGrid(this.beatGrid, this.doc.notes, { stepsPerBar:stepsPerBar(this.doc), bar4Fill: Boolean(this.doc?.beat_fill) });
    recordAct(this.doc, "beat_pad", { lane, step, on: this.paint.filling });
    this._compile();
    if (this.paint.filling) {
      const patch = LANES.find((l) => l.id === lane)?.patch || "kick";
      this.app.scheduler.previewSound({ patchId: patch, role: "drums", kit: this.doc.drum_kit });
    }
    this.render();
  }

  _afterTunePaint(col, midi) {
    const leadPatch = this.doc.lead_patch_id || "pluck_lead";
    this._writeTuneNotes(leadPatch);
    recordAct(this.doc, "tune_note", { col, midi, on: this.tunePaint.filling, tab: this.tuneTab });
    this._compile();
    if (this.tunePaint.filling) {
      this.app.scheduler.previewSound({ patchId: leadPatch, role: "lead", midi, durationSec: 0.35 });
    }
    this.render();
  }
}
