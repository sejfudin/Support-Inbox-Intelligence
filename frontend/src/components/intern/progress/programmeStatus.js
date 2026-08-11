/**
 * Plain-English explanations of the intern lifecycle statuses, for the one screen
 * where the subject is the intern themselves.
 *
 * These are shown **next to** the status, never instead of it. The stored value is
 * still printed verbatim (`helpers/internProfile.js`: "Lifecycle statuses are shown
 * exactly as stored in the database — no label mapping") so the intern and their
 * admin are looking at the same word; this only answers "what does `ready` mean?",
 * which the word alone does not. Keep the wording as sentences, not labels — the
 * moment one of these becomes a two-word noun it has turned into the label mapping
 * the rest of the app deliberately avoids.
 */
export const INTERN_STATUS_MEANING = Object.freeze({
  active: 'You are on the programme and building toward placement.',
  ready: 'You have been marked ready for placement and can be put forward for projects.',
  placed: 'You have been placed on a client project.',
  completed: 'Your internship has finished.',
  discontinued: 'Your internship has ended early.',
});

export const statusMeaning = (status) => INTERN_STATUS_MEANING[status] || '';

/**
 * The badge tone per status. `ready` and `placed` are the good news; `discontinued`
 * is the one that should not read as neutral.
 */
export const statusBadgeVariant = (status) => {
  if (status === 'placed' || status === 'ready') return 'success';
  if (status === 'discontinued') return 'destructive';
  if (status === 'completed') return 'outline';
  return 'secondary';
};
