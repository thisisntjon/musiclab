import {OUTLAW_STUDY_LEVEL,PROGRESSIVE_STUDY_LEVEL,DELTA_STUDY_LEVEL} from './scene_voice_levels.js';
import {createSceneWriter} from './scene_writer.js';
import {rootsStudyHarmony,rootsStudyCells,rootsStudyPitch} from './roots_study_phrases.js';
export const ROOTS_STUDY_IDS=['outlaw-country-v1','progressive-bluegrass-v1','delta-blues-v1'];
export function rootsStudyBacking(doc,session,preserved){
 if(!ROOTS_STUDY_IDS.includes(session.scene_id))throw Error('Unsupported roots study.');
 const id=session.scene_id,progressive=id==='progressive-bluegrass-v1',delta=id==='delta-blues-v1';
 const root=doc.global_context?.root_pc||0,minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
 const harmony=rootsStudyHarmony(id,minor),roots=delta?[0,0,5,7]:[0,minor?8:9,5,7];
 const density=session.density??1,color=session.color??1;
 const foldLow=p=>{while(p>55)p-=12;while(p<40)p+=12;return p;};
 const opening=session.scene_variant==='space'?5:session.scene_variant==='answer'?1:0;
 const leadCells=rootsStudyCells(id,harmony,opening,minor);
 const {add,finish}=createSceneWriter(id,doc,session,preserved);
 for(let bar=0;bar<4;bar++){
  const at=bar*16,odd=bar%2===1,space=session.scene_variant==='space'&&odd,tones=harmony.bars[bar];
  const low=foldLow(48+(root+roots[bar])%12);
  if(delta){
   for(const [i,step] of (odd?[0,8]:[0,6,10]).entries())add('bass','sampled_guitar_v1',at+step,low,[1.8,.8,1.2][i],.36);
  }else for(const [i,step] of [0,8].entries()){
   add('bass',progressive?'sampled_bass_v1':'sampled_guitar_v1',at+step,
     progressive?36+(root+roots[bar]+i*7)%12:foldLow(low+i*7),i?2:2.5,.35);
  }
  if(!delta&&!progressive){
   for(const step of [0,8])add('drums','kick',at+step,36,.6,.07);
   for(const step of [4,12])add('drums','snare',at+step,38,.5,.06);
   if(density>0)for(const step of [2,6,10,14])add('drums','hat_closed',at+step,42,.3,.025);
  }
  if(doc.auto_harmony_stabs)continue;
  // Keep the roll foreground: one voiced guitar punctuation per progressive bar.
  let strums=progressive?[odd?9:4]:delta?(odd?[0]:[0,8]):[4,12];
  const voiceCount=progressive&&density===0?1:2;
  for(const step of strums)for(let i=0;i<voiceCount;i++){
   const choices=progressive&&odd?(bar===1?[minor?3:4,7]:[minor?10:11,5]):tones;
   const interval=choices[(color===4?1-i:color===3?choices.length-1-i:(i+color)%choices.length)],pitch=60+(root+interval)%12;
   const position=at+step+i*(delta?.1:.08);
   // Delta lead is in72-83, separate from these60-71 strums.
   add('harmony','sampled_guitar_v1',position,pitch,
     ((space?.35:.55)+density*.05)*(progressive&&color===4?.5:1),progressive?.22:delta?.3:.26);
  }
  if(progressive&&density>=2&&bar<(density-1))add('harmony','sampled_guitar_v1',at+15,
    60+(root+tones[color%tones.length])%12,.2,.16);
  if(!progressive&&!space){
   const extra=[];
   if(density>=2&&odd)extra.push(14);
   if(density>=3&&bar===3)extra.push(15);
   if(density===4&&!odd)extra.push(6);
   for(const step of extra)add('harmony','sampled_guitar_v1',at+step,60+(root+tones[color%tones.length])%12,.2,.16);
  }

 }
 for(const cell of leadCells)add('lead',progressive?'sampled_banjo_v1':delta?'sampled_guitar_v1':'sampled_clean_guitar_v1',cell.position,
  rootsStudyPitch(id,root,cell),cell.gate,progressive?.38:.42);
 const level=id==='outlaw-country-v1'?OUTLAW_STUDY_LEVEL:progressive?PROGRESSIVE_STUDY_LEVEL:DELTA_STUDY_LEVEL;
 return finish().map(note=>note.patch_id.startsWith('sampled_')?{...note,velocity:note.velocity*level}:note);
}
