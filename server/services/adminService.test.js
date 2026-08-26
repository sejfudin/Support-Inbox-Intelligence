// Two concerns on `getUsers`, both exercised with Mongo mocked — no DB.
//
// 1. The `requireWorkspaceScope` guard. GET /api/admin/users is open to every
//    authenticated user (routes/admin.js: `protect` only), and the query starts
//    from `{}` — a missing workspaceId means "no filter", i.e. every user on the
//    platform. That is correct for an admin listing everyone and a leak for
//    anyone else, which is what this flag decides. A leak would show up here as
//    User.find being called.
//
// 2. The non-people exclusion every one of those queries now carries by
//    default (`constants/userVisibility.js`, same idiom as `Project.isSystem`) —
//    every internal QA account and the deleted-user tombstone stay out of the
//    mentor/specialization pickers and the mentor-notes audience picker for free,
//    since they all route through this one function. `includeTestAccounts: true`
//    is the one deliberate bypass, for Platform Management's "All Users" screen,
//    and it narrows the exclusion to the tombstone rather than dropping it.

jest.mock('../models/User', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../models/Workspace', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../models/Invitation', () => ({ find: jest.fn() }));

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { REAL_USER_FILTER, TOMBSTONE_FILTER } = require('../constants/userVisibility');
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
    // The non-people exclusion is on every query by default — see the describe
    // block below.
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ['u1'] },
      ...REAL_USER_FILTER,
    });
  });

  it('lists platform-wide when scope is not required and no workspace is given', async () => {
    User.find.mockReturnValue({
      select: () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) }),
    });

    await getUsers({ pagination: false });

    // The admin path: an unfiltered (bar non-people) query is the intended
    // behaviour here.
    expect(User.find).toHaveBeenCalledWith({ ...REAL_USER_FILTER });
  });
});

describe('getUsers non-people exclusion', () => {
  it('excludes test accounts and the tombstone by default, same idiom as Project.isSystem', async () => {
    User.find.mockReturnValue({
      select: () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) }),
    });

    await getUsers({ pagination: false, roles: ['admin', 'mentor'] });

    expect(User.find).toHaveBeenCalledWith({
      role: { $in: ['admin', 'mentor'] },
      ...REAL_USER_FILTER,
    });
  });

  it('drops only the test-account half when includeTestAccounts is explicitly true', async () => {
    User.find.mockReturnValue({
      select: () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) }),
    });

    await getUsers({ pagination: false, includeTestAccounts: true });

    const queryArg = User.find.mock.calls[0][0];
    expect(queryArg).not.toHaveProperty('isTestAccount');
  });

  it('never lists the tombstone, even for the one screen that wants test accounts', async () => {
    // The bypass exists so an admin can manage a QA account. There is nothing
    // about the tombstone for anyone to manage, so no screen has a reason to
    // list it — `includeTestAccounts` widens to TOMBSTONE_FILTER, not to `{}`.
    User.find.mockReturnValue({
      select: () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) }),
    });

    await getUsers({ pagination: false, includeTestAccounts: true });

    expect(User.find).toHaveBeenCalledWith({ ...TOMBSTONE_FILTER });
  });

  it('still excludes on the paginated path (the default the admin/mentor pickers use)', async () => {
    User.find.mockReturnValue({
      select: () => ({
        populate: () => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve([]) }) }) }),
      }),
    });
    User.countDocuments.mockResolvedValue(0);

    await getUsers({ page: 1, limit: 10 });

    expect(User.find).toHaveBeenCalledWith({ ...REAL_USER_FILTER });
    expect(User.countDocuments).toHaveBeenCalledWith({ ...REAL_USER_FILTER });
  });
});
