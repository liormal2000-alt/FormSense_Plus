export function renderPoseOverlay(canvas, result, { view = 'Front' } = {}) {
  const context = canvas.getContext('2d');
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(result.image, 0, 0, canvas.width, canvas.height);

  if (result.poseLandmarks) {
    window.drawConnectors(context, result.poseLandmarks, window.POSE_CONNECTIONS, {
      color: 'rgba(245, 248, 246, .88)',
      lineWidth: 2
    });
    window.drawLandmarks(context, result.poseLandmarks, {
      color: '#00f08a',
      lineWidth: 1,
      radius: 3
    });

    if (view === 'Front') drawAlignmentGuides(context, canvas, result.poseLandmarks);
  }
  context.restore();
}

function drawAlignmentGuides(context, canvas, landmarks) {
  const pairs = [[23, 27], [24, 28]];
  context.save();
  context.strokeStyle = 'rgba(243, 201, 79, .72)';
  context.lineWidth = 2;
  context.setLineDash([6, 6]);
  pairs.forEach(([hipIndex, ankleIndex]) => {
    const hip = landmarks[hipIndex];
    const ankle = landmarks[ankleIndex];
    if ((hip?.visibility ?? 0) < 0.5 || (ankle?.visibility ?? 0) < 0.5) return;
    context.beginPath();
    context.moveTo(hip.x * canvas.width, hip.y * canvas.height);
    context.lineTo(ankle.x * canvas.width, ankle.y * canvas.height);
    context.stroke();
  });
  context.restore();
}
