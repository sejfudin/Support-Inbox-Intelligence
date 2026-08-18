const {
  BLOCKER_NOTE_MAX_LENGTH,
  blockerIsDone,
  describeBlockerChange,
  isBlockedStatusSlug,
  isBlockerEmpty,
  normalizeBlockerNote,
  parseBlockerInput,
  readBlocker,
  resolveBlockerUpdate,
} = require('./ticketBlocker');

describe('isBlockedStatusSlug', () => {
  it('matches the blocked slug regardless of casing or padding', () => {
    expect(isBlockedStatusSlug('blocked')).toBe(true);
    expect(isBlockedStatusSlug('  Blocked ')).toBe(true);
  });

  it('does not match other statuses', () => {
    expect(isBlockedStatusSlug('in progress')).toBe(false);
    expect(isBlockedStatusSlug('')).toBe(false);
    expect(isBlockedStatusSlug(undefined)).toBe(false);
  });

  it('is keyed on the slug, so a relabelled status still counts', () => {
    // `updateStatus` writes the label only — a workspace that renames "Blocked"
    // to "Stuck" keeps slug `blocked`, and must keep the blocker field with it.
    const relabelled = { slug: 'blocked', label: 'Stuck' };
    expect(isBlockedStatusSlug(relabelled.slug)).toBe(true);
  });
});

describe('blockerIsDone', () => {
  // Nothing is waiting on a finished ticket, so it cannot be picked as a blocker.
  it('reads the status behaviour flag, not the label', () => {
    expect(blockerIsDone({ status: { slug: 'done', label: 'Shipped', isDone: true } })).toBe(true);
    expect(blockerIsDone({ status: { slug: 'done', label: 'Done', isDone: false } })).toBe(false);
  });

  it('is false when the status is missing or unpopulated', () => {
    expect(blockerIsDone({ status: '651f2c0f9e1a4b0012ab34cd' })).toBe(false);
    expect(blockerIsDone({})).toBe(false);
    expect(blockerIsDone(null)).toBe(false);
  });
});

describe('normalizeBlockerNote', () => {
  it('trims and defaults to an empty string', () => {
    expect(normalizeBlockerNote('  waiting on the client  ')).toBe('waiting on the client');
    expect(normalizeBlockerNote(undefined)).toBe('');
    expect(normalizeBlockerNote(null)).toBe('');
  });

  it('rejects a note over the length cap', () => {
    expect(() => normalizeBlockerNote('x'.repeat(BLOCKER_NOTE_MAX_LENGTH + 1))).toThrow(
      /cannot be more than/
    );
    expect(normalizeBlockerNote('x'.repeat(BLOCKER_NOTE_MAX_LENGTH))).toHaveLength(
      BLOCKER_NOTE_MAX_LENGTH
    );
  });
});

describe('parseBlockerInput', () => {
  it('returns undefined when the field was not sent — an unrelated edit must not wipe it', () => {
    expect(parseBlockerInput(undefined)).toBeUndefined();
  });

  it('treats null and an empty object as an explicit clear', () => {
    expect(parseBlockerInput(null)).toEqual({ ticketId: null, note: '' });
    expect(parseBlockerInput({})).toEqual({ ticketId: null, note: '' });
  });

  it('accepts an id string, a populated ticket, or a note on its own', () => {
    expect(parseBlockerInput({ ticket: 'abc', note: ' hmm ' })).toEqual({
      ticketId: 'abc',
      note: 'hmm',
    });
    expect(parseBlockerInput({ ticket: { _id: 'abc' } })).toEqual({ ticketId: 'abc', note: '' });
    expect(parseBlockerInput({ note: 'waiting on legal' })).toEqual({
      ticketId: null,
      note: 'waiting on legal',
    });
  });

  it('rejects a non-object payload', () => {
    expect(() => parseBlockerInput('some-id')).toThrow(/must be an object/);
    expect(() => parseBlockerInput(['a'])).toThrow(/must be an object/);
  });
});

