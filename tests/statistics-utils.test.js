import test from 'node:test';
import assert from 'node:assert/strict';
import { mean, movingAverage, percentile, range, standardDeviation } from '../js/utils/statistics-utils.js';

test('statistics ignore non-finite values', () => {
  assert.equal(mean([1, 2, Number.NaN, 3]), 2);
  assert.equal(range([1, Infinity, 6]), 5);
});

test('percentile interpolates without mutating input', () => {
  const values = [4, 1, 3, 2];
  assert.equal(percentile(values, 50), 2.5);
  assert.deepEqual(values, [4, 1, 3, 2]);
});

test('moving average and standard deviation handle boundaries', () => {
  assert.deepEqual(movingAverage([1, 2, 3], 3), [1.5, 2, 2.5]);
  assert.equal(standardDeviation([]), null);
  assert.equal(standardDeviation([5]), 0);
});
