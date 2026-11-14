// A melody kept with a Sound wheel sound shows that sound's plain name in the band rows,
// not its patch ID ('sampled kalimba v1').
import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

function setup(patch) {
  const values=new Map();
  globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},scrollTo(){},matchMedia:()=>({matches:false})};
  globalThis.document={body:{classList:{toggle(){},add(){}}},activeElement:null,getElementById:()=>null};
  globalThis.CSS||={escape:s=>String(s)};
  const f=Object.create(PlayFlow.prototype);
  f.root={querySelector:()=>null,querySelectorAll:()=>[]};
  f.app={scheduler:{isPlaying:false,setCompiledSong(){},setLoopRange(){},setRepeatPlayback(){},clearMuteLayers(){},setSpotlightRole(){},stop(){},previewSound(){},capturePerformance:()=>null,activeJamBacking:()=>null,masterBus:{piano:{}}},_announce(){},_logSessionEvent(){}};
  f.render=()=>{};f.stage='song';f.trail=[];f.confirm={};f._freshState();f.stage='tune';f.melodyFocus=true;f.editingCard=0;
  f.doc.song_cards=[{bars:4,beat:true,tune:true,under:true}];
  f.doc.notes=[{id:'mine',role:'lead',patch_id:'sampled_piano_v1',step:0,duration_steps:4,concrete:{midi_pitch:60},provenance:'user_placed'},
    {id:'band',role:'lead',patch_id:patch,step:16,duration_steps:4,concrete:{midi_pitch:67},provenance:'jam_generated',
      sound_base:{patch_id:'sampled_clean_guitar_v1',velocity:.5},velocity:.55}];
  f.tuneGrid={eventEditor:true};return f;
}
const bandLabels=html=>[...html.matchAll(/class="pf-band-row[^"]*">.*?aria-label="(?:Open|Close) ([^"]+) notes"/g)].map(m=>m[1]);

test('band rows name wheel sounds plainly, and catalogue sounds keep their catalogue names',()=>{
  for(const [patch,name] of [['sampled_kalimba_v1','Kalimba'],['sampled_square_lead_v1','Game synth'],['sampled_steel_drums_v1','Steel pan']]) {
    const html=setup(patch)._renderEventTune();
    const labels=bandLabels(html);
    assert.ok(labels.includes(name),`${patch}: band rows ${JSON.stringify(labels)} include ${name}`);
    assert.ok(labels.includes('Sampled piano'),'a catalogue sound keeps its catalogue name');
    assert.doesNotMatch(labels.join('|'),/sampled|_v1|\bv1\b/);
  }
});

test('a patch that is neither catalogued nor sampled still falls back to its spaced ID',()=>{
  const html=setup('mystery_sound')._renderEventTune();
  assert.ok(bandLabels(html).includes('mystery sound'));
});
