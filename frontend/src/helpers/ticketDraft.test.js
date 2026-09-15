import { describe, expect, it } from 'vitest';

import {
  draftPayloadsEqual,
  draftToForm,
  formatDraftSavedAt,
  isDraftFormEmpty,
  toDraftPayload,
} from './ticketDraft';

const STATUS_ID = '507f1f77bcf86cd799439011';
const OTHER_STATUS_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439013';

const filledForm = {
  subject: 'Fix the login redirect',
  description: '<p>Steps</p>',
  status: STATUS_ID,
  priority: 'high',
  storyPoints: 3,
  assignedTo: [USER_ID],
  dueDate: '2026-09-01',
  category: null,
  blockedBy: { ticket: { _id: 'abc', taskNumber: 12 }, note: 'waiting on ops' },
};

describe('toDraftPayload', () => {
  it('sends ids, not the documents the form renders from', () => {
    expect(toDraftPayload(filledForm)).toEqual({
      subject: 'Fix the login redirect',
      description: '<p>Steps</p>',
      status: STATUS_ID,
      priority: 'high',
      storyPoints: 3,
      assignedTo: [USER_ID],
      dueDate: '2026-09-01',
      category: null,
      blockedBy: { ticket: 'abc', note: 'waiting on ops' },
    });
  });

  it('turns the form’s "no assignees yet" placeholder into an empty list', () => {
    expect(toDraftPayload({ assignedTo: 'unassigned' }).assignedTo).toEqual([]);
  });
});

describe('draftToForm', () => {
  it('round-trips a draft back into the same payload', () => {
    const payload = toDraftPayload(filledForm);
    const restored = draftToForm({ ...payload, blockedBy: filledForm.blockedBy });

    // The round trip has to be exact, or the autosave that follows a restore
    // would see a change it did not make and immediately save again.
    expect(toDraftPayload(restored)).toEqual(payload);
  });

  it('falls back to the column the modal was opened from when the draft’s status is gone', () => {
    expect(draftToForm({ subject: 'x' }, OTHER_STATUS_ID).status).toBe(OTHER_STATUS_ID);
  });
});

describe('isDraftFormEmpty', () => {
  // Opening the modal already fills in a status and a priority, so counting
  // either would leave a draft behind for every modal anybody merely opened.
  it('ignores the fields the modal fills in by itself', () => {
    expect(
      isDraftFormEmpty({
        status: STATUS_ID,
        priority: 'medium',
        description: '<p></p>',
        assignedTo: 'unassigned',
      })
    ).toBe(true);
  });

  it('is not empty once anything has been typed or picked', () => {
    expect(isDraftFormEmpty({ subject: ' x ' })).toBe(false);
    expect(isDraftFormEmpty({ description: '<p>Something</p>' })).toBe(false);
    expect(isDraftFormEmpty({ assignedTo: [USER_ID] })).toBe(false);
    expect(isDraftFormEmpty({ storyPoints: 1 })).toBe(false);
    expect(isDraftFormEmpty({ dueDate: '2026-09-01' })).toBe(false);
    expect(isDraftFormEmpty({ category: STATUS_ID })).toBe(false);
    expect(isDraftFormEmpty({ blockedBy: { note: 'waiting' } })).toBe(false);
  });
});

describe('draftPayloadsEqual', () => {
  it('compares the wire shape, so an unchanged form costs no request', () => {
    expect(draftPayloadsEqual(toDraftPayload(filledForm), toDraftPayload({ ...filledForm }))).toBe(
      true
    );
    expect(
      draftPayloadsEqual(
        toDraftPayload(filledForm),
        toDraftPayload({ ...filledForm, subject: 'Something else' })
      )
    ).toBe(false);
  });
});

describe('formatDraftSavedAt', () => {
  it('has nothing to show for a draft that was never saved', () => {
    expect(formatDraftSavedAt(null)).toBe('');
    expect(formatDraftSavedAt('not a date')).toBe('');
  });

  it('formats a stored timestamp as a clock time', () => {
    expect(formatDraftSavedAt('2026-08-31T09:30:00.000Z')).toMatch(/\d/);
  });
});
