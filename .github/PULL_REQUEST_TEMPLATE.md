## What does this change do?

<!-- Describe your change in plain language so non-developers can follow along too. -->

## Accessibility & core-rules check

- [ ] **Player ownership:** Never silently replaces a person's played notes and calls the result theirs; Undo works cleanly.
- [ ] **Safe sound & privacy:** No autoplay before user press, respects the `−3 dBFS` ceiling and `Escape` / **Stop sound**, and makes zero external network calls.
- [ ] **Accessible ways in:** Works with keyboard focus, untimed two-switch scanning (`Space` + `Enter`), and non-drag controls; respects **Calm** / reduced motion and uses short, plain wording.
- [ ] **Saved-song compatibility:** Existing style IDs, patch IDs, and golden melody fixtures remain compatible.
- [ ] **Tests pass:** `python -m pytest -q`, `node --test "tests/js/**/*.test.mjs"`, and `python app.py --smoke-test`.
