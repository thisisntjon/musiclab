import test from 'node:test';
import assert from 'node:assert/strict';
import {MelodyFieldSession} from '../../../static/ui/melody_field_session.js';
const song={song_id:'mode-test',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:[{id:'original',role:'lead',step:0,duration_steps:4,patch_id:'sampled_piano_v1',provenance:'user_placed',concrete:{midi_pitch:60}}]};
const make=()=>new MelodyFieldSession(song,{scheduler:{isPlaying:false},captureOrigin:0,sourceDoc:{id:'original'}});
test('legacy and unsupported contexts disclose note variation without changing the source',()=>{
 const before=structuredClone(song),s=make(),html=s.html();
 assert.match(html,/data-melody-mode="note-variation"/);
 assert.match(html,/Try note changes/);
 assert.match(html,/It does not build a new melody/);
 assert.match(html,/New melody choices are not ready for this groove/);
 assert.match(html,/aria-label="Note changes/);
 assert.match(html,/Keep this take/);
 assert.doesNotMatch(html,/Keep this melody/);
 assert.deepEqual(song,before);
});
test('prepared phrase composer is distinctly labelled and keeps chosen-score action',()=>{
 const s=make();s.palette={original:{notes:structuredClone(song.events)}};
 const html=s.html();
 assert.match(html,/data-melody-mode="phrase-composer"/);
 assert.match(html,/Make your tune/);
 assert.match(html,/Try a new phrase with this band/);
 assert.match(html,/aria-label="Whole melody choices/);
 assert.match(html,/Keep this melody/);
 assert.doesNotMatch(html,/data-mf-coverage/);
});
