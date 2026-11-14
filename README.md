# MusicLab

A free, open instrument for people who believe they "aren't musical" — and for anyone for whom traditional instruments or music software weren't accessible.

- **Play right now in your browser (nothing to install):** https://musiclab.simoneresearch.com/
- **Brand new to GitHub or coding? Start here (includes AI harness remix ideas):** [`START_HERE.md`](START_HERE.md)
- **Accessibility, keyboard, switch & sensory guide:** [`ACCESSIBILITY.md`](ACCESSIBILITY.md)
- **Short guide for parents, carers & teachers:** [`static/parents.html`](static/parents.html) (online: https://musiclab.simoneresearch.com/static/parents.html)
- **Customize or adapt MusicLab (including gentle 5-minute edits):** [`CUSTOMIZING.md`](CUSTOMIZING.md)
- **Share feedback or contribute:** [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- **Security, privacy & credits:** [`SECURITY.md`](SECURITY.md) · [`NOTICES.md`](NOTICES.md)

---

## How it feels to play

Press **Listen and explore**, steer the circle through 78 connected styles (listed in [`static/js/theory/scene_catalogue.js`](static/js/theory/scene_catalogue.js)), and join in with the eight pads or their letter keys (`A S D F G H J K`). Press **Make my tune** to open the tune wheel: move it to hear different tunes over the same band, each written for the style you picked. Press **Change the sound** to open the Sound wheel and choose who plays your tune: 33 instruments in 9 groups, from piano and steel pan to violins, trumpet, banjo and bass flute. Keep the one you like, then save an editable song and download audio.

Generated backing and your performed notes retain separate origins. Optional Adjust and Make it nicer edits can change musical material; use Undo to restore the prior version. Download an editable song file (`.musiclab.json`) as a backup: WAV audio alone cannot reopen the notes.

> **Where it has been tried.** Chrome and Edge on Windows, in desktop and phone-sized windows, with mouse, keyboard only and two-switch scanning (`Space` moves, `Enter` chooses). On a first visit music starts on built-in sounds while the full sounds load, and the full sounds join at the next bar. Not yet tested: Safari, Firefox, phones and tablets as physical devices, real switch hardware. The catalogue is a set of original, connected styles, not all of music. The bundled sound bank's origin is described in [`NOTICES.md`](NOTICES.md). Technical checks do not establish listening quality or suitability for a particular person.

---

## What it's built around

- **Your notes are yours.** Changes reshape what you played. They never replace it and call the result yours. Your original take is saved with the song.
- **No countdowns.** Nothing asks you to hurry. (The optional humming feature records up to 8 seconds.)
- **Safe sound.** Sound starts only when you press something. Music is capped at −3 dBFS. **Stop sound** or `Escape` silences everything immediately, and **Lock volume** prevents accidental volume jumps.
- **Many ways in.** Touch, mouse, keyboard, or untimed two-switch scanning (`Space` moves, `Enter` chooses), plus button alternatives (**Choose without dragging** and **Move with buttons**) for every drag gesture; on the Sound wheel every group and sound is itself a button. Settings include **Read out loud** (using on-device voices only), **Bigger buttons**, **Calm** (less motion), **Sound on Play** (silent presses while choosing), and **Moving lights**. See [`ACCESSIBILITY.md`](ACCESSIBILITY.md) for the full setup guide.
- **Private song work.** Notes and saved songs stay in this browser unless you download or share them. A hosted copy still requests app and sound files from its host. The local Python server listens on `127.0.0.1`. There is no account. The optional microphone starts only when you press **Hum**.

---

## Three ways to use MusicLab

### 1. Play online right away (no installation)

Open https://musiclab.simoneresearch.com/ in a modern desktop or mobile web browser. Everything runs locally in your browser tab with no sign-up.

### 2. Download a ZIP to run offline on your own computer (no Git needed)

If you want an offline copy for home, a classroom, or a therapy room without using developer tools:

1. Click the green **Code** button near the top of this GitHub page and choose **Download ZIP**, then unzip the folder.
2. Make sure [Python 3.11 or newer](https://www.python.org/downloads/) is installed (MusicLab uses only Python's built-in standard library — there are no extra packages to install).
3. **On Windows:** Double-click **`launch.cmd`** inside the folder. It starts MusicLab and opens your browser automatically.
4. **On macOS or Linux:** Open Terminal inside the unzipped folder, run `python3 app.py`, and open http://127.0.0.1:8765 in your browser.

### 3. Run from the command line or static server (for tinkering & remixing)

The downloaded release runs immediately using a checked bundle. Before editing JavaScript, switch to the no-build source entry using [the customization setup](CUSTOMIZING.md#before-your-first-edit). Then edit, save, and refresh:

```bash
python app.py
```

Then open http://127.0.0.1:8765.

Static mode, without the MusicLab server (composition, playback, local saving and WAV export all run in the browser):

```bash
python -m http.server 8790 --bind 127.0.0.1 --directory .
```

Then open http://127.0.0.1:8790/static/index.html.

Songs saved in the browser stay in that browser profile. Download the editable song file (`.musiclab.json`) as a backup; a WAV alone can't be reopened for editing.

---

## Try the main route

1. Press **Listen and explore**. The band starts, and the circle shows where you are among the styles. Drag the dot, use the arrow keys, or open **Choose without dragging** to pick a style by name or step to the next style or family.
2. Tap a pad or use `A`, `S`, `D`, `F`, `G`, `H`, `J` and `K` to join in (`Z` and `X` shift the pads lower or higher). The pads follow the current musical context. Optional **Note names** shows their pitches. How you play also steers **Next family**: play a lot and it picks a busier style, hold notes and it picks a calmer one.
3. Press **Make my tune**. The tune wheel opens with the band still playing and the notes shown beside it. Drag toward **Bright hook**, **Smooth flow**, **Crisp bounce** or **Wide space**; the tune changes at a musical boundary and the band stays the same. **Original** goes back to the tune you arrived with, **Undo move** steps back once, and **Explore** moves the wheel for you. **Move with buttons** does the same without dragging. The **Tune wheel** and **Sound wheel** tabs above the wheel switch between the two.
4. Press **Sound wheel** (or **Change the sound** on the jam screen). Turn the wheel to hear each of the 9 groups (Keys, Bells, World, Guitars, Strings, Voices, Wind, Horns and Synths), then let go to see that group's sounds and pick one. The tune stays the same; only the instrument playing it changes, except that **Bass flute** plays it an octave lower, as a real bass flute does. **Own sound** in the middle goes back to the tune's first sound, **All groups** in the middle of a group shows the groups again, and **Undo move** takes back a choice. With keys, the arrows step round the wheel and `Home` picks **Own sound**; `Tab` and `Enter`, or two switches, reach every group and sound.
5. Press **Keep this melody**. Keep saves the tune in the sound you heard, and **Back to jam** carries on in that sound. On the save screen, name the song, press **Save here** to keep it in this browser, and use **Download editable song** for a backup you can reopen. **Download audio** gives a WAV.

In fresh House, Reggae, Soul, Ska, Rocksteady and Swing sessions, moving outward develops the same idea through **Light**, **Theme**, **Breathe** and **Return**. Breathe can add a pause before the ending; Return brings the opening rhythm back. The core notes stay while phrasing changes. Moving around hands over parts of the phrase between ideas. These are stepped musical choices, not continuous sound synthesis; other styles retain their existing tune patterns. Saved songs keep the version of the tune wheel they were made with. The wheel changes the tune; bass, chords and beat notes stay fixed. **Softer band** is a separate mix choice.

The first sampled download is about 11.7 MB (`GeneralUser-GS-2.0.3-MusicLab36-v1.sf2`, 11,699,936 bytes) and holds the 36 sampled programs the app uses, 33 of them on the Sound wheel. **Bass flute** is the bank's Flute sounding one octave below the written notes; saved songs and the score keep the written notes. The Sound wheel's loudness levels were matched by measurement in two styles, not by a listening test; Violins start slowly, so fast tunes can blur a little on them. The Sound wheel changes the tune only; there is no bass or drum wheel yet, and bands with note edits only show its card as not ready. The earlier 17-program bank (`GeneralUser-GS-2.0.3-MusicLab17-v1.sf2`, about 9 MB) stays bundled for pages opened before the change and for rollback, and the complete 128-instrument GeneralUser GS 2.0.3 bank (`GeneralUser-GS-2.0.3.sf2`, 32.3 MB) is bundled in `static/vendor/sampled-piano/` for reproducibility and custom instrument forks; the app downloads neither of them.

Every catalogue style has its own tune patterns. In the longer styles (twelve-bar blues, jazz, rock and metal forms and a few others) the wheel works on the four bars the band is playing when you press **Make my tune**. Classic Jam, three-beat songs, a kept custom band and the six-style slide still use the older wheel, which varies the notes you already have instead of offering new tunes; the line under the Jam buttons says which one you will get.

**Refine notes** opens single-note editing, and **Go deeper** holds the older song-building tools (parts, chapters, Make it nicer). They work, but the route above is the one this release was polished and checked around. [`examples/three-beat-song.musiclab.json`](examples/three-beat-song.musiclab.json) is an original generated demonstration, not a human performance; import it to inspect and edit its independent parts.

---

## Recover your work

Press **Keep this melody** to keep the chosen tune and its backing. While built-in loading sounds are playing, complete-melody Keep and Refine wait for the full sounds to reach playback. **More ways** opens so **Save played take** can keep exactly what played, including those built-in sounds. Stop or a late download does not make an unheard full sound eligible; press Play to hear it first. The original performance is retained separately; Keep does not save every alternative you auditioned as the new tune. Press **Save here** and download an editable backup before closing. Unkept live playing is not crash-safe: a leave warning cannot recover it after a crash. Stop sound or `Escape` silences everything. If the full sounds fail to load, the music keeps going on built-in sounds, a line under the music says so, and **Help** offers **Load sounds again**. Download an editable backup before clearing browser data. After a page reload, your saved songs and any unfinished draft are listed under **Your songs** on the start screen. If the local server is unavailable, reopen `launch.cmd`. Do not overwrite or delete your song files to repair playback.

The three-beat route uses individual-note editing and guided song parts. The older advanced section arranger and optional humming/grid-shape tools are not supported for that cycle. Sampled voices require browser WAV export; the Python renderer refuses them rather than substituting sounds. Sound can outlast the final musical step because exports retain release tails.

---

## Where things are

| What | Where |
| --- | --- |
| Beginner guide to GitHub & tweaking with AI coding harnesses | [`START_HERE.md`](START_HERE.md), [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md) |
| Accessibility, switch, keyboard & comfort setup guide | [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`static/parents.html`](static/parents.html) |
| Customization & adaptive hardware remix guide | [`CUSTOMIZING.md`](CUSTOMIZING.md) |
| 78 connected styles, circle geometry, melody composers (`v4`–`v9`), harmony, comfort & scan logic | [`static/js/theory/`](static/js/theory/) |
| Web Audio synth voices, SpessaSynth SoundFont sampler, local speech & humming capture | [`static/js/audio/`](static/js/audio/) |
| Main `PlayFlow` interface, tune wheel, Sound wheel (`MELODY_SOUNDS` in `static/ui/melody_field_session.js`), live score visualizer & CSS styles | [`static/ui/`](static/ui/), [`static/css/studio.css`](static/css/studio.css) |
| Visual effects & reduced-motion particle helpers | [`static/js/visual/`](static/js/visual/) |
| Bundled SoundFonts (the 36-program web bank, about 11.7 MB; the earlier 17-program bank, about 9 MB; and the full 128-program GeneralUser GS 2.0.3 bank, 32.3 MB) | [`static/vendor/sampled-piano/`](static/vendor/sampled-piano/) |
| Python standard-library server, local song store, theory mirror & offline synth renderer | [`src/`](src/), [`app.py`](app.py), [`launch.cmd`](launch.cmd) |
| Synth patch definitions, starter presets & example `.musiclab.json` song | [`presets/`](presets/), [`examples/`](examples/) |
| Optional entry bundler & Cloudflare Workers static hosting stage | [`hosting/`](hosting/) |
| Automated test suites (JavaScript `node --test` and Python `pytest`) | [`tests/`](tests/) |
| Community, contribution, security & licence documents | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md), [`NOTICES.md`](NOTICES.md), [`LICENSE`](LICENSE) |

---

## Test it

For running automated tests, install `pytest` and Node.js:

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

---

## Help shape it

You do **not** need to write code to help MusicLab grow. Open an issue in this repository's **Issues** tab on GitHub (structured, screen-reader-friendly forms are waiting there) to tell us what worked, what got in the way, or what you made.

We especially want to hear from:
- people who think they "aren't musical";
- parents, teachers, carers, therapists and support workers;
- disabled musicians and keyboard, switch, or screen-reader users;
- sound designers and musicians who want to help refine the styles and mix.

For code contributions and new styles, see [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CUSTOMIZING.md`](CUSTOMIZING.md).

---

## Licence

Original application code: MIT. Bundled third-party code and sounds have separate terms; see [`LICENSE`](LICENSE), [`NOTICES.md`](NOTICES.md) and the license files in `static/vendor/sampled-piano/`.


## Released bundle and local edits

The released page loads the checked, content-hashed app and melody-worker bundles. The original modules are retained beside them. To customize the source locally, change the module script in `static/index.html` from `./ui/app.<hash>.bundle.js` to `./ui/app.js` before trying your edits. No bundler is required for that development route. Do not assume edits to raw modules change an already generated bundle.

For release packaging, rebuild and verify the bundles using `hosting/BUNDLING.md`, or deliberately use and test the modular entry. Preserve sound assets and saved-song identity. The shipped `BUNDLE-PROVENANCE.json` identifies the original verified release inputs; source changes invalidate that record.
