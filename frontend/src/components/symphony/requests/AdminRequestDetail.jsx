import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { cn } from '@/lib/utils';
import {
  getPositionProgressRows,
  getRequestTotals,
  isAwaitingProject,
} from '@/helpers/staffingRequests';
import { countStagedPicks } from '@/hooks/useStagedPicks';
import { AdminRequestSeatGroup } from './AdminRequestSeatGroup';
import { RequestActions } from './RequestActions';
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

  // Why the button is off, in the button's own words. A disabled control that
  // doesn't say why is a dead end — and for the draft-project case the fix is
  // right beside it rather than only in the header.
  const refusal = !isOpen
    ? 'This request is closed — nothing more can be sent.'
    : needsProject
      ? 'This request names a project that does not exist yet. Recommendations need a real project, so resolve it before sending picks.'
      : stagedCount === 0
        ? 'Nothing staged yet. Add candidates to a seat and they collect here.'
        : null;

  return (
    <SymphonyCard className="space-y-5">
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        data-test={`request-detail-${request.id}`}
      >
        <RequestStatusBadge request={request} />
        <RequestActions request={request} canManage={false} onEdit={() => {}} onClose={() => {}} />
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

      {/* The one action this screen exists for. Closing and editing are
          leadership-side or a later ticket; neither competes with it here. */}
      <div className="space-y-2">
        <Button
          type="button"
          onClick={onSubmit}
          disabled={Boolean(refusal) || isSubmitting}
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground" data-test="submit-refusal">
              {refusal}
            </p>
            {needsProject && isOpen && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => setResolveOpen(true)}
                data-test="submit-resolve-project"
              >
                <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Resolve project
              </Button>
            )}
          </div>
        )}
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

      <div className="space-y-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Seats asked for
        </p>
        <div className="divide-y divide-border/60 border-t border-border/60">
          {rows.length === 0 ? (
            <p className="py-5 text-sm text-muted-foreground">No positions on this request.</p>
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
