# Accessibility, Comfort & Assistive Setup Guide

MusicLab is built around a simple belief: wanting to participate in making music should not depend on reading sheet music, playing fast on a traditional instrument, or using a mouse.

This guide is written in plain language for **players, disabled musicians, parents, carers, teachers, therapists, and assistive-technology users**, as well as developers who want to adapt the controls.

If you want the shortest overview for supporting a child or beginner, you can also read **[For parents (`static/parents.html`)](static/parents.html)** (or online at https://musiclab.simoneresearch.com/static/parents.html).

---

## 1. Quick safety & comfort controls

| Need | How to do it |
| --- | --- |
| **Silence all sound right away** | Press **`Escape`** on your keyboard, or press **Stop sound** in the top bar. |
| **No surprise autoplay** | MusicLab never makes sound on page load. Sound starts only after you press a play control or pad. |
| **Prevent loud spikes** | MusicLab caps its own output ceiling at **−3 dBFS**. Always start with your device speakers or headphones low, because a web app cannot control hardware speaker loudness. |
| **Keep someone from turning volume up by accident** | Press **Lock volume** next to the volume slider in the top bar (`#btn-volume-lock`). |
| **Stop flashing, pulsing, or moving lines** | Press **Calm** in the top bar (or inside **Settings** / **Help**). MusicLab also honours your device's **Reduced Motion** and **High Contrast** (`forced-colors`) settings automatically. |
| **Mute button/tap preview sounds while choosing** | Open **Settings** (or **Help**) and turn on **Sound on Play**. Tapping controls stays silent until you press **Play**. |
| **Make targets and text larger** | Open **Settings** (or **Help**) and turn on **Bigger buttons**. |
| **Hear prompts read out loud privately** | Press **Read this** / **Read this screen** for a one-time read, or turn on **Read out loud** in **Settings** / **Help**. Only voices installed on your own computer are used — no words are sent over the internet. |

All comfort choices are saved in your browser on that device so you do not have to re-set them every visit.

---

## 2. Ways to play and navigate (no mouse dragging required)

Every screen in the main route works by **touch, mouse, keyboard only, or untimed two-switch scanning**. Every drag control has a button or arrow-key alternative.

### Two-switch scanning (`Space` + `Enter`)

MusicLab includes built-in two-switch scanning that is **untimed** — nothing moves on a countdown, so there is never a moving highlight you have to catch in time:

- **Switch 1 (`Space`):** Move focus to the next interactive control on the screen (wraps cleanly back to the start).
- **Switch 2 (`Enter`):** Choose / press the highlighted control.

Most USB switch interfaces (such as Hitch, JoyCable, Xbox Adaptive Controller via keyboard mapping, or Makey Makey) can send `Space` and `Enter` out of the box. If your switch hardware sends different keys, see **[Remapping keys for adaptive switches in `CUSTOMIZING.md`](CUSTOMIZING.md#1-gentle-5-minute-customizations-no-build-tools-needed)**.

### Keyboard shortcuts

| Where you are | Keys | What happens |
| --- | --- | --- |
| **Anywhere** | `Escape` | Immediately stops all sound and releases held notes. |
| **Anywhere (outside text boxes)** | `Space` then `Enter` | Step through controls (`Space`) and press the highlighted control (`Enter`). |
| **Anywhere** | `Tab` / `Shift + Tab` | Standard browser focus navigation with high-visibility focus rings. |
| **Listen and explore — 8 pads** | `A` `S` `D` `F` `G` `H` `J` `K` | Play the eight musical pads along with the band. Holding a key holds the note; if the browser window loses focus, held notes release automatically so nothing gets stuck ringing. |
| **Listen and explore — octave** | `Z` / `X` | Move the eight pads lower (`Z`) or higher (`X`). |
| **Style circle (`[data-music-circle]`)** | `Arrow Left` / `Arrow Right` | Step to the previous or next connected musical style. |
| **Style circle (`[data-music-circle]`)** | `Arrow Up` / `Arrow Down` | Step to another style family. |
| **Refine notes (single-note editor)** | `Arrow Up` / `Arrow Down` | Move the selected note higher or lower in pitch. |
| **Refine notes (single-note editor)** | `Arrow Left` / `Arrow Right` | Move the selected note earlier or later in time. |
| **Refine notes (single-note editor)** | `Shift + Arrow Left` / `Right` | Make the selected note shorter or longer. |
| **Song timeline** | `Arrow Left` / `Right`, `Home`, `End` | Step backward or forward by bar, or jump to start/end. |

### Choosing without dragging

- **On the Style Circle:** Open **Choose without dragging** to pick any style by name from a standard dropdown or step through styles and families with buttons.
- **On the Tune Wheel ("Make my tune"):** Open **Move with buttons** to nudge toward **Bright hook**, **Smooth flow**, **Crisp bounce**, or **Wide space**, step outward (**Light**, **Theme**, **Breathe**, **Return**), compare with **Original**, or **Undo move** using ordinary buttons.
- **Optional Humming ("Hum an idea"):** Completely optional (records up to 8 seconds locally on your device only after you press **Hum**). If microphone permission is off or skipped, every part of MusicLab still works with pads, buttons, or switches.

---

## 3. Cognitive, learning & motor design principles

- **No countdowns, scores, or "wrong notes".** Listening to the band, pressing one pad, or comparing two tunes are all complete ways to participate.
- **Your notes stay yours.** Optional helpers (**Adjust**, **Make it nicer**) reshape what was played with one-tap **Undo**, and never silently replace a person's take and credit AI for it.
- **Plain, short language.** Prompts are checked by automated tests (`static/js/theory/plain_language.js`) to stay short and concrete (targeting a second-grade reading level on multi-word prompts), paired with drawn icons alongside sound and shape choices.
- **Small choice groups.** Comfort switches, saved songs, and shape choices are grouped into at most **3 choices per row** so screens do not turn into an overwhelming wall of buttons.

---

## 4. Tips for parents, carers, teachers & therapists

1. **Set up comfort once before starting:** Open https://musiclab.simoneresearch.com/ (or your local copy), open **Settings** on the start screen, and toggle **Calm**, **Bigger buttons**, **Sound on Play**, or **Read out loud** to fit the player.
2. **Check speaker level first, then press Lock volume:** Start with gentle room or headphone volume, press **Listen and explore** briefly to test loudness, and click **Lock volume** in the top bar.
3. **Save backups as `.musiclab.json` files:** Browser saves belong to one browser profile on one device. On the save screen (**Keep this melody**), use **Download editable song** to keep a `.musiclab.json` file in a folder for that student or player — unlike a `.wav` recording, the `.musiclab.json` file reopens all editable notes later.

---

## 5. Honest testing status & current limits

We want to be transparent about what has been verified and what has **not** been tested yet:

- **Tried so far:** Chrome and Edge on Windows, in desktop and phone-sized windows, using mouse, keyboard-only navigation, and `Space`/`Enter` two-switch scanning.
- **Not yet tested on real devices/setups:** Safari, Firefox, physical phones and tablets, physical switch boxes/mounts, or comprehensive testing across screen readers (NVDA, JAWS, VoiceOver, TalkBack).
- **Not a clinical or educational claim:** Automated checks verify code behavior, reading level, target sizing, and audio ceiling, not whether MusicLab fits a particular person.

If something gets in someone's way — a focus jump, a confusing label, a switch trap, a screen-reader announcement, or a sensory surprise — **please tell us** in the repository's **Issues** tab using the *Accessibility, comfort, or play feedback* template (no names or diagnoses needed).

---

## 6. Where accessibility features live in the source code

If you are adapting MusicLab for a specific person, classroom, clinic, or assistive device, start with these files:

| Feature | File |
| --- | --- |
| Comfort switches (`Read out loud`, `Calm`, `Bigger buttons`, `Sound on Play`, `Moving lights`) | [`static/js/theory/comfort.js`](static/js/theory/comfort.js) |
| Untimed two-switch scan state (`Space` next, `Enter` choose) | [`static/js/theory/scan_model.js`](static/js/theory/scan_model.js) |
| Local-only spoken prompts (`localService` speech synthesis) | [`static/js/audio/speech.js`](static/js/audio/speech.js) |
| Plain-language reading-grade checker | [`static/js/theory/plain_language.js`](static/js/theory/plain_language.js) |
| Keyboard handling, pad keys (`A`–`K`, `Z`/`X`), non-drag pickers & volume lock | [`static/ui/stages/play_flow.js`](static/ui/stages/play_flow.js) |
| Focus outlines, `.pf-bigger` sizing, `.pf-less-motion` & High Contrast styles | [`static/css/studio.css`](static/css/studio.css) |
| Plain-HTML guide for parents and supporters | [`static/parents.html`](static/parents.html) |
| Hard `−3 dBFS` audio ceiling | [`static/js/audio/master_bus.js`](static/js/audio/master_bus.js), [`src/audio_engine/dsp.py`](src/audio_engine/dsp.py) |
