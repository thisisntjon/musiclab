import {validPhraseHarmony} from './phrase_harmony.js';
import {validSourceMode as validFormMode} from './source_mode.js';
export {validFormMode};

// A form advances generated four-bar blocks while personal transport stays64steps.
export function validJamForm(program){
 return program?.version===1&&typeof program.id==='string'&&program.id.length<=80
  &&(program.liveResponse===undefined||typeof program.liveResponse==='boolean')
  &&Array.isArray(program.blocks)&&program.blocks.length>=2&&program.blocks.length<=4
  &&program.blocks.every(block=>typeof block.label==='string'&&block.label.length<=80
   &&Array.isArray(block.variants)&&block.variants.length>=1&&block.variants.length<=8
   &&block.variants.every(v=>validPhraseHarmony(v.harmony)&&(v.mode===undefined||validFormMode(v.mode))&&Array.isArray(v.events)&&v.events.length<=512
    &&v.events.every(e=>e.provenance==='jam_generated'&&['drums','bass','harmony','lead'].includes(e.role)
     &&Number.isInteger(e.step)&&e.step>=0&&e.step<64&&Number.isFinite(e.duration_sec)&&e.duration_sec>0
     &&Number.isFinite(e.velocity)&&e.velocity>=0&&e.velocity<=1)));
}
export function formCursor(program,blockIndex=0,cycle=0){
 return {version:1,id:program.id,blockIndex,cycle,bars:program.blocks.length*4,label:program.blocks[blockIndex].label};
}
export function formVariant(program,cursor){
 const variants=program.blocks[cursor.blockIndex].variants;
 return variants[cursor.cycle%variants.length];
}
