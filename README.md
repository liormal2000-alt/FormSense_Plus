# FormSense+

> An interactive AI exercise coach that analyzes uploaded workout videos and turns pose-estimation signals into concise, actionable form feedback.

**[FormSense+](https://formsenseplus.netlify.app/)**

FormSense+ helps beginner and intermediate trainees practice strength exercises more safely and deliberately. The user selects an exercise, uploads front and side views, receives structured feedback on movement quality, and can review the skeletal overlay or explore related exercises.

> **Safety note:** FormSense+ is an educational prototype, not medical advice or a substitute for a certified trainer. Stop exercising if you experience pain or discomfort.

## Highlights

- Supports **squats** and **bicep curls**.
- Detects **33 body landmarks** per frame with MediaPipe Pose.
- Computes exercise-specific biomechanical signals, including joint angles, symmetry, range of motion, tempo, and stability.
- Separates feedback into what to preserve, what to correct, and **low-confidence / uncertain** observations.
- Uses Gemini to convert deterministic findings into short, encouraging coaching summaries.
- Provides an iterative front-view → side-view practice loop, a replay with skeletal overlay, and related-exercise recommendations.

## How it works

```text
Uploaded video
  → MediaPipe Pose landmarks
  → JavaScript biomechanical rules and confidence checks
  → Structured form report
  → Gemini coaching summary and exercise recommendations
```

The computer-vision analysis runs locally in the user's browser. Gemini requests go through a Netlify Function, which keeps the API key outside the client-side code.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Pose estimation | MediaPipe Pose |
| AI feedback | Google Gemini 2.5 Flash |
| Markdown rendering | Marked.js |
| Hosting and serverless API proxy | Netlify + Netlify Functions |

## Run locally

For the visual interface only, open `index.html` in a modern browser. The AI features need the serverless function and a Gemini API key.

1. Install the Netlify CLI or run it with `npx`.
2. Create a local `.env` file from `.env.example` and enter your own `GEMINI_API_KEY`.
3. From the repository root, run:

```bash
npx netlify dev
```

4. Open the local URL printed in the terminal.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and select the repository.
3. Leave the build command and publish directory empty; Netlify serves `index.html` from the repository root.
4. In **Site configuration → Environment variables**, add `GEMINI_API_KEY` with a newly created Gemini API key.
5. Deploy. Every push to the configured production branch will publish a new version.

## Security

The original prototype contained a Gemini key in frontend code. That key must be considered exposed and should be **revoked or rotated** in Google AI Studio before deployment. This repository deliberately contains no active credentials; the Netlify Function reads the key only from the `GEMINI_API_KEY` environment variable.

## Design principles

The project was designed as an assistive coach rather than an authority that controls the user. It emphasizes:

- actionable and focused feedback instead of an overwhelming list of corrections;
- transparent uncertainty when body landmarks are not sufficiently visible;
- a clear human-AI division of work: the system measures and suggests, while the trainee decides how to act.

## Evaluation

An end-to-end usability study with five participants evaluated the workflow of selecting an exercise, uploading recordings, and interpreting the feedback. Participants found the interface clear and the practice flow intuitive; they also highlighted the value of the exercise recommendations. Suggested next improvements included camera-position reference images, limb-level error highlighting, a side-by-side reference repetition, and visible processing progress.

## Future directions

- Expand the exercise library (e.g., deadlift and bench press).
- Add user profiles and long-term progress tracking.
- Move from upload-based analysis to real-time visual feedback.
- Localize detected errors to the relevant limb and moment in the replay.

## Authors

- Lior Malachi
- Shachar Goralnik

