const SEVERITY_ORDER = { critical: 0, moderate: 1, minor: 2, none: 3 };

export function mergeDiagnostics(frontDiagnostic, sideDiagnostic) {
  if (!frontDiagnostic || frontDiagnostic.view !== 'Front') {
    throw new Error('A front-view diagnostic is required.');
  }
  if (!sideDiagnostic || !String(sideDiagnostic.view).startsWith('Side-')) {
    throw new Error('A side-view diagnostic is required.');
  }
  if (frontDiagnostic.exercise !== sideDiagnostic.exercise) {
    throw new Error('The two diagnostics must belong to the same exercise.');
  }

  const totalFrames = frontDiagnostic.quality.totalFrames + sideDiagnostic.quality.totalFrames;
  const validFrames = frontDiagnostic.quality.validFrames + sideDiagnostic.quality.validFrames;
  const findings = { good: [], corrections: [], uncertain: [] };

  for (const diagnostic of [frontDiagnostic, sideDiagnostic]) {
    for (const bucket of Object.keys(findings)) {
      findings[bucket].push(...diagnostic.findings[bucket].map(finding => ({
        ...finding,
        sourceView: diagnostic.view
      })));
    }
  }

  // Once a side-view depth measurement exists, the weaker front-view depth
  // proxy must not appear as a second or conflicting coaching judgment.
  if (sideDiagnostic.findings.good.concat(sideDiagnostic.findings.corrections).some(finding => finding.id === 'squat_depth')) {
    for (const bucket of Object.keys(findings)) {
      findings[bucket] = findings[bucket].filter(finding => finding.id !== 'squat_front_depth_proxy');
    }
  }

  findings.corrections.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return {
    schemaVersion: '1.0',
    exercise: frontDiagnostic.exercise,
    view: 'Combined',
    views: [frontDiagnostic.view, sideDiagnostic.view],
    analyzedAt: new Date().toISOString(),
    quality: {
      totalFrames,
      validFrames,
      validFrameRatio: totalFrames
        ? Number((validFrames / totalFrames).toFixed(3))
        : 0,
      confidenceType: 'MediaPipe landmark visibility',
      byView: {
        front: frontDiagnostic.quality,
        side: sideDiagnostic.quality
      }
    },
    repetitions: {
      ...sideDiagnostic.repetitions,
      byView: {
        front: frontDiagnostic.repetitions,
        side: sideDiagnostic.repetitions
      }
    },
    findings
  };
}
