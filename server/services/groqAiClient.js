function createAiServiceError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getGroqApiKey() {
  const safeKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!safeKey) {
    throw createAiServiceError("AI is not configured on server.", 503);
  }
  return safeKey;
}

function getGroqModel() {
  const safeModel = String(process.env.GROQ_MODEL || "").trim();
  if (!safeModel) {
    throw createAiServiceError("GROQ_MODEL is not configured on server.", 503);
  }
  return safeModel;
}

function getGroqTimeoutMs() {
  const raw = String(process.env.GROQ_TIMEOUT_MS || "").trim();
  if (!raw) {
    throw createAiServiceError("GROQ_TIMEOUT_MS is not configured on server.", 503);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createAiServiceError("Invalid GROQ_TIMEOUT_MS configuration on server.", 503);
  }

  return parsed;
}

function getGroqUrl() {
  const safeUrl = String(process.env.GROQ_URL || "").trim();
  if (!safeUrl) {
    throw createAiServiceError("GROQ_URL is not configured on server.", 503);
  }

  try {
    const parsed = new URL(safeUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
    return parsed.toString();
  } catch {
    throw createAiServiceError("Invalid GROQ_URL configuration on server.", 503);
  }
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];

  for (const item of outputItems) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractJsonObject(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function requestGroqOutputText({ prompt }) {
  const apiKey = getGroqApiKey();
  const groqUrl = getGroqUrl();
  const model = getGroqModel();
  const timeoutMs = getGroqTimeoutMs();

  try {
    const response = await fetch(groqUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw createAiServiceError(
        `AI provider request failed with status ${response.status}.`,
        503,
      );
    }

    const data = await response.json();
    const outputText = extractOutputText(data);

    if (!outputText) {
      throw createAiServiceError("AI provider returned empty output.", 502);
    }

    return outputText;
  } catch (error) {
    if (error?.statusCode) throw error;

    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw createAiServiceError("AI request timed out. Please try again.", 503);
    }

    throw createAiServiceError(
      "AI suggestion is currently unavailable. Please try again.",
      503,
    );
  }
}

module.exports = {
  createAiServiceError,
  extractJsonObject,
  requestGroqOutputText,
};
