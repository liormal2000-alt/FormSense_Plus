const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ALLOWED_ACTIONS = new Set(['coach_summary', 'recommendations']);
const MAX_BODY_LENGTH = 50_000;
const COACH_SCHEMA = {
  type: 'OBJECT',
  required: ['positive', 'priority', 'nextStep'],
  propertyOrdering: ['positive', 'priority', 'nextStep'],
  properties: {
    positive: { type: 'STRING' },
    priority: { type: 'STRING' },
    nextStep: { type: 'STRING' }
  }
};
const RECOMMENDATIONS_SCHEMA = {
  type: 'OBJECT',
  required: ['intro', 'exercises'],
  propertyOrdering: ['intro', 'exercises'],
  properties: {
    intro: { type: 'STRING' },
    exercises: {
      type: 'ARRAY',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'OBJECT',
        required: ['name', 'setup', 'action', 'tip'],
        propertyOrdering: ['name', 'setup', 'action', 'tip'],
        properties: {
          name: { type: 'STRING' },
          setup: { type: 'STRING' },
          action: { type: 'STRING' },
          tip: { type: 'STRING' }
        }
      }
    }
  }
};
const FINDING_CATALOG = Object.freeze({
  squat_shoulder_symmetry: ['Shoulder level', 'Keep the torso centered and both shoulders level.'],
  squat_knee_tracking: ['Frontal knee alignment', 'Keep the descent controlled and avoid a visible inward knee collapse.'],
  squat_lateral_lean: ['Side-to-side torso alignment', 'Brace gently and keep your chest centered between your feet.'],
  squat_depth: ['Squat depth', 'Descend only as far as you can maintain control and a stable position.'],
  squat_torso_angle: ['Forward torso inclination', 'Keep the trunk braced and choose a depth you can control.'],
  squat_forward_shin_angle: ['Shin inclination', 'Keep balanced pressure through the foot.'],
  squat_heel_stability: ['Heel stability', 'Maintain balanced pressure and use a stance that lets the heel stay grounded.'],
  curl_body_sway: ['Side-to-side torso movement', 'Reduce momentum and keep the trunk stable.'],
  curl_arm_symmetry: ['Bilateral range symmetry', 'Use a load that allows both arms to move through a controlled range.'],
  curl_elbow_flare: ['Upper-arm flare', 'Keep the upper arms close to your sides without forcing an uncomfortable position.'],
  curl_shoulder_symmetry: ['Shoulder level', 'Relax the shoulders and keep them level.'],
  curl_extension: ['Elbow extension', 'Lower the weight under control to a comfortable extended position.'],
  curl_contraction: ['Top position', 'Curl through a controlled range without lifting the elbow forward.'],
  curl_elbow_drift: ['Upper-arm movement', 'Keep the upper arm stable and let the forearm create the movement.'],
  curl_torso_momentum: ['Forward-back torso movement', 'Reduce the load or slow the movement to keep the torso steady.'],
  insufficient_visible_frames: ['Recording visibility', 'Record again with the relevant joints visible and the camera steady.']
});

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });

  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  const model = Netlify.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  if (!apiKey) return json({ error: 'AI coaching is not configured.' }, 503);

  try {
    const rawBody = await request.text();
    if (!rawBody || rawBody.length > MAX_BODY_LENGTH) return json({ error: 'Invalid request size.' }, 413);
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: 'The AI request body was not valid JSON.' }, 400);
    }
    validateRequest(body);

    const safeDiagnostic = sanitizeDiagnostic(body.diagnostic);
    const { prompt, responseSchema } = buildRequest(body.action, safeDiagnostic);
    const providerResponse = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: body.action === 'coach_summary' ? 0.35 : 0.5,
          maxOutputTokens: body.action === 'coach_summary' ? 512 : 1024,
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      }),
      signal: AbortSignal.timeout(15_000)
    });

    const providerPayload = await providerResponse.json().catch(() => null);
    if (!providerPayload) return json({ error: 'The AI provider returned an unreadable response.' }, 502);
    if (!providerResponse.ok) {
      console.error('Gemini request failed', providerResponse.status, providerPayload?.error?.status);
      return json({ error: 'The AI service could not complete the request.' }, 502);
    }

    const candidate = providerPayload?.candidates?.[0];
    const text = extractFinalText(candidate);
    if (!text) return json({ error: 'The AI service returned an empty response.' }, 502);

    let generated;
    try {
      generated = JSON.parse(stripCodeFence(text));
    } catch {
      console.error('Gemini returned malformed structured output', candidate?.finishReason);
      return json({ error: 'The AI service returned malformed structured output. Please retry.' }, 502);
    }

    if (body.action === 'coach_summary') {
      validateCoachSummary(generated);
      return json({
        summary: [generated.positive, generated.priority, generated.nextStep].join(' '),
        provider: 'gemini',
        model
      });
    }

    const recommendations = generated;
    validateRecommendations(recommendations);
    return json({ recommendations, provider: 'gemini', model });
  } catch (error) {
    if (error?.name === 'TimeoutError') return json({ error: 'The AI service timed out.' }, 504);
    if (error?.publicMessage) return json({ error: error.publicMessage }, 400);
    console.error('Unexpected Gemini function error', error);
    return json({ error: 'Unexpected AI service error.' }, 500);
  }
};

function extractFinalText(candidate) {
  const parts = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts
    : [];

  return parts
    .filter(part => part?.thought !== true && typeof part?.text === 'string')
    .map(part => part.text)
    .join('')
    .trim();
}

