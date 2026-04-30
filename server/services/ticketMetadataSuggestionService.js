const ALLOWED_PRIORITIES = ["low", "medium", "high", "critical"];
const PRIORITY_SET = new Set(ALLOWED_PRIORITIES);

const STORY_POINTS_MIN = 1;
const STORY_POINTS_MAX = 5;
const DEFAULT_GROQ_URL = "https://api.groq.com/openai/v1/responses";

const { buildTicketMetadataSuggestionPrompt } = require("../prompts/ticketPrompts");

function createSuggestionError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}


// Helpers 
function normalizeText(value) {
  return String(value || "").trim();
}

function validateSuggestionInput({ subject, description }) {
  const safeSubject = normalizeText(subject);
  const safeDescription = normalizeText(description);

  if (safeSubject.length < 3) {
    return "Subject must be at least 3 characters long";
  }

  if (safeDescription.length < 10) {
    return "Description must be at least 10 characters long";
  }

  return null;
}

function normalizePriority(value) {
  const safe = String(value || "").trim().toLowerCase();
  return PRIORITY_SET.has(safe) ? safe : null;
}

function normalizeStoryPoints(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  const rounded = Math.round(parsed);
  if (rounded < STORY_POINTS_MIN || rounded > STORY_POINTS_MAX) return null;

  return rounded;
}

function sanitizeSuggestion(raw) {
  if (!raw || typeof raw !== "object") return null;

  const priority = normalizePriority(raw.priority);
  const storyPoints = normalizeStoryPoints(raw.storyPoints);

  if (!priority || storyPoints === null) return null;

  return { priority, storyPoints };
}

// AI
function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

function getGroqModel() {
  return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
}

function getGroqTimeoutMs() {
  const parsed = Number(process.env.GROQ_TIMEOUT_MS || 6000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6000;
}

function getGroqUrl() {
  const safeUrl = String(process.env.GROQ_URL || DEFAULT_GROQ_URL).trim();

  try {
    const parsed = new URL(safeUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
    return parsed.toString();
  } catch {
    throw createSuggestionError("Invalid GROQ_URL configuration on server.", 503);
  }
}

function buildGroqRequestBody({ subject, description }) {
  return {
    model: getGroqModel(),
    input: buildTicketMetadataSuggestionPrompt({ subject, description }),
  };
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

async function requestGroqSuggestion({ subject, description, groqUrl }) {
  try {
    const response = await fetch(groqUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(buildGroqRequestBody({ subject, description })),
      signal: AbortSignal.timeout(getGroqTimeoutMs()),
    });

    if (!response.ok) {
      throw createSuggestionError(
        `AI provider request failed with status ${response.status}.`,
        503,
      );
    }

    const data = await response.json();
    const text = extractOutputText(data);
    const parsed = extractJsonObject(text);
    const sanitized = sanitizeSuggestion(parsed);

    if (!sanitized) {
      throw createSuggestionError("AI returned invalid suggestion format.", 502);
    }

    return sanitized;
  } catch (error) {
    if (error?.statusCode) throw error;

    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw createSuggestionError("AI request timed out. Please try again.", 503);
    }

    throw createSuggestionError(
      "AI suggestion is currently unavailable. Please try again.",
      503,
    );
  }
}

async function suggestTicketMetadata({ subject, description }) {
  const safeSubject = normalizeText(subject);
  const safeDescription = normalizeText(description);

  if (!isGroqConfigured()) {
    throw createSuggestionError("AI is not configured on server.", 503);
  }

  const groqUrl = getGroqUrl();

  return requestGroqSuggestion({
    subject: safeSubject,
    description: safeDescription,
    groqUrl,
  });
}


module.exports = {
  validateSuggestionInput,
  suggestTicketMetadata,
  ALLOWED_PRIORITIES,
  STORY_POINTS_MIN,
  STORY_POINTS_MAX,
};
