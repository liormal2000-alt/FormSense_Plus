import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVideoReachedEnd, toAnalysisLandmark } from '../js/vision/video-processor.js';

test('recognizes an explicitly ended video', () => {
  assert.equal(hasVideoReachedEnd({ ended: true, duration: 10, currentTime: 9 }), true);
});

test('recognizes the final video timestamp within tolerance', () => {
  assert.equal(hasVideoReachedEnd({ ended: false, duration: 10, currentTime: 9.99 }), true);
});

test('does not stop active playback early', () => {
  assert.equal(hasVideoReachedEnd({ ended: false, duration: 10, currentTime: 9.5 }), false);
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
