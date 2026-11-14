import test from 'node:test';
import assert from 'node:assert/strict';
import {MELODY_SOUNDS,MELODY_SOUND_FAMILIES,MelodyFieldSession,familyOf,familySounds,melodySoundEvents,soundKeyMove,soundSector,SOUND_HUB_RADIUS,SOUND_HYSTERESIS_DEG} from '../../../static/ui/melody_field_session.js';
import {SAMPLED_PROGRAMS} from '../../../static/js/theory/sampled_sound_capabilities.js';
import {checkPrompt} from '../../../static/js/theory/plain_language.js';

// The lead's set (13 Nov 2026): nine groups clockwise from the top, 33 sounds (Bass flute added on request), the tune's own sound in the middle.
const LEAD_SET=[
  ['Keys','#5aa9e6',[['Piano','Piano','sampled_piano_v1',1],['Electric piano','E-piano','sampled_electric_piano_v1',1.02],['Organ','Organ','sampled_organ_v1',1],['Accordion','Accordion','sampled_accordion_v1',1.23]]],
  ['Bells','#f2d04b',[['Music box','Music box','sampled_music_box_v1',1.59],['Marimba','Marimba','sampled_marimba_v1',1.04],['Vibes','Vibes','sampled_vibraphone_v1',.85]]],
  ['World','#4fd1c5',[['Steel pan','Steel pan','sampled_steel_drums_v1',1.2],['Kalimba','Kalimba','sampled_kalimba_v1',1.09],['Koto','Koto','sampled_koto_v1',1.23]]],
  ['Guitars','#e6a34f',[['Guitar','Guitar','sampled_guitar_v1',1.16],['Steel guitar','Steel','sampled_steel_guitar_v1',1.4],['Electric guitar','Electric','sampled_clean_guitar_v1',1.2],['Rock guitar','Rock','sampled_overdrive_guitar_v1',.9],['Banjo','Banjo','sampled_banjo_v1',1.3]]],
  ['Strings','#7fcf8a',[['Violins','Violins','sampled_strings_v1',1.1],['Harp','Harp','sampled_harp_v1',.83],['Plucked','Plucked','sampled_pizzicato_v1',1.25]]],
  ['Voices','#b59cf0',[['Choir','Choir','sampled_ooh_v1',.9],['Solo voice','Solo','sampled_solo_vox_v1',.76],['Space voice','Space','sampled_synth_voice_v1',1.2]]],
  ['Wind','#d86fae',[['Recorder','Recorder','sampled_recorder_v1',.89],['Clarinet','Clarinet','sampled_clarinet_v1',.84],['Harmonica','Harmonica','sampled_harmonica_v1',1.2],['Pan flute','Pan flute','sampled_pan_flute_v1',1],['Bass flute','Bass flute','sampled_bass_flute_v1',1.04],['Ocarina','Ocarina','sampled_ocarina_v1',.66]]],
  ['Horns','#f07a5a',[['Trumpet','Trumpet','sampled_trumpet_v1',.93],['Saxophone','Sax','sampled_tenor_sax_v1',.97],['Trombone','Trombone','sampled_trombone_v1',.88]]],
  ['Synths','#b8e04f',[['Game','Game','sampled_square_lead_v1',.96],['Buzzy','Buzzy','sampled_saw_lead_v1',.95],['Brassy','Brassy','sampled_synth_brass_v1',1.01]]],
];
const words=t=>t.trim().split(/\s+/).filter(Boolean).length;
const groupNames=MELODY_SOUND_FAMILIES.map(f=>f.name);

