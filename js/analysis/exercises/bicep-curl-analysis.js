import { ANALYSIS_CONFIG, LANDMARK, SEVERITY } from '../../config/analysis-config.js';
import { createDiagnostic, finalizeDiagnostic } from '../../core/diagnostic-model.js';
import { assessmentConfidence, filterFramesByVisibility, hasEnoughFrames } from '../confidence.js';
import { measurement, recordEvaluation, recordInsufficientData } from '../feedback-builder.js';
import { applyRepetitionSummary, segmentRepetitions } from '../repetition-segmenter.js';
import { aggregateByRepetition, aggregateRepetitionProperty, perRepetitionCustom, REP_AGGREGATORS as A } from '../repetition-metrics.js';
import { getAngle, getHorizontalDeviation, getVectorAngle, getVerticalDeviation, midpoint } from '../../utils/math-utils.js';
import { mean, percentile, round } from '../../utils/statistics-utils.js';

const L = LANDMARK;
const FRONT_INDICES = [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_ELBOW, L.RIGHT_ELBOW, L.LEFT_WRIST, L.RIGHT_WRIST, L.LEFT_HIP, L.RIGHT_HIP];

export function analyzeBicepCurl(frames, view) {
  return view === 'Front' ? analyzeFront(frames) : analyzeSide(frames, view);
}

