# New to GitHub or Coding? Start Here

Welcome! If you found MusicLab because you are a parent, teacher, carer, therapist, musician, or curious beginner — and GitHub looks like an airplane cockpit full of unfamiliar buttons — **this page is for you**.

You do **not** need to know how to code to use MusicLab, to download your own offline copy, to ask a question, or even to customize how MusicLab works for you or someone you support.

---

## Part 1: GitHub in plain English (5 minutes)

GitHub is simply a website that holds a project's files, keeps a history of changes (so mistakes can always be undone), and gives people a shared place to talk and share improvements.

Here is what the main words on this page mean:

| Word on GitHub | Plain-English meaning | When to use it |
| --- | --- | --- |
| **Repository ("repo")** | This project folder and all its files. | You are looking at the MusicLab repository right now. |
| **Code → Download ZIP** | Downloads a normal `.zip` folder of MusicLab onto your computer. | Best when you want an offline copy on your computer with **no GitHub account** and **no developer tools**. |
| **Issues** | The feedback, question, and bug-report board. | Best when you want to tell us what worked, where someone got stuck, or ask for help. |
| **Fork** | Makes **your own personal copy** of MusicLab under your GitHub account. | Best when you want to experiment freely! Nothing you change in your Fork can ever break the main MusicLab project. |
| **Commit** | Saving a named checkpoint of your changes (like a save slot in a game). | Lets you step back to an earlier working version anytime. |
| **Clone** | Downloading a repository using the `git` tool so you can save commits and sync with GitHub. | Helpful once you start making several edits on your computer. |
| **Pull Request ("PR")** | Raising your hand to say: *"I made a helpful change in my Fork — would you like to bring it into the main project?"* | Optional — only when you want to share an improvement back with everyone. |

---

## Part 2: Four gentle ways to use GitHub (pick your comfort level)

