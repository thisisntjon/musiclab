import {musicFieldBacking,validMusicField,sceneTempoAllowed} from './music_field.js';
import {stepsPerBar} from './musical_time.js';
import {tripleBacking} from './triple_scene.js';
import {anchoredBacking} from './band_anchor.js';
import {applyStyleTraits} from './style_traits.js';
import { bassInterval } from './underneath.js';
/** Local band playground. These pure edits never start audio or claim generated notes as authored. */
import { BARS, STEPS_PER_BAR } from "./session_rules.js";
import { blendedBacking, spectrumBacking } from "./style_blend.js";
import { isSceneVariant } from './style_scenes.js';
import {showcaseBacking} from './listening_showcase.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION,hasSceneCatalogue,sceneIndex,catalogueBacking} from './scene_catalogue.js';

const clone = value => JSON.parse(JSON.stringify(value));
const GENERATED = "musiclab_jam";
const DRUMS = {
  kick: { label: "Kick", midi: 36 }, snare: { label: "Snare", midi: 38 },
  clap: { label: "Clap", midi: 39 }, hat_closed: { label: "Closed hat", midi: 42 },
  hat_open: { label: "Open hat", midi: 46 }, perc: { label: "Percussion", midi: 45 },
};
const PITCHED = new Set(["sampled_muted_guitar_v1", "sampled_upright_bass_v1", "sampled_overdrive_guitar_v1", "sampled_organ_v1", "sampled_harmonica_v1", "sampled_strings_v1", "sampled_steel_guitar_v1", "sampled_trumpet_v1", "sampled_tenor_sax_v1", "sampled_clarinet_v1", "sampled_ooh_v1", "sampled_piano_v1", "sampled_electric_piano_v1", "sampled_guitar_v1", "sampled_clean_guitar_v1", "sampled_bass_v1", "sampled_banjo_v1", "warm_keys", "pluck_lead", "supersaw_stab", "clean_bass", "monster_growl", "talking_yoi", "wobble_bass", "sub_drop_808", "laser_screech", "vocal_chop", "reverse_swell"]);
const level = (value, fallback = 1) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(4, Math.round(Number(value)))) : fallback;
const isGenerated = note => note.provenance === "jam_generated" && note.generated_by === GENERATED;
// Captured onsets can lie between grid columns; replies must respect their full gates.
const noteStart = note => note.step + (note.performance?.version === 1
  && Number.isFinite(note.performance.offset_steps) && note.performance.offset_steps >= 0
  && note.performance.offset_steps < 1 ? note.performance.offset_steps : 0);
const noteEnd = note => noteStart(note) + Math.max(.001, Number(note.duration_steps) || 1);
const isPersonalJamInput = note => note.provenance === "user_placed"
  && (note.id?.startsWith("jam-user-") || (Number.isInteger(note.capture_occurrence)
    && typeof note.source_note_id === "string" && note.performance?.version === 1));
const isStarterPulse = note => note.provenance === "seed_template" && note.role === "drums" && note.patch_id === "kick"
  && note.id === `drum-kick-${note.step}` && note.step % 8 === 0 && note.duration_steps === 1 && note.velocity === .9;

export const JAM_PADS = Object.freeze([
  { key: "a", label: "Low" }, { key: "s", label: "Middle" },
  { key: "d", label: "High" }, { key: "f", label: "Top" },
]);

/** Exact pad metadata for both button labels and explicit single-note preview. */
export function jamPads(doc) {
  const session = doc.jam_session || {};
  if (session.kind === "drums") {
    const selected = DRUMS[session.patchId] ? session.patchId : "kick";
    const patches = [selected, ...["kick", "clap", "hat_closed", "perc"].filter(patch => patch !== selected)].slice(0, 4);
    return patches.map((patchId, index) => ({ ...JAM_PADS[index], label: DRUMS[patchId].label,
      patchId, midi: DRUMS[patchId].midi, role: "drums", kit: session.kit || "soft" }));
  }
  const root = ((Number(doc.global_context?.root_pc) || 0) % 12 + 12) % 12;
  const minor = /minor|dorian|phrygian/.test(doc.global_context?.scale_type || "");
  const low = /bass|growl|yoi|808/.test(session.patchId || "") ? 36 : 60;
  return JAM_PADS.map((pad, index) => ({ ...pad, patchId: session.patchId || "warm_keys",
    midi: low + root + [0, minor ? 3 : 4, 7, 12][index], role: "lead" }));
}

