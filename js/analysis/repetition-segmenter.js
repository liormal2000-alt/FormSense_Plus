import { mean, movingAverage, percentile, round } from '../utils/statistics-utils.js';

/**
 * Segments a high-low-high joint-angle signal using hysteresis.
 * It is intentionally exercise-scoped, not a general activity recognizer.
 */
export function segmentRepetitions(samples, config) {
  const clean = (samples ?? [])
    .filter(sample => Number.isFinite(sample?.time) && Number.isFinite(sample?.value))
    .sort((a, b) => a.time - b.time);

  if (clean.length < 5) return [];

  const smoothed = movingAverage(clean.map(sample => sample.value), 5);
  const reps = [];
  let state = 'waiting';
  let startIndex = null;
  let bottomIndex = null;

  for (let index = 0; index < clean.length; index += 1) {
    const value = smoothed[index];

    if (state === 'waiting' && value >= config.startThreshold) {
      state = 'ready';
      continue;
    }

    if (state === 'ready' && value < config.startThreshold) {
      startIndex = Math.max(0, index - 1);
      bottomIndex = index;
      state = 'descending';
      continue;
    }

    if (state === 'descending') {
      if (value < smoothed[bottomIndex]) bottomIndex = index;
      if (value <= config.bottomThreshold) state = 'bottom';
      if (value >= config.startThreshold) {
        state = 'ready';
        startIndex = null;
      }
      continue;
    }

    if (state === 'bottom') {
      if (value < smoothed[bottomIndex]) bottomIndex = index;
      if (value >= config.startThreshold) {
        const duration = clean[index].time - clean[startIndex].time;
        if (duration >= config.minimumDuration && duration <= config.maximumDuration) {
          const rawAngles = clean
            .slice(startIndex, index + 1)
            .map(sample => sample.value);
          reps.push({
            startTime: round(clean[startIndex].time, 2),
            bottomTime: round(clean[bottomIndex].time, 2),
            endTime: round(clean[index].time, 2),
            durationSeconds: round(duration, 2),
            // Boundaries use the smoothed signal, while ROM uses robust raw
            // extrema so the moving average does not artificially reduce depth.
            minimumAngle: round(percentile(rawAngles, 5), 1),
            maximumAngle: round(percentile(rawAngles, 95), 1)
          });
        }
        state = 'ready';
        startIndex = null;
        bottomIndex = null;
      }
    }
  }

  return reps;
}

export function applyRepetitionSummary(diagnostic, repetitions) {
  if (!repetitions.length) return diagnostic;
  diagnostic.repetitions = {
    detected: repetitions.length,
    averageDurationSeconds: round(mean(repetitions.map(rep => rep.durationSeconds)), 2),
    mode: 'repetition-aware',
    note: `Metrics include ${repetitions.length} detected complete repetition${repetitions.length === 1 ? '' : 's'}.`,
    items: repetitions
  };
  return diagnostic;
}
