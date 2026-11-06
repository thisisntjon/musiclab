// Phase 13.3: your keys matter. A press changes the band's next bar, and fast playing
// builds energy into a roll, a riser and a drop. The person's own notes never change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LookaheadScheduler } from "../../../static/js/audio/scheduler.js";
import { planMelodicPhrase, anchorPhraseToPlaying } from "../../../static/js/theory/melodic_evolution.js";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { startJam } from "../../../static/js/theory/jam_session.js";

function fakeParam() {
  return { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} };
}
function fakeNode(name) {
  const node = { name, connect(dest) { return dest; }, disconnect() {}, start() {}, stop() {} };
  return new Proxy(node, { get(target, key) { if (!(key in target) && typeof key === "string") target[key] = fakeParam(); return target[key]; } });
}
function fakeContext() {
  const ctx = { currentTime: 0, sampleRate: 1000, state: "running", destination: fakeNode("speaker"),
    createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }) };
  for (const kind of ["Gain", "Oscillator", "BiquadFilter", "WaveShaper", "Convolver", "DynamicsCompressor", "Analyser", "BufferSource", "StereoPanner"])
    ctx[`create${kind}`] = () => fakeNode(kind);
  return ctx;
}
const song = (extra = []) => ({ bpm: 100, swing: .5, total_steps: 64, total_duration_sec: 9.6,
  events: [...Array.from({ length: 64 }, (_, step) => ["drums", "bass", "harmony"].map(role => ({
    id: `band-${role}-${step}`, step, role, patch_id: role === "drums" ? "kick" : role === "bass" ? "clean_bass" : "warm_keys",
    duration_sec: .1, velocity: .3, provenance: "jam_generated", concrete: { midi_pitch: 60, freq_hz: 261.625565 } }))).flat(), ...extra] });
function scheduler(extra) {
  const s = new LookaheadScheduler();
  s.audioCtx = fakeContext(); s.ensureContext();
  s.setCompiledSong(song(extra), { quantizeJamBacking: true, jamStyleBlend: 0 });
  s.isPlaying = true; s.nextStepAudioTime = .04;
  s.performanceTake = { start: 0, bpm: 100, sequence: 0, events: [] };
  return s;
}
function step(s) {
  s.audioCtx.currentTime = s.nextStepAudioTime - .05;
  s._lookaheadTick();
  return s.visualQueue.at(-1);
}
const phrase = () => planMelodicPhrase({ version: 2, phraseOrdinal: 1, sceneId: "contrast-1", root: 0, minor: false, bpm: 100, seed: 3 }).events;

test("the answered bar opens on the played note, fitted to its chord; nothing else moves", () => {
  const base = phrase();
  const low = anchorPhraseToPlaying(base, { bar: 1, midi: 64 }), high = anchorPhraseToPlaying(base, { bar: 1, midi: 67 });
  const opening = events => events.filter(e => e.step >= 16 && e.step < 32).sort((a, b) => a.step - b.step)[0];
  assert.notEqual(opening(low).concrete.midi_pitch, opening(high).concrete.midi_pitch);
  for (const answered of [low, high]) {
    assert.ok([0, 4, 7, 9].includes(opening(answered).concrete.midi_pitch % 12), "a tone of bar 2's chord");
    assert.deepEqual(answered.filter(e => e.step < 16 || e.step >= 32), base.filter(e => e.step < 16 || e.step >= 32));
    assert.ok(answered.every(e => e.provenance === "jam_generated" && e.role === "lead"));
  }
  assert.equal(anchorPhraseToPlaying(base, { bar: 5, midi: 64 }), null);
});

