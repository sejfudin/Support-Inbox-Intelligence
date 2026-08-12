import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Ban, FolderPlus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { cn } from '@/lib/utils';
import {
  getPositionProgressRows,
  getRequestLockLabel,
  getRequestTotals,
  isAwaitingProject,
} from '@/helpers/staffingRequests';
import { buildTechnologyIndex } from '@/helpers/technologyIcons';
import { useTechnologies } from '@/queries/technologies';
import { countStagedPicks } from '@/hooks/useStagedPicks';
import { AdminRequestSeatGroup } from './AdminRequestSeatGroup';
import { CloseRequestDialog } from './CloseRequestDialog';
import { RequestNote } from './RequestNote';
import { RequestStatusBadge } from './RequestStatusBadge';
import { ResolveProjectDialog } from './ResolveProjectDialog';
import { formatDay, getNeededBy, getRequestBlocker, getRequestTitle } from './requestPresentation';

const Blocker = ({ blocker, action }) => (
  <div
    className={cn(
      'symphony-notice',
      blocker.tone === 'warning' && 'symphony-notice-warning',
      blocker.tone === 'success' && 'symphony-notice-success',
      blocker.tone === 'info' && 'symphony-notice-info'
    )}
    data-test="request-blocker"
  >
    <blocker.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-2">
      <p>{blocker.text}</p>
      {action}
    </div>
  </div>
);

/**
 * The admin's side of a staffing request. Leadership's detail pane asks and
 * watches; this one fills seats and sends an answer, so the two no longer share
 * a component — the shared one (`RequestDetail`) stays exactly as leadership
 * needs it.
 *
 * Picking writes nothing until `Submit to leadership`. Picks are staged into the
 * page's cart, and the submit sends the whole cart as one act: one insert, one
 * history event, one badge, however many seats it spans.
 *
 * The two ways an admin ends a request live here too — close as fulfilled, and
 * decline — because both are admin-only. Cancelling is leadership's and is
 * absent from this screen (see `RequestActions`).
 */
