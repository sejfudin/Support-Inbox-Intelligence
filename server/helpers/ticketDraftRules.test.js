// The draft's normalization rules. The point of every case here is the same one:
// a draft is autosaved on a timer, so it normalizes junk away instead of
// rejecting it — the real validation happens once, when the form is submitted as
// a ticket.
const {
  isDraftEmpty,
  hasDescriptionText,
  normalizeDraftInput,
  normalizeDraftDueDate,
  normalizeDraftStoryPoints,
} = require('./ticketDraftRules');

const STATUS_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';

describe('normalizeDraftInput', () => {
  it('keeps what the form can produce', () => {
    expect(
      normalizeDraftInput({
        subject: '  Fix the login redirect  ',
        description: '<p>Steps</p>',
        status: STATUS_ID,
        priority: 'HIGH',
        storyPoints: '3',
        assignedTo: [USER_ID, USER_ID],
        dueDate: '2026-09-01',
        blockedBy: { ticket: null, note: '  waiting on ops  ' },
      })
    ).toEqual({
      subject: 'Fix the login redirect',
      description: '<p>Steps</p>',
      status: STATUS_ID,
      priority: 'high',
      storyPoints: 3,
      assignedTo: [USER_ID],
      dueDate: '2026-09-01',
      category: null,
      blockedBy: { ticket: null, note: 'waiting on ops' },
    });
  });

  it('drops values the form cannot produce rather than failing the save', () => {
    const draft = normalizeDraftInput({
      subject: 'x'.repeat(200),
      priority: 'urgent',
      storyPoints: 42,
      assignedTo: ['not-an-id', USER_ID],
      dueDate: 'tomorrow',
      category: 'nonsense',
      status: { _id: STATUS_ID },
    });

    expect(draft.subject).toHaveLength(100);
    expect(draft.priority).toBe('medium');
    expect(draft.storyPoints).toBeNull();
    expect(draft.assignedTo).toEqual([USER_ID]);
    expect(draft.dueDate).toBe('');
    expect(draft.category).toBeNull();
    // A populated document is as valid an id as the string is — the form holds
    // whichever the last read handed it.
    expect(draft.status).toBe(STATUS_ID);
  });
});

describe('normalizeDraftDueDate', () => {
  // The date input holds a calendar day, and it is stored as that string on
  // purpose: parsing it into an instant here is what moves a due date by a day.
  it('keeps a calendar day and refuses anything else', () => {
    expect(normalizeDraftDueDate('2026-09-01')).toBe('2026-09-01');
    expect(normalizeDraftDueDate('2026-09-01T12:00:00.000Z')).toBe('');
    expect(normalizeDraftDueDate(null)).toBe('');
  });
});

describe('normalizeDraftStoryPoints', () => {
  it('accepts only the 1–5 scale the field offers', () => {
    expect(normalizeDraftStoryPoints(1)).toBe(1);
    expect(normalizeDraftStoryPoints('5')).toBe(5);
    expect(normalizeDraftStoryPoints(0)).toBeNull();
    expect(normalizeDraftStoryPoints(2.5)).toBeNull();
    expect(normalizeDraftStoryPoints('')).toBeNull();
  });
});

describe('hasDescriptionText', () => {
  it('reads an empty editor document as empty', () => {
    expect(hasDescriptionText('<p></p>')).toBe(false);
    expect(hasDescriptionText('<p>&nbsp;</p>')).toBe(false);
    expect(hasDescriptionText('<p>Hello</p>')).toBe(true);
  });
});

describe('isDraftEmpty', () => {
  // Merely opening the modal fills in a status (the column that was clicked) and
  // a priority. Counting either would leave a draft behind for every abandoned
  // modal, and the next visit would announce a "restored" draft holding nothing.
  it('ignores the fields the modal fills in by itself', () => {
    expect(isDraftEmpty({ status: STATUS_ID, priority: 'medium', description: '<p></p>' })).toBe(
      true
    );
  });

  it('is not empty once anything has been typed or picked', () => {
    expect(isDraftEmpty({ subject: 'Something' })).toBe(false);
    expect(isDraftEmpty({ description: '<p>Something</p>' })).toBe(false);
    expect(isDraftEmpty({ assignedTo: [USER_ID] })).toBe(false);
    expect(isDraftEmpty({ storyPoints: 2 })).toBe(false);
    expect(isDraftEmpty({ dueDate: '2026-09-01' })).toBe(false);
    expect(isDraftEmpty({ blockedBy: { note: 'waiting' } })).toBe(false);
  });
});
