const crypto = require('crypto');

/**
 * Pure helpers for the intern dashboard's standup card. No DB, no clock, no
 * network — the summarise-or-not decision and the cache-validity rule both live
 * here so they can be unit-tested, and so the read path and the write path can
 * never disagree about whether a cached summary still applies.
 */

/**
 * How long a note has to be before it is worth summarising.
 *
 * Comfortably above the card's own clamp: a note under this fits in five or six
 * lines and reads better verbatim than paraphrased, and summarising it would
 * spend an AI call to say the same thing less precisely.
 */
const SUMMARY_MIN_CHARS = 400;

/**
 * Separators for the hash payload, as escape sequences.
 *
 * They must not be writable in a note, or a line containing one could forge a
 * section boundary and two different notes could hash alike. They are also
 * deliberately written as `\u001F` / `\u001E` rather than as the literal bytes:
 * an earlier version embedded raw NUL and SOH directly in the source, which made
 * git classify this file as binary — `file` reported `data` and every diff of it,
 * local and on GitHub, collapsed to "Binary files differ". A hashing helper that
 * decides whether a cached summary is still valid is the last thing that should be
 * invisible to review. As printed text it also read as `.join(' ')` / `.join('')`,
 * which would have collided: `done: ['a']` and `todo: ['a']` hash identically once
 * the separators are stripped, and any editor or formatter that normalised control
 * characters would have silently introduced exactly that.
 */
const LINE_SEP = '\u001F'; // US — between lines within a section
const SECTION_SEP = '\u001E'; // RS — between done / todo / blockers

/** Every line of a note, in a stable order. */
const noteLines = ({ done = [], todo = [], blockers = [] }) => [
  ...done,
  ...todo,
  ...blockers.map((blocker) => (typeof blocker === 'string' ? blocker : blocker.text || '')),
];

/** Total characters of note text — what the length threshold is measured against. */
const noteLength = (entry) =>
  noteLines(entry).reduce((total, line) => total + String(line).trim().length, 0);

/**
 * Digest of the exact text a summary was generated from.
 *
 * Sections are joined with a separator that cannot appear inside a line, so
 * moving a line between `done` and `todo` changes the hash — the same set of
 * lines under different headings is a different note and deserves a different
 * summary. Hashed rather than stored verbatim so an entry does not carry a second
 * copy of itself.
 */
const noteSourceHash = ({ done = [], todo = [], blockers = [] }) => {
  const payload = [
    done.join(LINE_SEP),
    todo.join(LINE_SEP),
    blockers
      .map((blocker) => (typeof blocker === 'string' ? blocker : blocker.text || ''))
      .join(LINE_SEP),
  ].join(SECTION_SEP);

  return crypto.createHash('sha256').update(payload).digest('hex');
};

/** Whether a note is long enough that the card should show a summary instead. */
const shouldSummarize = (entry) => noteLength(entry) >= SUMMARY_MIN_CHARS;

/**
 * Whether a stored summary can still be shown.
 *
 * Requires text AND a hash that matches the note as it stands now. An entry
 * edited after its summary was generated fails here, which is what stops a stale
 * paraphrase from being presented as the current note.
 */
const isSummaryFresh = (entry) => {
  const summary = entry?.aiSummary;
  if (!summary?.text || !summary?.sourceHash) return false;
  return summary.sourceHash === noteSourceHash(entry);
};

module.exports = {
  SUMMARY_MIN_CHARS,
  noteLines,
  noteLength,
  noteSourceHash,
  shouldSummarize,
  isSummaryFresh,
};
