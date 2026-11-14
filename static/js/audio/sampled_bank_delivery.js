/** Delivery packaging only: sound identity remains the original GeneralUser presets. */
import {SAMPLED_BANK,SAMPLED_PROGRAMS} from '../theory/sampled_sound_capabilities.js';
export const SAMPLED_DELIVERY=Object.freeze({
 version:3,
 file:'GeneralUser-GS-2.0.3-MusicLab36-v1.sf2',
 sha256:'a3a9e330a46f04ece40769cec5d1ea8b469242cb5123ed5136399fc386d09fc7',
 bytes:11699936,
 sourceBankId:'generaluser-gs-2.0.3',
 sourceSha256:'9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe',
 programs:Object.freeze([0,4,10,11,12,16,21,22,24,25,27,28,29,32,33,45,46,48,53,54,56,57,62,66,71,73,74,75,79,80,81,85,105,107,108,114]),
});
const bankUrl=new URL('../../vendor/sampled-piano/'+SAMPLED_DELIVERY.file,import.meta.url);
export async function fetchSampledBank({retry=false,fetcher=globalThis.fetch}={}) {
 const response=await fetcher(bankUrl,{cache:retry?'reload':'default'});
 if(!response.ok)throw Error('Instrument files could not be loaded. Your song is unchanged.');
 const bank=await response.arrayBuffer();
 if(bank.byteLength!==SAMPLED_DELIVERY.bytes)throw Error('The sound file is not whole. Try loading it again.');
 const hash=await globalThis.crypto.subtle.digest('SHA-256',bank);
 const hex=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
 if(hex!==SAMPLED_DELIVERY.sha256)throw Error('The sound file has changed. Try loading it again.');
 return bank;
}
