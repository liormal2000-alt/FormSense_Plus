import { ANALYSIS_CONFIG, LANDMARK, SEVERITY } from '../../config/analysis-config.js';
import { createDiagnostic, finalizeDiagnostic } from '../../core/diagnostic-model.js';
import { assessmentConfidence, filterFramesByVisibility, hasEnoughFrames } from '../confidence.js';
import { measurement, recordEvaluation, recordInsufficientData } from '../feedback-builder.js';
import { applyRepetitionSummary, segmentRepetitions } from '../repetition-segmenter.js';
import { aggregateByRepetition, aggregateRepetitionProperty, perRepetitionCustom, REP_AGGREGATORS as A } from '../repetition-metrics.js';
import { getAngle, getEuclideanDistance, getHorizontalDeviation, getMedialKneeOffset, getVectorAngle, getVerticalDeviation, midpoint } from '../../utils/math-utils.js';
import { mean, percentile, round } from '../../utils/statistics-utils.js';

const L = LANDMARK;
const FRONT_INDICES = [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP, L.LEFT_KNEE, L.RIGHT_KNEE, L.LEFT_ANKLE, L.RIGHT_ANKLE];

export function analyzeSquat(frames, view) {
  return view === 'Front' ? analyzeFront(frames) : analyzeSide(frames, view);
}

