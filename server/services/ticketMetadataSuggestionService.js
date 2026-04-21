const ALLOWED_PRIORITIES = ["low", "medium", "high", "critical"];
const PRIORITY_SET = new Set(ALLOWED_PRIORITIES);

const STORY_POINTS_MIN = 1;
const STORY_POINTS_MAX = 5;

// if AI doesn't work 
const DEFAULT_PRIORITY = "medium";
const DEFAULT_STORY_POINTS = 3;

const GROQ_URL = "https://api.groq.com/openai/v1/responses";

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

function buildSuggestionPrompt({ subject, description }) {
  return [
    "You are a ticket triage assistant.",
    "Return ONLY valid JSON with exact shape:",
    '{"priority":"low|medium|high|critical","storyPoints":1}',
    "Rules:",
    "- priority must be one of low, medium, high, critical",
    "- storyPoints must be an integer from 1 to 5",
    "- base urgency on impact, risk, and production severity",
    "- base storyPoints on complexity, unknowns, and implementation effort",
    "",
    `Subject: ${subject}`,
    `Description: ${description}`,
  ].join("\n");
}

function buildGroqRequestBody({ subject, description }) {
  return {
    model: getGroqModel(),
    input: buildSuggestionPrompt({ subject, description }),
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

async function requestGroqSuggestion({ subject, description }) {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(buildGroqRequestBody({ subject, description })),
    signal: AbortSignal.timeout(getGroqTimeoutMs()),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${raw}`);
  }

  const data = await response.json();
  const text = extractOutputText(data);
  const parsed = extractJsonObject(text);

  return sanitizeSuggestion(parsed);
}

function toLowerText(subject, description) {
  return `${subject} ${description}`.toLowerCase();
}

// For fallback 

function scoreByKeywords(text, dictionary) {
  let score = 0;

  for (const item of dictionary) {
    if (text.includes(item.token)) {
      score += item.weight;
    }
  }

  return score;
}

function getPriorityKeywordScore(text) {
  return scoreByKeywords(text, [
    { token: "outage", weight: 7 },
    { token: "down", weight: 5 },
    { token: "production", weight: 4 },
    { token: "critical", weight: 4 },
    { token: "security", weight: 6 },
    { token: "data loss", weight: 7 },
    { token: "payment", weight: 4 },
    { token: "billing", weight: 3 },
    { token: "urgent", weight: 4 },
    { token: "cannot login", weight: 3 },
    { token: "blocked", weight: 3 },
  ]);
}

function mapPriorityScoreToPriority(score) {
  if (score >= 12) return "critical";
  if (score >= 7) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function getComplexityKeywordScore(text) {
  return scoreByKeywords(text, [
    { token: "refactor", weight: 3 },
    { token: "migration", weight: 4 },
    { token: "integrat", weight: 3 }, // catches integrate/integration
    { token: "webhook", weight: 3 },
    { token: "database", weight: 3 },
    { token: "auth", weight: 2 },
    { token: "socket", weight: 3 },
    { token: "cache", weight: 2 },
    { token: "performance", weight: 2 },
    { token: "api", weight: 2 },
    { token: "multiple", weight: 1 },
  ]);
}

function getLengthComplexityScore(description) {
  const words = normalizeText(description).split(/\s+/).filter(Boolean).length;
  if (words >= 180) return 4;
  if (words >= 120) return 3;
  if (words >= 70) return 2;
  if (words >= 30) return 1;
  return 0;
}

function mapComplexityScoreToStoryPoints(score) {
  if (score >= 11) return 5;
  if (score >= 8) return 4;
  if (score >= 5) return 3;
  if (score >= 3) return 2;
  return 1;
}

function buildFallbackSuggestion({ subject, description }) {
  const text = toLowerText(subject, description);

  const priorityScore = getPriorityKeywordScore(text);
  const complexityScore =
    getComplexityKeywordScore(text) + getLengthComplexityScore(description);

  const priority = mapPriorityScoreToPriority(priorityScore) || DEFAULT_PRIORITY;
  const storyPoints =
    mapComplexityScoreToStoryPoints(complexityScore) || DEFAULT_STORY_POINTS;

  return { priority, storyPoints };
}

async function suggestTicketMetadata({ subject, description }) {
  const safeSubject = normalizeText(subject);
  const safeDescription = normalizeText(description);

  const fallback = buildFallbackSuggestion({
    subject: safeSubject,
    description: safeDescription,
  });

  if (!isGroqConfigured()) {
    return { ...fallback, source: "fallback" };
  }

  try {
    const aiSuggestion = await requestGroqSuggestion({
      subject: safeSubject,
      description: safeDescription,
    });

    if (!aiSuggestion) {
      return { ...fallback, source: "fallback" };
    }

    return { ...aiSuggestion, source: "ai" };
  } catch (error) {
    console.error("[suggest-metadata] AI failed, using fallback:", error.message);
    return { ...fallback, source: "fallback" };
  }
}

module.exports = {
  validateSuggestionInput,
  suggestTicketMetadata,
  ALLOWED_PRIORITIES,
  STORY_POINTS_MIN,
  STORY_POINTS_MAX,
};