function bandNotes(doc, session, preserved) {
  if(session.anchor_backing)return anchoredBacking(doc,session,preserved);
  if(session.music_field)return musicFieldBacking(doc,session,preserved);
  if(stepsPerBar(doc)===12)return tripleBacking(doc,session,preserved);
  if(hasSceneCatalogue(session))return catalogueBacking(doc,session,preserved);
  if(session.showcase_version===1)return showcaseBacking(doc,session,preserved);
  if (Number.isFinite(session.style_spectrum)) return spectrumBacking(doc,session,preserved);
  if (typeof session.style_blend === 'number' && Number.isFinite(session.style_blend)) return blendedBacking(doc, session, preserved);
  const notes = [];
  const root = ((Number(doc.global_context?.root_pc) || 0) % 12 + 12) % 12;
  const minor = /minor|dorian|phrygian/.test(doc.global_context?.scale_type || "");
  const { density, color } = session;
  const harmonyPatch = color < 2 ? "warm_keys" : color < 4 ? "pluck_lead" : "supersaw_stab";
  const occupied = (role, patch, step) => preserved.some(note => note.role === role && note.step === step
    && (role !== "drums" || note.patch_id === patch));
  const add = (role, patch, step, midi, duration, velocity, voice = "") => {
    if (occupied(role, patch, step)) return;
    notes.push({ id: `jam-band-${role}-${patch}-${step}${voice}`, step, duration_steps: duration,
      velocity, role, patch_id: patch, pitch_lock_mode: "concrete", concrete: { midi_pitch: midi },
      provenance: "jam_generated", generated_by: GENERATED,
      ...(role === "harmony" ? { voiced_freqs: [440 * Math.pow(2, (midi - 69) / 12)] } : {}),
      ...(role === "drums" ? { drum_kit: session.kit } : { sound_seed: { brightness: .2 + color * .15, warmth: .8 - color * .12, width: .35 } }),
    });
  };
  for (let bar = 0; bar < BARS; bar++) {
    const base = bar * STEPS_PER_BAR;
    const kicks = density >= 3 ? [0, 6, 8, 14] : [0, 8];
    const hats = density === 0 ? [0, 8] : density === 1 ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12, 14];
    for (const step of kicks) add("drums", "kick", base + step, 36, 1, .65);
    for (const step of density === 0 ? [8] : [4, 12]) add("drums", "clap", base + step, 39, 1, .45);
    for (const step of hats) add("drums", "hat_closed", base + step, 42, 1, step % 4 ? .24 : .34);
    if (density === 4) for (const step of [3, 11]) add("drums", "perc", base + step, 45, 1, .3);
    const bassSteps = density >= 3 ? [0, 4, 8, 12] : density === 0 ? [0] : [0, 8];
    const degree = [0, 5, 7, 0][bar];
    for (const step of bassSteps) add("bass", "clean_bass", base + step, 36 + root + degree, density >= 3 ? 3 : 6, .45);
    // Explicit chord tones remain ordinary editable notes in captured material.
    const chordSteps = doc.auto_harmony_stabs ? [] : density >= 2 ? [0, 8] : [0];
    for (const step of chordSteps) {
      for (const [index, interval] of [0, minor ? 3 : 4, 7].entries()) {
        add("harmony", harmonyPatch, base + step, 48 + root + degree + interval + (color >= 3 ? 12 : 0),
          density >= 2 ? 6 : 12, .19, `-${index}`);
      }
    }
  }
  return notes;
}

/** A transparent baseline: the bass answers a few personal notes in available gaps.
 * This reads only recorded input, never its own generated output. It changes the editable
 * loop, not an already-heard performance; the audio scheduler owns its committed horizon.
 */
