export function finiteValues(values) {
  return (values ?? []).filter(Number.isFinite);
}

export function mean(values) {
  const clean = finiteValues(values);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

export function percentile(values, q) {
  const clean = finiteValues(values).sort((a, b) => a - b);
  if (!clean.length || !Number.isFinite(q)) return null;
  const boundedQ = Math.min(100, Math.max(0, q));
  const position = (clean.length - 1) * boundedQ / 100;
  const base = Math.floor(position);
  const rest = position - base;
  return clean[base + 1] === undefined
    ? clean[base]
    : clean[base] + rest * (clean[base + 1] - clean[base]);
}

export function standardDeviation(values) {
  const clean = finiteValues(values);
  if (!clean.length) return null;
  const average = mean(clean);
  return Math.sqrt(clean.reduce((sum, value) => sum + (value - average) ** 2, 0) / clean.length);
}

export function movingAverage(values, windowSize = 5) {
  const cleanWindow = Math.max(1, Math.floor(windowSize));
  return values.map((_, index) => {
    const start = Math.max(0, index - Math.floor(cleanWindow / 2));
    const end = Math.min(values.length, index + Math.floor(cleanWindow / 2) + 1);
    return mean(values.slice(start, end));
  });
}

export function range(values) {
  const clean = finiteValues(values);
  return clean.length ? Math.max(...clean) - Math.min(...clean) : null;
}

export function round(value, digits = 0) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
