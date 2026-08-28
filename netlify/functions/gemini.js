const ALLOWED_RESPONSE_MIME_TYPES = new Set([
  "text/plain",
  "application/json",
]);

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: { message: "Method not allowed. Use POST." },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not configured.");

    return jsonResponse(500, {
      error: { message: "The AI service is not configured." },
    });
  }

  let requestBody;

  try {
    requestBody = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      error: { message: "The request body must be valid JSON." },
    });
  }

  const prompt =
    typeof requestBody.prompt === "string"
      ? requestBody.prompt.trim()
      : "";

  const responseMimeType =
    requestBody.responseMimeType || "text/plain";

  if (!prompt) {
    return jsonResponse(400, {
      error: { message: "A non-empty prompt is required." },
    });
  }

  if (prompt.length > 30000) {
    return jsonResponse(413, {
      error: { message: "The prompt is too long." },
    });
  }

  if (!ALLOWED_RESPONSE_MIME_TYPES.has(responseMimeType)) {
    return jsonResponse(400, {
      error: { message: "Unsupported response MIME type." },
    });
  }

  const model =
    process.env.GEMINI_MODEL || "gemini-3.7-flash";

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  try {
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType,
        },
      }),
    });

    const data = await geminiResponse.json().catch(() => null);

    if (!geminiResponse.ok) {
      console.error(
        "Gemini API request failed:",
        geminiResponse.status,
        data?.error?.message || "Unknown upstream error"
      );

      return jsonResponse(geminiResponse.status, {
        error: {
          message:
            data?.error?.message ||
            "The AI service could not complete the request.",
        },
      });
    }

    if (!data) {
      return jsonResponse(502, {
        error: {
          message: "The AI service returned an invalid response.",
        },
      });
    }

    return jsonResponse(200, data);
  } catch (error) {
    console.error("Gemini request failed:", error);

    return jsonResponse(502, {
      error: { message: "Unable to reach the AI service." },
    });
  }
};
