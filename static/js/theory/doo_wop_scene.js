import {createSceneWriter} from './scene_writer.js';
import {OOH_SCENE_LEVEL} from './scene_voice_levels.js';

// Original sampled-vowel study, not four recorded singers or sung lyrics.
// The four registers remain separate even when transposed; two middle parts
// share the harmony role but have independent pitches and note identities.
export function dooWopBacking(doc,session,preserved) {
  const root=doc.global_context?.root_pc||0;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const chords=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]],roots=[0,sixth,5,7];
  const density=session.density??1,color=session.color??1,patch='sampled_ooh_v1';
  const {add,finish}=createSceneWriter('doo-wop-v1',doc,session,preserved);
  for(let bar=0;bar<4;bar++) {
    const at=bar*16,space=session.scene_variant==='space'&&bar%2===1;
    const level=[.92,1,.94,1.02][bar];
    for(const step of [0,8])add('drums','kick',at+step,36,.5,.08*level);
    for(const step of [4,12])add('drums','snare',at+step,38,.5,.065*level);
    for(const step of density>=3&&!space&&bar!==3?[0,8,14]:[0,8])
      add('bass',patch,at+step,48+(root+roots[bar])%12,bar===3&&step===8?7:step===14?.75:2,.28*level);
    const tones=chords[bar].map(n=>(root+n)%12).sort((a,b)=>a-b);
    const pair=[[0,1],[1,2],[0,2]][color%3];
    if(!doc.auto_harmony_stabs)for(const step of density===0||space?[10]:[2,10])
      for(const index of pair)add('harmony',patch,at+step,60+tones[index],
        Math.min(3,1+density*.35+(color>=3?.4:0)),.25*level);
    const answer=session.scene_variant==='answer'&&bar===3;
    for(const [i,step] of (space?[8]:[0,8]).entries()) {
      const interval=chords[bar][answer?1:i===0?2:0];
      add('lead',patch,at+step,72+(root+interval)%12,1.5,.36*level);
    }
  }
  return finish().map(note=>({...note,velocity:note.velocity*OOH_SCENE_LEVEL}));
}