export function AdminRequestDetail({
  request,
  cart,
  onArm,
  onUnstage,
  onSubmit,
  isSubmitting,
  rejections,
}) {
  const [resolveOpen, setResolveOpen] = useState(false);
  // Which close dialog is open, if any: 'fulfilled' | 'declined' | null. The
  // admin owns both of those reasons; cancelling belongs to leadership and is
  // absent from this screen entirely.
  const [closeReason, setCloseReason] = useState(null);
  // Which cards the admin has opened or closed by hand, `{ [positionId]: bool }`.
  // Absent means closed: every position starts compact, and the roster behind it
  // is opened on request. A request with four positions is then four readable
  // lines rather than a pane the admin has to scroll to see what it asked for.
  const [expandOverrides, setExpandOverrides] = useState({});
  const rows = getPositionProgressRows(request);
  const blocker = getRequestBlocker(request);
  const totals = getRequestTotals(request);
  const neededBy = getNeededBy(request);
  const stagedCount = countStagedPicks(cart);
  const isOpen = request.status !== 'closed';
  const needsProject = isAwaitingProject(request);
  const canStage = isOpen && !needsProject;

  // One action slot, one action in it. A request that still names a project
  // nobody created cannot be answered at all, so resolving it *is* the next
  // step — offering both buttons made the admin choose between a live control
  // and a dead one. The reason it is dead is not repeated here either: the
  // blocker banner below already says it, in more words than a button caption
  // has room for.
  const refusal =
    isOpen && !needsProject && stagedCount === 0
      ? 'Nothing staged yet. Add candidates to a seat and they collect here.'
      : null;

  // Only for the technology logos on the position headers — rows carry names, and
  // the icon map keys off slugs. Shared, long-cached query.
  const { data: allTechnologies = [] } = useTechnologies();
  const technologyIndex = useMemo(() => buildTechnologyIndex(allTechnologies), [allTechnologies]);

  // Closed unless the admin opened it — or unless it holds a pick the server
  // refused, which is the one thing that must not stay hidden.
  const hasRejection = (row) => (cart[row.id] ?? []).some((pick) => rejections[row.id]?.[pick.id]);
  const isExpanded = (row) => expandOverrides[row.id] ?? hasRejection(row);

  const setExpanded = useCallback(
    (positionId, next) => setExpandOverrides((current) => ({ ...current, [positionId]: next })),
    []
  );

  // A refused pick opens its own card, overriding a hand-collapse: the refusal
  // names a position, and a position the admin cannot see is the same as no
  // refusal at all.
  useEffect(() => {
    const refused = Object.keys(rejections);
    if (refused.length === 0) return;
    setExpandOverrides((current) => {
      const next = { ...current };
      refused.forEach((positionId) => delete next[positionId]);
      return next;
    });
  }, [rejections]);

  const anyExpanded = rows.some(isExpanded);
  const toggleAll = () =>
    setExpandOverrides(Object.fromEntries(rows.map((row) => [row.id, !anyExpanded])));

  return (
    <SymphonyCard className="space-y-5">
      {/* Title first, and the filing details demoted to the line above it. The
          request is identified by its project, not by its status — the status is
          one fact about it, so it rides along with who filed it and when. */}
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        data-test={`request-detail-${request.id}`}
      >
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <RequestStatusBadge request={request} />
            <p className="text-sm text-muted-foreground">
              {`Filed ${formatDay(request.createdAt) ?? '—'}`}
              {request.author?.fullname && ` by ${request.author.fullname}`}
            </p>
            {request.project?._id && (
              <Link
                to={`/projects/${request.project._id}`}
                className="symphony-link inline-flex items-center gap-0.5 text-sm"
              >
                View project
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {getRequestTitle(request)}
          </h2>

          {/* One line for where the request stands. `placed of wanted` leads
              because it is the only number that says whether the ask is answered
              — the rest are steps on the way there. */}
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {totals.placed} of {totals.wanted}
            </span>
            {` ${totals.wanted === 1 ? 'seat' : 'seats'} placed`}
            {totals.putForward > 0 && ` · ${totals.putForward} put forward`}
            {stagedCount > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-[hsl(var(--symphony-brand-ink))]">
                  {stagedCount} staged
                </span>
              </>
            )}
            {' · '}
            <span className={cn(neededBy.overdue && 'symphony-date-urgent')}>
              {neededBy.missing ? 'no needed-by date' : `due ${neededBy.short}`}
              {neededBy.sub && ` · ${neededBy.sub}`}
            </span>
          </p>
        </div>

        {/* `RequestActions` is leadership's — its edit / cancel / resolve set is
            written around `canManage` and the viewer's role. The admin pane has
            one primary action at a time, so it renders its own slot. */}
        <div className="flex flex-col items-end gap-1.5">
          {!isOpen ? (
            <span className="text-xs text-muted-foreground">
              Locked · {getRequestLockLabel(request).toLowerCase()}
              {request.closedBy?.fullname && ` by ${request.closedBy.fullname}`}
            </span>
          ) : needsProject ? (
            <Button
              type="button"
              onClick={() => setResolveOpen(true)}
              className="gap-2"
              data-test="request-resolve-project"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              Resolve project
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={onSubmit}
                disabled={stagedCount === 0 || isSubmitting}
                className="gap-2"
                data-test="submit-picks"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {isSubmitting
                  ? 'Sending…'
                  : stagedCount === 0
                    ? 'Submit to leadership'
                    : `Submit ${stagedCount} ${stagedCount === 1 ? 'pick' : 'picks'} to leadership`}
              </Button>
              {refusal && (
                <p className="text-right text-xs text-muted-foreground" data-test="submit-refusal">
                  {refusal}
                </p>
              )}
            </>
          )}
          {/* Answering "no" outlives whichever primary action is in the slot, so
              it sits below the branch rather than inside one of them. A request
              that still needs a project is exactly when an admin wants to
              decline — there is no capacity, and resolving a project first just
              to refuse the ask is busywork. The server agrees: only `fulfilled`
              is refused while the project is a draft.

              An outlined button rather than a text link: declining is one of the
              two answers an admin owes leadership, and a grey underline read as
              a footnote. It carries the destructive colour so the tone is
              unmistakable, but stays unfilled — the filled button is whatever
              moves the request forward, and there should only ever be one. */}
          {isOpen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCloseReason('declined')}
              className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              data-test="request-decline"
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Decline this request
            </Button>
          )}
        </div>
      </div>

      <ResolveProjectDialog open={resolveOpen} onOpenChange={setResolveOpen} request={request} />
      <CloseRequestDialog
        open={Boolean(closeReason)}
        onOpenChange={(next) => !next && setCloseReason(null)}
        request={request}
        reason={closeReason}
      />

      {blocker && (
        <Blocker
          blocker={blocker}
          // Demand met is a prompt, never an action: nothing closes a request on
          // its own, because closing writes a mandatory reason onto other
          // people's records. So the banner carries the button that opens the
          // dialog — and only on this screen, because only an admin may fulfil.
          action={
            blocker.key === 'demand-met' ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCloseReason('fulfilled')}
                data-test="request-close-fulfilled"
              >
                Close as fulfilled
              </Button>
            ) : null
          }
        />
      )}

      {request.closeNote?.trim() && (
        <section className="space-y-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Why it was closed
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
            {request.closeNote}
          </p>
        </section>
      )}

      <RequestNote request={request} />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Seats asked for
          </p>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-foreground"
              data-test="toggle-all-positions"
            >
              {anyExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
        {/* One card per requested position, each opening and closing on its own.
            A divided list read as a single long form; these are the units of the
            work. */}
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No positions on this request.</p>
          ) : (
            rows.map((row) => (
              <AdminRequestSeatGroup
                key={row.id}
                row={row}
                stagedPicks={cart[row.id] ?? []}
                rejections={rejections[row.id] ?? {}}
                expanded={isExpanded(row)}
                onExpandedChange={(next) => setExpanded(row.id, next)}
                onArm={onArm}
                onUnstage={onUnstage}
                canStage={canStage}
                technologyIndex={technologyIndex}
              />
            ))
          )}
        </div>
      </div>
    </SymphonyCard>
  );
}