function analyzeFront(frames) {
  const validFrames = filterFramesByVisibility(frames, FRONT_INDICES);
  const diagnostic = createDiagnostic({ exercise: 'Squat', view: 'Front', totalFrames: frames.length, validFrames: validFrames.length });

  if (!hasEnoughFrames(validFrames)) {
    recordInsufficientData(diagnostic, 'Front squat visibility', FRONT_INDICES);
    return finalizeDiagnostic(diagnostic);
  }

  const features = validFrames.map(frame => extractFrontFeatures(frame)).filter(Boolean);
  const repetitions = segmentRepetitions(
    features.map(item => ({ time: item.time, value: item.averageKneeAngle })),
    ANALYSIS_CONFIG.repetition.squat
  );
  const confidence = assessmentConfidence(validFrames, FRONT_INDICES);
  const shoulderTilt = aggregateByRepetition(features, repetitions, item => item.shoulderTilt, { withinRep: A.p95, fallback: A.p95 });
  const kneeOffset = aggregateByRepetition(features, repetitions, item => item.kneeOffset, { withinRep: A.p95, fallback: A.p95 });
  const lateralLean = aggregateByRepetition(features, repetitions, item => item.lateralLean, { withinRep: A.p95, fallback: A.p95 });

  recordEvaluation(diagnostic, {
    id: 'squat_shoulder_symmetry', label: 'Shoulder level', passed: shoulderTilt.value <= 3,
    severity: shoulderTilt.value > 15 ? SEVERITY.CRITICAL : shoulderTilt.value > 9 ? SEVERITY.MODERATE : SEVERITY.MINOR,
    confidence, goodMessage: 'Shoulders remained level.', correctionMessage: 'A shoulder tilt was detected.',
    cue: 'Keep the torso centered and both shoulders level.',
    measurement: metricMeasurement(shoulderTilt, 1, 'degrees', 'median_rep_95th_percentile', 'video_95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_knee_tracking', label: 'Frontal knee alignment', passed: kneeOffset.value <= 0.04,
    severity: kneeOffset.value > 0.12 ? SEVERITY.CRITICAL : kneeOffset.value > 0.08 ? SEVERITY.MODERATE : SEVERITY.MINOR,
    confidence,
    goodMessage: 'No pronounced inward knee displacement was detected.', correctionMessage: 'Inward knee displacement relative to the hip-ankle line was detected.',
    cue: 'Keep the descent controlled and avoid a visible inward knee collapse.',
    measurement: metricMeasurement(kneeOffset, 3, 'normalized_offset', 'median_rep_95th_percentile', 'video_95th_percentile'),
    landmarks: [L.LEFT_HIP, L.RIGHT_HIP, L.LEFT_KNEE, L.RIGHT_KNEE, L.LEFT_ANKLE, L.RIGHT_ANKLE]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_lateral_lean', label: 'Side-to-side torso alignment', passed: lateralLean.value <= 15,
    severity: lateralLean.value > 35 ? SEVERITY.CRITICAL : lateralLean.value > 25 ? SEVERITY.MODERATE : SEVERITY.MINOR, confidence,
    goodMessage: 'The torso stayed centered.', correctionMessage: 'Side-to-side torso lean was detected.',
    cue: 'Brace gently and keep your chest centered between your feet.',
    measurement: metricMeasurement(lateralLean, 1, 'degrees', 'median_rep_95th_percentile', 'video_95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP]
  });

  applyRepetitionSummary(diagnostic, repetitions);
  return finalizeDiagnostic(diagnostic);
}

function extractFrontFeatures(frame) {
  const lm = frame.landmarks;
  const leftKneeAngle = getAngle(lm[L.LEFT_HIP], lm[L.LEFT_KNEE], lm[L.LEFT_ANKLE]);
  const rightKneeAngle = getAngle(lm[L.RIGHT_HIP], lm[L.RIGHT_KNEE], lm[L.RIGHT_ANKLE]);
  const shoulderTilt = getHorizontalDeviation(lm[L.LEFT_SHOULDER], lm[L.RIGHT_SHOULDER]);
  const midShoulder = midpoint(lm[L.LEFT_SHOULDER], lm[L.RIGHT_SHOULDER]);
  const midHip = midpoint(lm[L.LEFT_HIP], lm[L.RIGHT_HIP]);
  const torsoAngle = getVectorAngle(midShoulder, midHip);
  const values = [leftKneeAngle, rightKneeAngle, shoulderTilt, torsoAngle];
  if (!values.every(Number.isFinite)) return null;
  return {
    time: frame.timestamp,
    shoulderTilt,
    kneeOffset: Math.max(
      0,
      getMedialKneeOffset(lm[L.LEFT_HIP], lm[L.LEFT_ANKLE], lm[L.LEFT_KNEE], midHip.x),
      getMedialKneeOffset(lm[L.RIGHT_HIP], lm[L.RIGHT_ANKLE], lm[L.RIGHT_KNEE], midHip.x)
    ),
    lateralLean: Math.abs(Math.abs(torsoAngle) - 90),
    averageKneeAngle: mean([leftKneeAngle, rightKneeAngle])
  };
}

function analyzeSide(frames, view) {
  const right = view === 'Side-Right';
  const indices = right
    ? [L.RIGHT_SHOULDER, L.RIGHT_HIP, L.RIGHT_KNEE, L.RIGHT_ANKLE, L.RIGHT_HEEL, L.RIGHT_FOOT_INDEX]
    : [L.LEFT_SHOULDER, L.LEFT_HIP, L.LEFT_KNEE, L.LEFT_ANKLE, L.LEFT_HEEL, L.LEFT_FOOT_INDEX];
  const [shoulder, hip, knee, ankle, heel, foot] = indices;
  const validFrames = filterFramesByVisibility(frames, indices);
  const diagnostic = createDiagnostic({ exercise: 'Squat', view, totalFrames: frames.length, validFrames: validFrames.length });

  if (!hasEnoughFrames(validFrames)) {
    recordInsufficientData(diagnostic, 'Side squat visibility', indices);
    return finalizeDiagnostic(diagnostic);
  }

  const features = validFrames.map(frame => {
    const lm = frame.landmarks;
    return {
      time: frame.timestamp,
      kneeAngle: getAngle(lm[hip], lm[knee], lm[ankle]),
      torsoAngle: getAngle(lm[shoulder], lm[hip], { x: lm[hip].x, y: lm[hip].y - 0.5 }),
      shinAngle: getVerticalDeviation(lm[knee], lm[ankle]),
      heelY: lm[heel].y,
      shankLength: getEuclideanDistance(lm[knee], lm[ankle])
    };
  }).filter(item => Object.values(item).every(Number.isFinite));

  const repetitions = segmentRepetitions(
    features.map(item => ({ time: item.time, value: item.kneeAngle })),
    ANALYSIS_CONFIG.repetition.squat
  );
  const confidence = assessmentConfidence(validFrames, indices);
  const minimumKneeAngle = aggregateRepetitionProperty(
    repetitions,
    'minimumAngle',
    percentile(features.map(item => item.kneeAngle), 5)
  );
  const maximumTorsoAngle = aggregateByRepetition(features, repetitions, item => item.torsoAngle, { withinRep: A.p95, fallback: A.p95 });
  const maximumShinAngle = aggregateByRepetition(features, repetitions, item => item.shinAngle, { withinRep: A.p95, fallback: A.p95 });
  const heelLiftRatio = perRepetitionCustom(features, repetitions, calculateHeelLiftRatio, calculateHeelLiftRatio);

  recordEvaluation(diagnostic, {
    id: 'squat_depth', label: 'Squat depth', passed: minimumKneeAngle.value <= 95,
    severity: minimumKneeAngle.value > 115 ? SEVERITY.CRITICAL : minimumKneeAngle.value > 105 ? SEVERITY.MODERATE : SEVERITY.MINOR,
    confidence, goodMessage: 'A deep squat position was reached.', correctionMessage: 'The lowest detected position was above the configured depth range.',
    cue: 'Descend only as far as you can maintain control and a comfortable, stable position.',
    measurement: metricMeasurement(minimumKneeAngle, 1, 'degrees', 'median_rep_minimum', 'video_5th_percentile_fallback'),
    landmarks: [hip, knee, ankle]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_torso_angle', label: 'Forward torso inclination', passed: maximumTorsoAngle.value <= 45,
    severity: maximumTorsoAngle.value > 60 ? SEVERITY.CRITICAL : maximumTorsoAngle.value > 50 ? SEVERITY.MODERATE : SEVERITY.MINOR,
    confidence, goodMessage: 'Torso position stayed within the configured reference range.', correctionMessage: 'A pronounced forward torso angle was detected.',
    cue: 'Keep the trunk braced and choose a depth you can control.',
    measurement: metricMeasurement(maximumTorsoAngle, 1, 'degrees', 'median_rep_95th_percentile', 'video_95th_percentile'),
    landmarks: [shoulder, hip]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_forward_shin_angle', label: 'Shin inclination', passed: maximumShinAngle.value <= 30,
    severity: SEVERITY.MINOR, confidence,
    goodMessage: 'Forward shin movement remained moderate.', correctionMessage: 'A pronounced forward shin angle was detected.',
    cue: 'Keep balanced pressure through the foot; forward knee travel is not automatically a fault and depends on mobility, anatomy and training goal.',
    measurement: metricMeasurement(maximumShinAngle, 1, 'degrees', 'median_rep_95th_percentile', 'video_95th_percentile'),
    landmarks: [knee, ankle, foot]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_heel_stability', label: 'Heel stability', passed: heelLiftRatio.value < 0.15,
    severity: SEVERITY.MINOR,
    confidence: assessmentConfidence(
      filterFramesByVisibility(frames, [heel, ankle]),
      [heel, ankle]
    ),
    goodMessage: 'The visible heel remained stable.', correctionMessage: 'Possible heel lift was detected.',
    cue: 'Maintain balanced foot pressure and use a stance that lets the heel stay grounded.',
    measurement: metricMeasurement(heelLiftRatio, 3, 'ratio', 'median_rep_range_over_shank_length', 'video_range_over_shank_length'),
    landmarks: [heel, ankle]
  });

  applyRepetitionSummary(diagnostic, repetitions);
  return finalizeDiagnostic(diagnostic);
}

function calculateHeelLiftRatio(samples) {
  if (!samples.length) return null;
  const heelValues = samples.map(item => item.heelY).filter(Number.isFinite);
  const shankLength = percentile(samples.map(item => item.shankLength), 50);
  if (!heelValues.length || !Number.isFinite(shankLength) || shankLength <= 0) return null;
  return (Math.max(...heelValues) - Math.min(...heelValues)) / shankLength;
}

function metricMeasurement(metric, digits, unit, repetitionAggregation, fallbackAggregation) {
  return measurement(
    round(metric.value, digits),
    unit,
    metric.mode === 'repetition_level' ? repetitionAggregation : fallbackAggregation
  );
}
