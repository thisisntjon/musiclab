import {compileReturnSong} from './returning_part.js';
import {ensureSectionIds, extractSongMaterial, MAX_SONG_CARDS} from '../js/theory/song_view.js';

/** Three understandable chapters; long captured takes remain intact inside the first. */
export function starterSong(doc, selected = 0) {
  const before = structuredClone(doc), after = structuredClone(doc);
  const cards = ensureSectionIds(after.song_cards);
  if (!cards[selected] || cards.length + 2 > MAX_SONG_CARDS) return null;
  const source = cards[selected];
  const length=source.bars*(doc.global_context?.steps_per_bar || 16);
  if((source.material?.notes || doc.notes).some(n=>{const start=n.step+(n.performance?.offset_steps || 0);return start<length&&start+n.duration_steps>length&&!(n.performance?.version===1&&Number.isFinite(n.duration_steps)&&n.duration_steps>0&&n.duration_steps<=64);} ))return null;
  const copy = name => {
    const card = {...structuredClone(source), role_name:name,
      material:extractSongMaterial(source.material || after), big:false, fx:null, preserve_performed_holds:true};
    delete card.section_id;
    delete card.capture_segment;
    return card;
  };
  const middle = copy('Big moment'), ending = copy('Ending');
  // A proposed quieter band, not an automatic correction of personal notes.
  ending.material.notes = ending.material.notes.map(n =>
    ['user_placed','hummed_confirmed'].includes(n.provenance) || n.role === 'lead' ? n :
      {...n, velocity:Number(n.velocity ?? .85) * .55});
  // The former last part must retain the same performed release after appending.
  const extendedCards=cards.map((card,i)=>i===cards.length-1&&!card.capture_segment?{...card,preserve_performed_holds:true}:card);
  after.song_cards = ensureSectionIds([...extendedCards, middle, ending]);
  // Never shorten a held original merely because it is no longer the final part.
  const original=compileReturnSong({...before,song_cards:cards});
  const candidate=compileReturnSong(after);
  if(JSON.stringify(original.events)!==JSON.stringify(candidate.events.filter(e=>e.card<cards.length)))return null;
  after.song_path = {version:1, step:'shape', groups:[
    {kind:'start', label:'Start', sections:cards.map(c=>c.section_id)},
    {kind:'big', label:'Big moment', sections:[after.song_cards[cards.length].section_id]},
    {kind:'ending', label:'Ending', sections:[after.song_cards[cards.length+1].section_id]},
  ]};
  return {kind:'starter', before, after, index:selected, afterIndex:cards.length, changed:true};
}

export function starterGroups(doc) {
  const groups = doc.song_path?.version === 1 ? doc.song_path.groups : null;
  if (!Array.isArray(groups) || groups.length < 1 || groups.length > MAX_SONG_CARDS || !Array.isArray(doc.song_cards)
    || groups.some(g=>!g || typeof g.label!=='string' || !Array.isArray(g.sections) || !g.sections.length)) return null;
  const ids = doc.song_cards.map(c=>c.section_id);
  if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)return null;
  const flat = groups.flatMap(g=>g.sections || []);
  if (flat.length !== ids.length || flat.some((id,i)=>id !== ids[i])) return null;
  return groups.map(g=>({...g, indices:g.sections.map(id=>ids.indexOf(id))}));
}


/** Keep chapter identity independent of its position, including older saves. */
export function chapterKind(group) {
  return group?.kind || ({Start:'start','Big moment':'big',Ending:'ending'})[group?.label];
}

// Freeze only context that would change when a chapter moves or disappears.
function retainBreaths(before,after) {
  for(const card of after.song_cards){
    const i=before.song_cards.findIndex(c=>c.section_id===card.section_id);
    if(i<0)continue;
    const source=before.song_cards[i],j=after.song_cards.indexOf(card);
    const old=typeof source.pre_big_breath==='boolean'?source.pre_big_breath:Boolean(before.song_cards[i+1]?.big);
    const next=typeof card.pre_big_breath==='boolean'?card.pre_big_breath:Boolean(after.song_cards[j+1]?.big);
    if(old!==next)card.pre_big_breath=old;
  }
}

/** Reorder whole chapters only if each section still plays the same local events. */
export function moveStarterChapter(doc,sectionId,direction) {
  const groups=starterGroups(doc),before=structuredClone(doc);
  const decline=reason=>({changed:false,doc:before,reason});
  if(!groups||!['earlier','later'].includes(direction))return decline('Choose a part to move.');
  const index=groups.findIndex(g=>g.sections.includes(sectionId)),target=index+(direction==='earlier'?-1:1);
  if(index<0||target<0||target>=groups.length)return decline('This part is at the edge.');
  const order=groups.slice();[order[index],order[target]]=[order[target],order[index]];
  const after=structuredClone(doc),cards=new Map(after.song_cards.map(c=>[c.section_id,c]));
  after.song_cards=order.flatMap(g=>g.sections.map(id=>cards.get(id)));
  after.song_path.groups=order.map(({indices,...group})=>({...group,kind:chapterKind(group)}));
  retainBreaths(doc,after);
  if(!chapterEventsMatch(doc,after))return decline('This move would change a sound. Your song stays.');
  return {changed:true,doc:after,selectedIndex:after.song_cards.findIndex(c=>c.section_id===sectionId)};
}

