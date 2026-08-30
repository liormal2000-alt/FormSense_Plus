const initialState = () => ({
  exercise: null,
  view: 'Front',
  workflowStage: 0,
  frames: [],
  diagnostic: null,
  attempts: {
    front: null,
    side: null
  },
  sourceUrl: null,
  replayUrl: null
});

export const appState = initialState();

export function beginSession(exercise) {
  resetUrls();
  Object.assign(appState, initialState(), { exercise });
}

export function beginAttempt(view) {
  revokeUrl('sourceUrl');
  revokeUrl('replayUrl');
  appState.view = view;
  appState.frames = [];
  appState.diagnostic = null;
}

export function setAttemptResult({ frames, diagnostic, sourceUrl, replayUrl }) {
  appState.frames = frames;
  appState.diagnostic = diagnostic;
  appState.sourceUrl = sourceUrl;
  appState.replayUrl = replayUrl;
  const attemptKey = diagnostic.view === 'Front' ? 'front' : 'side';
  appState.attempts[attemptKey] = { frames, diagnostic };
}

export function setCombinedDiagnostic(diagnostic) {
  appState.diagnostic = diagnostic;
}

export function advanceToSide() {
  appState.workflowStage = 1;
}

export function resetSession() {
  resetUrls();
  Object.assign(appState, initialState());
}

function revokeUrl(key) {
  if (appState[key]) URL.revokeObjectURL(appState[key]);
  appState[key] = null;
}

function resetUrls() {
  revokeUrl('sourceUrl');
  revokeUrl('replayUrl');
}
