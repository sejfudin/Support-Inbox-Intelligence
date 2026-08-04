// Covers `resolveActiveWorkspaceId` — the gate that stops a stale
// `User.workspaceId` pointer from scoping a request into a workspace the caller
// no longer (or never did) belong to. The regression it guards: demoting an
// admin/mentor to intern removes the `canAccessAnyWorkspace` bypass but leaves
// the pointer behind, and every ambient-workspace controller used to trust it.
//
// Mongo is mocked; no DB.

jest.mock('../models/Workspace', () => ({ findById: jest.fn() }));

const Workspace = require('../models/Workspace');
const { resolveActiveWorkspaceId } = require('./workspaceAuthz');

// Mongoose ObjectId-ish: `equals` is what isActiveWorkspaceMember calls.
const userId = (id) => ({ toString: () => id, equals: (other) => String(other) === id });

const WS = 'ws1';

const mockWorkspace = (members) => {
  Workspace.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(members) });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveActiveWorkspaceId', () => {
  it('returns null when the user has no pointer at all', async () => {
    await expect(
      resolveActiveWorkspaceId({ user: { role: 'intern', _id: userId('u1') } })
    ).resolves.toBeNull();
    expect(Workspace.findById).not.toHaveBeenCalled();
  });

  it('honors an active membership', async () => {
    mockWorkspace({ members: [{ user: userId('u1'), status: 'active' }] });

    await expect(
      resolveActiveWorkspaceId({ user: { role: 'intern', _id: userId('u1'), workspaceId: WS } })
    ).resolves.toBe(WS);
  });

  it('rejects a pointer with no matching member entry (the downgraded-role case)', async () => {
    mockWorkspace({ members: [{ user: userId('someone-else'), status: 'active' }] });

    await expect(
      resolveActiveWorkspaceId({ user: { role: 'intern', _id: userId('u1'), workspaceId: WS } })
    ).resolves.toBeNull();
  });

  it.each(['invited', 'disabled'])('rejects a %s membership', async (status) => {
    mockWorkspace({ members: [{ user: userId('u1'), status }] });

    await expect(
      resolveActiveWorkspaceId({ user: { role: 'intern', _id: userId('u1'), workspaceId: WS } })
    ).resolves.toBeNull();
  });

  it('rejects a pointer to a deleted workspace', async () => {
    mockWorkspace(null);

    await expect(
      resolveActiveWorkspaceId({ user: { role: 'intern', _id: userId('u1'), workspaceId: WS } })
    ).resolves.toBeNull();
  });

  it('lets admins and mentors keep an unbacked pointer', async () => {
    for (const role of ['admin', 'mentor']) {
      await expect(
        resolveActiveWorkspaceId({ user: { role, _id: userId('u1'), workspaceId: WS } })
      ).resolves.toBe(WS);
    }
    expect(Workspace.findById).not.toHaveBeenCalled();
  });

  it('accepts an override from an admin only', async () => {
    await expect(
      resolveActiveWorkspaceId({
        user: { role: 'admin', _id: userId('u1'), workspaceId: WS },
        override: 'ws2',
      })
    ).resolves.toBe('ws2');

    // A mentor's override is ignored — they fall back to their own pointer.
    await expect(
      resolveActiveWorkspaceId({
        user: { role: 'mentor', _id: userId('u1'), workspaceId: WS },
        override: 'ws2',
      })
    ).resolves.toBe(WS);
  });

  it('ignores an intern-supplied override and still verifies membership', async () => {
    mockWorkspace({ members: [{ user: userId('u1'), status: 'active' }] });

    await expect(
      resolveActiveWorkspaceId({
        user: { role: 'intern', _id: userId('u1'), workspaceId: WS },
        override: 'ws2',
      })
    ).resolves.toBe(WS);
  });

  it('returns null for an intern with an override but no pointer of their own', async () => {
    await expect(
      resolveActiveWorkspaceId({
        user: { role: 'intern', _id: userId('u1') },
        override: 'ws2',
      })
    ).resolves.toBeNull();
  });
});
