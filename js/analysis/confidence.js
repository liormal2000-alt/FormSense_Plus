import { ANALYSIS_CONFIG } from '../config/analysis-config.js';
import { mean } from '../utils/statistics-utils.js';

export function frameVisibility(frame, indices) {
  if (!frame?.landmarks || !indices?.length) return null;
  const values = indices.map(index => frame.landmarks[index]?.visibility).filter(Number.isFinite);
  return values.length === indices.length ? mean(values) : null;
}

export function filterFramesByVisibility(frames, indices, minimum = ANALYSIS_CONFIG.quality.minimumVisibility) {
  return (frames ?? []).filter(frame => indices.every(index => {
    const visibility = frame?.landmarks?.[index]?.visibility;
    return Number.isFinite(visibility) && visibility >= minimum;
  }));
}

export function segmentConfidence(frames, indices) {
  const visibilityValues = (frames ?? [])
    .map(frame => frameVisibility(frame, indices))
    .filter(Number.isFinite);
  const average = mean(visibilityValues);
  return average === null ? 0 : Math.round(average * 100);
}

export function assessmentConfidence(validFrames, indices) {
  const visibility = segmentConfidence(validFrames, indices) / 100;
  const sampleSupport = Math.min(
    1,
    (validFrames?.length ?? 0) / ANALYSIS_CONFIG.quality.recommendedValidFrames
  );
  return Math.round(visibility * sampleSupport * 100);
}

export function hasEnoughFrames(frames) {
  return (frames?.length ?? 0) >= ANALYSIS_CONFIG.quality.minimumValidFrames;
}
