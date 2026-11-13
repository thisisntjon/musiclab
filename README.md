# MusicLab

A free, open instrument for people who believe they "aren't musical".

**Try the early web release:** https://musiclab.simoneresearch.com/ · **[Make it your own (`CUSTOMIZING.md`)](CUSTOMIZING.md)** · **[Contributing (`CONTRIBUTING.md`)](CONTRIBUTING.md)** · **[Security (`SECURITY.md`)](SECURITY.md)** · **[Credits & sound licences (`NOTICES.md`)](NOTICES.md)**

Press **Listen and explore**, steer the circle through 78 connected styles (listed in `static/js/theory/scene_catalogue.js`), and join in with the eight pads or their letter keys. Press **Make my tune** to open the tune wheel: drag it to hear different tunes over the same band, each written for the style you picked. Keep the one you like, then save an editable song and download audio.

Generated backing and your performed notes retain separate origins. Optional Adjust and Make it nicer edits can change musical material; use Undo to restore the prior version. Download an editable song file as a backup: WAV audio alone cannot reopen the notes.

> **Where it has been tried.** Chrome and Edge on Windows, in desktop and phone-sized windows, with mouse, keyboard only and two-switch scanning (Space moves, Enter chooses). On a first visit music starts on built-in sounds while the full sounds load, and the full sounds join at the next bar. Not yet tested: Safari, Firefox, phones and tablets as physical devices, real switch hardware. The catalogue is a set of original, connected styles, not all of music. The bundled sound bank's origin is described in `NOTICES.md`. Technical checks do not establish listening quality or suitability for a particular person.

## What it's built around

- **Your notes are yours.** Changes reshape what you played. They never replace it and call the result yours. Your original take is saved with the song.
- **No countdowns.** Nothing asks you to hurry. (The optional humming feature records up to 8 seconds.)
- **Safe sound.** Sound starts only when you press something. Music is capped at −3 dBFS. **Stop sound** or Escape silences everything.
- **Many ways in.** Touch, mouse, keyboard, or two-switch scanning (Space moves, Enter chooses). Settings for read-aloud prompts, bigger controls, less motion, silent presses and a volume lock.
- **Private song work.** Notes and saved songs stay in this browser unless you download or share them. A hosted copy still requests app and sound files from its host. The local Python server listens on 127.0.0.1. There is no account. The optional microphone starts only when you press Hum.

## Run it

You need Python 3.11 or newer and a web browser. The app uses only the Python standard library, and the browser code runs directly as unbundled ES modules with no build step required.

```bash
python app.py
```

Then open http://127.0.0.1:8765.

On Windows you can double-click `launch.cmd` instead; it starts the app and opens your browser.

Static mode, without the MusicLab server (composition, playback, local saving and export run in the browser):

```bash
python -m http.server 8790 --bind 127.0.0.1 --directory .
```

Then open http://127.0.0.1:8790/static/index.html.

Songs saved in the browser stay in that browser profile. Download the editable song file as a backup; a WAV alone can't be reopened for editing.

## Try the main route

1. Press **Listen and explore**. The band starts, and the circle shows where you are among the styles. Drag the dot, use the arrow keys, or open **Choose without dragging** to pick a style by name or step to the next style or family.
2. Tap a pad or use A, S, D, F, G, H, J and K to join in. The pads follow the current musical context. Optional Note names shows their pitches. How you play also steers Next family: play a lot and it picks a busier style, hold notes and it picks a calmer one.
3. Press **Make my tune**. The tune wheel opens with the band still playing and the notes shown beside it. Drag toward Bright hook, Smooth flow, Crisp bounce or Wide space; the tune changes at a musical boundary and the band stays the same. **Original** goes back to the tune you arrived with, **Undo move** steps back once, and **Explore** moves the wheel for you. **Move with buttons** does the same without dragging.
4. Press **Keep this melody**. On the save screen, name the song, press **Save here** to keep it in this browser, and use **Download editable song** for a backup you can reopen. **Download audio** gives a WAV.

In fresh House, Reggae, Soul, Ska, Rocksteady and Swing sessions, moving outward develops the same idea through **Light**, **Theme**, **Breathe** and **Return**. Breathe can add a pause before the ending; Return brings the opening rhythm back. The core notes stay while phrasing changes. Moving around hands over parts of the phrase between ideas. These are stepped musical choices, not continuous sound synthesis; other styles retain their existing tune patterns. Saved songs keep the version of the tune wheel they were made with. The wheel changes the tune; bass, chords and beat notes stay fixed. **Softer band** is a separate mix choice.

