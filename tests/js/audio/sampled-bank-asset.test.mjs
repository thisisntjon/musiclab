import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SoundBankLoader,SpessaLog} from '../../../static/vendor/sampled-piano/engine.js';
import {SAMPLED_DELIVERY} from '../../../static/js/audio/sampled_bank_delivery.js';
import {SAMPLED_PROGRAMS} from '../../../static/js/theory/sampled_sound_capabilities.js';
SpessaLog.setLogLevel(false,false,false);
const vendor=name=>readFileSync(new URL('../../../static/vendor/sampled-piano/'+name,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const parse=b=>SoundBankLoader.fromArrayBuffer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const melodic=bank=>bank.presets.filter(p=>p.bankMSB===0&&p.bankLSB===0&&!p.isDrum);
// The engine plays program 0 (Grand Piano) with no error when a program is missing from the
// loaded bank, so the shipped file itself must hold a preset for every pinned sampled program.
test('the shipped delivery bank is the pinned file and holds a preset for every sampled program',()=>{
 const bytes=vendor(SAMPLED_DELIVERY.file);
 assert.equal(bytes.length,SAMPLED_DELIVERY.bytes);assert.equal(sha(bytes),SAMPLED_DELIVERY.sha256);
 const bank=parse(bytes),presets=melodic(bank),programs=presets.map(p=>p.program).sort((a,b)=>a-b);
 assert.deepEqual(programs,[...SAMPLED_DELIVERY.programs]);
 assert.equal(new Set(programs).size,programs.length);
 assert.equal(bank.presets.length,programs.length,'no drum kits or other banks are packaged');
 for(const [patch,program] of Object.entries(SAMPLED_PROGRAMS))assert.ok(programs.includes(program),`${patch} needs program ${program} in ${SAMPLED_DELIVERY.file}`);
 for(const preset of presets){
  const voices=preset.getVoiceParameters(60,96);
  assert.ok(voices.length>0,`program ${preset.program} has no voice at middle C`);
  assert.ok(voices.every(v=>v.sample.getAudioData().length>0),`program ${preset.program} has empty sample data`);
 }
});
test('the previous delivery file stays byte-identical for pages opened before the change and for rollback',()=>{
 const old=vendor('GeneralUser-GS-2.0.3-MusicLab17-v1.sf2');
 assert.equal(old.length,8970282);assert.equal(sha(old),'0d4e4d241e4d9c060f941eb9f7857c66bce0e5bfaef48beeebea8aaf98ad254b');
 assert.notEqual(SAMPLED_DELIVERY.file,'GeneralUser-GS-2.0.3-MusicLab17-v1.sf2');
});
// The live release still loads the 17 file; the 35 file was built but never published, so the 36 file
// replaced it in the tree and only the full bank, the 17 file and the current delivery file ship.
test('the delivery bank holds 36 programs, the 17 file is retained and the unpublished 35 file is gone',()=>{
 assert.equal(SAMPLED_DELIVERY.programs.length,36);assert.equal(SAMPLED_DELIVERY.file,'GeneralUser-GS-2.0.3-MusicLab36-v1.sf2');
 const banks=readdirSync(new URL('../../../static/vendor/sampled-piano/',import.meta.url)).filter(f=>f.endsWith('.sf2')).sort();
 assert.deepEqual(banks,['GeneralUser-GS-2.0.3-MusicLab17-v1.sf2','GeneralUser-GS-2.0.3-MusicLab36-v1.sf2','GeneralUser-GS-2.0.3.sf2']);
 assert.ok(!banks.includes('GeneralUser-GS-2.0.3-MusicLab35-v1.sf2'));
});
test('program 73 is the Flute preset of the bank, with a voice at every pitch the bass flute sounds',()=>{
 const flute=melodic(parse(vendor(SAMPLED_DELIVERY.file))).find(p=>p.program===73);
 assert.equal(flute?.name,'Flute');
 for(let pitch=36;pitch<=84;pitch++)for(const velocity of [48,96,127]){
  const voices=flute.getVoiceParameters(pitch,velocity);
  assert.equal(voices.length,1,`one Flute voice at ${pitch}/${velocity}`);
  assert.ok(voices[0].sample.getAudioData().length>0);
 }
});
