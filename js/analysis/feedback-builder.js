import { ANALYSIS_CONFIG } from '../config/analysis-config.js';
import { addFinding, createFinding } from '../core/diagnostic-model.js';

export function recordEvaluation(diagnostic, {
  id,
  label,
  passed,
  severity = 'minor',
  confidence,
  goodMessage,
  correctionMessage,
  cue = '',
  measurement = null,
  landmarks = []
}) {
  const isConfident = confidence >= ANALYSIS_CONFIG.quality.confidentVisibility * 100;
  const status = isConfident ? (passed ? 'good' : 'correction') : 'uncertain';
  const message = isConfident
    ? (passed ? goodMessage : correctionMessage)
    : `FormSense+ could not verify ${label.toLowerCase()} reliably in this recording.`;
  const uncertaintyCue = 'Try another recording with the relevant joints fully visible and the camera held steady.';

  addFinding(diagnostic, createFinding({
    id,
    label,
    status,
    severity: status === 'correction' ? severity : 'none',
    confidence,
    message,
    cue: status === 'uncertain' ? uncertaintyCue : cue,
    measurement,
    landmarks
  }));
}

export function recordInsufficientData(diagnostic, label, indices = []) {
  addFinding(diagnostic, createFinding({
    id: 'insufficient_visible_frames',
    label,
    status: 'uncertain',
    confidence: 0,
    message: 'There were not enough high-visibility frames to produce a reliable biomechanical assessment.',
    cue: 'Keep the full body in frame, improve lighting, and use a stable camera.',
    landmarks: indices
  }));
}

export function measurement(value, unit, aggregation) {
  return { value, unit, aggregation };
}
