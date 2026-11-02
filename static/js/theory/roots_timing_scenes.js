import {createSceneWriter} from './scene_writer.js';

export const ROOTS_TIMING_IDS=Object.freeze(['swing-v1','western-swing-v1','piedmont-v1']);
// Original C fixtures: first three pitches outline the current chord; the last
// approaches the NEXT root. It must not be validated as a current chord tone.
export const WALK_FIXTURES=Object.freeze({
  swing:{major:[[36,40,43,43],[45,48,52,43],[41,45,48,45],[43,47,50,38]],
    minor:[[36,39,43,46],[44,48,51,43],[41,44,48,41],[43,46,50,38]]},
  western:{major:[[48,43,40,47],[45,40,48,43],[41,48,45,41],[43,38,47,50]],
    minor:[[48,43,39,46],[44,39,48,43],[41,48,44,41],[43,38,46,50]]},
});
function fold(pitch,low,high){while(pitch<low)pitch+=12;while(pitch>high)pitch-=12;return pitch;}
export function rootsWalk(root,minor,western){
  const fixture=WALK_FIXTURES[western?'western':'swing'][minor?'minor':'major'];
  const scale=new Set((minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11]).map(pc=>(pc+root)%12));
  const walk=fixture.map(bar=>bar.map(pitch=>fold(pitch+root,36,55)));
  return walk.map((bar,i)=>{
    const next=(i+1)%4,target=walk[next][0],preferred=fixture[i][3]-fixture[next][0];
    const approach=[preferred,2,-2,1,-1].map(delta=>target+delta)
      .find(pitch=>pitch>=36&&pitch<=55&&scale.has(pitch%12));
    if(approach==null)throw Error('No bounded walking approach.');
    return [...bar.slice(0,3),approach];
  });
}

/** Shared-pulse small-group studies, not brass/reed or steel/fiddle ensembles. */
export function rootsTimingBacking(doc,session,preserved,motif){
  const id=session.scene_id,western=id==='western-swing-v1';
  if(!ROOTS_TIMING_IDS.includes(id))throw Error('Unsupported roots timing recipe.');
  if(id==='piedmont-v1')return piedmontBacking(doc,session,preserved,motif);
  const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9;
  const triads=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]];
  const extensions=minor?[10,5,3,5]:[9,7,2,5];
  const density=session.density??1,color=session.color??1,walk=rootsWalk(root,minor,western);
  const keys=color%2?'sampled_electric_piano_v1':'sampled_piano_v1';
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
    const answer=session.scene_variant==='answer'&&bar===3,phrase=[.92,1,.96,1.04][bar];
    for(let i=0;i<4;i++)add('bass','sampled_bass_v1',base+i*4,answer&&i===2?walk[bar][0]:walk[bar][i],i===3?2.5:3.2,(i===0?.37:.31)*phrase);
    if(density>=1){
      for(const step of [0,8])add('drums','kick',base+step,36,1,.07*phrase);
      for(const step of [4,12])add('drums','snare',base+step,38,.7,.065*phrase);
      const hats=density<2||space?[4,12]:western?[8/3,4,32/3,12]:[0,4,20/3,8,12,44/3];
      for(const step of hats)if(!(answer&&step===hats.at(-1)))add('drums','hat_closed',base+step,42,.4,([4,12].includes(step)?.05:.032)*phrase);
      if(answer)add('drums','snare',base+44/3,38,.4,.025*phrase);
      if(density===4&&bar===3)add('drums','perc',base+15,45,.35,.025*phrase);
    }
    if(doc.auto_harmony_stabs)continue;
    const pitches=western?[...triads[bar],extensions[bar]].sort((a,b)=>a-b):triads[bar];
    const inversion=color%pitches.length;
    const chord=pitches.map((_,i)=>48+root+pitches[(i+inversion)%pitches.length]+(i+inversion>=pitches.length?12:0)+(color===4?12:0));
    if(western){
      for(const step of [0,4,8,12])for(const pitch of chord)add('harmony','sampled_guitar_v1',base+step,pitch,space?.75:1.2,.26*phrase);
      if(odd&&!space&&density>=3){
        const replies=bar===1?[8,32/3]:density===4?[4,20/3,14]:[4,20/3];
        for(const [i,step] of replies.entries())add('harmony',keys,base+step,fold(chord[answer?2-i%2:i%2]+12,60,83),i? .7:1,.26*phrase);
      }
    }else{
      const piano=odd?(space?[]:[12]):density<2?[0]:[0,20/3];
      const guitar=odd?(space||density<2?[4]:[4,28/3]):density<3?[12]:[12,44/3];
      for(const step of piano)for(const pitch of [chord[0],chord[1]])add('harmony',keys,base+step,pitch,odd?1.6:1.2,.28*phrase);
      for(const [i,step] of guitar.entries())for(const pitch of [chord[answer?i:0],chord[2]])add('harmony','sampled_guitar_v1',base+step,pitch,.7,.25*phrase);
    }
  }
  return finish();
}

// Independent low/high guitar arrangement; not a physical finger/string model.
function piedmontBacking(doc,session,preserved,motif){
  const id=session.scene_id,root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const third=minor?3:4,sixth=minor?8:9,roots=[0,sixth,5,7];
  const triads=[[0,third,7],[0,third,sixth],[0,5,sixth],[2,7,minor?10:11]];
  const density=session.density??1,color=session.color??1;
  const contour=[[0,1,2,1],[1,2,0,2],[2,1,0,1],[0,2,1,2],[2,0,1,0]][color];
  const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
  for(let bar=0;bar<4;bar++){
    const base=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd;
    const answer=session.scene_variant==='answer'&&bar===3,phrase=[.92,1,.96,1.04][bar];
    for(let i=0;i<4;i++)add('bass','sampled_guitar_v1',base+i*4,fold(48+root+roots[bar]+(i%2?7:0),40,55),i%2?1.8:2.25,(i%2?.34:.4)*phrase);
    if(doc.auto_harmony_stabs)continue;
    const steps=odd?[2,5,10,15]:[2,6,9,14];
    if(density===4&&bar===3)steps[3]=44/3;
    for(let i=0;i<4;i++){
      if((density===0&&![0,2].includes(i))||(density===1&&i===1)||(space&&i!==0))continue;
      const tone=contour[answer?3-i:i],pitch=fold(60+root+triads[bar][tone],60,76);
      add('harmony','sampled_guitar_v1',base+steps[i],pitch,[.8,1.2,1.8,.6][i],(i===0?.38:.29)*phrase);
      if(density>=3&&i===0)add('harmony','sampled_guitar_v1',base+steps[i],fold(60+root+triads[bar][(tone+1)%3],60,76),.8,.23*phrase);
    }
  }
  return finish();
}
