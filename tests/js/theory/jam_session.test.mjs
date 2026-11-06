import { test } from "node:test";
import assert from "node:assert/strict";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";
import { startJam, setJamDirection, contributeJam, jamPads } from "../../../static/js/theory/jam_session.js";
import { compileSongStandalone } from "../../../static/ui/standalone_compiler.js";

const fresh = () => newPlayDoc({ now: 1, rand: () => .5 });
const own = notes => notes.filter(note => ["user_placed", "hummed_confirmed"].includes(note.provenance));

test("jam starts with selected instrument, ordinary generated notes and no authored-note claim", () => {
  const source = fresh();
  const before = structuredClone(source);
  const jam = startJam(source, { patchId: "pluck_lead" });
  assert.deepEqual(source, before);
  assert.equal(jam.lead_patch_id, "pluck_lead");
  assert.equal(jam.jam_session.patchId, "pluck_lead");
  assert.ok(jam.notes.length > 20);
  assert.ok(jam.notes.every(note => note.provenance === "jam_generated"));
  assert.equal(jam.play_session.acts_count, 0);
  const compiled = compileSongStandalone(jam);
  assert.ok(compiled.events.length > 20);
  assert.ok(compiled.events.every(event => Number.isFinite(event.concrete?.freq_hz) || event.role === "drums"));
});

test("direction is deterministic and bounded; own notes, instrument, context and history remain intact", () => {
  let jam = contributeJam(startJam(fresh(), { patchId: "warm_keys" }), { pad: 1, step: 4 });
  jam.notes.push({ id: "my-hum", step: 3, role: "lead", patch_id: "warm_keys", provenance: "hummed_confirmed",
    concrete: { midi_pitch: 67 }, duration_steps: 3, velocity: .6 });
  const before = structuredClone(jam);
  const changed = setJamDirection(jam, { density: 4, color: 4 });
  assert.deepEqual(own(changed.notes), own(jam.notes));
  assert.equal(changed.lead_patch_id, jam.lead_patch_id);
  assert.deepEqual(changed.global_context, jam.global_context);
  assert.deepEqual(changed.play_session, jam.play_session);
  assert.deepEqual(jam, before);
  assert.deepEqual(setJamDirection(changed, { density: 4, color: 4 }), changed);
  assert.equal(new Set(changed.notes.map(note => note.id)).size, changed.notes.length);
  const chords = compileSongStandalone(changed).events.filter(event => event.role === "harmony");
  assert.ok(chords.every(event => event.voiced_freqs.length === 1));
  assert.ok(changed.notes.length > setJamDirection(jam, { density: 0 }).notes.length);
  assert.equal(setJamDirection(jam, { density: 100 }).jam_session.density, 4);
  assert.equal(setJamDirection(jam, { color: -1 }).jam_session.color, 0);
});

test("contribution keeps original notes, finds a free slot, and reports fullness without erasing", () => {
  let jam = startJam(fresh(), { patchId: "pluck_lead" });
  for (let i = 0; i < 16; i++) {
    const before = own(jam.notes);
    jam = contributeJam(jam, { pad: i % 4, step: 0 });
    assert.equal(jam.jam_session.last_contribution.added, true);
    assert.equal(jam.jam_session.last_contribution.step, i);
    assert.deepEqual(own(jam.notes).slice(0, before.length), before);
  }
  assert.equal(own(jam.notes).length, 64);
  const full = contributeJam(jam, { pad: 0, step: 0 });
  assert.deepEqual(full.notes, jam.notes);
  assert.deepEqual(full.jam_session.last_contribution, { added: false, reason: "full", pad: 0 });
});

test("each drum choice is pad A and contributions stay on editable eighth-note columns", () => {
  for (const patchId of ["kick", "snare", "clap", "hat_closed", "hat_open", "perc"]) {
    const jam = startJam(fresh(), { kind: "drums", patchId, kit: "tiny" });
    assert.equal(jamPads(jam)[0].patchId, patchId);
    const played = contributeJam(jam, { pad: 0, step: 5 });
    assert.equal(played.jam_session.last_contribution.step, 4);
    assert.ok(own(played.notes).every(note => note.patch_id === patchId && note.step % 16 === 4));
    const next = setJamDirection(played, { density: 0, color: 4 });
    assert.deepEqual(own(next.notes), own(played.notes));
    assert.equal(next.drum_kit, "tiny");
    assert.equal(new Set(next.notes.map(note => note.id)).size, next.notes.length);
  }
});

test("captured JSON retains exact musical material and compile schedule", () => {
  let jam = startJam(fresh(), { patchId: "clean_bass" });
  jam = contributeJam(jam, { pad: 2, step: 8 });
  jam = setJamDirection(jam, { density: 3, color: 2 });
  const reopened = JSON.parse(JSON.stringify(jam));
  assert.deepEqual(reopened, jam);
  assert.deepEqual(compileSongStandalone(reopened).events, compileSongStandalone(jam).events);
  assert.equal(jamPads(jam)[2].midi, 43);
});

