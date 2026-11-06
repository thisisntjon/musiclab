// Production echo contract; source originals remain editable.
// Run: node --test tests/js/theory/melody_answer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureSectionIds, insertSongPart, extractSongMaterial, applySongMaterial, songEvents, MAX_SONG_CARDS } from '../../../static/js/theory/song_view.js';
import { compileSongStandalone } from '../../../static/ui/standalone_compiler.js';
import { exportProjectJson, parseProjectJson } from '../../../static/js/theory/save_store.js';

import {previewEchoAnswer, previewEndingIdea} from '../../../static/js/theory/melody_answer.js';
const clone = v => structuredClone(v);

const note = (id, step, duration, provenance = 'user_placed') => ({ id, role: 'lead', step, duration_steps: duration,
  patch_id: 'warm_keys', velocity: .8, provenance, concrete: { midi_pitch: 67, freq_hz: 391.99543598174927 },
  performance: { version: 1, offset_steps: .25 }, pitch_lock_mode: 'concrete' });
function fixture() {
  const material = { auto_harmony_stabs: false, lead_patch_id: 'warm_keys', notes: [note('mine', 2, 7.5), note('band', 10, 2, 'jam_generated'),
    { ...note('bass', 0, 4, 'jam_generated'), role: 'bass', patch_id: 'clean_bass' }] };
  const card = (id, name, notes = material.notes) => ({ section_id: id, role_name: name, bars: 2, beat: true, tune: true,
    under: true, big: false, fx: null, tune_variant: null, material: { ...clone(material), notes: clone(notes) } });
  return { id: 'echo-fixture', title: 'Echo fixture', notes: [], global_context: { root_pc: 0, scale_type: 'major', bpm: 100, meter: '4/4' },
    song_cards: [card('source','Source'), card('other','Other',[note('other-note',4,3)]), card('ending','Ending',[note('end-note',0,4)])] };
}
function compile(doc) {
  const loopDoc = { ...doc, arrangement_mode: 'loop' }, base = compileSongStandalone(loopDoc, null);
  return songEvents(base, doc.song_cards, doc.song_cards.map(c => compileSongStandalone(applySongMaterial(loopDoc,c.material), null)));
}
const music = n => [n.step, n.duration_steps, n.performance, n.concrete, n.patch_id, n.velocity];

test('preview is detached, uses personal material, and leaves every original section intact', () => {
  const doc = fixture(), snapshot = clone(doc), preview = previewEchoAnswer(doc,0);
  assert.equal(preview.changed,true); assert.equal(preview.afterIndex,2); assert.equal(preview.index,0);
  assert.deepEqual(doc,snapshot); assert.deepEqual(preview.before,snapshot);
  for (const original of doc.song_cards) assert.deepEqual(preview.after.song_cards.find(c => c.section_id === original.section_id),original);
  const card = preview.after.song_cards[preview.afterIndex], lead = card.material.notes.filter(n => n.role === 'lead');
  assert.equal(lead.length,1); assert.deepEqual(music(lead[0]),music(doc.song_cards[0].material.notes[0]));
  assert.equal(lead[0].provenance,'jam_generated'); assert.equal(lead[0].generated_by,'musiclab_melody_answer');
  assert.equal(lead[0].source_note_id,'mine'); assert.notEqual(lead[0].id,'mine');
  card.material.notes[0].concrete.midi_pitch = 80;
  assert.deepEqual(doc,snapshot,'editing preview cannot mutate original');
});

test('selected ending uses that ending as its source, not insertSongPart predecessor fallback', () => {
  const doc = fixture(), preview = previewEchoAnswer(doc,2);
  assert.equal(preview.changed,true); assert.equal(preview.afterIndex,2);
  assert.equal(preview.after.song_cards[2].material.notes.find(n => n.role === 'lead').source_note_id,'end-note');
  assert.equal(preview.after.song_cards.at(-1).section_id,'ending');
});

test('fallback to existing generated melody is explicit generated echo, never personal attribution', () => {
  const doc = fixture(); doc.song_cards[0].material.notes = [note('generated',1,3,'jam_generated')];
  const preview = previewEchoAnswer(doc,0), answer = preview.after.song_cards[preview.afterIndex].material.notes[0];
  assert.equal(preview.changed,true); assert.equal(answer.source_note_id,'generated'); assert.equal(answer.provenance,'jam_generated');
});

