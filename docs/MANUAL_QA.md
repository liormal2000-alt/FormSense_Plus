# FormSense+ Manual QA Checklist

Run this checklist locally with `npm run dev` and again on the deployed Netlify URL.

## Baseline

- [ ] Home screen is the working product, not a marketing-only page.
- [ ] Squat and Bicep Curl cards are reachable with keyboard navigation.
- [ ] Layout remains readable at desktop, tablet and 360 px mobile width.
- [ ] Browser console contains no startup errors.

## Upload validation

- [ ] Non-video files are rejected with a visible message.
- [ ] Videos longer than 90 seconds are rejected.
- [ ] Unsupported/corrupt videos lead to the recoverable error screen.
- [ ] Front and side guidance changes correctly.
- [ ] Selecting the same file again after a failed attempt works.

## Analysis matrix

Test at least one clear and one intentionally poor-quality recording for every row.

| Exercise | View | Expected checks |
| --- | --- | --- |
| Squat | Front | Shoulder level, frontal knee alignment, side-to-side torso alignment |
| Squat | Left side | Rep-level depth, forward torso inclination, shin inclination, heel stability |
| Squat | Right side | Rep-level depth, forward torso inclination, shin inclination, heel stability |
| Bicep Curl | Front | Side-to-side torso movement, bilateral range symmetry, upper-arm flare, shoulder level |
| Bicep Curl | Left side | Rep-level extension, top position, upper-arm movement, forward-back torso movement |
| Bicep Curl | Right side | Rep-level extension, top position, upper-arm movement, forward-back torso movement |

For each run:

- [ ] Processing percentage advances and reaches 100%.
- [ ] Skeleton overlay follows the detected body.
- [ ] Tracked and usable frame counts are displayed.
- [ ] Low-confidence metrics appear under Uncertain rather than Corrections.
- [ ] Positive findings do not display corrective cues.
- [ ] Squat depth appears once and comes from the side-view repetition analysis.
- [ ] Rep-aware measurements are labeled with `median rep ...`; fallback measurements explicitly say `video ... fallback`.
- [ ] A level shoulder line is not flagged when the person/camera image is horizontally mirrored.
- [ ] Repeat one known clip in portrait and landscape exports; angle-based judgments should remain materially consistent.
- [ ] Severity tags are shown only for corrections.
- [ ] Measurements and aggregation methods are displayed.
- [ ] Complete reps are counted only for full cycles.
- [ ] Incomplete movement does not create a false complete rep.
- [ ] Video-level fallback is clearly labeled when rep detection fails.
- [ ] Replay opens, plays and closes.
- [ ] Download link produces the analyzed WebM where MediaRecorder is supported.
- [ ] Retake preserves the current exercise and view.
- [ ] Front analysis continues to side selection.
- [ ] Side analysis exposes final-session actions.

## AI behavior

With a valid `GEMINI_API_KEY`:

- [ ] Summary contains no correction absent from the deterministic report.
- [ ] Summary prioritizes critical/moderate corrections.
- [ ] Summary mentions uncertainty when present.
- [ ] Recommendations contain exactly two complete cards.
- [ ] Generated text is displayed as text and cannot inject HTML.

Without a key, with an invalid key, and with network disabled:

- [ ] Deterministic results remain visible.
- [ ] Loader stops and a useful AI error is shown.
- [ ] Retry button is available.

## Browsers

- [ ] Latest Chrome
- [ ] Latest Edge
- [ ] Firefox: verify processing and note MediaRecorder differences
- [ ] Safari: verify processing; replay may fall back to the original video

## Deployment

- [ ] `GEMINI_API_KEY` is configured for Functions and absent from browser sources.
- [ ] `/.netlify/functions/gemini` rejects GET requests.
- [ ] Invalid actions and malformed diagnostics are rejected.
- [ ] Security headers appear on the deployed site.
- [ ] A full Squat and Bicep Curl workflow succeeds on the production URL.