describe('readBlocker / isBlockerEmpty', () => {
  it('reads a stored blocker off a ticket document', () => {
    expect(readBlocker({ blockedBy: { ticket: 'abc', note: ' why ' } })).toEqual({
      ticketId: 'abc',
      note: 'why',
    });
    expect(readBlocker({})).toEqual({ ticketId: null, note: '' });
  });

  it('is empty only when both halves are', () => {
    expect(isBlockerEmpty({ ticketId: null, note: '' })).toBe(true);
    expect(isBlockerEmpty({ ticketId: 'abc', note: '' })).toBe(false);
    expect(isBlockerEmpty({ ticketId: null, note: 'why' })).toBe(false);
  });
});

describe('resolveBlockerUpdate', () => {
  const current = { ticketId: 'abc', note: 'why' };

  it('clears the blocker when the ticket leaves the blocked status', () => {
    expect(resolveBlockerUpdate({ isBlocked: false, requested: undefined, current })).toEqual({
      ticket: null,
      note: '',
    });
  });

  it('writes nothing when leaving a status that had no blocker anyway', () => {
    expect(
      resolveBlockerUpdate({
        isBlocked: false,
        requested: undefined,
        current: { ticketId: null, note: '' },
      })
    ).toBeUndefined();
  });

  it('clears the blocker even when the request also tried to set one', () => {
    // Not blocked wins: the status is what makes a blocker meaningful.
    expect(
      resolveBlockerUpdate({ isBlocked: false, requested: { ticketId: 'x', note: 'y' }, current })
    ).toEqual({ ticket: null, note: '' });
  });

  it('leaves a blocked ticket alone when the field was not sent', () => {
    expect(
      resolveBlockerUpdate({ isBlocked: true, requested: undefined, current })
    ).toBeUndefined();
  });

  it('persists what was requested while blocked', () => {
    expect(
      resolveBlockerUpdate({ isBlocked: true, requested: { ticketId: 'xyz', note: '' }, current })
    ).toEqual({ ticket: 'xyz', note: '' });
    expect(
      resolveBlockerUpdate({ isBlocked: true, requested: { ticketId: null, note: '' }, current })
    ).toEqual({ ticket: null, note: '' });
  });
});

describe('describeBlockerChange', () => {
  const labelFor = (id) => `Ticket ${id}`;
  const describe_ = (previous, next) => describeBlockerChange({ previous, next, labelFor });

  it('says nothing when there is no update to persist', () => {
    expect(
      describeBlockerChange({ previous: { ticketId: 'a', note: '' }, next: undefined })
    ).toEqual([]);
  });

  it('reports a link being added, changed and dropped', () => {
    expect(describe_({ ticketId: null, note: '' }, { ticket: '7', note: '' })).toEqual([
      'Blocked by Ticket 7',
    ]);
    expect(describe_({ ticketId: '7', note: '' }, { ticket: '8', note: '' })).toEqual([
      'Blocking ticket changed from Ticket 7 to Ticket 8',
    ]);
    expect(describe_({ ticketId: '7', note: '' }, { ticket: null, note: '' })).toEqual([
      'No longer blocked by Ticket 7',
    ]);
  });

  it('tracks the note independently of the link', () => {
    expect(describe_({ ticketId: null, note: '' }, { ticket: null, note: 'waiting' })).toEqual([
      'Blocker note added',
    ]);
    expect(describe_({ ticketId: null, note: 'waiting' }, { ticket: null, note: 'still' })).toEqual(
      ['Blocker note updated']
    );
    expect(describe_({ ticketId: null, note: 'waiting' }, { ticket: null, note: '' })).toEqual([
      'Blocker note removed',
    ]);
  });

  it('reports both halves when a status change clears everything', () => {
    expect(describe_({ ticketId: '7', note: 'waiting' }, { ticket: null, note: '' })).toEqual([
      'No longer blocked by Ticket 7',
      'Blocker note removed',
    ]);
  });

  it('stays silent when nothing actually moved', () => {
    expect(describe_({ ticketId: '7', note: 'waiting' }, { ticket: '7', note: 'waiting' })).toEqual(
      []
    );
  });
});
