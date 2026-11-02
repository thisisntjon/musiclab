# MusicLab

A free, open-source browser instrument for people who believe they "aren't musical".

> **Status: Early, in development.** MusicLab runs locally in your browser or with a zero-dependency Python standard-library server. The genre circle includes 74 named musical interpretations across ten families plus four foundational arrangements, a scored continuous blend across the Ska–Rocksteady–Reggae sector, and a separate six-region continuous field. Automated checks verify event preservation, timing and audio ceilings, not subjective musical quality or suitability for every person. Beginner observation studies remain ahead.

## Start with the music, not the instrument

Press **Listen** and a band is already playing. Drag around the circle, use the arrow keys, or open **Choose without dragging** to steer across musical styles. Changes take effect at musical boundaries without cutting off the beat.

Join in using the **eight scale keys (`A` through `K`)** with home chord tones visibly marked and **`Z` / `X`** to shift octaves (or the four drum pads). Played notes anchor the band's next bar on your pitch, rapid playing builds drum and bass energy toward a roll and drop, and **Band answers me** replies on reserved voices while keeping your own performance intact.

When you hear a moment you like, press **Make my song**. The music keeps playing as the song view opens (`Find → Play → Shape → Detail → Share`), where a live companion sheet of music writes itself from what plays, a whole-song timeline lets you drag anywhere to play from there, you can shape Beginning / Main / Ending sections, drag notes directly in pitch, time and length on the Detail picture while hearing them live, undo, save in your browser, download standard **MusicXML 4.0** (`Download sheet`) or reopen a MusicXML/JSON file, or export a stereo `.WAV` audio file (`Download audio`).

## What it's built around

- **Anything you make with MusicLab is yours.** Your performed notes, timing and held durations are recorded with their origin (`note_origins`) and never silently replaced by generated material. You own the songs and audio files you create.
- **No AI-generated audio.** The band runs on deterministic musical rules and Web Audio synthesis/sampling on your device. There are no prompt boxes, no model calls, and no cloud services.
- **Nothing essential is timed.** There are no countdowns or forced quizzes.
- **Safe, deliberate sound.** Loading is silent; sound starts only when you press **Listen**, **Play** or a pad. Output is capped at −3 dBFS, **Stop sound** (or `Escape`) silences everything immediately, and **Calm** removes moving lights.
- **Many ways in.** Touch, mouse, keyboard, or two-switch scanning (`Space` moves, `Enter` chooses).
- **Private and local.** Static mode makes zero external network requests. The local Python server listens on `127.0.0.1` only and refuses cross-site requests.

## Run it

### Option 1: Static mode (any static web server, no backend required)

Composition, genre exploration, live playing, local saving and browser `.WAV` export all run directly in the browser:

```bash
python -m http.server 8790 --bind 127.0.0.1 --directory .
```

Then open `http://127.0.0.1:8790/static/index.html` (or `http://127.0.0.1:8790/`).

### Option 2: Local Python studio server

Requires Python 3.11 or newer (uses only the Python standard library):

```bash
python app.py
```

By default, `python app.py` starts the local studio server at `http://127.0.0.1:8765`. On Windows, you can double-click `launch.cmd`, which starts the local server on port 8777 (`http://127.0.0.1:8777/`) and opens your browser.

Songs saved in static mode stay in that browser profile. Download the editable `.json` project file (`Save song file`) as a backup if you want to move a song to another device; a `.WAV` file alone cannot be reopened for note editing.

## Test it

For development and verification you need Python (`pytest`) and Node.js 20+ (uses the built-in `node --test` runner):

```bash
python -m pytest -q
node --test "tests/js/**/*.test.mjs"
python app.py --smoke-test
```

The smoke test compiles and renders a song and checks the −3 dBFS safe-sound ceiling. An in-browser self-test is also available at `http://127.0.0.1:8790/static/index.html?selftest=1`.

## Where things are

| What | Where |
| --- | --- |
| Browser app (UI, Web Audio scheduler, musical spectrum & theory) | `static/` |
| Python engine and local `127.0.0.1` server | `src/`, `app.py` |
| Automated test suites (Python & JavaScript) | `tests/` |
| Starter presets and examples | `presets/`, `examples/` |
| Credits, third-party notices and licence | `NOTICES.md`, `LICENSE` |

## Help shape it

Open an issue to tell us what worked, what got in the way, or what you made. We especially want to hear from people who were told they "aren't musical", music teachers, carers and support workers, disabled musicians and assistive-technology users, and Web Audio / sound designers. See `CONTRIBUTING.md`.

## Licence

Original application code: MIT (`LICENSE`). Bundled third-party code (`SpessaSynth`, Apache-2.0) and the `GeneralUser GS 2.0.3` sound bank have separate terms and disclosures; see `NOTICES.md` and `static/vendor/sampled-piano/`.
