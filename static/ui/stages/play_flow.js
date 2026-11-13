import {SUPPORTED_SCENES as NEIGHBOURHOOD_SCENES} from '../../js/theory/melody_composer_v8.js';
import {SUPPORTED_SCENES as MOTIF_SCENES} from '../../js/theory/melody_composer_v7.js';
import {captureNativeMelodyBalance} from '../../js/theory/native_melody_balance.js';
import {VOCABULARY_VERSION} from '../../js/theory/melody_composer_v4.js';
import {selectedMelody} from '../../js/theory/selected_melody.js';
import {captureMelodyContext,COMPOSER_SCENES} from '../../js/theory/melody_composer.js';
import {melodyWorkspace} from '../../js/theory/melody_workspace.js';
import {MelodyFieldSession,heardMelodyCandidate,melodyKeepReadiness} from '../melody_field_session.js';
import {previewBigMoment} from '../big_moment.js';
import {bandRows,bandKey} from '../band_view.js';
import {exploreMelody,melodyPictures,MELODY_DIRECTIONS} from '../melody_explorer.js';
import {starterSong,starterGroups,chapterKind,moveStarterChapter,changeStarterChapter} from '../starter_song.js';
import {pitchRows,pitchTop,pitchName} from "../pitch_rows.js";
import {previewReturningPart, compileReturnSong} from '../returning_part.js';
import { needsExactTuneEditor } from "../../js/theory/tune_model.js";
import {LIVE_VOICE_LIMIT} from '../../js/audio/scheduler.js';
import {CIRCLE_GROUPS,CIRCLE_SCENES,circleSceneAt,circlePosition,circleStep,circleFamilyStep,circleFamilyScenes,circleChoiceAt,circleFieldForScene,circleFieldPosition} from '../../js/theory/music_circle.js';
import { planSectionDirection, applySectionTrial } from '../../js/theory/section_direction.js';
import { previewEchoAnswer, previewEndingIdea } from '../../js/theory/melody_answer.js';
import { liveVelocity } from '../../js/theory/scene_voice_levels.js';
import {musicFieldDescription,FIELD_REGIONS,CONNECTED_FIELD_REGIONS,musicFieldTempoAllowed,sceneTempoAllowed,ROOTS_FIELD_MAX_BPM} from '../../js/theory/music_field.js';
import {createJamFormBuilder} from '../../js/theory/jam_form_program.js';
import {formBlockCount} from '../../js/theory/form_scenes.js';
import {phraseContext} from '../../js/theory/phrase_harmony.js';
import {dynamicJamPads,personalPerformance,melodyPads} from '../../js/theory/dynamic_keys.js';
import {padNoteNames,spokenNoteName,loadPadNoteNames,savePadNoteNames} from '../../js/theory/pad_note_names.js';
import {CHORD_VOICE_SCENES} from '../../js/theory/style_traits.js';
import { scoreFromEvents, toMusicXML, fromMusicXML, renderSheetSvg, eventsFromTake } from '../../js/theory/score_sheet.js';
import { dealCards, applyCard, cardSeek } from '../../js/theory/adjust_cards.js';
import { visualBars, partOfRole, describeElements } from '../../js/theory/visual_tokens.js';
import { buildLiveScoreModel, computeLiveScoreFrame } from '../../js/theory/live_score_model.js';
import { liveScoreStripHtml, syncLiveScoreSvg, isCalmVisuals, extractLivePersonalEvents } from '../live_score_visualizer.js';
import { optimizeNotes, optimizeArrangement, chordTonesByBar, describeOptimisation } from '../../js/theory/optimize.js';
/** Phase 14.1 status words, one line per loading state, short enough for the plain-words check. */
const LOADING_WORDS = Object.freeze({
  loading: "Sound is on. Full sounds are on the way.",
  ready: "Full sounds join at the next bar.",
  live: "",
  failed: "Full sounds did not load. Help can try again.",
});
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
import { playedLive } from "../../js/theory/capture_window.js";
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
  songLibrary, trashSong, restoreSong,
  confirmPress,
  summarizeCartridge,
  listPhraseShelf,
  savePhraseToShelf,
  applyPhraseFromShelf,
  stashWorkingSong,
  storageNearlyFull,
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
  ensureSectionIds, insertSongPart, removeSongPart,
  isGeneratedBuildEffect, removeGeneratedBuildEffects,
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
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION,hasSceneCatalogue,compatibleSceneIndices,catalogueBacking} from '../../js/theory/scene_catalogue.js';
import {performanceLean,performanceRead,heardWords,backingActivity,leanWeights,leanWords} from '../../js/theory/exploration_bias.js';
import {readHand,ownPhrase,phraseSettled} from '../../js/theory/band_hand.js';
import {NOTE_NAMES as NOTE_NAMES_FOR_RECEIPT} from '../../js/theory/harmony.js';
import { SCENE_VARIANTS, sceneDescription } from '../../js/theory/style_scenes.js';
import { quieterBandComparison } from '../../js/theory/part_comparison.js';
import { materializePerformance } from "../../js/theory/performance_capture.js";
import { drumKit, drumLanes, drumLaneKey, drumLaneTop } from "../drum_lanes.js";
import { INSTRUMENT_GROUPS, getInstrument, instrumentPage } from "../../js/theory/instrument_catalogue.js";

const KEEP_LOST_WORDS = "Some of your first notes did not fit."; // Songs kept before 3 November may carry this.
const RESTS_LEFT_OUT_WORDS = "Long rests are left out.";
const EARLIER_SAVED_WORDS = "Your older notes are in a new song. Find it on the first screen.";
const EARLIER_HELD_WORDS = "Old notes stay with this song.";
const LAST_TAKE_WORDS = "Your last take is saved too. Find it on the first screen.";
const NEARLY_FULL_WORDS = "Space for songs is almost full. Use Download project.";
const playedIdsIn = song => [...(song?.notes || []), ...(song?.song_cards || []).flatMap(card => card?.material?.notes || [])]
  .filter(note => note?.provenance === "user_placed").map(note => note.source_note_id || note.id);
