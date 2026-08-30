export function isPoint(point) {
  return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function getAngle(a, b, c) {
  if (![a, b, c].every(isPoint)) return null;
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  const degrees = Math.abs(radians * 180 / Math.PI);
  return degrees > 180 ? 360 - degrees : degrees;
}

export function getVectorAngle(p1, p2) {
  if (![p1, p2].every(isPoint)) return null;
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
}

export function getHorizontalDeviation(p1, p2) {
  if (![p1, p2].every(isPoint)) return null;
  return Math.atan2(Math.abs(p2.y - p1.y), Math.abs(p2.x - p1.x)) * 180 / Math.PI;
}

export function getVerticalDeviation(p1, p2) {
  if (![p1, p2].every(isPoint)) return null;
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);
  return Math.atan2(dx, dy) * 180 / Math.PI;
}

export function getVerticalDistance(p1, p2) {
  if (![p1, p2].every(isPoint)) return null;
  return Math.abs(p1.y - p2.y);
}

export function getEuclideanDistance(p1, p2) {
  if (![p1, p2].every(isPoint)) return null;
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function getMedialKneeOffset(hip, ankle, knee, bodyMidlineX) {
  if (![hip, ankle, knee].every(isPoint) || !Number.isFinite(bodyMidlineX)) return null;
  const verticalSpan = ankle.y - hip.y;
  if (Math.abs(verticalSpan) < Number.EPSILON) return null;
  const ratio = (knee.y - hip.y) / verticalSpan;
  const expectedX = hip.x + ratio * (ankle.x - hip.x);
  const medialDirection = Math.sign(bodyMidlineX - expectedX);
  if (medialDirection === 0) return 0;
  return ((knee.x - expectedX) * medialDirection) / Math.abs(verticalSpan);
}

export function midpoint(a, b) {
  if (![a, b].every(isPoint)) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
