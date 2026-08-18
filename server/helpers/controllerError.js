/**
 * The controller catch block: map a thrown error to a response, or hand it on.
 *
 * Every controller wrote its own copy of this — eleven of them, in six different
 * shapes. They disagreed on things a caller cannot see from the outside: four
 * omitted `success: false`, four had no `ValidationError` branch (so a Mongoose
 * validation failure answered 500 instead of 400), and one passed `error.data`
 * through while the rest dropped it. Copying a handler between sibling
 * controllers therefore silently changed the response shape. Same argument as
 * `httpError.js` next door, one layer up.
 *
 * The three branches, in order:
 *
 * 1. An error carrying `statusCode` — a deliberate `httpError` from a service.
 *    Answered with the documented `{ success, message, data? }` envelope, where
 *    `data` appears only if the error carries some (`StatusValidationError` and
 *    friends attach field-level detail there).
 * 2. A Mongoose `ValidationError` — the model rejected the write, which is the
 *    caller's fault, so 400 with every field message joined rather than a 500.
 * 3. Anything else — no `statusCode` means unexpected (a `CastError`, a driver
 *    timeout, a `TypeError`), so it falls through to Express. That fall-through
 *    is what keeps internal detail out of JSON responses; see
 *    `.claude/docs/conventions.md`.
 *
 * `attachmentImage.js` deliberately does NOT use this: it serves image bytes,
 * has no `next` to fall through to, and must answer a fixed 500 with its own
 * message rather than leak an error into an <img> request.
 */
const handleControllerError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.data ? { data: error.data } : {}),
    });
  }

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors)
      .map((err) => err.message)
      .join(', ');
    return res.status(400).json({ success: false, message });
  }

  return next(error);
};

module.exports = { handleControllerError };