test("existing automatic chord backing is not doubled by jam chord generation", () => {
  const doc = fresh();
  doc.auto_harmony_stabs = true;
  const jam = startJam(doc, { patchId: "warm_keys" });
  assert.equal(jam.auto_harmony_stabs, true);
  assert.equal(jam.notes.filter(note => note.role === "harmony").length, 0);
  assert.equal(jam.drum_kit, jam.jam_session.kit);
  assert.ok(compileSongStandalone(jam).events.some(event => event.role === "harmony"));
});

const answers = doc => doc.notes.filter(note => note.response_version === "gap-answer-v1");
const band = doc => doc.notes.filter(note => note.provenance === "jam_generated");

test("equal input counts with contrasting pitches produce contrasting generated answers", () => {
  const base = startJam(fresh(), { patchId: "warm_keys" });
  const low = contributeJam(base, { pad: 0, step: 0 });
  const high = contributeJam(base, { pad: 2, step: 0 });
  assert.equal(own(low.notes).length, own(high.notes).length);
  assert.equal(answers(low).length, 4);
  assert.notDeepEqual(answers(low).map(note => note.concrete), answers(high).map(note => note.concrete));
  assert.notDeepEqual(band(low), band(high), "comparison excludes the player layer");
  assert.deepEqual(low.global_context, base.global_context, "no inferred tempo or key change");
  assert.ok(answers(low).every(note => note.provenance === "jam_generated" && note.generated_by === "musiclab_jam"));
  assert.equal(low.play_session.acts_count, 0, "responses cannot claim an act");
});

test("rhythmic counterfactuals move bass replies; answers name real sources and fit their gaps", () => {
  const base = startJam(fresh(), { kind: "drums", patchId: "snare" });
  const early = contributeJam(base, { pad: 0, step: 0 });
  const late = contributeJam(base, { pad: 0, step: 8 });
  assert.notDeepEqual(answers(early).map(note => note.step), answers(late).map(note => note.step));
  for (const doc of [early, late]) for (const answer of answers(doc)) {
    const input = doc.notes.find(note => note.id === answer.response_to[0]);
    assert.ok(input && input.provenance === "user_placed");
    assert.ok(answer.step >= input.step + input.duration_steps);
    assert.equal(Math.floor(answer.step / 16), Math.floor(input.step / 16));
    assert.ok(answer.step + answer.duration_steps <= (Math.floor(answer.step / 16) + 1) * 16);
  }
});

test("response toggle is reversible, deterministic and preserves every original note", () => {
  const played = contributeJam(startJam(fresh()), { pad: 1, step: 4 });
  const before = structuredClone(played);
  const fixed = setJamDirection(played, { responsive: false });
  assert.equal(answers(fixed).length, 0);
  assert.deepEqual(own(fixed.notes), own(played.notes));
  assert.equal(fixed.jam_session.response.mode, "off");
  assert.deepEqual(setJamDirection(fixed, { responsive: true }), played);
  assert.deepEqual(setJamDirection(played), played, "generated notes do not feed back into planning");
  assert.deepEqual(played, before, "input remains immutable");
  const reopened = JSON.parse(JSON.stringify(played));
  assert.deepEqual(compileSongStandalone(reopened).events, compileSongStandalone(played).events);
  assert.deepEqual(answers(reopened), answers(played));
});

test("dense input leaves space, respects the phrase end, and never piles up answer voices", () => {
  let jam = startJam(fresh());
  for (let step = 0; step < 16; step++) jam = contributeJam(jam, { pad: step % 4, step });
  assert.equal(answers(jam).length, 0);
  assert.equal(jam.jam_session.response.mode, "space");
  assert.equal(own(jam.notes).length, 64);
  assert.equal(new Set(jam.notes.map(note => note.id)).size, jam.notes.length);
  const full = contributeJam(jam, { pad: 0, step: 0 });
  assert.deepEqual(full.notes, jam.notes);
  assert.deepEqual(full.jam_session.response, jam.jam_session.response);
  const atEnd = contributeJam(startJam(fresh()), { pad: 0, step: 15 });
  assert.equal(answers(atEnd).length, 0, "a late note is not secretly answered before it or in another bar");
});

test("old sessions without an explicit response setting retain fixed backing", () => {
  const jam = startJam(fresh());
  delete jam.jam_session.responsive;
  const played = contributeJam(jam, { pad: 1, step: 0 });
  assert.equal(answers(played).length, 0);
  assert.equal(played.jam_session.response.enabled, false);
});

