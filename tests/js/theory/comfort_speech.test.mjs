// Phase 9c-3 and 9c-5: the comfort setup is kept on this device and speech only ever uses a voice on this computer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMFORT_KEY, COMFORT_DEFAULTS, loadComfort, saveComfort, toggleComfort, stepVoice, comfortClasses } from "../../../static/js/theory/comfort.js";
import { pickLocalVoice, createSpeaker } from "../../../static/js/audio/speech.js";

function memStorage(init = {}) {
  const m = { ...init };
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => (m[k] = String(v)), m };
}

test("comfort starts with speech off and everything else off", () => {
  assert.deepEqual(loadComfort(memStorage()), { ...COMFORT_DEFAULTS });
  assert.equal(COMFORT_DEFAULTS.speak, false);
});

test("comfort survives a save and load, under its own key", () => {
  const st = memStorage();
  const c = toggleComfort(toggleComfort(loadComfort(st), "bigger"), "speak");
  assert.ok(saveComfort(st, c));
  assert.ok(COMFORT_KEY in st.m);
  assert.deepEqual(loadComfort(st), c);
});

test("broken or strange stored values fall back to the defaults", () => {
  assert.deepEqual(loadComfort(memStorage({ [COMFORT_KEY]: "{not json" })), { ...COMFORT_DEFAULTS });
  const c = loadComfort(memStorage({ [COMFORT_KEY]: JSON.stringify({ speak: "yes", voiceVolume: 9, extra: 1 }) }));
  assert.equal(c.speak, false);
  assert.equal(c.voiceVolume, 1);
  assert.equal("extra" in c, false);
});

test("storage that throws never breaks the app", () => {
  const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
  assert.deepEqual(loadComfort(bad), { ...COMFORT_DEFAULTS });
  assert.equal(saveComfort(bad, COMFORT_DEFAULTS), false);
});

test("the voice volume moves in steps and stays between 0.2 and 1", () => {
  let c = { ...COMFORT_DEFAULTS };
  for (let i = 0; i < 10; i++) c = stepVoice(c, 1);
  assert.equal(c.voiceVolume, 1);
  for (let i = 0; i < 10; i++) c = stepVoice(c, -1);
  assert.equal(c.voiceVolume, 0.2);
});

test("less moving and bigger buttons map to page classes", () => {
  assert.deepEqual(comfortClasses({ ...COMFORT_DEFAULTS, lessMotion: true }), { "pf-less-motion": true, "pf-bigger": false });
});

const remote = { name: "Cloud voice", lang: "en-US", localService: false };
const local = { name: "Local voice", lang: "en-GB", localService: true };
const localFr = { name: "Voix", lang: "fr-FR", localService: true };

test("only a voice on this computer is ever picked", () => {
  assert.equal(pickLocalVoice([remote, local], "en-US"), local);
  assert.equal(pickLocalVoice([remote], "en-US"), null);
  assert.equal(pickLocalVoice([localFr, remote], "en-US"), null);
});

function fakeSynth(voices) {
  const said = [];
  return { said, getVoices: () => voices, speak: (u) => said.push(u), cancel: () => said.push("cancel") };
}
class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

test("speech is silent until turned on, then speaks with its own volume", () => {
  const synth = fakeSynth([remote, local]);
  const sp = createSpeaker(synth, FakeUtterance);
  assert.equal(sp.speak("Make a beat."), false);
  sp.configure({ on: true, volume: 0.4, lang: "en-US" });
  assert.equal(sp.speak("Make a beat."), true);
  const u = synth.said.find((x) => x instanceof FakeUtterance);
  assert.equal(u.voice, local);
  assert.equal(u.volume, 0.4);
});

test("with no voice on this computer nothing is spoken", () => {
  const synth = fakeSynth([remote]);
  const sp = createSpeaker(synth, FakeUtterance);
  sp.configure({ on: true });
  assert.equal(sp.speak("Hello."), false);
  assert.equal(synth.said.filter((x) => x instanceof FakeUtterance).length, 0);
});

test("the Read this button speaks even with speaking off, still only with a local voice", () => {
  const synth = fakeSynth([remote, local]);
  const sp = createSpeaker(synth, FakeUtterance);
  assert.equal(sp.speak("Make a tune."), false);
  assert.equal(sp.speak("Make a tune.", { force: true }), true);
  const none = createSpeaker(fakeSynth([remote]), FakeUtterance);
  assert.equal(none.speak("Make a tune.", { force: true }), false);
});
