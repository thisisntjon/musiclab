// Phase 8.0 AC7 + AC8: hummed tunes keep their shape when sung off key; failures are honest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { keyPhraseRelative, scaleDegreesOf, DEFAULT_NOTE_RANGE, rmsToExpression } from "../../../static/js/audio/hum_keying.js";
import { pitchTrackPcmToDraftNotes, recordHummedPhraseToDraftNotes } from "../../../static/js/audio/scheduler.js";

const TUNE = [60, 62, 64, 67, 64, 62, 60]; // 1-2-3-5-3-2-1 in C major

test("AC7: the same tune sung at different offsets keys to identical scale degrees", () => {
  const expected = [1, 2, 3, 5, 3, 2, 1];
  for (const off of [0, -0.5, -1, -3, -5, 0.3]) {
    const keyed = keyPhraseRelative(TUNE.map((m) => m + off), 0, "major");
    assert.deepEqual(scaleDegreesOf(keyed, 0, "major"), expected, `offset ${off}`);
  }
});

test("AC7: through the real pitch tracker (synthesised sine hums)", () => {
  const sr = 22050;
  const sps = Math.round(0.15 * sr);
  const expected = scaleDegreesOf(TUNE, 0, "major");
  for (const off of [0, -0.5, -1, -3, -5, 0.3]) {
    const pcm = new Float32Array(sps * 16);
    [...TUNE, 60].forEach((m, k) => {
      const f = 440 * 2 ** ((m + off - 69) / 12);
      for (let i = 0; i < 2 * sps; i++) pcm[2 * k * sps + i] = 0.5 * Math.sin((2 * Math.PI * f * (i % sps)) / sr);
    });
    const notes = pitchTrackPcmToDraftNotes(pcm, sr, 100, 0, "major");
    assert.deepEqual(scaleDegreesOf(notes.map((n) => n.snapped_midi), 0, "major"), expected, `offset ${off}`);
  }
});

test("AC7: empty and single-note input", () => {
  assert.deepEqual(keyPhraseRelative([], 0, "major"), []);
  assert.deepEqual(keyPhraseRelative([null, null], 0, "major"), [null, null]);
  const [one] = keyPhraseRelative([45.2], 0, "major");
  assert.ok(one >= DEFAULT_NOTE_RANGE.low && one <= DEFAULT_NOTE_RANGE.high, `single note ${one} out of range`);
});

test("AC7: a real interval mistake is kept, not 'corrected' into a different tune", () => {
  // 1-2-4-5 sung (the person sang a 4th, not a 3rd): keep it.
  const keyed = keyPhraseRelative([60, 62, 65, 67], 0, "major");
  assert.deepEqual(scaleDegreesOf(keyed, 0, "major"), [1, 2, 4, 5]);
});

test("AC8: a blocked microphone returns status denied and no notes (no made-up tune)", async () => {
  const mediaDevices = {
    getUserMedia: async () => {
      const err = new Error("blocked");
      err.name = "NotAllowedError";
      throw err;
    },
  };
  assert.deepEqual(await recordHummedPhraseToDraftNotes({ mediaDevices }), { status: "denied", source: null, notes: [] });
});

test("AC8: no microphone returns status no_device and no notes", async () => {
  const missing = {
    getUserMedia: async () => {
      const err = new Error("none");
      err.name = "NotFoundError";
      throw err;
    },
  };
  assert.equal((await recordHummedPhraseToDraftNotes({ mediaDevices: missing })).status, "no_device");
  assert.equal((await recordHummedPhraseToDraftNotes({ mediaDevices: {} })).status, "no_device");
});

test("12b-7 (#10): rmsToExpression and pitchTrackPcmToDraftNotes map vocal energy to velocity and filter brightness", () => {
  const soft = rmsToExpression(0.02);
  const loud = rmsToExpression(0.25);
  assert.ok(loud.velocity > soft.velocity);
  assert.ok(loud.brightness > soft.brightness);
  assert.ok(soft.velocity >= 0.45 && loud.velocity <= 0.98);
  assert.ok(soft.brightness >= 0.25 && loud.brightness <= 0.95);

  const sr = 22050;
  const sps = Math.round(0.15 * sr);
  const pcm = new Float32Array(sps * 16);
  // First note quiet (amp 0.08), second note loud (amp 0.45)
  for (let i = 0; i < 2 * sps; i++) pcm[i] = 0.08 * Math.sin((2 * Math.PI * 261.63 * i) / sr);
  for (let i = 0; i < 2 * sps; i++) pcm[4 * sps + i] = 0.45 * Math.sin((2 * Math.PI * 329.63 * i) / sr);
  const notes = pitchTrackPcmToDraftNotes(pcm, sr, 100, 0, "major");
  assert.equal(notes.length, 2);
  assert.ok(notes[1].velocity > notes[0].velocity);
  assert.ok(notes[1].gesture.xy_pad.y > notes[0].gesture.xy_pad.y);
});

test("Stop works while the browser is still asking for the microphone (nobody is stuck on the prompt)", async () => {
  const { recordHummedPhraseToDraftNotes } = await import("../../../static/js/audio/scheduler.js");
  const controller = {};
  const states = [];
  let stopped = 0;
  let grant;
  const mediaDevices = { getUserMedia: () => new Promise((resolve) => (grant = resolve)) };
  const run = recordHummedPhraseToDraftNotes({ controller, mediaDevices, onState: (s) => states.push(s) });
  await new Promise((r) => setTimeout(r, 0));
  controller.stop();
  const res = await run;
  assert.equal(res.status, "cancelled");
  assert.deepEqual(res.notes, []);
  assert.deepEqual(states, ["stopped"]);
  // If the person allows the mic after pressing Stop, the late stream is shut straight away.
  grant({ getTracks: () => [{ stop: () => (stopped += 1) }] });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(stopped, 1);
});
