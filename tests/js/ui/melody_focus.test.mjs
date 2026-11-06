// Optional melody lens: real PlayFlow routes, edits and compilation; scheduler is a stateful double.
// This checks preservation and control semantics, not listening quality or browser layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';

const clone = value => structuredClone(value);
const press = (flow, key) => flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });

function setup({ fractional = true } = {}) {
  const values = new Map(), session = new Map();
  const storage = map => ({ getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) });
  globalThis.window = { localStorage: storage(values), sessionStorage: storage(session), scrollTo() {}, matchMedia: () => ({ matches: false }) };
  globalThis.document = { hidden: false, body: { classList: { toggle() {}, add() {} } }, activeElement: null, getElementById: () => null };
  globalThis.CSS ||= { escape: s => String(s) };
  const scheduler = {
    isPlaying: false, stopGeneration: 0, spotlightRole: null,
    setCompiledSong(song) { this.song = song; }, setLoopRange() {}, setRepeatPlayback() {}, clearMuteLayers() {},
    setSpotlightRole(role) { this.spotlightRole = role; },
    stop() { this.isPlaying = false; this.stopGeneration++; }, start() { this.isPlaying = true; },
    unlock: async () => {}, previewSound() {}, capturePerformance: () => null, activeJamBacking: () => null,
    masterBus: { piano: {}, disposed: false },
  };
  const flow = Object.create(PlayFlow.prototype);
  flow.root = { querySelector: () => null, querySelectorAll: () => [] };
  flow.app = { scheduler, _announce() {}, _logSessionEvent() {} };
  flow.render = () => {}; flow._sparkAt = () => {}; flow.stage = 'song'; flow.trail = []; flow.confirm = {};
  flow._freshState();
  flow.stage = 'song';
  flow.doc.notes = [
    { id: 'jam-live-personal', role: 'lead', step: 20, duration_steps: fractional ? 5.75 : 2, velocity: .83,
      patch_id: 'warm_keys', provenance: 'user_placed', source_note_id: 'jam-live-personal', pitch_lock_mode: 'concrete',
      concrete: { midi_pitch: 67, freq_hz: 440 * 2 ** ((67-69)/12) }, performance: { version: 1, offset_steps: fractional ? .27 : 0 } },
    { id: 'backing', role: 'bass', step: 0, duration_steps: 4, velocity: .5, patch_id: 'clean_bass',
      provenance: 'jam_generated', concrete: { midi_pitch: 48 } },
  ];
  flow.doc.song_cards = [0,1].map(() => ({ beat: true, tune: true, under: true, fx: null, big: false, tune_variant: null }));
  flow._compile();
  return flow;
}

test('optional melody entry preserves compiled music and opens the first personal bar', async () => {
  const flow = setup(), before = clone(flow.app.compiledSong.events), notes = clone(flow.doc.notes);
  assert.equal(flow.stage, 'song', 'the melody phase is not mandatory');
  await press(flow, 'melody-part:0');
  assert.equal(flow.stage, 'tune');
  assert.equal(flow.melodyFocus, true);
  assert.equal(flow.editingCard, 0);
  assert.equal(flow.eventTuneBar, 1);
  assert.deepEqual(flow.doc.notes, notes);
  assert.deepEqual(flow.app.compiledSong.events, before);
  assert.equal(flow.app.scheduler.isPlaying, false, 'opening the lens does not start audio');
  assert.match(flow._renderTune(), /Play with your tune/);
  assert.match(flow._renderTune(), /Hear tune clearly/);
});

test('focused melody keeps the exact editor even for a simple on-grid tune after recompilation', async () => {
  const flow = setup({ fractional: false });
  await press(flow, 'melody-part:0');
  flow._compile();
  assert.equal(flow.tuneGrid.eventEditor, true);
  assert.match(flow._renderTune(), /data-phrase-note="jam-live-personal"/);
});

test('a deliberate pitch edit changes only its selected part and Undo restores timing, hold and provenance', async () => {
  const flow = setup();
  await press(flow, 'melody-part:0');
  const before = clone(flow.doc.notes), events = clone(flow.app.compiledSong.events);
  const other = clone(events.filter(e => e.card === 1));
  assert.ok(other.length, 'the unrelated part has compiled events');
  flow.eventTuneId = 'jam-live-personal';
  await press(flow, 'event-edit:up');
  const note = flow.doc.notes.find(n => n.id === 'jam-live-personal');
  assert.equal(note.concrete.midi_pitch, 68);
  for (const key of ['step', 'duration_steps', 'performance', 'source_note_id', 'provenance']) assert.deepEqual(note[key], before[0][key], key);
  assert.deepEqual(flow.app.compiledSong.events.filter(e => e.card === 1), other);
  await press(flow, 'undo');
  assert.deepEqual(flow.doc.notes, before);
  assert.deepEqual(flow.app.compiledSong.events, events);
});

