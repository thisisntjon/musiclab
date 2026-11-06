// Phase 13.6a: the sheet. What plays becomes real notation, writes out as MusicXML, and reads back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFromEvents, toMusicXML, fromMusicXML, renderSheetSvg, keySignature, noteType, parseXml, eventsFromTake } from "../../../static/js/theory/score_sheet.js";

const ev = (id, step, role, midi, extra = {}) => ({ id, step, role, duration_steps: 2, velocity: .7, patch_id: role === "drums" ? "kick" : role === "bass" ? "clean_bass" : "warm_keys",
  concrete: role === "drums" ? { midi, freq_hz: 200 } : { midi_pitch: midi, freq_hz: 440 * 2 ** ((midi - 69) / 12) }, provenance: "generator_default", ...extra });

const song = [
  ev("mine-0", 0, "lead", 64, { provenance: "user_placed", duration_steps: 4 }), ev("mine-1", 6, "lead", 67, { provenance: "user_placed", duration_steps: 3 }),
  ev("lead-2", 12, "lead", 72, { duration_steps: 4 }),
  ev("ch-0a", 0, "harmony", 60, { duration_steps: 8 }), ev("ch-0b", 0, "harmony", 64, { duration_steps: 8 }), ev("ch-0c", 0, "harmony", 67, { duration_steps: 8 }),
  ev("bass-0", 0, "bass", 48, { duration_steps: 8 }), ev("bass-8", 8, "bass", 43, { duration_steps: 8 }),
  ev("k0", 0, "drums", 36), ev("s4", 4, "drums", 38, { patch_id: "snare" }), ev("h2", 2, "drums", 42, { patch_id: "hat_closed" }), ev("k8", 8, "drums", 36),
  ev("lead-16", 16, "lead", 65, { duration_steps: 16 }),
];

test("key signatures and note values follow standard rules", () => {
  assert.deepEqual(keySignature(0, "major").fifths, 0);
  assert.deepEqual(keySignature(7, "major").fifths, 1);
  assert.deepEqual(keySignature(9, "minor"), { fifths: 0, mode: "minor", root: 9, flats: false });
  assert.deepEqual(keySignature(10, "major").fifths, -2);
  assert.deepEqual(noteType(4), { steps: 4, type: "quarter", dots: 0 });
  assert.deepEqual(noteType(6), { steps: 6, type: "quarter", dots: 1 });
  assert.deepEqual(noteType(16), { steps: 16, type: "whole", dots: 0 });
});

test("the score has one staff per part that sounds, chords stacked, rests filled, bars complete", () => {
  const score = scoreFromEvents(song, { title: "Test", bpm: 96, rootPc: 7, scaleType: "major", totalSteps: 32 });
  assert.deepEqual(score.parts, ["tune", "chords", "bass", "drums"]);
  assert.equal(score.measures.length, 2);
  assert.equal(score.key.fifths, 1);
  const chords = score.measures[0].parts.chords;
  assert.equal(chords[0].notes.length, 3, "a chord stacks at one onset");
  for (const m of score.measures) for (const id of score.parts) {
    const total = m.parts[id].reduce((s, i) => s + i.steps, 0);
    assert.equal(total, 16, `bar ${m.number} ${id} adds up to a full bar`);
  }
  const tune = score.measures[0].parts.tune;
  assert.ok(tune.find(i => i.kind === "note" && i.notes[0].own), "the person's notes are marked");
  assert.equal(score.measures[1].parts.tune[0].type, "whole");
});

