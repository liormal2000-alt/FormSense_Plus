import test from 'node:test';
import assert from 'node:assert/strict';
import { getAngle, getEuclideanDistance, getKneeOffset, midpoint } from '../js/utils/math-utils.js';

test('getAngle returns a right angle', () => {
  assert.equal(getAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }), 90);
});

test('getAngle rejects missing points without throwing', () => {
  assert.equal(getAngle(null, { x: 0, y: 0 }, { x: 0, y: 1 }), null);
});

test('distance and midpoint are calculated in normalized coordinates', () => {
  assert.equal(getEuclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(midpoint({ x: 0, y: 2 }, { x: 2, y: 4 }), { x: 1, y: 3 });
});

test('knee offset is normalized by hip-to-ankle height', () => {
  const offset = getKneeOffset({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: -0.1, y: 0.5 }, 'left');
  assert.equal(offset, 0.1);
});
