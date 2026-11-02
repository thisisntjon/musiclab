// Original instrumental studies. No performance or recorded tune is input here.
export function rootsStudyHarmony(id,minor=false) {
 const t=minor?3:4,s=minor?8:9;
 if(id==='delta-blues-v1')return {version:1,bars:[[0,t,7],[0,t,7],[5,s,0],[7,minor?10:11,2]],ending:7};
 if(id==='progressive-bluegrass-v1')return {version:1,bars:[[0,t,7,minor?10:s],[0,t,s,7],[0,5,s,2],[2,7,minor?10:11,5]],ending:7};
 return {version:1,bars:[[0,t,7],[0,t,s],[0,5,s],[2,7,minor?10:11]],ending:7};
}
export function rootsStudyCells(id,harmony,openingId=0,minor=false) {
 const cells=[],at=(bar,step,interval,gate,resolvesApproach=false)=>cells.push({position:bar*16+step,interval,gate,resolvesApproach});
 const openings=[[2,6],[1,6],[2,7],[0,6],[3,7],[6],[1,5],[3,6]];
 for(let bar=0;bar<4;bar++){
  const tones=harmony.bars[bar],odd=bar%2===1;
  if(id==='progressive-bluegrass-v1'){
   const patterns=[[0,2,4,6,8,10,12,14],[0,2,4,9,12,14],[2,4,6,10,12,14],[0,4,10,14]];
   let times=[...patterns[bar]];
   // Eight recognizable roll entries; keep an intact late roll/answer.
   if(bar===0)times=[...openings[openingId],8,10,12,14];
   if(openingId===5&&odd)times=[times[0],times.at(-1)];
   for(const [i,step] of times.entries())at(bar,step,tones[(i+openingId)%tones.length],bar===3?(i===1?2:1):.85);
  }else if(id==='delta-blues-v1'){
   if(odd){for(const [i,step] of (openingId===5?[14]:[10,14]).entries())at(bar,step,tones[(i+openingId)%3],step===14?2:1);}
   else {
    for(const [i,step] of openings[openingId].entries())at(bar,step,bar===0&&!minor&&i===1?3:tones[(openingId+i)%3],.8);
    // Explicit fretted minor-third approach resolves to the major third.
    if(!minor&&bar===0&&openings[openingId].length>1)at(bar,openings[openingId].at(-1)+1,4,1.2,true);
   }
  }else{
   const times=odd?(openingId===5?[14]:[10,14]):openings[openingId];
   for(const [i,step] of times.entries())at(bar,step,tones[(openingId+i)%3],odd?1.5:1);
  }
 }
 cells.at(-1).interval=harmony.ending;return cells;
}

// Keep the deliberately fretted approach adjacent when Ab crosses B5/C6.
// Only the authored resolution may extend one semitone above the usual register.
export function rootsStudyPitch(id,root,cell){
 const pitch=(id==='delta-blues-v1'?72:60)+(root+cell.interval)%12;
 return pitch+(id==='delta-blues-v1'&&cell.resolvesApproach&&root===8?12:0);
}
