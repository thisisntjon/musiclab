// Phase 9c-0: the playhead follows the steps actually heard, and only notes that sound light up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { advancePlayhead, playheadMarks } from "../../../static/js/theory/playhead.js";
import { compileSongStandalone } from "../../../static/ui/standalone_compiler.js";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";

const lead = (step, midi, duration_steps = 4) => ({ role: "lead", step, duration_steps, concrete: { midi_pitch: midi } });
const drum = (step, patch_id) => ({ role: "drums", step, patch_id });

/** Walk the loop step by step, like the audio clock does. */
function walk(compiled, from = 0, to = compiled.total_steps) {
  const states = [];
  let st = null;
  for (let step = from; step < to; step++) {
    st = advancePlayhead(st, { step, events: compiled.events.filter((e) => e.step === step) }, compiled.total_steps);
    states.push(st);
  }
  return states;
}

test("bar and position come from the step", () => {
  const st = advancePlayhead(null, { step: 37, events: [] }, 64);
  assert.equal(st.bar, 2);
  assert.equal(st.local, 5);
  assert.equal(st.bars, 4);
});

test("a held note stays lit for its length, then goes out", () => {
  let st = advancePlayhead(null, { step: 0, events: [lead(0, 60, 3)] });
  assert.equal(st.lead.midi, 60);
  st = advancePlayhead(st, { step: 1, events: [] });
  st = advancePlayhead(st, { step: 2, events: [] });
  assert.equal(st.lead?.midi, 60);
  st = advancePlayhead(st, { step: 3, events: [] });
  assert.equal(st.lead, null);
});

test("a new note replaces the held one; the loop wrapping clears it", () => {
  let st = advancePlayhead(null, { step: 62, events: [lead(62, 60, 8)] });
  st = advancePlayhead(st, { step: 63, events: [lead(63, 64, 1)] });
  assert.equal(st.lead.midi, 64);
  st = advancePlayhead(st, { step: 0, events: [] });
  assert.equal(st.lead, null);
});

test("drum hits light their lane for the whole eighth, and odd-step hits never light a pad", () => {
  let st = advancePlayhead(null, { step: 4, events: [drum(4, "kick"), drum(4, "hat_closed")] });
  assert.deepEqual(st.hits, ["kick", "hat"]);
  st = advancePlayhead(st, { step: 5, events: [drum(5, "snare")] });
  assert.deepEqual(st.hits, ["kick", "hat"]);
  st = advancePlayhead(st, { step: 6, events: [] });
  assert.deepEqual(st.hits, []);
});

test("beat stage: the ring covers each supported lane; only pads that are on can light", () => {
  const st = advancePlayhead(null, { step: 21, events: [] });
  const m = playheadMarks({ ...st, hits: ["clap"] }, { stage: "beat" });
  assert.equal(m.ring.length, 6);
  assert.ok(m.ring.every((s) => s.includes('data-step="2"')));
  assert.deepEqual(m.lit, ['.pf-pad.on[data-lane="clap"][data-step="2"]']);
});

test("all percussion voices have distinct lanes and at most three pads brighten", () => {
  const patches = ["snare", "hat_open", "perc", "kick", "clap", "hat_closed"];
  const state = advancePlayhead(null, { step: 0, events: patches.map(patch => drum(0, patch)) });
  assert.deepEqual(state.hits, ["snare", "hat_open", "perc", "kick", "clap", "hat"]);
  assert.equal(playheadMarks(state, { stage: "beat" }).lit.length, 3);
});

test("tune stage: My tune shows bars 1-3, the ending tab shows bar 4, and off-page steps are not marked", () => {
  const inMain = advancePlayhead(null, { step: 16 + 3, events: [lead(19, 62, 2)] });
  assert.equal(playheadMarks(inMain, { stage: "tune", tab: "main", page: 0, pageSize: 8 }).ring.length, 1);
  assert.deepEqual(playheadMarks(inMain, { stage: "tune", tab: "ending" }), { ring: [], lit: [] });
  assert.deepEqual(playheadMarks(inMain, { stage: "tune", tab: "main", page: 1, pageSize: 8 }), { ring: [], lit: [] });
  const inEnding = advancePlayhead(null, { step: 48 + 9, events: [] });
  assert.equal(playheadMarks(inEnding, { stage: "tune", tab: "ending", page: 1, pageSize: 8 }).ring[0], '.pf-note[data-col="9"]');
  assert.deepEqual(playheadMarks(inEnding, { stage: "tune", tab: "main", page: 1, pageSize: 8 }), { ring: [], lit: [] });
});

test("other stages and no playhead mark nothing", () => {
  const st = advancePlayhead(null, { step: 0, events: [] });
  assert.deepEqual(playheadMarks(st, { stage: "under" }), { ring: [], lit: [] });
  assert.deepEqual(playheadMarks(null, { stage: "beat" }), { ring: [], lit: [] });
});

test("over a real compiled loop, every lit tune note is a note the person placed and it is heard at that moment", () => {
  const doc = newPlayDoc();
  doc.notes.push({ role: "lead", step: 0, duration_steps: 4, patch_id: "pluck_lead", provenance: "user_placed", concrete: { midi_pitch: 60 } });
  doc.notes.push({ role: "lead", step: 8, duration_steps: 2, patch_id: "pluck_lead", provenance: "user_placed", concrete: { midi_pitch: 64 } });
  const compiled = compileSongStandalone(doc, null);
  const states = walk(compiled);
  const leadEvents = compiled.events.filter((e) => e.role === "lead");
  let litSteps = 0;
  for (const st of states) {
    if (!st.lead) continue;
    litSteps++;
    const ev = leadEvents.find((e) => e.step === st.lead.step);
    assert.ok(ev, `lit note at step ${st.lead.step} has a real event`);
    assert.equal(ev.concrete.midi_pitch, st.lead.midi);
    assert.ok(st.step < ev.step + ev.duration_steps, "never lit past its own length");
  }
  assert.ok(litSteps > 0);
  // Drums: every hit lane maps to a drum event on that eighth.
  for (const st of states) {
    for (const lane of st.hits) {
      const eighth = st.step - (st.local % 2);
      assert.ok(compiled.events.some((e) => e.role === "drums" && e.step === eighth), `hit at ${st.step} from a real drum`);
    }
  }
});


test("audio-clock snapshots show simultaneous gates in a 12-step bar and clear between ticks", () => {
  const sounding=[lead(12,60,.2),lead(12,64,.2)];
  const state=advancePlayhead(null,{step:12,events:[],sounding},48,12);
  const marks=playheadMarks(state,{stage:"tune"});
  assert.equal(marks.lit.length,2);
  assert.ok(marks.lit.every(s=>s.includes('data-col="0"')));
  const ended=advancePlayhead(state,{step:12,events:[],sounding:[]},48,12);
  assert.deepEqual(playheadMarks(ended,{stage:"tune"}).lit,[]);
});
