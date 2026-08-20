import { describe, expect, it } from 'vitest';
import { ACTIVITY_TONE, buildProfileActivity, formatActivityTime } from './profileActivity';

const NOW = new Date('2026-08-15T12:00:00.000Z');
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const build = (sources) => buildProfileActivity({ now: NOW, ...sources });

describe('buildProfileActivity', () => {
  it('reads a done ticket as closed, dated by doneAt', () => {
    const [row] = build({
      tickets: [
        {
          _id: 't1',
          taskNumber: 81,
          subject: 'Cache the workspace member lookup',
          status: { isDone: true },
          doneAt: daysAgo(1),
          updatedAt: daysAgo(0),
        },
      ],
    });

    expect(row.title).toBe('Closed #81 Cache the workspace member lookup');
    expect(row.tone).toBe(ACTIVITY_TONE.SUCCESS);
    expect(row.at.toISOString()).toBe(daysAgo(1));
  });

  it('reads an open ticket as updated, dated by updatedAt', () => {
    const [row] = build({
      tickets: [
        {
          _id: 't2',
          taskNumber: 76,
          subject: 'Refactor the attendance meter',
          status: { isDone: false },
          updatedAt: daysAgo(2),
        },
      ],
    });

    expect(row.title).toBe('Updated #76 Refactor the attendance meter');
    expect(row.tone).toBe(ACTIVITY_TONE.INFO);
  });

  it('names the hub in a check-in row', () => {
    const [row] = build({
      hubName: 'Sarajevo',
      records: [{ date: '2026-08-14', checkedInAt: daysAgo(1) }],
    });

    expect(row.title).toBe('Checked in at the Sarajevo hub');
  });

  it('skips an attendance row with no check-in time', () => {
    // What an approved remote day looks like: a record, but nobody checked in.
    expect(build({ records: [{ date: '2026-08-14', checkedInAt: null }] })).toEqual([]);
  });

  it('dates a decided request by the decision and an open one by the ask', () => {
    const rows = build({
      requests: [
        {
          id: 'r1',
          type: 'vacation',
          dates: ['2026-08-20', '2026-08-26'],
          status: 'approved',
          decidedAt: daysAgo(3),
          createdAt: daysAgo(9),
        },
        {
          id: 'r2',
          type: 'sick',
          dates: ['2026-08-18'],
          status: 'pending',
          decidedAt: null,
          createdAt: daysAgo(4),
        },
      ],
    });

    expect(rows.map((row) => row.title)).toEqual([
      'Vacation request approved — 20 Aug — 26 Aug',
      'Sick day request sent — Tue, 18 Aug',
    ]);
    expect(rows[0].tone).toBe(ACTIVITY_TONE.SUCCESS);
    expect(rows[1].tone).toBe(ACTIVITY_TONE.NEUTRAL);
  });

  it('drops anything outside the window and orders the rest newest first', () => {
    const rows = build({
      tickets: [
        { _id: 'old', subject: 'Ancient', status: { isDone: false }, updatedAt: daysAgo(30) },
        { _id: 'new', subject: 'Fresh', status: { isDone: false }, updatedAt: daysAgo(1) },
      ],
      records: [{ date: '2026-08-12', checkedInAt: daysAgo(3) }],
    });

    expect(rows.map((row) => row.title)).toEqual(['Updated Fresh', 'Checked in for the day']);
  });

  it('caps the feed', () => {
    const tickets = Array.from({ length: 12 }, (_, index) => ({
      _id: `t${index}`,
      subject: `Ticket ${index}`,
      status: { isDone: false },
      updatedAt: daysAgo(index / 10),
    }));

    expect(build({ tickets })).toHaveLength(6);
  });

  it('returns nothing when every source is empty', () => {
    expect(build({})).toEqual([]);
  });
});

describe('formatActivityTime', () => {
  // Local, not UTC: the clock time is rendered in the reader's zone, so a UTC
  // literal would make these assertions depend on where the suite runs.
  const localNow = new Date(2026, 7, 15, 12, 0); // Sat 15 Aug 2026

  it('names today and yesterday', () => {
    expect(formatActivityTime(new Date(2026, 7, 15, 14, 2), localNow)).toBe('Today 14:02');
    expect(formatActivityTime(new Date(2026, 7, 14, 9, 20), localNow)).toBe('Yesterday 09:20');
  });

  it('uses the weekday inside the window', () => {
    expect(formatActivityTime(new Date(2026, 7, 12, 16, 41), localNow)).toBe('Wed 16:41');
  });

  it('falls back to the date once the weekday stops being unique', () => {
    expect(formatActivityTime(new Date(2026, 7, 8, 11, 15), localNow)).toBe('8 Aug 11:15');
  });

  it('is blank for a missing timestamp', () => {
    expect(formatActivityTime(null, localNow)).toBe('');
  });
});
