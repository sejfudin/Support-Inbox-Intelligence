const {
  DESCRIPTION_CHAR_CAP,
  stripToText,
  buildSprintTicketFacts,
  sprintSummarySourceHash,
  perUserProgress,
  carryOverSubjects,
} = require('./sprintSummaryData');

// backlog -> todo -> doing -> done, matching how a workspace orders its columns.
const STATUSES = [
  { _id: 'backlog', isBacklog: true, sortOrder: 0 },
  { _id: 'todo', sortOrder: 1 },
  { _id: 'doing', sortOrder: 2 },
  { _id: 'done', isDone: true, sortOrder: 3 },
];

const ticket = (over = {}) => ({
  taskNumber: 1,
  subject: 'Subject',
  description: '<p>Body</p>',
  status: 'done',
  storyPoints: 3,
  assignedTo: ['u1'],
  isArchived: false,
  ...over,
});

describe('stripToText', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripToText('<p>Hello   <strong>there</strong></p>\n<p>friend</p>')).toBe(
      'Hello there friend'
    );
  });

  it('is empty for nullish input', () => {
    expect(stripToText(null)).toBe('');
    expect(stripToText(undefined)).toBe('');
  });
});

describe('buildSprintTicketFacts', () => {
  it('drops archived tickets', () => {
    const facts = buildSprintTicketFacts(
      [ticket({ taskNumber: 1 }), ticket({ taskNumber: 2, isArchived: true })],
      STATUSES
    );
    expect(facts.map((f) => f.number)).toEqual([1]);
  });

  it('strips the description and caps its length', () => {
    const long = `<p>${'x'.repeat(DESCRIPTION_CHAR_CAP + 100)}</p>`;
    const [fact] = buildSprintTicketFacts([ticket({ description: long })], STATUSES);
    expect(fact.description).toHaveLength(DESCRIPTION_CHAR_CAP);
    expect(fact.description).not.toContain('<');
  });

  it('buckets by the ticket status against the workspace columns', () => {
    const facts = buildSprintTicketFacts(
      [
        ticket({ taskNumber: 1, status: 'done' }),
        ticket({ taskNumber: 2, status: 'doing' }),
        ticket({ taskNumber: 3, status: 'todo' }),
      ],
      STATUSES
    );
    expect(facts.map((f) => f.bucket)).toEqual(['done', 'inProgress', 'todo']);
  });

  it('treats a missing estimate as zero points', () => {
    const [fact] = buildSprintTicketFacts([ticket({ storyPoints: null })], STATUSES);
    expect(fact.points).toBe(0);
  });

  it('normalises assignee ids to strings', () => {
    const [fact] = buildSprintTicketFacts(
      [ticket({ assignedTo: [{ _id: 'u9' }, 'u2'] })],
      STATUSES
    );
    expect(fact.assigneeIds).toEqual(['u9', 'u2']);
  });
});

describe('sprintSummarySourceHash', () => {
  const base = buildSprintTicketFacts(
    [
      ticket({ taskNumber: 1, status: 'done', storyPoints: 2, assignedTo: ['u1'] }),
      ticket({ taskNumber: 2, status: 'doing', storyPoints: 5, assignedTo: ['u2', 'u1'] }),
    ],
    STATUSES
  );

  it('is independent of ticket order', () => {
    expect(sprintSummarySourceHash(base)).toBe(sprintSummarySourceHash([...base].reverse()));
  });

  it('is unchanged when only a subject changes', () => {
    const renamed = base.map((f) => ({ ...f, subject: `${f.subject} (edited)` }));
    expect(sprintSummarySourceHash(renamed)).toBe(sprintSummarySourceHash(base));
  });

  it('changes when a ticket moves bucket', () => {
    const moved = base.map((f, i) => (i === 1 ? { ...f, bucket: 'done' } : f));
    expect(sprintSummarySourceHash(moved)).not.toBe(sprintSummarySourceHash(base));
  });

  it('changes when an estimate changes', () => {
    const reestimated = base.map((f, i) => (i === 0 ? { ...f, points: 3 } : f));
    expect(sprintSummarySourceHash(reestimated)).not.toBe(sprintSummarySourceHash(base));
  });

  it('changes when assignees change, regardless of their order', () => {
    const reassigned = base.map((f, i) => (i === 1 ? { ...f, assigneeIds: ['u3'] } : f));
    expect(sprintSummarySourceHash(reassigned)).not.toBe(sprintSummarySourceHash(base));

    const shuffled = base.map((f, i) => (i === 1 ? { ...f, assigneeIds: ['u1', 'u2'] } : f));
    expect(sprintSummarySourceHash(shuffled)).toBe(sprintSummarySourceHash(base));
  });
});

describe('perUserProgress', () => {
  it('counts a shared ticket in full for every assignee', () => {
    const tickets = [ticket({ status: 'done', storyPoints: 5, assignedTo: ['u1', 'u2'] })];
    const { points, counts } = perUserProgress(tickets, STATUSES, ['u1', 'u2']);
    expect(points.get('u1')).toEqual({ done: 5, inProgress: 0, todo: 0, total: 5 });
    expect(points.get('u2')).toEqual({ done: 5, inProgress: 0, todo: 0, total: 5 });
    expect(counts.get('u1').total).toBe(1);
  });

  it('excludes archived tickets', () => {
    const tickets = [ticket({ status: 'done', storyPoints: 3, isArchived: true })];
    const { counts } = perUserProgress(tickets, STATUSES, ['u1']);
    expect(counts.get('u1')).toEqual({ done: 0, inProgress: 0, todo: 0, total: 0 });
  });

  it('splits points across done / in progress / to do', () => {
    const tickets = [
      ticket({ taskNumber: 1, status: 'done', storyPoints: 2, assignedTo: ['u1'] }),
      ticket({ taskNumber: 2, status: 'doing', storyPoints: 3, assignedTo: ['u1'] }),
      ticket({ taskNumber: 3, status: 'todo', storyPoints: 1, assignedTo: ['u1'] }),
    ];
    const { points } = perUserProgress(tickets, STATUSES, ['u1']);
    expect(points.get('u1')).toEqual({ done: 2, inProgress: 3, todo: 1, total: 6 });
  });

  it('gives a member with no sprint ticket an all-zero row', () => {
    const { points } = perUserProgress([ticket({ assignedTo: ['u1'] })], STATUSES, ['u2']);
    expect(points.get('u2')).toEqual({ done: 0, inProgress: 0, todo: 0, total: 0 });
  });
});

describe('carryOverSubjects', () => {
  it('lists the subjects of tickets that did not land', () => {
    const facts = buildSprintTicketFacts(
      [
        ticket({ taskNumber: 1, subject: 'Shipped thing', status: 'done' }),
        ticket({ taskNumber: 2, subject: 'Half-done thing', status: 'doing' }),
        ticket({ taskNumber: 3, subject: 'Untouched thing', status: 'todo' }),
      ],
      STATUSES
    );
    expect(carryOverSubjects(facts)).toEqual(['Half-done thing', 'Untouched thing']);
  });
});
