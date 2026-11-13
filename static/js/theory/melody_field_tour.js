import {melodyFieldPosition} from './melody_field.js';

/** Optional, visible exploration of the SAME field; never reseeds or rewrites it. */
export function melodyFieldTourPosition({startPosition,startTime,now,bpm,stepsPerBar=16,mode='orbit'}) {
  if(!Number.isFinite(startTime)||!Number.isFinite(now)||!Number.isFinite(bpm)||bpm<=0
    ||!Number.isInteger(stepsPerBar)||stepsPerBar<=0)throw new RangeError('Invalid melody exploration clock.');
  const source=melodyFieldPosition(startPosition);
  const elapsed=Math.max(0,now-startTime),bar=stepsPerBar*15/bpm;
  const startRadius=Math.hypot(source.x,source.y),angle=Math.atan2(source.x,source.y);
  if(mode==='dynamic') {
    const bars=elapsed/bar;
    const smooth=t=>{const c=Math.max(0,Math.min(1,t));return c*c*(3-2*c);};
    const rings=[.64,.92,.24,.96,.54,.88,.34,.94];
    const polarAt=k=>k<0?{r:startRadius,theta:angle}:{r:rings[k%rings.length],theta:angle+(k+1)*(Math.PI*7/12)};
    if(bars<1.5) {
      const a=smooth(bars/1.5),dest=polarAt(0);
      const dx=Math.sin(dest.theta)*dest.r,dy=Math.cos(dest.theta)*dest.r;
      return melodyFieldPosition({x:source.x+(dx-source.x)*a,y:source.y+(dy-source.y)*a});
    }
    const shifted=bars-1.5,chapter=Math.floor(shifted/4),phase=(shifted%4)/4;
    const cur=polarAt(chapter),next=polarAt(chapter+1),glide=smooth((phase-.72)/.28);
    const r=cur.r+(next.r-cur.r)*glide,theta=cur.theta+(next.theta-cur.theta)*glide;
    return melodyFieldPosition({x:Math.sin(theta)*r,y:Math.cos(theta)*r});
  }
  // Approach a useful outer neighbourhood gently, then travel one region per
  // four bars. This is an editorial exploration policy, not a preference model.
  const ease=Math.min(1,elapsed/(2*bar));
  const radius=startRadius+(.72-startRadius)*ease*ease*(3-2*ease);
  const theta=angle+elapsed/(4*bar)*Math.PI/3;
  return melodyFieldPosition({x:Math.sin(theta)*radius,y:Math.cos(theta)*radius});
}