test('tune spotlight is audition only and leaving the lens restores full-band listening', async () => {
  const flow = setup();
  await press(flow, 'melody-part:0');
  const before = clone(flow._canonicalDoc()), events = clone(flow.app.compiledSong.events);
  await press(flow, 'spot:tune');
  assert.equal(flow.app.scheduler.spotlightRole, 'tune');
  assert.equal(flow.app.scheduler.isPlaying, false);
  assert.deepEqual(flow._canonicalDoc(), before);
  assert.deepEqual(flow.app.compiledSong.events, events);
  await press(flow, 'to-song');
  assert.equal(flow.stage, 'song');
  assert.equal(Boolean(flow.melodyFocus), false);
  assert.equal(flow.app.scheduler.spotlightRole, null);
  assert.deepEqual(flow.app.compiledSong.events, events);
});

test('canonical editable continuation retains exact personal notes after focused editing', async () => {
  const flow = setup();
  await press(flow, 'melody-part:0');
  flow.eventTuneId = 'jam-live-personal';
  await press(flow, 'event-edit:longer');
  const before = clone(flow.app.compiledSong.events);
  const saved = JSON.parse(JSON.stringify(flow._canonicalDoc()));
  const reopened = setup();
  reopened.doc = saved;
  reopened._compile();
  assert.deepEqual(reopened.app.compiledSong.events, before);
  await press(reopened, 'melody-part:0');
  const note = reopened.doc.notes.find(n => n.id === 'jam-live-personal');
  assert.equal(note.duration_steps, 6);
  assert.equal(note.performance.offset_steps, .27);
  assert.equal(note.concrete.midi_pitch, 67);
  assert.equal(note.provenance, 'user_placed');
  assert.equal(note.source_note_id, 'jam-live-personal');
});

test('pitch dragging a held continuation in the next bar preserves its earlier fractional onset', async () => {
  const flow = setup();
  flow.doc.notes[0].step = 14;
  flow.doc.notes[0].duration_steps = 8;
  flow._compile();
  await press(flow, 'melody-part:0');
  flow.eventTuneBar = 1;
  assert.match(flow._renderEventTune(), /data-phrase-note="jam-live-personal"/);
  const before = clone(flow.doc.notes[0]);
  const picture = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 444, height: 210 }), setPointerCapture() {}, releasePointerCapture() {} };
  const button = { dataset: { phraseNote: before.id }, getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 44 }) };
  const { low, high } = flow.phraseRange;
  const y = 34 + (high - before.concrete.midi_pitch) / (high-low) * 140;
  const pointer = yy => ({ pointerId: 1, clientX: 8, clientY: yy, button: 0, target: { closest: () => button } });
  flow._beginNoteDrag(pointer(y), picture);
  flow._moveNoteDrag(pointer(y-25));
  flow._endNoteDrag();
  const after = flow.doc.notes.find(n => n.id === before.id);
  assert.notEqual(after.concrete.midi_pitch, before.concrete.midi_pitch);
  assert.equal(after.step, before.step, 'vertical drag must not move an earlier attack into the displayed bar');
  assert.deepEqual(after.performance, before.performance);
  assert.equal(after.duration_steps, before.duration_steps);
});

for (const role of ['bass','harmony','drums','fx','hocket']) test(`${role} exact removal, Undo and continuation preserve other parts and roles`, async () => {
  const flow = setup();
  flow.doc.notes.push({id:`target-${role}`,role,step:1,duration_steps:3.5,performance:{version:1,offset_steps:.2},
    patch_id:role==='drums'?'kick':role==='fx'?'reverse_swell':'warm_keys',velocity:.2,
    provenance:'jam_generated',generated_by:'musiclab_jam',concrete:{midi_pitch:60,freq_hz:261.625565}});
  flow._compile(); await press(flow,'melody-part:0'); await press(flow,`event-role:${role}`);
  const before=clone(flow.doc.notes), other=clone(flow.app.compiledSong.events.filter(e=>e.card===1));
  flow.eventTuneId=`target-${role}`;
  await press(flow,'event-edit:remove');
  assert.deepEqual(flow.doc.notes,before.filter(n=>n.id!==`target-${role}`));
  assert.deepEqual(flow.app.compiledSong.events.filter(e=>e.card===1),other);
  const saved=JSON.parse(JSON.stringify(flow._canonicalDoc())), compiled=clone(flow.app.compiledSong.events);
  const restored=setup(); restored.doc=saved; restored._compile();
  assert.deepEqual(restored.app.compiledSong.events,compiled);
  await press(flow,'undo'); assert.deepEqual(flow.doc.notes,before);
  flow.eventTuneId=`target-${role}`; await press(flow,'event-edit:longer');
  const edited=flow.doc.notes.find(n=>n.id===`target-${role}`);
  assert.equal(edited.duration_steps,3.75); assert.equal(edited.role,role);
  assert.equal(edited.provenance,'jam_generated'); assert.equal(edited.generated_by,undefined);
  assert.equal(edited.edited_from_generator,'musiclab_jam');
});

test('nonmelody editor does not offer hidden tune transformations as selected-role actions', async () => {
  const flow=setup(); await press(flow,'melody-part:0'); await press(flow,'event-role:bass');
  const html=flow._renderEventTune();
  assert.doesNotMatch(html,/data-key="change-sound"/, 'current instrument action changes lead notes, not the displayed bass');
  assert.doesNotMatch(html,/data-key="melody-echo"/);
  assert.doesNotMatch(html,/data-key="spot:tune"/);
  assert.doesNotMatch(html,/Bar 2[^<]*your notes/, 'lead-note ownership must not label the bass bar');
});