test('sound wheel offers every melodic bank sound except basses and muted guitar', () => {
  const patches=MELODY_SOUNDS.map(s=>s.patch);
  assert.equal(patches[0],null,'the tune\'s own sound stays first, in the middle of the wheel');
  assert.equal(new Set(patches).size,patches.length,'no duplicate sounds');
  for(const patch of patches.slice(1))assert.ok(Object.hasOwn(SAMPLED_PROGRAMS,patch),`${patch} is in the bundled bank`);
  const left=['sampled_bass_v1','sampled_upright_bass_v1','sampled_muted_guitar_v1'];
  for(const patch of left)assert.ok(Object.hasOwn(SAMPLED_PROGRAMS,patch),`${patch} is still a bank sound, only left off the wheel`);
  const expected=Object.keys(SAMPLED_PROGRAMS).filter(p=>!left.includes(p)).sort();
  assert.equal(expected.length,33);
  assert.deepEqual(patches.slice(1).sort(),expected);
  // The sounds saved by earlier versions must still reopen.
  for(const old of ['sampled_piano_v1','sampled_guitar_v1','sampled_clarinet_v1','sampled_organ_v1','sampled_strings_v1','sampled_ooh_v1','sampled_trumpet_v1','sampled_tenor_sax_v1'])assert.ok(patches.includes(old));
});

test('the wheel holds exactly the lead\'s nine groups and 33 sounds, in ring order', () => {
  assert.deepEqual(MELODY_SOUND_FAMILIES.map(f=>[f.name,f.hue]),LEAD_SET.map(([name,hue])=>[name,hue]));
  assert.deepEqual(MELODY_SOUNDS.slice(1).map(s=>[s.family,s.label,s.short,s.patch,s.level]),
    LEAD_SET.flatMap(([name,,sounds])=>sounds.map(([label,short,patch,level])=>[name,label,short,patch,level])));
  assert.deepEqual({...MELODY_SOUNDS[0]},{label:'Own sound',short:'Own',patch:null,family:null},
    'the middle is the tune\'s own sound; "Original" is the toolbar button\'s name');
});

