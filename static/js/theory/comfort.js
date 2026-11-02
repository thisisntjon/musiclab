/**
 * Comfort setup (9c-5): a few switches a person or carer sets once, kept on this device only.
 * - speak: prompts and changes are spoken with a voice on this computer (off by default)
 * - voiceVolume: how loud that voice is, separate from the music (0.2 to 1)
 * - lessMotion: no pulsing and no moving line, whatever the system setting says
 * - bigger: larger pads, buttons and text
 * - quietPresses: a press never makes a sound; only Play does
 * - movingLights: particles and the beat ball move even when the system asks for reduced motion (off: they fade in place)
 */
export const COMFORT_KEY = "musiclab.comfort.v1";
export const COMFORT_DEFAULTS = Object.freeze({ speak: false, voiceVolume: 0.8, lessMotion: false, bigger: false, quietPresses: false, movingLights: false });
export const COMFORT_SWITCHES = ["speak", "lessMotion", "bigger", "quietPresses", "movingLights"];
const VOICE_STEP = 0.2;

export function loadComfort(storage) {
  let saved = {};
  try {
    saved = JSON.parse(storage?.getItem(COMFORT_KEY) || "{}") || {};
  } catch (_e) {
    saved = {};
  }
  const out = { ...COMFORT_DEFAULTS };
  for (const k of COMFORT_SWITCHES) if (typeof saved[k] === "boolean") out[k] = saved[k];
  if (Number.isFinite(saved.voiceVolume)) out.voiceVolume = clampVoice(saved.voiceVolume);
  return out;
}

export function saveComfort(storage, comfort) {
  try {
    storage?.setItem(COMFORT_KEY, JSON.stringify(comfort));
    return true;
  } catch (_e) {
    return false; // storage unavailable: the setting lasts for this visit only
  }
}

function clampVoice(v) {
  return Math.round(Math.min(1, Math.max(0.2, Number(v))) * 10) / 10;
}

export function toggleComfort(comfort, key) {
  if (!COMFORT_SWITCHES.includes(key)) throw new Error(`Unknown comfort switch: ${key}`);
  return { ...comfort, [key]: !comfort[key] };
}

export function stepVoice(comfort, dir) {
  return { ...comfort, voiceVolume: clampVoice(comfort.voiceVolume + (dir > 0 ? VOICE_STEP : -VOICE_STEP)) };
}

/** The page classes for a comfort setting (applied to <body>). */
export function comfortClasses(comfort) {
  return { "pf-less-motion": comfort.lessMotion, "pf-bigger": comfort.bigger };
}
