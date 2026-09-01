// Pure shaping for the sprint recap. No DB, no clock, no network — the read path
// and the write path both build the AI input and the freshness digest from here,
// so a cached recap and a freshly generated one can never disagree about what
// counts. Bucketing, the archived-ticket rule, id stringification and the empty
// bucket shape are NOT reimplemented: they are imported from `sprintRules.js`,
// which owns them once (ADR 0011).

const crypto = require('crypto');
const {
  bucketSprintTicket,
  firstMainStatusKey,
  SPRINT_BUCKETS,
  countsTowardsSprint,
  emptyBuckets,
  idKey,
} = require('./sprintRules');

// Tickets fed to the model. A sprint holding more than this is summarised from
// its first 60 (newest first, the caller sorts) — the recap is a digest, not an
// inventory, and the token budget is real.
const SUMMARY_TICKET_CAP = 60;

// Per-ticket description characters fed to the model. Enough for the gist of a
// ticket, short enough that 60 of them stay within one request.
const DESCRIPTION_CHAR_CAP = 400;

const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

// Rich-text (TipTap) description -> plain text for the prompt. A plain tag strip,
// not `sanitize-html`: this text is only ever fed to the model, never rendered,
// so there is no injection surface to defend — and keeping this helper free of
// `sanitize-html` (whose ESM dependency Jest will not parse) is what lets it be
// unit-tested directly, like `sprintRules.js` beside it.
const stripToText = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#?\w+;/g, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toTicketFact = (ticket, statuses, todoKey) => ({
  number: ticket?.taskNumber ?? null,
  subject: String(ticket?.subject || '').trim(),
  description: stripToText(ticket?.description).slice(0, DESCRIPTION_CHAR_CAP),
  bucket: bucketSprintTicket(ticket, statuses, todoKey),
  points: typeof ticket?.storyPoints === 'number' ? ticket.storyPoints : 0,
  assigneeIds: Array.isArray(ticket?.assignedTo)
    ? ticket.assignedTo.map(idKey).filter(Boolean)
    : [],
});

// The flat per-ticket facts the prompt and the freshness digest both read.
// Archived tickets are dropped here, once, so nothing downstream has to remember.
const buildSprintTicketFacts = (tickets = [], statuses = []) => {
  const todoKey = firstMainStatusKey(statuses);
  return tickets
    .filter(countsTowardsSprint)
    .map((ticket) => toTicketFact(ticket, statuses, todoKey));
};

// Deterministic digest of the sprint's ticket state: task number, bucket, points
// and assignees per ticket, order-independent. Editing a ticket's title alone
// does not change it — the recap is about what shipped, not its exact wording —
// but moving a ticket between buckets, re-estimating it or re-assigning it does,
// which is what lets a read tell a still-current recap from a stale one. Mirrors
// `noteSourceHash` in `helpers/standupNote.js`.
const sprintSummarySourceHash = (ticketFacts = []) => {
  const rows = ticketFacts
    .map(
      (fact) =>
        `${fact.number}|${fact.bucket}|${fact.points}|${[...fact.assigneeIds].sort().join(',')}`
    )
    .sort();
  return crypto.createHash('sha256').update(rows.join('\n')).digest('hex');
};

// Story points and ticket counts for one sprint, split per member id. A ticket
// with several assignees counts IN FULL for each of them: a shared ticket is
// work every assignee did, and splitting the points would make the per-person
// rows stop summing to anything a reader recognises. Archived tickets are
// excluded, matching the team totals. Members with no sprint ticket come back
// with zero buckets, and the caller drops them from the view.
const perUserProgress = (tickets = [], statuses = [], memberIds = []) => {
  const todoKey = firstMainStatusKey(statuses);
  const wanted = new Set(memberIds.map(String));
  const points = new Map();
  const counts = new Map();
  wanted.forEach((id) => {
    points.set(id, emptyBuckets());
    counts.set(id, emptyBuckets());
  });

  tickets.filter(countsTowardsSprint).forEach((ticket) => {
    const bucket = bucketSprintTicket(ticket, statuses, todoKey);
    const estimate = typeof ticket?.storyPoints === 'number' ? ticket.storyPoints : 0;
    const assignees = Array.isArray(ticket?.assignedTo) ? ticket.assignedTo.map(idKey) : [];

    assignees
      .filter((id) => id && wanted.has(id))
      .forEach((id) => {
        points.get(id)[bucket] += estimate;
        points.get(id).total += estimate;
        counts.get(id)[bucket] += 1;
        counts.get(id).total += 1;
      });
  });

  return { points, counts };
};

// Subjects of the tickets that did not land — derived, always available, shown
// whether or not an AI recap has been generated.
const carryOverSubjects = (ticketFacts = []) =>
  ticketFacts
    .filter((fact) => fact.bucket !== SPRINT_BUCKETS.DONE)
    .map((fact) => fact.subject)
    .filter(Boolean);

module.exports = {
  SUMMARY_TICKET_CAP,
  DESCRIPTION_CHAR_CAP,
  stripToText,
  countsTowardsSprint,
  buildSprintTicketFacts,
  sprintSummarySourceHash,
  perUserProgress,
  carryOverSubjects,
};
