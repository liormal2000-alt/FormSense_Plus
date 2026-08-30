const SEVERITY_ORDER = { critical: 0, moderate: 1, minor: 2, none: 3 };

export function createDiagnostic({ exercise, view, totalFrames, validFrames }) {
  const coverage = totalFrames ? validFrames / totalFrames : 0;
  return {
    schemaVersion: '1.0',
    exercise,
    view,
    analyzedAt: new Date().toISOString(),
    quality: {
      totalFrames,
      validFrames,
      validFrameRatio: Number(coverage.toFixed(3)),
      confidenceType: 'MediaPipe landmark visibility'
    },
    repetitions: {
      detected: 0,
      averageDurationSeconds: null,
      mode: 'video-level',
      note: 'No reliable complete repetitions were detected.'
    },
    findings: { good: [], corrections: [], uncertain: [] }
  };
}

export function createFinding({
  id,
  label,
  status,
  severity = 'none',
  confidence,
  message,
  cue = '',
  measurement = null,
  landmarks = []
}) {
  return {
    id,
    label,
    status,
    severity,
    confidence: Number.isFinite(confidence) ? Math.round(confidence) : 0,
    confidenceType: 'landmark_visibility_and_sample_support',
    message,
    cue,
    measurement,
    landmarks
  };
}

export function addFinding(diagnostic, finding) {
  const bucket = finding.status === 'good'
    ? diagnostic.findings.good
    : finding.status === 'correction'
      ? diagnostic.findings.corrections
      : diagnostic.findings.uncertain;
  bucket.push(finding);
}

export function finalizeDiagnostic(diagnostic) {
  diagnostic.findings.corrections.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return diagnostic;
}
