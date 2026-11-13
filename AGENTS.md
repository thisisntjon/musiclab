# Instructions for Coding Agents & Harnesses (`AGENTS.md`)

Welcome! MusicLab is a free, local-first browser musical instrument designed so people who felt shut out of traditional instruments, notation, or complex DAWs — including disabled players, switch/keyboard users, children, and beginners — can explore styles, shape melodies, and make music that comes from them.

Many people opening MusicLab in an AI coding harness (Claude Code, Codex, Cursor, Antigravity, Gemini CLI, GitHub Copilot, Windsurf) are **parents, teachers, carers, therapists, musicians, or first-time GitHub users**, not full-time software engineers.

---

## 1. How to collaborate with the person using you

- **Use plain, warm, low-jargon language** unless the user clearly asks for deep technical detail. Explain *what* you changed, *which file* you touched, and *how they can try it in their browser* (including reminding them to hard-refresh `Ctrl+Shift+R` / `Cmd+Shift+R` if browser caching holds onto an old `.js` file).
- **Make one clean, reversible change at a time** rather than rewriting unrelated modules.
- **Remind the user to test audio changes at low device volume first.**

---

## 2. Core invariants you MUST preserve

Never break these principles unless the user explicitly asks in their private fork and understands the trade-off:

1. **Player authorship stays sacred:** Never silently overwrite a person's performed notes (`provenance`) with generated notes and credit the result to them. Keep **Original** and **Undo** working.
2. **Safe, gesture-gated sound:** Sound must never autoplay on page load. Keep the `−3 dBFS` ceiling ([`static/js/audio/master_bus.js`](static/js/audio/master_bus.js) and [`src/audio_engine/dsp.py`](src/audio_engine/dsp.py)) and immediate `Escape` / **Stop sound** working.
3. **Zero external network calls:** Do **not** add external CDNs, fonts, analytics, cloud APIs, or remote speech/AI endpoints. Hosted CSP enforces `connect-src 'self'`, and Python uses **only the Python 3.11+ standard library**.
4. **Accessibility is first-class, never optional:**
   - Every control on the main route must work with keyboard focus and **untimed two-switch scanning** (`Space` steps, `Enter` chooses — [`static/js/theory/scan_model.js`](static/js/theory/scan_model.js)).
   - Never introduce countdown timers, timed reflexes, or drag-only controls without a button/arrow-key alternative.
   - Respect **Calm** / `prefers-reduced-motion` / `forced-colors` ([`static/js/theory/comfort.js`](static/js/theory/comfort.js)), local-only speech (`localService === true` in [`static/js/audio/speech.js`](static/js/audio/speech.js)), max-3-options-per-group layout, and short plain-language prompts (checked by [`static/js/theory/plain_language.js`](static/js/theory/plain_language.js)).
5. **Saved-song compatibility:**
   - Append new style IDs in [`static/js/theory/scene_catalogue.js`](static/js/theory/scene_catalogue.js) rather than renaming or reordering existing entries.
   - Append new versioned `sampled_<name>_v1` patch IDs in [`static/js/theory/sampled_sound_capabilities.js`](static/js/theory/sampled_sound_capabilities.js) rather than changing existing program numbers.
   - Never regenerate [`tests/js/theory/composer-v5-golden.json`](tests/js/theory/composer-v5-golden.json) just to silence a failing saved-song stability test.

---

## 3. Zero-build architecture & fast file map

- **Local source editing:** the release entry loads checked bundles. Switch its module script to `./ui/app.js` for no-build development, as described below; raw-module edits do not alter generated bundles.
- **Run locally:** `python app.py` (serves `http://127.0.0.1:8765`, loopback-only) or Windows `launch.cmd`, or static mode `python -m http.server 8790 --bind 127.0.0.1 --directory .` (`http://127.0.0.1:8790/static/index.html`).

### Where to make common customizations

