// Open-release audit S6 (Q2): every Stop then Play left the old sampled synth alive, about 10 MB and one
// AudioWorklet node each time. Chrome frees the node only after destroy() has reached the processor and the
// worklet's message port is closed; disconnecting first, or destroying while connected, keeps it alive.
// These tests drive createPiano with a fake library, so they check the order of calls, not real memory.
// The real-browser check is a development tool.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sampled from '../../../static/js/audio/sampled_piano.js';

const {createPiano, PIANO_PATCH} = sampled;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const settled = () => sleep((sampled.SYNTH_RETIRE_MS ?? 50) + 60);

function fakeLibrary({bankError = null, destroyError = null} = {}) {
  const synths = [];
  class WorkletSynthesizer {
    constructor(context) {
      this.context = context; this.calls = []; this.isReady = Promise.resolve();
      this.midiChannels = Array.from({length: 16}, () => ({}));
      const synth = this;
      this.worklet = {disconnect() { synth.calls.push('worklet.disconnect'); },
        port: {close() { synth.calls.push('port.close'); }}};
      this.soundBankManager = {async addSoundBank() { synth.calls.push('addSoundBank'); if (bankError) throw bankError; }};
      synths.push(this);
    }
    receiveEventCallback(event) { if (event.type === 'channelAdded') this.midiChannels.push({}); }
    addNewChannel() { this.receiveEventCallback({type: 'channelAdded'}); }
    programChange() {} controllerChange() {}
    noteOn(channel, pitch) { this.calls.push(`noteOn ${pitch}`); }
    noteOff() {}
    connect(node) { this.calls.push('connect'); return node; }
    stopAll(force) { this.calls.push(`stopAll ${force}`); }
    destroy() { this.calls.push('destroy'); if (destroyError) throw destroyError; }
    count(call) { return this.calls.filter(c => c === call).length; }
    get open() { return this.count('port.close') === 0; }
  }
  return {synths, load: async () => ({library: {WorkletSynthesizer}, bank: new ArrayBuffer(8)})};
}
function fakeContext() {
  const param = () => ({value: 1, cancelScheduledValues() {}, setValueAtTime() {}});
  return {currentTime: 0, audioWorklet: {async addModule() {}},
    createGain: () => ({gain: param(), connect(node) { return node; }, disconnect() { this.disconnected = true; }})};
}
const note = {patch_id: PIANO_PATCH, concrete: {freq_hz: 440}, duration_sec: .5, velocity: .8};

test('Stop retires the sampled synth: stopAll, destroy, then a later port close frees it', async () => {
  const {synths, load} = fakeLibrary();
  const piano = await createPiano(fakeContext(), {}, load);
  piano.trigger(note, 0);
  piano.stop();
  const [synth] = synths;
  assert.equal(synth.count('destroy'), 1);
  assert.ok(synth.calls.indexOf('stopAll true') < synth.calls.indexOf('destroy'), 'notes stop before the synth is destroyed');
  // Closing at once can drop the destroy message before the processor reads it, and the node stays alive.
  assert.equal(synth.count('port.close'), 0, 'the port waits for destroy to reach the processor');
  await settled();
  assert.equal(synth.count('port.close'), 1, 'the port is closed, so the browser can free the node and its bank copy');
  assert.ok(synth.calls.indexOf('destroy') < synth.calls.indexOf('port.close'));
});

test('pressing Stop again retires the synth only once', async () => {
  const {synths, load} = fakeLibrary();
  const piano = await createPiano(fakeContext(), {}, load);
  piano.stop(); piano.stop(); await settled(); piano.stop();
  assert.equal(synths[0].count('destroy'), 1);
  assert.equal(synths[0].count('port.close'), 1);
  assert.throws(() => piano.trigger(note, 1), /Sampled sounds stopped/);
});

test('negative control: a piano that is still playing keeps its synth open', async () => {
  const {synths, load} = fakeLibrary();
  const piano = await createPiano(fakeContext(), {}, load);
  piano.trigger(note, 0);
  await settled();
  assert.equal(synths[0].count('destroy'), 0);
  assert.equal(synths[0].open, true);
  assert.ok(piano.trigger(note, 1), 'it still plays');
});

test('a load that fails part way retires its half-made synth and still reports the load error', async () => {
  const {synths, load} = fakeLibrary({bankError: Error('The sound file is not whole. Try loading it again.')});
  await assert.rejects(createPiano(fakeContext(), {}, load), /not whole/);
  assert.equal(synths[0].count('destroy'), 1);
  await settled();
  assert.equal(synths[0].count('port.close'), 1);
});

test('a synth whose destroy throws still gets its port closed', async () => {
  const {synths, load} = fakeLibrary({destroyError: Error('destroy failed')});
  const piano = await createPiano(fakeContext(), {}, load);
  assert.throws(() => piano.stop(), /destroy failed/, 'the scheduler logs this and keeps stopping');
  await settled();
  assert.equal(synths[0].count('port.close'), 1);
});

test('twenty Stop then Play cycles leave only the playing synth open', async () => {
  const {synths, load} = fakeLibrary();
  const context = fakeContext();
  for (let i = 0; i < 20; i++) {
    const piano = await createPiano(context, {}, load);
    piano.trigger(note, i);
    piano.stop();
  }
  const playing = await createPiano(context, {}, load);
  playing.trigger(note, 21);
  await settled();
  assert.equal(synths.length, 21);
  assert.deepEqual(synths.filter(s => s.open), [synths[20]], 'only the synth still playing is open');
  assert.ok(synths.slice(0, 20).every(s => s.count('destroy') === 1 && s.count('port.close') === 1));
});
