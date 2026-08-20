# A review request names its own pull request, and does not reconcile with the linked one

## Status

accepted

## Context

A ticket can already carry a pull request. `Ticket.linkedPullRequest` holds `prNumber`, `prTitle`,
`branchName`, `state`, `isDraft`, `author` and more, and **nobody types it**: the GitHub App's
`pull_request` webhook parses a task number out of the branch name or PR title and links the ticket
automatically (`services/autoLinkService.js`, `helpers/taskExtractor.js`). It stays live — `state`
flips to `merged`, and the workspace can auto-move the ticket on open and on merge.

So when a review request needs to say *what* to review, reusing that field looks obvious. It is not,
for two reasons.

**The webhook only links what it can recognise.** Auto-link needs a connected repo and a task number
in the branch or title. A workspace that never installed the GitHub App has no `Integration` at all,
and a branch named `fix-login` links to nothing. Making review requests depend on auto-link would
make the feature unavailable to exactly the teams working the most manually.

**The two facts have different authors and different meanings.** `linkedPullRequest` is what GitHub
*reports*. A review request's PR is what the intern *claims* the reviewer should look at. Writing
the intern's claim into the webhook's field means an unverified string sitting in a document whose
other fields are verified, with no `state` or `author`, waiting to be overwritten by the next
webhook.

Alternatives considered:

- **Require an auto-linked PR; no typed URL.** Cleanest data, one writer. Rejected: it gates the
  whole feature on a GitHub App install and a branch naming convention, and offers no workaround
  when either is missing.
- **Prompt for a URL and write it into `linkedPullRequest`.** One field, no duplication. Rejected:
  it gives that field two writers with different trust levels, drops the fields a hand-typed URL
  cannot supply, and the next webhook silently overwrites what the intern typed.
- **No PR at all — the request is a bare "please look at this ticket" ping.** Rejected: an ask with
  nothing to look at is the thing this feature replaces.
- **Reconcile the two, rejecting a request whose URL disagrees with the linked PR.** Rejected: the
  auto-link can legitimately be stale — a previous branch for the same ticket — and the webhook is
  not always right. Blocking on a disagreement stops a valid request because of a bad guess.

## Decision

**The review request carries its own pull-request URL, typed by the intern and required. It is
stored separately from `linkedPullRequest`, and the two are never reconciled.**

- The URL must be `https://github.com/<owner>/<repo>/pull/<n>`. Nothing else is accepted — not a
  `compare/` link, not a commit, not another host.
- The validator parses `owner`, `repo` and `prNumber` and stores them as **derived** fields, written
  only by the validator, never edited, never rendered directly. They exist so the mismatch check and
  a future GitHub integration do not have to re-parse the string in three places.
- A valid URL is **not** proof the pull request exists, is open, or belongs to the intern. Nothing
  fetches it, previews it, or reads state from it. It renders as a link and nothing more.
- When the parsed `prNumber` differs from `linkedPullRequest.prNumber`, the ticket **warns** and
  allows the request. It never blocks, and it never rewrites either value.
- `linkedPullRequest` keeps its single writer: the webhook. The review request's URL keeps its
  single writer: the requesting intern.

## Consequences

- Review requests work with no GitHub App installed, no connected repo, and no branch naming
  convention — the manual path is the *only* path in v1, so nothing about the feature depends on the
  integration.
- Two links to one pull request can be visible on one ticket and can disagree. This is intended, and
  the warning is the whole of the handling. Anyone "fixing" it by reconciling them will reintroduce
  the rejected alternative above.
- When the full GitHub integration lands (reviewers mirrored to GitHub via a `User → githubLogin`
  mapping), the typed URL stops being a source of truth and becomes a **fallback** for tickets with
  no auto-linked PR. It should shrink, not grow. Nothing must be built that treats it as
  authoritative — no fetching PR state from it, no deriving the repo to call the API against.
- Reversing this means a migration: the typed URLs are real data on real tickets, and folding them
  into `linkedPullRequest` would mix verified and unverified values in one field. Meaningful cost,
  hence this ADR.