test('nine groups of 3 to 5 sounds sit together round the wheel; names are short and distinct', () => {
  assert.equal(MELODY_SOUND_FAMILIES.length,9);
  const order=MELODY_SOUNDS.slice(1).map(s=>s.family);
  assert.ok(order.every(f=>groupNames.includes(f)));
  const runs=order.filter((f,i)=>f!==order[i-1]);
  assert.deepEqual(runs,groupNames,'each group is one unbroken run, in ring order');
  for(const name of groupNames){
    const sounds=familySounds(name);
    assert.ok(sounds.length>=3&&sounds.length<=6,`${name} holds 3 to 6 sounds`);
    assert.deepEqual(sounds,MELODY_SOUNDS.filter(s=>s.family===name));
    assert.ok(/^#[0-9a-f]{6}$/.test(MELODY_SOUND_FAMILIES.find(f=>f.name===name).hue));
  }
  const labels=MELODY_SOUNDS.map(s=>s.label);
  for(const name of groupNames)assert.ok(!labels.includes(name),`${name} is a group, not also a sound name`);
  assert.equal(new Set(labels).size,labels.length);
  // Harmonica and Ocarina are honest instrument names; the plain-language rule would call them long words.
  const longNames=new Set(['Harmonica','Ocarina']);
  for(const s of MELODY_SOUNDS){
    assert.ok(s.short&&s.short.length<=10,`${s.label} short label fits the wheel`);
    assert.ok(words(s.label)<=2,`${s.label} is two words or fewer`);
    if(s.patch)assert.ok(s.level>=.5&&s.level<=1.6,`${s.label} level is within the measured clamp`);
    if(s.family)assert.ok(words(`${s.family} ${s.short}`)<=3,`${s.family} with its chosen ${s.short} stays within 3 words`);
    for(const text of [s.label,s.short])if(!longNames.has(text))assert.ok(checkPrompt(text).ok,`${text} reads at grade 2`);
  }
  for(const text of [...groupNames,'All groups'])assert.ok(checkPrompt(text).ok,text);
});

test('familyOf and familySounds', () => {
  assert.equal(familyOf(null),null);
  assert.equal(familyOf(undefined),null);
  assert.equal(familyOf('sampled_muted_guitar_v1'),null,'a sound off the wheel has no group');
  assert.equal(familyOf('sampled_kalimba_v1'),'World');
  assert.equal(familyOf('sampled_strings_v1'),'Strings');
  assert.equal(familyOf('sampled_ooh_v1'),'Voices');
  assert.equal(familyOf('sampled_trumpet_v1'),'Horns');
  for(const s of MELODY_SOUNDS.slice(1))assert.equal(familyOf(s.patch),s.family);
  assert.deepEqual(familySounds(null),[]);
  assert.deepEqual(familySounds('Nope'),[]);
  assert.deepEqual(familySounds('Horns').map(s=>s.label),['Trumpet','Saxophone','Trombone']);
  assert.equal(familySounds('Keys')[0].patch,'sampled_piano_v1','a group plays its first sound when picked');
});

const at=(deg,r=.7)=>[Math.sin(deg*Math.PI/180)*r,Math.cos(deg*Math.PI/180)*r];

test('soundSector: the middle, 40-degree groups and 360/n sounds, clockwise from the top', () => {
  assert.equal(SOUND_HUB_RADIUS,.3);
  for(const view of [null,...groupNames]){
    assert.equal(soundSector(view,0,0),'hub');
    assert.equal(soundSector(view,0,.299),'hub');
    assert.equal(soundSector(view,.2,.2),'hub','radius .283 is inside the middle');
    assert.equal(soundSector(view,0,.301),0);
  }
  for(let i=0;i<9;i++){
    for(const r of [.31,.7,.99])assert.equal(soundSector(null,...at(i*40,r)),i,`group ${i} at its centre, radius ${r}`);
    assert.equal(soundSector(null,...at(i*40+19)),i);
    assert.equal(soundSector(null,...at(i*40-19)),i);
    assert.equal(soundSector(null,...at(i*40+21)),(i+1)%9);
    assert.equal(soundSector(null,...at(i*40-21)),(i+8)%9);
  }
  assert.equal(soundSector(null,1,0),2,'90 degrees (right) is World, centred on 80');
  assert.equal(soundSector(null,...at(179)),4,'just before the bottom, going clockwise, is Strings (160)');
  assert.equal(soundSector(null,...at(181)),5,'just after the bottom is Voices (200)');
  for(const view of groupNames){
    const n=familySounds(view).length,width=360/n;
    for(let j=0;j<n;j++){
      assert.equal(soundSector(view,...at(j*width)),j,`${view} sound ${j}`);
      assert.equal(soundSector(view,...at(j*width+width/2-1)),j);
      assert.equal(soundSector(view,...at(j*width+width/2+1)),(j+1)%n);
    }
  }
});

test('soundSector: a 4-degree hold at sector edges while dragging, and outside the disk', () => {
  assert.equal(SOUND_HYSTERESIS_DEG,4);
  // Group 0 spans -20..20.
  assert.equal(soundSector(null,...at(22)),1,'a fresh press past the edge is the next group');
  assert.equal(soundSector(null,...at(22),0),0,'a drag holds until 4 degrees past the edge');
  assert.equal(soundSector(null,...at(23.9),0),0);
  assert.equal(soundSector(null,...at(24.2),0),1);
  assert.equal(soundSector(null,...at(-23.9),0),0);
  assert.equal(soundSector(null,...at(-24.2),0),8);
  assert.equal(soundSector(null,...at(10),1),0,'a held sector never blocks a sector well inside another');
  // Horns has 3 sounds of 120 degrees: sound 0 spans -60..60.
  assert.equal(soundSector('Horns',...at(63),0),0);
  assert.equal(soundSector('Horns',...at(64.2),0),1);
  // Wind has 6 sounds of 60 degrees: sound 2 spans 90..150.
  assert.equal(soundSector('Wind',...at(153),2),2);
  assert.equal(soundSector('Wind',...at(155),2),3);
  // The middle still wins while dragging; the caller decides what the middle does.
  assert.equal(soundSector(null,0,.1,3),'hub');
  assert.equal(soundSector('Keys',0,.1,2),'hub');
  // Outside the disk: nothing on a fresh press; a drag that slips off the rim keeps turning.
  assert.equal(soundSector(null,0,1.2),null);
  assert.equal(soundSector('Keys',...at(90,1.3)),null);
  assert.equal(soundSector(null,0,1.2,0),0);
  assert.equal(soundSector(null,...at(130,1.4),0),3);
  assert.equal(soundSector('Keys',...at(90,1.3),'hub'),1);
});

const key=patch=>`melody-field-sound-${MELODY_SOUNDS.findIndex(s=>s.patch===patch)}`;

test('soundKeyMove: arrows, Home and Backspace on both rings', () => {
  // Group ring: arrows step round the groups and Own sound (between Synths and Keys) and play each group's first sound.
  assert.deepEqual(soundKeyMove(null,null,'ArrowRight'),{view:null,patch:'sampled_piano_v1',focus:'melody-field-family-0'});
  assert.deepEqual(soundKeyMove(null,null,'ArrowDown'),{view:null,patch:'sampled_piano_v1',focus:'melody-field-family-0'});
  assert.deepEqual(soundKeyMove(null,null,'ArrowLeft'),{view:null,patch:'sampled_square_lead_v1',focus:'melody-field-family-8'});
  assert.deepEqual(soundKeyMove(null,null,'ArrowUp'),{view:null,patch:'sampled_square_lead_v1',focus:'melody-field-family-8'});
  assert.deepEqual(soundKeyMove(null,'sampled_kalimba_v1','ArrowRight'),{view:null,patch:'sampled_guitar_v1',focus:'melody-field-family-3'});
  assert.deepEqual(soundKeyMove(null,'sampled_kalimba_v1','ArrowLeft'),{view:null,patch:'sampled_music_box_v1',focus:'melody-field-family-1'});
  assert.deepEqual(soundKeyMove(null,'sampled_synth_brass_v1','ArrowRight'),{view:null,patch:null,focus:'melody-field-sound-0'},'past Synths is Own sound');
  assert.deepEqual(soundKeyMove(null,'sampled_piano_v1','ArrowLeft'),{view:null,patch:null,focus:'melody-field-sound-0'},'before Keys is Own sound');
  assert.deepEqual(soundKeyMove(null,'sampled_kalimba_v1','Home'),{view:null,patch:null,focus:'melody-field-sound-0'});
  for(const k of ['Backspace','Enter',' ','Escape','a','End'])assert.equal(soundKeyMove(null,'sampled_kalimba_v1',k),null,`${k} is not the wheel's on the group ring`);
  // Sound ring: left and right change the sound inside the group, wrapping.
  assert.deepEqual(soundKeyMove('World','sampled_kalimba_v1','ArrowRight'),{view:'World',patch:'sampled_koto_v1',focus:key('sampled_koto_v1')});
  assert.deepEqual(soundKeyMove('World','sampled_kalimba_v1','ArrowLeft'),{view:'World',patch:'sampled_steel_drums_v1',focus:key('sampled_steel_drums_v1')});
  assert.equal(soundKeyMove('World','sampled_koto_v1','ArrowRight').patch,'sampled_steel_drums_v1');
  assert.equal(soundKeyMove('World','sampled_steel_drums_v1','ArrowLeft').patch,'sampled_koto_v1');
  assert.equal(soundKeyMove('World',null,'ArrowRight').patch,'sampled_steel_drums_v1','from outside the group, Right starts at its first sound');
  assert.equal(soundKeyMove('World',null,'ArrowLeft').patch,'sampled_koto_v1');
  // Up and down open the previous or next group and play its first sound.
  assert.deepEqual(soundKeyMove('World','sampled_kalimba_v1','ArrowDown'),{view:'Guitars',patch:'sampled_guitar_v1',focus:key('sampled_guitar_v1')});
  assert.deepEqual(soundKeyMove('World','sampled_kalimba_v1','ArrowUp'),{view:'Bells',patch:'sampled_music_box_v1',focus:key('sampled_music_box_v1')});
  assert.equal(soundKeyMove('Synths','sampled_saw_lead_v1','ArrowDown').view,'Keys');
  assert.equal(soundKeyMove('Keys','sampled_organ_v1','ArrowUp').view,'Synths');
  // Backspace shows all groups (view only); Home picks the tune's own sound and shows all groups.
  assert.deepEqual(soundKeyMove('World','sampled_kalimba_v1','Backspace'),{view:null,patch:undefined,focus:'melody-field-family-2'});
  assert.deepEqual(soundKeyMove('World','sampled_kalimba_v1','Home'),{view:null,patch:null,focus:'melody-field-sound-0'});
  for(const k of ['Enter',' ','Escape','Tab'])assert.equal(soundKeyMove('World','sampled_kalimba_v1',k),null);
  assert.equal(soundKeyMove('Nope','sampled_kalimba_v1','ArrowRight'),null);
  // Every focus key names the sound it chooses.
  for(const view of groupNames)for(const s of familySounds(view))for(const k of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']){
    const move=soundKeyMove(view,s.patch,k);
    assert.equal(move.focus,key(move.patch));assert.equal(familyOf(move.patch),move.view);
  }
});

test('keys alone reach every sound from the tune\'s own sound', () => {
  const reached=new Set();
  let view=null,patch=null;
  for(let g=0;g<9;g++){
    ({view,patch}=soundKeyMove(view,patch,'ArrowRight'));
    view=familyOf(patch); // Enter opens the focused group
    for(let i=0;i<6;i++){reached.add(patch);({patch}=soundKeyMove(view,patch,'ArrowRight'));}
    ({view}=soundKeyMove(view,patch,'Backspace'));
  }
  assert.deepEqual([...reached].sort(),MELODY_SOUNDS.slice(1).map(s=>s.patch).sort());
});

function session({melodySound='sampled_kalimba_v1'}={}) {
  const lead={id:'g1',role:'lead',step:0,duration_steps:4,velocity:.7,patch_id:'synth_lead',provenance:'jam_generated',concrete:{midi_pitch:64}};
  const sourceDoc={id:'wheel',global_context:{bpm:100,bars:4,root_pc:0},notes:[lead],arrangement_mode:'loop'};
  const song={song_id:'wheel',bpm:100,swing:.5,total_steps:64,steps_per_bar:16,events:[lead]};
  const queued=[];
  const scheduler={isPlaying:true,gridOriginTime:0,audioCtx:{currentTime:1},stopGeneration:0,spotlightRole:null,
    getPartAuditionState(){return null;},
    queueContinuousPartAudition(_view,{requestId}){queued.push(requestId);return {ok:true};}};
  const phraseContext={version:1,composerVersion:7,root:0,melodySound};
  const field=new MelodyFieldSession(song,{scheduler,captureOrigin:0,sourceDoc,phraseContext});
  field.palette={original:{notes:[lead]}};
  field.candidates.clear();field.requestId=field._candidate(field.position).id;
  return {field,queued,phraseContext};
}
const snapshot=field=>({requestId:field.requestId,history:structuredClone(field.history),candidates:[...field.candidates.keys()],
  soundPatch:field.soundPatch,position:{...field.position},melodySound:field.phraseContext.melodySound,comparison:field.comparisonPosition??null});

test('view changes never touch the request, history, candidates or the saved sound', () => {
  const {field,queued,phraseContext}=session();
  assert.equal(field.soundPatch,'sampled_kalimba_v1');
  field.setSoundMode(true);
  assert.equal(field.soundView,null,'entering the Sound wheel shows the group ring');
  const before=snapshot(field);
  assert.equal(field.closeSoundFamily(),false);
  assert.equal(field.openSoundFamily('World'),true,'opening the group that holds the sound plays nothing new');
  assert.equal(field.soundView,'World');
  assert.deepEqual(snapshot(field),before);
  assert.equal(field.followSoundView(),false);
  assert.equal(field.closeSoundFamily(),true);
  assert.equal(field.soundView,null);
  assert.deepEqual(snapshot(field),before);
  assert.deepEqual(queued,[],'no view change asks the scheduler for anything');
  assert.equal(phraseContext.melodySound,'sampled_kalimba_v1');
  for(const id of field.candidates.keys())assert.doesNotMatch(id,/World|view/);
  field.setSoundMode(false);field.setSoundMode(true);
  assert.equal(field.soundView,null,'a second entry starts on the group ring again');
  assert.deepEqual(snapshot(field),before);
  assert.equal(field.openSoundFamily('Nope'),false);
  field.setSoundMode(false);
  assert.equal(field.openSoundFamily('World'),false,'the Tune wheel has no sound groups');
});

test('opening another group plays its first sound once; Undo, Original and Home bring the view along', () => {
  const {field,queued}=session();
  field.setSoundMode(true);
  field.openSoundFamily('Bells');
  assert.equal(field.soundView,'Bells');
  assert.equal(field.soundPatch,'sampled_music_box_v1');
  assert.equal(field.history.length,1,'one Undo step');
  assert.equal(queued.length,1,'heard through one request');
  field.openSoundFamily('Bells');
  assert.equal(field.history.length,1,'opening it again changes nothing');
  field.applySoundMove(soundKeyMove(field.soundView,field.soundPatch,'ArrowRight'));
  assert.equal(field.soundPatch,'sampled_marimba_v1');assert.equal(field.history.length,2);
  field.undo();
  assert.equal(field.soundPatch,'sampled_music_box_v1');assert.equal(field.soundView,'Bells','same group: the view stays');
  field.undo();
  assert.equal(field.soundPatch,'sampled_kalimba_v1');assert.equal(field.soundView,'World','the view follows the sound to its group');
  field.applySoundMove(soundKeyMove(field.soundView,field.soundPatch,'Home'));
  assert.equal(field.soundPatch,null);assert.equal(field.soundView,null,'Home shows all groups');
  field.applySoundMove(soundKeyMove(field.soundView,field.soundPatch,'ArrowRight'));
  assert.equal(field.soundPatch,'sampled_piano_v1');assert.equal(field.soundView,null,'arrows on the group ring keep the group ring');
  field.openSoundFamily('Keys');
  field.applySoundMove(soundKeyMove(field.soundView,field.soundPatch,'Backspace'));
  assert.equal(field.soundView,null);assert.equal(field.soundPatch,'sampled_piano_v1','Backspace changes the view only');
  // Original compares with the tune's first sound; an open ring follows it and comes back with it.
  field.openSoundFamily('Keys');
  field.toggleOriginal();
  assert.equal(field.soundPatch,'sampled_kalimba_v1');assert.equal(field.soundView,'World');
  field.toggleOriginal();
  assert.equal(field.soundPatch,'sampled_piano_v1');assert.equal(field.soundView,'Keys');
  // An own-sound start: Original goes back to the middle and the group ring.
  const own=session({melodySound:null}).field;own.setSoundMode(true);own.openSoundFamily('Horns');
  own.toggleOriginal();
  assert.equal(own.soundPatch,null);assert.equal(own.soundView,null);
});

test('Sound wheel markup: group ring, every sound ring, and no old list, legend or dots', () => {
  const {field}=session();
  field.setSoundMode(true);
  const ring=field.html();
  assert.doesNotMatch(ring,/Choose without dragging|melody-sound-list|pf-sound-legend|pf-sound-choices|data-mf-request|data-mf-reached|pf-mf-centre|melody-field-controls/);
  const disk=ring.match(/<div class="pf-melody-disk pf-sound-disk"[\s\S]*?<p class="pf-sub" data-mf-status/)[0];
  assert.match(disk,/^<div class="pf-melody-disk pf-sound-disk" data-melody-disk data-sound-view="" tabindex="-1" role="group"/,'the disk is not a Tab stop of its own here');
  assert.equal((disk.match(/tabindex=/g)||[]).length,1,'every button inside the disk is a native Tab stop (only the disk names a tabindex)');
  assert.doesNotMatch(disk,/"[a-z-]+="/,'every attribute is separated by a space');
  const keys=[...disk.matchAll(/data-key="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(keys,['melody-field-sound-0',...groupNames.map((_,i)=>`melody-field-family-${i}`)],'the middle first, then the groups clockwise (also the Tab order)');
  assert.match(disk,/data-key="melody-field-family-2"[^>]*aria-label="World Kalimba, World sounds" data-chosen="true"[^>]*>World <span class="pf-sound-now" data-sound-now>Kalimba<\/span>/);
  // Both views' prompts share one cell so the disk never moves; the one for this view is the one shown.
  const prompt=t=>{const [,view,inner]=t.match(/<p class="pf-sound-prompt" data-mf-sound-prompt data-view="(groups|sounds)">([\s\S]*?)<\/p>/);
    return inner.match(new RegExp(`<span data-prompt="${view}">([^<]*)</span>`))[1];};
  assert.equal(prompt(ring),'Turn to hear each group. Let go to see its sounds. Your notes stay.');
  const label=t=>t.match(/data-melody-disk[^>]*aria-label="([^"]*)"/)[1];
  for(const text of [prompt(ring),label(ring)])assert.ok(checkPrompt(text).ok,`${text} -> ${JSON.stringify(checkPrompt(text).problems)}`);
  for(const name of groupNames){
    field.soundView=name;
    const html=field.html(),sounds=familySounds(name);
    const disk=html.match(/<div class="pf-melody-disk pf-sound-disk"[\s\S]*?<p class="pf-sub" data-mf-status/)[0];
    const keys=[...disk.matchAll(/data-key="([^"]+)"/g)].map(m=>m[1]);
    assert.deepEqual(keys,[...sounds.map(s=>key(s.patch)),'melody-field-families'],`${name}: its sounds, then All groups last`);
    assert.deepEqual([...disk.matchAll(/data-sound-choice="(\d+)"/g)].map(m=>MELODY_SOUNDS[Number(m[1])].patch),sounds.map(s=>s.patch));
    for(const s of sounds)assert.match(disk,new RegExp(`data-key="${key(s.patch)}"[^>]*>${s.label}</button>`));
    assert.match(disk,/data-key="melody-field-families"[^>]*>All groups<\/button>/);
    assert.equal((disk.match(/tabindex=/g)||[]).length,1);
    assert.match(disk,/class="pf-sound-rim" aria-hidden="true"/);
    assert.equal(prompt(html),'Turn to hear each sound. The middle shows all groups.');
    for(const text of [prompt(html),label(html)])assert.ok(checkPrompt(text).ok,`${text} -> ${JSON.stringify(checkPrompt(text).problems)}`);
  }
  field.setSoundMode(false);
  const tune=field.html();
  assert.match(tune,/data-melody-disk tabindex="0"/,'the Tune wheel keeps its own Tab stop');
  assert.match(tune,/Move with buttons/);
  assert.doesNotMatch(tune,/pf-sound-sector|data-sound-choice/);
});

test('sound level applies once to generated tune notes only', () => {
  const events=[
    {role:'lead',provenance:'jam_generated',patch_id:'synth_lead',velocity:.6},
    {role:'lead',provenance:'jam_generated',patch_id:'synth_lead',velocity:.6,edited_from_generator:true},
    {role:'lead',provenance:'personal',patch_id:'synth_lead',velocity:.6},
    {role:'bass',provenance:'jam_generated',patch_id:'sampled_bass_v1',velocity:.6},
  ];
  const banjo=MELODY_SOUNDS.find(s=>s.patch==='sampled_banjo_v1');
  const once=melodySoundEvents(events,banjo.patch);
  assert.equal(once[0].patch_id,banjo.patch);
  assert.ok(Math.abs(once[0].velocity-.6*banjo.level)<1e-9);
  assert.deepEqual(once.slice(1),events.slice(1),'edited, personal and band notes are untouched');
  const again=melodySoundEvents(once,banjo.patch);
  assert.equal(again[0].velocity,once[0].velocity,'reapplying the same sound does not boost again');
  assert.deepEqual(melodySoundEvents(events,null),events,'Original changes nothing');
  const loud=melodySoundEvents([{...events[0],velocity:.95}],'sampled_steel_guitar_v1');
  assert.ok(loud[0].velocity<=1,'velocity never exceeds full');
  assert.throws(()=>melodySoundEvents(events,'sampled_muted_guitar_v1'),/Unknown melody sound/);
});

test('levels never stack: any chain of sounds equals choosing the last one fresh', () => {
  const events=[.45,.6,.75,.85].map((velocity,i)=>({id:`n${i}`,role:'lead',provenance:'jam_generated',patch_id:'synth_lead',velocity}));
  const steel='sampled_steel_guitar_v1',clarinet='sampled_clarinet_v1',banjo='sampled_banjo_v1';
  const fresh=melodySoundEvents(events,clarinet);
  // Saved with Steel, reopened (the saved notes become the source), then Clarinet chosen.
  const reopened=structuredClone(melodySoundEvents(events,steel));
  assert.deepEqual(melodySoundEvents(reopened,clarinet),fresh,'reopen and switch matches a fresh choice');
  assert.deepEqual(melodySoundEvents(melodySoundEvents(melodySoundEvents(events,banjo),steel),clarinet),fresh);
  // Steel caps loud notes at 1; the base keeps them distinct for the next sound.
  assert.notEqual(fresh[2].velocity,fresh[3].velocity);
  // Original restores the very first sound and loudness, even after a reopen.
  const original=melodySoundEvents(reopened,null);
  assert.deepEqual(original,events);
  // A note whose velocity was never set stays unset after a round trip.
  const bare=[{role:'lead',provenance:'jam_generated',patch_id:'synth_lead'}];
  assert.deepEqual(melodySoundEvents(melodySoundEvents(bare,banjo),null),bare);
});

test('an older save already in a wheel sound is not rescaled on reopen', () => {
  const legacy=[{role:'lead',provenance:'jam_generated',patch_id:'sampled_organ_v1',velocity:.6}];
  assert.deepEqual(melodySoundEvents(legacy,'sampled_organ_v1'),legacy);
  const moved=melodySoundEvents(legacy,'sampled_clarinet_v1');
  assert.equal(moved[0].sound_base.patch_id,'sampled_organ_v1');
  assert.deepEqual(melodySoundEvents(moved,null),legacy);
});

test('every new sound level-scales like the shipped ones', () => {
  const events=[{role:'lead',provenance:'jam_generated',patch_id:'synth_lead',velocity:.5}];
  for(const s of MELODY_SOUNDS.slice(1)){
    const [e]=melodySoundEvents(events,s.patch);
    assert.equal(e.patch_id,s.patch);
    assert.ok(Math.abs(e.velocity-Math.min(1,.5*s.level))<1e-9,s.label);
    assert.deepEqual(melodySoundEvents([e],null),events);
  }
});
