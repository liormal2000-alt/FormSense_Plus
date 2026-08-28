import { ANALYSIS_CONFIG, LANDMARK, SEVERITY } from '../../config/analysis-config.js';
import { createDiagnostic, finalizeDiagnostic } from '../../core/diagnostic-model.js';
import { filterFramesByVisibility, hasEnoughFrames, segmentConfidence } from '../confidence.js';
import { measurement, recordEvaluation, recordInsufficientData } from '../feedback-builder.js';
import { applyRepetitionSummary, segmentRepetitions } from '../repetition-segmenter.js';
import { getAngle, getDirectionalDrift, getVectorAngle, getVerticalDeviation, midpoint } from '../../utils/math-utils.js';
import { mean, percentile, range, round } from '../../utils/statistics-utils.js';

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
      torsoDeviation: Math.abs(getVectorAngle(midShoulder, midHip) - 90),
      elbowFlare: Math.max(
        getVerticalDeviation(lm[L.LEFT_SHOULDER], lm[L.LEFT_ELBOW]),
        getVerticalDeviation(lm[L.RIGHT_SHOULDER], lm[L.RIGHT_ELBOW])
      ),
      shoulderTilt: Math.abs(getVectorAngle(lm[L.LEFT_SHOULDER], lm[L.RIGHT_SHOULDER]))
    };
  }).filter(item => Object.values(item).every(Number.isFinite));

  const confidence = segmentConfidence(frames, FRONT_INDICES);
  const bodySway = percentile(features.map(item => item.torsoDeviation), 95);
  const leftRange = range(features.map(item => item.leftFlexion));
  const rightRange = range(features.map(item => item.rightFlexion));
  const symmetryDifference = Math.abs(leftRange - rightRange);
  const elbowFlare = percentile(features.map(item => item.elbowFlare), 95);
  const shoulderTilt = percentile(features.map(item => item.shoulderTilt), 95);

  recordEvaluation(diagnostic, {
    id: 'curl_body_sway', label: 'Upper-body stability', passed: bodySway < 20,
    severity: bodySway > 30 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The upper body remained steady.', correctionMessage: 'Upper-body sway was detected.',
    cue: 'Reduce momentum and keep the trunk stable throughout the curl.',
    measurement: measurement(round(bodySway, 1), 'degrees', '95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_arm_symmetry', label: 'Arm symmetry', passed: symmetryDifference < 15,
    severity: SEVERITY.MINOR, confidence,
    goodMessage: 'Both arms used a similar range of motion.', correctionMessage: 'The detected arm ranges were uneven.',
    cue: 'Use a load that allows both arms to move through a controlled range.',
    measurement: measurement(round(symmetryDifference, 1), 'degrees', 'range_difference'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_ELBOW, L.RIGHT_ELBOW, L.LEFT_WRIST, L.RIGHT_WRIST]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_elbow_flare', label: 'Elbow position', passed: elbowFlare < 20,
    severity: elbowFlare > 30 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'Elbows remained close to the body.', correctionMessage: 'Elbow flare was detected.',
    cue: 'Keep the upper arms close to your sides without forcing an uncomfortable position.',
    measurement: measurement(round(elbowFlare, 1), 'degrees', '95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_ELBOW, L.RIGHT_ELBOW]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_shoulder_symmetry', label: 'Shoulder symmetry', passed: shoulderTilt < 15,
    severity: shoulderTilt > 25 ? SEVERITY.MODERATE : SEVERITY.MINOR, confidence,
    goodMessage: 'Shoulders remained balanced.', correctionMessage: 'Uneven shoulder position was detected.',
    cue: 'Relax the shoulders and keep them level during the set.',
    measurement: measurement(round(shoulderTilt, 1), 'degrees', '95th_percentile'),
    landmarks: [L.LEFT_SHOULDER, L.RIGHT_SHOULDER]
  });

  applyRepetitionSummary(diagnostic, segmentRepetitions(
    features.map(item => ({ time: item.time, value: mean([item.leftFlexion, item.rightFlexion]) })),
    ANALYSIS_CONFIG.repetition.bicepCurl
  ));
  return finalizeDiagnostic(diagnostic);
}

function analyzeSide(frames, view) {
  const right = view === 'Side-Right';
  const shoulder = right ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER;
  const elbow = right ? L.RIGHT_ELBOW : L.LEFT_ELBOW;
  const wrist = right ? L.RIGHT_WRIST : L.LEFT_WRIST;
  const hip = right ? L.RIGHT_HIP : L.LEFT_HIP;
  const side = right ? 'right' : 'left';
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
      elbowDrift: getDirectionalDrift(lm[shoulder], lm[elbow], side),
      torsoDeviation: getVerticalDeviation(lm[hip], lm[shoulder])
    };
  }).filter(item => Object.values(item).every(Number.isFinite));

  const confidence = segmentConfidence(frames, indices);
  const maximumExtension = percentile(features.map(item => item.flexion), 95);
  const minimumFlexion = percentile(features.map(item => item.flexion), 5);
  const maximumDrift = percentile(features.map(item => item.elbowDrift), 95);
  const leanRange = range(features.map(item => item.torsoDeviation));

  recordEvaluation(diagnostic, {
    id: 'curl_extension', label: 'Elbow extension', passed: maximumExtension > 150,
    severity: maximumExtension < 120 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The arm reached a full lower position.', correctionMessage: 'The lower position showed limited elbow extension.',
    cue: 'Lower the weight under control until the arm reaches a comfortable extended position.',
    measurement: measurement(round(maximumExtension, 1), 'degrees', '95th_percentile'),
    landmarks: [shoulder, elbow, wrist]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_contraction', label: 'Top position', passed: minimumFlexion < 60,
    severity: minimumFlexion > 80 ? SEVERITY.MODERATE : SEVERITY.MINOR, confidence,
    goodMessage: 'A strong top position was reached.', correctionMessage: 'The top position showed a limited contraction range.',
    cue: 'Curl through a controlled, comfortable range without lifting the elbow forward.',
    measurement: measurement(round(minimumFlexion, 1), 'degrees', '5th_percentile'),
    landmarks: [shoulder, elbow, wrist]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_elbow_drift', label: 'Elbow drift', passed: maximumDrift < 20,
    severity: maximumDrift > 35 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The elbow remained stable.', correctionMessage: 'Forward elbow drift was detected.',
    cue: 'Keep the upper arm stable and let the forearm create most of the visible movement.',
    measurement: measurement(round(maximumDrift, 1), 'degrees', '95th_percentile'),
    landmarks: [shoulder, elbow]
  });

  recordEvaluation(diagnostic, {
    id: 'curl_torso_momentum', label: 'Torso momentum', passed: leanRange < 20,
    severity: leanRange > 30 ? SEVERITY.CRITICAL : SEVERITY.MODERATE, confidence,
    goodMessage: 'The torso stayed stable through the movement.', correctionMessage: 'Torso movement suggests momentum was used.',
    cue: 'Reduce the load or slow the movement if needed to keep the torso steady.',
    measurement: measurement(round(leanRange, 1), 'degrees', 'range'),
    landmarks: [shoulder, hip]
  });

  applyRepetitionSummary(diagnostic, segmentRepetitions(
    features.map(item => ({ time: item.time, value: item.flexion })),
    ANALYSIS_CONFIG.repetition.bicepCurl
  ));
  return finalizeDiagnostic(diagnostic);
}
