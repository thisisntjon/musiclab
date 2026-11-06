// A jam begun from an instrument has no scene_id and its band has no form cursor. undefined === undefined must not read
// as a matching cursor: JSON.parse(JSON.stringify(undefined)) throws, and it took Make my song, Undo and every edit down.
// Test drafted by the interface agent (workflow/evidence/interface-repair-2026-11-02/json-error/proposed-fix.patch).
// The real route, with notes reaching the kept song by identity, is .qa-tools/instrument-route-probe.cjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";

function flowWith(scheduler, session = {}) {
  const flow = Object.create(PlayFlow.prototype);
  flow.stage = "jam";
  flow.doc = { id: "song-1", jam_session: { kind: "pitched", ...session } };
  flow.app = { scheduler };
  return flow;
}
const descriptor = { version: 3, sceneId: "x" };

test("playing, with no scene and no form cursor: nothing throws and no cursor is invented", () => {
  const flow = flowWith({ isPlaying: true, activeJamBacking: () => ({ source_song_id: "song-1", leadPlan: { descriptor }, phraseContext: {} }) });
  flow._retainMelodicState();
  assert.equal("form_cursor" in flow.doc.jam_session, false);
  assert.deepEqual(flow.doc.jam_session.melodic_evolution, descriptor);
});

test("stopped, with no scene and no form cursor: nothing throws and no cursor is invented", () => {
  const flow = flowWith({ isPlaying: false, lastStoppedJamLead: { source_song_id: "song-1", plan: null, formCursor: undefined } });
  flow._retainMelodicState();
  assert.equal("form_cursor" in flow.doc.jam_session, false);
});

test("a real cursor for this scene and song is still retained as a copy; another scene's is not", () => {
  const cursor = { id: "scene-a", blockIndex: 2, cycle: 1 };
  const same = flowWith({ isPlaying: false, lastStoppedJamLead: { source_song_id: "song-1", formCursor: cursor } }, { scene_id: "scene-a" });
  same._retainMelodicState();
  assert.deepEqual(same.doc.jam_session.form_cursor, cursor);
  assert.notEqual(same.doc.jam_session.form_cursor, cursor);
  const other = flowWith({ isPlaying: false, lastStoppedJamLead: { source_song_id: "song-1", formCursor: cursor } }, { scene_id: "scene-b" });
  other._retainMelodicState();
  assert.equal("form_cursor" in other.doc.jam_session, false);
});
