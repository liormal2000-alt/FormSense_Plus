import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostic, createFinding } from '../js/core/diagnostic-model.js';
import { mergeDiagnostics } from '../js/analysis/merge-diagnostics.js';

test('merges front and side diagnostics into one combined result', () => {
  const front = createDiagnostic({ exercise: 'Squat', view: 'Front', totalFrames: 10, validFrames: 8 });
  const side = createDiagnostic({ exercise: 'Squat', view: 'Side-Right', totalFrames: 20, validFrames: 18 });
  front.findings.good.push(createFinding({ id: 'front-good', label: 'Front', status: 'good', confidence: 90 }));
  side.findings.corrections.push(createFinding({ id: 'side-fix', label: 'Side', status: 'correction', severity: 'critical', confidence: 88 }));

  const combined = mergeDiagnostics(front, side);

  assert.equal(combined.view, 'Combined');
  assert.deepEqual(combined.views, ['Front', 'Side-Right']);
  assert.equal(combined.quality.totalFrames, 30);
  assert.equal(combined.quality.validFrames, 26);
  assert.equal(combined.findings.good[0].sourceView, 'Front');
  assert.equal(combined.findings.corrections[0].sourceView, 'Side-Right');
});

test('rejects a merge without both required views', () => {
  const front = createDiagnostic({ exercise: 'Squat', view: 'Front', totalFrames: 10, validFrames: 8 });
  assert.throws(() => mergeDiagnostics(front, null), /side-view diagnostic/);
});

test('side-view squat depth supersedes the weaker front depth proxy', () => {
  const front = createDiagnostic({ exercise: 'Squat', view: 'Front', totalFrames: 10, validFrames: 10 });
  const side = createDiagnostic({ exercise: 'Squat', view: 'Side-Left', totalFrames: 10, validFrames: 10 });
  front.findings.corrections.push(createFinding({ id: 'squat_front_depth_proxy', label: 'Proxy', status: 'correction', confidence: 90 }));
  side.findings.good.push(createFinding({ id: 'squat_depth', label: 'Depth', status: 'good', confidence: 90 }));

  const combined = mergeDiagnostics(front, side);
  const ids = Object.values(combined.findings).flat().map(finding => finding.id);

  assert.equal(ids.includes('squat_front_depth_proxy'), false);
  assert.equal(ids.includes('squat_depth'), true);
});
