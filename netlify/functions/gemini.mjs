const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ALLOWED_ACTIONS = new Set(['coach_summary', 'recommendations']);
const MAX_BODY_LENGTH = 50_000;
const FINDING_CATALOG = Object.freeze({
  squat_shoulder_symmetry: ['Shoulder symmetry', 'Keep the torso centered and both shoulders level.'],
  squat_knee_tracking: ['Knee tracking', 'Keep each knee aligned with the direction of the corresponding foot.'],
  squat_lateral_lean: ['Lateral torso stability', 'Brace gently and keep your chest centered between your feet.'],
  squat_foot_angle: ['Foot position', 'Use a comfortable stance and keep each knee aligned with its foot.'],
  squat_front_depth_proxy: ['Depth proxy', 'Use the side view for the more reliable depth assessment.'],
  squat_depth: ['Squat depth', 'Descend only as far as you can maintain control and a stable position.'],
  squat_torso_angle: ['Torso angle', 'Keep the trunk braced and choose a depth you can control.'],
  squat_forward_shin_angle: ['Forward shin angle', 'Keep balanced pressure through the foot.'],
  squat_heel_stability: ['Heel stability', 'Maintain balanced pressure and use a stance that lets the heel stay grounded.'],
  curl_body_sway: ['Upper-body stability', 'Reduce momentum and keep the trunk stable.'],
  curl_arm_symmetry: ['Arm symmetry', 'Use a load that allows both arms to move through a controlled range.'],
  curl_elbow_flare: ['Elbow position', 'Keep the upper arms close to your sides without forcing an uncomfortable position.'],
  curl_shoulder_symmetry: ['Shoulder symmetry', 'Relax the shoulders and keep them level.'],
  curl_extension: ['Elbow extension', 'Lower the weight under control to a comfortable extended position.'],
  curl_contraction: ['Top position', 'Curl through a controlled range without lifting the elbow forward.'],
  curl_elbow_drift: ['Elbow drift', 'Keep the upper arm stable and let the forearm create the movement.'],
  curl_torso_momentum: ['Torso momentum', 'Reduce the load or slow the movement to keep the torso steady.'],
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
    const body = JSON.parse(rawBody);
    validateRequest(body);

    const safeDiagnostic = sanitizeDiagnostic(body.diagnostic);
    const { prompt, responseMimeType } = buildRequest(body.action, safeDiagnostic);
    const providerResponse = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: body.action === 'coach_summary' ? 0.35 : 0.5,
          maxOutputTokens: body.action === 'coach_summary' ? 260 : 700,
          responseMimeType
        }
      }),
      signal: AbortSignal.timeout(15_000)
    });

    const providerPayload = await providerResponse.json();
    if (!providerResponse.ok) {
      console.error('Gemini request failed', providerResponse.status, providerPayload?.error?.status);
      return json({ error: 'The AI service could not complete the request.' }, 502);
    }

    const text = providerPayload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return json({ error: 'The AI service returned an empty response.' }, 502);

    if (body.action === 'coach_summary') return json({ summary: text });
    const recommendations = JSON.parse(stripCodeFence(text));
    validateRecommendations(recommendations);
    return json({ recommendations });
  } catch (error) {
    if (error?.name === 'TimeoutError') return json({ error: 'The AI service timed out.' }, 504);
    if (error instanceof SyntaxError) return json({ error: 'Invalid JSON request or response.' }, 400);
    if (error?.publicMessage) return json({ error: error.publicMessage }, 400);
    console.error('Unexpected Gemini function error', error);
    return json({ error: 'Unexpected AI service error.' }, 500);
  }
};

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
      responseMimeType: 'text/plain',
      prompt: `You are the explanation layer of FormSense+, an exercise-form learning aid.\nThe deterministic vision pipeline has already made every biomechanical judgment. Do not add, remove, contradict, or medically diagnose findings. Treat confidence as landmark visibility, not proof of biomechanical accuracy.\n\nUsing only the diagnostic JSON below, write exactly three short, encouraging sentences in English:\n1. Mention the most useful positive finding, if one exists.\n2. Prioritize at most two corrections by severity and include practical cues already present in the data.\n3. Mention recording uncertainty when present, or finish with a motivating next step.\nAvoid claims about preventing injury and avoid saying the system is certain.\n\nDIAGNOSTIC JSON:\n${data}`
    };
  }

  return {
    responseMimeType: 'application/json',
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
        severity: ['critical', 'moderate', 'minor'].includes(finding.severity) ? finding.severity : 'none',
        confidence: clampNumber(finding.confidence, 0, 100),
        measurement: Number.isFinite(numericValue) ? {
          value: numericValue,
          unit: String(finding.measurement.unit || '').slice(0, 30),
          aggregation: String(finding.measurement.aggregation || '').slice(0, 40)
        } : null,
        cue: status === 'uncertain' ? 'Record again with the relevant joints visible and the camera steady.' : catalog[1]
      }];
    });
  }

  return {
    exercise: diagnostic.exercise,
    view: ['Front', 'Side-Left', 'Side-Right'].includes(diagnostic.view) ? diagnostic.view : 'Unknown',
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
