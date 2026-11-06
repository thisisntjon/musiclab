# Notices

**Project:** MusicLab.
**Licence:** MIT (`LICENSE`).

## 1. Application code and optional sampled piano

The original synthesis route uses browser-native Web Audio and ES modules (`static/`) and the Python standard library (`src/`). The optional `sampled_piano_v1` route now includes pinned third-party code and a sound bank in `static/vendor/sampled-piano/`; the older no-third-party-code statement is superseded.

- SpessaSynth lib4.4.0/core4.4.1 and stb-vorbis0.0.6: Apache-2.0; fflate0.8.3: MIT. Full license texts accompany the bundle. Reproducible build inputs and pinned lockfile are retained in the development repository.
- MusicLab modification (2026-10-30) to the pinned SpessaSynth browser worklet: synchronize its processor time to the AudioWorklet render clock at each quantum, correcting startup clock skew in absolute-time events. The development repository retains the hash-checked reproduction script; only the live process boundary changes. The separate offline renderer is unchanged. Upstream license and attribution remain intact.
- GeneralUser GS2.0.3 by S. Christian Collins: unmodified bank from the previously inspected canonical repository commit `684543d5e5efaef08d02be50dcda8d552478fa60`, SHA256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`. Its full custom license accompanies the bank. It permits software use/repackaging but states that some inherited sample origins cannot be traced with certainty. The project owner chose on 2026-11-02 to ship the unmodified bank under its licence with this disclosure; the development repository retains that record. This notice is not legal advice. Versioned patches expose GM programs0 (piano),4 (electric piano),16 (Tonewheel Organ),22 (harmonica),24 (nylon guitar),25 (acoustic steel-string guitar),27 (clean guitar),29 (Overdrive Guitar),33 (finger bass),48 (Fast Strings ensemble),53 (Voice Oohs),56 (trumpet),66 (tenor sax),71 (clarinet) and105 (banjo). Program53 is a sampled vowel preset, not intelligible sung words or a claim of individual recorded singers.

The same unmodified bank also exposes bank0/program28 as `sampled_muted_guitar_v1` (Muted Guitar) and bank0/program32 as `sampled_upright_bass_v1` (Acoustic Bass). These are existing bank presets, not new recorded articulations.

No commercial game audio or extracted game assets are incorporated.

## 2. Technical sources

- **Web Audio lookahead scheduling:** based on Chris Wilson's article *A Tale of Two Clocks* (25 ms timer, 100 ms schedule-ahead window), https://web.dev/articles/audio-scheduling.
- **Zero-delay-feedback state-variable filter:** based on Andrew Simper's public technical note *Linear Trapezoidal Integrated State Variable Filter* (Cytomic, 2013), https://cytomic.com/technical-papers/.
- **Research behind the design:** retained in the development repository.

## 3. Ideas and prior art (ideas only, no code copied)

These products and papers inspired features. Only ideas were borrowed; no code, data tables or assets were copied (development investigation records). Licences marked UNVERIFIED were not read at source for this notice.

| Inspiration | Idea used in MusicLab | Upstream licence | Source |
|---|---|---|---|
| Mutable Instruments Grids | A drum map between a few hand-written patterns (preset row now removed from the UI) | Mixed (GPL-3.0 for AVR code, MIT for STM32 code), UNVERIFIED | https://github.com/pichenettes/eurorack; `static/js/theory/beat_model.js` |
| Mutable Instruments Marbles | Déjà Vu: loop-locked variation of your own notes | MIT, UNVERIFIED | https://github.com/pichenettes/eurorack; `static/js/theory/phrase_transforms.js` |
| Mutable Instruments Clouds / Beads | Reverse-swell riser | MIT, UNVERIFIED | https://github.com/pichenettes/eurorack; `static/js/audio/voices.js` |
| Mutable Instruments Plaits / Rings | Modal marimba and plucked string (textbook Karplus-Strong) | MIT, UNVERIFIED | https://github.com/pichenettes/eurorack; `src/audio_engine/dsp.py` |
| Toussaint, "The Euclidean algorithm generates traditional musical rhythms" (2005) | Euclidean rhythm formula | Paper; no code | http://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf; `static/js/theory/beat_model.js` |
| BeepBox | Note movement: Slide, Bounce, Sparkle | MIT, UNVERIFIED | https://github.com/johnnesky/beepbox; `src/theory_core/phrase_transforms.py` |
| Strudel | Wide echo (`jux`) and Ripple notes (`arp`) chord styles; Euclidean rhythms | AGPL-3.0, UNVERIFIED | https://strudel.cc; `static/js/theory/underneath.js` |
| Synplant (Sonic Charge) | Grow sound: Brighter, Warmer, Wider | Proprietary product; idea only | https://soniccharge.com/synplant; `static/js/theory/sound_breeder.js` |
| Teenage Engineering OP-Z | Part FX: Beat drop, High lift, Drum roll | Proprietary product; idea only | https://teenage.engineering/products/op-z; `static/js/theory/song_view.js` |
| Chrome Music Lab | General inspiration for playful music-making on the web; the colours are not copied | Apache-2.0 (recorded in the development investigation) | https://github.com/googlecreativelab/chrome-music-lab |
| Hyperscore (MIT Media Lab), Electroplankton and Tenori-On (Toshio Iwai) | Inspiration only: drawing and playing music without notation | Products and papers; idea only | development investigation |

## 4. Trademarks

Mutable Instruments, Grids, Marbles, Clouds, Beads, Plaits and Rings; Teenage Engineering and OP-Z; Sonic Charge and Synplant; BeepBox; Strudel; Chrome Music Lab; Hyperscore; Electroplankton and Tenori-On are names belonging to their owners. MusicLab is not affiliated with or endorsed by any of them. These names appear mainly in code comments and docs.

## 5. How to start it

See the root `README.md`.

## 6. Local project method reuse (2026-10-29)

`src/song_store/store.py::write_json_atomic` adapts the temporary-write,
flush/fsync, replace and cleanup method from the project author's earlier
local simulation project. MusicLab uses an exclusive same-directory temporary
file and preserves its existing JSON format. No game assets or simulation code
are included. The development repository retains the detailed source record.
