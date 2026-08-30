import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRepetitionProperty } from '../js/analysis/repetition-metrics.js';

test('depth aggregation uses each detected repetition minimum before combining reps', () => {
  const repetitions = [
    { minimumAngle: 72 },
    { minimumAngle: 84 },
    { minimumAngle: 78 }
  ];

  const result = aggregateRepetitionProperty(repetitions, 'minimumAngle', 35);

  assert.equal(result.mode, 'repetition_level');
  assert.deepEqual(result.perRepetitionValues, [72, 84, 78]);
  assert.equal(result.value, 78);
});

test('depth aggregation reports an explicit video fallback when no rep exists', () => {
  const result = aggregateRepetitionProperty([], 'minimumAngle', 91);
  assert.equal(result.mode, 'video_level_fallback');
  assert.equal(result.value, 91);
});
