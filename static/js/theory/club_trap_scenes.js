import {createSceneWriter} from './scene_writer.js';
import {sceneHarmonyLevel,NATIVE_SCENE_BASS_LEVEL} from './scene_voice_levels.js';

export const CLUB_TRAP_IDS=Object.freeze(['jersey-club-v1','trap-v1']);
export const JERSEY_KICKS=Object.freeze([0,4,8,11,14]);
const fold=(p,low,high)=>{while(p<low)p+=12;while(p>high)p-=12;return p;};

export function clubTrapBacking(doc,session,preserved,motif){
 const id=session.scene_id,trap=id==='trap-v1';
 if(!CLUB_TRAP_IDS.includes(id))throw Error('Unsupported club recipe.');
 const root=((Number(doc.global_context?.root_pc)||0)%12+12)%12;
 const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
 const third=minor?3:4,roots=[0,minor?8:9,5,7];
 const dyads=minor?[[60,67],[60,63],[65,72],[58,62]]:[[60,67],[60,64],[65,72],[59,62]];
 const density=session.density??1,color=session.color??1;
 const patch=['sampled_electric_piano_v1','sampled_piano_v1','sampled_guitar_v1','sampled_electric_piano_v1','warm_keys'][color];
 const level=sceneHarmonyLevel(patch);
 const {add,finish}=createSceneWriter(id,doc,session,preserved,motif.map(n=>({...n,id:`${id}-motif-${n.id}`})));
 for(let bar=0;bar<4;bar++){
  const base=bar*16,odd=bar%2===1,last=bar===3;
  const space=session.scene_variant==='space'&&odd,answer=session.scene_variant==='answer'&&last;
  const phrase=[.92,1,.96,1.04][bar],localThird=bar===1?(minor?4:3):third;
  const kick=trap?(odd?[0,7.5,14]:[0,6,11]):JERSEY_KICKS;
  for(const [i,step] of kick.entries())add('drums','kick',base+step,36,.65,.14*phrase*(trap?1:[1,.85,1,.8,.9][i]));
  for(const step of trap?[8]:odd?[4,12]:[4,11])add('drums','snare',base+step,38,.65,.12*phrase);
  let hats=trap?(density===0?[0,4,8,12]:[0,2,4,6,8,10,12,14]):density>0?[2,6,10,13]:[];
  if(space)hats=trap?(density===0?[0,8]:[0,4,8,12]):hats.filter(s=>s===2||s===10);
  // Rolls replace the final straight hat; no duplicate attack at14.
  if(trap&&odd&&density>=2){
   hats=hats.filter(s=>s!==14);
   hats.push(...(last&&density===4?[14,14.5,15,15.5]:[14,44/3,46/3]));
  }
  for(const step of hats){
   const roll=trap&&odd&&density>=2&&step>=14;
   const accent=roll?(step===14?1:step<15?.7:.5):step%4===0?1:.7;
   add('drums','hat_closed',base+step,42,roll?.25:.3,.035*accent*phrase*(space?.65:1));
  }
  if(odd&&density>=(trap?3:2))add('drums','perc',base+(trap?5:7),60,.4,.022*phrase*(space?.5:1));
  if(!trap&&last&&(density>=3||answer))add('drums','snare',base+(answer?14.5:15),38,.25,(density>=3?.025:.012)*phrase*(space?.5:1));
  const bass=trap?(odd?[[0,0,6],[7.5,0,4],[14,answer?localThird:7,1.5]]:[[0,0,5],[6,7,3],[11,0,4]]):
   odd?[[4,0,1.5],[11,localThird,1],[14,0,1]]:[[0,0,1.5],[8,0,1.5],[14,7,1]];
  for(const [step,pitch,gate] of bass)add('bass','clean_bass',base+step,fold(36+root+roots[bar]+pitch,36,55),gate,NATIVE_SCENE_BASS_LEVEL*phrase);
  if(doc.auto_harmony_stabs)continue;
  const voiced=dyads[bar].map(p=>fold(p+root+(color===3?12:0),48,84)).sort((a,b)=>a-b);
  const times=trap?[odd?4:0]:space?[9]:odd?[9,13]:[2,6];
  for(const step of times)for(const [i,pitch] of voiced.entries()){
   const changed=answer&&!trap&&step===13&&i===0?(pitch+12<=88?pitch+12:pitch-12):pitch;
   add('harmony',patch,base+step,changed,trap?(space?1.5:3):space?.35:.5,level*phrase);
  }
  if(last&&(trap||density===4)){
   const pitch=60+root+roots[bar]+(answer?(trap?7:localThird):(trap?localThird:7));
   if(!trap||!space)add('harmony',patch,base+(trap?12:15),pitch,trap?1:space?.2:.4,level*.65*phrase);
  }
 }
 return finish();
}