test("an answer starts at its bar line, not at the start of the four bars", () => {
  const s = scheduler();
  for (let i = 0; i < 8; i++) step(s);
  const events = anchorPhraseToPlaying(phrase().map(e => ({ ...e, patch_id: "warm_keys" })), { bar: 1, midi: 67 });
  assert.equal(s.queueJamLead({ events, planVersion: 1, phraseOrdinal: 0, commitStep: 16 }), true);
  assert.equal(s.queueJamLead({ events, planVersion: 2, phraseOrdinal: 0, commitStep: 7 }), false, "only bar lines");
  while (s.currentStep !== 16) step(s);
  assert.equal(s.activeJamLead, null);
  const atBar = step(s);
  assert.equal(s.activeJamLead?.planVersion, 1);
  const lead = atBar.events.filter(e => e.role === "lead");
  assert.equal(lead.length, 1);
  assert.equal(lead[0].evolution.answered.midi, 67);
});

function flowWith(midis) {
  const queued = [];
  const s = {
    isPlaying: true, currentStep: 6, jamPhraseOrdinal: 0, liveNotes: new Map(), masterBus: { piano: {}, disposed: false },
    activeJamLead: { planVersion: 1, events: phrase(), descriptor: null }, committedJamBacking: [], activeJamForm: null,
    _supportsJamPhrase: () => true, activeJamBacking: () => ({ phraseContext: { root: 0, minor: false } }),
    queueJamLead(plan) { queued.push(plan); return true; }, previewSound() {}, noteOn() { return 1; }, addPlayEnergy() { this.energy = (this.energy || 0) + 1; },
  };
  const flow = Object.create(PlayFlow.prototype);
  Object.assign(flow, { stage: "jam", liveHolds: new Map(), root: { querySelector: () => null }, render() {}, _refreshJourney() {}, _markJamPad() {},
    app: { scheduler: s, _announce() {} } });
  flow.doc = startJam({ id: "song", notes: [], global_context: { bpm: 100, root_pc: 0 }, song_cards: [] }, { kind: "pitched", patchId: "warm_keys" });
  Object.assign(flow.doc.jam_session, { showcase_version: 1, live_keys: true });
  flow._liveJamPads = () => midis.map((midi, i) => ({ patchId: "warm_keys", role: "lead", midi, key: "asdf"[i], label: "x" }));
  return { flow, s, queued };
}

test("pressing S or F gives different band notes at the start of the next bar; your notes are untouched", () => {
  const firstAttack = plan => plan.events.filter(e => e.step >= 16 && e.step < 32).sort((a, b) => a.step - b.step)[0].concrete.midi_pitch;
  const runs = [1, 3].map(pad => {
    const { flow, queued, s } = flowWith([60, 64, 67, 72]);
    const before = structuredClone(flow.doc.notes);
    flow._playJamPad(pad);
    assert.deepEqual(flow.doc.notes, before, "live playing never edits the person's song");
    assert.equal(queued.length, 1); assert.equal(queued[0].commitStep, 16); assert.equal(s.energy, 1);
    return firstAttack(queued[0]);
  });
  assert.notEqual(runs[0], runs[1]);
  const { queued } = flowWith([60, 64, 67, 72]);
  assert.equal(queued.length, 0, "with no press the band carries on unchanged");
});

test("12 fast presses build a rhythm without surprise sweeps or drops; personal notes keep their exact level", () => {
  const mine = { id: "mine", step: 62, role: "lead", patch_id: "warm_keys", duration_sec: .2, velocity: .42, provenance: "user_placed", concrete: { midi_pitch: 64, freq_hz: 329.63 } };
  const s = scheduler([mine]);
  const seen = [];
  while (s.currentStep !== 46) step(s);
  for (let i = 0; i < 12; i++) { s.audioCtx.currentTime += 2 / 12; s.addPlayEnergy(); }
  s.audioCtx.currentTime = s.nextStepAudioTime - .05;
  for (let i = 0; i < 20; i++) seen.push(step(s));
  const all = seen.flatMap(v => v.events);
  assert.ok(!all.some(e => e.id.startsWith("energy-riser-")), "no automatic riser");
  assert.ok(!all.some(e => e.id.startsWith("energy-drop-")), "no automatic drop");
  const kickAfterPress = all.find(e => e.role === "drums" && e.patch_id === "kick");
  assert.ok(kickAfterPress.velocity > .3, "generated drums grow with energy");
  assert.equal(all.find(e => e.id === "mine").velocity, .42, "the person's note is never changed");

  const r = scheduler();
  while (r.currentStep !== 56) step(r);
  for (let i = 0; i < 12; i++) r.addPlayEnergy();
  const rolls = [];
  for (let i = 0; i < 8; i++) rolls.push(...step(r).events.filter(e => e.id.startsWith("energy-roll-")));
  assert.ok(rolls.length >= 1, "a snare roll at the end of the bar");
});

