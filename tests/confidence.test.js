import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFramesByVisibility, frameVisibility, segmentConfidence } from '../js/analysis/confidence.js';

const frame = (...visibility) => ({ landmarks: visibility.map(value => ({ x: 0, y: 0, visibility: value })) });

test('frame visibility requires every requested landmark', () => {
  assert.equal(frameVisibility(frame(0.9, 0.7), [0, 1]), 0.8);
  assert.equal(frameVisibility(frame(0.9), [0, 1]), null);
});

test('filtering and segment confidence use landmark visibility', () => {
  const frames = [frame(0.9, 0.9), frame(0.5, 0.9), frame(0.8, 0.8)];
  assert.equal(filterFramesByVisibility(frames, [0, 1], 0.65).length, 2);
  assert.equal(segmentConfidence(frames, [0, 1]), 80);
});
