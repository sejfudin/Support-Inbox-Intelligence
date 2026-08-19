const {
  CANDIDATE_EMPTY_CAUSES,
  MISMATCH,
  answerReviewRequest,
  assertCanAnswerReview,
  assertCanCancelReview,
  assertCanRequestReview,
  assertReviewerEligible,
  buildReviewRequest,
  describeReviewRequestHistory,
  detectPullRequestMismatch,
  isReviewRequestStale,
  parsePullRequestUrl,
  resolveReviewerCandidates,
} = require('./reviewRequestRules');

// Minimal ObjectId-like stand-in — mirrors what workspaceAuthz.test.js uses,
// since resolveReviewerCandidates calls straight into isActiveWorkspaceMember.
const id = (value) => ({
  value,
  equals(other) {
    return String(other?.value ?? other) === String(this.value);
  },
  toString() {
    return String(this.value);
  },
});

const workspaceWith = (members) => ({ members });
const activeMember = (userId) => ({ user: userId, status: 'active' });
const inactiveMember = (userId) => ({ user: userId, status: 'removed' });

describe('parsePullRequestUrl', () => {
  it('accepts a well-formed GitHub pull request URL', () => {
    expect(parsePullRequestUrl('https://github.com/acme/widgets/pull/42')).toEqual({
      owner: 'acme',
      repo: 'widgets',
      prNumber: 42,
    });
  });

  it('accepts owner/repo names with hyphens, dots and underscores', () => {
    expect(parsePullRequestUrl('https://github.com/acme-org/widgets.js/pull/7')).toEqual({
      owner: 'acme-org',
      repo: 'widgets.js',
      prNumber: 7,
    });
  });

  it.each([
    ['a compare link', 'https://github.com/acme/widgets/compare/main...feature'],
    ['a commit link', 'https://github.com/acme/widgets/commit/abc123'],
    ['a blob link', 'https://github.com/acme/widgets/blob/main/README.md'],
    ['a non-GitHub host', 'https://gitlab.com/acme/widgets/pull/42'],
    ['plain http', 'http://github.com/acme/widgets/pull/42'],
    ['over-long input', `https://github.com/acme/widgets/pull/${'1'.repeat(500)}`],
  ])('rejects %s', (_label, url) => {
    expect(() => parsePullRequestUrl(url)).toThrow(/must look like/);
  });

  it.each([
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('reports %s as a missing URL, not a shape error', (_label, url) => {
    expect(() => parsePullRequestUrl(url)).toThrow(/required/);
  });

  it('reports non-string input as a missing URL', () => {
    expect(() => parsePullRequestUrl(undefined)).toThrow(/required/);
    expect(() => parsePullRequestUrl(null)).toThrow(/required/);
  });

  it('throws an httpError carrying a 400 status', () => {
    try {
      parsePullRequestUrl('not a url');
      throw new Error('expected parsePullRequestUrl to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });
});

describe('resolveReviewerCandidates', () => {
  const mentorA = id('mentor-a');
  const mentorB = id('mentor-b');

  it('returns no_profile when the intern has no profile at all', () => {
    expect(
      resolveReviewerCandidates({ internProfile: null, workspace: workspaceWith([]) })
    ).toEqual({ candidates: [], emptyCause: CANDIDATE_EMPTY_CAUSES.NO_PROFILE });
  });

  it('returns no_mentor when neither mentor field is set', () => {
    const result = resolveReviewerCandidates({
      internProfile: { primaryMentor: null, secondaryMentor: null },
      workspace: workspaceWith([]),
    });
    expect(result).toEqual({ candidates: [], emptyCause: CANDIDATE_EMPTY_CAUSES.NO_MENTOR });
  });

  it('includes only the primary mentor when no secondary is set', () => {
    const workspace = workspaceWith([activeMember(mentorA)]);
    const result = resolveReviewerCandidates({
      internProfile: { primaryMentor: mentorA, secondaryMentor: null },
      workspace,
    });
    expect(result).toEqual({ candidates: [mentorA], emptyCause: null });
  });

  it('excludes a secondaryMentor with no specializationAssignedAt (legacy junk, ADR 0002)', () => {
    const workspace = workspaceWith([activeMember(mentorA), activeMember(mentorB)]);
    const result = resolveReviewerCandidates({
      internProfile: {
        primaryMentor: mentorA,
        secondaryMentor: mentorB,
        specializationAssignedAt: null,
      },
      workspace,
    });
    expect(result).toEqual({ candidates: [mentorA], emptyCause: null });
  });

  it('includes the secondary mentor once specializationAssignedAt is set', () => {
    const workspace = workspaceWith([activeMember(mentorA), activeMember(mentorB)]);
    const result = resolveReviewerCandidates({
      internProfile: {
        primaryMentor: mentorA,
        secondaryMentor: mentorB,
        specializationAssignedAt: new Date('2024-01-01'),
      },
      workspace,
    });
    expect(result.emptyCause).toBeNull();
    expect(result.candidates).toEqual([mentorA, mentorB]);
  });

  it('filters out mentors who are not active members of the workspace', () => {
    const workspace = workspaceWith([activeMember(mentorA), inactiveMember(mentorB)]);
    const result = resolveReviewerCandidates({
      internProfile: {
        primaryMentor: mentorA,
        secondaryMentor: mentorB,
        specializationAssignedAt: new Date('2024-01-01'),
      },
      workspace,
    });
    expect(result).toEqual({ candidates: [mentorA], emptyCause: null });
  });

  it('returns not_workspace_members when mentors exist but none qualifies', () => {
    const workspace = workspaceWith([inactiveMember(mentorA)]);
    const result = resolveReviewerCandidates({
      internProfile: { primaryMentor: mentorA, secondaryMentor: null },
      workspace,
    });
    expect(result).toEqual({
      candidates: [],
      emptyCause: CANDIDATE_EMPTY_CAUSES.NOT_WORKSPACE_MEMBERS,
    });
  });
});

describe('assertReviewerEligible', () => {
  const mentorA = id('mentor-a');
  const stranger = id('stranger');

  it('accepts the primary mentor when they are an active workspace member', () => {
    const workspace = workspaceWith([activeMember(mentorA)]);
    expect(() =>
      assertReviewerEligible({
        reviewerId: mentorA,
        internProfile: { primaryMentor: mentorA, secondaryMentor: null },
        workspace,
      })
    ).not.toThrow();
  });

  it("refuses someone who is not one of the intern's mentors", () => {
    const workspace = workspaceWith([activeMember(stranger)]);
    expect(() =>
      assertReviewerEligible({
        reviewerId: stranger,
        internProfile: { primaryMentor: mentorA, secondaryMentor: null },
        workspace,
      })
    ).toThrow(/must be one of your own mentors/);
  });

  it('refuses a secondaryMentor with no specializationAssignedAt (legacy junk)', () => {
    const secondary = id('secondary');
    const workspace = workspaceWith([activeMember(secondary)]);
    expect(() =>
      assertReviewerEligible({
        reviewerId: secondary,
        internProfile: { primaryMentor: mentorA, secondaryMentor: secondary },
        workspace,
      })
    ).toThrow(/must be one of your own mentors/);
  });

  it('refuses a real mentor who is not an active member of the workspace', () => {
    const workspace = workspaceWith([]);
    expect(() =>
      assertReviewerEligible({
        reviewerId: mentorA,
        internProfile: { primaryMentor: mentorA, secondaryMentor: null },
        workspace,
      })
    ).toThrow(/not an active member of this workspace/);
  });
});

describe('transition legality', () => {
  describe('assertCanRequestReview', () => {
    it('refuses a caller who is not an intern', () => {
      expect(() => assertCanRequestReview({ isIntern: false, isAssignee: true })).toThrow(
        /Only an intern/
      );
    });

    it('refuses an intern who is not an assignee of the ticket', () => {
      expect(() => assertCanRequestReview({ isIntern: true, isAssignee: false })).toThrow(
        /Only an assignee/
      );
    });

    it('allows an intern assignee', () => {
      expect(() => assertCanRequestReview({ isIntern: true, isAssignee: true })).not.toThrow();
    });
  });

  describe('assertCanAnswerReview', () => {
    it('refuses anyone but the named reviewer', () => {
      expect(() => assertCanAnswerReview({ reviewerId: 'm1', actorId: 'm2' })).toThrow(
        /Only the requested reviewer/
      );
      expect(() => assertCanAnswerReview({ reviewerId: 'm1', actorId: null })).toThrow(
        /Only the requested reviewer/
      );
    });

    it('allows the named reviewer', () => {
      expect(() => assertCanAnswerReview({ reviewerId: 'm1', actorId: 'm1' })).not.toThrow();
    });
  });

  describe('assertCanCancelReview', () => {
    it('allows the requesting intern', () => {
      expect(() =>
        assertCanCancelReview({
          requestedById: 'intern1',
          reviewerId: 'mentor1',
          actorId: 'intern1',
          state: 'pending',
        })
      ).not.toThrow();
    });

    it('allows the named reviewer', () => {
      expect(() =>
        assertCanCancelReview({
          requestedById: 'intern1',
          reviewerId: 'mentor1',
          actorId: 'mentor1',
          state: 'pending',
        })
      ).not.toThrow();
    });

    it('refuses another assignee', () => {
      expect(() =>
        assertCanCancelReview({
          requestedById: 'intern1',
          reviewerId: 'mentor1',
          actorId: 'intern2',
          state: 'pending',
        })
      ).toThrow(/Only the requesting intern or the reviewer/);
    });

    it('refuses a workspace admin', () => {
      expect(() =>
        assertCanCancelReview({
          requestedById: 'intern1',
          reviewerId: 'mentor1',
          actorId: 'admin1',
          state: 'pending',
        })
      ).toThrow(/Only the requesting intern or the reviewer/);
    });

    it('refuses the requesting intern once the request is approved', () => {
      expect(() =>
        assertCanCancelReview({
          requestedById: 'intern1',
          reviewerId: 'mentor1',
          actorId: 'intern1',
          state: 'approved',
        })
      ).toThrow(/already been answered/);
    });

    it('refuses the reviewer once they have requested changes', () => {
      expect(() =>
        assertCanCancelReview({
          requestedById: 'intern1',
          reviewerId: 'mentor1',
          actorId: 'mentor1',
          state: 'changes_requested',
        })
      ).toThrow(/already been answered/);
    });

    // Authz outranks state: a stranger is told they are not a party, never that
    // the request has been answered — that would confirm a request exists.
    it('refuses a stranger before it looks at the state', () => {
      expect(() =>
        assertCanCancelReview({
          requestedById: 'intern1',
          reviewerId: 'mentor1',
          actorId: 'admin1',
          state: 'approved',
        })
      ).toThrow(/Only the requesting intern or the reviewer/);
    });
  });
});

describe('buildReviewRequest', () => {
  it('builds a pending request with derived PR parts', () => {
    const requestedAt = new Date('2024-05-01T00:00:00Z');
    const result = buildReviewRequest({
      prUrl: 'https://github.com/acme/widgets/pull/9',
      reviewer: 'mentor1',
      requestedBy: 'intern1',
      requestedAt,
    });
    expect(result).toEqual({
      reviewer: 'mentor1',
      state: 'pending',
      prUrl: 'https://github.com/acme/widgets/pull/9',
      owner: 'acme',
      repo: 'widgets',
      prNumber: 9,
      requestedBy: 'intern1',
      requestedAt,
      answeredAt: null,
    });
  });

  describe.each(['pending', 'approved', 'changes_requested'])(
    'replacing a request that was previously %s',
    (priorState) => {
      it(`resets to pending with a clean answeredAt, regardless of the prior ${priorState} state`, () => {
        // The builder takes no "previous" argument at all — replacement is
        // simply building fresh, from any state, since there is no separate
        // re-request path. Nothing from a prior request — reviewer, state,
        // answeredAt — can leak into the replacement.
        const result = buildReviewRequest({
          prUrl: 'https://github.com/acme/widgets/pull/1',
          reviewer: 'mentor2',
          requestedBy: 'intern1',
          requestedAt: new Date('2024-06-01T00:00:00Z'),
        });

        expect(result.state).toBe('pending');
        expect(result.answeredAt).toBeNull();
        expect(result.reviewer).toBe('mentor2');
      });
    }
  );

  it('rejects an invalid URL before building anything', () => {
    expect(() =>
      buildReviewRequest({
        prUrl: 'not-a-url',
        reviewer: 'mentor1',
        requestedBy: 'intern1',
        requestedAt: new Date(),
      })
    ).toThrow(/must look like/);
  });
});

describe('answerReviewRequest', () => {
  const pending = { state: 'pending', reviewer: 'mentor1' };

  it('sets approved and stamps answeredAt', () => {
    const answeredAt = new Date('2024-07-01T00:00:00Z');
    const result = answerReviewRequest({
      reviewRequest: pending,
      state: 'approved',
      answeredAt,
    });
    expect(result).toMatchObject({ state: 'approved', answeredAt });
  });

  it('sets changes_requested and stamps answeredAt', () => {
    const answeredAt = new Date('2024-07-02T00:00:00Z');
    const result = answerReviewRequest({
      reviewRequest: pending,
      state: 'changes_requested',
      answeredAt,
    });
    expect(result).toMatchObject({ state: 'changes_requested', answeredAt });
  });

  it('refuses any other state value', () => {
    expect(() =>
      answerReviewRequest({ reviewRequest: pending, state: 'rejected', answeredAt: new Date() })
    ).toThrow(/approved or changes requested/);
  });

  it('refuses answering a request that is not pending', () => {
    const answered = { state: 'approved', reviewer: 'mentor1' };
    expect(() =>
      answerReviewRequest({ reviewRequest: answered, state: 'approved', answeredAt: new Date() })
    ).toThrow(/already been answered/);
  });
});

describe('isReviewRequestStale', () => {
  it('is stale when the ticket status carries the isDone flag', () => {
    expect(
      isReviewRequestStale({ reviewRequest: { state: 'pending' }, isDone: true, isArchived: false })
    ).toBe(true);
  });

  it('is stale when the ticket is archived', () => {
    expect(
      isReviewRequestStale({ reviewRequest: { state: 'pending' }, isDone: false, isArchived: true })
    ).toBe(true);
  });

  it('is not stale otherwise', () => {
    expect(
      isReviewRequestStale({
        reviewRequest: { state: 'pending' },
        isDone: false,
        isArchived: false,
      })
    ).toBe(false);
  });

  it('is not stale when there is no request at all', () => {
    expect(isReviewRequestStale({ reviewRequest: null, isDone: true, isArchived: true })).toBe(
      false
    );
  });
});

describe('detectPullRequestMismatch', () => {
  it('reports agreement when the numbers match', () => {
    expect(detectPullRequestMismatch({ prNumber: 5, linkedPrNumber: 5 })).toBe(MISMATCH.AGREES);
  });

  it('reports disagreement when the numbers differ', () => {
    expect(detectPullRequestMismatch({ prNumber: 5, linkedPrNumber: 6 })).toBe(MISMATCH.DISAGREES);
  });

  it('reports nothing to compare against when there is no linked pull request', () => {
    expect(detectPullRequestMismatch({ prNumber: 5, linkedPrNumber: null })).toBe(
      MISMATCH.NO_COMPARISON
    );
  });

  it('reports nothing to compare against when there is no parsed PR number', () => {
    expect(detectPullRequestMismatch({ prNumber: null, linkedPrNumber: 5 })).toBe(
      MISMATCH.NO_COMPARISON
    );
  });
});

describe('describeReviewRequestHistory', () => {
  it('phrases a request', () => {
    expect(describeReviewRequestHistory('requested', { reviewerName: 'Alex' })).toBe(
      'Review requested from Alex'
    );
  });

  it('phrases a cancellation', () => {
    expect(describeReviewRequestHistory('cancelled', { actorName: 'Sam' })).toBe(
      'Review request cancelled by Sam'
    );
  });

  it('phrases an approval', () => {
    expect(describeReviewRequestHistory('approved')).toBe('Review approved');
  });

  it('phrases changes requested', () => {
    expect(describeReviewRequestHistory('changes_requested')).toBe('Changes requested');
  });

  it('phrases going stale, naming done vs archived', () => {
    expect(describeReviewRequestHistory('stale', { reason: 'done' })).toMatch(/ticket is done/);
    expect(describeReviewRequestHistory('stale', { reason: 'archived' })).toMatch(
      /ticket is archived/
    );
  });

  it('throws on an unknown transition', () => {
    expect(() => describeReviewRequestHistory('teleported')).toThrow(/Unknown review-request/);
  });
});
