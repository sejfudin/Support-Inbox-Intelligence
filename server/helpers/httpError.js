/**
 * An `Error` carrying the HTTP status a controller should answer with.
 *
 * Services throw these instead of touching `res`, so they stay transport-
 * agnostic and can be called from another service, a seeder or a test without
 * an HTTP request in sight. The controller's catch reads `statusCode` and maps
 * it; an error *without* one is by definition unexpected (a CastError, a driver
 * timeout, a TypeError) and falls through to Express's handler as a 500, which
 * is what keeps internal detail out of JSON responses.
 *
 * Argument order is `(message, statusCode)`, matching the majority of the call
 * sites this replaces. It used to be defined seven times across `services/`
 * under three names — `httpError(statusCode, message)`,
 * `createError(message, statusCode)` and `makeError(message, statusCode)` —
 * with the first taking its arguments in the opposite order from the other two.
 * Copying a `throw` between sibling services therefore produced `new Error(404)`
 * with the message in `statusCode`, and `res.status('Some message...')`
 * downstream. One signature is the point of this helper; the deduplication is
 * the smaller half of it.
 *
 * For domain errors that carry more than a status — `StatusValidationError` and
 * its field-level detail — write a class instead. See `.claude/docs/conventions.md`.
 */
const httpError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

module.exports = { httpError };
