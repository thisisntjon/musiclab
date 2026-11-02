# Notices

**Project:** MusicLab.
**Licence:** MIT (`LICENSE`).

## 1. Application code and sampled instruments

The synthesis route uses browser-native Web Audio and ES modules (`static/`) and the Python standard library (`src/`). The `sampled_piano_v1` instrument route uses pinned third-party code and a sound bank in `static/vendor/sampled-piano/`:

- **SpessaSynth** (`spessasynth_lib` 4.4.0 / `spessasynth_core` 4.4.1) and `stb-vorbis` 0.0.6: Apache-2.0; `fflate` 0.8.3: MIT. Full license texts accompany the bundle in `static/vendor/sampled-piano/THIRD-PARTY-LICENSES.txt`.
- **MusicLab modification (2026-10-30)** to the pinned SpessaSynth browser worklet: synchronizes its processor time to the `AudioWorklet` render clock at each quantum, correcting startup clock skew in absolute-time events. Only the live process boundary changes; the offline renderer is unchanged. Upstream license and attribution remain intact.
- **GeneralUser GS 2.0.3** by S. Christian Collins: unmodified sound bank from canonical repository commit `684543d5e5efaef08d02be50dcda8d552478fa60`, SHA-256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`. Its full license (`GeneralUser-GS-LICENSE.txt`) accompanies the bank in `static/vendor/sampled-piano/`, permitting free use and redistribution with software packages while noting that some historical sample origins in the bank cannot be traced with certainty. Versioned patches expose General MIDI programs across keyboards, guitars, bass, strings, brass, reeds and banjo (`static/js/audio/sampled_piano.js`).

No commercial game audio or extracted game assets are incorporated.

## 2. Technical sources

- **Web Audio lookahead scheduling:** based on Chris Wilson's article *A Tale of Two Clocks* (25 ms timer, 100 ms schedule-ahead window), https://web.dev/articles/audio-scheduling.
- **Zero-delay-feedback state-variable filter:** based on Andrew Simper's public technical note *Linear Trapezoidal Integrated State Variable Filter* (Cytomic, 2013), https://cytomic.com/technical-papers/.

## 3. Ideas and prior art (ideas only, no code or recordings copied)

These works, products and papers inspired features in MusicLab. Only ideas were borrowed; no code, data tables, compositions or recordings were copied.

| Inspiration | Idea used in MusicLab | Source |
|---|---|---|
| Grant Kirkhope (*Banjo-Kazooie*, Rare, 1998) | Adaptive style transitions where instrumentation changes across regions while the core musical phrase continues | Idea only; no music or assets used |
| Mutable Instruments (Grids, Marbles, Clouds/Beads, Plaits/Rings) | Topographic drum map, loop-locked variation of user notes, reverse-swell riser, modal marimba and Karplus-Strong plucked string | https://github.com/pichenettes/eurorack (idea only) |
| Godfried Toussaint, "The Euclidean algorithm generates traditional musical rhythms" (2005) | Euclidean rhythm distribution formula | http://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf |
| BeepBox | Note movement transforms (Slide, Bounce, Sparkle) | https://github.com/johnnesky/beepbox (idea only) |
| Strudel | Wide echo (`jux`) and arpeggiated (`arp`) chord styles | https://strudel.cc (idea only) |
| Synplant (Sonic Charge) | Grow sound macro directions (Brighter, Warmer, Wider) | https://soniccharge.com/synplant (idea only) |
| Teenage Engineering OP-Z | Part effects (Beat drop, High lift, Drum roll) | https://teenage.engineering/products/op-z (idea only) |
| Chrome Music Lab, Hyperscore, Electroplankton, Tenori-On | Playful, immediate music-making without requiring notation first | Idea only |

## 4. Trademarks

Banjo-Kazooie and Rare; Mutable Instruments, Grids, Marbles, Clouds, Beads, Plaits and Rings; Teenage Engineering and OP-Z; Sonic Charge and Synplant; BeepBox; Strudel; Chrome Music Lab; Hyperscore; Electroplankton and Tenori-On are names belonging to their respective owners. MusicLab is not affiliated with or endorsed by any of them.

## 5. How to start it

See the root `README.md`.

## 6. Local atomic file-write method

`src/song_store/store.py::write_json_atomic` adapts the temporary-write, flush/fsync, replace and cleanup pattern from the author's earlier local simulation project, using an exclusive same-directory temporary file and preserving MusicLab's JSON format.
