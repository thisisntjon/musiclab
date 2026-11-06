import {createSceneWriter} from './scene_writer.js';
import {sceneHarmonyLevel} from './scene_voice_levels.js';
import {NEO_SHELLS} from './soul_timing_scenes.js';

export const FAST_BREAK_IDS=Object.freeze(['drum-and-bass-v1','jungle-v1','liquid-dnb-v1']);
// q is a subdivision of one fast drum bar: q/2 maps to the unchanged song
// grid. Two fast drum bars fit each application bar; BPM and personal notes
// are never multiplied. These are original programmed patterns, not samples.
export const FAST_DRUMS=Object.freeze({
  dnb:[{kick:[0,10],ghost:[7,15],ratios:[.22,.22],hats:[0,2,4,6,8,10,12,14]},
    {kick:[0,9,14],ghost:[3,11],ratios:[.24,.24],hats:[0,2,4,6,8,10,12,14]}],
  jungle:[{kick:[0,6,10,13.5],ghost:[3,7,10.5,15],ratios:[.18,.32,.22,.35],hats:[0,1,2,4,5,6,8,9,10,12,14,15]},
    {kick:[0,7,11],ghost:[2.5,6,9.5,14.5,15.5],ratios:[.25,.18,.30,.22,.16],hats:[0,2,3,4,6,8,10,11,12,14]}],
  liquid:[{kick:[0,10],ghost:[6.5,15],ratios:[.16,.20],hats:[0,2,3,4,6,8,10,11,12,14]},
    {kick:[0,8,11],ghost:[7,10.5],ratios:[.18,.14],hats:[0,2,4,5,6,8,10,12,13,14]}],
});
const fold=(p,low,high)=>{while(p<low)p+=12;while(p>high)p-=12;return p;};

export function fastBreakBacking(doc,session,preserved,motif){
  const id=session.scene_id,jungle=id==='jungle-v1',liquid=id==='liquid-dnb-v1';
  if(!FAST_BREAK_IDS.includes(id))throw Error('Unsupported fast-break recipe.');
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9,roots=[0,sixth,5,7];
  const triads=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]];
  const density=session.density??1,color=session.color??1;
  const colors=liquid?['sampled_electric_piano_v1','sampled_piano_v1','warm_keys','sampled_guitar_v1','sampled_electric_piano_v1']:
    jungle?['warm_keys','sampled_electric_piano_v1','sampled_guitar_v1','pluck_lead','warm_keys']:
    ['warm_keys','pluck_lead','sampled_electric_piano_v1','supersaw_stab','warm_keys'];
  const patch=colors[color],level=sceneHarmonyLevel(patch),pattern=FAST_DRUMS[jungle?'jungle':liquid?'liquid':'dnb'];
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
    const answer=session.scene_variant==='answer'&&bar===3,phrase=[.92,1,.96,1.04][bar];
    const localThird=bar===1?(minor?4:3):third;
    for(let half=0;half<2;half++){
      const cell=pattern[half],offset=base+half*8,last=bar===3&&half===1;
      for(const q of cell.kick)add('drums','kick',offset+q/2,36,.65,.14*phrase);
      for(const q of [4,12])add('drums','snare',offset+q/2,38,.65,.12*phrase);
      let ghosts=density>=2?cell.ghost:jungle?cell.ghost.slice(0,1):[];
      if(last&&(density===4||answer))ghosts=jungle?[2.5,6,9.5,14,15,15.5]:liquid?[7,10.5,15]:[3,11,15];
      if(space)ghosts=ghosts.slice(0,1);
      for(const [i,q] of ghosts.entries())add('drums','snare',offset+q/2,38,.3,.12*cell.ratios[i%cell.ratios.length]*phrase);
      let hats=density===0?cell.hats.filter(q=>q%4===0):[...cell.hats];
      if(space)hats=hats.filter(q=>q%2===0);
      if(density>=3&&!space&&!hats.includes(7))hats.push(7);
      if(density===4&&last&&!hats.includes(15))hats.push(15);
      for(const q of hats){
        const open=!jungle&&!liquid&&last&&q===14;
        add('drums',open?'hat_open':'hat_closed',offset+q/2,open?46:42,.3,(q%4===0?.04:.025)*phrase*(liquid?.8:1));
      }
    }
    const bass=liquid?[[0,0,7],[8,0,6]]:jungle?(odd?[[2,0,8]]:[[0,0,6],[10,7,4]]):[[0,0,5.5],[8,answer?localThird:7,5]];
    for(const [step,pitch,gate] of bass)add('bass','sampled_bass_v1',base+step,fold(36+root+roots[bar]+pitch,36,55),gate,.37*phrase);
    if(doc.auto_harmony_stabs)continue;
    if(liquid){
      // Sustain common shell voices across the second sonority rather than
      // retriggering every sample. The top voice alone moves by an octave.
      // This authored legato also keeps fast repeated cycles within allocation.
      const pitches=NEO_SHELLS[minor?'minor':'major'][bar],inv=color%3;
      const voiced=pitches.map((_,i)=>fold(pitches[(i+inv)%3]+root+(i+inv>=3?12:0)+(color===4?12:0),48,88));
      const top=Math.max(...voiced);
      for(const pitch of voiced)add('harmony',patch,base,pitch,space||pitch===top?7:14,level*.8*phrase);
      if(!space){
        const moved=answer?(top+12<=88?top+12:top-24):top-12;
        add('harmony',patch,base+8,moved,6,level*.8*phrase);
      }
      if(odd&&!space&&density>=3)for(const [i,step] of [14,15].entries())add('harmony','sampled_piano_v1',base+step,60+root+triads[bar][i],.6,.2*phrase);
    }else if(jungle){
      const upper=[roots[bar],roots[bar]+(answer?localThird:7)];
      for(const pitch of upper)add('harmony',patch,base+(odd?4:0),fold(48+root+pitch+(color===4?12:0),48,83),space?4:odd?7:8,level*phrase);
    }else{
      const chord=triads[bar],inv=color%3;
      for(const step of space?[6]:[6,14])for(const i of [0,2])add('harmony',patch,base+step,fold(48+root+chord[(i+inv)%3]+(i+inv>=3?12:0)+(color===4?12:0),48,83),.8,level*phrase);
      if(answer)add('harmony',patch,base+15,60+root+roots[bar],.5,level*.7*phrase);
    }
  }
  return finish();
}