function validateRequest(body) {
  if (!body || !ALLOWED_ACTIONS.has(body.action)) throw publicError('Unsupported AI action.');
  const diagnostic = body.diagnostic;
  if (!diagnostic || diagnostic.schemaVersion !== '1.0') throw publicError('Invalid diagnostic schema.');
  if (!['Squat', 'Bicep Curl'].includes(diagnostic.exercise)) throw publicError('Unsupported exercise.');
  if (!diagnostic.findings || !diagnostic.quality) throw publicError('Incomplete diagnostic data.');
}

function buildRequest(action, diagnostic) {
  const data = JSON.stringify(diagnostic);

  if (action === 'coach_summary') {
    return {
      responseSchema: COACH_SCHEMA,
      prompt: `You are the explanation layer of FormSense+, an exercise-form learning aid.\nThe deterministic vision pipeline has already made every biomechanical judgment. Do not add, remove, contradict, or medically diagnose findings. Treat confidence as a combination of landmark visibility and sample support, not proof of biomechanical accuracy.\n\nUsing only the combined front-and-side diagnostic JSON below, return three short English sentences as JSON fields. The positive field must mention the most useful positive finding, or honestly state that no high-confidence positive was available. The priority field must prioritize at most two corrections by severity and use only cues present in the data. The nextStep field must mention recording uncertainty when present, otherwise give a motivating practice step. Avoid claims about preventing injury and avoid saying the system is certain.\n\nDIAGNOSTIC JSON:\n${data}`
    };
  }

  return {
    responseSchema: RECOMMENDATIONS_SCHEMA,
    prompt: `The user completed a ${diagnostic.exercise}. Suggest exactly two established alternative exercises that target similar primary muscles. Do not provide medical or rehabilitation advice. Return only valid JSON in this exact shape:\n{"intro":"one short encouraging sentence","exercises":[{"name":"name","setup":"one sentence","action":"one sentence","tip":"one sentence"},{"name":"name","setup":"one sentence","action":"one sentence","tip":"one sentence"}]}\nKeep every field concise and in English. Context: ${data}`
  };
}

function sanitizeDiagnostic(diagnostic) {
  const findings = { good: [], corrections: [], uncertain: [] };
  for (const [bucket, status] of [['good', 'good'], ['corrections', 'correction'], ['uncertain', 'uncertain']]) {
    const input = Array.isArray(diagnostic.findings[bucket]) ? diagnostic.findings[bucket] : [];
    findings[bucket] = input.slice(0, 12).flatMap(finding => {
      const catalog = FINDING_CATALOG[finding?.id];
      if (!catalog) return [];
      const numericValue = Number(finding?.measurement?.value);
      return [{
        id: finding.id,
        label: catalog[0],
        status,
        sourceView: ['Front', 'Side-Left', 'Side-Right'].includes(finding.sourceView)
          ? finding.sourceView
          : diagnostic.view,
        severity: ['critical', 'moderate', 'minor'].includes(finding.severity) ? finding.severity : 'none',
        confidence: clampNumber(finding.confidence, 0, 100),
        measurement: Number.isFinite(numericValue) ? {
          value: numericValue,
          unit: String(finding.measurement.unit || '').slice(0, 30),
          aggregation: String(finding.measurement.aggregation || '').slice(0, 40)
        } : null,
        cue: status === 'uncertain'
          ? 'Record again with the relevant joints visible and the camera steady.'
          : status === 'correction'
            ? catalog[1]
            : ''
      }];
    });
  }

  return {
    exercise: diagnostic.exercise,
    view: ['Front', 'Side-Left', 'Side-Right', 'Combined'].includes(diagnostic.view) ? diagnostic.view : 'Unknown',
    views: Array.isArray(diagnostic.views)
      ? diagnostic.views.filter(view => ['Front', 'Side-Left', 'Side-Right'].includes(view)).slice(0, 2)
      : [],
    quality: {
      totalFrames: clampNumber(diagnostic.quality.totalFrames, 0, 100_000),
      validFrames: clampNumber(diagnostic.quality.validFrames, 0, 100_000),
      validFrameRatio: clampNumber(diagnostic.quality.validFrameRatio, 0, 1)
    },
    repetitions: {
      detected: clampNumber(diagnostic.repetitions?.detected, 0, 1_000),
      averageDurationSeconds: clampNumber(diagnostic.repetitions?.averageDurationSeconds, 0, 60),
      mode: diagnostic.repetitions?.mode === 'repetition-aware' ? 'repetition-aware' : 'video-level'
    },
    findings
  };
}

function validateCoachSummary(value) {
  if (!value) throw publicError('Invalid coaching response.');
  for (const key of ['positive', 'priority', 'nextStep']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) {
      throw publicError('Incomplete coaching response.');
    }
  }
}

function clampNumber(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(maximum, Math.max(minimum, number));
}

function validateRecommendations(value) {
  if (!value || typeof value.intro !== 'string' || !Array.isArray(value.exercises) || value.exercises.length !== 2) {
    throw publicError('Invalid recommendations response.');
  }
  for (const exercise of value.exercises) {
    for (const key of ['name', 'setup', 'action', 'tip']) {
      if (typeof exercise?.[key] !== 'string' || !exercise[key].trim()) throw publicError('Incomplete recommendations response.');
    }
  }
}

function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function publicError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}
