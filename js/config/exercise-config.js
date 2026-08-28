export const EXERCISES = Object.freeze({
  Squat: {
    id: 'squat',
    label: 'Squat',
    frontChecklist: [
      'Face the camera directly',
      'Keep your full body and both feet visible',
      'Use a stable camera and uncluttered background'
    ],
    sideChecklist: [
      'Stand fully side-on to the camera',
      'Keep the visible shoulder, hip and foot in frame',
      'Record at least one complete repetition'
    ]
  },
  'Bicep Curl': {
    id: 'bicep-curl',
    label: 'Bicep Curl',
    frontChecklist: [
      'Face the camera with both arms visible',
      'Keep shoulders, elbows and wrists in frame',
      'Record at least one complete curl'
    ],
    sideChecklist: [
      'Stand fully side-on to the camera',
      'Keep the visible shoulder, elbow and wrist in frame',
      'Avoid moving outside the camera frame'
    ]
  }
});

export function getExerciseConfig(exercise) {
  const config = EXERCISES[exercise];
  if (!config) throw new Error(`Unsupported exercise: ${exercise}`);
  return config;
}