function analyzeFront(frames) {
  const validFrames = filterFramesByVisibility(frames, FRONT_INDICES);
  const diagnostic = createDiagnostic({ exercise: 'Bicep Curl', view: 'Front', totalFrames: frames.length, validFrames: validFrames.length });
  if (!hasEnoughFrames(validFrames)) {
    recordInsufficientData(diagnostic, 'Front curl visibility', FRONT_INDICES);
    return finalizeDiagnostic(diagnostic);
  }

  const features = validFrames.map(frame => {
    const lm = frame.landmarks;
    const midShoulder = midpoint(lm[L.LEFT_SHOULDER], lm[L.RIGHT_SHOULDER]);
    const midHip = midpoint(lm[L.LEFT_HIP], lm[L.RIGHT_HIP]);
    return {
      time: frame.timestamp,
      leftFlexion: getAngle(lm[L.LEFT_SHOULDER], lm[L.LEFT_ELBOW], lm[L.LEFT_WRIST]),
      rightFlexion: getAngle(lm[L.RIGHT_SHOULDER], lm[L.RIGHT_ELBOW], lm[L.RIGHT_WRIST]),
      torsoAngle: getVectorAngle(midShoulder, midHip),
      elbowFlare: Math.max(
        getVerticalDeviation(lm[L.LEFT_SHOULDER], lm[L.LEFT_ELBOW]),
        getVerticalDeviation(lm[L.RIGHT_SHOULDER], lm[L.RIGHT_ELBOW])
      ),
      shoulderTilt: getHorizontalDeviation(lm[L.LEFT_SHOULDER], lm[L.RIGHT_SHOULDER])
    };
  }).filter(item => Object.values(item).every(Number.isFinite));

  const repetitions = segmentRepetitions(
    features.map(item => ({ time: item.time, value: mean([item.leftFlexion, item.rightFlexion]) })),
    ANALYSIS_CONFIG.repetition.bicepCurl
  );
  const confidence = assessmentConfidence(validFrames, FRONT_INDICES);
  const bodySway = aggregateByRepetition(features, repetitions, item => item.torsoAngle, { withinRep: A.range, fallback: A.range });
  const symmetryDifference = perRepetitionCustom(features, repetitions, calculateArmRangeDifference, calculateArmRangeDifference);
  const elbowFlare = aggregateByRepetition(features, repetitions, item => item.elbowFlare, { withinRep: A.p95, fallback: A.p95 });
  const shoulderTilt = aggregateByRepetition(features, repetitions, item => item.shoulderTilt, { withinRep: A.p95, fallback: A.p95 });

  recordEvaluation(diagnostic, {
    id: 'curl_body_sway', label: 'Side-to-side torso movement', passed: bodySway.value < 20,
    severity: bodySway.value > 30 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The upper body remained steady.', correctionMessage: 'Upper-body sway was detected.',
    cue: 'Reduce momentum and keep the trunk stable throughout the curl.',
    measurement: metricMeasurement(bodySway, 1, 'degrees', 'median_rep_angle_range', 'video_angle_range'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_arm_symmetry', label: 'Bilateral range symmetry', passed: symmetryDifference.value < 15,
    severity: SEVERITY.MINOR, confidence,
    goodMessage: 'Both arms used a similar range of motion.', correctionMessage: 'The detected arm ranges were uneven.',
    cue: 'Use a load that allows both arms to move through a controlled range.',
    measurement: metricMeasurement(symmetryDifference, 1, 'degrees', 'median_rep_range_difference', 'video_range_difference'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_ELBOW, L.RIGHT_ELBOW, L.LEFT_WRIST, L.RIGHT_WRIST]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_elbow_flare', label: 'Upper-arm flare', passed: elbowFlare.value < 20,
    severity: elbowFlare.value > 30 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'Elbows remained close to the body.', correctionMessage: 'Elbow flare was detected.',
    cue: 'Keep the upper arms close to your sides without forcing an uncomfortable position.',
    measurement: metricMeasurement(elbowFlare, 1, 'degrees', 'median_rep_95th_percentile', 'video_95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_ELBOW, L.RIGHT_ELBOW]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_shoulder_symmetry', label: 'Shoulder level', passed: shoulderTilt.value < 15,
    severity: shoulderTilt.value > 25 ? SEVERITY.MODERATE : SEVERITY.MINOR, confidence,
    goodMessage: 'Shoulders remained balanced.', correctionMessage: 'Uneven shoulder position was detected.',
    cue: 'Relax the shoulders and keep them level during the set.',
    measurement: metricMeasurement(shoulderTilt, 1, 'degrees', 'median_rep_95th_percentile', 'video_95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER]
  });

  applyRepetitionSummary(diagnostic, repetitions);
  return finalizeDiagnostic(diagnostic);
}

function analyzeSide(frames, view) {
  const right = view === 'Side-Right';
  const shoulder = right ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER;
  const elbow = right ? L.RIGHT_ELBOW : L.LEFT_ELBOW;
  const wrist = right ? L.RIGHT_WRIST : L.LEFT_WRIST;
  const hip = right ? L.RIGHT_HIP : L.LEFT_HIP;
  const indices = [shoulder, elbow, wrist, hip];
  const validFrames = filterFramesByVisibility(frames, indices);
  const diagnostic = createDiagnostic({ exercise: 'Bicep Curl', view, totalFrames: frames.length, validFrames: validFrames.length });
  if (!hasEnoughFrames(validFrames)) {
    recordInsufficientData(diagnostic, 'Side curl visibility', indices);
    return finalizeDiagnostic(diagnostic);
  }

  const features = validFrames.map(frame => {
    const lm = frame.landmarks;
    return {
      time: frame.timestamp,
      flexion: getAngle(lm[shoulder], lm[elbow], lm[wrist]),
      upperArmAngle: getVerticalDeviation(lm[shoulder], lm[elbow]),
      torsoAngle: getVectorAngle(lm[shoulder], lm[hip])
    };
  }).filter(item => Object.values(item).every(Number.isFinite));

  const repetitions = segmentRepetitions(
    features.map(item => ({ time: item.time, value: item.flexion })),
    ANALYSIS_CONFIG.repetition.bicepCurl
  );
  const confidence = assessmentConfidence(validFrames, indices);
  const maximumExtension = aggregateRepetitionProperty(
    repetitions,
    'maximumAngle',
    percentile(features.map(item => item.flexion), 95)
  );
  const minimumFlexion = aggregateRepetitionProperty(
    repetitions,
    'minimumAngle',
    percentile(features.map(item => item.flexion), 5)
  );
  const upperArmMovement = aggregateByRepetition(features, repetitions, item => item.upperArmAngle, { withinRep: A.range, fallback: A.range });
  const leanRange = aggregateByRepetition(features, repetitions, item => item.torsoAngle, { withinRep: A.range, fallback: A.range });

  recordEvaluation(diagnostic, {
    id: 'curl_extension', label: 'Elbow extension', passed: maximumExtension.value > 150,
    severity: maximumExtension.value < 120 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The arm reached a full lower position.', correctionMessage: 'The lower position showed limited elbow extension.',
    cue: 'Lower the weight under control until the arm reaches a comfortable extended position.',
    measurement: metricMeasurement(maximumExtension, 1, 'degrees', 'median_rep_maximum', 'video_95th_percentile_fallback'),
    landmarks: [shoulder, elbow, wrist]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_contraction', label: 'Top position', passed: minimumFlexion.value < 60,
    severity: minimumFlexion.value > 80 ? SEVERITY.MODERATE : SEVERITY.MINOR, confidence,
    goodMessage: 'A strong top position was reached.', correctionMessage: 'The top position showed a limited contraction range.',
    cue: 'Curl through a controlled, comfortable range without lifting the elbow forward.',
    measurement: metricMeasurement(minimumFlexion, 1, 'degrees', 'median_rep_minimum', 'video_5th_percentile_fallback'),
    landmarks: [shoulder, elbow, wrist]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_elbow_drift', label: 'Upper-arm movement', passed: upperArmMovement.value < 20,
    severity: upperArmMovement.value > 35 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The upper arm remained stable.', correctionMessage: 'Pronounced upper-arm movement was detected during the curl.',
    cue: 'Keep the upper arm steady and let the forearm create most of the visible movement.',
    measurement: metricMeasurement(upperArmMovement, 1, 'degrees', 'median_rep_angle_range', 'video_angle_range'),
    landmarks: [shoulder, elbow]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_torso_momentum', label: 'Forward-back torso movement', passed: leanRange.value < 20,
    severity: leanRange.value > 30 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The torso stayed stable through the movement.', correctionMessage: 'Torso movement suggests momentum was used.',
    cue: 'Reduce the load or slow the movement if needed to keep the torso steady.',
    measurement: metricMeasurement(leanRange, 1, 'degrees', 'median_rep_angle_range', 'video_angle_range'),
    landmarks: [shoulder, hip]
  });

  applyRepetitionSummary(diagnostic, repetitions);
  return finalizeDiagnostic(diagnostic);
}

function calculateArmRangeDifference(samples) {
  if (!samples.length) return null;
  const leftRange = percentile(samples.map(item => item.leftFlexion), 95) - percentile(samples.map(item => item.leftFlexion), 5);
  const rightRange = percentile(samples.map(item => item.rightFlexion), 95) - percentile(samples.map(item => item.rightFlexion), 5);
  return Math.abs(leftRange - rightRange);
}

function metricMeasurement(metric, digits, unit, repetitionAggregation, fallbackAggregation) {
  return measurement(
    round(metric.value, digits),
    unit,
    metric.mode === 'repetition_level' ? repetitionAggregation : fallbackAggregation
  );
}
