import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayDoc} from '../../../static/js/theory/session_rules.js';
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {INSTRUMENTS} from '../../../static/js/theory/instrument_catalogue.js';
const ids=['boom-bap-v1','trip-hop-v1','neo-soul-v1'];
const make=id=>setJamDirection(startJam(newPlayDoc()),{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',scene_catalogue:SCENE_CATALOGUE_VERSION,scene_mix:SCENE_MIX_VERSION,scene_id:id,density:2,color:0,responsive:false});
const at=n=>n.step+n.performance.offset_steps;
const part=(song,role,bar)=>song.notes.filter(n=>n.role===role&&n.step>=bar*16&&n.step<(bar+1)*16);
test('neo-soul baseline rootless shells preserve explicit local major and minor qualities',()=>{
 const expected={major:[[64,71,74],[60,67,71],[57,64,67],[59,65,69]],natural_minor:[[63,70,74],[60,67,70],[56,63,67],[58,62,65]]};
 for(const scale_type of Object.keys(expected))for(const root_pc of [0,2]){
  const input=make(ids[2]);Object.assign(input.global_context,{scale_type,root_pc});const song=setJamDirection(input);
  for(let bar=0;bar<4;bar++){
   const start=bar*16+(bar%2?1.25:.25);
   const pitches=part(song,'harmony',bar).filter(n=>at(n)===start).map(n=>n.concrete.midi_pitch).sort((a,b)=>a-b);
   assert.deepEqual(pitches,expected[scale_type][bar].map(p=>p+root_pc));
   const root=[0,scale_type==='major'?9:8,5,7][bar]+root_pc;
   assert.ok(pitches.every(p=>p%12!==root%12));
  }
 }
});
test('neo-soul delays only authored backing events and preserves the played source',()=>{
 const song=make(ids[2]),snare=part(song,'drums',0).find(n=>n.patch_id==='snare');
 assert.equal(at(snare),4.125);
 const chord=part(song,'harmony',0)[0];assert.equal(at(chord),.25);
 const events=compileSongStandalone(song).events;
 assert.equal(events.find(e=>e.id===snare.id).start_sec,Math.round(4.125*15/song.global_context.bpm*1e6)/1e6);
 const own={id:'jam-user-independent-onset',role:'lead',patch_id:'sampled_piano_v1',step:3,duration_steps:7.6,velocity:.73,concrete:{midi_pitch:66},pitch_lock_mode:'concrete',performance:{version:1,offset_steps:.13},provenance:'user_placed'};
 song.notes.push(own);
 for(const scene_variant of ['base','answer','space'])assert.deepEqual(setJamDirection(song,{responsive:true,scene_variant}).notes.find(n=>n.id===own.id),own);
});
test('boom-bap clipped cells and trip-hop alternate empty downbeats differ structurally',()=>{
 const boom=make(ids[0]),trip=make(ids[1]);
 assert.deepEqual([...new Set(part(boom,'harmony',0).map(n=>`${at(n)}:${n.duration_steps}`))],['0:1.25','3:0.5','8:1.25','11:0.5']);
 const snares=part(boom,'drums',0).filter(n=>n.patch_id==='snare');
 assert.ok(Math.abs(snares.find(n=>at(n)===3.5).velocity/snares.find(n=>at(n)===4).velocity-.22)<1e-12);
 assert.deepEqual(part(trip,'drums',1).filter(n=>n.patch_id==='kick').map(n=>at(n)-16),[2,9.5]);
 assert.deepEqual(part(trip,'bass',0).map(at),[2,10]);
 assert.deepEqual(part(trip,'bass',1).map(n=>at(n)-16),[1.5,11.5]);
 assert.ok(part(trip,'harmony',0).every(n=>at(n)===0&&n.duration_steps===9));
});
test('all soul-timing tones retain meaningful variants, controls and registered voices',()=>{
 const patches=new Set(INSTRUMENTS.map(i=>i.patchId));
 const signature=s=>JSON.stringify(compileSongStandalone(s).events.map(({id,source_note_id,...e})=>e));
 for(const id of ids){
  const base=make(id);
  for(const field of ['density','color'])assert.equal(new Set(Array.from({length:5},(_,v)=>signature(setJamDirection(base,{[field]:v})))).size,5,`${id}/${field}`);
  for(const density of [0,1,2,4])for(let color=0;color<5;color++){
   const song=setJamDirection(base,{density,color});
   assert.equal(new Set(['base','answer','space'].map(scene_variant=>signature(setJamDirection(song,{scene_variant})))).size,3,`${id}/${density}/${color}`);
   for(const n of song.notes)assert.ok(patches.has(n.patch_id),n.patch_id);
  }
 }
});
