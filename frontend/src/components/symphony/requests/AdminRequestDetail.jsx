import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { cn } from '@/lib/utils';
import {
  getPositionProgressRows,
  getRequestLockLabel,
  getRequestTotals,
  isAwaitingProject,
} from '@/helpers/staffingRequests';
import { countStagedPicks } from '@/hooks/useStagedPicks';
import { AdminRequestSeatGroup } from './AdminRequestSeatGroup';
import { RequestNote } from './RequestNote';
import { RequestStatusBadge } from './RequestStatusBadge';
import { ResolveProjectDialog } from './ResolveProjectDialog';
import { formatDay, getNeededBy, getRequestBlocker, getRequestTitle } from './requestPresentation';

const Blocker = ({ blocker }) => (
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
    <p>{blocker.text}</p>
  </div>
);

/**
 * The admin's side of a staffing request. Leadership's detail pane asks and
 * watches; this one fills seats and sends an answer, so the two no longer share
 * a component — the shared one (`RequestDetail`) stays exactly as leadership
 * needs it.
 *
 * Nothing on this screen writes until `Submit to leadership`. Picks are staged
 * into the page's cart, and the submit sends the whole cart as one act: one
 * insert, one history event, one badge, however many seats it spans.
 */
export function AdminRequestDetail({
  request,
  cart,
  armedRow,
  onArm,
  onUnstage,
  onSubmit,
  isSubmitting,
  rejections,
}) {
  const [resolveOpen, setResolveOpen] = useState(false);
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

  return (
    <SymphonyCard className="space-y-5">
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        data-test={`request-detail-${request.id}`}
      >
        <RequestStatusBadge request={request} />

        {/* `RequestActions` is leadership's — its edit / cancel / resolve set is
            written around `canManage` and the viewer's role. The admin pane has
            exactly one action, so it renders it itself. */}
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
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {getRequestTitle(request)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {`Filed ${formatDay(request.createdAt) ?? '—'}`}
          {request.author?.fullname && ` by ${request.author.fullname}`}
          {request.project?._id && (
            <>
              {' · '}
              <Link to={`/projects/${request.project._id}`} className="symphony-link">
                View project
              </Link>
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {totals.wanted} {totals.wanted === 1 ? 'seat' : 'seats'}
          {' · '}
          <span className="font-semibold text-foreground">{totals.placed} placed</span>
          {' · '}
          {totals.putForward} put forward
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
            {neededBy.sub && ` — ${neededBy.sub}`}
          </span>
        </p>
      </div>

      <ResolveProjectDialog open={resolveOpen} onOpenChange={setResolveOpen} request={request} />

      {blocker && <Blocker blocker={blocker} />}

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
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Seats asked for
        </p>
        {/* One card per seat, each opening and closing on its own. A divided
            list read as a single long form; these are the units of the work. */}
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
                armed={armedRow?.id === row.id}
                onArm={onArm}
                onUnstage={onUnstage}
                canStage={canStage}
              />
            ))
          )}
        </div>
      </div>
    </SymphonyCard>
  );
}
