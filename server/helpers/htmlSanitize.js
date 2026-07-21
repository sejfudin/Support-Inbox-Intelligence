const sanitizeHtml = require('sanitize-html');
const { DESCRIPTION_ALLOWED_TAGS } = require('./aiValidationRules');

const DESCRIPTION_SANITIZE_OPTIONS = {
  allowedTags: DESCRIPTION_ALLOWED_TAGS,
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Rich-text fields (ticket description) are rendered as HTML on the client
// (dangerouslySetInnerHTML), so they must be sanitized before persisting.
// Plain-text fields (comments) are NOT sanitized here — they render through
// React's text-node escaping, and running them through sanitize-html would
// entity-encode `&`/`<`/`>` into the stored value and corrupt the text.
const sanitizeDescriptionHtml = (html) =>
  sanitizeHtml(html || '', DESCRIPTION_SANITIZE_OPTIONS).trim();

module.exports = {
  sanitizeDescriptionHtml,
};
