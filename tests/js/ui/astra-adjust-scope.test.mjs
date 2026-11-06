import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayFlow } from '../../../static/ui/stages/play_flow.js';

const setup = id => {
  const flow = Object.create(PlayFlow.prototype);
  flow.doc = {song_cards:[{}, {}, {}]};
  flow.adjustHand = [{id,title:id,hint:''}];
  flow._btn = (key,label) => `<button data-key="${key}">${label}</button>`;
  return flow;
};

test('Adjust labels actual targets rather than claiming every change is whole-song', () => {
  for (const [id,label] of [['slower','Whole song pace'],['longer','Song structure'],
    ['mood-1-bigger','Part 2'],['ending-roll','Ending: part 3'],
    ['lift','Part 2'],['ring','Shared tune: your notes']]) {
    assert.ok(setup(id)._adjustHtml().includes(label),`${id}: ${label}`);
  }
  const f = setup('octave-up'); f.editingCard=2;
  assert.ok(f._adjustHtml().includes('Part 3: your notes'));
});

test('Lift scope stays on the part being previewed rather than the next eligible part', () => {
  const f = setup('lift');
  f.cardPreview = {id:'lift',baseline:structuredClone(f.doc)};
  f.doc.song_cards[1].tune_variant='lift';
  assert.match(f._adjustHtml(), /Part 2/);
});
