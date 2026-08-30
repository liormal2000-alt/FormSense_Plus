import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostic } from '../js/core/diagnostic-model.js';
import { recordEvaluation } from '../js/analysis/feedback-builder.js';

test('low landmark visibility moves a provisional result to uncertainty', () => {
  const diagnostic = createDiagnostic({ exercise: 'Squat', view: 'Front', totalFrames: 10, validFrames: 8 });
  recordEvaluation(diagnostic, {
    id: 'metric', label: 'Knee tracking', passed: false, severity: 'critical', confidence: 70,
    goodMessage: 'Good.', correctionMessage: 'Correction.'
  });
  assert.equal(diagnostic.findings.corrections.length, 0);
  assert.equal(diagnostic.findings.uncertain.length, 1);
  assert.equal(diagnostic.findings.uncertain[0].severity, 'none');
});

test('high-confidence failed rule becomes a correction', () => {
  const diagnostic = createDiagnostic({ exercise: 'Squat', view: 'Front', totalFrames: 10, validFrames: 10 });
  recordEvaluation(diagnostic, {
    id: 'metric', label: 'Knee tracking', passed: false, severity: 'critical', confidence: 92,
    goodMessage: 'Good.', correctionMessage: 'Correction.'
  });
  assert.equal(diagnostic.findings.corrections[0].message, 'Correction.');
});

test('positive findings do not carry corrective cues', () => {
  const diagnostic = createDiagnostic({ exercise: 'Squat', view: 'Front', totalFrames: 10, validFrames: 10 });
  recordEvaluation(diagnostic, {
    id: 'positive', label: 'Positive', passed: true, confidence: 95,
    goodMessage: 'Good.', correctionMessage: 'Correction.', cue: 'Correct this.'
  });
  assert.equal(diagnostic.findings.good[0].cue, '');
});
