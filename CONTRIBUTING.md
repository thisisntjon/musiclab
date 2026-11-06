# Contributing to MusicLab

Thank you for helping. MusicLab is early, and the most useful thing you can give it is honest feedback from real use.

## Feedback

There is no feedback address for this first release. If you are reading this somewhere with an issue tracker, open an issue there and tell us:

- who was playing (no names or diagnoses needed, just what kind of access they use: touch, mouse, keyboard, switch, screen reader);
- what they were trying to do;
- what worked, and where they got stuck.

## Code

- Keep the app local: no external network requests, CDNs or cloud services.
- Python code uses the standard library only.
- Respect the core rules: a person's notes are never replaced and credited to them, nothing essential is timed, and sound starts only after a press.
- Run the tests before opening a pull request:

```bash
python -m pytest -q
```

```bash
node --test "tests/js/**/*.test.mjs"
```

By contributing you agree your work is released under the MIT licence.
