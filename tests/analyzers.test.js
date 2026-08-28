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
    assert.ok(findingCount >= 4);
  });
}
