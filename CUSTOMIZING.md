# Customizing & Adapting MusicLab

MusicLab includes its original source beside a checked release bundle, with zero accounts, zero cloud services, and zero mandatory build tools for local source editing so anyone — from a teacher or assistive-tech specialist tweaking keys for one player, to a musician adding new styles and instruments — can make it their own.

> **New to GitHub or want to customize MusicLab using an AI coding harness** (Claude Code, Codex, Cursor, Antigravity, Gemini CLI, or GitHub Copilot)? Start with **[`START_HERE.md`](START_HERE.md)** for a plain-English GitHub walkthrough and ready-to-paste prompt ideas! This repo also includes [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) so AI coding tools automatically understand MusicLab's layout and safety rules.

## Before your first edit

The release page loads `./ui/app.<hash>.bundle.js`, a generated copy of the JavaScript. Editing the original source alone will not change what that page runs.

1. In your own copy, open [`static/index.html`](static/index.html). Find the final `<script type="module" ...>` tag.
2. Change only its `src` value from `./ui/app.<hash>.bundle.js` to `./ui/app.js`. Keep `type="module"` and `onerror="musicLabBootFailed()"` unchanged.
3. Start `python3 app.py` and open http://127.0.0.1:8765. On Windows, `launch.cmd` instead opens http://127.0.0.1:8777; use the tab it opens. Hard-refresh after edits (`Ctrl+Shift+R` / `Cmd+Shift+R`). Source edits now load without a build step.

For the Bigger buttons example below, use a fresh browser profile: a previously saved comfort preference takes precedence over the new default. Do not clear browser storage containing songs just to test a default.

This is a local development copy, not a rebuilt release. Its shipped `MANIFEST.json` and `BUNDLE-PROVENANCE.json` no longer certify changed files. For publishing a fork, follow [`hosting/BUNDLING.md`](hosting/BUNDLING.md) and regenerate release evidence; do not copy old hashes onto new code.

---

## 1. Gentle 5-minute customizations (no build tools needed)

### A. Turn on Calm, Bigger buttons, or Read out loud by default

If you run a dedicated copy for a classroom, clinic, or player who always wants larger buttons, no motion, silent control taps, or spoken prompts, open [`static/js/theory/comfort.js`](static/js/theory/comfort.js) and edit `COMFORT_DEFAULTS`:

```js
export const COMFORT_DEFAULTS = Object.freeze({
  speak: false,        // true = read prompts out loud using an on-device voice
  voiceVolume: 0.8,    // 0.2 to 1.0
  lessMotion: false,   // true = Calm mode on by default (no pulsing or moving lines)
  bigger: false,       // true = larger pads, buttons, and text on first visit
  quietPresses: false, // true = Sound on Play (pressing controls makes no preview noise)
  movingLights: false, // true = keep beat visuals moving even if OS reduced-motion is on
});
```

### B. Remap keyboard keys for USB switches, adaptive controllers, or Makey Makey

Many adaptive switches, foot pedals, head arrays, and Makey Makey boards send specific keystrokes:

- **Two-switch scanning (`Space` to step, `Enter` to choose):** Handled in `_onKey(ev)` near the bottom of [`static/ui/stages/play_flow.js`](static/ui/stages/play_flow.js) (`if (ev.key === " ")` and `else if (ev.key === "Enter")`). You can add extra switch key codes there (for example `ev.key === " " || ev.key === "1"`).
- **Live 8-note pads (`A S D F G H J K`) and octave shift (`Z` / `X`):** Also in `_onKey(ev)` and `_liveJamPads()` inside [`static/ui/stages/play_flow.js`](static/ui/stages/play_flow.js).

### C. Unlock any of the 128 General MIDI instruments already in the repo

