import { formatView } from './workflow-ui.js';

export function renderResults(diagnostic, { replayUrl, downloadName, isFinal }) {
  document.getElementById('results-step').textContent = `${diagnostic.exercise} · ${formatView(diagnostic.view)}`;
  document.getElementById('results-title').textContent = `${diagnostic.view === 'Front' ? 'Front' : 'Side'} analysis complete`;
  renderQuality(diagnostic);
  renderFindingList('list-good', diagnostic.findings.good, 'No high-confidence positive findings were available.');
  renderFindingList('list-bad', diagnostic.findings.corrections, 'No high-confidence corrections were detected.');
  renderFindingList('list-warn', diagnostic.findings.uncertain, 'No major visibility limitations were detected.');

  document.getElementById('col-warn').hidden = diagnostic.findings.uncertain.length === 0;
  const video = document.getElementById('outputVideo');
  const download = document.getElementById('downloadLink');
  video.src = replayUrl;
  download.href = replayUrl;
  download.download = downloadName;
  document.getElementById('video-section').hidden = true;
  document.getElementById('toggle-replay').textContent = 'Watch skeleton replay';

  document.getElementById('continue-btn').hidden = isFinal;
  document.getElementById('final-actions').hidden = !isFinal;
  document.getElementById('retake-btn').textContent = `Retake ${diagnostic.view === 'Front' ? 'front' : 'side'} view`;
  document.getElementById('recommend-btn').textContent = `More exercises like ${diagnostic.exercise}`;
  document.getElementById('recommendations').hidden = true;
  resetAiPanel();
}

function renderQuality(diagnostic) {
  const ratio = Math.round(diagnostic.quality.validFrameRatio * 100);
  const reps = diagnostic.repetitions.detected;
  const values = [
    ['Tracked frames', diagnostic.quality.totalFrames],
    ['Usable frames', `${diagnostic.quality.validFrames} (${ratio}%)`],
    ['Complete reps', reps || 'Not reliably detected'],
    ['Analysis mode', diagnostic.repetitions.mode]
  ];
  const strip = document.getElementById('quality-strip');
  strip.replaceChildren(...values.map(([label, value]) => {
    const pill = document.createElement('span');
    pill.className = 'quality-pill';
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    pill.append(strong, document.createTextNode(String(value)));
    return pill;
  }));
}

function renderFindingList(id, findings, emptyMessage) {
  const container = document.getElementById(id);
  if (!findings.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = emptyMessage;
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(...findings.map(createFindingCard));
}

function createFindingCard(finding) {
  const card = document.createElement('article');
  card.className = 'finding-card';
  const heading = document.createElement('div');
  heading.className = 'finding-heading';
  const label = document.createElement('span');
  label.className = 'finding-label';
  label.textContent = finding.label;
  heading.append(label);

  if (finding.status === 'correction') {
    const severity = document.createElement('span');
    severity.className = `severity-tag severity-${finding.severity}`;
    severity.textContent = finding.severity;
    heading.append(severity);
  }

  const message = document.createElement('p');
  message.className = 'finding-message';
  message.textContent = finding.message;
  card.append(heading, message);

  if (finding.cue) {
    const cue = document.createElement('p');
    cue.className = 'finding-cue';
    cue.textContent = `Cue: ${finding.cue}`;
    card.append(cue);
  }

  const meta = document.createElement('p');
  meta.className = 'finding-meta';
  const metric = finding.measurement
    ? ` · ${formatMeasurement(finding.measurement)}`
    : '';
  meta.textContent = `Tracking confidence: ${finding.confidence}%${metric}`;
  card.append(meta);
  return card;
}

function formatMeasurement(measurement) {
  const units = {
    degrees: '°',
    ratio: '',
    normalized_offset: '',
    normalized_distance: ''
  };
  return `${measurement.value}${units[measurement.unit] ?? ` ${measurement.unit}`} (${measurement.aggregation.replaceAll('_', ' ')})`;
}

export function setAiLoading() {
  document.getElementById('ai-loading').hidden = false;
  document.getElementById('ai-response').hidden = true;
  document.getElementById('ai-error').hidden = true;
  document.getElementById('ai-retry').hidden = true;
}

export function showAiSummary(summary) {
  document.getElementById('ai-loading').hidden = true;
  const response = document.getElementById('ai-response');
  response.textContent = summary;
  response.hidden = false;
}

export function showAiError(message) {
  document.getElementById('ai-loading').hidden = true;
  const error = document.getElementById('ai-error');
  error.textContent = `${message} Your rule-based results are still available above.`;
  error.hidden = false;
  document.getElementById('ai-retry').hidden = false;
}

export function resetAiPanel() {
  document.getElementById('ai-response').textContent = '';
  document.getElementById('ai-error').textContent = '';
  setAiLoading();
}

export function renderRecommendations(data) {
  const section = document.getElementById('recommendations');
  const content = document.getElementById('recommendations-content');
  const intro = document.createElement('p');
  intro.className = 'recommendation-intro';
  intro.textContent = data.intro;
  const grid = document.createElement('div');
  grid.className = 'recommendation-grid';

  data.exercises.forEach(exercise => {
    const card = document.createElement('article');
    card.className = 'recommendation-card';
    const title = document.createElement('h3');
    title.textContent = exercise.name;
    const setup = paragraph('Setup', exercise.setup);
    const action = paragraph('Action', exercise.action);
    const tip = paragraph('Tip', exercise.tip);
    const link = document.createElement('a');
    link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to do ${exercise.name}`)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Find technique videos on YouTube →';
    card.append(title, setup, action, tip, link);
    grid.append(card);
  });

  content.replaceChildren(intro, grid);
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function showRecommendationError(message) {
  const section = document.getElementById('recommendations');
  const error = document.createElement('p');
  error.className = 'inline-error';
  error.textContent = message;
  document.getElementById('recommendations-content').replaceChildren(error);
  section.hidden = false;
}

function paragraph(label, text) {
  const node = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  node.append(strong, document.createTextNode(text));
  return node;
}
