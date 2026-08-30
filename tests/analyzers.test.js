import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSquat } from '../js/analysis/exercises/squat-analysis.js';
import { analyzeBicepCurl } from '../js/analysis/exercises/bicep-curl-analysis.js';

function sampleLandmarks() {
  const landmarks = Array.from({ length: 33 }, (_, index) => ({ x: 0.5, y: 0.05 + index * 0.01, z: 0, visibility: 0.96 }));
  Object.assign(landmarks[11], { x: 0.42, y: 0.22 });
  Object.assign(landmarks[12], { x: 0.58, y: 0.22 });
  Object.assign(landmarks[13], { x: 0.42, y: 0.38 });
  Object.assign(landmarks[14], { x: 0.58, y: 0.38 });
  Object.assign(landmarks[15], { x: 0.42, y: 0.54 });
  Object.assign(landmarks[16], { x: 0.58, y: 0.54 });
  Object.assign(landmarks[23], { x: 0.45, y: 0.5 });
  Object.assign(landmarks[24], { x: 0.55, y: 0.5 });
  Object.assign(landmarks[25], { x: 0.45, y: 0.7 });
  Object.assign(landmarks[26], { x: 0.55, y: 0.7 });
  Object.assign(landmarks[27], { x: 0.45, y: 0.9 });
  Object.assign(landmarks[28], { x: 0.55, y: 0.9 });
  Object.assign(landmarks[29], { x: 0.43, y: 0.92 });
  Object.assign(landmarks[30], { x: 0.57, y: 0.92 });
  Object.assign(landmarks[31], { x: 0.4, y: 0.94 });
  Object.assign(landmarks[32], { x: 0.6, y: 0.94 });
  return landmarks;
}

function sampleFrames() {
  return Array.from({ length: 12 }, (_, index) => ({ timestamp: index * 0.2, landmarks: sampleLandmarks() }));
}

for (const [name, analyze, view] of [
  ['front squat', analyzeSquat, 'Front'],
  ['side squat', analyzeSquat, 'Side-Left'],
  ['front curl', analyzeBicepCurl, 'Front'],
  ['side curl', analyzeBicepCurl, 'Side-Right']
]) {
  test(`${name} produces a structured diagnostic`, () => {
    const diagnostic = analyze(sampleFrames(), view);
    assert.equal(diagnostic.schemaVersion, '1.0');
    assert.equal(diagnostic.quality.validFrames, 12);
    const findingCount = Object.values(diagnostic.findings).flat().length;
    assert.ok(findingCount >= 3);
  });
}

test('front squat treats a level shoulder line as level in either vector direction', () => {
  const frames = Array.from({ length: 24 }, (_, index) => ({
    timestamp: index * 0.2,
    landmarks: sampleLandmarks()
  }));
  for (const frame of frames) {
    Object.assign(frame.landmarks[11], { x: 0.58, y: 0.22 });
    Object.assign(frame.landmarks[12], { x: 0.42, y: 0.22 });
  }

  const diagnostic = analyzeSquat(frames, 'Front');
  const finding = Object.values(diagnostic.findings).flat().find(item => item.id === 'squat_shoulder_symmetry');

  assert.equal(finding.status, 'good');
  assert.equal(finding.measurement.value, 0);
});

test('front curl treats a level shoulder line as level in either vector direction', () => {
  const frames = Array.from({ length: 24 }, (_, index) => ({
    timestamp: index * 0.2,
    landmarks: sampleLandmarks()
  }));
  for (const frame of frames) {
    Object.assign(frame.landmarks[11], { x: 0.58, y: 0.22 });
    Object.assign(frame.landmarks[12], { x: 0.42, y: 0.22 });
  }

  const diagnostic = analyzeBicepCurl(frames, 'Front');
  const finding = Object.values(diagnostic.findings).flat().find(item => item.id === 'curl_shoulder_symmetry');

  assert.equal(finding.status, 'good');
  assert.equal(finding.measurement.value, 0);
});

