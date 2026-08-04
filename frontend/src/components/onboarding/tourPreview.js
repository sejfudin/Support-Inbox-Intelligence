import { useEffect, useState } from 'react';

/**
 * Example data shown on the intern dashboard **while the what's-new tour is
 * running**, and only where the real card would otherwise be empty.
 *
 * The tour explains cards by pointing at them. A brand-new intern has no
 * recommendation, no evaluation and no standup note yet, so without this the
 * tour spotlights "No recommendation yet" while the copy describes a placement
 * timeline — and the workload step describes a bar/donut toggle that isn't even
 * rendered at zero tickets.
 *
 * Two rules, both load-bearing:
 *
 * 1. **Never replaces real data.** Substitution happens per card and only when
 *    that card is empty. An intern with a real 3.5 average must never be shown a
 *    4.3, even for a few seconds — this is their own performance record.
 * 2. **Always visibly labelled.** Every card that renders this gets an "Example"
 *    chip. Fabricated evaluation scores and placements presented as real would be
 *    alarming, not helpful. If you add a card here, add the chip too.
 */

export const TOUR_ACTIVE_EVENT = 'whatsnew:active';

/** Fired by the tour when it opens and closes. */
export const emitTourActive = (active) => {
  window.dispatchEvent(new CustomEvent(TOUR_ACTIVE_EVENT, { detail: { active } }));
};

/** Whether the what's-new tour is on screen right now. */
export const useTourActive = () => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = (event) => setActive(Boolean(event.detail?.active));
    window.addEventListener(TOUR_ACTIVE_EVENT, onChange);
    return () => window.removeEventListener(TOUR_ACTIVE_EVENT, onChange);
  }, []);

  return active;
};

// Dates are relative to "now" so the example never reads as stale — a tour run in
// December should not show a July interview. Computed at call time, not module
// load, for the same reason.
const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const SAMPLE_WORKLOAD = {
  open: 5,
  buckets: [
    { slug: 'to do', label: 'To do', color: '#64748b', count: 1 },
    { slug: 'in progress', label: 'In progress', color: '#3b82f6', count: 2 },
    { slug: 'on staging', label: 'On staging', color: '#8b5cf6', count: 1 },
    { slug: 'blocked', label: 'Blocked', color: '#ef4444', count: 1 },
  ],
};

const SAMPLE_TICKETS = {
  total: 5,
  items: [
    {
      id: 'sample-1',
      taskNumber: 2,
      subject: 'Data export returns empty CSV',
      description: 'Blocking the reports release — flag it in standup if you are still stuck.',
      priority: 'critical',
      dueDate: daysFromNow(-1),
      category: 'Reports',
      status: { id: 's1', slug: 'blocked', label: 'Blocked', color: '#ef4444' },
      score: 1520,
      flags: ['overdue', 'blocked', 'critical'],
      overdue: true,
    },
    {
      id: 'sample-2',
      taskNumber: 5,
      subject: 'Flaky login test on CI',
      description: '',
      priority: 'high',
      dueDate: daysFromNow(2),
      category: 'Testing',
      status: { id: 's2', slug: 'in progress', label: 'In progress', color: '#3b82f6' },
      score: 140,
      flags: ['due-soon', 'high'],
      overdue: false,
    },
    {
      id: 'sample-3',
      taskNumber: 3,
      subject: 'Dashboard chart tooltip misaligned',
      description: '',
      priority: 'medium',
      dueDate: daysFromNow(4),
      category: 'UI',
      status: { id: 's2', slug: 'in progress', label: 'In progress', color: '#3b82f6' },
      score: 60,
      flags: [],
      overdue: false,
    },
    {
      id: 'sample-4',
      taskNumber: 4,
      subject: 'Add empty-state to interns list',
      description: '',
      priority: 'low',
      dueDate: daysFromNow(8),
      category: 'UI',
      status: { id: 's3', slug: 'to do', label: 'To do', color: '#64748b' },
      score: 0,
      flags: [],
      overdue: false,
    },
  ],
};

const SAMPLE_STANDUP = (date) => ({
  date,
  written: true,
  isWeekend: false,
  // No edit affordance on an example: the button would open an editor for an
  // entry that does not exist.
  editable: false,
  submittedAt: new Date().toISOString(),
  done: ['Finished the pagination fix on #3 and pushed it for review.'],
  todo: ['Pair with Jon on the export job, then pick up the interns-list empty state.'],
  blockers: [{ text: 'Still need review on #5 — the flaky CI login test.', linkedTicket: null }],
  ticketsMentioned: 3,
  aiSummary: null,
  needsSummary: false,
});

const SAMPLE_PIPELINE = {
  total: 1,
  current: {
    id: 'sample-rec',
    status: 'interviewing',
    statusDates: {
      recommended: daysFromNow(-8),
      interviewing: daysFromNow(-2),
      resulted: null,
    },
    position: 'Frontend Engineer',
    project: 'Project Atlas',
    technologies: [],
    interviews: [
      {
        company: 'the Atlas team',
        role: 'Junior Engineer',
        stage: '',
        scheduledAt: daysFromNow(4),
      },
    ],
    result: { outcome: null, decidedAt: null },
    updatedAt: daysFromNow(-2),
  },
};

const SAMPLE_EVALUATIONS = {
  total: 2,
  delta: 0.5,
  latest: {
    id: 'sample-eval-1',
    periodStart: daysFromNow(-90),
    periodEnd: daysFromNow(-2),
    averageScore: 4.3,
    evaluator: 'Your mentor',
  },
  items: [
    {
      id: 'sample-eval-1',
      periodStart: daysFromNow(-90),
      periodEnd: daysFromNow(-2),
      averageScore: 4.3,
      evaluator: 'Your mentor',
    },
    {
      id: 'sample-eval-2',
      periodStart: daysFromNow(-180),
      periodEnd: daysFromNow(-90),
      averageScore: 3.8,
      evaluator: 'Your mentor',
    },
  ],
};

/**
 * Merge example data into a dashboard payload, per card, only where that card has
 * nothing real to show. Returns `{ dashboard, preview }` where `preview` flags
 * which cards were substituted, so each can render its "Example" chip.
 */
export const withTourSamples = (dashboard, active) => {
  if (!active || !dashboard) return { dashboard, preview: {} };

  const preview = {
    workload: (dashboard.workload?.open ?? 0) === 0,
    tickets: (dashboard.tickets?.total ?? 0) === 0,
    standup: !dashboard.standup?.written,
    pipeline: !dashboard.pipeline?.current,
    evaluations: !dashboard.evaluations?.latest,
  };

  return {
    preview,
    dashboard: {
      ...dashboard,
      workload: preview.workload ? SAMPLE_WORKLOAD : dashboard.workload,
      tickets: preview.tickets ? SAMPLE_TICKETS : dashboard.tickets,
      standup: preview.standup ? SAMPLE_STANDUP(dashboard.date) : dashboard.standup,
      pipeline: preview.pipeline ? SAMPLE_PIPELINE : dashboard.pipeline,
      evaluations: preview.evaluations ? SAMPLE_EVALUATIONS : dashboard.evaluations,
    },
  };
};
