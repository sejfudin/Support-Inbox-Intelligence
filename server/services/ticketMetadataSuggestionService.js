const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_SET = new Set(ALLOWED_PRIORITIES);

const STORY_POINTS_MIN = 1;
const STORY_POINTS_MAX = 5;
const { MIN_SUBJECT_LENGTH, MIN_TEXT_LENGTH } = require('../helpers/aiValidationRules');

const { buildTicketMetadataSuggestionPrompt } = require('../prompts/ticketPrompts');
const {
  createAiServiceError,
  extractJsonObject,
  requestGroqOutputText,
} = require('./groqAiClient');

// Helpers
function normalizeText(value) {
  return String(value || '').trim();
}

function validateSuggestionInput({ subject, description }) {
  const safeSubject = normalizeText(subject);
  const safeDescription = normalizeText(description);

  if (safeSubject.length < MIN_SUBJECT_LENGTH) {
    return `Subject must be at least ${MIN_SUBJECT_LENGTH} characters long`;
  }

  if (safeDescription.length < MIN_TEXT_LENGTH) {
    return `Description must be at least ${MIN_TEXT_LENGTH} characters long`;
  }

  return null;
}

function normalizePriority(value) {
  const safe = String(value || '')
    .trim()
    .toLowerCase();
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
  if (!raw || typeof raw !== 'object') return null;

  const priority = normalizePriority(raw.priority);
  const storyPoints = normalizeStoryPoints(raw.storyPoints);

  if (!priority || storyPoints === null) return null;

  return { priority, storyPoints };
}

async function suggestTicketMetadata({ subject, description }) {
  const safeSubject = normalizeText(subject);
  const safeDescription = normalizeText(description);

  const prompt = buildTicketMetadataSuggestionPrompt({
    subject: safeSubject,
    description: safeDescription,
  });

  const outputText = await requestGroqOutputText({ prompt });
  const parsed = extractJsonObject(outputText);
  const sanitized = sanitizeSuggestion(parsed);

  if (!sanitized) {
    throw createAiServiceError('AI returned invalid suggestion format.', 502);
  }

  return sanitized;
}

module.exports = {
  validateSuggestionInput,
  suggestTicketMetadata,
  ALLOWED_PRIORITIES,
  STORY_POINTS_MIN,
  STORY_POINTS_MAX,
};