test('side squat reports depth from detected repetition extrema', () => {
  const angles = [165, 165, 160, 155, 145, 130, 110, 90, 80, 90, 110, 130, 150, 160, 165, 165];
  const frames = angles.map((angle, index) => sideFrameForJointAngle(angle, index, 'squat'));
  const diagnostic = analyzeSquat(frames, 'Side-Right');
  const depth = Object.values(diagnostic.findings).flat().find(item => item.id === 'squat_depth');

  assert.equal(diagnostic.repetitions.detected, 1);
  assert.equal(depth.measurement.aggregation, 'median_rep_minimum');
  assert.ok(depth.measurement.value < 100);
});

test('a controlled squat reaching about 85 degrees is not flagged as shallow', () => {
  const angles = [165, 165, 165, 165, 160, 150, 140, 125, 110, 95, 85, 85, 85, 95, 110, 130, 150, 160, 165, 165, 165, 165, 165, 165];
  const frames = angles.map((angle, index) => sideFrameForJointAngle(angle, index, 'squat'));
  const diagnostic = analyzeSquat(frames, 'Side-Right');
  const depth = Object.values(diagnostic.findings).flat().find(item => item.id === 'squat_depth');

  assert.equal(diagnostic.repetitions.detected, 1);
  assert.equal(depth.status, 'good');
});

test('front squat detects inward knee displacement regardless of left-right image placement', () => {
  const frames = Array.from({ length: 24 }, (_, index) => ({
    timestamp: index * 0.2,
    landmarks: sampleLandmarks()
  }));
  for (const frame of frames) {
    Object.assign(frame.landmarks[23], { x: 0.6, y: 0.5 });
    Object.assign(frame.landmarks[27], { x: 0.65, y: 0.9 });
    Object.assign(frame.landmarks[25], { x: 0.57, y: 0.7 });
    Object.assign(frame.landmarks[24], { x: 0.4, y: 0.5 });
    Object.assign(frame.landmarks[28], { x: 0.35, y: 0.9 });
    Object.assign(frame.landmarks[26], { x: 0.43, y: 0.7 });
  }

  const diagnostic = analyzeSquat(frames, 'Front');
  const knee = Object.values(diagnostic.findings).flat().find(item => item.id === 'squat_knee_tracking');

  assert.equal(knee.status, 'correction');
  assert.ok(knee.measurement.value > 0.04);
});

test('side curl reports extension and contraction per detected repetition', () => {
  const angles = [165, 165, 160, 150, 140, 120, 95, 70, 55, 70, 95, 120, 145, 160, 165, 165];
  const frames = angles.map((angle, index) => sideFrameForJointAngle(angle, index, 'curl'));
  const diagnostic = analyzeBicepCurl(frames, 'Side-Right');
  const findings = Object.values(diagnostic.findings).flat();

  assert.equal(diagnostic.repetitions.detected, 1);
  assert.equal(findings.find(item => item.id === 'curl_extension').measurement.aggregation, 'median_rep_maximum');
  assert.equal(findings.find(item => item.id === 'curl_contraction').measurement.aggregation, 'median_rep_minimum');
});

function sideFrameForJointAngle(angle, index, exercise) {
  const landmarks = sampleLandmarks();
  const center = { x: 0.5, y: 0.55 };
  const length = 0.2;
  const direction = (-90 + angle) * Math.PI / 180;
  const distal = {
    x: center.x + length * Math.cos(direction),
    y: center.y + length * Math.sin(direction)
  };

  if (exercise === 'squat') {
    Object.assign(landmarks[24], { x: 0.5, y: 0.35 });
    Object.assign(landmarks[26], center);
    Object.assign(landmarks[28], distal);
    Object.assign(landmarks[12], { x: 0.5, y: 0.15 });
    Object.assign(landmarks[30], { x: distal.x - 0.02, y: distal.y + 0.01 });
    Object.assign(landmarks[32], { x: distal.x + 0.08, y: distal.y + 0.01 });
  } else {
    Object.assign(landmarks[12], { x: 0.5, y: 0.35 });
    Object.assign(landmarks[14], center);
    Object.assign(landmarks[16], distal);
    Object.assign(landmarks[24], { x: 0.5, y: 0.75 });
  }

  return { timestamp: index * 0.2, landmarks };
}
