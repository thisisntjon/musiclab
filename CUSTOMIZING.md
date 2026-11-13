# Customizing MusicLab

MusicLab is designed so you can inspect, modify and remix every part of the instrument locally without accounts, cloud services or mandatory build steps.

`static/index.html` loads `./ui/app.js` directly as standard browser ES modules. Edit any file under `static/`, save, refresh `http://127.0.0.1:8765` (with browser cache disabled in DevTools if needed), and hear your change right away.

---

## 1. Explore or add styles on the 78-style circle

Every style on the **Listen and explore** circle combines a band arrangement (drums, bass, chords and starter lead), harmonic timeline and circle placement:

- **Catalogue & circle placement:** `static/js/theory/scene_catalogue.js` and `static/js/theory/music_circle.js` define the style IDs, display labels, family groupings, tempo defaults and neighbour transitions around the circle.
- **Band patterns & long-form scores:**
  - `static/js/theory/jam_scenes.js` — core groove scenes.
  - `static/js/theory/extended_catalogue_scenes.js`, `roots_scenes.js`, `folk_Americana_scenes.js`, `african_latin_scenes.js`, `funk_disco_scenes.js`, `modern_club_scenes.js`, `world_regional_scenes.js` — regional and genre scene builders.
  - `static/js/theory/blues_form_score.js`, `jazz_form_score.js`, `rock_form_score.js`, `metal_form_score.js` — multi-bar progression forms (such as 12-bar blues and turnaround forms).
- **Backing harmony map:** `static/js/theory/phrase_harmony.js` describes the chord timeline per 4-bar block so the pads and melody wheel stay locked to the actual band harmony.

> **Compatibility tip:** Existing saved songs reference style IDs by name. When adding your own styles, append new IDs rather than renaming or reordering existing entries. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the 5-step checklist and run:
> ```bash
> node --test tests/js/theory/genre-fit-composer-v5.test.mjs
> ```

---

## 2. Customize the Melody Wheel ("Make my tune")

When a player presses **Make my tune**, a Web Worker (`static/ui/melody_composer_worker.js` via `static/ui/melody_field_session.js`) precomputes musical melodies across the wheel so dragging swaps melodies cleanly at musical boundaries while keeping the band fixed:

- **Core melody composer & style profiles:** `static/js/theory/melody_composer_v5.js` and `static/js/theory/melody_genre_profiles_launch.js` define rhythmic cells, contour shapes, phrase endings and register ranges per style.
- **Stepped motif development (`Light` → `Theme` → `Breathe` → `Return`):** `static/js/theory/melody_composer_v7.js`, `melody_composer_v8.js` and `melody_composer_v9.js` implement motif-preserving development and phrase handovers for styles such as House, Reggae, Soul, Ska, Rocksteady and Swing.
- **Curated seed phrases:** `static/js/theory/melody_phrase_library_v1.js` holds the musical seed shapes that are adapted to the active chord timeline.
- **Wheel directions & labels:** `static/ui/melody_wheel_canvas.js` renders the 2D wheel, directional poles (**Bright hook**, **Smooth flow**, **Crisp bounce**, **Wide space**) and stepped ring feedback.

After editing composer logic, verify both musical fit and saved-song stability:

```bash
node --test "tests/js/theory/*composer*.test.mjs"
```

---

## 3. Unlock all 128 General MIDI instruments or build custom synths

MusicLab supports two sound engines side by side: **sampled instruments** powered by SpessaSynth + GeneralUser GS 2.0.3 in the browser, and **synthesized voices** rendered in both Web Audio and Python.

### A. Unlocking additional instruments from the full SoundFont

For fast startup, `static/js/audio/sampled_bank_delivery.js` fetches `GeneralUser-GS-2.0.3-MusicLab17-v1.sf2` (`8,970,282` bytes), a 17-preset subset of GeneralUser GS 2.0.3. The **complete 128-program bank** is already included at `static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2` (`32,319,396` bytes, SHA-256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`).

To expose any General MIDI program (`0`–`127`, such as vibraphone `11`, cello `42`, flute `73`, or kalimba `108`):

1. **Point delivery at the full bank (or your own custom `.sf2` subset):** Update `file`, `bytes` and `sha256` in `static/js/audio/sampled_bank_delivery.js` (`SAMPLED_DELIVERY` verifies exact byte length and SHA-256 via Web Crypto before loading).
2. **Register a new versioned patch ID:** Add `sampled_<your_instrument>_v1: <programNumber>` to `programs` in `static/js/theory/sampled_sound_capabilities.js` (keep existing `sampled_*_v1` mappings unchanged so saved songs keep their sound).
3. **Add an instrument card:** Add a `pitched(...)` entry in `static/js/theory/instrument_catalogue.js` (optional icon SVGs live in `static/assets/instruments/`).

> Check `NOTICES.md` and `static/vendor/sampled-piano/GeneralUser-GS-LICENSE.txt` if you redistribute modified or replacement SoundFonts.

### B. Tweaking synthesized voices & drum kits

- **Browser Web Audio synths & drum kits:** `static/js/audio/voices.js`, `static/js/audio/sampler.js` and `static/js/audio/engine.js`.
- **Python offline WAV synth & −3 dBFS safety limiter:** `src/audio_engine/dsp.py` and `src/audio_engine/events.py`.
- **Shared patch parameters:** `presets/patches.json`.

Run the ceiling and audio tests after changing synth levels:

```bash
python app.py --smoke-test
python -m pytest tests/test_audio_engine.py -q
```

---

## 4. Adapt controls, accessibility, and visuals

MusicLab was built so people with different motor, sensory and reading preferences can participate:

- **Main guided flow & pads:** `static/ui/stages/play_flow.js` orchestrates **Listen and explore**, the 8 live pads (`A S D F G H J K`), **Make my tune**, **Refine notes** and saving/exporting.
- **Two-switch scanning & keyboard navigation:** `static/ui/scan_model.js` drives single-/two-switch scanning (`Space` to step, `Enter` to choose) and focus grouping.
- **Sensory comfort & read-aloud settings:** `static/ui/comfort.js` manages reduced motion, larger targets, silent presses, spoken prompts and volume lock.
- **Visualizers & theme styling:** `static/ui/live_score_visualizer.js`, `static/ui/particles.js` and `static/css/studio.css`.
- **Humming input ("Hum an idea"):** `static/js/audio/pitch_capture.js` performs local pitch detection in the browser (up to 8 seconds, started only on explicit button press).

---

## 5. Song file format (`.musiclab.json`)

Downloaded editable songs are plain UTF-8 JSON validated by `static/js/project_validation.js` (browser) and `src/song_store/store.py` (Python). Inspect `examples/three-beat-song.musiclab.json` to see how sections, tracks, note provenance (`performed` vs generated backing) and preserved original takes are stored.

---

## 6. Optional bundling & self-hosting (`hosting/`)

Local use needs no bundler. If you host MusicLab on the web and want to collapse the startup ES module graph into content-hashed bundles or serve the >25 MiB full SoundFont on Cloudflare Workers Static Assets:

- Read [`hosting/BUNDLING.md`](hosting/BUNDLING.md) for deterministic `esbuild` entry bundling (`hosting/bundle_entry.cjs`).
- Use `hosting/stage-musiclab-cloudflare.mjs` and `hosting/musiclab-worker.mjs` to stage a static deployment directory complete with strict `Content-Security-Policy` script hashes, zero-analytics headers, and `< 25 MiB` SoundFont shard or R2 streaming.
