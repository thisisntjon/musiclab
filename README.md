# MusicLab

A free, open instrument for people who believe they "aren't musical".

Press **Listen and explore**, steer the musical circle, and join with the eight pads or their letter keys. Press **Make my song** to keep the performed moment, then shape parts, revise notes, save an editable song and download audio.

Generated backing and your performed notes retain separate origins. Optional Adjust and Make it nicer edits can change musical material; use Undo to restore the prior version. Download an editable song file as a backup: WAV audio alone cannot reopen the notes.

> **Where it has been tried.** Chrome and Edge on Windows, in desktop and phone-sized windows, with mouse, keyboard only and two-switch scanning (Space moves, Enter chooses). On a first visit music starts on built-in sounds while the full sounds load, and the full sounds join at the next bar. Not yet tested: Safari, Firefox, phones and tablets as physical devices, real switch hardware. The catalogue is a set of original, connected styles, not all of music. The bundled sound bank's origin is described in `NOTICES.md`. Technical checks do not establish listening quality or suitability for a particular person.

## What it's built around

- **Your notes are yours.** Changes reshape what you played. They never replace it and call the result yours. Your original take is saved with the song.
- **No countdowns.** Nothing asks you to hurry. (The optional humming feature records up to 8 seconds.)
- **Safe sound.** Sound starts only when you press something. Music is capped at −3 dBFS. **Stop sound** or Escape silences everything.
- **Many ways in.** Touch, mouse, keyboard, or two-switch scanning (Space moves, Enter chooses). Settings for read-aloud prompts, bigger controls, less motion, silent presses and a volume lock.
- **Private.** It runs on your own computer and listens on 127.0.0.1 only. Nothing is uploaded and there's no account. The microphone is used only when you press Hum.

## Run it

You need Python 3.11 or newer and a web browser. The app uses only the Python standard library.

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

## Try the supported route

Press **Listen and explore**. The band starts, and the circle shows where you are among the styles. Drag the dot, use the arrow keys, or open **Choose without dragging** for Previous style, Next style and Next family. Tap a pad or play A to K to join in. The band plays your phrase back; after you rest, it says one thing it heard and offers one move, which you can take or leave. How you play also steers Next family: play a lot and it picks a busier style, hold notes and it picks a calmer one. Undo brings any change back. The optional Beat cycle disclosure on the start screen chooses three beats for a new song; the default is four.

Press **Make my song** to keep the moment. Play with your tune in the whole-band view, try an optional melody idea, then build Start, Big moment and Ending. Develop the selected Big moment and choose an ending. Shape shows the chapters; move, copy or remove a whole chapter, or open its notes for detailed edits. Long chapters contain several pages; the song supports eight underlying pages. **Make it nicer** offers three ideas at a time; Keep as is and Undo are always there. **Share** saves an editable song file in this browser and downloads a WAV. `examples/three-beat-song.musiclab.json` is an original generated demonstration, not a human performance; import it to inspect and edit its independent parts.

## Recover your work

Your playing is kept when you press **Make my song**. Until then it is only in the open page: the browser asks before you leave, but a crash, or a phone that skips the question, loses it. Stop sound or Escape silences everything. If the full sounds fail to load, the music keeps going on built-in sounds, a line under the music says so, and Help (inside More) offers **Load sounds again**. Download an editable backup before clearing browser data. After a page reload, your saved songs and any unfinished draft are listed under **Your songs** on the start screen. If the local server is unavailable, reopen `launch.cmd`. Do not overwrite or delete your song files to repair playback.

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
| Browser app (UI, audio, music logic) | `static/` |
| Python engine and local server | `src/`, `app.py` |
| Tests | `tests/` |
| Sound presets | `presets/` |
| Credits and licences | `NOTICES.md`, `LICENSE` |

## Help shape it

There is no feedback channel for this first release. If you are reading this in a place that has an issue tracker, that tracker is the way to tell us what worked, what got in the way, or what you made. We especially want to hear from people who think they aren't musical; teachers, carers and support workers; disabled musicians and assistive-technology users; and sound designers, since the sound engine is the biggest open problem. Code contributions: see `CONTRIBUTING.md`.

## Licence

Original application code: MIT. Bundled third-party code and sounds have separate terms; see `LICENSE`, `NOTICES.md` and the license files in `static/vendor/sampled-piano/`.
