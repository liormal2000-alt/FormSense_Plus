import { mean, percentile } from '../utils/statistics-utils.js';

export function aggregateByRepetition(samples, repetitions, selectValue, {
  withinRep,
  acrossReps = values => percentile(values, 50),
  fallback
}) {
  const cleanSamples = (samples ?? []).filter(sample =>
    Number.isFinite(sample?.time) && Number.isFinite(selectValue(sample))
  );

  if (repetitions?.length) {
    const perRepetitionValues = repetitions.flatMap(repetition => {
      const values = cleanSamples
        .filter(sample => sample.time >= repetition.startTime && sample.time <= repetition.endTime)
        .map(selectValue);
      const value = withinRep(values);
      return Number.isFinite(value) ? [value] : [];
    });

    if (perRepetitionValues.length) {
      return {
        value: acrossReps(perRepetitionValues),
        perRepetitionValues,
        mode: 'repetition_level'
      };
    }
  }

  const values = cleanSamples.map(selectValue);
  return {
    value: fallback(values),
    perRepetitionValues: [],
    mode: 'video_level_fallback'
  };
}

export function perRepetitionCustom(samples, repetitions, calculate, fallback) {
  if (repetitions?.length) {
    const values = repetitions.flatMap(repetition => {
      const repetitionSamples = (samples ?? []).filter(sample =>
        sample.time >= repetition.startTime && sample.time <= repetition.endTime
      );
      const value = calculate(repetitionSamples);
      return Number.isFinite(value) ? [value] : [];
    });
    if (values.length) {
      return {
        value: percentile(values, 50),
        perRepetitionValues: values,
        mode: 'repetition_level'
      };
    }
  }

  return {
    value: fallback(samples ?? []),
    perRepetitionValues: [],
    mode: 'video_level_fallback'
  };
}

export function aggregateRepetitionProperty(repetitions, property, fallbackValue) {
  const values = (repetitions ?? [])
    .map(repetition => repetition?.[property])
    .filter(Number.isFinite);

  if (values.length) {
    return {
      value: percentile(values, 50),
      perRepetitionValues: values,
      mode: 'repetition_level'
    };
  }

  return {
    value: fallbackValue,
    perRepetitionValues: [],
    mode: 'video_level_fallback'
  };
}

export const REP_AGGREGATORS = Object.freeze({
  minimum: values => values.length ? Math.min(...values) : null,
  maximum: values => values.length ? Math.max(...values) : null,
  median: values => percentile(values, 50),
  p05: values => percentile(values, 5),
  p95: values => percentile(values, 95),
  range: values => values.length ? Math.max(...values) - Math.min(...values) : null,
  mean
});
