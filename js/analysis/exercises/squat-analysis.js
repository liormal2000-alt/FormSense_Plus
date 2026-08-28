import { ANALYSIS_CONFIG, LANDMARK, SEVERITY } from '../../config/analysis-config.js';
import { createDiagnostic, finalizeDiagnostic } from '../../core/diagnostic-model.js';
import { filterFramesByVisibility, hasEnoughFrames, segmentConfidence } from '../confidence.js';
import { measurement, recordEvaluation, recordInsufficientData } from '../feedback-builder.js';
import { applyRepetitionSummary, segmentRepetitions } from '../repetition-segmenter.js';
import { getAngle, getEuclideanDistance, getKneeOffset, getVectorAngle, getVerticalDistance, midpoint } from '../../utils/math-utils.js';
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
  const confidence = segmentConfidence(frames, FRONT_INDICES);
  const shoulderTilt = percentile(features.map(item => item.shoulderTilt), 95);
  const kneeOffset = percentile(features.map(item => item.kneeOffset), 95);
  const lateralLean = percentile(features.map(item => item.lateralLean), 95);
  const footAngle = percentile(features.map(item => item.footAngle), 50);
  const thighLengths = features.map(item => item.thighLength);
  const depthRatio = percentile(thighLengths, 5) / percentile(thighLengths, 95);

  recordEvaluation(diagnostic, {
    id: 'squat_shoulder_symmetry', label: 'Shoulder symmetry', passed: shoulderTilt <= 3,
    severity: shoulderTilt > 9 ? SEVERITY.CRITICAL : shoulderTilt > 6 ? SEVERITY.MODERATE : SEVERITY.MINOR,
    confidence, goodMessage: 'Shoulders remained level.', correctionMessage: 'A shoulder tilt was detected.',
    cue: 'Keep the torso centered and both shoulders level.',
    measurement: measurement(round(shoulderTilt, 1), 'degrees', '95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_knee_tracking', label: 'Knee tracking', passed: kneeOffset <= 0.1,
    severity: SEVERITY.CRITICAL, confidence,
    goodMessage: 'Knees tracked consistently over the feet.', correctionMessage: 'Inward knee movement was detected.',
    cue: 'Keep each knee aligned with the direction of the corresponding foot.',
    measurement: measurement(round(kneeOffset, 3), 'normalized_offset', '95th_percentile'),
    landmarks: [L.LEFT_HIP, L.RIGHT_HIP, L.LEFT_KNEE, L.RIGHT_KNEE, L.LEFT_ANKLE, L.RIGHT_ANKLE]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_lateral_lean', label: 'Lateral torso stability', passed: lateralLean <= 15,
    severity: lateralLean > 25 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The torso stayed centered.', correctionMessage: 'Side-to-side torso lean was detected.',
    cue: 'Brace gently and keep your chest centered between your feet.',
    measurement: measurement(round(lateralLean, 1), 'degrees', '95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_foot_angle', label: 'Foot position', passed: footAngle >= 20 && footAngle <= 45,
    severity: SEVERITY.MINOR, confidence: segmentConfidence(frames, [L.LEFT_ANKLE, L.RIGHT_ANKLE, L.LEFT_FOOT_INDEX, L.RIGHT_FOOT_INDEX]),
    goodMessage: 'Foot angles remained within the configured reference range.', correctionMessage: 'Foot angle was outside the configured reference range.',
    cue: 'Use a comfortable stance and keep each knee aligned with its foot.',
    measurement: measurement(round(footAngle, 1), 'degrees', 'median'),
    landmarks: [L.LEFT_ANKLE, L.RIGHT_ANKLE, L.LEFT_FOOT_INDEX, L.RIGHT_FOOT_INDEX]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_front_depth_proxy', label: 'Depth proxy', passed: depthRatio < 0.4,
    severity: SEVERITY.MODERATE, confidence,
    goodMessage: 'The front-view depth proxy indicates a substantial descent.', correctionMessage: 'The front-view depth proxy suggests a shallow descent.',
    cue: 'Use the side-view analysis for the more reliable depth assessment.',
    measurement: measurement(round(depthRatio, 3), 'ratio', '5th_to_95th_percentile'),
    landmarks: [L.LEFT_HIP, L.RIGHT_HIP, L.LEFT_KNEE, L.RIGHT_KNEE]
  });

  applyRepetitionSummary(diagnostic, segmentRepetitions(
    features.map(item => ({ time: item.time, value: item.averageKneeAngle })),
    ANALYSIS_CONFIG.repetition.squat
  ));
  return finalizeDiagnostic(diagnostic);
}

function extractFrontFeatures(frame) {
  const lm = frame.landmarks;
  const leftKneeAngle = getAngle(lm[L.LEFT_HIP], lm[L.LEFT_KNEE], lm[L.LEFT_ANKLE]);
  const rightKneeAngle = getAngle(lm[L.RIGHT_HIP], lm[L.RIGHT_KNEE], lm[L.RIGHT_ANKLE]);
  const shoulderAngle = getVectorAngle(lm[L.LEFT_SHOULDER], lm[L.RIGHT_SHOULDER]);
  const midShoulder = midpoint(lm[L.LEFT_SHOULDER], lm[L.RIGHT_SHOULDER]);
  const midHip = midpoint(lm[L.LEFT_HIP], lm[L.RIGHT_HIP]);
  const torsoAngle = getVectorAngle(midShoulder, midHip);
  const leftFootAngle = Math.abs(getVectorAngle(lm[L.LEFT_ANKLE], lm[L.LEFT_FOOT_INDEX]) - 90);
  const rightFootAngle = Math.abs(getVectorAngle(lm[L.RIGHT_ANKLE], lm[L.RIGHT_FOOT_INDEX]) - 90);
  const values = [leftKneeAngle, rightKneeAngle, shoulderAngle, torsoAngle, leftFootAngle, rightFootAngle];
  if (!values.every(Number.isFinite)) return null;
  return {
    time: frame.timestamp,
    shoulderTilt: Math.abs(shoulderAngle),
    kneeOffset: Math.max(
      getKneeOffset(lm[L.LEFT_HIP], lm[L.LEFT_ANKLE], lm[L.LEFT_KNEE], 'left'),
      getKneeOffset(lm[L.RIGHT_HIP], lm[L.RIGHT_ANKLE], lm[L.RIGHT_KNEE], 'right')
    ),
    lateralLean: Math.abs(Math.abs(torsoAngle) - 90),
    footAngle: mean([leftFootAngle, rightFootAngle]),
    thighLength: mean([
      getVerticalDistance(lm[L.LEFT_HIP], lm[L.LEFT_KNEE]),
      getVerticalDistance(lm[L.RIGHT_HIP], lm[L.RIGHT_KNEE])
    ]),
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
      shinAngle: Math.abs(90 - getAngle(lm[knee], lm[ankle], lm[foot])),
      heelY: lm[heel].y,
      shankLength: getEuclideanDistance(lm[knee], lm[ankle])
    };
  }).filter(item => Object.values(item).every(Number.isFinite));

  const confidence = segmentConfidence(frames, indices);
  const minimumKneeAngle = percentile(features.map(item => item.kneeAngle), 5);
  const maximumTorsoAngle = percentile(features.map(item => item.torsoAngle), 95);
  const maximumShinAngle = percentile(features.map(item => item.shinAngle), 95);
  const baselineFrames = features.slice(0, Math.min(15, features.length));
  const baselineHeel = mean(baselineFrames.map(item => item.heelY));
  const heelLift = baselineHeel - Math.min(...features.map(item => item.heelY));
  const heelThreshold = mean(features.map(item => item.shankLength)) * 0.15;

  recordEvaluation(diagnostic, {
    id: 'squat_depth', label: 'Squat depth', passed: minimumKneeAngle < 80,
    severity: minimumKneeAngle > 100 ? SEVERITY.CRITICAL : minimumKneeAngle > 90 ? SEVERITY.MODERATE : SEVERITY.MINOR,
    confidence, goodMessage: 'A deep squat position was reached.', correctionMessage: 'The lowest detected position was above the configured depth range.',
    cue: 'Descend only as far as you can maintain control and a comfortable, stable position.',
    measurement: measurement(round(minimumKneeAngle, 1), 'degrees', '5th_percentile'),
    landmarks: [hip, knee, ankle]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_torso_angle', label: 'Torso angle', passed: maximumTorsoAngle <= 45,
    severity: maximumTorsoAngle > 60 ? SEVERITY.CRITICAL : maximumTorsoAngle > 50 ? SEVERITY.MODERATE : SEVERITY.MINOR,
    confidence, goodMessage: 'Torso position stayed within the configured reference range.', correctionMessage: 'A pronounced forward torso angle was detected.',
    cue: 'Keep the trunk braced and choose a depth you can control.',
    measurement: measurement(round(maximumTorsoAngle, 1), 'degrees', '95th_percentile'),
    landmarks: [shoulder, hip]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_forward_shin_angle', label: 'Forward shin angle', passed: maximumShinAngle <= 30,
    severity: SEVERITY.MINOR, confidence,
    goodMessage: 'Forward shin movement remained moderate.', correctionMessage: 'A pronounced forward shin angle was detected.',
    cue: 'Keep balanced pressure through the foot; forward knee travel is not automatically a fault and depends on mobility, anatomy and training goal.',
    measurement: measurement(round(maximumShinAngle, 1), 'degrees', '95th_percentile'),
    landmarks: [knee, ankle, foot]
  });

  recordEvaluation(diagnostic, {
    id: 'squat_heel_stability', label: 'Heel stability', passed: heelLift < heelThreshold,
    severity: SEVERITY.MINOR, confidence: segmentConfidence(frames, [heel, ankle]),
    goodMessage: 'The visible heel remained stable.', correctionMessage: 'Possible heel lift was detected.',
    cue: 'Maintain balanced foot pressure and use a stance that lets the heel stay grounded.',
    measurement: measurement(round(heelLift, 4), 'normalized_distance', 'baseline_delta'),
    landmarks: [heel, ankle]
  });

  applyRepetitionSummary(diagnostic, segmentRepetitions(
    features.map(item => ({ time: item.time, value: item.kneeAngle })),
    ANALYSIS_CONFIG.repetition.squat
  ));
  return finalizeDiagnostic(diagnostic);
}
