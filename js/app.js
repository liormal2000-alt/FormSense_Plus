import { ANALYSIS_CONFIG } from './config/analysis-config.js';
import { analyzeSquat } from './analysis/exercises/squat-analysis.js';
import { analyzeBicepCurl } from './analysis/exercises/bicep-curl-analysis.js';
import { mergeDiagnostics } from './analysis/merge-diagnostics.js';
import { appState, advanceToSide, beginAttempt, beginSession, resetSession, setAttemptResult, setCombinedDiagnostic } from './core/state.js';
import { generateCoachSummary, generateRecommendations } from './services/ai-coach.js';
import { PoseEngine } from './vision/pose-engine.js';
import { VideoProcessor } from './vision/video-processor.js';
import { resetProgress, updateProgress } from './ui/progress-ui.js';
import { configureUploadView, setUploadError, showFatalError, showView } from './ui/workflow-ui.js';
import {
  renderRecommendations,
  renderResults,
  setAiLoading,
  showAiError,
  showAiSummary,
  showRecommendationError
} from './ui/results-ui.js';

const video = document.getElementById('videoSource');
const canvas = document.getElementById('outputCanvas');
let poseEngine = null;
let processor = null;
let aiSummaryPending = false;

bindEvents();

function bindEvents() {
  document.querySelectorAll('[data-exercise]').forEach(button => {
    button.addEventListener('click', () => startExercise(button.dataset.exercise));
  });
  document.querySelectorAll('[data-side]').forEach(button => {
    button.addEventListener('click', () => selectSide(button.dataset.side));
  });
  document.querySelectorAll('[data-action="home"]').forEach(button => button.addEventListener('click', goHome));
  document.getElementById('videoUploader').addEventListener('change', handleUpload);
  document.getElementById('retake-btn').addEventListener('click', retakeCurrentView);
  document.getElementById('error-retry').addEventListener('click', retakeCurrentView);
  document.getElementById('toggle-replay').addEventListener('click', toggleReplay);
  document.getElementById('ai-retry').addEventListener('click', requestAiSummary);
  document.getElementById('recommend-btn').addEventListener('click', requestExerciseRecommendations);
  window.addEventListener('beforeunload', resetSession);
}

function startExercise(exercise) {
  beginSession(exercise);
  configureUploadView(exercise, 'Front', 0);
  showView('view-upload');
}

function selectSide(side) {
  beginAttempt(side);
  configureUploadView(appState.exercise, side, 1);
  showView('view-upload');
}

function retakeCurrentView() {
  if (!appState.exercise) return goHome();
  const view = appState.view;
  beginAttempt(view);
  configureUploadView(appState.exercise, view, appState.workflowStage);
  showView('view-upload');
}

function goHome() {
  processor?.cancel();
  video.pause();
  video.removeAttribute('src');
  video.load();
  resetSession();
  showView('view-home');
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  let pendingSourceUrl = null;

  try {
    setUploadError('');
    validateFile(file);
    const sourceUrl = URL.createObjectURL(file);
    pendingSourceUrl = sourceUrl;
    await loadVideo(sourceUrl);
    validateVideoMetadata(video);
    resetProgress();
    showView('view-processing');

    if (!poseEngine) poseEngine = new PoseEngine();
    if (!processor) processor = new VideoProcessor(poseEngine);
    const { frames, replayBlob } = await processor.process({
      video,
      canvas,
      view: appState.view,
      onProgress: updateProgress
    });

    const diagnostic = appState.exercise === 'Squat'
      ? analyzeSquat(frames, appState.view)
      : analyzeBicepCurl(frames, appState.view);
    const replayUrl = replayBlob ? URL.createObjectURL(replayBlob) : sourceUrl;
    setAttemptResult({ frames, diagnostic, sourceUrl, replayUrl });
    pendingSourceUrl = null;

    if (diagnostic.view === 'Front') {
      advanceToSide();
      showView('view-side-select');
      return;
    }

    const combinedDiagnostic = mergeDiagnostics(
      appState.attempts.front?.diagnostic,
      diagnostic
    );
    setCombinedDiagnostic(combinedDiagnostic);
    renderResults(combinedDiagnostic, {
      replayUrl,
      downloadName: `FormSense_${appState.exercise.replaceAll(' ', '_')}_Side.webm`,
      isFinal: true
    });
    showView('view-results');
    if (combinedDiagnostic.quality.validFrames > 0) {
      requestAiSummary();
    } else {
      showAiError('AI coaching is unavailable because the video did not provide enough usable movement data.');
    }
  } catch (error) {
    console.error(error);
    if (pendingSourceUrl) URL.revokeObjectURL(pendingSourceUrl);
    showFatalError(error.message || 'An unexpected processing error occurred.');
  }
}

function validateFile(file) {
  if (!file.type.startsWith('video/')) throw new Error('Please choose a supported video file.');
  if (file.size > ANALYSIS_CONFIG.video.maxSizeBytes) throw new Error('The selected video is larger than 250 MB.');
}

function validateVideoMetadata(videoElement) {
  if (!Number.isFinite(videoElement.duration) || videoElement.duration <= 0) throw new Error('The video duration could not be read.');
  if (videoElement.duration > ANALYSIS_CONFIG.video.maxDurationSeconds) throw new Error('Please upload a video no longer than 90 seconds.');
  if (!videoElement.videoWidth || !videoElement.videoHeight) throw new Error('The video dimensions could not be read.');
}

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('The browser could not decode this video. Try MP4 or WebM.'));
    video.src = url;
    video.load();
  });
}

async function requestAiSummary() {
  if (!appState.diagnostic || aiSummaryPending) return;
  if (appState.diagnostic.quality.validFrames <= 0) {
    showAiError('AI coaching is unavailable because the video did not provide enough usable movement data.');
    return;
  }

  aiSummaryPending = true;
  setAiLoading();
  try {
    showAiSummary(await generateCoachSummary(appState.diagnostic));
  } catch (error) {
    showAiError(error.message);
  } finally {
    aiSummaryPending = false;
  }
}

async function requestExerciseRecommendations() {
  const button = document.getElementById('recommend-btn');
  button.disabled = true;
  button.textContent = 'Building recommendations…';
  try {
    renderRecommendations(await generateRecommendations(appState.diagnostic));
  } catch (error) {
    showRecommendationError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = `More exercises like ${appState.exercise}`;
  }
}

function toggleReplay() {
  const section = document.getElementById('video-section');
  section.hidden = !section.hidden;
  document.getElementById('toggle-replay').textContent = section.hidden ? 'Watch skeleton replay' : 'Hide skeleton replay';
  if (section.hidden) document.getElementById('outputVideo').pause();
}