test("MusicXML writes out and reads back the same music, part by part", () => {
  const score = scoreFromEvents(song, { title: "Round trip", bpm: 96, rootPc: 7, scaleType: "major", totalSteps: 32 });
  const text = toMusicXML(score);
  assert.match(text, /<score-partwise version="4.0">/);
  assert.match(text, /<per-minute>96<\/per-minute>/);
  assert.match(text, /<fifths>1<\/fifths>/);
  assert.match(text, /<clef><sign>F<\/sign><line>4<\/line><\/clef>/);
  assert.match(text, /<clef><sign>percussion<\/sign>/);
  const back = fromMusicXML(text);
  assert.equal(back.ok, true);
  assert.equal(back.bpm, 96); assert.equal(back.root_pc, 7); assert.equal(back.bars, 2); assert.equal(back.steps_per_bar, 16);
  const want = song.filter(e => e.role !== "drums").map(e => [e.role, e.step, e.concrete.midi_pitch]).sort();
  const got = back.notes.filter(n => n.role !== "drums").map(n => [n.role, n.step, n.concrete.midi_pitch]).sort();
  assert.deepEqual(got, want, "every pitched note is back at its step and pitch");
  const drums = back.notes.filter(n => n.role === "drums").map(n => [n.step, n.patch_id]).sort();
  assert.deepEqual(drums, [[0, "kick"], [2, "hat_closed"], [4, "snare"], [8, "kick"]]);
  assert.deepEqual(back.notes.filter(n => n.provenance === "user_placed").map(n => n.id).sort(), ["mine-0", "mine-1"], "the person's notes stay theirs");
  assert.equal(back.notes.find(n => n.id === "mine-0").duration_steps, 4);
});

test("a sheet saved by a notation program (ties, backups, no MusicLab fields) still opens", () => {
  const foreign = `<?xml version="1.0"?><!DOCTYPE score-partwise PUBLIC "x" "y">
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>2</divisions><key><fifths>-1</fifths><mode>major</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>
<note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
<note><rest/><duration>2</duration><type>quarter</type></note>
<note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
<backup><duration>8</duration></backup>
<note><pitch><step>F</step><octave>3</octave></pitch><duration>8</duration><type>whole</type></note>
</measure></part></score-partwise>`;
  const back = fromMusicXML(foreign);
  assert.equal(back.ok, true);
  assert.equal(back.bpm, 120); assert.equal(back.root_pc, 5);
  assert.deepEqual(back.notes.map(n => [n.step, n.duration_steps, n.concrete.midi_pitch]), [[0, 8, 70], [12, 4, 65], [0, 16, 53]]);
  assert.equal(fromMusicXML("<html></html>").ok, false);
  assert.equal(parseXml('<a x="1"><b/>t<c y=\'2\'>u</c></a>').children[0].children.length, 2);
});

test("the drawn sheet carries the app's part colours, the person's notes and a playhead", () => {
  const score = scoreFromEvents(song, { title: "Drawn", bpm: 96, totalSteps: 32 });
  const svg = renderSheetSvg(score, { playheadStep: 6 });
  assert.match(svg, /<svg class="pf-sheet"/);
  for (const id of ["tune", "chords", "bass", "drums"]) assert.match(svg, new RegExp(`pf-part-${id}`));
  assert.match(svg, /class="pf-sheet-note pf-part-tune own now" data-id="mine-1"/, "the note sounding under the playhead is marked");
  assert.match(svg, /pf-sheet-playhead/);
  assert.ok((svg.match(/pf-sheet-rest/g) || []).length > 0, "rests are drawn");
  assert.doesNotMatch(svg, /NaN/);
});

test("the page writes itself from what has sounded, and the beat ball lands on beats and bounces between them", () => {
  const take = { start: 10, bpm: 120, steps_per_bar: 16, events: [
    { event: ev("a", 0, "lead", 64), time: 10, duration: .25 },
    { event: ev("b", 0, "lead", 67), time: 10 + 4 * .125, duration: .25 },
    { event: ev("c", 0, "drums", 36), time: 10 + 8 * .125, duration: .1 },
    { event: ev("later", 0, "lead", 72), time: 10 + 12 * .125, duration: .25 } ] };
  const { events, step } = eventsFromTake(take, { until: 10 + 9 * .125 });
  assert.deepEqual(events.map(e => [e.id, e.step]), [["a", 0], ["b", 4], ["c", 8]], "a note appears only once it has sounded");
  assert.equal(step, 9);
  const score = scoreFromEvents(events, { bpm: 120, totalSteps: 16 });
  const onBeat = renderSheetSvg(score, { playheadStep: 4 }), between = renderSheetSvg(score, { playheadStep: 6 });
  const cy = svg => Number(svg.match(/class="pf-sheet-beat" data-beat="2"[^>]*/) ? svg.match(/cy="([\d.]+)" r="4" class="pf-sheet-beat" data-beat="2"/)[1] : NaN);
  assert.ok(cy(onBeat) > cy(between), "the ball is on the staff line at the beat and up in the air between beats");
  assert.match(onBeat, /pf-sheet-beat-mark on/);
});
