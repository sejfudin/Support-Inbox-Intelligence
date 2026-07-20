const sanitizeHtml = require('sanitize-html');
const { DESCRIPTION_ALLOWED_TAGS } = require('./aiValidationRules');

const DESCRIPTION_SANITIZE_OPTIONS = {
  allowedTags: DESCRIPTION_ALLOWED_TAGS,
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

const PLAIN_TEXT_SANITIZE_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Rich-text fields (ticket description) keep a small formatting allowlist.
const sanitizeDescriptionHtml = (html) =>
  sanitizeHtml(html || '', DESCRIPTION_SANITIZE_OPTIONS).trim();

// Plain-text fields (comments) strip all markup — the editor never produces any.
const sanitizePlainText = (text) => sanitizeHtml(text || '', PLAIN_TEXT_SANITIZE_OPTIONS).trim();

module.exports = {
  sanitizeDescriptionHtml,
  sanitizePlainText,
};
