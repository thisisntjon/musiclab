// A kept Bass wheel line is the band's bass until the next Jam direction change, then the band's own bass returns
// (bass wheel attack fix 3). Never two bass lines, never a kept line pinned over a new band, personal notes untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setJamDirection,contributeJam,startJam,isBandOwnedNote} from '../../../static/js/theory/jam_session.js';
import {isReplaceableNote} from '../../../static/js/theory/section_direction.js';
import {selectedMelody} from '../../../static/js/theory/selected_melody.js';
import {SCENE_CATALOGUE_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {bassContext,bassCandidateEvents,bassAdmission,bassWheelRecord,BASS_WHEEL_GENERATOR} from '../../../static/js/theory/bass_wheel.js';
import {HAND_SWING} from '../../../static/js/theory/band_hand.js';
import {anchorBand} from '../../../static/js/theory/band_anchor.js';
import {compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {parseProjectJson,exportProjectJson} from '../../../static/js/theory/save_store.js';
import {jamScore,scoreOf,SCENES} from './bass-wheel-fixtures.mjs';

const WHEEL=BASS_WHEEL_GENERATOR;
const onset=n=>n.step+(n.performance?.version===1?n.performance.offset_steps||0:0);
const wheel=doc=>doc.notes.filter(n=>n.generated_by===WHEEL);
const bandBass=doc=>doc.notes.filter(n=>n.role==='bass'&&n.generated_by==='musiclab_jam');
const personal=doc=>doc.notes.filter(n=>n.provenance==='user_placed');
const OWN_LEAD={id:'jam-user-sampled_piano_v1-5',step:5,duration_steps:2,velocity:.7,role:'lead',patch_id:'sampled_piano_v1',
  pitch_lock_mode:'concrete',concrete:{midi_pitch:64},provenance:'user_placed'};

/** Keep a Funky Full bass from the wheel through the real selectedMelody save, as Keep and Back to jam do. */
function keptBass(scene='soul-v1',move='funky-full') {
  const {doc,song,context}=jamScore(scene);
  const ctx=bassContext(context);
  assert.ok(ctx,'admitted');
  const events=bassCandidateEvents(ctx,move,song.events);
  const kept=selectedMelody(doc,{...song,events},{context:{...context,source:undefined},choice:{position:{x:0,y:0},requestId:'test'}});
  kept.notes.push(structuredClone(OWN_LEAD));
  return {kept,ctx,doc};
}
const noDoubleBass=doc=>{
  const bass=doc.notes.filter(n=>n.role==='bass');
  assert.equal(new Set(bass.map(n=>onset(n).toFixed(4))).size,bass.length,'two bass notes on one onset');
  assert.ok(!(wheel(doc).length&&bandBass(doc).length),'never the kept line and the band bass together');
};

for(const move of ['funky-full','chill-light','deep-light'])test(`a kept ${move} bass plays as the band bass: calls that do not change direction keep it and hold the band bass back`,()=>{
  const {kept}=keptBass('soul-v1',move);
  const line=wheel(kept);
  assert.ok(line.length>=8);assert.equal(bandBass(kept).length,0);
  // A finished hold or Stay re-apply (no arguments), the Answer toggle, and a pad press.
  for(const next of [setJamDirection(kept),setJamDirection(kept,{responsive:false}),setJamDirection(kept,{responsive:true}),contributeJam(kept,{pad:1,step:3})]) {
    assert.deepEqual(wheel(next),line);
    assert.equal(bandBass(next).length,0,'the band writes no bass in the gaps');
    assert.deepEqual(personal(next).filter(n=>n.id===OWN_LEAD.id),[OWN_LEAD]);
    noDoubleBass(next);
  }
});

test('the next Jam direction change gives the kept bass way to the band own bass',()=>{
  const {kept,doc}=keptBass();
  const changes=[{density:3},{color:3},{scene_variant:'space'},{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'house-v1'},
    {scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'soul-v1',density:2}];
  for(const change of changes) {
    const next=setJamDirection(kept,change);
    assert.equal(wheel(next).length,0,JSON.stringify(change));
    assert.ok(bandBass(next).length>0,'the band bass returns');
    assert.deepEqual(personal(next),personal(kept),'personal notes untouched');
    noDoubleBass(next);
  }
  // Same band, back to its own bass exactly: the soul band's bass (with its answer to the personal note).
  const back=setJamDirection(setJamDirection(kept,{density:2}),{density:1});
  const reference=structuredClone(doc);reference.notes.push(structuredClone(OWN_LEAD));
  // (Its answer's exact gap depends on the saved notes' performed timing, so compare the scene's own notes.)
  const music=d=>bandBass(d).filter(n=>!n.response_to).map(n=>[n.id,onset(n),n.duration_steps,n.concrete.midi_pitch]);
  assert.deepEqual(music(back),music(setJamDirection(reference,{density:1})));
  assert.equal(bandBass(back).filter(n=>n.response_to).length,1);
});

test('a captured kept bass stays like captured band notes, and holds the band bass back',()=>{
  const {kept}=keptBass();
  const take=structuredClone(kept);
  take.notes.forEach((n,i)=>{if(n.generated_by===WHEEL)n.capture_occurrence=i;});
  const changed=setJamDirection(take,{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'house-v1'});
  assert.deepEqual(wheel(changed),wheel(take),'a performance keeps what was played');
  assert.equal(bandBass(changed).length,0,'and the new band adds no second bass');
  const replaced=setJamDirection(take,{scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:'house-v1',replace_captured_band:true});
  assert.equal(wheel(replaced).length,0);assert.ok(bandBass(replaced).length>0);
  noDoubleBass(replaced);
});

test('an edited wheel note is personal: it stays and the band plays round it',()=>{
  const {kept}=keptBass();
  const edited=structuredClone(kept),target=wheel(edited)[0];
  target.edited_from_generator=true;
  const next=setJamDirection(edited,{density:3});
  assert.deepEqual(next.notes.find(n=>n.id===target.id),target);
  assert.equal(wheel(next).filter(n=>!n.edited_from_generator).length,0);
  assert.equal(isBandOwnedNote(target),false);assert.equal(isReplaceableNote(target),false);
});

test('a new Jam session is a new band: a kept bass gives way',()=>{
  const {kept}=keptBass();
  const bare=structuredClone(kept);delete bare.jam_session;
  const started=startJam(bare,{kind:'pitched',patchId:'sampled_piano_v1'});
  assert.equal(wheel(started).length,0);
  noDoubleBass(started);
});

test('Stay over a kept bass: the anchored band keeps one bass line and the song still saves and reopens',()=>{
  const {kept}=keptBass('ska-v1','walk-big');
  const compiled=compileSongStandalone({...kept,arrangement_mode:'loop'});
  // What the audio clock's band snapshot holds: every jam_generated event, the kept line included.
  const anchored=setJamDirection(anchorBand(kept,{time:4,events:compiled.events.filter(n=>n.provenance==='jam_generated')}));
  assert.deepEqual(wheel(anchored),wheel(kept));assert.equal(bandBass(anchored).length,0);
  noDoubleBass(anchored);
  const parsed=parseProjectJson(exportProjectJson(anchored));
  assert.equal(parsed.ok,true,'a kept bass inside a Stay anchor is valid band material');
  const bad=structuredClone(anchored);bad.jam_session.anchor_backing.notes[0].generated_by='someone_else';
  assert.equal(parseProjectJson(exportProjectJson(bad)).ok,false);
  const lead=structuredClone(anchored),wheelNote=lead.jam_session.anchor_backing.notes.find(n=>n.generated_by===WHEEL);
  wheelNote.role='lead';
  assert.equal(parseProjectJson(exportProjectJson(lead)).ok,false,'only as the bass');
});

test('band ownership is one rule: section trials replace a kept wheel bass like band notes',()=>{
  const {kept}=keptBass();
  const note=wheel(kept)[0];
  assert.equal(isBandOwnedNote(note),true);assert.equal(isReplaceableNote(note),true);
  assert.equal(isReplaceableNote({...note,role:'lead'}),false,'only the bass role is a wheel line');
  assert.equal(isReplaceableNote(bandBass(setJamDirection(kept,{density:2}))[0]),true);
  assert.equal(isReplaceableNote(OWN_LEAD),false);
});

// ---- Key, scale and swing: a kept line is concrete pitches and offsets built for one key and feel ----
/** Keep a wheel line with the record the app's bassSave writes (context.bassWheel), as Keep and Back to jam do. */
function keptWithRecord(scene='soul-v1',move='deep-full',options={}) {
  const {doc,song,context}=jamScore(scene,options);
  const ctx=bassContext(context);
  assert.ok(ctx,'admitted');
  const events=bassCandidateEvents(ctx,move,song.events);
  const kept=selectedMelody(doc,{...song,events},{context:{...context,source:undefined,bassWheel:bassWheelRecord(ctx,move)},
    choice:{position:{x:0,y:0},requestId:'keep'}});
  return {kept,ctx,doc};
}
/** The band hand's offers, as play_flow _handKey applies them: global_context first, then setJamDirection(next,{}). */
function hand(doc,change) {
  const next=structuredClone(doc);
  Object.assign(next.global_context,change);
  return setJamDirection(next,{});
}
/** A real change of the PLAYED swing: humanize on again with this swing (standalone_compiler.js plays .5 while it is
 * off, which it is after every Keep, so a global_context swing alone changes nothing the band plays). */
function played(doc,swing) {
  const next=structuredClone(doc);
  next.global_context.swing=swing;next.scaffold_options={...next.scaffold_options,humanize:true};
  return setJamDirection(next,{});
}
/** What the Feel the bass card asks (play_flow _bassEntryReady): the compiled band with the doc's saved record. */
function cardReady(doc) {
  const {context}=scoreOf(doc),saved=savedRecord(doc);
  return bassAdmission({...context,...(saved?{bassWheel:saved}:{})},context.source.events);
}
const savedRecord=doc=>doc.capture_notes?.melody_field?.context?.bassWheel??doc.capture_notes?.melody_field?.bassWheel??null;
const bandMusic=d=>bandBass(d).filter(n=>!n.response_to).map(n=>[n.id,onset(n),n.duration_steps,n.concrete.midi_pitch]);

test("the band hand's 'G is home' gives a kept wheel bass way: the band bass returns in G and the Bass wheel opens again",()=>{
  // The reported reproduction: Soul in C, Keep Deep Full, then 'G is home'.
  const {kept,doc}=keptWithRecord('soul-v1','deep-full');
  assert.equal(wheel(kept).length,12);assert.equal(bandBass(kept).length,0);
  assert.equal(cardReady(kept).ok,true,'control: the card opens over the kept line in its own key');
  const home=hand(kept,{root_pc:7});
  assert.equal(wheel(home).length,0,'no C-key wheel note stays under the G chords');
  const reference=hand(doc,{root_pc:7});
  assert.deepEqual(bandMusic(home),bandMusic(reference),'the band plays its own bass in G');
  noDoubleBass(home);
  const card=cardReady(home);
  assert.equal(card.ok,true,`the Bass wheel opens again: ${card.reason}`);
  assert.equal(card.ctx.bandSource,'live');assert.equal(card.ctx.root,7);assert.equal(card.ctx.openingMove,'band');
});

test('a key, scale or swing change gives a kept line way in every admitted scene; an unchanged one keeps it',()=>{
  for(const scene of SCENES)for(const minor of [false,true]) {
    const {kept}=keptWithRecord(scene,'funky-full',{minor});
    const line=wheel(kept);
    assert.ok(line.length>0,scene);
    // No false give-way: the same key and feel, re-applied by the hand route or a pad press, keeps the line. The
    // hand's swing too: after the Keep humanize is off, so the band still plays straight (scoreOf: swing .5).
    assert.equal(scoreOf(hand(kept,{swing:HAND_SWING})).song.swing,.5,'control: the band does not swing after a Keep');
    for(const same of [hand(kept,{root_pc:0}),hand(kept,{scale_type:minor?'minor':'major'}),hand(kept,{swing:kept.global_context.swing}),
      hand(kept,{swing:HAND_SWING}),setJamDirection(kept),contributeJam(kept,{pad:1,step:3})]) {
      assert.deepEqual(wheel(same),line,`${scene}${minor?' minor':''}: kept`);
      assert.equal(bandBass(same).length,0);
    }
    const changes=[{root_pc:5},{root_pc:6},{scale_type:minor?'major':'minor'}].map(change=>[JSON.stringify(change),hand(kept,change)]);
    for(const [what,next] of [...changes,['played swing .62',played(kept,HAND_SWING)]]) {
      const label=`${scene}${minor?' minor':''} ${what}`;
      assert.equal(wheel(next).length,0,label);
      assert.ok(bandBass(next).length>0,`${label}: the band bass returns`);
      noDoubleBass(next);
      const card=cardReady(next);
      assert.equal(card.ok,true,`${label}: ${card.reason}`);
    }
  }
});

test('a scale change keeps a line whose chords stay the same; a tiny played swing change within 0.03 keeps it too',()=>{
  // The band's chords follow only major or minor (scene_catalogue.js), so minor to dorian changes nothing it plays.
  const {kept,ctx}=keptWithRecord('reggae-v1','walk-big',{minor:true});
  assert.deepEqual(wheel(hand(kept,{scale_type:'dorian'})),wheel(kept));
  // Built over a band playing .52; the Keep turned humanize off, so it now plays .5 (within .03: the same feel).
  assert.equal(ctx.swing,.52);assert.equal(kept.scaffold_options.humanize,false);
  assert.deepEqual(wheel(played(kept,ctx.swing+.02)),wheel(kept));
  assert.equal(wheel(played(kept,ctx.swing+.06)).length,0);
  // With humanize off a swing number alone plays nothing new, so the line stays.
  assert.deepEqual(wheel(hand(kept,{swing:ctx.swing+.06})),wheel(kept));
});

test('a kept line saved before notes carried their key gives way by the saved record',()=>{
  const {kept}=keptWithRecord('ska-v1','walk-full');
  const old=structuredClone(kept);
  for(const n of wheel(old))delete n.bass_wheel.built_for;
  assert.deepEqual(wheel(setJamDirection(old)),wheel(old),'same key: kept');
  assert.equal(wheel(hand(old,{root_pc:2})).length,0,'the record says it was built in C');
  const bare=structuredClone(old);delete bare.capture_notes;
  assert.deepEqual(wheel(hand(bare,{root_pc:2})),wheel(bare),'nothing says what it was built for: it stays until the next direction change');
});

test('under Stay the band is frozen as it played, kept bass included: a key change still leaves one bass line',()=>{
  const {kept}=keptWithRecord('ska-v1','walk-big');
  const compiled=compileSongStandalone({...kept,arrangement_mode:'loop'});
  const anchored=setJamDirection(anchorBand(kept,{time:4,events:compiled.events.filter(n=>n.provenance==='jam_generated')}));
  const moved=hand(anchored,{root_pc:7});
  const music=d=>wheel(d).map(n=>[n.id,Math.round(onset(n)*1e6)/1e6,n.concrete.midi_pitch]).sort((a,b)=>a[1]-b[1]);
  assert.deepEqual(music(moved),music(anchored));
  assert.equal(bandBass(moved).length,0);noDoubleBass(moved);
  noDoubleBass(hand(moved,{root_pc:7}));
});

test('a captured wheel bass stays through a key change, like captured band notes',()=>{
  const {kept}=keptWithRecord();
  const take=structuredClone(kept);
  take.notes.forEach((n,i)=>{if(n.generated_by===WHEEL)n.capture_occurrence=i;});
  assert.deepEqual(wheel(hand(take,{root_pc:7})),wheel(take));
});

// ---- The played swing: every Keep turns humanize off, and then the band plays straight whatever global_context says ----
/** A Keep of what the Jam plays now (a tune Keep): selectedMelody turns humanize off. */
function keepAsIs(doc) {
  const {song,context}=scoreOf(doc);
  return selectedMelody(doc,song,{context:{...context,source:undefined},choice:{position:{x:0,y:0},requestId:'tune'}});
}
/** A Bass wheel Keep over this doc's band, with the record bassSave writes. */
function wheelKeep(doc,move='funky-full') {
  const {song,context}=scoreOf(doc);
  const ctx=bassContext(context);
  assert.ok(ctx,'admitted');
  const events=bassCandidateEvents(ctx,move,song.events);
  return {ctx,kept:selectedMelody(doc,{...song,events},{context:{...context,source:undefined,bassWheel:bassWheelRecord(ctx,move)},
    choice:{position:{x:0,y:0},requestId:'keep'}})};
}
/** Where in its step each compiled note starts: the feel. The bass may start only where the rest of the band does, or
 * where a band note on the grid starts at the swing the band plays now (0, and swing - .5 on an odd step). */
function feel(doc) {
  const song=scoreOf(doc).song,stepSec=15/song.bpm,r3=x=>Math.round(x*1000)/1000;
  const at=events=>new Set(events.map(e=>r3(e.start_sec/stepSec-e.step)));
  const band=song.events.filter(e=>e.provenance==='jam_generated');
  return {swing:song.swing,bass:at(band.filter(e=>e.role==='bass')),rest:new Set([...at(band.filter(e=>e.role!=='bass')),0,r3(song.swing-.5)])};
}
// (Swing's lines play the band's triplet pocket at any swing number: bass_wheel.js swingFeel. The check skips it.)
const oneFeel=(doc,label)=>{if(label.startsWith('swing-v1'))return;
  const f=feel(doc);assert.ok([...f.bass].every(o=>f.rest.has(o)),`${label}: bass ${[...f.bass]} over band ${[...f.rest]}`);};

test('after a Keep the band plays straight: a kept line built then stays on a pad press, a finished hold and a swing offer',()=>{
  // The review's reproduction: 'Swing the band', any Keep, then a Bass wheel move and Keep, then Back to jam and a pad.
  for(const scene of SCENES) {
    const swung=hand(jamScore(scene).doc,{swing:HAND_SWING});
    assert.equal(feel(swung).swing,HAND_SWING,`${scene}: control, the band swings while humanize is on`);
    const tuned=keepAsIs(swung);
    assert.equal(tuned.scaffold_options.humanize,false);assert.equal(tuned.global_context.swing,HAND_SWING);
    assert.equal(feel(tuned).swing,.5,`${scene}: after a Keep the band plays straight`);
    const {kept,ctx}=wheelKeep(tuned);
    assert.equal(ctx.swing,.5,'the wheel hears the swing the band plays');
    const line=wheel(kept);
    assert.ok(line.length>0&&line.every(n=>n.bass_wheel.built_for.swing===.5),scene);
    for(const [what,next] of [['pad',contributeJam(kept,{pad:1,step:3})],['hold',setJamDirection(kept)],['Answer',setJamDirection(kept,{responsive:false})],
      ['swing offer',hand(kept,{swing:HAND_SWING})],['swing .52',hand(kept,{swing:.52})]]) {
      assert.deepEqual(wheel(next),line,`${scene} ${what}: the kept bass stays`);
      assert.equal(bandBass(next).length,0);noDoubleBass(next);oneFeel(next,`${scene} ${what}`);
    }
    // The saved record says the same: a line saved before notes carried their key reads the played swing too.
    const old=structuredClone(kept);for(const n of wheel(old))delete n.bass_wheel.built_for;
    assert.equal(savedRecord(old).band.swing,.5);
    assert.deepEqual(wheel(contributeJam(old,{pad:1,step:3})),wheel(old),`${scene}: by the record, kept`);
    // Positive controls: a real change of key, chords or played swing still gives way.
    for(const [what,next] of [['root',hand(kept,{root_pc:7})],['mode',hand(kept,{scale_type:'minor'})],['played swing',played(kept,HAND_SWING)],
      ['record, played swing',played(old,HAND_SWING)]]) {
      assert.equal(wheel(next).length,0,`${scene} ${what}: gives way`);
      assert.ok(bandBass(next).length>0);noDoubleBass(next);
    }
  }
});

test('a swung first Keep: the band plays straight from the next pad press, so the kept line gives way there and the band bass plays straight too',()=>{
  // Decided (review mirror case): a kept line follows the band's feel. The first Keep over a swung Jam bakes the swing
  // into every kept note, so Back to jam plays line and band swung together; the next call regenerates the band
  // with humanize off (straight), and the line built for .62 gives way to the band's own bass, also straight.
  for(const scene of SCENES) {
    const swung=hand(jamScore(scene).doc,{swing:HAND_SWING});
    const {kept,ctx}=wheelKeep(swung);
    assert.equal(ctx.swing,HAND_SWING);assert.equal(kept.scaffold_options.humanize,false);
    assert.ok(wheel(kept).length>0);
    for(const [what,next] of [['pad',contributeJam(kept,{pad:1,step:3})],['hold',setJamDirection(kept)]]) {
      const label=`${scene} ${what}`;
      assert.equal(feel(next).swing,.5,`${label}: the band plays straight now`);
      assert.equal(wheel(next).length,0,`${label}: the swung line gives way`);
      assert.ok(bandBass(next).length>0,`${label}: the band bass returns`);
      noDoubleBass(next);oneFeel(next,label);
    }
    // The Bass wheel opens again over the straight band. (After a pad press the band's bass answers the new note, and
    // the card refuses that score as off-chord with or without a kept line: a tune Keep then a pad does the same.)
    const card=cardReady(setJamDirection(kept));
    assert.equal(card.ok,true,`${scene}: the Bass wheel opens again: ${card.reason}`);
    assert.equal(card.ctx.swing,.5);assert.equal(card.ctx.bandSource,'live');
  }
  // Negative control: the same first Keep over an unswung Jam (.52, played .5 after the Keep) keeps its line.
  const {kept}=wheelKeep(jamScore('soul-v1').doc);
  assert.deepEqual(wheel(contributeJam(kept,{pad:1,step:3})),wheel(kept));
});
