import {buildMelodyPalette as developedNinePalette} from '../js/theory/melody_composer_v9.js';
import {buildMelodyPalette as neighbourhoodPalette} from '../js/theory/melody_composer_v8.js';
import {buildMelodyPalette as developedPalette} from '../js/theory/melody_composer_v7.js';
import {buildMelodyPalette as motifPalette} from '../js/theory/melody_composer_v6.js';
import {balanceNativeMelodyPlans} from '../js/theory/native_melody_balance.js';
import {buildMelodyPalette as genrePalette} from '../js/theory/melody_composer_v5.js';
import {buildMelodyPalette as corpusPalette} from '../js/theory/melody_composer_v4.js';
import {buildMelodyPalette as legacyPalette} from '../js/theory/melody_composer.js';
import {buildMelodyPalette as phrasePalette} from '../js/theory/melody_composer_v2.js';
import {buildMelodyPalette as vocabularyPalette} from '../js/theory/melody_composer_v3.js';
self.onmessage=({data})=>{
  try {
    const version=data.composerVersion??1;
    if(![1,2,3,4,5,6,7,8,9].includes(version))throw new Error('Unknown melody composer version.');
    const plans=(version===9?developedNinePalette:version===8?neighbourhoodPalette:version===7?developedPalette:version===6?motifPalette:version===5?genrePalette:version===4?corpusPalette:version===3?vocabularyPalette:version===2?phrasePalette:legacyPalette)(data);
    self.postMessage({plans:version===5?balanceNativeMelodyPlans(plans,data):plans});
  } catch(error){self.postMessage({error:error.message});}
};
