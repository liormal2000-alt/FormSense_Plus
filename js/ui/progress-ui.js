const fill = document.getElementById('progress-fill');
const value = document.getElementById('progress-value');
const track = document.querySelector('[role="progressbar"]');
const status = document.getElementById('processing-status');

export function resetProgress() {
  updateProgress(0);
  status.textContent = 'Loading the pose model…';
}

export function updateProgress(ratio) {
  const percentage = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  fill.style.width = `${percentage}%`;
  value.textContent = `${percentage}%`;
  track.setAttribute('aria-valuenow', String(percentage));
  if (percentage > 0 && percentage < 100) status.textContent = 'Extracting landmarks and measuring movement…';
  if (percentage === 100) status.textContent = 'Building your diagnostic report…';
}
