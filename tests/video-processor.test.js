import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureFramesCollected, hasVideoReachedEnd, toAnalysisLandmark } from '../js/vision/video-processor.js';

test('recognizes an explicitly ended video', () => {
  assert.equal(hasVideoReachedEnd({ ended: true, duration: 10, currentTime: 9 }), true);
});

test('recognizes the final video timestamp within tolerance', () => {
  assert.equal(hasVideoReachedEnd({ ended: false, duration: 10, currentTime: 9.99 }), true);
});

test('does not stop active playback early', () => {
  assert.equal(hasVideoReachedEnd({ ended: false, duration: 10, currentTime: 9.5 }), false);
});

test('does not treat a temporary playback pause as the end of the video', () => {
  assert.equal(hasVideoReachedEnd({ ended: false, paused: true, duration: 10, currentTime: 3 }), false);
});

test('rejects an analysis that collected no pose frames', () => {
  assert.throws(() => ensureFramesCollected([]), /No body landmarks were detected/);
  assert.doesNotThrow(() => ensureFramesCollected([{ timestamp: 0, landmarks: [] }]));
});

test('analysis landmarks correct normalized coordinates for video aspect ratio', () => {
  const point = { x: 0.5, y: 0.5, z: 0, visibility: 0.9 };
  assert.deepEqual(toAnalysisLandmark(point, 16 / 9), {
    x: 8 / 9,
    y: 0.5,
    z: 0,
    visibility: 0.9
  });
});
