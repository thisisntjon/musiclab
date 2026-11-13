/** Delivery packaging only: sound identity remains the original GeneralUser presets. */
import {SAMPLED_BANK,SAMPLED_PROGRAMS} from '../theory/sampled_sound_capabilities.js';
export const SAMPLED_DELIVERY=Object.freeze({
 version:1,
 file:'GeneralUser-GS-2.0.3-MusicLab17-v1.sf2',
 sha256:'0d4e4d241e4d9c060f941eb9f7857c66bce0e5bfaef48beeebea8aaf98ad254b',
 bytes:8970282,
 sourceBankId:'generaluser-gs-2.0.3',
 sourceSha256:'9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe',
 programs:Object.freeze([0,4,16,22,24,25,27,28,29,32,33,48,53,56,66,71,105]),
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