### Level 1: Just play or run offline (no GitHub account needed)
1. **Play online immediately:** Open https://musiclab.simoneresearch.com/.
2. **Or grab an offline copy:** Click the green **Code** button near the top-right of the file list → click **Download ZIP** → unzip it on your computer.
   - Install [Python 3.11+](https://www.python.org/downloads/) if you don't have it yet.
   - On Windows, double-click **`launch.cmd`**. On Mac/Linux, open Terminal in that folder and run `python3 app.py`, then open http://127.0.0.1:8765.

### Level 2: Share feedback or ask a question in Issues (free GitHub account)
1. Create a free account on https://github.com/ if you don't have one.
2. Click the **Issues** tab near the top of this repository.
3. Click the green **New issue** button.
4. Pick **"Accessibility, comfort, or play feedback"** (or **"Something didn't work"**), fill in as much or as little as you want in everyday words, and click **Submit new issue**.

### Level 3: Make your own safe sandbox on GitHub ("Forking" + editing right in your browser)
Want to try changing a label or default setting without installing *any* coding tools?
1. Click the **Fork** button near the top-right of this repository and click **Create fork**. You now own a personal copy!
2. In your fork, click into a file — for example [`static/js/theory/comfort.js`](static/js/theory/comfort.js).
3. First follow [Before your first edit](CUSTOMIZING.md#before-your-first-edit) in your fork to switch `static/index.html` to the source entry. Then click the **pencil icon ("Edit this file")** in the top-right corner of the file box.
4. Change `bigger: false` to `bigger: true` (so **Bigger buttons** starts turned on), then click the green **Commit changes...** button to save your checkpoint.
5. Anytime you download a ZIP of *your* fork, it has your custom defaults built in — and if you ever make a mistake, click **History** on that file to see and restore what was there before.

### Level 4: Save checkpoints on your computer with GitHub Desktop (visual, no command line)
If terminal commands feel intimidating, install **[GitHub Desktop](https://desktop.github.com/)** (free for Windows and Mac):
1. Click **File → Clone repository**, pick your MusicLab fork, and choose a folder on your computer.
2. Double-click `launch.cmd` (or run `python3 app.py`) to open MusicLab in your browser.
3. Edit files, test in your browser, and use GitHub Desktop's visual list to save checkpoints (**Commit to main**) or undo any file with one right-click (**Discard changes**).

---

## Part 3: How to tweak MusicLab using popular AI coding harnesses

Because MusicLab offers a **no-build development route** (switch to the source entry first using [this short setup](CUSTOMIZING.md#before-your-first-edit)) and **over 1,400 automated safety tests**, it is a wonderful project to customize with an AI coding harness — even if you have never written JavaScript before.

We have also included an **[`AGENTS.md`](AGENTS.md)** (and **[`CLAUDE.md`](CLAUDE.md)**) guide right inside the project root. That means modern coding harnesses **automatically read MusicLab's map and safety rules** the moment you open the folder!

### Popular harnesses that work great with MusicLab

- **Visual / editor harnesses (easiest if you don't like terminals):**
  - **VS Code + GitHub Copilot** (open the folder in VS Code and use Copilot Chat / Agent mode)
  - **Cursor** or **Windsurf** (open the `musiclab` folder and type what you want in the side chat panel)
  - **Google Antigravity** (open the `musiclab` workspace and describe what you want to adapt in plain language)
- **Command-line harnesses (run inside the `musiclab` folder in Terminal / PowerShell):**
  - **Claude Code** (`claude`) — automatically reads `CLAUDE.md` and `AGENTS.md`
  - **OpenAI Codex CLI** (`codex`) — automatically reads `AGENTS.md`
  - **Gemini CLI** (`gemini`) — can read `AGENTS.md` for full repo context

### Your 3-step workflow with any harness

1. **Unzip or clone MusicLab** onto your computer, and open that folder in your chosen harness.
2. **Switch to the source entry** using [Before your first edit](CUSTOMIZING.md#before-your-first-edit), then **start MusicLab** (`launch.cmd` on Windows, or `python3 app.py` on Mac/Linux) and keep http://127.0.0.1:8765 open in your browser with your speaker volume low.
3. **Ask for one clear tweak at a time**, refresh your browser tab (`Ctrl+Shift+R` or `Cmd+Shift+R` so the browser loads your new file), and **listen with your own ears**.

---

## Part 4: Ready-to-copy prompt ideas you can paste into a harness

Copy any of the ideas below into your AI coding tool and adjust the details to fit you or the person you are supporting:

### Idea 1: Adapt keys for a USB switch box, foot pedal, or Makey Makey
> *"Read AGENTS.md and ACCESSIBILITY.md first. My player uses a USB switch interface that sends the `1` key for Switch 1 and the `2` key for Switch 2 (instead of Space and Enter). Please update `PlayFlow` so `1` also steps through controls and `2` activates the focused control, while keeping `Space`, `Enter`, and `Escape` working as before. Also turn `bigger` and `lessMotion` on by default in `comfort.js`. Run the relevant JS tests afterward and explain in plain English how I can test it in my browser."*

### Idea 2: Create a calm, sensory-friendly classroom or therapy default
> *"Read AGENTS.md first. Help me set up a calm classroom copy of MusicLab: turn **Calm** (`lessMotion`), **Bigger buttons** (`bigger`), and **Sound on Play** (`quietPresses`) on by default on first visit, and start the top volume slider at `50` instead of `80`. Make sure `Escape` / **Stop sound** and the −3 dBFS limiter stay intact, and run `python app.py --smoke-test` and the UI tests to verify."*

### Idea 3: Add sticker-friendly colours or `Do Re Mi` labels to the 8 pads
> *"Read AGENTS.md first. We put coloured `Do Re Mi Fa So La Ti Do` stickers on keys `A S D F G H J K` on a keyboard. Can you add an option in **Listen and explore** that shows large, high-contrast `Do Re Mi` labels (alongside the letter keys) on the eight playing pads, while keeping keyboard and two-switch scanning clean? Check it with the JS tests."*

### Idea 4: Unlock new instruments from the bundled 128-sound bank
> *"Read AGENTS.md and CUSTOMIZING.md Section 1C. Please switch `sampled_bank_delivery.js` to load the full `GeneralUser-GS-2.0.3.sf2` bank (already in `static/vendor/sampled-piano/`) and add versioned `sampled_*_v1` instruments for **Celesta** (GM 8), **Xylophone** (GM 13), **Cello** (GM 42) and **Sitar** (GM 104) to the Sound wheel without changing any existing `sampled_*_v1` IDs. Update or add tests so we know saved songs stay safe."*

### Idea 5: Build a gentle, slower musical style for relaxation or motor ease
> *"Read AGENTS.md and CONTRIBUTING.md ('Adding a style without changing saved songs'). Help me add a new slow, warm ~72 BPM style to the circle with spacious chords and a simple, singable tune wheel profile — appending a new style ID without reordering or altering any existing styles. Run `node --test tests/js/theory/genre-fit-composer-v5.test.mjs` and `composer-v5-saved-songs-stable.test.mjs` to make sure saved songs are untouched."*

### Idea 6: Ask your harness for a plain-English tour or safety check
> *"Read AGENTS.md. Run `python app.py --smoke-test`, `python -m pytest -q`, and `node --test \"tests/js/**/*.test.mjs\"`, then tell me in plain, non-technical language whether my copy of MusicLab passed every safety and audio check."*

---

## Golden rules when tweaking with AI tools

1. **Keep speaker volume low when testing audio edits.** Even though MusicLab has a −3 dBFS limiter, always test synth or audio changes at low headphone/speaker volume first.
2. **You are the listener.** Automated tests check rules and math; only a real person can tell whether a sound feels warm, joyful, or overwhelming.
3. **Never let an edit take away player agency.** Keep `Escape` (**Stop sound**), **Undo**, untimed controls (no countdowns!), local-only privacy (no external internet calls), and separate ownership of the player's notes intact.
4. **Did something break?** If you used Git or GitHub Desktop, you can always undo uncommitted edits cleanly (`git checkout -- .` or right-click → **Discard changes** in GitHub Desktop), or re-download a fresh ZIP anytime!

If you make a remix or adaptation that helped someone play music, we would love to hear about it in the **Issues** tab under **"Share an idea, adaptive setup, or remix"**!
