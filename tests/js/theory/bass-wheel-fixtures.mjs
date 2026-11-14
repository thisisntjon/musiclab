// Shared fixtures for the bass wheel tests and the offline render: real Jam bands from the scene catalogue,
// compiled the way the app compiles them, with the melody session's captured context (composer 9).
import {startJam,setJamDirection} from '../../../static/js/theory/jam_session.js';
import {SCENE_CATALOGUE_VERSION,SCENE_MIX_VERSION} from '../../../static/js/theory/scene_catalogue.js';
import {buildStandaloneSeed,compileSongStandalone} from '../../../static/ui/standalone_compiler.js';
import {captureMelodyContext} from '../../../static/js/theory/melody_composer.js';
import {phraseContext} from '../../../static/js/theory/phrase_harmony.js';
import {VOCABULARY_VERSION} from '../../../static/js/theory/melody_phrase_library_v1.js';

export const SCENES=['house-v1','reggae-v1','soul-v1','ska-v1','rocksteady-v1','swing-v1'];
export const VARIANTS=['base','answer','space'];

/** A Jam on one catalogue scene: the doc, its compiled loop and the melody session context. */
export function jamScore(scene,{root=0,minor=false,variant='base',density=1,color=1,bpm=null}={}) {
  let doc=startJam(buildStandaloneSeed(),{kind:'pitched',patchId:'sampled_piano_v1'});
  doc.global_context={...doc.global_context,root_pc:root,scale_type:minor?'minor':'major',...(bpm?{bpm}:{})};
  doc.notes=doc.notes.filter(n=>n.provenance!=='seed_template');
  doc=setJamDirection(doc,{showcase_version:1,showcase_palette:'sampled',showcase_arrangement:'contrast-v1',
    scene_catalogue:SCENE_CATALOGUE_VERSION,scene_id:scene,scene_mix:SCENE_MIX_VERSION,scene_variant:variant,density,color});
  doc.id='bass-wheel-test';
  return {doc,...scoreOf(doc)};
}

/** A doc's compiled loop and the melody session context captured from it (what the Bass wheel card checks). */
export function scoreOf(doc) {
  const song=compileSongStandalone({...doc,arrangement_mode:'loop'}),stepSec=15/song.bpm;
  song.song_id=doc.id;
  song.events=song.events.map(e=>({...e,duration_steps:e.duration_steps??e.duration_sec/stepSec}));
  const captured=captureMelodyContext(song,{phraseContext:phraseContext(doc)});
  const context=captured?{...captured,composerVersion:9,vocabularyVersion:VOCABULARY_VERSION}:null;
  return {song,context};
}
