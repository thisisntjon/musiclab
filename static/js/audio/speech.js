/**
 * Spoken prompts (9c-3). Only voices that run on this computer (localService) are used, so no words leave the
 * machine (T7). If there is no such voice, nothing is spoken and the screen-reader text still carries everything.
 * Speech is off unless the comfort setup turns it on, and it has its own volume.
 */
export function pickLocalVoice(voices, lang = "en") {
  const local = (voices || []).filter((v) => v && v.localService === true);
  const prefix = String(lang).toLowerCase().split("-")[0];
  return (
    local.find((v) => String(v.lang).toLowerCase() === String(lang).toLowerCase()) ||
    local.find((v) => String(v.lang).toLowerCase().startsWith(prefix)) ||
    null
  );
}

export function createSpeaker(synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) {
  const state = { on: false, volume: 0.8, lang: "en-US", spoken: [] };
  return {
    state,
    configure({ on, volume, lang } = {}) {
      if (typeof on === "boolean") state.on = on;
      if (Number.isFinite(volume)) state.volume = volume;
      if (lang) state.lang = lang;
      if (!state.on) synth?.cancel?.();
    },
    /**
     * Speak `text`, replacing anything still being said. Returns false when nothing was spoken.
     * `force` is for the "Read this" button: the person asked, so it speaks even with speaking turned off.
     */
    speak(text, { force = false } = {}) {
      if ((!state.on && !force) || !synth || !Utterance || !String(text || "").trim()) return false;
      const voice = pickLocalVoice(synth.getVoices?.() || [], state.lang);
      if (!voice) return false;
      synth.cancel?.();
      const u = new Utterance(String(text));
      u.voice = voice;
      u.lang = voice.lang;
      u.volume = state.volume;
      u.rate = 0.95;
      synth.speak(u);
      state.spoken.push(String(text));
      if (state.spoken.length > 50) state.spoken.shift();
      return true;
    },
  };
}
