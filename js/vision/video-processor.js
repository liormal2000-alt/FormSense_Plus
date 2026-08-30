import { renderPoseOverlay } from './overlay-renderer.js';

const POSE_ESTIMATE_TIMEOUT = Symbol('pose-estimate-timeout');

export class VideoProcessor {
  constructor(poseEngine) {
    this.poseEngine = poseEngine;
    this.cancelled = false;
  }

  cancel() {
    this.cancelled = true;
  }

  async process({ video, canvas, view, onProgress = () => {} }) {
    this.cancelled = false;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const recorder = createCanvasRecorder(canvas);
    const frames = [];
    let lastProcessedTime = -1;
    let playbackEnded = false;

    const handlePlaybackEnded = () => { playbackEnded = true; };
    video.addEventListener('ended', handlePlaybackEnded);

    try {
      await video.play();

      while (!playbackEnded && !this.cancelled) {
        if (hasVideoReachedEnd(video)) break;

        const timestamp = video.currentTime;
        if (timestamp !== lastProcessedTime) {
          const result = await estimatePoseWithTimeout(this.poseEngine, video);

          if (result === POSE_ESTIMATE_TIMEOUT) {
            if (hasVideoReachedEnd(video)) break;
            throw new Error('Pose estimation timed out before the video finished. Please try the recording again.');
          }

          if (result) {
            renderPoseOverlay(canvas, result, { view });
            if (result.poseLandmarks) {
              const aspectRatio = video.videoWidth / video.videoHeight;
              frames.push({
                timestamp: Number(timestamp.toFixed(4)),
                landmarks: result.poseLandmarks.map(point => toAnalysisLandmark(point, aspectRatio))
              });
            }
          }

          lastProcessedTime = timestamp;
          onProgress(video.duration ? Math.min(1, timestamp / video.duration) : 0);
        }

        if (playbackEnded || hasVideoReachedEnd(video)) break;
        await nextVideoFrame(video);
      }
    } finally {
      video.removeEventListener('ended', handlePlaybackEnded);
    }

    if (this.cancelled) throw new Error('Video processing was cancelled.');
    onProgress(1);
    const replayBlob = await recorder.stop();
    return { frames, replayBlob };
  }
}

export function toAnalysisLandmark(point, aspectRatio) {
  return {
    // MediaPipe normalizes x by image width and y by image height. Scaling x
    // by width/height puts both axes in height-based units for 2D geometry.
    x: point.x * aspectRatio,
    y: point.y,
    z: point.z,
    visibility: point.visibility
  };
}

function nextVideoFrame(video) {
  return new Promise(resolve => {
    if (hasVideoReachedEnd(video)) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      video.removeEventListener('ended', finish);
      resolve();
    };

    const timeoutId = setTimeout(finish, 500);
    video.addEventListener('ended', finish, { once: true });

    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(finish);
    } else {
      requestAnimationFrame(finish);
    }
  });
}

export function hasVideoReachedEnd(video) {
  if (video.ended) return true;
  if (video.paused && video.currentTime > 0) return true;
  if (!Number.isFinite(video.duration) || !Number.isFinite(video.currentTime)) return false;
  return video.duration - video.currentTime <= 0.05;
}

function estimatePoseWithTimeout(poseEngine, image, timeoutMs = 3000) {
  let timeoutId;
  const estimatePromise = poseEngine.estimate(image).finally(() => clearTimeout(timeoutId));
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve(POSE_ESTIMATE_TIMEOUT), timeoutMs);
  });
  return Promise.race([estimatePromise, timeoutPromise]);
}

function createCanvasRecorder(canvas) {
  if (!canvas.captureStream || !window.MediaRecorder) {
    return { stop: async () => null };
  }

  const supportedTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type));
  const stream = canvas.captureStream(30);
  const chunks = [];
  const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  mediaRecorder.addEventListener('dataavailable', event => {
    if (event.data.size) chunks.push(event.data);
  });
  mediaRecorder.start();

  return {
    stop: () => new Promise(resolve => {
      if (mediaRecorder.state === 'inactive') {
        resolve(chunks.length ? new Blob(chunks, { type: mimeType || 'video/webm' }) : null);
        return;
      }
      mediaRecorder.addEventListener('stop', () => {
        stream.getTracks().forEach(track => track.stop());
        resolve(chunks.length ? new Blob(chunks, { type: mimeType || 'video/webm' }) : null);
      }, { once: true });
      mediaRecorder.stop();
    })
  };
}
