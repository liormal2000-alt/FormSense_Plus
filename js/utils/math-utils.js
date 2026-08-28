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

export function getKneeOffset(hip, ankle, knee, side) {
  if (![hip, ankle, knee].every(isPoint)) return null;
  const totalHeight = ankle.y - hip.y;
  if (Math.abs(totalHeight) < Number.EPSILON) return null;
  const ratio = (knee.y - hip.y) / totalHeight;
  const expectedX = hip.x + ratio * (ankle.x - hip.x);
  const normalizedOffset = (knee.x - expectedX) / totalHeight;
  return side === 'left' ? -normalizedOffset : normalizedOffset;
}

export function getDirectionalDrift(shoulder, elbow, side) {
  if (![shoulder, elbow].every(isPoint)) return null;
  const angle = Math.atan2(Math.abs(shoulder.x - elbow.x), Math.abs(shoulder.y - elbow.y)) * 180 / Math.PI;
  const isForward = side === 'right' ? elbow.x > shoulder.x : elbow.x < shoulder.x;
  return isForward ? angle : -angle;
}

export function midpoint(a, b) {
  if (![a, b].every(isPoint)) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