test("one press a bar adds no roll, riser or drop", () => {
  const s = scheduler();
  const extra = [];
  for (let i = 0; i < 128; i++) {
    if (s.currentStep % 16 === 0) s.addPlayEnergy();
    extra.push(...step(s).events.filter(e => e.generated_by === "musiclab_energy"));
  }
  assert.deepEqual(extra, []);
});

test("Stop clears the energy", () => {
  const s = scheduler();
  for (let i = 0; i < 12; i++) s.addPlayEnergy();
  s.stop();
  assert.equal(s.energyAt(s.audioCtx.currentTime), 0);
});

test("when the band plays its answer, the pad you pressed lights with it and it is said in words", () => {
  const { flow } = flowWith([60, 64, 67, 72]);
  flow._playJamPad(2);
  const [source] = flow.answerPads.keys();
  flow._showBandAnswers({ passed: [{ events: [{ role: "lead", evolution: { answered: { source_note_id: source, midi: 67 } } }] }] });
  assert.ok(flow.padFlashes.has(2));
  assert.equal(flow.answerHeard.text, "The band picked up your note.");
  assert.equal(flow.answerPads.size, 0);
});

test("in a fixed-form style the answer is played over the form's melody, once, and the build-up still works", () => {
  const formLead = { id: "form-lead-20", step: 20, role: "lead", patch_id: "warm_keys", duration_sec: .2, velocity: .4, provenance: "jam_generated", concrete: { midi_pitch: 72, freq_hz: 523.25 } };
  const s = scheduler([formLead]);
  for (let i = 0; i < 8; i++) step(s);
  assert.equal(s.answerNextBar({ step: 16, phraseOrdinal: 0, pitch: 67, midi: 66, sourceNoteId: "jam-live-x", patchId: "warm_keys" }), true);
  const heard = [];
  for (let i = 0; i < 80; i++) heard.push(...step(s).events.filter(e => e.role === "lead"));
  const answered = heard.filter(e => e.evolution?.answered?.source_note_id === "jam-live-x");
  assert.equal(answered.length, 1, "once");
  assert.equal(answered[0].concrete.midi_pitch, 67);
  assert.equal(answered[0].step, 20, "on the form's own note, not a new one");
  assert.ok(heard.some(e => e.id === "form-lead-20"), "the form melody returns next time round");
  for (let i = 0; i < 12; i++) s.addPlayEnergy();
  const ornaments = [];
  for (let i = 0; i < 64; i++) ornaments.push(...step(s).events.filter(e => e.generated_by === "musiclab_energy"));
  assert.ok(ornaments.length > 0, "energy also works in fixed-form styles");
});

test("a fixed-form bar with no band note gets a short answering note on its first beat", () => {
  const s = scheduler();
  for (let i = 0; i < 8; i++) step(s);
  s.answerNextBar({ step: 32, phraseOrdinal: 0, pitch: 64, midi: 64, sourceNoteId: "jam-live-y", patchId: "warm_keys" });
  while (s.currentStep !== 32) step(s);
  const atBar = step(s).events.filter(e => e.evolution?.answered);
  assert.equal(atBar.length, 1);
  assert.equal(atBar[0].concrete.midi_pitch, 64);
});
