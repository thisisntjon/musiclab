import {createSceneWriter} from './scene_writer.js';

import {responseHarmony} from './phrase_harmony.js';

// Original four-bar instrumental study: low piano calls, upper answers,
// dominant-to-tonic arrival, then room. Not vocals or a worship simulation.
export function pianoResponseBacking(doc,session,preserved) {
  const root=doc.global_context?.root_pc||0;
  const minor=/minor|dorian|phrygian/.test(doc.global_context?.scale_type||'');
  const harmony=responseHarmony(minor),roots=[0,5,7,0];
  const density=session.density??1,color=session.color??1;
  const {add,finish}=createSceneWriter('gospel-piano-v1',doc,session,preserved);
  for(let bar=0;bar<4;bar++) {
    const at=bar*16,tones=harmony.bars[bar],ending=bar===3;
    const space=session.scene_variant==='space'&&bar%2===1;
    const level=[.9,.95,1.05,.85][bar];
    add('drums','kick',at,36,1,.13*level);
    if(!ending&&!space&&density>0)add('drums','kick',at+8,36,1,.095*level);
    for(const step of ending?[4]:[4,12])add('drums','snare',at+step,38,1,.11*level);
    if(!ending)for(const step of density<2?[2,10]:[2,6,10,14])add('drums','hat_closed',at+step,42,.5,.045*level);
    add('bass','sampled_bass_v1',at,36+root+roots[bar],ending?10:5,.38*level);
    if(!ending&&!space)add('bass','sampled_bass_v1',at+8,36+root+roots[bar]+7,3,.29*level);
    if(!doc.auto_harmony_stabs) {
      // Calls end before the upper responses; articulation remains explicit.
      const calls=ending?[0]:density>=3&&!space?[0,4]:[0];
      for(const step of calls)for(let voice=0;voice<3;voice++) {
        const ordered=tones.map(n=>(root+n)%12).sort((a,b)=>a-b);
        const index=(voice+color%3)%3;
        add('harmony','sampled_piano_v1',at+step,48+ordered[index]+(index<color%3?12:0),ending?6:color>=3?3.5:2.5,.3*level);
      }
      const answers=ending?[8]:space?[10]:density===0?[10]:density>=4?[8,10,13]:[8,12];
      for(const [i,step] of answers.entries()) {
        const answer=session.scene_variant==='answer'?2-i%2:1+i%2;
        for(const interval of ending?[0]:[tones[answer],tones[0]+12])
          add('harmony','sampled_piano_v1',at+step,72+(root+interval)%12,ending?4:1+color*.15,.24*level);
      }
    }
    // A spare initial lead already agrees with the destination progression.
    const melody=ending?[[4,7,2],[12,0,3]]:[[6,tones[1],2],[14,tones[2],1]];
    for(const [step,interval,gate] of melody)add('lead','sampled_piano_v1',at+step,60+root+interval,gate,.5*level);
  }
  // Matched production renders against soul/early R&B: retain the phrase's
  // final space while reducing the entry level gap from 4.60 to 2.33 dB.
  // This recipe owns only generated material, never personal velocities.
  return finish().map(note=>({...note,velocity:note.velocity*1.25}));
}
