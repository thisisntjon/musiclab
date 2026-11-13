/** Explicit, versioned generated-band velocity treatment; never changes personal notes. */
export const SOFT_BAND_FACTOR=.45;
const eligible=n=>n.provenance==='jam_generated'&&['bass','harmony','hocket','drums'].includes(n.role);
export function balanceBasis(events,saved=null){
  return Object.fromEntries(events.filter(n=>eligible(n)&&Number.isFinite(n.velocity)).map(n=>[n.id,
    Number.isFinite(saved?.[n.id])?Math.max(0,Math.min(1,saved[n.id])):Number.isFinite(n.velocity)?n.velocity:.85]));
}
export function balancedEvents(events,basis,soft){
  return events.map(n=>{
    const note=structuredClone(n);
    if(eligible(n)&&Number.isFinite(n.velocity)&&Number.isFinite(basis[n.id]))note.velocity=basis[n.id]*(soft?SOFT_BAND_FACTOR:1);
    return note;
  });
}
