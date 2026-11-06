// Phase 15.1: the heard meter, the pad light and the direction glow show the read as it happens and change nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceRead,performanceLean,heardWords,BIAS_MIN_NOTES} from '../../../static/js/theory/exploration_bias.js';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE,SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {circleFamilyScenes} from '../../../static/js/theory/music_circle.js';

const freq=midi=>440*2**((midi-69)/12);
const own=(time,hold,midi=64)=>({time,duration:hold,released_at:time+hold,occurrence:time,event:{provenance:'user_placed',source_note_id:`jam-live-x-${time}`,role:'lead',concrete:{freq_hz:freq(midi)}}});
const take=(events,bpm=120)=>({bpm,start:0,steps_per_bar:16,events});

test('the read exists from the first note, says so until it would steer, and then matches the lean',()=>{
  assert.equal(performanceRead(take([]),10),null);
  assert.equal(heardWords(null),'Band hears: nothing yet. Play a key.');
  const one=performanceRead(take([own(1,.1)]),2);
  assert.equal(one.settled,false);assert.equal(heardWords(one),'Band hears: a start. Play more.');
  assert.equal(performanceLean(take([own(1,.1)]),2),null,'the steering read still needs its minimum');
  const busy=[...Array(12)].map((_,i)=>own(1+i*.2,.05));
  const read=performanceRead(take(busy),4),lean=performanceLean(take(busy),4);
  assert.equal(read.settled,true);assert.equal(read.lean,lean.lean);assert.equal(read.activity,lean.activity);
  assert.equal(heardWords(read),'Band hears: you play a lot.');
  assert.equal(heardWords(performanceRead(take([own(1,2),own(4,2),own(7,2)]),10)),'Band hears: you leave room.');
  assert.equal(BIAS_MIN_NOTES,3);
});

test('the read names the pitch class the person returns to, without steering on it',()=>{
  const read=performanceRead(take([own(1,.1,64),own(2,.1,64),own(3,.1,67)]),5);
  assert.equal(read.topPitchClass,4);assert.ok(read.topShare>.6);
  assert.ok(!('topPitchClass' in Object(performanceLean(take([]),1)||{})));
});

function makeFlow(events,{playing=true}={}) {
  const doc=setJamDirection(startJam(newPlayDoc({now:1,rand:()=>.5}),{patchId:'sampled_piano_v1'}),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'hip-hop-v1',scene_mix:SCENE_MIX_VERSION});
  doc.jam_session.exploration_map='catalogue-circle-v2';
  const classes=new Map();
  const padButtons=[...Array(8)].map((_,i)=>({classList:{toggle(c,on){classes.set(`${i}:${c}`,on);}}}));
  const attrs={};const style={};
  const box={getAttribute:k=>attrs[k],setAttribute(k,v){attrs[k]=v;},dataset:{},querySelector:sel=>sel.includes('fill')?{style}:{style:{}}};
  const root={querySelector:sel=>sel==='#pf-heard'?box:null,querySelectorAll:sel=>sel==='.pf-jam-pad'?padButtons:[]};
  const flow=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',root,padOctave:0,
    app:{scheduler:{isPlaying:playing,audioCtx:{currentTime:6},performanceTake:take(events,doc.global_context.bpm),activeJamContext:()=>null}}});
  return {flow,classes,attrs,style};
}

test('the meter paints the read into the page and lights the leaned pad; nothing in the document changes',()=>{
  const {flow,classes,attrs,style}=makeFlow([...Array(9)].map((_,i)=>own(2+i*.25,.05,i%4===3?67:64)));
  const before=JSON.stringify(flow.doc);
  flow._paintHeard();
  assert.equal(attrs['aria-label'],'Band hears: you play a lot.');
  assert.match(style.width,/%$/);
  const pads=flow._liveJamPads();
  const litIndex=pads.findIndex(p=>((p.midi%12)+12)%12===4);
  assert.ok(litIndex>=0,'E is on a pad in C major');
  assert.equal(classes.get(`${litIndex}:pf-pad-leaned`),true);
  assert.equal(JSON.stringify(flow.doc),before);
  assert.equal(flow.undoStack,undefined);
  // Stopped band: the meter reads nothing and the pad light goes out.
  flow.app.scheduler.isPlaying=false;flow._paintHeard();
  assert.equal(attrs['aria-label'],'Band hears: nothing yet. Play a key.');
  assert.equal(classes.get(`${litIndex}:pf-pad-leaned`),false);
});

test('the direction glow uses the same weights Next family uses, and points at the scene Next family would pick',()=>{
  const busy=[...Array(24)].map((_,i)=>own(1+i*.2,.05,64));
  const {flow}=makeFlow(busy);
  flow._paintHeard();
  const ticks=[];const tickEls=new Map();
  for(const id of SCENE_CATALOGUE.map(s=>s.id)){const el={dataset:{scene:id},style:{},classes:new Set(),classList:{toggle(c,on){on?el.classes.add(c):el.classes.delete(c);},remove(...cs){cs.forEach(c=>el.classes.delete(c));}}};ticks.push(el);tickEls.set(id,el);}
  const arrow={hidden:true,style:{},dataset:{}};
  const circle={querySelectorAll:()=>ticks,querySelector:()=>arrow};
  flow._paintDirectionGlow(circle,'hip-hop-v1');
  assert.equal(arrow.hidden,false);
  const nextFamilyPick=flow._circleFamilyChoice('hip-hop-v1',1);
  const weights=flow._glow.weights;
  const family=circleFamilyScenes('hip-hop-v1',1);
  const brightestInNextFamily=family.filter(id=>weights.has(id)).reduce((a,b)=>weights.get(b)>weights.get(a)?b:a);
  assert.equal(nextFamilyPick,brightestInNextFamily,'the arrow and Next family agree');
  assert.ok(tickEls.get(brightestInNextFamily).classes.has('pf-tick-toward'));
  assert.ok([...weights.values()].every(w=>w>=.4&&w<=2.5));
  // A scene outside reach is left alone.
  assert.equal(tickEls.get('black-metal-v1').style.opacity,'');
  // No lean: everything resets and the arrow hides.
  flow.heardRead={settled:true,lean:0};
  flow._paintDirectionGlow(circle,'hip-hop-v1');
  assert.equal(arrow.hidden,true);
  assert.ok(ticks.every(t=>!t.classes.has('pf-tick-toward')&&!t.classes.has('pf-tick-away')&&t.style.opacity===''));
});