The first sampled download is about 9 MB (`GeneralUser-GS-2.0.3-MusicLab17-v1.sf2`) and retains all 17 mapped sampled instruments. The complete 128-instrument GeneralUser GS 2.0.3 bank (`GeneralUser-GS-2.0.3.sf2`, 32.3 MB) is also bundled in `static/vendor/sampled-piano/` for reproducibility and custom instrument forks; it is not downloaded alongside that smaller bank.

Every catalogue style has its own tune patterns. In the longer styles (twelve-bar blues, jazz, rock and metal forms and a few others) the wheel works on the four bars the band is playing when you press **Make my tune**. Classic Jam, three-beat songs, a kept custom band and the six-style slide still use the older wheel, which varies the notes you already have instead of offering new tunes; the line under the Jam buttons says which one you will get.

**Refine notes** opens single-note editing, and **Go deeper** holds the older song-building tools (parts, chapters, Make it nicer). They work, but the route above is the one this release was polished and checked around. `examples/three-beat-song.musiclab.json` is an original generated demonstration, not a human performance; import it to inspect and edit its independent parts.

## Recover your work

Press **Keep this melody** to keep the chosen tune and its backing. While built-in loading sounds are playing, complete-melody Keep and Refine wait for the full sounds to reach playback. **More ways** opens so **Save played take** can keep exactly what played, including those built-in sounds. Stop or a late download does not make an unheard full sound eligible; press Play to hear it first. The original performance is retained separately; Keep does not save every alternative you auditioned as the new tune. Press **Save here** and download an editable backup before closing. Unkept live playing is not crash-safe: a leave warning cannot recover it after a crash. Stop sound or Escape silences everything. If the full sounds fail to load, the music keeps going on built-in sounds, a line under the music says so, and Help (inside More) offers **Load sounds again**. Download an editable backup before clearing browser data. After a page reload, your saved songs and any unfinished draft are listed under **Your songs** on the start screen. If the local server is unavailable, reopen `launch.cmd`. Do not overwrite or delete your song files to repair playback.

The three-beat route uses individual-note editing and guided song parts. The older advanced section arranger and optional humming/grid-shape tools are not supported for that cycle. Sampled voices require browser WAV export; the Python renderer refuses them rather than substituting sounds. Sound can outlast the final musical step because exports retain release tails.

## Test it

For development you also need `pytest` and Node.js.

```bash
python -m pytest -q
```

```bash
node --test "tests/js/**/*.test.mjs"
```

```bash
python app.py --smoke-test
```

The smoke test renders a song and checks the −3 dBFS ceiling. The in-browser self-test page is being rebuilt and is not a way to confirm the app works in this release.

## Where things are

| What | Where |
| --- | --- |
| 78 connected styles, circle geometry, melody composers (`v4`–`v9`), harmony & instrument catalogue | `static/js/theory/` |
| Web Audio synth voices, SpessaSynth SoundFont sampler, bank loader, pitch capture & WAV export | `static/js/audio/` |
| Main `PlayFlow` interface, melody wheel canvas, live visualizer, two-switch scan & comfort settings | `static/ui/`, `static/css/` |
| Bundled SoundFonts (9 MB 17-instrument web bank + full 32.3 MB 128-program GeneralUser GS 2.0.3 bank) | `static/vendor/sampled-piano/` |
| Python standard-library server, local song store, theory mirror & offline synth renderer | `src/`, `app.py`, `launch.cmd` |
| Synth patch definitions, starter presets & example `.musiclab.json` song | `presets/`, `examples/` |
| Optional entry bundler & Cloudflare Workers static hosting stage | `hosting/` |
| Automated test suites (`1,234` JS tests + `167` Python tests) | `tests/` |
| Customization, contribution, security & licence guides | `CUSTOMIZING.md`, `CONTRIBUTING.md`, `SECURITY.md`, `NOTICES.md`, `LICENSE` |

## Make it your own

MusicLab ships unbundled so you can edit any style, melody generator, synth patch, instrument mapping or control layout and test your changes immediately on `http://127.0.0.1:8765`. Start with **[`CUSTOMIZING.md`](CUSTOMIZING.md)** for a tour of the extension points.

## Help shape it

Open an issue in this repository's **Issues** tab on GitHub to tell us what worked, what got in the way, or what you made. We especially want to hear from people who think they aren't musical; teachers, carers and support workers; disabled musicians and assistive-technology users; and sound designers who can help evaluate the mix and instrument behavior. Code contributions: see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licence

Original application code: MIT. Bundled third-party code and sounds have separate terms; see [`LICENSE`](LICENSE), [`NOTICES.md`](NOTICES.md) and the license files in `static/vendor/sampled-piano/`.