test('editable export/import compiles the exact echo gate and pitch consistently', () => {
  const preview = previewEchoAnswer(fixture(),0), compiled = compile(preview.after);
  const parsed = parseProjectJson(exportProjectJson(preview.after));
  assert.equal(parsed.ok,true);
  const restored = parsed.song || parsed.doc || parsed.project?.song;
  assert.ok(restored, 'import must return editable song');
  assert.deepEqual(compile(restored),compiled);
  const answer = compiled.events.find(e => e.card === preview.afterIndex && e.role === 'lead');
  assert.equal(answer.concrete.midi_pitch,67); assert.equal(answer.duration_steps,7.5);
  assert.equal(answer.duration_sec,1.125);
});

test('capacity, cross-boundary holds and transition continuity do not silently replace or shorten originals', () => {
  for (const alter of [
    d => { d.song_cards = Array.from({length:8},(_,i) => ({...clone(d.song_cards[0]),section_id:`part-${i}`})); },
    d => { d.song_cards[0].material.notes[0].duration_steps = 40; },
    d => { d.song_cards.at(-1).big = true; },
    d => { d.song_cards[1].capture_segment = {version:1,take_id:'take',start_step:0,end_step:32}; d.song_cards[2].capture_segment = {version:1,take_id:'take',start_step:32,end_step:64}; },
  ]) {
    const doc = fixture(); alter(doc); const snapshot = clone(doc), preview = previewEchoAnswer(doc,0);
    assert.equal(preview.changed,false); assert.ok(preview.reason); assert.deepEqual(preview.after,snapshot); assert.deepEqual(doc,snapshot);
  }
});


test('ending idea changes one final pitch, preserves originals and every other written note', () => {
 const doc=fixture(), snapshot=clone(doc), p=previewEndingIdea(doc,0);
 assert.equal(p.changed,true);assert.equal(p.kind,'ending');assert.equal(p.sourceNoteId,'band');
 assert.deepEqual(doc,snapshot);
 for(const c of doc.song_cards) assert.deepEqual(p.after.song_cards.find(x=>x.section_id===c.section_id),c);
 const notes=p.after.song_cards[p.afterIndex].material.notes, old=doc.song_cards[0].material.notes;
 for(let i=0;i<old.length;i++) {
  if(old[i].id!=='band') assert.deepEqual(notes[i],old[i]);
  else {assert.equal(notes[i].source_note_id,'band');assert.equal(notes[i].provenance,'jam_generated');
   assert.equal(notes[i].concrete.midi_pitch,69);assert.equal(notes[i].concrete.freq_hz,440);
   assert.equal(notes[i].duration_steps,old[i].duration_steps);assert.deepEqual(notes[i].performance,old[i].performance);}
 }
 const original=compile(doc), candidate=compile(p.after);
 const local=(song,i)=>song.events.filter(e=>e.card===i).map(e=>{const n=clone(e);delete n.card;delete n.start_sec;delete n.step;return n;});
 // Compare event payloads after removing the section's time displacement.
 for(let i=0;i<doc.song_cards.length;i++) {
  const j=p.after.song_cards.findIndex(c=>c.section_id===doc.song_cards[i].section_id);
  assert.deepEqual(local(candidate,j),local(original,i));
 }
 assert.deepEqual(local(candidate,p.afterIndex).filter(e=>e.role!=='lead'),local(original,0).filter(e=>e.role!=='lead'));
 const parsed=parseProjectJson(exportProjectJson(p.after));assert.equal(parsed.ok,true);
 assert.deepEqual(compile(parsed.song),candidate);
});

test('ending admits only bounded, concrete, full-length material',()=>{
 for(const change of [
  d=>{d.song_cards[0].big=true;},
  d=>{d.song_cards[0].material.notes[2].duration_steps=40;},
  d=>{delete d.song_cards[0].material.notes[2].concrete;},
  d=>{d.song_cards[0].material.notes[0].performance.offset_steps=NaN;},
  d=>{d.global_context.scale_type='unknown';},
 ]) {const d=fixture();change(d);const p=previewEndingIdea(d,0);assert.equal(p.changed,false);assert.deepEqual(p.after,d);}
});

test('ending preview tolerates a stale index into synthesized default song cards',()=>{
 const doc=fixture();doc.notes=clone(doc.song_cards[0].material.notes);doc.song_cards=[];
 const p=previewEndingIdea(doc,0);assert.equal(p.changed,false);assert.deepEqual(p.after,doc);
});
