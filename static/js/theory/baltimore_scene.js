import {createSceneWriter} from './scene_writer.js';
import {NATIVE_SCENE_BASS_LEVEL,sceneHarmonyLevel} from './scene_voice_levels.js';
export function baltimoreCells(harmony,openingId=0) {
 const cells=[],patterns=[[2,6],[1,6],[2,7],[0,6],[3,7],[2],[1,5],[3,6]];
 for(let bar=0;bar<4;bar++)for(const [i,step] of patterns[openingId%8].entries()){
  if(openingId===5&&bar===1)continue;
  cells.push({position:bar*16+(bar%2?8:0)+step,interval:harmony.bars[bar][(openingId+i)%3],gate:.6});
 }
 cells.at(-1).interval=harmony.ending;return cells;
}
export function baltimoreBacking(doc,session,preserved) {
 const root=doc.global_context?.root_pc||0,minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
 const third=minor?3:4,sixth=minor?8:9,roots=[0,sixth,5,7];
 const harmony={bars:[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],ending:7};
 const density=session.density??1,color=session.color??1;
 const patch=['sampled_electric_piano_v1','sampled_piano_v1','sampled_clean_guitar_v1','sampled_banjo_v1','sampled_guitar_v1'][color];
 const {add,finish}=createSceneWriter('baltimore-club-v1',doc,session,preserved);
 for(let bar=0;bar<4;bar++){
  const at=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
  for(const step of [0,4,8,13,15])add('drums','kick',at+step,36,.5,step===0?.14:.11);
  for(const step of [4,12])add('drums','clap',at+step,38,.4,.12);
  for(const step of density===0?[2,6,10,14]:[0,2,4,6,8,10,12,14])add('drums','hat_closed',at+step,42,.2,step%4===2?.032:.02);
  if(density>=2)add('drums','perc',at+(odd?11:7),45,.25,.035);
  if(density>=3&&!space)add('drums','snare',at+7,38,.25,.035);
  if(density===4||session.scene_variant==='answer'&&bar===3)add('drums','perc',at+14.5,45,.2,.026);
  for(const step of space?[3]:[3,10])add('bass','clean_bass',at+step,36+(root+roots[bar])%12,.8+density*.08,NATIVE_SCENE_BASS_LEVEL);
  if(!doc.auto_harmony_stabs)add('harmony',patch,at+8,60+(root+harmony.bars[bar][1])%12,space?.4:.7,sceneHarmonyLevel(patch));
 }
 for(const cell of baltimoreCells(harmony,session.scene_variant==='space'?5:session.scene_variant==='answer'?1:0))
  add('lead',patch,cell.position,60+(root+cell.interval)%12,cell.gate,.4);
 return finish();
}
