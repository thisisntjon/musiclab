import {createSceneWriter} from './scene_writer.js';
import {NATIVE_SCENE_BASS_LEVEL,sceneHarmonyLevel} from './scene_voice_levels.js';

// Original generated fragments, never slices of a personal performance.
export function footworkFragments(harmony,openingId=0) {
 const cells=[],rhythms=[[0,4/3],[0,2],[2/3,4],[2,10/3],[0,8/3],[4,16/3],[1,7/3],[2/3,10/3]];
 for(let v=0;v<8;v++) {
  if(openingId===5&&v%2)continue;
  const tones=harmony.bars[Math.floor(v/2)],a=tones[(openingId+v)%tones.length];
  for(const [i,q] of rhythms[openingId%8].entries())cells.push({position:v*8+q/2,
   interval:v===7&&i===1?harmony.ending:i?tones[(openingId+v+1)%tones.length]:a,gate:.4});
 }
 cells.at(-1).interval=harmony.ending;
 return cells;
}
export function footworkBacking(doc,session,preserved) {
 const root=doc.global_context?.root_pc||0,minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
 const third=minor?3:4,sixth=minor?8:9;
 const harmony={bars:[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],ending:7};
 const density=session.density??1,color=session.color??1;
 const patch=['sampled_electric_piano_v1','sampled_piano_v1','sampled_banjo_v1','sampled_clean_guitar_v1','sampled_guitar_v1'][color];
 const {add,finish}=createSceneWriter('footwork-v1',doc,session,preserved);
 for(let v=0;v<8;v++) {
  const at=v*8,odd=v%2===1,space=session.scene_variant==='space'&&odd;
  const kicks=space?[0,10]:odd?[0,4,20/3,32/3,14]:[0,8/3,16/3,10,14];
  for(const q of kicks)add('drums','kick',at+q/2,36,.3,q===0?.13:.075);
  add('drums','clap',at+4,38,.3,.10);
  if(density>=3&&odd)add('drums','clap',at+7.5,38,.2,.035);
  for(const q of density===0?[2]:[2,10])add('drums','hat_closed',at+q/2,42,.2,.025);
  if(!space&&odd)for(const q of [12,40/3,44/3])add('drums','perc',at+q/2,45,.2,.028);
  if(density===4)add('drums','hat_closed',at+3.5,42,.2,.02);
  if(!space)add('bass','clean_bass',at+(odd?5:0),36+(root+harmony.bars[Math.floor(v/2)][0])%12,.6,NATIVE_SCENE_BASS_LEVEL);
  if(!doc.auto_harmony_stabs&&v%2===0)add('harmony',patch,at+6,60+(root+harmony.bars[v/2][1])%12,.5+density*.12,sceneHarmonyLevel(patch));
 }
 const ordinal=session.scene_variant==='space'?5:session.scene_variant==='answer'?1:0;
 for(const cell of footworkFragments(harmony,ordinal)) {
  add('lead',patch,cell.position,60+(root+cell.interval)%12,cell.gate,.34);
  if(density>=2&&Math.floor(cell.position/8)%2===0)add('lead',patch,cell.position+2,60+(root+cell.interval)%12,.3,.26);
 }
 return finish();
}