function answerPlayer(session, backing, preserved, doc) {
  const STEPS_PER_BAR=stepsPerBar(doc);
  const startOf = note => Number.isFinite(session.style_spectrum) ? bassInterval(note,doc)[0] : noteStart(note);
  const endOf = note => Number.isFinite(session.style_spectrum) ? bassInterval(note,doc)[1] : noteEnd(note);
  const response = { enabled: session.responsive === true, note_count: 0, source_ids: [], mode: "off" };
  if (!response.enabled) return { notes: backing, response };
  const source = preserved.filter(note => isPersonalJamInput(note) && Number.isInteger(note.step)
    && note.role === (session.kind === "drums" ? "drums" : "lead"));
  response.mode = source.length ? "space" : "waiting";
  if (!source.length) return { notes: backing, response };
  let notes = [...backing];
  for (let bar = 0; bar < BARS; bar++) {
    const start = bar * STEPS_PER_BAR;
    const end = start + STEPS_PER_BAR;
    const phrase = source.filter(note => note.step >= start && note.step < end)
      .sort((a, b) => a.step - b.step || a.id.localeCompare(b.id));
    if (!phrase.length) continue;
    const connected = Number.isFinite(session.style_spectrum);
    const barBacking = backing.filter(note => note.step >= start && note.step < end);
    const firstChord = Math.min(...barBacking.filter(note => note.role === 'harmony').map(note => note.step));
    const answersBefore = response.note_count;
    // Dense playing gets less competing comping, not a louder or busier band.
    notes = notes.filter(note => note.step < start || note.step >= end
      || (note.role !== "bass" && !(phrase.length >= 6 && note.role === "harmony"
        && note.step > (connected ? firstChord : start))));
    const used = new Set();
    for (const input of phrase.slice(-4)) {
      const earliest = Math.ceil(startOf(input) + Math.max(2, endOf(input)-startOf(input)));
      const step = Array.from({ length: Math.max(0, end - earliest) }, (_, i) => earliest + i)
        .find(at => !used.has(at) && !preserved.some(note => startOf(note) <= at
          && endOf(note) > at
          && (note.role === "bass" || note.role === (session.kind === "drums" ? "drums" : "lead")))
          && !phrase.some(note => note.step === at));
      if (step === undefined) continue;
      const template = backing.find(note => note.role === "bass" && note.step >= start && note.step < end);
      if (!template) continue;
      const pitch = Number(input.concrete?.midi_pitch);
      let midi = session.kind === "drums" || !Number.isFinite(pitch)
        ? template.concrete.midi_pitch : 36 + ((pitch % 12) + 12) % 12;
      // The new Piedmont band uses a guitar for its low part. Keep a generated
      // reply's pitch class while respecting that recipe's guitar register;
      // legacy bass replies and every personal source note remain unchanged.
      const guitarReply = session.scene_id === "piedmont-v1" && template.patch_id === "sampled_guitar_v1";
      if (guitarReply) {
        while (midi < 40) midi += 12;
        while (midi > 55) midi -= 12;
      }
      const duration = Math.min(2, end - step,
        ...preserved.filter(note => startOf(note) > step
          && (note.role === "bass" || note.role === (session.kind === "drums" ? "drums" : "lead"))).map(note => startOf(note) - step),
        ...[...used].filter(at => at > step).map(at => at - step));
      notes.push({ ...clone(template), id: `jam-answer-${bar}-${step}`, step, duration_steps: duration,
        velocity: .42, concrete: { midi_pitch: midi },
        // Keep the computed gap exact when its boundaries came from performed
        // timing; legacy integer quantization/swing could extend into that gap.
        ...(preserved.some(note => note.performance?.version === 1)
          ? { performance: { version: 1, offset_steps: 0 } } : {}),
        response_to: [input.id], response_version: guitarReply ? "gap-answer-guitar-v1" : "gap-answer-v1" });
      for (let at = step; at < step + duration; at++) used.add(at);
      response.source_ids.push(input.id);
      response.note_count++;
    }
    // With no reply gap, silence is not the only accompaniment: retain this
    // profile's bass foundation, already filtered against personal bass gates.
    // Do not count these original backing notes as responses to the person.
    if (connected && response.note_count === answersBefore) {
      notes.push(...barBacking.filter(note => note.role === 'bass'));
    }
  }
  if (response.note_count) response.mode = "answer";
  return { notes, response };
}

/** Enter only on an explicit user action. The generic untouched opening pulse may become band material. */
export function startJam(doc, { kind = "pitched", patchId, kit } = {}) {
  const next = clone(doc);
  const drums = kind === "drums";
  const selected = drums ? (DRUMS[patchId] ? patchId : "kick") : (PITCHED.has(patchId) ? patchId : PITCHED.has(next.lead_patch_id) ? next.lead_patch_id : "warm_keys");
  next.jam_session = { kind: drums ? "drums" : "pitched", patchId: selected,
    kit: ["soft", "punchy", "tiny"].includes(kit) ? kit : next.drum_kit || "soft", density: 1, color: 1, responsive: true, style_blend: 0 };
  if (!doc.jam_session) next.notes = (next.notes || []).filter(note => !isStarterPulse(note));
  next.drum_kit = next.jam_session.kit;
  if (!drums) next.lead_patch_id = selected;
  return setJamDirection(next, next.jam_session);
}

