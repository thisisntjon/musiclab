/** Wander through explicitly compatible arrangements without a fixed
 * playlist. Recent directions are avoided; catalogue order is not similarity.
 * This is explicit exploration, not inference about the listener's taste.
 */
export const EXPLORATION_DWELL_SECONDS=20;
export function nextExplorationStyle(current,recent=[],random=Math.random,available=[0,1,2,3],favorites=[]) {
  const at=Math.round(Number(current)||0);
  const last=recent.slice(-2);
  let options=available.filter(index=>index!==at&&index!==last.at(-1));
  if(!options.length)options=available.filter(index=>index!==at);
  if(!options.length)return at;
  const weights=options.map(index=>(index===last[0] ? .35 : 1)*(favorites.includes(index)?3:1));
  let choice=Math.max(0,Math.min(.999999,Number(random())||0))*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<options.length;i++){choice-=weights[i];if(choice<0)return options[i];}
  return options.at(-1);
}

/** Reach an unvisited direction through existing edges. Backtrack deliberately
 * out of exhausted branches instead of randomly bouncing inside them.
 * Memory is session coverage, not an inferred musical preference.
 */
export function nextUnvisitedStyle(current,visited,neighbors,random=Math.random,favorites=[]) {
  const seen=new Set([...visited,current]);
  const queue=[{node:current,first:null}],searched=new Set([current]);
  for(let head=0;head<queue.length;) {
    const end=queue.length,candidates=[];
    for(;head<end;head++) {
      const {node,first}=queue[head];
      for(const next of neighbors(node)) {
        if(searched.has(next))continue;
        searched.add(next);
        const entry={node:next,first:first??next};
        if(!seen.has(next))candidates.push(entry.first);
        queue.push(entry);
      }
    }
    if(candidates.length)return nextExplorationStyle(current,[],random,[...new Set(candidates)],favorites);
  }
  return nextExplorationStyle(current,[],random,neighbors(current),favorites);
}
