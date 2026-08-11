import { format } from 'date-fns';

/**
 * The recommendation lifecycle as the *intern* reads it — shared by the dashboard's
 * "My pipeline" card and the full history on "My progress" so the two can never
 * disagree about which stage someone is at.
 *
 * Deliberately NOT `components/interns/recommendations/recommendationUi.jsx`, which
 * does the same job for the admin: that module carries the recommendations
 * redesign's own hardcoded palette and font stack and is built around the admin's
 * wording. This one is logic only, no markup, so both intern surfaces can style it
 * to their own context.
 */

// In order. Mirrors `RECOMMENDATION_STATUSES` on the server; the labels are the
// intern-facing wording rather than the admin table's.
export const STAGES = Object.freeze([
  { key: 'recommended', label: 'Recommended' },
  { key: 'interviewing', label: 'Interview' },
  { key: 'resulted', label: 'Result' },
]);

export const RESULT_LABEL = Object.freeze({
  placed: 'Placed 🎉',
  not_placed: 'Not placed this time',
});

export const formatStageDay = (value) => (value ? format(new Date(value), 'MMM d') : null);

/**
 * The state of each stage for one recommendation.
 *
 * The load-bearing rule: a stage *before* the current one with no recorded date was
 * **skipped**, not completed. Interviewing is legitimately skippable
 * (`recommended → resulted` straight through), and rendering that as "done" would
 * tell an intern they sat an interview that never happened.
 *
 * @returns {Array<{ key: string, label: string, state: 'done'|'current'|'skipped'|'pending', date: string|null }>}
 */
export const buildStageSteps = (recommendation) => {
  const dates = recommendation?.statusDates || {};
  const currentIndex = STAGES.findIndex((stage) => stage.key === recommendation?.status);

  return STAGES.map((stage, index) => {
    let state;
    if (index === currentIndex) state = 'current';
    else if (index < currentIndex) state = dates[stage.key] ? 'done' : 'skipped';
    else state = 'pending';
    return { ...stage, state, date: formatStageDay(dates[stage.key]) };
  });
};

/**
 * The same three stages with nothing behind them, for an intern who has not been
 * put forward yet — so the empty state can say what *will* happen rather than
 * going blank.
 */
export const EMPTY_STAGE_STEPS = STAGES.map((stage) => ({
  ...stage,
  state: 'pending',
  date: null,
}));

/**
 * The interview to put in front of the intern: the soonest one still ahead of them,
 * or failing that the latest one behind them.
 *
 * Stored order is not chronological, so taking the first dated record happily
 * presents last week's interview as what is coming next — the opposite of
 * actionable. `upcoming` is returned rather than recomputed by the caller so the
 * copy and the choice can never disagree about which side of now a date falls on.
 */
export const nextInterview = (interviews = []) => {
  const dated = (interviews || [])
    .filter((interview) => interview?.scheduledAt)
    .map((interview) => ({ ...interview, at: new Date(interview.scheduledAt).getTime() }))
    .filter((interview) => !Number.isNaN(interview.at));

  if (dated.length === 0) return null;

  const now = Date.now();
  const ahead = dated.filter((interview) => interview.at >= now);
  if (ahead.length > 0) {
    return { ...ahead.reduce((a, b) => (a.at <= b.at ? a : b)), upcoming: true };
  }
  return { ...dated.reduce((a, b) => (a.at >= b.at ? a : b)), upcoming: false };
};

/**
 * Every interview on a recommendation, soonest first, with dateless ones last.
 *
 * The pipeline card shows one; the progress page lists them all, and "all of them
 * in stored order" is not a chronology anyone can read.
 */
export const sortInterviews = (interviews = []) =>
  [...(interviews || [])].sort((a, b) => {
    const aAt = a?.scheduledAt ? new Date(a.scheduledAt).getTime() : null;
    const bAt = b?.scheduledAt ? new Date(b.scheduledAt).getTime() : null;
    if (aAt === null && bAt === null) return 0;
    if (aAt === null) return 1;
    if (bAt === null) return -1;
    return aAt - bAt;
  });
