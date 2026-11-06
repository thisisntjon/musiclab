import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';

const source = 'jam-live-personal-original';
function flow() {
  const value = Object.create(PlayFlow.prototype);
  value._rememberUnkeptPlaying(source);
  return value;
}
const note = () => ({id: 'kept-note', source_note_id: source, provenance: 'user_placed',
  step: 3, duration_steps: 2.75, concrete: {midi_pitch: 64}});

test('generated attribution and arbitrary IDs cannot retire an original performance', () => {
  const f = flow();
  f._reconcileRetainedPlaying({notes: [{id:'answer', provenance:'scaffold',
    evolution:{answered:{source_note_id:source}}}], metadata:{id:source}});
  assert.equal(f._hasUnkeptPlaying(), true);
  assert.deepEqual([...f.unkeptLiveIds], [source]);
});

test('a complete personal canonical note retires only its own pending identity', () => {
  const f = flow(); f._rememberUnkeptPlaying('jam-live-other');
  f._reconcileRetainedPlaying({song_cards:[{material:{notes:[note()]}}]});
  assert.deepEqual([...f.unkeptLiveIds], ['jam-live-other']);
});

test('a timed personal capture occurrence is retained without canonical step fields', () => {
  const f = flow(); const event = note(); delete event.step; delete event.duration_steps;
  f._reconcileRetainedPlaying({captured_performance:{events:[{event,time:1.25,duration:.6875}]}});
  assert.equal(f._hasUnkeptPlaying(), false);
});

test('identity with missing musical payload or invalid duration is not retained', () => {
  for (const invalid of [
    {id:source,provenance:'user_placed'},
    {...note(),duration_steps:0},
    {...note(),concrete:{freq_hz:0}},
    {event:{...note(),step:undefined,duration_steps:undefined},time:2,duration:NaN},
  ]) {
    const f = flow(); f._reconcileRetainedPlaying({notes:[invalid]});
    assert.equal(f._hasUnkeptPlaying(),true);
  }
});

test('retained notes do not hide a failed storage warning', () => {
  const f = flow(); f.draftSaveFailed = true;
  f._reconcileRetainedPlaying({notes:[note()]});
  assert.equal(f.unkeptLiveIds.size,0);
  assert.equal(f._hasUnkeptPlaying(),true);
});
