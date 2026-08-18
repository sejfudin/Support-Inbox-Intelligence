import { describe, expect, it } from 'vitest';
import {
  BLOCKER_NOTE_MAX_LENGTH,
  blockedByChipLabel,
  blockerFromTicket,
  blockerTicketId,
  blockersEqual,
  emptyBlocker,
  isBlockedStatusId,
  isBlockedStatusSlug,
  isBlockerEmpty,
  isDoneBlockerCandidate,
  ticketRefLabel,
  toBlockerPayload,
} from './ticketBlocker';

describe('isBlockedStatusSlug', () => {
  it('matches the blocked slug regardless of casing', () => {
    expect(isBlockedStatusSlug('blocked')).toBe(true);
    expect(isBlockedStatusSlug(' Blocked ')).toBe(true);
    expect(isBlockedStatusSlug('in progress')).toBe(false);
    expect(isBlockedStatusSlug(undefined)).toBe(false);
  });
});

describe('isBlockedStatusId', () => {
  const options = [
    { value: '1', slug: 'to do' },
    // Relabelled by the workspace; the slug is what identifies it.
    { value: '2', slug: 'blocked', label: 'Stuck' },
  ];

  it('resolves the selected status id through its option', () => {
    expect(isBlockedStatusId(options, '2')).toBe(true);
    expect(isBlockedStatusId(options, '1')).toBe(false);
  });

  it('is false for an unknown or missing id', () => {
    expect(isBlockedStatusId(options, '99')).toBe(false);
    expect(isBlockedStatusId(options, undefined)).toBe(false);
    expect(isBlockedStatusId([], '2')).toBe(false);
  });
});

describe('blockerTicketId', () => {
  it('reads an id from a populated doc or a bare id', () => {
    expect(blockerTicketId({ _id: 'abc', subject: 'x' })).toBe('abc');
    expect(blockerTicketId('abc')).toBe('abc');
    expect(blockerTicketId(null)).toBeNull();
  });
});

describe('blockerFromTicket', () => {
  it('seeds the form from a ticket, keeping the populated doc for display', () => {
    const doc = { _id: 'abc', taskNumber: 12 };
    expect(blockerFromTicket({ blockedBy: { ticket: doc, note: 'waiting' } })).toEqual({
      ticket: doc,
      note: 'waiting',
    });
  });

  it('falls back to an empty blocker for a ticket that has none', () => {
    expect(blockerFromTicket({})).toEqual(emptyBlocker());
    expect(blockerFromTicket(undefined)).toEqual(emptyBlocker());
  });
});

describe('isBlockerEmpty', () => {
  it('is empty only when neither half is set', () => {
    expect(isBlockerEmpty(emptyBlocker())).toBe(true);
    expect(isBlockerEmpty({ ticket: null, note: '   ' })).toBe(true);
    expect(isBlockerEmpty({ ticket: { _id: 'a' }, note: '' })).toBe(false);
    expect(isBlockerEmpty({ ticket: null, note: 'waiting' })).toBe(false);
  });
});

describe('blockersEqual', () => {
  it('compares by id and trimmed note, so a populated doc equals its id', () => {
    expect(blockersEqual({ ticket: { _id: 'a' }, note: 'x' }, { ticket: 'a', note: ' x ' })).toBe(
      true
    );
    expect(blockersEqual({ ticket: 'a', note: '' }, { ticket: 'b', note: '' })).toBe(false);
    expect(blockersEqual({ ticket: 'a', note: '' }, { ticket: 'a', note: 'x' })).toBe(false);
    expect(blockersEqual(emptyBlocker(), { ticket: null, note: '' })).toBe(true);
  });
});

describe('toBlockerPayload', () => {
  it('sends ids and a trimmed note, never the populated document', () => {
    expect(toBlockerPayload({ ticket: { _id: 'abc', subject: 'x' }, note: '  why  ' })).toEqual({
      ticket: 'abc',
      note: 'why',
    });
    expect(toBlockerPayload(emptyBlocker())).toEqual({ ticket: null, note: '' });
    expect(toBlockerPayload(undefined)).toEqual({ ticket: null, note: '' });
  });
});

describe('ticketRefLabel', () => {
  it('names a ticket by its number when it has one', () => {
    expect(ticketRefLabel({ taskNumber: 12 })).toBe('Ticket 12');
    expect(ticketRefLabel({})).toBe('Linked ticket');
  });
});

describe('blockedByChipLabel', () => {
  it('labels a blocker that has a task number', () => {
    expect(blockedByChipLabel({ taskNumber: 12 })).toBe('Blocked by #12');
  });

  it('is null when there is no number to show, so no chip renders', () => {
    // A note-only blocker, an unpopulated ref, or no blocker at all — none of
    // these can produce a clickable reference, and "#undefined" is worse than
    // nothing next to a row that already carries a Blocked badge.
    expect(blockedByChipLabel({ _id: 'abc' })).toBeNull();
    expect(blockedByChipLabel('abc')).toBeNull();
    expect(blockedByChipLabel(null)).toBeNull();
    expect(blockedByChipLabel(undefined)).toBeNull();
  });
});

describe('BLOCKER_NOTE_MAX_LENGTH', () => {
  it('matches the server cap in server/helpers/ticketBlocker.js', () => {
    expect(BLOCKER_NOTE_MAX_LENGTH).toBe(500);
  });
});

describe('isDoneBlockerCandidate', () => {
  // Mirrors `blockerIsDone` on the server, which refuses the link outright.
  it('reads the status behaviour flag, not the label', () => {
    expect(isDoneBlockerCandidate({ status: { label: 'Shipped', isDone: true } })).toBe(true);
    expect(isDoneBlockerCandidate({ status: { label: 'Done', isDone: false } })).toBe(false);
  });

  it('is false when the status is missing or unpopulated', () => {
    expect(isDoneBlockerCandidate({ status: '651f2c0f9e1a4b0012ab34cd' })).toBe(false);
    expect(isDoneBlockerCandidate({})).toBe(false);
    expect(isDoneBlockerCandidate(null)).toBe(false);
  });
});