/** Replace only this module's generated band; all retained notes and song context remain untouched. */
export function setJamDirection(doc, { density, color, responsive, style_blend, style_spectrum, scene_variant, showcase_version, showcase_palette, showcase_arrangement, scene_catalogue, scene_id, scene_mix, anchor_drums, anchor_chords, style_drums, style_chords, band_chord_patch, music_field } = {}) {
  const next = clone(doc);
  if (!next.jam_session) return next;
  const session = { ...next.jam_session, density: level(density ?? next.jam_session.density), color: level(color ?? next.jam_session.color) };
  if([density,color,style_blend,style_spectrum,scene_id].some(value=>value!==undefined)) {
    delete session.anchor_backing;delete session.anchor_traits;
  }
  if(anchor_drums!==undefined||anchor_chords!==undefined) {
    if(!session.anchor_backing)throw Error('Choose Stay before adjusting this band.');
    if([anchor_drums,anchor_chords].some(v=>v!==undefined&&(!Number.isInteger(v)||v<0||v>4)))throw Error('Unsupported band adjustment.');
    session.anchor_traits={version:1,drums:anchor_drums??session.anchor_traits?.drums??2,
      chords:anchor_chords??session.anchor_traits?.chords??2};
  }
  if (typeof responsive === "boolean") session.responsive = responsive;
  if(showcase_version===1)session.showcase_version=1;
  if(showcase_palette==='sampled')session.showcase_palette='sampled';
  if(showcase_arrangement==='contrast-v1')session.showcase_arrangement='contrast-v1';
  if(scene_catalogue===SCENE_CATALOGUE_VERSION)session.scene_catalogue=scene_catalogue;
  if(scene_mix!==undefined){
    if(scene_mix!==SCENE_MIX_VERSION||!hasSceneCatalogue(session))throw Error('Unsupported band mix.');
    session.scene_mix=scene_mix;
  }
  if (typeof style_blend === 'number' && Number.isFinite(style_blend)) session.style_blend = Math.max(0, Math.min(1, style_blend));
  if(hasSceneCatalogue(session)) {
    if(scene_id!==undefined&&sceneIndex(scene_id)<0)throw Error('Unsupported musical scene.');
    const index=scene_id!==undefined?sceneIndex(scene_id):Number.isFinite(style_spectrum)?Math.max(0,Math.min(SCENE_CATALOGUE.length-1,Math.round(style_spectrum))):Math.max(0,sceneIndex(session.scene_id));
    session.scene_id=SCENE_CATALOGUE[index].id;session.style_spectrum=index;
  } else if (Number.isFinite(style_spectrum)) session.style_spectrum = Math.max(0,Math.min(3,style_spectrum));
  if (scene_variant !== undefined) {
    if (!isSceneVariant(scene_variant)) throw Error('Unsupported phrase variation.');
    session.scene_variant=scene_variant;
  }
  if(style_drums!==undefined||style_chords!==undefined) {
    if(!hasSceneCatalogue(session)||[style_drums,style_chords].some(v=>v!==undefined&&(!Number.isInteger(v)||v<0||v>4)))throw Error('Unsupported shared band adjustment.');
    session.style_traits={version:1,drums:style_drums??session.style_traits?.drums??2,chords:style_chords??session.style_traits?.chords??2};
  }
  if(band_chord_patch!==undefined) {
    if(!hasSceneCatalogue(session)||![null,'sampled_banjo_v1'].includes(band_chord_patch))throw Error('Unsupported band chord sound.');
    if(band_chord_patch===null)delete session.band_chord_patch;
    else session.band_chord_patch=band_chord_patch;
  }
  if(music_field !== undefined) {
    if(music_field === null) delete session.music_field;
    else {
      if(!validMusicField(music_field)||stepsPerBar(next)!==16)throw Error('Unsupported musical field.');
      if(music_field.version===5){if(session.exploration_map!=='catalogue-circle-v2')throw Error('This scored arc requires the updated circle.');}
      else delete session.exploration_map;
      session.music_field={version:music_field.version,x:music_field.x,y:music_field.y};
      session.scene_catalogue=SCENE_CATALOGUE_VERSION;session.style_spectrum=music_field.version===2?Math.round(music_field.x*3):0;session.scene_id=music_field.version===3?(music_field.x<.5?'rocksteady-v1':'reggae-v1'):`contrast-${session.style_spectrum}`;
      if(music_field.version===4){const p=music_field.x*5;session.scene_id=p<.5?'reggae-v1':p<1.5?'rocksteady-v1':`contrast-${Math.min(3,Math.max(0,Math.round(p-2)))}`;}
      if(music_field.version===5)session.scene_id=['ska-v1','rocksteady-v1','reggae-v1'][Math.round(music_field.x*2)];
      if(music_field.version>=3)session.style_spectrum=sceneIndex(session.scene_id);
      session.showcase_version=1;session.showcase_palette='sampled';session.showcase_arrangement='contrast-v1';
      delete session.anchor_backing;delete session.anchor_traits;delete session.style_traits;
      if(music_field.version<3)delete session.band_chord_patch;
    }
  } else if(scene_id!==undefined||style_spectrum!==undefined||style_blend!==undefined)delete session.music_field;
  if(!sceneTempoAllowed(session.scene_id,next.global_context?.bpm??100))throw Error('This Black-metal arrangement supports up to 160 BPM. Your tempo and notes are unchanged.');
  if(['catalogue-circle-v1','catalogue-circle-v2'].includes(session.exploration_map)&&(next.global_context?.bpm??100)>160)throw Error('Circular exploration supports up to 160 BPM. Your tempo and notes are unchanged.');
  next.jam_session = session;
  const preserved = (next.notes || []).filter(note => !isGenerated(note));
  const backing=bandNotes(next,session,preserved);
  // Stay already contains the response that actually played. Answering again
  // would replace that chosen bass even with both relative controls neutral.
  const answer = session.anchor_backing?{notes:backing,response:{enabled:false,note_count:0,source_ids:[],mode:'anchored'}}
    :answerPlayer(session,backing,preserved,next);
  session.response = answer.response;
  next.notes = [...preserved, ...(session.anchor_backing?answer.notes:applyStyleTraits(answer.notes,session,preserved,next))];
  return next;
}

