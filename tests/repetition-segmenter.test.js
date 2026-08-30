import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRepetitionSummary, segmentRepetitions } from '../js/analysis/repetition-segmenter.js';

const config = { startThreshold: 145, bottomThreshold: 115, minimumDuration: 0.5, maximumDuration: 8 };

test('segments a complete high-low-high movement cycle', () => {
  const values = [165, 165, 160, 155, 145, 130, 110, 90, 90, 105, 125, 145, 155, 165, 165, 165];
  const samples = values.map((value, index) => ({ value, time: index * 0.2 }));
  const repetitions = segmentRepetitions(samples, config);
  assert.equal(repetitions.length, 1);
  assert.ok(repetitions[0].minimumAngle <= 115);
  assert.ok(repetitions[0].minimumAngle < 100);
  assert.ok(repetitions[0].durationSeconds >= 0.5);
});

test('does not count an incomplete descent', () => {
  const values = [165, 160, 145, 125, 105, 90];
  const repetitions = segmentRepetitions(values.map((value, index) => ({ value, time: index * 0.2 })), config);
  assert.equal(repetitions.length, 0);
});

test('adds honest repetition-aware metadata only when reps exist', () => {
  const diagnostic = { repetitions: { detected: 0, mode: 'video-level' } };
  applyRepetitionSummary(diagnostic, [{ durationSeconds: 2, startTime: 0, endTime: 2 }]);
  assert.equal(diagnostic.repetitions.mode, 'repetition-aware');
  assert.equal(diagnostic.repetitions.averageDurationSeconds, 2);
});