test("answer releases before a protected bass onset and never overlaps another answer", () => {
  let jam = contributeJam(startJam(fresh(), { patchId: "warm_keys" }), { pad: 0, step: 0 });
  const bass = { id: "my-bass", step: 3, duration_steps: 4, role: "bass", patch_id: "clean_bass",
    provenance: "user_placed", concrete: { midi_pitch: 40 }, velocity: .7 };
  jam.notes.push(bass);
  jam = setJamDirection(jam);
  assert.equal(answers(jam).find(note => note.step === 2).duration_steps, 1);
  assert.deepEqual(jam.notes.find(note => note.id === bass.id), bass);
  jam = contributeJam(jam, { pad: 1, step: 2 });
  jam.notes.find(note => note.id === "jam-user-warm_keys-0").duration_steps = 8;
  jam = setJamDirection(jam);
  for (const answer of answers(jam)) {
    const protectedNotes = jam.notes.filter(note => note !== answer
      && (note.role === "bass" || (note.role === "lead" && note.provenance === "user_placed")));
    assert.ok(protectedNotes.every(note => answer.step + answer.duration_steps <= note.step
      || answer.step >= note.step + note.duration_steps), `answer ${answer.id} must fit a full gap`);
  }
});

test("captured personal occurrences drive replies without changing source identity or gates", () => {
  for (const kind of ['pitched', 'drums']) {
    const jam = startJam(fresh(), { kind, patchId: kind === 'drums' ? 'snare' : 'warm_keys' });
    const source = {id:'take-personal-0',step:0,duration_steps:2.6,velocity:.7,
      role:kind==='drums'?'drums':'lead',patch_id:kind==='drums'?'snare':'warm_keys',
      concrete:{midi_pitch:kind==='drums'?38:64},provenance:'user_placed',
      source_note_id:'original-input',capture_occurrence:1,performance:{version:1,offset_steps:.75}};
    jam.notes.push(source);
    const before = structuredClone(jam);
    const changed = setJamDirection(jam,{density:2});
    assert.equal(changed.jam_session.response.mode,'answer');
    assert.ok(answers(changed).length>0);
    assert.ok(answers(changed).every(n=>n.response_to[0]===source.id && n.step>=4));
    assert.deepEqual(changed.notes.find(n=>n.id===source.id),source);
    assert.deepEqual(jam,before);
    assert.deepEqual(setJamDirection(changed),changed,'answers never become their own input');
    const off=setJamDirection(changed,{responsive:false});
    assert.equal(answers(off).length,0);assert.deepEqual(off.notes.find(n=>n.id===source.id),source);
    assert.deepEqual(setJamDirection(off,{responsive:true}),changed);
    assert.deepEqual(compileSongStandalone(JSON.parse(JSON.stringify(changed))).events,compileSongStandalone(changed).events);
  }
});

test("reply gate clips at fractional protected onsets and excludes generated captured sources", () => {
  const jam=startJam(fresh());
  jam.notes.push({id:'take-source',step:0,duration_steps:.5,role:'lead',patch_id:'warm_keys',
    provenance:'user_placed',concrete:{midi_pitch:60},source_note_id:'mine',capture_occurrence:1,
    performance:{version:1,offset_steps:.25}});
  jam.notes.push({id:'my-bass',step:4,duration_steps:2,role:'bass',patch_id:'clean_bass',
    provenance:'user_placed',concrete:{midi_pitch:40},performance:{version:1,offset_steps:.5}});
  const next=setJamDirection(jam);const answer=answers(next)[0];
  assert.equal(answer.step,3);assert.equal(answer.duration_steps,1.5);
  const compiled=compileSongStandalone(next).events.find(e=>e.id===answer.id);
  assert.ok(Math.abs(compiled.duration_sec-1.5*.15)<.00001);
  assert.ok(Math.abs(compiled.start_sec-3*.15)<.00001);
  const supplied=structuredClone(jam);supplied.notes.find(n=>n.id==='take-source').provenance='jam_generated';
  assert.equal(answers(setJamDirection(supplied)).length,0);
});

test("drum replies wait for the complete captured drum gate, including fractional onset", () => {
  const jam=startJam(fresh(),{kind:'drums',patchId:'snare'});
  jam.notes.push(...[{id:'take-a',step:0,duration_steps:.5,offset:.25},{id:'take-b',step:2,duration_steps:2,offset:.5}].map((n,i)=>({
    ...n,role:'drums',patch_id:'snare',provenance:'user_placed',concrete:{midi_pitch:38},
    source_note_id:`drum-${i}`,capture_occurrence:i+1,performance:{version:1,offset_steps:n.offset}})));
  const next=setJamDirection(jam);
  assert.ok(answers(next).length>0);
  for(const answer of answers(next))for(const note of own(jam.notes)){
    const start=note.step+note.performance.offset_steps,end=start+note.duration_steps;
    assert.ok(answer.step>=end||answer.step+answer.duration_steps<=start);
  }
});
