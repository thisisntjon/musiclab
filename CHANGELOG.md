# Release notes

## 2026-11-14: Bass wheel cache repair and Back to Jam

- Returning visitors now load the stylesheet that matches the app. Previously, an older cached stylesheet could leave the new Bass wheel black with unstyled buttons, even though fresh-browser checks passed.
- Back to Jam stays beside Stop and volume throughout the wheel journey and saved Jam songs. It works with pointer, keyboard and enabled switch scanning. The narrow toolbar wraps to keep controls reachable.
- Returning retains the selected bass and uses the existing preservation path. Leaving Show me puts back its preview instead of silently accepting it.

App candidate: `8c7cb1fc5eca61f9051283a9d8e11848ae14403c`. Verified with a prior-release browser cache, Chrome desktop/touch emulation, Edge at 320px, exact save/reopen and independent package review. These checks do not establish physical-phone or screen-reader speech acceptance. Keep or download your work before refreshing an already-open page.

## 2026-11-14: Bass wheel and release fixes

- **Feel the bass:** six ways to play, each Light, Full or Big, plus Band bass. Starts from any style by moving to a nearby bass-ready style when needed. Hear bass clearly softens the other parts while choosing.
- **Saving and sharing:** safer song imports, protection against oversized nested song histories, and startup when browser storage is blocked.
- **Keyboard and comfort:** Space presses focused buttons by default; untimed switch scanning is available in Help. Clearer labels, visible errors and quieter status announcements.
- **Playback and export:** fixes for repeated Stop/Play memory use, long WAV exports and returning to the jam while sounds load.
- **For contributors:** illustrated introduction, architecture map, contribution guide and roadmap. The source-entry setup keeps local JavaScript edits visible without requiring a bundler.

App candidate: `daad3ae09b67eb17acab30e1684a4305f9cfe83f`. The public inventory is in [MANIFEST.json](MANIFEST.json). The shipped app uses checked bundles; source modules remain beside them.

Checked in Chrome and Edge on Windows with desktop and narrow viewports, keyboard and software switch navigation. Physical mobile devices, physical switch hardware, screen-reader speech and listening quality still need human evaluation. The older whole-run developer `?selftest` diagnostic has stale later steps; it is not the release validation route.

The hosted app no longer serves the complete source SoundFont or a duplicate workers.dev origin. The full bank remains in this repository for local customization and reproducibility. Saved songs should be downloaded as editable `.musiclab.json` backups before changing browser data.
