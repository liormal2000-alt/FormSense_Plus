import { renderPoseOverlay } from './overlay-renderer.js';

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

    await video.play();

    while (!video.ended && !this.cancelled) {
      const timestamp = video.currentTime;
      if (timestamp !== lastProcessedTime) {
        const result = await this.poseEngine.estimate(video);
        if (result) {
          renderPoseOverlay(canvas, result, { view });
          if (result.poseLandmarks) {
            frames.push({
              timestamp: Number(timestamp.toFixed(4)),
              landmarks: result.poseLandmarks.map(point => ({
                x: point.x,
                y: point.y,
                z: point.z,
                visibility: point.visibility
              }))
            });
          }
        }
        lastProcessedTime = timestamp;
        onProgress(video.duration ? Math.min(1, timestamp / video.duration) : 0);
      }
      await nextVideoFrame(video);
    }

    if (this.cancelled) throw new Error('Video processing was cancelled.');
    onProgress(1);
    const replayBlob = await recorder.stop();
    return { frames, replayBlob };
  }
}

function nextVideoFrame(video) {
  return new Promise(resolve => {
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => resolve());
    } else {
      requestAnimationFrame(resolve);
    }
  });
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
