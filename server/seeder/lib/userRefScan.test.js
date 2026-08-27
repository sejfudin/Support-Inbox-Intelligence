// The schema walk, on hand-built schemas rather than the app's models.
//
// It is tested here because it has already been wrong once in a way nothing
// noticed: checking only a path's top-level `options.ref` plus the array caster
// found 27 of the 35 user refs in this codebase and reported "no dangling refs"
// while eight kinds of them dangled. Every declaration form below is one that
// mistake missed.

const mongoose = require('mongoose');
const { userRefPaths, readPath, isAuthorshipRef, missingIdsOf } = require('./userRefScan');

const { ObjectId } = mongoose.Schema.Types;

const byPath = (paths) => Object.fromEntries(paths.map((entry) => [entry.path, entry]));

describe('userRefPaths', () => {
  it('finds a scalar ref and records whether clearing it is legal', () => {
    const schema = new mongoose.Schema({
      creator: { type: ObjectId, ref: 'User', required: true },
      updatedBy: { type: ObjectId, ref: 'User' },
      workspace: { type: ObjectId, ref: 'Workspace' },
      title: String,
    });

    const found = byPath(userRefPaths(schema));

    expect(Object.keys(found).sort()).toEqual(['creator', 'updatedBy']);
    expect(found.creator).toMatchObject({ isArray: false, inDocArray: false, isRequired: true });
    expect(found.updatedBy.isRequired).toBe(false);
  });

  it('finds a ref declared on an array element, not just on the caster', () => {
    // `[{ type: ObjectId, ref: 'User' }]` leaves `caster.options` empty. This is
    // the form the original walk missed — Ticket.assignedTo and
    // MentorComment.visibleTo are both declared this way.
    const schema = new mongoose.Schema({
      assignedTo: [{ type: ObjectId, ref: 'User' }],
    });

    const found = byPath(userRefPaths(schema));

    expect(found.assignedTo).toMatchObject({ isArray: true, inDocArray: false });
  });

  it('descends into a document array and records where the boundary was', () => {
    // `eachPath` reports `members` as one node and never yields `members.user`.
    // An arrayFilters update needs the array path and the leaf spelled
    // separately, so the walk keeps both.
    const schema = new mongoose.Schema({
      members: [
        new mongoose.Schema({
          user: { type: ObjectId, ref: 'User', required: true },
          invitedBy: { type: ObjectId, ref: 'User' },
          role: String,
        }),
      ],
    });

    const found = byPath(userRefPaths(schema));

    expect(found['members.user']).toMatchObject({
      inDocArray: true,
      docArrayPath: 'members',
      leafPath: 'user',
      nestedDocArray: false,
      isRequired: true,
    });
    expect(found['members.invitedBy'].leafPath).toBe('invitedBy');
  });

  it('descends into an embedded document without calling it an array', () => {
    // `reviewRequest.reviewer` is dotted but has no array in the middle, so the
    // dotted path is directly writable and needs no positional update.
    const schema = new mongoose.Schema({
      reviewRequest: new mongoose.Schema({
        reviewer: { type: ObjectId, ref: 'User' },
      }),
    });

    const found = byPath(userRefPaths(schema));

    expect(found['reviewRequest.reviewer']).toMatchObject({
      inDocArray: false,
      docArrayPath: null,
      leafPath: null,
    });
  });

  it('flags a ref inside two nested document arrays instead of guessing', () => {
    const schema = new mongoose.Schema({
      groups: [
        new mongoose.Schema({
          entries: [
            new mongoose.Schema({
              member: { type: ObjectId, ref: 'User' },
            }),
          ],
        }),
      ],
    });

    const found = byPath(userRefPaths(schema));

    expect(found['groups.entries.member']).toMatchObject({
      nestedDocArray: true,
      // The innermost array is the one whose elements hold the leaf.
      docArrayPath: 'groups.entries',
      leafPath: 'member',
    });
  });
});

describe('readPath', () => {
  it('reads a plain and a dotted path', () => {
    expect(readPath({ creator: 'u1' }, 'creator')).toBe('u1');
    expect(readPath({ reviewRequest: { reviewer: 'u1' } }, 'reviewRequest.reviewer')).toBe('u1');
  });

  it('collects the key from every element of an array on the way through', () => {
    const doc = { members: [{ user: 'u1' }, { user: 'u2' }] };
    expect(readPath(doc, 'members.user')).toEqual(['u1', 'u2']);
  });

  it('survives a null on the way down and skips null elements', () => {
    expect(readPath({}, 'reviewRequest.reviewer')).toBeUndefined();
    expect(readPath({ members: [null, { user: 'u1' }] }, 'members.user')).toEqual(['u1']);
  });
});

describe('isAuthorshipRef', () => {
  it('is false for a record whose whole subject is the departed user', () => {
    // These two shapes are the cleanup script's to delete. Repointing them at a
    // tombstone would manufacture an intern named "Deleted user".
    expect(isAuthorshipRef({ modelName: 'InternProfile', refPath: 'user' })).toBe(false);
    expect(isAuthorshipRef({ modelName: 'RefreshToken', refPath: 'user' })).toBe(false);
    expect(isAuthorshipRef({ modelName: 'Notification', refPath: 'recipient' })).toBe(false);
  });

  it('is true for a record that describes something that happened', () => {
    expect(isAuthorshipRef({ modelName: 'Ticket', refPath: 'creator' })).toBe(true);
    expect(isAuthorshipRef({ modelName: 'Workspace', refPath: 'owner' })).toBe(true);
    expect(isAuthorshipRef({ modelName: 'InternProfile', refPath: 'primaryMentor' })).toBe(true);
  });

  it('keys on the model as well as the field, not the field alone', () => {
    // `Invitation.user` is the invitee — that row goes. `Invitation.invitedBy`
    // records who sent it, which still happened.
    expect(isAuthorshipRef({ modelName: 'Invitation', refPath: 'user' })).toBe(false);
    expect(isAuthorshipRef({ modelName: 'Invitation', refPath: 'invitedBy' })).toBe(true);
  });
});

describe('missingIdsOf', () => {
  it('reports each missing user once, however many records point at it', () => {
    const finding = {
      dangling: [
        { docId: 'd1', userId: 'u1' },
        { docId: 'd2', userId: 'u1' },
        { docId: 'd3', userId: 'u2' },
      ],
    };

    expect(missingIdsOf(finding)).toEqual(['u1', 'u2']);
  });
});