- **Default comfort switches (`Calm`, `Bigger buttons`, `Sound on Play`, `Read out loud`):** [`static/js/theory/comfort.js`](static/js/theory/comfort.js) (`COMFORT_DEFAULTS`).
- **Keyboard shortcuts, USB switch keys (`Space`/`Enter`), 8 live pads (`A–K`), octave (`Z`/`X`), and main UI stages:** [`static/ui/stages/play_flow.js`](static/ui/stages/play_flow.js) (see `_onKey(ev)` for key handling and `_liveJamPads()` for pad notes).
- **Unlocking any of the 128 General MIDI instruments:**
  1. [`static/js/audio/sampled_bank_delivery.js`](static/js/audio/sampled_bank_delivery.js) — switch `SAMPLED_DELIVERY` from the 9 MB 17-preset bank (`GeneralUser-GS-2.0.3-MusicLab17-v1.sf2`) to the bundled full 32.3 MB 128-preset bank (`GeneralUser-GS-2.0.3.sf2`, `32319396` bytes, SHA-256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`), or recompute `bytes` + `sha256` for a custom `.sf2`.
  2. [`static/js/theory/sampled_sound_capabilities.js`](static/js/theory/sampled_sound_capabilities.js) — add `sampled_<instrument>_v1: <gmProgram0to127>`.
  3. [`static/js/theory/instrument_catalogue.js`](static/js/theory/instrument_catalogue.js) — add a `pitched(...)` instrument card.
- **78 connected styles & backing harmony:** [`static/js/theory/scene_catalogue.js`](static/js/theory/scene_catalogue.js), [`static/js/theory/music_circle.js`](static/js/theory/music_circle.js), [`static/js/theory/phrase_harmony.js`](static/js/theory/phrase_harmony.js), and `*_scene.js` / `*_form_score*.js` in `static/js/theory/`. (Follow the 5-step checklist in [`CONTRIBUTING.md`](CONTRIBUTING.md).)
- **Tune Wheel ("Make my tune") composers:** [`static/js/theory/melody_composer_v5.js`](static/js/theory/melody_composer_v5.js) through [`static/js/theory/melody_composer_v9.js`](static/js/theory/melody_composer_v9.js), [`static/js/theory/melody_genre_profiles_launch.js`](static/js/theory/melody_genre_profiles_launch.js), [`static/js/theory/melody_phrase_library_v1.js`](static/js/theory/melody_phrase_library_v1.js), and [`static/ui/melody_field_session.js`](static/ui/melody_field_session.js).
- **Web Audio & Python synths:** [`static/js/audio/voices.js`](static/js/audio/voices.js), [`src/audio_engine/synth.py`](src/audio_engine/synth.py), [`src/audio_engine/dsp.py`](src/audio_engine/dsp.py), [`presets/patches.json`](presets/patches.json).
- **Visual styling, focus rings, `.pf-bigger`, `.pf-less-motion`:** [`static/css/studio.css`](static/css/studio.css).
- **Optional production bundling & Cloudflare Workers hosting:** [`hosting/BUNDLING.md`](hosting/BUNDLING.md). If you change files in a fork and use `hosting/stage-musiclab-cloudflare.mjs`, regenerate `MANIFEST.json` SHA-256 entries first so package verification passes.

---

## 4. Verification commands (run after edits)

```bash
# Fast end-to-end render + -3 dBFS ceiling smoke check (~3 seconds)
python -B app.py --smoke-test

# Targeted JS test (fast) or full JS suite (1,234 tests)
node --test "tests/js/**/*.test.mjs"

# Full Python suite (167 tests)
python -B -m pytest -q
```


## Released bundle and local edits

The released page loads the checked, content-hashed app and melody-worker bundles. The original modules are retained beside them. To customize the source locally, change the module script in `static/index.html` from `./ui/app.<hash>.bundle.js` to `./ui/app.js` before trying your edits. No bundler is required for that development route. Do not assume edits to raw modules change an already generated bundle.

For release packaging, rebuild and verify the bundles using `hosting/BUNDLING.md`, or deliberately use and test the modular entry. Preserve sound assets and saved-song identity. The shipped `BUNDLE-PROVENANCE.json` identifies the original verified release inputs; source changes invalidate that record.
