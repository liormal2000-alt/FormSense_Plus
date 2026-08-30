import test from 'node:test';
import assert from 'node:assert/strict';
import { getAngle, getEuclideanDistance, getHorizontalDeviation, getMedialKneeOffset, midpoint } from '../js/utils/math-utils.js';

test('getAngle returns a right angle', () => {
  assert.equal(getAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }), 90);
});

test('getAngle rejects missing points without throwing', () => {
  assert.equal(getAngle(null, { x: 0, y: 0 }, { x: 0, y: 1 }), null);
});

test('horizontal deviation is direction invariant', () => {
  assert.equal(getHorizontalDeviation({ x: 0, y: 0 }, { x: 1, y: 0 }), 0);
  assert.equal(getHorizontalDeviation({ x: 1, y: 0 }, { x: 0, y: 0 }), 0);
});

test('distance and midpoint are calculated in normalized coordinates', () => {
  assert.equal(getEuclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(midpoint({ x: 0, y: 2 }, { x: 2, y: 4 }), { x: 1, y: 3 });
});

test('medial knee offset is normalized and invariant to image mirroring', () => {
  const imageRightLeg = getMedialKneeOffset(
    { x: 0.6, y: 0 }, { x: 0.7, y: 1 }, { x: 0.6, y: 0.5 }, 0.5
  );
  const mirroredLeg = getMedialKneeOffset(
    { x: 0.4, y: 0 }, { x: 0.3, y: 1 }, { x: 0.4, y: 0.5 }, 0.5
  );
  assert.ok(Math.abs(imageRightLeg - 0.05) < 1e-10);
  assert.ok(Math.abs(mirroredLeg - 0.05) < 1e-10);
});