function chapterEventsMatch(doc,after,pairs=after.song_cards.filter(c=>doc.song_cards.some(n=>n.section_id===c.section_id)).map(c=>[c.section_id,c.section_id])) {
  const a=compileReturnSong(doc),b=compileReturnSong(after),spb=a.steps_per_bar||16;
  const local=(song,d,id)=>{
    const i=d.song_cards.findIndex(c=>c.section_id===id),offset=d.song_cards.slice(0,i).reduce((v,c)=>v+c.bars*spb,0);
    return song.events.filter(e=>e.card===i).map(e=>{const n=structuredClone(e);delete n.card;delete n.section_id;
      const card=d.song_cards[i],rawIds=new Set((card.material?.notes||d.notes||[]).map(note=>note.id));
      if(n.generated_by==='song_card_lift'&&n.provenance==='generator_default'&&!rawIds.has(n.id)&&n.id.endsWith('-lift-c'+i))n.id=n.id.slice(0,-('-lift-c'+i).length)+'-lift';
      if(card.tune_variant==='lift'&&n.role==='lead'&&n.id.endsWith('-variation-c'+i))n.id=n.id.slice(0,-('-variation-c'+i).length)+'-variation';
      if(card.fx==='drum_roll'&&n.provenance==='generator_default'&&!rawIds.has(n.id)&&new RegExp('^fx-roll-c'+i+'-s\\d+$').test(n.id))n.id=n.id.replace(/^fx-roll-c\d+-/,'fx-roll-');
      n.step=Number((n.step-offset).toFixed(9));n.start_sec-=offset*15/song.bpm;return n;});
  };
  for(const [sourceId,targetId] of pairs){
    const x=local(a,doc,sourceId),y=local(b,after,targetId);
    if(x.length!==y.length||x.some((n,i)=>{const {start_sec:t,...rest}=n,{start_sec:u,...other}=y[i];return Math.abs(t-u)>.000100001||JSON.stringify(rest)!==JSON.stringify(other);}))return false;
  }
  return true;
}

/** +/- changes a whole chapter; no implicit edits to the retained music. */
export function changeStarterChapter(doc,sectionId,action) {
  const groups=starterGroups(doc),before=structuredClone(doc);
  const decline=reason=>({changed:false,doc:before,reason});
  const index=groups?.findIndex(g=>g.sections.includes(sectionId));
  if(!groups||index<0||!['copy','remove'].includes(action))return decline('Choose a part.');
  const group=groups[index],after=structuredClone(doc);
  const order=groups.map(({indices,...g})=>({...g,kind:chapterKind(g)}));
  let selectedId;
  if(action==='remove'){
    if(groups.length<=1)return decline('Keep one part in your song.');
    after.song_cards=after.song_cards.filter(c=>!group.sections.includes(c.section_id));
    order.splice(index,1);selectedId=order[Math.min(index,order.length-1)].sections[0];
  }else{
    if(doc.song_cards.length+group.sections.length>MAX_SONG_CARDS)return decline('This copy needs more space. Your song stays.');
    const originals=doc.song_cards.filter(c=>group.sections.includes(c.section_id));
    const copies=originals.map(c=>{const copy={...structuredClone(c),material:extractSongMaterial(c.material||doc)};const i=doc.song_cards.indexOf(c);copy.pre_big_breath=typeof c.pre_big_breath==='boolean'?c.pre_big_breath:Boolean(doc.song_cards[i+1]?.big);delete copy.section_id;return copy;});
    const named=ensureSectionIds([...after.song_cards,...copies]).slice(after.song_cards.length);
    const at=group.indices.at(-1)+1;after.song_cards.splice(at,0,...named);
    order.splice(index+1,0,{kind:'extra',label:'New part',sections:named.map(c=>c.section_id)});selectedId=named[0].section_id;
    retainBreaths(doc,after);
    if(!chapterEventsMatch(doc,after,originals.map((c,i)=>[c.section_id,named[i].section_id])))return decline('This copy would change a sound. Your song stays.');
  }
  after.song_path.groups=order;
  retainBreaths(doc,after);
  if(!chapterEventsMatch(doc,after))return decline('This change would alter a sound. Your song stays.');
  return {changed:true,doc:after,selectedIndex:after.song_cards.findIndex(c=>c.section_id===selectedId)};
}
