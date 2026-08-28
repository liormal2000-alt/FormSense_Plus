export const ANALYSIS_CONFIG = Object.freeze({
  pose: {
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  },
  quality: {
    minimumVisibility: 0.65,
    confidentVisibility: 0.85,
    minimumValidFrames: 8,
    recommendedValidFrames: 20
  },
  video: {
    maxDurationSeconds: 90,
    maxSizeBytes: 250 * 1024 * 1024
  },
  repetition: {
    squat: { startThreshold: 145, bottomThreshold: 115, minimumDuration: 0.6, maximumDuration: 10 },
    bicepCurl: { startThreshold: 140, bottomThreshold: 90, minimumDuration: 0.45, maximumDuration: 8 }
  }
});

export const SEVERITY = Object.freeze({
  MINOR: 'minor',
  MODERATE: 'moderate',
  CRITICAL: 'critical'
});

export const LANDMARK = Object.freeze({
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
});
