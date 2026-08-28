import { getExerciseConfig } from '../config/exercise-config.js';

export function showView(id) {
  document.querySelectorAll('.view').forEach(view => {
    const active = view.id === id;
    view.classList.toggle('active', active);
    view.setAttribute('aria-hidden', String(!active));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function configureUploadView(exercise, view, stage) {
  const config = getExerciseConfig(exercise);
  const front = view === 'Front';
  document.getElementById('step-label').textContent = `Step ${stage + 1} of 2 · ${front ? 'Front' : 'Side'} analysis`;
  document.getElementById('upload-title').textContent = `Upload ${exercise} · ${formatView(view)}`;
  document.getElementById('upload-desc').textContent = front
    ? 'Use a front-facing recording so both sides of the body can be compared.'
    : 'Use a side recording to evaluate range of motion and front-to-back movement.';
  const guide = document.getElementById('guide-image');
  guide.src = front ? 'assets/guides/front-view.svg' : 'assets/guides/side-view.svg';
  guide.alt = front ? 'Front-view camera positioning guide' : 'Side-view camera positioning guide';
  const checklist = document.getElementById('recording-checklist');
  checklist.replaceChildren(...(front ? config.frontChecklist : config.sideChecklist).map(item => element('li', item)));
  setUploadError('');
}

export function setUploadError(message) {
  const node = document.getElementById('upload-error');
  node.textContent = message;
  node.hidden = !message;
}

export function showFatalError(message) {
  document.getElementById('fatal-error-message').textContent = message;
  showView('view-error');
}

export function formatView(view) {
  if (view === 'Front') return 'Front view';
  return view === 'Side-Right' ? 'Right side visible' : 'Left side visible';
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