For fast web loading, [`static/js/audio/sampled_bank_delivery.js`](static/js/audio/sampled_bank_delivery.js) loads `GeneralUser-GS-2.0.3-MusicLab36-v1.sf2` (`11,699,936` bytes, about 11.7 MB), which holds the 36 programs the app uses (33 of them on the Sound wheel). However, the **complete 128-instrument SoundFont** is already sitting right next to it at `static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2` (`32,319,396` bytes, SHA-256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`)!

To unlock instruments like Celesta (`8`), Xylophone (`13`), Cello (`42`), Sitar (`104`) or Bagpipe (`109`):

1. **Switch to the full SoundFont** in [`static/js/audio/sampled_bank_delivery.js`](static/js/audio/sampled_bank_delivery.js):
   ```js
   file: 'GeneralUser-GS-2.0.3.sf2',
   sha256: '9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe',
   bytes: 32319396,
   ```
2. **Add a new versioned patch ID** (for example `sampled_celesta_v1: 8`) to `programs` in [`static/js/theory/sampled_sound_capabilities.js`](static/js/theory/sampled_sound_capabilities.js). Keep existing `sampled_*_v1` IDs unchanged so previously saved songs still sound the same. To make a sound play lower or higher than the written notes, add it to `transpose` in the same file, as **Bass flute** does (`-12`, one octave lower).
3. **Put it on the Sound wheel** by adding an entry to `MELODY_SOUNDS` in [`static/ui/melody_field_session.js`](static/ui/melody_field_session.js) (its label, short label, patch ID, group and loudness `level`), and give it a plain name in [`static/js/theory/sampled_sound_labels.js`](static/js/theory/sampled_sound_labels.js). Or, to offer it as a jam instrument, **add a visible card** in `INSTRUMENTS` inside [`static/js/theory/instrument_catalogue.js`](static/js/theory/instrument_catalogue.js) (instrument icons live in `static/assets/instruments/`). Run the JS tests afterwards; the Sound wheel tests pin the current list.

> Check [`NOTICES.md`](NOTICES.md) and `static/vendor/sampled-piano/GeneralUser-GS-LICENSE.txt` if you redistribute modified or replacement SoundFonts.

---

## 2. Explore or add styles on the 78-style circle

Every style on the **Listen and explore** circle combines a band arrangement (drums, bass, chords, and starter lead), harmonic timeline, and circle placement:

- **Catalogue & circle geometry:** [`static/js/theory/scene_catalogue.js`](static/js/theory/scene_catalogue.js) and [`static/js/theory/music_circle.js`](static/js/theory/music_circle.js) define style IDs, plain-language labels, family groupings, tempo defaults, and neighbour transitions around the circle.
- **Scene & groove builders:**
  - [`static/js/theory/style_scenes.js`](static/js/theory/style_scenes.js), [`static/js/theory/rhythm_scenes.js`](static/js/theory/rhythm_scenes.js), [`static/js/theory/pulse_scenes.js`](static/js/theory/pulse_scenes.js), [`static/js/theory/fast_break_scenes.js`](static/js/theory/fast_break_scenes.js), [`static/js/theory/club_trap_scenes.js`](static/js/theory/club_trap_scenes.js), [`static/js/theory/house_roots_scenes.js`](static/js/theory/house_roots_scenes.js)
  - [`static/js/theory/roots_study_scenes.js`](static/js/theory/roots_study_scenes.js), [`static/js/theory/roots_timing_scenes.js`](static/js/theory/roots_timing_scenes.js), [`static/js/theory/soul_timing_scenes.js`](static/js/theory/soul_timing_scenes.js), [`static/js/theory/ska_scene.js`](static/js/theory/ska_scene.js), [`static/js/theory/rocksteady_scene.js`](static/js/theory/rocksteady_scene.js), [`static/js/theory/doo_wop_scene.js`](static/js/theory/doo_wop_scene.js), [`static/js/theory/indie_scene.js`](static/js/theory/indie_scene.js), [`static/js/theory/dubstep_scene.js`](static/js/theory/dubstep_scene.js), [`static/js/theory/footwork_scene.js`](static/js/theory/footwork_scene.js), [`static/js/theory/grime_scene.js`](static/js/theory/grime_scene.js), [`static/js/theory/baltimore_scene.js`](static/js/theory/baltimore_scene.js), [`static/js/theory/triple_scene.js`](static/js/theory/triple_scene.js)
- **Multi-bar progression forms:** [`static/js/theory/blues_form_scores.js`](static/js/theory/blues_form_scores.js), [`static/js/theory/jazz_form_scores.js`](static/js/theory/jazz_form_scores.js), [`static/js/theory/bossa_form_score.js`](static/js/theory/bossa_form_score.js), [`static/js/theory/hard_rock_form_score.js`](static/js/theory/hard_rock_form_score.js), [`static/js/theory/heavy_metal_form_score.js`](static/js/theory/heavy_metal_form_score.js), and sibling `*_form_score.js` modules.
- **Backing harmony map:** [`static/js/theory/phrase_harmony.js`](static/js/theory/phrase_harmony.js) describes the chord timeline per 4-bar block so the pads and tune wheel stay locked to the actual band chords.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the 5-step compatibility checklist and verify with:

```bash
node --test tests/js/theory/genre-fit-composer-v5.test.mjs
```

---

## 3. Customize the Tune Wheel ("Make my tune")

When a player presses **Make my tune**, a Web Worker ([`static/ui/melody_composer_worker.js`](static/ui/melody_composer_worker.js) coordinated by [`static/ui/melody_field_session.js`](static/ui/melody_field_session.js) and [`static/ui/melody_explorer.js`](static/ui/melody_explorer.js)) computes musical melodies across the wheel so moving around swaps melodies cleanly at musical boundaries while keeping the band steady:

- **Core melody composer & style profiles:** [`static/js/theory/melody_composer_v5.js`](static/js/theory/melody_composer_v5.js) and [`static/js/theory/melody_genre_profiles_launch.js`](static/js/theory/melody_genre_profiles_launch.js).
- **Stepped motif development (`Light` → `Theme` → `Breathe` → `Return`):** [`static/js/theory/melody_composer_v7.js`](static/js/theory/melody_composer_v7.js), [`static/js/theory/melody_composer_v8.js`](static/js/theory/melody_composer_v8.js), and [`static/js/theory/melody_composer_v9.js`](static/js/theory/melody_composer_v9.js).
- **Curated seed phrases:** [`static/js/theory/melody_phrase_library_v1.js`](static/js/theory/melody_phrase_library_v1.js).

Verify melody changes against saved-song stability and harmony tests:

```bash
node --test "tests/js/theory/*composer*.test.mjs"
```

---

## 4. Tweaking synthesized voices, drum kits & visualizers

- **Browser Web Audio synths & master limiter:** [`static/js/audio/voices.js`](static/js/audio/voices.js), [`static/js/audio/master_bus.js`](static/js/audio/master_bus.js), [`static/js/audio/scheduler.js`](static/js/audio/scheduler.js).
- **Python offline WAV synth & −3 dBFS safety limiter:** [`src/audio_engine/dsp.py`](src/audio_engine/dsp.py) and [`src/audio_engine/synth.py`](src/audio_engine/synth.py).
- **Shared synth patch parameters:** [`presets/patches.json`](presets/patches.json).
- **Live score & particle visuals:** [`static/ui/live_score_visualizer.js`](static/ui/live_score_visualizer.js), [`static/js/visual/particles.js`](static/js/visual/particles.js), [`static/js/visual/particle_canvas.js`](static/js/visual/particle_canvas.js), and [`static/css/studio.css`](static/css/studio.css).

After changing audio levels, run the ceiling check:

```bash
python app.py --smoke-test
python -m pytest tests/test_audio_engine.py -q
```

---

## 5. Editable song format (`.musiclab.json`)

Downloaded editable songs are plain UTF-8 JSON validated by [`static/js/theory/project_validation.js`](static/js/theory/project_validation.js) (browser) and [`src/song_store/store.py`](src/song_store/store.py) (Python). Inspect [`examples/three-beat-song.musiclab.json`](examples/three-beat-song.musiclab.json) to see how sections, notes, note provenance (`performed` vs generated backing), and preserved original takes are stored.

---

## 6. Optional bundling & self-hosting (`hosting/`)

Local use needs no bundler. If you host MusicLab on the web for a school, community group, or public site, see [`hosting/BUNDLING.md`](hosting/BUNDLING.md) for optional `esbuild` startup bundling (`hosting/bundle_entry.cjs`) and Cloudflare Workers Static Assets staging (`hosting/stage-musiclab-cloudflare.mjs` + `hosting/musiclab-worker.mjs`).
