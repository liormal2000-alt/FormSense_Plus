const ENDPOINT = '/.netlify/functions/gemini';

export async function requestCoachSummary(diagnostic) {
  return callFunction('coach_summary', diagnostic);
}

export async function requestRecommendations(diagnostic) {
  return callFunction('recommendations', diagnostic);
}

async function callFunction(action, diagnostic) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, diagnostic }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The AI service is temporarily unavailable.');
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The AI request timed out. Please try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
