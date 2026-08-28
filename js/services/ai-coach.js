import { requestCoachSummary, requestRecommendations } from './gemini-client.js';

export async function generateCoachSummary(diagnostic) {
  const result = await requestCoachSummary(diagnostic);
  if (typeof result.summary !== 'string' || !result.summary.trim()) {
    throw new Error('The AI service returned an empty summary.');
  }
  return result.summary.trim();
}

export async function generateRecommendations(diagnostic) {
  const result = await requestRecommendations(diagnostic);
  if (!result.recommendations || !Array.isArray(result.recommendations.exercises)) {
    throw new Error('The AI service returned invalid recommendations.');
  }
  return result.recommendations;
}