export function jamDirectionKey(doc) {
  const session=doc?.jam_session;
  if(session?.anchor_backing)return `anchored-v1:${session.anchor_backing.time}:${session.scene_variant||'base'}`;
  if(session?.music_field)return `music-field-v${session.music_field.version}`;
  if(hasSceneCatalogue(session))return `scene:${session.scene_id}:${session.scene_variant||'base'}`;
  if(session?.showcase_version===1)return `showcase-v1:${session.showcase_arrangement||'original'}:${session.style_spectrum||0}:${session.scene_variant||'base'}`;
  return Number.isFinite(session?.style_spectrum) ? `connected-four-v1:${session.style_spectrum}${session.scene_variant && session.scene_variant!=='base'?`:scene-v1:${session.scene_variant}`:''}` : null;
}

/** Keep a playable contribution across the source phrase. Collisions move to a free slot; authored notes stay. */
export function contributeJam(doc, { pad = 0, step = 0, sound: performedSound = null } = {}) {
  const next = clone(doc);
  const cycle=stepsPerBar(doc);
  if (!next.jam_session || !Number.isInteger(pad) || pad < 0 || pad > 3) return next;
  const sound = performedSound || jamPads(next)[pad];
  const stride = sound.role === "drums" ? 2 : 1;
  const rawStep = Number.isFinite(Number(step)) ? Math.trunc(Number(step)) : 0;
  const requested = Math.floor(((rawStep % cycle) + cycle) % cycle / stride) * stride;
  const retained = (next.notes || []).filter(note => !isGenerated(note));
  const slots = Array.from({ length: cycle / stride }, (_, i) => (requested + i * stride) % cycle);
  const local = slots.find(candidate => !retained.some(note => note.role === sound.role && note.step % cycle === candidate
    && (sound.role !== "drums" || note.patch_id === sound.patchId)));
  if (local === undefined) {
    next.jam_session.last_contribution = { added: false, reason: "full", pad };
    return next;
  }
  for (let bar = 0; bar < BARS; bar++) {
    const at = bar * cycle + local;
    retained.push({ id: `jam-user-${sound.patchId}-${at}`, step: at, duration_steps: sound.role === "drums" ? 1 : 2,
      velocity: .7, role: sound.role, patch_id: sound.patchId, pitch_lock_mode: "concrete",
      concrete: { midi_pitch: sound.midi }, provenance: "user_placed" });
  }
  next.notes = retained;
  next.jam_session.last_contribution = { added: true, pad, step: local, ...sound };
  return setJamDirection(next);
}

export function jamDirectionDescription(doc) {
  const { density = 1, color = 1 } = doc.jam_session || {};
  if(doc.jam_session?.showcase_version===1)return `${["Lots of space", "Light beat", "More rhythm", "Busy band", "Full band"][density]}. Band sound ${color+1} of 5. Your notes stay.`;
  return `${["Lots of space", "Light beat", "More rhythm", "Busy band", "Full band"][density]}. ${["Soft backing", "Warm backing", "Plucked backing", "High backing", "Bright backing"][color]}. Your notes stay.`;
}
