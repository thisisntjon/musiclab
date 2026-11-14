# How MusicLab works

MusicLab is a browser instrument. A person steers musical choices; the app turns those choices into editable notes and scheduled sound. AI coding tools helped build the instrument. The browser does not need a hosted AI service to play it.

## Follow one gesture

1. **Choose a direction.** The journey controller connects wheel, key and button input to a musical session.
2. **Build a candidate.** Style and melody modules produce notes with pitches, timing, durations, sound identities and provenance. A style's musical behavior is separate from the instrument playing it.
3. **Schedule it.** The audio scheduler keeps transport running and joins accompaniment changes at musical boundaries. A requested choice can differ from what is currently heard.
4. **Show it.** The score visualization follows actual musical events. Preview and sounding states must remain distinguishable.
5. **Keep it.** The chosen editable score and performed archive have distinct meanings. Played-take capture excludes future queued attacks. Complete-score Keep retains the chosen editable score, including its later notes. Neither route may silently replace personally played material.

## Where to look

| Responsibility | Starting point |
| --- | --- |
| App and journey | [app.js](static/ui/app.js), [play_flow.js](static/ui/stages/play_flow.js) |
| Melody exploration and comparisons | [melody_field_session.js](static/ui/melody_field_session.js) |
| Styles and harmony | [scene_catalogue.js](static/js/theory/scene_catalogue.js), [phrase_harmony.js](static/js/theory/phrase_harmony.js) |
| Sound capabilities | [sampled_sound_capabilities.js](static/js/theory/sampled_sound_capabilities.js) |
| Scheduling and audio | [scheduler.js](static/js/audio/scheduler.js) |
| Chosen score and personal archive | [selected_melody.js](static/js/theory/selected_melody.js), [performance_capture.js](static/js/theory/performance_capture.js) |
| Musical visuals | [live_score_model.js](static/js/theory/live_score_model.js) |
| Local server | [app.py](app.py) |
| Verification | [JavaScript tests](tests/js), [Python tests](tests) |

This is a starting map, not a claim that every module is independent. Saved composer versions preserve earlier behavior; do not update their golden outputs just to make a regression disappear.

## Source versus release

The release page loads a prebuilt, content-hashed bundle. Changing a raw module does not change that bundle. Follow [Before your first edit](CUSTOMIZING.md#before-your-first-edit) for no-build development, and [bundling guidance](hosting/BUNDLING.md) for release work.

The manifest describes the released bytes, not a modified local checkout. Keep source, assets and bundle provenance together when comparing results.

## What a useful test proves

Check one intended change and the things it must leave alone. For example: switch a generated melody's instrument while a personal note is held; verify the held voice, original notes, backing, Undo and reopened score. Then listen to the result.

Passing tests do not establish musical enjoyment, audience comprehension or universal accessibility. Include device/browser conditions, observed behavior and remaining limits in a contribution.
