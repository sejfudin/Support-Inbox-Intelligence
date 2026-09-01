// `taskNumber` allocation. The bug this replaced was a lost update: a read of
// `max(taskNumber)` and a write of `max + 1` with several awaits in between, so
// five concurrent creates in one workspace all produced the same number and the
// non-unique `{ workspace, taskNumber }` index accepted every duplicate.
//
// Three things are pinned here, because each one is a way to reintroduce it:
//
// - The increment returns the POST-increment `seq`. `findOneAndUpdate` defaults
//   to returning the document as it was, so an omitted `returnDocument: 'after'`
//   hands every caller the previous number — and reads as correct.
// - A missing counter is seeded from the workspace's existing maximum, not from
//   zero. That is why the increment is not an upsert: an upsert would restart an
//   established workspace at 1.
// - `E11000` from the seeding insert is the concurrent-first-create case, not a
//   failure, and the retry after it must succeed.
//
// The `Counter` and `Ticket` models are mocked — no database.

jest.mock('../models/Counter', () => ({ findOneAndUpdate: jest.fn(), create: jest.fn() }));
jest.mock('../models/Ticket', () => ({ findOne: jest.fn() }));

const Counter = require('../models/Counter');
const Ticket = require('../models/Ticket');
const { nextTaskNumber, syncTaskNumberCounter } = require('./ticketNumberService');

const WORKSPACE = 'ws1';

// Counter.findOneAndUpdate(...).lean() — the service always leans the result.
const leanTo = (result) => ({ lean: jest.fn().mockResolvedValue(result) });

// Ticket.findOne(...).sort(...).select(...).lean()
const mockHighestTaskNumber = (taskNumber) => {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(taskNumber === null ? null : { taskNumber }),
  };
  Ticket.findOne.mockReturnValue(chain);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('nextTaskNumber', () => {
  it('returns the incremented value of an existing counter, without reading the tickets', async () => {
    Counter.findOneAndUpdate.mockReturnValue(leanTo({ seq: 43 }));

    await expect(nextTaskNumber(WORKSPACE)).resolves.toBe(43);

    expect(Counter.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(Ticket.findOne).not.toHaveBeenCalled();
    expect(Counter.create).not.toHaveBeenCalled();
  });

  it('increments atomically and asks for the document as it is after the write', async () => {
    Counter.findOneAndUpdate.mockReturnValue(leanTo({ seq: 2 }));

    await nextTaskNumber(WORKSPACE);

    const [filter, update, options] = Counter.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ workspace: WORKSPACE, name: 'ticket' });
    expect(update).toEqual({ $inc: { seq: 1 } });
    expect(options).toEqual({ returnDocument: 'after' });
    // No upsert: a missing counter must come back as null so it can be seeded
    // from the existing maximum instead of restarting at 1.
    expect(options.upsert).toBeUndefined();
  });

  it('seeds a missing counter from the highest existing taskNumber, then increments', async () => {
    Counter.findOneAndUpdate
      .mockReturnValueOnce(leanTo(null))
      .mockReturnValueOnce(leanTo({ seq: 43 }));
    mockHighestTaskNumber(42);
    Counter.create.mockResolvedValue({});

    await expect(nextTaskNumber(WORKSPACE)).resolves.toBe(43);

    expect(Counter.create).toHaveBeenCalledWith({
      workspace: WORKSPACE,
      name: 'ticket',
      seq: 42,
    });
  });

  it('starts a workspace with no tickets at 1', async () => {
    Counter.findOneAndUpdate
      .mockReturnValueOnce(leanTo(null))
      .mockReturnValueOnce(leanTo({ seq: 1 }));
    mockHighestTaskNumber(null);
    Counter.create.mockResolvedValue({});

    await expect(nextTaskNumber(WORKSPACE)).resolves.toBe(1);

    expect(Counter.create).toHaveBeenCalledWith({ workspace: WORKSPACE, name: 'ticket', seq: 0 });
  });

  it('retries and succeeds when a concurrent request seeded the counter first (E11000)', async () => {
    Counter.findOneAndUpdate
      .mockReturnValueOnce(leanTo(null))
      .mockReturnValueOnce(leanTo({ seq: 8 }));
    mockHighestTaskNumber(7);
    const duplicateKey = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
    Counter.create.mockRejectedValue(duplicateKey);

    await expect(nextTaskNumber(WORKSPACE)).resolves.toBe(8);

    expect(Counter.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('rethrows a seeding failure that is not a duplicate key', async () => {
    Counter.findOneAndUpdate.mockReturnValue(leanTo(null));
    mockHighestTaskNumber(7);
    Counter.create.mockRejectedValue(new Error('connection lost'));

    await expect(nextTaskNumber(WORKSPACE)).rejects.toThrow('connection lost');
  });
});

describe('syncTaskNumberCounter', () => {
  it('raises an existing counter to the highest taskNumber without ever lowering it', async () => {
    mockHighestTaskNumber(42);
    Counter.findOneAndUpdate.mockReturnValue(leanTo({ seq: 42 }));

    await expect(syncTaskNumberCounter(WORKSPACE)).resolves.toBe(42);

    const [, update] = Counter.findOneAndUpdate.mock.calls[0];
    expect(update).toEqual({ $max: { seq: 42 } });
    expect(Counter.create).not.toHaveBeenCalled();
  });

  it('creates the counter at the highest taskNumber when there is none', async () => {
    mockHighestTaskNumber(42);
    Counter.findOneAndUpdate.mockReturnValue(leanTo(null));
    Counter.create.mockResolvedValue({});

    await expect(syncTaskNumberCounter(WORKSPACE)).resolves.toBe(42);

    expect(Counter.create).toHaveBeenCalledWith({
      workspace: WORKSPACE,
      name: 'ticket',
      seq: 42,
    });
  });
});
