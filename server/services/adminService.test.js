// Covers the `requireWorkspaceScope` guard on `getUsers`.
//
// GET /api/admin/users is open to every authenticated user (routes/admin.js:
// `protect` only), and the query starts from `{}` — a missing workspaceId means
// "no filter", i.e. every user on the platform. That is correct for an admin
// listing everyone and a leak for anyone else, which is what this flag decides.
//
// Mongo is mocked; no DB. A leak would show up here as User.find being called.

jest.mock('../models/User', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../models/Workspace', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../models/Invitation', () => ({ find: jest.fn() }));

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { getUsers } = require('./adminService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getUsers workspace scoping', () => {
  it('returns an empty page without querying users when scope is required but absent', async () => {
    const result = await getUsers({ requireWorkspaceScope: true, page: 2, limit: 25 });

    expect(result).toEqual({
      users: [],
      pagination: { total: 0, page: 2, limit: 25, pages: 0 },
    });
    expect(User.find).not.toHaveBeenCalled();
    expect(Workspace.findById).not.toHaveBeenCalled();
  });

  it('drops the pagination envelope when pagination is disabled', async () => {
    // The flag arrives off the query string, so the string form has to work too.
    for (const pagination of ['false', false]) {
      const result = await getUsers({ requireWorkspaceScope: true, pagination });
      expect(result).toEqual({ users: [] });
    }
    expect(User.find).not.toHaveBeenCalled();
  });

  it('returns an empty page when the requested workspace is gone', async () => {
    Workspace.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const result = await getUsers({ workspaceId: 'ws-missing', page: 1, limit: 10 });

    expect(result.users).toEqual([]);
    expect(result.pagination).toEqual({ total: 0, page: 1, limit: 10, pages: 0 });
    expect(User.find).not.toHaveBeenCalled();
  });

  it('scopes to the workspace active members when a workspace resolves', async () => {
    Workspace.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        members: [
          { user: 'u1', status: 'active' },
          { user: 'u2', status: 'invited' },
          { user: 'u3', status: 'disabled' },
        ],
      }),
    });
    User.find.mockReturnValue({
      select: () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) }),
    });

    await getUsers({ workspaceId: 'ws1', pagination: false });

    // Only the active member reaches the query — invited/disabled are excluded.
    expect(User.find).toHaveBeenCalledWith({ _id: { $in: ['u1'] } });
  });

  it('lists platform-wide when scope is not required and no workspace is given', async () => {
    User.find.mockReturnValue({
      select: () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) }),
    });

    await getUsers({ pagination: false });

    // The admin path: an unfiltered query is the intended behaviour here.
    expect(User.find).toHaveBeenCalledWith({});
  });
});
