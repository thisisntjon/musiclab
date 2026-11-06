import test from 'node:test';
import assert from 'node:assert/strict';
import {removeGeneratedBuildEffects,isGeneratedBuildEffect,ensureSectionIds} from '../../../static/js/theory/song_view.js';
import {LookaheadScheduler} from '../../../static/js/audio/scheduler.js';

const note=(id,extra={})=>({id,role:'fx',patch_id:'reverse_swell',step:3,duration_steps:7.25,
  concrete:{midi_pitch:61},provenance:'jam_generated',generated_by:'musiclab_energy',...extra});

test('cleanup detaches only selected part; exact personal/edited notes and original capture stay',()=>{
  const notes=[note('auto'),note('auto-drop',{patch_id:'sub_drop_808'}),
    note('mine',{provenance:'user_placed'}),note('hum',{provenance:'hummed_confirmed'}),
    note('edited',{edited_from_generator:true}),note('other-generator',{generated_by:'other'}),
    note('roll',{patch_id:'snare'}),note('take-old',{provenance:'generator_default',source_note_id:'fx-swell-c0'})];
  const doc={id:'source',notes,song_cards:ensureSectionIds([{},{}]),
    captured_performance:{events:notes.map(event=>({event,time:.5,duration:1.2}))}};
  const original=structuredClone(doc),result=removeGeneratedBuildEffects(doc,0);
  assert.deepEqual(doc,original);
  assert.deepEqual(result.notes,doc.notes);
  assert.deepEqual(result.song_cards[1],doc.song_cards[1]);
  assert.deepEqual(result.captured_performance,doc.captured_performance);
  assert.deepEqual(result.song_cards[0].material.notes,notes.filter(n=>!['auto','auto-drop','take-old'].includes(n.id)));
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});

test('patch identity alone cannot authorize deletion',()=>{
  for(const patch_id of ['reverse_swell','sub_drop_808']){
    assert.equal(isGeneratedBuildEffect(note('fx-swell-personal',{patch_id,provenance:'user_placed'})),false);
    assert.equal(isGeneratedBuildEffect(note('fx-swell-edited',{patch_id,provenance:'generator_default',edited_from_generator:true})),false);
    assert.equal(isGeneratedBuildEffect(note('intentional',{patch_id,provenance:'generator_default',generated_by:undefined})),false);
  }
});

test('maximal mash energy never adds rise/drop across phrase boundaries; Calm suppresses rolls too',()=>{
  const s=Object.create(LookaheadScheduler.prototype);
  Object.assign(s,{committedJamBacking:[],repeatPlayback:true,compiledSong:{steps_per_bar:16},energyDrop:{phrase:0,step:0}});
  let count=0;
  for(let phrase=0;phrase<3;phrase++)for(let step=0;step<64;step++){
    s.jamPhraseOrdinal=phrase;const events=s._energyOrnaments(step,.15,1);count+=events.length;
    assert.ok(events.every(e=>e.patch_id==='snare'&&e.velocity<=.1));
    assert.equal(s.energyDrop,null);
  }
  assert.ok(count>0,'quiet rhythmic response remains');
  s.setQuietOrnaments(true);
  for(let step=0;step<64;step++)assert.deepEqual(s._energyOrnaments(step,.15,1),[]);
});
