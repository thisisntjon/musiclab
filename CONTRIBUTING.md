# Contributing to MusicLab

Thank you for helping. MusicLab is early, and the most useful thing you can give it is honest feedback from real use. Please read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) so we keep this repository welcoming for everyone.

## Ways to help without writing code

You do **not** need to be a programmer or a trained musician to contribute. Open an issue in this repository's **Issues** tab on GitHub (plain-language templates are provided) and tell us:

- **How you were playing** (please do **not** share real names or medical diagnoses — just tell us what access setup you used, such as touch, mouse, keyboard only, two-switch scanning, screen reader, or playing alongside a parent/teacher/carer);
- **What you were trying to do**;
- **What felt good, and where you got stuck** (for example: a button label that wasn't clear, a focus jump, a sound that startled someone, or a control that required too much precision).

If you are adapting MusicLab for your own setup, classroom, or remix, see [`ACCESSIBILITY.md`](ACCESSIBILITY.md) and [`CUSTOMIZING.md`](CUSTOMIZING.md).

## Contributing code

- **Keep the app local:** no external network requests, CDNs, analytics beacons, or cloud services.
- **Zero extra Python dependencies:** Python code uses the standard library only.
- **Protect accessibility & core principles:**
  - A person's notes are never silently replaced and credited to them.
  - Nothing essential is timed or scored.
  - Sound starts only after a press and respects the `−3 dBFS` ceiling and `Escape` / **Stop sound**.
  - Every new control works with keyboard focus and untimed two-switch scanning (`Space` + `Enter`), avoids drag-only traps, and keeps user-facing wording plain and short (checked by [`static/js/theory/plain_language.js`](static/js/theory/plain_language.js)).
- **Run the tests before opening a pull request:**

```bash
python -m pytest -q
```

```bash
node --test "tests/js/**/*.test.mjs"
```

```bash
python app.py --smoke-test
```

By contributing you agree your work is released under the MIT licence.

## Adding a style without changing saved songs

Style behavior and instrument sound are separate. A style defines rhythm, harmony, phrasing and development; a patch realizes those notes. Preserve personal notes, performed timing, held durations and provenance.

1. Inspect [`static/js/theory/scene_catalogue.js`](static/js/theory/scene_catalogue.js) and the relevant scene implementation. Add a stable id; do not reorder or rename existing catalogue entries.
2. Describe the actual backing harmony in [`static/js/theory/phrase_harmony.js`](static/js/theory/phrase_harmony.js). Long forms need the correct harmony for each four-bar block. Do not change an existing band's chords simply to satisfy the melody composer.
3. Add a versioned rhythm/profile definition. Existing `GENRE_PROFILES` in [`static/js/theory/melody_composer_v5.js`](static/js/theory/melody_composer_v5.js) and admitted launch profiles in [`static/js/theory/melody_genre_profiles_launch.js`](static/js/theory/melody_genre_profiles_launch.js) define saved behavior. Changes to shared composer functions, source phrases or old profiles require an explicit compatibility strategy, not silent regeneration.
4. Prove the new style reaches the real Jam-to-Melody route, fits the backing, offers distinct coherent choices and keeps the backing unchanged during comparison. Scale membership alone is not musical acceptance. Use matched listening examples as well as event tests.
5. Verify Original, Undo, Keep, personal holds, save/reopen, export and a fallback when a route is unsupported. Retain the exact candidate and sound-bank fingerprints.

[`tests/js/theory/composer-v5-saved-songs-stable.test.mjs`](tests/js/theory/composer-v5-saved-songs-stable.test.mjs) pins the earlier supported wheels. Never refresh its golden file merely to pass a failing test. New launch profiles need the same compatibility care even where that particular fixture does not cover them. See [`tests/js/theory/genre-fit-composer-v5.test.mjs`](tests/js/theory/genre-fit-composer-v5.test.mjs) for harmony, form-block and output checks.

Do not add external assets without checking their redistribution terms and updating [`NOTICES.md`](NOTICES.md). Put model, timing or range constraints in implementation and tests; keep the user-facing language simple.