const isOwnNote = n => n.provenance === "user_placed" || n.provenance === "hummed_confirmed";

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
    this.detailsOpen = false;
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
      isQuiet: () => Boolean(this.comfort.lessMotion || this.stage==='start'),
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
      const partCircle=e.target.closest('[data-part-circle]');
      if(partCircle && e.button===0) {
        e.preventDefault(); this.root.setPointerCapture?.(e.pointerId);
        this.partCircleGesture={id:e.pointerId,rect:partCircle.getBoundingClientRect()};
        return this._pointPartCircle(e);
      }
      const field=e.target.closest('[data-music-field], [data-music-circle]');
      if(!field||e.button!==0)return;
      e.preventDefault();field.focus({preventScroll:true});field.setPointerCapture(e.pointerId);
      this.fieldPointer=e.pointerId;this.fieldGesture=false;this._pointMusicField(e,field);
    });
    this.root.addEventListener('pointermove', e => {
      if(this.partCircleGesture?.id===e.pointerId)return this._pointPartCircle(e);
      if(this.scrub?.pointerId===e.pointerId)return this._scrubTo(e);
      if(this.noteDrag?.pointerId===e.pointerId)return this._moveNoteDrag(e);
      if(this.fieldPointer===e.pointerId)this._pointMusicField(e,e.target.closest('[data-music-field], [data-music-circle]'));
    });
    this.root.addEventListener('pointerup', e => {
      if(this.partCircleGesture?.id===e.pointerId){this.partCircleGesture=null;return;}
      if(this.scrub?.pointerId===e.pointerId)return this._endScrub();
      if(this.noteDrag?.pointerId===e.pointerId)return this._endNoteDrag();
      if(this.fieldPointer!==e.pointerId)return;
      this._flushMusicField();this.fieldPointer=null;this.fieldGesture=false;
    });
    this.root.addEventListener('pointercancel', () => { this.partCircleGesture=null; this._endScrub(); if (this.noteDrag) this._endNoteDrag({ cancelled: true }); this.cancelFieldGesture(); });
    this.root.addEventListener('input', e => {
      if(e.target.matches('[data-circle-blend]')){const x=Number(e.target.value);this._requestCircle(['ska-v1','rocksteady-v1','reggae-v1'][Math.round(x*2)],true,{version:5,x,y:.5});return;}
      const axis=e.target.dataset?.fieldAxis;if(!axis)return;
      this._requestMusicField({...this._requestedField(),[axis]:Number(e.target.value)},true);
    });
    this.root.addEventListener('keydown', e => {
      if(e.target.matches('[data-part-circle]')) {
        const id=this.partComparison?.sceneId;
        const next=e.key==='ArrowRight'?circleStep(id,1):e.key==='ArrowLeft'?circleStep(id,-1):e.key==='ArrowDown'?circleFamilyStep(id,1):e.key==='ArrowUp'?circleFamilyStep(id,-1):null;
        if(next){e.preventDefault();this._selectPartBand(next);this.root.querySelector('[data-part-circle]')?.focus();}return;
      }
      if(e.target.matches('[data-music-circle]')) {
        const id=this.circleIntent?.id||this.doc.jam_session.scene_id;
        const next=e.key==='ArrowRight'?circleStep(id,1):e.key==='ArrowLeft'?circleStep(id,-1):e.key==='ArrowDown'?this._circleFamilyChoice(id,1):e.key==='ArrowUp'?this._circleFamilyChoice(id,-1):null;
        if(next){e.preventDefault();this._requestCircle(next,false);}return;
      }
      if(!e.target.matches('[data-music-field]'))return;
      const deltas={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,.025],ArrowDown:[0,-.025]};
      if(!deltas[e.key])return;e.preventDefault();
      const [dx,dy]=deltas[e.key],f=this._requestedField();
      this._requestMusicField({x:f.x+dx,y:f.y+dy},false);
    });
    this.root.addEventListener("change", (e) => {
      if(e.target?.id==='pf-part-band-picker'){this._selectPartBand(e.target.value);this.root.querySelector('#pf-part-band-picker')?.focus();return;}
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
    window.addEventListener("beforeunload", (e) => this._onBeforeUnload(e));
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._releaseAllLive(); });
    this.render();
  }

  /** Playing in Jam lives only in the open page until it is kept and saved. */
  _hasUnkeptPlaying() {
    return Boolean(this.unkeptLiveIds?.size || this.draftSaveFailed);
  }

  _rememberUnkeptPlaying(sourceNoteId) {
    (this.unkeptLiveIds ||= new Set()).add(sourceNoteId);
  }

  _reconcileRetainedPlaying(song) {
    if (!this.unkeptLiveIds?.size) return;
    // Retained source/capture records also count: earlier takes can live in their own saved song.
    const pending = [song], seen = new Set();
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      // Attribution alone is not a recoverable performance. Require an actual personal
      // note, or a timed capture occurrence, before retiring its pending live identity.
      const note = value.event || value;
      const timed = value.event
        ? Number.isFinite(value.time) && Number.isFinite(value.duration) && value.duration > 0
        : Number.isFinite(note.step) && Number.isFinite(note.duration_steps) && note.duration_steps > 0;
      const pitched = Number.isFinite(note.concrete?.midi_pitch)
        || (Number.isFinite(note.concrete?.freq_hz) && note.concrete.freq_hz > 0);
      if (note.provenance === 'user_placed' && timed && (pitched || note.role === 'drums')) {
        if (typeof note.source_note_id === 'string') this.unkeptLiveIds.delete(note.source_note_id);
        if (typeof note.id === 'string') this.unkeptLiveIds.delete(note.id);
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') pending.push(child);
    }
  }

  _onBeforeUnload(e) {
    if (!this._hasUnkeptPlaying()) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
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
      activeSongCard: this.activeSongCard,
      editingCard: this.editingCard,
      sharedMaterial: this.sharedMaterial ? JSON.parse(JSON.stringify(this.sharedMaterial)) : null,
    });
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  _undo() {
    this.chapterMoveMessage=null;
    this.keptBandNoChange=null;
    const prev = this.undoStack.pop();
    if (!prev) return this.app._announce("Nothing to undo.");
    if(this.stage==='jam'&&this.app.scheduler.activeJamLead) {
      this._stopForScopeChange();
      this.app.scheduler.lastStoppedJamLead=null;
    }
    const previousScope = this.editingCard;
    this.doc = prev.doc;
    if(Number.isInteger(prev.activeSongCard))this.activeSongCard=prev.activeSongCard;
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
    this.doc.song_cards = ensureSectionIds(this.doc.song_cards);
    this.tuneGrid.eventEditor = Boolean(this.melodyFocus) || stepsPerBar(this.doc)===12 || needsExactTuneEditor(this.doc.notes, this._partBars());
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
    if (ok) {
      this.lastDraftSnapshot = JSON.stringify(song);
      this._reconcileRetainedPlaying(song);
      if (this.unkeptLiveIds?.size) for (const saved of listWorkingSongs(window.localStorage)) this._reconcileRetainedPlaying(saved);
    }
    return ok;
  }

  _retainBeforeSwitch() {
    if (this.unkeptLiveIds?.size) {
      this.stage = 'jam';
      this.render();
      this.app._announce(this.melodyField?(this.melodyField.palette?'Press Save played take to keep your playing.':'Press Keep this take to save your playing first.'):'Press Make my tune, then Keep this take to save your playing first.');
      return false;
    }
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
    return (this.doc.jam_start || this.doc.captured_performance || this.doc.capture_notes?.melody_field) && cards.length === 1 ? cards[0].bars : BARS;
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

  _editPart(index, stage = "tune", {undo = true} = {}) {
    this.eventRole = 'lead'; this.eventPatch=null; this.bandCollapsed=false;this.starterBlocked=false;this.chapterMoveMessage=null;
    this.eventTuneZoom = false;
    if (!Number.isInteger(index) || !this.doc.song_cards?.[index]) return;
    this.detailHub = false;   // a part's Open means its notes, not the hub
    const wasPlaying = Boolean(this.app.scheduler?.isPlaying);
    this._stopForScopeChange();
    this._finishPartEdit();
    if(undo)this._pushUndo();
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
    const firstOwnStep = Math.min(...this.doc.notes.filter(n => n.role === "lead" && isOwnNote(n)).map(n => n.step));
    this.eventTuneBar = Number.isFinite(firstOwnStep) ? Math.floor(firstOwnStep / stepsPerBar(this.doc)) : 0;
    this.eventTuneId = null;
    this.eventSelectionExplicit = false;
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

  /** Said on the song screen for as long as this take is the song, since the notes really are gone. */
  _keepLostHtml() {
    const kept = this.doc?.captured_performance;
    const words = [kept?.personal_lost ? KEEP_LOST_WORDS : "", kept?.rests_left_out ? RESTS_LEFT_OUT_WORDS : "", kept?.earlier_notice || ""].filter(Boolean).join(" ");
    return words ? `<p class="pf-say pf-msg pf-keep-lost" role="status">${esc(words)}</p>` : "";
  }

  /** Whatever did not fit in this song becomes another song on the start screen, so no note is discarded. Same id on a
   * repeat Keep, so Undo and Keep again does not make copies. Returns the words to say, or "" when nothing was held back. */
  _saveEarlierNotes(capture, source) {
    let chunk = capture?.earlier, part = 1, allSaved = Boolean(chunk);
    if (!chunk) return "";
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    while (chunk) {
      // Named by the first note played live, whose id is unique. Occurrences restart with every take, and a note
      // repeating from the loop keeps its id between takes, so either could land on an older song and replace it.
      const first = chunk.events.find(playedLive) || chunk.events.find(item => item.event?.provenance === "user_placed");
      const noteKey = first?.event?.source_note_id || first?.event?.id || `part-${part}`;
      const { id, title } = this._olderSongSlot(storage, source, noteKey, chunk.events.filter(item => item.event?.provenance === "user_placed").map(item => item.event.source_note_id || item.event.id));
      const { earlier, ...own } = chunk;
      let saved = false;
      try {
        const doc = materializePerformance({ ...source, id, title }, { ...own, source_song_id: id });
        doc.song_cards = normalizeSongCards(doc.song_cards);
        delete doc.jam_start; // A copy of where this song started, for a Restore that an older part does not need.
        // Made as Keep makes any song. Live keys record no act, and the start screen lists only a song with one.
        recordAct(doc, "keep_direction", { muted_layers: [] });
        doc.capture_development_started = true;
        doc.last_stage = "song"; // Not the band screen the person was on when this was split off.
        doc.song_cards = songArcFromCapture(doc.song_cards);
        saved = stashWorkingSong(storage, doc);
      } catch (_error) { saved = false; }
      allSaved = allSaved && saved;
      chunk = earlier; part += 1;
    }
    return allSaved ? EARLIER_SAVED_WORDS : EARLIER_HELD_WORDS;
  }

  /** Where an older song goes. A stored song is replaced only by one holding all its notes, as Undo and Keep again does.
   * A replayed note keeps its id, so two different parts can begin alike; the second then takes its own place. The next
   * number means no two buttons read alike. */
  _olderSongSlot(storage, source, noteKey, playedIds) {
    const base = `${source.id}-earlier-${String(noteKey).replace(/[^\w-]/g, "-")}`, holds = new Set(playedIds);
    const already = listWorkingSongs(storage).filter(song => song.id.startsWith(`${source.id}-earlier-`));
    let id = base, n = 1, hit;
    while ((hit = already.find(song => song.id === id)) && !playedIdsIn(hit).every(note => holds.has(note))) id = `${base}-${++n}`;
    return { id, title: hit?.title || `${source.title || "your song"}, earlier ${already.length + 1}` };
  }

  /** A new Keep on a kept song makes the new take the song. If that would drop anything the person played, the song as
   * it stood is saved first, whole, as its own song. It also stays behind Restore source loop, so if it cannot be saved
   * the held line is still true. */
  _saveLastTake(source, capture) {
    if (!source?.captured_performance) return "";
    const inNewTake = new Set();
    for (let part = capture; part; part = part.earlier) for (const item of part.events) if (item.event?.provenance === "user_placed") inNewTake.add(item.event.source_note_id || item.event.id);
    const played = playedIdsIn(source), dropped = played.filter(note => !inNewTake.has(note));
    if (!dropped.length) return "";
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    try {
      const { id, title } = this._olderSongSlot(storage, source, dropped[0], played);
      const doc = JSON.parse(JSON.stringify(source));
      Object.assign(doc, { id, title, capture_development_started: true, last_stage: "song" });
      doc.captured_performance.source_song_id = id;
      delete doc.captured_performance.earlier_notice; // That line was about the Keep that made it.
      return stashWorkingSong(storage, doc) ? LAST_TAKE_WORDS : EARLIER_HELD_WORDS;
    } catch (_error) { return EARLIER_HELD_WORDS; }
  }

  /** Keep the current musical state, not a newly generated approximation of it. */
  async _enterMelodyField() {
    if(this.stage!=='jam'||this.melodyField||this.melodyPreparing)return;
    this._flushMusicField?.();
    const scheduler=this.app.scheduler;
    this.melodyPreparing=true;
    try {
      if(!scheduler.isPlaying) {
        const token=this._intentToken();
        if(!await this._keepMusicGoing(token))return;
        await new Promise(resolve=>setTimeout(resolve,150));
        if(!this._intentValid(token))return;
      }
      // A picked band joins at its next boundary. Build the tune on it, not on the band it replaces.
      if(!await this._awaitPickedBand())return;
      const capture=scheduler.capturePerformance();
      if(!capture?.events?.length)return this.app._announce('Listen a little, then try your tune.');
      const source=materializePerformance(this._canonicalDoc(),capture);
      // Keep the actual Jam as the source archive, but explore the complete
      // currently reached groove rather than its partial recording.
      const reached=scheduler.activeJamBacking();
      const compiled=melodyWorkspace(scheduler.compiledSong,reached,capture,scheduler.gridOriginTime);
      const capturedContext=captureMelodyContext(compiled,reached,{customBacking:Boolean(this.doc.jam_session?.anchor_backing)});
      const phraseContext=capturedContext?captureNativeMelodyBalance({...capturedContext,composerVersion:NEIGHBOURHOOD_SCENES.has(capturedContext.sceneId)||MOTIF_SCENES.has(capturedContext.sceneId)?9:5,vocabularyVersion:VOCABULARY_VERSION}):null;
      const session=new MelodyFieldSession(compiled,{scheduler,captureOrigin:scheduler.gridOriginTime,
        root:source.global_context.root_pc||0,scale:source.global_context.scale_type||'major',sourceDoc:source,phraseContext});
      const generation=scheduler.stopGeneration;
      await session.prepare();
      if(this.stage!=='jam'||scheduler.stopGeneration!==generation||this.melodyField||this.doc.id!==capture.source_song_id)return;
      // A band picked while the choices were loading would make this tune belong to the wrong band.
      if(this._pickedBandPending())return this.app._announce('Your band changed. Press Make my tune again when it plays.');
      session.fromSaved=Boolean(this.doc.capture_notes?.melody_field);
      if(!session.begin())return this.app._announce('Your tune is here. Try again when the music plays.');
      this.cancelFieldGesture();this.exploreTour=null;this.answerOnRelease=false;clearTimeout(this.answerTimer);this.melodyField=session;
      this.render();this.root.querySelector('[data-melody-disk]')?.focus();
    }catch(error){this.app._announce(`Your tune stays. ${error.message}`);}finally{this.melodyPreparing=false;}
  }

  /** True while the chosen band has not yet replaced the one the audio clock is playing. */
  _pickedBandPending() {
    const scheduler=this.app.scheduler;
    if(this.exploreTour||!scheduler?.isPlaying)return false;
    if(this.circleIntent||this.fieldIntent)return true;
    if(scheduler.pendingJamBacking!=null||scheduler.jamBridgeStage!=null
      ||scheduler.lastJamBackingCommit?.audioTime>scheduler.audioCtx?.currentTime
      ||(scheduler.jamBackingTimeline?.length&&!scheduler.activeJamBacking?.()))return true;
    const want=this.doc?.jam_session?.scene_id;
    if(!want)return false;
    const reached=scheduler.activeJamBacking?.()?.phraseContext;
    if(!reached?.sceneId)return false;
    if(reached.sceneId!==want)return true;
    // Same band, different blend: the requested blend must also have reached the audio clock.
    const asked=this.doc.jam_session.music_field||null,playing=reached.musicField||null;
    return Boolean(asked)!==Boolean(playing)||Boolean(asked&&['version','x','y'].some(k=>asked[k]!==playing[k]));
  }

  async _awaitPickedBand() {
    if(!this._pickedBandPending())return true;
    const token=this._intentToken(),id=this.doc.id,alreadyPreparing=this.melodyPreparing;
    this.melodyPreparing=true;
    this.app._announce('Your new band is starting. Your tune opens when it plays.');
    // Bounded. A later pick supersedes this one; Stop, leaving Jam or another song cancels it.
    try{for(let i=0;i<200&&this._pickedBandPending();i++)await new Promise(resolve=>setTimeout(resolve,100));}
    finally{if(!alreadyPreparing)this.melodyPreparing=false;}
    if(!this._intentValid(token)||this.stage!=='jam'||this.melodyField||this.doc.id!==id)return false;
    // Never open the tune on the outgoing band.
    if(this._pickedBandPending()){this.app._announce('That band has not started yet. Your groove stays. Try again when it plays.');return false;}
    return true;
  }

  async _resumeMelodyField() {
    if(this.melodyField)return;
    const scheduler=this.app.scheduler,doc=this._canonicalDoc();
    try {
      const compiled=compileReturnSong(doc);
      const savedCtx=doc.capture_notes?.melody_field?.version===4?{...structuredClone(doc.capture_notes.melody_field.context),source:structuredClone(compiled)}:null;
      const upgradeCtx=!savedCtx?captureMelodyContext(compiled,{phraseContext:phraseContext(doc)},{customBacking:Boolean(doc.jam_session?.anchor_backing)}):null;
      const field=new MelodyFieldSession(compiled,{scheduler,
        captureOrigin:scheduler.gridOriginTime??0,root:doc.global_context.root_pc||0,
        scale:doc.global_context.scale_type||'major',sourceDoc:doc,
        phraseContext:savedCtx,canUpgrade:Boolean(upgradeCtx)});
      const generation=scheduler.stopGeneration;await field.prepare();
      if(this.doc.id!==doc.id||generation!==scheduler.stopGeneration)return;
      field.fromSaved=true;field.upgradeContext=upgradeCtx?captureNativeMelodyBalance({...upgradeCtx,composerVersion:5,vocabularyVersion:VOCABULARY_VERSION}):null;
      if(scheduler.isPlaying&&!field.begin())return this.app._announce('Stop, then open your tune map. Your notes stay.');
      this.doc=doc;this.editingCard=null;this.sharedMaterial=null;
      this.app.songDoc=doc;this.app.compiledSong=compiled;
      this.stage='jam';this.melodyFocus=false;this.melodyField=field;this.exploreTour=null;
      this.render();this.root.querySelector('[data-melody-disk]')?.focus();
    }catch(error){this.app._announce(`Your tune stays. ${error.message}`);}
  }

  async _melodyFieldAction(key) {
    const field=this.melodyField,scheduler=this.app.scheduler;
    const moves={'melody-field-left':[-.1,0],'melody-field-right':[.1,0],
      'melody-field-up':[0,.1],'melody-field-down':[0,-.1]};
    if(moves[key])return field.nudge(...moves[key]);
    if(key==='melody-field-original'&&field.palette)return field.toggleOriginal();
    if(key==='melody-field-original'){const before={...field.position};field.request({x:0,y:0});field.remember(before);return;}
    if(key==='melody-field-undo')return field.undo();
    if(key==='melody-field-upgrade'&&field.upgradeContext) {
      try {
        const nextField=new MelodyFieldSession(field.source,{scheduler,captureOrigin:field.captureOrigin,
          root:field.field.root,scale:field.field.scale,sourceDoc:field.sourceDoc,phraseContext:field.upgradeContext});
        const generation=scheduler.stopGeneration;await nextField.prepare();
        if(this.melodyField!==field||generation!==scheduler.stopGeneration)return;
        nextField.captureOrigin=scheduler.gridOriginTime??field.captureOrigin;
        nextField.fromSaved=field.fromSaved;
        if(scheduler.isPlaying)scheduler.clearPartAudition?.();
        if(scheduler.isPlaying&&!nextField.begin()){this.app._announce('Stop, then try new tunes.');return;}
        this.melodyField=nextField;this.render();this.root.querySelector('[data-melody-disk]')?.focus();
      }catch(error){this.app._announce(`Your tune stays. ${error.message}`);}
      return;
    }
    if(key==='melody-field-explore')return field.toggleExploration();
    if(key==='melody-field-balance')return field.toggleBandBalance();
    if(key==='melody-field-focus'){
      scheduler.setSpotlightRole(scheduler.spotlightRole==='tune'?null:'tune');
      field.paint();return;
    }
    if(key==='melody-field-play') {
      if(scheduler.isPlaying){scheduler.stop();field.paint();return;}
      const generation=scheduler.stopGeneration;
      try {
        await scheduler.unlock();
        if(this.melodyField!==field||generation!==scheduler.stopGeneration)return;
        scheduler.beginLoadingSession();
        const candidate=field._candidate(field.position);
        scheduler.setLoopRange(0,null);scheduler.setRepeatPlayback(true);
        if(!scheduler.beginPartAudition(candidate.song,{sectionId:field.sectionId,requestId:candidate.id}).ok)return;
        scheduler.start();field.hasPlayed=scheduler.isPlaying;field.captureOrigin=scheduler.gridOriginTime;field.paint();
      }catch(error){this.app._announce(`Could not play: ${error.message}`);}
      return;
    }
    if(['melody-field-keep','melody-field-refine','melody-field-back'].includes(key)&&field.palette) {
      const readiness=melodyKeepReadiness(field,scheduler);
      if(!readiness.ok){field.paint();return this.app._announce(readiness.message);}
      const candidate=heardMelodyCandidate(field,scheduler);
      if(!candidate)return this.app._announce('Your melody is joining. Keep it when it plays.');
      const capture=field.hasPlayed?(scheduler.capturePerformance?.()||scheduler.lastStoppedPerformance):null;
      const hasNewPersonal=Boolean(capture?.events?.some(r=>r.event?.provenance==='user_placed'));
      // No fresh take (or reopened save without new live presses): retain the existing performance archive intact.
      const archive=capture?.events?.length&&(!field.fromSaved||hasNewPersonal)
        ?materializePerformance(field.sourceDoc,capture,{keepWholeSource:Boolean(field.fromSaved)}):null;
      const choice={position:candidate.position,requestId:candidate.id};
      const context=candidate.bandBalance||field.phraseContext?.bandBasis?{...field.phraseContext,bandBalance:candidate.bandBalance?1:0,bandBasis:field.bandBasis}:field.phraseContext;
      const next=selectedMelody(field.sourceDoc,candidate.song,{context,choice,performanceArchive:archive});
      this._pushUndo();this._stopForScopeChange();this._finishPartEdit();
      this.doc=next;this.melodyField=null;this.activeSongCard=0;
      this.beatGrid=beatGridFromNotes(this.doc.notes,stepsPerBar(this.doc));
      this.tuneGrid=tuneGridFromNotes(this.doc.notes);
      this._resetCapturedView();
      if(key==='melody-field-refine'){this.melodyFocus=true;this.eventRole='lead';this.eventPatch=null;this.bandCollapsed=false;}
      this.app.scheduler.markPerformanceKept?.();this._reconcileRetainedPlaying(this.doc);
      this._compile();
      if(key==='melody-field-refine')this._go('tune');
      else this._go(key==='melody-field-back'?'jam':'keep');return;
    }
    if(key==='melody-field-take')key='melody-field-keep';
    if(['melody-field-keep','melody-field-refine','melody-field-back'].includes(key)) {
      // A paused reopened creation has no new take. Do not recapture stale history
      // or nest its source snapshot just because someone opens Refine or Save.
      this.melodyField=null;
      if(field.hasPlayed) {
        this._captureDirection({captureFieldTake:true});
        if(!field.fromSaved)this.doc.capture_source=structuredClone(field.sourceDoc);
        this.doc.capture_notes={...this.doc.capture_notes,melody_field:{version:field.field.version,
          realized_position:field.candidates.get(field.realizedId)?.position||{x:0,y:0},
          semantics:'Controls last realized; notes store the actual take, not an endpoint regeneration.'}};
        this._compile();
      } else if(key==='melody-field-refine') {
        this.melodyFocus=true;
        if(this.doc.song_cards.length>1)this._editPart(0,'tune',{undo:false});else this._go('tune');
      }
      if(key==='melody-field-keep')return this._go('keep');
      if(key==='melody-field-refine')return;
      this._go('jam');return;
    }
  }

  _captureDirection({captureFieldTake=false}={}) {
    // A second fast press lands on the song it just made: nothing more to keep, and nothing to say over the first line.
    if (this.stage !== "jam" && this.doc?.captured_performance) return;
    const fromJam = this.stage === "jam";
    let fullCapture = fromJam ? (this.app.scheduler?.capturePerformance?.()
      || this.app.scheduler?.lastStoppedPerformance) : null;
    // Keep never refuses. Without usable playing from this song, keep the band loop
    // itself; another song's history is never taken.
    if(fromJam&&fullCapture&&fullCapture.source_song_id!==this.doc.id)fullCapture=null;
    // The field auditions a complete audible take. Its Keep must not inherit
    // the separate Jam-only filter and discard the chosen generated variation.
    const personalOnly=!captureFieldTake&&fromJam&&this.doc.jam_session?.personal_only===true;
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
      const source = this._canonicalDoc();
      const earlierNotice = this._saveEarlierNotes(capture, source);
      // A copy stays in this song's file only if it could not be saved as its own song.
      const { earlier, ...thisSong } = capture;
      const lastTakeNotice = this._saveLastTake(source, capture);
      this.doc = materializePerformance(source, earlierNotice === EARLIER_HELD_WORDS ? capture : thisSong, { keepWholeSource: lastTakeNotice === EARLIER_HELD_WORDS });
      const notices = [...new Set([earlierNotice, lastTakeNotice].filter(Boolean))].join(" ");
      if (notices) this.doc.captured_performance.earlier_notice = notices;
      this.app.scheduler?.markPerformanceKept?.();
      if(personalOnly&&fullCapture)this.doc.listening_reference={version:1,label:'Full listening reference, excluded from song playback and export',performance:(({earlier,...own})=>own)(fullCapture)};
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
      // Keep the entire performance. Arrangement is an explicit next choice.
      this.doc.song_path = {version:1, step:'melody'};
      this.activeSongCard = 0;
      this._resetCapturedView();
    }
    this._compile();
    if (fromJam) {
      this.melodyFocus = true;
      if(this.doc.song_cards.length>1)this._editPart(0, 'tune', {undo:false});
      else this._go('tune');
    } else this._go("song");
    // Continue only when Jam was already playing; focus on the selected tune.
    if (wasPlaying) {
      const range = songCardRanges(this.doc.song_cards,4*stepsPerBar(this.doc),this.doc.global_context.bpm,stepsPerBar(this.doc))[0];
      this._keepMusicGoing(this._intentToken(), range ? [range.start_step,range.end_step] : null);
    }
    // The same honest line is heard and seen: an unkept note is never covered by a plain "saved".
    const lostNote = capture?.personal_lost ? ` ${KEEP_LOST_WORDS}` : "";
    const heldBack = this.doc.captured_performance?.earlier_notice;
    const nearlyFull = !this.draftSaveFailed && typeof window !== "undefined" && storageNearlyFull(window.localStorage) ? ` ${NEARLY_FULL_WORDS}` : "";
    const keptNote = `${lostNote}${this.doc.captured_performance?.rests_left_out ? ` ${RESTS_LEFT_OUT_WORDS}` : ""}${heldBack ? ` ${heldBack}` : ""}${nearlyFull}`;
    this.app._announce(capture ? (this.draftSaveFailed ? `This is your song now. It is not saved yet.${keptNote}` : `This is your song now. It is saved.${keptNote} Try your tune here.`)
      : focused
      ? "Kept this mix. Focus is off so kept parts play at full sound. Press Play to hear them."
      : "Kept this mix. Your notes stay the same. Shape your part, then build your song.");
  }

  /** Moving deeper into the same song never drops the music: resume it looping. */
  async _keepMusicGoing(token = this._intentToken(), loop = null) {
    const scheduler = this.app.scheduler;
    if (!scheduler || scheduler.isPlaying || !this._intentValid(token)) return false;
    // Stopping releases the sampled sounds; get them back quietly instead of asking.
    if (!scheduler.loadingSession && this.app.compiledSong?.events?.some(e => isSampledPatch(e.patch_id))
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
    if(this.doc?.capture_notes?.melody_field)return `<nav class="pf-row pf-journey" aria-label="Your music">${this.doc?.jam_session&&this.stage!=='jam'?this._btn('jam-open','Jam','pf-btn pf-small pf-journey-step'):''}${this._btn('melody-field-resume','Tune map','pf-btn pf-small pf-journey-step')}${this.stage==='keep'?'':this._btn('keep','Save / export','pf-btn pf-small pf-journey-step')}</nav>`;
    const current = this._journeyLevel(), inJam = this.stage === "jam", hasJam = Boolean(this.doc?.jam_session);
    const levels = [["find", "Find", hasJam], ["play", "Play", hasJam], ["shape", "Shape", true],
      ["detail", "Detail", !inJam], ["share", "Share", !inJam]];
    const steps = levels.map(([id, label, reachable]) => {
      const here = id === current, attrs = here ? 'aria-current="step"' : reachable ? "" : "disabled";
      const title = id === "shape" && inJam ? ' title="Make what is playing into your song"' : "";
      return `<li>${this._btn(`journey:${id}`, label, "pf-btn pf-small pf-journey-step", `${attrs}${title}`)}</li>`;
    }).join("");
    const adjust = current && current !== "find" ? this._btn("adjust-open", "Adjust", "pf-btn pf-small pf-adjust-btn", `aria-expanded="${Boolean(this.adjustOpen)}"`) : "";
    const nicer = ""; // Suggestions have an explicit preview; no unnamed musical rewrites.
    const what = this._btn("legend-open", "What is this?", "pf-btn pf-small pf-legend-btn", `aria-expanded="${Boolean(this.legendOpen)}"`);
    return `<nav class="pf-journey" aria-label="Your song's journey"><ol>${steps}</ol>${nicer}${adjust}${what}</nav>`;
  }

  _refreshJourney() {
    const nav = this.root?.querySelector?.(".pf-journey");
    if (nav) nav.outerHTML = this._journeyHtml();
  }

  _journey(level) {
    // Detail pressed from inside an editor brings the three tiles back.
    if (level === "detail" && this._journeyLevel() === "detail") { this.detailHub = true; return this.render(); }
    if (level === this._journeyLevel()) return;
    if (level === "find" || level === "play") {
      if (this.stage === "jam" || !this.doc.jam_session) return;
      this._stopForScopeChange();
      return this._go("jam");
    }
    if (level === "shape") return this.stage === "jam" ? this._captureDirection() : this._go("song");
    if (this.stage === "jam") return;
    if (level === "detail") { this.detailHub = true; return this._go(this._capturedDevelopmentStage()); }
    if (level === "share") return this._go("keep");
  }

  _songOverviewHtml() {
    if(this.doc?.capture_notes?.melody_field){const cards=normalizeSongCards(this.doc.song_cards);return cards.length>1?`<details><summary>More of this take</summary><div class="pf-row">${cards.map((c,i)=>this._btn(`melody-part:${i}`,`Passage ${i+1}`)).join('')}</div></details>`:'';}
    const cards = normalizeSongCards(this.doc.song_cards);
    if(this.doc.song_path?.step==='melody') return `<nav class="pf-row" aria-label="Tune pages"><strong>Your tune</strong><details><summary>More of your playing</summary>${cards.length>1?cards.map((c,i)=>this._btn(`melody-part:${i}`,`Page ${i+1}`)).join(''):''}${this._btn('to-song','See all my playing')}</details></nav>`;
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
    if(stage!=='jam')this.melodyField=null;
    if (stage !== 'tune') this.melodyFocus = false;
    if (!["beat", "tune", "under"].includes(stage)) this.detailHub = false;
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
    this.detailsOpen = false;
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
    if(this.melodyField?.dragging){this.melodyField.needsRender=true;this.melodyField.paint();return;}
    const oldPitchScroll=this.root.querySelector?.(".pf-pitch-scroll");
    const oldPitchView=oldPitchScroll ? {top:oldPitchScroll.scrollTop,...this.phraseRange} : null;
    this.eventTimingOpen=this.root.querySelector('.pf-event-timing')?.open??this.eventTimingOpen;
    this.demoToolsOpen=this.root.querySelector('.pf-demo-tools:not(.pf-song-more)')?.open??this.demoToolsOpen;
    this.songMoreOpen=this.root.querySelector('.pf-song-more')?.open??this.songMoreOpen;
    this.sheetOpen=this.root.querySelector('.pf-sheet-box')?.open??this.sheetOpen;
    this.shareMoreOpen=this.root.querySelector('.pf-share-more')?.open??this.shareMoreOpen;
    this.playedTakeOpen=this.root.querySelector('.pf-played-take')?.open??this.playedTakeOpen;
    this.nameIdeasOpen=this.root.querySelector('.pf-name-ideas')?.open??this.nameIdeasOpen;
    this.participationOpen=this.root.querySelector('.pf-participation')?.open??this.participationOpen;
    this.startOptionsOpen=this.root.querySelector('.pf-other-ways')?.open??this.startOptionsOpen;
    this.startCycleOpen=this.root.querySelector('.pf-cycle-choice')?.open??this.startCycleOpen;
    this.melodyPadsOpen=this.root.querySelector('.pf-melody-pads')?.open??this.melodyPadsOpen;
    this.refineMoreOpen=this.root.querySelector('.pf-refine-more')?.open??this.refineMoreOpen;
    if(this.melodyField)this.melodyField.moreOpen=this.root.querySelector('.pf-melody-keep-more')?.open??this.melodyField.moreOpen;
    document.body.classList.toggle('pf-listening',this.stage==='start'||(this.stage==='jam'&&this.doc?.jam_session?.showcase_version===1));
    const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const focusKey = document.activeElement?.dataset?.key;
    // A redraw right after a screen change must not throw keyboard users back to the page top.
    const focusOnHeading = document.activeElement?.classList?.contains?.("pf-heading");
    if (this.allAtOnce && this.doc && this.stage !== "start" && this.editingCard == null) {
      this.root.innerHTML = this._renderAllAtOnce();
    } else if (this.stage === "start") {
      this.root.innerHTML = this._renderStart();
    } else if (this.stage === "jam") {
      this.root.innerHTML = this._renderJam();
    } else if (this.detailHub && ["beat", "tune", "under"].includes(this.stage)) {
      this.root.innerHTML = this._renderDetailHub();
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
    const wheelJam = this.stage === 'jam' && (this.doc?.jam_session?.music_field || this.doc?.jam_session?.exploration_map);
    if (!this.melodyField && !wheelJam && this.stage !== "start" && this.doc && this.partComparison?.kind!=='melody' && !(this.stage==='tune'&&this.tuneGrid.eventEditor)) this.root.insertAdjacentHTML("afterbegin", this._journeyHtml());
    if(this.stage!=='start'&&(this.melodyField||!(this.stage==='jam'&&(this.doc?.jam_session?.music_field||this.doc?.jam_session?.exploration_map))))this.root.insertAdjacentHTML('beforeend',`<section aria-label="Help and access"><div class="pf-row">
      ${this._btn('settings',this.comfortOpen?'Close help':'Help','pf-btn pf-small',`aria-expanded="${Boolean(this.comfortOpen)}"`)}</div>${this.comfortOpen?this._helpPanelHtml():''}</section>`);
    if(this.partComparison && this.stage==='song'){this.root.insertAdjacentHTML('afterbegin',this._comparisonHtml());this._syncPartAudition();}
    if (this.pianoMessage === "The sounds did not load. Press Play to try again."
      && this.app.scheduler?.masterBus?.piano && !this.app.scheduler.masterBus.disposed) this.pianoMessage = "";
    if (this.pianoMessage) this.root.insertAdjacentHTML('afterbegin', `<p role="status">${esc(this.pianoMessage)}</p>`);
    if (this.deleteMessage) this.root.insertAdjacentHTML('afterbegin', `<p role="status">${esc(this.deleteMessage)}</p>`);
    if (this.stage !== 'start' && (isSampledPatch(this.doc?.lead_patch_id) || this.app.compiledSong?.events?.some(n => isSampledPatch(n.patch_id)))
      && (!this.app.scheduler?.masterBus?.piano || this.app.scheduler.masterBus.disposed))
      this._loadSoundsQuietly();
    if (this.draftSaveFailed) this.root.insertAdjacentHTML("afterbegin",
      '<p role="alert">Your new edits are not saved. Keep this page open. Use Download project. Keep that file.</p>'
      + this._btn('dl-project', 'Download project', 'pf-btn'));
    else if (this.stage !== "start" && typeof window !== "undefined" && storageNearlyFull(window.localStorage)) this.root.insertAdjacentHTML("afterbegin",
      `<p role="status">${NEARLY_FULL_WORDS}</p>` + this._btn('dl-project', 'Download project', 'pf-btn'));
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
    if (focusOnHeading && !focusKey) {
      const heading = this.root.querySelector(".pf-heading");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
    const pitchScroll=this.root.querySelector?.('.pf-pitch-scroll');
    if(pitchScroll) {
      if(oldPitchView?.rowHeight&&oldPitchView.role===(this.eventRole||'lead')&&oldPitchView.card===this.editingCard)
        pitchScroll.scrollTop=oldPitchView.top+(this.phraseRange.high-oldPitchView.high)*this.phraseRange.rowHeight;
      else {const chosen=this.root.querySelector?.('[data-phrase-note][aria-pressed="true"]');if(chosen)pitchScroll.scrollTop=Math.max(0,chosen.offsetTop-pitchScroll.clientHeight/2);}
    }
    this._paintPlayhead();
    this._paintJamPads();
    this._paintJamAnswer();
    this._paintLiveScore?.(Boolean(this.app?.scheduler?.isPlaying));
    if(this.melodyField){
      const field=this.melodyField;
      field.onGestureEnd=()=>{if(this.melodyField===field&&field.needsRender){field.needsRender=false;this.render();this.root.querySelector('[data-melody-disk]')?.focus({preventScroll:true});}};
      field.bind(this.root);
    }
    // The pads were rebuilt: the next tick must paint their lights again, even if the read has not changed.
    this._heardPadKey=null;if(this.adoption)this.adoption.text='';
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo(scrollX, scrollY);
    }
  }

  /**
   * Called from the app's animation frame with the latest heard step (or null between steps).
   * Updates only CSS classes on the current screen, never rebuilding the DOM.
   */
  onTick(stepEvt, isPlaying) {
    this.visualPosition = isPlaying ? (stepEvt?.position ?? stepEvt?.step ?? null) : null;
    this._syncPartAudition();
    if(this.melodyField){this.melodyField.paint();this._paintJamPads();return;}
    this.soundingNotes = isPlaying ? (stepEvt?.sounding || this.soundingNotes || []) : [];
    if (stepEvt?.sounding) this.soundingParts = new Set(stepEvt.sounding.map(e => partOfRole(e.role)).filter(Boolean));
    else if (!isPlaying) this.soundingParts = new Set();
    this._showBandAnswers(stepEvt);
    this._paintSheet();
    this._paintTimeline();
    this._paintListeningVisual(isPlaying);
    this._paintLiveScore?.(isPlaying);
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
    const cursor=this.root.querySelector('.pf-phrase-cursor') || this.root.querySelector('.pf-band-cursor');
    if(cursor){
      const ranges=songCardRanges(this.doc.song_cards,4*stepsPerBar(this.doc),this.doc.global_context.bpm,stepsPerBar(this.doc));
      const start=ranges[this.editingCard]?.start_step||0;
      const quiet = this.comfort?.lessMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const absolute = !quiet && Number.isFinite(this.visualPosition) ? this.visualPosition : this.playhead?.step;
      const step=this.playhead && Number.isFinite(absolute) ? absolute-start : null;
      const first=this.phraseRange?.startStep??this.eventTuneBar*stepsPerBar(this.doc);
      const width=this.phraseRange?.stepCount||stepsPerBar(this.doc);
      cursor.hidden=step==null||step<first||step>=first+width;
      const status=this.root.querySelector('#pf-phrase-status');
      const message=step==null?'Stopped. Press Play to hear your music.':`Playing bar ${Math.floor(step/stepsPerBar(this.doc))+1}${cursor.hidden?' outside this zoom. Choose Whole part to follow.':'.'}`;
      if(status&&status.textContent!==message)status.textContent=message;
      if(!cursor.hidden)cursor.style.left=`${(step-first)/width*100}%`;
      for(const marker of this.root.querySelectorAll('.pf-band-cursor')){marker.hidden=cursor.hidden;marker.style.left=cursor.style.left;}
      for(const mark of this.root.querySelectorAll('[data-band-onset]'))mark.classList.toggle('pf-band-playing',step!=null&&step>=Number(mark.dataset.bandOnset)&&step<Number(mark.dataset.bandEnd));
      const role=this.eventRole||'lead';
      for(const note of this.root.querySelectorAll('[data-phrase-note]')) {
        const id=note.dataset.phraseNote;
        const playing=(this.soundingNotes||[]).some(event=>event.role===role
          && (this.editingCard==null||event.card===this.editingCard)
          && (event.id===id||event.id===`${id}-variation-c${this.editingCard}`));
        note.classList.toggle('pf-note-playing',playing);
        this.root.querySelector(`[data-note-duration="${CSS.escape(id)}"]`)?.classList.toggle('pf-note-playing',playing);
      }
    }

    const textEls = this.root.querySelectorAll(".pf-bar-text");
    if (!this.playhead) {
      for (const marker of this.root.querySelectorAll('[data-block-progress]')) marker.style.display = 'none';
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
    for (const block of this.root.querySelectorAll('.pf-song-block')) {
      const grouped=block.querySelectorAll('[data-group-page]');
      for(const page of grouped){const mark=page.querySelector('[data-block-progress]');if(mark)mark.style.display='none';}
      const marker = grouped.length ? block.querySelector(`[data-group-page="${cardIdx}"] [data-block-progress]`) : block.querySelector('[data-block-progress]');
      const active = (block.dataset.groupCards||block.dataset.card).split(',').map(Number).includes(cardIdx) && Boolean(this.app.scheduler?.isPlaying);
      block.classList.toggle('now',active);
      if (!marker) continue;
      marker.style.display = active ? '' : 'none';
      if (active && currentRange) {
        const x = (this.playhead.step - currentRange.start_step) / (currentRange.end_step - currentRange.start_step) * 240;
        marker.setAttribute('x1', x); marker.setAttribute('x2', x);
      }
    }
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
    const library = songLibrary(window.localStorage, {trash:!!this.libraryTrash});
    const rows = library.songs;
    const selected = rows.find(row=>row.id===this.librarySelection);
    const pages=Math.max(1,Math.ceil(rows.length/SAVES_PER_PAGE));
    const shown=rows.slice(((this.savePage||0)%pages)*SAVES_PER_PAGE,(((this.savePage||0)%pages)+1)*SAVES_PER_PAGE);
    const tiles=shown.map(row=>{
      const cart=summarizeCartridge(row.draft||row.saved);
      return this._choice(`library-select:${row.id}`,`<span class="pf-cover" aria-hidden="true">${icon(KIT_ICONS[cart.kit]||'note')}</span><strong>${esc(row.title)}</strong><span class="pf-sub">${this.libraryTrash?'In Trash':row.unfinished?'Unfinished edits':'Saved'} - ${cart.parts} parts</span>`,row.id===selected?.id,'pf-btn pf-library-tile');
    }).join('');
    const controls=selected ? (this.libraryTrash
      ? this._btn(`library-restore:${selected.id}`,'Restore song','pf-btn pf-next')
      : `${this._btn(`continue:${selected.id}`,'Load song','pf-btn pf-next')}
        ${this._btn(`library-copy:${selected.id}`,'Duplicate','pf-btn')}
        ${selected.saved&&selected.unfinished?this._btn(`library-checkpoint:${selected.id}`,'Open saved copy','pf-btn'):''}
        ${this._btn(`delete:${selected.id}`,this.confirm.armed===`delete:${selected.id}`?'Confirm move to Trash':'Delete','pf-btn')}`) : '';
    const resume=`<section class="pf-song-library" aria-label="Songs">
      <div class="pf-row"><h2>${this.libraryTrash?'Trash':'Your songs'}</h2>${this._btn('library-trash',this.libraryTrash?'Back to songs':'Trash','pf-btn pf-small')}${this._btn('open-project','Import song','pf-btn pf-small')}</div>
      ${!library.ok?'<p role="alert">Saved songs could not be read. Nothing was changed. Keep this page open and download any unsaved project.</p>':''}
      <div class="pf-library-grid">${tiles||'<p>No songs here yet.</p>'}</div>
      ${pages>1?this._btn('more-saves','More songs','pf-btn pf-small'):''}
      ${selected?`<div class="pf-library-actions" aria-label="Selected song"><strong>${esc(selected.title)}</strong><div class="pf-row">${controls}</div>${selected.saved&&selected.unfinished&&!this.libraryTrash?'<p>The latest edits load first. Open saved copy keeps those edits safe.</p>':''}</div>`:''}
      ${this.libraryTrash?'<p>Trash keeps recovery copies on this device. It does not free storage space.</p>':''}
      ${this.deleteMessage?`<p role="status">${esc(this.deleteMessage)}</p>`:''}
    </section>`;
    if(this.libraryOpen) return `<div class="pf-stage pf-start">
      <div class="pf-row">${this._btn('library-close','Back','pf-btn')}${this._btn('listen-circle','New song','pf-btn pf-next')}</div>
      ${resume}
      <input id="pf-import-file" type="file" accept=".json,.musicxml,.xml" hidden />
    </div>`;
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
        <p class="pf-sub pf-for-parents">For kids and new players. Your song stays on this device. ${this._btn('parents','For parents','pf-btn pf-small pf-link')}</p>
        <div class="pf-row">${this._btn("listen-circle", "Listen and explore", "pf-btn pf-next",this.pianoLoading?'disabled':'')}</div>
        <p class="pf-sub">Press Listen. Then tap a pad or play A S D F to join in.</p>
        ${pendingJam}
        <div class="pf-row pf-start-songs">${this._btn('library-open','Your songs','pf-btn')}</div>
        <details class="pf-demo-tools" ${this.demoToolsOpen?'open':''}><summary data-key="demo-tools">More</summary>
        <details class="pf-other-ways" ${this.startOptionsOpen?'open':''}><summary data-key="start-options">Other ways to begin</summary>${this._btn("listen-explore","Hear the band","pf-btn pf-small")}
        <details class="pf-cycle-choice" ${this.startCycleOpen?'open':''}><summary data-key="cycle-options">Beat cycle for a new song</summary><p>Four beats or three beats in each bar. This choice starts a new song.</p>
        <div class="pf-row">${this._btn('new-cycle:16','Four beats','pf-btn pf-small',`aria-pressed="${this.newCycle!==12}"`)}${this._btn('new-cycle:12','Three beats','pf-btn pf-small',`aria-pressed="${this.newCycle===12}"`)}</div></details>
        ${this._legendHtml()}
        ${this._instrumentPickerHtml()}
        <div class="pf-row">${this._btn("hum-door", `${icon("mic")} Hum an idea`, "pf-btn pf-small")}</div>
        </details>
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

  _instrumentPickerHtml({ changing = false, melodyOnly = false } = {}) {
    const group = melodyOnly && this.instrumentGroup === "drums" ? "keys" : this.instrumentGroup || "keys";
    const page = instrumentPage(group, this.instrumentPage || 0);
    const groups = INSTRUMENT_GROUPS.filter(item=>!melodyOnly||item.id!=="drums").map(item => this._choice(`instrument-group:${item.id}`, esc(item.label), item.id === group, "pf-btn pf-small")).join("");
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

  _liveScoreData() {
    if (!this.doc || this._visualMode?.() === 'off') return null;
    const scheduler = this.app?.scheduler;
    const compiled = this.app?.compiledSong || scheduler?.compiledSong;
    const spb = stepsPerBar(this.doc);
    if (this.stage === 'jam') {
      const backing = scheduler?.activeJamBacking?.();
      const totalSteps = compiled?.total_steps || 4 * spb;
      const bpm = Number(backing?.bpm || compiled?.bpm || this.doc?.global_context?.bpm || 100);
      const swing = Number(compiled?.swing ?? this.doc?.global_context?.swing ?? 0.5);
      const baseEvents = backing?.events || compiled?.events || this.doc?.notes || [];
      const docOwn = (this.doc?.notes || []).filter(n => n?.provenance === 'user_placed');
      const liveOwn = [...docOwn, ...extractLivePersonalEvents(scheduler, { totalSteps, bpm })];
      const model = buildLiveScoreModel({
        events: baseEvents,
        liveUserEvents: liveOwn,
        totalSteps,
        startStep: 0,
        stepsPerBar: spb,
        bpm,
        swing,
        bandBalance: 1,
        spotlightRole: scheduler?.spotlightRole || null,
      });
      return { model, startStep: 0, totalSteps, bpm, caption: 'Live band score. Bright edge marks your notes.' };
    }
    const ranges = songCardRanges(this.doc?.song_cards, 4 * spb, this.doc?.global_context?.bpm || 100, spb);
    const activeCard = this.stage === 'tune' && this.editingCard != null
      ? this.editingCard
      : (ranges.find(r => this.playhead && this.playhead.step >= r.start_step && this.playhead.step < r.end_step)?.index ?? 0);
    const range = ranges[activeCard] || { start_step: 0, end_step: 4 * spb };
    const startStep = range.start_step || 0;
    const totalSteps = Math.max(spb, (range.end_step || 4 * spb) - startStep);
    const bpm = Number(compiled?.bpm || this.doc?.global_context?.bpm || 100);
    const swing = Number(compiled?.swing ?? this.doc?.global_context?.swing ?? 0.5);
    const model = buildLiveScoreModel({
      events: compiled?.events || this.doc?.notes || [],
      totalSteps,
      startStep,
      stepsPerBar: spb,
      bpm,
      swing,
      bandBalance: this.doc?.capture_notes?.melody_field?.context?.bandBalance === 1 ? 0.45 : 1,
      spotlightRole: scheduler?.spotlightRole || null,
    });
    const caption = this.stage === 'keep'
      ? 'Your song score. It moves when the music plays.'
      : 'Full band score. Bright edge marks your notes.';
    return { model, startStep, totalSteps, bpm, caption };
  }

  _liveScoreHtml() {
    const data = this._liveScoreData();
    return data ? liveScoreStripHtml(data.model, { caption: data.caption }) : '';
  }

  _paintLiveScore(isPlaying) {
    const svg = this.root?.querySelector?.('[data-live-score]');
    if (!svg) return;
    const data = this._liveScoreData();
    if (!data) return;
    const scheduler = this.app?.scheduler;
    const quiet = isCalmVisuals(Boolean(this.comfort?.lessMotion));
    const jamPos = this.stage === 'jam' ? scheduler?.activeJamContext?.({ readOnly: true })?.position : null;
    const positionSteps = isPlaying ? (this.visualPosition ?? jamPos ?? this.playhead?.step ?? null) : null;
    const frame = computeLiveScoreFrame({
      isPlaying: Boolean(isPlaying) && positionSteps != null,
      positionSteps,
      startStep: data.startStep,
      windowSteps: data.totalSteps,
      bpm: data.bpm,
      quiet,
    });
    const sounding = new Set();
    if (isPlaying) {
      for (const e of this.soundingNotes || []) if (e?.id) sounding.add(e.id);
      const now = Number(scheduler?.audioCtx?.currentTime || 0) - Number(scheduler?.audioCtx?.outputLatency || scheduler?.audioCtx?.baseLatency || 0);
      for (const n of scheduler?.visualNotes || []) if (n?.time <= now && n?.end > now && n.event?.id) sounding.add(n.event.id);
    }
    syncLiveScoreSvg(svg, {
      model: data.model,
      frame,
      soundingIds: sounding,
      includeMfAttrs: false,
      showLaneLabels: true,
    });
  }

  _liveJamPads() {
    const context = this.doc.jam_session?.dynamic_keys ? this.app.scheduler.activeJamContext?.({ readOnly: true }) : null;
    if (this.doc.jam_session?.live_keys) return melodyPads(this.doc, context, { octaveShift: this.padOctave || 0 });
    return this.doc.jam_session?.dynamic_keys ? dynamicJamPads(this.doc, context) : jamPads(this.doc);
  }

  // Optional, off by default, remembered on this device. For people who read music.
  _padNoteNamesOn() {
    if (this.padNoteNames === undefined) this.padNoteNames = loadPadNoteNames(globalThis.localStorage);
    return this.padNoteNames === true;
  }

  _padNoteNames(pads) {
    const g = this.doc?.global_context || {};
    return padNoteNames(pads, { rootPc: g.root_pc, minor: /minor|dorian|phrygian|aeolian/.test(g.scale_type || "") });
  }

  // Keys can follow the band's chords, so the names are refreshed whenever the pads' notes change.
  _paintPadNoteNames() {
    if (!this._padNoteNamesOn() || !this.doc?.jam_session) return;
    const marks = this.root?.querySelectorAll?.('.pf-jam-pad [data-pad-note]');
    if (!marks?.length) return;
    const pads = this._liveJamPads(), sig = pads.map(p => p.midi).join(','), names = this._padNoteNames(pads);
    if (this._padNoteSig === sig) return;
    this._padNoteSig = sig;
    marks.forEach(mark => {
      const button = mark.closest('.pf-jam-pad'), index = Number(button?.dataset.key?.split(':')[1]), pad = pads[index], name = pad && names[index];
      if (!name) return;
      if (mark.textContent !== name) mark.textContent = name;
      button.setAttribute('aria-label', `${spokenNoteName(name)}, ${pad.label}, key ${pad.key.toUpperCase()}${pad.home ? ', a home note' : ''}`);
    });
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

  // Phase 14.3b: the band shows its hand. After a settled phrase, one read and one move; the person
  // takes it or leaves it, and Undo is one press. Nothing here changes the band on its own.
  _serviceBandHand() {
    const scheduler=this.app?.scheduler,take=scheduler?.performanceTake,now=scheduler?.audioCtx?.currentTime;
    if(this.stage!=='jam'||!scheduler?.isPlaying||!take||!Number.isFinite(now)){if(this.bandHand){this.bandHand=null;this._paintBandHand();}return;}
    // A new take (after Stop, Undo or a style change that restarts) counts from one again.
    if(this.bandHandTake!==take){this.bandHandTake=take;this.bandHandThrough=0;}
    const notes=ownPhrase(take,now);
    const last=notes.at(-1)?.occurrence??null;
    if(last===null||last<=(this.bandHandThrough||0)||!phraseSettled(notes,now,take.bpm))return;
    const jam=this.doc.jam_session||{};
    const hand=readHand(take,now,{root:this.doc.global_context?.root_pc,swing:this.doc.global_context?.swing,density:jam.density});
    this.bandHandThrough=last;
    this.bandHand=hand;
    this._paintBandHand();
  }

  // Phase 15.1: the heard meter. What the band reads from your playing, shown as it happens, before
  // any button: a bar from room to a lot, and a light on the pad you lean on. It changes nothing.
  _heardMeterHtml() {
    const read=this.heardRead||null,activity=read?read.activity:.5;
    return `<div class="pf-heard" id="pf-heard" role="img" aria-label="${esc(heardWords(read))}" data-settled="${Boolean(read?.settled)}">
      <span class="pf-heard-end">Room</span><span class="pf-heard-track"><span class="pf-heard-fill" data-heard-fill style="width:${Math.round(activity*100)}%"></span><span class="pf-heard-mark" data-heard-mark style="left:${Math.round(activity*100)}%"></span></span><span class="pf-heard-end">A lot</span>
    </div>${this._receiptHtml()}<p class="pf-sub pf-adopted" id="pf-adopted" role="status">${esc(this.adoption?.text||'')}</p>`;
  }

  // Phase 15.2: a receipt in pictures. Every change the band makes because of the person shows, for
  // one bar, what they did and what the band did, with the same glyph on both sides of the arrow.
  _receiptHtml() {
    const r=this.receipt;
    return `<div class="pf-receipt" id="pf-receipt" role="status"${r?'':' hidden'}>${r?`<span class="pf-receipt-cell pf-receipt-did" data-glyph="${esc(r.glyph)}"><span class="pf-receipt-glyph" aria-hidden="true"></span>${esc(r.did)}</span><span class="pf-receipt-arrow" aria-hidden="true">→</span><span class="pf-receipt-cell pf-receipt-so" data-part="${esc(r.part)}"><span class="pf-receipt-glyph" aria-hidden="true"></span>${esc(r.so)}</span>`:''}</div>`;
  }

  _showReceipt(did,so,{glyph='many',part='band',minor=false}={}) {
    const bpm=Number(this.doc?.global_context?.bpm)||100;
    // An answer is minor: it may not hide a move the person just took, and the same card twice is one card.
    const live=this.receipt&&this.receipt.until>performance.now();
    if(live&&((minor&&!this.receipt.minor)||(this.receipt.did===did&&this.receipt.so===so)))return;
    this.receipt={did,so,glyph,part,minor,until:performance.now()+Math.max(2500,4*60000/bpm)};
    const box=this.root?.querySelector?.('#pf-receipt');
    if(box)box.outerHTML=this._receiptHtml();
    this.app?._announce?.(`${did} ${so}`);
  }

  _paintReceipt() {
    if(this.receipt&&this.receipt.until<=performance.now()){this.receipt=null;const box=this.root?.querySelector?.('#pf-receipt');if(box)box.outerHTML=this._receiptHtml();}
  }

  /** Phase 15.2: when the band adopts the person's phrase, say so for as long as it keeps it, count the bars, and light the pads it uses. */
  _paintAdoption() {
    const s=this.app?.scheduler,commit=s?.lastJamLeadCommit,lead=s?.activeJamLead;
    const answered=Boolean(lead?.events?.some(e=>e.evolution?.answered));
    if(!s?.isPlaying||!commit||!lead||!answered){
      if(this.adoption){this.adoption=null;this._paintAdoptionDom(new Set());}
      return;
    }
    if(!this.adoption||this.adoption.planVersion!==lead.planVersion){
      this.adoption={planVersion:lead.planVersion,since:commit.audioTime,bar:0,text:''};
    }
    const barSec=(60/(Number(this.doc?.global_context?.bpm)||100))*4;
    const bar=Math.max(1,Math.floor(((s.audioCtx?.currentTime||0)-this.adoption.since)/barSec)+1);
    // The band opens its phrase on the person's note; it does not play their whole tune, so it does not say so.
    const text=`The band's tune starts on your note. Bar ${bar}.`;
    if(text!==this.adoption.text){this.adoption.text=text;this.adoption.bar=bar;
      // Light the note the band took from the person, not every note of its lead.
      const pcs=new Set(lead.events.map(e=>e.evolution?.answered?.midi).filter(Number.isFinite).map(midi=>((Math.round(midi)%12)+12)%12));
      this._paintAdoptionDom(pcs);
    }
  }

  _paintAdoptionDom(pcs) {
    const line=this.root?.querySelector?.('#pf-adopted');
    if(line&&line.textContent!==(this.adoption?.text||''))line.textContent=this.adoption?.text||'';
    const pads=this._liveJamPads();
    this.root?.querySelectorAll?.('.pf-jam-pad').forEach((button,i)=>{const pad=pads[i];button.classList.toggle('pf-pad-adopted',Boolean(pad&&Number.isFinite(pad.midi)&&pcs.has(((pad.midi%12)+12)%12)));});
  }

  /** Phase 15.2: Read this shows that it is reading, for a person who cannot hear the voice well. */
  _readingToast(on) {
    let toast=this.root?.querySelector?.('.pf-reading');
    if(!on){toast?.remove();return;}
    if(!toast&&this.root){toast=document.createElement('p');toast.className='pf-sub pf-reading';toast.setAttribute('role','status');this.root.prepend(toast);}
    if(toast)toast.textContent='Reading this screen.';
    this.readingUntil=performance.now()+1500;
    // Its own timer: the music tick does not run on the start screen or while stopped.
    clearInterval(this.readingTimer);
    this.readingTimer=setInterval(()=>{
      if(performance.now()<=this.readingUntil||(typeof window!=='undefined'&&window.speechSynthesis?.speaking))return;
      clearInterval(this.readingTimer);this.readingUntil=null;this._readingToast(false);
    },250);
  }

  _paintHeard() {
    const box=this.root?.querySelector?.('#pf-heard');
    const scheduler=this.app?.scheduler;
    const read=this.stage==='jam'&&scheduler?.isPlaying?performanceRead(scheduler.performanceTake,scheduler.audioCtx?.currentTime):null;
    this.heardRead=read;
    // Phase 15.2 housekeeping on the same tick: receipts expire, adoption is watched, Calm silences the fill.
    scheduler?.setQuietOrnaments?.(Boolean(this.comfort?.lessMotion));
    this._paintReceipt();this._paintAdoption();
    if(!box)return;
    const pct=`${Math.round((read?read.activity:.5)*100)}%`;
    const fill=box.querySelector('[data-heard-fill]'),mark=box.querySelector('[data-heard-mark]');
    if(fill&&fill.style.width!==pct)fill.style.width=pct;
    if(mark&&mark.style.left!==pct)mark.style.left=pct;
    const words=heardWords(read);
    if(box.getAttribute('aria-label')!==words)box.setAttribute('aria-label',words);
    box.dataset.settled=String(Boolean(read?.settled));
    // The pad you lean on lights up; it is the pitch class, so the light follows an octave shift.
    // Pads are recomputed only when the read's note changes, not every frame.
    const padKey=read?.settled?`${read.topPitchClass}|${read.topShare>=.34}|${this.padOctave||0}`:'none';
    if(this._heardPadKey===padKey)return;
    this._heardPadKey=padKey;
    const pads=this._liveJamPads();
    const buttons=this.root.querySelectorAll('.pf-jam-pad');
    buttons.forEach((button,i)=>{const pad=pads[i];const lit=Boolean(read?.settled&&pad&&Number.isFinite(pad.midi)&&((pad.midi%12)+12)%12===read.topPitchClass&&read.topShare>=.34);button.classList.toggle('pf-pad-leaned',lit);});
  }

  // Phase 15.1: direction glow. The scenes the lean points at brighten on the ring, the others dim,
  // and a short arrow on the ring points at the brightest. Same weights Next family uses.
  _paintDirectionGlow(circle,currentId) {
    const ticks=circle.querySelectorAll('[data-scene]'),arrow=circle.querySelector('[data-circle-arrow]');
    const lean=this.heardRead?.settled?this.heardRead.lean:0;
    if(!lean){ticks.forEach(t=>{t.classList.remove('pf-tick-toward','pf-tick-away');t.style.opacity='';});if(arrow)arrow.hidden=true;this._glowKey=null;return;}
    const bpm=this.doc.global_context?.bpm,currentIndex=SCENE_CATALOGUE.findIndex(s=>s.id===currentId);
    const reach=new Set([...circleFamilyScenes(currentId,0),...circleFamilyScenes(currentId,1),...circleFamilyScenes(currentId,-1)]);
    const key=`${Math.sign(lean)}|${currentId}|${bpm}`;
    if(this._glowKey!==key){
      const weight=this._explorationBias(currentIndex);
      this._glow={key,weights:new Map([...reach].filter(id=>sceneTempoAllowed(id,bpm)).map(id=>[id,weight(SCENE_CATALOGUE.findIndex(s=>s.id===id))]))};
      this._glowKey=key;
    }
    let best=null,bestW=1;
    ticks.forEach(t=>{const id=t.dataset.scene,w=this._glow.weights.get(id);
      const toward=w>1.15,away=w<.85;t.classList.toggle('pf-tick-toward',toward);t.classList.toggle('pf-tick-away',away);
      t.style.opacity=w===undefined?'':String(Math.max(.25,Math.min(1,.55+(w-1)*.45)));
      if(w>bestW+1e-9&&id!==currentId){best=id;bestW=w;}});
    if(arrow){
      if(!best){arrow.hidden=true;return;}
      const from=circlePosition(currentId),to=circlePosition(best);
      const angle=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
      arrow.hidden=false;arrow.style.left=`${from.x*100}%`;arrow.style.top=`${from.y*100}%`;arrow.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;
      const name=SCENE_CATALOGUE.find(s=>s.id===best)?.name||'';
      if(arrow.dataset.toward!==name)arrow.dataset.toward=name;
    }
  }

  _bandHandHtml() {
    const hand=this.bandHand;
    return `<div class="pf-band-hand" id="pf-band-hand" role="status">${hand?`<p class="pf-sub pf-band-hand-heard">I heard: ${esc(hand.heard)}</p>
      <div class="pf-row">${this._btn('hand-take',esc(hand.move),'pf-btn pf-small')}${this._btn('hand-skip','Not now','pf-btn pf-small pf-link')}</div>`:''}</div>`;
  }

  _paintBandHand() {
    const box=this.root?.querySelector?.('#pf-band-hand');
    if(box)box.outerHTML=this._bandHandHtml();
  }

  _handKey(key) {
    const hand=this.bandHand;
    this.bandHand=null;
    if(key==='hand-skip'||!hand){this._paintBandHand();return true;}
    if(hand.kind==='song'){this._paintBandHand();this.root?.querySelector?.('[data-key="capture-direction"]')?.click();return true;}
    this._pushUndo();
    const next=JSON.parse(JSON.stringify(this.doc));
    if(hand.kind==='root')next.global_context.root_pc=hand.value;
    if(hand.kind==='swing')next.global_context.swing=hand.value;
    this._acceptJamDoc(setJamDirection(next,hand.kind==='density'?{density:hand.value}:{}));
    // Phase 15.2: the receipt and the one-beat confirmation. The Undo message is announced last so
    // the receipt cannot overwrite the way back.
    const receipt=hand.kind==='root'?['You leaned on a note.',`Band: ${NOTE_NAMES_FOR_RECEIPT[hand.value]} is home.`,'lean','tune']
      :hand.kind==='swing'?['You played off the beat.','Band: swing.','offbeat','drums']
      :hand.move==='More space'?['You held notes.','Band: more space.','hold','drums']:['You played a lot.','Band: more movement.','many','drums'];
    this._showReceipt(receipt[0],receipt[1],{glyph:receipt[2],part:receipt[3]});
    this.app.scheduler?.requestConfirmFill?.();
    this.app._announce(`${hand.move}: done at the next bar. Undo brings it back.`);
    this.render();
    return true;
  }

  // Phase 14.3: Next family lands on the scene in that family that matches how the person is
  // playing. Busy playing lands on the family's busiest scene, held playing on its calmest; with
  // nothing to go on it lands on the family's first scene, as before. Next style stays a plain step.
  _circleFamilyChoice(id,delta) {
    const scenes=circleFamilyScenes(id,delta),bpm=this.doc.global_context?.bpm;
    const weight=this._explorationBias(SCENE_CATALOGUE.findIndex(scene=>scene.id===id));
    let best=scenes[0],bestWeight=1;
    if(this.explorationLean?.lean)for(const sceneId of scenes){
      if(!sceneTempoAllowed(sceneId,bpm))continue;
      const w=weight(SCENE_CATALOGUE.findIndex(scene=>scene.id===sceneId));
      if(w>bestWeight+1e-9){best=sceneId;bestWeight=w;}
    }
    const words=leanWords(this.explorationLean?.lean);
    const line=this.root?.querySelector?.('#pf-lean-words');
    if(line)line.textContent=words;else if(words)this.jamMessage=words;
    // Phase 15.2: when the person's playing chose the landing, say so in pictures and confirm with a fill.
    if(this.explorationLean?.lean&&best!==scenes[0]){
      const busy=this.explorationLean.lean>0;
      this._showReceipt(busy?'You played a lot.':'You held notes.','Band: new style.',{glyph:busy?'many':'hold',part:'band'});
      this.app?.scheduler?.requestConfirmFill?.();
    }
    return best;
  }

  _requestCircle(id,gesture,field) {
    if(this.stage!=='jam'||!this.doc.jam_session?.exploration_map||!CIRCLE_SCENES.includes(id))return;
    if(!gesture||!this.fieldGesture)this._pushUndo();
    this.fieldGesture=gesture;this.exploreTour=null;
    field=this.doc.jam_session.exploration_map==='catalogue-circle-v2'?(field===undefined?circleFieldForScene(id):field):null;
    this.circleIntent={id,field,song:this.doc.id,stop:this.app.scheduler.stopGeneration};this._paintCircle();
  }

  _paintCircle() {
    const coverage=this.root?.querySelector('[data-melody-entry-coverage]');if(coverage){const text=this._melodyEntryHint();if(coverage.textContent!==text)coverage.textContent=text;}
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
    // A family name fades while a marker sits on it, so the marker never hides or touches readable text.
    const marks=['requested','realized'].map(kind=>circle.querySelector(`[data-circle-${kind}]`)).filter(m=>m&&!m.hidden).map(m=>({x:parseFloat(m.style.left)/100,y:parseFloat(m.style.top)/100}));
    const size=circle.clientWidth||340; // names are a fixed pixel size, so nearness is measured in pixels
    circle.querySelectorAll?.('.pf-circle-family').forEach(label=>{const x=parseFloat(label.style.left)/100,y=parseFloat(label.style.top)/100;
      const near=marks.some(m=>Math.abs(m.x-x)*size<52&&Math.abs(m.y-y)*size<34);if((label.dataset.near==='true')!==near)label.dataset.near=String(near);});
    const describe=(scene,field)=>field?.version===5?musicFieldDescription(field):name(scene);
    const title=circle.querySelector('[data-circle-title]');if(title)title.textContent=describe(id,requestedField);
    const blend=this.root.querySelector('[data-circle-blend]');if(blend&&document.activeElement!==blend)blend.value=requestedField?.version===5?requestedField.x:.5;
    const label=this.root.querySelector('#pf-current-direction');
    if(label){const mode=requestedField?.version===5?'Scored blend':'Boundary change';const text=!scheduler.isPlaying?`Ready: ${describe(id,requestedField)}.`:changing||id!==reached||JSON.stringify(requestedField||null)!==JSON.stringify(reachedField||null)?`${mode}: moving toward ${describe(id,requestedField)}.`:`Playing: ${describe(reached,reachedField)}.`;if(label.textContent!==text)label.textContent=text;}
    const picker=this.root.querySelector('#pf-circle-picker');if(picker&&document.activeElement!==picker)picker.value=id;
    this._paintDirectionGlow(circle,id);
  }

  _musicCircleHtml() {
    const short=['Originals','Roots','Blues','Jazz','Soul','Reggae / ska','Hip-hop','House','Breaks','Rock'];
    const labels=CIRCLE_GROUPS.map((group,i)=>{const angle=((i+.5)/CIRCLE_GROUPS.length-.25)*2*Math.PI;return `<span class="pf-circle-family" style="left:${50+34*Math.cos(angle)}%;top:${50+34*Math.sin(angle)}%" title="${esc(group.label)}">${esc(short[i]||group.label)}</span>`;}).join('');
    const ticks=CIRCLE_SCENES.map(id=>{const p=circlePosition(id);return `<span class="pf-circle-tick" data-scene="${id}" style="left:${p.x*100}%;top:${p.y*100}%"></span>`;}).join('');
    const blendControls=this.doc.jam_session.exploration_map==='catalogue-circle-v2'?`<label for="pf-circle-blend">Blend Ska, Rocksteady and Reggae</label><input id="pf-circle-blend" data-circle-blend type="range" min="0" max="1" step="0.025" value=".5" /><div class="pf-row">${this._btn('circle-blend:less','Toward Ska','pf-btn pf-small')}${this._btn('circle-blend:more','Toward Reggae','pf-btn pf-small')}</div>`:'';
    return `<section aria-label="Circular music explorer"><p class="pf-sub">Drag the dot round. Or use the arrow keys.</p>
      <div class="pf-music-circle" data-music-circle tabindex="0" role="group" aria-label="Circular music explorer. Left and right choose a style; up and down choose a family.">
        ${this._listeningVisualHtml()}<div aria-hidden="true">${ticks}${labels}</div><strong data-circle-title class="pf-circle-title"></strong>
        <span data-circle-requested class="pf-field-requested"></span><span data-circle-realized class="pf-field-realized" hidden></span><span data-circle-arrow class="pf-circle-arrow" hidden></span>
      </div><p class="pf-sub">${CIRCLE_SCENES.length} styles. Ring: your pick. Dot: what plays. Bright dots: where your playing points.</p>
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

  _melodyEntryHint() {
    const scheduler=this.app.scheduler,backing=scheduler?.activeJamBacking?.(),song=scheduler?.compiledSong;
    if(!scheduler?.isPlaying||!song||!backing)return 'Press Listen to check tune choices for this band.';
    const custom=Boolean(this.doc.jam_session?.anchor_backing),cache=this.melodyCoverageCache;
    if(cache?.backing===backing&&cache.song===song&&cache.custom===custom)return cache.text;
    const ready=captureMelodyContext({...song,events:backing.events||song.events},backing,{customBacking:custom});
    const developed=ready&&(MOTIF_SCENES.has(ready.sceneId)||NEIGHBOURHOOD_SCENES.has(ready.sceneId));
    const text=developed?'Try ideas. Move out to shape one.':ready?'Try new tune patterns with this band.':'This band has note edits only. New tune patterns are not ready here.';
    this.melodyCoverageCache={backing,song,custom,text};return text;
  }

  _renderListeningJam() {
    const jam=this.doc.jam_session,playing=Boolean(this.app.scheduler?.isPlaying);
    const livePads=this._liveJamPads();
    const padNames=this._padNoteNamesOn()?this._padNoteNames(livePads):[];
    const pads=livePads.map((pad,index)=>{const waiting=this.pendingPad?.pad===index;
      const note=padNames[index]||null;
      return this._btn(`jam-pad:${index}`,note?`<span class="pf-pad-keyhint" aria-hidden="true">${pad.key.toUpperCase()}</span><kbd class="pf-pad-note" data-pad-note>${note}</kbd> ${esc(pad.label)}`:`<kbd>${pad.key.toUpperCase()}</kbd> ${esc(pad.label)}`,`pf-btn pf-jam-pad${pad.home?' pf-pad-home':''}${waiting?' pf-pad-waiting':''}${note?' pf-pad-named':''}`,`aria-label="${note?`${spokenNoteName(note)}, ${esc(pad.label)}, key ${pad.key.toUpperCase()}`:`${pad.key.toUpperCase()}: ${esc(pad.label)}`}${pad.home?', a home note':''}"${waiting?' aria-busy="true"':''}`);}).join('')
      +(livePads.length>4?`<div class="pf-row pf-octave" role="group" aria-label="Key height">${this._btn('pad-octave:-1','Lower keys','pf-btn pf-small',(this.padOctave||0)<=-1?'disabled':'')}${this._btn('pad-octave:1','Higher keys','pf-btn pf-small',(this.padOctave||0)>=1?'disabled':'')}${jam.kind!=='drums'?this._btn('pad-note-names','Note names','pf-btn pf-small',`aria-pressed="${this._padNoteNamesOn()}" title="Show the note each pad plays, such as C or B flat"`):''}</div>`:'');
    if(jam.music_field||jam.exploration_map)return `<div class="pf-stage pf-listening-stage pf-demo-stage${jam.exploration_map?' pf-jam-circle':''}">
      <h1 class="pf-heading">Find your groove</h1>
      ${jam.exploration_map?this._musicCircleHtml():this._musicFieldHtml()}
      <p class="pf-sub" id="pf-current-direction" aria-live="polite"></p>
      <div class="pf-row">${[this._btn('play',playing?'Stop':'Listen','pf-btn pf-play'),this._btn('melody-field-enter','Make my tune','pf-btn pf-next'),this._btn('undo','Undo','pf-btn pf-small')].join('')}</div><p class="pf-sub" data-melody-entry-coverage>${this._melodyEntryHint()}</p>
      ${this._liveScoreHtml()}
      <div class="pf-jam-pads" role="group" aria-label="Play with the band">${pads}</div>${this._heardMeterHtml()}${this._bandHandHtml()}
      <p class="pf-sub">Touch a pad. ${jam.live_keys?(this._padNoteNamesOn()?'Or use the computer keys A to K, the small letters in the corners.':'Or play A to K.')+' Bright pads always fit. Hold to let your note ring.':'Or play A S D F. Your notes repeat with the band.'} Play lots. The next group is busy. Hold notes. It is calm.</p>
      <p class="pf-sub" id="pf-answer-heard" aria-live="polite"></p>
      <p class="pf-sub" id="pf-key-sound"></p>
      <p class="pf-sub" id="pf-lean-words" role="status">${esc(leanWords(this.explorationLean?.lean))}</p>
      ${this.jamMessage?`<p role="status" class="pf-sub">${esc(this.jamMessage)}</p>`:''}
      ${this._sheetBoxHtml()}
      <details class="pf-demo-tools" ${this.demoToolsOpen?'open':''}><summary data-key="demo-tools">Go deeper</summary>
        <div class="pf-row">${this._btn('capture-direction','Build a song','pf-btn pf-small')}</div>
        ${jam.live_keys?`<div class="pf-row">${this._btn('jam-answer','Answer this','pf-btn pf-small')}${this._btn('jam-auto-answer','Band answers me','pf-btn pf-small',`aria-pressed="${jam.auto_answer===true}"`)}</div>
        <p id="pf-answer-status" class="pf-sub" role="status">${jam.auto_answer===true?'Play, then pause. The band plays your notes back.':'Play and let go. Answer this plays your last notes back.'}</p>`:''}
        ${stepsPerBar(this.doc)!==16?'':jam.exploration_map?this._btn('enter-field','Slide between six styles','pf-btn pf-small'):this._btn('enter-circle','Back to the circle','pf-btn pf-small')}
        ${this._jamParticipationHtml()}
        <div class="pf-row">${this._btn('settings',this.comfortOpen?'Close help':'Help','pf-btn pf-small',`aria-expanded="${Boolean(this.comfortOpen)}"`)}${this._backBtn()}</div>
        ${this.comfortOpen?this._helpPanelHtml():''}
      </details>
    </div>`;
    return `<div class="pf-stage pf-listening-stage"><h1 class="pf-heading">Find your groove</h1>
      ${jam.music_field?this._musicFieldHtml():this._honeycombHtml()}
      <p class="pf-sub" id="pf-current-direction" aria-live="polite"></p>
      <p class="pf-say">${jam.anchor_backing?'This phrase is frozen. Explore when you are ready.':this.exploreTour?'The band explores. You steer.':'Staying with this style. The tune keeps moving.'}</p>
      <div class="pf-row">${this._btn('play',playing?'Stop':'Play','pf-btn pf-play')}
      ${!jam.music_field?this._btn('stay-style',this.exploreTour?'Stay here':'Explore','pf-btn',`aria-pressed="${Boolean(this.exploreTour)}" ${playing?'':'disabled'}`):this._btn('leave-field','Connected styles','pf-btn')}
      ${!jam.music_field?this._btn('change-style','Change style','pf-btn',playing?'':'disabled'):''}
      ${this._btn('melody-field-enter','Make my tune','pf-btn pf-next')}</div><p class="pf-sub" data-melody-entry-coverage>${this._melodyEntryHint()}</p>
      ${this._liveScoreHtml()}
      <div class="pf-jam-pads" role="group" aria-label="Play with the band">${pads}</div>
      <p class="pf-sub">Tap a pad or play A S D F. ${jam.live_keys?'Hold to let a note ring.':'Your notes repeat with the band.'} How you play steers the band. Make my tune opens tune choices.</p>
      ${this._heardMeterHtml()}${this._bandHandHtml()}${this.explorationLean?.lean?`<p class="pf-sub" role="status">${leanWords(this.explorationLean.lean)}</p>`:''}
      <p class="pf-sub" id="pf-key-sound"></p>
      ${this._sheetBoxHtml()}
      ${jam.live_keys?`<div class="pf-row">${this._btn('jam-answer','Answer this','pf-btn pf-small',playing?'':'disabled')}${this._btn('jam-auto-answer','Band answers me','pf-btn pf-small',`aria-pressed="${jam.auto_answer===true}"`)}</div>
      <p id="pf-answer-status" class="pf-sub" role="status">${jam.auto_answer===true?'Play, then pause. The band plays your notes back.':'Play and let go. Answer this plays your last notes back.'}</p>`:''}
      ${this._jamParticipationHtml({steering:jam.music_field?'':jam.anchor_backing?this._keptBandControlsHtml():`<div class="pf-row" role="group" aria-label="Steer the band">${this._btn('jam-density:less','More space','pf-btn pf-small',jam.density===0?'disabled':'')}
      ${this._btn('jam-density:more','More movement','pf-btn pf-small',jam.density===4?'disabled':'')}</div>`})}
      ${this.jamMessage?`<p role="status" class="pf-sub">${esc(this.jamMessage)}</p>`:''}
      <div class="pf-row">${!jam.music_field?this._btn('enter-field','Slide six styles','pf-btn pf-small'):''}${!jam.music_field?this._btn('showcase-controls','Shape band','pf-btn pf-small'):''}${this._btn('undo','Undo','pf-btn pf-small')}${this._backBtn()}</div>
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
    if(this.melodyField)return this.melodyField.html()+`<details class="pf-melody-pads" ${this.melodyPadsOpen?'open':''}><summary data-key="melody-pads">Play along</summary><p class="pf-sub">Keys A to K play at any time.</p><div class="pf-row" aria-label="Play along">${this._liveJamPads().map((pad,i)=>this._btn(`jam-pad:${i}`,`<kbd>${pad.key.toUpperCase()}</kbd> ${esc(pad.label)}`,'pf-btn pf-jam-pad')).join('')}</div></details>`;
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
      <div class="pf-row">${this._btn("play", playing ? "Stop band" : "Play band", "pf-btn pf-play")}${this._btn("melody-field-enter", "Make my tune", "pf-btn pf-next")}${this._btn("undo", "Undo", "pf-btn pf-small")}</div>
      <p class="pf-sub" data-melody-entry-coverage>${this._melodyEntryHint()}</p>
      ${this._liveScoreHtml()}
      <div class="pf-row">${this._btn("explore-tour", this.exploreTour ? "Stay here" : "Auto tour", "pf-btn", `aria-pressed="${Boolean(this.exploreTour)}" ${playing ? '' : 'disabled'}`)}</div>
      <div class="pf-row">${this._btn('explore-near','Explore nearby','pf-btn pf-small',playing?'':'disabled')}${this._btn('explore-wide','Explore wider','pf-btn pf-small',playing?'':'disabled')}</div>
      <p class="pf-sub">${this.doc.jam_session?.anchor_backing ? 'Nearby varies the band active when you pressed. It returns at the next bar; notes already queued can still play. Style, tone and density controls leave this snapshot.' : 'Nearby varies the active band. Wider visits other connected styles.'}</p>
      <p class="pf-sub" id="pf-explore-status">${this.exploreTour ? 'Exploring connected styles. Each direction has time to settle before the next. Stay here to shape it, or keep playing along.' : 'Choose a direction yourself, or let the band explore. You can join in at any time.'}</p>
      ${this._keptBandControlsHtml()}
      ${this._sharedStyleControlsHtml()}
      <div class="pf-jam-pads" role="group" aria-label="Play and keep notes">${pads}</div>
      <p class="pf-sub">Tap a pad or press A, S, D, F. Each press adds to the beat. You can play with the band stopped too.</p>
      <div class="pf-row">${this._btn("jam-responsive", jam?.live_keys?"Band makes room":"Band responds", "pf-btn pf-small", `aria-pressed="${jam?.responsive === true}"`)}</div>
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
        ${this._btn("jam-color:less", jam?.showcase_version===1?"Prev sound":"Warmer", "pf-btn", (jam?.color ?? 1) === 0 ? "disabled" : "")}${this._btn("jam-color:more", jam?.showcase_version===1?"Next sound":"Brighter", "pf-btn", jam?.color === 4 ? "disabled" : "")}</div></div>
      </div>
      <p class="pf-say">${esc(jamDirectionDescription(this.doc))}</p>
      ${this.jamMessage && this.jamMessage !== jamDirectionDescription(this.doc) ? `<p class="pf-say pf-msg" role="status">${esc(this.jamMessage)}</p>` : ""}
      <div class="pf-row">${this._btn("jam-edit", "Edit my notes", "pf-btn")}</div>
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
    const role = this.eventRole || 'lead';
    if(!this.doc.notes.some(n=>n.role===role&&n.patch_id===this.eventPatch))this.eventPatch=this.doc.notes.find(n=>n.role===role)?.patch_id||null;
    const roles = [['lead','Tune'],['bass','Bass'],['harmony','Chords'],['drums','Beat'],['fx','Effects'],['hocket','Answers']];
    this.eventTuneBar = Math.max(0, Math.min(bars - 1, this.eventTuneBar || 0));
    const spb=stepsPerBar(this.doc), totalSteps=bars*spb;
    const barStart = this.eventTuneZoom ? this.eventTuneBar*spb : 0, barEnd = this.eventTuneZoom ? barStart+spb : totalSteps;
    const onset = n => n.step + (n.performance?.offset_steps || 0);
    const notes = this.doc.notes.filter(n => n.role === role && (!this.eventPatch || n.patch_id===this.eventPatch) && onset(n) < barEnd && onset(n) + n.duration_steps > barStart)
      .slice().sort((a,b) => (a.step + (a.performance?.offset_steps || 0)) - (b.step + (b.performance?.offset_steps || 0)));
    const lanes = role === 'drums' ? drumLanes({...this.doc,notes:this.doc.notes.filter(n=>!this.eventPatch||n.patch_id===this.eventPatch)}) : null;
    const noteName = (n, i) => `${isOwnNote(n) ? "Your note" : "Band note"} ${i + 1}`;
    const selected = notes.find(n => n.id === this.eventTuneId) || notes.find(isOwnNote) || notes[0];
    this.eventTuneId = selected?.id;
    if(lanes && !lanes.some(l=>l.key===this.eventDrumLane)) this.eventDrumLane=selected ? drumLaneKey(selected,this.doc) : lanes[0].key;
    const barsWithOwn = new Set(this.doc.notes.filter(n => n.role === role && isOwnNote(n)).map(n => Math.floor(n.step / stepsPerBar(this.doc))));
    const pitch=n=>Number(n.concrete?.midi_pitch??n.concrete?.midi??60);
    const roleNotes=this.doc.notes.filter(n=>n.role===role && (!this.eventPatch || n.patch_id===this.eventPatch));
    const pitches=lanes?null:pitchRows(roleNotes);
    const low=pitches?.low??48,high=pitches?.high??72;
    const selectedIndex=notes.indexOf(selected),stepCount=barEnd-barStart;
    const durations = [];
    const list=notes.map((n,i)=>{
      const position=Math.max(0, (onset(n)-barStart)/stepCount);
      const width=(Math.min(barEnd,onset(n)+n.duration_steps)-Math.max(barStart,onset(n)))/stepCount*100;
      const top=lanes ? drumLaneTop(n,this.doc,lanes) : pitchTop(pitch(n),pitches);
      durations.push(`<span class="pf-phrase-duration${isOwnNote(n)?' pf-note-own':''}${n.id===selected?.id?' pf-note-selected':''}" data-note-duration="${esc(n.id)}" style="left:${position*100}%;top:${top+(lanes?11:3)}px;width:${width}%" aria-hidden="true"></span>`);
      return this._btn(`event-select:${encodeURIComponent(n.id)}`,`${i+1}`,`pf-btn pf-phrase-note${isOwnNote(n)?' pf-phrase-own':''}`,
        `style="left:min(${position*100}%, calc(100% - 44px));top:${top}px;width:${width}%" data-phrase-note="${esc(n.id)}" aria-pressed="${n.id===selected?.id}" aria-label="${lanes ? esc(lanes.find(l=>l.key===drumLaneKey(n,this.doc))?.label || n.patch_id) + ", " : esc(pitchName(pitch(n))) + ", "}${noteName(n,i)}, beat ${(position*stepCount/4+1).toFixed(2)}. Drag it, or use the arrow keys, to change it."`);
    }).join('');
    this.phraseRange={low,high,stepCount,bar:this.eventTuneBar,startStep:barStart,totalSteps,lanes,role,card:this.editingCard,...(pitches?{rowHeight:pitches.rowHeight}: {})};
    const playing=Boolean(this.app.scheduler?.isPlaying);
    const scope=this.editingCard==null?'Your tune':`Part ${this.editingCard+1}`;
    const transportLabel=playing?'Stop playback':this.editingCard==null?'Play music':`Play part ${this.editingCard+1}`;
    const editLayer=role==='lead'?'tune':role==='drums'?'beat':'under';
    const layerOff=this.editingCard!=null && this.doc.song_cards?.[this.editingCard]?.[editLayer]===false;
    const detailPicture=`      ${!lanes?`<div class="pf-pitch-scroll"><div class="pf-pitch-grid"><div class="pf-pitch-labels" aria-hidden="true">${pitches.rows.map(row=>`<div class="pf-pitch-key${row.black?' pf-pitch-black':''}">${row.label}</div>`).join('')}</div>`:''}

      ${lanes ? `<div class="pf-drum-grid"><div class="pf-drum-labels" role="group" aria-label="Choose a drum sound">${lanes.map((lane,i)=>this._btn(`event-lane:${i}`,esc(lane.label),'pf-btn pf-drum-label',`style="height:56px" aria-pressed="${this.eventDrumLane===lane.key}"`)).join('')}</div>` : ''}

      <div class="pf-phrase-picture${pitches?' pf-pitch-picture':''}" data-phrase-picture style="--phrase-beat-width:${400/stepCount}%;${lanes ? `height:${lanes.length*56+24}px` : `height:${pitches.height}px`}" role="group" aria-label="${this.eventTuneZoom?`Bar ${this.eventTuneBar+1}`:'Whole part'}: notes by ${lanes ? 'sound' : 'pitch'} and time">

        ${list||(lanes ? '' : '<p class="pf-phrase-empty">This bar has room for a tune. Add a note to begin.</p>')}${durations.join('')}

        <span class="pf-phrase-cursor" aria-hidden="true" hidden></span>

      </div>

      ${lanes ? "</div>" : "</div></div>"}

      <div class="pf-phrase-beats${lanes ? ' pf-drum-beats' : ' pf-pitch-beats'}" aria-hidden="true">${Array.from({length:this.eventTuneZoom?spb/4:bars},(_,i)=>`<span>${this.eventTuneZoom?'Beat':'Bar'} ${i+1}</span>`).join('')}</div>

`;
    const card=this.editingCard??0;
    const ranges=songCardRanges(this.doc.song_cards,4*spb,this.doc.global_context.bpm,spb);
    const rows=bandRows(this.app.compiledSong?.events,this.doc.notes,{card,start:ranges[card]?.start_step||0,stepSeconds:60/this.doc.global_context.bpm/4});
    if(!rows.some(r=>r.role===role && (!this.eventPatch||r.patch===this.eventPatch)))rows.unshift({key:JSON.stringify([role,this.eventPatch||'']),role,patch:this.eventPatch||'',sources:[],events:[],empty:true});
    const active=rows.find(r=>r.role===role && (!this.eventPatch || r.patch===this.eventPatch));
    const ownIds=new Set((this.doc.notes||[]).filter(n=>n?.provenance==='user_placed').map(n=>n.id));
    const bandHtml=`<div class="pf-band-view" aria-label="Your band">${rows.map(row=>{
      const chosen=row===active&&!this.bandCollapsed;
      const partCls=partOfRole(row.role)||(row.role==='hocket'?'chords':'drums');
      const rowPitches=row.events.map(e=>e.pitch), minPitch=Math.min(...rowPitches),maxPitch=Math.max(...rowPitches);
      const marks=row.events.filter(e=>e.onset<barEnd&&e.onset+e.duration>barStart).map(e=>{
        const left=Math.max(barStart,e.onset),end=Math.min(barEnd,e.onset+e.duration);
        const isOwn=ownIds.has(e.id)||String(e.id).startsWith('jam-live-');
        return `<span class="pf-band-mark pf-part-${partCls}${isOwn?' own':''}" data-band-onset="${e.onset}" data-band-end="${e.onset+e.duration}" style="top:${maxPitch>minPitch?8+(maxPitch-e.pitch)/(maxPitch-minPitch)*28:20}px;left:${(left-barStart)/stepCount*100}%;width:${(end-left)/stepCount*100}%" aria-hidden="true"></span>`;
      }).join('');
      const label=getInstrument(row.patch)?.label||row.patch?.replaceAll('_',' ')||roles.find(r=>r[0]===row.role)?.[1]||'Band';
      return `<section class="pf-band-row${chosen?' pf-band-selected':''}"><div class="pf-band-summary">${this._btn('band-row:'+encodeURIComponent(row.key),`<span aria-hidden="true">${chosen?'&#9662;':'&#9656;'}</span> ${esc(label)}<small>${roles.find(r=>r[0]===row.role)?.[1]||esc(row.role)}</small>`,'pf-btn pf-band-label',`aria-expanded="${chosen}" aria-label="${chosen?'Close':'Open'} ${esc(label)} notes"`)}<div class="pf-band-track" aria-hidden="true">${marks}<span class="pf-band-cursor" hidden></span></div></div>${chosen?`<p class="pf-sub">${{lead:'Tune: the main line you can hum.',bass:'Bass: the low notes that move the song.',harmony:'Chords: notes that ring as a group.',drums:'Beat: the pulse you can tap to.',hocket:'Reply: notes that answer your tune.',fx:'Effect: a sound that adds a change.'}[row.role]||'Change a note here.'}</p>${detailPicture}`:''}${!row.sources.length&&!row.empty?'<p class="pf-sub">The band plays this. Try Edit backing.</p>':''}</section>`;
    }).join('')}</div>`;
    const rolePickerHtml=`<div class="pf-row" role="group" aria-label="Choose sounds to edit">${roles.filter(([id])=>id==='lead'||this.doc.notes.some(n=>n.role===id)).map(([id,label])=>this._choice(`event-role:${id}`,label,role===id,'pf-btn pf-small')).join('')}</div>`;
    const selectedChapter = starterGroups(this.doc)?.find(group=>group.indices.includes(this.editingCard));
    const requestedGuide = this.doc.song_path?.step;
    const guideStep = requestedGuide === 'chorus' ? (chapterKind(selectedChapter || {}) === 'big' ? requestedGuide : null)
      : requestedGuide === 'ending' ? (chapterKind(selectedChapter || {}) === 'ending' ? requestedGuide : null) : requestedGuide;
    return `<div class="pf-stage pf-tune pf-event-tune">
      <div class="pf-head-row"><div><h1 class="pf-heading">${guideStep==='chorus'?'Make your big moment':guideStep==='ending'?'Choose your ending':role !== 'lead' ? `Edit ${roles.find(r=>r[0]===role)?.[1].toLowerCase() || 'sounds'}` : this.melodyFocus ? 'Play with your tune' : 'Shape your tune'}</h1><p class="pf-sub">${guideStep==='melody'?'Your kept playing. Try a note.':`${scope}. ${this.editingCard==null?'Edits affect linked parts.':'Edits stay in this part.'}`} </p></div>
      <div class="pf-row">${this._btn('play',transportLabel,this.doc.capture_notes?.melody_field?'pf-btn pf-play':'pf-btn pf-play pf-big','data-event-transport')}${this._btn('undo','Undo')}${this._btn('adjust-open','Assist','pf-btn',`aria-expanded="${Boolean(this.adjustOpen)}"`)}</div></div>
      ${this.doc.song_cards?.[this.editingCard]?.under && (this.doc.song_cards[this.editingCard].big || this.doc.song_cards[this.editingCard].fx==='high_lift')?'<p class="pf-sub">The band adds higher notes here. Below are the notes you can change.</p>':''}
      ${this.doc.song_cards?.[this.editingCard]?.tune_variant==='lift'?'<p class="pf-sub">This part plays your tune higher. These are the notes you can change.</p>':''}
      <p class="pf-say">Touch a note to change it. Tap a gap to add one.${barsWithOwn.size?' Your notes have a bright edge.':''}</p>
      ${layerOff?`<div class="pf-row" role="status"><span>This sound is off in this part.</span>${this._btn(`card-layer:${this.editingCard}:${editLayer}`,'Turn on','pf-btn')}</div>`:''}
      ${role==='lead'?`<div class="pf-row pf-melody-sound">${this._btn('change-sound','Change sound','pf-btn',`aria-expanded="${Boolean(this.instrumentPickerOpen)}"`)}<span>${esc([...new Set(roleNotes.map(n=>getInstrument(n.patch_id)?.label||n.patch_id).filter(Boolean))].join(' / ') || getInstrument(this.doc.lead_patch_id)?.label || 'Tune sound')}</span></div>${this.instrumentPickerOpen?this._instrumentPickerHtml({changing:true,melodyOnly:true}):''}`:''}
      <div class="pf-row" role="group" aria-label="Choose a bar">${this._choice('event-whole-part','Whole part',!this.eventTuneZoom)}${!this.eventTuneZoom?this._btn('event-zoom','Zoom in','pf-btn pf-small'):''}${this.eventTuneZoom?Array.from({length:bars},(_,b)=>this._choice(`event-bar:${b}`,`Bar ${b+1}${barsWithOwn.has(b)?' · your notes':''}`,b===this.eventTuneBar)).join(''):''}</div>
      ${!lanes?`<div class="pf-row">${this._choice('event-pitch-snap','Snap to key',this.pitchSnap!==false,'pf-btn pf-small')}</div>`:''}
      <div class="pf-phrase-caption"><span>${lanes ? "Drum sounds" : "Higher notes"}</span><span>Time moves left to right</span></div>
      <p id="pf-phrase-status" class="pf-sub" role="status">${playing?"Playing this part.":"Stopped. Press Play to hear your music."}</p>
      <p class="pf-sub">Tap a sound to see its notes. The line shows where you are. Long bars ring for longer.</p>
      ${this.melodyFocus?this._liveScoreHtml():''}
      ${bandHtml}
      ${this.doc.capture_notes?.melody_field?'':rolePickerHtml}
      ${this.melodyFocus ? (role==='lead' ? `<div class="pf-row">${this._choice('spot:tune', 'Hear tune clearly', this.app.scheduler?.spotlightRole === 'tune')}${this.doc.capture_notes?.melody_field?'':`${this._btn('melody-explore', 'Explore my tune')}${this._btn('melody-ending', 'Try a new ending')}`}</div>${this.doc.capture_notes?.melody_field?'':`<details><summary>More ideas</summary>${this._btn('melody-echo', 'Try an echo')}</details>`}` : '') : this._timelineHtml()}
      ${notes.length?`<details class="pf-note-list"><summary data-key="note-list">Pick from list</summary><div class="pf-row" role="group" aria-label="Choose a note">${notes.map((n,i)=>this._btn(`event-pick:${encodeURIComponent(n.id)}`,noteName(n,i),'pf-btn pf-small',`aria-pressed="${n.id===selected?.id}"`)).join('')}</div></details>`:''}
      ${selected && this.eventSelectionExplicit?`<section class="pf-details" aria-label="Selected note"><strong>${noteName(selected,selectedIndex)} selected</strong>
        <p class="pf-sub">Hear it alone. Undo puts it back.</p>
        <div class="pf-row">${this._btn('event-edit:hear','Hear this note')}${this._btn('event-edit:remove','Remove this note','pf-btn pf-small')}</div>
        <details class="pf-event-timing" ${this.eventTimingOpen?'open':''}><summary data-key="event-timing">Change it with buttons</summary>
          <p class="pf-sub">Use these to move the note, or to make it ring more or less.</p>
          <div class="pf-row">${[['up','Higher pitch'],['down','Lower pitch'],['earlier','Earlier'],['later','Later'],['shorter','Shorter'],['longer','Longer']].filter(([k])=>!['up','down'].includes(k)||this._canPitch(selected)).map(([k,l])=>this._btn(`event-edit:${k}`,l)).join('')}</div>
        </details></section>`:''}
      <div class="pf-row">${this._btn('event-add','+ Add note')}</div>
      ${this.starterBlocked?`<section class="pf-details" role="status" tabindex="-1" data-starter-blocked><strong>Your tune is safe.</strong><p>${this.doc.song_cards.length>6?'This song has no room for two more parts.':'A held note crosses a part. A copy could cut it short.'}</p><p>Keep these parts and shape them next.</p>${this._btn('starter-existing','Shape my kept song')}</section>`:''}
      <div class="pf-row">${this.doc.capture_notes?.melody_field?this._btn('melody-field-resume','Tune map')+this._btn('keep','Save / export','pf-btn pf-next'):guideStep==='melody'?`${this._btn('build-starter','Build around my tune','pf-btn pf-next')}${this._btn('guide-starter','Build it with me')}`:guideStep==='chorus'?this._btn('guide-ending','Next: ending','pf-btn pf-next'):guideStep==='ending'?this._btn('guide-shape','See my song','pf-btn pf-next'):this._btn('to-song','Whole song','pf-btn pf-next')}${this.doc.capture_notes?.melody_field||guideStep==='melody'?'':this._btn('to-under','Edit backing')}${!this.doc.capture_notes?.melody_field&&this.editingCard==null?this._backBtn():''}${this._btn('keep','Save / export')}</div>
      ${this.doc.capture_notes?.melody_field?`<details class="pf-refine-more" ${this.refineMoreOpen?'open':''}><summary data-key="refine-more">Go deeper</summary>${rolePickerHtml}<div class="pf-row">${this._btn('to-under','Edit backing')}${this.editingCard==null?this._backBtn():''}</div></details>`:''}</div>`;
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
      if (inKey.has(((target - d) % 12 + 12) % 12)) return Math.max(0, Math.min(127, target - d));
      if (inKey.has(((target + d) % 12 + 12) % 12)) return Math.max(0, Math.min(127, target + d));
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
    const local = Math.max(0, Math.min(stepCount - 1, Math.round((x / Math.max(1, rect.width)) * stepCount)));
    const raw = this.phraseRange.rowHeight ? high - (y-this.phraseRange.rowHeight/2)/this.phraseRange.rowHeight : high - ((y - 12 - 22) / 140) * (high - low);
    const pitch = this.pitchSnap===false ? Math.max(0,Math.min(127,Math.round(raw))) : this._snapPitch(raw);
    const lane = this.phraseRange.lanes?.[Math.max(0, Math.min(this.phraseRange.lanes.length-1, Math.floor((y-12)/56)))];
    return { rect, local, lane, step: (this.phraseRange.startStep ?? bar*stepCount) + local, pitch, stepCount };
  }

  _beginNoteDrag(e, picture) {
    const button = e.target.closest?.("[data-phrase-note]");
    const { rect, local, step, pitch, lane } = this._pictureGeometry(e, picture);
    let note = button ? this.doc.notes.find(n => n.id === button.dataset.phraseNote && n.role === (this.eventRole || "lead")) : null;
    this._pushUndo();
    const undoDepth = this.undoStack.length;
    let added = false;
    if (!note) {
      // A press on an empty spot puts a note there, then the same drag can move it.
      let index = 1; while (this.doc.notes.some(n => n.id === `event-note-${index}`)) index++;
      note = { id: `event-note-${index}`, step, duration_steps: 2, ...this._newEventSound(lane),
        provenance: "user_placed", pitch_lock_mode: "concrete", concrete: { midi_pitch: pitch, freq_hz: 440 * 2 ** ((pitch - 69) / 12) }, performance: { version: 1, offset_steps: 0 } };
      if (lane) { note.concrete = structuredClone(lane.source.concrete || {midi_pitch:36}); this.eventDrumLane=lane.key; }
      this.doc.notes.push(note);
      added = true;
    }
    this.eventTuneId = note.id;this.eventSelectionExplicit=true;
    if(note.role==='drums')this.eventDrumLane=drumLaneKey(note,this.doc);
    const noteRect = button?.getBoundingClientRect();
    const visibleRect = button && this.root.querySelector?.(`[data-note-duration="${CSS.escape(note.id)}"]`)?.getBoundingClientRect?.();
    const edgeRect = visibleRect || noteRect;
    const resize = Boolean(button) && edgeRect && e.clientX > edgeRect.right - (visibleRect ? Math.min(10,visibleRect.width/3) : 14);
    try { picture.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointers have no capture */ }
    this.noteDrag = { pointerId: e.pointerId, picture, id: note.id, mode: resize ? "resize" : "move", undoDepth, changed: added,
      grabStep: local, grabY:e.clientY, startStep: note.step, startPitch: Number(note.concrete?.midi_pitch ?? note.concrete?.midi ?? 60), startDur: Number(note.duration_steps) || 1, lastPreview: 0 };
    if (added) {
      // A new note needs its button on screen; re-render once, then hold the fresh picture.
      this._applyNoteDrag(note, { step, ...(lane ? {} : {pitch}), duration: 2 }, { sound: true });
      this.render();
      const fresh = this._livePicture(picture);
      this.noteDrag.picture = fresh;
      try { fresh.setPointerCapture?.(e.pointerId); } catch { /* the pointer may already be up */ }
    } else {
      // Selecting an existing note must not re-render mid-gesture: mark it in place.
      this._hearNote(note);
      for (const b of this.root.querySelectorAll?.("[data-phrase-note]") || []) b.setAttribute("aria-pressed", String(b.dataset.phraseNote === note.id));
      for (const span of this.root.querySelectorAll?.('[data-note-duration]') || []) span.classList.toggle('pf-note-selected',span.dataset.noteDuration===note.id);
    }
    this.root.querySelector?.(`[data-phrase-note="${CSS.escape(note.id)}"]`)?.focus?.({ preventScroll: true });
  }

  _moveNoteDrag(e) {
    const drag = this.noteDrag, note = this.doc.notes.find(n => n.id === drag.id);
    if (!note) return;
    const { local, pitch, stepCount } = this._pictureGeometry(e, drag.picture);
    const bar = this.phraseRange.startStep ?? this.phraseRange.bar*stepCount, maxStep = this.phraseRange.totalSteps ?? this._partBars()*stepCount;
    if (drag.mode === "resize") {
      const onset = note.step + (note.performance?.offset_steps || 0);
      const duration = Math.max(1, Math.min(maxStep - onset, bar + local + 1 - onset));
      if (duration !== note.duration_steps) this._applyNoteDrag(note, { duration });
      return;
    }
    const step = Math.max(0, Math.min(maxStep - 1, drag.startStep + (local - drag.grabStep)));
    const verticalIntent = !Number.isFinite(drag.grabY) || (Number.isFinite(e.clientY) && Math.abs(e.clientY-drag.grabY) >= (this.phraseRange.rowHeight || 8)/2);
    const targetPitch = !verticalIntent && drag.pitchMoved ? drag.startPitch : pitch;
    const pitchChanged = (verticalIntent || drag.pitchMoved) && this._canPitch(note) && targetPitch !== Number(note.concrete?.midi_pitch ?? note.concrete?.midi), stepChanged = step !== note.step;
    if(pitchChanged)drag.pitchMoved=true;
    if (!pitchChanged && !stepChanged) return;
    // Only an intended move in time touches timing; a pitch-only drag leaves the note's feel alone.
    this._applyNoteDrag(note, { ...(stepChanged ? { step } : {}), ...(pitchChanged ? { pitch:targetPitch } : {}) }, { sound: pitchChanged });
  }

  _applyNoteDrag(note, { step, pitch, duration }, { sound = false } = {}) {
    if (step !== undefined) { note.step = step; note.performance = { ...(note.performance || {}), version: 1, offset_steps: 0 }; }
    if (pitch !== undefined) note.concrete = { ...note.concrete, midi_pitch: pitch, freq_hz: 440 * 2 ** ((pitch - 69) / 12) };
    if (duration !== undefined) note.duration_steps = duration;
    // A dragged band note is a deliberate edit, like one made with the buttons: keep its origin
    // label but retire the generator's permission to replace it at the next style change.
    if (note.generated_by) { note.edited_from_generator = note.generated_by; delete note.generated_by; }
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
    try { scheduler.previewSound({ patchId: note.patch_id, role: note.role, kit:note.role==='drums'?drumKit(note,this.doc):null, midi: note.concrete?.midi_pitch, durationSec: .25 }); } catch { /* a silent drag still moves the note */ }
  }

  _placeNoteButton(note) {
    const button = this.root.querySelector?.(`[data-phrase-note="${CSS.escape(note.id)}"]`);
    if (!button || !this.phraseRange) return;
    const { low, high, stepCount, bar } = this.phraseRange;
    const onset = note.step + (note.performance?.offset_steps || 0), start = this.phraseRange.startStep ?? bar*stepCount;
    const position = Math.max(0, (onset - start) / stepCount);
    const width = Math.max(0, (Math.min(start + stepCount, onset + note.duration_steps) - Math.max(start, onset)) / stepCount * 100);
    button.style.left = `min(${position * 100}%, calc(100% - 44px))`;
    button.style.top = `${this.phraseRange.lanes ? drumLaneTop(note,this.doc,this.phraseRange.lanes) : pitchTop(Number(note.concrete?.midi_pitch ?? note.concrete?.midi ?? 60),this.phraseRange)}px`;
    button.style.width = `${width}%`;
    const span = this.root.querySelector?.(`[data-note-duration="${CSS.escape(note.id)}"]`);
    if (span) { span.style.left = `${position * 100}%`; span.style.top = `${parseFloat(button.style.top) + (this.phraseRange.lanes?11:3)}px`; span.style.width = `${width}%`; }
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

  _canPitch(note) { return note?.role !== 'drums' && Number.isFinite(Number(note?.concrete?.midi_pitch ?? note?.concrete?.midi)); }

  async _editEvent(action) {
    const note = this.doc.notes.find(n => n.id === this.eventTuneId && n.role === (this.eventRole || "lead"));
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
      scheduler.previewSound({patchId:note.patch_id,role:note.role,kit:note.role==='drums'?drumKit(note,this.doc):null,midi:note.concrete?.midi_pitch??note.concrete?.midi,
        durationSec:Math.min(4,Math.max(.05,Number(note.duration_steps||1)*15/(this.doc.global_context.bpm||100)))});
      return;
    }
    if (action !== "add" && !note) return;
    if (action !== "add" && this.doc.notes.filter(n=>n.id===this.eventTuneId && n.role===(this.eventRole||"lead")).length !== 1) {
      return this.app._announce("This note has a shared name. Your notes are safe.");
    }
    if (['up','down'].includes(action) && !this._canPitch(note)) return;
    this._pushUndo();
    if (action === "add") {
      let index=1; while(this.doc.notes.some(n=>n.id===`event-note-${index}`)) index++;
      const id=`event-note-${index}`;
      this.doc.notes.push({id,step:(this.eventTuneBar||0)*stepsPerBar(this.doc),duration_steps:2,...this._newEventSound(),provenance:"user_placed",pitch_lock_mode:"concrete",
        concrete:this._newEventSound().concrete || {midi_pitch:60},performance:{version:1,offset_steps:0}});
      this.eventTuneId=id;this.eventSelectionExplicit=true;
    } else {
      this.doc.notes=editLeadEvent(this.doc.notes,this.eventTuneId,action,{totalSteps:this._partBars()*stepsPerBar(this.doc),role:this.eventRole||"lead"});
      const edited=this.doc.notes.find(n=>n.id===this.eventTuneId);
      if(edited) this.eventTuneBar=Math.floor(edited.step/stepsPerBar(this.doc));
    }
    this.tuneGrid={...tuneGridFromNotes(this.doc.notes,this._partBars()),eventEditor:true};
    recordAct(this.doc,"tune_event_edit",{action});
    this._compile();this.render();
    this.app._announce(action==="remove"?"One note removed. Undo can bring it back.":"Note changed.");
    if(action==="remove") this.root.querySelector('[data-key^="event-select:"]')?.focus();
  }

  _newEventSound(lane = null) {
    const role=this.eventRole||'lead';
    if (role==='drums') {
      const lanes=drumLanes({...this.doc,notes:this.doc.notes.filter(n=>!this.eventPatch||n.patch_id===this.eventPatch)});
      const chosen=lane || lanes.find(l=>l.key===this.eventDrumLane) || lanes.find(l=>l.source.id===this.eventTuneId) || lanes[0];
      return {role,patch_id:chosen.patch,drum_kit:chosen.kit,concrete:structuredClone(chosen.source.concrete || {midi_pitch:36}),velocity:liveVelocity(chosen.patch,role,isSampledPatch(chosen.patch))};
    }
    const source=this.doc.notes.find(n=>n.id===this.eventTuneId&&n.role===role)||this.doc.notes.find(n=>n.role===role && (!this.eventPatch||n.patch_id===this.eventPatch));
    const patch_id=source?.patch_id || (role==='drums'?'kick':role==='bass'?'clean_bass':role==='fx'?'reverse_swell':this.doc.lead_patch_id||'warm_keys');
    return {role,patch_id,velocity:liveVelocity(patch_id,role,isSampledPatch(patch_id))};
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
    if(!embedded && this.partComparison?.kind==='melody')return '';
    const cards = normalizeSongCards(this.doc.song_cards);
    const playing = Boolean(this.app.scheduler?.isPlaying);
    const activeIdx = Math.min(cards.length - 1, Math.max(0, this.activeSongCard || 0));
    const activeCard = cards[activeIdx] || cards[0];
    const lastIdx = cards.length - 1;
    const groups = starterGroups(this.doc);
    const activeGroup=groups?.find(g=>g.indices.includes(activeIdx));
    const pageScope=activeGroup?.indices.length>1;
    const scopeName=pageScope?`${activeGroup.label}: Page ${activeGroup.indices.indexOf(activeIdx)+1} of ${activeGroup.indices.length}`:(activeGroup?.label||activeCard.role_name||`Part ${activeIdx+1}`);
    const chapterIndex=groups?.indexOf(activeGroup);
    const endingSelected = cards.length > 1 && (activeGroup ? activeGroup.indices.includes(lastIdx) : activeIdx === lastIdx);
    const tiles = (groups ? groups.map(g=>({card:cards[g.indices[0]],idx:g.indices[0],group:g})) : cards.map((card,idx)=>({card,idx}))).map(({card,idx,group}) => {
      const name = group?.label || card.role_name || `Part ${idx + 1}`;
      const displayBars=group?group.indices.reduce((sum,i)=>sum+cards[i].bars,0):card.bars;
      const selected=group?group.indices.includes(activeIdx):idx===activeIdx;
      return this._btn(`select-card:${idx}`, `<strong>${esc(name)}</strong>${group?group.indices.map(i=>`<span data-group-page="${i}">${this._songBlockSvg(i)}</span>`).join(''):this._songBlockSvg(idx)}<span class="pf-sub">${displayBars} ${displayBars === 1 ? 'bar' : 'bars'}${(group?group.indices.includes(lastIdx):idx===lastIdx)&&cards.length>1?' - Ends here':''}</span>`,
        `pf-btn pf-song-card pf-song-block${selected ? ' selected' : ''}`,
        `data-card="${idx}" data-group-cards="${group?group.indices.join(','):idx}" style="flex-grow:${displayBars}" aria-pressed="${selected}" aria-label="Select ${group?'':`part ${idx+1}: `}${esc(name)}, ${displayBars} bars"`);
    }).join('');
    const choices = endingSelected
      ? ENDING_STYLES.map(st => this._choice(`ending-style:${st.id}`, st.label, endingStyle(cards[lastIdx]) === st.id, 'pf-btn pf-small'))
      : PART_MOODS.map(m => this._choice(`part-mood:${activeIdx}:${m.id}`, m.label, partMood(activeCard) === m.id, 'pf-btn pf-small'));
    const panel = `<section class="pf-song-selected pf-song-card" aria-label="Selected part ${activeIdx + 1}">
      <strong>${esc(scopeName)}</strong>${pageScope?'<span class="pf-sub"> Edits affect this page.</span>':''}<span class="pf-sub">${endingSelected ? ' Ends here.' : ''}</span>
      <div class="pf-row">${this._btn(`play-card:${activeIdx}`, pageScope?'Hear this page':'Hear this part', 'pf-btn')}${this._btn(`melody-part:${activeIdx}`, 'Edit notes', 'pf-btn pf-next')}${this._btn(`part-band:${activeIdx}`, 'Try new band', 'pf-btn')}${this._btn(`part-return:${activeIdx}`, 'Bring this back', 'pf-btn')}</div>
      <div class="pf-row" role="group" aria-label="Change selected part">${endingSelected?'<span class="pf-sub">How it ends: (last page)</span>':''}${choices.join('')}</div>
      <div class="pf-row" role="group" aria-label="Move selected part">${groups?`${this._btn(`move-chapter:${activeIdx}:earlier`,'Move part earlier','pf-btn pf-small',chapterIndex===0?'disabled':'')}${this._btn(`move-chapter:${activeIdx}:later`,'Move part later','pf-btn pf-small',chapterIndex===groups.length-1?'disabled':'')}`:`${this._btn(`move-card:${activeIdx}:earlier`,'Earlier','pf-btn pf-small',activeIdx===0?'disabled':'')}${this._btn(`move-card:${activeIdx}:later`,'Later','pf-btn pf-small',activeIdx===lastIdx?'disabled':'')}`}
      ${this.chapterMoveMessage?`<span role="status" tabindex="-1" data-chapter-message>${esc(this.chapterMoveMessage)}</span>`:''}
      ${(activeCard.material?.notes || this.doc.notes).some(isGeneratedBuildEffect)?this._btn(`remove-build-effects:${activeIdx}`,'Remove auto effects','pf-btn pf-small'):''}</div></section>`;
    const count = `<div class="pf-row" role="group" aria-label="Number of song parts">
      ${this._btn(`remove-card:${activeIdx}`, '&#8722;', 'pf-btn', `aria-label="Remove selected ${pageScope?'page':'part'}" ${cards.length <= 1 ? 'disabled' : ''}`)}
      <strong>${cards.length} ${groups?'pages':cards.length === 1 ? 'part' : 'parts'}</strong>
      ${this._btn('add-card', '+', 'pf-btn', `aria-label="Add independent part before ending" ${cards.length >= MAX_SONG_CARDS ? 'disabled' : ''}`)}</div>`;
    const chapterCount=groups?`<div class="pf-row" role="group" aria-label="Whole song parts">${this._btn(`change-chapter:${activeIdx}:remove`,'&#8722;','pf-btn',`aria-label="Remove selected whole part" ${groups.length<=1?'disabled':''}`)}<strong>${groups.length} ${groups.length===1?'part':'parts'}</strong>${this._btn(`change-chapter:${activeIdx}:copy`,'+','pf-btn',`aria-label="Add independent copy of selected whole part" ${cards.length+activeGroup.sections.length>MAX_SONG_CARDS?'disabled':''}`)}<span class="pf-sub">Copy or remove the whole part. Undo brings it back.</span></div>`:'';
    const footer = embedded ? "" : `<div class="pf-row">
          ${this._btn("keep", `${icon("save")} Save`, "pf-btn pf-next")}
        </div>`;
    // Everything else stays available, behind More.
    const layerSwitches = CARD_LAYERS.map(l => this._choice(`card-layer:${activeIdx}:${l.id}`, `${icon(l.icon)} ${l.label}`, Boolean(activeCard[l.id]))).join("");
    const fxBtns = CARD_FX.map(f => this._choice(`card-fx:${activeIdx}:${f.id}`, `${icon(f.icon)} ${f.label}`, activeCard?.fx === f.id, "pf-btn pf-small")).join("");
    const more = embedded ? "" : `<details class="pf-demo-tools pf-song-more" ${this.songMoreOpen ? "open" : ""}><summary data-key="song-more">More</summary>
        ${groups?count:''}${this._timelineHtml()}
        <details><summary>See the music sheet</summary>${this._sheetBoxHtml()}</details>
        <p class="pf-sub">These change the part you touched last: part ${activeIdx + 1}.</p>
        <div class="pf-row" role="group" aria-label="Part ${activeIdx + 1} length">
          ${this._btn(`card-bars:${activeIdx}:${activeCard.bars - 1}`, "Shorter", "pf-btn pf-small", activeCard.bars <= 1 ? "disabled" : "")}
          <span>${activeCard.bars} ${activeCard.bars === 1 ? "bar" : "bars"}</span>
          ${this._btn(`card-bars:${activeIdx}:${activeCard.bars + 1}`, "Longer", "pf-btn pf-small", activeCard.bars >= 4 ? "disabled" : "")}
        </div>
        <div class="pf-row" role="group" aria-label="Part ${activeIdx + 1} layers">${layerSwitches}</div>
        <div class="pf-row" role="group" aria-label="Part ${activeIdx + 1} extras">${fxBtns}${this._choice(`card-variation:${activeIdx}`, `${icon("climb")} Lift tune`, activeCard.tune_variant === "lift", "pf-btn pf-small")}</div>
        <div class="pf-row">
          ${cards.length > 1 ? this._btn(`remove-card:${activeIdx}`, `${icon("trash")} Remove`, "pf-btn pf-small") : ""}
          ${this._btn(`compare-part:${activeIdx}`, "Softer band", "pf-btn pf-small")}
        </div>
        <div class="pf-row">${this._btn("edit-shared", "Edit shared tune", "pf-btn pf-small")}${this._btn("toggle-all-view", `${icon("grid")} All at once`, "pf-btn pf-small")}</div>
        ${this.doc.jam_session ? `<div class="pf-row">${this._btn("jam-open", "Back to jam", "pf-btn pf-small")}</div><p class="pf-sub">The jam changes parts that copy it. Parts you changed stay safe.</p>` : ""}
        ${this.doc.capture_source ? `<div class="pf-row">${this._btn("restore-capture-source", this.doc.capture_notes?.melody_field?.version===4?"Open played take":"Restore source loop", "pf-btn pf-small")}</div><p class="pf-sub">${this.doc.capture_notes?.melody_field?.version===4?"Hear what you played. Undo brings this tune back.":"Go back to the loop from the start. Undo brings this back."}</p>` : ""}
        ${this.doc.jam_start ? `<div class="pf-row">${this._btn("restore-jam", "Restore first jam", "pf-btn pf-small")}</div><p class="pf-sub">Restore the first jam and its parts. Undo brings this song back.</p>` : ""}
      </details>`;
    const pagesHtml=activeGroup?.indices.length>1?`<details><summary>Pages in this part</summary>${activeGroup.indices.map((i,n)=>this._btn(`select-card:${i}`,`Page ${n+1}`)).join('')}<div class="pf-row">${this._btn(`move-card:${activeIdx}:earlier`,'Move page earlier','pf-btn pf-small',activeIdx===0?'disabled':'')}${this._btn(`move-card:${activeIdx}:later`,'Move page later','pf-btn pf-small',activeIdx===lastIdx?'disabled':'')}</div></details>`:'';
    return `
      <div class="pf-stage pf-song">
        <div class="pf-head-row"><h1 class="pf-heading">Shape your song</h1>${embedded?'':this._btn('play',playing?'Stop playback':'Play song','pf-btn pf-play','data-song-transport')}${embedded?'':this._btn('undo','Undo')}</div>
        <p class="pf-say">Choose a part. See its notes. Hear it play.</p>
        ${this._keepLostHtml()}
        ${groups?`${chapterCount}<p class="pf-sub">${groups.map(g=>esc(g.label)).join(' &rarr; ')}</p>`:`${this.doc.song_path?.groups?'<p class="pf-sub">Each page now shows as its own part.</p>':''}${count}`}
        <div class="pf-song-blocks" role="group" aria-label="Song parts in playing order">${tiles}</div>
        <p class="pf-sub">Beat / Bass / Chords / Tune. Bright edges mark your notes.</p>
        ${pagesHtml}
        ${panel}
        ${footer}
        ${more}
      </div>`;
  }

  /** Detail arrives as three tiles: Beat, Tune, Backing. Each says what it holds; Open goes in. The music keeps playing. */
  _renderDetailHub() {
    const notes = this.doc.notes || [], own = n => n.provenance === "user_placed" || n.provenance === "hummed_confirmed";
    const lead = notes.filter(n => n.role === "lead"), drums = notes.filter(n => n.role === "drums");
    const kit = KITS.find(k => k.id === (this.doc.drum_kit || "punchy"))?.label || "Punchy";
    const feel = FEELS.find(f => f.id === this.doc.underneath?.feel)?.label || "Just beat and tune";
    const scope = this.editingCard != null ? `Part ${this.editingCard + 1}` : "Your song";
    const playing = Boolean(this.app.scheduler?.isPlaying);
    const playBtn = this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play");
    const tile = (id, title, line, hint) => `<div class="pf-song-card pf-hub-tile" data-hub="${id}">
        <p class="pf-song-card-title">${title}</p>
        <p class="pf-sub">${esc(line)}</p>
        <p class="pf-sub">${esc(hint)}</p>
        <div class="pf-row">${this._btn(`hub-open:${id}`, "Open", "pf-btn pf-small", `aria-label="Open ${title.toLowerCase()}"`)}</div>
      </div>`;
    return `<div class="pf-stage pf-detail-hub">
      <div class="pf-head-row"><h1 class="pf-heading">Go deeper</h1>${playBtn}</div>
      <p class="pf-say">${scope}. Pick a part to work on. The song keeps playing.</p>
      ${this._timelineHtml()}
      <div class="pf-song-cards">
        ${tile("beat", "Beat", `${drums.length} ${drums.length === 1 ? "hit" : "hits"}. Drum sound: ${kit}.`, "Tap pads to add or take away hits.")}
        ${tile("tune", "Tune", `${lead.length} ${lead.length === 1 ? "note" : "notes"}, ${lead.filter(own).length} yours.`, "Drag notes up, down, left and right.")}
        ${tile("under", "Backing", `${feel}.`, "Chords and bass under the tune.")}
      </div>
      <div class="pf-row">${this._btn("to-song", `${icon("back")} Back to shape`, "pf-btn pf-small")}</div>
    </div>`;
  }

  /** One Help control: read this screen aloud, then the comfort settings. */
  _helpPanelHtml() {
    const retry = this.app.scheduler?.loadingSession?.state === "failed" ? this._btn('sounds-retry', 'Load sounds again', 'pf-btn pf-small') : "";
    // "For parents" is a page in the same tab with its own Back, so nothing leaves the app.
    return `<div class="pf-help-panel"><div class="pf-row">${this._btn('speak-screen','Read this screen','pf-btn pf-small')}${this._btn('parents','For parents','pf-btn pf-small')}${retry}</div>${this._renderComfort()}</div>`;
  }

  /* ---- Make it nicer: one tap to the nearest version known to sound better, on every level, with Undo. ---- */
  _optimize() {
    const level = this._journeyLevelForCards();
    if (!level) return;
    const g = this.doc.global_context || {}, spb = stepsPerBar(this.doc), root = ((Number(g.root_pc) || 0) % 12 + 12) % 12, minor = /minor|dorian|phrygian|aeolian/.test(g.scale_type || "");
    if (level === "play") {
      // The keys move to the band's register, so what you play sits where the band sings.
      const lead = (this.app.scheduler?.committedJamBacking || []).filter(e => e.role === "lead" && Number.isFinite(e.concrete?.midi_pitch)).map(e => e.concrete.midi_pitch).sort((a, b) => a - b);
      const median = lead.length ? lead[Math.floor(lead.length / 2)] : 64, home = this._liveJamPads()[0]?.midi ?? 60;
      const shift = Math.max(-1, Math.min(1, Math.round((median - home) / 12)));
      if (shift === 0) { this.app._announce("The keys fit the band now."); return this.render(); }
      this.padOctave = Math.max(-1, Math.min(1, (this.padOctave || 0) + shift));
      this.app._announce(shift > 0 ? "Keys moved up to fit the band." : "Keys moved down to fit the band.");
      return this.render();
    }
    const song = this.app.compiledSong, bars = Math.max(1, Math.ceil((song?.total_steps || 64) / spb));
    const tones = chordTonesByBar(song?.events || [], { bars, stepsPerBar: spb, root, minor });
    this._pushUndo();
    let notesResult = null, arrangementResult = null;
    if (level === "detail") {
      notesResult = optimizeNotes(this.doc.notes, { tonesByBar: tones, stepsPerBar: spb, root, minor });
      if (notesResult.changed) this.doc.notes = notesResult.notes;
    } else {
      const canonical = this._canonicalDoc();
      arrangementResult = optimizeArrangement(canonical.song_cards, canonical.global_context?.bpm || 100);
      notesResult = optimizeNotes(canonical.notes, { tonesByBar: tones, stepsPerBar: spb, root, minor });
      const cards = arrangementResult.cards.map(card => {
        if (!card.material?.notes) return card;
        const r = optimizeNotes(card.material.notes, { tonesByBar: tones, stepsPerBar: spb, root, minor });
        if (r.changed) { notesResult.changes.chord += r.changes.chord; notesResult.changes.grid += r.changes.grid; notesResult.changes.overlap += r.changes.overlap; notesResult.changed = true; }
        return r.changed ? { ...card, material: { ...card.material, notes: r.notes } } : card;
      });
      const next = { ...canonical, song_cards: cards, global_context: { ...canonical.global_context, bpm: arrangementResult.bpm }, notes: notesResult.changed ? notesResult.notes : canonical.notes };
      if (this.editingCard != null && this.sharedMaterial) {
        this.doc = { ...this.doc, global_context: next.global_context, song_cards: next.song_cards };
        this.sharedMaterial = extractSongMaterial(next);
      } else this.doc = { ...this.doc, ...next };
    }
    const changed = Boolean(notesResult?.changed || arrangementResult?.changed);
    if (!changed) this.undoStack.pop();
    this.tuneGrid = this.tuneGrid?.eventEditor ? { ...tuneGridFromNotes(this.doc.notes, this._partBars()), eventEditor: true } : tuneGridForBars(this.tuneGrid, this.doc.notes, this._partBars());
    if (changed) recordAct(this.doc, "optimize", { level, ...(notesResult?.changes || {}), arrangement: arrangementResult?.changes || [] });
    this._compile();
    this.jamMessage = "";
    this.app._announce(describeOptimisation({ notes: notesResult, arrangement: arrangementResult }));
    this.render();
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
    this.adjustOpen = false;
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
    const scopeDoc = this.cardPreview?.baseline || this.doc;
    const scope = id => {
      if (['slower', 'faster'].includes(id)) return 'Whole song pace';
      if (id === 'longer') return 'Song structure';
      if (['octave-up', 'ring'].includes(id)) return this.editingCard != null ? `Part ${this.editingCard + 1}: your notes` : 'Shared tune: your notes';
      if (id.startsWith('mood-')) return `Part ${Number(id.split('-')[1]) + 1}`;
      if (id.startsWith('ending-')) return `Ending: part ${scopeDoc.song_cards.length}`;
      if (id === 'lift') return `Part ${Math.max(1, scopeDoc.song_cards.findIndex((c, i) => i > 0 && c.tune_variant !== 'lift')) + 1}`;
      return 'Preview';
    };
    const cards = hand.map(card => this._btn(`adjust-card:${card.id}`, `<strong>${esc(card.title)}</strong><span class="pf-sub">${scope(card.id)} · ${esc(card.hint)}</span>${card.id === previewing ? '<span class="pf-sub pf-card-state">Playing it. Tap again to keep.</span>' : ""}`,
      `pf-btn pf-card pf-adjust-card${card.id === previewing ? " pf-adjust-previewing" : ""}`, `aria-pressed="${card.id === previewing}"`)).join("");
    return `<section class="pf-adjust" aria-label="Adjust"><div class="pf-row pf-adjust-head"><strong>Three ideas</strong><span class="pf-sub">Tap one to hear it. Tap again to keep it.</span></div>
      <div class="pf-row pf-adjust-hand" role="group" aria-label="Ideas for your song">${cards}</div>
      <div class="pf-row">${this._btn("adjust-keep-as-is", previewing ? "Restore original" : "Keep as is", "pf-btn pf-small")}${this._btn("adjust-shuffle", "Other ideas", "pf-btn pf-small")}</div></section>`;
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
      blocks.push({ lane: id, step: Number.isFinite(e.start_sec) ? e.start_sec / (15 / song.bpm) : Number(e.step) || 0, length: Number.isFinite(e.duration_sec) ? e.duration_sec / (15 / song.bpm) : Number(e.duration_steps) || 1, own: e.provenance === "user_placed" || e.provenance === "hummed_confirmed", id: e.id });
    }
    return { total, spb, ranges, lanes: lanes.map(([id, label]) => ({ id, label })), blocks,
      parts: ranges.map((r, i) => ({ ...r, name: this.doc.song_cards[i]?.role_name || `Part ${i + 1}` })) };
  }

  _songBlockSvg(index) {
    const model = this._timelineModel(), part = model?.parts[index];
    if (!part) return '';
    const span = part.end_step - part.start_step, width = 240;
    const bars = model.blocks.filter(b => b.step < part.end_step && b.step + b.length > part.start_step).map(b => {
      const start = Math.max(part.start_step, b.step), end = Math.min(part.end_step, b.step + b.length);
      const lane = model.lanes.findIndex(l => l.id === b.lane);
      return `<rect x="${(start - part.start_step) / span * width}" y="${8 + lane * 20}" width="${(end - start) / span * width}" height="10" rx="2" class="pf-tl-block pf-part-${b.lane}${b.own ? ' own' : ''}" data-source-note="${esc(b.id)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 240 90" aria-hidden="true" focusable="false">${bars}<line data-block-progress x1="0" x2="0" y1="0" y2="90" style="display:none"/></svg>`;
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
    if (this.sheetOpen === undefined) this.sheetOpen = this.stage !== "jam" && typeof window !== "undefined" && (window.innerWidth || 0) >= 900;
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
          <div class="pf-row">${playBtn} ${undoBtn} ${keepBtn} ${stepBtn}${this._btn("melody-field-enter", "Make my tune", "pf-btn pf-next")}</div>
          <p class="pf-sub" data-melody-entry-coverage>${this._melodyEntryHint()}</p>
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
        <div class="pf-head-row"><h1 class="pf-heading">Save your music</h1>${this._barsHtml()}</div>
        ${this._liveScoreHtml()}
        <p class="pf-say">${
          mine
            ? (this.draftSaveFailed?"Your edits are not saved. Download an editable song to keep them.":"Pick a name. Save on this device or download a copy.")
            : "You can keep this starting point now and add your own notes later."
        }</p>
        <div class="pf-row pf-name-row">
          <label class="pf-say" for="pf-title">Name:</label>
          <input id="pf-title" type="text" value="${esc(title)}" placeholder="My song" />
          <details class="pf-name-ideas" ${this.nameIdeasOpen ? "open" : ""}><summary data-key="name-ideas">Name ideas</summary><div class="pf-row" role="group" aria-label="Pick a name">${names}</div></details>
        </div>
        <div class="pf-row">
          ${this._btn("save", `${icon("save")} Save here`, "pf-btn pf-big")}
          ${this._btn("download", `${icon("download")} Download audio`, "pf-btn pf-big")}
          ${this._btn("dl-project", `${icon("save")} Download editable song`, "pf-btn pf-big")}
          ${this._btn("play", playing ? `${icon("stop")} Stop` : `${icon("play")} Play`, "pf-btn pf-play")}
          ${this._backBtn()}
        </div>
        ${(this.doc.capture_notes?.melody_field?.version===4&&this.doc.capture_source)||this.melodyArchiveOpen?`<details class="pf-played-take" ${this.playedTakeOpen?"open":""}><summary data-key="played-take">Your played take</summary><p class="pf-sub">Hear your live play. Undo brings your tune back.</p><div class="pf-row">${this.doc.capture_notes?.melody_field?.version===4&&this.doc.capture_source?this._btn('restore-capture-source','Open played take'):''}${this.undoStack?.length?this._btn('undo','Undo'):''}</div></details>`:''}
        ${swapList}
        ${this.saveMessage ? `<p class="pf-say pf-msg" aria-live="polite">${esc(this.saveMessage)}</p>` : ""}
        <details class="pf-demo-tools pf-share-more" ${this.shareMoreOpen ? "open" : ""}><summary data-key="share-more">More</summary>
          <div class="pf-row">
            ${this._btn("dl-sheet", `${icon("note")} Download sheet`, "pf-btn pf-small")}
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
    this.melodyField=null;
    this.melodyArchiveOpen=false;this.playedTakeOpen=false;
    this.melodyFocus = false;
    this.eventRole = "lead"; this.eventPatch=null; this.bandCollapsed=false;this.starterBlocked=false;this.chapterMoveMessage=null;
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
    const generation = scheduler.stopGeneration, songId = this.doc?.id;
    const current = () => scheduler.stopGeneration === generation && this.doc?.id === songId;
    const load = Promise.resolve().then(() => scheduler.preparePiano())
      .then(() => {
        if (current() && this.pianoMessage === "The sounds did not load. Press Play to try again.") {
          this.pianoMessage = ""; this.render();
        }
      })
      .catch(() => {
        // Stop/navigation retires this load. A cancelled graph is not a failed bank.
        if (!current() || scheduler.loadingSession || (scheduler.masterBus?.piano && !scheduler.masterBus.disposed)) return;
        this.pianoMessage = "The sounds did not load. Press Play to try again."; this.render();
      })
      .finally(() => { if (this.quietLoad === load) this.quietLoad = null; });
    this.quietLoad = load;
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

  /**
   * Phase 14.1: a fresh Listen must not wait for the sampled bank. The scheduler's loading session
   * plays the bundled native voices at once and brings the loaded sounds in at the next bar line.
   * Only Listen asks for this (`fast`); choosing a sampled instrument elsewhere still loads first.
   */
  async _beginLoadingSession() {
    const scheduler = this.app.scheduler;
    if (typeof scheduler?.beginLoadingSession !== "function") return false;
    this._stopForScopeChange();
    try { await scheduler.unlock?.(); } catch { /* the first press still proceeds; sound waits for the next gesture */ }
    const session = scheduler.beginLoadingSession();
    if (!session) { this.pianoMessage = ""; return true; }
    this.pianoMessage = LOADING_WORDS.loading;
    session.onChange(state => {
      if (scheduler.loadingSession !== session) return;
      this.pianoMessage = LOADING_WORDS[state] ?? "";
      this.app._announce?.(this.pianoMessage);
      this.render();
    });
    return true;
  }

  async _startInstrument(instrumentId, { fast = false } = {}) {
    const instrument = getInstrument(instrumentId);
    if (!instrument) return;
    if (!this._retainBeforeSwitch()) return;
    const sampled = isSampledPatch(instrumentId);
    // No extra await on the old path: a yield here let another press change the song mid-start (the fuzz found it).
    const quick = fast && sampled && typeof this.app.scheduler?.beginLoadingSession === "function" && await this._beginLoadingSession();
    if (sampled && !quick && !await this._loadPiano()) return;
    this._freshState({audioStopped:sampled});
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
      (this.styleFavorites||[]).map(id=>SCENE_CATALOGUE.findIndex(scene=>scene.id===id)),this._explorationBias(current));
  }

  // Phase 14.3: the person's recent playing leans the pick. Scene movement is measured from the
  // band each candidate would generate for this very song, so the comparison is real, not a label.
  _explorationBias(current) {
    const scheduler=this.app?.scheduler;
    const lean=performanceLean(scheduler?.performanceTake,scheduler?.audioCtx?.currentTime);
    this.explorationLean=lean;
    if(!lean||!lean.lean)return ()=>1;
    const steps=stepsPerBar(this.doc),preserved=(this.doc.notes||[]).filter(note=>note.provenance!=='jam_generated');
    const cache=this._sceneActivityCache||(this._sceneActivityCache=new Map());
    const activityOf=index=>{
      const scene=SCENE_CATALOGUE[index];if(!scene)return NaN;
      const key=`${scene.id}|${this.doc.global_context?.bpm}|${this.doc.jam_session?.density}|${this.doc.jam_session?.color}`;
      if(!cache.has(key)){
        let value=NaN;
        try{value=backingActivity(catalogueBacking(this.doc,{...this.doc.jam_session,scene_id:scene.id,style_spectrum:index,scene_variant:'base'},preserved),steps);}catch{/* a scene this song cannot play stays unweighted */}
        cache.set(key,value);
      }
      return cache.get(key);
    };
    return leanWeights(lean.lean,activityOf(current),activityOf);
  }

  // Musical decisions must not depend on animation frames being painted.
  advanceMusic() {
    if(this.melodyField){this.melodyField.advance();return;}
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
    this._serviceBandHand();
    this._paintHeard();
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
      // Phase 15.2: the receipt fires here, when the answering note has sounded on the audio clock,
      // on both paths (a free style's next-bar plan and a fixed form's answer over its own melody).
      this._showReceipt('You played a note.','Band: picks up your note.',{glyph:'tune',part:'tune',minor:true});
    }
    if (this.answerHeard && this.answerHeard.until <= performance.now()) {
      this.answerHeard = null;
      const status = this.root?.querySelector?.('#pf-answer-heard');
      if (status) status.textContent = "";
    }
  }

  /** The band's next bar opens on the note just played, fitted to that bar's chord. */
  _answerNextBar(midi, sourceNoteId) {
    if(this.melodyField)return false;
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
    // A jam begun from an instrument has no scene and no cursor: undefined === undefined is not a match.
    if(cursor&&snapshot?.source_song_id===this.doc.id&&cursor.id===this.doc.jam_session.scene_id)
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
    if(c.kind==='starter') return `<section class="pf-stage" aria-label="Suggested song"><h2>A song from your tune</h2><p>Your tune returns. Then the band gets soft. Your first playing stays.</p><div class="pf-row">${this._btn('compare-original','Hear my tune')}${this._btn('compare-alternative','Hear song idea')}${this._btn('compare-stop','Stop')}${this._btn('compare-keep','Keep this song')}${this._btn('compare-close','Back to my tune')}</div></section>`;
    if(c.kind==='return') return `<section class="pf-stage" aria-label="Bring this part back"><h2>Bring this part back</h2>
      <p class="pf-say">${c.changed ? 'Add a copy at the end. You can change each part on its own.' : esc(c.reason)}</p>
      <div class="pf-row" aria-label="Song preview order">${(c.auditionAlternative?c.after:c.before).song_cards.map((part,i)=>`<span class="pf-btn" data-return-part="${i}">${esc(part.role_name||`Part ${i+1}`)}</span>`).join('')}</div>
      <div class="pf-row">${this._btn('compare-original','Hear song')}${this._btn('compare-alternative','Hear new song','pf-btn',c.changed?'':'disabled')}${this._btn('compare-stop','Stop')}${this._btn('compare-keep','Keep return','pf-btn pf-next',c.changed?'':'disabled')}${this._btn('compare-close','Keep original')}</div></section>`;
    if(c.kind==='melody') return `<section class="pf-stage" aria-label="Melody explorer"><h2>${c.purpose==='big-moment'?'Shape your big moment':'Explore your tune'}</h2><p>Your rhythm stays. Try a new shape.</p><div class="pf-melody-compass" role="group" aria-label="Tune direction">${MELODY_DIRECTIONS.map(d=>this._choice(`melody-direction:${d.id}`,d.label,d.id===c.direction)).join('')}${this._btn('compare-original','Hear original')}</div><p>${esc(c.changed?MELODY_DIRECTIONS.find(d=>d.id===c.direction).description:c.reason)}</p>${this._melodyBandHtml(c)}<details><summary>Compare tune shapes</summary><div class="pf-melody-pictures">${melodyPictures(c)}</div></details><p class="pf-sub">${c.purpose==='big-moment'?'The app made this. Keep changes this part only. Undo brings it back.':'The app made this. Keep adds a new part. Your first tune stays.'}</p><div class="pf-row">${this._btn('compare-alternative','Hear idea','pf-btn pf-play',c.changed?'':'disabled')}${this._btn('compare-stop','Stop')}${this._btn('compare-keep',c.purpose==='big-moment'?'Keep this part':'Keep new part','pf-btn pf-next',c.changed?'':'disabled')}${this._btn('compare-close','Back to my tune')}</div></section>`;
    if(c.kind==='ending') return `<section class="pf-stage" aria-label="Try a new ending"><h2>Try a new ending</h2>
      <p class="pf-say">${c.changed ? 'The last note goes up one step. The rest stays. MusicLab made this idea.' : esc(c.reason)}</p>
      <p class="pf-sub">Keep adds a new part before the last part. Your first tune stays.</p>
      <div class="pf-row">${this._btn('compare-original','Play original')}${this._btn('compare-alternative','Play idea','pf-btn',c.changed?'':'disabled')}${this._btn('compare-stop','Stop')}${this._btn('compare-keep','Keep new part','pf-btn pf-next',c.changed?'':'disabled')}${this._btn('compare-close','Keep original')}</div></section>`;
    if(c.kind==='answer') return `<section class="pf-stage" aria-label="Optional echo answer"><h2>Try an echo</h2>
      <p class="pf-say">A new part from this tune. Your first notes stay. MusicLab made it.</p>
      <p class="pf-sub">${c.changed ? 'Copies the notes and their lengths, without part effects. Adds an echo before the ending. This is a repeat of your tune, not a new melody.' : esc(c.reason)}</p>
      <div class="pf-row">${this._btn('compare-original','Play original')}${this._btn('compare-alternative','Play echo','pf-btn',c.changed?'':'disabled')}${this._btn('compare-stop','Stop')}${this._btn('compare-keep','Keep echo','pf-btn pf-next',c.changed?'':'disabled')}${this._btn('compare-close','Keep original')}</div></section>`;
    if(c.kind==='band') {
      const point=circlePosition(c.sceneId) || {x:.5,y:.5}, name=SCENE_CATALOGUE.find(s=>s.id===c.sceneId)?.name || 'Band';
      const families=CIRCLE_GROUPS.map((g,i)=>{const angle=((i+.5)/CIRCLE_GROUPS.length-.25)*2*Math.PI;return `<span class="pf-circle-family" style="left:${50+34*Math.cos(angle)}%;top:${50+34*Math.sin(angle)}%">${esc(g.label)}</span>`;}).join('');
      return `<section class="pf-stage" aria-label="Try a band for this part"><h2>New band for part ${c.index+1}</h2>
        <p class="pf-say">Your tune stays. Press Play to hear the loop. Pick a band while it plays.</p>
        <div class="pf-music-circle" data-part-circle tabindex="0" role="group" aria-label="Choose a band. Left and right: style. Up and down: family.">
          <div aria-hidden="true">${families}</div><strong class="pf-circle-title">${esc(name)}</strong><span class="pf-field-requested" style="left:${point.x*100}%;top:${point.y*100}%"></span></div>
        <label for="pf-part-band-picker">Next band</label><select id="pf-part-band-picker">${CIRCLE_GROUPS.map(g=>`<optgroup label="${esc(g.label)}">${g.sceneIds.map(id=>`<option value="${id}" ${id===c.sceneId?'selected':''}>${esc(SCENE_CATALOGUE.find(s=>s.id===id).name)}</option>`).join('')}</optgroup>`).join('')}</select>
        <p class="pf-sub" data-part-issue>${c.issue ? esc(c.issue) : 'The band changes at a bar. Keep saves the band that has played.'}</p><p role="status" aria-atomic="true" data-part-status>Press Play to hear this part.</p>
        <div class="pf-row">${this._btn('compare-original','Play original')}${this._btn('compare-alternative','Play new band','pf-btn',c.candidates?.[c.requestedId]?'':'disabled')}${this._btn('compare-stop','Stop')}${this._btn('compare-keep','Keep this band','pf-btn pf-next',c.realized?.trial?'':'disabled')}${this._btn('compare-close','Keep original')}</div></section>`;
    }
    return `<section class="pf-stage" aria-label="Optional listening comparison"><h2>Compare part ${c.index+1}</h2>
      <p class="pf-say">${c.changed ? `${c.changed} band notes are quieter. Your played notes stay the same. Nothing changes until you choose Keep.` : 'No band notes can change here. Both versions stay the same.'}</p>
      ${c.changed ? '<p class="pf-say">Hear how a softer band leaves your tune more space. You can keep either one.</p>' : ''}
      <div class="pf-row">${this._btn('compare-original','Play original','pf-btn')}${this._btn('compare-alternative',c.changed?'Play quieter band':'Play preview','pf-btn')}
      ${this._btn('compare-stop','Stop comparison','pf-btn')}${this._btn('compare-keep','Keep this change','pf-btn',c.changed?'':'disabled')}
      ${this._btn('compare-close','Keep original / Close','pf-btn')}</div></section>`;
  }

  _melodyBandHtml(c) {
    const doc=c.auditionAlternative?c.after:c.before;
    const card=normalizeSongCards(doc.song_cards)[c.auditionAlternative?(c.afterIndex??c.index):c.index];
    if(!card)return '';
    const local=card.material?applySongMaterial(doc,card.material):doc;
    const loop=compileSongStandalone({...local,arrangement_mode:'loop'});
    const compiled=songEvents(loop,[{...card,material:undefined}]);
    const stepSec=15/compiled.bpm,span=compiled.total_steps;
    const rows=bandRows(compiled.events,[],{card:0,stepSeconds:stepSec});
    return `<section class="pf-comparison-band" aria-label="Band in this preview"><h3>${c.auditionAlternative?'Tune idea':'Original tune'}</h3><p class="pf-sub" data-melody-audition-status>Press Hear to play.</p>${rows.map(row=>{
      const pitches=row.events.map(e=>e.pitch),low=Math.min(...pitches),high=Math.max(...pitches);
      const marks=row.events.map(e=>`<span class="pf-band-mark" data-audition-onset="${e.onset}" data-audition-end="${e.onset+e.duration}" style="left:${e.onset/span*100}%;width:${Math.min(e.duration,span-e.onset)/span*100}%;top:${high>low?8+(high-e.pitch)/(high-low)*28:20}px"></span>`).join('');
      return `<div class="pf-band-summary"><div class="pf-band-label">${esc(getInstrument(row.patch)?.label||row.patch)}<small>${esc({lead:'Tune',bass:'Bass',harmony:'Chords',drums:'Beat',hocket:'Reply',fx:'Effect'}[row.role]||row.role)}</small></div><div class="pf-band-track" aria-hidden="true">${marks}<span class="pf-audition-cursor" data-audition-span="${span}" hidden></span></div></div>`;
    }).join('')}</section>`;
  }

  _pointPartCircle(event) {
    const rect=this.partCircleGesture?.rect;
    if(!rect || this.partComparison?.kind!=='band')return;
    const id=circleSceneAt((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);
    if(id)this._selectPartBand(id);
  }

  _partCandidateCompiled(candidate) {
    const doc=candidate.doc, c=this.partComparison;
    const card=normalizeSongCards(doc.song_cards).find(n=>n.section_id===c.sectionId);
    if(!card)return null;
    const local=card.material?applySongMaterial(doc,card.material):doc;
    const loop=compileSongStandalone({...local,arrangement_mode:'loop'});
    return songEvents(loop,[{...card,material:undefined}]);
  }

  _syncPartAudition() {
    const c=this.partComparison;
    if(c?.kind==='melody') {
      const scheduler=this.app.scheduler;
      if(!scheduler.isPlaying&&c.auditionStarted&&!c.canonicalRestored&&this.app.compiledSong){scheduler.setCompiledSong(this.app.compiledSong);c.canonicalRestored=true;}
      const quiet=this.comfort?.lessMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const position=scheduler.isPlaying&&c.auditionStarted?(quiet?scheduler.lastVisualClock?.step:this.visualPosition):null;
      for(const marker of this.root?.querySelectorAll('[data-audition-span]')||[]){const span=Number(marker.dataset.auditionSpan);marker.hidden=!Number.isFinite(position)||position<0||position>=span;if(!marker.hidden)marker.style.left=`${position/span*100}%`;}
      for(const mark of this.root?.querySelectorAll('[data-audition-onset]')||[])mark.classList.toggle('pf-band-playing',Number.isFinite(position)&&position>=Number(mark.dataset.auditionOnset)&&position<Number(mark.dataset.auditionEnd));
      const status=this.root?.querySelector('[data-melody-audition-status]');
      if(status)status.textContent=scheduler.isPlaying&&c.auditionStarted?(c.auditionAlternative?'Playing the idea.':'Playing the original.'):'Stopped. Press Hear to play.';
      return;
    }
    if(c && ['return','starter'].includes(c.kind)) {
      const scheduler=this.app.scheduler;
      if(!scheduler.isPlaying && c.auditionStarted && !c.canonicalRestored && this.app.compiledSong){scheduler.setCompiledSong(this.app.compiledSong);c.canonicalRestored=true;}
      const doc=c.auditionAlternative?c.after:c.before;
      const clock=scheduler.lastVisualClock;
      const ranges=songCardRanges(doc.song_cards,Number(doc.global_context?.bars||4)*stepsPerBar(doc),doc.global_context.bpm,stepsPerBar(doc));
      for(const block of this.root?.querySelectorAll?.('[data-return-part]')||[]) {
        const i=Number(block.dataset.returnPart),range=ranges[i];
        const active=scheduler.isPlaying&&range&&clock?.step>=range.start_step&&clock.step<range.end_step;
        block.classList.toggle('active',Boolean(active));block.setAttribute('aria-current',active?'true':'false');
      }
      return;
    }
    if(c?.kind!=='band')return;
    const scheduler=this.app.scheduler;
    const state=scheduler.getPartAuditionState?.() || scheduler.lastPartAuditionState;
    if(state?.sectionId===c.sectionId && c.candidates?.[state.realizedId]) c.realized=c.candidates[state.realizedId];
    if(!scheduler.isPlaying && c.auditionStarted && !c.canonicalRestored && this.app.compiledSong){
      scheduler.setCompiledSong(this.app.compiledSong);c.canonicalRestored=true;
    }
    const pending=scheduler.isPlaying && state?.realizedId!==state?.requestedId;
    const playing=c.realized?.name || 'Original';
    const status=this.root?.querySelector('[data-part-status]');
    const text=scheduler.isPlaying && !state?.realizedId ? 'Starting the loop.' : scheduler.isPlaying ? `Playing: ${playing}.${pending ? ` Next: ${c.candidates?.[state?.requestedId]?.name || 'new band'}.` : ''}`
      :c.realized?`Stopped. Last played: ${playing}.`:'Press Play to hear this part.';
    if(status&&status.textContent!==text)status.textContent=text;
    const keep=this.root?.querySelector('[data-key="compare-keep"]');if(keep)keep.disabled=!c.realized?.trial;
  }

  _selectPartBand(sceneId) {
    const current=this.partComparison;
    if(current?.kind!=='band'||current.sceneId===sceneId)return;
    const planned=planSectionDirection(current.before,{sectionId:current.sectionId,sceneId});
    const applied=planned.ok?applySectionTrial(current.before,planned.trial):null;
    current.candidates ||= {};
    if(!current.auditionPrefix){this.partAuditionSequence=(this.partAuditionSequence||0)+1;current.auditionPrefix=`part-${this.partAuditionSequence}-`;}
    const requestId=current.auditionPrefix+sceneId;
    if(applied?.ok) current.candidates[requestId]={requestId,doc:applied.doc,trial:planned.trial,name:SCENE_CATALOGUE.find(s=>s.id===sceneId)?.name || 'New band'};
    Object.assign(current,{sceneId,requestedId:requestId,after:applied?.ok?applied.doc:current.before,
      changed:applied?.ok&&planned.trial.summary.changed,
      issue:!applied?.ok?'This band does not fit this part yet. Your song stays the same.':null});
    if(applied?.ok && this.app.scheduler.getPartAuditionState?.()) {
      const compiled=this._partCandidateCompiled(current.candidates[requestId]);
      if(!compiled || !this.app.scheduler.queuePartAudition(compiled,{sectionId:current.sectionId,requestId}).ok)
        current.issue='This band needs a new preview. Stop, then press Play.';
    }
    // Keep the wheel DOM and pointer capture intact while dragging.
    const circle=this.root.querySelector('[data-part-circle]');
    if(circle){
      const point=circlePosition(sceneId)||{x:.5,y:.5};
      const marker=circle.querySelector('.pf-field-requested');if(marker){marker.style.left=`${point.x*100}%`;marker.style.top=`${point.y*100}%`;}
      const title=circle.querySelector('.pf-circle-title');if(title)title.textContent=SCENE_CATALOGUE.find(s=>s.id===sceneId)?.name||'Band';
      const picker=this.root.querySelector('#pf-part-band-picker');if(picker)picker.value=sceneId;
      const issue=this.root.querySelector('[data-part-issue]');if(issue)issue.textContent=current.issue||'The band changes at a bar. Keep saves the band that has played.';
      const play=this.root.querySelector('[data-key="compare-alternative"]');if(play)play.disabled=!applied?.ok;
    } else this.render();
    this._syncPartAudition();
  }

  async _playBandComparison(alternative) {
    const c=this.partComparison;
    if(c?.kind!=='band')return;
    const token=this.comparisonGeneration=(this.comparisonGeneration||0)+1;
    const scheduler=this.app.scheduler;
    if(!c.candidates)return;
    const originalId=c.auditionPrefix+'original';
    c.candidates[originalId] ||= {requestId:originalId,doc:c.before,trial:null,name:'Original'};
    if(scheduler.getPartAuditionState?.()) {
      const candidate=c.candidates[alternative?c.requestedId:originalId];
      if(candidate) scheduler.queuePartAudition(this._partCandidateCompiled(candidate),{sectionId:c.sectionId,requestId:candidate.requestId});
      this._syncPartAudition();return;
    }
    this._stopForScopeChange();const stopGeneration=scheduler.stopGeneration;
    try {
      await scheduler.preparePiano();
      if(token!==this.comparisonGeneration || this.partComparison!==c || this.stage!=='song'
        ||stopGeneration!==scheduler.stopGeneration || JSON.stringify(this._canonicalDoc())!==JSON.stringify(c.before))return;
      const candidate=c.candidates[alternative?c.requestedId:originalId];if(!candidate)return;
      const compiled=this._partCandidateCompiled(candidate);if(!compiled)return;
      scheduler.setLoopRange(0,null);scheduler.setRepeatPlayback(true);scheduler.clearMuteLayers();scheduler.setSpotlightRole(null);
      if(!scheduler.beginPartAudition(compiled,{sectionId:c.sectionId,requestId:candidate.requestId}).ok)return;
      c.auditionStarted=true;c.canonicalRestored=false;scheduler.start();this._syncPartAudition();
    } catch(error){this.app._announce(`Could not play this band: ${error.message}`);}
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
    if(this.partComparison?.kind==='band')return this._playBandComparison(alternative);
    const comparison=this.partComparison;
    if(!comparison || JSON.stringify(this._canonicalDoc())!==JSON.stringify(comparison.before))return;
    const token=this.comparisonGeneration=(this.comparisonGeneration||0)+1;
    this._stopForScopeChange();
    const doc=alternative?comparison.after:comparison.before;
    const stopGeneration=this.app.scheduler.stopGeneration;
    const card=normalizeSongCards(doc.song_cards)[alternative ? (comparison.afterIndex ?? comparison.index) : comparison.index];
    if (!card) return;
    const local=card.material?applySongMaterial(doc,card.material):doc;
    const loop=compileSongStandalone({...local,arrangement_mode:'loop'});
    const compiled=['return','starter'].includes(comparison.kind)?compileReturnSong(doc):songEvents(loop,[{...card,material:undefined}]);
    try {
      if(compiled.events.some(e=>isSampledPatch(e.patch_id)))await this.app.scheduler.preparePiano();
      if(token!==this.comparisonGeneration || this.partComparison!==comparison
        || stopGeneration!==this.app.scheduler.stopGeneration || this.stage!=='song'
        || JSON.stringify(this._canonicalDoc())!==JSON.stringify(comparison.before))return;
      if(['return','starter','melody'].includes(comparison.kind)) {
        comparison.auditionAlternative=alternative;comparison.auditionStarted=true;comparison.canonicalRestored=false;
        this.app.scheduler.setLoopRange(0,null);this.app.scheduler.setRepeatPlayback(false);
        this.app.scheduler.setCompiledSong(compiled);this.app.scheduler.start();this.render();
        if(comparison.kind==='melody')this.root.querySelector(`[data-key="${alternative?'compare-alternative':'compare-original'}"]`)?.focus();
      } else this.app.scheduler.playComparisonOnce(compiled);
      this.app._announce(alternative&&comparison.changed?(comparison.kind==='melody'?'Playing the tune idea.':comparison.kind==='starter'?'Playing the song idea.':comparison.kind==='answer'?'Playing the echo.':comparison.kind==='ending'?'Playing the new ending.':comparison.kind==='return'?'Playing the song with a return.':comparison.kind==='band'?'Playing the new band.':'Playing the quieter band example.'):'Playing the original part.');
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
      if (isSampledPatch(sound.patchId) && !scheduler.loadingSession && (!scheduler.masterBus?.piano || scheduler.masterBus.disposed)) await scheduler.preparePiano();
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
  _playJamPad(pad, holdSource = null, retried = false, resolvedPads = null) {
    if (this.stage !== "jam" || !Number.isInteger(pad) || pad < 0) return;
    const pads = resolvedPads || this._liveJamPads();
    if (pad >= pads.length) return;
    if (!this.jamPlayed) { this.jamPlayed = true; this._refreshJourney(); }
    if(this.melodyField)this.melodyField.exploring=null;
    if(this.melodyField||this.doc.jam_session?.live_keys) {
      const sound=pads[pad],scheduler=this.app.scheduler;
      scheduler.makeRoomForLive=this.doc.jam_session.responsive===true;
      if(!scheduler.isPlaying||(isSampledPatch(sound.patchId)&&!scheduler.loadingSession&&(!scheduler.masterBus?.piano||scheduler.masterBus.disposed)))
        return retried?this._soundsNotReady():this._readyThenPlay(pad,holdSource);
      if(holdSource)this._releaseLive(holdSource);
      // Past the held-note limit a press still sounds, as a short note; earlier holds keep ringing.
      if(holdSource&&sound.role!=='drums'&&sound.patchId!=='reverse_swell'&&scheduler.liveNotes?.size>=LIVE_VOICE_LIMIT){holdSource=null;this._heldFull();}
      this.holdSequence=(this.holdSequence||0)+1;
      const sourceNoteId=`jam-live-${this.doc.id}-${this.holdSequence}-${performance.now()}`;
      try {
        if(holdSource){const id=scheduler.noteOn({...sound,sourceNoteId});if(id!=null){this._rememberUnkeptPlaying(sourceNoteId);this.liveHolds.set(holdSource,id);this._markJamPad(pad,holdSource,id);}}
        else {const dispatched=scheduler.previewSound({...sound,sourceNoteId,durationSec:.25});if(dispatched===true)this._rememberUnkeptPlaying(sourceNoteId);if(!scheduler.previewsMuted)this._markJamPad(pad);}
        if(!scheduler.previewsMuted&&!this.melodyField){scheduler.addPlayEnergy?.();if(sound.role!=='drums'&&this._answerNextBar(sound.midi,sourceNoteId))this._rememberAnswerPad(sourceNoteId,pad);}
      }catch(error){this.jamMessage=`Could not play: ${error.message}`;this.app._announce(this.jamMessage);this.render();}
      return;
    }
    const performedSound=pads[pad];
    if (isSampledPatch(performedSound.patchId) && !this.app.scheduler.loadingSession && (!this.app.scheduler.masterBus?.piano || this.app.scheduler.masterBus.disposed))
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
    this._paintHeard?.(); // Phase 15.1: the meter answers the press at once, not at the next music tick.
  }

  _paintJamPads() {
    this._paintPadNoteNames();
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
    if (this.answerOnRelease && !this.liveHolds.size && !this.melodyField) {
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
    if (doc) { if(this.melodyField)this.doc=doc;else this._acceptJamDoc(doc); }
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
    if (this.stage==='tune' && this.tuneGrid?.eventEditor && (this.eventRole||'lead')==='lead' && instrument.kind==='drums') return;
    if (isSampledPatch(id)) {
      const stage=this.stage,card=this.editingCard,docId=this.doc.id;
      const loading=this._loadPiano(),generation=this.app.scheduler.stopGeneration;
      const before=JSON.stringify(this._canonicalDoc());
      if (!await loading) return;
      if(this.stage!==stage||this.editingCard!==card||this.doc.id!==docId
        ||this.app.scheduler.stopGeneration!==generation||JSON.stringify(this._canonicalDoc())!==before)return;
    }
    this._pushUndo();
    if (!isSampledPatch(id)) this._stopForScopeChange();
    this.doc.selected_instrument = id;
    if (instrument.kind === "drums") this.doc.drum_kit = instrument.kitId;
    else {
      this.eventPatch=null;
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
    else this._readingToast(true); // Phase 15.2: a visible sign that reading began
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
    if(key==='melody-field-enter')return this._enterMelodyField();
    if(key==='melody-field-resume')return this._resumeMelodyField();
    if(this.melodyField&&key.startsWith('melody-field-'))return this._melodyFieldAction(key);
    this.deleteMessage = null;
    if(!key.startsWith('circle-blend:')&&!key.startsWith('field-nudge:')&&!['circle-next','circle-previous','circle-family'].includes(key))this.cancelFieldGesture();
    if(['field-options','demo-tools','participation-options','start-options','cycle-options','circle-options','melody-pads','melody-keep-more','refine-more','note-list','event-timing'].includes(key))return;
    if(key.startsWith('circle-blend:')&&this.stage==='jam'&&this.doc.jam_session.exploration_map==='catalogue-circle-v2'){const current=(this.circleIntent?this.circleIntent.field:this.doc.jam_session.music_field)?.x??.5;const x=Math.round(Math.max(0,Math.min(1,current+(key.endsWith('more')?.025:-.025)))*1000)/1000;this._requestCircle(['ska-v1','rocksteady-v1','reggae-v1'][Math.round(x*2)],false,{version:5,x,y:.5});return;}
    if((key==='hand-take'||key==='hand-skip')&&this.stage==='jam')return this._handKey(key);
    if(['circle-next','circle-previous','circle-family'].includes(key)) {
      const id=this.circleIntent?.id||this.doc.jam_session.scene_id;
      this._requestCircle(key==='circle-family'?this._circleFamilyChoice(id,1):circleStep(id,key==='circle-next'?1:-1),false);return;
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
      // The slide field is four-beat music; a three-beat style keeps its own time instead of throwing.
      if(stepsPerBar(this.doc)!==16){this.jamMessage='This style keeps its own time. The slide field is for four-beat styles.';this.app._announce(this.jamMessage);return this.render();}
      this._pushUndo();this._fitTempo();this.exploreTour=null;
      this._acceptJamDoc(setJamDirection(this.doc,{music_field:{version:4,x:.5,y:.5}}));
      this.render();this._paintMusicField();this.root.querySelector('[data-music-field]')?.focus();return;
    }
    if(key.startsWith('new-cycle:') && this.stage==='start') {
      this.newCycle=key==='new-cycle:12'?12:16;return this.render();
    }
    if(['melody-echo','melody-ending'].includes(key) && this.stage==='tune') {
      const index=this.editingCard ?? this.activeSongCard ?? 0;
      this._stopForScopeChange();
      this._go('song');
      this.partComparison=(key==='melody-ending'?previewEndingIdea:previewEchoAnswer)(this._canonicalDoc(), index);
      this.render();this.root.querySelector('[data-key="compare-original"]')?.focus();return;
    }
    if(key==='melody-explore') {
      const index=this.editingCard??this.activeSongCard??0;
      this._finishPartEdit();this._stopForScopeChange();this._go('song');
      const doc=this._canonicalDoc(),big=starterGroups(doc)?.find(g=>chapterKind(g)==='big')?.indices.includes(index);
      this.partComparison=(big?previewBigMoment:exploreMelody)(doc,index);this.render();
      this.root.querySelector('[data-key="melody-direction:rise"]')?.focus();return;
    }
    if(key.startsWith('melody-direction:') && this.partComparison?.kind==='melody') {
      const c=this.partComparison;this.comparisonGeneration=(this.comparisonGeneration||0)+1;this._stopForScopeChange();
      this.partComparison=(c.purpose==='big-moment'?previewBigMoment:exploreMelody)(c.before,c.index,key.slice('melody-direction:'.length));this.render();
      this.root.querySelector(`[data-key="${key}"]`)?.focus();return;
    }
    if(key.startsWith('part-return:') && this.stage==='song') {
      const index=Number(key.slice('part-return:'.length));this._stopForScopeChange();
      this.partComparison=previewReturningPart(this._canonicalDoc(),index);
      this.render();this.root.querySelector('[data-key="compare-original"]')?.focus();return;
    }
    if(key.startsWith('part-band:') && this.stage==='song') {
      const index=Number(key.slice('part-band:'.length));
      if(!Number.isInteger(index)||!this.doc.song_cards[index])return;
      this._stopForScopeChange();
      const before=this._canonicalDoc(), sectionId=before.song_cards[index].section_id;
      this.partComparison={kind:'band',index,sectionId,before,after:before,changed:false,sceneId:null};
      this._selectPartBand(before.song_cards[index].section_direction?.scene_id || before.jam_session?.scene_id || CIRCLE_SCENES[0]);
      this.root.querySelector('[data-part-circle]')?.focus();return;
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
    if(key==='compare-stop'){this._syncPartAudition();this.comparisonGeneration=(this.comparisonGeneration||0)+1;this._stopForScopeChange();this._syncPartAudition();return;}
    if(key==='compare-keep' || key==='compare-close') {
      this._syncPartAudition();
      const comparison=this.partComparison;
      if(comparison?.kind==='band') {
        const kept=key==='compare-keep'&&comparison.realized?.trial
          ?applySectionTrial(this._canonicalDoc(),comparison.realized.trial):null;
        this.comparisonGeneration=(this.comparisonGeneration||0)+1;this._stopForScopeChange();
        if(kept?.ok){this._pushUndo();this.doc=kept.doc;this.activeSongCard=this.doc.song_cards.findIndex(c=>c.section_id===comparison.sectionId);this._compile();this.app._announce('Kept this band. Your tune stays. Undo brings the old band back.');}
        if(key==='compare-keep' && !kept?.ok)this.app._announce('This part has changed. Your new edits stay. Try the band again.');
        this.partComparison=null;this.render();this.root.querySelector(`[data-key="part-band:${this.activeSongCard??comparison.index}"]`)?.focus();return;
      }
      this.comparisonGeneration=(this.comparisonGeneration||0)+1;this._stopForScopeChange();
      if(key==='compare-keep' && comparison?.changed && JSON.stringify(this._canonicalDoc())===JSON.stringify(comparison.before)) {
        this._pushUndo();this.doc=comparison.after;this._compile();
        this.activeSongCard=comparison.afterIndex ?? comparison.index;
        this.app._announce(comparison.purpose==='big-moment'?'Changed this part. Undo brings it back.':comparison.kind==='melody'?'Kept a new tune part. Your first tune stays. Undo takes the new part out.':comparison.kind==='starter'?'Kept this song idea. Undo brings your tune back.':comparison.kind==='return'?'Added a return. Each part has its own notes. Undo takes the copy out.':comparison.kind==='ending'?'Added a new part. Your first tune stays. Undo takes the new part out.':comparison.kind==='answer'?'Added an echo. Your first tune stays. Undo takes the echo out.':`Changed the band in part ${comparison.index+1}. Use Undo to bring it back.`);
      }
      else if(key==='compare-keep')this.app._announce('Your new edits stay. Try this idea again.');
      this.partComparison=null;
      if(comparison?.purpose==='big-moment'&&key==='compare-keep'){this.melodyFocus=true;return this._editPart(comparison.index,'tune',{undo:false});}
      if(['starter','melody'].includes(comparison?.kind) && key==='compare-close'){this.melodyFocus=true;return this._editPart(comparison.index,'tune');}
      this.render();
      if(comparison?.kind==='return')this.root.querySelector(`[data-key="melody-part:${this.activeSongCard??comparison.index}"]`)?.focus();
      return;
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
      this.app._announce(`Changing style at the next musical boundary. Your notes stay. ${leanWords(this.explorationLean?.lean)}`.trim());
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
      if (!await this._startInstrument('sampled_piano_v1', { fast: true })) return;
      // The main button opens on a band that has whole-melody choices. Every band stays in the picker.
      const openingPool=key==='listen-circle'?SCENE_CATALOGUE.filter(scene=>COMPOSER_SCENES.includes(scene.id)):SCENE_CATALOGUE;
      if(stepsPerBar(this.doc)===16)
        this._acceptJamDoc(setJamDirection(this.doc,{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:openingPool[Math.min(openingPool.length-1,Math.floor((this.explorationRandom||Math.random)()*openingPool.length))].id,scene_mix:SCENE_MIX_VERSION}));
      if(key==='listen-field'&&stepsPerBar(this.doc)===16)this._acceptJamDoc(setJamDirection(this.doc,{music_field:{version:4,x:.5,y:.5}}));
      if(key==='listen-circle')this.doc.jam_session.exploration_map='catalogue-circle-v2';
      Object.assign(this.doc.jam_session,{live_keys:true,dynamic_keys:true,follow_band_sound:true,personal_only:false,auto_answer:true});
      if(key==='listen-circle'){const field=circleFieldForScene(this.doc.jam_session.scene_id);this._acceptJamDoc(field?setJamDirection(this.doc,{music_field:field}):this.doc);}
      this.exploreTour = key!=='listen-explore'?null:{mode:'wide',direction:1, settledAt:null};
      this.app.scheduler.setRepeatPlayback(true);
      this.app.scheduler.start();
      if(this.app.scheduler.isPlaying&&!this.app.scheduler.loadingSession)this.pianoMessage='';
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
    if(key.startsWith("event-pick:")){this.eventSelectionExplicit=true;this.eventTuneId=decodeURIComponent(key.slice(11)); const picked=this.doc.notes.find(n=>n.id===this.eventTuneId); if(picked?.role==='drums')this.eventDrumLane=drumLaneKey(picked,this.doc); return this.render();}
    if (key.startsWith("event-select:")) { this.eventSelectionExplicit=true;this.eventTuneId=decodeURIComponent(key.slice(13)); const picked=this.doc.notes.find(n=>n.id===this.eventTuneId); if(picked?.role==='drums')this.eventDrumLane=drumLaneKey(picked,this.doc); return this.render(); }
    if (key.startsWith('event-lane:') && this.eventRole==='drums') {
      const lane=drumLanes({...this.doc,notes:this.doc.notes.filter(n=>!this.eventPatch||n.patch_id===this.eventPatch)})[Number(key.slice(11))];
      if(!lane)return;
      this.eventDrumLane=lane.key;this.eventSelectionExplicit=false;
      return this.render();
    }
    if(key.startsWith('band-row:')) {
      const [role,patch]=JSON.parse(decodeURIComponent(key.slice(9)));
      const source=this.doc.notes.find(n=>n.role===role&&n.patch_id===patch);
      if(!source){this.app._announce('The band plays this. Try Edit backing.');return;}
      this.bandCollapsed=this.eventRole===role&&this.eventPatch===patch?!this.bandCollapsed:false;
      this.eventRole=role;this.eventPatch=patch;this.eventTuneId=source.id;this.eventDrumLane=null;
      this.eventSelectionExplicit=false;this.instrumentPickerOpen=false;
      this.render();[...this.root.querySelectorAll("[data-key]")].find(button=>button.dataset.key===key)?.focus();return;
    }
    if (key.startsWith('event-role:')) {
      const role=key.slice('event-role:'.length);
      if(!['lead','bass','harmony','drums','fx','hocket'].includes(role))return;
      this.bandCollapsed=false;this.eventRole=role;this.eventPatch=null;this.eventDrumLane=null;this.eventTuneId=null;this.eventSelectionExplicit=false;this.instrumentPickerOpen=false;
      const first=this.doc.notes.filter(n=>n.role===role).sort((a,b)=>a.step-b.step)[0];
      this.eventTuneBar=first?Math.floor(first.step/stepsPerBar(this.doc)):0;
      this.melodyFocus=true;this.tuneGrid.eventEditor=true;
      this.app.scheduler?.setSpotlightRole(null);
      return this.render();
    }
    if(key==='event-pitch-snap'){this.pitchSnap=this.pitchSnap===false;return this.render();}
    if (key==='event-zoom') { const chosen=this.doc.notes.find(n=>n.id===this.eventTuneId);if(chosen)this.eventTuneBar=Math.max(0,Math.min(this._partBars()-1,Math.floor(chosen.step/stepsPerBar(this.doc))));this.eventTuneZoom=true;this.render();this.root.querySelector(`[data-key="event-bar:${this.eventTuneBar}"]`)?.focus();return; }
    if (key==='event-whole-part') { this.eventTuneZoom=false; return this.render(); }
    if (key.startsWith("event-bar:")) { this.eventTuneZoom=true; this.eventTuneBar=Number(key.slice(10)); return this.render(); }
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

    if (key.startsWith('select-card:')) {
      const index = Number(key.slice('select-card:'.length));
      if (!Number.isInteger(index) || !this.doc.song_cards?.[index]) return;
      this.activeSongCard = index;
      this.render();
      this.root.querySelector?.(`[data-key="select-card:${index}"]`)?.focus?.({preventScroll:true});
      return;
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
      const melodyArchive=this.doc.capture_notes?.melody_field?.version===4;
      this._pushUndo();
      this._stopForScopeChange();
      this.editingCard = null;
      this.sharedMaterial = null;
      this._acceptJamDoc(JSON.parse(JSON.stringify(this.doc.capture_source)));
      this.melodyArchiveOpen=melodyArchive;if(melodyArchive)this.playedTakeOpen=true;
      this._go(melodyArchive?"keep":"song");
      return this.app._announce(melodyArchive?"Your played take is here. Undo brings your tune back.":"Your loop is back. Undo brings this take back.");
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
    if(key==='library-open'){this.savePage=0;this.libraryOpen=true;this.render();this.root.querySelector('[data-key="library-close"]')?.focus();return;}
    if(key==='library-close'){this.libraryOpen=false;this.render();this.root.querySelector('[data-key="library-open"]')?.focus();return;}
    if (key.startsWith('library-select:')) { this.librarySelection=key.slice(15); return this.render(); }
    if (key==='library-trash') { this.libraryTrash=!this.libraryTrash;this.librarySelection=null;this.savePage=0;return this.render(); }
    if (key.startsWith('library-restore:')) {
      const result=restoreSong(window.localStorage,key.slice(16));
      this.deleteMessage=result.ok?'Song restored.':result.reason==='slots_full'?'Saved song slots are full. Move another song to Trash first.':'Could not restore. Your recovery copy is unchanged.';
      if(result.ok){this.libraryTrash=false;this.librarySelection=key.slice(16);this.savePage=Math.floor(songLibrary(window.localStorage).songs.findIndex(row=>row.id===this.librarySelection)/SAVES_PER_PAGE);}
      this.app._announce(this.deleteMessage);this.render();
      if(result.ok)this.root.querySelector(`[data-key="library-select:${CSS.escape(this.librarySelection)}"]`)?.focus();
      return;
    }
    if(key.startsWith('library-copy:')||key.startsWith('library-checkpoint:')) {
      const checkpoint=key.startsWith('library-checkpoint:');
      const id=key.slice(checkpoint?19:13);
      const row=songLibrary(window.localStorage).songs.find(row=>row.id===id);
      if(!row||!this._retainBeforeSwitch())return;
      const copy=JSON.parse(JSON.stringify(checkpoint?row.saved:row.draft||row.saved));
      copy.id=`song-${globalThis.crypto.randomUUID()}`;
      copy.title=`${copy.title||'My song'}${checkpoint?' - saved copy':' - copy'}`;
      if(!stashWorkingSong(window.localStorage,copy)){this.deleteMessage='Could not save a copy. The original is unchanged.';return this.render();}
      return this._loadDocIntoFlow(copy,{stage:'song'});
    }
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
    if(key==='starter-existing'){this.starterBlocked=false;this._finishPartEdit();this._go('song');return;}
    if(key==='build-starter'||key==='guide-starter') {
      const index=this.editingCard ?? 0;
      const trial=starterSong(this._canonicalDoc(),index);
      if(!trial){this.starterBlocked=true;this.render();this.root.querySelector('[data-starter-blocked]')?.focus();this.app._announce('Your tune is safe. Keep these parts and shape them next.');return;}
      this.starterBlocked=false;
      this._finishPartEdit();this._stopForScopeChange();
      if(key==='build-starter'){this._go('song');this.partComparison=starterSong(this._canonicalDoc(),index);this.render();return;}
      this._pushUndo();this.doc=trial.after;this.doc.song_path.step='chorus';this._compile();
      this.melodyFocus=true;return this._editPart(trial.afterIndex,'tune',{undo:false});
    }
    if(key==='guide-ending'||key==='guide-shape') {
      this._finishPartEdit();this._pushUndo();
      this.doc.song_path.step=key==='guide-ending'?'ending':'shape';this._compile();
      if(key==='guide-shape')return this._go('song');
      this.melodyFocus=true;return this._editPart(starterGroups(this.doc)?.find(g=>chapterKind(g)==='ending')?.indices[0]??this.doc.song_cards.length-1,'tune');
    }
    if (key.startsWith('melody-part:')) {
      const index = Number(key.slice('melody-part:'.length));
      if (!Number.isInteger(index) || !this.doc.song_cards?.[index]) return;
      this.melodyFocus = true;
      return this._editPart(index, 'tune');
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
      if (this.doc.song_cards.length >= MAX_SONG_CARDS) return;
      this._pushUndo();
      const result = insertSongPart(this.doc.song_cards, this.doc.song_cards[this.activeSongCard || 0]?.section_id, this.doc);
      this.doc.song_cards = result.cards;
      this.activeSongCard = result.cards.findIndex(c => c.section_id === result.selectedSectionId);
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
    if (key.startsWith('remove-build-effects:')) {
      const index=Number(key.slice('remove-build-effects:'.length));
      if(!Number.isInteger(index)||!this.doc.song_cards[index])return;
      this._pushUndo();this.doc=removeGeneratedBuildEffects(this._canonicalDoc(),index);this._compile();this.render();
      this.app._announce('Auto effects removed from this part. Undo brings them back.');return;
    }
    if (key.startsWith("remove-card:")) {
      const idx = Number(key.slice("remove-card:".length));
      if (this.doc.song_cards.length <= 1 || !this.doc.song_cards[idx]) return;
      this._pushUndo();
      const result = removeSongPart(this.doc.song_cards, this.doc.song_cards[idx].section_id);
      this.doc.song_cards = result.cards;
      this.activeSongCard = result.cards.findIndex(c => c.section_id === result.selectedSectionId);
      recordAct(this.doc, "song_card", { action: "remove", card: idx, count: this.doc.song_cards.length });
      this._compile();
      this.app._announce(`Removed part ${idx + 1}. Undo can bring it back.`);
      return this.render();
    }
    if(key.startsWith('move-chapter:')||key.startsWith('change-chapter:')) {
      const [,raw,direction]=key.split(':'),index=Number(raw);
      const result=(key.startsWith('change-chapter:')?changeStarterChapter:moveStarterChapter)(this._canonicalDoc(),this.doc.song_cards[index]?.section_id,direction);
      if(!result.changed){this.chapterMoveMessage=result.reason;this.render();this.root.querySelector("[data-chapter-message]")?.focus();this.app._announce(result.reason);return;}
      this._pushUndo();this._stopForScopeChange();this.doc=result.doc;this.activeSongCard=result.selectedIndex;
      this.chapterMoveMessage=key.startsWith('change-chapter:')?'Changed the whole part. Undo brings it back.':'Moved the whole part. All its pages moved.';this._compile();this.render();
      this.root.querySelector(`[data-key="select-card:${starterGroups(this.doc).find(g=>g.indices.includes(this.activeSongCard)).indices[0]}"]`)?.focus();return;
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
    if (key === "pad-note-names") {
      this.padNoteNames = !this._padNoteNamesOn();
      savePadNoteNames(globalThis.localStorage, this.padNoteNames);
      this.app._announce(this.padNoteNames ? "Pads now show note names. They change when the band changes chord." : "Pads show keys again.");
      return this.render();
    }
    if (key === "optimize") { this._openAdjust(); return this.render(); }
    if (key === "sounds-retry") { this.app.scheduler?.loadingSession?.retry?.(); return this.render(); }
    if (key === "parents") {
      this._stopForScopeChange();
      // Static hosting and the local app's root aliases have different page mounts.
      // Check before navigating so a missing help page never replaces the song.
      for (const path of ["../../parents.html", "../../static/parents.html"]) {
        const url = new URL(path, import.meta.url).href;
        try {
          if ((await window.fetch(url)).ok) { window.location.href = url; return; }
        } catch (_) { /* Try the other supported mount without leaving the song. */ }
      }
      this.app._announce("Could not find that page. Your song is still here. Try again.");
      return;
    }
    if (key.startsWith("hub-open:")) { const to = key.slice("hub-open:".length); this.detailHub = false; if (!["beat", "tune", "under"].includes(to)) return; this._go(to); return this.render(); }
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
      this.app._announce(res.ok ? `Saved "${res.entry.title}" to your shelf.` : "Add a note first to save a phrase.");
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
        return this.app._announce("Add a note first, then mix it.");
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
    if (this.doc?.id === id && !this._retainBeforeSwitch()) return;
    if (!confirmPress(this.confirm, `delete:${id}`)) {
      this.app._announce("Press one more time to throw it out.");
      return this.render();
    }
    const result = trashSong(window.localStorage, id);
    if(result.ok) this.librarySelection=null;
    this.deleteMessage = result.ok ? "Moved to Trash. You can restore this song there." : result.reason === "missing" ? "That saved song could not be found." : "Could not remove this song. Nothing was removed.";
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
    this.melodyField=null;
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
    if(loaded.capture_notes?.melody_field && ['tune','keep','song'].includes(stage))this._resumeMelodyField();
    return true;
  }

  _downloadProject() {
    this._readTitle();
    this._compile();
    const jsonText = exportProjectJson(this._canonicalDoc());
    const blob = new Blob([jsonText], { type: "application/json" });
    const safe = this.doc.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase() || "my_song";
    triggerBlobDownload(blob, `${safe}.json`);
    this.saveMessage = `Downloaded "${this.doc.title}". Keep that file.`;
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
      // Scan-stop budget (<= 35 stops on Refine): when the switch note-list summary is present, skip unselected generated canvas pills.
      if (el.classList.contains("pf-phrase-note") && !el.classList.contains("pf-phrase-own") && el.getAttribute("aria-pressed") !== "true"
        && this.root.querySelector?.(".pf-note-list:not([open])")) {
        return false;
      }
      return true;
    });
  }

  _onKey(ev) {
    if (!this.root || this.root.style.display === "none") return;
    if (document.getElementById("btn-stop-listening")) return; // mic is listening; its own handler takes Space/Enter
    const active = document.activeElement;
    if(ev.key==='Enter'&&(active?.matches?.('[data-music-field]')||active?.matches?.('[data-music-circle]')||active?.matches?.('[data-part-circle]')||active?.matches?.('[data-melody-disk]'))) {
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
      this.eventTuneId = ev.target.dataset.phraseNote;this.eventSelectionExplicit=true;
      const action = ev.key === "ArrowUp" ? "up" : ev.key === "ArrowDown" ? "down" : ev.shiftKey ? (ev.key === "ArrowRight" ? "longer" : "shorter") : (ev.key === "ArrowRight" ? "later" : "earlier");
      return this._editEvent(action).then(() => this.root.querySelector(`[data-phrase-note="${CSS.escape(this.eventTuneId)}"]`)?.focus());
    }
    if (this.stage === "jam" && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.repeat && ["z", "x"].includes(ev.key.toLowerCase())
      && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      ev.preventDefault();
      return this._shiftPadOctave(ev.key.toLowerCase() === "z" ? -1 : 1);
    }
    const keyPads = this.stage === "jam" && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.repeat
      && "asdfghjk".includes(ev.key.toLowerCase()) && ev.key.length === 1 ? this._liveJamPads() : null;
    const keyPad = keyPads?.findIndex(p => p.key === ev.key.toLowerCase()) ?? -1;
    if (keyPad >= 0 || (this.stage === 'jam' && ev.repeat && !ev.ctrlKey && !ev.altKey && !ev.metaKey && ev.key.length === 1 && 'asdfghjk'.includes(ev.key.toLowerCase()))) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!ev.repeat) this._playJamPad(keyPad, `key:${ev.key.toLowerCase()}`, false, keyPads);
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
