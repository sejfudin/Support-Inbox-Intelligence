// Escapes regex metacharacters so user-supplied search text is matched as a
// literal string, not evaluated as a live regex pattern (prevents ReDoS from
// adversarial patterns like `(a+)+$` and fixes literal-character searches).
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };
