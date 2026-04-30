const sanitizeHtml = require("sanitize-html");
const { buildTicketDescriptionGenerationPrompt } = require("../prompts/ticketPrompts");
const {
  createAiServiceError,
  extractJsonObject,
  requestGroqOutputText,
} = require("./groqAiClient");

const MIN_SUBJECT_LENGTH = 3;
const MIN_PROMPT_LENGTH = 10;

const SANITIZE_OPTIONS = {
  allowedTags: ["p", "br", "ul", "ol", "li", "strong", "em", "code", "blockquote", "h3"],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function validateDescriptionGenerationInput({ subject, prompt }) {
  const safeSubject = normalizeText(subject);
  const safePrompt = normalizeText(prompt);

  if (safeSubject.length < MIN_SUBJECT_LENGTH) {
    return "Subject must be at least 3 characters long";
  }

  if (safePrompt.length < MIN_PROMPT_LENGTH) {
    return "Prompt must be at least 10 characters long";
  }

  return null;
}

function extractDescriptionHtmlFromPayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  return normalizeText(payload.descriptionHtml);
}

function sanitizeDescriptionHtml(html) {
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

async function generateTicketDescription({ subject, prompt }) {
  const safeSubject = normalizeText(subject);
  const safePrompt = normalizeText(prompt);

  const aiPrompt = buildTicketDescriptionGenerationPrompt({
    subject: safeSubject,
    prompt: safePrompt,
  });

  const outputText = await requestGroqOutputText({ prompt: aiPrompt });
  const parsed = extractJsonObject(outputText);

  const rawDescriptionHtml = extractDescriptionHtmlFromPayload(parsed);
  if (!rawDescriptionHtml) {
    throw createAiServiceError("AI returned invalid description format.", 502);
  }

  const descriptionHtml = sanitizeDescriptionHtml(rawDescriptionHtml);
  if (!descriptionHtml) {
    throw createAiServiceError("AI generated empty description.", 502);
  }

  return { descriptionHtml };
}

module.exports = {
  validateDescriptionGenerationInput,
  generateTicketDescription,
};
